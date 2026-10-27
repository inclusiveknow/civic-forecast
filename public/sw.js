/* THE CIVIC FORECAST · service worker
 * - Data (data/*.json): network first, cached copy when offline. Deadlines and
 *   numbers can be corrected at any time, so fresh always wins.
 * - Everything else on this site: cached, refreshed in the background.
 * - Other sites (live lookups, fonts, map libraries): left to the browser.
 * Bumping VERSION clears every older cache, including v1's.
 */

const VERSION = 'cf-v2.2.0';
const STATIC_CACHE = `${VERSION}-static`;
const DYNAMIC_CACHE = `${VERSION}-dynamic`;
const V = '?v=2.2.0';

const PRECACHE = [
  './',
  'index.html',
  'methodology.html',
  '404.html',
  'manifest.webmanifest',
  `styles/app.css${V}`,
  `scripts/icons.js${V}`,
  `scripts/civic.js${V}`,
  `scripts/live.js${V}`,
  `scripts/map.js${V}`,
  `scripts/plan.js${V}`,
  `scripts/sky.js${V}`,
  `scripts/app.js${V}`,
  'data/civic.json',
  'data/rent.json',
  'data/econ.json',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

// third-party files the app needs to draw (map libraries, the map itself, fonts):
// keep a copy so the installed app opens fast and works offline
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never
  // precaches a stale copy of a page the old version had fetched
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => !k.startsWith(VERSION));
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Replacing an older version: pages still open were served from its cache,
    // so reload them once onto the new site. First-time installs skip this.
    if (old.length) {
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (CDN.includes(url.hostname)) event.respondWith(staleWhileRevalidate(req));
    return; // live lookups (weather, NWS, FEMA...) always go to the network
  }
  if (url.pathname.includes('/data/')) { event.respondWith(networkFirst(req)); return; }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) (await caches.open(DYNAMIC_CACHE)).put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.status === 200) (await caches.open(DYNAMIC_CACHE)).put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}
