/**
 * Permanent archive of every day's reading in R2.
 * Path scheme: archive/YYYY/MM/DD/reading.json
 */

import type { Env } from '../index';

export async function archiveSnapshot(reading: any, env: Env): Promise<void> {
  const d = new Date(reading.date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const key = `archive/${y}/${m}/${day}/reading.json`;
  await env.ARCHIVE.put(key, JSON.stringify(reading, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}
