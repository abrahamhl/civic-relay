// SENDA · Conducir (estilo navegador): mapa a pantalla completa, búsqueda, ruta giro a giro, avisos con
// colores e iconos, incidencias y cámaras DGT, cámara con IA en miniatura y entrega a Waze o Google Maps.
// Red: OpenFreeMap (mapa), OSRM de FOSSGIS (rutas, pruebas), Nominatim (búsqueda, ≤1/s). Sin red: radar.
import { createTracker, topAlert } from './core/drive-hazard.mjs';
import { interpretAlternatives } from './core/voice-report.mjs';
import { REPORT_KINDS } from './core/road-guard.mjs';
import { parseDatex2 } from './core/datex2.mjs';
import { wazeUrl, googleMapsUrl } from './core/route-planner.mjs';
import { routeUrl, parseRoute, nextManeuver, shouldReroute, announcement } from './core/nav-osrm.mjs';
import { CATEGORIES, FROM_REPORT, fromDatex, markerSvg } from './core/report-style.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const say = (t) => { try { speechSynthesis.cancel(); speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: 'es-ES' })); } catch { /* sin voz */ } };
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
const reports = () => LS.get('senda.ruta.reports', []);

const st = { pos: null, speed: null, heading: 0, follow: true, map: null, mapOk: false, route: null, dest: null, said: new Set(), lastRouteS: -1e9, incidents: [], incSource: '', cams: [], me: null };

// ── Mapa (OpenFreeMap). Si no carga en 10 s (sin red, versión base), se usa el radar. ──
function initMap() {
  if (!window.maplibregl) return offline('No se pudo cargar el mapa.');
  maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
  const map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-3.7038, 40.4168], zoom: 12, attributionControl: { compact: true } });
  st.map = map;
  const t = setTimeout(() => { if (!st.mapOk) offline('Sin conexión al mapa: se muestra el radar. El mapa completo necesita Internet (versión play o navegador).'); }, 10000);
  map.on('load', () => {
    st.mapOk = true; clearTimeout(t);
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#0b5394', 'line-width': 11 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#2b8cff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    if (st.lastFix) onPos(st.lastFix); // la primera posición pudo llegar antes de que cargara el mapa
    drawMarkers();
  });
  map.on('dragstart', () => { st.follow = false; });
  let mv; map.on('moveend', () => { clearTimeout(mv); mv = setTimeout(drawMarkers, 300); });
}
function offline(msg) { $('#map').hidden = true; $('#radarWrap').hidden = false; $('#offmsg').textContent = msg; drawRadar(); }

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
  for (const i of st.incidents) if (i.lat != null && inView(i.lon, i.lat)) {
    const cat = fromDatex(i);
    markers.push(marker(i.lon, i.lat, cat, `<b>${esc(CATEGORIES[cat].label)}</b> · ${esc(i.road ?? '')}<br><small>DGT: ${esc(i.type)} / ${esc(i.cause ?? '')}<br>${esc(st.incSource)}</small>`));
  }
  if (st.map.getZoom() >= 10) for (const c of st.cams) if (inView(c.lon, c.lat))
    markers.push(marker(c.lon, c.lat, 'CAMARA', `<b>Cámara DGT</b> · ${esc(c.carretera)} ${esc(c.destino ?? '')}<br><img src="${esc(c.url)}" alt="Imagen de la cámara" style="width:100%;border-radius:8px;margin-top:6px"><small>DGT, CC BY · imagen en vivo si hay red</small>`));
  for (const r of reports()) if (inView(r.lon, r.lat)) {
    const cat = FROM_REPORT[r.kind] ?? 'PELIGRO';
    markers.push(marker(r.lon, r.lat, cat, `<b>${esc(REPORT_KINDS[r.kind]?.label ?? r.kind)}</b><br><small>Aviso de SENDA · ${new Date(r.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${r.verified ? 'visto con cámara' : 'sin verificar'}</small>`));
  }
}

// ── Incidencias DGT: en vivo (app play, la parte nativa las descarga de nap.dgt.es) o copia con su fecha ──
async function loadIncidents() {
  try { const r = await fetch('/senda/live/dgt-incidencias.xml', { cache: 'no-store' }); if (r.ok) { st.incidents = parseDatex2(await r.text()); st.incSource = `DGT en vivo ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; return drawMarkers(); } } catch { /* copia */ }
  try { const d = await (await fetch('/senda/data/referencias/dgt_incidencias.json')).json(); st.incidents = Object.values(d).find(Array.isArray) ?? []; st.incSource = `DGT, copia del ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`; } catch { st.incSource = 'sin incidencias'; }
  drawMarkers();
}
fetch('/senda/data/referencias/dgt_camaras.json').then((r) => r.json()).then((d) => { st.cams = d.camaras; drawMarkers(); }).catch(() => {});

// ── GPS, seguimiento y navegación ──
function onPos(p) {
  st.lastFix = p;
  st.pos = [p.coords.longitude, p.coords.latitude]; st.speed = p.coords.speed;
  if (p.coords.heading != null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 1) st.heading = p.coords.heading;
  $('#speed').innerHTML = `<div>${st.speed == null ? '–' : Math.round(st.speed * 3.6)}<small>km/h</small></div>`;
  if (st.mapOk) {
    if (!st.me) { const el = document.createElement('div'); el.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M12 4 6 19l6-3 6 3z" fill="#2b8cff"/></svg>'; st.me = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat(st.pos).addTo(st.map); st.map.jumpTo({ center: st.pos, zoom: 15 }); }
    st.me.setLngLat(st.pos).setRotation(st.heading);
    if (st.follow) st.map.easeTo({ center: st.pos, bearing: st.route ? st.heading : st.map.getBearing(), pitch: st.route ? 45 : 0, duration: 800 });
  } else drawRadar();
  if (st.route) guide();
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
    guide();
  } catch { hint('Sin conexión al servicio de rutas. Abre el destino en Waze o Google Maps.'); $('#etaTime').textContent = dest.name; $('#etaInfo').textContent = ''; }
}
function endNav() { st.route = null; st.dest = null; $('#turn').hidden = true; $('#etaBox').hidden = true; $('#searchBox').hidden = false; st.map?.getSource('route')?.setData({ type: 'FeatureCollection', features: [] }); st.map?.easeTo({ pitch: 0, bearing: 0 }); hint('Busca un destino o toca Casa/Trabajo.'); }
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
  drawMarkers(); say(`Aviso de ${REPORT_KINDS[kind].label} guardado`); hint(`Aviso «${REPORT_KINDS[kind].label}» guardado en tu posición. Viaja a otros móviles SENDA por Bluetooth o paquete.`);
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

// ── Cámara con IA en miniatura (toca para ampliar). Análisis 4/s; se apaga al salir. ──
const MP = '/senda/vendor/mediapipe-tasks-vision-1.2.3';
const ES = { car: 'coche', truck: 'camión', bus: 'autobús', motorcycle: 'moto', bicycle: 'bici', person: 'persona', dog: 'perro', horse: 'caballo', cow: 'vaca', sheep: 'oveja' };
const COLOR = { VERDE: '#34c759', AMBAR: '#ffcc00', ROJO: '#ff3b30' };
let det = null, stream = null, tracker = null, camOn = false, lastT = 0; const saidAdas = new Map();
$('#camBtn').addEventListener('click', async () => {
  if (camOn) return camStop();
  try {
    if (!det) { const vision = await import(MP + '/vision_bundle.mjs'); const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
      det = await vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: '/senda/vendor/models/efficientdet_lite0_int8.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: 0.4, maxResults: 8 }); }
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    $('#v').srcObject = stream; await $('#v').play(); try { await navigator.wakeLock?.request('screen'); } catch { /* */ }
    camOn = true; tracker = createTracker(); $('#pip').hidden = false; $('#camBtn').classList.add('on'); requestAnimationFrame(tick);
  } catch (e) { hint('Cámara no disponible: ' + (e.message || e.name)); }
});
$('#pip').addEventListener('click', () => $('#pip').classList.toggle('big'));
function camStop() { camOn = false; stream?.getTracks().forEach((t) => t.stop()); stream = null; $('#pip').hidden = true; $('#adas').hidden = true; $('#camBtn').classList.remove('on'); }
document.addEventListener('visibilitychange', () => { if (document.hidden && camOn) camStop(); });
function tick(now) {
  if (!camOn) return;
  if (now - lastT >= 250) { lastT = now; analyse(now); }
  requestAnimationFrame(tick);
}
function analyse(now) {
  const v = $('#v'); if (!v.videoWidth) return;
  const W = v.videoWidth, H = v.videoHeight, r = det.detectForVideo(v, now);
  const objs = tracker.update(r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H })), now / 1000);
  const c = $('#ov'), box = c.getBoundingClientRect(), dpr = devicePixelRatio || 1; c.width = box.width * dpr; c.height = box.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const s = Math.max(box.width / W, box.height / H), ox = (box.width - W * s) / 2, oy = (box.height - H * s) / 2;
  for (const o of objs) { const bx = ox + o.box.x * W * s, by = oy + o.box.y * H * s, bw = o.box.w * W * s, bh = o.box.h * H * s;
    if (o.label === 'person') { x.fillStyle = 'rgba(0,0,0,.85)'; x.fillRect(bx, by, bw, bh); }
    x.strokeStyle = COLOR[o.level]; x.lineWidth = o.level === 'VERDE' ? 2 : 4; x.strokeRect(bx, by, bw, bh); }
  const top = topAlert(objs), a = $('#adas');
  if (!top) { a.hidden = true; return; }
  a.hidden = false; a.className = top.level;
  a.textContent = `${ES[top.label] ?? top.label} ${top.zone === 'TU_CARRIL' ? 'delante' : top.zone === 'DERECHA' ? 'a la derecha' : 'a la izquierda'}: ${top.reasons.join(' · ')}`;
  const key = top.id + top.level; if (Date.now() - (saidAdas.get(key) ?? 0) > 6000) { saidAdas.set(key, Date.now()); if (top.level === 'ROJO') { navigator.vibrate?.([200, 100, 200]); say(`Cuidado, ${ES[top.label] ?? 'vehículo'} delante`); } else if (top.reasons.some((rr) => rr.startsWith('se mete'))) say(`${ES[top.label] ?? 'vehículo'} ${top.reasons.find((rr) => rr.startsWith('se mete'))}`); }
}

// ── Radar sin red (avisos, cámaras e incidencias en 5 km; la marcha hacia arriba) ──
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
    for (const i of st.incidents) if (i.lat != null) plot(i.lon, i.lat, CATEGORIES[fromDatex(i)].color, 10);
    for (const r of reports()) plot(r.lon, r.lat, CATEGORIES[FROM_REPORT[r.kind] ?? 'PELIGRO'].color, 12);
  }
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -22); x.lineTo(15, 17); x.lineTo(0, 8); x.lineTo(-15, 17); x.closePath(); x.fill(); x.restore();
}

// La tarjeta de abajo cambia de alto (llegada, avisos): los botones flotantes se colocan siempre encima.
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--bottomH', `${Math.ceil(e.target.getBoundingClientRect().height)}px`)).observe($('#bottom'));

initMap();
loadIncidents();
setInterval(() => { if (!document.hidden) loadIncidents(); }, 5 * 60 * 1000);
// Para pruebas automáticas
globalThis.sendaDrive = { st, goTo, onPos };
