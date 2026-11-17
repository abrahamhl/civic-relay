/**
 * SENDA · Biblioteca de vecinos: la reserva de muchos teléfonos funciona como una sola red.
 *
 * Un móvil guarda ~1 GB. Cuarenta vecinos con SENDA guardan ~40 GB. Si cada uno guarda un FRAGMENTO
 * distinto de un paquete común (mapas detallados de toda la comarca, la Wikipedia médica, el plan de
 * evacuación de cada barrio…), cualquier vecino puede reconstruir el paquete entero en cuanto oye a
 * k de ellos por la red local, Bluetooth o una pasarela, sin Internet. Es almacenamiento distribuido
 * con codificación Reed-Solomon k-de-n (la misma de `erasure.mjs`, real y exacta):
 *   P(recuperar) = Σ_{i ≥ k} C(n,i)·pⁱ·(1−p)ⁿ⁻ⁱ   con p = probabilidad de alcanzar a un vecino.
 * Cada vecino guarda solo paquete/k; el conjunto guarda n/k veces el paquete (redundancia elegida).
 *
 * ¿Quién tiene qué? Cada teléfono anuncia su inventario en un FILTRO DE BLOOM: con n piezas y una tasa
 * de falsos positivos p bastan m = −n·ln p / (ln 2)² bits y k = (m/n)·ln 2 funciones hash. 2000 piezas
 * al 1 % ocupan unos 2,4 KB: caben en pocos paquetes Bluetooth. Las piezas se nombran por su huella
 * (direccionamiento por contenido, como en IPFS o en las redes centradas en datos): da igual QUIÉN la
 * sirva, se comprueba que es la correcta.
 */
import { encodeShards, decodeShards } from './erasure.mjs';

const lnC = (() => { const lf = [0]; for (let i = 1; i <= 512; i++) lf[i] = lf[i - 1] + Math.log(i); return (n, k) => lf[n] - lf[k] - lf[n - k]; })();
/** Probabilidad de reunir al menos k de n fragmentos si cada vecino se alcanza con probabilidad p. */
export function retrievalProbability(k, n, p) {
  if (p >= 1) return 1; if (p <= 0) return k === 0 ? 1 : 0;
  let s = 0; for (let i = k; i <= n; i++) s += Math.exp(lnC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p)); return Math.min(1, s);
}

/**
 * Elige k y n: el mínimo almacenamiento por vecino (paquete/k) con P(recuperar) ≥ objetivo.
 * @returns {{k, n, perPhoneMB, communityMB, p:number}|null}
 */
export function planSwarm({ packMB, phones, pAvail, target = 0.99, maxPerPhoneMB = 1024 }) {
  let best = null;
  for (let n = 1; n <= Math.min(phones, 255); n++) {
    let lo = 1, hi = n, k = 0; while (lo <= hi) { const mid = (lo + hi) >> 1; if (retrievalProbability(mid, n, pAvail) >= target) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (!k || packMB / k > maxPerPhoneMB) continue;
    if (!best || k > best.k || (k === best.k && n < best.n)) best = { k, n };
  }
  return best && { ...best, perPhoneMB: +(packMB / best.k).toFixed(1), communityMB: +((packMB * best.n) / best.k).toFixed(1), p: +retrievalProbability(best.k, best.n, pAvail).toFixed(4) };
}

/** Parámetros de un filtro de Bloom para n piezas con tasa de falsos positivos p. */
export function bloomParams(n, p) { const m = Math.ceil((-n * Math.log(p)) / Math.LN2 ** 2), k = Math.max(1, Math.round((m / n) * Math.LN2)); return { m, k, bytes: Math.ceil(m / 8) }; }
export const bloomFpRate = (m, k, n) => (1 - Math.exp((-k * n) / m)) ** k;
const fnv = (s, seed) => { let h = (2166136261 ^ seed) >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** Filtro de Bloom con doble hash (Kirsch-Mitzenmacher). */
export function bloom(n, p) {
  const { m, k, bytes } = bloomParams(n, p), bits = new Uint8Array(bytes);
  const idx = (s) => { const h1 = fnv(s, 0), h2 = (fnv(s, 0x9e3779b9) | 1) >>> 0; return Array.from({ length: k }, (_, i) => (h1 + i * h2) % m); };
  return { m, k, bytes, bits, add: (s) => idx(s).forEach((b) => (bits[b >> 3] |= 1 << (b & 7))), has: (s) => idx(s).every((b) => bits[b >> 3] & (1 << (b & 7))) };
}

/** Huella (SHA-256, hex) de una pieza: su nombre universal. */
export async function contentId(bytes) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); return [...h].map((x) => x.toString(16).padStart(2, '0')).join(''); }

/**
 * Demostración real: un paquete se reparte en n fragmentos Reed-Solomon entre vecinos; con los que
 * se alcancen (≥ k) se reconstruye byte a byte y se verifica su huella.
 */
export async function swarmRoundTrip(pack, { k, n, reachable }) {
  const enc = encodeShards(pack, k, n), id = await contentId(pack);
  const got = enc.shards.map((data, index) => ({ index, data })).filter((_, i) => reachable[i]);
  if (got.length < k) return { ok: false, got: got.length, k, id };
  const back = decodeShards(got, { k, len: enc.len });
  return { ok: (await contentId(back)) === id, got: got.length, k, id, shardBytes: enc.shardSize };
}

/** Escenario: barrio con vecinos con SENDA; disponibilidad por distancia y batería (determinista). */
export function swarmScenario({ seed = 11, phones = 40, packMB = 6000 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nodes = Array.from({ length: phones }, (_, i) => ({ id: `V${i + 1}`, x: 40 + R() * 560, y: 60 + R() * 380, battery: 0.1 + 0.9 * R() }));
  return { nodes, packMB, me: { x: 320, y: 250 } };
}
