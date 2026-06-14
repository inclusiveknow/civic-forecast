/**
 * THE CIVIC FORECAST — daily pipeline
 *
 * Cloudflare Worker triggered by cron. Each morning:
 *   04:00 ET — pull from all six public sources + RSS news feeds
 *   05:00 ET — compute readings + LLM-write the sentence + advisory
 *   06:00 ET — publish to KV (and the static site fetches /api/today)
 *
 * Resilience contract:
 *   - Every source fetch is in Promise.allSettled — one failure does not
 *     crash the rest.
 *   - Every source has a per-source last-known-good in KV. If today's
 *     pull fails, the previous pull is reused so the page never blanks.
 *   - The LLM-written sentence falls back to a deterministic template if
 *     the Anthropic call fails or returns invalid output.
 *   - The whole today's reading is preserved in KV for 25 hours so that
 *     even if the entire pipeline fails, the previous day's reading is
 *     still served to the page.
 *
 * Endpoints (Worker):
 *   POST /run     — manually trigger the full pipeline
 *   GET  /today   — return today's reading (JSON; what the page fetches)
 *   GET  /health  — last-success timestamp per source
 *
 * Cron times are UTC. 04:00 ET = 08:00 UTC, etc. (EST. ET shifts an hour
 * during DST; the Worker reads scheduledTime if it needs precision.)
 */

import { fetchPress } from './sources/press';
import { fetchCourts } from './sources/courts';
import { fetchSunlight } from './sources/sunlight';
import { fetchChamber } from './sources/chamber';
import { fetchStreets } from './sources/streets';
import { fetchRecord } from './sources/record';
import { fetchNews } from './sources/news';
import { computeReadings } from './compute/readings';
import { computeGeography } from './compute/geography';
import { writeSentence } from './compute/reading-sentence';
import { writeAdvisory } from './compute/advisory';
import { rankStories } from './compute/stories';
import { buildPage } from './publish/build-page';
import { archiveSnapshot } from './publish/archive';

export interface Env {
  READINGS: KVNamespace;
  ARCHIVE: R2Bucket;
  PROPUBLICA: string;
  ACLED: string;
  COURTLISTENER: string;
  ANTHROPIC: string;
}

const SOURCES = ['press', 'courts', 'sunlight', 'chamber', 'streets', 'record', 'news'] as const;
type SourceName = typeof SOURCES[number];

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runPipeline(env, event.scheduledTime));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/run' && req.method === 'POST') {
      const result = await runPipeline(env, Date.now());
      return jsonResponse(result);
    }
    if (url.pathname === '/today') {
      const today = await env.READINGS.get('today', 'json');
      return jsonResponse(today, 300);
    }
    if (url.pathname === '/health') {
      const health: Record<string, any> = { ok: true, sources: {} };
      for (const s of SOURCES) {
        const meta = await env.READINGS.get(`source:${s}:meta`, 'json') as any;
        health.sources[s] = meta || { last_success: null, last_error: null };
      }
      const today = await env.READINGS.get('today', 'json') as any;
      health.last_publish = today?.generated_at || null;
      return jsonResponse(health, 60);
    }
    return new Response(
      'civic-forecast pipeline\n' +
      '  POST /run    — run the daily pipeline now\n' +
      '  GET  /today  — today\'s reading JSON\n' +
      '  GET  /health — per-source last success / error\n',
      { status: 200, headers: { 'content-type': 'text/plain' } }
    );
  },
};

function jsonResponse(data: any, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

async function runPipeline(env: Env, scheduledTime: number) {
  const log: string[] = [];
  const t0 = Date.now();
  log.push(`pipeline start ${new Date(scheduledTime).toISOString()}`);

  // ==== 1. Pull every source in parallel, with last-known-good fallback ====
  const fetchers = {
    press:    () => fetchPress(env),
    courts:   () => fetchCourts(env),
    sunlight: () => fetchSunlight(env),
    chamber:  () => fetchChamber(env),
    streets:  () => fetchStreets(env),
    record:   () => fetchRecord(env),
    news:     () => fetchNews(env),
  };

  const sources: Record<string, any> = {};
  await Promise.all(
    Object.entries(fetchers).map(async ([name, fn]) => {
      sources[name] = await pullWithFallback(name as SourceName, fn, env, log);
    })
  );

  // ==== 2. Compute readings (status, tone, trend, sparkline) ====
  const indicators = await computeReadings(sources, env);

  // ==== 3. Compute geography (atmospheric regions for the map) ====
  const indicatorsWithGeo = await computeGeography(indicators);

  // ==== 4. Composite pressure + feeling ====
  const pressure = computePressure(indicatorsWithGeo);
  const feeling = pressureToFeeling(pressure);
  const signal = computeSignal(indicatorsWithGeo);

  // ==== 5. LLM-written sentence + advisory (with fallback) ====
  const sentence = await writeSentence(indicatorsWithGeo, env);
  const advisory = await writeAdvisory(indicatorsWithGeo, env);

  // ==== 6. Rank top stories from the news pool ====
  const newsItems = sources.news?.items || [];
  const topStories = rankStories(newsItems, indicatorsWithGeo);

  // ==== 7. Past 6 days from KV for the seven-day strip ====
  const sixDays = await loadSixDays(env);

  // ==== 8. Assemble + persist ====
  const reading = {
    date: new Date().toISOString(),
    generated_at: new Date().toISOString(),
    feeling,
    pressure,
    signal,
    reading_sentence: sentence,
    six_days: [...sixDays, { date: todayDate(), feeling, pressure, today: true }],
    top_stories: topStories,
    indicators: indicatorsWithGeo,
    advisory,
  };

  await env.READINGS.put('today', JSON.stringify(reading), { expirationTtl: 60 * 60 * 25 });
  await env.READINGS.put(`day:${todayDate()}`, JSON.stringify(reading), { expirationTtl: 60 * 60 * 24 * 365 });
  await archiveSnapshot(reading, env);
  await buildPage(reading, env);

  const elapsed = Date.now() - t0;
  log.push(`pipeline complete ${elapsed}ms`);
  return { ok: true, elapsed_ms: elapsed, log, top_stories_count: topStories.length };
}

// =====================================================================
// Resilience: per-source last-known-good in KV
// =====================================================================
async function pullWithFallback(name: SourceName, fn: () => Promise<any>, env: Env, log: string[]) {
  try {
    const data = await fn();
    await env.READINGS.put(`source:${name}:lkg`, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 });
    await env.READINGS.put(`source:${name}:meta`, JSON.stringify({
      last_success: new Date().toISOString(),
      last_error: null,
    }), { expirationTtl: 60 * 60 * 24 * 30 });
    log.push(`source ${name}: OK`);
    return data;
  } catch (e: any) {
    const lkg = await env.READINGS.get(`source:${name}:lkg`, 'json');
    await env.READINGS.put(`source:${name}:meta`, JSON.stringify({
      last_success: (await env.READINGS.get(`source:${name}:meta`, 'json') as any)?.last_success || null,
      last_error: { at: new Date().toISOString(), message: e.message || String(e) },
    }), { expirationTtl: 60 * 60 * 24 * 30 });
    log.push(`source ${name}: FAIL (${e.message}), using last-known-good`);
    return lkg;
  }
}

function computePressure(indicators: any[]): number {
  const TONE_WEIGHTS = { clear: 0, mild: 10, watch: 35, warning: 60, storm: 85, severe: 100 };
  const weights: Record<string, number> = { press: 1.15, courts: 1.0, sunlight: 1.15, chamber: 1.0, streets: 1.0, record: 1.0 };
  const total = indicators.reduce((sum, ind) => {
    const w = weights[ind.id] ?? 1.0;
    const v = TONE_WEIGHTS[ind.tone as keyof typeof TONE_WEIGHTS] ?? 35;
    return sum + v * w;
  }, 0);
  const totalWeight = indicators.reduce((s, ind) => s + (weights[ind.id] ?? 1.0), 0);
  return Math.round(total / totalWeight);
}

function pressureToFeeling(p: number): string {
  if (p < 15) return 'clear';
  if (p < 30) return 'mild';
  if (p < 55) return 'overcast';
  if (p < 75) return 'warning';
  if (p < 92) return 'storm';
  return 'severe';
}

function computeSignal(indicators: any[]): string {
  const ups = indicators.filter(i => i.trend_dir === 'up').length;
  const downs = indicators.filter(i => i.trend_dir === 'down').length;
  if (ups > downs) return 'pressure_building';
  if (downs > ups) return 'pressure_easing';
  return 'pressure_building';
}

async function loadSixDays(env: Env) {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `day:${d.toISOString().slice(0, 10)}`;
    const stored = await env.READINGS.get(key, 'json') as any;
    days.push({
      date: d.toISOString().slice(0, 10),
      dow: d.getDay(),
      feeling: stored?.feeling || 'clear',
      pressure: stored?.pressure || 0,
    });
  }
  return days;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
