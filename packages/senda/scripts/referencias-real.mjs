// SENDA v0.20 · Experimento con datos reales: base de referencia de incendios + cruce fuego–tráfico.
//
// Uso:
//   node packages/senda/scripts/referencias-real.mjs [dirCrudoGOES] [dirTfL]
//   (los directorios crudos solo hacen falta la primera vez; después se usa la copia compacta del repo)
//
// Datos reales:
//   - NOAA GOES-16/18 ABI L2 FDC: detecciones de fuego cada 5–10 min;
//   - NOAA HRRR 3 km: viento a 10 m, racha, temperatura y humedad;
//   - cicatriz Sentinel-2 del caso SMV 2026 (v0.19);
//   - conteos de 12 cámaras reales de TfL JamCams (Londres) con YOLOX + ByteTrack.
// Modelo, marcado como tal:
//   - la demanda de evacuación (supuestos explícitos con su fuente);
//   - los gemelos simulados que prueban el filtro de Kalman.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as FC from '../src/fire-cases.mjs';
import * as TF from '../src/traffic-fusion.mjs';
import { filterGoesFrames } from '../src/observation-quality.mjs';
import { estimateRobustFront } from '../src/fire-front-robust.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'investor-next/public/senda/data/referencias'); mkdirSync(OUT, { recursive: true });
const RAW = process.argv[2], TFL = process.argv[3];
const FIRES = { camp: ['us/goes_camp.json', 'camp'], palisades: ['us2/goes_la.json', 'palisades'], eaton: ['us2/goes_la.json', 'eaton'], marshall: ['us2/goes_marshall.json', 'marshall'], smokehouse: ['us2/goes_smokehouse.json', 'smokehouse'], troublesome: ['us2/goes_troublesome.json', 'troublesome'], creek: ['us2/goes_creek.json', 'creek'] };
const META = {
  camp: { ref: 'camp-2018', sat: 'GOES-16', combustible: 'matorral/bosque' }, palisades: { ref: 'palisades-2025', sat: 'GOES-18', combustible: 'matorral/bosque' },
  eaton: { ref: 'eaton-2025', sat: 'GOES-18', combustible: 'matorral/bosque' }, marshall: { ref: 'marshall-2021', sat: 'GOES-16', combustible: 'pasto' },
  smokehouse: { ref: 'smokehouse-2024', sat: 'GOES-16', combustible: 'pasto' }, troublesome: { ref: 'troublesome-2020', sat: 'GOES-16', combustible: 'matorral/bosque' }, creek: { ref: 'creek-2020', sat: 'GOES-16', combustible: 'matorral/bosque' },
};

// ── 1. copia compacta de los datos crudos (una vez) ─────────────────────────────
const GOES = resolve(OUT, 'goes_casos.json');
if (RAW) {
  const all = {};
  for (const [f, [file, key]] of Object.entries(FIRES)) {
    const j = JSON.parse(readFileSync(resolve(RAW, file), 'utf8'));
    all[f] = { satelite: j.satelite, frames: j.frames[key].map((x) => ({ t: x.t, det: x.det.map((d) => [+d[0].toFixed(4), +d[1].toFixed(4), d[2] == null ? null : Math.round(d[2]), d[3] == null ? null : Number(d[3]), d[4] == null ? null : Number(d[4])]) })), hrrr: j.hrrr[key] };
  }
  writeFileSync(GOES, JSON.stringify({ fuente: 'NOAA GOES-R ABI L2 Fire Detection (FDCC) y NOAA HRRR 3 km (AWS Open Data, dominio público). Descargado por scripts/datos-reales/goes_hrrr_incendio.py', casos: all }));
}
if (TFL) {
  const rows = [];
  for (const d of readdirSync(resolve(TFL, 'out')).sort()) {
    const j = JSON.parse(readFileSync(resolve(TFL, 'out', d, 'fixed.json'), 'utf8'));
    rows.push({ camara: d, durS: j.durationS, cruces: j.total, porSentido: j.counts, mediaEnImagen: j.meanInFrame, maxEnImagen: j.maxInFrame, por5s: j.per5s });
  }
  const locF = resolve(TFL, 'loc.json'), loc = existsSync(locF) ? JSON.parse(readFileSync(locF, 'utf8')) : {};
  for (const r of rows) if (loc[r.camara]) { const [n, la, lo] = loc[r.camara]; Object.assign(r, { nombre: n, lat: la, lon: lo }); }
  writeFileSync(resolve(OUT, 'tfl_camaras.json'), JSON.stringify({ fuente: 'TfL JamCams (Powered by TfL Open Data), clips de ≈ 10 s descargados del bucket público el 06-11-2026 a las 00:31 hora de Londres (de noche). Detección YOLOX-s (Apache 2.0) + ByteTrack; sin identificar personas ni matrículas.', capturaUTC: '2026-11-06T00:31Z', camaras: rows }, null, 1));
  for (const f of readdirSync(resolve(TFL, 'stills'))) copyFileSync(resolve(TFL, 'stills', f), resolve(OUT, f));
}
// Cámaras oficiales de Caltrans en los corredores de evacuación de Camp, Palisades y Eaton (vídeo HLS real
// + imágenes del operador cada ≈ 15 min), analizadas con packages/senda-vision/camera_flow.py.
const CAMS = process.argv[4];
const G0 = JSON.parse(readFileSync(GOES, 'utf8')).casos;
if (CAMS) {
  const rows = [];
  for (const d of readdirSync(CAMS).filter((x) => /^c\d\d$/.test(x)).sort()) {
    const m = JSON.parse(readFileSync(resolve(CAMS, d, 'meta.json'), 'utf8')), fF = resolve(CAMS, d, 'flow.json'), f = existsSync(fF) ? JSON.parse(readFileSync(fF, 'utf8')) : {};
    const fr = G0[m.zona].frames, s = FC.approachSeries(fr, [m.lat, m.lon]), dmin = Math.min(...s.map((x) => x.distKm));
    rows.push({ zona: m.zona, id: m.id, ruta: m.ruta, lat: m.lat, lon: m.lon, sentido: m.dir || null, imagenEnDirecto: m.img,
      video: f.durS ? { durS: f.durS, cruces: f.cruces, flujoVehH: f.flujoVehH, mediaEnImagen: f.mediaEnImagen, maxEnImagen: f.maxEnImagen, seguidos: f.seguidos, velMedianaMovKmh: f.velMedianaMovKmh, fraccionParados: f.fraccionParados } : null,
      serie: (f.serieImagenes || []).map((x) => x.vehiculos),
      estado: f.durS || (f.serieImagenes || []).some((x) => x.vehiculos != null) ? 'en servicio' : 'fuera de servicio (el operador sirve «Temporarily Unavailable»)',
      fuegoHistorico: { distMinKm: +dmin.toFixed(1), a5km: FC.firstWithin(s, 5.1), a3km: FC.firstWithin(s, 3.1) } });
  }
  writeFileSync(resolve(OUT, 'caltrans_corredores.json'), JSON.stringify({ fuente: 'Caltrans CCTV (cwwp2.dot.ca.gov, catálogos D3 y D7; vídeo HLS de wzmedia.dot.ca.gov). Capturado el 05-11-2026 hacia las 17:15 PST (hora punta de la tarde). Recuento con YOLOX-s + ByteTrack en la sesión; no se guarda ninguna imagen ni se identifica a nadie. Velocidad aproximada con el tamaño del vehículo como escala (≈ ±30 %).', capturaPST: '2026-11-05T17:15', camaras: rows }, null, 1));
}
const G = G0, TFLC = JSON.parse(readFileSync(resolve(OUT, 'tfl_camaras.json'), 'utf8'));
const CALF = resolve(OUT, 'caltrans_corredores.json'), CAL = existsSync(CALF) ? JSON.parse(readFileSync(CALF, 'utf8')) : null;

// ── 2. progresión medida y tramos ───────────────────────────────────────────────
const prog = {}, points = [], sourceQA = {};
for (const [f, c] of Object.entries(G)) {
  // Legacy v0.20 compact frames dropped the mask. They are replayable but NOT quality-certified.
  // New raw exports preserve d[3], and strict pixels are used when sufficient observations remain.
  const Q = filterGoesFrames(c.frames);
  sourceQA[f] = { status: Q.status, usableForCalibration: Q.usableForCalibration, counts: Q.counts, removedFraction: Q.removedFraction };
  const candidateFrames = Q.usableForCalibration ? Q.frames : c.frames;
  const P = FC.goesProgression(candidateFrames, { hrrr: c.hrrr }), seg = FC.runSegments(P, c.hrrr);
  prog[f] = { ...META[f], primeraDeteccion: P.firstDetection, origen: P.origin.map((x) => +x.toFixed(4)), dirDeg: P.dirDeg, dirFuente: P.dirFuente, pixelKm: [+P.pixel.dxKm.toFixed(2), +P.pixel.dyKm.toFixed(2)],
    filas: P.rows.map((r) => ({ t: r.t, min: Math.round(r.min), n: r.n, frpMW: r.frpMW, frenteKm: r.frontMaxKm })), tramos: seg,
    frenteRobustoExploratorio: Q.usableForCalibration ?
      estimateRobustFront(c.frames, { origin: P.origin, spreadToDeg: P.dirDeg,
        pixelResolutionKm: Math.max(P.pixel.dxKm, P.pixel.dyKm), minPixelsPerFrame: 3, minFrames: 4, frontQuantile: 0.8 }) :
      { status: 'REQUIRES_MASKED_RAW_GOES', speedKmh: null, forOperationalAlert: false },
    hrrr: c.hrrr.map((h) => ({ t: h.validUTC, u10Kmh: +(Math.hypot(h.u10, h.v10) * 3.6).toFixed(1), rachaKmh: +(h.gust * 3.6).toFixed(1), t2: h.t2, hr: h.rh2 })) };
  for (const s of seg) if (s.resuelto) points.push({ caso: f, combustible: META[f].combustible, ...s });
}

// ── 3. entrenamiento y validación ───────────────────────────────────────────────
const loo = FC.leaveOneFireOut(points, { models: ['potencia', 'razon-combustible', 'bayes-10%'] });
const cal = FC.calibrateRule(points), cov80 = FC.looCoverage(points, { level: 0.8 }), cov90 = FC.looCoverage(points, { level: 0.9 });
const nistCamp = { documentado: '≈ 7 millas en 90 min ≈ 7,5 km/h (presentación de NIST; pendiente de verificar en la TN 2135)', medidoGoes: points.find((p) => p.caso === 'camp')?.rosKmh ?? null };

// ── 4. contraste fuera de muestra con el caso español (SMV 2026) ────────────────
const SMV = resolve(ROOT, 'investor-next/public/senda/data/smv2026');
let smv = null;
if (existsSync(resolve(SMV, 'fire3d.json'))) {
  const meta = JSON.parse(readFileSync(resolve(SMV, 'real.json'), 'utf8')), r3 = JSON.parse(readFileSync(resolve(SMV, 'fire3d.json'), 'utf8'));
  const bits = new Uint8Array(readFileSync(resolve(SMV, 'burn_100m.bin'))), W = meta.dem.w, H = meta.dem.h, ig = r3.ignicion, dx = 0.1;
  // componente conexa del 24-07 que contiene la ignición (o la celda quemada más cercana)
  let seed = null, best = Infinity; for (let j = Math.max(0, ig.j - 3); j <= Math.min(H - 1, ig.j + 3); j++) for (let i = Math.max(0, ig.i - 3); i <= Math.min(W - 1, ig.i + 3); i++) if (bits[j * W + i] & 1) { const d = Math.hypot(i - ig.i, j - ig.j); if (d < best) { best = d; seed = [i, j]; } }
  let maxKm = 0, cells = 0;
  if (seed) {
    const seen = new Uint8Array(W * H), st = [seed]; seen[seed[1] * W + seed[0]] = 1;
    while (st.length) { const [i, j] = st.pop(); cells++; maxKm = Math.max(maxKm, Math.hypot(i - ig.i, j - ig.j) * dx); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const u = i + a, v = j + b; if (u >= 0 && v >= 0 && u < W && v < H && !seen[v * W + u] && bits[v * W + u] & 1) { seen[v * W + u] = 1; st.push([u, v]); } } }
  }
  const u10 = r3.masaDeAire?.[1]?.viento10Kmh ?? r3.masaDeAire?.[1]?.u10Kmh ?? 23, horas = 20, I = cal.interval(u10, 0.8);
  smv = { componenteHa: cells, frenteMaxKm: +maxKm.toFixed(2), horasHastaImagen: horas, rosMediaMinKmh: +(maxKm / horas).toFixed(2), u10Kmh: u10, prediccion: { regla10: +FC.tenPercentRule(u10).toFixed(2), mediana: +I.mediana.toFixed(2), p10: +I.lo.toFixed(2), p90: +I.hi.toFixed(2) },
    nota: 'La imagen Sentinel-2 del 24-07 llega ≈ 20 h después de la ignición calibrada (15 UTC del 23-07): la velocidad media incluye la noche y las pausas, así que es una cota inferior de la carrera diurna.' };
}

// ── 5. cuándo se acercó el fuego a lugares documentados (GOES) ──────────────────
const places = {
  altadenaOeste: { fire: 'eaton', p: [34.19, -118.155], nombre: 'Altadena oeste (centro aproximado)', documentado: 'orden de evacuación después de las 03:00 locales (11:00 UTC del 8); el fuego avanzaba hacia allí desde ≈ 21:30 y había llamas visibles poco antes de las 23:00', ordenUTC: '2025-01-08T11:00:00Z', tz: -8 },
  pentz: { fire: 'camp', p: [39.77, -121.575], nombre: 'Pentz Rd / Skyway alta (aprox.)', documentado: 'NIST: a las 08:30 el fuego alcanzó el tráfico en Pentz Rd y en la parte alta de Skyway', ordenUTC: null, tz: -8 },
  palisadesDr: { fire: 'palisades', p: [34.0465, -118.5265], nombre: 'Palisades Dr / Sunset Blvd (aprox.)', documentado: 'coches abandonados en Palisades Dr y Sunset; se apartaron con excavadora', ordenUTC: null, tz: -8 },
};
const approach = {};
for (const [k, pl] of Object.entries(places)) {
  const s = FC.approachSeries(G[pl.fire].frames, pl.p);
  approach[k] = { ...pl, serie: s.map((x) => ({ t: x.t, km: x.distKm })), a3km: FC.firstWithin(s, 3.1), a2km: FC.firstWithin(s, 2.1), a1km: FC.firstWithin(s, 1.2) };
}
// Umbral dinámico de SENDA para Altadena oeste: ROS hacia el lugar (elipse de viento) × (despeje + margen) + pavesas
const ellipse = (thetaDeg, ecc = 0.8) => (1 - ecc) / (1 - ecc * Math.cos((thetaDeg * Math.PI) / 180));
function senderTrigger(k, { clearMin = 60, marginMin = 15, spottingKm = 1.6, z = 0 } = {}) {
  const pl = places[k], c = G[pl.fire], s = FC.approachSeries(c.frames, pl.p);
  for (const x of s) {
    const w = FC.hrrrAt(c.hrrr, x.t), f = c.frames.find((q) => q.t === x.t), cen = f.det.reduce((a, d) => [a[0] + d[0] / f.det.length, a[1] + d[1] / f.det.length], [0, 0]);
    const toward = FC.bearingTo(cen, pl.p), theta = Math.abs((((w.fromDeg + 180 - toward) % 360) + 540) % 360 - 180);
    const ros = cal.interval(w.u10Kmh, 0.8)[z > 0 ? 'hi' : 'mediana'] * ellipse(theta), D = TF.triggerBufferKm({ rosKmh: ros, clearMin, marginMin, spottingKm });
    if (x.distKm <= D) return { t: x.t, distKm: x.distKm, umbralKm: +D.toFixed(2), rosHaciaKmh: +ros.toFixed(2), anguloDeg: Math.round(theta), u10Kmh: +w.u10Kmh.toFixed(1) };
  }
  return null;
}
const hoursBetween = (a, b) => (a && b ? +((Date.parse(b) - Date.parse(a)) / 3.6e6).toFixed(1) : null);
const eatonTrig = { p50: senderTrigger('altadenaOeste'), p90: senderTrigger('altadenaOeste', { z: 1 }), fijo3km: approach.altadenaOeste.a3km };
eatonTrig.adelantoHorasP50 = hoursBetween(eatonTrig.p50?.t, places.altadenaOeste.ordenUTC); eatonTrig.adelantoHorasP90 = hoursBetween(eatonTrig.p90?.t, places.altadenaOeste.ordenUTC); eatonTrig.adelantoHoras3km = hoursBetween(eatonTrig.fijo3km, places.altadenaOeste.ordenUTC);

// ── 6. Paradise · Skyway: CTM con la llegada real del fuego (GOES) ──────────────
// Trazado aproximado (pendiente de verificar con OpenStreetMap); carriles en sentido de bajada.
const SKY = [
  { name: 'Skyway alta (Magalia)', lat: 39.81, lon: -121.58, lanes: 1, vfKmh: 50 }, { name: 'Skyway alta', lat: 39.79, lon: -121.595, lanes: 1, vfKmh: 50 },
  { name: 'Paradise norte', lat: 39.775, lon: -121.605, lanes: 1, vfKmh: 40 }, { name: 'Paradise centro (tramo estrechado en 2014)', lat: 39.76, lon: -121.62, lanes: 1, vfKmh: 40 },
  { name: 'Paradise sur', lat: 39.745, lon: -121.635, lanes: 2, vfKmh: 50 }, { name: 'Skyway baja', lat: 39.735, lon: -121.665, lanes: 2, vfKmh: 80 },
  { name: 'Skyway baja', lat: 39.728, lon: -121.705, lanes: 2, vfKmh: 80 }, { name: 'Entrada a Chico', lat: 39.725, lon: -121.75, lanes: 2, vfKmh: 60 },
];
const lenKm = (a, b) => { const [x, y] = FC.localKm([a.lat, a.lon], b.lat, b.lon); return Math.hypot(x, y); };
const cellsSky = SKY.map((c, i) => ({ ...c, lenKm: +Math.max(1.5, lenKm(c, SKY[Math.min(SKY.length - 1, i + 1)]) || 3).toFixed(2) }));
const t0Camp = G.camp.frames.find((f) => f.det.length).t;
const fireAt = cellsSky.map((c) => { const s = FC.approachSeries(G.camp.frames, [c.lat, c.lon]), t = FC.firstWithin(s, 2.1); return t ? (Date.parse(t) - Date.parse(t0Camp)) / 60000 : Infinity; });
// Supuestos de demanda (explícitos): Paradise ≈ 26.000 hab. (censo 2010, pendiente de verificar),
// ≈ 1,3 vehículos por hogar de 2,3 personas y la mitad de los vehículos por Skyway.
const demandSky = [700, 800, 1800, 2200, 1500, 0, 0, 0], supuestos = 'Demanda: ≈ 7.000 vehículos por Skyway (la mitad de ≈ 14.700 vehículos de Paradise y Magalia; supuesto). Salida a Chico: 1.800 veh/h por dos carriles, que caen a 900 veh/h cuando se atasca la ciudad (supuesto coherente con el atasco documentado por NIST). Curva de salidas de Rayleigh con τ = 40 min.';
const exitSky = (t) => (t > 60 ? 900 : 1800);
const scenarios = {};
const runSky = (name, cells, opts) => { const R = TF.makeRoute(cells); const r = TF.simulateEvacuation(R, { demand: demandSky, tauMin: 40, durMin: 600, exitCap: exitSky, fireArrivalMin: fireAt, sampleEvery: 300, ...opts }); scenarios[name] = { despejeMin: r.clearMin, expuestosVehMin: r.exposedVehMin, maxAtrapados: r.maxCaught, desviados: r.diverted, serie: r.series }; return R; };
// Hora de aviso «histórica» para comparar: no la imponemos; buscamos la última hora segura.
const R1 = runSky('aviso-al-detectar', cellsSky, { warnMin: 0 });
runSky('aviso-60min', cellsSky, { warnMin: 60 });
const contra = cellsSky.map((c) => ({ ...c, lanes: c.lanes * 2 })); runSky('contraflujo-al-detectar', contra, { warnMin: 0 });
const cierres = TF.closureSchedule(R1, fireAt, { marginMin: 10 }); runSky('cierres-senda', cellsSky, { warnMin: 0, closeAtMin: cierres });
const safe = TF.latestSafeWarning(TF.makeRoute(cellsSky), { demand: demandSky, tauMin: 40, durMin: 900, exitCap: exitSky, fireArrivalMin: fireAt }, { lo: -720, hi: 240 });
const safeContra = TF.latestSafeWarning(TF.makeRoute(contra), { demand: demandSky, tauMin: 40, durMin: 900, exitCap: (t) => exitSky(t) * 2, fireArrivalMin: fireAt }, { lo: -720, hi: 240 });

// ── 7. Gemelos simulados del filtro (EnKF): ¿cuánto tarda SENDA en ver el atasco y el bloqueo? ──
function twin({ cells, demand, trueCap, bottlenecks, obsCells, flowCells, probeEvery = 1, steps = 240, dt = 30, seed = 11, tau = 30, exitCap = 3600 }) {
  const R = TF.makeRoute(cells), N = cells.length; let n = new Array(N).fill(0), q = new Array(N).fill(0), prev = 0, r = seed;
  const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }, g = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
  const F = TF.makeEnkf(R, { members: 40, bottlenecks, seed }), track = [];
  // Ruido de cámara tomado de las cámaras reales de Londres (dispersión de vehículos en imagen).
  // Ruido de cámara tomado de cámaras reales: vehículos en imagen en Londres (noche) y Caltrans (hora punta).
  const occ = [...TFLC.camaras.map((c) => c.mediaEnImagen), ...(CAL?.camaras || []).filter((c) => c.video).map((c) => c.video.mediaEnImagen)];
  const camSd = Math.max(1, Math.sqrt(occ.reduce((a, x) => a + x, 0) / Math.max(1, occ.length)));
  for (let s = 0; s <= steps; s++) {
    const t = (s * dt) / 60, dep = TF.rayleighDepart(t, tau), inflow = demand.map((d) => d * (dep - prev)); prev = dep;
    const capT = (i) => trueCap(i, t), st = TF.ctmStep(R, n, dt, { capF: capT, exitCapVehH: exitCap * (bottlenecks.includes(N) ? trueCap(N, t) : 1), inflow, queue: q }); n = st.n; q = st.queue;
    F.forecast(dt, { inflow, exitCapVehH: exitCap });
    if (s % 4 === 0) {
      const obs = [], k = (c) => n[c] / (R.cells[c].lenKm * R.cells[c].lanes);
      for (const c of obsCells) obs.push({ tipo: 'camara-densidad', cell: c, valor: Math.max(0, k(c) + camSd * g()), sd: camSd });
      for (let c = 0; c < N; c += probeEvery) obs.push({ tipo: 'sonda-velocidad', cell: c, valor: Math.max(0, R.cells[c].fd.speed(k(c)) + 4 * g()), sd: 4 });
      for (const c of flowCells) { const cf = capT(c), send = Math.min(R.cells[c].fd.vfKmh * k(c), R.cells[c].fd.qmax * cf) * R.cells[c].lanes; let recv; if (c === N - 1) recv = exitCap * (bottlenecks.includes(N) ? trueCap(N, t) : 1); else { const d = R.cells[c + 1], kd = k(c + 1); recv = Math.min(d.fd.qmax * capT(c + 1), d.fd.wKmh * Math.max(0, d.fd.kj - kd)) * d.lanes; } obs.push({ tipo: 'camara-flujo', cell: c, valor: Math.max(0, Math.min(send, recv) / 60 + 1.5 * g()), sd: 1.5 }); }
      F.analyze(obs); const m = F.mean(); track.push({ tMin: +t.toFixed(1), cap: m.capFactor.map((x) => +x.toFixed(3)), sd: m.capSd.map((x) => +x.toFixed(3)), verdad: bottlenecks.map((b) => +trueCap(b, t).toFixed(3)) });
    }
  }
  return { track, camSd: +camSd.toFixed(2) };
}
// (a) Atasco aguas abajo (Chico) que la salida de Paradise no ve: capacidad de salida cae al 30 % en el minuto 45.
const twinA = twin({ cells: cellsSky.map(({ lenKm, lanes, vfKmh }) => ({ lenKm, lanes, vfKmh })), demand: demandSky, bottlenecks: [cellsSky.length], trueCap: (i, t) => (i === cellsSky.length && t > 45 ? 0.3 : 1), obsCells: [3, 6], flowCells: [cellsSky.length - 1], exitCap: 1800, tau: 40 });
const detA = twinA.track.find((x) => x.tMin > 45 && x.cap[0] < 0.5 && x.sd[0] < 0.1);
const convA = twinA.track.find((x) => x.tMin > 45 && Math.abs(x.cap[0] - 0.3) < 0.05);
// (b) Palisades Dr: coches abandonados bloquean la celda 3 en el minuto 50; ¿qué celda y cuándo?
const PAL = [{ lenKm: 1.2, lanes: 1, vfKmh: 40 }, { lenKm: 1.2, lanes: 1, vfKmh: 40 }, { lenKm: 1.2, lanes: 1, vfKmh: 40 }, { lenKm: 0.8, lanes: 1, vfKmh: 40 }, { lenKm: 1.5, lanes: 2, vfKmh: 50 }, { lenKm: 1.5, lanes: 2, vfKmh: 50 }];
const twinB = twin({ cells: PAL, demand: [900, 800, 600, 200, 300, 0], bottlenecks: [2, 3, 4], trueCap: (i, t) => (i === 3 && t > 50 ? 0.05 : 1), obsCells: [3], flowCells: [3], probeEvery: 1, tau: 25, exitCap: 2400 });
// Localización: la celda bloqueada es la de menor factor, < 0,5 y al menos 0,3 por debajo de las demás.
const detB = twinB.track.find((x) => { if (x.tMin <= 50) return false; const i = x.cap.indexOf(Math.min(...x.cap)), others = x.cap.filter((_, k) => k !== i); return i === 1 && x.cap[1] < 0.5 && Math.min(...others) - x.cap[1] > 0.3; });

// ── 8. cámaras reales: modelo de ruido ─────────────────────────────────────────
const camNoise = TFLC.camaras.map((c) => ({ camara: c.camara, nombre: c.nombre, ...TF.cameraNoiseFromCounts({ meanInFrame: c.mediaEnImagen, crossings: c.cruces, durationS: c.durS }) }));
const totalCross = TFLC.camaras.reduce((a, c) => a + c.cruces, 0), totalDur = TFLC.camaras.reduce((a, c) => a + c.durS, 0);

// ── salida ──────────────────────────────────────────────────────────────────────
const result = {
  version: 'v0.21-research-replay', generado: new Date().toISOString().slice(0, 10),
  observationQuality: { sources: sourceQA, trainingStatus: Object.values(sourceQA).every((q) => q.usableForCalibration)
    ? 'FILTERED_RESEARCH_NOT_FIELD_VALIDATED' : 'LEGACY_UNVERIFIED_REPROCESS_RAW_GOES_REQUIRED',
    note: 'If any raw mask is lost, numerical fit remains a reproducibility reference only. Do not claim operational predictive accuracy, lead-time or calibration.' },
  fuentes: FC.FIRE_SOURCES_REF, base: FC.REFERENCE_FIRES.map(({ id, nombre, pais, fecha, combustible, satelite, hechos, leccion }) => ({ id, nombre, pais, fecha, combustible, satelite, hechos, leccion })),
  progresion: prog,
  entrenamiento: { puntos: points, loo: { n: loo.n, casos: loo.casos, scores: loo.scores, preds: loo.preds }, regla10Calibrada: { mu: cal.mu, sigma: cal.sigma, sigmaPred: cal.sigmaPred, n: cal.n, factorMediana: cal.factorMediana }, cobertura80: { cobertura: cov80.cobertura, n: cov80.n, filas: cov80.rows }, cobertura90: { cobertura: cov90.cobertura, n: cov90.n }, nistCamp },
  smv,
  aproximacion: approach, eatonDisparo: eatonTrig,
  paradise: { celdas: cellsSky.map((c, i) => ({ nombre: c.name, lenKm: c.lenKm, carriles: c.lanes, vfKmh: c.vfKmh, lat: c.lat, lon: c.lon, llegadaFuegoMin: Number.isFinite(fireAt[i]) ? Math.round(fireAt[i]) : null, cierreMin: cierres[i] })), t0: t0Camp, supuestos, escenarios: scenarios, ultimoAvisoSeguroMin: safe, ultimoAvisoSeguroContraflujoMin: safeContra },
  gemelos: { atascoChico: { deteccion: detA ?? null, convergencia: convA ?? null, track: twinA.track, ruidoCamara: twinA.camSd }, palisadesBloqueo: { deteccion: detB ?? null, track: twinB.track } },
  caltrans: CAL ? { fuente: CAL.fuente, captura: CAL.capturaPST, camaras: CAL.camaras } : null,
  camaras: { fuente: TFLC.fuente, captura: TFLC.capturaUTC, total: { cruces: totalCross, segundos: +totalDur.toFixed(1), porHora: Math.round((totalCross / totalDur) * 3600) }, ruido: camNoise },
};
writeFileSync(resolve(OUT, 'referencias.json'), JSON.stringify(result));
writeFileSync(resolve(ROOT, 'docs/paper/resultados_v020.json'), JSON.stringify({ ...result, progresion: Object.fromEntries(Object.entries(prog).map(([k, v]) => [k, { ...v, filas: undefined, hrrr: undefined }])), aproximacion: Object.fromEntries(Object.entries(approach).map(([k, v]) => [k, { ...v, serie: undefined }])), gemelos: { atascoChico: { deteccion: detA, convergencia: convA }, palisadesBloqueo: { deteccion: detB } } }, null, 1));

const fmt = (t, tz = -8) => (t ? new Date(Date.parse(t) + tz * 3.6e6).toISOString().slice(11, 16) : '—');
console.log('GOES observation quality:', JSON.stringify(result.observationQuality));
console.log('puntos de entrenamiento', points.length, 'de', new Set(points.map((p) => p.caso)).size, 'incendios');
console.log('LOO', JSON.stringify(loo.scores));
console.log('regla 10 % calibrada', JSON.stringify({ mu: cal.mu, sigma: cal.sigma, factor: cal.factorMediana }), 'cobertura 80 %', cov80.cobertura, '90 %', cov90.cobertura);
console.log('Camp NIST vs GOES', nistCamp.medidoGoes, 'km/h');
console.log('SMV', JSON.stringify(smv));
console.log('Altadena oeste: GOES a ≤3 km', fmt(approach.altadenaOeste.a3km), 'local; disparo SENDA P50', fmt(eatonTrig.p50?.t), 'P90', fmt(eatonTrig.p90?.t), '; adelanto vs orden (h):', eatonTrig.adelantoHorasP50, eatonTrig.adelantoHorasP90, eatonTrig.adelantoHoras3km);
console.log('Pentz: GOES a ≤3 km', fmt(approach.pentz.a3km), '≤2 km', fmt(approach.pentz.a2km), '(NIST: 08:30)');
console.log('Palisades Dr: ≤2 km', fmt(approach.palisadesDr.a2km));
console.log('Paradise llegada fuego (min tras 1ª detección)', fireAt.map((x) => (Number.isFinite(x) ? Math.round(x) : '∞')).join(','), 'cierres', cierres.join(','));
for (const [k, v] of Object.entries(scenarios)) console.log(' ', k, 'despeje', v.despejeMin, 'min; expuestos', v.expuestosVehMin, 'veh·min; máx', v.maxAtrapados, '; desviados', v.desviados);
console.log('último aviso seguro (min respecto a la 1ª detección):', JSON.stringify(safe), 'contraflujo', JSON.stringify(safeContra));
console.log('gemelo A (atasco en Chico, real 0,30 desde el min 45): detectado', JSON.stringify(detA));
console.log('gemelo B (bloqueo Palisades Dr, celda 3 desde el min 50): detectado', JSON.stringify(detB));
console.log('cámaras TfL', JSON.stringify(result.camaras.total));
if (CAL) for (const c of CAL.camaras) console.log(' Caltrans', c.zona, c.id, c.video ? `${c.video.flujoVehH} veh/h, ${c.video.mediaEnImagen} en imagen, v≈${c.video.velMedianaMovKmh} km/h` : c.estado, 'serie', c.serie.map((x) => x ?? '·').join(','), '· fuego histórico a', c.fuegoHistorico.distMinKm, 'km', c.fuegoHistorico.a5km ? `(≤5 km ${fmt(c.fuegoHistorico.a5km)})` : '');
