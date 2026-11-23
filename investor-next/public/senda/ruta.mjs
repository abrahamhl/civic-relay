// Ruta SENDA: mapa de calles reales (OSM), rutas moldeables, avisos y cámaras de la DGT por el camino.
import { buildGraph, alternatives, nearRoute, googleMapsUrl, wazeUrl, LIMITS } from './core/route-planner.mjs';
import { REPORT_KINDS } from './core/road-guard.mjs';
import { interpretAlternatives } from './core/voice-report.mjs';
import { verifyReport } from './core/hazard-verify.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`);
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem('senda.ruta.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('senda.ruta.' + k, JSON.stringify(v)); } catch { /* */ } } };

const [area, camsData] = await Promise.all([
  fetch('/senda/data/aislamiento/dana_horta_sud.json').then((r) => r.json()),
  fetch('/senda/data/referencias/dgt_camaras.json').then((r) => r.json()).catch(() => null),
]);
const net = area.red, water = area.agua.anillos;
const graphs = {};
const graph = (m) => (graphs[m] ??= buildGraph(net, m));

const st = { tool: 'from', mode: 'car', from: null, to: null, via: [], polys: [], drawing: null, reports: LS.get('reports', []), kind: 'parado', routes: [], sel: 0 };

// ── Mapa (proyección equirectangular local sobre el recuadro de la zona) ──
const cv = $('#map'), ctx = cv.getContext('2d');
const [W0, S0, E0, N0] = area.bbox;
const kx = Math.cos(((S0 + N0) / 2) * Math.PI / 180);
let view = { cx: (W0 + E0) / 2, cy: (S0 + N0) / 2, scale: 1 };
function size() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); return r; }
let box = size();
const base = () => Math.min(box.width / ((E0 - W0) * kx), box.height / (N0 - S0));
const toPx = ([lon, lat]) => [box.width / 2 + (lon - view.cx) * kx * base() * view.scale, box.height / 2 - (lat - view.cy) * base() * view.scale];
const toLL = (x, y) => [view.cx + (x - box.width / 2) / (kx * base() * view.scale), view.cy - (y - box.height / 2) / (base() * view.scale)];

const ROAD_W = { motorway: 2.2, trunk: 2, primary: 1.8, secondary: 1.5, tertiary: 1.3 };
function draw() {
  ctx.clearRect(0, 0, box.width, box.height);
  {
    ctx.fillStyle = 'rgba(10,132,255,.28)';
    for (const ring of water) { ctx.beginPath(); ring.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.fill(); }
  }
  for (const w of net.ways) {
    ctx.strokeStyle = ROAD_W[w.hw.replace('_link', '')] ? 'rgba(235,235,245,.42)' : 'rgba(235,235,245,.16)';
    ctx.lineWidth = (ROAD_W[w.hw.replace('_link', '')] || 0.7) * Math.min(2, Math.max(1, view.scale / 2));
    ctx.beginPath(); w.n.forEach((id, i) => { const [x, y] = toPx(net.coords[id]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  }
  for (const poly of [...st.polys, ...(st.drawing ? [st.drawing] : [])]) {
    ctx.fillStyle = 'rgba(251,191,36,.25)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath(); poly.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  st.routes.forEach((r, i) => {
    if (i === st.sel) return;
    line(r.coords, 'rgba(145,215,232,.55)', 4);
  });
  if (st.routes[st.sel]) line(st.routes[st.sel].coords, '#ff7756', 5);
  for (const r of st.reports) dot([r.lon, r.lat], '#ff5b6e', 7, '!');
  st.via.forEach((p, i) => dot(p, '#fbbf24', 8, String(i + 1)));
  if (st.from) dot(st.from, '#34d399', 9, 'A');
  if (st.to) dot(st.to, '#ff7756', 9, 'B');
}
function line(coords, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath(); coords.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
function dot(p, color, r, label) { const [x, y] = toPx(p); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = '600 10px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 0.5); }

// ── Herramientas ──
const HINT = { from: 'Toca el mapa para poner el origen.', to: 'Toca el mapa para poner el destino.', via: 'Toca una calle por la que quieras pasar. Puedes poner varias.', avoid: 'Dibuja con el dedo la zona que quieres evitar.', report: 'Elige el tipo de aviso y toca dónde está.', pan: 'Arrastra para mover el mapa.' };
function setTool(t) { st.tool = t; document.querySelectorAll('#tool button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); $('#hint').textContent = HINT[t]; $('#kinds').hidden = t !== 'report'; }
document.querySelectorAll('#tool button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.t)));
$('#kinds').innerHTML = Object.entries(REPORT_KINDS).map(([k, v]) => `<button data-k="${esc(k)}"${k === st.kind ? ' class="on"' : ''}>${esc(v.label)}</button>`).join('');
$('#kinds').addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; st.kind = k; document.querySelectorAll('#kinds button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); });
document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.m; document.querySelectorAll('#mode button').forEach((x) => x.classList.toggle('on', x === b)); plan(); }));
['avoidWater', 'avoidReports'].forEach((id) => $('#' + id).addEventListener('change', plan));
$('#clearAvoid').addEventListener('click', () => { st.polys = []; st.via = []; plan(); });
$('#zin').addEventListener('click', () => { view.scale = Math.min(40, view.scale * 1.6); draw(); });
$('#zout').addEventListener('click', () => { view.scale = Math.max(1, view.scale / 1.6); draw(); });

let drag = null;
const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  const [x, y] = pos(e);
  if (st.tool === 'pan') drag = { x, y, cx: view.cx, cy: view.cy };
  else if (st.tool === 'avoid') st.drawing = [toLL(x, y)];
  else drag = { x, y, tap: true };
});
cv.addEventListener('pointermove', (e) => {
  const [x, y] = pos(e);
  if (st.tool === 'pan' && drag) { view.cx = drag.cx - (x - drag.x) / (kx * base() * view.scale); view.cy = drag.cy + (y - drag.y) / (base() * view.scale); draw(); }
  else if (st.drawing) { st.drawing.push(toLL(x, y)); draw(); }
});
cv.addEventListener('pointerup', (e) => {
  const [x, y] = pos(e);
  if (st.drawing) { if (st.drawing.length > 4) st.polys.push(st.drawing); st.drawing = null; plan(); return; }
  if (drag?.tap && Math.hypot(x - drag.x, y - drag.y) < 12) {
    const p = toLL(x, y);
    if (st.tool === 'from') { st.from = p; setTool('to'); }
    else if (st.tool === 'to') { st.to = p; setTool('via'); }
    else if (st.tool === 'via') st.via.push(p);
    else if (st.tool === 'report') { st.reports.push({ kind: st.kind, lon: p[0], lat: p[1], t: Date.now(), own: true }); LS.set('reports', st.reports); }
    plan();
// Para pruebas automáticas: posición en pantalla de un punto de la ruta elegida.
globalThis.sendaRuta = { st, toPx };
  }
  drag = null;
});
addEventListener('resize', () => { box = size(); draw(); });

// ── Cálculo ──
function plan() {
  st.routes = []; st.sel = 0;
  if (st.from && st.to) {
    const avoid = { polygons: [...st.polys, ...($('#avoidWater').checked ? water : [])], points: $('#avoidReports').checked ? st.reports.map((r) => ({ lon: r.lon, lat: r.lat, rM: 80 })) : [] };
    const res = alternatives(graph(st.mode), { from: st.from, to: st.to, via: st.via, avoid }, 3);
    st.routes = res.filter((r) => r.ok);
    if (!st.routes.length) st.fail = res[0]?.reason; else st.fail = null;
  }
  renderList(); draw();
}
const FAIL = { SIN_CAMINO: 'No hay camino que cumpla todo lo que pides. Si «Agua observada» está activado, puede que el agua deje esta zona aislada, como pasó en la DANA. Quita alguna zona evitada o algún punto de paso.', PUNTO_EN_ZONA_EVITADA: 'El origen, el destino o un punto de paso está dentro de una zona que pides evitar.', SIN_RED: 'No hay calles para este medio de transporte.' };
function renderList() {
  const box2 = $('#routes');
  if (!st.from || !st.to) { box2.innerHTML = '<div class="row"><span class="t"><small>Pon origen y destino en el mapa.</small></span></div>'; }
  else if (!st.routes.length) { box2.innerHTML = `<div class="row"><span class="t">No hay ruta<small style="white-space:normal">${esc(FAIL[st.fail] || '')}</small></span></div>`; }
  else box2.innerHTML = st.routes.map((r, i) => `<button class="row${i === st.sel ? ' sel' : ''}" data-i="${i}"><span class="sw" style="background:${i === st.sel ? 'var(--acc)' : 'var(--cielo)'}"></span><span class="t">${i ? 'Alternativa ' + i : 'Más corta'} · ${km(r.lengthM)}<small>${esc(r.streets.filter((s) => s.lengthM > 60).map((s) => s.name).filter((n, k, a) => n !== a[k - 1]).slice(0, 4).join(' → '))}</small></span></button>`).join('');
  const r = st.routes[st.sel];
  const g = r ? googleMapsUrl({ from: st.from, to: st.to, via: st.via, mode: st.mode }) : null;
  for (const [id, url] of [['#gmaps', g?.url], ['#waze', r ? wazeUrl({ to: st.to }).url : null]]) {
    const a = $(id);
    if (url) { a.href = url; a.removeAttribute('aria-disabled'); a.style.opacity = ''; a.style.pointerEvents = ''; }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.style.opacity = '.4'; a.style.pointerEvents = 'none'; }
  }
  $('#handoff').textContent = r ? `Google Maps recibe origen, destino y ${st.via.length} punto(s) de paso (en el navegador del móvil admite hasta ${g.mobileBrowserMaxVia}); recalcula con su propio tráfico. Waze solo recibe el destino: su enlace público no admite paradas intermedias.` : '';
  renderAlong();
}
$('#routes').addEventListener('click', (e) => { const i = e.target.closest('[data-i]')?.dataset.i; if (i == null) return; st.sel = Number(i); renderList(); draw(); });

function renderAlong() {
  const r = st.routes[st.sel];
  if (!r) { $('#along').innerHTML = '<div class="row"><span class="t"><small>Los avisos y las cámaras cercanas a la ruta aparecerán aquí.</small></span></div>'; $('#cams').innerHTML = ''; return; }
  const reps = nearRoute(r.coords, st.reports.map((x, i) => ({ ...x, idx: i })), 150);
  const cams = camsData ? nearRoute(r.coords, camsData.camaras, 2000).slice(0, 6) : [];
  const nearestCam = camsData && !cams.length ? nearRoute(r.coords, camsData.camaras, 50_000)[0] : null;
  $('#along').innerHTML = [
    ...reps.map((x) => `<div class="row"><span class="sw" style="background:var(--rosa)"></span><span class="t">${esc(REPORT_KINDS[x.kind]?.label || x.kind)}<small>A ${km(x.distM)} de la ruta · ${x.verified ? `visto con cámara: ${esc(x.verified.es || x.verified.verdict)}` : 'sin verificar'} · ${new Date(x.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></span><button class="btn" style="padding:8px 10px;font-size:13px" data-verify="${x.idx}">Verificar con cámara</button></div>`),
    `<div class="row"><span class="sw" style="background:var(--azul)"></span><span class="t">${cams.length} cámara(s) de la DGT a menos de 2 km<small>${cams.length ? 'Imagen en directo si hay conexión' : nearestCam ? `La más cercana está a ${km(nearestCam.distM)} (${esc(nearestCam.carretera)})` : 'Catálogo no disponible'}</small></span></div>`,
  ].join('');
  const show = cams.length ? cams : nearestCam ? [nearestCam] : [];
  $('#cams').innerHTML = show.map((c) => `<div class="cam"><img loading="lazy" alt="Cámara DGT ${esc(c.id)}" src="${esc(c.url)}"><div>${esc(c.carretera)} · ${esc(c.destino || '')}<br><small>a ${km(c.distM)} · DGT, CC BY</small></div></div>`).join('');
  $('#cams').querySelectorAll('img').forEach((img) => img.addEventListener('error', () => {
    const d = document.createElement('div');
    d.textContent = 'Sin conexión: imagen no disponible';
    d.style.cssText = 'aspect-ratio:4/3;display:grid;place-items:center;color:#888;padding:8px;text-align:center';
    img.replaceWith(d);
  }, { once: true }));
}

$('#truth').textContent = [
  `Calles: ${area.red.fuente}.`,
  `Agua: ${area.agua.fuente} (cartografía oficial de la DANA, no del día de hoy).`,
  camsData ? `Cámaras: ${camsData.fuente}; licencia ${camsData.licencia}. La imagen es la que publica la DGT en este momento.` : '',
  `Distancias medidas sobre las calles. Tiempo de viaje: ${LIMITS.travelTime}. Sentido único: ${LIMITS.oneway}.`,
  'Los avisos que pones aquí se guardan solo en este móvil y no están verificados por nadie.',
  `Zona disponible: l'Horta Sud (Valencia). Otras zonas necesitan su paquete de calles.`,
].filter(Boolean).join(' ');

// ── Verificar un aviso con la cámara (modelo en el móvil; la imagen no sale de aquí) ──
// Umbrales ELEGIDOS por la app y declarados (no calibrados con medidas): confianza 0,5 y 3 fotogramas coincidentes.
const VERIFY = { minScore: 0.5, minFrames: 3, seconds: 4 };
const MP = '/senda/vendor/mediapipe-tasks-vision-1.2.3';
let detector = null;
async function getDetector() {
  if (detector) return detector;
  const vision = await import(MP + '/vision_bundle.mjs');
  const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
  detector = await vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: '/senda/vendor/models/efficientdet_lite0_int8.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: 0.3, maxResults: 6 });
  return detector;
}
const GICON = { vehicle: '<path d="M3 14l2-6h14l2 6v4H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', animal: '<circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="4.5" cy="11" r="2"/><circle cx="19.5" cy="11" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5-2 3-4 3-4 0-4-3z"/>', object: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>', person: '<circle cx="12" cy="6" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>' };
const gIcon = (g, color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GICON[g] || GICON.object}</svg>`;
let camStream = null, camReport = null, camResult = null;
function closeCam() { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; $('#cam').hidden = true; }
$('#cam-close').addEventListener('click', closeCam);
$('#cam-ok').addEventListener('click', () => {
  if (camReport != null && camResult) { st.reports[camReport].verified = { verdict: camResult.verdict, es: camResult.es ?? null, t: Date.now() }; LS.set('reports', st.reports); renderAlong(); }
  closeCam();
});
async function verifyWithCamera(i) {
  const rep = st.reports[i]; camReport = i; camResult = null;
  $('#cam').hidden = false; $('#cam-ok').hidden = true; $('#cam-res').innerHTML = ''; $('#cam-msg').textContent = 'Cargando el reconocedor (en el móvil, sin red)…';
  try {
    const [det, stream] = await Promise.all([getDetector(), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })]);
    camStream = stream; const v = $('#cam-v'); v.srcObject = stream; await v.play();
    const c = $('#cam-c'), x = c.getContext('2d'); c.width = v.videoWidth; c.height = v.videoHeight;
    $('#cam-msg').textContent = `Mirando ${VERIFY.seconds} s… Las personas se tapan; la imagen no sale del móvil.`;
    const frames = [], t0 = performance.now();
    await new Promise((done) => { const tick = () => {
      if (!camStream) return done();
      const r = det.detectForVideo(v, performance.now());
      x.clearRect(0, 0, c.width, c.height);
      const dets = [];
      for (const d of r.detections) { const cat = d.categories[0], b = d.boundingBox; dets.push({ label: cat.categoryName, score: cat.score });
        if (cat.categoryName === 'person') { x.fillStyle = '#000'; x.fillRect(b.originX, b.originY, b.width, b.height); } // privacidad: se tapa
        else { x.strokeStyle = '#ff7756'; x.lineWidth = 4; x.strokeRect(b.originX, b.originY, b.width, b.height); } }
      frames.push(dets);
      if (performance.now() - t0 < VERIFY.seconds * 1000) requestAnimationFrame(tick); else done();
    }; requestAnimationFrame(tick); });
    camResult = verifyReport(rep.kind, frames, VERIFY);
    const color = camResult.verdict === 'COMPATIBLE' ? '#34d399' : camResult.verdict === 'NO_VISTO' ? '#ff5b6e' : '#93a7b1';
    const title = camResult.verdict === 'COMPATIBLE' ? `Visto: ${camResult.es}` : camResult.verdict === 'NO_VISTO' ? 'No se ha visto nada compatible' : 'No verificable con este modelo';
    $('#cam-res').innerHTML = `<div class="verdict">${gIcon(camResult.group || 'object', color)}<div><b>${esc(title)}</b><br><small class="sub">${esc(camResult.note || camResult.reason || `${camResult.frames ?? 0} de ${frames.length} fotogramas · umbral 0,5 y 3 fotogramas (elegido por la app, no calibrado)`)}</small></div></div>`;
    $('#cam-msg').textContent = 'Solo se guarda la etiqueta, nunca la imagen.';
    $('#cam-ok').hidden = camResult.verdict !== 'COMPATIBLE';
  } catch (err) { $('#cam-msg').textContent = 'No se pudo usar la cámara o el reconocedor: ' + (err.message || err.name); }
}
$('#along').addEventListener('click', (e) => { const i = e.target.closest('[data-verify]')?.dataset.verify; if (i != null) verifyWithCamera(Number(i)); });

// ── Aviso por voz ──
const ERRV = { NO_DISPONIBLE: 'Este móvil no tiene reconocimiento de voz.', PERMISO_DENEGADO: 'Sin permiso de micrófono.', ERROR_7: 'No se ha entendido nada. Prueba otra vez.', ERROR_6: 'No se oyó nada.', ERROR_2: 'Sin red y sin idioma español descargado: descarga el reconocimiento sin conexión en los ajustes de voz de Android.', ERROR_13: 'Falta el idioma español sin conexión en este móvil.' };
const vMsg = (t, cls = '') => { $('#voiceMsg').textContent = t; $('#voiceMsg').className = 'foot ' + cls; };
const here = () => new Promise((ok) => {
  if (!navigator.geolocation) return ok(null);
  navigator.geolocation.getCurrentPosition((p) => ok([p.coords.longitude, p.coords.latitude]), () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
});
async function handleSpoken(alternatives) {
  const r = interpretAlternatives(alternatives);
  if (!r.kind) { vMsg(`No he entendido «${r.text || ''}». Di qué hay: coche parado, accidente, animal, obras…`, 'ko'); return; }
  const side = r.side === 'CONTRARIO' ? ' (sentido contrario)' : r.side === 'MI_SENTIDO' ? ' (mi sentido)' : '';
  let p = await here(), where = 'tu posición';
  if (!p) { p = [view.cx, view.cy]; where = 'el centro del mapa (sin GPS)'; }
  if (!confirm(`¿Publicar aviso «${r.label}${side}» en ${where}?\n\nHas dicho: «${r.from || r.text}»`)) { vMsg('Aviso cancelado.'); return; }
  st.reports.push({ kind: r.kind, side: r.side, lon: p[0], lat: p[1], t: Date.now(), own: true, voice: true });
  LS.set('reports', st.reports); plan();
  vMsg(`Aviso guardado: ${r.label}${side}. Solo en este móvil, sin verificar.`, 'ok');
}
globalThis.sendaVoice = (res) => {
  if (res.state) { $('#voiceTxt').textContent = res.state === 'ESCUCHANDO' ? 'Escuchando… habla ahora' : 'Procesando…'; return; }
  $('#voice').classList.remove('on'); $('#voiceTxt').textContent = 'Aviso por voz';
  if (res.error) { vMsg(ERRV[res.error] || `El reconocimiento de voz falló (${res.error}).`, 'ko'); return; }
  handleSpoken(res.alternatives);
};
$('#voice').addEventListener('click', () => {
  if (typeof window.SendaNative?.listen === 'function') { $('#voice').classList.add('on'); $('#voiceTxt').textContent = 'Preparando…'; window.SendaNative.listen(); return; }
  const t = prompt('Escribe el aviso o díctalo con el micrófono del teclado:', '');
  if (t) handleSpoken([t]);
});

// Ruta de ejemplo: el primer par de servicios reales de la zona con camino seco (evitando el agua observada).
const sv = area.servicios;
pick: for (let i = 0; i < Math.min(sv.length, 8); i++) for (let j = sv.length - 1; j > i; j -= 3) {
  const a = [sv[i].lon, sv[i].lat], b = [sv[j].lon, sv[j].lat];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02) continue;
  if (alternatives(graph('car'), { from: a, to: b, avoid: { polygons: water } }, 1)[0]?.ok) {
    st.from = a; st.to = b; setTool('via');
    $('#hint').textContent = `Ejemplo: ${sv[i].name} → ${sv[j].name}. ${HINT.via}`;
    break pick;
  }
}
plan();
// Para pruebas automáticas: posición en pantalla de un punto de la ruta elegida.
globalThis.sendaRuta = { st, toPx };
