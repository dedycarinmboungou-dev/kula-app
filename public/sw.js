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

// Handle incoming Web Push — show the notification
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }

  const title = payload.title || 'Kula 🌱';
  const body  = payload.body  || '';
  const icon  = payload.icon  || '/icon-192.png';
  const badge = payload.badge || '/icon-192.png';
  const tag   = payload.tag   || 'kula-push';
  const data  = payload.data  || { tab: 'dashboard' };

  event.waitUntil(
    self.registration.showNotification(title, { body, icon, badge, tag, data, renotify: false })
  );
});

// Handle notification click — open/focus the app and go to the right tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tab = event.notification.data?.tab || 'chat';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const focused = clients.find(c => c.visibilityState === 'visible' || c.focused);
      if (focused) {
        focused.postMessage({ type: 'NOTIF_CLICK', tab });
        return focused.focus();
      }
      const any = clients[0];
      if (any) {
        any.postMessage({ type: 'NOTIF_CLICK', tab });
        return any.focus();
      }
      return self.clients.openWindow('/');
    })
  );
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

  // Network-first for HTML navigation — always get fresh markup on deploy
  if (request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for other static assets (CSS, JS, icons)
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
