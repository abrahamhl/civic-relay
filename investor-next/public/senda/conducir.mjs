// SENDA · Conducir (estilo navegador): mapa a pantalla completa, búsqueda, ruta giro a giro, avisos con
// colores e iconos, incidencias y cámaras DGT, cámara con IA en miniatura y entrega a Waze o Google Maps.
// Red: OpenFreeMap (mapa), OSRM de FOSSGIS (rutas, pruebas), Nominatim (búsqueda, ≤1/s). Sin red: radar.
import { createTracker, topAlert, RULES } from './core/drive-hazard.mjs';
import { hazardsAhead, corridorAnnouncement, stoppingDistanceM } from './core/drive-corridor.mjs';
import { createBlackBox } from './core/drive-blackbox.mjs';
import { radarsAhead, createSectionTracker, RADAR_RULES } from './core/drive-radars.mjs';
import { detectRegion, ndwToIncident, dutchMotorwayWindow } from './core/ndw-nl.mjs';
import { enrichTracksForHud, renderArHud, DEFAULT_CAM_GEOM, declaredGeom, project3DToScreen } from './core/drive-ar-hud.mjs';
import { rssLongitudinalSameDir, EXAMPLE_RSS_PARAMS } from './core/drive-physics-v2.mjs';
import { createGnssImuEkf, createHorizonCalibrator } from './core/drive-kalman-fusion.mjs';
import { sendaToDenm, denmToSenda, encodeDenmCompact, decodeDenmCompact, isDenmCompact, isInsideDenmRelevance } from './core/cits-denm.mjs';
import { movingQueueIntercept, EXAMPLE_LWR_HIGHWAY } from './core/traffic-shockwave.mjs';
import { analyzeUrbanCanyon, analyzeRfEnvironment, parseWifiSurveyJsonl, analyzeRoadSurfaceImu, createSurfaceMapper, runFieldLabBattery } from './core/drive-field-lab.mjs';
import { createLinkProber, isProbePack } from './core/ble-link-probe.mjs';
import { openPmTilesLocal } from './core/pmtiles-reader.mjs';
import { parseGdacsRss, parseMtgEvents, osintNear } from './core/osint-feeds.mjs';
import { interpretAlternatives } from './core/voice-report.mjs';
import { REPORT_KINDS, call112Script, LANE_SAY } from './core/road-guard.mjs';
import { detectCrashEvent, EXAMPLE_DETECTION_CONFIG, syntheticTrace } from './core/roadsafe-crash-detect.mjs';
import { laneGuide, laneSvg } from './core/lane-guide.mjs';
import { clusterCrashes, clusterIconSvg } from './core/crash-cluster.mjs';
import { parseUtterance, createParkedCalibrator, summarizeSession } from './core/voice-copilot.mjs';
import { createInsights, objectLine, RULE_2S, CYCLIST_CLEARANCE } from './core/camera-insights.mjs';
import { parseDatex2 } from './core/datex2.mjs';
import { wazeUrl, googleMapsUrl, haversineM } from './core/route-planner.mjs';
import { routeUrl, parseRoute, nextManeuver, shouldReroute, announcement, snapToRoute, distToRoute, parseGpxTrack } from './core/nav-osrm.mjs';
import { fromCamera, fromMmwave, coverage, summarize, SECTORS } from './core/surround-radar.mjs';
import { createFrameParser, cleanTargets, CMD as RADAR_CMD, SERIAL as RADAR_SERIAL } from './core/mmwave-radar.mjs';
import { CATEGORIES, FROM_REPORT, fromDatex, markerSvg } from './core/report-style.mjs';
import { saveBlob } from './save-file.mjs';
import { compassHeading, createHeadingFusion } from './core/heading-fusion.mjs';
import { packReports, unpackReports, mergeReports, isReportPack, SHARE_RULES } from './core/hazard-share.mjs';
import { b64, unb64 } from './core/b64.mjs';
import { createBlackbox } from './core/blackbox.mjs';
import { observe } from './core/hazard-belief.mjs';
import { summarizeScan, radarPoints, drawSignalRadarPro, drawHistory, blipKey } from './core/signal-radar.mjs';
import { MAP_STYLES, styleFor, orthoCovers, circlePolygon, TERRAIN_SOURCE, legendCss } from './core/map-style.mjs';
import { analyzeRouteCurvesAhead, PUBLISHED_SURFACE_PRESETS, PUBLISHED_VEHICLE_PROFILES } from './core/drive-copilot-physics.mjs';
import { composeProximityMessage } from './core/drive-community-calibration.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
// Identificador ALEATORIO de este móvil (no es el IMEI ni nada personal): sirve para contar móviles distintos en un mismo accidente.
const DEVICE_ID = LS.get('senda.devId', null) ?? (() => { const v = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join(''); LS.set('senda.devId', v); return v; })();
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
const reports = () => LS.get('senda.ruta.reports', []);

const st = {
  pos: null, shownPos: null, speed: null, heading: 0, headingSrc: null, headingOffset: null, region: 'ES', follow: true, map: null, mapOk: false, route: null, dest: null,
  said: new Set(), saidCorridor: new Set(), saidRadar: new Set(), spokenLog: [], corridor: null, curveState: null, lastRouteS: -1e9,
  incidents: [], nlIncidents: [], incSource: '', nlIncSource: '', cams: [],
  radars: [], stretches: [], sectionTracker: createSectionTracker([]), radarState: null, sectionState: null,
  me: null, bb: createBlackBox(),
  ekf: createGnssImuEkf(), ekfState: null, horizonCal: createHorizonCalibrator(),
  prevGnssFix: null, lastFixWallMs: 0, lastFixTraceMs: 0, lastPredictTraceMs: 0,
  easeCount: 0, easeIntervalsMs: [], rerouteCount: 0,
  activeListen: false, surfaceMapper: createSurfaceMapper({ cellSizeM: 25 }),
  gnssHistory: [], imuHistory: [], rfSamples: [], lastLabReport: null,
  ble: { tx: 0, rx: 0, rejected: 0 }, prober: createLinkProber(),
  battery: { pct: null, charging: null }, aiMode: LS.get('senda.drive.aiMode', 'auto'),
  imu: { ax: null, ay: null, az: null, gx: null, gy: null, gz: null, alpha: null, beta: null, gamma: null },
  osintEvents: [], osintState: null, pmArchives: new Map(), lastVision: null,
};
const setHtml = (el, html) => { if (el && el.__lastHtml !== html) { el.__lastHtml = html; el.innerHTML = html; } };
const say = (t) => {
  if (!t) return;
  st.spokenLog.push({ t: Date.now(), text: String(t) });
  if (st.spokenLog.length > 200) st.spokenLog.shift();
  try {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
      if (!navigator.webdriver) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: 'es-ES' }));
    }
  } catch { /* sin voz */ }
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
let mapLibrePromise = null;
function loadMapLibre() {
  if (!document.querySelector('link[href*="maplibre-gl.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/senda/vendor/maplibre-gl-4.7.1/maplibre-gl.css';
    document.head.appendChild(l);
  }
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;
  mapLibrePromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp.js';
    s.async = true;
    s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error('maplibregl no inicializado')));
    s.onerror = () => rej(new Error('Error cargando maplibre-gl-csp.js'));
    document.head.appendChild(s);
  });
  return mapLibrePromise;
}
async function initMap() {
  try { await loadMapLibre(); } catch { return offline('No se pudo cargar el mapa.'); }
  if (!window.maplibregl) return offline('No se pudo cargar el mapa.');
  maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
  registerPmTilesProtocol();
  const map = new maplibregl.Map({ container: 'map', style: styleFor(LS.get('senda.map.style', 'mapa')), center: [-3.7038, 40.4168], zoom: 12, attributionControl: { compact: true } });
  st.map = map;
  const t = setTimeout(() => { if (!st.mapOk) offline('Sin conexión al mapa: se muestra el radar. Puedes cargar un mapa offline (.pmtiles) desde el botón «+».'); }, 10000);
  map.on('load', () => {
    st.mapOk = true; clearTimeout(t);
    $('#map')?.classList.add('ready');
    ensureRouteLayers(map);
    if (st.lastFix) onPos(st.lastFix);
    drawMarkers(true);
  });
  map.on('style.load', () => { if (st.mapOk) { ensureRouteLayers(map); drawMarkers(true); } ensureMeLayers(map); applyMapDetails(); });
  map.addControl(new maplibregl.NavigationControl({ showZoom: false, visualizePitch: true }), 'top-right'); // brújula: toca para volver al norte
  map.on('dragstart', () => { st.follow = false; });
  let mv; map.on('moveend', () => { clearTimeout(mv); mv = setTimeout(() => drawMarkers(false), 300); });
  window.addEventListener('resize', () => { st.map?.resize(); }, { passive: true });
  screen.orientation?.addEventListener?.('change', () => { setTimeout(() => st.map?.resize(), 60); });
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
let markers = [], lastMarkerCenter = null, lastMarkerZoom = null;
function marker(lon, lat, cat, popupHtml) {
  const el = document.createElement('div'); el.innerHTML = markerSvg(cat, cat === 'CAMARA' ? 26 : 34); el.style.cursor = 'pointer'; el.dataset.cat = cat;
  const m = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]);
  if (popupHtml) m.setPopup(new maplibregl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(popupHtml));
  return m.addTo(st.map);
}
function drawMarkers(force = true) {
  if (!st.mapOk) return drawRadar();
  const c = st.map.getCenter(), z = st.map.getZoom(), curCenter = [c.lng, c.lat];
  if (!force && lastMarkerCenter && haversineM(lastMarkerCenter, curCenter) < 250 && Math.abs(z - (lastMarkerZoom ?? z)) < 0.4) return;
  lastMarkerCenter = curCenter; lastMarkerZoom = z;
  markers.forEach((m) => { try { m.getPopup()?.remove(); } catch { /* */ } m.remove(); }); markers = [];
  const b = st.map.getBounds(), inView = (lon, lat) => b.contains([lon, lat]);
  const L = mapDetails();
  // Con el mapa alejado solo lo grave (como las apps de mapas): evita cientos de iconos amontonados
  const SEV = { ACCIDENTE: 4, CORTE: 4, PARADO: 3, ANIMAL: 3, PELIGRO: 3, TRAFICO: 2, OBRAS: 1, CLIMA: 1 };
  const minSev = z >= 10 ? 0 : z >= 8 ? 3 : z >= 6 ? 4 : 99, maxInc = z >= 10 ? 400 : 60;
  const incs = L.inc ? activeIncidents().filter((i) => i.lat != null && inView(i.lon, i.lat)).map((i) => ({ i, cat: i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i) })).filter((x) => (SEV[x.cat] ?? 1) >= minSev).sort((a, b) => (SEV[b.cat] ?? 1) - (SEV[a.cat] ?? 1)).slice(0, maxInc) : [];
  for (const { i } of incs) {
    const cat = i.type === 'BridgeOpening' ? 'CORTE' : fromDatex(i);
    markers.push(marker(i.lon, i.lat, cat, `<b>${esc(i.type === 'BridgeOpening' ? 'Puente levadizo' : CATEGORIES[cat].label)}</b> · ${esc(i.road ?? '')}<br><small>${esc(i.type)} / ${esc(i.cause ?? '')}<br>${esc(activeIncSource())}</small>`));
  }
  if (st.map.getZoom() >= 10) {
    if (L.cams) { let nCam = 0; for (const c of st.cams) if (inView(c.lon, c.lat) && nCam++ < 150) { // como mucho 150 en pantalla: el mapa sigue fluido
      const srcInfo = st.camSources?.[c.src] ?? { name: c.src, license: '' }, img = c.img ? `${c.img}${c.img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : null;
      const body = img ? `<img src="${esc(img)}" alt="Imagen de la cámara" style="width:100%;border-radius:8px;margin-top:6px"><small>${esc(srcInfo.name)} · ${esc(srcInfo.license)} · imagen en vivo si hay red</small>`
        : `<small>${esc(srcInfo.name)} publica solo la ubicación${c.page ? ` · <a href="${esc(c.page)}" target="_blank" rel="noopener">ver la emisión oficial</a>` : ''}<br>${esc(srcInfo.license)}</small>`;
      markers.push(marker(c.lon, c.lat, 'CAMARA', `<b>Cámara · ${esc(c.cc)}</b>${c.name ? ` · ${esc(c.name)}` : ''}${c.road && !String(c.name ?? '').includes(c.road) ? ` · ${esc(c.road)}` : ''}<br>${body}`));
    } }
    if (L.radar && st.mode === 'car') for (const rd of st.radars) if (inView(rd.lon, rd.lat))
      markers.push(marker(rd.lon, rd.lat, 'CAMARA', `<b>${rd.kind === 'section' ? 'Radar de tramo' : 'Radar fijo'} oficial</b>${rd.road ? ` · ${esc(rd.road)}` : ''}${rd.maxspeed ? ` · ${rd.maxspeed} km/h` : ''}<br><small>${esc(String(rd.src).toUpperCase())} · publicado oficialmente (solo fijos y tramo)</small>`));
  }
  if (L.senda) {
    // Accidentes: un solo icono por accidente con «×N» móviles (no N iconos). Agrupación = las mismas reglas que ya fusionan avisos compartidos.
    const dets = [];
    for (const r of reports()) if (r.kind === 'accidente') {
      dets.push({ id: r.dev ?? `r${r.id}`, tS: r.t / 1000, lat: r.lat, lon: r.lon, accM: r.acc, lane: r.lane, vehicle: r.dev ?? `r${r.id}`, wellbeing: r.wb });
      for (const t of r.seen ?? []) dets.push({ id: `r${r.id}-${t}`, tS: t / 1000, lat: r.lat, lon: r.lon, accM: null });
    }
    for (const c of clusterCrashes(dets, { windowS: SHARE_RULES.sameMs / 1000, radiusM: SHARE_RULES.sameM })) if (inView(c.lon, c.lat)) {
      const el = document.createElement('div'); el.innerHTML = clusterIconSvg(c, 40); el.style.cursor = 'pointer';
      const how = c.state === 'CORROBORATED' ? `confirmado por ${c.devices} móviles SENDA distintos` : 'un solo móvil: probable, sin confirmar';
      const pos = c.sigmaM != null ? `posición combinada de ${c.devices} GPS ± ${c.sigmaM} m` : 'posición media (algún aviso llegó sin su precisión GPS)';
      const html = `<b>Accidente · ×${c.devices}</b><br><small>${how}<br>${pos}${c.lane ? `<br>Vehículo ${esc(LANE_SAY[c.lane] ?? c.lane)} (declarado)` : ''}${c.needHelp ? `<br><b>${c.needHelp} piden ayuda</b>` : ''}${c.ok ? `<br>${c.ok} dicen estar bien` : ''}<br>Satélite: no se usa para confirmar; las imágenes públicas (Sentinel-2, 10 m por píxel) no distinguen coches ni se piden al momento.</small>`;
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).setPopup(new maplibregl.Popup({ offset: 20, maxWidth: '270px' }).setHTML(html)).addTo(st.map));
    }
  }
  if (L.senda) for (const r of reports()) if (r.kind !== 'accidente' && inView(r.lon, r.lat)) {
    const cat = FROM_REPORT[r.kind] ?? 'PELIGRO';
    markers.push(marker(r.lon, r.lat, cat, `<b>${esc(REPORT_KINDS[r.kind]?.label ?? r.kind)}</b><br><small>Aviso de SENDA · ${new Date(r.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${r.verified ? 'visto con cámara' : 'sin verificar'}</small>`));
  }
}

// ── Incidencias ES (DGT) + NL (NDW DATEX II v3 CC0: SRTI, brugopeningen, afsluitingen) ──
async function loadIncidents() {
  if (window.SendaNative) {
    try { const r = await fetch('/senda/live/dgt-incidencias.xml', { cache: 'no-store' }); if (r.ok) { st.incidents = parseDatex2(await r.text()); st.incSource = `DGT en vivo ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; drawMarkers(true); return updateCorridor(); } } catch { /* copia */ }
  }
  try { const d = await (await fetch('/senda/data/referencias/dgt_incidencias.json')).json(); st.incidents = Object.values(d).find(Array.isArray) ?? []; st.incSource = `DGT, copia del ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`; } catch { st.incSource = 'sin incidencias'; }
  drawMarkers(true); updateCorridor();
}
fetch('/senda/data/referencias/nl_ndw_incidencias.json').then((r) => r.json()).then((d) => {
  st.nlIncidents = Array.isArray(d.incidencias) ? d.incidencias.map(ndwToIncident) : [];
  st.nlIncSource = `NDW NL (CC0), ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`;
  drawMarkers(); updateCorridor();
}).catch(() => {});
// Cámaras públicas de fuentes oficiales (DGT, Madrid, Euskadi, Rijkswaterstaat, Bruselas…), cada una con su licencia; si falta el archivo, solo la DGT.
fetch('/senda/data/referencias/camaras_publicas.json').then((r) => r.json()).then((d) => { st.cams = d.cameras; st.camSources = Object.fromEntries(d.sources.map((x) => [x.id, x])); drawMarkers(); })
  .catch(() => fetch('/senda/data/referencias/dgt_camaras.json').then((r) => r.json()).then((d) => { st.cams = d.camaras.map((c) => ({ id: c.id, src: 'DGT', cc: 'ES', lat: c.lat, lon: c.lon, name: `${c.carretera} ${c.destino ?? ''}`.trim(), img: c.url })); drawMarkers(); }).catch(() => {}));
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
  setHtml($('#caIco'), markerSvg(t.cat, 26));
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
  if (announce) { hint(`Modo ${MODE_ES[m]}: rutas ${MODE_ES[m]}${m === 'car' ? ' y radares fijos oficiales' : ', sin radares de velocidad'}.`); say(`Modo ${MODE_ES[m]}`); }
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
const SV = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const DETAILS = [['inc', SV('<path d="M4 20h16M6 20V9h12v11M6 13h12M9 9V5M15 9V5"/>'), 'Tráfico e incidencias'], ['radar', SV('<rect x="4" y="6" width="16" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M8 6l1-2h6l1 2"/>'), 'Radares fijos'], ['cams', SV('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'), 'Cámaras de tráfico'], ['senda', SV('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'), 'Avisos SENDA'], ['b3d', SV('<path d="M4 21V9l6-4v16M10 21V3l10 5v13M2 21h20"/>'), 'Edificios 3D']];
const BASE_STYLES = ['mapa', 'claro', 'noche', 'satelite', 'relieve', 'topo'];
function renderLayers() {
  const cur = LS.get('senda.map.style', 'mapa'), d = mapDetails();
  const tile = ([id, v]) => `<button class="lay-style${id === cur ? ' on' : ''}" data-style="${id}"><img src="/senda/previews/map-${id}.webp" alt="" loading="lazy"><span>${v.label}</span></button>`;
  $('#layStyles').innerHTML = Object.entries(MAP_STYLES).filter(([id]) => BASE_STYLES.includes(id)).map(tile).join('');
  $('#layStyles2').innerHTML = Object.entries(MAP_STYLES).filter(([id]) => !BASE_STYLES.includes(id)).map(tile).join('');
  $('#layDetails').innerHTML = DETAILS.map(([k, ic, lb]) => `<button class="lay-det${d[k] ? ' on' : ''}" data-det="${k}"><i>${ic}</i><span>${lb}</span></button>`).join('');
  $('#lay3d').classList.toggle('on', st.view3d); $('#layBw')?.classList.toggle('on', !!LS.get('senda.map.bw', false));
  const n = MAP_STYLES[cur]?.note; if ($('#layNote')) $('#layNote').textContent = n ?? 'Mapa de OpenStreetMap (OpenFreeMap).';
}
$('#layersBtn')?.addEventListener('click', () => { renderLayers(); $('#layers').hidden = false; });
const openTools = (on) => { $('#tools').hidden = !on; $('#moreBtn')?.classList.toggle('on', on); };
$('#moreBtn')?.addEventListener('click', () => openTools($('#tools').hidden));
$('#toolsClose')?.addEventListener('click', () => openTools(false));
$('#tools')?.addEventListener('click', (e) => { const b = e.target.closest('.trow'); if (b && b.id !== 'sheetAiMode') setTimeout(() => openTools(false), 0); });
$('#layClose')?.addEventListener('click', () => { $('#layers').hidden = true; });
for (const box of ['#layStyles', '#layStyles2']) $(box)?.addEventListener('click', (e) => { const b = e.target.closest('[data-style]'); if (b) setMapStyle(b.dataset.style); });
$('#layDetails')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-det]'); if (!b) return;
  const d = mapDetails(); d[b.dataset.det] = !d[b.dataset.det]; LS.set('senda.map.details', d); renderLayers(); applyMapDetails(); drawMarkers();
});
$('#lay3d')?.addEventListener('click', () => setView3d(!st.view3d));
$('#layBw')?.addEventListener('click', () => { LS.set('senda.map.bw', !LS.get('senda.map.bw', false)); applyMapDetails(); renderLayers(); }); // los avisos siguen en color
$('#layNorth')?.addEventListener('click', () => { st.map?.easeTo({ bearing: 0, pitch: 0, duration: 600 }); setView3d(false); });

// ── Paneles: solo uno abierto a la vez y el botón «atrás» de Android los cierra (antes salía de la pantalla) ──
const CLOSERS = { '#layers': () => { $('#layers').hidden = true; }, '#tools': () => openTools(false), '#sig': () => sigOpen(false), '#labPanel': () => openLab(false), '#info': () => { $('#info').hidden = true; }, '#sheet': () => openSheet(false) };
let ovSuppress = false, ovPushed = false, ovPendingBack = false;
const anyOpen = (except = null) => Object.keys(CLOSERS).some((x) => x !== except && $(x) && !$(x).hidden);
function closeOverlays(except = null) { ovSuppress = true; for (const [sel, fn] of Object.entries(CLOSERS)) if (sel !== except && $(sel) && !$(sel).hidden) fn(); ovSuppress = false; }
// Una sola entrada en el historial mientras haya algún panel abierto; se cuenta para no retroceder nunca de más
// (antes, al encadenar paneles deprisa, «atrás» podía sacar de Conducir a la pantalla anterior).
function ovSync() {
  if (anyOpen()) { if (!ovPushed && !ovPendingBack) { history.pushState({ sendaOverlay: true }, ''); ovPushed = true; } }
  else if (ovPushed && !ovPendingBack) { ovPushed = false; ovPendingBack = true; history.back(); }
}
for (const sel of Object.keys(CLOSERS)) {
  const el = $(sel); if (!el) continue;
  let was = el.hidden;
  new MutationObserver(() => {
    if (el.hidden === was) return; was = el.hidden; // reescribir el mismo valor no es un cambio
    if (ovSuppress) return;
    if (!el.hidden && sel !== '#info') closeOverlays(sel); // «ⓘ» se abre encima sin cerrar lo de debajo
    ovSync();
  }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
}
addEventListener('popstate', () => {
  if (ovPendingBack) { ovPendingBack = false; ovSync(); return; } // era nuestro propio «atrás»: si mientras tanto se abrió otro panel, se vuelve a apuntar
  ovPushed = false; // «atrás» del sistema con un panel abierto: cerrar el de arriba
  if ($('#info') && !$('#info').hidden) { $('#info').hidden = true; if (anyOpen('#info')) { history.pushState({ sendaOverlay: true }, ''); ovPushed = true; } return; }
  closeOverlays();
});

// ── Qué es cada cosa: explicación al entrar y con «ⓘ» (valores de referencia orientativos, no garantizados) ──
const INFO = {
  conducir: { t: 'SENDA · Conducir, andar, pedalear', what: 'Tu mapa con avisos de tráfico oficiales, radares fijos publicados, avisos de otros usuarios de SENDA y una cámara con IA que reconoce lo que tienes delante. Funciona también sin Internet (con menos datos).', see: ['Arriba: coche, bici o a pie (cambia rutas y avisos), y Casa y Trabajo.', 'Derecha: capas del mapa, centrar en ti, aviso hablado y «Más».', '«Más»: cámara con IA, dashcam, datos en pantalla, caja negra, radar de señales y laboratorio.', 'Botón naranja: avisar de algo (accidente, obras, objeto…).'], values: ['Punto azul = tú. El círculo azul claro es el margen de error del GPS: en calle abierta suele ser de pocos metros; entre edificios, más grande.'], tip: 'Configura todo antes de arrancar. Al volante, no toques el móvil.' },
  senales: { t: '📡 Señales a tu alrededor', what: 'Las redes Wi-Fi y los aparatos Bluetooth que tu móvil oye ahora mismo, como un radar. Sirve para ver dónde podría crecer la malla de SENDA sin operadoras.', see: ['Cuanto más cerca del centro, más fuerte se oye (medido).', 'Alrededor del círculo es solo dibujo: el móvil no sabe en qué dirección está cada aparato.', 'Naranja: otro móvil con SENDA cerca (también te avisa por voz).', 'Los puntos nuevos destellan al aparecer.'], values: ['Orientativo: −30 a −55 dBm = muy cerca · −55 a −67 = buena · −67 a −80 = débil · por debajo de −80 = casi al límite.', 'Calle con pisos: decenas de redes. Campo: casi ninguna.', 'Android solo deja ~4 barridos Wi-Fi cada 2 minutos: verás la antigüedad del dato.'], tip: 'Camina despacio por distintas calles y compara. Con la caja negra activa, se guarda cada 30 s (sin nombres ni direcciones).' },
  camara: { t: '🎥 Cámara con IA', what: 'La IA del móvil reconoce coches, camiones, motos, bicis, personas y semáforos en directo. Todo ocurre en tu móvil: la imagen no sale de él.', see: ['Recuadro verde = sin riesgo · ámbar = atención · rojo = se acerca deprisa por tu carril.', 'Las personas se tapan por privacidad.', 'Toca la miniatura para verla en grande.'], values: ['Analiza unas 4 veces por segundo. En un ordenador medimos ~74 ms por imagen; en tu móvil lo mide la caja negra.', 'La primera vez tarda unos segundos en cargar el modelo.'], tip: 'Para distancias en metros, mide la altura del soporte y ponla en Dashcam → «Montaje».' },
  cajanegra: { t: '⏺ Caja negra', what: 'Guarda lo que SENDA vio y decidió, segundo a segundo, para revisar el viaje después y mejorar la app.', see: ['Al empezar, Android te pide permiso para grabar la pantalla: acéptalo.', '«Marcar» señala un momento raro.', 'Al pararla se guardan: vídeo en Películas/SENDA y datos (.json y .jsonl) en Descargas/SENDA.'], values: ['Incluye tu recorrido GPS. No incluye imágenes de la cámara ni datos de otras personas.'], tip: 'Pásale los archivos a Abraham para analizarlos.' },
  capas: { t: '🗺️ Capas del mapa', what: 'Elige cómo ves el mapa y qué se muestra encima.', see: ['Mapa, Claro, Noche: OpenStreetMap.', 'Satélite: ortofoto oficial de España (PNOA, IGN) y Países Bajos (PDOK).', 'Satélite del día: NASA MODIS de ayer, todo el mundo, ~250 m por píxel (se ven nubes y humo).', 'Térmico: temperatura de la superficie de día (NASA MODIS); bajo las nubes no hay dato.', 'Nubes, Luces nocturnas, Relieve y Topográfico.', '3D: inclina el mapa con relieve real del terreno.', 'Blanco y negro: el mapa en grises; los avisos siguen en color.'], values: ['Las imágenes de NASA son de satélite: no se actualizan en tiempo real (una o dos pasadas al día).'], tip: 'Pellizca para hacer zoom; con dos dedos arriba/abajo inclinas el mapa.' },
};
function showInfo(key) {
  const i = INFO[key]; if (!i) return;
  $('#infoBody').innerHTML = `<h3>${String(i.t).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')}</h3><p>${i.what}</p><h4>Qué verás</h4><ul>${i.see.map((x) => `<li>${x}</li>`).join('')}</ul>${i.values.length ? `<h4>Valores de referencia</h4><ul>${i.values.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}<p class="info-tip">${i.tip}</p>`;
  $('#info').hidden = false;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-info]'); if (b) { e.stopPropagation(); showInfo(b.dataset.info); } });
$('#infoClose')?.addEventListener('click', () => { $('#info').hidden = true; });
if (!LS.get('senda.drive.welcomed', false)) LS.set('senda.drive.welcomed', true);

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

function projectAlongRouteM(coords, pos) {
  if (!Array.isArray(coords) || coords.length < 2 || !pos) return 0;
  const lat0 = pos[1];
  const mLat = 111_132.95, mLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let bestD2 = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = [(coords[i][0] - pos[0]) * mLon, (coords[i][1] - pos[1]) * mLat];
    const [x2, y2] = [(coords[i + 1][0] - pos[0]) * mLon, (coords[i + 1][1] - pos[1]) * mLat];
    const dx = x2 - x1, dy = y2 - y1;
    const segLen = Math.hypot(dx, dy);
    if (segLen > 0.1) {
      const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / (segLen * segLen)));
      const px = x1 + t * dx, py = y1 + t * dy;
      const d2 = px * px + py * py;
      if (d2 < bestD2) { bestD2 = d2; bestS = acc + t * segLen; }
    }
    acc += segLen;
  }
  return bestS;
}

function updateCurveHorizon() {
  const el = $('#curveAlert');
  if (st.mode !== 'car' || !st.route?.coords || st.route.coords.length < 3 || !st.pos || !(st.speed > 5)) {
    st.curveState = null;
    if (el) el.hidden = true;
    return;
  }
  try {
    const egoAlongM = projectAlongRouteM(st.route.coords, st.pos);
    const surf = PUBLISHED_SURFACE_PRESETS.dry_asphalt;
    const veh = PUBLISHED_VEHICLE_PROFILES.sedan;
    const res = analyzeRouteCurvesAhead({
      routeCoords: st.route.coords,
      egoAlongM,
      egoSpeedMs: st.speed,
      horizonM: 500,
      maxLateralMu: surf.muLatMax,
      superelevationE: veh.defaultSuperelevationE,
      vehicleSsf: veh.ssf,
      comfortBrakeMs2: 2.8,
      reactionTimeS: 1.5,
    });
    st.curveState = res;
    const c = res.topCurve;
    if (!el) return;
    if (!c || c.cue === 'COMFORTABLE') { el.hidden = true; return; }
    el.hidden = false;
    el.className = `card ${c.cue}`;
    $('#cuTitle').textContent = `Curva ${c.direction.toLowerCase()} en ${fmtDist(c.entryAheadM)} · ${c.cue === 'BRAKE_NOW' ? 'frena antes' : 'suelta acelerador'}`;
    $('#cuSub').textContent = `Radio ~${Math.round(c.minRadiusM)} m · vuelco SSF ${Math.round(c.rolloverSpeedKmh)} km/h (ref. asfalto seco)`;
    $('#cuLim').textContent = String(Math.round(c.safeSpeedKmh));
  } catch {
    st.curveState = null;
    if (el) el.hidden = true;
  }
}

function buildAndroidAutoState() {
  const speedKmh = st.speed != null && Number.isFinite(st.speed) ? +(st.speed * 3.6).toFixed(1) : null;
  const ssd = st.speed != null && Number.isFinite(st.speed) ? stoppingDistanceM(st.speed) : null;
  const rows = [];
  let status = 'VERDE';
  let recommendedMaxKmh = null;

  if (st.lastVision?.active && (st.lastVision.level === 'ROJO' || st.lastVision.level === 'AMBAR')) {
    status = st.lastVision.level;
    const ttc = st.lastVision.minTtcS != null ? ` · TTC ${st.lastVision.minTtcS.toFixed(1)} s` : '';
    rows.push(`${st.lastVision.level === 'ROJO' ? '!' : '▲'} ADAS cámara: riesgo frontal${ttc}`);
  }
  if (st.corridor?.top) {
    const t = st.corridor.top;
    if (t.urgency === 'ROJO') status = 'ROJO';
    else if (t.urgency === 'AMBAR' && status === 'VERDE') status = 'AMBAR';
    rows.push(`${t.urgency === 'ROJO' ? '!' : '▲'} ${t.label} a ${fmtDist(t.distM)}${t.road ? ` (${t.road})` : ''}`);
  }
  if (st.curveState?.topCurve && st.curveState.topCurve.cue !== 'COMFORTABLE') {
    const c = st.curveState.topCurve;
    if (c.cue === 'BRAKE_NOW') status = 'ROJO';
    else if (status === 'VERDE') status = 'AMBAR';
    const lim = Math.round(c.safeSpeedKmh);
    recommendedMaxKmh = recommendedMaxKmh == null ? lim : Math.min(recommendedMaxKmh, lim);
    rows.push(`${c.cue === 'BRAKE_NOW' ? '!' : '▲'} Curva ${c.direction.toLowerCase()} en ${fmtDist(c.entryAheadM)} · máx ${lim} km/h`);
  }
  if (st.sectionState && !st.sectionState.finished) {
    if (st.sectionState.overAverage) status = status === 'ROJO' ? 'ROJO' : 'AMBAR';
    if (st.sectionState.maxspeed != null) recommendedMaxKmh = recommendedMaxKmh == null ? st.sectionState.maxspeed : Math.min(recommendedMaxKmh, st.sectionState.maxspeed);
    rows.push(`Tramo ${st.sectionState.road || ''}: media ${st.sectionState.avgKmh != null ? st.sectionState.avgKmh.toFixed(0) : '–'} km/h · quedan ${fmtDist(st.sectionState.remainingM)}`.trim());
  } else if (st.radarState?.top) {
    const r = st.radarState.top;
    if (r.overLimit && status === 'VERDE') status = 'AMBAR';
    if (r.maxspeed != null) recommendedMaxKmh = recommendedMaxKmh == null ? r.maxspeed : Math.min(recommendedMaxKmh, r.maxspeed);
    rows.push(`Radar a ${fmtDist(r.distM)}${r.maxspeed ? ` · máx ${r.maxspeed} km/h` : ''}`);
  }
  if (st.ekfState?.mode && st.ekfState.mode !== 'GNSS_FUSED') {
    if (status === 'VERDE') status = 'AMBAR';
    rows.push(`Túnel / sin GPS · EKF ${st.ekfState.mode} (σ ${Math.round(st.ekfState.sigmaPosM ?? 0)} m)`);
  }

  return {
    status,
    speedKmh,
    recommendedMaxKmh,
    stoppingDistM: ssd != null ? +ssd.toFixed(1) : null,
    gripReservePct: null,
    rows: rows.slice(0, 6),
  };
}

let lastAaPushMs = 0;
function publishToAndroidAuto(force = false) {
  const payload = buildAndroidAutoState();
  const now = Date.now();
  if (!force && (now - lastAaPushMs) < 900 && payload.status !== 'ROJO') return payload;
  lastAaPushMs = now;
  try {
    if (typeof window.SendaNative?.publishDriveState === 'function') {
      window.SendaNative.publishDriveState(JSON.stringify(payload));
    }
  } catch { /* puente no disponible */ }
  return payload;
}

// ── GPS, fusión EKF 6 estados, seguimiento y navegación ──
// Orientación fusionada (declarada antes de pedir el GPS para que ningún fijo temprano la use sin crear)
const HF = createHeadingFusion({ gpsMinSpeedMs: 3, tauCompassS: 0.4, tauGpsS: 0.8, tauOffsetS: 20 });
const EASE_MIN_INTERVAL_MS = 800;
let lastBearingMs = 0, lastEaseMs = -Infinity;

function capSet(set, max = 512) {
  while (set.size > max) {
    const first = set.values().next().value;
    if (first === undefined) break;
    set.delete(first);
  }
}

function easeCameraFollowing(driving, vMs) {
  if (!st.mapOk || !st.follow || !st.shownPos) return false;
  const nowPerf = performance.now();
  if (nowPerf - lastEaseMs < EASE_MIN_INTERVAL_MS) return false;
  if (Number.isFinite(lastEaseMs)) {
    st.easeIntervalsMs.push(Math.round(nowPerf - lastEaseMs));
    if (st.easeIntervalsMs.length > 120) st.easeIntervalsMs.shift();
  }
  lastEaseMs = nowPerf;
  st.easeCount++;
  const h = st.map.getContainer().clientHeight, v = vMs ?? 0, zoom = !driving ? undefined : v > 25 ? 15.6 : v > 14 ? 16.3 : 17;
  st.map.easeTo({
    center: st.shownPos,
    bearing: (driving || st.route || st.view3d || st.headingUp) && st.heading != null ? st.heading : st.map.getBearing(),
    pitch: st.view3d ? 60 : driving ? 55 : st.route ? 45 : 0,
    zoom,
    padding: driving ? { top: Math.round(h * 0.42), bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
    duration: 800,
  });
  return true;
}

function onPos(p) {
  const fixMs = Number.isFinite(p.timestamp) && p.timestamp > 0 ? p.timestamp : Date.now();
  st.lastFix = p;
  st.lastFixWallMs = Date.now();
  st.lastFixTraceMs = fixMs;
  st.lastPredictTraceMs = fixMs;

  // Si el navegador/WebView entrega lat/lon sin rumbo o velocidad Doppler, se deriva el curso geométrico entre muestras reales (>2,5 m)
  let effSpeedMs = Number.isFinite(p.coords.speed) && p.coords.speed >= 0 ? p.coords.speed : null;
  let effHeadingDeg = Number.isFinite(p.coords.heading) ? p.coords.heading : null;
  if (st.prevGnssFix) {
    const dtS = (fixMs - st.prevGnssFix.fixMs) / 1000;
    const stepM = haversineM([st.prevGnssFix.lon, st.prevGnssFix.lat], [p.coords.longitude, p.coords.latitude]);
    if (effHeadingDeg == null && stepM >= 2.5) {
      const D = Math.PI / 180;
      const dx = (p.coords.longitude - st.prevGnssFix.lon) * Math.cos(p.coords.latitude * D) * 111_320;
      const dy = (p.coords.latitude - st.prevGnssFix.lat) * 111_132.95;
      effHeadingDeg = (((Math.atan2(dx, dy) * 180) / Math.PI) % 360 + 360) % 360;
    }
    if (effSpeedMs == null && dtS >= 0.2 && dtS <= 15) {
      const vEst = stepM / dtS;
      if (vEst <= 70) effSpeedMs = +vEst.toFixed(2);
    }
  }
  st.prevGnssFix = { lon: p.coords.longitude, lat: p.coords.latitude, fixMs };

  crashSpeed(p, fixMs);
  st.ekfState = st.ekf.updateGnss({
    lon: p.coords.longitude, lat: p.coords.latitude,
    accuracyM: p.coords.accuracy ?? 8, speedMs: effSpeedMs, headingDeg: effHeadingDeg,
    tMs: fixMs,
  });
  st.pos = st.ekfState?.gnssRejected && st.ekfState.pos ? st.ekfState.pos : [p.coords.longitude, p.coords.latitude];
  st.speed = effSpeedMs;
  st.region = detectRegion(st.pos);
  const navNowS = fixMs / 1000;
  HF.gps(effHeadingDeg, effSpeedMs ?? 0, navNowS); applyHeading(false);
  if (VC.parked && Number.isFinite(p.coords.speed)) VC.cal.add(p.coords.speed);
  const shownMs = VC.cal.gate(st.speed);
  setHtml($('#speed'), `<div>${shownMs == null ? '–' : Math.round(shownMs * 3.6)}<small>${VC.parked ? 'calibrando' : 'km/h'}</small></div>`);
  if (st.mapOk) {
    if (!st.me) { const el = document.createElement('div'); el.className = 'me-puck'; el.innerHTML = '<i class="cone"></i><b></b><svg class="arrow" viewBox="0 0 46 46"><path d="M23 4 39 40 23 32 7 40Z" fill="#1a73e8" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>'; st.me = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat(st.pos).addTo(st.map); st.map.jumpTo({ center: st.pos, zoom: st.mode === 'foot' ? 17 : 15 }); }
    // Modo conducción: en coche, flecha de navegación; navegando, la flecha va SOBRE la ruta si el GPS cae dentro de su precisión
    const driving = st.mode === 'car' && (st.route || (st.speed ?? 0) > 2);
    const snap = st.route ? snapToRoute(st.route.coords, st.pos, Math.max(15, p.coords.accuracy ?? 12)) : null;
    st.shownPos = snap ? snap.at : st.pos;
    if (snap?.bearingDeg != null && st.headingSrc == null) {
      st.heading = snap.bearingDeg;
      st.me.setRotation(st.heading);
      st.me.getElement().classList.toggle('has-heading', true);
    }
    st.me.getElement().classList.toggle('drive', st.mode === 'car');
    st.me.setLngLat(st.shownPos); applyHeading(false);
    const nowAccPerf = performance.now();
    if (!st.lastAccUpdatePerf || nowAccPerf - st.lastAccUpdatePerf >= 250) {
      st.lastAccUpdatePerf = nowAccPerf;
      st.map.getSource('me-acc')?.setData(circlePolygon(st.pos, Math.max(3, p.coords.accuracy ?? 10))); // precisión real del GPS (radio = accuracy)
    }
    easeCameraFollowing(driving, st.speed);
  } else drawRadar();
  if (st.route) guide(navNowS);
  updateCorridor();
  updateRadars(fixMs);
  updateCurveHorizon();
  updateOsint();
  publishToAndroidAuto();
  capSet(st.saidCorridor); capSet(st.saidRadar);
  bbLog('gps', { lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: p.coords.accuracy != null ? Math.round(p.coords.accuracy) : null, v: p.coords.speed ?? effSpeedMs, hdg: p.coords.heading ?? effHeadingDeg, alt: p.coords.altitude != null ? Math.round(p.coords.altitude) : null, gt: fixMs, ekfRej: !!st.ekfState?.gnssRejected });
  tele.gps = { ...p.coords, speed: p.coords.speed ?? effSpeedMs, heading: p.coords.heading ?? effHeadingDeg };
  st.gnssHistory.push({ accuracyM: p.coords.accuracy, altM: p.coords.altitude, maha2: st.ekfState?.maha2 ?? 0, rejected: !!st.ekfState?.gnssRejected });
  if (st.gnssHistory.length > 120) st.gnssHistory.shift();
  if (st.activeListen) ingestSurfaceNow(fixMs);
}
navigator.geolocation?.watchPosition(onPos, () => { setHtml($('#speed'), '<div>–<small>sin GPS</small></div>'); }, { enableHighAccuracy: true, maximumAge: 0 }); // máxima precisión: sin reutilizar posiciones antiguas

function currentNavClockS() {
  return st.lastFixTraceMs > 0 ? st.lastFixTraceMs / 1000 : performance.now() / 1000;
}

function guide(now = currentNavClockS()) {
  if (!st.route || !st.pos) return;
  if (Number.isFinite(st.lastRouteS) && now < st.lastRouteS) st.lastRouteS = now - 31;
  if (shouldReroute(st.route, st.pos, st.lastRouteS, now)) {
    if (navigator.onLine === false) {
      st.lastRouteS = now;
      hint('Fuera de ruta y sin red: se conserva la ruta cargada en memoria hasta recuperar conexión.');
    } else {
      say('Recalculando');
      return goTo(st.dest, true, now);
    }
  }
  const n = nextManeuver(st.route, st.pos);
  $('#turn').hidden = false; setHtml($('#turnIco'), maneuverIcon(n.step)); $('#turnDist').textContent = fmtDist(n.distM); $('#turnTxt').textContent = n.step.text;
  const lg = laneGuide(n.step.lanes); $('#lanes').hidden = !lg || n.distM > 2000; if (lg) { setHtml($('#laneSvg'), laneSvg(n.step.lanes)); $('#laneTxt').textContent = lg.text; }
  const a = announcement(n, st.said); capSet(st.said); if (a) say(a);
  if (n.step.type === 'arrive' && n.distM < 30) { say('Has llegado'); endNav(); }
}

async function goTo(dest, reroute = false, nowS = currentNavClockS()) {
  if (!st.pos) return hint('Esperando al GPS para calcular la ruta…');
  const prevRoute = st.route;
  st.dest = dest; st.lastRouteS = nowS;
  hint(reroute ? 'Recalculando…' : 'Calculando ruta…');
  $('#etaBox').hidden = false; $('#searchBox').hidden = true;
  try {
    const json = await (await fetch(routeUrl({ from: st.pos, to: dest.at, mode: st.mode }))).json();
    const r = parseRoute(json);
    if (!r.ok) return hint('No hay ruta: ' + r.reason);
    // Alternativas de OSRM (hasta 3): cada una en su color, con su tiempo, distancia y avisos conocidos a lo largo
    if (!reroute) { st.alts = (json.routes ?? []).map((_, i) => parseRoute(json, i)).filter((x) => x.ok).slice(0, 3); st.altIdx = 0; drawAlts(); }
    st.route = r; st.said = new Set(); st.follow = true;
    if (reroute) st.rerouteCount++;
    if (!reroute) window.SendaNative?.p2pStart?.(); // APK: buzón Bluetooth abierto mientras navegas, para recibir avisos de accidentes cercanos
    st.map?.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords } });
    const arrive = new Date(Date.now() + r.durationS * 1000);
    $('#etaTime').textContent = arrive.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    $('#etaInfo').textContent = `${Math.round(r.durationS / 60)} min · ${fmtDist(r.distanceM)} · ${dest.name}`;
    if (st.pos && st.me) {
      const snap = snapToRoute(r.coords, st.pos, 25);
      if (snap) {
        st.shownPos = snap.at; st.me.setLngLat(st.shownPos);
        if (snap.bearingDeg != null && (st.headingSrc == null || (st.speed ?? 0) < 1.5)) {
          st.heading = snap.bearingDeg; st.me.setRotation(st.heading); st.me.getElement().classList.toggle('has-heading', true);
        }
      }
    }
    hint('Llegada estimada por OSRM, sin tráfico en vivo. Para tráfico en vivo, abre la misma ruta en Waze o Google Maps.');
    guide(nowS); updateCorridor(); updateCurveHorizon();
  } catch {
    if (reroute && prevRoute) {
      st.route = prevRoute;
      hint('Sin red para recalcular: se mantiene la ruta cargada en memoria.');
      return;
    }
    hint('Sin conexión al servicio de rutas. Abre el destino en Waze o Google Maps.');
    $('#etaTime').textContent = dest.name; $('#etaInfo').textContent = '';
  }
}
function endNav() { st.alts = null; st.map?.getSource('route-alts')?.setData({ type: 'FeatureCollection', features: [] }); if ($('#altsRow')) $('#altsRow').hidden = true; st.map?.setPaintProperty('route', 'line-color', ALT_COLORS[0]); st.route = null; st.dest = null; $('#turn').hidden = true; $('#lanes').hidden = true; $('#etaBox').hidden = true; $('#searchBox').hidden = false; st.map?.getSource('route')?.setData({ type: 'FeatureCollection', features: [] }); st.map?.easeTo({ pitch: 0, bearing: 0 }); hint('Navegación terminada.'); updateCorridor(); updateCurveHorizon(); }
$('#endNav').addEventListener('click', endNav);
$('#goWaze').addEventListener('click', () => { if (st.dest) location.href = wazeUrl({ to: st.dest.at }).url; });
$('#goMaps').addEventListener('click', () => { if (st.dest) location.href = googleMapsUrl({ from: st.pos ?? st.dest.at, to: st.dest.at }).url; });
$('#center').addEventListener('click', async () => {
  try { if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch { /* iOS: permiso denegado */ }
  if (st.follow && !st.headingUp) { st.headingUp = true; hint(st.heading == null ? 'Modo brújula: mueve el móvil en forma de 8 si la flecha no se orienta.' : 'Modo brújula: el mapa gira hacia donde miras.'); }
  else { st.headingUp = false; if (st.follow) st.map?.easeTo({ bearing: 0, duration: 500 }); }
  st.follow = true; $('#center').classList.toggle('on', st.headingUp);
  if (st.pos && st.mapOk) st.map.easeTo({ center: st.pos, zoom: Math.max(st.map.getZoom(), 16), bearing: st.headingUp && st.heading != null ? st.heading : st.map.getBearing() });
});
let toastT = 0;
/** Flecha de la maniobra (como en las apps de navegación) a partir del tipo y el sentido de OSRM. */
function maneuverIcon(step) {
  const t = step?.type, m = step?.modifier ?? 'straight', W = (d) => `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  if (t === 'arrive') return W('<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>');
  if (t === 'roundabout' || t === 'rotary' || t === 'exit roundabout') return W('<path d="M12 21v-6"/><path d="M12 15a4 4 0 1 1 4-4"/><path d="M16 11V5M13 8l3-3 3 3"/>');
  if (m === 'uturn') return W('<path d="M8 21V9a4 4 0 0 1 8 0v4M13 10l3 3 3-3"/>');
  const ang = { left: -90, right: 90, 'slight left': -45, 'slight right': 45, 'sharp left': -135, 'sharp right': 135, straight: 0 }[m] ?? 0;
  return W(`<g transform="rotate(${ang} 12 13)"><path d="M12 21V6M7 10l5-5 5 5"/></g>`);
}
function hint(t) { const box = $('#toast'); if (!box || !t) return; $('#hint').textContent = t; box.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { box.hidden = true; }, Math.min(9000, 2600 + t.length * 45)); }

// ── Búsqueda (Nominatim: solo al pulsar «Buscar», máximo 1 petición por segundo) ──
/** Resultados como en las apps de mapas: nombre, una línea corta (calle, ciudad), distancia y sin duplicados cercanos. */
function searchList(raw) {
  const out = [];
  for (const p of raw ?? []) {
    const a = p.address ?? {}, name = p.name || p.display_name.split(',')[0], at = [Number(p.lon), Number(p.lat)];
    const city = a.city || a.town || a.village || a.municipality || a.county || '';
    const sub = [a.road && a.road !== name ? a.road : null, city && city !== name ? city : null, a.state && !city ? a.state : null, a.country_code && st.pos ? null : a.country].filter(Boolean).join(', ') || p.display_name.split(',').slice(1, 3).join(',').trim();
    const distM = st.pos ? haversineM(st.pos, at) : null;
    if (out.some((o) => o.name === name && haversineM(o.at, at) < 400)) continue; // mismo sitio con otra entrada de OSM
    out.push({ name, sub, at, distM, cls: p.category || p.class, type: p.type });
    if (out.length === 6) break;
  }
  return st.pos ? out.sort((x, y) => x.distM - y.distM) : out;
}
function placeIcon(p) {
  const d = p.cls === 'railway' || p.type === 'station' ? '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 11h12M9 20l-2 2M15 20l2 2M9 16v2M15 16v2"/>'
    : p.cls === 'highway' ? '<path d="M4 20 9 4M20 20 15 4M12 6v2M12 11v2M12 16v2"/>'
    : p.cls === 'place' || p.cls === 'boundary' ? '<path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-5h4v5"/>'
    : '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}
let lastSearch = 0;
$('#search').addEventListener('submit', async (e) => {
  e.preventDefault(); const q = $('#q').value.trim(); if (!q) return;
  if (Date.now() - lastSearch < 1100) return; lastSearch = Date.now();
  const box = $('#results'); box.hidden = false; box.innerHTML = '<button disabled>Buscando…</button>';
  try {
    const near = st.pos ? `&viewbox=${st.pos[0] - 0.5},${st.pos[1] + 0.5},${st.pos[0] + 0.5},${st.pos[1] - 0.5}` : '';
    const raw = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&accept-language=es&q=${encodeURIComponent(q)}${near}`)).json();
    const list = searchList(raw);
    box.innerHTML = list.length ? list.map((p, i) => `<button data-i="${i}"><span class="ri">${placeIcon(p)}</span><span class="rt"><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span>${p.distM != null ? `<span class="rd">${fmtDist(p.distM)}</span>` : ''}</button>`).join('') : '<button disabled>Sin resultados</button>';
    box.onclick = (ev) => { const i = ev.target.closest('[data-i]')?.dataset.i; if (i == null) return; const p = list[i]; box.hidden = true; $('#q').blur(); goTo({ name: p.name, at: p.at }); };
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
function saveReport(kind, side = 'SIN_INDICAR', extra = {}) {
  if (!st.pos) return hint('Sin GPS: no se puede situar el aviso.');
  const id = crypto.getRandomValues(new Uint32Array(1))[0];
  const list = reports(); list.push({ kind, side, lon: st.pos[0], lat: st.pos[1], t: Date.now(), own: true, id, dev: DEVICE_ID, acc: st.lastFix?.coords?.accuracy ?? null, ...extra }); LS.set('senda.ruta.reports', list);
  drawMarkers(); updateCorridor(); if (extra.quiet) return id; say(`Aviso de ${REPORT_KINDS[kind].label} guardado`); hint(`Aviso «${REPORT_KINDS[kind].label}» guardado en tu posición. Para pasarlo a otros móviles SENDA cercanos: «Más» → «Enviar mis avisos por Bluetooth» o «Compartir avisos sin la app».`);
}
window.sendaVoice = (res) => {
  if (VC.on) return vcHandle(res);
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
function mapKindToQuickSignal(kind) {
  if (kind === 'accidente') return 'ayuda';
  if (kind === 'retencion') return 'retencion';
  if (kind === 'parado') return 'parado';
  if (kind === 'niebla') return 'niebla';
  if (kind === 'inundacion' || kind === 'hielo') return 'agua';
  return 'obstaculo';
}
async function shareIndirectDrive() {
  openSheet(false);
  const latest = reports().slice(-1)[0];
  const signalId = mapKindToQuickSignal(latest?.kind ?? st.corridor?.top?.kind ?? 'obstaculo');
  const pos = st.pos ? { lat: st.pos[1], lon: st.pos[0] } : null;
  const msg = composeProximityMessage({
    signalId,
    pos,
    recommendedMaxKmh: st.curveState?.topCurve?.safeSpeedKmh ?? st.radarState?.top?.maxspeed ?? null,
    roadHint: st.corridor?.top?.road ?? st.dest?.name ?? '',
  });
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: msg.indirect.title, text: msg.indirect.shareText });
      hint('Aviso compartido para personas sin app SENDA.');
      return msg;
    }
  } catch { /* usuario canceló o share bloqueado */ }
  try {
    await navigator.clipboard?.writeText(msg.indirect.shareText);
    hint('Aviso copiado al portapapeles: pégalo en WhatsApp, SMS o grupo de carretera.');
  } catch {
    hint(msg.indirect.shareText);
  }
  return msg;
}
$('#shareIndirectDrive')?.addEventListener('click', shareIndirectDrive);
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
  const sa = $('#sheetAiMode span'); if (sa?.firstChild) sa.firstChild.textContent = lbl;
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
  const wv = prompt('Ancho de tu vehículo en metros (coche con espejos ≈ lo que midas; bici = manillar). Sirve para la separación al adelantar. Vacío = no estimarla.', cur.egoWidthM ?? '');
  const g = { camHeightM: parseFloat(String(h).replace(',', '.')), fovVDeg: parseFloat(String(f ?? '').replace(',', '.')), egoWidthM: parseFloat(String(wv ?? '').replace(',', '.')) || null };
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
  drawInsights(x, box.width, box.height, objs);
  noteObjects(objs);
  const top = topAlert(objs), a = $('#adas');
  if (!top) { a.hidden = true; return; }
  a.hidden = false; a.className = top.level;
  a.textContent = `${ES[top.label] ?? top.label} ${top.zone === 'TU_CARRIL' ? 'delante' : top.zone === 'DERECHA' ? 'a la derecha' : 'a la izquierda'}: ${top.reasons.join(' · ')}`;
  publishToAndroidAuto(top.level === 'ROJO');
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
  document.documentElement.classList.remove('dashmode', 'nomini', 'dashmini'); $('#dash').hidden = true; st.map?.resize();
}
/** Minimizar: la cámara sigue grabando en una ventana pequeña y la app queda libre; tocarla la vuelve a ampliar. */
function dashMini(on) { const h = document.documentElement.classList; h.toggle('dashmini', on); h.toggle('dashmode', !on); st.map?.resize(); if (on) hint(dash.rec ? 'Sigue grabando en la ventana pequeña. Tócala para ampliar.' : 'Cámara en ventana pequeña. Tócala para ampliar.'); }
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
  drawInsights(x, W, H, dash.objs, true);
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
    dash.mic?.getTracks().forEach((tr) => tr.stop()); dash.mic = null;
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
  if ($('#withVoice').checked) { // la voz va en una petición aparte (la app solo concede micrófono o cámara por separado)
    try { dash.mic = await navigator.mediaDevices.getUserMedia({ audio: true }); dash.mic.getAudioTracks().forEach((tr) => src.addTrack(tr)); if (VC.on) hint('Con la voz en el vídeo, algunos móviles pausan el micrófono de apoyo: las notas seguirán en el audio del vídeo.'); }
    catch (e) { hint('Sin micrófono para el vídeo: ' + (e.message || e.name)); }
  }
  dash.chunks = []; dash.rec = new MediaRecorder(src, { mimeType: mime || undefined, videoBitsPerSecond: q.bps });
  dash.rec.ondataavailable = (e) => { if (e.data.size) dash.chunks.push(e.data); };
  dash.rec.start(1000); dash.t0 = Date.now(); $('#recBtn').classList.add('on'); $('#recDot').hidden = false;
  dash.timer = setInterval(() => { const s = Math.floor((Date.now() - dash.t0) / 1000); $('#recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; $('#dashSpeed').textContent = `${VC.cal.gate(st.speed) == null ? '–' : Math.round(st.speed * 3.6)} km/h`; }, 500);
}
$('#dashBtn').addEventListener('click', dashOpen);
$('#dashExit').addEventListener('click', dashClose);
$('#dashMin').addEventListener('click', (e) => { e.stopPropagation(); dashMini(true); });
$('#dash').addEventListener('click', () => { if (document.documentElement.classList.contains('dashmini')) dashMini(false); });
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
  st.camObjs = { t: Date.now(), objs };
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
// ── Orientación: hacia dónde miras (brújula) y hacia dónde vas (GPS), fusionadas y autocalibradas ──
// Constantes de diseño (declaradas): el GPS manda desde 3 m/s (≈ 11 km/h); suavizados de 0,4 s (brújula), 0,8 s (GPS)
// y 20 s para aprender la corrección de la brújula mientras se conduce.
function applyHeading(fromCompass) {
  const s = HF.state(); if (s.headingDeg == null) return;
  st.heading = s.headingDeg; st.headingSrc = s.source; st.headingOffset = s.offsetDeg;
  if (st.me) { st.me.setRotation(st.heading); st.me.getElement().classList.toggle('has-heading', true); }
  // El mapa gira con la brújula solo en modo brújula (o navegando/3D), como mucho ~7 veces por segundo y si cambia > 2°
  if (fromCompass && st.mapOk && st.follow && (st.headingUp || st.route || st.view3d || st.mode === 'car') && performance.now() - lastBearingMs > 140 && Math.abs(((st.map.getBearing() - st.heading + 540) % 360) - 180) > 2) {
    lastBearingMs = performance.now(); st.map.rotateTo(st.heading, { duration: 140, easing: (k) => k });
  }
}
const onOrient = (e) => { const c = compassHeading(e, { screenAngle: screen.orientation?.angle ?? window.orientation ?? 0 }); if (c) { HF.compass(c.headingDeg, performance.now() / 1000); applyHeading(true); } };
window.addEventListener('deviceorientationabsolute', onOrient, { passive: true }); // Android: referido al norte
window.addEventListener('deviceorientation', (e) => { if (typeof e.webkitCompassHeading === 'number' || e.absolute) onOrient(e); }, { passive: true }); // iOS (y navegadores que marcan absolute)
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
function pruneMapByAge(map, nowMs, maxAgeMs = 60_000) {
  if (map.size <= 64) return;
  for (const [k, t] of map.entries()) if (nowMs - t > maxAgeMs) map.delete(k);
}

/** Propagación cinemática EKF en túneles (pérdida de GPS de hasta 65 s): mantiene flecha, rumbo y maniobras sin fingir fijación GPS. */
function coastTunnelTick(dtMs = 1000) {
  if (!st.ekf.initialized || !st.lastFix || !(st.speed > 1.5)) return null;
  const nextT = (st.lastPredictTraceMs || st.lastFixTraceMs || Date.now()) + dtMs;
  st.lastPredictTraceMs = nextT;
  let yawRateRadS = (st.imu.gz ?? 0) * Math.PI / 180;
  if (st.route && st.pos && st.imu.gz == null) {
    const snapPre = snapToRoute(st.route.coords, st.pos, 60);
    if (snapPre?.bearingDeg != null && st.heading != null) {
      const diffDeg = ((snapPre.bearingDeg - st.heading + 540) % 360) - 180;
      yawRateRadS = (Math.max(-18, Math.min(18, diffDeg)) * Math.PI / 180) / Math.max(0.5, dtMs / 1000);
    }
  }
  const ek = st.ekf.predict({ tMs: nextT, aLongMs2: 0, yawRateRadS });
  if (!ek?.pos) return null;
  st.ekfState = ek;
  st.pos = ek.pos;
  const snap = st.route ? snapToRoute(st.route.coords, st.pos, Math.max(45, (ek.sigmaPosM ?? 15) * 2)) : null;
  st.shownPos = snap ? snap.at : st.pos;
  if (snap?.bearingDeg != null && st.imu.gz == null) st.heading = snap.bearingDeg;
  else if (Number.isFinite(ek.headingDeg)) st.heading = ek.headingDeg;
  if (st.mapOk && st.me) {
    st.me.setLngLat(st.shownPos);
    st.me.setRotation(st.heading);
    st.map.getSource('me-acc')?.setData(circlePolygon(st.pos, Math.max(12, ek.sigmaPosM ?? 20)));
    easeCameraFollowing(st.mode === 'car', st.speed);
  } else {
    drawRadar();
  }
  if (st.route) guide(nextT / 1000);
  publishToAndroidAuto();
  return ek;
}

function sampleSlow() {
  const nowMs = Date.now();
  pruneMapByAge(saidAdas, nowMs);
  pruneMapByAge(lastAlert, nowMs);
  if (st.lastFixWallMs > 0) {
    const gapMs = nowMs - st.lastFixWallMs;
    if (gapMs >= 2500 && gapMs <= 65_000 && (st.speed ?? 0) > 1.5) coastTunnelTick(1000);
  }
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
    st.heading != null ? `RUMBO ${Math.round(st.heading)}° · ${{ gps: 'GPS', brujula: 'brújula', brujula_calibrada: 'brújula calibrada' }[st.headingSrc] ?? '–'}${st.headingOffset != null ? ` (corr ${st.headingOffset > 0 ? '+' : ''}${st.headingOffset}°)` : ''}` : 'RUMBO –',
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
  hint('Caja negra grabando. Todo se guarda solo en tu móvil. Si Android lo pide, acepta para grabar también la pantalla. «Marcar» señala un momento.');
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
  const lc = $('#labChip small'); if (lc) lc.textContent = st.activeListen ? 'Mapa de cobertura activo' : 'Cobertura de radio, GPS y estado de la vía';
  $('#labStatusPill')?.classList.toggle('live', st.activeListen);
  if ($('#labStatusPill')) $('#labStatusPill').textContent = st.activeListen ? 'MAPEANDO' : 'EN ESPERA';
  $('#labListenBtn')?.classList.toggle('live', st.activeListen);
  if ($('#labListenBtn')) $('#labListenBtn').textContent = st.activeListen ? 'Mapa de cobertura: encendido' : 'Mapa de cobertura: apagado';
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

const bootMap = () => setTimeout(() => { initMap(); }, 0);
if (document.readyState === 'complete') bootMap();
else window.addEventListener('load', bootMap, { once: true });
loadIncidents();
setInterval(() => { if (!document.hidden) loadIncidents(); }, 5 * 60 * 1000);
// ── Después de un choque: el detector del núcleo decide si PREGUNTAR; una alarma fuerte ayuda a encontrar el móvil; nadie llama solo al 112 ──
// Configuración: EXAMPLE_DETECTION_CONFIG, ejemplo SIN CALIBRAR (se dice en pantalla). Por eso la app pregunta y nunca afirma que hubo un choque.
const CRASH_CFG = EXAMPLE_DETECTION_CONFIG, G0 = 9.80665;
const crashBuf = { imu: [], speed: [], gyro: [] };
const crash = { open: false, lastTrigS: -1e9, tick: 0, left: 0, result: null, sim: false, reportId: null, wb: null, rep: { vehicles: null, lane: null, trapped: null, fire: null } };
const tS = () => performance.now() / 1000;
const keep = (arr, v, s = 45, maxLen = 4500) => {
  arr.push(v);
  while (arr.length > maxLen || (arr.length && arr[0].t < v.t - s)) arr.shift();
};
let actx = null, siren = null, buzz = 0;
addEventListener('pointerdown', () => { try { actx ??= new AudioContext(); actx.resume(); } catch { /* sin audio web */ } }, { passive: true });
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity, t = tS();
  if (a && Number.isFinite(a.x)) {
    keep(crashBuf.imu, { t, x: a.x, y: a.y ?? 0, z: a.z ?? 0 }, 45, 4500);
    if (!crash.open && t - crash.lastTrigS > 60 && Math.hypot(a.x, a.y ?? 0, a.z ?? 0) / G0 >= CRASH_CFG.trigger.peakG) crashTriggered(t);
  }
  const g = e.rotationRate; if (g && Number.isFinite(g.alpha)) keep(crashBuf.gyro, { t, x: g.alpha, y: g.beta ?? 0, z: g.gamma ?? 0 }, 45, 4500);
});
function crashSpeed(p, fixMs = Date.now()) {
  const v = p.coords.speed; if (!Number.isFinite(v)) return;
  const t = tS(), prev = crashBuf.speed[crashBuf.speed.length - 1];
  const dtFixS = prev && Number.isFinite(prev.fixMs) && fixMs > prev.fixMs ? (fixMs - prev.fixMs) / 1000 : (prev ? t - prev.t : 0);
  keep(crashBuf.speed, { t, fixMs, ms: v, src: 'GNSS' }, 45, 120);
  if (prev && dtFixS > 0 && dtFixS <= 1.5 && (prev.ms - v) / dtFixS / G0 >= CRASH_CFG.trigger.physicalDecelG && !crash.open && t - crash.lastTrigS > 60) crashTriggered(t);
}
function crashTriggered(t0) {
  crash.lastTrigS = t0; bbLog('note', { text: 'Disparo del detector de choque' });
  setTimeout(() => crashEvaluate(t0), 3000); // primera lectura: pulso y caída de velocidad
  setTimeout(() => crashEvaluate(t0), (CRASH_CFG.thresholds.stationaryAfterS + 2) * 1000); // segunda: ¿sigue parado?
}
function crashEvaluate(t0) {
  if (crash.open && crash.result?.state === 'LIKELY_CRASH') return;
  const from = t0 - 20, f = (arr) => arr.filter((x) => x.t >= from).map((x) => ({ ...x, t: +(x.t - from).toFixed(3) }));
  const dRoadM = st.route && st.pos ? +distToRoute(st.route, st.pos).toFixed(1) : null;
  const r = detectCrashEvent({ imu: f(crashBuf.imu), speed: f(crashBuf.speed), gyro: f(crashBuf.gyro), distanceToRoadM: dRoadM }, CRASH_CFG);
  bbLog('note', { text: `Detector de choque: ${r.state} (p=${r.posterior ?? '–'})` });
  if (r.state === 'LIKELY_CRASH' || r.state === 'CHECK_USER') openCrash(r, false);
}
/** Verifica en caliente una traza sintética rotulada por la misma puerta de `crashEvaluate` (solo abre `#crash` si `LIKELY_CRASH` o `CHECK_USER`). */
function evaluateSyntheticCrash(kind, { openUi = true } = {}) {
  const tr = syntheticTrace(kind);
  const r = detectCrashEvent(tr, CRASH_CFG);
  const triggeredAlarm = r.state === 'LIKELY_CRASH' || r.state === 'CHECK_USER';
  if (openUi && triggeredAlarm) openCrash(r, true);
  return { kind, label: tr.label, state: r.state, posterior: r.posterior, peakG: r.peakG, triggeredAlarm, crashModalOpen: !$('#crash')?.hidden };
}

// Para pruebas automáticas
globalThis.sendaDrive = {
  st, goTo, onPos, dash, updateCorridor, updateRadars, updateCurveHorizon, shareIndirectDrive, drawTele,
  buildAndroidAutoState, publishToAndroidAuto, coastTunnelTick, evaluateSyntheticCrash, parseGpxTrack,
  bbStart, bbSample, bbExport, setAiMode, aiIntervalMs,
  sendBleProbe, loadPmTilesFile, loadOsintXml, loadOsintGeoJson,
  exportDenm, encodeDenmCompact, decodeDenmCompact, ekf: st.ekf, horizonCal: st.horizonCal,
  openLab, setActiveListen, runLabBattery, loadRfSurveyText, exportLabAndMap, surfaceMapper: st.surfaceMapper,
  renderArHud, enrichTracksForHud, hudPhysicsState, createTracker, FULL_RULES,
};
function openCrash(r, sim) {
  const upgrade = crash.open && r.state === 'LIKELY_CRASH' && crash.result?.state !== 'LIKELY_CRASH';
  if (crash.open && !upgrade) return;
  if (!crash.open) Object.assign(crash, { sim, reportId: null, wb: null, rep: { vehicles: null, lane: null, trapped: null, fire: null } });
  crash.open = true; crash.result = r;
  $('#crash').hidden = false; $('#crashClose').hidden = true; $('#crashRep').hidden = true; $('#crashSay').hidden = true; $('#crashState').textContent = '';
  for (const b of $('#crashRep').querySelectorAll('button')) b.classList.remove('on');
  $('#crashBasis').textContent = sim ? 'SIMULACIÓN · prueba con una traza sintética: la alarma suena para que compruebes el volumen' : 'Posible choque detectado por los sensores de este móvil · detector sin calibrar: por eso te pregunta';
  $('#crashTitle').textContent = r.state === 'LIKELY_CRASH' ? '¿Estáis bien?' : '¿Va todo bien?';
  $('#crashWhy').textContent = `Pico ${r.peakG} g${r.maxVehicleDecelG ? ` · frenada de ${r.maxVehicleDecelG} g` : ''} · ${r.used?.length ?? 0} indicio(s) físico(s). Si no respondes, se avisa a los de detrás. Nadie llama solo al 112.`;
  navigator.wakeLock?.request('screen').catch(() => { /* sin permiso */ });
  if (r.state === 'LIKELY_CRASH' || sim) alarmOn(); else { navigator.vibrate?.([300, 150, 300]); say('¿Va todo bien? Toca la pantalla.'); }
  clearInterval(crash.tick); crash.left = r.countdownS ?? 30; $('#crashCount').textContent = `${crash.left} s`;
  $('#crashCount').classList.remove('msg');
  crash.tick = setInterval(() => { crash.left--; $('#crashCount').textContent = crash.left > 0 ? `${crash.left} s` : 'Sin respuesta'; if (crash.left <= 0) { clearInterval(crash.tick); crashNoAnswer(); } }, 1000);
}
function alarmOn() {
  const N = window.SendaNative;
  if (typeof N?.alarm === 'function') N.alarm(true);
  else if (actx && !siren) { try { const o = actx.createOscillator(), gn = actx.createGain(); o.type = 'square'; gn.gain.value = 0.9; o.connect(gn).connect(actx.destination); o.start(); let hi = false; siren = { o, iv: setInterval(() => { hi = !hi; o.frequency.setValueAtTime(hi ? 960 : 770, actx.currentTime); }, 450) }; } catch { /* */ } }
  clearInterval(buzz); navigator.vibrate?.([800, 300, 800]); buzz = setInterval(() => { navigator.vibrate?.([800, 300, 800]); say('Posible accidente. Toca la pantalla.'); }, 4000);
}
function alarmOff() {
  window.SendaNative?.alarm?.(false);
  if (siren) { clearInterval(siren.iv); try { siren.o.stop(); } catch { /* */ } siren = null; }
  clearInterval(buzz); navigator.vibrate?.(0);
}
/** Guarda el aviso de accidente (una vez por choque) y lo envía a los móviles SENDA cercanos para que los de detrás lo vean venir. */
function declareAccident(extra) {
  if (crash.sim) return $('#crashState').textContent = 'Simulación: no se ha guardado ni enviado ningún aviso.';
  if (crash.reportId == null) crash.reportId = saveReport('accidente', 'SIN_INDICAR', { quiet: true, ...extra });
  else { const list = reports(), r = list.find((x) => x.id === crash.reportId); if (r) { Object.assign(r, extra); LS.set('senda.ruta.reports', list); drawMarkers(); } }
  if (crash.reportId == null) return $('#crashState').textContent = 'Sin GPS todavía: el aviso se guardará en cuanto haya posición. Llama al 112 si lo necesitas.';
  const N = window.SendaNative;
  if (typeof N?.p2pSend === 'function') { N.p2pStart(); const pack = packReports(reports()); N.p2pSend(b64(pack)); st.ble.tx += pack[2]; $('#crashState').textContent = 'Aviso de accidente enviado por Bluetooth a los móviles SENDA cercanos (los que vienen detrás lo ven en su mapa).'; }
  else $('#crashState').textContent = 'Aviso de accidente guardado. En la web no hay Bluetooth: compártelo con «Más» → «Compartir avisos sin la app».';
}
function crashNoAnswer() {
  if (crash.wb) return;
  alarmOn(); crash.wb = 'NO_ANSWER'; declareAccident({ wb: 'NO_ANSWER' }); show112(); say('Sin respuesta. Aviso enviado. Si puedes, llama al 112.');
}
function show112() {
  const p = st.pos, acc = st.lastFix?.coords?.accuracy;
  const where = p ? `las coordenadas ${p[1].toFixed(5)}, ${p[0].toFixed(5)}${Number.isFinite(acc) ? ` (GPS ± ${Math.round(acc)} m)` : ''}` : 'una posición que aún no tengo';
  const R = crash.rep, txt = call112Script({ where, vehicles: R.vehicles, trapped: R.trapped, fire: R.fire, lane: R.lane });
  $('#crashSay').hidden = false; $('#crashSay').innerHTML = `<b>Si llamas al 112, di:</b><br>${esc(txt)}`;
}
function answerCrash(wb, text) {
  alarmOff(); clearInterval(crash.tick); crash.wb = wb; $('#crashClose').hidden = false; $('#crashCount').textContent = text; $('#crashCount').classList.add('msg');
  declareAccident({ wb }); show112();
  if (wb === 'OK') say('Anotado. Ponte a salvo detrás del guardarraíl, con el chaleco puesto.');
  else say('Anotado. Llama al 112 con el botón blanco.');
}
$('#crashOk').addEventListener('click', () => answerCrash('OK', 'Estás bien'));
$('#crashHurt').addEventListener('click', () => answerCrash('HURT', 'No estás bien: llama al 112'));
$('#crashHelp').addEventListener('click', () => answerCrash('NEEDS_HELP', 'Pedís ayuda: llama al 112'));
$('#crashRepBtn').addEventListener('click', () => { alarmOff(); $('#crashClose').hidden = false; clearInterval(crash.tick); $('#crashCount').textContent = 'Cuéntanos qué ha pasado'; $('#crashCount').classList.add('msg'); $('#crashRep').hidden = false; show112(); });
$('#crash112').addEventListener('click', () => { alarmOff(); clearInterval(crash.tick); $('#crashClose').hidden = false; if (!crash.wb) { crash.wb = 'NEEDS_HELP'; declareAccident({ wb: 'NEEDS_HELP' }); } });
$('#crashRep').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-v]'), row = b?.closest('[data-f]'); if (!b) return;
  for (const x of row.querySelectorAll('button')) x.classList.toggle('on', x === b);
  const f = row.dataset.f, v = b.dataset.v;
  crash.rep[f] = v === '' ? null : f === 'fire' ? v === 'true' : f === 'lane' ? v : Number(v);
  declareAccident({ lane: crash.rep.lane, vehicles: crash.rep.vehicles, wb: crash.wb ?? 'REPORTED' }); show112();
});
$('#crashClose').addEventListener('click', () => { alarmOff(); crash.open = false; $('#crash').hidden = true; if (!crash.sim) hint('El aviso de accidente sigue en tu mapa y en el de los móviles a los que se envió.'); });
$('#crashFalse').addEventListener('click', () => {
  alarmOff(); clearInterval(crash.tick); bbLog('note', { text: 'Choque descartado por el usuario (falsa alarma)' });
  if (crash.reportId != null && !crash.sim) { LS.set('senda.ruta.reports', reports().filter((r) => r.id !== crash.reportId)); drawMarkers(); updateCorridor(); }
  crash.open = false; $('#crash').hidden = true; hint('Falsa alarma anotada. Gracias: así se calibra el detector.');
});
$('#crashTest')?.addEventListener('click', () => { openCrash(detectCrashEvent(syntheticTrace('CRASH_REAR_END'), CRASH_CFG), true); });


// ── Micrófono de apoyo: notas de voz con hora, posición, velocidad y lo que veía la cámara; órdenes para calibrar en vivo ──
// Las notas (pueden llevar matrículas, que son datos personales) se quedan en este móvil y en la caja negra; no viajan en los avisos.
const PARKED_MIN = 10; // lecturas de GPS en parado antes de filtrar (≈10 s a 1 Hz): elección de diseño, no un dato
const VC = { on: false, parked: false, notes: LS.get('senda.voz.notas', []), cal: createParkedCalibrator({ minSamples: PARKED_MIN, saved: LS.get('senda.voz.parado', null) }), rec: null, errs: 0, quietUntil: 0 };
function vcPill() {
  $('#vcPill').hidden = !VC.on; $('#vcPill').classList.toggle('parked', VC.parked);
  const thr = VC.cal.threshold();
  $('#vcTxt').textContent = VC.parked ? `Calibrando en parado · ${VC.cal.state().n} lecturas` : `Escuchando · ${VC.notes.filter((n) => n.cmd === 'NOTE').length} notas${thr != null ? ` · parado ≤ ${(thr * 3.6).toFixed(1)} km/h` : ''}`;
}
function vcSay(t) { VC.quietUntil = Date.now() + 2500 + t.length * 60; say(t); } // no escuchar mientras habla la app
function vcListen() {
  if (!VC.on) return;
  const wait = Math.max(0, VC.quietUntil - Date.now()) + (VC.errs > 3 ? 1500 : 250);
  setTimeout(() => {
    if (!VC.on) return;
    if (typeof window.SendaNative?.listen === 'function') return window.SendaNative.listen();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { VC.on = false; vcPill(); return hint('Este navegador no tiene reconocimiento de voz. Usa la app de Android.'); }
    if (VC.rec) return;
    const r = new SR(); r.lang = 'es-ES'; r.continuous = true; r.interimResults = false; r.maxAlternatives = 3;
    r.onresult = (e) => { const res = e.results[e.results.length - 1]; vcHandle({ alternatives: [...res].map((a) => a.transcript) }); };
    r.onerror = () => { VC.errs++; }; r.onend = () => { VC.rec = null; vcListen(); };
    try { r.start(); VC.rec = r; } catch { VC.rec = null; }
  }, wait);
}
function vcHandle(res) {
  if (res.state) return; // «escuchando» / «procesando» del reconocedor nativo
  if (res.error) { VC.errs++; return vcListen(); } // silencio o nada entendido: se vuelve a escuchar
  VC.errs = 0;
  const alts = res.alternatives ?? [], p = parseUtterance(alts[0] ?? '');
  if (p.cmd === 'EMPTY') return vcListen();
  const c = st.lastFix?.coords, entry = {
    t: Date.now(), iso: new Date().toISOString(), lat: c?.latitude ?? null, lon: c?.longitude ?? null, accM: c?.accuracy ?? null,
    gpsKmh: st.speed == null ? null : +(st.speed * 3.6).toFixed(1), shownKmh: VC.cal.gate(st.speed) == null ? null : +(VC.cal.gate(st.speed) * 3.6).toFixed(1), heading: st.heading ?? null,
    cmd: p.cmd, kmh: p.kmh ?? null, text: p.text, alternatives: alts.slice(0, 3), tags: p.tags, plates: p.plates,
    camera: st.lastVision ? { objects: st.lastVision.count ?? st.lastVision.objects ?? null } : null, dashcamSecond: dash.rec ? Math.round((Date.now() - dash.t0) / 1000) : null,
  };
  VC.notes.push(entry); if (VC.notes.length > 3000) VC.notes.shift(); LS.set('senda.voz.notas', VC.notes);
  bbLog('voice', entry);
  if (p.cmd === 'PARKED') { VC.parked = true; vcSay('Calibrando en parado. Cuando salgas, di en marcha.'); }
  else if (p.cmd === 'MOVING') { VC.parked = false; LS.set('senda.voz.parado', VC.cal.state()); const thr = VC.cal.threshold(); vcSay(thr == null ? `Faltan lecturas en parado: llevo ${VC.cal.state().n} de ${PARKED_MIN}.` : `Calibrado. En parado el GPS marcaba hasta ${(thr * 3.6).toFixed(1)} kilómetros por hora; ahora se mostrará cero.`); }
  else if (p.cmd === 'SPEED') vcSay(`Anotado: el coche marca ${p.kmh} y el GPS ${entry.gpsKmh == null ? 'no tiene dato' : Math.round(entry.gpsKmh)}.`);
  else if (p.cmd === 'MARK') { bbLog('note', { text: 'MARCA por voz' }); vcSay('Marcado'); }
  else if (p.cmd === 'FALSE_ALERT') vcSay('Anotado como falsa alarma');
  else navigator.vibrate?.(40); // nota: sin voz, para no cortarte
  vcPill(); vcListen();
}
function vcStart() {
  VC.on = true; VC.errs = 0; vcPill();
  hint('Micrófono de apoyo activo. Habla con normalidad: cada frase se guarda con hora, posición y velocidad. Órdenes: «estoy parado», «en marcha», «voy a 50», «marca», «falsa alarma».');
  if (!bb) setTimeout(() => hint('Consejo: activa también la caja negra para que las notas queden en el mismo registro sellado que el GPS, los sensores y la cámara.'), 6000);
  vcListen();
}
function vcStop() { VC.on = false; try { VC.rec?.stop(); } catch { /* */ } VC.rec = null; if (VC.parked) { VC.parked = false; LS.set('senda.voz.parado', VC.cal.state()); } vcPill(); hint(`Micrófono de apoyo parado · ${VC.notes.length} entradas guardadas en el móvil.`); }
async function vcSave() {
  const sum = summarizeSession(VC.notes);
  const doc = { format: 'senda-voz/1', exportedAt: new Date().toISOString(), containsPersonalData: sum.containsPersonalData, notice: 'Puede contener matrículas (datos personales): no publicar; solo para calibrar sensores.', parkedCalibration: { minSamples: PARKED_MIN, ...VC.cal.state() }, summary: sum, notes: VC.notes };
  const r = await saveBlob(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), `senda-voz-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  hint(r.ok ? `Notas de voz guardadas en ${r.where}.` : 'No se pudieron guardar las notas.');
}
$('#vcBtn')?.addEventListener('click', () => (VC.on ? vcStop() : vcStart()));
$('#vcStop')?.addEventListener('click', vcStop);
$('#vcSave')?.addEventListener('click', vcSave);


// ── Radar 360: lo que ven los sensores REALES alrededor del coche, actualizado cada 10–15 s para ahorrar batería ──
// Delante: la cámara del móvil (si no está abierta, abre una instantánea, detecta y se apaga). Detrás o a los lados: el SENDA
// Radar mmWave por USB, montado donde se declare. Donde no hay sensor se dibuja rayado y se dice: el móvil no ve detrás.
const SR = { on: false, everyS: LS.get('senda.sr.every', 15), timer: 0, last: null, mount: LS.get('senda.sr.mount', null), mm: { t: 0, targets: [] }, usbStop: null };
const SR_FILTER = { minMm: 100, maxMm: 8000, mergeMm: 1000 }; // mismos valores declarados que /senda/personas (alcance 8 m de la hoja de datos)
async function srSnapshotCamera() {
  if (camOn || dash.on) return st.camObjs && Date.now() - st.camObjs.t < 3000 ? st.camObjs.objs : [];
  let s = null;
  try {
    await getDetector(); s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = s; await v.play(); await new Promise((r) => setTimeout(r, 350));
    const r = timedDetect(v, performance.now());
    const raw = r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, box: { x: d.boundingBox.originX / v.videoWidth, y: d.boundingBox.originY / v.videoHeight, w: d.boundingBox.width / v.videoWidth, h: d.boundingBox.height / v.videoHeight } }));
    return enrichTracksForHud(raw, { speedMs: st.speed, geom: userGeom() });
  } catch { return null; } finally { s?.getTracks().forEach((t) => t.stop()); }
}
async function srTick() {
  if (!SR.on) return;
  const geom = userGeom() ?? DEFAULT_CAM_GEOM, cam = await srSnapshotCamera();
  const camObjs = cam ? fromCamera(cam, { hfovDeg: geom.fovHDeg }) : [];
  const mmFresh = SR.mount && Date.now() - SR.mm.t < 2500, mmObjs = mmFresh ? fromMmwave(SR.mm.targets, { mount: SR.mount }) : [];
  const objs = [...camObjs, ...mmObjs], sum = summarize(objs), cov = coverage({ cameraHfovDeg: cam ? geom.fovHDeg : null, mmwaveMounts: mmFresh ? [SR.mount] : [] });
  srDraw(objs, cov); $('#srCount').textContent = String(sum.total);
  $('#srTxt').textContent = `${sum.text}${cov.uncovered.length ? ` · sin sensor en ${cov.uncovered.length === 8 ? 'todas las zonas' : cov.uncovered.length + '/8 zonas'}` : ''}`;
  bbLog('surround', { total: sum.total, bySector: sum.bySector, cam: camObjs.length, radar: mmObjs.length, uncovered: cov.uncovered });
  if (SR.last != null && sum.key !== SR.last && (st.speed ?? 0) > 1) say(sum.total ? sum.text.replace(/\((\d+) m\)/g, 'a $1 metros') : 'Despejado alrededor');
  SR.last = sum.key;
  clearTimeout(SR.timer); SR.timer = setTimeout(srTick, SR.everyS * 1000);
}
function srDraw(objs, cov) {
  const c = $('#sr'), x = c.getContext('2d'), W = c.width, R = W / 2 - 6, k = R / 20; // escala: 20 m al borde
  x.clearRect(0, 0, W, W); x.save(); x.translate(W / 2, W / 2);
  for (const sct of cov.uncovered) { const a = (SECTORS.indexOf(sct) * 45 - 90) * Math.PI / 180; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a - Math.PI / 8, a + Math.PI / 8); x.closePath(); x.fillStyle = 'rgba(255,255,255,.07)'; x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 2; for (const m of [5, 10, 20]) { x.beginPath(); x.arc(0, 0, m * k, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '600 16px system-ui'; x.fillText('5', 5 * k + 3, -3); x.fillText('10 m', 10 * k + 3, -3);
  x.fillStyle = '#e8edf0'; x.beginPath(); x.roundRect(-11, -22, 22, 44, 7); x.fill(); x.fillStyle = '#1a73e8'; x.fillRect(-8, -17, 16, 9); // tu coche (delante = arriba)
  for (const o of objs) {
    const col = o.src === 'RADAR' ? '#ff9f0a' : '#5ac8fa';
    if (Number.isFinite(o.x) && Number.isFinite(o.y)) { const px = Math.max(-R, Math.min(R, o.x * k)), py = -Math.max(-R, Math.min(R, o.y * k)); x.fillStyle = col; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); }
    else { const a = (o.bearingDeg - 90) * Math.PI / 180; x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.arc(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10), 8, 0, 7); x.stroke(); } // sin distancia: en el borde y hueco
  }
  x.restore();
}
function srStart() { SR.on = true; $('#srBox').hidden = false; $('#srEvery').textContent = `${SR.everyS} s`; $('#srTxt').textContent = 'Primera lectura…'; SR.last = null; srTick(); if (!st.camObjs) hint('Radar 360: la cámara del móvil mira hacia delante; para ver detrás, conecta el SENDA Radar por USB y di dónde va montado.'); }
function srStop() { SR.on = false; clearTimeout(SR.timer); $('#srBox').hidden = true; SR.usbStop?.(); SR.usbStop = null; }
function srFeedFactory() { const parser = createFrameParser((raw) => { try { SR.mm = { t: Date.now(), targets: cleanTargets(raw, SR_FILTER) }; } catch { /* */ } }); return (bytes) => parser.push(bytes); }
async function srConnectUsb() {
  const where = prompt('¿Dónde va montado el SENDA Radar? Escribe: detras, delante, izquierda o derecha', SR.mount?.name ?? 'detras');
  const M = { detras: { yawDeg: 180, yM: -2 }, delante: { yawDeg: 0, yM: 2 }, izquierda: { yawDeg: -90, xM: -0.9 }, derecha: { yawDeg: 90, xM: 0.9 } }[String(where ?? '').trim().toLowerCase().replace('á', 'a')];
  if (!M) return hint('Montaje no reconocido: detras, delante, izquierda o derecha.');
  SR.mount = { ...M, name: where.trim().toLowerCase() }; LS.set('senda.sr.mount', SR.mount);
  const feed = srFeedFactory(), N = window.SendaNative, unb = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), b64o = (b) => btoa(String.fromCharCode(...b));
  if (typeof N?.usbList === 'function' && !('serial' in navigator)) {
    let devs = []; try { devs = JSON.parse(N.usbList() || '[]'); } catch { /* */ }
    if (!devs.length) return hint('No veo el radar por USB. Conéctalo con un cable OTG.');
    window.sendaUsbSerial = (b) => feed(unb(b)); window.sendaUsbStatus = (ev) => { if (ev?.event === 'open') for (const c of [RADAR_CMD.ENABLE_CONFIG, RADAR_CMD.MULTI_TARGET, RADAR_CMD.END_CONFIG]) N.usbWrite(b64o(c)); };
    SR.usbStop = () => { window.sendaUsbSerial = null; window.sendaUsbStatus = null; try { N.usbClose(); } catch { /* */ } };
    if (!N.usbOpen(devs[0].deviceId)) return hint('No se pudo abrir el radar USB.');
    return hint(`SENDA Radar conectado (${where.trim()}). Alcance 8 m, solo objetivos en movimiento.`);
  }
  if (!('serial' in navigator)) return hint('Este navegador no puede leer USB. Usa la app de Android o Chrome de escritorio.');
  try {
    const port = await navigator.serial.requestPort(); await port.open(RADAR_SERIAL); const w = port.writable.getWriter();
    for (const c of [RADAR_CMD.ENABLE_CONFIG, RADAR_CMD.MULTI_TARGET, RADAR_CMD.END_CONFIG]) { await w.write(c); await new Promise((r) => setTimeout(r, 50)); }
    const reader = port.readable.getReader(); let alive = true;
    SR.usbStop = async () => { alive = false; try { await reader.cancel(); } catch { /* */ } try { w.releaseLock(); reader.releaseLock(); await port.close(); } catch { /* */ } };
    (async () => { while (alive) { const { value, done } = await reader.read(); if (done) break; if (value) feed(value); } })().catch(() => {});
    hint(`SENDA Radar conectado (${where.trim()}).`);
  } catch (e) { hint('No se abrió el radar: ' + (e.message || e.name)); }
}
$('#srBtn')?.addEventListener('click', () => (SR.on ? srStop() : srStart()));
$('#srOff')?.addEventListener('click', srStop);
$('#srUsb')?.addEventListener('click', srConnectUsb);
$('#srEvery')?.addEventListener('click', () => { SR.everyS = SR.everyS === 15 ? 10 : 15; LS.set('senda.sr.every', SR.everyS); $('#srEvery').textContent = `${SR.everyS} s`; });


// ── Cámara con datos que importan, por modo de uso: coche, bici (móvil mirando atrás) o peatón ──
// + SENDA Radar mmWave superpuesto en la imagen: marca lo que se mueve aunque la cámara no lo vea (p. ej. tapado).
const CAM_MODES = { COCHE: 'Coche', BICI_ATRAS: 'Bici · mira atrás', PEATON: 'Peatón' };
const CAMI = { mode: LS.get('senda.cam.uso', 'COCHE'), ins: null, last: [], lastSum: null, said2s: 0, saidOv: 0, logT: 0 };
function camIns() {
  if (!CAMI.ins || CAMI.ins.mode !== CAMI.mode) { const g = LS.get('senda.drive.geom', null); CAMI.ins = createInsights({ windowS: 3, egoHalfWidthM: g?.egoWidthM ? g.egoWidthM / 2 : null, mode: CAMI.mode }); } // 3 s de historia: elección de diseño
  return CAMI.ins;
}
function drawInsights(x, W, H, objs, isDash = false) {
  const tS = performance.now() / 1000, ins = camIns(), list = ins.update(objs, tS, st.speed ?? null), sum = ins.summary(list, tS);
  CAMI.last = list; CAMI.lastSum = sum;
  const fs = Math.max(11, Math.round(W / (isDash ? 70 : 42)));
  x.save(); x.font = `700 ${fs}px system-ui`; x.textBaseline = 'top';
  const byId = new Map(objs.map((o) => [o.id, o]));
  for (const i of list) {
    const o = byId.get(i.id); if (!o?.box || i.kind === 'OTRO') continue;
    const lines = objectLine(i); if (lines.length < 2) continue; // la etiqueta básica ya la pinta el HUD: aquí solo lo que añade datos
    const bx = o.box.x * W, by = (o.box.y + o.box.h) * H + 3, wmax = Math.max(...lines.map((l) => x.measureText(l).width)) + 10;
    x.fillStyle = i.gapBelow2s || i.level === 'ROJO' ? 'rgba(255,59,48,.85)' : i.level === 'AMBAR' ? 'rgba(255,159,10,.85)' : 'rgba(0,0,0,.6)';
    x.fillRect(Math.min(bx, W - wmax - 2), by, wmax, lines.length * (fs + 3) + 4);
    x.fillStyle = '#fff'; lines.forEach((l, k) => x.fillText(l, Math.min(bx, W - wmax - 2) + 5, by + 3 + k * (fs + 3)));
  }
  // franja superior: lo más útil del modo
  const top = [];
  if (CAMI.mode === 'COCHE') {
    if (sum.lead?.gapS != null) top.push(`Delante: ${String(sum.lead.gapS).replace('.', ',')} s${sum.leadBelow2s ? ` · menos de ${RULE_2S.seconds} s (DGT)` : ' · bien'}`);
    if (sum.closeOvertakes) top.push(`${sum.closeOvertakes} adelantamiento(s) a ciclistas a menos de ${String(CYCLIST_CLEARANCE.meters).replace('.', ',')} m`);
  } else if (CAMI.mode === 'BICI_ATRAS') {
    top.push(`Adelantamientos: ${sum.overtakes.length}${sum.closeOvertakes ? ` · ${sum.closeOvertakes} a menos de 1,5 m` : ''}`);
    if (sum.nextArrival) top.push(`Viene ${objectLine(sum.nextArrival)[0]} · te alcanza en ${String(sum.nextArrival.ttcS).replace('.', ',')} s`);
  } else if (sum.nextArrival) top.push(`Se acerca ${objectLine(sum.nextArrival)[0]} · llega en ${String(sum.nextArrival.ttcS).replace('.', ',')} s (información, no una orden de cruzar)`);
  top.push(`${CAM_MODES[CAMI.mode]} · ${sum.now.vehicles} vehículos · ${sum.now.vulnerable} personas/bicis`);
  if (!userGeom()) top.push('Sin montaje declarado: sin metros ni velocidades');
  const tf = Math.max(12, Math.round(W / (isDash ? 60 : 36)));
  x.font = `800 ${tf}px system-ui`; const tw = Math.max(...top.map((l) => x.measureText(l).width)) + 16;
  x.fillStyle = sum.leadBelow2s ? 'rgba(255,59,48,.88)' : 'rgba(0,0,0,.62)'; const ty = isDash ? H * 0.24 : 6; x.fillRect(6, ty, Math.min(W - 12, tw), top.length * (tf + 4) + 8);
  x.fillStyle = '#fff'; top.forEach((l, k) => x.fillText(l, 14, ty + 5 + k * (tf + 4)));
  drawRadarOnCamera(x, W, H, list);
  x.restore();
  // voz con calma: distancia corta sostenida (coche) y adelantamientos cercanos (bici)
  const now = Date.now();
  if (CAMI.mode === 'COCHE' && sum.leadBelow2s && (st.speed ?? 0) > 14 && now - CAMI.said2s > 30000) { CAMI.said2s = now; say('Distancia corta: menos de dos segundos con el de delante'); }
  if (CAMI.mode === 'BICI_ATRAS' && sum.closeOvertakes > CAMI.saidOv) { CAMI.saidOv = sum.closeOvertakes; navigator.vibrate?.([120, 60, 120]); const o = sum.overtakes.at(-1); say(`Te han adelantado a ${String(o.clearanceM).replace('.', ',')} metros`); }
  if (now - CAMI.logT > 2000) { CAMI.logT = now; bbLog('insight', { mode: CAMI.mode, lead: sum.lead ? { d: sum.lead.distM, gapS: sum.lead.gapS, kmh: sum.lead.sameDirKmh } : null, n: sum.now, overtakes: sum.overtakes.length, close: sum.closeOvertakes }); }
}
/** Objetivos del SENDA Radar (montado mirando como la cámara) dibujados sobre la imagen; los que la cámara no ve se marcan. */
function drawRadarOnCamera(x, W, H, camList) {
  if (!(SR.mount && SR.mount.yawDeg === 0 && Date.now() - SR.mm.t < 2500)) return;
  const geom = userGeom() ?? DEFAULT_CAM_GEOM, half = (geom.fovHDeg / 2) * Math.PI / 180, f = (W / 2) / Math.tan(half);
  for (const t of fromMmwave(SR.mm.targets, { mount: { yawDeg: 0 } })) {
    const ang = t.bearingDeg * Math.PI / 180; if (Math.abs(ang) > half) continue;
    const u = W / 2 + Math.tan(ang) * f, p = project3DToScreen(t.x, Math.max(1, t.y), W, H, geom), v = p?.v ?? H * 0.7;
    const seen = camList.some((i) => i.distM != null && Math.abs(i.distM - t.distM) < 1.5 && Math.abs((i.lateralM ?? 0) - t.x) < 1.2);
    x.strokeStyle = '#ff9f0a'; x.lineWidth = 4; x.beginPath(); x.moveTo(u, v - 18); x.lineTo(u + 14, v); x.lineTo(u, v + 18); x.lineTo(u - 14, v); x.closePath(); x.stroke();
    const lab = `radar · ${String(t.distM).replace('.', ',')} m${seen ? '' : ' · solo radar (no se ve: tapado u oscuro)'}`;
    x.font = '700 13px system-ui'; const w = x.measureText(lab).width + 10; x.fillStyle = 'rgba(255,159,10,.9)'; x.fillRect(u - w / 2, v + 22, w, 19); x.fillStyle = '#000'; x.fillText(lab, u - w / 2 + 5, v + 25);
  }
}
document.querySelectorAll('#dash [data-uso]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation(); CAMI.mode = b.dataset.uso; LS.set('senda.cam.uso', CAMI.mode); CAMI.saidOv = 0;
  document.querySelectorAll('#dash [data-uso]').forEach((y) => y.classList.toggle('on', y === b));
  if (CAMI.mode === 'BICI_ATRAS') hint('Bici: pon el móvil mirando hacia atrás. Mide los adelantamientos y su separación lateral (mínimo legal 1,5 m, RGC art. 85.4). Declara en «Montaje» el ancho de tu manillar.');
  else if (CAMI.mode === 'PEATON') hint('Peatón: apunta a la calzada. Verás qué se acerca y en cuántos segundos llega. Es información: mira siempre antes de cruzar.');
  else hint('Coche: distancia con el de delante en segundos (regla de 2 s), velocidad de los demás y adelantamientos a ciclistas.');
}));
$('#dashRadar')?.addEventListener('click', (e) => { e.stopPropagation(); srConnectUsb(); });

document.querySelectorAll('#dash [data-uso]').forEach((y) => y.classList.toggle('on', y.dataset.uso === CAMI.mode));
$('#geomBtn')?.addEventListener('click', (e) => { e.stopPropagation(); askGeom(); CAMI.ins = null; });


// ── Rutas alternativas en colores, con los avisos conocidos de cada una (incidencias oficiales + avisos SENDA a ≤ 150 m) ──
const ALT_COLORS = ['#2b8cff', '#a259ff', '#ff9f0a'];
function routeHazards(rt) {
  const xs = rt.coords.map((c) => c[0]), ys = rt.coords.map((c) => c[1]), pad = 0.01, bb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const pts = [...(activeIncidents() ?? []).filter((i) => i.lat != null).map((i) => [i.lon, i.lat]), ...reports().map((x) => [x.lon, x.lat])].filter((p) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3]);
  return pts.filter((p) => distToRoute(rt, p) <= 150).length; // 150 m: margen de diseño para «en esta carretera»
}
function drawAlts() {
  const alts = st.alts ?? [];
  if (st.map && !st.map.getSource('route-alts')) {
    st.map.addSource('route-alts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    st.map.addLayer({ id: 'route-alts', type: 'line', source: 'route-alts', paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.55 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }, st.map.getLayer('route-casing') ? 'route-casing' : undefined);
  }
  st.map?.getSource('route-alts')?.setData({ type: 'FeatureCollection', features: alts.map((a, i) => ({ type: 'Feature', properties: { color: ALT_COLORS[i] }, geometry: { type: 'LineString', coordinates: a.coords } })).filter((_, i) => i !== st.altIdx) });
  const box = $('#altsRow'); if (!box) return;
  box.hidden = alts.length < 2;
  box.innerHTML = alts.map((a, i) => { const n = routeHazards(a); return `<button data-alt="${i}" class="${i === st.altIdx ? 'on' : ''}"><i style="background:${ALT_COLORS[i]}"></i>${Math.round(a.durationS / 60)} min · ${fmtDist(a.distanceM)}<small>${n ? `${n} aviso${n > 1 ? 's' : ''}` : 'sin avisos conocidos'}</small></button>`; }).join('');
}
$('#altsRow')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-alt]'); if (!b || !st.alts) return;
  const i = +b.dataset.alt, r = st.alts[i]; if (!r) return;
  st.altIdx = i; st.route = r; st.said = new Set();
  st.map?.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords } });
  st.map?.setPaintProperty('route', 'line-color', ALT_COLORS[i]);
  $('#etaTime').textContent = new Date(Date.now() + r.durationS * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('#etaInfo').textContent = `${Math.round(r.durationS / 60)} min · ${fmtDist(r.distanceM)} · ${st.dest?.name ?? ''}`;
  drawAlts(); guide(); updateCorridor();
});
