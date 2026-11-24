// SENDA · Conducir (estilo navegador): mapa a pantalla completa, búsqueda, ruta giro a giro, avisos con
// colores e iconos, incidencias y cámaras DGT, cámara con IA en miniatura y entrega a Waze o Google Maps.
// Red: OpenFreeMap (mapa), OSRM de FOSSGIS (rutas, pruebas), Nominatim (búsqueda, ≤1/s). Sin red: radar.
import { createTracker, topAlert, RULES } from './core/drive-hazard.mjs';
import { hazardsAhead, corridorAnnouncement, stoppingDistanceM } from './core/drive-corridor.mjs';
import { createBlackBox } from './core/drive-blackbox.mjs';
import { radarsAhead, createSectionTracker, RADAR_RULES } from './core/drive-radars.mjs';
import { detectRegion, ndwToIncident, dutchMotorwayWindow } from './core/ndw-nl.mjs';
import { enrichTracksForHud, renderArHud } from './core/drive-ar-hud.mjs';
import { rssLongitudinalSameDir, EXAMPLE_RSS_PARAMS } from './core/drive-physics-v2.mjs';
import { createLinkProber, isProbePack } from './core/ble-link-probe.mjs';
import { openPmTilesLocal } from './core/pmtiles-reader.mjs';
import { parseGdacsRss, parseMtgEvents, osintNear } from './core/osint-feeds.mjs';
import { interpretAlternatives } from './core/voice-report.mjs';
import { REPORT_KINDS } from './core/road-guard.mjs';
import { parseDatex2 } from './core/datex2.mjs';
import { wazeUrl, googleMapsUrl } from './core/route-planner.mjs';
import { routeUrl, parseRoute, nextManeuver, shouldReroute, announcement } from './core/nav-osrm.mjs';
import { CATEGORIES, FROM_REPORT, fromDatex, markerSvg } from './core/report-style.mjs';
import { saveBlob } from './save-file.mjs';
import { packReports, unpackReports, mergeReports, isReportPack } from './core/hazard-share.mjs';
import { b64, unb64 } from './core/b64.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const say = (t) => { try { speechSynthesis.cancel(); speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: 'es-ES' })); } catch { /* sin voz */ } };
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
const reports = () => LS.get('senda.ruta.reports', []);

const st = {
  pos: null, speed: null, heading: 0, region: 'ES', follow: true, map: null, mapOk: false, route: null, dest: null,
  said: new Set(), saidCorridor: new Set(), saidRadar: new Set(), corridor: null, lastRouteS: -1e9,
  incidents: [], nlIncidents: [], incSource: '', nlIncSource: '', cams: [],
  radars: [], stretches: [], sectionTracker: createSectionTracker([]), radarState: null, sectionState: null,
  me: null, bb: createBlackBox(),
  ble: { tx: 0, rx: 0, rejected: 0 }, prober: createLinkProber(),
  battery: { pct: null, charging: null }, aiMode: LS.get('senda.drive.aiMode', 'auto'),
  imu: { ax: null, ay: null, az: null, gx: null, gy: null, gz: null, alpha: null, beta: null, gamma: null },
  osintEvents: [], osintState: null, pmArchives: new Map(), lastVision: null,
};

// ── Mapa (OpenFreeMap en línea o archivo local .pmtiles 100 % sin red; si no carga en 10 s → radar) ──
function ensureRouteLayers(map) {
  if (!map.getSource('route')) {
    map.addSource('route', { type: 'geojson', data: st.route ? { type: 'Feature', geometry: { type: 'LineString', coordinates: st.route.coords } } : { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#0b5394', 'line-width': 11 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#2b8cff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  }
}
function registerPmTilesProtocol() {
  if (!window.maplibregl?.addProtocol) return;
  maplibregl.addProtocol('pmtiles', async (params) => {
    const m = /^pmtiles:\/\/local\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) return { data: new Uint8Array(0) };
    const archive = st.pmArchives.get(m[1]);
    if (!archive) return { data: new Uint8Array(0) };
    const tile = await archive.getTile(Number(m[2]), Number(m[3]), Number(m[4]));
    return { data: tile ?? new Uint8Array(0) };
  });
}
function initMap() {
  if (!window.maplibregl) return offline('No se pudo cargar el mapa.');
  maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
  registerPmTilesProtocol();
  const map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-3.7038, 40.4168], zoom: 12, attributionControl: { compact: true } });
  st.map = map;
  const t = setTimeout(() => { if (!st.mapOk) offline('Sin conexión al mapa: se muestra el radar. Puedes cargar un mapa offline (.pmtiles) desde el botón naranja.'); }, 10000);
  map.on('load', () => {
    st.mapOk = true; clearTimeout(t);
    ensureRouteLayers(map);
    if (st.lastFix) onPos(st.lastFix);
    drawMarkers();
  });
  map.on('style.load', () => { if (st.mapOk) { ensureRouteLayers(map); drawMarkers(); } });
  map.on('dragstart', () => { st.follow = false; });
  let mv; map.on('moveend', () => { clearTimeout(mv); mv = setTimeout(drawMarkers, 300); });
}
function offline(msg) { $('#map').hidden = true; $('#radarWrap').hidden = false; $('#offmsg').textContent = msg; drawRadar(); }
async function loadPmTilesFile(file) {
  const archive = await openPmTilesLocal(file);
  const id = String(Date.now());
  st.pmArchives.set(id, archive);
  const h = archive.header;
  const isRaster = h.tileType !== 'mvt';
  const layers = [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9eff2' } }];
  if (isRaster) {
    layers.push({ id: 'pm-raster', type: 'raster', source: 'pm' });
  } else {
    const vLayers = Array.isArray(archive.metadata?.vector_layers) ? archive.metadata.vector_layers : [];
    for (const vl of vLayers.slice(0, 12)) {
      const n = String(vl.id || '');
      const isWater = /water/i.test(n), isRoad = /road|transp/i.test(n);
      layers.push({
        id: `pm-${n}`,
        type: isWater ? 'fill' : 'line',
        source: 'pm',
        'source-layer': n,
        paint: isWater ? { 'fill-color': '#a8d5f2' } : { 'line-color': isRoad ? '#546e7a' : '#90a4ae', 'line-width': isRoad ? 2 : 1 },
      });
    }
  }
  const style = {
    version: 8,
    sources: {
      pm: {
        type: isRaster ? 'raster' : 'vector',
        tiles: [`pmtiles://local/${id}/{z}/{x}/{y}`],
        minzoom: h.minZoom,
        maxzoom: h.maxZoom,
        attribution: archive.metadata?.attribution || 'PMTiles local offline (OSM)',
      },
    },
    layers,
  };
  $('#radarWrap').hidden = true; $('#map').hidden = false;
  if (st.map) {
    st.mapOk = true;
    st.map.setStyle(style);
    const center = st.pos ?? [h.centerLon || -3.7038, h.centerLat || 40.4168];
    st.map.jumpTo({ center, zoom: Math.max(h.minZoom, Math.min(h.maxZoom, h.centerZoom || 12)) });
  }
  hint(`Mapa offline PMTiles v3 cargado (${h.tileType.toUpperCase()} · z${h.minZoom}–z${h.maxZoom} · 0 red).`);
  return { id, header: h, metadata: archive.metadata };
}

// ── Marcadores: incidencias DGT, cámaras DGT y avisos de SENDA (cada tipo con su color e icono) ──
let markers = [];
function marker(lon, lat, cat, popupHtml) {
  const el = document.createElement('div'); el.innerHTML = markerSvg(cat, cat === 'CAMARA' ? 26 : 34); el.style.cursor = 'pointer'; el.dataset.cat = cat;
  const m = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]);
  if (popupHtml) m.setPopup(new maplibregl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(popupHtml));
  return m.addTo(st.map);
}
function drawMarkers() {
  if (!st.mapOk) return drawRadar();
  markers.forEach((m) => m.remove()); markers = [];
  const b = st.map.getBounds(), inView = (lon, lat) => b.contains([lon, lat]);
  for (const i of activeIncidents()) if (i.lat != null && inView(i.lon, i.lat)) {
    const cat = i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i);
    markers.push(marker(i.lon, i.lat, cat, `<b>${esc(i.type === 'BridgeOpening' ? 'Puente levadizo' : CATEGORIES[cat].label)}</b> · ${esc(i.road ?? '')}<br><small>${esc(i.type)} / ${esc(i.cause ?? '')}<br>${esc(activeIncSource())}</small>`));
  }
  if (st.map.getZoom() >= 10) {
    for (const c of st.cams) if (inView(c.lon, c.lat))
      markers.push(marker(c.lon, c.lat, 'CAMARA', `<b>Cámara DGT</b> · ${esc(c.carretera)} ${esc(c.destino ?? '')}<br><img src="${esc(c.url)}" alt="Imagen de la cámara" style="width:100%;border-radius:8px;margin-top:6px"><small>DGT, CC BY · imagen en vivo si hay red</small>`));
    for (const rd of st.radars) if (inView(rd.lon, rd.lat))
      markers.push(marker(rd.lon, rd.lat, 'CAMARA', `<b>${rd.kind === 'section' ? 'Radar de tramo' : 'Radar fijo'} oficial</b>${rd.road ? ` · ${esc(rd.road)}` : ''}${rd.maxspeed ? ` · ${rd.maxspeed} km/h` : ''}<br><small>${esc(String(rd.src).toUpperCase())} · publicado oficialmente (solo fijos y tramo)</small>`));
  }
  for (const r of reports()) if (inView(r.lon, r.lat)) {
    const cat = FROM_REPORT[r.kind] ?? 'PELIGRO';
    markers.push(marker(r.lon, r.lat, cat, `<b>${esc(REPORT_KINDS[r.kind]?.label ?? r.kind)}</b><br><small>Aviso de SENDA · ${new Date(r.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${r.verified ? 'visto con cámara' : 'sin verificar'}</small>`));
  }
}

// ── Incidencias ES (DGT) + NL (NDW DATEX II v3 CC0: SRTI, brugopeningen, afsluitingen) ──
async function loadIncidents() {
  try { const r = await fetch('/senda/live/dgt-incidencias.xml', { cache: 'no-store' }); if (r.ok) { st.incidents = parseDatex2(await r.text()); st.incSource = `DGT en vivo ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; drawMarkers(); return updateCorridor(); } } catch { /* copia */ }
  try { const d = await (await fetch('/senda/data/referencias/dgt_incidencias.json')).json(); st.incidents = Object.values(d).find(Array.isArray) ?? []; st.incSource = `DGT, copia del ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`; } catch { st.incSource = 'sin incidencias'; }
  drawMarkers(); updateCorridor();
}
fetch('/senda/data/referencias/nl_ndw_incidencias.json').then((r) => r.json()).then((d) => {
  st.nlIncidents = Array.isArray(d.incidencias) ? d.incidencias.map(ndwToIncident) : [];
  st.nlIncSource = `NDW NL (CC0), ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`;
  drawMarkers(); updateCorridor();
}).catch(() => {});
fetch('/senda/data/referencias/dgt_camaras.json').then((r) => r.json()).then((d) => { st.cams = d.camaras; drawMarkers(); }).catch(() => {});
Promise.allSettled([
  fetch('/senda/data/referencias/dgt_radares_oficiales.json').then((r) => r.json()),
  fetch('/senda/data/referencias/nl_radares_oficiales.json').then((r) => r.json()),
]).then(([esRes, nlRes]) => {
  const es = esRes.status === 'fulfilled' ? esRes.value : {};
  const nl = nlRes.status === 'fulfilled' ? nlRes.value : {};
  st.radars = [...(Array.isArray(es.puntos) ? es.puntos : []), ...(Array.isArray(nl.puntos) ? nl.puntos : [])];
  st.stretches = [...(Array.isArray(es.tramos) ? es.tramos : []), ...(Array.isArray(nl.tramos) ? nl.tramos : [])];
  st.sectionTracker = createSectionTracker(st.stretches);
  drawMarkers(); updateRadars();
});

const activeIncidents = () => (st.region === 'NL' ? st.nlIncidents : st.incidents);
const activeIncSource = () => (st.region === 'NL' ? (st.nlIncSource || 'NDW NL') : (st.incSource || 'DGT'));

// ── Avisos por delante en el corredor (100 % en el móvil, con o sin red, auto ES / NL) ──
function updateCorridor() {
  const el = $('#corridorAlert');
  if (!st.pos) { st.corridor = null; if (el) el.hidden = true; return; }
  const res = hazardsAhead({
    pos: st.pos, headingDeg: st.heading, speedMs: st.speed,
    routeCoords: st.route?.coords ?? null,
    incidents: activeIncidents(), incSource: activeIncSource(),
    reports: reports(),
  });
  st.corridor = res;
  if (!el) return;
  if (!res.top) { el.hidden = true; return; }
  const t = res.top;
  el.hidden = false; el.className = 'card ' + t.urgency;
  $('#caIco').innerHTML = markerSvg(t.cat, 26);
  $('#caTitle').textContent = `${t.label} · ${fmtDist(t.distM)}${t.road ? ` · ${t.road}` : ''}`;
  const ssdTxt = res.ssdM != null ? ` · parada AASHTO ${Math.round(res.ssdM)} m` : '';
  const extra = res.dedupedCount > 1 ? ` · +${res.dedupedCount - 1} más` : '';
  $('#caSub').textContent = `${t.sourceLabel}${ssdTxt}${extra}`;
  const phrase = corridorAnnouncement(t, st.saidCorridor);
  if (phrase) say(phrase);
}

// ── Radares fijos, de semáforo y de tramo publicados (ES + NL, 100 % legal, sin móviles policiales) ──
function updateRadars(nowMs = Date.now()) {
  const el = $('#radarAlert');
  if (!st.pos) { st.radarState = null; st.sectionState = null; if (el) el.hidden = true; return; }
  const nowHour = new Date(nowMs).getHours();
  const res = radarsAhead({ pos: st.pos, headingDeg: st.heading, speedMs: st.speed, points: st.radars, nowHour });
  const sec = st.sectionTracker.update({ pos: st.pos, tMs: nowMs, headingDeg: st.heading, speedMs: st.speed });
  st.radarState = res;
  st.sectionState = sec;
  if (!el) return;
  const limEl = $('#raLim');
  if (sec && !sec.finished) {
    el.hidden = false;
    el.className = 'card' + (sec.overAverage ? ' OVER' : '');
    $('#raTitle').textContent = `Tramo${sec.road ? ` · ${sec.road}` : ''} · media ${sec.avgKmh != null ? sec.avgKmh.toFixed(1).replace('.', ',') : '–'} km/h`;
    $('#raSub').textContent = `Quedan ${fmtDist(sec.remainingM)} (${sec.progressPct} %) · radar de tramo oficial publicado`;
    if (sec.maxspeed != null) { limEl.hidden = false; limEl.textContent = String(sec.maxspeed); } else limEl.hidden = true;
    return;
  }
  if (!res.top) { el.hidden = true; return; }
  const r = res.top;
  el.hidden = false;
  el.className = 'card' + (r.overLimit ? ' OVER' : '');
  const kindLbl = r.kind === 'section' ? 'Trajectcontrole / Tramo' : r.kind === 'redlight' ? 'Cámara semáforo / Roodlicht' : 'Radar fijo / Flitspaal';
  $('#raTitle').textContent = `${kindLbl} · ${fmtDist(r.distM)}${r.road ? ` · ${r.road}` : ''}`;
  const omTxt = r.omCheck ? ` · OM corr. ${r.omCheck.correctedKmh} km/h` : '';
  const nlDay = r.country === 'NL' ? ` · ${dutchMotorwayWindow(new Date(nowMs)).label}` : '';
  $('#raSub').textContent = `${r.attribution}${r.etaS != null ? ` · ${r.etaS} s` : ''}${omTxt}${r.dir ? ` · ${r.dir}` : ''}${!r.maxspeed ? nlDay : ''}`;
  if (r.maxspeed != null) { limEl.hidden = false; limEl.textContent = String(r.maxspeed); } else limEl.hidden = true;
  if (r.distM <= RADAR_RULES.voiceM && !st.saidRadar.has(r.id)) {
    st.saidRadar.add(r.id);
    say(`${r.kind === 'section' ? 'Radar de tramo' : r.kind === 'redlight' ? 'Cámara de semáforo' : 'Radar fijo'} a ${fmtDist(r.distM)}${r.maxspeed ? `, límite ${r.maxspeed}` : ''}`);
  }
}

function updateOsint() {
  if (!st.pos || !st.osintEvents.length) { st.osintState = null; return; }
  const near = osintNear({ pos: st.pos, events: st.osintEvents, radiusKm: 150 });
  st.osintState = near.length
    ? { count: near.length, closestKm: near[0].distKm, topType: near[0].type, topLevel: near[0].level }
    : { count: 0, closestKm: null, topType: null, topLevel: null };
}

// ── GPS, seguimiento y navegación ──
function onPos(p) {
  st.lastFix = p;
  st.pos = [p.coords.longitude, p.coords.latitude]; st.speed = p.coords.speed;
  st.region = detectRegion(st.pos);
  if (p.coords.heading != null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 1) st.heading = p.coords.heading;
  $('#speed').innerHTML = `<div>${st.speed == null ? '–' : Math.round(st.speed * 3.6)}<small>km/h</small></div>`;
  if (st.mapOk) {
    if (!st.me) { const el = document.createElement('div'); el.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M12 4 6 19l6-3 6 3z" fill="#2b8cff"/></svg>'; st.me = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat(st.pos).addTo(st.map); st.map.jumpTo({ center: st.pos, zoom: 15 }); }
    st.me.setLngLat(st.pos).setRotation(st.heading);
    if (st.follow) st.map.easeTo({ center: st.pos, bearing: st.route ? st.heading : st.map.getBearing(), pitch: st.route ? 45 : 0, duration: 800 });
  } else drawRadar();
  if (st.route) guide();
  updateCorridor();
  updateRadars(p.timestamp || Date.now());
  updateOsint();
}
navigator.geolocation?.watchPosition(onPos, () => { $('#speed').innerHTML = '<div>–<small>sin GPS</small></div>'; }, { enableHighAccuracy: true, maximumAge: 1000 });

function guide() {
  const now = performance.now() / 1000;
  if (shouldReroute(st.route, st.pos, st.lastRouteS, now)) { say('Recalculando'); return goTo(st.dest, true); }
  const n = nextManeuver(st.route, st.pos);
  $('#turn').hidden = false; $('#turnDist').textContent = fmtDist(n.distM); $('#turnTxt').textContent = n.step.text;
  const a = announcement(n, st.said); if (a) say(a);
  if (n.step.type === 'arrive' && n.distM < 30) { say('Has llegado'); endNav(); }
}

async function goTo(dest, reroute = false) {
  if (!st.pos) return hint('Esperando al GPS para calcular la ruta…');
  st.dest = dest; st.lastRouteS = performance.now() / 1000;
  hint(reroute ? 'Recalculando…' : 'Calculando ruta…');
  $('#etaBox').hidden = false; $('#searchBox').hidden = true;
  try {
    const r = parseRoute(await (await fetch(routeUrl({ from: st.pos, to: dest.at }))).json());
    if (!r.ok) return hint('No hay ruta: ' + r.reason);
    st.route = r; st.said = new Set(); st.follow = true;
    st.map?.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords } });
    const arrive = new Date(Date.now() + r.durationS * 1000);
    $('#etaTime').textContent = arrive.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    $('#etaInfo').textContent = `${Math.round(r.durationS / 60)} min · ${fmtDist(r.distanceM)} · ${dest.name}`;
    hint('Llegada estimada por OSRM, sin tráfico en vivo. Para tráfico en vivo, abre la misma ruta en Waze o Google Maps.');
    guide(); updateCorridor();
  } catch { hint('Sin conexión al servicio de rutas. Abre el destino en Waze o Google Maps.'); $('#etaTime').textContent = dest.name; $('#etaInfo').textContent = ''; }
}
function endNav() { st.route = null; st.dest = null; $('#turn').hidden = true; $('#etaBox').hidden = true; $('#searchBox').hidden = false; st.map?.getSource('route')?.setData({ type: 'FeatureCollection', features: [] }); st.map?.easeTo({ pitch: 0, bearing: 0 }); hint('Busca un destino o toca Casa/Trabajo.'); updateCorridor(); }
$('#endNav').addEventListener('click', endNav);
$('#goWaze').addEventListener('click', () => { if (st.dest) location.href = wazeUrl({ to: st.dest.at }).url; });
$('#goMaps').addEventListener('click', () => { if (st.dest) location.href = googleMapsUrl({ from: st.pos ?? st.dest.at, to: st.dest.at }).url; });
$('#center').addEventListener('click', () => { st.follow = true; if (st.pos && st.mapOk) st.map.easeTo({ center: st.pos, zoom: 16 }); });
function hint(t) { $('#hint').textContent = t; }

// ── Búsqueda (Nominatim: solo al pulsar «Buscar», máximo 1 petición por segundo) ──
let lastSearch = 0;
$('#search').addEventListener('submit', async (e) => {
  e.preventDefault(); const q = $('#q').value.trim(); if (!q) return;
  if (Date.now() - lastSearch < 1100) return; lastSearch = Date.now();
  const box = $('#results'); box.hidden = false; box.innerHTML = '<button disabled>Buscando…</button>';
  try {
    const near = st.pos ? `&viewbox=${st.pos[0] - 0.5},${st.pos[1] + 0.5},${st.pos[0] + 0.5},${st.pos[1] - 0.5}` : '';
    const list = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es&q=${encodeURIComponent(q)}${near}`)).json();
    box.innerHTML = list.length ? list.map((p, i) => `<button data-i="${i}">${esc(p.name || p.display_name.split(',')[0])}<small>${esc(p.display_name)}</small></button>`).join('') : '<button disabled>Sin resultados</button>';
    box.onclick = (ev) => { const i = ev.target.closest('[data-i]')?.dataset.i; if (i == null) return; const p = list[i]; box.hidden = true; goTo({ name: p.name || p.display_name.split(',')[0], at: [Number(p.lon), Number(p.lat)] }); };
  } catch { box.innerHTML = '<button disabled>Sin conexión para buscar</button>'; }
});
for (const [id, key, name] of [['#favHome', 'home', 'Casa'], ['#favWork', 'work', 'Trabajo']]) $(id).addEventListener('click', () => {
  const fav = LS.get('senda.drive.fav.' + key, null);
  if (!fav) { if (!st.pos) return hint('Sin GPS todavía.'); if (confirm(`¿Guardar tu posición actual como «${name}»?`)) { LS.set('senda.drive.fav.' + key, st.pos); hint(`${name} guardado.`); } return; }
  goTo({ name, at: fav });
});

// ── Avisos: cuadrícula con colores e iconos + voz ──
const KINDS = ['accidente', 'retencion', 'parado', 'obstaculo', 'obras', 'animal', 'niebla', 'hielo'];
$('#grid').innerHTML = KINDS.map((k) => `<button data-k="${k}">${markerSvg(FROM_REPORT[k], 58)}${esc(REPORT_KINDS[k].label.replace('Vehículo parado', 'Parado'))}</button>`).join('');
const openSheet = (on) => { $('#sheet').hidden = !on; $('#veil').hidden = !on; };
$('#reportBtn').addEventListener('click', () => openSheet(true));
$('#veil').addEventListener('click', () => openSheet(false));
$('#grid').addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) { openSheet(false); saveReport(k); } });
function saveReport(kind, side = 'SIN_INDICAR') {
  if (!st.pos) return hint('Sin GPS: no se puede situar el aviso.');
  const list = reports(); list.push({ kind, side, lon: st.pos[0], lat: st.pos[1], t: Date.now(), own: true }); LS.set('senda.ruta.reports', list);
  drawMarkers(); updateCorridor(); say(`Aviso de ${REPORT_KINDS[kind].label} guardado`); hint(`Aviso «${REPORT_KINDS[kind].label}» guardado en tu posición. Para pasarlo a otros móviles SENDA cercanos: botón naranja → «Bluetooth».`);
}
window.sendaVoice = (res) => {
  if (res.state) return hint(res.state === 'ESCUCHANDO' ? 'Habla ahora…' : 'Procesando…');
  if (res.error) return hint('Voz: ' + res.error);
  const r = interpretAlternatives(res.alternatives);
  if (!r.kind) return hint(`No entendido: «${r.text || ''}»`);
  if (confirm(`¿Publicar «${r.label}» aquí?`)) saveReport(r.kind, r.side);
};
$('#voiceBtn').addEventListener('click', () => {
  if (typeof window.SendaNative?.listen === 'function') window.SendaNative.listen();
  else { const t = prompt('Escribe o dicta el aviso:'); if (t) window.sendaVoice({ alternatives: [t] }); }
});

// ── Avisos y sonda cooperativa RTT entre móviles SENDA por Bluetooth (sin red, sin MACs ajenas) ──
$('#shareBle').addEventListener('click', () => {
  openSheet(false);
  const N = window.SendaNative;
  if (typeof N?.p2pSend !== 'function') return hint('Compartir por Bluetooth solo funciona en la app de Android.');
  N.p2pStart(); // abre tu buzón para RECIBIR los avisos de otros
  const pack = packReports(reports());
  if (pack[2] === 0) return hint('Buzón Bluetooth abierto: recibirás avisos de móviles SENDA cercanos. No tienes avisos recientes que enviar.');
  st.ble.tx += pack[2];
  N.p2pSend(b64(pack)); hint(`Enviando ${pack[2]} aviso(s) a móviles SENDA cercanos…`);
});
function sendBleProbe() {
  openSheet(false);
  const N = window.SendaNative;
  const ping = st.prober.makePing(Date.now());
  if (typeof N?.p2pSend !== 'function') {
    hint('Sonda BLE generada (16 bytes CRC-8). Para enviarla por radio BLE, abre SENDA en Android.');
    return ping;
  }
  N.p2pStart();
  N.p2pSend(b64(ping.bytes));
  hint(`Sonda BLE PING #${st.prober.stats().pingsSent} enviada a móviles SENDA cercanos (esperando PONG para medir RTT)…`);
  return ping;
}
$('#probeBle')?.addEventListener('click', sendBleProbe);
$('#pmBtn')?.addEventListener('click', () => { openSheet(false); $('#pmFile')?.click(); });
$('#pmFile')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try { await loadPmTilesFile(f); } catch (err) { hint('No se pudo abrir .pmtiles: ' + (err.message || err)); }
});
window.sendaP2P = (ev) => {
  if (ev.event === 'status') return hint(ev.text);
  if (ev.event !== 'received') return;
  const bytes = unb64(ev.b64);
  if (isProbePack(bytes)) {
    const res = st.prober.onReceive(bytes, Date.now());
    if (!res.ok) return hint('Sonda BLE descartada: ' + res.error);
    if (res.type === 'PING' && res.reply) {
      window.SendaNative?.p2pSend?.(b64(res.reply));
      return hint(`Sonda BLE PING respondida automáticamente (PONG #${st.prober.stats().pingsAnswered}).`);
    }
    if (res.type === 'PONG') {
      const s = st.prober.stats();
      return hint(`Sonda BLE PONG recibido · RTT ${res.rttMs} ms · mediana ${s.medianRttMs} ms · tasa ${Math.round((s.responseRate ?? 0) * 100)} %.`);
    }
    return;
  }
  if (!isReportPack(bytes)) return hint('Ha llegado un mensaje cifrado por Bluetooth: ábrelo en Mensajes.');
  try {
    const { reports: got, rejected } = unpackReports(bytes);
    st.ble.rx += got.length; st.ble.rejected += rejected;
    const m = mergeReports(reports(), got); LS.set('senda.ruta.reports', m.reports); drawMarkers(); updateCorridor();
    if (m.added) say(`${m.added} aviso${m.added > 1 ? 's' : ''} nuevo${m.added > 1 ? 's' : ''} de otro móvil`);
    hint(`Recibidos ${got.length} aviso(s) de otro móvil (${m.added} nuevos${rejected ? `, ${rejected} descartados por corruptos` : ''}). Sin verificar.`);
  } catch (e) { hint('Paquete de avisos no válido: ' + e.message); }
};

// ── Cámara con IA en miniatura (toca para ampliar). Cadencia seleccionable: Auto / 4 Hz fija / 2 Hz ahorro. ──
const MP = '/senda/vendor/mediapipe-tasks-vision-1.2.3';
const ES = { car: 'coche', truck: 'camión', bus: 'autobús', motorcycle: 'moto', bicycle: 'bici', person: 'persona', dog: 'perro', horse: 'caballo', cow: 'vaca', sheep: 'oveja' };
const COLOR = { VERDE: '#34c759', AMBAR: '#ffcc00', ROJO: '#ff3b30' };
const AI_MODES = ['auto', '4hz', '2hz'];
const AI_LABELS = { auto: 'IA: Auto', '4hz': 'IA: 4 Hz fija', '2hz': 'IA: 2 Hz' };
function syncAiLabels() {
  const lbl = AI_LABELS[st.aiMode] ?? 'IA: Auto';
  if ($('#aiModeBtn')) $('#aiModeBtn').textContent = lbl;
  if ($('#sheetAiMode')) $('#sheetAiMode').textContent = lbl;
}
function setAiMode(mode) {
  st.aiMode = AI_MODES.includes(mode) ? mode : 'auto';
  LS.set('senda.drive.aiMode', st.aiMode);
  syncAiLabels();
  hint(st.aiMode === '4hz'
    ? 'Cadencia IA fijada en 4 Hz sin recorte por batería (modo calibración).'
    : st.aiMode === '2hz'
      ? 'Cadencia IA fijada en 2 Hz (ahorro de batería).'
      : 'Cadencia IA en modo Auto (4 Hz normal, 2 Hz si batería < 25 % sin cargar).');
  return st.aiMode;
}
const cycleAiMode = () => setAiMode(AI_MODES[(AI_MODES.indexOf(st.aiMode) + 1) % AI_MODES.length]);
$('#aiModeBtn')?.addEventListener('click', cycleAiMode);
$('#sheetAiMode')?.addEventListener('click', cycleAiMode);
syncAiLabels();
const aiIntervalMs = () => {
  if (st.aiMode === '4hz') return 250;
  if (st.aiMode === '2hz') return 500;
  return st.battery.pct != null && st.battery.pct < 25 && st.battery.charging === false ? 500 : 250;
};
function summarizeVision(objs, inferMs, intervalMs) {
  const top = topAlert(objs);
  const ttcs = objs.map((o) => o.ttcS).filter((x) => x != null);
  return {
    active: true,
    count: objs.length,
    level: top?.level ?? 'VERDE',
    minTtcS: ttcs.length ? Math.min(...ttcs) : null,
    clipped: objs.filter((o) => o.clipped).length,
    inferMs,
    hz: +(1000 / intervalMs).toFixed(1),
    tracks: objs,
  };
}
let det = null, stream = null, tracker = null, camOn = false, lastT = 0; const saidAdas = new Map();
const FULL_RULES = { ...RULES, includeInfra: true };
function hudPhysicsState(iv = 250) {
  const spd = st.speed;
  const ssdM = stoppingDistanceM(spd);
  const rssM = spd != null && spd > 0 ? rssLongitudinalSameDir({ vRearMs: spd, vFrontMs: spd }, EXAMPLE_RSS_PARAMS).dMinM : null;
  const curvature = spd != null && spd > 3 && typeof st.imu.ay === 'number' ? st.imu.ay / (spd * spd) : 0;
  return {
    speedMs: spd, ssdM, rssM, curvature, imu: st.imu, region: st.region,
    radarTop: st.radarState?.top ?? null, corridorTop: st.corridor?.top ?? null,
    pos: st.pos, aiHz: +(1000 / iv).toFixed(1), bbActive: st.bb.active,
  };
}
$('#camBtn').addEventListener('click', async () => {
  if (camOn) return camStop();
  try {
    await getDetector();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    $('#v').srcObject = stream; await $('#v').play(); try { await navigator.wakeLock?.request('screen'); } catch { /* */ }
    camOn = true; tracker = createTracker(FULL_RULES); $('#pip').hidden = false; $('#camBtn').classList.add('on'); requestAnimationFrame(tick);
  } catch (e) { hint('Cámara no disponible: ' + (e.message || e.name)); }
});
$('#pip').addEventListener('click', () => $('#pip').classList.toggle('big'));
function camStop() { camOn = false; st.lastVision = null; stream?.getTracks().forEach((t) => t.stop()); stream = null; $('#pip').hidden = true; $('#adas').hidden = true; $('#camBtn').classList.remove('on'); }
document.addEventListener('visibilitychange', () => { if (document.hidden && camOn) camStop(); });
function tick(now) {
  if (!camOn) return;
  const iv = aiIntervalMs();
  if (now - lastT >= iv) { lastT = now; analyse(now, iv); }
  requestAnimationFrame(tick);
}
function analyse(now, iv = 250) {
  const v = $('#v'); if (!v.videoWidth) return;
  const W = v.videoWidth, H = v.videoHeight, t0 = performance.now(), r = det.detectForVideo(v, now), inferMs = performance.now() - t0;
  const rawObjs = tracker.update(r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H })), now / 1000);
  const objs = enrichTracksForHud(rawObjs, { speedMs: st.speed });
  st.lastVision = summarizeVision(objs, inferMs, iv);
  const c = $('#ov'), box = c.getBoundingClientRect(), dpr = devicePixelRatio || 1; c.width = box.width * dpr; c.height = box.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  renderArHud(x, box.width, box.height, { ...hudPhysicsState(iv), tracks: objs });
  const top = topAlert(objs), a = $('#adas');
  if (!top) { a.hidden = true; return; }
  a.hidden = false; a.className = top.level;
  a.textContent = `${ES[top.label] ?? top.label} ${top.zone === 'TU_CARRIL' ? 'delante' : top.zone === 'DERECHA' ? 'a la derecha' : 'a la izquierda'}: ${top.reasons.join(' · ')}`;
  const key = top.id + top.level; if (Date.now() - (saidAdas.get(key) ?? 0) > 6000) { saidAdas.set(key, Date.now()); if (top.level === 'ROJO') { navigator.vibrate?.([200, 100, 200]); say(`Cuidado, ${ES[top.label] ?? 'vehículo'} delante`); } else if (top.reasons.some((rr) => rr.startsWith('se mete'))) say(`${ES[top.label] ?? 'vehículo'} ${top.reasons.find((rr) => rr.startsWith('se mete'))}`); }
}

// ── Modo dashcam AR-HUD 3D + BEV: cámara trasera a pantalla completa + mapa al lado ──
const QUALITY = { low: { w: 1280, h: 720, bps: 2_500_000, label: '720p' }, high: { w: 1920, h: 1080, bps: 8_000_000, label: '1080p' } };
const dash = { on: false, q: 'low', stream: null, objs: [], lastDet: 0, rec: null, chunks: [], t0: 0, timer: null };
async function getDetector() {
  if (det) return det;
  const vision = await import(MP + '/vision_bundle.mjs'); const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
  det = await vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: '/senda/vendor/models/efficientdet_lite0_int8.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: 0.35, maxResults: 12 });
  return det;
}
async function dashCamera() {
  dash.stream?.getTracks().forEach((t) => t.stop());
  const q = QUALITY[dash.q];
  dash.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: 30 } }, audio: false });
  const v = $('#v'); v.srcObject = dash.stream; await v.play();
}
async function dashOpen() {
  if (camOn) camStop();
  document.documentElement.classList.add('dashmode'); $('#dash').hidden = false; dash.on = true;
  $('#dashInfo').textContent = 'Cargando cámara…';
  try {
    await Promise.all([getDetector(), dashCamera()]); tracker = createTracker(FULL_RULES);
    try { await navigator.wakeLock?.request('screen'); } catch { /* */ }
    st.map?.resize(); requestAnimationFrame(dashFrame);
  } catch (e) { $('#dashInfo').textContent = 'Cámara no disponible: ' + (e.message || e.name); }
}
function dashClose() {
  if (dash.rec) dashRecord();
  dash.on = false; st.lastVision = null; dash.stream?.getTracks().forEach((t) => t.stop()); dash.stream = null;
  document.documentElement.classList.remove('dashmode', 'nomini'); $('#dash').hidden = true; st.map?.resize();
}
function dashFrame(now) {
  if (!dash.on) return;
  const v = $('#v'), c = $('#dashCanvas');
  if (v.videoWidth) {
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const W = c.width, H = c.height, x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(v, 0, 0, W, H);
    const iv = aiIntervalMs();
    if (now - dash.lastDet >= iv) { dash.lastDet = now; const t0 = performance.now(), r = det.detectForVideo(v, now), inferMs = performance.now() - t0;
      const rawObjs = tracker.update(r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H })), now / 1000);
      dash.objs = enrichTracksForHud(rawObjs, { speedMs: st.speed, sourceCtx: x, W, H });
      st.lastVision = summarizeVision(dash.objs, inferMs, iv);
      const top = topAlert(dash.objs); if (top) warnDash(top); }
    drawDashData(x, W, H, iv); // AR-HUD 3D + BEV completo en pantalla (y en vídeo si «Datos en el vídeo» está activo)
    $('#dashInfo').textContent = `${dash.objs.length} obj · ${st.region} · ${W}×${H} · ${(1000 / iv).toFixed(0)} Hz`;
  }
  requestAnimationFrame(dashFrame);
}
function drawDashData(x, W, H, iv = 250) {
  renderArHud(x, W, H, { ...hudPhysicsState(iv), tracks: dash.objs });
}
function warnDash(o) {
  const key = o.id + o.level; if (Date.now() - (saidAdas.get(key) ?? 0) < 6000) return; saidAdas.set(key, Date.now());
  if (o.level === 'ROJO') { navigator.vibrate?.([200, 100, 200]); say(`Cuidado, ${ES[o.label] ?? 'vehículo'} delante`); }
  else if (o.reasons.some((r) => r.startsWith('se mete'))) say(`${ES[o.label] ?? 'vehículo'} ${o.reasons.find((r) => r.startsWith('se mete'))}`);
}
function pickMime() {
  for (const m of ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  return '';
}
async function dashRecord() {
  if (dash.rec) { // parar y guardar
    const r = dash.rec; dash.rec = null; clearInterval(dash.timer); $('#recBtn').classList.remove('on'); $('#recDot').hidden = true;
    await new Promise((ok) => { r.onstop = ok; r.stop(); });
    const mime = r.mimeType || 'video/webm', ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(dash.chunks, { type: mime }); dash.chunks = [];
    $('#dashInfo').textContent = `Guardando ${(blob.size / 1e6).toFixed(1)} MB…`;
    const res = await saveBlob(blob, `senda-dashcam-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${QUALITY[dash.q].label}.${ext}`, (f) => { $('#dashInfo').textContent = `Guardando… ${Math.round(f * 100)} %`; });
    say(res.ok ? 'Vídeo guardado' : 'No se pudo guardar el vídeo');
    $('#dashInfo').textContent = res.ok ? `Vídeo guardado en ${res.where} (${(blob.size / 1e6).toFixed(1)} MB)` : 'No se pudo guardar';
    return;
  }
  if (!dash.stream) return;
  const q = QUALITY[dash.q], mime = pickMime();
  const src = $('#withData').checked ? $('#dashCanvas').captureStream(30) : dash.stream; // con datos = lo que ves; sin datos = cámara tal cual
  dash.chunks = []; dash.rec = new MediaRecorder(src, { mimeType: mime || undefined, videoBitsPerSecond: q.bps });
  dash.rec.ondataavailable = (e) => { if (e.data.size) dash.chunks.push(e.data); };
  dash.rec.start(1000); dash.t0 = Date.now(); $('#recBtn').classList.add('on'); $('#recDot').hidden = false;
  dash.timer = setInterval(() => { const s = Math.floor((Date.now() - dash.t0) / 1000); $('#recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; $('#dashSpeed').textContent = `${st.speed == null ? '–' : Math.round(st.speed * 3.6)} km/h`; }, 500);
}
$('#dashBtn').addEventListener('click', dashOpen);
$('#dashExit').addEventListener('click', dashClose);
$('#recBtn').addEventListener('click', dashRecord);
$('#miniMap').addEventListener('click', () => { document.documentElement.classList.toggle('nomini'); st.map?.resize(); });
document.querySelectorAll('#dash [data-q]').forEach((b) => b.addEventListener('click', async () => {
  if (dash.rec) return say('Para la grabación para cambiar la calidad');
  dash.q = b.dataset.q; document.querySelectorAll('#dash [data-q]').forEach((x) => x.classList.toggle('on', x === b));
  try { await dashCamera(); } catch (e) { $('#dashInfo').textContent = 'Esa calidad no está disponible: ' + (e.message || e.name); }
}));
document.addEventListener('visibilitychange', () => { if (document.hidden && dash.on && !dash.rec) dashClose(); });

// ── Radar sin red (avisos, cámaras, radares oficiales e incidencias en 5 km; la marcha hacia arriba) ──
function drawRadar() {
  const c = $('#radar'); if (!c || $('#radarWrap').hidden) return;
  const x = c.getContext('2d'), W = c.width, R = W / 2 - 16, RANGE = 5000;
  x.clearRect(0, 0, W, W); x.save(); x.translate(W / 2, W / 2);
  x.strokeStyle = 'rgba(145,215,232,.3)'; x.lineWidth = 2; for (const f of [1, 0.5]) { x.beginPath(); x.arc(0, 0, R * f, 0, 7); x.stroke(); }
  if (st.pos) {
    const rot = -st.heading * Math.PI / 180, k = Math.cos(st.pos[1] * Math.PI / 180);
    const plot = (lon, lat, color, r) => { const dx = (lon - st.pos[0]) * 111320 * k, dy = (lat - st.pos[1]) * 110540; if (Math.hypot(dx, dy) > RANGE) return;
      const px = (dx * Math.cos(rot) - dy * Math.sin(rot)) / RANGE * R, py = -(dx * Math.sin(rot) + dy * Math.cos(rot)) / RANGE * R; x.fillStyle = color; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); };
    for (const cam of st.cams) plot(cam.lon, cam.lat, CATEGORIES.CAMARA.color, 7);
    for (const rd of st.radars) plot(rd.lon, rd.lat, '#30b0c7', 8);
    for (const i of activeIncidents()) if (i.lat != null) plot(i.lon, i.lat, CATEGORIES[i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i)].color, 10);
    for (const r of reports()) plot(r.lon, r.lat, CATEGORIES[FROM_REPORT[r.kind] ?? 'PELIGRO'].color, 12);
  }
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -22); x.lineTo(15, 17); x.lineTo(0, 8); x.lineTo(-15, 17); x.closePath(); x.fill(); x.restore();
}

// ── Sensores reales del dispositivo (batería + IMU 3 ejes; null si el móvil no los expone) ──
if (typeof navigator.getBattery === 'function') {
  navigator.getBattery().then((b) => {
    const syncBat = () => { st.battery.pct = +(b.level * 100).toFixed(1); st.battery.charging = b.charging; };
    syncBat(); b.addEventListener?.('levelchange', syncBat); b.addEventListener?.('chargingchange', syncBat);
  }).catch(() => {});
}
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (a) {
    if (typeof a.x === 'number' && Number.isFinite(a.x)) st.imu.ax = a.x;
    if (typeof a.y === 'number' && Number.isFinite(a.y)) st.imu.ay = a.y;
    if (typeof a.z === 'number' && Number.isFinite(a.z)) st.imu.az = a.z;
  }
  const r = e.rotationRate;
  if (r) {
    if (typeof r.alpha === 'number' && Number.isFinite(r.alpha)) st.imu.gx = r.alpha;
    if (typeof r.beta === 'number' && Number.isFinite(r.beta)) st.imu.gy = r.beta;
    if (typeof r.gamma === 'number' && Number.isFinite(r.gamma)) st.imu.gz = r.gamma;
  }
}, { passive: true });
window.addEventListener('deviceorientation', (e) => {
  if (typeof e.alpha === 'number' && Number.isFinite(e.alpha)) st.imu.alpha = e.alpha;
  if (typeof e.beta === 'number' && Number.isFinite(e.beta)) st.imu.beta = e.beta;
  if (typeof e.gamma === 'number' && Number.isFinite(e.gamma)) st.imu.gamma = e.gamma;
}, { passive: true });

function loadOsintXml(xml) {
  st.osintEvents = parseGdacsRss(xml);
  updateOsint();
  return st.osintEvents.length;
}
function loadOsintGeoJson(gj) {
  st.osintEvents = parseMtgEvents(gj);
  updateOsint();
  return st.osintEvents.length;
}

// ── Caja negra de viaje v2 (1 Hz, telemetría completa de calibración, SHA-256, sin vídeo ni PII, 0 €) ──
function rfSnapshot() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    online: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
    netType: c?.effectiveType ?? null,
    downlinkMbps: typeof c?.downlink === 'number' ? c.downlink : null,
    rttMs: typeof c?.rtt === 'number' ? c.rtt : null,
  };
}
let bbTimer = null;
function bbSample() {
  if (!st.bb.active) return null;
  const coords = st.lastFix?.coords;
  const entry = st.bb.record({
    t: Date.now(), pos: st.pos, accuracyM: coords?.accuracy ?? null,
    altM: coords?.altitude ?? null, altAccuracyM: coords?.altitudeAccuracy ?? null,
    speedMs: st.speed, headingDeg: st.heading, imu: { ...st.imu },
    vision: st.lastVision, corridor: st.corridor,
    radar: st.radarState, section: st.sectionState,
    rf: rfSnapshot(), battery: { ...st.battery },
    ble: { ...st.ble }, bleProbe: st.prober.stats(),
    osint: st.osintState,
  });
  const batTxt = st.battery.pct != null ? ` · Bat ${Math.round(st.battery.pct)} %` : '';
  const netTxt = navigator.onLine ? '' : ' · sin red';
  $('#bbText').textContent = `● Caja negra · ${st.bb.count}${batTxt}${netTxt}`;
  return entry;
}
function bbStart() {
  st.bb.reset(); st.bb.start();
  $('#bbBtn')?.classList.add('rec'); $('#bbBadge').hidden = false;
  syncAiLabels();
  bbSample();
  clearInterval(bbTimer); bbTimer = setInterval(bbSample, 1000);
  hint('Caja negra v2 activa (1 Hz, telemetría completa de calibración, solo local, sin vídeo ni PII).');
}
async function bbExport() {
  clearInterval(bbTimer); bbTimer = null; st.bb.stop();
  $('#bbBtn')?.classList.remove('rec'); $('#bbBadge').hidden = true;
  if (st.bb.count === 0) return hint('Caja negra vacía: no se guardó archivo.');
  const doc = await st.bb.exportSealed();
  const text = JSON.stringify(doc, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const name = `senda-blackbox-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const res = await saveBlob(blob, name);
  const s = doc.summary;
  hint(res.ok
    ? `Caja negra v2 sellada SHA-256 guardada en ${res.where} (${(blob.size / 1024).toFixed(1)} KB · ${s.frames} muestras · ${s.distanceKm} km · ${s.deadZoneSamples} sin red · ${s.radarAlertFrames} radares).`
    : 'No se pudo guardar la caja negra.');
  return doc;
}
$('#bbBtn')?.addEventListener('click', () => { if (st.bb.active) bbExport(); else bbStart(); });
$('#bbSave')?.addEventListener('click', bbExport);

// La tarjeta de abajo cambia de alto (llegada, avisos): los botones flotantes se colocan siempre encima.
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--bottomH', `${Math.ceil(e.target.getBoundingClientRect().height)}px`)).observe($('#bottom'));

initMap();
loadIncidents();
setInterval(() => { if (!document.hidden) loadIncidents(); }, 5 * 60 * 1000);
// Para pruebas automáticas
globalThis.sendaDrive = {
  st, goTo, onPos, dash, updateCorridor, updateRadars,
  bbStart, bbSample, bbExport, setAiMode, aiIntervalMs,
  sendBleProbe, loadPmTilesFile, loadOsintXml, loadOsintGeoJson,
  renderArHud, enrichTracksForHud, hudPhysicsState, createTracker, FULL_RULES,
};
