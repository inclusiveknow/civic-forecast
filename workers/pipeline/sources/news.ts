/**
 * News RSS aggregator — pulls from multiple free, reliable feeds and
 * classifies each headline to one of the six indicators by keyword.
 *
 * Free, no key required. Sources chosen for civic relevance and stable
 * RSS contracts:
 *   - NPR National News        — feeds.npr.org/1003/rss.xml
 *   - NPR Politics              — feeds.npr.org/1014/rss.xml
 *   - ProPublica                — propublica.org/feeds/propublica/main
 *   - Federal Register Top      — federalregister.gov/api/v1/documents.rss
 *   - Reuters US Politics       — via Google News RSS proxy
 *
 * If a feed fails the others still ship. If ALL feeds fail, the Worker
 * falls back to last-known-good news from KV.
 */

import type { Env } from '../index';

const FEEDS = [
  { name: 'NPR National',     url: 'https://feeds.npr.org/1003/rss.xml',                 weight: 1.1 },
  { name: 'NPR Politics',     url: 'https://feeds.npr.org/1014/rss.xml',                 weight: 1.2 },
  { name: 'ProPublica',       url: 'https://www.propublica.org/feeds/propublica/main',   weight: 1.3 },
  { name: 'Federal Register', url: 'https://www.federalregister.gov/api/v1/documents.rss?conditions[type][]=PRESDOCU&conditions[type][]=PRORULE', weight: 0.9 },
  { name: 'AP via Google',    url: 'https://news.google.com/rss/search?q=when:1d+%22Associated+Press%22+(court+OR+protest+OR+FOIA+OR+executive+order+OR+journalist+OR+Congress)&hl=en-US&gl=US&ceid=US:en', weight: 1.0 },
];

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  pub_date: string;     // ISO
  image: string | null;
  description: string;
  indicators: string[];
  score: number;
  weight: number;
}

export async function fetchNews(env: Env): Promise<{ items: NewsItem[]; fetched_at: string }> {
  const results = await Promise.allSettled(
    FEEDS.map(f =>
      fetchFeed(f.url).then(items => items.map(i => ({ ...i, source: f.name, weight: f.weight })))
    )
  );

  const items: NewsItem[] = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value);
    } else {
      console.warn(`[news] ${FEEDS[idx].name} failed:`, r.reason?.message || r.reason);
    }
  });

  // Classify + score each item
  const classified = items.map(i => {
    const { indicators, score } = classify(i.headline + ' ' + (i.description || ''));
    return { ...i, indicators, score };
  });

  // Filter to only items that touch a civic indicator
  const civic = classified.filter(i => i.indicators.length > 0);

  // De-dup by headline (lowercase, alphanumeric)
  const seen = new Set<string>();
  const unique: NewsItem[] = [];
  for (const item of civic) {
    const key = item.headline.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return { items: unique, fetched_at: new Date().toISOString() };
}

// =====================================================================
// RSS parsing — minimal, regex-based, Workers-runtime compatible
// =====================================================================

async function fetchFeed(url: string): Promise<NewsItem[]> {
  const r = await fetchWithRetry(url, 2);
  if (!r.ok) throw new Error(`feed ${url}: ${r.status}`);
  const xml = await r.text();
  return parseRSS(xml);
}

async function fetchWithRetry(url: string, attempts: number): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, {
        headers: {
          'user-agent': 'CivicForecast/1.0 (+https://civicforecast.org)',
          accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        cf: { cacheTtl: 600, cacheEverything: true } as any,
      });
      if (r.ok || r.status === 304) return r;
      lastErr = new Error(`status ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) await sleep(400 * (i + 1));
  }
  throw lastErr;
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  // Match each <item>...</item> (RSS) or <entry>...</entry> (Atom)
  const blockRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml))) {
    const block = m[2];
    const headline = decodeXml(stripCdata(extract(block, 'title') || '')).trim();
    if (!headline) continue;
    const link = extractLink(block);
    const pub = extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated') || '';
    const description = decodeXml(stripCdata(extract(block, 'description') || extract(block, 'summary') || extract(block, 'content') || '')).replace(/<[^>]+>/g, '').slice(0, 400);
    const image = extractImage(block, description);

    items.push({
      headline,
      source: '',
      url: link,
      pub_date: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      image,
      description,
      indicators: [],
      score: 0,
      weight: 1,
    });
  }
  return items;
}

function extract(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function extractLink(block: string): string {
  // RSS: <link>url</link>. Atom: <link href="url" .../>
  const rssLink = extract(block, 'link');
  if (rssLink && /^https?:/.test(rssLink)) return rssLink;
  const atomMatch = block.match(/<link\b[^>]*href="([^"]+)"/i);
  if (atomMatch) return atomMatch[1];
  // Google News wraps the real link in description sometimes
  const descLink = block.match(/<a[^>]+href="(https?:[^"]+)"/i);
  if (descLink) return descLink[1];
  return '';
}

function extractImage(block: string, description: string): string | null {
  // Try every well-known place an RSS image can hide.
  // 1) <media:thumbnail url="..."/>
  let m = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (m) return m[1];
  // 2) <media:content url="..." medium="image"/>
  m = block.match(/<media:content[^>]+url="([^"]+)"[^>]*(?:medium="image"|type="image)/i);
  if (m) return m[1];
  // 3) <enclosure url="..." type="image/..."/>
  m = block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image\//i);
  if (m) return m[1];
  // 4) <image><url>...</url></image>
  m = block.match(/<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i);
  if (m) return m[1];
  // 5) An <img> tag inside description / content
  m = description.match(/<img[^>]+src="([^"]+)"/i);
  if (m) return m[1];
  // 6) ProPublica often inlines; check raw block for <img>
  m = block.match(/<img[^>]+src="([^"]+)"/i);
  if (m) return m[1];
  return null;
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================================
// Indicator classification — keyword-based, fast, deterministic
// Each headline is scored against each indicator's keyword set; any
// indicator with score > 0 gets tagged.
// =====================================================================

const KW: Record<string, RegExp[]> = {
  press: [
    /\bjournalist(s)?\b/i,
    /\breporter(s)?\b/i,
    /\bpress freedom\b/i,
    /\bnewsroom\b/i,
    /\bpress credentials?\b/i,
    /\bsubpoena(ed)?\s+(reporter|journalist|news)/i,
    /\bphotographer\s+(arrest|detain|seiz)/i,
  ],
  courts: [
    /\b(supreme court|federal court|appeals court|circuit court|district court)\b/i,
    /\b(judge|justice)s?\b.*\b(rule|ruling|order|opinion|dismiss|grant|deny|block|uphold)/i,
    /\bcourt (rule|ruling|order|opinion|decide|dismiss|block|uphold)/i,
    /\b(injunction|temporary restraining order|stay|writ)\b/i,
    /\bvoting rights?\b/i,
    /\bfirst amendment\b/i,
  ],
  sunlight: [
    /\bFOIA\b/i,
    /\bfreedom of information\b/i,
    /\bpublic records?\b.*\b(deni|reject|withhold|redact)/i,
    /\b(transparen|opaque|secret|classifi)\w*/i,
    /\bagency.*\b(refuse|deny|withhold|redact)/i,
  ],
  chamber: [
    /\bcongress\b/i,
    /\bsenate\b/i,
    /\bhouse of representatives\b/i,
    /\bspeaker (of the house|johnson|jeffries|pelosi)\b/i,
    /\b(roll[- ]call vote|cloture|filibuster|recess|quorum)\b/i,
    /\b(committee|subcommittee).*hearing\b/i,
    /\bbipartisan\b/i,
    /\bappropriations?\b/i,
  ],
  streets: [
    /\bprotest(s|er|ers|ed|ing)?\b/i,
    /\b(rally|rallies|march|marches|demonstration|demonstrators?)\b/i,
    /\b(use of force|teargas|tear gas|rubber bullets|kettled)\b/i,
    /\b(occupy|sit-in|walkout)\b/i,
    /\bcounter[- ]protest/i,
  ],
  record: [
    /\bexecutive order\b/i,
    /\bpresidential (proclamation|memorand)/i,
    /\bfederal register\b/i,
    /\b(rule|rulemaking).*\b(propose|finalize|issue|withdraw)/i,
    /\b(comment period|public comment)\b/i,
    /\b(EPA|HHS|DHS|DOJ|DOL|HUD|USDA|FTC|FCC|SEC|FAA|NHTSA|OSHA)\b.*\b(rule|order|action|propose)/i,
  ],
};

function classify(text: string): { indicators: string[]; score: number } {
  const indicators: string[] = [];
  let total = 0;
  for (const [id, patterns] of Object.entries(KW)) {
    let count = 0;
    for (const re of patterns) {
      if (re.test(text)) count += 1;
    }
    if (count > 0) {
      indicators.push(id);
      total += count;
    }
  }
  return { indicators, score: total };
}
