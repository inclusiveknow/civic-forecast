/**
 * Federal Register — federalregister.gov/developers/api/v1
 * Free, no key. The administrative state's pulse.
 */

import type { Env } from '../index';

export async function fetchRecord(env: Env) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const url = new URL('https://www.federalregister.gov/api/v1/documents.json');
  url.searchParams.set('conditions[publication_date][gte]', since);
  url.searchParams.set('conditions[publication_date][lte]', today);
  url.searchParams.set('per_page', '200');
  url.searchParams.set('order', 'newest');

  const r = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`record: ${r.status}`);
  const data: any = await r.json();
  const docs = data.results || [];

  const counts = {
    rules: docs.filter((d: any) => d.type === 'Rule').length,
    proposed: docs.filter((d: any) => d.type === 'Proposed Rule').length,
    notice: docs.filter((d: any) => d.type === 'Notice').length,
    presidential: docs.filter((d: any) => d.type === 'Presidential Document').length,
  };

  return {
    docs: docs.map((d: any) => ({
      title: d.title,
      type: d.type,
      agencies: (d.agencies || []).map((a: any) => a.name),
      date: d.publication_date,
      url: d.html_url,
    })),
    total: docs.length,
    ...counts,
    fetched_at: new Date().toISOString(),
  };
}
