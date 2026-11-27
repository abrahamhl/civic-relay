/**
 * SENDA · Alrededor: cámara + capas de datos reales + dispositivos seleccionables.
 * Núcleo probado: core/ar-view.mjs. Sin datos inventados: cada punto sale de un conjunto con fuente y licencia.
 */
import { normalizeDatasets, rankNearby, project, declutter, describePosition, deviceCards, LAYERS } from './core/ar-view.mjs';
import { REPORT_KINDS } from './core/road-guard.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const st = { pos: null, acc: null, heading: null, headSrc: null, pitch: 0, points: [], near: [], layers: new Set(['INCIDENT', 'SENDA', 'RADAR', 'CAMERA']), range: 5000, tab: 'near', sel: null, devs: [], devHist: new Map(), scanAt: null, loaded: false };

async function loadData() {
  const get = (f) => fetch(`/senda/data/referencias/${f}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [cameras, dgtIncidents, ndwIncidents, dgtRadars, nlRadars] = await Promise.all(['camaras_publicas.json', 'dgt_incidencias.json', 'nl_ndw_incidencias.json', 'dgt_radares_oficiales.json', 'nl_radares_oficiales.json'].map(get));
  let rep = []; try { rep = JSON.parse(localStorage.getItem('senda.ruta.reports')) ?? []; } catch { /* sin avisos */ }
  const sendaReports = rep.map((r) => ({ ...r, kindLabel: REPORT_KINDS[r.kind]?.label ?? r.kind }));
  st.points = normalizeDatasets({ cameras, dgtIncidents, ndwIncidents, dgtRadars, nlRadars, sendaReports });
  st.loaded = true; refresh();
}

function refresh() {
  if (!st.pos) { paintList(); return; }
  st.near = rankNearby(st.points.filter((p) => st.layers.has(p.layer)), st.pos, { maxM: st.range, limit: 40 });
  paintOverlay(); paintList();
  if (st.sel?.layer) { const s = st.near.find((p) => p.id === st.sel.id); if (s) showCard(s); }
}

function paintOverlay() {
  const ovl = $('#ovl'); ovl.querySelectorAll('.mk').forEach((n) => n.remove());
  // Zona útil: entre la cabecera y la lista de abajo (nada queda tapado ni sin poder tocarse).
  ovl.style.top = `${$('header').offsetHeight}px`; ovl.style.bottom = `${$('#sheet').offsetHeight}px`;
  const w = ovl.clientWidth, h = ovl.clientHeight;
  if (st.heading == null) { $('#horizon').hidden = true; return; }
  const placed = declutter(project(st.near.slice(0, 18), { headingDeg: st.heading, pitchDeg: st.pitch, w, h, maxM: st.range }));
  const hz = $('#horizon'); hz.hidden = false; hz.style.top = `${Math.max(0, Math.min(h, h / 2 + (st.pitch / 25) * (h / 2)))}px`;
  for (const p of placed) {
    const b = document.createElement('button');
    b.className = `mk ${p.layer}${p.inView ? '' : ' edge'}${st.sel?.id === p.id ? ' sel' : ''}`;
    b.style.left = `${p.x}px`; b.style.top = `${p.y}px`;
    const d = p.distM < 1000 ? `${Math.round(p.distM / 10) * 10} m` : `${(p.distM / 1000).toFixed(1)} km`;
    b.innerHTML = p.inView ? `${LAYERS[p.layer].icon}<span class="t">${esc(p.title)}</span><small>${d}</small>` : `${p.rel < 0 ? '◀' : '▶'} ${LAYERS[p.layer].icon}`;
    b.setAttribute('aria-label', `${LAYERS[p.layer].label}: ${p.title}, ${d}`);
    b.addEventListener('click', () => { st.sel = p; showCard(p); paintOverlay(); });
    ovl.appendChild(b);
  }
}

function paintList() {
  const ul = $('#list');
  if (st.tab === 'near') {
    $('#note').textContent = !st.loaded ? 'Cargando datos oficiales…' : !st.pos ? 'Esperando tu posición GPS…' : `${st.near.length} cosas en ${st.range / 1000} km, de más a menos importante. Toca una para ver su ficha.`;
    ul.innerHTML = st.near.map((p, i) => `<li><button data-i="${i}">${LAYERS[p.layer].icon}<span><b>${esc(p.title)}</b><br><span class="s">${esc(LAYERS[p.layer].label)}${p.sub ? ' · ' + esc(p.sub) : ''}</span></span><span class="d">${p.distM < 1000 ? Math.round(p.distM) + ' m' : (p.distM / 1000).toFixed(1) + ' km'}</span></button></li>`).join('');
    ul.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { st.sel = st.near[+b.dataset.i]; showCard(st.sel); paintOverlay(); }));
  } else {
    const native = typeof window.SendaNative?.radioScan === 'function';
    $('#note').textContent = !native ? 'Los dispositivos de radio solo se ven en la app de Android (un navegador no puede leer Wi-Fi ni Bluetooth).' : st.scanAt ? `${st.devs.length} dispositivos · barrido de hace ${Math.round((Date.now() - st.scanAt) / 1000)} s · sin nombres ni direcciones MAC.` : 'Escuchando radios…';
    ul.innerHTML = st.devs.map((d, i) => `<li><button data-i="${i}">${d.kind === 'SENDA' ? '📲' : d.kind === 'WIFI' ? (d.open ? '🟢' : '🔒') : '🔵'}<span><b>${esc(d.title)}</b><br><span class="s">${esc(d.intensity.label)}${d.kind === 'WIFI' ? (d.open ? ' · red abierta' : ' · protegida') : ''}</span></span><span class="d">${d.rssi} dBm</span></button></li>`).join('');
    ul.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { st.sel = st.devs[+b.dataset.i]; showCard(st.sel); }));
  }
}

function showCard(p) {
  const c = $('#card'); c.hidden = false;
  if (p.layer) {
    const img = p.img ? `<img alt="Imagen en directo de ${esc(p.title)}" src="${esc(p.img)}${p.img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}">` : '';
    c.innerHTML = `<button class="close" aria-label="Cerrar ficha">✕</button><h2>${LAYERS[p.layer].icon} ${esc(p.title)}</h2><div class="fine">${esc(LAYERS[p.layer].label)}</div>
      <dl><dt>Dónde</dt><dd>${esc(st.heading != null ? describePosition(p, st.heading) : `${Math.round(p.distM)} m (sin brújula: dirección no disponible)`)}</dd>
      ${p.sub ? `<dt>Detalle</dt><dd>${esc(p.sub)}</dd>` : ''}${p.at ? `<dt>Desde</dt><dd>${esc(new Date(p.at).toLocaleString())}</dd>` : ''}
      <dt>Fuente</dt><dd>${esc(p.src)}</dd>${p.license ? `<dt>Licencia</dt><dd>${esc(p.license)}</dd>` : ''}
      ${p.layer === 'INCIDENT' ? '<dt>Atención</dt><dd>Dato del momento de la descarga del conjunto; puede haber cambiado.</dd>' : ''}</dl>${img}`;
  } else {
    c.innerHTML = `<button class="close" aria-label="Cerrar ficha">✕</button><h2>${p.kind === 'SENDA' ? '📲' : p.kind === 'WIFI' ? '📶' : '🔵'} ${esc(p.title)}</h2>
      <dl><dt>Señal</dt><dd>${p.rssi} dBm · ${esc(p.intensity.label)}</dd>${p.band ? `<dt>Banda</dt><dd>${esc(p.band)} GHz</dd>` : ''}
      <dt>Tendencia</dt><dd>${esc(p.trend)} (${p.samples} barrido${p.samples > 1 ? 's' : ''})</dd>
      <dt>Visto</dt><dd>desde ${new Date(p.first).toLocaleTimeString()} · último ${new Date(p.last).toLocaleTimeString()}</dd>
      <dt>Uso</dt><dd>${esc(p.gateway)}</dd>
      <dt>Dirección</dt><dd>Android no la da: solo intensidad. Sin nombre de red ni MAC (identificador efímero de esta sesión).</dd></dl>`;
  }
  c.querySelector('.close').addEventListener('click', () => { c.hidden = true; st.sel = null; paintOverlay(); });
}

function paintPose() {
  $('#pose').textContent = `${st.pos ? `GPS ±${Math.round(st.acc ?? 0)} m` : 'sin GPS'} · ${st.heading != null ? `rumbo ${Math.round(st.heading)}° (${st.headSrc})` : 'sin brújula'} · inclinación ${Math.round(st.pitch)}°`;
}

/* ---------- sensores ---------- */
let lastPaint = 0;
function onOrient(e) {
  let hd = null;
  if (Number.isFinite(e.webkitCompassHeading)) hd = e.webkitCompassHeading;
  else if (e.absolute && Number.isFinite(e.alpha)) hd = (360 - e.alpha) % 360;
  if (hd != null) { st.heading = hd; st.headSrc = 'brújula'; }
  if (Number.isFinite(e.beta)) st.pitch = Math.max(-60, Math.min(60, e.beta - 90));
  const t = performance.now(); if (t - lastPaint > 120) { lastPaint = t; paintPose(); paintOverlay(); }
}
async function start() {
  $('#start').hidden = true;
  try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); $('#cam').srcObject = s; } catch { $('#note').textContent = 'Sin cámara (permiso denegado o no disponible): se muestran las capas sobre fondo oscuro.'; }
  try { if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch { /* iOS: sin permiso no hay brújula */ }
  addEventListener('deviceorientationabsolute', onOrient); addEventListener('deviceorientation', onOrient);
  navigator.geolocation?.watchPosition((p) => {
    st.pos = { lat: p.coords.latitude, lon: p.coords.longitude }; st.acc = p.coords.accuracy;
    if (st.headSrc !== 'brújula' && Number.isFinite(p.coords.heading) && p.coords.speed > 2) { st.heading = p.coords.heading; st.headSrc = 'GPS en marcha'; }
    paintPose(); refresh();
  }, () => { $('#note').textContent = 'Sin permiso de ubicación: no se puede colocar nada alrededor.'; }, { enableHighAccuracy: true, maximumAge: 5000 });
  scanRadios(); setInterval(scanRadios, 15_000);
}

/* ---------- radios (APK) ---------- */
function scanRadios() { if (typeof window.SendaNative?.radioScan === 'function') window.SendaNative.radioScan(); }
const prevRadio = window.sendaRadio;
window.sendaRadio = (scan) => { prevRadio?.(scan); st.devs = deviceCards(scan, st.devHist); st.scanAt = Date.now(); if (st.tab === 'dev') paintList(); };

/* ---------- interfaz ---------- */
$('#go').addEventListener('click', start);
document.querySelectorAll('[data-layer]').forEach((i) => i.addEventListener('change', () => { i.checked ? st.layers.add(i.dataset.layer) : st.layers.delete(i.dataset.layer); refresh(); }));
$('#range').addEventListener('change', (e) => { st.range = +e.target.value; refresh(); });
for (const [id, tab] of [['#tabNear', 'near'], ['#tabDev', 'dev']]) $(id).addEventListener('click', () => { st.tab = tab; $('#tabNear').setAttribute('aria-selected', String(tab === 'near')); $('#tabDev').setAttribute('aria-selected', String(tab === 'dev')); paintList(); });
addEventListener('resize', () => paintOverlay());
loadData();

/* Ganchos para pruebas automáticas (sin efecto para el usuario). */
window.SENDA_ALREDEDOR = {
  setPose: ({ lat, lon, heading, pitch = 0, acc = 5 }) => { st.pos = { lat, lon }; st.acc = acc; st.heading = heading; st.headSrc = 'prueba'; st.pitch = pitch; paintPose(); refresh(); },
  scan: (s) => window.sendaRadio(s),
  state: () => ({ loaded: st.loaded, points: st.points.length, near: st.near.map((p) => ({ id: p.id, layer: p.layer, distM: Math.round(p.distM) })), devs: st.devs.length, markers: document.querySelectorAll('.mk').length }),
  start,
};
