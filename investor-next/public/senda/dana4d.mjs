// SENDA · DANA 4D (Valencia, 29-10-2024, l'Horta Sud): relieve 3D, agua observada por satélite y modelo
// hidrológico (por dónde baja el agua, de dónde viene y qué se inunda antes). Cada capa lleva su etiqueta.
import { MAP_STYLES, styleFor, TERRAIN_SOURCE } from './core/map-style.mjs';
import { lonToTileX, latToTileY, gridToLonLat } from './core/geo-survey.mjs';
import { DI, DJ, handRGBA, compareRGBA, agreement, floodMask } from './core/flood-science.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }));
const D = '/senda/data/dana2024/';

const [meta, ems, obsGj, cauces] = await Promise.all(['hidro.json', 'emsr773.json', 'emsr773_inundacion.geojson', 'cauces.geojson'].map((f) => fetch(D + f).then((r) => r.json())));
const bin = (f) => fetch(D + f).then((r) => r.arrayBuffer());
const [handBuf, obsBuf, dirBuf] = await Promise.all(['hand_roi.bin', 'obs_roi.bin', 'dir_z12.bin'].map(bin));
const G = meta.malla, R = meta.roi, cellKm2 = (G.celdaM * G.celdaM) / 1e6;
const handQ = new Uint8Array(handBuf), obs = new Uint8Array(obsBuf), dirP = new Uint8Array(dirBuf);
const HAND = Float32Array.from(handQ, (v) => (v === 255 ? NaN : v / 4)); // metros
const dirAt = (k) => (dirP[k >> 1] >> ((k & 1) * 4)) & 15; // 15 = salida
const RUN = meta.calibracion.find((r) => r.streamKm2 === meta.cauceKm2), BEST = RUN.best;
const obsCells = obs.reduce((s, v) => s + v, 0);
const AOI3 = obsGj.features.find((f) => f.properties.aoi === 3);

// ── Mapa ──
maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
const STYLES = ['satelite', 'falso', 'dia', 'relieve', 'mapa', 'noche', 'topo'];
const DAY = '2024-10-30'; // imágenes NASA (MODIS) del día siguiente al suceso
const sty = (id) => styleFor(id, { date: DAY });
let styleId = LS.get('senda.d4d.style', 'satelite');
const map = new maplibregl.Map({ container: 'map', style: sty(styleId), center: [-0.47, 39.41], zoom: 11.2, pitch: 55, bearing: -20, maxPitch: 80, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

const mkCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const putRGBA = (c, rgba) => { const x = c.getContext('2d'), img = x.createImageData(c.width, c.height); img.data.set(rgba); x.putImageData(img, 0, 0); };
const cHand = mkCanvas(R.w, R.h), cCmp = mkCanvas(R.w, R.h);
let cBasin = null, basinCorners = null; // la capa de cuenca se crea al calcular la primera

const LAYERS = [
  { id: 'obs', label: 'Agua vista por satélite', badge: 'real', on: true, sub: `Copernicus EMS EMSR773 · imagen del 31-10 10:22 UTC · ${fmt(AOI3.properties.km2, 2)} km² en l'Horta Sud`, info: `<p>Zonas inundadas cartografiadas por el servicio de emergencias de Copernicus (UE) con imágenes de satélite: ${obsGj.features.map((f) => `${esc(f.properties.nombre)} ${fmt(f.properties.km2, 2)} km² (${esc(f.properties.imagen.slice(0, 16).replace('T', ' '))} UTC)`).join(' · ')}.</p><p><b>Ojo:</b> la imagen de l'Horta Sud es del 31-10 por la mañana, unas 44 horas después de empezar el suceso: parte del agua ya se había retirado y en zonas urbanas el radar y la óptica ven peor el agua.</p><p class="src">${esc(ems.cita)} · ${esc(ems.licencia)}</p>` },
  { id: 'hand', label: 'Agua del modelo (nivel elegido)', badge: 'scen', on: true, sub: 'Celdas a menos altura sobre su cauce que el nivel de arriba', info: `<p>Cada celda de ${fmt(G.celdaM, 1)} m sabe a qué altura está sobre el cauce al que drena (HAND, «altura sobre el drenaje más cercano»). Si subes el nivel, se pintan las celdas que quedarían por debajo: primero se inundan las más bajas respecto a su cauce. Azul oscuro = más bajo.</p><p>Sirve para saber <b>qué se inunda antes</b>. No da calados ni horas: no hay caudal ni lluvia en este cálculo.</p>` },
  { id: 'cmp', label: 'Modelo frente a satélite', badge: 'model', on: false, sub: 'Blanco: aciertan los dos · azul: solo el modelo · verde: solo el satélite', info: '<p>Compara, celda a celda, el agua del modelo al nivel elegido con la mancha observada por Copernicus. Con eso se calcula el índice de éxito crítico (CSI): aciertos / (aciertos + falsas alarmas + fallos). 1 sería perfecto.</p>' },
  { id: 'cauces', label: 'Cauces del modelo', badge: 'model', on: true, sub: 'Por dónde baja el agua según el relieve · más grueso = más cuenca', info: `<p>Dirección del agua celda a celda (método D8: cada celda vierte a su vecina más baja) sobre el relieve con los hoyos rellenados (Priority-Flood). Se dibuja todo cauce que recoge ${meta.cauceDibujoKm2} km² o más.</p><p>Es el relieve natural a ${fmt(G.celdaM, 0)} m: <b>no incluye</b> encauzamientos, colectores, puentes ni el nuevo cauce del Turia como obra. Donde la realidad canaliza el agua, el modelo puede ir por otro lado.</p>` },
  { id: 'basin', label: 'Cuenca del punto elegido', badge: 'model', on: true, sub: 'Toca «¿De dónde viene el agua?» y luego un punto', info: '<p>Toda la superficie cuya agua de lluvia acaba pasando por el punto que tocas, siguiendo las direcciones D8 hacia arriba. Es la «cuenca vertiente»: cuanto mayor, más agua puede llegar en un aguacero.</p>' },
];
const state = { level: LS.get('senda.d4d.level', BEST.level), on: Object.fromEntries(LAYERS.map((l) => [l.id, LS.get(`senda.d4d.${l.id}`, l.on)])), basinMode: false, playing: false };

function addAll() {
  if (!map.getSource('dem')) map.addSource('dem', { ...TERRAIN_SOURCE });
  map.setTerrain({ source: 'dem', exaggeration: 2 }); // ×2: la llanura es casi plana; realce de dibujo declarado
  const src = (id, def) => { if (!map.getSource(id)) map.addSource(id, def); };
  src('hand', { type: 'canvas', canvas: cHand, coordinates: R.esquinas, animate: false });
  src('cmp', { type: 'canvas', canvas: cCmp, coordinates: R.esquinas, animate: false });
  if (cBasin) src('basin', { type: 'canvas', canvas: cBasin, coordinates: basinCorners, animate: false });
  src('obs', { type: 'geojson', data: obsGj });
  src('cauces', { type: 'geojson', data: cauces });
  src('pin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const L = (def) => { if (!map.getLayer(def.id)) map.addLayer(def); };
  for (const id of [...(cBasin ? ['basin'] : []), 'hand', 'cmp']) L({ id, type: 'raster', source: id, paint: { 'raster-opacity': id === 'basin' ? 0.55 : 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
  L({ id: 'obs', type: 'fill', source: 'obs', paint: { 'fill-color': '#34c759', 'fill-opacity': 0.35 } });
  L({ id: 'obs-line', type: 'line', source: 'obs', paint: { 'line-color': '#34c759', 'line-width': 1.2 } });
  L({ id: 'cauces', type: 'line', source: 'cauces', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#64d2ff', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, ['+', 0.6, ['*', 0.7, ['get', 'clase']]], 14, ['+', 1.5, ['*', 1.8, ['get', 'clase']]]] } });
  L({ id: 'cauces-lbl', type: 'symbol', source: 'cauces', filter: ['>=', ['get', 'clase'], 3], layout: { 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': ['concat', ['to-string', ['get', 'km2']], ' km²'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 }, paint: { 'text-color': '#64d2ff', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
  L({ id: 'pin', type: 'circle', source: 'pin', paint: { 'circle-radius': 7, 'circle-color': '#0a84ff', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
  render(true);
}
map.on('style.load', addAll);

// ── Dibujo ──
let lastLevel = null;
function render(force = false) {
  if (!map.getLayer('hand')) return;
  const L = state.level;
  if (force || lastLevel !== L) {
    putRGBA(cHand, handRGBA(HAND, L));
    const m = floodMask(HAND, L); putRGBA(cCmp, compareRGBA(m, obs));
    const a = agreement(m, obs); let n = 0; for (const v of m) n += v;
    $('#kMod').textContent = fmt(n * cellKm2, 1); $('#kCsi').textContent = fmt(a.csi, 2);
    state.last = { ...a, km2: n * cellKm2 }; lastLevel = L;
    for (const id of ['hand', 'cmp']) { map.getSource(id)?.play?.(); map.getSource(id)?.pause?.(); }
  }
  $('#lvlTxt').innerHTML = `${fmt(L, 1)} m <small style="color:var(--l2);font-weight:500">sobre el cauce</small>`;
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  vis('obs', state.on.obs); vis('obs-line', state.on.obs); vis('hand', state.on.hand && !state.on.cmp); vis('cmp', state.on.cmp);
  vis('cauces', state.on.cauces); vis('cauces-lbl', state.on.cauces); vis('basin', state.on.basin); vis('pin', state.on.basin);
  $('#cmpLeg').hidden = !state.on.cmp;
  renderScience();
}

// ── Cuenca vertiente de un punto (D8 hacia arriba) ──
const toPx = (lon, lat) => [(lonToTileX(lon, G.z) - G.x0) * G.size, (latToTileY(lat, G.z) - G.y0) * G.size];
function upstream(k0) {
  const seen = new Uint8Array(G.w * G.h), st = [k0]; seen[k0] = 1; let n = 0, i0 = G.w, i1 = 0, j0 = G.h, j1 = 0, edge = false;
  while (st.length) {
    const k = st.pop(), i = k % G.w, j = (k / G.w) | 0; n++;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
    if (i === 0 || j === 0 || i === G.w - 1 || j === G.h - 1) edge = true;
    for (let d = 0; d < 8; d++) {
      const ii = i - DI[d], jj = j - DJ[d]; if (ii < 0 || jj < 0 || ii >= G.w || jj >= G.h) continue; // vecino que, con dirección d, cae aquí
      const kk = jj * G.w + ii; if (!seen[kk] && dirAt(kk) === d) { seen[kk] = 1; st.push(kk); }
    }
  }
  return { seen, n, i0, i1, j0, j1, edge };
}
/** Acumulación de flujo a partir de D8 (orden topológico de Kahn): se calcula una vez, al primer uso. */
let ACC = null;
function accFromDir() {
  if (ACC) return ACC;
  const N = G.w * G.h, indeg = new Uint8Array(N), acc = new Float32Array(N).fill(1), down = (k) => { const d = dirAt(k); if (d === 15) return -1; const i = (k % G.w) + DI[d], j = ((k / G.w) | 0) + DJ[d]; return i < 0 || j < 0 || i >= G.w || j >= G.h ? -1 : j * G.w + i; };
  for (let k = 0; k < N; k++) { const n = down(k); if (n >= 0) indeg[n]++; }
  const q = new Int32Array(N); let h = 0, t = 0; for (let k = 0; k < N; k++) if (!indeg[k]) q[t++] = k;
  while (h < t) { const k = q[h++], n = down(k); if (n < 0) continue; acc[n] += acc[k]; if (--indeg[n] === 0) q[t++] = n; }
  return (ACC = acc);
}
/** Celda de mayor cuenca en un radio de r celdas (≈ 120 m): el dedo rara vez cae justo en el cauce. */
function snap(i, j, r = 4) {
  const acc = accFromDir(); let best = j * G.w + i;
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= G.w || jj >= G.h) continue; const k = jj * G.w + ii; if (acc[k] > acc[best]) best = k; }
  return best;
}
function basinAt(lon, lat) {
  const [px, py] = toPx(lon, lat), i = Math.floor(px), j = Math.floor(py);
  if (i < 1 || j < 1 || i >= G.w - 1 || j >= G.h - 1) return showToast('Fuera de la zona calculada');
  // primero el punto exacto; si su cuenca es mínima, se busca el cauce más cercano (≤ 4 celdas)
  const k = snap(i, j), up = upstream(k);
  const w = up.i1 - up.i0 + 1, h = up.j1 - up.j0 + 1, rgba = new Uint8ClampedArray(w * h * 4);
  for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) if (up.seen[(jj + up.j0) * G.w + ii + up.i0]) rgba.set([255, 159, 10, 170], (jj * w + ii) * 4);
  cBasin = mkCanvas(w, h); putRGBA(cBasin, rgba);
  const c = (x, y) => gridToLonLat(G, x, y); basinCorners = [c(up.i0, up.j0), c(up.i1 + 1, up.j0), c(up.i1 + 1, up.j1 + 1), c(up.i0, up.j1 + 1)];
  if (map.getLayer('basin')) map.removeLayer('basin'); if (map.getSource('basin')) map.removeSource('basin');
  map.addSource('basin', { type: 'canvas', canvas: cBasin, coordinates: basinCorners, animate: false });
  map.addLayer({ id: 'basin', type: 'raster', source: 'basin', paint: { 'raster-opacity': 0.55, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } }, map.getLayer('hand') ? 'hand' : undefined);
  const pt = gridToLonLat(G, (k % G.w) + 0.5, ((k / G.w) | 0) + 0.5);
  map.getSource('pin').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pt } });
  state.on.basin = true; render();
  const km2 = up.n * cellKm2;
  showInfo(`<h3>💧 Cuenca de este punto <span class="badge model">MODELO</span></h3>
<p style="font-size:28px;font-weight:800;margin:4px 0">${fmt(km2, km2 < 10 ? 2 : 0)} km²</p>
<p>Es la superficie (en naranja) cuya lluvia acaba pasando por aquí, según el relieve. ${up.edge ? '<b>La cuenca llega al borde de la zona calculada: en realidad es mayor.</b>' : ''}</p>
<p>Referencia: la cuenca completa de la rambla del Poyo es de 422,3 km² según el CEDEX, cifra citada en Wikipedia (<b>no verificada</b> en la fuente original). Toca el cauce grande entre Torrent y Paiporta para comparar.</p>
<p class="src">D8 (O'Callaghan y Mark, 1984) sobre relieve de ${fmt(G.celdaM, 0)} m con hoyos rellenados (Barnes et al., 2014). Sin colectores ni obras de drenaje.</p>`);
}

// ── Inspector de un punto ──
function inspect(lon, lat) {
  const [px, py] = toPx(lon, lat), i = Math.floor(px) - R.px[0], j = Math.floor(py) - R.px[1];
  if (i < 0 || j < 0 || i >= R.w || j >= R.h) return showToast('Toca dentro del recuadro de l’Horta Sud');
  const k = j * R.w + i, hv = HAND[k], o = obs[k];
  showInfo(`<h3>🔎 Este punto</h3><table class="tbl">
<tr><td>Posición</td><td>${lat.toFixed(5)}, ${lon.toFixed(5)}</td><td></td></tr>
<tr><td>Agua vista por satélite (31-10)</td><td>${o ? 'sí' : 'no'}</td><td><span class="badge real">REAL</span></td></tr>
<tr><td>Altura sobre su cauce</td><td>${Number.isFinite(hv) ? `${fmt(hv, 2)} m` : 'sin dato (mar o lago)'}</td><td><span class="badge model">MODELO</span></td></tr>
<tr><td>¿Se inunda al nivel elegido (${fmt(state.level, 1)} m)?</td><td>${Number.isFinite(hv) ? (hv <= state.level ? 'sí' : `no: le faltan ${fmt(hv - state.level, 1)} m`) : '–'}</td><td><span class="badge scen">ESCENARIO</span></td></tr></table>
<p class="src">Celda de ${fmt(G.celdaM, 1)} m. «Altura sobre su cauce» = cota del punto menos la del cauce al que drena (HAND, Rennó et al. 2008).</p>`);
}
map.on('click', (e) => { if (state.basinMode) { state.basinMode = false; $('#basinBtn').classList.remove('on'); $('#msg').hidden = true; return basinAt(e.lngLat.lng, e.lngLat.lat); } inspect(e.lngLat.lng, e.lngLat.lat); });

// ── 🔬 Ciencia ──
function drawCsi() {
  const cv = $('#csi'); if (!cv) return; const x = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 34;
  x.clearRect(0, 0, W, H); x.font = '20px Inter, system-ui'; x.fillStyle = 'rgba(235,235,245,.62)'; x.strokeStyle = 'rgba(84,84,88,.6)';
  const X = (L) => pad + (L / 20) * (W - pad - 10), Y = (v) => H - pad + 8 - (v / 0.25) * (H - pad - 10);
  for (const v of [0, 0.1, 0.2]) { x.beginPath(); x.moveTo(pad, Y(v)); x.lineTo(W - 10, Y(v)); x.stroke(); x.fillText(String(v).replace('.', ','), 2, Y(v) + 6); }
  for (const L of [0, 5, 10, 15, 20]) x.fillText(`${L} m`, X(L) - 14, H - 4);
  const COL = { 1: '#8e8e93', 5: '#64d2ff', 25: '#0a84ff' };
  for (const r of meta.calibracion) { x.strokeStyle = COL[r.streamKm2] ?? '#fff'; x.lineWidth = r.streamKm2 === meta.cauceKm2 ? 4 : 2; x.beginPath(); r.rows.forEach((p, q) => (q ? x.lineTo(X(p.level), Y(p.csi)) : x.moveTo(X(p.level), Y(p.csi)))); x.stroke(); }
  x.strokeStyle = '#ffd60a'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); meta.banera.filas.forEach((p, q) => { const L = p.zMaxM / 4; q ? x.lineTo(X(L), Y(p.csi)) : x.moveTo(X(L), Y(p.csi)); }); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#fff'; x.beginPath(); x.arc(X(state.level), Y(state.last?.csi ?? 0), 7, 0, 7); x.fill();
}
let sciKey = '';
function renderScience() {
  const a = state.last; if (!a) return; const key = `${state.level}`; if (key === sciKey) return drawCsi(); sciKey = key;
  const M = meta.metodo;
  $('#science').innerHTML = `<h4>¿Acierta el modelo? (al nivel ${fmt(state.level, 1)} m)</h4>
<table class="tbl"><tr><td>Agua del modelo</td><td>${fmt(a.km2, 1)} km²</td><td><span class="badge model">MODELO</span></td></tr>
<tr><td>Agua vista por satélite</td><td>${fmt(obsCells * cellKm2, 1)} km² (oficial ${fmt(meta.observado.km2Oficial, 2)})</td><td><span class="badge real">REAL</span></td></tr>
<tr><td>Aciertos · falsas alarmas · fallos</td><td>${fmt(a.hits * cellKm2, 1)} · ${fmt(a.falseAlarms * cellKm2, 1)} · ${fmt(a.misses * cellKm2, 1)} km²</td><td></td></tr>
<tr><td>CSI (1 = perfecto)</td><td><b>${fmt(a.csi, 3)}</b> · acierto ${fmt(100 * a.hitRate, 0)} % · falsa alarma ${fmt(100 * a.falseAlarmRatio, 0)} %</td><td></td></tr></table>
<h4>Acuerdo según el nivel</h4><canvas id="csi" width="700" height="300"></canvas>
<div class="leg"><span><i style="background:#0a84ff"></i>cauce ≥ 25 km² (el usado)</span><span><i style="background:#64d2ff"></i>≥ 5 km²</span><span><i style="background:#8e8e93"></i>≥ 1 km²</span><span><i style="background:#ffd60a"></i>sin hidrología: «todo lo que esté por debajo de N×4 m de cota»</span></div>
<p class="src">El mejor acuerdo (CSI ${fmt(BEST.csi, 3)} a ${fmt(BEST.level, 1)} m) <b>se calibra mirando la mancha real</b>: no es una predicción hecha antes. Con hidrología el acuerdo dobla al de «inundar lo más bajo» (CSI ${fmt(meta.banera.mejor.csi, 3)}), pero sigue siendo bajo.</p>
<h4>Por qué no acierta más (dicho tal cual)</h4><ul style="margin:0 0 6px 18px;padding:0;color:var(--l2);font-size:12.5px;line-height:1.45">
${M.limites.map((t) => `<li>${esc(t)}</li>`).join('')}
<li>Aguas abajo de Torrent el Poyo se desborda en un cono aluvial: el agua se abre en abanico y deja de seguir un solo cauce, justo lo que HAND (un cauce por celda) no representa.</li></ul>
<p class="src">Métodos: ${esc(M.relleno)} · ${esc(M.direccion)} · ${esc(M.hand)} · ${esc(M.acuerdo)}. Relieve: ${meta.procedencia.teselas.length} teselas con su SHA-256 guardado en hidro.json.</p>`;
  drawCsi();
}

// ── Controles ──
$('#layers').innerHTML = LAYERS.map((l) => `<label class="layer"><input type="checkbox" data-l="${l.id}" ${state.on[l.id] ? 'checked' : ''}><span class="t"><span class="badge ${l.badge}">${{ real: 'REAL', model: 'MODELO', scen: 'ESCENARIO' }[l.badge]}</span>${esc(l.label)}<small>${l.sub}</small></span><button class="i" data-i="${l.id}" aria-label="Qué es">i</button></label>`).join('');
$('#layers').addEventListener('change', (e) => { const id = e.target.dataset.l; if (!id) return; state.on[id] = e.target.checked; LS.set(`senda.d4d.${id}`, e.target.checked); render(); });
$('#layers').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); const l = LAYERS.find((x) => x.id === b.dataset.i); showInfo(`<h3>${esc(l.label)} <span class="badge ${l.badge}">${{ real: 'REAL', model: 'MODELO', scen: 'ESCENARIO' }[l.badge]}</span></h3>${l.info}`); });
$('#lvl').value = state.level;
$('#lvl').addEventListener('input', (e) => { state.level = +e.target.value; LS.set('senda.d4d.level', state.level); render(); });
let raf = 0;
$('#play').addEventListener('click', () => {
  state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶';
  if (state.playing && state.level >= 20) state.level = 0;
  let last = performance.now();
  const step = (now) => { if (!state.playing) return; if (now - last > 180) { last = now; state.level = state.level >= 20 ? 0 : state.level + 0.5; $('#lvl').value = state.level; render(); } raf = requestAnimationFrame(step); };
  if (state.playing) raf = requestAnimationFrame(step); else cancelAnimationFrame(raf);
});
$('#basinBtn').addEventListener('click', () => { state.basinMode = !state.basinMode; $('#basinBtn').classList.toggle('on', state.basinMode); $('#msg').textContent = 'Toca un punto del mapa (mejor sobre un cauce azul)'; $('#msg').hidden = !state.basinMode; });
$('#sciBtn').addEventListener('click', () => { panelMini(false); $('#science').scrollIntoView({ behavior: 'smooth' }); });
$('#styleBtn').addEventListener('click', () => { styleId = STYLES[(STYLES.indexOf(styleId) + 1) % STYLES.length]; LS.set('senda.d4d.style', styleId); map.setStyle(sty(styleId), { diff: false }); showToast(`Mapa: ${MAP_STYLES[styleId].label}${MAP_STYLES[styleId].url === null && !['satelite', 'relieve', 'topo'].includes(styleId) ? ` · NASA ${DAY}` : ''}`); });
$('#kObs').textContent = fmt(obsCells * cellKm2, 1); $('#kBest').textContent = `${fmt(BEST.level, 1)} m`;

function showInfo(html) { $('#infoBody').innerHTML = html; $('#info').hidden = false; }
$('#infoX').addEventListener('click', () => { $('#info').hidden = true; });
let toastT; function showToast(t) { const m = $('#msg'); m.textContent = t; m.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { if (!state.basinMode) m.hidden = true; }, 1800); }
const HELP = `<h3>Cómo leer la DANA 4D</h3>
<p><b>3D + nivel del agua.</b> El mapa tiene el relieve real (realzado ×2 porque la llanura es casi plana). La barra sube el agua desde los cauces: verás qué se inunda primero.</p>
<h4>Qué miras</h4><ul>
<li><span class="badge real">REAL</span> En verde, el agua que vio el satélite (Copernicus EMS, activación EMSR773). En l'Horta Sud, imagen del 31-10-2024 a las 10:22 UTC.</li>
<li><span class="badge model">MODELO</span> Cauces calculados con el relieve: por dónde baja el agua y cuánta cuenca recoge cada tramo.</li>
<li><span class="badge scen">ESCENARIO</span> En azul, lo que quedaría bajo el agua con el nivel que elijas sobre el cauce.</li></ul>
<h4>Para investigar</h4><ul><li>💧 «¿De dónde viene el agua?»: toca un punto y verás toda su cuenca y sus km².</li><li>Toca cualquier punto: si el satélite vio agua, su altura sobre el cauce y si se inunda al nivel elegido.</li><li>🔬 Ciencia: cuánto acierta el modelo frente al satélite, con qué nivel acierta más y por qué no acierta más.</li></ul>
<h4>Lo que este modelo NO es</h4><ul><li>No tiene lluvia, caudal ni horas: ordena qué se inunda antes, no cuándo ni con qué calado.</li><li>El nivel que mejor encaja se ha calibrado con la mancha real: no es una predicción hecha antes del suceso.</li><li>No incluye diques, colectores, puentes ni encauzamientos.</li></ul>
<p class="src">${esc(ems.cita)}. Relieve: Terrain Tiles (AWS Open Data). Fondo «Satélite»: ortofoto PNOA del IGN <b>actual</b>, no la de 2024. Fondos de la NASA (🗺️): MODIS del ${DAY.split('-').reverse().join('-')}, el día siguiente.</p>`;
$('#helpBtn').addEventListener('click', () => showInfo(HELP));
const panelMini = (on) => { $('#panel').classList.toggle('mini', on); LS.set('senda.d4d.mini', on); };
$('#grab').addEventListener('click', () => panelMini(!$('#panel').classList.contains('mini')));
panelMini(LS.get('senda.d4d.mini', true));
if (!LS.get('senda.d4d.welcomed', false)) { LS.set('senda.d4d.welcomed', true); setTimeout(() => showInfo(HELP), 800); }
globalThis.sendaDana4d = { map, state, render, basinAt, upstream, G };
