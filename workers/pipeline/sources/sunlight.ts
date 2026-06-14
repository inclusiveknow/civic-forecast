/**
 * MuckRock FOIA — muckrock.com/api_v1/
 * Free, no key. Tracks FOIA requests across all U.S. agencies.
 */

import type { Env } from '../index';

export async function fetchSunlight(env: Env) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://www.muckrock.com/api_v1/foia/?date_submitted__gte=${since}&jurisdiction=federal&format=json&page_size=200`;

  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`sunlight: ${r.status}`);
  const data: any = await r.json();

  const requests = (data.results || []).map((req: any) => ({
    id: req.id,
    title: req.title,
    status: req.status, // submitted, ack, processed, fix, payment, lawsuit, no_docs, done, partial, abandoned, appealing, rejected
    date_submitted: req.date_submitted,
    date_done: req.date_done,
    agency: req.agency_name || '',
  }));

  // Compute denial percentage
  const completed = requests.filter((r: any) => ['done', 'no_docs', 'rejected', 'partial', 'abandoned'].includes(r.status));
  const denied = requests.filter((r: any) => ['no_docs', 'rejected', 'abandoned'].includes(r.status));
  const denial_pct = completed.length > 0 ? Math.round((denied.length / completed.length) * 100) : 0;

  return { requests, denial_pct, total: requests.length, fetched_at: new Date().toISOString() };
}
