/**
 * SENDA · Propagación sobre el terreno real, conjunto probabilístico, validación y óptica de cámaras (v0.19).
 *
 * 1. LLEGADA DEL FUEGO sobre una malla con terreno, combustible y VIENTO VARIABLE EN EL ESPACIO Y EN EL TIEMPO
 *    (Dijkstra con costes dependientes del tiempo: el viento de cada tramo es el de la hora a la que llega el frente).
 *    Elipse de viento y pendiente de Rothermel del núcleo `wildfire.mjs`.
 * 2. CONJUNTO (Monte Carlo) con perturbaciones de dirección y fuerza del viento y de la velocidad base →
 *    probabilidad de que el fuego haya llegado a cada celda antes de t.
 * 3. VALIDACIÓN contra una cicatriz observada (Sentinel-2): Jaccard, Sørensen y habilidad frente a un modelo nulo
 *    (círculo de la misma área), comparando a igualdad de área para no depender de la hora de ignición.
 * 4. CÁMARAS: modelo estenopeico con rumbo, inclinación y campo de visión; geolocalización de un píxel sobre el
 *    terreno con UNA cámara; triangulación 3D con VARIAS (altura de la columna); calor del fuego a partir de la
 *    altura de la columna (inversión de Briggs); anchura del frente por la frecuencia de parpadeo de la llama;
 *    sincronización de cámaras por destellos (correlación cruzada de brillo).
 */
import { windShape } from './wildfire.mjs';
import { G, CP } from './atmos3d.mjs';

/** Velocidad base sin viento ni pendiente (m/min) por clase de combustible de `fuel_100m.bin`. Valores ORIENTATIVOS. */
export const ROS0 = Object.freeze({ 0: 0, 1: 6, 2: 3, 3: 1.5, 4: 0.2 });
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

function heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(t, i) { a.push([t, i]); let c = a.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (a[p][0] <= a[c][0]) break; [a[p], a[c]] = [a[c], a[p]]; c = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === c) break; [a[m], a[c]] = [a[c], a[m]]; c = m; } } return top; },
  };
}

/**
 * Tiempo de llegada (min) desde las igniciones. Malla con la fila 0 al NORTE; x hacia el este.
 * @param {{w:number,h:number,dx:number,elev:ArrayLike<number>,fuel:ArrayLike<number>}} F
 * @param {Array<{i:number,j:number,t?:number}>} ignitions
 * @param {(i:number,j:number,tMin:number)=>{u:number,v:number}} windAt viento (m/s, u este, v norte) en la celda y el minuto
 */
export function arrivalOnField(F, ignitions, windAt, { rosMult = 1, maxMin = 1440, ros0 = ROS0, beta = 0.01 } = {}) {
  const { w, h, dx, elev, fuel } = F, T = new Float32Array(w * h).fill(Infinity), H = heap();
  for (const g of ignitions) { const c = g.j * w + g.i; if (g.i >= 0 && g.j >= 0 && g.i < w && g.j < h && ros0[fuel[c]] > 0) { T[c] = Math.min(T[c], g.t ?? 0); H.push(T[c], c); } }
  const slopeK = 5.275 * beta ** -0.3;
  while (H.size) {
    const [t, c] = H.pop(); if (t > T[c] || t > maxMin) continue;
    const i = c % w, j = (c - i) / w, r0 = ros0[fuel[c]] * rosMult; if (r0 <= 0) continue;
    const wv = windAt(i, j, t), kmh = Math.hypot(wv.u, wv.v) * 3.6, { head, ecc } = windShape(kmh), toRad = Math.atan2(-wv.v, wv.u);
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const n = nj * w + ni; if (ros0[fuel[n]] <= 0) continue;
      const dist = Math.hypot(di, dj) * dx, dir = Math.atan2(dj, di), ell = (head * (1 - ecc)) / (1 - ecc * Math.cos(dir - toRad));
      const tan = (elev[n] - elev[c]) / dist, slope = tan > 0 ? slopeK * tan * tan : 0;
      const ros = r0 * ell * (1 + slope), nt = t + dist / Math.max(ros, 1e-3);
      if (nt < T[n]) { T[n] = nt; H.push(T[n], n); } // se encola el valor ya redondeado a 32 bits: si no, el frente se descarta como obsoleto
    }
  }
  return T;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/**
 * Conjunto de simulaciones con incertidumbre. Devuelve las llegadas y una función de probabilidad P(T ≤ t) en 0–100.
 */
export function ensembleArrival(F, ignitions, windAt, { members = 24, seed = 11, dirSdDeg = 15, speedSd = 0.2, rosSd = 0.25, maxMin = 1440 } = {}) {
  const R = rng(seed), N = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R()), runs = [];
  for (let m = 0; m < members; m++) {
    const rot = (N() * dirSdDeg * Math.PI) / 180, sc = Math.exp(N() * speedSd), rm = Math.exp(N() * rosSd), c = Math.cos(rot), s = Math.sin(rot);
    runs.push({ rot, sc, rm, T: arrivalOnField(F, ignitions, (i, j, t) => { const q = windAt(i, j, t); return { u: (q.u * c + q.v * s) * sc, v: (-q.u * s + q.v * c) * sc }; }, { rosMult: rm, maxMin }) });
  }
  const pAt = (tMin) => { const P = new Uint8Array(F.w * F.h); for (let k = 0; k < P.length; k++) { let n = 0; for (const r of runs) if (r.T[k] <= tMin) n++; P[k] = Math.round((100 * n) / runs.length); } return P; };
  return { runs, pAt };
}
export const burnedMask = (T, tMin) => Uint8Array.from(T, (x) => (x <= tMin ? 1 : 0));
export const countOnes = (m) => { let n = 0; for (const x of m) n += x ? 1 : 0; return n; };
export function jaccard(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = !!a[k], y = !!b[k]; if (x && y) i++; if (x || y) u++; } return u ? i / u : 1; }
export function sorensen(a, b) { let i = 0, s = 0; for (let k = 0; k < a.length; k++) { const x = !!a[k], y = !!b[k]; if (x && y) i++; s += (x ? 1 : 0) + (y ? 1 : 0); } return s ? (2 * i) / s : 1; }
/** Minuto en que el área simulada alcanza `cells` celdas (comparar a igualdad de área). */
export function timeForArea(T, cells) { const v = Float32Array.from(T).filter(Number.isFinite).sort(); return v.length >= cells ? v[cells - 1] : Infinity; }
/** Modelo nulo: las `cells` celdas combustibles más cercanas a la ignición (un círculo de la misma área). */
export function circleNull(F, ign, cells, ros0 = ROS0) {
  const d = []; for (let j = 0; j < F.h; j++) for (let i = 0; i < F.w; i++) if (ros0[F.fuel[j * F.w + i]] > 0) d.push([Math.hypot(i - ign.i, j - ign.j), j * F.w + i]);
  d.sort((a, b) => a[0] - b[0]); const m = new Uint8Array(F.w * F.h); for (let k = 0; k < Math.min(cells, d.length); k++) m[d[k][1]] = 1; return m;
}
/** Habilidad frente al nulo: (J − J0) / (1 − J0). > 0 mejor que un círculo. */
export const skillVsNull = (J, J0) => (J - J0) / (1 - J0);

// ---------------------------------------------------------------- Cámaras
const norm = (v) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Cámara estenopeica en coordenadas locales ENU (x este, y norte, z arriba; m). Rumbo de brújula e inclinación (negativa hacia abajo). */
export function makeCamera({ x, y, z, azDeg, tiltDeg = 0, hfovDeg = 60, w = 1920, h = 1080 }) {
  const az = (azDeg * Math.PI) / 180, tl = (tiltDeg * Math.PI) / 180, f = [Math.sin(az) * Math.cos(tl), Math.cos(az) * Math.cos(tl), Math.sin(tl)];
  const r = norm(cross(f, [0, 0, 1])), u = cross(r, f), th = Math.tan((hfovDeg * Math.PI) / 360), tv = (th * h) / w;
  return { o: [x, y, z], f, r, u, th, tv, w, h, azDeg, tiltDeg, hfovDeg };
}
/** Rayo (origen, dirección unitaria) del píxel (u, v). */
export function pixelRay(cam, px, py) {
  const xn = ((2 * px) / cam.w - 1) * cam.th, yn = (1 - (2 * py) / cam.h) * cam.tv;
  return { o: cam.o, d: norm([cam.f[0] + xn * cam.r[0] + yn * cam.u[0], cam.f[1] + xn * cam.r[1] + yn * cam.u[1], cam.f[2] + xn * cam.r[2] + yn * cam.u[2]]) };
}
/** Proyección de un punto 3D a píxel (para dibujar lo que ve cada cámara). */
export function projectPoint(cam, p) {
  const v = [p[0] - cam.o[0], p[1] - cam.o[1], p[2] - cam.o[2]], zc = dot(v, cam.f); if (zc <= 0) return { inFront: false };
  const xn = dot(v, cam.r) / zc, yn = dot(v, cam.u) / zc; return { inFront: true, u: ((xn / cam.th + 1) * cam.w) / 2, v: ((1 - yn / cam.tv) * cam.h) / 2, depth: zc };
}
/** Intersección rayo–terreno por marcha y bisección. `heightAt(x,y)` en m. */
export function rayTerrain(ray, heightAt, { step = 15, maxM = 40000 } = {}) {
  let prev = 0;
  for (let s = step; s <= maxM; s += step) {
    const p = [ray.o[0] + ray.d[0] * s, ray.o[1] + ray.d[1] * s, ray.o[2] + ray.d[2] * s];
    if (p[2] <= heightAt(p[0], p[1])) {
      let a = prev, b = s; for (let k = 0; k < 30; k++) { const m = (a + b) / 2, q = [ray.o[0] + ray.d[0] * m, ray.o[1] + ray.d[1] * m, ray.o[2] + ray.d[2] * m]; if (q[2] <= heightAt(q[0], q[1])) b = m; else a = m; }
      const q = [ray.o[0] + ray.d[0] * b, ray.o[1] + ray.d[1] * b, ray.o[2] + ray.d[2] * b]; return { hit: true, p: q, rangeM: b };
    }
    prev = s;
  }
  return { hit: false };
}
/** ¿Ve la cámara el punto p? (la visual no corta el terreno antes de llegar). */
export function lineOfSight(o, p, heightAt, { step = 20, clearM = 2 } = {}) {
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], L = Math.hypot(...d);
  for (let s = step; s < L - step; s += step) { const q = [o[0] + (d[0] * s) / L, o[1] + (d[1] * s) / L, o[2] + (d[2] * s) / L]; if (q[2] < heightAt(q[0], q[1]) + clearM) return false; }
  return true;
}
/** Punto más cercano a varios rayos (mínimos cuadrados 3D): base o cima de la columna vista por varias cámaras. */
export function closestPointToRays(rays) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const { o, d, w = 1 } of rays) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const m = w * ((r === c ? 1 : 0) - d[r] * d[c]); A[r][c] += m; b[r] += m * o[c]; }
  const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  if (Math.abs(det) < 1e-9) return { ok: false };
  const inv = [[A[1][1] * A[2][2] - A[1][2] * A[2][1], A[0][2] * A[2][1] - A[0][1] * A[2][2], A[0][1] * A[1][2] - A[0][2] * A[1][1]], [A[1][2] * A[2][0] - A[1][0] * A[2][2], A[0][0] * A[2][2] - A[0][2] * A[2][0], A[0][2] * A[1][0] - A[0][0] * A[1][2]], [A[1][0] * A[2][1] - A[1][1] * A[2][0], A[0][1] * A[2][0] - A[0][0] * A[2][1], A[0][0] * A[1][1] - A[0][1] * A[1][0]]].map((r) => r.map((x) => x / det));
  const p = [0, 1, 2].map((r) => inv[r][0] * b[0] + inv[r][1] * b[1] + inv[r][2] * b[2]);
  const res = rays.map(({ o, d }) => { const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], t = dot(v, d); return Math.hypot(v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]); });
  return { ok: true, p, residualRmsM: Math.sqrt(res.reduce((s, x) => s + x * x, 0) / res.length) };
}
/**
 * Calor convectivo del fuego (W) a partir de la altura de la columna sobre el foco, invirtiendo la altura final de
 * Briggs en atmósfera estable: Δh = 2,6·(F/(U·N²))^⅓ → F = U·N²·(Δh/2,6)³ → Q = F·π·cp·ρ·T/g. Orden de magnitud.
 */
export function plumeHeatFromHeight({ riseM, U, N2, rho = 1.05, tK = 305 }) {
  const F = Math.max(1, U) * Math.max(N2, 1e-5) * (riseM / 2.6) ** 3; return { F, qW: (F * Math.PI * CP * rho * tK) / G };
}
/**
 * Calor del fuego (W) con la base y un punto de la columna triangulados: en la fase de ascenso curvado
 * Δz = 1,6·F^⅓·x^⅔/U → F = (Δz·U / (1,6·x^⅔))³ (Briggs). x = distancia horizontal base–punto (m).
 */
export function plumeHeatFromRise({ riseM, xM, U, rho = 1.05, tK = 305 }) {
  const F = ((riseM * Math.max(1, U)) / (1.6 * Math.max(xM, 1) ** (2 / 3))) ** 3; return { F, qW: (F * Math.PI * CP * rho * tK) / G };
}
/** Frecuencia dominante de parpadeo (Hz) en una serie de brillo y fracción de energía en la banda de llama (1–15 Hz). */
export function flickerSpectrum(series, fps) {
  const n = series.length, mean = series.reduce((s, x) => s + x, 0) / n, x = series.map((v) => v - mean); let best = { f: 0, p: 0 }, band = 0, tot = 0;
  for (let k = 1; k < n / 2; k++) { let re = 0, im = 0; for (let t = 0; t < n; t++) { const a = (2 * Math.PI * k * t) / n; re += x[t] * Math.cos(a); im -= x[t] * Math.sin(a); } const p = re * re + im * im, f = (k * fps) / n; tot += p; if (f >= 1 && f <= 15) { band += p; if (p > best.p) best = { f, p }; } }
  return { peakHz: best.f, bandRatio: tot ? band / tot : 0 };
}
/** Anchura aproximada de la base de la llama por la frecuencia de «puffing»: f ≈ 1,5·D^−½ (Cetegen y Ahmed, 1993). Aproximación de charco. */
export const flickerToWidthM = (fHz) => (1.5 / fHz) ** 2;
/** Desfase (en muestras) que mejor alinea dos series de brillo: sincroniza cámaras con un destello común. */
export function syncOffset(a, b, maxLag = 50) {
  const m = (s) => s.reduce((x, y) => x + y, 0) / s.length, ma = m(a), mb = m(b); let best = { lag: 0, r: -Infinity };
  for (let L = -maxLag; L <= maxLag; L++) { let s = 0, sa = 0, sb = 0; for (let t = 0; t < a.length; t++) { const u = t + L; if (u < 0 || u >= b.length) continue; const x = a[t] - ma, y = b[u] - mb; s += x * y; sa += x * x; sb += y * y; } const r = s / Math.sqrt(sa * sb || 1); if (r > best.r) best = { lag: L, r }; }
  return best;
}
