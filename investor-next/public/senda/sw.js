/* SENDA Campo · service worker: la app entera queda instalada en el teléfono y abre sin red. */
const VERSION = 'senda-campo-v2';
const ASSETS = [
  './', './index.html', './app.css', './app.mjs', './db.mjs', './audio.mjs', './icon.svg', './manifest.webmanifest',
  './core/b64.mjs', './core/envelope.mjs', './core/bundle.mjs', './core/acoustic-modem.mjs', './core/zones.mjs', './core/feeds.mjs',
  './core/orbital.mjs', './core/router.mjs', './core/channels.mjs', './core/ladder.mjs', './core/brand.mjs',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // fuentes externas: directo a la red
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match('./index.html'))));
});
