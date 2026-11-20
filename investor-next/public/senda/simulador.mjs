// SENDA · Simulador 3D sobre el relieve real de San Martín de Valdeiglesias (incendio del 23-07-2026).
// Datos: Copernicus DEM 100 m, combustible por celda, Sentinel-2 L2A (4 fechas), GFS 0,25° del 23-07 12Z,
// tiempos de llegada calibrados por SENDA y cicatriz observada. Módulos: wildfire.mjs, atmos3d.mjs, seismic.mjs, utm.mjs.
import * as THREE from '/senda/vendor/three.module.min.js';
import { arrivalTimes, FUELS } from '/senda/core/wildfire.mjs';
import { gfsProfile, lclHeightM } from '/senda/core/atmos3d.mjs';
import { locateEvent, sWaveLeadTimes } from '/senda/core/seismic.mjs';
import { fromUtm, toUtm } from '/senda/core/utm.mjs';

const $ = (s) => document.querySelector(s);
const nf = (x, d = 0) => Number(x).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
const B = '/senda/data/smv2026/';
const [demB, fuelB, burnB, arrB, F3, REAL, GFS] = await Promise.all([
  ...['dem_100m.bin', 'fuel_100m.bin', 'burn_100m.bin', 'arrival_roi.bin'].map((f) => fetch(B + f).then((r) => r.arrayBuffer())),
  ...['fire3d.json', 'real.json', 'gfs_20260723_12z.json'].map((f) => fetch(B + f).then((r) => r.json())),
]);
const { w: W, h: H, dx: DX, x0: X0, y1: Y1 } = F3.malla, ZONE = 30;
const dem = new Int16Array(demB), fuel = new Uint8Array(fuelB), burn = new Uint8Array(burnB), arrRoi = new Uint16Array(arrB);
let zMin = Infinity, zMax = -Infinity; for (const v of dem) { zMin = Math.min(zMin, v); zMax = Math.max(zMax, v); }
const ROI = F3.conjunto.roi;
const Tcal = new Float32Array(W * H).fill(Infinity);
for (let j = 0; j < ROI.h; j++) for (let i = 0; i < ROI.w; i++) { const v = arrRoi[j * ROI.w + i]; if (v !== 65535) Tcal[(ROI.j0 + j) * W + ROI.i0 + i] = v; }
let T = Tcal, Tname = 'cal';
const geoOf = (i, j) => fromUtm(X0 + (i + 0.5) * DX, Y1 - (j + 0.5) * DX, ZONE);
const ign = F3.ignicion;

/* ---------------- escena ---------------- */
const cv = $('#c3d');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a1016'); scene.fog = new THREE.Fog('#0a1016', 60000, 140000);
const camera = new THREE.PerspectiveCamera(45, 1, 50, 300000);
scene.add(new THREE.HemisphereLight('#cfe3ff', '#3a2a1a', 1.1));
const sun = new THREE.DirectionalLight('#fff3e0', 2.0); sun.position.set(-30000, 40000, 20000); scene.add(sun);
let EX = 2;
const STEP = 2, NX = Math.floor(W / STEP), NY = Math.floor(H / STEP);
const geo = new THREE.PlaneGeometry(W * DX, H * DX, NX - 1, NY - 1); geo.rotateX(-Math.PI / 2);
function applyHeights() {
  const p = geo.attributes.position;
  for (let jy = 0; jy < NY; jy++) for (let ix = 0; ix < NX; ix++) { const k = jy * NX + ix; p.setY(k, (dem[(jy * STEP) * W + ix * STEP] - zMin) * EX); }
  p.needsUpdate = true; geo.computeVertexNormals();
}
applyHeights();
const loader = new THREE.TextureLoader();
const terrainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
const terrain = new THREE.Mesh(geo, terrainMat); scene.add(terrain);
const ovCv = document.createElement('canvas'); ovCv.width = W; ovCv.height = H; const og = ovCv.getContext('2d');
const ovTex = new THREE.CanvasTexture(ovCv); ovTex.colorSpace = THREE.SRGBColorSpace;
const overlay = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
scene.add(overlay);
const wx = (i) => (i + 0.5 - W / 2) * DX, wz = (j) => (j + 0.5 - H / 2) * DX, wy = (z) => (z - zMin) * EX;
const elevAt = (i, j) => dem[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))];

/* ---------------- muestras de satélite ---------------- */
const SC = [['pre', '16-07'], ['d0724', '24-07'], ['d0729', '29-07'], ['d0808', '08-08']];
const toast = (msg) => { const t = $('#toast'); t.innerHTML = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 4200); };
function setScene(k) {
  loader.load(`${B}tci_${k}.jpg`, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; terrainMat.map = tx; terrainMat.needsUpdate = true; });
  document.querySelectorAll('#scenes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  const id = REAL.escenas[k]?.split('/')[1] ?? k;
  $('#scene-note').innerHTML = `Escena <span class="mono">${id}</span>. Sentinel-2 MSI mira casi en vertical (campo de visión de ±10,3°); 10–20 m por píxel; con dos satélites vuelve a pasar cada 5 días.`;
  toast(`Nueva muestra cargada · Sentinel-2 ${id.split('_')[0]} · ${id.split('_')[2]?.replace(/(\d{4})(\d\d)(\d\d)/, '$3-$2-$1') ?? ''} · tesela ${id.split('_')[1] ?? ''}`);
}
$('#scenes').innerHTML = SC.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('');
$('#scenes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setScene(b.dataset.k); });

/* ---------------- fuego ---------------- */
let tMin = 0, scarOn = true;
function paintFire() {
  og.clearRect(0, 0, W, H); const img = og.createImageData(W, H), d = img.data;
  for (let k = 0; k < W * H; k++) {
    const a = T[k]; let r = 0, g = 0, b = 0, al = 0;
    if (a <= tMin) { if (tMin - a < 45) { r = 255; g = 106 + Math.round(90 * (1 - (tMin - a) / 45)); b = 40; al = 235; } else { r = 70; g = 18; b = 12; al = 190; } }
    else if (scarOn && burn[k] > 0) { r = 120; g = 220; b = 255; al = 70; }
    d[4 * k] = r; d[4 * k + 1] = g; d[4 * k + 2] = b; d[4 * k + 3] = al;
  }
  og.putImageData(img, 0, 0); ovTex.needsUpdate = true;
  let burning = 0, burned = 0; for (let k = 0; k < W * H; k++) if (T[k] <= tMin) { burned++; if (tMin - T[k] < 45) burning++; }
  return { burnedHa: burned, frontHa: burning };
}
const tmax = () => { let m = 0; for (const v of T) if (Number.isFinite(v) && v > m) m = v; return Math.max(60, Math.min(1440, m)); };
function setT(v) { tMin = v; $('#t').value = v; const r = paintFire(); $('#t-lab').innerHTML = `+${nf(v / 60, 1)} h<small>${nf(r.burnedHa)} ha quemadas · ${nf(r.frontHa)} ha en frente activo</small>`; frontCells = collectFront(); }
let frontCells = [];
function collectFront() { const out = []; for (let k = 0; k < W * H; k += 3) if (T[k] <= tMin && tMin - T[k] < 45) out.push(k); return out; }
function ticks() { const m = tmax(); $('#t').max = m; $('#ticks').innerHTML = Array.from({ length: 7 }, (_, q) => `<span style="left:${(q / 6) * 100}%">+${nf((m * q) / 6 / 60, 1)} h</span>`).join(''); }
document.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-src]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('#mio').hidden = b.dataset.src !== 'mio';
  if (b.dataset.src === 'cal') { T = Tcal; Tname = 'cal'; ticks(); setT(0); srcNote(); } else { srcNote(); }
}));
function srcNote() { $('#src-note').innerHTML = Tname === 'cal' ? `Tiempos calibrados por SENDA: ignición ${F3.conjunto.llegada.ignicionUTC} UTC, viento girado ${F3.conjunto.llegada.giroVientoDeg}°, velocidad ×${F3.conjunto.llegada.multVelocidad} (mejor de ${F3.conjunto.miembros} miembros frente a la cicatriz del satélite).` : 'Tu simulación con pocos datos: ignición y viento elegidos por ti; relieve y combustible reales.'; }
let myIgn = null;
$('#w-dir').oninput = (e) => ($('#w-dir-v').textContent = `${e.target.value}°`);
$('#w-spd').oninput = (e) => ($('#w-spd-v').textContent = `${e.target.value} km/h`);
$('#run').onclick = () => {
  const g = myIgn ?? { i: ign.i, j: ign.j }, t0 = performance.now();
  const elev = Float32Array.from(dem);
  const R = arrivalTimes({ w: W, h: H, cellM: DX, fuel, elev }, [{ x: g.i, y: g.j, t: 0 }], { windKmh: +$('#w-spd').value, windToDeg: +$('#w-dir').value }, { maxMin: 1440 });
  T = R; Tname = 'mio'; ticks(); setT(Math.min(360, +$('#t').max)); srcNote();
  let inter = 0, mine = 0, obs = 0; const tEnd = +$('#t').max; for (let k = 0; k < W * H; k++) { const a = T[k] <= tEnd, o = burn[k] > 0; if (a) mine++; if (o) obs++; if (a && o) inter++; }
  $('#run-out').innerHTML = `Calculado en ${nf(performance.now() - t0)} ms sobre ${nf(W * H)} celdas reales. Coincidencia con la cicatriz del satélite (Jaccard): <b>${nf(inter / Math.max(1, mine + obs - inter), 2)}</b>; el modelo calibrado de SENDA llega a ${nf(F3.conjunto.trasAsimilar.parametros.jaccard, 2)}. Con pocos datos el avance es una hipótesis; cada nueva imagen de satélite lo corrige.`;
};

/* ---------------- atmósfera, viento y pluma ---------------- */
const prof = gfsProfile(GFS.times[0], GFS.grid, ign.lat, ign.lon);
const mA = F3.masaDeAire[0], lcl = lclHeightM(mA.t2, mA.td2), plumeTop = F3.pluma.alturaFinalM;
const airGroup = new THREE.Group(), windGroup = new THREE.Group(); scene.add(airGroup, windGroup);
function buildAir() {
  airGroup.clear(); windGroup.clear();
  const rhoMax = Math.max(...prof.levels.map((l) => l.rho)), rhoMin = Math.min(...prof.levels.map((l) => l.rho));
  for (const l of prof.levels) {
    if (l.z > zMin + 6500) continue;
    const u = (l.rho - rhoMin) / Math.max(1e-6, rhoMax - rhoMin);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(W * DX * 0.96, H * DX * 0.96), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.58, 0.6, 0.35 + 0.35 * u), transparent: true, opacity: 0.03 + 0.07 * u, depthWrite: false, side: THREE.DoubleSide }));
    pl.rotation.x = -Math.PI / 2; pl.position.y = wy(l.z); airGroup.add(pl);
    if (l.rh >= 85) for (let c = 0; c < 18; c++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1200 + 800 * Math.random(), 10, 8), new THREE.MeshBasicMaterial({ color: '#f2f4f6', transparent: true, opacity: 0.35, depthWrite: false })); s.position.set((Math.random() - 0.5) * W * DX * 0.8, wy(l.z), (Math.random() - 0.5) * H * DX * 0.8); airGroup.add(s); }
    const spd = Math.hypot(l.u, l.v), dir = new THREE.Vector3(l.u, 0, -l.v).normalize();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ar = new THREE.ArrowHelper(dir, new THREE.Vector3(a * 11000, wy(l.z), b * 10000), 900 + spd * 170, new THREE.Color().setHSL(0.08, 0.7, 0.65), 380, 240); ar.line.material.transparent = true; ar.line.material.opacity = 0.55; ar.cone.material.transparent = true; ar.cone.material.opacity = 0.7; windGroup.add(ar); }
  }
  const lclPlane = new THREE.Mesh(new THREE.PlaneGeometry(W * DX * 0.96, H * DX * 0.96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  lclPlane.rotation.x = -Math.PI / 2; lclPlane.position.y = wy(elevAt(ign.i, ign.j) + lcl); airGroup.add(lclPlane);
}
buildAir();
const NP = 900, pPos = new Float32Array(NP * 3), pAge = new Float32Array(NP).fill(1e9), pBase = new Float32Array(NP);
const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.45, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const plume = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3)), new THREE.PointsMaterial({ color: '#b9b4ad', map: puff, size: 900, transparent: true, opacity: 0.28, depthWrite: false, sizeAttenuation: true }));
scene.add(plume);
const windAt = (zAbs) => { const ls = prof.levels; let a = ls[0]; for (const l of ls) if (l.z <= zAbs) a = l; return a; };
function stepPlume(dt) {
  if (!$('#l-plume').checked || !frontCells.length || mode !== 'fuego') { plume.visible = false; return; } plume.visible = true;
  for (let n = 0; n < NP; n++) {
    if (pAge[n] > 90) { const k = frontCells[(Math.random() * frontCells.length) | 0], i = k % W, j = (k / W) | 0; pPos[3 * n] = wx(i); pPos[3 * n + 2] = wz(j); pBase[n] = dem[k]; pPos[3 * n + 1] = wy(dem[k]); pAge[n] = Math.random() * 10; }
    pAge[n] += dt * 12; const zAbs = pBase[n] + Math.min(plumeTop, pAge[n] * 26), l = windAt(zAbs);
    pPos[3 * n] += l.u * dt * 40; pPos[3 * n + 2] += -l.v * dt * 40; pPos[3 * n + 1] = wy(zAbs);
  }
  plume.geometry.attributes.position.needsUpdate = true;
}
// gráfica de la columna
(function chart() {
  const c = $('#col-chart'), g = c.getContext('2d'), Wc = c.width, Hc = c.height, ls = prof.levels.filter((l) => l.z < zMin + 6500);
  const zTop = zMin + 6500, Y = (z) => Hc - 24 - ((z - zMin) / (zTop - zMin)) * (Hc - 40);
  const rmin = Math.min(...ls.map((l) => l.rho)), rmax = Math.max(...ls.map((l) => l.rho)), X = (r) => 50 + ((r - rmin) / (rmax - rmin)) * (Wc - 80);
  g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, Wc, Hc); g.font = '20px Inter'; g.lineWidth = 3;
  g.strokeStyle = '#4f8cff'; g.beginPath(); ls.forEach((l, k) => (k ? g.lineTo(X(l.rho), Y(l.z)) : g.moveTo(X(l.rho), Y(l.z)))); g.stroke();
  const zg = elevAt(ign.i, ign.j);
  for (const [z, col, lab] of [[zg + lcl, '#e7e9ec', `base de nube posible (LCL) ${nf(lcl)} m`], [zg + plumeTop, '#ff6a3d', `techo de la pluma ${nf(plumeTop)} m`], [zg, '#8c949e', `suelo ${nf(zg)} m`]]) { if (z > zTop) continue; g.strokeStyle = col; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(40, Y(z)); g.lineTo(Wc - 10, Y(z)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.fillText(lab, 50, Y(z) - 6); }
  g.fillStyle = '#4f8cff'; g.fillText(`densidad ${nf(rmin, 2)} → ${nf(rmax, 2)} kg/m³`, 50, 22);
  $('#air-out').innerHTML = [['Temperatura a 2 m', `${nf(mA.t2, 1)} °C`], ['Humedad', `${nf(mA.rh2)} %`], ['Densidad en superficie', `${nf(mA.densidad, 3)} kg/m³`], ['Índice de Haines', `${mA.haines} de 6`], ['Base de nube posible (LCL)', `${nf(lcl)} m sobre el suelo`], ['Pluma (modelo)', `${nf(plumeTop)} m · ${nf(F3.pluma.calorGW, 1)} GW`], ['Nubes', ls.some((l) => l.rh >= 85) ? 'sí, en capas con humedad ≥ 85 %' : 'no: aire seco; la pluma no alcanza la base de nube']].map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('') + '<p class="note">Fuente: NOAA GFS 0,25° del 23-07-2026 12Z (dominio público) y modelo de pluma de SENDA.</p>';
  const c2 = F3.conjunto; $('#val').innerHTML = `<p class="note">Validación del modelo calibrado frente al satélite: acierto P50 del ${nf(100 * c2.aciertoObservadoConP50)} % → ${nf(100 * c2.trasAsimilar.aciertoObservadoConP50)} % tras asimilar; falsa alarma del ${nf(100 * c2.falsaAlarmaP50)} % → ${nf(100 * c2.trasAsimilar.falsaAlarmaP50)} % (el modelo sobrestima el área). Datos de <span class="mono">fire3d.json</span>.</p>`;
})();

/* ---------------- agua ---------------- */
const water = new THREE.Mesh(new THREE.PlaneGeometry(W * DX, H * DX), new THREE.MeshStandardMaterial({ color: '#2f6fd6', transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1 }));
water.rotation.x = -Math.PI / 2; water.visible = false; scene.add(water);
function setWater(z) { water.position.y = wy(z); $('#lvl-v').textContent = `${z} m`; let n = 0; for (const v of dem) if (v < z) n++; $('#lvl-out').innerHTML = `<b>${nf(n)} ha</b> por debajo de ${z} m (${nf((100 * n) / dem.length, 1)} % de la zona).`; }
$('#lvl').oninput = (e) => setWater(+e.target.value);

/* ---------------- sismo ---------------- */
const TOWNS = [['San Martín de Valdeiglesias', 40.362, -4.398], ['Cadalso de los Vidrios', 40.301, -4.435], ['El Tiemblo', 40.414, -4.503], ['Navas del Rey', 40.383, -4.254], ['Ávila', 40.656, -4.700], ['Toledo', 39.857, -4.024], ['Madrid', 40.417, -3.704]];
const sisG = new THREE.Group(); scene.add(sisG);
$('#nst').oninput = (e) => ($('#nst-v').textContent = e.target.value);
function quake(i, j) {
  sisG.clear(); const ep = geoOf(i, j), N = +$('#nst').value; let s = 7; const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const phones = Array.from({ length: N }, () => { const pi = (R() * W) | 0, pj = (R() * H) | 0; return { i: pi, j: pj, ...geoOf(pi, pj) }; });
  const vp = 6, d = (a, b) => 2 * 6371 * Math.asin(Math.sqrt(Math.sin(((b.lat - a.lat) * Math.PI) / 360) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(((b.lon - a.lon) * Math.PI) / 360) ** 2));
  const picks = phones.map((p) => ({ ...p, t: d(ep, p) / vp + (R() - 0.5) * 0.15 }));
  // Un sistema de alerta temprana localiza con los primeros móviles que detectan la onda P, no con todos.
  const first = [...picks].sort((a, b) => a.t - b.t).slice(0, Math.min(picks.length, 6)), tReady = first[first.length - 1].t, t0 = performance.now(), est = locateEvent(first, { gridKm: 40, stepKm: 1, minStations: 4 });
  const ms = performance.now() - t0, err = est ? d(ep, est) : NaN;
  const lead = est ? sWaveLeadTimes(est, TOWNS.map(([n, lat, lon]) => ({ n, lat, lon })), tReady + ms / 1000) : [];
  const mk = (ii, jj, col, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 300, 24), new THREE.MeshBasicMaterial({ color: col })); m.position.set(wx(ii), wy(elevAt(ii, jj)) + 400, wz(jj)); sisG.add(m); };
  mk(i, j, '#e5484d', 900); phones.forEach((p) => mk(p.i, p.j, '#4f8cff', 300));
  if (est) { const u = toUtm(est.lat, est.lon, ZONE), ei = Math.round((u.x - X0) / DX - 0.5), ej = Math.round((Y1 - u.y) / DX - 0.5); mk(ei, ej, '#ffffff', 500); }
  $('#sis-out').innerHTML = est ? [['Epicentro real (simulado)', `${nf(ep.lat, 4)}, ${nf(ep.lon, 4)}`], ['Epicentro calculado', `${nf(est.lat, 4)}, ${nf(est.lon, 4)}`], ['Error', `${nf(err, 1)} km`], ['Localizado con', `los ${first.length} primeros móviles, a los ${nf(tReady, 1)} s del sismo (+${nf(ms)} ms de cálculo)`], ['Confianza', est.confidence]].map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('') + `<p class="h" style="margin-top:10px">Segundos de aviso antes de la onda S</p>` + lead.map((l) => `<div class="row"><span>${l.n}</span><b>${l.leadS > 0 ? `${nf(l.leadS, 1)} s` : 'ya llegó'}</b></div>`).join('') + '<p class="note">Ondas P a 6 km/s y S a 3,5 km/s; 0,15 s de error de detección por móvil. Coordenadas de los municipios aproximadas (centro urbano). Un sismo no se predice: se detecta y se avisa a quien aún no lo ha sentido; cerca del epicentro no hay margen, a decenas de kilómetros sí.</p>' : '<p class="note">Faltan móviles para localizarlo.</p>';
}

/* ---------------- cámara: órbita, cuatro direcciones, cenital y horizonte ---------------- */
const tgt = new THREE.Vector3(wx(ign.i), wy(elevAt(ign.i, ign.j)), wz(ign.j));
let az = Math.PI * 0.85, el = 0.62, rad = 42000;
function place() { const c = Math.cos(el); camera.position.set(tgt.x + rad * c * Math.sin(az), tgt.y + rad * Math.sin(el), tgt.z + rad * c * Math.cos(az)); camera.lookAt(tgt); }
const preset = { obl: () => { el = 0.62; rad = 42000; }, cen: () => { el = 1.553; rad = 52000; }, hor: () => { el = 0.035; rad = 9000; } };
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => { preset[b.dataset.cam](); place(); }));
const move = (dir) => { const fwd = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az)), right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)), s = rad * 0.12;
  if (dir === 'n') tgt.z -= s; if (dir === 's') tgt.z += s; if (dir === 'e') tgt.x += s; if (dir === 'w') tgt.x -= s; if (dir === 'f') tgt.addScaledVector(fwd, s); if (dir === 'b') tgt.addScaledVector(fwd, -s); if (dir === 'r') tgt.addScaledVector(right, s); if (dir === 'l') tgt.addScaledVector(right, -s);
  if (dir === 'c') tgt.set(wx(ign.i), wy(elevAt(ign.i, ign.j)), wz(ign.j)); place(); };
document.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => move(b.dataset.mv)));
addEventListener('keydown', (e) => { const k = { ArrowUp: 'f', w: 'f', ArrowDown: 'b', s: 'b', ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r' }[e.key]; if (k && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { move(k); e.preventDefault(); } if (e.key === 'q') { az += 0.08; place(); } if (e.key === 'e') { az -= 0.08; place(); } });
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az, el, moved: false, pan: e.shiftKey || e.button === 2 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (drag) { const dxp = e.clientX - drag.x, dyp = e.clientY - drag.y; if (Math.abs(dxp) + Math.abs(dyp) > 3) drag.moved = true;
    if (drag.pan) { move(dxp > 0 ? 'l' : 'r'); drag.x = e.clientX; } else { az = drag.az - dxp * 0.005; el = Math.max(0.02, Math.min(1.56, drag.el + dyp * 0.004)); place(); } return; }
  hover(e);
});
cv.addEventListener('pointerup', (e) => { if (drag && !drag.moved) click(e); drag = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => { e.preventDefault(); rad = Math.max(1500, Math.min(140000, rad * (e.deltaY > 0 ? 1.12 : 0.89))); place(); }, { passive: false });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObject(terrain)[0]; if (!h) return null; const i = Math.round(h.point.x / DX + W / 2 - 0.5), j = Math.round(h.point.z / DX + H / 2 - 0.5); return i >= 0 && j >= 0 && i < W && j < H ? { i, j } : null; }
let lastHover = '';
function hover(e) { const p = pick(e); if (!p) return; const g = geoOf(p.i, p.j), k = p.j * W + p.i, a = T[k];
  lastHover = `<br>Cursor: <b>${nf(g.lat, 5)}, ${nf(g.lon, 5)}</b> · UTM 30N ${nf(X0 + (p.i + 0.5) * DX)} E ${nf(Y1 - (p.j + 0.5) * DX)} N<br>Cota <b>${nf(dem[k])} m</b> · ${FUELS[fuel[k]]?.label ?? '—'} · llegada del fuego: <b>${Number.isFinite(a) ? `+${nf(a / 60, 1)} h` : 'no llega'}</b>`; }
function click(e) { const p = pick(e); if (!p) return; if (mode === 'sismo') quake(p.i, p.j); else if (mode === 'fuego' && Tname !== 'cal' || (mode === 'fuego' && !$('#mio').hidden)) { myIgn = p; toast(`Ignición colocada en ${nf(geoOf(p.i, p.j).lat, 4)}, ${nf(geoOf(p.i, p.j).lon, 4)} · pulsa «Calcular avance»`); } }

/* ---------------- modos ---------------- */
let mode = 'fuego';
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('on', m.dataset.for === mode)); overlay.visible = mode === 'fuego'; water.visible = mode === 'agua'; sisG.visible = mode === 'sismo'; if (mode === 'agua') setWater(+$('#lvl').value); }));
$('#l-wind').onchange = (e) => (windGroup.visible = e.target.checked); $('#l-air').onchange = (e) => (airGroup.visible = e.target.checked);
$('#scar').onchange = (e) => { scarOn = e.target.checked; paintFire(); };
$('#exag').oninput = (e) => { EX = +e.target.value; $('#exag-v').textContent = `×${EX}`; applyHeights(); buildAir(); tgt.y = wy(elevAt(ign.i, ign.j)); place(); if (water.visible) setWater(+$('#lvl').value); };

/* ---------------- reproducción y vídeo ---------------- */
let playing = false; $('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? '❚❚ Pausa' : '▶ Reproducir'; if (playing && tMin >= +$('#t').max) setT(0); };
$('#t').oninput = (e) => setT(+e.target.value);
$('#rec').onclick = () => {
  if (!window.MediaRecorder) { toast('Este navegador no permite grabar vídeo.'); return; }
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = `senda-simulacion-${mode}.webm`; a.click(); toast('Vídeo descargado: grabación de la simulación (no es un ensayo de campo).'); $('#rec').textContent = '● Grabar vídeo'; };
  setT(0); playing = true; $('#play').textContent = '❚❚ Pausa'; rec.start(); $('#rec').textContent = '■ Grabando…';
  setTimeout(() => rec.state !== 'inactive' && rec.stop(), 12000);
};

/* ---------------- bucle ---------------- */
function resize() { const r = cv.getBoundingClientRect(); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(cv);
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (playing) { const m = +$('#t').max; setT(Math.min(m, tMin + dt * (m / 12))); if (tMin >= m) { playing = false; $('#play').textContent = '▶ Reproducir'; } }
  stepPlume(dt); renderer.render(scene, camera);
  const azDeg = ((((Math.atan2(-Math.sin(az), -Math.cos(az)) * 180) / Math.PI) % 360) + 360) % 360;
  $('#hud').innerHTML = `Mirando al <b>${nf(azDeg)}°</b> · elevación <b>${nf((el * 180) / Math.PI)}°</b> · distancia ${nf(rad / 1000, 1)} km${lastHover}`;
  requestAnimationFrame(frame);
}
ticks(); srcNote(); setScene('d0724'); setT(Math.round(+$('#t').max * 0.4)); preset.obl(); place(); resize(); requestAnimationFrame(frame);
window.__sim = { ready: true, W, H, zMin, zMax, lcl, plumeTop };
