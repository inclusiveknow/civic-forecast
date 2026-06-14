/**
 * Pick the top 5 stories from the news pool. Ranked by:
 *   - Recency (newer beats older)
 *   - Source weight (NPR Politics > Federal Register, etc.)
 *   - Classification confidence (more keyword hits = more relevant)
 *   - Whether the story's indicator moved sharply today (boost)
 *
 * Then attach a one-line "weather note" connecting the story to the
 * indicator's current state.
 */

import type { NewsItem } from '../sources/news';

export interface RankedStory extends NewsItem {
  rank: number;
  time: string;          // human-readable "today · 06:14 ET"
  direction: 'up' | 'down' | 'flat';
  weather_note: string;
}

export function rankStories(items: NewsItem[], indicators: any[]): RankedStory[] {
  const now = Date.now();

  const indById = Object.fromEntries(indicators.map(i => [i.id, i]));

  const scored = items.map(i => {
    const ageH = (now - new Date(i.pub_date).getTime()) / 36e5;
    const recency = Math.max(0, 24 - ageH) / 24; // 1.0 today, 0.0 24h+ old
    let movement = 0;
    i.indicators.forEach(id => {
      const ind = indById[id];
      if (ind && (ind.tone === 'storm' || ind.tone === 'severe' || ind.trend_dir === 'up')) movement += 0.6;
      if (ind && ind.tone === 'warning') movement += 0.3;
    });
    const composite = i.score * 1.0 + recency * 2.0 + movement * 1.5 + (i.weight - 1) * 0.5;
    return { item: i, composite };
  });

  scored.sort((a, b) => b.composite - a.composite);

  // Ensure indicator diversity in the top 5 — don't pick 5 PRESS stories
  const picked: NewsItem[] = [];
  const indCounts: Record<string, number> = {};
  for (const { item } of scored) {
    if (picked.length >= 5) break;
    const primary = item.indicators[0];
    if (primary && (indCounts[primary] || 0) >= 2) continue; // max 2 per indicator
    indCounts[primary] = (indCounts[primary] || 0) + 1;
    picked.push(item);
  }
  // If we ended up under 5 (rare), top up with the highest scores regardless
  if (picked.length < 5) {
    for (const { item } of scored) {
      if (picked.length >= 5) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }

  return picked.map((i, idx) => ({
    ...i,
    rank: idx + 1,
    time: formatTime(i.pub_date),
    direction: directionFor(i, indById),
    weather_note: weatherNote(i, indById),
  }));
}

function directionFor(i: NewsItem, indById: Record<string, any>): 'up' | 'down' | 'flat' {
  const dirs = i.indicators.map(id => indById[id]?.trend_dir).filter(Boolean);
  if (dirs.includes('up')) return 'up';
  if (dirs.includes('down')) return 'down';
  return 'flat';
}

function weatherNote(i: NewsItem, indById: Record<string, any>): string {
  if (i.indicators.length === 0) return '';
  const primary = i.indicators[0];
  const ind = indById[primary];
  if (!ind) return '';
  const dirText = ind.trend_dir === 'up'
    ? `pushes ${primary.toUpperCase()} higher`
    : ind.trend_dir === 'down'
      ? `eases ${primary.toUpperCase()} pressure`
      : `keeps ${primary.toUpperCase()} steady`;
  return `${dirText} — currently ${ind.status} (${ind.count_week} this week vs. ${ind.count_avg_90} 90-day average).`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 36e5;
  if (diffH < 1) return 'just now';
  if (diffH < 12) {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `today · ${hh}:${mm} UTC`;
  }
  if (diffH < 36) return 'yesterday';
  return d.toISOString().slice(0, 10);
}
