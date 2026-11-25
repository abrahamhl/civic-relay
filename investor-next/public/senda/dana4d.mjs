// SENDA · DANA 4D (Valencia, 29-10-2024, l'Horta Sud): relieve 3D, agua observada por satélite y modelo
// hidrológico (por dónde baja el agua, de dónde viene y qué se inunda antes). Cada capa lleva su etiqueta.
import { MAP_STYLES, styleFor, TERRAIN_SOURCE } from './core/map-style.mjs';
import { lonToTileX, latToTileY, gridToLonLat } from './core/geo-survey.mjs';
import { DI, DJ, handRGBA, compareRGBA, agreement, floodMask } from './core/flood-science.mjs';
import { downstreamPath, closestOnPath, travelMinutes, frontIndex, flowLevel, localToUtcMs, leadMinutes } from './core/flood-warning.mjs';
import { saveBlob } from './save-file.mjs';
import { meanSlope, velocityEnsemble, arrivalBand, pickBest } from './core/hydro-estimates.mjs';
import { parseSeries, sha256Hex, valueAt, CONNECTORS, SERIES_KINDS } from './core/data-connectors.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }));
const D = '/senda/data/dana2024/';

const [meta, ems, obsGj, cauces, TEL] = await Promise.all(['hidro.json', 'emsr773.json', 'emsr773_inundacion.geojson', 'cauces.geojson', 'telemetria.json'].map((f) => fetch(D + f).then((r) => r.json())));
const TOWNS = (await fetch('/senda/data/radio/poyo.json').then((r) => r.json())).municipios; // puntos de Nominatim (OSM, ODbL)
const PRO = new URLSearchParams(location.search).has('pro') || !!window.__TAURI_INTERNALS__;
const bin = (f) => fetch(D + f).then((r) => r.arrayBuffer());
const [handBuf, obsBuf, dirBuf, demBuf] = await Promise.all(['hand_roi.bin', 'obs_roi.bin', 'dir_z12.bin', 'dem_d4.bin'].map(bin));
const DEM4 = new Int16Array(demBuf);
const SWE = await fetch(D + 'swe.json').then((r) => r.json());
const SWEV = await Promise.all(SWE.variantes.map(async (v) => ({ ...v, frames: new Uint8Array(await bin(`swe_${v.id}_frames.bin`)), max: new Uint8Array(await bin(`swe_${v.id}_max.bin`)) })));
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
const cHand = mkCanvas(R.w, R.h), cCmp = mkCanvas(R.w, R.h), cSwe = mkCanvas(SWE.malla.w, SWE.malla.h);
let cBasin = null, basinCorners = null; // la capa de cuenca se crea al calcular la primera

const LAYERS = [
  { id: 'obs', label: 'Agua vista por satélite', badge: 'real', on: true, sub: `Copernicus EMS EMSR773 · imagen del 31-10 10:22 UTC · ${fmt(AOI3.properties.km2, 2)} km² en l'Horta Sud`, info: `<p>Zonas inundadas cartografiadas por el servicio de emergencias de Copernicus (UE) con imágenes de satélite: ${obsGj.features.map((f) => `${esc(f.properties.nombre)} ${fmt(f.properties.km2, 2)} km² (${esc(f.properties.imagen.slice(0, 16).replace('T', ' '))} UTC)`).join(' · ')}.</p><p><b>Ojo:</b> la imagen de l'Horta Sud es del 31-10 por la mañana, unas 44 horas después de empezar el suceso: parte del agua ya se había retirado y en zonas urbanas el radar y la óptica ven peor el agua.</p><p class="src">${esc(ems.cita)} · ${esc(ems.licencia)}</p>` },
  { id: 'hand', label: 'Agua del modelo (nivel elegido)', badge: 'scen', on: true, sub: 'Celdas a menos altura sobre su cauce que el nivel de arriba', info: `<p>Cada celda de ${fmt(G.celdaM, 1)} m sabe a qué altura está sobre el cauce al que drena (HAND, «altura sobre el drenaje más cercano»). Si subes el nivel, se pintan las celdas que quedarían por debajo: primero se inundan las más bajas respecto a su cauce. Azul oscuro = más bajo.</p><p>Sirve para saber <b>qué se inunda antes</b>. No da calados ni horas: no hay caudal ni lluvia en este cálculo.</p>` },
  { id: 'cmp', label: 'Modelo frente a satélite', badge: 'model', on: false, sub: 'Blanco: aciertan los dos · azul: solo el modelo · verde: solo el satélite', info: '<p>Compara, celda a celda, el agua del modelo al nivel elegido con la mancha observada por Copernicus. Con eso se calcula el índice de éxito crítico (CSI): aciertos / (aciertos + falsas alarmas + fallos). 1 sería perfecto.</p>' },
  { id: 'cauces', label: 'Cauces del modelo', badge: 'model', on: true, sub: 'Por dónde baja el agua según el relieve · más grueso = más cuenca', info: `<p>Dirección del agua celda a celda (método D8: cada celda vierte a su vecina más baja) sobre el relieve con los hoyos rellenados (Priority-Flood). Se dibuja todo cauce que recoge ${meta.cauceDibujoKm2} km² o más.</p><p>Es el relieve natural a ${fmt(G.celdaM, 0)} m: <b>no incluye</b> encauzamientos, colectores, puentes ni el nuevo cauce del Turia como obra. Donde la realidad canaliza el agua, el modelo puede ir por otro lado.</p>` },
  { id: 'swe', label: 'Simulación hidrodinámica 2D', badge: 'model', on: true, sub: 'Aguas someras (Bates et al. 2010) · avanza con la hora · calado en m', info: `<p>El agua entra por el cauce del Poyo con un hidrograma construido con los datos publicados (subida en 2 h, 2.282 m³/s a las 18:55, 3.500 m³/s estimados a las 19:35) y se mueve por el relieve resolviendo las ecuaciones de aguas someras (formulación inercial de Bates, Horritt y Fewtrell, 2010, base de LISFLOOD-FP) en celdas de ${SWE.malla.celdaM} m.</p><p>Verificado con pruebas clásicas (lago en reposo, conservación de la masa, calado normal de Manning). Comparado con la mancha de Copernicus mejora la superficie respecto al modelo estático, pero <b>los tiempos de llegada no son fiables</b> (ver 🔬).</p>` },
  { id: 'basin', label: 'Cuenca del punto elegido', badge: 'model', on: true, sub: 'Toca «¿De dónde viene el agua?» y luego un punto', info: '<p>Toda la superficie cuya agua de lluvia acaba pasando por el punto que tocas, siguiendo las direcciones D8 hacia arriba. Es la «cuenca vertiente»: cuanto mayor, más agua puede llegar en un aguacero.</p>' },
];
const state = { level: LS.get('senda.d4d.level', BEST.level), on: Object.fromEntries(LAYERS.map((l) => [l.id, LS.get(`senda.d4d.${l.id}`, l.on)])), basinMode: false, playing: false };

function addAll() {
  if (!map.getSource('dem')) map.addSource('dem', { ...TERRAIN_SOURCE });
  map.setTerrain({ source: 'dem', exaggeration: 2 }); // ×2: la llanura es casi plana; realce de dibujo declarado
  const src = (id, def) => { if (!map.getSource(id)) map.addSource(id, def); };
  src('hand', { type: 'canvas', canvas: cHand, coordinates: R.esquinas, animate: false });
  src('cmp', { type: 'canvas', canvas: cCmp, coordinates: R.esquinas, animate: false });
  src('swe', { type: 'canvas', canvas: cSwe, coordinates: SWE.malla.esquinas, animate: false });
  if (cBasin) src('basin', { type: 'canvas', canvas: cBasin, coordinates: basinCorners, animate: false });
  src('obs', { type: 'geojson', data: obsGj });
  src('cauces', { type: 'geojson', data: cauces });
  src('pin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  for (const id of ['tpath', 'tmarks', 'tfront', 'towns']) src(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const L = (def) => { if (!map.getLayer(def.id)) map.addLayer(def); };
  for (const id of [...(cBasin ? ['basin'] : []), 'hand', 'cmp', 'swe']) L({ id, type: 'raster', source: id, paint: { 'raster-opacity': id === 'basin' ? 0.55 : 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
  L({ id: 'obs', type: 'fill', source: 'obs', paint: { 'fill-color': '#34c759', 'fill-opacity': 0.35 } });
  L({ id: 'obs-line', type: 'line', source: 'obs', paint: { 'line-color': '#34c759', 'line-width': 1.2 } });
  L({ id: 'cauces', type: 'line', source: 'cauces', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#64d2ff', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, ['+', 0.6, ['*', 0.7, ['get', 'clase']]], 14, ['+', 1.5, ['*', 1.8, ['get', 'clase']]]] } });
  L({ id: 'cauces-lbl', type: 'symbol', source: 'cauces', filter: ['>=', ['get', 'clase'], 3], layout: { 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': ['concat', ['to-string', ['get', 'km2']], ' km²'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 }, paint: { 'text-color': '#64d2ff', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
  L({ id: 'tpath', type: 'line', source: 'tpath', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#bf5af2', 'line-width': 5, 'line-opacity': 0.9 } });
  L({ id: 'tmarks', type: 'circle', source: 'tmarks', paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-color': '#bf5af2', 'circle-stroke-width': 2 } });
  L({ id: 'tmarks-lbl', type: 'symbol', source: 'tmarks', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.2] }, paint: { 'text-color': '#fff', 'text-halo-color': '#5e2a84', 'text-halo-width': 1.6 } });
  L({ id: 'towns', type: 'symbol', source: 'towns', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-anchor': 'left', 'text-offset': [0.8, 0] }, paint: { 'text-color': '#ffd60a', 'text-halo-color': '#000', 'text-halo-width': 1.6 } });
  L({ id: 'tfront', type: 'circle', source: 'tfront', paint: { 'circle-radius': 11, 'circle-color': '#ff453a', 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
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
  vis('swe', state.on.swe); vis('cauces', state.on.cauces); vis('cauces-lbl', state.on.cauces); vis('basin', state.on.basin); vis('pin', state.on.basin);
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
map.on('click', (e) => { if (TT.pick) { TT.pick = false; $('#tPick').classList.remove('on'); $('#msg').hidden = true; return travelFrom(e.lngLat.lng, e.lngLat.lat); } if (state.basinMode) { state.basinMode = false; $('#basinBtn').classList.remove('on'); $('#msg').hidden = true; return basinAt(e.lngLat.lng, e.lngLat.lat); } inspect(e.lngLat.lng, e.lngLat.lat); });

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
<h4>🌊 Simulación 2D frente al modelo estático</h4>
<table class="tbl"><tr><td><b>Rugosidad n · bajada</b></td><td><b>CSI · acierto · falsa alarma</b></td><td><b>Llega a Paiporta</b></td></tr>
${SWE.calibracion.map((r) => `<tr${r.n === SWE.mejor.n && r.recesionH === SWE.mejor.recesionH ? ' style="font-weight:700;color:#fff"' : ''}><td>${fmt(r.n, 3)} · ${r.recesionH} h</td><td>${fmt(r.csi, 3)} · ${fmt(100 * r.acierto)} % · ${fmt(100 * r.falsaAlarma)} %</td><td>${r.llegadas?.Paiporta != null ? clock(16 * 60 + 55 + r.llegadas.Paiporta) : 'no llega'}</td></tr>`).join('')}
<tr><td>Modelo estático (HAND)</td><td>${fmt(SWE.comparacionHAND.csi, 3)}</td><td>sin tiempo</td></tr></table>
<p class="src">La simulación 2D <b>mejora la superficie</b> (CSI ${fmt(SWE.mejor.csi, 3)} frente a ${fmt(SWE.comparacionHAND.csi, 3)}, +${fmt(100 * (SWE.mejor.csi / SWE.comparacionHAND.csi - 1))} %), con balance de masa cerrado (error ≈ 10⁻¹⁵). Pero <b>sus tiempos no son fiables</b>: ${sweFrontTxt()}, cuando el CEDEX estimó 14 m/s por Chiva. Causas conocidas: la formulación inercial omite la advección (está pensada para flujo lento) y la malla de ${fmt(SWE.malla.celdaM)} m no resuelve el cauce encauzado. La rugosidad y la bajada se calibran con la mancha observada: no es una predicción a ciegas. Próximo paso: solver de volúmenes finitos completo (Kurganov y Petrova, 2007) con porosidad urbana.</p>
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

// ── ⏱️ Línea del tiempo del 29-10 con telemetría publicada (cada dato con su fuente y su estado) ──
const OFF = 1; // CET (UTC+1) el 29-10-2024: el cambio de hora fue el 27-10
const DAY0 = '2024-10-29';
const C = Object.fromEntries(TEL.constantes.map((c) => [c.id, c]));
const TH = { avisoM3s: C.umbral_aviso.valor, capacidadM3s: C.capacidad_urbana.valor };
const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const clock = (min) => { const m = Math.round(min), d = Math.floor(m / 1440); return `${d === 1 ? 'día siguiente ' : d > 1 ? `+${d} días ` : ''}${hhmm(((m % 1440) + 1440) % 1440)}`; };
const minOf = (local) => (local && local.startsWith(DAY0) ? +local.slice(11, 13) * 60 + +local.slice(14, 16) : null);
const EV = TEL.eventos.map((e) => ({ ...e, min: minOf(e.local), unv: /no verificado/i.test(e.estado) }));
const FLOW = EV.filter((e) => e.unidad === 'm³/s' && e.min != null);
const ESA = EV.find((e) => e.id === 'esalert');
const TT = { pick: false, path: null, k0: null, dep: LS.get('senda.d4d.dep', 'poyo_1855'), method: LS.get('senda.d4d.meth', 'cedex'), vManual: LS.get('senda.d4d.v', null), v: C.velocidad_chiva.valor, arrivals: [], ens: [] };
const IMP = []; // series importadas por el operador (solo en memoria: no se guardan al cerrar)
const R4 = meta.relieveD4, elevAt = (k) => { const i = Math.floor((k % G.w) / R4.factor), j = Math.floor(((k / G.w) | 0) / R4.factor), v = DEM4[j * R4.w + i]; return v === -32768 ? NaN : v; };
const CEDEX_OBS = [{ id: 'cedex', label: 'Dato del CEDEX en Chiva (observado, preliminar)', velocityMs: C.velocidad_chiva.valor, source: TEL.fuentes[C.velocidad_chiva.fuente].cita }];
const ensembleFor = (k0, kEnd, distM) => velocityEnsemble({ lengthM: distM, slope: meanSlope(elevAt(k0), elevAt(kEnd), distM), observed: CEDEX_OBS });
state.tMin = LS.get('senda.d4d.t', 1135);
const TIPO = { MEDIDO: ['real', 'MEDIDO'], ESTIMADO: ['scen', 'ESTIMADO'], OFICIAL: ['real', 'OFICIAL'], SIN_HORA: ['model', 'SIN HORA'] };

function renderTime() {
  const t = state.tMin, utc = new Date(localToUtcMs(`${DAY0}T00:00`, OFF) + t * 60_000);
  $('#clock').innerHTML = `${hhmm(t % 1440)} <small style="color:var(--l2);font-weight:500">${t >= 1440 ? '30-10' : '29-10'} · ${pad2(utc.getUTCHours())}:${pad2(utc.getUTCMinutes())} UTC</small>`;
  const pub = FLOW.filter((e) => e.min <= t).at(-1), tMs = localToUtcMs(`${DAY0}T00:00`, OFF) + t * 60_000;
  const imp = IMP.filter((x) => x.kind === 'caudal').map((x) => ({ x, p: valueAt(x, tMs) })).filter((o) => o.p).sort((a, b) => b.p.tMs - a.p.tMs)[0];
  const best = pickBest([...(imp ? [{ basis: 'MEDIDO', value: imp.p.value, at: hhmm(Math.round((imp.p.tMs / 60000 + OFF * 60) % 1440)), imp: true }] : []), ...(pub ? [{ basis: 'OBSERVADO_EXTERNO', value: pub.valor, at: hhmm(pub.min), unv: pub.unv }] : [])]);
  $('#kQ').innerHTML = best ? `${fmt(best.value)}${best.unv ? '<small style="color:#ff9f0a"> ?</small>' : ''} <small style="font-size:10px;color:var(--l2)">m³/s ${best.at}${best.imp ? ' · tu red' : ''}</small>` : '–';
  const lv = flowLevel(best?.value, TH);
  $('#kLvl').textContent = { normal: 'normal', aviso: 'AVISO', desbordamiento: 'DESBORDA', sin_dato: 'sin dato', no_medido: 'no medido' }[lv.level];
  $('#kLvl').style.color = { aviso: '#ffd60a', desbordamiento: '#ff453a' }[lv.level] ?? '';
  $('#kAlert').textContent = t < ESA.min ? `en ${ESA.min - t} min` : `enviado ${hhmm(ESA.min)}`;
  $('#kAlert').style.color = t < ESA.min ? '#ff9f0a' : '#64d2ff';
  document.querySelectorAll('#evlist .ev[data-m]').forEach((el) => el.classList.toggle('fut', +el.dataset.m > t));
  drawFlow(); renderSwe();
  // Frente del escenario de llegada
  const fr = map.getSource('tfront');
  if (fr && TT.path) {
    const dep = EV.find((e) => e.id === TT.dep)?.min ?? null, idx = dep == null ? -1 : frontIndex(TT.path, TT.v, t - dep);
    fr.setData(idx < 0 ? { type: 'FeatureCollection', features: [] } : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: cellLonLat(TT.path.cells[idx]) } });
  }
}
function drawFlow() {
  const cv = $('#tq'); if (!cv || !cv.offsetParent) return; const x = cv.getContext('2d'), W = cv.width, H = cv.height, L = 52, B = 34, T0 = 360, T1 = 1800, QMAX = 4000;
  const X = (m) => L + ((m - T0) / (T1 - T0)) * (W - L - 12), Y = (q) => H - B - (q / QMAX) * (H - B - 12);
  x.clearRect(0, 0, W, H); x.font = '19px Inter, system-ui'; x.lineWidth = 1;
  for (const q of [0, 1000, 2000, 3000, 4000]) { x.strokeStyle = 'rgba(84,84,88,.5)'; x.beginPath(); x.moveTo(L, Y(q)); x.lineTo(W - 12, Y(q)); x.stroke(); x.fillStyle = 'rgba(235,235,245,.62)'; x.fillText(q ? `${q / 1000}k` : '0', 8, Y(q) + 6); }
  for (let m = 360; m <= 1800; m += 180) x.fillText(hhmm(m % 1440).slice(0, 2) + 'h', X(m) - 12, H - 8);
  const hline = (q, col) => { x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(L, Y(q)); x.lineTo(W - 12, Y(q)); x.stroke(); x.setLineDash([]); };
  hline(TH.avisoM3s, '#ffd60a'); hline(TH.capacidadM3s, '#ff9f0a');
  x.strokeStyle = '#64d2ff'; x.lineWidth = 3; x.beginPath(); x.moveTo(X(ESA.min), 8); x.lineTo(X(ESA.min), H - B); x.stroke();
  for (const e of FLOW) {
    const px = X(e.min), py = Y(e.valor); x.lineWidth = 3;
    if (e.tipo === 'ESTIMADO') { x.fillStyle = '#bf5af2'; x.beginPath(); x.moveTo(px, py - 10); x.lineTo(px + 10, py); x.lineTo(px, py + 10); x.lineTo(px - 10, py); x.fill(); }
    else if (e.unv) { x.strokeStyle = '#ff9f0a'; x.beginPath(); x.arc(px, py, 8, 0, 7); x.stroke(); }
    else { x.fillStyle = '#ff453a'; x.beginPath(); x.arc(px, py, 8, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.fillText(fmt(e.valor), px + 12, py - 8);
  }
  for (const s2 of IMP.filter((z) => z.kind === 'caudal')) for (const p of s2.points) { const m = (p.tMs / 60000 + OFF * 60) - Date.parse(`${DAY0}T00:00Z`) / 60000; if (m < T0 || m > T1) continue; x.fillStyle = '#64d2ff'; x.fillRect(X(m) - 6, Y(Math.min(p.value, QMAX)) - 6, 12, 12); }
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(state.tMin), 8); x.lineTo(X(state.tMin), H - B); x.stroke();
}
function evHtml(e) {
  const [cls, lab] = TIPO[e.tipo] ?? ['model', e.tipo], val = e.valor != null ? ` · <b>${e.masDe ? 'más de ' : ''}${fmt(e.valor, e.valor % 1 ? 1 : 0)} ${esc(e.unidad)}</b>` : '';
  return `<div class="ev" data-id="${e.id}" ${e.min != null ? `data-m="${e.min}"` : ''}><time>${e.min != null ? (e.aprox ? '~' : '') + hhmm(e.min) : e.local ? esc(e.local.slice(8, 10) + '-' + e.local.slice(5, 7)) : '—'}</time><span><span class="badge ${cls}">${lab}</span>${e.unv ? '<span class="badge unv">NO VERIFICADO</span>' : ''}${esc(e.texto)}${val}<small>${esc(e.lugar ?? e.cuando ?? '')}</small></span></div>`;
}
const timed = EV.filter((e) => e.min != null).sort((a, b) => a.min - b.min), untimed = EV.filter((e) => e.min == null);
const leadTxt = (a, b) => { const l = leadMinutes(TEL.eventos, a, b, OFF); return l ? `${l.approx ? '≈ ' : ''}${fmt(l.minutes)} min` : 'no calculable (sin hora)'; };
$('#evlist').innerHTML = `<table class="tbl" style="margin-bottom:6px"><tr><td>Último dato del aforo (18:55) → ES-Alert</td><td><b>${leadTxt('poyo_1855', 'esalert')}</b></td><td><span class="badge model">CALCULADO</span></td></tr><tr><td>Pico estimado CEDEX (19:35) → ES-Alert</td><td><b>${leadTxt('cedex_pico', 'esalert')}</b></td><td></td></tr><tr><td>Hora del suceso según Copernicus → ES-Alert</td><td><b>${leadTxt('cems_evento', 'esalert')}</b></td><td></td></tr></table><p class="src" style="font-size:11.5px;color:var(--l2);margin:0 2px 6px">Restas de horas publicadas (fuentes abajo, toca cada dato). No es un juicio sobre la gestión: es la ventana de tiempo que un sistema de aviso puede aprovechar.</p>` + timed.map(evHtml).join('') + `<h4>Sin hora exacta o fuera del día</h4>` + untimed.map(evHtml).join('') +
  `<p class="src" style="font-size:11.5px;color:var(--l2)">No encontrado: ${TEL.noEncontrado.map(esc).join(' · ')}</p>`;
$('#evlist').addEventListener('click', (ev) => {
  const el = ev.target.closest('.ev'); if (!el) return; const e = EV.find((x) => x.id === el.dataset.id), f = TEL.fuentes[e.fuente];
  if (e.min != null) { state.tMin = e.min; $('#t').value = e.min; LS.set('senda.d4d.t', e.min); renderTime(); }
  const disc = e.discrepancia ? `<p><b>Discrepancia:</b> otra fuente da ${fmt(e.discrepancia.valor, 1)} ${esc(e.unidad)} (${esc(TEL.fuentes[e.discrepancia.fuente].cita)}). Se muestran las dos.</p>` : '';
  showInfo(`<h3>${e.min != null ? hhmm(e.min) + ' · ' : ''}${esc(e.texto)}</h3>${e.valor != null ? `<p style="font-size:26px;font-weight:800;margin:4px 0">${e.masDe ? '> ' : ''}${fmt(e.valor, 1)} ${esc(e.unidad)}</p>` : ''}
<table class="tbl"><tr><td>Tipo</td><td>${esc(e.tipo)}</td><td></td></tr><tr><td>Lugar</td><td>${esc(e.lugar ?? '—')}</td><td></td></tr><tr><td>Hora</td><td>${e.local ? esc(e.local.replace('T', ' ')) + ' (local)' + (e.utc ? ` · ${esc(e.utc.slice(11, 16))} UTC` : '') : esc(e.cuando ?? '—')}</td><td></td></tr><tr><td>Estado</td><td>${esc(e.estado)}</td><td></td></tr></table>${disc}
<p class="src">${esc(f.cita)}<br>${esc(f.url)}</p>`);
});

// ⏱️ Escenario de llegada: camino D8 aguas abajo desde un punto, a la velocidad elegida
const cellLonLat = (k) => gridToLonLat(G, (k % G.w) + 0.5, ((k / G.w) | 0) + 0.5).map((v) => +v.toFixed(6));
$('#tDep').innerHTML = timed.filter((e) => e.min != null).map((e) => `<option value="${e.id}">${hhmm(e.min)} · ${esc(e.texto.slice(0, 38))}${e.texto.length > 38 ? '…' : ''}</option>`).join('');
$('#tDep').value = TT.dep; if (TT.vManual > 0) { $('#tVel').value = TT.vManual; $('#tVelTxt').textContent = fmt(TT.vManual, 1); } else $('#tVelTxt').textContent = '–';
function travelFrom(lon, lat) {
  const [px, py] = toPx(lon, lat), i = Math.floor(px), j = Math.floor(py);
  if (i < 1 || j < 1 || i >= G.w - 1 || j >= G.h - 1) return showToast('Fuera de la zona calculada');
  TT.k0 = snap(i, j); TT.path = downstreamPath(dirAt, G.w, G.h, TT.k0, G.celdaM); travelRender(); state.tMin = Math.max(state.tMin, EV.find((e) => e.id === TT.dep)?.min ?? state.tMin); $('#t').value = state.tMin; renderTime();
}
function travelRender() {
  const p = TT.path; if (!p) { for (const id of ['tpath', 'tmarks', 'towns', 'tfront']) map.getSource(id)?.setData({ type: 'FeatureCollection', features: [] }); $('#tOut').innerHTML = ''; return; }
  const dep = EV.find((e) => e.id === TT.dep), coords = p.cells.map(cellLonLat), marks = [];
  TT.ens = ensembleFor(TT.k0, p.cells.at(-1), p.distM.at(-1));
  const chosen = TT.method === 'manual' ? null : TT.ens.find((r) => r.id === TT.method);
  TT.v = chosen ? chosen.velocityMs : TT.vManual;
  $('#tVelBox').hidden = TT.method !== 'manual';
  if (!(TT.v > 0)) { $('#tOut').innerHTML = 'Elige una velocidad con la barra: sin fuente no se pone ninguna por defecto.'; for (const id of ['tpath', 'tmarks', 'towns', 'tfront']) map.getSource(id)?.setData({ type: 'FeatureCollection', features: [] }); return; }
  for (let m = 10; ; m += 10) { const idx = frontIndex(p, TT.v, m); if (idx >= p.cells.length - 1 || idx < 0) break; marks.push({ type: 'Feature', properties: { label: `+${m} min` }, geometry: { type: 'Point', coordinates: coords[idx] } }); if (marks.length > 40) break; }
  map.getSource('tpath')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  map.getSource('tmarks')?.setData({ type: 'FeatureCollection', features: marks });
  TT.arrivals = TOWNS.map((tw) => { const [tx, ty] = toPx(tw.lon, tw.lat), c = closestOnPath(p, G.w, Math.floor(ty) * G.w + Math.floor(tx)); return { ...tw, offM: c.offCells * G.celdaM, distM: c.distM, idx: c.idx }; })
    .filter((a) => a.offM <= 1500 && a.idx > 0).sort((a, b) => a.distM - b.distM)
    .map((a) => { const band = arrivalBand(a.distM, ensembleFor(TT.k0, p.cells[a.idx], a.distM)); return { ...a, min: travelMinutes(a.distM, TT.v), at: dep.min + travelMinutes(a.distM, TT.v), band }; });
  map.getSource('towns')?.setData({ type: 'FeatureCollection', features: TT.arrivals.map((a) => ({ type: 'Feature', properties: { label: `${a.nombre} ${clock(a.at)}` }, geometry: { type: 'Point', coordinates: coords[a.idx] } })) });
  const totalMin = travelMinutes(p.distM.at(-1), TT.v);
  $('#tOut').innerHTML = `Camino del agua según el relieve: <b>${fmt(p.distM.at(-1) / 1000, 1)} km</b> hasta el mar o el borde · a ${fmt(TT.v, 1)} m/s, <b>${fmt(totalMin)} min</b>.<br>
Si sale a las <b>${hhmm(dep.min)}</b> (${esc(dep.texto.slice(0, 60))}):<br>${TT.arrivals.length ? TT.arrivals.map((a) => `· ${esc(a.nombre)}: <b>${clock(a.at)}</b> (+${fmt(a.min)} min; horquilla de los métodos ${a.band ? `${clock(dep.min + a.band.minMin)}–${clock(dep.min + a.band.maxMin)}` : '–'}; el cauce del modelo pasa a ${fmt(a.offM)} m)${a.at < ESA.min ? ` → <b style="color:#ff9f0a">${fmt(ESA.min - a.at)} min antes del ES-Alert</b>` : ` → ${fmt(a.at - ESA.min)} min después del ES-Alert`}`).join('<br>') : 'ningún municipio de la lista a menos de 1,5 km del camino.'}<br>
${TT.dep === 'cedex_pico' ? '<span class="src">Salida a las 19:35: el texto del CEDEX (vía Roldán 2025) une el pico de 3.500 m³/s a esa hora con el agua «desplazándose por Chiva» a 14 m/s, pero no precisa en qué punto se dio el pico. Es una lectura posible, no confirmada.</span><br>' : TT.dep === 'poyo_1855' ? '<span class="src">Las 18:55 son la hora del último dato del aforo (cruce con la A-3), aguas abajo de Chiva: para este caso, toca un punto del cauce cerca de ese cruce con «Elegir punto».</span><br>' : ''}<table class="tbl" style="margin:6px 0"><tr><td><b>Método</b></td><td><b>Velocidad media · tiempo de todo el recorrido</b></td><td><b>Ámbito</b></td></tr>${TT.ens.map((r) => `<tr${r.id === TT.method ? ' style="color:#fff;font-weight:700"' : ''}><td>${esc(r.label)}<br><small>${r.basis === 'ESTIMACION' ? 'ESTIMACIÓN SENDA' : 'OBSERVADO'}</small></td><td>${fmt(r.velocityMs, 1)} m/s · ${fmt(r.tcMin)} min</td><td style="white-space:normal;text-align:left">${esc(r.validity)}<br><small>${esc(r.source)}</small></td></tr>`).join('')}</table>
<span class="src">Pendiente media del recorrido: ${fmt(100 * meanSlope(elevAt(TT.k0), elevAt(p.cells.at(-1)), p.distM.at(-1)), 2)} % (relieve reducido de ${fmt(R4.celdaM)} m). Los métodos no coinciden porque miden cosas distintas: el CEDEX dio la velocidad del agua en la punta de una crecida ya formada; Témez y Kirpich estiman el <b>tiempo de concentración</b>, la respuesta media de la cuenca a la lluvia, y por eso dan llegadas mucho más tardías. <b>Para una crecida en marcha, el dato observado es la mejor referencia</b>; las fórmulas sirven cuando no hay ninguna medida, y la horquilla, para planificar con margen.</span><br>
<span class="src">ESCENARIO: velocidad constante (${fmt(C.velocidad_chiva.valor)} m/s es la del CEDEX por Chiva, preliminar; aplicarla a todo el recorrido es una suposición). Camino D8 sin encauzamientos: en la llanura puede ir por otro lado. Municipios: punto de Nominatim (OSM).</span>`;
}
$('#travelBtn').addEventListener('click', () => { panelMini(false); $('#tOut').scrollIntoView({ behavior: 'smooth', block: 'center' }); if (!TT.path) { const [tx, ty] = toPx(TOWNS[0].lon, TOWNS[0].lat); TT.k0 = snap(Math.floor(tx), Math.floor(ty)); TT.path = downstreamPath(dirAt, G.w, G.h, TT.k0, G.celdaM); travelRender(); renderTime(); } });
$('#tChiva').addEventListener('click', () => { const c = TOWNS.find((t) => t.nombre === 'Chiva'); TT.dep = 'cedex_pico'; $('#tDep').value = TT.dep; LS.set('senda.d4d.dep', TT.dep); travelFrom(c.lon, c.lat); map.fitBounds([[-0.75, 39.38], [-0.33, 39.5]], { padding: 40, pitch: 50 }); });
$('#tPick').addEventListener('click', () => { TT.pick = !TT.pick; $('#tPick').classList.toggle('on', TT.pick); $('#msg').textContent = 'Toca dónde sale el agua'; $('#msg').hidden = !TT.pick; });
$('#tClear').addEventListener('click', () => { TT.path = null; travelRender(); });
$('#tDep').addEventListener('change', (e) => { TT.dep = e.target.value; LS.set('senda.d4d.dep', TT.dep); travelRender(); renderTime(); });
$('#tMeth').value = TT.method;
$('#tMeth').addEventListener('change', (e) => { TT.method = e.target.value; LS.set('senda.d4d.meth', TT.method); if (TT.method === 'manual' && !(TT.vManual > 0)) $('#tVelTxt').textContent = '–'; travelRender(); renderTime(); });
$('#tVel').addEventListener('input', (e) => { TT.vManual = +e.target.value; LS.set('senda.d4d.v', TT.vManual); $('#tVelTxt').textContent = fmt(TT.vManual, 1); travelRender(); renderTime(); });
$('#t').value = state.tMin;
$('#t').addEventListener('input', (e) => { state.tMin = +e.target.value; LS.set('senda.d4d.t', state.tMin); renderTime(); });
let traf = 0;
$('#tplay').addEventListener('click', () => {
  state.tplaying = !state.tplaying; $('#tplay').textContent = state.tplaying ? '❚❚' : '▶';
  let last = performance.now();
  const step = (now) => { if (!state.tplaying) return; if (now - last > 90) { last = now; state.tMin = state.tMin >= 1800 ? 360 : state.tMin + 5; $('#t').value = state.tMin; renderTime(); } traf = requestAnimationFrame(step); };
  if (state.tplaying) traf = requestAnimationFrame(step); else cancelAnimationFrame(traf);
});
map.on('style.load', () => { travelRender(); renderTime(); });

// ── 🌊 Simulación hidrodinámica 2D: fotogramas cada 15 min desde las 16:55 locales ──
const SWE_T0 = 16 * 60 + 55, SW = SWE.malla.w, SH = SWE.malla.h;
state.sweVar = LS.get('senda.d4d.swevar', 'extension'); state.sweMode = 'now';
function decodeRle(bytes, off, len, out) { let p = off, k = 0; const end = off + len; while (p < end) { const v = bytes[p++]; if (v === 255) { const r = bytes[p] | (bytes[p + 1] << 8); p += 2; out.fill(0, k, k + r); k += r; } else out[k++] = v; } return out; }
const sweCol = (v) => (v < 5 ? [155, 231, 255, 150] : v < 15 ? [58, 160, 255, 185] : v < 30 ? [22, 82, 216, 210] : [122, 43, 214, 225]);
const sweBuf = new Uint8Array(SW * SH); let sweKey = '';
function renderSwe() {
  const V = SWEV.find((v) => v.id === state.sweVar) ?? SWEV[0], src = map.getSource('swe'); if (!src) return;
  let data = null, label;
  if (state.sweMode === 'max') { data = V.max; label = 'calado máximo de toda la simulación'; }
  else { const idx = Math.floor((state.tMin - SWE_T0) / 15) - 1; if (idx >= 0) { const f = V.fotogramas[Math.min(idx, V.fotogramas.length - 1)]; data = decodeRle(V.frames, f.offset, f.bytes, sweBuf); label = `agua a las ${hhmm((SWE_T0 + Math.round(f.tSeg / 60)) % 1440)}${idx >= V.fotogramas.length ? ' (fin de la simulación)' : ''}`; } else label = 'la simulación empieza a las 16:55'; }
  const key = `${V.id}|${state.sweMode}|${label}`; if (key === sweKey) return; sweKey = key;
  const rgba = new Uint8ClampedArray(SW * SH * 4); let wet = 0;
  if (data) for (let k = 0; k < data.length; k++) { const v = data[k]; if (!v) continue; rgba.set(sweCol(v), k * 4); wet++; }
  putRGBA(cSwe, rgba); src.play?.(); src.pause?.();
  const cell = SWE.malla.celdaM ** 2 / 1e6;
  $('#sweOut').innerHTML = `${esc(label)} · <b>${fmt(wet * cell, 1)} km²</b> con agua (≥ ${fmt(SWE.umbralMojadoM, 1)} m) · variante n = ${fmt(V.n, 3)}, bajada en ${V.recesionH} h<br>${V.municipios.filter((m) => m.llegadaMin != null).map((m) => `${esc(m.nombre)}: llega ${clock(SWE_T0 + m.llegadaMin)} · calado máx. ${fmt(m.calMaxM, 1)} m`).join(' · ') || 'el agua no llega a los puntos de los municipios de la lista'}`;
}
$('#sweVar').innerHTML = SWEV.map((v) => { const r = SWE.calibracion.find((c) => c.n === v.n && c.recesionH === v.recesionH); return `<option value="${v.id}">${v.id === 'extension' ? 'mejor superficie' : 'más rápida'} · CSI ${fmt(r?.csi, 3)}</option>`; }).join('');
$('#sweVar').value = state.sweVar;
$('#sweVar').addEventListener('change', (e) => { state.sweVar = e.target.value; LS.set('senda.d4d.swevar', state.sweVar); renderSwe(); });
$('#sweMode').addEventListener('change', (e) => { state.sweMode = e.target.value; renderSwe(); });

/** Velocidad media del frente simulado (línea recta entrada → municipio más rápido alcanzado), calculada de los datos. */
function sweFrontTxt() {
  const fastV = SWEV.find((v) => v.id === 'tiempo') ?? SWEV[0], hit = fastV.municipios.filter((m) => m.llegadaMin != null).sort((a, b) => a.llegadaMin - b.llegadaMin)[0];
  if (!hit) return 'el frente simulado no llega a los municipios de la lista';
  const tw = TOWNS.find((t) => t.nombre === hit.nombre), [lo, la] = SWE.entrada.lonlat, R = 6371e3, rad = Math.PI / 180;
  const dM = 2 * R * Math.asin(Math.sqrt(Math.sin(((tw.lat - la) * rad) / 2) ** 2 + Math.cos(la * rad) * Math.cos(tw.lat * rad) * Math.sin(((tw.lon - lo) * rad) / 2) ** 2));
  return `el frente simulado avanza a ≈ ${fmt(dM / (hit.llegadaMin * 60), 1)} m/s (${fmt(dM / 1000, 1)} km en línea recta hasta ${esc(hit.nombre)} en ${Math.floor(hit.llegadaMin / 60)} h ${hit.llegadaMin % 60} min, en la variante más rápida, contando desde el inicio de la subida)`;
}

// ── 🔌 Conectores: datos de la red del organismo (solo en memoria; sustituyen a las estimaciones) ──
const STATUS = { conectado: 'CONECTADO', importable: 'IMPORTABLE', requiere_clave: 'REQUIERE CLAVE', requiere_convenio: 'REQUIERE CONVENIO' };
$('#cCat').innerHTML = CONNECTORS.map((c) => `<div class="ev"><span><b>${esc(c.label)}</b><span class="chip ${c.status}">${STATUS[c.status]}</span><small>${esc(c.note)}</small></span></div>`).join('');
function renderImports() {
  $('#cOut').innerHTML = IMP.length ? IMP.map((x, i) => `<div>✅ <span class="badge imp">IMPORTADO</span><b>${esc(x.meta.station || SERIES_KINDS[x.kind].label)}</b> · ${x.points.length} datos de ${esc(SERIES_KINDS[x.kind].label.toLowerCase())} (${esc(x.unit)}) · fuente: ${esc(x.meta.source.name)}${x.meta.source.license ? ` · licencia: ${esc(x.meta.source.license)}` : ''}<br><small>SHA-256 ${x.sha256.slice(0, 16)}… · <a href="#" data-rm="${i}" style="color:#ff453a">quitar</a></small></div>`).join('') : '';
}
$('#cOut').addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (!r) return; e.preventDefault(); IMP.splice(+r.dataset.rm, 1); renderImports(); renderTime(); });
$('#cFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return; const text = await f.text(); e.target.value = '';
  const res = parseSeries(text, { kind: $('#cKind').value, station: $('#cSta').value.trim() || null, source: { name: $('#cSrc').value.trim(), license: $('#cLic').value.trim() || null, file: f.name } });
  if (!res.ok) { $('#cOut').innerHTML = `<b style="color:#ff453a">No se ha cargado:</b><br>${res.errors.slice(0, 8).map((x) => `· ${x.line ? `línea ${x.line}: ` : ''}${esc(x.msg)}`).join('<br>')}${res.errors.length > 8 ? `<br>… y ${res.errors.length - 8} más` : ''}`; return; }
  IMP.push({ ...res, sha256: await sha256Hex(text) }); renderImports(); renderTime(); showToast('Datos cargados: mandan sobre las estimaciones');
});
$('#cSample').addEventListener('click', () => showInfo(`<h3>Formato para cargar datos</h3><p>Un fichero CSV con cabecera <b>hora,valor</b> (o separado por punto y coma) o un JSON con <b>[{"hora": …, "valor": …}]</b>. La hora debe llevar <b>zona horaria</b>: sin ella no se acepta, porque una hora ambigua puede mover una alerta una o dos horas.</p>
<pre style="background:#f2f2f7;border-radius:10px;padding:10px;font-size:12px;overflow:auto">hora,valor
2024-10-29T17:30+01:00,10
2024-10-29T18:00+01:00,20
2024-10-29T18:30Z,30</pre><p>Unidades: caudal en m³/s, lluvia en mm por intervalo, nivel en m. Hay que indicar quién mide el dato (fuente). El fichero no sale de este dispositivo y se olvida al cerrar la página.</p><p class="src">Los valores 10, 20 y 30 solo enseñan el formato: no son datos de ningún suceso.</p>`));
renderImports();

// ── PRO (escritorio): paquete de datos con procedencia y huellas ──
const sha = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
if (PRO) {
  $('#proBox').hidden = false;
  $('#proNote').textContent = 'Incluye la cronología con fuentes y estados, las constantes, la calibración completa, el escenario de llegada activo y la huella SHA-256 de cada capa binaria para poder auditarlo.';
  $('#expPack').addEventListener('click', async () => {
    const pack = {
      producto: 'SENDA · DANA 4D · paquete de datos', generadoUTC: new Date().toISOString(), aviso: 'Contiene datos REALES (con fuente), ESTIMADOS por terceros y MODELO/ESCENARIO de SENDA, etiquetados uno a uno.',
      telemetria: TEL, metodo: meta.metodo, calibracion: meta.calibracion, banera: meta.banera, observado: meta.observado, procedenciaRelieve: meta.procedencia,
      huellas: { 'hand_roi.bin': await sha(handBuf), 'obs_roi.bin': await sha(obsBuf), 'dir_z12.bin': await sha(dirBuf), 'dem_d4.bin': await sha(demBuf) },
      datosImportados: IMP.map(({ kind, unit, points, meta: m, sha256 }) => ({ basis: 'MEDIDO_IMPORTADO', kind, unit, estacion: m.station, fuente: m.source, sha256, puntos: points.map((q) => [q.iso, q.value]) })),
      metodosVelocidad: TT.ens,
      escenarioLlegada: TT.path ? { basis: 'ESCENARIO', sale: TT.dep, metodo: TT.method, velocidadMs: TT.v, longitudM: Math.round(TT.path.distM.at(-1)), camino: TT.path.cells.map(cellLonLat), municipios: TT.arrivals.map(({ nombre, offM, distM, min, at, band }) => ({ nombre, distanciaCaminoM: Math.round(distM), separacionM: Math.round(offM), minutos: +min.toFixed(1), horaLocal: clock(at), horquillaMetodosMin: band ? [+band.minMin.toFixed(1), +band.maxMin.toFixed(1)] : null })) } : null,
    };
    const r = await saveBlob(new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }), `senda-dana4d-paquete-${new Date().toISOString().slice(0, 10)}.json`); showToast(r.ok ? `Guardado en ${r.where}` : 'No se pudo guardar');
  });
  $('#expCsv').addEventListener('click', async () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['id', 'hora_local', 'hora_utc', 'tipo', 'valor', 'unidad', 'lugar', 'texto', 'estado', 'fuente', 'url'].join(',')].concat(TEL.eventos.map((e) => [e.id, e.local ?? e.cuando, e.utc ?? (e.local ? new Date(localToUtcMs(e.local, OFF)).toISOString() : ''), e.tipo, e.valor, e.unidad, e.lugar, e.texto, e.estado, TEL.fuentes[e.fuente].cita, TEL.fuentes[e.fuente].url].map(q).join(',')));
    const r = await saveBlob(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' }), 'senda-dana4d-cronologia.csv'); showToast(r.ok ? `Guardado en ${r.where}` : 'No se pudo guardar');
  });
  if (window.__TAURI_INTERNALS__ || new URLSearchParams(location.search).has('pro')) { const b = Object.assign(document.createElement('button'), { className: 'tb', textContent: '←', title: 'Volver al Command Center' }); b.setAttribute('aria-label', 'Volver'); b.addEventListener('click', () => history.length > 1 ? history.back() : (location.href = '/')); $('#top').prepend(b); }
}
function showInfo(html) { $('#infoBody').innerHTML = html; $('#info').hidden = false; }
$('#infoX').addEventListener('click', () => { $('#info').hidden = true; });
let toastT; function showToast(t) { const m = $('#msg'); m.textContent = t; m.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { if (!state.basinMode) m.hidden = true; }, 1800); }
const HELP = `<h3>Cómo leer la DANA 4D</h3>
<p><b>3D + nivel del agua.</b> El mapa tiene el relieve real (realzado ×2 porque la llanura es casi plana). La barra sube el agua desde los cauces: verás qué se inunda primero.</p>
<h4>Qué miras</h4><ul>
<li><span class="badge real">REAL</span> En verde, el agua que vio el satélite (Copernicus EMS, activación EMSR773). En l'Horta Sud, imagen del 31-10-2024 a las 10:22 UTC.</li>
<li><span class="badge model">MODELO</span> Cauces calculados con el relieve: por dónde baja el agua y cuánta cuenca recoge cada tramo.</li>
<li><span class="badge scen">ESCENARIO</span> En azul, lo que quedaría bajo el agua con el nivel que elijas sobre el cauce.</li></ul>
<h4>La línea del tiempo (arriba)</h4><ul><li>Mueve la hora del 29-10 (hora local) o pulsa ▶: verás el último caudal medido en el aforo del Poyo, si estaba por encima del umbral de aviso (150 m³/s) o de la capacidad del cauce urbano (800 m³/s), y cuánto faltaba para el ES-Alert.</li><li>Cada dato de la cronología lleva su fuente, su tipo (MEDIDO, ESTIMADO, OFICIAL) y si está verificado. Si dos fuentes no coinciden, se ven las dos.</li><li>⏱️ «¿Cuándo llega?»: elige de dónde sale el agua y a qué hora; el punto rojo avanza por el cauce con la hora y ves a qué hora pasaría junto a cada municipio.</li></ul><h4>Para investigar</h4><ul><li>💧 «¿De dónde viene el agua?»: toca un punto y verás toda su cuenca y sus km².</li><li>Toca cualquier punto: si el satélite vio agua, su altura sobre el cauce y si se inunda al nivel elegido.</li><li>🔬 Ciencia: cuánto acierta el modelo frente al satélite, con qué nivel acierta más y por qué no acierta más.</li></ul>
<h4>Lo que este modelo NO es</h4><ul><li>No tiene lluvia, caudal ni horas: ordena qué se inunda antes, no cuándo ni con qué calado.</li><li>El nivel que mejor encaja se ha calibrado con la mancha real: no es una predicción hecha antes del suceso.</li><li>No incluye diques, colectores, puentes ni encauzamientos.</li></ul>
<p class="src">${esc(ems.cita)}. Relieve: Terrain Tiles (AWS Open Data). Fondo «Satélite»: ortofoto PNOA del IGN <b>actual</b>, no la de 2024. Fondos de la NASA (🗺️): MODIS del ${DAY.split('-').reverse().join('-')}, el día siguiente.</p>`;
$('#helpBtn').addEventListener('click', () => showInfo(HELP));
const panelMini = (on) => { $('#panel').classList.toggle('mini', on); LS.set('senda.d4d.mini', on); };
$('#grab').addEventListener('click', () => panelMini(!$('#panel').classList.contains('mini')));
panelMini(LS.get('senda.d4d.mini', true));
if (!LS.get('senda.d4d.welcomed', false)) { LS.set('senda.d4d.welcomed', true); setTimeout(() => showInfo(HELP), 800); }
globalThis.sendaDana4d = { map, state, render, basinAt, upstream, G };
