/**
 * SENDA · Sentidos ampliados: ver los sonidos, oír la radio y ver la respiración.
 *
 * 1) ESCUCHA CORAL (ver los sonidos). Varios móviles alrededor de los escombros oyen el mismo golpe en
 *    instantes distintos. Con sus posiciones y las diferencias de llegada (TDOA), la multilateración
 *    por mínimos cuadrados (Gauss-Newton) sitúa el golpe en un mapa con su incertidumbre. Los relojes de
 *    los móviles no están sincronizados: un pitido de sincronía emitido desde un punto conocido calcula
 *    el desfase de cada uno. Límite físico: el sonido viaja ~343 m/s por el aire pero mucho más rápido
 *    por hormigón y de forma irregular por escombros, así que el resultado es una ZONA, no un punto.
 * 2) MODO ARVA (oír la radio). Como los detectores de víctimas de avalancha, convierte la intensidad
 *    Bluetooth de la baliza SENDA de una persona atrapada en pitidos más rápidos al acercarse, con un
 *    intervalo de distancia honesto (la atenuación real depende de muros y cuerpos).
 * 3) RESPIRACIÓN POR WI-FI (ver la respiración): `through-wall.mjs` (CSI con un accesorio ESP32).
 *    Validada en condiciones controladas; a través de muros no hay validación independiente.
 */
import { rssiToDistanceM } from './rubble.mjs';

export const SOUND_AIR_MS = 343;

/** Desfase de reloj de cada móvil a partir de un pitido emitido en un punto conocido. */
export function clockOffsets(phones, chirpAt, arrivals, { c = SOUND_AIR_MS } = {}) {
  const raw = phones.map((p, i) => arrivals[i] - Math.hypot(p.x - chirpAt.x, p.y - chirpAt.y) / c);
  return raw.map((o) => o - raw[0]); // relativo al móvil 0
}

/**
 * Multilateración 2D por diferencias de llegada.
 * @param {Array<{x:number,y:number,t:number}>} obs  posición del móvil (m) y llegada corregida (s)
 * @returns {{x, y, t0, rmsMs, sigmaM}}  sigmaM: incertidumbre 1σ aproximada si el ruido de tiempo es `sigmaS`
 */
export function multilaterate(obs, { c = SOUND_AIR_MS, iters = 60, sigmaS = 0.0005 } = {}) {
  if (obs.length < 3) throw new Error('hacen falta al menos 3 móviles');
  let x = obs.reduce((s, o) => s + o.x, 0) / obs.length + 0.5, y = obs.reduce((s, o) => s + o.y, 0) / obs.length + 0.5;
  let t0 = Math.min(...obs.map((o) => o.t)) - 0.01, JtJ = null;
  for (let it = 0; it < iters; it++) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    for (const o of obs) {
      const d = Math.max(1e-6, Math.hypot(x - o.x, y - o.y)), r = o.t - (t0 + d / c), J = [(x - o.x) / (c * d), (y - o.y) / (c * d), 1];
      for (let i = 0; i < 3; i++) { b[i] += J[i] * r; for (let j = 0; j < 3; j++) A[i][j] += J[i] * J[j]; }
    }
    const dlt = solve3(A, b); if (!dlt) break; x += dlt[0]; y += dlt[1]; t0 += dlt[2]; JtJ = A;
    if (Math.hypot(dlt[0], dlt[1]) < 1e-4) break;
  }
  const res = obs.map((o) => o.t - (t0 + Math.hypot(x - o.x, y - o.y) / c)), rmsMs = 1000 * Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
  const inv = JtJ ? inv3(JtJ) : null, sigmaM = inv ? sigmaS * Math.sqrt(Math.max(0, inv[0][0] + inv[1][1])) : null;
  return { x, y, t0, rmsMs, sigmaM };
}
function solve3(A, b) { const inv = inv3(A); return inv ? inv.map((row) => row[0] * b[0] + row[1] * b[1] + row[2] * b[2]) : null; }
function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-24) return null;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}

/** Primer instante en que la señal supera k veces el ruido de fondo (detector de golpe). */
export function detectOnset(samples, sr, { k = 6, noiseS = 0.05 } = {}) {
  const n = Math.max(8, Math.round(noiseS * sr)), noise = Math.sqrt(samples.slice(0, n).reduce((s, v) => s + v * v, 0) / n) || 1e-9;
  for (let i = n; i < samples.length; i++) if (Math.abs(samples[i]) > k * noise) return i / sr;
  return null;
}

/** Escenario ilustrativo: 5 móviles alrededor de un edificio derrumbado, un golpe y relojes desfasados. */
export function chorusScenario({ seed = 3, knock = { x: 7.5, y: 12.2 }, jitterS = 0.0004 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const phones = [{ x: -4, y: -3 }, { x: 22, y: -2 }, { x: 24, y: 21 }, { x: -3, y: 23 }, { x: 10, y: -6 }];
  const clock = phones.map((_, i) => (i ? (R() - 0.5) * 0.1 : 0)); // hasta ±50 ms de desfase
  const chirpAt = { x: 10, y: -6 }, tChirp = 1.0, tKnock = 4.0;
  const hear = (src, t) => phones.map((p, i) => t + Math.hypot(p.x - src.x, p.y - src.y) / SOUND_AIR_MS + clock[i] + (R() - 0.5) * 2 * jitterS);
  const chirpArr = hear(chirpAt, tChirp), knockArr = hear(knock, tKnock);
  const off = clockOffsets(phones, chirpAt, chirpArr), obs = phones.map((p, i) => ({ ...p, t: knockArr[i] - off[i] }));
  return { phones, knock, chirpAt, clock, offsets: off, obs, fix: multilaterate(obs, { sigmaS: jitterS }) };
}

/** Filtro de Kalman escalar para suavizar el RSSI. */
export function kalman1d({ q = 0.6, r = 9 } = {}) { let x = null, p = 10; return (z) => { if (x === null) { x = z; return x; } p += q; const k = p / (p + r); x += k * (z - x); p *= 1 - k; return x; }; }

/**
 * Guía tipo ARVA: distancia estimada (con intervalo por la incertidumbre del medio) y ritmo de pitido.
 * @returns {{distM, loM, hiM, beepMs, trend:'más cerca'|'más lejos'|'igual'}}
 */
export function arvaGuide(rssiSmoothed, prevSmoothed = null, { txPower1m = -59 } = {}) {
  const distM = rssiToDistanceM(rssiSmoothed, { txPower1m, n: 2.7 }), loM = rssiToDistanceM(rssiSmoothed, { txPower1m, n: 3.6 }), hiM = rssiToDistanceM(rssiSmoothed, { txPower1m, n: 2.0 });
  const beepMs = Math.round(Math.min(1000, Math.max(80, 80 + (920 * Math.log10(distM + 1)) / Math.log10(41))));
  const trend = prevSmoothed == null || Math.abs(rssiSmoothed - prevSmoothed) < 0.4 ? 'igual' : rssiSmoothed > prevSmoothed ? 'más cerca' : 'más lejos';
  return { distM: +distM.toFixed(1), loM: +Math.min(loM, hiM).toFixed(1), hiM: +Math.max(loM, hiM).toFixed(1), beepMs, trend };
}
