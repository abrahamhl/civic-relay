// SENDA · Explorador 3D: cualquier zona del mundo en 3D (relieve real + edificios), topografía de lo que ves,
// perfiles, planta exterior de edificios y luz del Sol real (4D). Mismo archivo en la web, la app y el escritorio.
// Modo PRO (?pro=1, escritorio): más resolución de relieve, más área y más calidad de imagen.
import { MAP_STYLES, styleFor, TERRAIN_SOURCE, orthoCovers } from './core/map-style.mjs';
import { tilesFor, decodeTerrarium, mosaic, terrainStats, contourInterval, contours, elevationProfile, sunPosition, footprintMetrics, footprintSvg, footprintDxf, sampleHeight } from './core/geo-survey.mjs';
import { saveBlob } from './save-file.mjs';

const $ = (s) => document.querySelector(s);
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const PRO = new URLSearchParams(location.search).has('pro') || !!window.__TAURI_INTERNALS__ || (() => { try { return localStorage.getItem('senda.pro') === '1'; } catch { return false; } })();
const LIM = PRO ? { z: 15, tiles: 64, px: Math.min(devicePixelRatio || 1, 2) } : { z: 14, tiles: 16, px: Math.min(devicePixelRatio || 1, 1.5) }; // límites de la app (rendimiento)
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
const say = (t, ms = 2600) => { const m = $('#msg'); m.textContent = t; m.hidden = false; clearTimeout(say.t); if (ms) say.t = setTimeout(() => { m.hidden = true; }, ms); };
if (PRO) $('#pro').hidden = false;
if (window.__TAURI_INTERNALS__ || new URLSearchParams(location.search).has('pro')) { // escritorio: volver al Command Center
  const back = Object.assign(document.createElement('button'), { className: 'tb', textContent: '←', ariaLabel: 'Volver' }); back.onclick = () => (history.length > 1 ? history.back() : location.assign('/')); $('#top').prepend(back);
}

// ── Mapa ──
maplibregl.setWorkerUrl('/senda/vendor/maplibre-gl-4.7.1/maplibre-gl-csp-worker.js');
const start = LS.get('senda.exp.view', { c: [-4.3986, 40.3595], z: 14.5, p: 60, b: -20 });
let styleId = LS.get('senda.exp.style', 'satelite');
const map = new maplibregl.Map({ container: 'map', style: styleFor(styleId), center: start.c, zoom: start.z, pitch: start.p, bearing: start.b, maxPitch: 85, pixelRatio: LIM.px, antialias: PRO, maxTileCacheSize: PRO ? 800 : 300, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.on('moveend', () => LS.set('senda.exp.view', { c: map.getCenter().toArray(), z: map.getZoom(), p: map.getPitch(), b: map.getBearing() }));
const st = { contours: null, grid: null, prof: [], profDraw: false, bld: null, exag: LS.get('senda.exp.ex', 1.3), b3d: LS.get('senda.exp.b3d', true) };

function addCustom() {
  if (!map.getSource('dem')) map.addSource('dem', { ...TERRAIN_SOURCE });
  map.setTerrain({ source: 'dem', exaggeration: st.exag });
  if (!map.getSource('ofmv')) map.addSource('ofmv', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', 'none'); // usamos la nuestra (con color por altura)
  if (!map.getLayer('senda-bld')) map.addLayer({ id: 'senda-bld', type: 'fill-extrusion', source: 'ofmv', 'source-layer': 'building', minzoom: 14,
    paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#d9d4c7', 15, '#c9b99a', 40, '#a7a0d8', 100, '#7c74d9'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.92 } });
  map.setLayoutProperty('senda-bld', 'visibility', st.b3d ? 'visible' : 'none');
  if (!map.getLayer('senda-bld-sel')) { map.addSource('bldsel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); map.addLayer({ id: 'senda-bld-sel', type: 'fill-extrusion', source: 'bldsel', paint: { 'fill-extrusion-color': '#ff9f0a', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-opacity': 0.95 } }); }
  const gj = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data }); };
  gj('ct', st.contours ?? { type: 'FeatureCollection', features: [] }); gj('prof', { type: 'FeatureCollection', features: [] });
  if (!map.getLayer('ct')) map.addLayer({ id: 'ct', type: 'line', source: 'ct', paint: { 'line-color': ['case', ['get', 'index'], '#ff9f0a', '#ffd60a'], 'line-width': ['case', ['get', 'index'], 1.8, 0.8], 'line-opacity': 0.9 } });
  if (!map.getLayer('ct-lbl')) map.addLayer({ id: 'ct-lbl', type: 'symbol', source: 'ct', filter: ['get', 'index'], layout: { 'symbol-placement': 'line', 'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 }, paint: { 'text-color': '#ffd60a', 'text-halo-color': '#000', 'text-halo-width': 1.4 } });
  if (!map.getLayer('prof')) map.addLayer({ id: 'prof', type: 'line', source: 'prof', paint: { 'line-color': '#0a84ff', 'line-width': 4 } });
  applySun();
}
map.on('style.load', addCustom);

// ── Topografía de lo que ves ──
async function demGrid(bounds) {
  let z = Math.min(LIM.z, Math.max(8, Math.floor(map.getZoom())));
  let tiles = tilesFor(bounds, z);
  while (tiles.length > LIM.tiles && z > 8) tiles = tilesFor(bounds, --z);
  const dec = await Promise.all(tiles.map(async (t) => {
    const r = await fetch(`${DEM}/${t.z}/${t.x}/${t.y}.png`); if (!r.ok) throw new Error(`relieve ${r.status}`);
    const bmp = await createImageBitmap(await r.blob()), c = new OffscreenCanvas(256, 256), x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    return { ...t, heights: decodeTerrarium(x.getImageData(0, 0, 256, 256).data) };
  }));
  return mosaic(dec, z);
}
$('#survey').addEventListener('click', async () => {
  say('Descargando relieve de esta zona…', 0);
  try {
    const b = map.getBounds(), bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], g = await demGrid(bounds); st.grid = g;
    const s = terrainStats(g, map.getCenter().lat), interval = contourInterval(s.maxM - s.minM), step = Math.max(1, Math.round(Math.sqrt((g.w * g.h) / (PRO ? 600_000 : 250_000))));
    st.contours = contours(g, interval, { step }); map.getSource('ct')?.setData(st.contours);
    const kp = $('#topoKp').querySelectorAll('b');
    [fmt(s.minM), fmt(s.maxM), fmt(s.meanM), `${fmt(s.slopeMeanDeg, 1)}°`, `${fmt(s.slopeP99Deg, 1)}°`, `${interval} m`].forEach((v, i) => { kp[i].textContent = v; });
    $('#topoSrc').textContent = `Malla de ${g.w}×${g.h} celdas de ≈ ${fmt(s.cellM, 1)} m (zoom ${g.z}${PRO ? ', PRO' : ''}) · ${st.contours.features.length} curvas · Terrain Tiles en AWS (EU-DEM/SRTM y otros): orientativo, no topografía de obra.`;
    say(`Topografía lista: ${st.contours.features.length} curvas cada ${interval} m`);
  } catch (e) { say('No se pudo descargar el relieve: ' + e.message); }
});
$('#ctOff').addEventListener('click', () => { st.contours = null; map.getSource('ct')?.setData({ type: 'FeatureCollection', features: [] }); });
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
$('#ctGeo').addEventListener('click', () => { if (!st.contours) return say('Primero «Levantar esta zona»'); saveBlob(new Blob([JSON.stringify(st.contours)], { type: 'application/geo+json' }), `senda-curvas-${stamp()}.geojson`).then((r) => say(r.ok ? `Guardado en ${r.where}` : 'No se pudo guardar')); });
$('#ctSvg').addEventListener('click', () => {
  if (!st.contours) return say('Primero «Levantar esta zona»');
  const b = map.getBounds(), W = 1000, H = Math.round(W * (b.getNorth() - b.getSouth()) / ((b.getEast() - b.getWest()) * Math.cos(map.getCenter().lat * Math.PI / 180)));
  const X = (lon) => ((lon - b.getWest()) / (b.getEast() - b.getWest())) * W, Y = (lat) => ((b.getNorth() - lat) / (b.getNorth() - b.getSouth())) * H;
  const paths = st.contours.features.map((f) => `<path d="M${f.geometry.coordinates.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('L')}" fill="none" stroke="${f.properties.index ? '#8a4b08' : '#c58b3a'}" stroke-width="${f.properties.index ? 1.4 : 0.6}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 40}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${paths}<text x="10" y="${H + 24}" font-size="13">Curvas cada ${st.contours.interval} m (maestras cada ${st.contours.interval * 5} m) · ${b.getSouth().toFixed(5)}, ${b.getWest().toFixed(5)} – ${b.getNorth().toFixed(5)}, ${b.getEast().toFixed(5)} · Terrain Tiles AWS · SENDA</text></svg>`;
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `senda-plano-topografico-${stamp()}.svg`).then((r) => say(r.ok ? `Guardado en ${r.where}` : 'No se pudo guardar'));
});

// ── Perfil del terreno ──
$('#prDraw').addEventListener('click', () => { st.profDraw = !st.profDraw; $('#prDraw').classList.toggle('on', st.profDraw); if (st.profDraw) say('Toca el mapa para añadir puntos', 0); else $('#msg').hidden = true; });
$('#prClear').addEventListener('click', () => { st.prof = []; map.getSource('prof')?.setData({ type: 'FeatureCollection', features: [] }); drawProfile(null); });
async function updateProfile() {
  map.getSource('prof')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: st.prof } });
  if (st.prof.length < 2) return;
  const xs = st.prof.map((p) => p[0]), ys = st.prof.map((p) => p[1]), pad = 0.002;
  const g = await demGrid([Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]);
  drawProfile(elevationProfile(g, st.prof, PRO ? 5 : 10));
}
function drawProfile(pr) {
  const c = $('#prof'), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  const kp = $('#prKp').querySelectorAll('b');
  if (!pr) { kp.forEach((b) => { b.textContent = '–'; }); return; }
  const hs = pr.pts.map((p) => p.h).filter(Number.isFinite), lo = Math.min(...hs), hi = Math.max(...hs), W = c.width, H = c.height, m = 30;
  x.strokeStyle = 'rgba(255,255,255,.15)'; x.fillStyle = 'rgba(235,235,245,.6)'; x.font = '20px sans-serif';
  for (let k = 0; k <= 4; k++) { const y = m + ((H - 2 * m) * k) / 4; x.beginPath(); x.moveTo(m, y); x.lineTo(W - 8, y); x.stroke(); x.fillText(`${Math.round(hi - ((hi - lo) * k) / 4)} m`, 4, y - 4); }
  x.beginPath(); pr.pts.forEach((p, i) => { const X = m + ((W - m - 8) * p.d) / pr.lengthM, Y = m + (H - 2 * m) * (1 - (p.h - lo) / (hi - lo || 1)); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
  x.strokeStyle = '#0a84ff'; x.lineWidth = 3; x.stroke(); x.lineTo(W - 8, H - m); x.lineTo(m, H - m); x.closePath(); x.fillStyle = 'rgba(10,132,255,.18)'; x.fill();
  kp[0].textContent = pr.lengthM >= 1000 ? `${fmt(pr.lengthM / 1000, 2)} km` : `${fmt(pr.lengthM)} m`; kp[1].textContent = `${fmt(pr.ascentM)} m`; kp[2].textContent = `${fmt(pr.descentM)} m`;
}

// ── Edificio: planta exterior ──
async function groundAt(p) { try { const g = await demGrid([p[0] - 0.0005, p[1] - 0.0005, p[0] + 0.0005, p[1] + 0.0005]); return sampleHeight(g, p); } catch { return NaN; } }
async function pickBuilding(e) {
  const f = map.queryRenderedFeatures(e.point, { layers: ['senda-bld'] })[0]; if (!f) return false;
  const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
  const m = footprintMetrics(ring), h = f.properties.render_height ?? null, base = f.properties.render_min_height ?? 0;
  map.getSource('bldsel')?.setData({ type: 'Feature', properties: { h: (h ?? 6) + 0.3, b: base }, geometry: { type: 'Polygon', coordinates: [ring] } }); // resaltado 3D con su altura
  st.bld = { ring, h, m, ground: NaN }; tab('edif');
  const kp = $('#bKp').querySelectorAll('b');
  kp[0].textContent = fmt(m.areaM2, 1); kp[1].textContent = fmt(m.perimeterM, 1); kp[2].textContent = h != null ? fmt(h - base, 1) : '–'; kp[5].textContent = m.edgesM.length;
  st.bld.ground = await groundAt(m.centroid); kp[3].textContent = fmt(st.bld.ground); kp[4].textContent = h != null && Number.isFinite(st.bld.ground) ? fmt(st.bld.ground + h) : '–';
  return true;
}
const bOpts = () => ({ title: 'Planta exterior · SENDA', heightM: st.bld?.h, groundM: st.bld?.ground, source: `OSM/OpenMapTiles · centro ${st.bld.m.centroid.map((v) => v.toFixed(6)).join(', ')}` });
$('#bSvg').addEventListener('click', () => { if (!st.bld) return say('Toca primero un edificio'); saveBlob(new Blob([footprintSvg(st.bld.ring, bOpts())], { type: 'image/svg+xml' }), `senda-planta-${stamp()}.svg`).then((r) => say(r.ok ? `Plano guardado en ${r.where}` : 'No se pudo guardar')); });
$('#bDxf').addEventListener('click', () => { if (!st.bld) return say('Toca primero un edificio'); saveBlob(new Blob([footprintDxf(st.bld.ring)], { type: 'application/dxf' }), `senda-planta-${stamp()}.dxf`).then((r) => say(r.ok ? `DXF guardado en ${r.where}` : 'No se pudo guardar')); });

map.on('click', async (e) => {
  if (st.profDraw) { st.prof.push([+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]); updateProfile().catch((err) => say(err.message)); return; }
  if (!(await pickBuilding(e)) && map.getZoom() >= 15 && st.b3d) say('Aquí no hay huella de edificio en los datos');
});

// ── Sol 4D ──
const now = new Date(); $('#sunDate').value = now.toISOString().slice(0, 10); $('#sunHour').value = now.getHours() * 60 + now.getMinutes();
function sunUtcMs() { const [y, mo, d] = $('#sunDate').value.split('-').map(Number), min = +$('#sunHour').value; return new Date(y, mo - 1, d, Math.floor(min / 60), min % 60).getTime(); } // hora local del dispositivo
function applySun() {
  const c = map.getCenter(), t = sunUtcMs(), s = sunPosition(t, c.lat, c.lng);
  $('#sunHourTxt').textContent = new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const kp = $('#sunKp').querySelectorAll('b'); kp[0].textContent = `${fmt(s.elevationDeg, 1)}°`; kp[1].textContent = `${fmt(s.azimuthDeg)}°`;
  const day = new Date(t); day.setHours(0, 0, 0, 0); let rise = null, set = null, prev = null;
  for (let m = 0; m <= 1440; m += 2) { const e = sunPosition(day.getTime() + m * 60_000, c.lat, c.lng).elevationDeg - (-0.833); if (prev != null && prev < 0 && e >= 0) rise = m; if (prev != null && prev >= 0 && e < 0) set = m; prev = e; }
  const hm = (m) => (m == null ? '–' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`); kp[2].textContent = `${hm(rise)} · ${hm(set)}`;
  const up = s.elevationDeg > 0;
  try { map.setLight({ anchor: 'map', position: [1.5, s.azimuthDeg, Math.max(0, Math.min(90, 90 - s.elevationDeg))], color: up ? '#ffffff' : '#5a6b8c', intensity: up ? 0.45 : 0.15 }); } catch { /* */ }
  if (map.getLayer('hillshade')) map.setPaintProperty('hillshade', 'hillshade-illumination-direction', s.azimuthDeg);
}
for (const id of ['#sunDate', '#sunHour']) $(id).addEventListener('input', applySun);
map.on('moveend', applySun);

// ── Vista ──
function renderStyles() {
  $('#styles').innerHTML = Object.entries(MAP_STYLES).map(([id, v]) => `<button data-s="${id}" class="${id === styleId ? 'on' : ''}"><img src="/senda/previews/map-${id}.webp" alt="" loading="lazy">${v.label}</button>`).join('');
  $('#styleNote').textContent = MAP_STYLES[styleId]?.note ?? 'Mapa de OpenStreetMap (OpenFreeMap).';
}
$('#styles').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; styleId = b.dataset.s; LS.set('senda.exp.style', styleId); map.setStyle(styleFor(styleId), { diff: false }); renderStyles(); if (styleId === 'satelite' && !orthoCovers(map.getCenter().toArray())) say('Aquí no hay ortofoto oficial: prueba «Satélite del día»'); });
$('#ex').value = st.exag; $('#exTxt').textContent = fmt(st.exag, 1);
$('#ex').addEventListener('input', (e) => { st.exag = +e.target.value; LS.set('senda.exp.ex', st.exag); $('#exTxt').textContent = fmt(st.exag, 1); map.setTerrain({ source: 'dem', exaggeration: st.exag }); });
$('#b3d').classList.toggle('on', st.b3d);
$('#b3d').addEventListener('click', () => { st.b3d = !st.b3d; LS.set('senda.exp.b3d', st.b3d); $('#b3d').classList.toggle('on', st.b3d); if (map.getLayer('senda-bld')) map.setLayoutProperty('senda-bld', 'visibility', st.b3d ? 'visible' : 'none'); });
$('#tilt').addEventListener('click', () => map.easeTo({ pitch: map.getPitch() > 30 ? 0 : 65, duration: 700 }));
$('#north').addEventListener('click', () => map.easeTo({ bearing: 0, duration: 600 }));
renderStyles();

// ── Pestañas, búsqueda, ubicación, ayuda ──
function tab(p) { document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === p)); document.querySelectorAll('.pane').forEach((x) => { x.hidden = x.dataset.p !== p; }); $('#sheet').classList.remove('mini'); }
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) tab(b.dataset.p); });
$('#grab').addEventListener('click', () => { const s = $('#sheet'), mini = !s.dataset.mini; s.dataset.mini = mini ? '1' : ''; document.querySelectorAll('.pane').forEach((x) => { x.style.display = mini ? 'none' : ''; }); $('#tabs').style.display = mini ? 'none' : ''; });
let lastQ = 0;
$('#search').addEventListener('submit', async (e) => {
  e.preventDefault(); const q = $('#q').value.trim(); if (!q || Date.now() - lastQ < 1100) return; lastQ = Date.now(); // Nominatim: ≤ 1 petición/s
  try { const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`)).json(); if (!r[0]) return say('No encontrado'); map.flyTo({ center: [+r[0].lon, +r[0].lat], zoom: 15.5, pitch: 62, duration: 2500 }); say(r[0].display_name.split(',').slice(0, 3).join(',')); }
  catch { say('Sin conexión con el buscador'); }
});
$('#me').addEventListener('click', () => navigator.geolocation?.getCurrentPosition((p) => map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 16, pitch: 62, duration: 2000 }), () => say('Sin permiso de ubicación'), { enableHighAccuracy: true }));
const HELP = `<h3>Explorador 3D · cómo funciona</h3>
<p>Cualquier lugar del mundo con el relieve real del terreno y los edificios en 3D. Todo se calcula en tu dispositivo con datos abiertos.</p>
<h4>⛰️ Topografía</h4><ul><li>«Levantar esta zona» descarga el relieve de lo que ves y calcula alturas, pendientes y curvas de nivel (equidistancia automática; las maestras, cada 5).</li><li>Precisión: celdas de ≈ 5–20 m según el zoom; la fuente (EU-DEM/SRTM y otros) tiene errores de varios metros. Sirve para planificar y entender el terreno, no para replantear una obra.</li></ul>
<h4>📈 Perfil</h4><ul><li>Traza una línea y verás cuánto sube y baja, y su longitud.</li></ul>
<h4>🏢 Edificio</h4><ul><li>Toca un edificio: superficie en planta, perímetro, altura (de OpenStreetMap; a veces estimada), cota del suelo y de la cubierta. Descarga su planta exterior con cotas (SVG) o para CAD (DXF).</li><li>No existen planos interiores en datos abiertos: no se inventan.</li></ul>
<h4>☀️ Sol 4D</h4><ul><li>Elige fecha y hora: la luz sigue al Sol real (NOAA). La cuarta dimensión es el tiempo.</li></ul>
<h4>🗺️ Vista</h4><ul><li>15 tipos de mapa (satélite oficial, relieve, térmico, falso color…), realce del relieve y edificios 3D.</li></ul>
<p>${PRO ? '<b>Modo PRO</b> (escritorio): hasta zoom 15 y 64 teselas por levantamiento, imagen a mayor resolución.' : 'En el escritorio (modo PRO) el levantamiento llega a más detalle y más área.'}</p>`;
$('#helpBtn').addEventListener('click', () => { $('#helpBody').innerHTML = HELP; $('#help').hidden = false; });
$('#helpX').addEventListener('click', () => { $('#help').hidden = true; });
if (!LS.get('senda.exp.welcomed', false)) { LS.set('senda.exp.welcomed', true); setTimeout(() => $('#helpBtn').click(), 700); }
globalThis.sendaExplorer = { map, st };
