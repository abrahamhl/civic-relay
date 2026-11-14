/* SENDA Campo · service worker (raíz, alcance /senda): la app entera queda instalada en el teléfono y abre sin red.
   Está en la raíz porque el sitio usa URL limpias (/senda sin barra final). */
const VERSION = 'senda-campo-v39';
const ASSETS = [
  '/senda', '/senda/app.css', '/senda/app.mjs', '/senda/db.mjs', '/senda/audio.mjs', '/senda/icon.svg', '/senda/manifest.webmanifest',
  '/senda/core/b64.mjs', '/senda/core/envelope.mjs', '/senda/core/bundle.mjs', '/senda/core/acoustic-modem.mjs', '/senda/core/zones.mjs', '/senda/core/feeds.mjs',
  '/senda/core/orbital.mjs', '/senda/core/router.mjs', '/senda/core/channels.mjs', '/senda/core/ladder.mjs', '/senda/core/brand.mjs', '/senda/core/rail-incident.mjs', '/senda/incidente', '/senda/core/rail-scenario.mjs',
  '/senda/edificios', '/senda/vendor/three-0.158.0.min.js', '/senda/core/building-twin.mjs', '/senda/core/building-scenario.mjs', '/senda/core/remote-command.mjs', '/senda/core/rubble.mjs', '/senda/core/roles.mjs',
  '/senda/coord.mjs', '/senda/organismo', '/senda/core/beacon.mjs',
  '/senda/red', '/senda/estado', '/senda/core/erasure.mjs', '/senda/core/bearers.mjs', '/senda/core/satellites.mjs', '/senda/core/blackout.mjs', '/senda/core/drone.mjs', '/senda/core/interop.mjs',
  '/senda/ojo', '/senda/incendio', '/senda/core/wildfire.mjs', '/geo/land-110m.json', '/senda/via', '/senda/core/rail-watch.mjs', '/senda/core/rail-watch-scenario.mjs', '/senda/core/occupancy.mjs', '/senda/core/rescue-scenario.mjs', '/senda/core/vision-layers.mjs', '/senda/core/sensor-fabric.mjs',
  '/senda/llamada', '/senda/core/sdp-compact.mjs', '/senda/dron', '/senda/core/rf-census.mjs', '/senda/arquitectura', '/senda/estado.json', '/senda/core/voice-mesh.mjs',
  '/senda/kit.mjs', '/senda/kit.css', '/senda/sentidos', '/senda/agua', '/senda/triaje', '/senda/monte', '/senda/barrido', '/senda/core/platforms.mjs', '/senda/core/flood-watch.mjs', '/senda/core/triage.mjs', '/senda/core/geo-offline.mjs', '/senda/core/senses.mjs', '/senda/core/house-sweep.mjs', '/senda/core/through-wall.mjs', '/senda/reserva', '/senda/core/net-reserve.mjs', '/senda/core/swarm-cache.mjs', '/senda/core/coverage-memory.mjs',
  '/senda/carretera', '/senda/core/road-guard.mjs',
  '/senda/centro', '/senda/mensaje', '/senda/avisos', '/senda/atlas', '/senda/demo', '/senda/plataforma', '/senda/consola', '/senda/core/fusion.mjs', '/senda/vuelo', '/senda/core/cross-source.mjs', '/senda/data/referencias/usgs_sismos.json', '/senda/api/v1/layers/mundo-usgs.geojson', '/senda/data/nepal2026/nepal_s2.json', '/senda/data/nepal2026/nepal_3d.json', '/senda/data/nepal2026/dem_60m.bin', '/senda/data/nepal2026/tci_pre.jpg', '/senda/data/nepal2026/tci_post2.jpg', '/senda/data/nepal2026/cambio_pre_post.png', '/senda/api/v1/catalog.json', '/senda/api/v1/briefing.json', '/senda/api/v1/openapi.json', '/senda/api/v1/layers/mundo-gdacs.geojson', '/senda/api/v1/layers/espana-dgt.geojson', '/senda/api/v1/layers/paises-bajos-ndw.geojson', '/senda/api/v1/layers/integridad-gnss.geojson', '/senda/core/atlas.mjs', '/senda/core/courier.mjs', '/senda/core/hazard-reports.mjs', '/senda/core/vigia.mjs', '/senda/core/incident-ops.mjs', '/senda/core/reliability-store.mjs', '/senda/core/corridor-connectors.mjs', '/senda/core/delivery-assurance.mjs', '/senda/core/telecom-mathematical-physics.mjs',
  '/senda/camaras', '/senda/paises', '/senda/core/drive-cases.mjs', '/senda/core/datex2.mjs', '/senda/core/cameras.mjs',
  '/senda/dgt', '/senda/core/dgt-infra.mjs',
  '/senda/trafico', '/senda/vehiculos', '/senda/core/vehicle-link.mjs', '/media/vision/dashcam.json', '/media/vision/fixed.json',
  '/senda/fuego', '/senda/core/fire-watch.mjs',
  '/senda/fuego3d', '/senda/paper', '/senda/core/atmos3d.mjs', '/senda/core/fire-field.mjs', '/senda/core/utm.mjs',
  '/senda/referencias', '/senda/evacuacion', '/senda/core/fire-cases.mjs', '/senda/core/traffic-fusion.mjs',
  '/senda/data/referencias/referencias.json', '/senda/data/referencias/goes_casos.json', '/senda/data/referencias/tfl_camaras.json', '/senda/data/referencias/gdacs_eventos.json', '/senda/data/referencias/dgt_incidencias.json', '/senda/data/referencias/ndw_situaciones.json', '/senda/data/referencias/glofas_puntos.json', '/senda/data/referencias/adsb_gnss.json', '/senda/core/gnss-integrity.mjs', '/senda/core/river-context.mjs', '/senda/core/bridging-trust.mjs',
  '/senda/data/referencias/tfl_03752.jpg', '/senda/data/referencias/tfl_06590.jpg', '/senda/data/referencias/tfl_03850.jpg', '/senda/data/referencias/tfl_02158.jpg',
  '/senda/data/smv2026/real.json', '/senda/data/smv2026/validacion_effis.json', '/senda/data/smv2026/gfs_20260723_12z.json', '/senda/data/smv2026/gfs_sinoptico.json', '/senda/data/smv2026/fire3d.json', '/senda/data/smv2026/dem_100m.bin', '/senda/data/smv2026/fuel_100m.bin', '/senda/data/smv2026/burn_100m.bin', '/senda/data/smv2026/prob_roi.bin', '/senda/data/smv2026/arrival_roi.bin', '/senda/data/smv2026/dnbr_d0808.png', '/senda/data/smv2026/tci_pre.jpg', '/senda/data/smv2026/tci_d0724.jpg', '/senda/data/smv2026/tci_d0729.jpg', '/senda/data/smv2026/tci_d0808.jpg',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // fuentes externas: directo a la red
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match('/senda'))));
});
