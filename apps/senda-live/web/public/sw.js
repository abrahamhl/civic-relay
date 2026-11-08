// SENDA LIVE PWA offline shell v2. Public model snapshots live in separate IndexedDB.
// No third-party map tiles are preloaded or cached (OSM tile policy).
const CACHE_NAME = 'senda-live-v2-atmosphere4d';
const PREFIX = 'senda-live-';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  // Navigation is network-first, then falls back to the last locally cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone())));
        }
        return response;
      } catch {
        return (await caches.match('/index.html')) ||
          new Response('<h1>SENDA desconectada</h1><p>Abre la aplicación online una vez para preparar la PWA.</p>',
            { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Cache local JS/CSS/icon assets after first successful load; never intercept external tiles.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
    }
    return response;
  })());
});
