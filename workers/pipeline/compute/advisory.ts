/**
 * Generate the daily advisory (2-3 sentences) — the single most consequential
 * delta of the past 24 hours.
 */

import type { Env } from '../index';

const MODEL = 'claude-haiku-4-5-20251001';

export async function writeAdvisory(indicators: any[], env: Env) {
  const summary = indicators.map(i => ({
    id: i.id,
    status: i.status,
    count: i.count_today,
    avg: i.count_avg_90,
    trend: i.trend_dir,
    delta: i.trend_n,
    notable: (i.events || []).slice(0, 2).map((e: any) => e.text),
  }));

  const sourceList = indicators.map(i => i.source).filter(Boolean);
  const fallback = {
    title_key: 'advisory_title',
    text_key: 'advisory_text',
    text: defaultAdvisory(summary),
    sources: sourceList.slice(0, 1),
  };

  if (!env.ANTHROPIC) return fallback;

  const prompt = `You write the daily advisory for The Civic Forecast — a public site that reports U.S. civic conditions like a weather report.

The advisory: 2-3 sentences. The single most consequential delta of the past 24 hours. Calm observational voice.

CONSTRAINTS:
- Never names a party, person, or sitting administration.
- No exclamation marks.
- Specific enough to be useful, abstract enough to be neutral.
- Identify the indicator(s) that drove the delta.
- 2-3 sentences. Under 80 words total.

INDICATORS TODAY:
${JSON.stringify(summary, null, 2)}

Pick the single most consequential change and write the advisory. Reply with the advisory text only.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`anthropic advisory: ${r.status}`);
    const data: any = await r.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text || /\b(democrat|republican|biden|trump|harris|gop|administration)\b/i.test(text)) {
      return fallback;
    }
    return {
      title_key: 'advisory_title',
      text,
      sources: sourceList.slice(0, 1),
    };
  } catch (e) {
    console.error('[advisory]', e);
    return fallback;
  }
}

function defaultAdvisory(summary: any[]): string {
  const biggest = summary.reduce((a, b) => (b.delta > a.delta ? b : a), summary[0] || { id: '', delta: 0 });
  if (biggest.delta < 2) {
    return 'No single indicator moved sharply in the past day. The pattern remains consistent with the rolling baseline.';
  }
  return `The ${biggest.id} indicator shifted notably this week, with a ${biggest.trend} of ${biggest.delta}. The change is the largest delta among the six tracked systems.`;
}
