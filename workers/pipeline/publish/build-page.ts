/**
 * "Publish" the daily reading: write reading.json into KV (served by /today
 * endpoint, mirrored into the Pages deploy as data/reading.json).
 *
 * For a full static publish you'd push reading.json into the Pages project
 * via wrangler / GitHub Action. This Worker version just stores in KV; the
 * static site fetches /today from the Worker (via fetch with a CDN cache
 * in front).
 */

import type { Env } from '../index';

export async function buildPage(reading: any, env: Env): Promise<void> {
  await env.READINGS.put('today', JSON.stringify(reading), {
    expirationTtl: 60 * 60 * 25, // ~25 hours; replaced each morning
  });
}
