/**
 * Convert per-indicator events into atmospheric regions on the map.
 * Each region is { center: [lon, lat], r: <px>, i: <intensity 0-1> }.
 *
 * The strategy: cluster events by approximate region, weight by count,
 * then emit one region per cluster.
 */

const REGION_CENTERS: Record<string, [number, number]> = {
  northeast: [-72.0, 42.5],
  midatlantic: [-77.0, 38.9],
  southeast: [-83.5, 32.5],
  florida: [-82.4, 28.0],
  midwest: [-87.6, 41.8],
  uppermidwest: [-93.2, 44.9],
  greatplains: [-97.0, 39.0],
  southwest: [-106.5, 31.8],
  texas: [-97.7, 30.3],
  rockies: [-105.0, 39.7],
  pacificnw: [-122.6, 45.5],
  california: [-118.2, 34.0],
  norcal: [-122.4, 37.8],
};

// Human label shown on the map dot + popover for each region cluster.
const REGION_LABELS: Record<string, string> = {
  northeast: 'Northeast',
  midatlantic: 'D.C.',
  southeast: 'Southeast',
  florida: 'Florida',
  midwest: 'Midwest',
  uppermidwest: 'Upper Midwest',
  greatplains: 'Great Plains',
  southwest: 'Southwest',
  texas: 'Texas',
  rockies: 'Rockies',
  pacificnw: 'Pacific NW',
  california: 'California',
  norcal: 'Bay Area',
};

export async function computeGeography(indicators: any[]) {
  return indicators.map(ind => {
    if (ind.regions && ind.regions.length) return ind;
    // Cluster events into regions
    const buckets: Record<string, number> = {};
    (ind.events || []).forEach((e: any) => {
      // Heuristic: derive region from event text or assume DC
      const region = guessRegion(e.text || '');
      buckets[region] = (buckets[region] || 0) + 1;
    });
    if (Object.keys(buckets).length === 0) buckets.midatlantic = 1;
    const max = Math.max(...Object.values(buckets));
    const regions = Object.entries(buckets).map(([name, count]) => ({
      center: REGION_CENTERS[name] || REGION_CENTERS.midatlantic,
      r: 60 + count * 8,
      i: Math.min(0.9, 0.4 + (count / max) * 0.5),
      label: REGION_LABELS[name] || REGION_LABELS.midatlantic,
    }));
    return { ...ind, regions };
  });
}

function guessRegion(text: string): string {
  const t = text.toLowerCase();
  if (/florida|tampa|miami|orlando|tallahassee/.test(t)) return 'florida';
  if (/atlanta|georgia|alabama|tennessee|carolina/.test(t)) return 'southeast';
  if (/portland|seattle|oregon|washington state/.test(t)) return 'pacificnw';
  if (/los angeles|san diego|california\b(?!.*north)/.test(t)) return 'california';
  if (/san francisco|bay area|berkeley|oakland/.test(t)) return 'norcal';
  if (/texas|dallas|houston|austin/.test(t)) return 'texas';
  if (/minneapolis|st\. paul|wisconsin|minnesota/.test(t)) return 'uppermidwest';
  if (/chicago|illinois|detroit|michigan|ohio/.test(t)) return 'midwest';
  if (/new york|brooklyn|queens|nyc|boston|massachusetts/.test(t)) return 'northeast';
  if (/d\.?c\.?|washington|maryland|virginia/.test(t)) return 'midatlantic';
  if (/arizona|new mexico|phoenix/.test(t)) return 'southwest';
  if (/colorado|denver|utah|wyoming/.test(t)) return 'rockies';
  return 'midatlantic';
}
