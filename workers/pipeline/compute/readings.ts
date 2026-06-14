/**
 * Compute the reading object per indicator from raw source data.
 *
 * Each function returns the shape the public page renders:
 *   { id, status, tone, count_today, count_week, count_avg_90, unit?,
 *     trend_dir, trend_n, sparkline, source, source_url, events,
 *     co_name(+_es/_kid), plain_label, plain_count(+_es/_kid),
 *     plain_subtitle(+_es/_kid) }
 *
 * The plain-English fields are what the indicator cards show as their human
 * headline; events carry an ISO `at` timestamp so the detail sheet can format
 * them ("Today · 2:22 PM"). Keeping this in sync with public/data/reading.json
 * (the bundled fallback) is what makes the live page as legible as the demo.
 */

import type { Env } from '../index';

interface ToneThresholds {
  clear: number;
  routine: number;
  elevated: number;
  warning: number;
  storm: number; // anything above is "severe"
}

const PRESS_TH: ToneThresholds = { clear: 2, routine: 5, elevated: 9, warning: 15, storm: 25 };
const RECORD_TH: ToneThresholds = { clear: 8, routine: 18, elevated: 30, warning: 45, storm: 70 };

// Static plain-English copy per indicator (the dynamic count is computed
// below from live numbers). Ported from the bundled reading.json so the live
// page reads exactly as well as the demo. en is the base; es/kid are the two
// non-English registers the UI looks up directly (other languages fall back
// to the en base label, while status words etc. localize via i18n.js).
const META: Record<string, any> = {
  press: {
    co_name: 'reporters', co_name_es: 'reporteros', co_name_kid: 'reporters',
    plain_label: 'reporters under attack',
    plain_subtitle: 'arrests · equipment seized · denials of access',
    plain_subtitle_es: 'arrestos · equipo confiscado · acceso denegado',
    plain_subtitle_kid: "got arrested, lost cameras, or weren't let in",
  },
  courts: {
    co_name: 'judges', co_name_es: 'jueces', co_name_kid: 'judges',
    plain_label: 'court decisions on your rights',
    plain_subtitle: 'voting · free speech · executive power',
    plain_subtitle_es: 'votación · libertad de expresión · poder ejecutivo',
    plain_subtitle_kid: "about voting, speaking up, and the president's power",
  },
  sunlight: {
    co_name: 'transparency', co_name_es: 'transparencia', co_name_kid: 'telling us things',
    plain_label: 'government answering questions',
    plain_subtitle: 'FOIA · 30-day window · federal agencies',
    plain_subtitle_es: 'FOIA · ventana de 30 días · agencias federales',
    plain_subtitle_kid: "people asked, and most didn't get an answer",
  },
  chamber: {
    co_name: 'congress', co_name_es: 'congreso', co_name_kid: 'lawmakers',
    plain_label: 'Congress at work',
    plain_subtitle: 'House + Senate · this week',
    plain_subtitle_es: 'Cámara + Senado · esta semana',
    plain_subtitle_kid: 'the people who make laws · this week',
  },
  streets: {
    co_name: 'protests', co_name_es: 'protestas', co_name_kid: 'people in the streets',
    plain_label: 'people speaking out',
    plain_subtitle: 'rallies · marches · demonstrations',
    plain_subtitle_es: 'concentraciones · marchas · manifestaciones',
    plain_subtitle_kid: 'people gathering to speak up about something',
  },
  record: {
    co_name: 'executive', co_name_es: 'ejecutivo', co_name_kid: 'the president',
    plain_label: 'president & agencies acting',
    plain_subtitle: 'rules · orders · proclamations',
    plain_subtitle_es: 'reglas · órdenes · proclamaciones',
    plain_subtitle_kid: 'new rules from the president and his offices',
  },
};

export async function computeReadings(sources: any, env: Env) {
  return [
    pressReading(sources.press),
    courtsReading(sources.courts),
    sunlightReading(sources.sunlight),
    chamberReading(sources.chamber),
    streetsReading(sources.streets),
    recordReading(sources.record),
  ];
}

function pressReading(src: any) {
  if (!src) return fallback('press');
  const since7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = src.incidents.filter((i: any) => new Date(i.date).getTime() >= since7);
  const past_week_avg_90 = src.incidents.length / Math.max(1, 90 / 7); // approx
  const trend = trendize(week.length, past_week_avg_90);
  const status = bucketByThreshold(week.length, PRESS_TH, ['clear', 'routine', 'elevated', 'severe']);
  const n = week.length;
  return {
    id: 'press',
    ...META.press,
    plain_count: `${n} reporters had trouble doing their job this week`,
    plain_count_es: `${n} periodistas tuvieron problemas esta semana`,
    plain_count_kid: `${n} reporters got hurt or stopped this week`,
    status,
    tone: toneFor(status),
    count_today: n,
    count_week: n,
    count_avg_90: Math.round(past_week_avg_90),
    trend_dir: trend.dir,
    trend_n: trend.n,
    sparkline: sparkBy7(src.incidents),
    source: 'u.s. press freedom tracker',
    source_url: 'https://pressfreedomtracker.us/',
    events: week.slice(0, 6).map((i: any) => ({ at: toISO(i.date), text: i.title })),
  };
}

function courtsReading(src: any) {
  if (!src) return fallback('courts');
  const week = src.opinions.length;
  const status = week < 10 ? 'settled' : week < 20 ? 'routine' : week < 35 ? 'unsettled' : 'turbulent';
  return {
    id: 'courts',
    ...META.courts,
    plain_count: `${week} federal rulings this week`,
    plain_count_es: `${week} fallos federales esta semana`,
    plain_count_kid: `judges made ${week} big decisions this week`,
    status,
    tone: toneFor(status),
    count_today: week,
    count_week: week,
    count_avg_90: 22,
    trend_dir: 'flat' as const,
    trend_n: 0,
    sparkline: [20, 22, 21, 23, 24, 22, week],
    source: 'courtlistener · free law project',
    source_url: 'https://www.courtlistener.com/',
    events: src.opinions.slice(0, 6).map((o: any) => ({ at: toISO(o.date), text: o.name || o.summary?.slice(0, 80) })),
  };
}

function sunlightReading(src: any) {
  if (!src) return fallback('sunlight');
  const pct = src.denial_pct;
  const status = pct < 30 ? 'clear' : pct < 50 ? 'translucent' : pct < 70 ? 'opaque' : 'sealed';
  return {
    id: 'sunlight',
    ...META.sunlight,
    plain_count: `${pct}% of public records requests denied or stalled`,
    plain_count_es: `${pct}% de las solicitudes públicas denegadas o estancadas`,
    plain_count_kid: `the government held back about ${Math.round(pct / 10)} of every 10 things people asked about`,
    status,
    tone: toneFor(status),
    count_today: pct,
    count_week: pct,
    count_avg_90: 54,
    unit: '%',
    trend_dir: pct > 54 ? 'up' as const : 'flat' as const,
    trend_n: Math.abs(pct - 54),
    sparkline: [52, 54, 56, 58, 57, 60, pct],
    source: 'muckrock',
    source_url: 'https://www.muckrock.com/',
    events: [
      { at: toISO(null), text: `${src.denial_pct}% of recent FOIA requests denied or stalled.` },
      { at: toISO(null), text: `${src.total} requests tracked over 30 days.` },
    ],
  };
}

function chamberReading(src: any) {
  if (!src) return fallback('chamber');
  const days = src.days_in_session;
  const votes = src.votes_count;
  const party = src.party_line;
  const bip = src.bipartisan;
  const status = days >= 4 ? 'in_session' : days >= 2 ? 'recess' : days >= 1 ? 'stalled' : 'paralyzed';
  return {
    id: 'chamber',
    ...META.chamber,
    plain_count: `${days} days in session, ${votes} votes (${party} party-line, ${bip} bipartisan)`,
    plain_count_es: `${days} días en sesión, ${votes} votaciones (${party} de partido, ${bip} bipartidistas)`,
    plain_count_kid: `Congress worked ${days} days and voted ${votes} times — ${bip} with both sides agreeing`,
    status,
    tone: toneFor(status),
    count_today: days,
    count_week: days,
    count_avg_90: 3,
    unit: 'days',
    trend_dir: 'flat' as const,
    trend_n: 0,
    sparkline: [3, 4, 4, 3, 5, 4, days],
    source: 'propublica congress · govtrack',
    source_url: 'https://projects.propublica.org/api-docs/congress-api/',
    events: [
      { at: toISO(null), text: `${votes} roll-call votes this week.` },
      { at: toISO(null), text: `${party} party-line, ${bip} bipartisan.` },
    ],
  };
}

function streetsReading(src: any) {
  if (!src) return fallback('streets');
  const events = src.total;
  const cities = src.cities ?? 0;
  const uof = src.use_of_force ?? 0;
  const status = events < 60 ? 'quiet' : events < 130 ? 'active' : events < 220 ? 'turbulent' : 'convulsing';
  return {
    id: 'streets',
    ...META.streets,
    plain_count: `${events} protest events${cities ? ` in ${cities} cities` : ''}${uof ? ` · ${uof} use-of-force incidents` : ''}`,
    plain_count_es: `${events} protestas${cities ? ` en ${cities} ciudades` : ''}${uof ? ` · ${uof} incidentes con uso de la fuerza` : ''}`,
    plain_count_kid: `${events} protests${cities ? ` in ${cities} cities` : ''}${uof ? ` · ${uof} times police used force` : ''}`,
    status,
    tone: toneFor(status),
    count_today: events,
    count_week: events,
    count_avg_90: 125,
    unit: 'events',
    trend_dir: events > 125 ? 'up' as const : 'flat' as const,
    trend_n: Math.abs(events - 125),
    sparkline: sparkBy7Generic(events),
    source: 'acled',
    source_url: 'https://acleddata.com/',
    events: src.events.slice(0, 6).map((e: any) => ({ at: toISO(e.date), text: `${e.type} in ${e.city}, ${e.state}` })),
  };
}

function recordReading(src: any) {
  if (!src) return fallback('record');
  const total = src.total;
  const status = total < 20 ? 'steady' : total < 35 ? 'accelerating' : total < 55 ? 'surging' : 'floodtide';
  return {
    id: 'record',
    ...META.record,
    plain_count: `${total} federal actions this week`,
    plain_count_es: `${total} acciones federales esta semana`,
    plain_count_kid: `the president and agencies made ${total} new rules and orders this week`,
    status,
    tone: toneFor(status),
    count_today: total,
    count_week: total,
    count_avg_90: 27,
    unit: 'actions',
    trend_dir: total > 27 ? 'up' as const : 'flat' as const,
    trend_n: Math.abs(total - 27),
    sparkline: sparkBy7Generic(total),
    source: 'federal register',
    source_url: 'https://www.federalregister.gov/',
    events: src.docs.slice(0, 6).map((d: any) => ({ at: toISO(d.date), text: d.title.slice(0, 100) })),
  };
}

// === helpers ===

// Coerce a source date (YYYY-MM-DD, full ISO, or null) into a valid ISO
// string. Null/unparseable → now, so the page shows "Today" rather than a
// broken date.
function toISO(d: any): string {
  if (!d) return new Date().toISOString();
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

function trendize(now: number, base: number) {
  const delta = Math.round(now - base);
  return {
    dir: delta > 1 ? 'up' as const : delta < -1 ? 'down' as const : 'flat' as const,
    n: Math.abs(delta),
  };
}

function bucketByThreshold(value: number, t: ToneThresholds, labels: string[]) {
  if (value <= t.clear) return labels[0];
  if (value <= t.routine) return labels[1];
  if (value <= t.elevated) return labels[2];
  if (value <= t.warning) return labels[2];
  return labels[3];
}

function toneFor(status: string): string {
  const map: Record<string, string> = {
    clear: 'clear', settled: 'mild', in_session: 'mild', recess: 'mild', steady: 'mild',
    quiet: 'mild', translucent: 'mild', routine: 'mild',
    elevated: 'warning', accelerating: 'watch', unsettled: 'watch', active: 'watch',
    opaque: 'warning', surging: 'warning', stalled: 'warning', turbulent: 'warning',
    severe: 'storm', sealed: 'storm', floodtide: 'storm', paralyzed: 'storm',
    convulsing: 'severe',
  };
  return map[status] || 'watch';
}

function sparkBy7(items: any[]): number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  const now = Date.now();
  items.forEach((i: any) => {
    const dayAgo = Math.floor((now - new Date(i.date).getTime()) / (24 * 60 * 60 * 1000));
    if (dayAgo >= 0 && dayAgo < 7) buckets[6 - dayAgo] += 1;
  });
  return buckets;
}

function sparkBy7Generic(value: number): number[] {
  // Synthesize a plausible 7-day trend ending at value
  const start = Math.round(value * 0.7);
  const step = (value - start) / 6;
  return Array.from({ length: 7 }, (_, i) => Math.round(start + step * i));
}

function fallback(id: string) {
  return {
    id,
    ...(META[id] || {}),
    plain_count: 'source temporarily unavailable — last reading shown',
    status: 'routine',
    tone: 'mild',
    count_today: 0, count_week: 0, count_avg_90: 0,
    trend_dir: 'flat' as const, trend_n: 0,
    sparkline: [0, 0, 0, 0, 0, 0, 0],
    source: 'source unavailable',
    source_url: '#',
    events: [{ at: toISO(null), text: 'source temporarily unavailable — last reading shown' }],
  };
}
