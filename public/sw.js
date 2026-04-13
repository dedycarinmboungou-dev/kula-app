const CACHE_NAME = 'kula-cache-force-__BUILD_TIME__';
const DATA_CACHE = 'kula-data-cache'; // persists across deploys — API data only

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// GET API endpoints whose responses are worth caching for offline use
const DATA_ENDPOINTS = ['/api/dashboard', '/api/poches', '/api/transactions'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        // Delete old static caches but keep DATA_CACHE — it survives deploys
        keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k))
      )
    ).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach(client => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
        });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    const isCacheable = request.method === 'GET' &&
      DATA_ENDPOINTS.some(p => url.pathname.startsWith(p));

    if (isCacheable) {
      // Network-first; on success cache the response; on failure serve from cache
      event.respondWith(
        fetch(request.clone()).then(async (response) => {
          if (response.ok) {
            try {
              const data = await response.clone().json();
              const wrapped = JSON.stringify({ ...data, _cached_at: Date.now() });
              const cache = await caches.open(DATA_CACHE);
              cache.put(request, new Response(wrapped, {
                headers: { 'Content-Type': 'application/json' }
              }));
            } catch { /* silent — best-effort cache */ }
          }
          return response;
        }).catch(async () => {
          const cache  = await caches.open(DATA_CACHE);
          const cached = await cache.match(request);
          if (cached) {
            const data = await cached.json();
            return new Response(
              JSON.stringify({ ...data, _kula_offline: true }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ error: 'Hors ligne' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
      return;
    }

    // Network-first for all other API calls (mutations, auth, etc.)
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
    )
  );
});
