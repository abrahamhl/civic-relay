/**
 * SENDA · Planificador de radioenlaces sobre relieve real (núcleo puro, sin E/S).
 *
 * Responde a: «si cae la red móvil, ¿dónde pongo repetidores de radio de baja potencia (p. ej. LoRa en 868 MHz)
 * para que un aviso llegue de la cabecera de un barranco a los pueblos de abajo?».
 *
 * MODELO (basis: 'MODEL' — es una PREDICCIÓN de propagación, no una medida de campo):
 *  - Pérdida en espacio libre (Friis): L = 32,45 + 20·log10(f MHz) + 20·log10(d km).
 *  - Difracción por el relieve: aristas de cuchillo según ITU-R P.526 (aprox. J(ν) = 6,9 + 20·log10(√((ν−0,1)²+1) + ν − 0,1),
 *    válida para ν > −0,78), combinadas con el método de Deygout (arista principal + una secundaria a cada lado).
 *  - Curvatura de la Tierra con radio efectivo k·R (k lo aporta quien llama; 4/3 es la atmósfera estándar de la ITU).
 *
 * LO QUE NO INCLUYE (se devuelve en `assumptions`): edificios, vegetación, interiores, multitrayecto, interferencias
 * y ciclo de trabajo. Un modelo de terreno desnudo es OPTIMISTA en zona urbana o arbolada.
 *
 * Veracidad: potencia, ganancias, sensibilidad y margen NO llevan valor por defecto. Quien simula los declara
 * (con su fuente: hoja de datos del equipo, norma de la banda) y el resultado los repite.
 */

const R_EARTH = 6371008.8, C = 299792458;

/** Pérdida en espacio libre, dB. */
export function fsplDb(dKm, fMhz) { return 32.45 + 20 * Math.log10(fMhz) + 20 * Math.log10(Math.max(dKm, 1e-6)); }

/** Pérdida por arista de cuchillo J(ν) en dB (ITU-R P.526); 0 si ν ≤ −0,78. */
export function knifeEdgeLossDb(v) { return v > -0.78 ? 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1) : 0; }

/** Distancia haversine (m) entre {lon,lat}. */
export function distM(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Cota del terreno (m) por interpolación bilineal.
 * dem = { w, h, data (fila 0 = norte), west, north, dx, dy } con dx, dy en grados por celda (centros de celda).
 */
export function elevationAt(dem, lon, lat) {
  const fx = Math.min(dem.w - 1, Math.max(0, (lon - dem.west) / dem.dx)), fy = Math.min(dem.h - 1, Math.max(0, (dem.north - lat) / dem.dy));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(dem.w - 1, x0 + 1), y1 = Math.min(dem.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0, d = dem.data;
  return (d[y0 * dem.w + x0] * (1 - tx) + d[y0 * dem.w + x1] * tx) * (1 - ty) + (d[y1 * dem.w + x0] * (1 - tx) + d[y1 * dem.w + x1] * tx) * ty;
}

/** Parámetro de Fresnel-Kirchhoff ν de un obstáculo de altura h (m) sobre la línea, a d1 y d2 (m) de los extremos. */
function nu(h, d1, d2, lambda) { return h * Math.sqrt((2 * (d1 + d2)) / (lambda * d1 * d2)); }

/** Mayor ν del tramo [i0,i1] del perfil (extremos excluidos), respecto a la recta entre los dos extremos. */
function worstEdge(prof, i0, i1, lambda, kR) {
  const a = prof[i0], b = prof[i1], D = b.d - a.d; let best = { v: -Infinity, i: -1 };
  for (let i = i0 + 1; i < i1; i++) {
    const d1 = prof[i].d - a.d, d2 = b.d - prof[i].d, line = a.z + ((b.z - a.z) * d1) / D, bulge = (d1 * d2) / (2 * kR);
    const v = nu(prof[i].z + bulge - line, d1, d2, lambda);
    if (v > best.v) best = { v, i };
  }
  return best;
}

/**
 * Pérdida de trayecto entre dos puntos con antena a hM metros sobre el terreno.
 * @param {object} dem
 * @param {{lon,lat,hM}} tx @param {{lon,lat,hM}} rx
 * @param {{fMhz:number, kFactor:number, stepM?:number}} p  fMhz y kFactor OBLIGATORIOS.
 */
export function pathLoss(dem, tx, rx, p) {
  if (!(p?.fMhz > 0)) throw new Error('radio-planner: falta «fMhz» (frecuencia de la banda)');
  if (!(p?.kFactor > 0)) throw new Error('radio-planner: falta «kFactor» (radio efectivo de la Tierra; 4/3 = atmósfera estándar ITU)');
  if (!(tx.hM >= 0) || !(rx.hM >= 0)) throw new Error('radio-planner: cada extremo necesita «hM» (altura de antena sobre el suelo, m)');
  const D = distM(tx, rx), lambda = C / (p.fMhz * 1e6), kR = p.kFactor * R_EARTH;
  if (D < 1) return { dKm: 0, fsplDb: 0, diffractionDb: 0, totalDb: 0, los: true, edges: 0 };
  const n = Math.max(2, Math.min(400, Math.ceil(D / (p.stepM ?? 60)))), prof = new Array(n + 1);
  for (let i = 0; i <= n; i++) { const t = i / n, lon = tx.lon + (rx.lon - tx.lon) * t, lat = tx.lat + (rx.lat - tx.lat) * t; prof[i] = { d: D * t, z: elevationAt(dem, lon, lat) }; }
  prof[0].z += tx.hM; prof[n].z += rx.hM;
  const main = worstEdge(prof, 0, n, lambda, kR); let diff = 0, edges = 0;
  if (main.v > -0.78) {
    diff += knifeEdgeLossDb(main.v); edges++;
    for (const [i0, i1] of [[0, main.i], [main.i, n]]) { const s = worstEdge(prof, i0, i1, lambda, kR); if (s.v > -0.78) { diff += knifeEdgeLossDb(s.v); edges++; } }
  }
  const fs = fsplDb(D / 1000, p.fMhz);
  return { dKm: D / 1000, fsplDb: fs, diffractionDb: diff, totalDb: fs + diff, los: main.v <= 0, edges, mainNu: main.v };
}

/**
 * Balance del enlace: pérdida máxima admisible (dB). Sin valores por defecto.
 * radio = { txPowerDbm, txGainDbi, rxGainDbi, sensitivityDbm, marginDb }
 */
export function maxPathLossDb(radio) {
  for (const k of ['txPowerDbm', 'txGainDbi', 'rxGainDbi', 'sensitivityDbm', 'marginDb']) if (!Number.isFinite(radio?.[k])) throw new Error(`radio-planner: falta «${k}». No lleva valor por defecto: decláralo con su fuente.`);
  return radio.txPowerDbm + radio.txGainDbi + radio.rxGainDbi - radio.sensitivityDbm - radio.marginDb;
}

/**
 * Cobertura de un emplazamiento sobre la malla del DEM (submuestreada cada `stride` celdas).
 * @returns {{w,h,stride,covered:Uint8Array,marginDb:Float32Array,cells,coveredCells,pct}}
 */
export function coverage(dem, site, radio, p, { stride = 2, rxHM, maxKm = Infinity } = {}) {
  if (!(rxHM >= 0)) throw new Error('radio-planner: falta «rxHM» (altura del receptor sobre el suelo, m)');
  const maxL = maxPathLossDb(radio), w = Math.ceil(dem.w / stride), h = Math.ceil(dem.h / stride), covered = new Uint8Array(w * h), margin = new Float32Array(w * h).fill(NaN);
  let n = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const rx = { lon: dem.west + i * stride * dem.dx, lat: dem.north - j * stride * dem.dy, hM: rxHM };
    if (distM(site, rx) / 1000 > maxKm) continue;
    const L = pathLoss(dem, site, rx, p).totalDb, m = maxL - L; margin[j * w + i] = m; if (m >= 0) { covered[j * w + i] = 1; n++; }
  }
  return { w, h, stride, covered, marginDb: margin, cells: w * h, coveredCells: n, pct: Math.round((1000 * n) / (w * h)) / 10 };
}

/** ¿Hay enlace a→b? Devuelve la pérdida, el margen y si cierra. */
export function link(dem, a, b, radio, p) {
  const pl = pathLoss(dem, a, b, p), marginDb = maxPathLossDb(radio) - pl.totalDb;
  return { ...pl, marginDb, ok: marginDb >= 0 };
}

/**
 * Malla entre emplazamientos: enlaces que cierran y saltos mínimos desde `from` (BFS).
 * sites: [{id, lon, lat, hM}]
 */
export function mesh(dem, sites, radio, p, { from = 0 } = {}) {
  const links = [];
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) { const l = link(dem, sites[i], sites[j], radio, p); links.push({ a: i, b: j, dKm: l.dKm, lossDb: l.totalDb, marginDb: l.marginDb, los: l.los, ok: l.ok }); }
  const hops = new Array(sites.length).fill(null), prev = new Array(sites.length).fill(null); hops[from] = 0; const q = [from];
  while (q.length) { const u = q.shift(); for (const l of links) { if (!l.ok) continue; const v = l.a === u ? l.b : l.b === u ? l.a : -1; if (v >= 0 && hops[v] === null) { hops[v] = hops[u] + 1; prev[v] = u; q.push(v); } } }
  return { links, hops, prev, reachable: hops.filter((x) => x !== null).length };
}

/**
 * Elige K repetidores entre candidatos para cubrir el máximo de puntos de demanda (voraz, garantía 1−1/e del
 * problema de cobertura máxima). demand: [{lon,lat,hM,weight?}] · candidates: [{id,lon,lat,hM}]
 * `mustConnect`: si true, cada repetidor nuevo debe enlazar con alguno ya elegido (malla conexa); el primero es libre
 * o el índice `seed`.
 */
export function placeRelays(dem, candidates, demand, radio, p, K, { mustConnect = false, seed = null } = {}) {
  const maxL = maxPathLossDb(radio), cov = candidates.map((c) => demand.map((d) => pathLoss(dem, c, d, p).totalDb <= maxL));
  const wgt = demand.map((d) => d.weight ?? 1), total = wgt.reduce((a, b) => a + b, 0), done = new Array(demand.length).fill(false), chosen = [], steps = [];
  const cc = mustConnect ? candidates.map((a, i) => candidates.map((b, j) => i !== j && pathLoss(dem, a, b, p).totalDb <= maxL)) : null;
  let acc = 0;
  for (let k = 0; k < K; k++) {
    let best = -1, gain = -1;
    for (let c = 0; c < candidates.length; c++) {
      if (chosen.includes(c)) continue;
      if (k === 0 && seed !== null && c !== seed) continue;
      if (mustConnect && chosen.length && !chosen.some((s) => cc[s][c])) continue;
      let g = 0; for (let d = 0; d < demand.length; d++) if (!done[d] && cov[c][d]) g += wgt[d];
      if (g > gain) { gain = g; best = c; }
    }
    if (best < 0 || (gain <= 0 && !(k === 0 && seed !== null))) break;
    chosen.push(best); for (let d = 0; d < demand.length; d++) if (cov[best][d]) done[d] = true; acc += gain;
    steps.push({ candidate: best, id: candidates[best].id ?? best, gain, cumulative: acc, pct: Math.round((1000 * acc) / total) / 10 });
  }
  return { basis: 'MODEL', chosen, steps, covered: done, coveredWeight: acc, totalWeight: total, pct: total ? Math.round((1000 * acc) / total) / 10 : null, assumptions: ASSUMPTIONS };
}

/** Candidatos a repetidor: máximos locales del relieve en ventanas de `win` celdas (cimas y lomas). */
export function peakCandidates(dem, { win = 12, hM, minProminenceM = 0 } = {}) {
  if (!(hM >= 0)) throw new Error('radio-planner: falta «hM» (altura del mástil del repetidor, m)');
  const out = [];
  for (let j0 = 0; j0 < dem.h; j0 += win) for (let i0 = 0; i0 < dem.w; i0 += win) {
    let bz = -Infinity, bi = 0, bj = 0, mn = Infinity;
    for (let j = j0; j < Math.min(dem.h, j0 + win); j++) for (let i = i0; i < Math.min(dem.w, i0 + win); i++) { const z = dem.data[j * dem.w + i]; if (z > bz) { bz = z; bi = i; bj = j; } if (z < mn) mn = z; }
    if (bz - mn >= minProminenceM) out.push({ id: `c${out.length}`, lon: dem.west + bi * dem.dx, lat: dem.north - bj * dem.dy, hM, z: bz });
  }
  return out;
}

export const ASSUMPTIONS = Object.freeze([
  'Predicción con modelo de propagación (espacio libre + difracción ITU-R P.526 / Deygout); no es una medida de campo',
  'Terreno desnudo: sin edificios, vegetación ni interiores → optimista en casco urbano y arbolado',
  'Sin multitrayecto, interferencias ni límite de ciclo de trabajo de la banda',
  'Potencia, ganancias, sensibilidad, margen, alturas y factor k son parámetros declarados por quien simula',
  'El relieve es un modelo digital de superficie remuestreado: obstáculos menores que la celda no existen para el cálculo',
]);
