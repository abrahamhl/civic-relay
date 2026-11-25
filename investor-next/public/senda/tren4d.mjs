// SENDA · Tren 4D: reconstrucción del accidente de Adamuz (18-01-2026) solo con datos publicados.
// REAL = cifra publicada con su fuente · MODELO = calculado por SENDA (cinemática) · SIMULACIÓN = escenario sintético.
import { styleFor } from './core/map-style.mjs';
import { hms, fmtHms, speedProfile, pkAt, meanDecel, stopping, closingKmh, brakingShortfall } from './core/rail-reconstruct.mjs';
import { simulateTwoTrainIncident } from './core/rail-scenario.mjs';
import { saveBlob } from './save-file.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const PRO = new URLSearchParams(location.search).has('pro') || !!window.__TAURI_INTERNALS__;
const D = await fetch('/senda/data/adamuz2026/cronologia.json').then((r) => r.json());
const EV = D.eventos.map((e) => ({ ...e, s: hms(e.t), unv: /no verificado/i.test(e.estado) }));
const E = Object.fromEntries(EV.map((e) => [e.id, e]));
const PK_ROTURA = D.pk.rotura.valor, PK_IMPACTO = D.pk.impacto.valor;

// ── Dos versiones del mismo informe preliminar de la CIAF, tal como lo citan los medios ──
const VERSIONS = {
  infobae: { label: 'CIAF vía Infobae (28-04)', tc: E.choque_infobae.s,
    alvia: [{ tSec: E.alvia_s613.s, vKmh: E.alvia_s613.vKmh }, { tSec: E.choque_infobae.s, vKmh: E.choque_infobae.vKmh }],
    iryo: [{ tSec: E.iryo_sintoma.s, vKmh: E.iryo_sintoma.vKmh }, { tSec: E.iryo_aguja.s, vKmh: E.iryo_aguja.vKmh }, { tSec: E.choque_infobae.s, vKmh: E.choque_infobae.vIryoKmh }],
    brakeAt: E.alvia_s613.s, note: 'Colisión a las 19:43:42. Velocidades del Iryo de las 19:43:29 y 19:43:33 tomadas de la versión de Forbes (Infobae solo da «más de 200 km/h»).' },
  forbes: { label: 'CIAF vía Forbes/COPE (10-03)', tc: E.choque_forbes.s,
    alvia: [{ tSec: E.alvia_lzb.s, vKmh: E.alvia_lzb.vKmh }, { tSec: E.choque_forbes.s, vKmh: E.choque_forbes.vKmh }],
    iryo: [{ tSec: E.iryo_sintoma.s, vKmh: E.iryo_sintoma.vKmh }, { tSec: E.iryo_aguja.s, vKmh: E.iryo_aguja.vKmh }, { tSec: E.iryo_freno.s, vKmh: E.iryo_freno.vKmh }],
    brakeAt: E.alvia_lzb.s, note: 'Colisión a las 19:43:44. Tras las 19:43:43 se mantiene la última velocidad publicada del Iryo (141 km/h).' },
};
const state = { ver: LS.get('senda.t4d.ver', 'infobae'), zoom: 's', t: hms('19:43:35'), playing: false, ad: 25, cv: 55 };
let V, iryo, alvia;
const build = () => { V = VERSIONS[state.ver]; iryo = speedProfile(V.iryo); alvia = speedProfile(V.alvia); };
build();
const pkIryo = (t) => pkAt(iryo, { tAnchor: V.tc, pkAnchor: PK_IMPACTO, dir: -1 }, t); // Iryo va hacia PK decreciente
const posAlvia = (t) => pkAt(alvia, { tAnchor: V.tc, pkAnchor: PK_IMPACTO, dir: +1 }, t);

// ── Mapa 3D ──
maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
const map = new maplibregl.Map({ container: 'map', style: styleFor('satelite'), center: [D.lugar.lon, D.lugar.lat], zoom: 14.2, pitch: 60, bearing: 30, maxPitch: 80, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.on('style.load', () => {
  if (!map.getSource('rail')) map.addSource('rail', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  if (!map.getLayer('rail')) map.addLayer({ id: 'rail', type: 'line', source: 'rail', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#ffd60a', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 5], 'line-opacity': 0.9 } });
  if (!map.getSource('site')) map.addSource('site', { type: 'geojson', data: { type: 'Feature', properties: { label: 'Zona del accidente (coordenadas de Wikipedia)' }, geometry: { type: 'Point', coordinates: [D.lugar.lon, D.lugar.lat] } } });
  if (!map.getLayer('site')) map.addLayer({ id: 'site', type: 'circle', source: 'site', paint: { 'circle-radius': 10, 'circle-color': '#ff375f', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
  if (!map.getLayer('site-lbl')) map.addLayer({ id: 'site-lbl', type: 'symbol', source: 'site', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.6] }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.6 } });
});

// ── Línea del tiempo ──
const RANGES = { s: [hms('19:43:15'), hms('19:44:10'), 1], m: [hms('19:40:00'), hms('20:35:00'), 15] };
function setZoom(z) { state.zoom = z; const [a, b, st] = RANGES[z]; Object.assign($('#t'), { min: a, max: b, step: st }); state.t = Math.min(b, Math.max(a, state.t)); $('#t').value = state.t; document.querySelectorAll('#zoom button').forEach((x) => x.classList.toggle('on', x.dataset.z === z)); render(); }
function render() {
  const t = state.t, before = t <= V.tc;
  $('#clock').textContent = `${fmtHms(t)} h`;
  $('#kI').textContent = before && t >= V.iryo[0].tSec - 30 ? fmt(iryo.v(t) * 3.6) : t > V.tc ? (t >= E.iryo_parado.s ? 'parado' : 'choque') : '–';
  $('#kA').textContent = before && t >= V.alvia[0].tSec - 30 ? fmt(alvia.v(t) * 3.6) : t > V.tc ? 'choque' : '–';
  $('#kD').textContent = before && t >= V.iryo[0].tSec - 30 ? `${fmt((pkIryo(t) - posAlvia(t)) * 1000)} m` : t > V.tc ? '0 m' : '–';
  const s2 = E.segundo_tren.s; $('#k2').textContent = t < V.tc ? '–' : t < s2 ? `faltan ${Math.floor((s2 - t) / 60)} min` : fmtHms(s2);
  document.querySelectorAll('#evlist .ev').forEach((el) => el.classList.toggle('fut', +el.dataset.s > t));
  drawMarey();
}

// ── Diagrama de Marey: PK frente al tiempo ──
function drawMarey() {
  const cv = $('#marey'); if (!cv.offsetParent) return; const x = cv.getContext('2d'), W = cv.width, H = cv.height, L = 70, B = 36;
  const T0 = hms('19:43:20'), T1 = hms('19:43:50');
  const samples = []; for (let t = T0; t <= V.tc; t += 0.25) samples.push(pkIryo(t), posAlvia(t));
  const lo = Math.min(...samples, PK_IMPACTO) - 0.05, hi = Math.max(...samples, PK_ROTURA) + 0.05;
  const X = (t) => L + ((t - T0) / (T1 - T0)) * (W - L - 12), Y = (pk) => H - B - ((pk - lo) / (hi - lo)) * (H - B - 12);
  x.clearRect(0, 0, W, H); x.font = '19px Inter, system-ui'; x.lineWidth = 1;
  const stp = hi - lo > 1.5 ? 0.5 : hi - lo > 0.6 ? 0.2 : 0.1; for (let k = Math.ceil(lo / stp) * stp; k <= hi; k += stp) { x.strokeStyle = 'rgba(84,84,88,.5)'; x.beginPath(); x.moveTo(L, Y(k)); x.lineTo(W - 12, Y(k)); x.stroke(); x.fillStyle = 'rgba(235,235,245,.62)'; x.fillText(k.toFixed(1).replace('.', ','), 4, Y(k) + 6); }
  for (let t = T0; t <= T1; t += 5) x.fillText(fmtHms(t).slice(3), X(t) - 22, H - 8);
  const hl = (pk, col, dash) => { x.strokeStyle = col; x.lineWidth = 2; x.setLineDash(dash); x.beginPath(); x.moveTo(L, Y(pk)); x.lineTo(W - 12, Y(pk)); x.stroke(); x.setLineDash([]); };
  hl(PK_ROTURA, '#ffd60a', [8, 6]); hl(PK_IMPACTO, '#fff', [3, 5]);
  const line = (fn, col) => { x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); let first = true; for (let t = T0; t <= V.tc; t += 0.25) { const px = X(t), py = Y(fn(t)); first ? x.moveTo(px, py) : x.lineTo(px, py); first = false; } x.stroke(); };
  line(pkIryo, '#ff375f'); line(posAlvia, '#64d2ff');
  const dot = (t, pk, col) => { x.fillStyle = col; x.beginPath(); x.arc(X(t), Y(pk), 7, 0, 7); x.fill(); };
  dot(E.iryo_descarrila.s, PK_ROTURA, '#ffd60a'); dot(V.brakeAt, posAlvia(V.brakeAt), '#64d2ff'); dot(V.tc, PK_IMPACTO, '#fff');
  x.fillStyle = '#ffd60a'; x.fillText('descarrila coche 6', X(E.iryo_descarrila.s) + 10, Y(PK_ROTURA) - 10);
  x.fillStyle = '#64d2ff'; x.fillText('freno de emergencia (LZB)', X(V.brakeAt) + 10, Y(posAlvia(V.brakeAt)) + 22);
  if (state.t >= T0 && state.t <= T1) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(state.t), 8); x.lineTo(X(state.t), H - B); x.stroke(); }
}

// ── 🔬 Física y lecciones (todo calculado de las cifras publicadas) ──
function renderScience() {
  const tc = V.tc, dIryo = iryo.dist(E.iryo_descarrila.s, tc), dPk = (PK_ROTURA - PK_IMPACTO) * 1000, gap = dPk - dIryo;
  const a0 = V.alvia[0], a1 = V.alvia[1], dec = meanDecel(a0, a1), dBrake = alvia.dist(a0.tSec, tc);
  const st = stopping(a0.vKmh, dec), sf = brakingShortfall(a0.vKmh, dec, dBrake);
  const vIryoImpact = iryo.v(tc) * 3.6, vAlviaImpact = alvia.v(tc) * 3.6;
  const symToBrake = V.brakeAt - E.iryo_sintoma.s, dSym = E.iryo_sintoma.vKmh / 3.6 * symToBrake;
  $('#science').innerHTML = `<h4>🔬 Física y lecciones <span class="badge model">MODELO</span></h4>
<p class="out">${esc(V.note)} Posiciones ancladas en el punto de impacto (PK ${fmt(PK_IMPACTO, 3)}, Infobae); entre lecturas, la velocidad cambia de forma lineal (supuesto).</p>
<table class="tbl">
<tr><td>Del primer síntoma (19:43:29) al freno de emergencia del Alvia</td><td><b>${fmt(symToBrake)} s</b> · a ${E.iryo_sintoma.vKmh} km/h el Iryo recorre ${fmt(dSym)} m en ese tiempo</td></tr>
<tr><td>Del freno del Alvia al choque</td><td><b>${fmt(tc - V.brakeAt)} s</b> y ${fmt(dBrake)} m recorridos, bajando de ${a0.vKmh} a ${a1.vKmh} km/h</td></tr>
<tr><td>Deceleración media del Alvia en esos segundos</td><td><b>${fmt(dec, 2)} m/s²</b> (incluye el tiempo de actuación del freno; no es su deceleración máxima)</td></tr>
<tr><td>Para detenerse con esa deceleración desde ${a0.vKmh} km/h</td><td>${fmt(st.distM / 1000, 2)} km y ${fmt(st.timeS)} s. Le faltaban <b>${fmt(sf.shortfallM / 1000, 2)} km</b>: habría tenido que frenar <b>${fmt(sf.earlierS)} s antes</b> (hacia las ${fmtHms(V.brakeAt - sf.earlierS)})${V.brakeAt - sf.earlierS < E.iryo_sintoma.s ? ', antes incluso de que el Iryo mostrara el primer síntoma' : ''}</td></tr>
<tr><td>Velocidad de acercamiento en el choque</td><td><b>${fmt(closingKmh(vAlviaImpact, vIryoImpact))} km/h</b> (Alvia ${fmt(vAlviaImpact)} + Iryo ${fmt(vIryoImpact)})</td></tr>
<tr><td>Comprobación cruzada entre fuentes</td><td>Según las velocidades, el coche 6 del Iryo recorre ${fmt(dIryo)} m entre el descarrilamiento (19:43:34) y el choque; según los PK de la CIAF hay ${fmt(dPk)} m. Diferencia: <b>${fmt(gap)} m</b> (≈ ${fmt(gap / (vIryoImpact / 3.6), 1)} s a la velocidad del Iryo), compatible con el redondeo de las horas al segundo en dos fuentes y con que el primer eje y la parte trasera del coche no están en el mismo punto; con datos públicos no se puede afinar más</td></tr>
<tr><td>Respuesta</td><td>Primera llamada al 112: <b>+${fmt(E.llamada_112.s - tc)} s</b> · confirmación oficial del segundo tren: <b>+${Math.floor((E.segundo_tren.s - tc) / 60)} min ${(E.segundo_tren.s - tc) % 60} s</b> · un pasajero del Alvia llega al Iryo: +${Math.floor((E.llega_alvia.s - tc) / 60)} min</td></tr></table>
<p class="out"><b>Lección física:</b> una vez descarrilado el Iryo, ningún sistema podía parar el Alvia a tiempo; hacían falta kilómetros. El valor está <b>antes</b> (detectar la rotura del carril: SENDA tiene <code>trackCircuitWatch</code> para escalones de tensión y un detector por ondas guiadas en <code>rail-advanced-safety</code>) y <b>después</b> (saber en segundos que hay dos trenes y dónde).</p>
<p class="out"><b>Señal previa, en disputa:</b> ${esc(D.senalPrevia.texto)}</p>`;
}

// ── 📱 ¿Y con SENDA? (simulación sintética con los algoritmos reales) ──
function renderSenda() {
  $('#adTxt').textContent = state.ad; $('#cvTxt').textContent = state.cv;
  const r = simulateTwoTrainIncident({ adoption: state.ad / 100, coverage: state.cv / 100 }), pub = E.segundo_tren.s - V.tc;
  $('#senOut').innerHTML = `Con ${state.ad} % de pasajeros con SENDA y ${state.cv} % de cobertura: ${r.phonesWithSenda} móviles, ${r.reportsDelivered} informes entregados.<br>
Primer emplazamiento conocido: <b>${r.firstSiteKnownS != null ? `${fmt(r.firstSiteKnownS)} s` : 'no'}</b> · segundo tren: <b>${r.secondTrainKnownS != null ? `${fmt(r.secondTrainKnownS)} s` : 'no detectado'}</b> después del choque, frente a <b>${Math.floor(pub / 60)} min ${pub % 60} s</b> publicados hasta la confirmación oficial.<br>
<span style="font-size:11.5px">${esc(r.disclaimer ?? 'Simulación sintética y determinista: teléfonos, sensores y respuestas son simulados; los algoritmos son los reales de SENDA.')} Emplazamiento ilustrativo, no las coordenadas oficiales.</span>`;
}

// ── Cronología ──
$('#evlist').innerHTML = EV.map((e) => `<div class="ev" data-id="${e.id}" data-s="${e.s}"><time>${e.t}</time><span><span class="badge real">${e.tipo}</span>${e.unv ? '<span class="badge unv">NO VERIFICADO</span>' : ''}<b>${esc(e.tren)}</b> · ${esc(e.texto)}${e.vKmh ? ` · <b>${e.vKmh} km/h</b>` : ''}<small>${esc(D.fuentes[e.fuente].cita.split(',')[0])}${e.discrepancia ? ' · otra fuente difiere' : ''}</small></span></div>`).join('') + `<p class="out">No encontrado: ${D.noEncontrado.map(esc).join(' · ')}.</p>`;
$('#evlist').addEventListener('click', (ev) => {
  const el = ev.target.closest('.ev'); if (!el) return; const e = E[el.dataset.id], f = D.fuentes[e.fuente];
  state.t = e.s; setZoom(e.s > hms('19:44:10') || e.s < hms('19:43:15') ? 'm' : 's');
  showInfo(`<h3>${esc(e.t)} · ${esc(e.tren)}</h3><p>${esc(e.texto)}</p>${e.vKmh ? `<p style="font-size:26px;font-weight:800;margin:4px 0">${e.vKmh} km/h</p>` : ''}<table class="tbl"><tr><td>Tipo</td><td>${esc(e.tipo)}</td></tr><tr><td>Estado</td><td>${esc(e.estado)}</td></tr></table><p class="src">${esc(f.cita)}<br>${esc(f.url)}</p>`);
});

// ── Controles ──
$('#ver').innerHTML = Object.entries(VERSIONS).map(([k, v]) => `<button data-v="${k}" class="${k === state.ver ? 'on' : ''}">${esc(v.label)}</button>`).join('');
$('#ver').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; state.ver = b.dataset.v; LS.set('senda.t4d.ver', state.ver); build(); document.querySelectorAll('#ver button').forEach((x) => x.classList.toggle('on', x === b)); renderScience(); renderSenda(); render(); });
$('#zoom').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) setZoom(b.dataset.z); });
$('#t').addEventListener('input', (e) => { state.t = +e.target.value; render(); });
$('#ad').value = state.ad; $('#cv').value = state.cv;
$('#ad').addEventListener('input', (e) => { state.ad = +e.target.value; renderSenda(); });
$('#cv').addEventListener('input', (e) => { state.cv = +e.target.value; renderSenda(); });
let raf = 0;
$('#play').addEventListener('click', () => {
  state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; let last = performance.now();
  const step = (now) => { if (!state.playing) return; const [a, b, st] = RANGES[state.zoom]; if (now - last > (state.zoom === 's' ? 250 : 120)) { last = now; state.t = state.t >= b ? a : state.t + st; $('#t').value = state.t; render(); } raf = requestAnimationFrame(step); };
  if (state.playing) raf = requestAnimationFrame(step); else cancelAnimationFrame(raf);
});
const panelMini = (on) => { $('#panel').classList.toggle('mini', on); if (!on) requestAnimationFrame(render); };
$('#grab').addEventListener('click', () => panelMini(!$('#panel').classList.contains('mini')));
$('#sciBtn').addEventListener('click', () => { panelMini(false); $('#science').scrollIntoView({ behavior: 'smooth' }); });
$('#senBtn').addEventListener('click', () => { panelMini(false); $('#senOut').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
function showInfo(html) { $('#infoBody').innerHTML = html; $('#info').hidden = false; }
$('#infoX').addEventListener('click', () => { $('#info').hidden = true; });
const HELP = `<h3>Cómo leer el Tren 4D</h3>
<p>Reconstrucción del accidente de Adamuz con <b>datos publicados</b> (informe preliminar de la CIAF tal como lo citan los medios, registros del 112 y de Adif recogidos por Wikipedia). Nada inventado: lo que no se ha encontrado se dice.</p>
<ul><li><b>Línea del tiempo</b> al segundo (19:43–19:44) o en minutos (respuesta de emergencias hasta las 20:35).</li>
<li><b>Diagrama espacio-tiempo</b> (como los que usa la ingeniería ferroviaria): punto kilométrico de cada tren frente al tiempo, calculado integrando las velocidades publicadas.</li>
<li><b>Dos versiones</b> del mismo informe preliminar, porque las fuentes difieren en 1–2 segundos.</li>
<li><b>🔬 Física y lecciones</b>: tiempos, distancias de frenado, velocidad de acercamiento y una comprobación cruzada entre fuentes.</li>
<li><b>📱 ¿Y con SENDA?</b>: simulación sintética (marcada así) de cuándo sabría SENDA que hay dos trenes, con los algoritmos reales.</li></ul>
<p class="src">${esc(D.aviso)} Vías: OpenStreetMap vía OpenFreeMap. Fondo: ortofoto PNOA actual (no la de enero de 2026).</p>`;
$('#helpBtn').addEventListener('click', () => showInfo(HELP));
if (PRO) {
  $('#proBox').hidden = false;
  $('#expPack').addEventListener('click', async () => {
    const pack = { producto: 'SENDA · Tren 4D (Adamuz) · paquete de datos', generadoUTC: new Date().toISOString(), version: state.ver, cronologia: D, perfiles: { iryo: V.iryo, alvia: V.alvia, anclaje: { pk: PK_IMPACTO, t: fmtHms(V.tc) } }, simulacionSenda: { basis: 'SIMULATION', adopcion: state.ad / 100, cobertura: state.cv / 100 } };
    await saveBlob(new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }), `senda-tren4d-adamuz-${new Date().toISOString().slice(0, 10)}.json`);
  });
}
panelMini(true); setZoom('s'); renderScience(); renderSenda();
if (!LS.get('senda.t4d.welcomed', false)) { LS.set('senda.t4d.welcomed', true); setTimeout(() => showInfo(HELP), 800); }
globalThis.sendaTren4d = { map, state, render };
