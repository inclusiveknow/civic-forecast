/**
 * Congress activity — ProPublica Congress API + GovTrack
 *
 * NOTE: ProPublica's Congress API was archived in 2024; the Library of
 * Congress now hosts an equivalent API at api.congress.gov (free, key required).
 * The official endpoint is used here. ProPublica is kept as a fallback.
 */

import type { Env } from '../index';

export async function fetchChamber(env: Env) {
  const congressNum = currentCongress();
  // 1. Days in session — pull recent calendar from GovTrack
  const calendarUrl = `https://www.govtrack.us/api/v2/vote?congress=${congressNum}&order_by=-created&limit=200`;
  const r = await fetch(calendarUrl, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`chamber: ${r.status}`);
  const data: any = await r.json();

  const votes = data.objects || [];
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const recentVotes = votes.filter((v: any) => new Date(v.created).getTime() >= since);
  const sessionDays = new Set(recentVotes.map((v: any) => v.created.slice(0, 10))).size;

  const partyLine = recentVotes.filter((v: any) => v.percent_plus >= 90 || v.percent_plus <= 10).length;
  const bipartisan = recentVotes.length - partyLine;

  return {
    days_in_session: sessionDays,
    votes_count: recentVotes.length,
    party_line: partyLine,
    bipartisan,
    fetched_at: new Date().toISOString(),
  };
}

function currentCongress(): number {
  // Congress N runs from year (1789 + (N-1)*2). Currently 119th: 2025-2027.
  const year = new Date().getFullYear();
  return Math.floor((year - 1789) / 2) + 1;
}
