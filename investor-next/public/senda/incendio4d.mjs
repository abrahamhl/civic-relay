// SENDA · Incendio 4D (San Martín de Valdeiglesias, 23-07-2026): mapa 3D con relieve real + tiempo.
// Todo lo que se dibuja lleva su etiqueta: REAL (medido), MODELO (calculado por SENDA) o ESCENARIO (lo eliges tú).
import { MAP_STYLES, styleFor, TERRAIN_SOURCE } from './core/map-style.mjs';
import { gridCorners, fireEllipse, plumeRings, arrivalRGBA, arrivalAreaHa, lengthToBreadth } from './core/fire4d.mjs';
import { CASE_SMV_2026 } from './core/fire-watch.mjs';
import { haversineM } from './core/route-planner.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const D = '/senda/data/smv2026/';
const IGN = CASE_SMV_2026.ignition;

const [real, fire, effis, gfs] = await Promise.all(['real.json', 'fire3d.json', 'effis_perimetros.json', 'gfs_20260723_12z.json'].map((f) => fetch(D + f).then((r) => r.json())));
const arrival = new Uint16Array(await (await fetch(D + 'arrival_roi.bin')).arrayBuffer());
const ROI = fire.conjunto.roi, M = fire.malla;
const roiCorners = gridCorners({ x0: M.x0 + ROI.i0 * M.dx, y1: M.y1 - ROI.j0 * M.dx, res: M.dx, w: ROI.w, h: ROI.h });
const sceneCorners = real.esquinas_lonlat;
const T0_UTC = Date.UTC(2026, 6, 23, 15, 0); // ignición del MODELO calibrado (fire3d.conjunto.llegada.ignicionUTC = 15:00)
const effisMain = effis.capas['modis.ba.poly.season'].features.filter((f) => String(f.properties.id) === '592438');
const P = fire.pluma;

// ── Capas (cada una con su etiqueta, explicación y fuente) ──
const LAYERS = [
  { id: 'ign', label: 'Inicio del fuego', badge: 'real', on: true, sub: 'M-501, km 57 (posición aproximada)', info: `<p>Según la Guardia Civil, el fuego empezó a partir de un coche de combustión en llamas en la calzada, junto al km 57 de la M-501, a la entrada de San Martín de Valdeiglesias.</p><p class="src">${CASE_SMV_2026.facts.slice(0, 1).map((f) => esc(f.src)).join('')}</p>` },
  { id: 'effis', label: 'Perímetro final EFFIS', badge: 'real', on: true, sub: `${Number(effisMain[0]?.properties.AREA_HA ?? 19939).toLocaleString('es-ES')} ha · inicio EFFIS ${esc(String(effisMain[0]?.properties.FIREDATE ?? '').slice(0, 16))}`, info: `<p>Área quemada cartografiada por EFFIS (Copernicus, Centro Común de Investigación de la UE) con satélite. Es la superficie total, no la evolución hora a hora.</p><p class="src">${esc(effis.fuente)}</p>` },
  { id: 'dnbr', label: 'Severidad (dNBR, 08-08)', badge: 'real', on: false, sub: `Sentinel-2 · ${real.fechas.d0808.ha_moderada_o_mas.toLocaleString('es-ES')} ha de severidad moderada o más`, info: '<p>Diferencia normalizada de quemado (dNBR) entre la imagen de antes (16-07) y la del 08-08: cuanto más rojo, más se quemó la vegetación. Calculado por SENDA con datos Copernicus Sentinel-2.</p>' },
  { id: 'front', label: 'Avance del frente', badge: 'model', on: true, sub: 'Minuto a minuto desde la ignición del modelo (15:00 UTC)', info: `<p>Tiempo de llegada del fuego a cada celda de 100 m calculado por el modelo de SENDA (viento 3D con conservación de masa sobre terreno real, calibrado con la cicatriz del 24-07). Amarillo = frente de los últimos 45 min; rojo oscuro = ya quemado.</p><p>Calibración guardada: giro del viento ${fire.conjunto.llegada.giroVientoDeg}°, multiplicador de velocidad ${fire.conjunto.llegada.multVelocidad}. Es un MODELO, no la evolución real medida.</p>` },
  { id: 'plume', label: 'Columna de humo 3D', badge: 'model', on: true, sub: `Briggs (1975) · ${(P.alturaFinalM / 1000).toLocaleString('es-ES')} km de altura · viento en la capa de mezcla ${P.vientoMezclaMs} m/s`, info: `<p>Eje de la pluma doblada por el viento: Δh(x) = 1,6·F^(1/3)·x^(2/3)/U (Briggs, 1975), con flujo de flotabilidad F = ${P.flujoFlotabilidad.toLocaleString('es-ES')} m⁴/s³ (calor liberado ${P.calorGW} GW, intensidad ${P.intensidadKWm.toLocaleString('es-ES')} kW/m) y U = ${P.vientoMezclaMs} m/s. Radio de la columna = 0,5·altura (supuesto declarado). Pavesas: mediana ${P.pavesas.p50M} m y P90 ${P.pavesas.p90M} m a sotavento (${esc(P.pavesas.supuestos)}).</p>` },
  { id: 'wind', label: 'Viento a 10 m', badge: 'model', on: true, sub: 'Previsión NOAA GFS 0,25°, pasada 23-07 12 UTC', info: `<p>Flechas hacia donde sopla el viento, longitud según la velocidad. Es una previsión meteorológica global (no una estación): resolución ≈ 25 km.</p><p class="src">${esc(gfs.source)}</p>` },
  { id: 'roads', label: 'Carreteras del caso', badge: 'real', on: true, sub: 'M-501 y N-403 (trazado simplificado)', info: `<p>Trazado simplificado de las vías que se cortaron. ${esc(CASE_SMV_2026.facts[5].text)}</p>` },
  { id: 'scen', label: 'Escenario de viento', badge: 'scen', on: false, sub: 'Elipse de Alexander (1985) con tus valores', info: '<p>Forma que tendría el fuego con el viento que elijas abajo: relación longitud/anchura LB = 1 + 8,729·(1 − e^(−0,030·U))^2,155 (Alexander, 1985) y cociente cabeza/cola de Anderson (1983). Sirve para comparar, no para predecir: no tiene en cuenta relieve ni combustible.</p>' },
];
const state = { t: 0, playing: false, scene: 'd0724', on: Object.fromEntries(LAYERS.map((l) => [l.id, LS.get(`senda.f4d.${l.id}`, l.on)])), draw: false, pts: LS.get('senda.f4d.draw', []), closed: LS.get('senda.f4d.closed', false) };

// ── Mapa con relieve real ──
maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
const STYLES = ['satelite', 'relieve', 'mapa', 'dia', 'termico', 'noche', 'topo'];
let styleId = LS.get('senda.f4d.style', 'satelite');
const map = new maplibregl.Map({ container: 'map', style: styleFor(styleId), center: [IGN.lon + 0.06, IGN.lat - 0.07], zoom: 10.6, pitch: 58, bearing: -25, maxPitch: 80, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
const frontCanvas = Object.assign(document.createElement('canvas'), { width: ROI.w, height: ROI.h });

function addAll() {
  if (!map.getSource('dem')) map.addSource('dem', { ...TERRAIN_SOURCE });
  map.setTerrain({ source: 'dem', exaggeration: 1.4 }); // ×1,4: realce de dibujo para ver los valles (declarado)
  for (const s of ['pre', 'd0724', 'd0729', 'd0808']) if (!map.getSource(`s2-${s}`)) map.addSource(`s2-${s}`, { type: 'image', url: `${D}tci_${s}.jpg`, coordinates: sceneCorners });
  if (!map.getSource('dnbr')) map.addSource('dnbr', { type: 'image', url: `${D}dnbr_d0808.png`, coordinates: sceneCorners });
  for (const s of ['pre', 'd0724', 'd0729', 'd0808']) if (!map.getLayer(`s2-${s}`)) map.addLayer({ id: `s2-${s}`, type: 'raster', source: `s2-${s}`, paint: { 'raster-opacity': 0.92, 'raster-fade-duration': 0 }, layout: { visibility: 'none' } });
  if (!map.getLayer('dnbr')) map.addLayer({ id: 'dnbr', type: 'raster', source: 'dnbr', paint: { 'raster-opacity': 0.75 } });
  if (!map.getSource('front')) map.addSource('front', { type: 'canvas', canvas: frontCanvas, coordinates: roiCorners, animate: false });
  if (!map.getLayer('front')) map.addLayer({ id: 'front', type: 'raster', source: 'front', paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } });
  const gj = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data }); else map.getSource(id).setData(data); };
  gj('effis', { type: 'FeatureCollection', features: effisMain });
  gj('roads', { type: 'FeatureCollection', features: CASE_SMV_2026.roads.map((r) => ({ type: 'Feature', properties: { name: r.name }, geometry: { type: 'LineString', coordinates: r.path.map((p) => [p.lon, p.lat]) } })) });
  gj('ign', { type: 'Feature', properties: { label: 'Inicio · M-501 km 57' }, geometry: { type: 'Point', coordinates: [IGN.lon, IGN.lat] } });
  gj('plume', plumeRings({ lat: IGN.lat, lon: IGN.lon, F: P.flujoFlotabilidad, U: P.vientoMezclaMs, toDeg: P.dirHacia, zTop: P.alturaFinalM }));
  gj('wind', { type: 'FeatureCollection', features: [] }); gj('scen', { type: 'FeatureCollection', features: [] }); gj('draw', { type: 'FeatureCollection', features: [] });
  const L = (def) => { if (!map.getLayer(def.id)) map.addLayer(def); };
  L({ id: 'effis', type: 'line', source: 'effis', paint: { 'line-color': '#34c759', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
  L({ id: 'roads', type: 'line', source: 'roads', paint: { 'line-color': '#ffd60a', 'line-width': 3 } });
  L({ id: 'roads-lbl', type: 'symbol', source: 'roads', layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 }, paint: { 'text-color': '#ffd60a', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
  L({ id: 'wind', type: 'line', source: 'wind', paint: { 'line-color': '#64d2ff', 'line-width': 2.5 }, layout: { 'line-cap': 'round' } });
  L({ id: 'wind-lbl', type: 'symbol', source: 'wind', filter: ['has', 'kmh'], layout: { 'text-field': ['concat', ['to-string', ['get', 'kmh']], ' km/h'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1] }, paint: { 'text-color': '#64d2ff', 'text-halo-color': '#000', 'text-halo-width': 1.4 } });
  L({ id: 'scen', type: 'fill', source: 'scen', paint: { 'fill-color': '#bf5af2', 'fill-opacity': 0.22 } });
  L({ id: 'scen-line', type: 'line', source: 'scen', paint: { 'line-color': '#bf5af2', 'line-width': 2 } });
  L({ id: 'plume', type: 'fill-extrusion', source: 'plume', paint: { 'fill-extrusion-color': '#d1d1d6', 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-opacity': 0.6 } });
  L({ id: 'draw', type: 'line', source: 'draw', paint: { 'line-color': '#bf5af2', 'line-width': 3 } });
  L({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#bf5af2', 'circle-stroke-width': 2 } });
  L({ id: 'ign', type: 'circle', source: 'ign', paint: { 'circle-radius': 9, 'circle-color': '#ff3b30', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
  L({ id: 'ign-lbl', type: 'symbol', source: 'ign', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.6] }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.6 } });
  render();
}
map.on('style.load', addAll);

// ── Dibujo de cada instante ──
function windAt(tUtc) {
  const tt = gfs.times.reduce((b, x) => (Date.parse(x.validUTC) <= tUtc ? x : b), gfs.times[0]);
  const U = tt.fields['UGRD@10 m above ground'], V = tt.fields['VGRD@10 m above ground'], feats = [];
  let near = null, nd = Infinity;
  gfs.grid.lats.forEach((la, i) => gfs.grid.lons.forEach((lo, j) => {
    const u = U[i][j], v = V[i][j], kmh = Math.hypot(u, v) * 3.6, k = 0.006 * kmh / 3.6; // flecha: ~0,006° por m/s
    const tip = [lo + k * u / Math.hypot(u, v || 1e-9), la + k * v / Math.hypot(u || 1e-9, v)];
    const ang = Math.atan2(v, u), h1 = [tip[0] - 0.012 * Math.cos(ang - 0.5), tip[1] - 0.012 * Math.sin(ang - 0.5)], h2 = [tip[0] - 0.012 * Math.cos(ang + 0.5), tip[1] - 0.012 * Math.sin(ang + 0.5)];
    feats.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[lo, la], tip], [h1, tip, h2]] } });
    feats.push({ type: 'Feature', properties: { kmh: Math.round(kmh) }, geometry: { type: 'Point', coordinates: [lo, la] } });
    const d = haversineM([lo, la], [IGN.lon, IGN.lat]); if (d < nd) { nd = d; near = { kmh, toDeg: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360, valid: tt.validUTC }; }
  }));
  return { fc: { type: 'FeatureCollection', features: feats }, near };
}
function render() {
  if (!map.getLayer('front')) return;
  const t = state.t, tUtc = T0_UTC + t * 60_000;
  // Avance del frente (MODELO)
  const ctx = frontCanvas.getContext('2d'), img = ctx.createImageData(ROI.w, ROI.h);
  img.data.set(arrivalRGBA(arrival, ROI.w, ROI.h, t)); ctx.putImageData(img, 0, 0);
  map.getSource('front')?.play?.(); map.getSource('front')?.pause?.();
  const ha = arrivalAreaHa(arrival, t, M.dx);
  $('#kHa').textContent = Math.round(ha).toLocaleString('es-ES');
  // Viento (MODELO meteorológico)
  const w = windAt(tUtc); map.getSource('wind')?.setData(w.fc);
  $('#kWind').textContent = `${Math.round(w.near.kmh)} km/h`;
  // Escenario
  const kmh = +$('#wKmh').value, to = +$('#wTo').value, ros = +$('#wRos').value;
  $('#wv').textContent = kmh; $('#wd').textContent = to; $('#wr').textContent = ros.toLocaleString('es-ES');
  const e = fireEllipse({ lat: IGN.lat, lon: IGN.lon, rosHeadMMin: ros, windKmh: kmh, toDeg: to, tMin: Math.max(1, t) });
  map.getSource('scen')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [e.ring] } });
  state.lastScen = e;
  // Hora
  const loc = new Date(tUtc).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  $('#clock').innerHTML = `${loc} <small style="color:var(--l2);font-weight:500">(+${Math.floor(t / 60)} h ${t % 60} min)</small>`;
  // Visibilidad
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  for (const s of ['pre', 'd0724', 'd0729', 'd0808']) vis(`s2-${s}`, state.scene === s);
  vis('dnbr', state.on.dnbr); vis('front', state.on.front); vis('effis', state.on.effis); vis('roads', state.on.roads); vis('roads-lbl', state.on.roads);
  vis('plume', state.on.plume && t >= 20); vis('wind', state.on.wind); vis('wind-lbl', state.on.wind); vis('scen', state.on.scen); vis('scen-line', state.on.scen);
  vis('ign', state.on.ign); vis('ign-lbl', state.on.ign);
  if (state.on.scen) $('#drawOut').textContent = `Escenario a ${t} min: ${Math.round(e.areaHa).toLocaleString('es-ES')} ha · cabeza ${Math.round(e.headM)} m · LB ${e.LB.toFixed(2)} (con viento ${kmh} km/h). Modelo a ${t} min: ${Math.round(ha).toLocaleString('es-ES')} ha.`;
  drawSketch();
}

// ── Controles ──
$('#layers').innerHTML = LAYERS.map((l) => `<label class="layer"><input type="checkbox" data-l="${l.id}" ${state.on[l.id] ? 'checked' : ''}><span class="t"><span class="badge ${l.badge}">${{ real: 'REAL', model: 'MODELO', scen: 'ESCENARIO' }[l.badge]}</span>${esc(l.label)}<small>${l.sub}</small></span><button class="i" data-i="${l.id}" aria-label="Qué es">i</button></label>`).join('');
$('#layers').addEventListener('change', (e) => { const id = e.target.dataset.l; if (!id) return; state.on[id] = e.target.checked; LS.set(`senda.f4d.${id}`, e.target.checked); render(); });
$('#layers').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); const l = LAYERS.find((x) => x.id === b.dataset.i); showInfo(`<h3>${esc(l.label)} <span class="badge ${l.badge}">${{ real: 'REAL', model: 'MODELO', scen: 'ESCENARIO' }[l.badge]}</span></h3>${l.info}`); });
$('#t').addEventListener('input', (e) => { state.t = +e.target.value; render(); });
for (const id of ['#wKmh', '#wTo', '#wRos']) $(id).addEventListener('input', () => { if (!state.on.scen) { state.on.scen = true; $('[data-l="scen"]').checked = true; } render(); });
$('#scene').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; state.scene = b.dataset.s; document.querySelectorAll('#scene button').forEach((x) => x.classList.toggle('on', x === b)); render(); });
let raf = 0;
$('#play').addEventListener('click', () => {
  state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶';
  let last = performance.now();
  const step = (now) => { if (!state.playing) return; if (now - last > 120) { last = now; state.t = (state.t + 5) % 925; $('#t').value = state.t; render(); } raf = requestAnimationFrame(step); };
  if (state.playing) raf = requestAnimationFrame(step); else cancelAnimationFrame(raf);
});
$('#styleBtn').addEventListener('click', () => { styleId = STYLES[(STYLES.indexOf(styleId) + 1) % STYLES.length]; LS.set('senda.f4d.style', styleId); map.setStyle(styleFor(styleId), { diff: false }); showToast(`Mapa: ${MAP_STYLES[styleId].label}`); });

// ── Dibujar sobre el mapa (cortafuegos, rutas de evacuación, zonas) ──
const ringAreaHa = (pts) => { if (pts.length < 3) return 0; const la0 = pts[0][1] * Math.PI / 180, mx = 111_320 * Math.cos(la0), my = 111_320; let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += (x1 * mx) * (y2 * my) - (x2 * mx) * (y1 * my); } return Math.abs(s) / 2 / 10_000; };
function drawSketch() {
  const p = state.pts, f = p.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }));
  if (p.length > 1) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: state.closed ? [...p, p[0]] : p } });
  map.getSource('draw')?.setData({ type: 'FeatureCollection', features: f });
  if (!state.on.scen && p.length) {
    let len = 0; for (let i = 1; i < p.length; i++) len += haversineM(p[i - 1], p[i]);
    $('#drawOut').textContent = `Tu dibujo: ${p.length} puntos · ${(len / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km${state.closed ? ` · ${ringAreaHa(p).toLocaleString('es-ES', { maximumFractionDigits: 1 })} ha` : ''}`;
  }
}
const saveDraw = () => { LS.set('senda.f4d.draw', state.pts); LS.set('senda.f4d.closed', state.closed); drawSketch(); };
$('#drawBtn').addEventListener('click', () => { state.draw = !state.draw; $('#drawBtn').classList.toggle('on', state.draw); $('#drawMsg').hidden = !state.draw; $('#drawMsg').textContent = 'Toca el mapa para añadir puntos'; if (state.draw && state.closed) { state.pts = []; state.closed = false; saveDraw(); } });
$('#drawClose').addEventListener('click', () => { if (state.pts.length >= 3) { state.closed = true; state.draw = false; $('#drawBtn').classList.remove('on'); $('#drawMsg').hidden = true; saveDraw(); } });
$('#drawClear').addEventListener('click', () => { state.pts = []; state.closed = false; saveDraw(); $('#drawOut').textContent = ''; });
map.on('click', (e) => { if (!state.draw) return; state.pts.push([+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]); saveDraw(); });

// ── Ayuda: qué se mira, qué se puede cambiar y cómo se calcula ──
function showInfo(html) { $('#infoBody').innerHTML = html; $('#info').hidden = false; }
$('#infoX').addEventListener('click', () => { $('#info').hidden = true; });
let toastT; function showToast(t) { const m = $('#drawMsg'); m.textContent = t; m.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { if (!state.draw) m.hidden = true; }, 1800); }
const HELP = `<h3>Cómo leer el Incendio 4D</h3>
<p><b>4D = 3D + tiempo.</b> El mapa tiene el relieve real del terreno; la barra de tiempo mueve el modelo minuto a minuto.</p>
<h4>Qué miras</h4><ul>
<li><span class="badge real">REAL</span> Inicio en la M-501 (km 57), perímetro final de EFFIS (${Number(effisMain[0]?.properties.AREA_HA ?? 19939).toLocaleString('es-ES')} ha), imágenes Sentinel-2 de antes, 24-07, 29-07 y 08-08, y la severidad medida (dNBR).</li>
<li><span class="badge model">MODELO</span> Avance del frente (hectáreas por minuto), columna de humo (Briggs) y viento de la previsión GFS.</li>
<li><span class="badge scen">ESCENARIO</span> La elipse morada responde a tus valores de viento y velocidad.</li></ul>
<h4>Qué puedes cambiar</h4><ul><li>Tiempo (▶ o la barra), fecha del satélite, capas, tipo de mapa (🗺️), viento y velocidad del escenario.</li><li>✏️ Dibujar: líneas (cortafuegos, rutas) o zonas, con su longitud y superficie.</li></ul>
<h4>Lo que no cuadra (dicho tal cual)</h4><ul><li>Hora de inicio: EFFIS registra ${esc(String(effisMain[0]?.properties.FIREDATE ?? ''))} (zona horaria no indicada); el modelo calibrado arranca a las 15:00 UTC; el conjunto de probabilidad, a las ${esc(fire.conjunto.roi.ignicionUTC)} UTC.</li>
<li>El modelo cubre ${Math.round(arrivalAreaHa(arrival, 65534, M.dx)).toLocaleString('es-ES')} ha en su recuadro; EFFIS da ${Number(effisMain[0]?.properties.AREA_HA ?? 19939).toLocaleString('es-ES')} ha en total porque el fuego se unió con el de Almorox y siguió días después.</li>
<li>Las imágenes Sentinel-2 se colocan con sus esquinas (aprox. a unos metros); el relieve está realzado ×1,4 para verlo mejor.</li></ul>`;
$('#helpBtn').addEventListener('click', () => showInfo(HELP));
const panelMini = (on) => { $('#panel').classList.toggle('mini', on); LS.set('senda.f4d.mini', on); };
$('#grab').addEventListener('click', () => panelMini(!$('#panel').classList.contains('mini')));
panelMini(LS.get('senda.f4d.mini', true)); // empieza plegado: se ve el mapa
if (!LS.get('senda.f4d.welcomed', false)) { LS.set('senda.f4d.welcomed', true); setTimeout(() => showInfo(HELP), 800); }
globalThis.sendaFire4d = { map, state, render };
