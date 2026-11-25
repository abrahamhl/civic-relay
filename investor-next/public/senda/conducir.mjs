// SENDA · Conducir (estilo navegador): mapa a pantalla completa, búsqueda, ruta giro a giro, avisos con
// colores e iconos, incidencias y cámaras DGT, cámara con IA en miniatura y entrega a Waze o Google Maps.
// Red: OpenFreeMap (mapa), OSRM de FOSSGIS (rutas, pruebas), Nominatim (búsqueda, ≤1/s). Sin red: radar.
import { createTracker, topAlert, RULES } from './core/drive-hazard.mjs';
import { hazardsAhead, corridorAnnouncement, stoppingDistanceM } from './core/drive-corridor.mjs';
import { createBlackBox } from './core/drive-blackbox.mjs';
import { radarsAhead, createSectionTracker, RADAR_RULES } from './core/drive-radars.mjs';
import { detectRegion, ndwToIncident, dutchMotorwayWindow } from './core/ndw-nl.mjs';
import { enrichTracksForHud, renderArHud, DEFAULT_CAM_GEOM, declaredGeom } from './core/drive-ar-hud.mjs';
import { rssLongitudinalSameDir, EXAMPLE_RSS_PARAMS } from './core/drive-physics-v2.mjs';
import { createGnssImuEkf, createHorizonCalibrator } from './core/drive-kalman-fusion.mjs';
import { sendaToDenm, denmToSenda, encodeDenmCompact, decodeDenmCompact, isDenmCompact, isInsideDenmRelevance } from './core/cits-denm.mjs';
import { movingQueueIntercept, EXAMPLE_LWR_HIGHWAY } from './core/traffic-shockwave.mjs';
import { analyzeUrbanCanyon, analyzeRfEnvironment, parseWifiSurveyJsonl, analyzeRoadSurfaceImu, createSurfaceMapper, runFieldLabBattery } from './core/drive-field-lab.mjs';
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
import { createBlackbox } from './core/blackbox.mjs';
import { observe } from './core/hazard-belief.mjs';
import { summarizeScan, radarPoints, drawSignalRadarPro, drawHistory, blipKey } from './core/signal-radar.mjs';
import { MAP_STYLES, styleFor, orthoCovers, circlePolygon, TERRAIN_SOURCE, legendCss } from './core/map-style.mjs';

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
  ekf: createGnssImuEkf(), ekfState: null, horizonCal: createHorizonCalibrator(),
  activeListen: false, surfaceMapper: createSurfaceMapper({ cellSizeM: 25 }),
  gnssHistory: [], imuHistory: [], rfSamples: [], lastLabReport: null,
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
  const map = new maplibregl.Map({ container: 'map', style: styleFor(LS.get('senda.map.style', 'mapa')), center: [-3.7038, 40.4168], zoom: 12, attributionControl: { compact: true } });
  st.map = map;
  const t = setTimeout(() => { if (!st.mapOk) offline('Sin conexión al mapa: se muestra el radar. Puedes cargar un mapa offline (.pmtiles) desde el botón naranja.'); }, 10000);
  map.on('load', () => {
    st.mapOk = true; clearTimeout(t);
    ensureRouteLayers(map);
    if (st.lastFix) onPos(st.lastFix);
    drawMarkers();
  });
  map.on('style.load', () => { if (st.mapOk) { ensureRouteLayers(map); drawMarkers(); } ensureMeLayers(map); applyMapDetails(); });
  map.addControl(new maplibregl.NavigationControl({ showZoom: false, visualizePitch: true }), 'top-right'); // brújula: toca para volver al norte
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
  const L = mapDetails(), z = st.map.getZoom();
  // Con el mapa alejado solo lo grave (como las apps de mapas): evita cientos de iconos amontonados
  const SEV = { ACCIDENTE: 4, CORTE: 4, PARADO: 3, ANIMAL: 3, PELIGRO: 3, TRAFICO: 2, OBRAS: 1, CLIMA: 1 };
  const minSev = z >= 10 ? 0 : z >= 8 ? 3 : z >= 6 ? 4 : 99, maxInc = z >= 10 ? 400 : 60;
  const incs = L.inc ? activeIncidents().filter((i) => i.lat != null && inView(i.lon, i.lat)).map((i) => ({ i, cat: i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i) })).filter((x) => (SEV[x.cat] ?? 1) >= minSev).sort((a, b) => (SEV[b.cat] ?? 1) - (SEV[a.cat] ?? 1)).slice(0, maxInc) : [];
  for (const { i } of incs) {
    const cat = i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i);
    markers.push(marker(i.lon, i.lat, cat, `<b>${esc(i.type === 'BridgeOpening' ? 'Puente levadizo' : CATEGORIES[cat].label)}</b> · ${esc(i.road ?? '')}<br><small>${esc(i.type)} / ${esc(i.cause ?? '')}<br>${esc(activeIncSource())}</small>`));
  }
  if (st.map.getZoom() >= 10) {
    if (L.cams) for (const c of st.cams) if (inView(c.lon, c.lat))
      markers.push(marker(c.lon, c.lat, 'CAMARA', `<b>Cámara DGT</b> · ${esc(c.carretera)} ${esc(c.destino ?? '')}<br><img src="${esc(c.url)}" alt="Imagen de la cámara" style="width:100%;border-radius:8px;margin-top:6px"><small>DGT, CC BY · imagen en vivo si hay red</small>`));
    if (L.radar && st.mode === 'car') for (const rd of st.radars) if (inView(rd.lon, rd.lat))
      markers.push(marker(rd.lon, rd.lat, 'CAMARA', `<b>${rd.kind === 'section' ? 'Radar de tramo' : 'Radar fijo'} oficial</b>${rd.road ? ` · ${esc(rd.road)}` : ''}${rd.maxspeed ? ` · ${rd.maxspeed} km/h` : ''}<br><small>${esc(String(rd.src).toUpperCase())} · publicado oficialmente (solo fijos y tramo)</small>`));
  }
  if (L.senda) for (const r of reports()) if (inView(r.lon, r.lat)) {
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
  const lwrTxt = (t.cat === 'ACCIDENTE' || t.cat === 'CORTE' || t.cat === 'TRAFICO') && (st.speed ?? 0) > 14 && t.distM > 200
    ? (() => {
        const lwr = movingQueueIntercept({ distToIncidentM: t.distM, egoSpeedKmh: st.speed * 3.6, incidentAgeS: 60, lwrParams: EXAMPLE_LWR_HIGHWAY });
        return lwr.queueForming ? ` · cola LWR ~${fmtDist(lwr.interceptDistM)} (modelo)` : '';
      })()
    : '';
  const extra = res.dedupedCount > 1 ? ` · +${res.dedupedCount - 1} más` : '';
  $('#caSub').textContent = `${t.sourceLabel}${ssdTxt}${lwrTxt}${extra}`;
  st.corrVoteId = t.source === 'SENDA' ? t.reportId : null; $('#caVote').hidden = st.corrVoteId == null;
  const ck = `${t.label}|${t.urgency}|${Math.round(t.distM / 100)}`; if (ck !== tele.corrKey) { tele.corrKey = ck; bbLog('corridor', { label: t.label, urgency: t.urgency, distM: Math.round(t.distM), src: t.sourceLabel, ssdM: res.ssdM != null ? Math.round(res.ssdM) : null }); }
  tele.corr = `${t.label} ${fmtDist(t.distM)} ${t.urgency}`;
  const phrase = corridorAnnouncement(t, st.saidCorridor);
  if (phrase) say(phrase);
}

// «Sigue ahí» / «Ya no está»: cada respuesta actualiza la probabilidad bayesiana del aviso (hazard-belief).
function voteCorridor(obs) {
  const id = st.corrVoteId; if (id == null) return;
  const list = reports(), i = list.findIndex((r) => r.id === id); if (i < 0) return;
  list[i] = observe(list[i], obs); LS.set('senda.ruta.reports', list);
  bbLog('note', { text: `voto ${obs === 'neg' ? 'ya no está' : 'sigue ahí'} · aviso ${id}` });
  say(obs === 'neg' ? 'Gracias, anotado que ya no está' : 'Gracias, confirmado'); updateCorridor(); drawMarkers();
}
$('#caYes')?.addEventListener('click', (e) => { e.stopPropagation(); voteCorridor('conf'); });
$('#caNo')?.addEventListener('click', (e) => { e.stopPropagation(); voteCorridor('neg'); });

// ── Cómo te mueves: coche, bici o a pie (rutas de su tipo; los radares de velocidad solo en coche) ──
st.mode = ['car', 'bike', 'foot'].includes(LS.get('senda.drive.mode', 'car')) ? LS.get('senda.drive.mode', 'car') : 'car';
const MODE_ES = { car: 'en coche', bike: 'en bici', foot: 'a pie' };
function setMode(m, announce = true) {
  st.mode = m; LS.set('senda.drive.mode', m);
  document.querySelectorAll('#favs .mode').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  document.documentElement.dataset.mode = m;
  bbLog('note', { text: `modo ${m}` }); updateRadars(); updateCorridor();
  if (announce) { hint(`Modo ${MODE_ES[m]}: rutas ${MODE_ES[m]}${m === 'car' ? ', radares fijos oficiales' : ', sin radares de velocidad'}. Prueba «📡 Señales» y la cámara.`); say(`Modo ${MODE_ES[m]}`); }
  if (st.dest && st.route) goTo(st.dest, true);
}
document.querySelectorAll('#favs .mode').forEach((b) => { b.classList.toggle('on', b.dataset.mode === st.mode); b.addEventListener('click', () => setMode(b.dataset.mode)); });
document.documentElement.dataset.mode = st.mode;

// ── 📡 Señales a tu alrededor: Wi-Fi y Bluetooth cercanos (app Android), sin nombres ni direcciones ──
const sig = { open: false, pts: [], sum: null, sweep: -Math.PI / 2, timer: null, last: 0, next: 0, fresh: new Map(), keys: new Set(), hist: [], waiting: false, lastT: 0 };
const SCAN_EVERY_MS = 30_000; // Android permite ~4 barridos Wi-Fi cada 2 min en primer plano
function sigScan() {
  const N = window.SendaNative;
  if (typeof N?.radioScan !== 'function') { $('#sigNote').textContent = 'Solo en la app de Android: un navegador no puede ver redes Wi-Fi ni Bluetooth.'; $('#sigClock').textContent = 'sin acceso a las radios'; return false; }
  if (sig.waiting && Date.now() - sig.last < 12_000) return false; // ya hay un barrido en marcha
  sig.last = Date.now(); sig.next = sig.last + SCAN_EVERY_MS; sig.waiting = true; N.radioScan();
  setTimeout(() => { if (sig.waiting && Date.now() - sig.last >= 12_000) { sig.waiting = false; $('#sigNote').textContent = 'El barrido no respondió (¿Bluetooth o ubicación apagados?). Pulsa «Escanear» de nuevo.'; } }, 12_500);
  return true;
}
window.sendaRadio = (scan) => {
  sig.waiting = false;
  const pts = radarPoints(scan), now = performance.now();
  const keys = new Set(pts.map(blipKey));
  for (const k of keys) if (!sig.keys.has(k) && sig.keys.size) sig.fresh.set(k, now); // nuevos desde el barrido anterior
  sig.keys = keys; sig.pts = pts; sig.sum = summarizeScan(scan);
  const s = sig.sum, age = Number.isFinite(scan?.wifiAgeS) && scan.wifiAgeS >= 0 ? scan.wifiAgeS : null;
  sig.hist.push({ wifiN: s.wifiN, bleN: s.bleN }); if (sig.hist.length > 20) sig.hist.shift();
  bbLog('radio', { mode: st.mode, wifiN: s.wifiN, w24: s.wifiByBand['2.4'], w5: s.wifiByBand['5'], w6: s.wifiByBand['6'], wifiBest: s.wifiBestDbm, wifiMed: s.wifiMedianDbm, bleN: s.bleN, bleBest: s.bleBestDbm, sendaNear: s.sendaNear, fresh: s.wifiFresh, wifiAgeS: age });
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('#sgWifi', s.wifiN); set('#sgWifiSub', `${s.wifiByBand['2.4']}·${s.wifiByBand['5']}·${s.wifiByBand['6']} (2,4·5·6 GHz)`);
  set('#sgBle', s.bleN); set('#sgBleSub', s.bleBestDbm != null ? `mejor ${s.bleBestDbm} dBm` : 'ninguno');
  set('#sgSenda', s.sendaNear); set('#sgBest', s.wifiBestDbm ?? '–');
  set('#sigNote', `Wi-Fi: ${age != null ? `dato de hace ${age} s` : 'sin dato'}${s.wifiFresh ? '' : ' (Android limitó el barrido)'} · Bluetooth: escucha de 4 s · centro = más fuerte (medido); el ángulo es solo dibujo.${s.note ? ' · ' + s.note : ''}`);
  const hc = $('#sigHist'); if (hc) drawHistory(hc.getContext('2d'), hc.width, hc.height, sig.hist);
  if (s.sendaNear > 0) { navigator.vibrate?.([60, 40, 60]); say(`${s.sendaNear} móvil${s.sendaNear > 1 ? 'es' : ''} SENDA cerca`); }
};
function sigFrame(t) {
  if (!sig.open) return;
  const dt = sig.lastT ? Math.min(100, t - sig.lastT) : 16; sig.lastT = t;
  sig.sweep = (sig.sweep + dt * 0.0021) % (Math.PI * 2); // una vuelta cada ~3 s
  const c = $('#sigCanvas'); drawSignalRadarPro(c.getContext('2d'), c.width, sig.pts, sig.sweep, { fresh: sig.fresh, now: t });
  const left = Math.max(0, Math.round((sig.next - Date.now()) / 1000));
  $('#sigClock').textContent = sig.waiting ? 'escuchando…' : sig.last ? `próximo barrido en ${left} s` : 'listo';
  requestAnimationFrame(sigFrame);
}
function sigOpen(on) {
  sig.open = on; $('#sig').hidden = !on; clearInterval(sig.timer); sig.lastT = 0;
  if (on) { sigScan(); sig.timer = setInterval(sigScan, SCAN_EVERY_MS); requestAnimationFrame(sigFrame); if (!LS.get('senda.info.senales', false)) { LS.set('senda.info.senales', true); } }
}
$('#sigChip')?.addEventListener('click', () => sigOpen(!sig.open));
if (location.hash === '#senales') setTimeout(() => sigOpen(true), 600);
$('#sigClose')?.addEventListener('click', () => sigOpen(false));
$('#sigScan')?.addEventListener('click', sigScan);
// Con la caja negra en marcha y fuera del coche, se mide la malla cada 30 s aunque el radar esté cerrado.
setInterval(() => { if (bb && st.mode !== 'car' && !sig.open && Date.now() - sig.last > 29_000) { if (typeof window.SendaNative?.radioScan === 'function') { sig.last = Date.now(); window.SendaNative.radioScan(); } } }, 5000);

// ── Capas y vistas del mapa (como en las apps de mapas conocidas): tipo, detalles y 3D ──
function mapDetails() { return { inc: true, radar: true, cams: true, senda: true, b3d: true, ...(LS.get('senda.map.details', {}) ?? {}) }; }
function ensureMeLayers(map) {
  if (!map?.getSource || map.getSource('me-acc')) return;
  map.addSource('me-acc', { type: 'geojson', data: st.pos && st.lastFix ? circlePolygon(st.pos, Math.max(3, st.lastFix.coords.accuracy ?? 10)) : { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'me-acc-fill', type: 'fill', source: 'me-acc', paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.14 } });
  map.addLayer({ id: 'me-acc-line', type: 'line', source: 'me-acc', paint: { 'line-color': '#1a73e8', 'line-opacity': 0.55, 'line-width': 1.2 } });
}
function applyTerrain() { // relieve 3D real (Terrain Tiles) cuando la vista 3D está activa
  const m = st.map; if (!m?.getSource) return;
  try {
    if (st.view3d) { if (!m.getSource('terrain3d')) m.addSource('terrain3d', { ...TERRAIN_SOURCE }); m.setTerrain({ source: 'terrain3d', exaggeration: 1.2 }); } // ×1,2: elección de dibujo, declarada
    else m.setTerrain(null);
  } catch { /* sin relieve en este estilo */ }
}
function applyMapDetails() {
  const m = st.map; if (!m?.getLayer) return;
  applyTerrain(); $('#map')?.classList.toggle('bw', !!LS.get('senda.map.bw', false));
  const id = LS.get('senda.map.style', 'mapa'), leg = $('#mapLegend');
  const lg = legendCss(id);
  if (leg) { leg.hidden = !lg; if (lg) { leg.querySelector('i').style.background = lg.gradient; leg.querySelector('span').innerHTML = `<b>${lg.title}</b> · paleta oficial NASA${id === 'termico' ? ' · sin color = sin dato (nubes)' : ''}<span class="lgl">${lg.labels.map((x) => `<em>${x}</em>`).join('')}</span>`; } }
  try { if (m.getLayer('building-3d')) m.setLayoutProperty('building-3d', 'visibility', mapDetails().b3d ? 'visible' : 'none'); } catch { /* estilo sin edificios */ }
}
function setMapStyle(id) {
  LS.set('senda.map.style', id); st.map?.setStyle(styleFor(id), { diff: false }); renderLayers();
  if (id === 'satelite') hint(st.pos && !orthoCovers(st.pos) ? 'Aquí no hay ortofoto oficial: solo de España (PNOA, IGN) y Países Bajos (PDOK). Prueba «Satélite del día».' : 'Satélite: ortofoto oficial (PNOA en España, PDOK en Países Bajos).');
  else if (MAP_STYLES[id]?.note) hint(`${MAP_STYLES[id].label}: ${MAP_STYLES[id].note}.`);
}
st.view3d = !!LS.get('senda.map.3d', false);
function setView3d(on) {
  st.view3d = on; LS.set('senda.map.3d', on); renderLayers();
  applyTerrain(); st.map?.easeTo({ pitch: on ? 60 : 0, bearing: on && st.heading ? st.heading : st.map.getBearing(), duration: 700 });
}
const DETAILS = [['inc', '🚧', 'Tráfico e incidencias'], ['radar', '📸', 'Radares fijos'], ['cams', '🎥', 'Cámaras DGT'], ['senda', '⚠️', 'Avisos SENDA'], ['b3d', '🏙️', 'Edificios 3D']];
function renderLayers() {
  const cur = LS.get('senda.map.style', 'mapa'), d = mapDetails();
  $('#layStyles').innerHTML = Object.entries(MAP_STYLES).map(([id, v]) => `<button class="lay-style${id === cur ? ' on' : ''}" data-style="${id}"><img src="/senda/previews/map-${id}.webp" alt="" loading="lazy"><span>${v.label}</span></button>`).join('');
  $('#layDetails').innerHTML = DETAILS.map(([k, ic, lb]) => `<button class="lay-det${d[k] ? ' on' : ''}" data-det="${k}"><i>${ic}</i><span>${lb}</span></button>`).join('');
  $('#lay3d').classList.toggle('on', st.view3d); $('#layBw')?.classList.toggle('on', !!LS.get('senda.map.bw', false));
  const n = MAP_STYLES[cur]?.note; if ($('#layNote')) $('#layNote').textContent = n ?? 'Mapa de OpenStreetMap (OpenFreeMap).';
}
$('#layersBtn')?.addEventListener('click', () => { renderLayers(); $('#layers').hidden = false; });
$('#layClose')?.addEventListener('click', () => { $('#layers').hidden = true; });
$('#layStyles')?.addEventListener('click', (e) => { const b = e.target.closest('[data-style]'); if (b) setMapStyle(b.dataset.style); });
$('#layDetails')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-det]'); if (!b) return;
  const d = mapDetails(); d[b.dataset.det] = !d[b.dataset.det]; LS.set('senda.map.details', d); renderLayers(); applyMapDetails(); drawMarkers();
});
$('#lay3d')?.addEventListener('click', () => setView3d(!st.view3d));
$('#layBw')?.addEventListener('click', () => { LS.set('senda.map.bw', !LS.get('senda.map.bw', false)); applyMapDetails(); renderLayers(); }); // los avisos siguen en color
$('#layNorth')?.addEventListener('click', () => { st.map?.easeTo({ bearing: 0, pitch: 0, duration: 600 }); setView3d(false); });

// ── Paneles: solo uno abierto a la vez y el botón «atrás» de Android los cierra (antes salía de la pantalla) ──
const CLOSERS = { '#layers': () => { $('#layers').hidden = true; }, '#sig': () => sigOpen(false), '#labPanel': () => openLab(false), '#info': () => { $('#info').hidden = true; }, '#sheet': () => openSheet(false) };
let ovSuppress = false;
function closeOverlays(except = null) { ovSuppress = true; for (const [sel, fn] of Object.entries(CLOSERS)) if (sel !== except && $(sel) && !$(sel).hidden) fn(); ovSuppress = false; }
for (const sel of Object.keys(CLOSERS)) {
  const el = $(sel); if (!el) continue;
  new MutationObserver(() => {
    if (ovSuppress) return;
    if (!el.hidden) { if (sel !== '#info') closeOverlays(sel); if (!history.state?.sendaOverlay) history.pushState({ sendaOverlay: true }, ''); } // «ⓘ» se abre encima sin cerrar lo de debajo
    else if (Object.keys(CLOSERS).every((s2) => !$(s2) || $(s2).hidden) && history.state?.sendaOverlay) history.back();
  }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
}
addEventListener('popstate', () => { if ($('#info') && !$('#info').hidden) { $('#info').hidden = true; if (Object.keys(CLOSERS).some((x) => x !== '#info' && $(x) && !$(x).hidden)) history.pushState({ sendaOverlay: true }, ''); return; } closeOverlays(); });

// ── Qué es cada cosa: explicación al entrar y con «ⓘ» (valores de referencia orientativos, no garantizados) ──
const INFO = {
  conducir: { t: 'SENDA · Conducir, andar, pedalear', what: 'Tu mapa con avisos de tráfico oficiales, radares fijos publicados, avisos de otros usuarios de SENDA y una cámara con IA que reconoce lo que tienes delante. Funciona también sin Internet (con menos datos).', see: ['Arriba: 🚗 coche · 🚲 bici · 🚶 a pie (cambia rutas y avisos).', '📡 Señales: radar de redes Wi-Fi y Bluetooth a tu alrededor.', 'Botón naranja: avisar de algo (accidente, obras, objeto…).', 'Botón de capas: tipo de mapa, satélite oficial, 3D y qué se muestra.', 'Botón de grabar: caja negra del viaje.'], values: ['Punto azul = tú. El círculo azul claro es el margen de error del GPS: en calle abierta suele ser de pocos metros; entre edificios, más grande.'], tip: 'Configura todo antes de arrancar. Al volante, no toques el móvil.' },
  senales: { t: '📡 Señales a tu alrededor', what: 'Las redes Wi-Fi y los aparatos Bluetooth que tu móvil oye ahora mismo, como un radar. Sirve para ver dónde podría crecer la malla de SENDA sin operadoras.', see: ['Cuanto más cerca del centro, más fuerte se oye (medido).', 'Alrededor del círculo es solo dibujo: el móvil no sabe en qué dirección está cada aparato.', 'Naranja: otro móvil con SENDA cerca (también te avisa por voz).', 'Los puntos nuevos destellan al aparecer.'], values: ['Orientativo: −30 a −55 dBm = muy cerca · −55 a −67 = buena · −67 a −80 = débil · por debajo de −80 = casi al límite.', 'Calle con pisos: decenas de redes. Campo: casi ninguna.', 'Android solo deja ~4 barridos Wi-Fi cada 2 minutos: verás la antigüedad del dato.'], tip: 'Camina despacio por distintas calles y compara. Con la caja negra activa, se guarda cada 30 s (sin nombres ni direcciones).' },
  camara: { t: '🎥 Cámara con IA', what: 'La IA del móvil reconoce coches, camiones, motos, bicis, personas y semáforos en directo. Todo ocurre en tu móvil: la imagen no sale de él.', see: ['Recuadro verde = sin riesgo · ámbar = atención · rojo = se acerca deprisa por tu carril.', 'Las personas se tapan por privacidad.', 'Toca la miniatura para verla en grande.'], values: ['Analiza unas 4 veces por segundo. En un ordenador medimos ~74 ms por imagen; en tu móvil lo mide la caja negra.', 'La primera vez tarda unos segundos en cargar el modelo.'], tip: 'Para distancias en metros, mide la altura del soporte y ponla en Dashcam → «Montaje».' },
  cajanegra: { t: '⏺ Caja negra', what: 'Guarda lo que SENDA vio y decidió, segundo a segundo, para revisar el viaje después y mejorar la app.', see: ['Al empezar, Android te pide permiso para grabar la pantalla: acéptalo.', '«Marcar» señala un momento raro.', 'Al pararla se guardan: vídeo en Películas/SENDA y datos (.json y .jsonl) en Descargas/SENDA.'], values: ['Incluye tu recorrido GPS. No incluye imágenes de la cámara ni datos de otras personas.'], tip: 'Pásale los archivos a Abraham para analizarlos.' },
  capas: { t: '🗺️ Capas del mapa', what: 'Elige cómo ves el mapa y qué se muestra encima.', see: ['Mapa, Claro, Noche: OpenStreetMap.', 'Satélite: ortofoto oficial de España (PNOA, IGN) y Países Bajos (PDOK).', 'Satélite del día: NASA MODIS de ayer, todo el mundo, ~250 m por píxel (se ven nubes y humo).', 'Térmico: temperatura de la superficie de día (NASA MODIS); bajo las nubes no hay dato.', 'Nubes, Luces nocturnas, Relieve y Topográfico.', '3D: inclina el mapa con relieve real del terreno.', 'Blanco y negro: el mapa en grises; los avisos siguen en color.'], values: ['Las imágenes de NASA son de satélite: no se actualizan en tiempo real (una o dos pasadas al día).'], tip: 'Pellizca para hacer zoom; con dos dedos arriba/abajo inclinas el mapa.' },
};
function showInfo(key) {
  const i = INFO[key]; if (!i) return;
  $('#infoBody').innerHTML = `<h3>${i.t}</h3><p>${i.what}</p><h4>Qué verás</h4><ul>${i.see.map((x) => `<li>${x}</li>`).join('')}</ul>${i.values.length ? `<h4>Valores de referencia</h4><ul>${i.values.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}<p class="info-tip">💡 ${i.tip}</p>`;
  $('#info').hidden = false;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-info]'); if (b) { e.stopPropagation(); showInfo(b.dataset.info); } });
$('#infoClose')?.addEventListener('click', () => { $('#info').hidden = true; });
if (!LS.get('senda.drive.welcomed', false)) { LS.set('senda.drive.welcomed', true); setTimeout(() => showInfo('conducir'), 900); }

// ── Radares fijos, de semáforo y de tramo publicados (ES + NL, 100 % legal, sin móviles policiales) ──
function updateRadars(nowMs = Date.now()) {
  const el = $('#radarAlert');
  if (st.mode !== 'car') { st.radarState = null; st.sectionState = null; if (el) el.hidden = true; return; } // radares: solo en coche
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

// ── GPS, fusión EKF 6 estados, seguimiento y navegación ──
function onPos(p) {
  st.lastFix = p;
  st.ekfState = st.ekf.updateGnss({
    lon: p.coords.longitude, lat: p.coords.latitude,
    accuracyM: p.coords.accuracy ?? 8, speedMs: p.coords.speed, headingDeg: p.coords.heading,
    tMs: p.timestamp || Date.now(),
  });
  st.pos = st.ekfState?.gnssRejected && st.ekfState.pos ? st.ekfState.pos : [p.coords.longitude, p.coords.latitude];
  st.speed = p.coords.speed;
  st.region = detectRegion(st.pos);
  if (p.coords.heading != null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 1) st.heading = p.coords.heading;
  $('#speed').innerHTML = `<div>${st.speed == null ? '–' : Math.round(st.speed * 3.6)}<small>km/h</small></div>`;
  if (st.mapOk) {
    if (!st.me) { const el = document.createElement('div'); el.className = 'me-puck'; el.innerHTML = '<i class="cone"></i><b></b>'; st.me = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat(st.pos).addTo(st.map); st.map.jumpTo({ center: st.pos, zoom: st.mode === 'foot' ? 17 : 15 }); }
    st.me.setLngLat(st.pos).setRotation(st.heading); st.me.getElement().classList.toggle('has-heading', p.coords.heading != null && (p.coords.speed ?? 0) > 1);
    st.map.getSource('me-acc')?.setData(circlePolygon(st.pos, Math.max(3, p.coords.accuracy ?? 10))); // precisión real del GPS (radio = accuracy)
    if (st.follow) st.map.easeTo({ center: st.pos, bearing: st.route || st.view3d ? st.heading : st.map.getBearing(), pitch: st.view3d ? 60 : st.route ? 45 : 0, duration: 800 });
  } else drawRadar();
  if (st.route) guide();
  updateCorridor();
  updateRadars(p.timestamp || Date.now());
  updateOsint();
  bbLog('gps', { lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: p.coords.accuracy != null ? Math.round(p.coords.accuracy) : null, v: p.coords.speed, hdg: p.coords.heading, alt: p.coords.altitude != null ? Math.round(p.coords.altitude) : null, gt: p.timestamp, ekfRej: !!st.ekfState?.gnssRejected });
  tele.gps = p.coords;
  st.gnssHistory.push({ accuracyM: p.coords.accuracy, altM: p.coords.altitude, maha2: st.ekfState?.maha2 ?? 0, rejected: !!st.ekfState?.gnssRejected });
  if (st.gnssHistory.length > 120) st.gnssHistory.shift();
  if (st.activeListen) ingestSurfaceNow(p.timestamp || Date.now());
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
    const r = parseRoute(await (await fetch(routeUrl({ from: st.pos, to: dest.at, mode: st.mode }))).json());
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
  const list = reports(); list.push({ kind, side, lon: st.pos[0], lat: st.pos[1], t: Date.now(), own: true, id: crypto.getRandomValues(new Uint32Array(1))[0] }); LS.set('senda.ruta.reports', list);
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
  bbLog('ble', { ev: ev.event, text: ev.text ?? null, bytes: ev.b64 ? Math.floor(ev.b64.length * 3 / 4) : null });
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
  if (isDenmCompact(bytes)) {
    try {
      const denm = decodeDenmCompact(bytes);
      const rep = denmToSenda(denm);
      const rel = st.pos ? isInsideDenmRelevance(denm, st.pos, Date.now()) : { relevant: true, distM: null };
      if (!rel.relevant) return;
      const m = mergeReports(reports(), [{ kind: rep.kind, side: 'SIN_INDICAR', lon: rep.lon, lat: rep.lat, t: rep.t, own: false }]);
      LS.set('senda.ruta.reports', m.reports); drawMarkers(); updateCorridor();
      st.ble.rx++;
      if (m.added) say(`Aviso C-ITS DENM recibido: ${REPORT_KINDS[rep.kind]?.label ?? rep.kind}`);
      return hint(`C-ITS DENM recibido (causa ETSI ${rep.causeCode}${rel.distM != null ? ` · ${fmtDist(rel.distM)}` : ''}).`);
    } catch (e) { return hint('DENM compacto no válido: ' + e.message); }
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
// Montaje de la cámara: SOLO lo que la persona mide en su coche (sin esto, no se dan metros).
function userGeom() { return declaredGeom(LS.get('senda.drive.geom', null)); }
function askGeom() {
  const cur = LS.get('senda.drive.geom', {}) ?? {};
  const h = prompt('Altura de la cámara sobre el suelo, en metros (mídela en tu coche; ej. 1,3). Vacío = no dar distancias.', cur.camHeightM ?? '');
  if (h === null) return;
  if (h.trim() === '') { LS.set('senda.drive.geom', null); return hint('Sin geometría: no se muestran distancias en metros.'); }
  const f = prompt('Campo de visión VERTICAL de la cámara, en grados (ficha del móvil; ej. 50).', cur.fovVDeg ?? '');
  const g = { camHeightM: parseFloat(String(h).replace(',', '.')), fovVDeg: parseFloat(String(f ?? '').replace(',', '.')) };
  if (!declaredGeom(g)) return hint('Valores fuera de rango (altura 0,5–3 m, campo 20–120°). No se guardan.');
  LS.set('senda.drive.geom', g); hint(`Montaje guardado: ${g.camHeightM} m, ${g.fovVDeg}°. Las distancias son estimación de cámara (sin calibrar con medidas).`);
}
const FULL_RULES = { ...RULES, includeInfra: true };
function hudPhysicsState(iv = 250) {
  const spd = st.speed;
  const ssdM = stoppingDistanceM(spd);
  const rssM = spd != null && spd > 0 ? rssLongitudinalSameDir({ vRearMs: spd, vFrontMs: spd }, EXAMPLE_RSS_PARAMS).dMinM : null;
  const curvature = spd != null && spd > 3 && typeof st.imu.ay === 'number' ? st.imu.ay / (spd * spd) : 0;
  const hCal = st.horizonCal.status();
  const base = userGeom() ?? DEFAULT_CAM_GEOM;
  const geom = hCal.calibrated ? { ...base, pitchDeg: hCal.pitchDeg, horizonY: hCal.horizonY } : base;
  return {
    speedMs: spd, ssdM, rssM, curvature, imu: st.imu, region: st.region,
    radarTop: st.radarState?.top ?? null, corridorTop: st.corridor?.top ?? null,
    pos: st.pos, aiHz: +(1000 / iv).toFixed(1), bbActive: st.bb.active, geom,
  };
}
$('#camBtn').addEventListener('click', async () => {
  if (camOn) return camStop();
  try {
    await getDetector();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    $('#v').srcObject = stream; await $('#v').play(); try { await navigator.wakeLock?.request('screen'); } catch { /* */ }
    camOn = true; tracker = createTracker(FULL_RULES); $('#pip').hidden = false; $('#camBtn').classList.add('on'); requestAnimationFrame(tick);
  } catch (e) { hint('Cámara no disponible: ' + (e.message || e.name) + '. Revisa el permiso de cámara de SENDA en Ajustes de Android.'); }
  if (camOn && !LS.get('senda.info.camara', false)) { LS.set('senda.info.camara', true); showInfo('camara'); }
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
  const W = v.videoWidth, H = v.videoHeight, t0 = performance.now(), r = timedDetect(v, now), inferMs = performance.now() - t0;
  const rawObjs = tracker.update(r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H })), now / 1000);
  const objs = enrichTracksForHud(rawObjs, { speedMs: st.speed, geom: userGeom() });
  st.lastVision = summarizeVision(objs, inferMs, iv);
  const c = $('#ov'), box = c.getBoundingClientRect(), dpr = devicePixelRatio || 1; c.width = box.width * dpr; c.height = box.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  renderArHud(x, box.width, box.height, { ...hudPhysicsState(iv), tracks: objs });
  noteObjects(objs);
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
    if (now - dash.lastDet >= iv) { dash.lastDet = now; const t0 = performance.now(), r = timedDetect(v, now), inferMs = performance.now() - t0;
      const rawObjs = tracker.update(r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H })), now / 1000);
      dash.objs = enrichTracksForHud(rawObjs, { speedMs: st.speed, geom: userGeom(), sourceCtx: x, W, H });
      st.lastVision = summarizeVision(dash.objs, inferMs, iv);
      noteObjects(dash.objs);
      const top = topAlert(dash.objs); if (top) warnDash(top); }
    drawDashData(x, W, H, iv);
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

// ── Panel «Datos» + Caja negra unificada (JSONL + SHA-256 v2 + pantalla Android MediaProjection) ──
const tele = { on: LS.get('senda.drive.tele', false), gps: null, imu: null, gyro: null, det: { ms: null, n: 0, hz: 0, frames: [] }, top: null, corr: null, corrKey: '', net: null, bat: null, ble: null };
let bb = null, bbScreen = null, bbTimer = null, battery = null;
const lastAlert = new Map();
function bbLog(k, data) { if (bb) bb.add(k, data); }
function timedDetect(v, now) {
  const t0 = performance.now(), r = det.detectForVideo(v, now), ms = performance.now() - t0;
  const f = tele.det.frames; f.push(performance.now()); while (f.length && f[0] < performance.now() - 2000) f.shift();
  tele.det.ms = ms; tele.det.n = r.detections.length; tele.det.hz = f.length / 2;
  bbLog('det', { ms: Math.round(ms), n: r.detections.length, be: 'CPU' });
  return r;
}
function noteObjects(objs) {
  const top = topAlert(objs); tele.top = top ? `${ES[top.label] ?? top.label} ${top.zone} ${top.level}${top.ttcS ? ' ' + top.ttcS.toFixed(1) + ' s' : ''}` : `${objs.length} obj · sin alerta`;
  for (const o of objs) {
    if (o.level === 'VERDE') continue;
    const key = o.id + o.level; if (Date.now() - (lastAlert.get(key) ?? 0) < 1000) continue; lastAlert.set(key, Date.now());
    bbLog('alert', { level: o.level, label: o.label, zone: o.zone, ttcS: o.ttcS != null ? +o.ttcS.toFixed(2) : null, reasons: o.reasons, box: [o.box.x, o.box.y, o.box.w, o.box.h].map((x) => +x.toFixed(3)) });
  }
}

// ── Radar sin red (avisos, cámaras, radares ES+NL e incidencias en 5 km; la marcha hacia arriba) ──
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
    battery = b;
    const syncBat = () => { st.battery.pct = +(b.level * 100).toFixed(1); st.battery.charging = b.charging; };
    syncBat(); b.addEventListener?.('levelchange', syncBat); b.addEventListener?.('chargingchange', syncBat);
  }).catch(() => {});
}
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity || e.acceleration;
  const g = e.rotationRate;
  if (a) {
    if (typeof a.x === 'number' && Number.isFinite(a.x)) st.imu.ax = a.x;
    if (typeof a.y === 'number' && Number.isFinite(a.y)) st.imu.ay = a.y;
    if (typeof a.z === 'number' && Number.isFinite(a.z)) st.imu.az = a.z;
    const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
    tele.imu = mag;
    tele.gyro = g ? Math.hypot(g.alpha ?? 0, g.beta ?? 0, g.gamma ?? 0) : null;
    bbLog('imu', { a: +mag.toFixed(2), ax: +(a.x ?? 0).toFixed(2), ay: +(a.y ?? 0).toFixed(2), az: +(a.z ?? 0).toFixed(2), gyro: tele.gyro != null ? Math.round(tele.gyro) : null });
  }
  if (g) {
    if (typeof g.alpha === 'number' && Number.isFinite(g.alpha)) st.imu.gx = g.alpha;
    if (typeof g.beta === 'number' && Number.isFinite(g.beta)) st.imu.gy = g.beta;
    if (typeof g.gamma === 'number' && Number.isFinite(g.gamma)) st.imu.gz = g.gamma;
  }
  const yawRadS = (st.imu.gz ?? 0) * Math.PI / 180;
  const aLong = e.acceleration?.x ?? 0;
  if (st.imu.ay != null && st.imu.az != null) {
    st.horizonCal.update({ ax: st.imu.ax ?? 0, ay: st.imu.ay, az: st.imu.az, speedMs: st.speed ?? 0, yawRateRadS: yawRadS, aLongMs2: aLong });
    st.imuHistory.push({ ax: st.imu.ax ?? 0, ay: st.imu.ay, az: st.imu.az, speedMs: st.speed ?? 0 });
    if (st.imuHistory.length > 120) st.imuHistory.shift();
  }
  if (st.ekf.initialized && st.lastFix) {
    const nowMs = Date.now();
    const fixMs = st.lastFix.timestamp || nowMs;
    if (nowMs - fixMs > 2500) {
      st.ekfState = st.ekf.predict({ tMs: nowMs, aLongMs2: aLong, yawRateRadS: yawRadS });
      if (st.ekfState?.pos) st.pos = st.ekfState.pos;
    }
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
function exportDenm(kind = 'obstaculo') {
  if (!st.pos) return null;
  const denm = sendaToDenm({ kind, lon: st.pos[0], lat: st.pos[1], headingDeg: st.heading, t: Date.now() });
  const compact = encodeDenmCompact(denm);
  return { denm, compact, b64: b64(compact), bytes: compact.length };
}

function rfSnapshot() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    online: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
    netType: c?.effectiveType ?? null,
    downlinkMbps: typeof c?.downlink === 'number' ? c.downlink : null,
    rttMs: typeof c?.rtt === 'number' ? c.rtt : null,
  };
}
function sampleSlow() {
  const c = navigator.connection;
  tele.net = { online: navigator.onLine, type: c?.type ?? null, eff: c?.effectiveType ?? null, down: c?.downlink ?? null, rtt: c?.rtt ?? null };
  tele.bat = battery ? { level: battery.level, charging: battery.charging } : null;
  bbLog('net', tele.net); if (tele.bat) bbLog('bat', tele.bat);
}
const f1 = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(d));
function drawTele() {
  const el = $('#tele'); if (!el) return;
  el.hidden = !tele.on && !bb; if (el.hidden) return;
  const g = tele.gps, n = tele.net, b = tele.bat, ek = st.ekfState, hc = st.horizonCal.status();
  el.textContent = [
    bb ? `● REC ${new Date(Date.now() - bb.t0).toISOString().slice(11, 19)} · ${bb.rows.length} filas${bbScreen ? ' · pantalla' : ''}` : '',
    `[${st.region}] GPS ${g ? `±${f1(g.accuracy, 0)}m ${f1((g.speed ?? NaN) * 3.6, 0)}km/h ${f1(g.heading, 0)}° alt ${f1(g.altitude, 0)}m` : 'sin señal'}`,
    ek ? `EKF ${ek.mode} ±${f1(ek.sigmaPosM, 1)}m${ek.outliersRejected ? ` · ${ek.outliersRejected} salto(s) GPS rej` : ''} · H-Cal ${hc.samples}/20 (${hc.pitchDeg}°)` : '',
    `IMU ${f1(tele.imu, 1)}m/s² giro ${f1(tele.gyro, 0)}°/s`,
    `IA ${camOn || dash.on ? `${f1(tele.det.hz, 1)}Hz ${f1(tele.det.ms, 0)}ms ${tele.det.n}det · ${tele.top ?? ''}` : 'apagada'}`,
    `Radares ${st.radars.length} · ${st.region === 'NL' ? `NDW ${st.nlIncidents.length}` : `DGT ${st.incidents.length}`} · SENDA ${reports().length}`,
    `Red ${n ? `${n.online ? (n.eff ?? 'sí') : 'NO'}${n.down != null ? ' ' + n.down + 'Mb/s' : ''}${n.rtt != null ? ' ' + n.rtt + 'ms' : ''}` : '–'} · Bat ${b ? Math.round(b.level * 100) + '%' + (b.charging ? '⚡' : '') : '–'}`,
  ].filter(Boolean).join('\n');
}
setInterval(() => { sampleSlow(); drawTele(); }, 1000);
$('#teleBtn')?.addEventListener('click', () => { tele.on = !tele.on; LS.set('senda.drive.tele', tele.on); $('#teleBtn')?.classList.toggle('on', tele.on); drawTele(); });
$('#teleBtn')?.classList.toggle('on', tele.on);

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
  bb = createBlackbox({ meta: { app: 'SENDA Drive', page: 'conducir', mode: st.mode, region: st.region, ua: navigator.userAgent, screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, native: !!window.SendaNative, radios: (() => { try { return JSON.parse(window.SendaNative?.radioCaps?.() ?? 'null'); } catch { return null; } })(), privacy: 'contiene tu recorrido GPS; sin imágenes de cámara' } });
  tele.corrKey = ''; sampleSlow();
  $('#bbBtn')?.classList.add('rec', 'on'); $('#bbDash')?.classList.add('on');
  $('#bbBadge').hidden = false; $('#markBtn').hidden = false;
  document.documentElement.classList.add('bbrec');
  syncAiLabels();
  bbSample();
  clearInterval(bbTimer); bbTimer = setInterval(bbSample, 1000);
  if (typeof window.SendaNative?.screenRecStart === 'function') window.SendaNative.screenRecStart(dash.q === 'high');
  hint('Caja negra en marcha: datos cada segundo + JSONL, solo en el móvil. Si Android lo pide, acepta para grabar también la pantalla.');
  drawTele();
}
window.sendaScreenRec = (ev) => {
  bbLog('note', { text: `pantalla: ${ev.event}${ev.detail ? ' · ' + ev.detail : ''}` });
  if (ev.event === 'started') { bbScreen = { native: true }; hint(`Grabando pantalla (${ev.detail}) + datos.`); }
  else if (ev.event === 'saved') { hint(`Vídeo de pantalla guardado en ${ev.detail}.`); bbScreen = null; }
  else if (ev.event === 'error') { hint(ev.detail); bbScreen = null; }
  drawTele();
};
async function bbExport() {
  clearInterval(bbTimer); bbTimer = null; st.bb.stop();
  const box = bb; bb = null;
  $('#bbBtn')?.classList.remove('rec', 'on'); $('#bbDash')?.classList.remove('on');
  $('#bbBadge').hidden = true; $('#markBtn').hidden = true;
  document.documentElement.classList.remove('bbrec');
  if (bbScreen?.native) window.SendaNative?.screenRecStop?.();
  if (st.bb.count === 0) { drawTele(); return hint('Caja negra vacía: no se guardó archivo.'); }
  const doc = await st.bb.exportSealed();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const res = await saveBlob(blob, `senda-blackbox-${stamp}.json`);
  if (box && box.rows.length) {
    await saveBlob(new Blob([box.toJsonl()], { type: 'application/x-ndjson' }), `senda-cajanegra-${stamp}.jsonl`);
  }
  const s = doc.summary;
  hint(res.ok
    ? `Caja negra v2 sellada SHA-256 guardada en ${res.where} (${(blob.size / 1024).toFixed(1)} KB · ${s.frames} muestras · ${s.distanceKm} km · ${s.deadZoneSamples} sin red · ${s.radarAlertFrames} radares).`
    : 'No se pudo guardar la caja negra.');
  drawTele();
  return doc;
}
$('#bbBtn')?.addEventListener('click', () => { if (st.bb.active) bbExport(); else bbStart(); });
$('#bbDash')?.addEventListener('click', () => { if (st.bb.active) bbExport(); else bbStart(); });
$('#bbSave')?.addEventListener('click', bbExport);
$('#markBtn')?.addEventListener('click', () => { bbLog('note', { text: 'MARCA del conductor' }); navigator.vibrate?.(60); say('Marcado'); });

// ── Laboratorio de señal: mapa de cobertura y firme en celdas de 25 m (sin datos personales) ──
function ingestSurfaceNow(tMs = Date.now()) {
  if (!st.pos) return null;
  const road = analyzeRoadSurfaceImu(st.imuHistory.slice(-24));
  const rf = st.rfSamples.length ? analyzeRfEnvironment(st.rfSamples) : null;
  const cell = st.surfaceMapper.ingest({
    lon: st.pos[0], lat: st.pos[1],
    accuracyM: st.lastFix?.coords?.accuracy ?? null,
    ekfMaha2: st.ekfState?.maha2 ?? 0,
    ekfRejected: !!st.ekfState?.gnssRejected,
    imuRmsZ: road.rmsVerticalMs2,
    rfCount: rf?.uniqueSaltedNodes ?? 0,
    rssiMedianDbm: rf?.rssiMedianDbm ?? null,
    online: navigator.onLine,
    visionObjects: st.lastVision?.count ?? 0,
    region: st.region,
    tMs,
  });
  const sum = st.surfaceMapper.summary();
  if ($('#lkCells')) $('#lkCells').textContent = `${sum.totalCells} cel.`;
  return cell;
}
function renderLabReport(rep) {
  const canyon = rep.tests.find((t) => t.id === 'URBAN_CANYON_RF')?.metrics?.canyon;
  const rf = rep.tests.find((t) => t.id === 'URBAN_CANYON_RF')?.metrics?.rf;
  const cyber = rep.tests.find((t) => t.id === 'CYBER_INTEGRITY_AUDIT');
  const sum = st.surfaceMapper.summary();
  if ($('#lkCanyon')) $('#lkCanyon').textContent = (canyon?.canyonClass ?? 'SIN_DATOS').replace('URBAN_CANYON_', '').replace('SUBURBAN_', '');
  if ($('#lkCells')) $('#lkCells').textContent = `${sum.totalCells} cel.`;
  if ($('#lkRf')) $('#lkRf').textContent = rf?.ricianKDb != null ? `K ${rf.ricianKDb}dB` : (rf?.sampleCount ? `${rf.rssiMedianDbm}dBm` : 'Sin barr.');
  if ($('#lkCyber')) $('#lkCyber').textContent = cyber?.status === 'OK' ? '0 MACs OK' : 'ALERTA';
  const box = $('#labCards');
  if (!box) return;
  box.innerHTML = rep.tests.map((t) => `
    <article class="lcard ${esc(t.status)}" data-test="${esc(t.id)}">
      <div class="lcard-top">
        <span class="lcard-name">${esc(t.name)}</span>
        <span class="lcard-tags"><span class="ltag">${esc(t.basis)}</span><span class="ltag ${esc(t.status)}">${esc(t.status)}</span></span>
      </div>
      <div class="lcard-head">${esc(t.headline)}</div>
      <div class="lcard-interp">${esc(t.interpretation)}</div>
    </article>`).join('');
}
function runLabBattery() {
  let radioCaps = null;
  try { radioCaps = JSON.parse(window.SendaNative?.radioCaps?.() ?? 'null'); } catch { radioCaps = null; }
  const rep = runFieldLabBattery({
    nowMs: Date.now(),
    pos: st.pos,
    speedMs: st.speed,
    headingDeg: st.heading,
    altM: st.lastFix?.coords?.altitude ?? null,
    region: st.region,
    ekfState: st.ekfState,
    horizonStatus: st.horizonCal.status(),
    gnssHistory: st.gnssHistory,
    imuHistory: st.imuHistory,
    rfSamples: st.rfSamples,
    corridor: st.corridor,
    radarsCount: st.radars.length,
    incidentsCount: activeIncidents().length,
    vision: st.lastVision,
    bleStats: st.ble,
    probeStats: st.prober.stats(),
    radioCaps,
    blackbox: { active: st.bb.active, count: st.bb.count },
    surfaceSummary: st.surfaceMapper.summary(),
    online: navigator.onLine,
  });
  st.lastLabReport = rep;
  renderLabReport(rep);
  bbLog('field_lab', { overall: rep.summary.overall, ok: rep.summary.OK, warn: rep.summary.WARN, crit: rep.summary.CRIT, cells: rep.summary.surfaceCells });
  hint(`Batería Lab Campo ejecutada: ${rep.summary.OK}/${rep.summary.totalEngines} OK · ${rep.summary.WARN} aviso · ${rep.summary.NO_SENSOR} sin sensor.`);
  return rep;
}
function setActiveListen(on) {
  st.activeListen = !!on;
  $('#labChip')?.classList.toggle('live', st.activeListen);
  if ($('#labChip')) $('#labChip').textContent = st.activeListen ? '● Mapa ON' : '⚡ Laboratorio';
  $('#labStatusPill')?.classList.toggle('live', st.activeListen);
  if ($('#labStatusPill')) $('#labStatusPill').textContent = st.activeListen ? 'MAPEANDO' : 'EN ESPERA';
  $('#labListenBtn')?.classList.toggle('live', st.activeListen);
  if ($('#labListenBtn')) $('#labListenBtn').textContent = st.activeListen ? '● Mapa de cobertura: ON' : '● Mapa de cobertura: OFF';
  if (st.activeListen) {
    window.SendaNative?.p2pStart?.();
    ingestSurfaceNow();
    hint('Mapa de cobertura activado: celdas de 25 m con calidad del GPS, estado del firme, cobertura de radio (sin guardar identificadores) y buzón Bluetooth.');
  } else {
    hint('Mapa de cobertura en pausa (las celdas ya capturadas se conservan para exportar GeoJSON).');
  }
  return st.activeListen;
}
function openLab(on) {
  openSheet(false);
  const show = on == null ? $('#labPanel').hidden : !!on;
  $('#labPanel').hidden = !show;
  $('#veil').hidden = !show;
  if (show) runLabBattery();
}
function loadRfSurveyText(text) {
  const parsed = parseWifiSurveyJsonl(text);
  if (!parsed.length) { hint('El archivo no contiene lecturas Wi-Fi JSONL válidas.'); return 0; }
  st.rfSamples = st.rfSamples.concat(parsed).slice(-600);
  if (st.activeListen) ingestSurfaceNow();
  runLabBattery();
  hint(`Barrido RF importado: ${parsed.length} lecturas anonimizadas (0 MACs/SSIDs almacenados).`);
  return parsed.length;
}
async function exportLabAndMap() {
  const rep = st.lastLabReport ?? runLabBattery();
  const gj = st.surfaceMapper.toGeoJson();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  let sha = null;
  try {
    const raw = new TextEncoder().encode(JSON.stringify(rep));
    const dig = await crypto.subtle.digest('SHA-256', raw);
    sha = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { /* sin WebCrypto */ }
  const sealed = { ...rep, sha256: sha, surfaceSummary: st.surfaceMapper.summary() };
  const labBlob = new Blob([JSON.stringify(sealed, null, 2)], { type: 'application/json' });
  const mapBlob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' });
  const r1 = await saveBlob(labBlob, `senda-field-lab-${stamp}.json`);
  const r2 = await saveBlob(mapBlob, `senda-surface-map-${stamp}.geojson`);
  hint(`Lab Campo (${(labBlob.size / 1024).toFixed(1)} KB, SHA-256) y Mapa 25 m (${gj.features.length} celdas GeoJSON) guardados en ${r1.where || r2.where || 'local'}.`);
  return { sealed, geojson: gj };
}

$('#labChip')?.addEventListener('click', () => openLab(true));
$('#sheetLabBtn')?.addEventListener('click', () => openLab(true));
$('#labClose')?.addEventListener('click', () => openLab(false));
$('#veil')?.addEventListener('click', () => { openSheet(false); if (!$('#labPanel').hidden) openLab(false); });
$('#labRunBtn')?.addEventListener('click', runLabBattery);
$('#labListenBtn')?.addEventListener('click', () => setActiveListen(!st.activeListen));
$('#labProbeBtn')?.addEventListener('click', () => {
  sendBleProbe();
  const d = exportDenm('obstaculo');
  if (d && typeof window.SendaNative?.p2pSend === 'function') window.SendaNative.p2pSend(d.b64);
  runLabBattery();
});
$('#labRfBtn')?.addEventListener('click', () => {
  if (typeof window.SendaNative?.openRadios === 'function') {
    window.SendaNative.openRadios('senda://accion?a=WIFI_SCAN&id=76f202336769f0e2');
  } else {
    $('#rfSurveyFile')?.click();
  }
});
$('#rfSurveyFile')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  loadRfSurveyText(await f.text());
});
$('#labExportBtn')?.addEventListener('click', exportLabAndMap);

// La tarjeta de abajo cambia de alto (llegada, avisos): los botones flotantes se colocan siempre encima.
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--bottomH', `${Math.ceil(e.target.getBoundingClientRect().height)}px`)).observe($('#bottom'));

initMap();
loadIncidents();
setInterval(() => { if (!document.hidden) loadIncidents(); }, 5 * 60 * 1000);
// Para pruebas automáticas
globalThis.sendaDrive = {
  st, goTo, onPos, dash, updateCorridor, updateRadars, drawTele,
  bbStart, bbSample, bbExport, setAiMode, aiIntervalMs,
  sendBleProbe, loadPmTilesFile, loadOsintXml, loadOsintGeoJson,
  exportDenm, encodeDenmCompact, decodeDenmCompact, ekf: st.ekf, horizonCal: st.horizonCal,
  openLab, setActiveListen, runLabBattery, loadRfSurveyText, exportLabAndMap, surfaceMapper: st.surfaceMapper,
  renderArHud, enrichTracksForHud, hudPhysicsState, createTracker, FULL_RULES,
};
