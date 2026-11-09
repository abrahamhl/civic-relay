// SENDA LIVE PWA offline shell v2. Public model snapshots live in separate IndexedDB.
// No third-party map tiles are preloaded or cached (OSM tile policy).
const CACHE_NAME = 'senda-live-v3-atmosphere4d';
const PREFIX = 'senda-live-';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  // Pre-cache the ACTUAL hashed JS/CSS asset paths from the built Vite index.
  // On a first-time install the document's assets may have loaded before the SW
  // gained control; relying on runtime asset caching leaves offline restart broken.
  event.waitUntil((async () => {
    const response = await fetch('/index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('SHELL_UNAVAILABLE');
    const html = await response.text();
    const assets = new Set(SHELL);
    const paths = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
      .map((match) => match[1]);
    for (const path of paths.slice(0, 24)) {
      if (/^\/assets\/[A-Za-z0-9._/-]+$/.test(path)) assets.add(path);
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...assets]);
  })());
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
