/**
 * U.S. Press Freedom Tracker — pressfreedomtracker.us/api/
 * Public JSON. No key required. Updated continuously.
 */

import type { Env } from '../index';

export interface PressIncident {
  id: number;
  date: string;
  city: string;
  state: string;
  lat: number | null;
  lon: number | null;
  categories: string[];
  title: string;
}

export async function fetchPress(env: Env) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://pressfreedomtracker.us/api/edge/incidents/?date_lower=${since}&limit=500&format=json`;

  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`press: ${r.status}`);
  const data: any = await r.json();
  const incidents = (data.results || []).map((i: any) => ({
    id: i.id,
    date: i.date,
    city: i.city || '',
    state: (i.state && i.state[0]?.name) || '',
    lat: i.latitude || null,
    lon: i.longitude || null,
    categories: (i.categories || []).map((c: any) => c.title || c.name),
    title: i.title || '',
  }));

  return { incidents, fetched_at: new Date().toISOString() };
}
