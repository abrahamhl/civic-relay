// SENDA · Conducir: cámara del salpicadero con análisis en el móvil, velocidad GPS, radar de avisos,
// grabación, aviso por voz y favoritos. Pensado para gastar poca batería: el análisis va a pocos
// fotogramas por segundo y se para al salir de la pantalla.
import { createTracker, topAlert, RULES } from './core/drive-hazard.mjs';
import { interpretAlternatives } from './core/voice-report.mjs';
import { REPORT_KINDS } from './core/road-guard.mjs';
import { parseDatex2 } from './core/datex2.mjs';
import { wazeUrl, googleMapsUrl, haversineM } from './core/route-planner.mjs';

const $ = (s) => document.querySelector(s);
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const ES = { car: 'coche', truck: 'camión', bus: 'autobús', motorcycle: 'moto', bicycle: 'bici', person: 'persona', dog: 'perro', horse: 'caballo', cow: 'vaca', sheep: 'oveja' };
const COLOR = { VERDE: '#34d399', AMBAR: '#fbbf24', ROJO: '#ff5b6e' };

const st = { running: false, eco: false, pos: null, speed: null, heading: 0, incidents: [], incSource: '', cams: [], rec: null, said: new Map() };

// ── Datos alrededor: avisos propios, cámaras DGT, incidencias DGT (en vivo si la app puede; si no, copia fechada) ──
const reports = () => LS.get('senda.ruta.reports', []);
fetch('/senda/data/referencias/dgt_camaras.json').then((r) => r.json()).then((d) => { st.cams = d.camaras; }).catch(() => {});
async function loadIncidents() {
  // 1) En vivo: solo dentro de la app con Internet (versión play), que la descarga de nap.dgt.es.
  try {
    const r = await fetch('/senda/live/dgt-incidencias.xml', { cache: 'no-store' });
    if (r.ok) { st.incidents = parseDatex2(await r.text()); st.incSource = `DGT en vivo, ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; info(); return; }
  } catch { /* sin red: copia guardada */ }
  // 2) Copia guardada con su fecha (CC BY, DGT).
  try { const d = await (await fetch('/senda/data/referencias/dgt_incidencias.json')).json(); st.incidents = Object.values(d).find(Array.isArray) ?? []; st.incSource = `DGT, copia del ${new Date(d.descargadoUTC).toLocaleDateString('es-ES')}`; } catch { st.incSource = 'sin incidencias'; }
  info();
}
loadIncidents();
setInterval(() => { if (!document.hidden) loadIncidents(); }, 5 * 60 * 1000);

function info(extra = '') {
  const near = st.pos ? st.incidents.filter((i) => i.lat != null && haversineM(st.pos, [i.lon, i.lat]) < 10_000).length : 0;
  $('#info').textContent = `${extra ? extra + ' · ' : ''}Incidencias a <10 km: ${st.pos ? near : '—'} (${st.incSource || 'cargando'}). Avisos de SENDA: ${reports().length}. Rojo = se acerca en ≤ ${RULES.redTtcS} s (AASHTO); ámbar y «se mete» = reglas de la app sin calibrar.`;
}

// ── GPS ──
navigator.geolocation?.watchPosition((p) => {
  st.pos = [p.coords.longitude, p.coords.latitude];
  st.speed = p.coords.speed; if (p.coords.heading != null && !Number.isNaN(p.coords.heading)) st.heading = p.coords.heading;
  $('#speed').innerHTML = `${st.speed == null ? '–' : Math.round(st.speed * 3.6)}<small> km/h</small>`;
  drawRadar(); info();
}, () => { $('#speed').innerHTML = '–<small> sin GPS</small>'; }, { enableHighAccuracy: true, maximumAge: 2000 });

// ── Radar con la dirección de la marcha hacia arriba (radio 5 km) ──
function drawRadar() {
  const c = $('#radar'), x = c.getContext('2d'), W = c.width, R = W / 2 - 8, RANGE = 5000; // radio 5 km (anillo interior: 2,5 km)
  x.clearRect(0, 0, W, W); x.save(); x.translate(W / 2, W / 2);
  x.strokeStyle = 'rgba(145,215,232,.25)'; for (const f of [1, 0.5]) { x.beginPath(); x.arc(0, 0, R * f, 0, 7); x.stroke(); }
  if (st.pos) {
    const rot = -st.heading * Math.PI / 180, k = Math.cos(st.pos[1] * Math.PI / 180);
    const plot = (lon, lat, color, r) => {
      const dx = (lon - st.pos[0]) * 111320 * k, dy = (lat - st.pos[1]) * 110540, d = Math.hypot(dx, dy); if (d > RANGE) return;
      const px = (dx * Math.cos(rot) - dy * Math.sin(rot)) / RANGE * R, py = -(dx * Math.sin(rot) + dy * Math.cos(rot)) / RANGE * R;
      x.fillStyle = color; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    };
    for (const cam of st.cams) plot(cam.lon, cam.lat, '#0a84ff', 5);
    for (const i of st.incidents) if (i.lat != null) plot(i.lon, i.lat, '#fbbf24', 6);
    for (const r of reports()) plot(r.lon, r.lat, '#ff5b6e', 7);
  }
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fill();
  x.restore();
}
drawRadar();

// ── Cámara + análisis (MediaPipe + EfficientDet-Lite0, en el móvil) ──
const MP = '/senda/vendor/mediapipe-tasks-vision-1.2.3';
let det = null, stream = null, tracker = createTracker(), lastT = 0;
async function start() {
  $('#start').hidden = true; $('#state').textContent = 'Cargando…';
  try {
    if (!det) {
      const vision = await import(MP + '/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
      det = await vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: '/senda/vendor/models/efficientdet_lite0_int8.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: 0.4, maxResults: 8 });
    }
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const v = $('#v'); v.srcObject = stream; await v.play();
    try { await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
    st.running = true; tracker = createTracker(); loop();
  } catch (e) { $('#start').hidden = false; $('#state').textContent = 'Error: ' + (e.message || e.name); }
}
function stop() { st.running = false; stream?.getTracks().forEach((t) => t.stop()); stream = null; $('#state').textContent = 'En pausa'; }
$('#go').addEventListener('click', start);
document.addEventListener('visibilitychange', () => { if (document.hidden && st.running) { stop(); $('#start').hidden = false; } });

function loop() {
  if (!st.running) return;
  const now = performance.now(), every = st.eco ? 500 : 166; // 2 o 6 análisis por segundo
  if (now - lastT >= every) { lastT = now; analyse(now); }
  requestAnimationFrame(loop);
}
function analyse(now) {
  const v = $('#v'); if (!v.videoWidth) return;
  const r = det.detectForVideo(v, now);
  const W = v.videoWidth, H = v.videoHeight;
  const dets = r.detections.map((d) => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX / W, y: d.boundingBox.originY / H, w: d.boundingBox.width / W, h: d.boundingBox.height / H }));
  const objs = tracker.update(dets, now / 1000);
  drawOverlay(objs, v);
  const top = topAlert(objs);
  const a = $('#alert');
  if (top) { a.className = top.level; a.textContent = `${ES[top.label] ?? top.label} ${top.zone === 'TU_CARRIL' ? 'delante' : top.zone === 'DERECHA' ? 'a la derecha' : 'a la izquierda'}: ${top.reasons.join(' · ')}`; warn(top); }
  else a.className = '';
  $('#state').textContent = `${objs.length} a la vista · ${st.eco ? 2 : 6}/s`;
}
function warn(o) {
  const key = o.id + o.level, last = st.said.get(key) ?? 0;
  if (Date.now() - last < 6000) return;
  st.said.set(key, Date.now());
  if (o.level === 'ROJO') { navigator.vibrate?.([200, 100, 200]); speechSynthesis?.speak(Object.assign(new SpeechSynthesisUtterance(`Cuidado, ${ES[o.label] ?? 'vehículo'} delante`), { lang: 'es-ES' })); }
  else if (o.reasons.some((r) => r.startsWith('se mete'))) speechSynthesis?.speak(Object.assign(new SpeechSynthesisUtterance(`${ES[o.label] ?? 'vehículo'} ${o.reasons.find((r) => r.startsWith('se mete'))}`), { lang: 'es-ES' }));
}
// Recuadros sobre la imagen (object-fit: cover → se calcula el recorte para que coincidan)
function drawOverlay(objs, v) {
  const c = $('#ov'), box = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  c.width = box.width * dpr; c.height = box.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const s = Math.max(box.width / v.videoWidth, box.height / v.videoHeight), ox = (box.width - v.videoWidth * s) / 2, oy = (box.height - v.videoHeight * s) / 2;
  // franja de tu carril
  x.fillStyle = 'rgba(52,211,153,.08)'; x.fillRect(ox + RULES.egoLane[0] * v.videoWidth * s, 0, (RULES.egoLane[1] - RULES.egoLane[0]) * v.videoWidth * s, box.height);
  for (const o of objs) {
    const bx = ox + o.box.x * v.videoWidth * s, by = oy + o.box.y * v.videoHeight * s, bw = o.box.w * v.videoWidth * s, bh = o.box.h * v.videoHeight * s;
    if (o.label === 'person') { x.fillStyle = 'rgba(0,0,0,.85)'; x.fillRect(bx, by, bw, bh); } // privacidad
    x.strokeStyle = COLOR[o.level]; x.lineWidth = o.level === 'VERDE' ? 2 : 4; x.strokeRect(bx, by, bw, bh);
    const label = `${ES[o.label] ?? o.label}${o.ttcS ? ' · ' + o.ttcS.toFixed(1) + ' s' : ''}`;
    x.font = '600 13px Inter,sans-serif'; const tw = x.measureText(label).width + 10;
    x.fillStyle = COLOR[o.level]; x.fillRect(bx, by - 20, tw, 20); x.fillStyle = '#000'; x.fillText(label, bx + 5, by - 6);
  }
}

// ── Botones ──
$('#eco').addEventListener('click', () => { st.eco = !st.eco; $('#eco').textContent = `Ahorro: ${st.eco ? 'sí' : 'no'}`; });
// Grabación tipo dashcam: tramos de 30 s; se guardan los 2 últimos en memoria y solo se descargan si pulsas «Guardar».
let recChunks = [], segs = [];
$('#rec').addEventListener('click', () => {
  if (st.rec) { st.rec.stop(); st.rec = null; $('#rec').classList.remove('on'); $('#rec').textContent = 'Grabar';
    const all = [...segs, new Blob(recChunks, { type: 'video/webm' })].filter((b) => b.size);
    if (all.length && confirm('¿Guardar los últimos segundos grabados en el móvil?')) all.forEach((b, i) => Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `senda-conducir-${Date.now()}-${i}.webm` }).click());
    recChunks = []; segs = []; return; }
  if (!stream) return alert('Primero pulsa «Empezar a conducir».');
  const startSeg = () => { recChunks = []; const r = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 1_500_000 }); r.ondataavailable = (e) => recChunks.push(e.data);
    r.onstop = () => { if (st.rec === r) { segs.push(new Blob(recChunks, { type: 'video/webm' })); segs = segs.slice(-2); startSeg(); } }; st.rec = r; r.start(1000); setTimeout(() => r.state === 'recording' && r.stop(), 30_000); };
  startSeg(); $('#rec').classList.add('on'); $('#rec').textContent = 'Parar y guardar';
});
// Aviso por voz (mismo intérprete que en Ruta) en tu posición GPS
window.sendaVoice = (res) => {
  if (res.state) { $('#report').textContent = res.state === 'ESCUCHANDO' ? 'Habla ahora…' : 'Procesando…'; return; }
  $('#report').textContent = 'Aviso por voz';
  if (res.error) return info('Voz: ' + res.error);
  saveReport(interpretAlternatives(res.alternatives));
};
function saveReport(r) {
  if (!r.kind) return info(`No entendido: «${r.text || ''}»`);
  if (!st.pos) return info('Sin GPS: no se puede situar el aviso');
  if (!confirm(`¿Publicar «${r.label}» aquí?`)) return;
  const list = reports(); list.push({ kind: r.kind, side: r.side, lon: st.pos[0], lat: st.pos[1], t: Date.now(), own: true, voice: true }); LS.set('senda.ruta.reports', list);
  drawRadar(); info(`Aviso guardado: ${REPORT_KINDS[r.kind].label}`);
}
$('#report').addEventListener('click', () => {
  if (typeof window.SendaNative?.listen === 'function') { $('#report').textContent = 'Preparando…'; window.SendaNative.listen(); }
  else { const t = prompt('Escribe o dicta el aviso:'); if (t) saveReport(interpretAlternatives([t])); }
});
// Favoritos: se guardan con tu posición actual; luego abren la navegación en Waze o Google Maps
for (const k of ['home', 'work']) $('#' + k).addEventListener('click', () => {
  const fav = LS.get('senda.drive.fav.' + k, null), name = k === 'home' ? 'Casa' : 'Trabajo';
  if (!fav) { if (!st.pos) return alert('Sin GPS todavía'); if (confirm(`¿Guardar tu posición actual como «${name}»?`)) LS.set('senda.drive.fav.' + k, st.pos); return; }
  const useWaze = confirm(`Ir a ${name}: Aceptar = Waze, Cancelar = Google Maps`);
  location.href = useWaze ? wazeUrl({ to: fav }).url : googleMapsUrl({ from: st.pos ?? fav, to: fav }).url;
});
$('#waze').addEventListener('click', () => {
  alert('Waze no permite que otras apps lean ni publiquen sus avisos (no hay API pública; solo organismos con convenio «Waze for Cities»). SENDA abre Waze para que navegues; tus avisos de SENDA quedan en SENDA.');
  location.href = 'https://waze.com/ul';
});
info();
