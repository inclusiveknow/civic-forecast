/**
 * CourtListener — courtlistener.com/api/
 * Free with registration. Rate limit 5,000/day.
 */

import type { Env } from '../index';

const RELEVANT_TAGS = [
  'civil-rights',
  'voting-rights',
  'first-amendment',
  'executive-power',
];

export async function fetchCourts(env: Env) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://www.courtlistener.com/api/rest/v3/opinions/?date_filed__gte=${since}&order_by=-date_filed&page_size=100`;

  const r = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: `Token ${env.COURTLISTENER}`,
    },
  });
  if (!r.ok) throw new Error(`courts: ${r.status}`);
  const data: any = await r.json();

  const opinions = (data.results || []).map((o: any) => ({
    id: o.id,
    date: o.date_filed,
    court: o.cluster?.docket?.court || '',
    name: o.cluster?.case_name || '',
    summary: o.plain_text?.slice(0, 400) || o.html_lawbox?.slice(0, 400) || '',
    url: `https://www.courtlistener.com${o.absolute_url}`,
  }));

  return { opinions, fetched_at: new Date().toISOString() };
}
