/**
 * ACLED — Armed Conflict Location & Event Data
 * acleddata.com — free for non-commercial with registration.
 */

import type { Env } from '../index';

export async function fetchStreets(env: Env) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ACLED uses a simple GET with key + email
  const url = new URL('https://api.acleddata.com/acled/read');
  url.searchParams.set('key', env.ACLED);
  url.searchParams.set('country', 'United States of America');
  url.searchParams.set('event_date', `${since}|${new Date().toISOString().slice(0, 10)}`);
  url.searchParams.set('event_date_where', 'BETWEEN');
  url.searchParams.set('event_type', 'Protests|Riots|Strategic developments');
  url.searchParams.set('limit', '500');

  const r = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`streets: ${r.status}`);
  const data: any = await r.json();
  const events = data.data || [];

  const cities = new Set(events.map((e: any) => `${e.location}, ${e.admin1}`));
  const useOfForce = events.filter((e: any) =>
    /violent|force|teargas|rubber|arrest/i.test(e.notes || '')
  ).length;

  return {
    events: events.map((e: any) => ({
      date: e.event_date,
      city: e.location,
      state: e.admin1,
      lat: parseFloat(e.latitude),
      lon: parseFloat(e.longitude),
      type: e.sub_event_type,
      notes: (e.notes || '').slice(0, 200),
    })),
    total: events.length,
    cities: cities.size,
    use_of_force: useOfForce,
    fetched_at: new Date().toISOString(),
  };
}
