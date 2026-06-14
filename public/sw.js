/* THE CIVIC FORECAST — service worker
 * Strategy:
 *   - Static assets: cache-first, refresh in background ("stale-while-revalidate")
 *   - data/reading.json: network-first with cache fallback
 *   - Everything else: network-first
 * The version string busts the cache when this file changes.
 */

const VERSION = 'cf-v1.2.0';
const STATIC_CACHE = `${VERSION}-static`;
const DYNAMIC_CACHE = `${VERSION}-dynamic`;

const PRECACHE = [
  '/',
  'index.html',
  'methodology.html',
  '404.html',
  'embed.html',
  'manifest.webmanifest',
  'styles/main.css',
  'styles/map.css',
  'scripts/app.js',
  'scripts/data.js',
  'scripts/i18n.js',
  'scripts/icons.js',
  'scripts/map.js',
  'data/reading.json',
  'favicon.svg',
  'apple-touch-icon.svg',
  'og-image.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  // Skip external (CDN fonts, D3, etc.) — let the browser handle them.
  if (url.origin !== self.location.origin) return;

  // Network-first for the daily reading: always try fresh, fall back to cache offline.
  if (url.pathname.endsWith('/data/reading.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        const cache = caches.open(DYNAMIC_CACHE);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);
  return cached || fetchPromise || new Response('offline', { status: 503 });
}
