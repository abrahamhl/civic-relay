/**
 * SENDA · Motor de Garantía de Entrega (delivery assurance).
 *
 * Problema: el planificador multiportador (bearers.mjs) calcula la probabilidad EXACTA de recibir
 * ≥k fragmentos suponiendo que los portadores fallan de forma INDEPENDIENTE. En una catástrofe
 * los fallos tienen causa común: un apagón tumba a la vez datos móviles, SMS y el relé del vecino;
 * una tormenta degrada el satélite de banda Ku pero apenas a Iridium (L) o LoRa (868 MHz).
 * Suponer independencia SOBRESTIMA la fiabilidad justo cuando más importa.
 *
 * Este módulo encadena cuatro piezas, cada una verificable:
 *  1. Fallos correlacionados por causa común: mezcla de estados de peligro h con P(h);
 *     condicionado a h los portadores son independientes ⇒ P(≥k) = Σ_h P(h)·PB_h(≥k), exacta
 *     (Poisson-binomial agrupada por DP dentro de cada estado). Independencia = un único estado.
 *  2. Física → probabilidad: lluvia (ITU-R P.838-3) resta margen al enlace y el desvanecimiento
 *     Nakagami-m da la probabilidad de éxito por intento (telecom-mathematical-physics.mjs).
 *  3. Aprendizaje: posterior Beta-Binomial por portador a partir de recibos firmados; se planifica
 *     con un cuantil inferior creíble (restricción de azar), no con la media.
 *  4. Optimización con brecha medida: multiarranque + búsqueda local por máxima pendiente; en instancias
 *     pequeñas se compara con el óptimo exacto por enumeración (exactOptimalAllocation).
 *  5. Certificado: SHA-256 de entradas y salidas canónicas ⇒ cada plan es reproducible y auditable.
 *
 * Los efectos de cada estado de peligro y los perfiles de radio son HIPÓTESIS DE PLANIFICACIÓN
 * declaradas y sustituibles; los recibos de campo las corrigen vía el posterior.
 */
import { BEARERS } from './bearers.mjs';
import { SHARD_HEADER } from './erasure.mjs';
import { computeRainAttenuation, computeFadingOutageAndCapacity } from './telecom-mathematical-physics.mjs';

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ 1. Beta-Binomial */

function lnGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Fracción continua de la beta incompleta (Lentz modificado; Numerical Recipes §6.4). */
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** CDF de la distribución Beta(a, b): beta incompleta regularizada I_x(a, b). */
export function betaCdf(x, a, b) {
  if (!(a > 0 && b > 0)) throw new RangeError('betaCdf: a y b deben ser > 0');
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Cuantil de Beta(a, b) por bisección sobre la CDF (60 iteraciones ⇒ error < 1e-15). */
export function betaQuantile(q, a, b) {
  if (!(q >= 0 && q <= 1)) throw new RangeError('betaQuantile: q ∈ [0, 1]');
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (betaCdf(mid, a, b) < q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/**
 * Posterior conjugado de la fiabilidad de un portador.
 * Prior Beta(α0, β0) centrado en el valor de planificación `p0` con fuerza `priorStrength`
 * (pseudo-observaciones), actualizado con éxitos/fallos de recibos firmados.
 * @returns {{alpha:number, beta:number, mean:number, lower:number, upper:number, observations:number}}
 */
export function posteriorReliability({ p0, successes = 0, failures = 0, priorStrength = 4, credibility = 0.9 }) {
  if (!(finite(p0) && p0 > 0 && p0 < 1)) throw new RangeError('p0 ∈ (0, 1)');
  if (!(Number.isInteger(successes) && successes >= 0 && Number.isInteger(failures) && failures >= 0)) throw new RangeError('successes/failures enteros ≥ 0');
  if (!(priorStrength > 0) || !(credibility > 0 && credibility < 1)) throw new RangeError('priorStrength > 0 y credibility ∈ (0, 1)');
  const alpha = p0 * priorStrength + successes;
  const beta = (1 - p0) * priorStrength + failures;
  const tail = (1 - credibility) / 2;
  return {
    alpha, beta,
    mean: alpha / (alpha + beta),
    lower: betaQuantile(tail, alpha, beta),
    upper: betaQuantile(1 - tail, alpha, beta),
    observations: successes + failures,
  };
}

/* ------------------------------------------------------------------ 2. física → probabilidad */

/**
 * Perfiles de radio por portador (HIPÓTESIS DE PLANIFICACIÓN, sustituibles):
 * frecuencia del tramo más sensible a la lluvia, margen nominal en cielo despejado, longitud
 * efectiva del trayecto en lluvia y parámetro Nakagami-m. Portadores sin perfil no dependen de la lluvia.
 */
export const RADIO_PROFILES = Object.freeze({
  MESHTASTIC: { freqGhz: 0.868, marginDb: 10, rainPathKm: 5, nakagamiM: 1.5 },
  IRIDIUM_SBD: { freqGhz: 1.62, marginDb: 9, rainPathKm: 4, nakagamiM: 2 },
  SAT_D2C_SMS: { freqGhz: 1.9, marginDb: 6, rainPathKm: 4, nakagamiM: 1.5 },
  QO100: { freqGhz: 10.49, marginDb: 9, rainPathKm: 4, nakagamiM: 4 },
  RELAY_INTERNET: { freqGhz: 12, marginDb: 8, rainPathKm: 4, nakagamiM: 4 },
  CELL_DATA: { freqGhz: 1.8, marginDb: 12, rainPathKm: 3, nakagamiM: 1 },
  SMS: { freqGhz: 0.9, marginDb: 14, rainPathKm: 3, nakagamiM: 1 },
});

/**
 * Probabilidad de que un intento NO caiga por desvanecimiento con lluvia `rainMmH`:
 * SNR medio = margen − atenuación por lluvia (P.838-3 × trayecto); umbral = 0 dB de margen;
 * P(éxito) = 1 − P_out Nakagami-m. Devuelve también los dB perdidos.
 */
export function linkAvailability(profile, rainMmH = 0) {
  if (!profile) return { pLink: 1, rainLossDb: 0 };
  const rainLossDb = rainMmH > 0 ? computeRainAttenuation(profile.freqGhz, rainMmH, 'V').pathAttenuationDb(profile.rainPathKm) : 0;
  const snrLinear = 10 ** ((profile.marginDb - rainLossDb) / 10);
  const { outageProbability } = computeFadingOutageAndCapacity(snrLinear, 1, 1e4, profile.nakagamiM);
  return { pLink: clamp01(1 - outageProbability), rainLossDb };
}

/**
 * Estados de peligro por defecto (HIPÓTESIS declaradas). `family` multiplica la p del portador
 * según su familia (bearers.mjs); `rainMmH` activa la física de lluvia en los que tienen perfil.
 * - GRID_DOWN: las antenas móviles agotan baterías en horas (apagón 28-04-2025); el relé del
 *   vecino necesita corriente; los móviles siguen pero con menos encuentros.
 */
export const DEFAULT_HAZARDS = Object.freeze({
  NORMAL: { family: {}, rainMmH: 0 },
  GRID_DOWN: { family: { TERRESTRIAL: 0.15, BACKBONE: 0.3, PROXIMITY: 0.85 }, rainMmH: 0 },
  STORM: { family: { PROXIMITY: 0.8, AERIAL: 0.4 }, rainMmH: 50 },
  GRID_DOWN_STORM: { family: { TERRESTRIAL: 0.15, BACKBONE: 0.3, PROXIMITY: 0.7, AERIAL: 0.4 }, rainMmH: 50 },
});

/** p efectiva de un portador en un estado de peligro: base × factor de familia × disponibilidad física relativa. */
const STATE_P_CACHE = new Map();
export function bearerSuccessInState(bearerId, pBase, hazard) {
  // La física no cambia durante una optimización: memo por (portador, p, lluvia, efectos de familia).
  const key = `${bearerId}|${pBase}|${hazard.rainMmH ?? 0}|${JSON.stringify(hazard.family ?? {})}`;
  const hit = STATE_P_CACHE.get(key);
  if (hit !== undefined) return hit;
  const value = bearerSuccessInStateUncached(bearerId, pBase, hazard);
  if (STATE_P_CACHE.size > 20000) STATE_P_CACHE.clear();
  STATE_P_CACHE.set(key, value);
  return value;
}

function bearerSuccessInStateUncached(bearerId, pBase, hazard) {
  const def = BEARERS[bearerId];
  if (!def) throw new RangeError(`portador desconocido: ${bearerId}`);
  const famFactor = hazard.family?.[def.family] ?? 1;
  const profile = RADIO_PROFILES[bearerId];
  // La p base ya incluye el desvanecimiento en cielo despejado: se aplica solo la degradación RELATIVA.
  const clear = linkAvailability(profile, 0).pLink;
  const now = linkAvailability(profile, hazard.rainMmH ?? 0).pLink;
  const physics = clear > 0 ? now / clear : 0;
  return clamp01(pBase * famFactor * physics);
}

/* ------------------------------------------------------------------ 3. probabilidad correlacionada */

/** Poisson-binomial agrupada: P(Σ ≥ k) cuando el grupo g entrega `shards` fragmentos con prob. p_g. */
function tailAtLeast(groups, k) {
  let dist = new Float64Array(1); dist[0] = 1;
  for (const { p, shards } of groups) {
    if (!shards) continue;
    const next = new Float64Array(dist.length + shards);
    for (let s = 0; s < dist.length; s++) { const v = dist[s]; if (!v) continue; next[s] += v * (1 - p); next[s + shards] += v * p; }
    dist = next;
  }
  let acc = 0;
  for (let s = k; s < dist.length; s++) acc += dist[s];
  return acc;
}

function normaliseScenarios(scenarios) {
  const entries = Object.entries(scenarios).filter(([, s]) => s.prob > 0);
  const total = entries.reduce((a, [, s]) => a + s.prob, 0);
  if (!(total > 0)) throw new RangeError('al menos un estado con prob > 0');
  return entries.map(([name, s]) => ({ name, ...s, prob: s.prob / total }));
}

/**
 * Probabilidad exacta de entrega con fallos de causa común.
 * @param {Array<{id:string, p:number, shards:number}>} groups  un grupo por mensaje enviado
 * @param {number} k  fragmentos necesarios (Reed-Solomon k-de-n)
 * @param {Object<string,{prob:number, family?:object, rainMmH?:number}>} scenarios
 * @returns {{pDelivery:number, byState:Array<{name:string, prob:number, pDelivery:number}>, pIndependentMarginal:number}}
 *   `pIndependentMarginal`: lo que diría el modelo independiente usando las p MARGINALES (media
 *   sobre estados) — la cifra optimista que da un planificador ingenuo.
 */
export function correlatedDeliveryProbability(groups, k, scenarios) {
  if (!(Number.isInteger(k) && k >= 1)) throw new RangeError('k entero ≥ 1');
  const states = normaliseScenarios(scenarios);
  const byState = states.map((h) => ({
    name: h.name,
    prob: h.prob,
    pDelivery: tailAtLeast(groups.map((g) => ({ shards: g.shards, p: bearerSuccessInState(g.id, g.p, h) })), k),
  }));
  const pDelivery = byState.reduce((a, s) => a + s.prob * s.pDelivery, 0);
  const marginal = groups.map((g) => ({ shards: g.shards, p: states.reduce((a, h) => a + h.prob * bearerSuccessInState(g.id, g.p, h), 0) }));
  return { pDelivery, byState, pIndependentMarginal: tailAtLeast(marginal, k) };
}

/* ------------------------------------------------------------------ 4. optimización */

function buildSlots(usable, shardSize) {
  const slots = [];
  for (const b of usable) {
    const cap = Math.floor(b.mtu / (shardSize + SHARD_HEADER));
    if (cap < 1) continue;
    for (let m = 0; m < b.messages; m++) slots.push({ id: b.id, p: b.p, cap, shards: 0, costEUR: b.costEUR, latencyS: b.latencyS });
  }
  return slots;
}

/** Óptimo exacto por enumeración de repartos (solo instancias pequeñas): referencia para medir la brecha. */
export function exactOptimalAllocation(slots, n, k, scenarios) {
  if (slots.length > 8 || n > 12) throw new RangeError('exactOptimalAllocation: instancia demasiado grande');
  let best = { p: -1, alloc: null };
  const alloc = new Array(slots.length).fill(0);
  const rec = (i, left) => {
    if (i === slots.length) {
      if (left) return;
      const p = correlatedDeliveryProbability(slots.map((s, j) => ({ ...s, shards: alloc[j] })), k, scenarios).pDelivery;
      if (p > best.p + 1e-15) best = { p, alloc: [...alloc] };
      return;
    }
    for (let x = Math.min(slots[i].cap, left); x >= 0; x--) { alloc[i] = x; rec(i + 1, left - x); }
    alloc[i] = 0;
  };
  rec(0, n);
  return best;
}

const usedCost = (slots) => slots.reduce((a, s) => a + (s.shards > 0 ? s.costEUR : 0), 0);
const pOf = (slots, k, scenarios) => correlatedDeliveryProbability(slots, k, scenarios).pDelivery;

/**
 * Búsqueda local por máxima pendiente. Vecindario: mover un BLOQUE de t fragmentos de un mensaje
 * a otro (t = 1…). Los movimientos de bloque escapan de los óptimos locales del efecto umbral
 * (un mensaje que por sí solo lleva k fragmentos).
 */
function steepestAscent(slots, k, scenarios, budgetEUR) {
  let current = pOf(slots, k, scenarios);
  // Reducción por simetría EXACTA: mensajes del mismo portador con igual p, capacidad y coste son
  // intercambiables, así que basta un representante por clase (portador, fragmentos actuales).
  const cls = (x) => `${x.id}|${x.p}|${x.cap}|${x.costEUR}|${x.shards}`;
  const reps = () => { const m = new Map(); for (const x of slots) if (!m.has(cls(x))) m.set(cls(x), x); return [...m.values()]; };
  for (let iter = 0; iter < 500; iter++) {
    let best = null, bestP = current + 1e-12;
    const R = reps();
    for (const from of R) {
      if (!from.shards) continue;
      for (const to of R) {
        if (to === from) continue;
        const tMax = Math.min(from.shards, to.cap - to.shards);
        for (let t = 1; t <= tMax; t++) {
          from.shards -= t; to.shards += t;
          if (usedCost(slots) <= budgetEUR + 1e-9) { const p = pOf(slots, k, scenarios); if (p > bestP) { bestP = p; best = [from, to, t]; } }
          to.shards -= t; from.shards += t;
        }
      }
    }
    if (!best) return current;
    best[0].shards -= best[2]; best[1].shards += best[2]; current = bestP;
  }
  return current;
}

/** Reparte exactamente n fragmentos: varios arranques deterministas + máxima pendiente; aplica el mejor. */
function allocateFixedN(slots, n, k, scenarios, budgetEUR, starts = 6, kicks = 12) {
  const capTotal = slots.reduce((a, s) => a + s.cap, 0);
  if (n > capTotal) return -1;
  const order = slots.map((s, i) => i).sort((i, j) => slots[j].p - slots[i].p || slots[i].costEUR - slots[j].costEUR);
  const rng = (() => { let t = 0x5e3d1 ^ n ^ (k << 8); return () => { t = (t + 0x6d2b79f5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; })();
  let bestP = -1, bestAlloc = null;
  for (let st = 0; st < starts; st++) {
    slots.forEach((s) => { s.shards = 0; });
    const seq = st <= 1 ? order : [...order].sort(() => rng() - 0.5);
    let left = n;
    if (st === 1) {
      // Arranque concentrado: llena cada mensaje hasta su capacidad, del más fiable al menos.
      for (const i of seq) { const t = Math.min(left, slots[i].cap); slots[i].shards = t; left -= t; }
    } else {
      // Arranque equilibrado: un fragmento por mensaje (más fiable primero), luego segunda ronda…
      while (left > 0) {
        let placed = false;
        for (const i of seq) { if (left === 0) break; if (slots[i].shards < slots[i].cap) { slots[i].shards++; left--; placed = true; } }
        if (!placed) break;
      }
    }
    if (usedCost(slots) > budgetEUR + 1e-9) {
      // Retira de mensajes de pago y recoloca en gratuitos cuando sea posible.
      for (const s of slots) if (s.costEUR > 0 && s.shards) { const free = slots.find((f) => f.costEUR === 0 && f.shards < f.cap); while (s.shards && free && free.shards < free.cap) { s.shards--; free.shards++; } }
      if (usedCost(slots) > budgetEUR + 1e-9) continue;
    }
    let p = steepestAscent(slots, k, scenarios, budgetEUR);
    // Búsqueda local iterada: perturba (vacía un mensaje y reparte sus fragmentos al azar),
    // reoptimiza y acepta solo si mejora. Escapa de valles que exigen mover varios bloques.
    for (let kick = 0; kick < kicks; kick++) {
      const saved = slots.map((x) => x.shards);
      const loaded = slots.filter((x) => x.shards > 0);
      if (!loaded.length) break;
      const victim = loaded[Math.floor(rng() * loaded.length)];
      let carry = victim.shards; victim.shards = 0;
      for (let guard = 0; carry > 0 && guard < 1000; guard++) {
        const to = slots[Math.floor(rng() * slots.length)];
        if (to !== victim && to.shards < to.cap) { to.shards++; carry--; }
      }
      const q = carry === 0 && usedCost(slots) <= budgetEUR + 1e-9 ? steepestAscent(slots, k, scenarios, budgetEUR) : -1;
      if (q > p + 1e-12) p = q; else slots.forEach((x, i) => { x.shards = saved[i]; });
    }
    if (p > bestP + 1e-12) { bestP = p; bestAlloc = slots.map((s) => s.shards); }
  }
  if (!bestAlloc) return -1;
  slots.forEach((s, i) => { s.shards = bestAlloc[i]; });
  return bestP;
}

/**
 * Elige n con reoptimización COMPLETA para cada n (effort = 'thorough'): más lento, mejor plan.
 * Se detiene cuando la mejora es ≤ minGain durante 3 pasos seguidos (mesetas).
 */
function allocateThoroughN(slots, k, nMax, scenarios, budgetEUR, minGain) {
  let p = allocateFixedN(slots, k, k, scenarios, budgetEUR);
  if (p < 0) return 0;
  let n = k, alloc = slots.map((s) => s.shards), stall = 0;
  for (let cur = k + 1; cur <= nMax && stall < 3; cur++) {
    const q = allocateFixedN(slots, cur, k, scenarios, budgetEUR, 2, 0);
    if (q < 0) break;
    if (q - p > minGain) { p = q; n = cur; alloc = slots.map((s) => s.shards); stall = 0; } else stall++;
  }
  slots.forEach((s, i) => { s.shards = alloc[i]; });
  const polished = allocateFixedN(slots, n, k, scenarios, budgetEUR, 3, 8);
  if (polished < p - 1e-12) slots.forEach((s, i) => { s.shards = alloc[i]; });
  return n;
}

/**
 * Elige n: óptimo con n = k (multiarranque + búsqueda iterada) y después arranque en caliente:
 * añade el fragmento de mayor ganancia, reoptimiza localmente y sigue mientras la mejora supere
 * `minGain`. Al final, una pasada completa de búsqueda iterada sobre el n elegido.
 */
function allocateAdaptiveN(slots, k, nMax, scenarios, budgetEUR, minGain) {
  let p = allocateFixedN(slots, k, k, scenarios, budgetEUR);
  if (p < 0) return 0;
  let n = k, cur = k, bestAlloc = slots.map((s) => s.shards), stall = 0;
  const PATIENCE = 3; // mesetas: a veces un fragmento solo rinde junto con el siguiente
  while (cur < nMax && stall < PATIENCE) {
    let bestSlot = null, bestQ = -1;
    const seen = new Set();
    for (const s of slots) {
      const key = `${s.id}|${s.p}|${s.cap}|${s.costEUR}|${s.shards}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (s.shards >= s.cap) continue;
      s.shards++;
      if (usedCost(slots) <= budgetEUR + 1e-9) { const q = pOf(slots, k, scenarios); if (q > bestQ) { bestQ = q; bestSlot = s; } }
      s.shards--;
    }
    if (!bestSlot) break;
    bestSlot.shards++; cur++;
    const q = steepestAscent(slots, k, scenarios, budgetEUR);
    if (q - p > minGain) { p = q; n = cur; bestAlloc = slots.map((s) => s.shards); stall = 0; } else stall++;
  }
  slots.forEach((s, i) => { s.shards = bestAlloc[i]; });
  const saved = slots.map((s) => s.shards);
  const polished = allocateFixedN(slots, n, k, scenarios, budgetEUR, 3, 8);
  if (polished < p - 1e-12) slots.forEach((s, i) => { s.shards = saved[i]; });
  return n;
}

/**
 * Asignación con exactamente `n` fragmentos (multiarranque + máxima pendiente).
 * Expuesta para medir la brecha de optimalidad frente a exactOptimalAllocation.
 * @returns {{p:number, alloc:number[]}}
 */
export function greedyAllocation(slots, n, k, scenarios) {
  const work = slots.map((s) => ({ ...s, shards: 0 }));
  const p = allocateFixedN(work, n, k, scenarios, Infinity);
  return { p, alloc: work.map((s) => s.shards) };
}

/**
 * Plan multiportador con garantía: maximiza P(entrega) bajo fallos correlacionados, usando para
 * cada portador la COTA INFERIOR creíble de su fiabilidad aprendida (restricción de azar).
 *
 * @param {number} lengthBytes  tamaño del mensaje cifrado
 * @param {Array<{id:string, messages?:number}>} available  portadores disponibles
 * @param {object} [opts]
 * @param {Object<string,{prob:number}>} [opts.scenarios]  P(estado) según el contexto (alerta, red eléctrica…)
 * @param {Object<string,{successes:number, failures:number}>} [opts.receipts]  historial por portador
 * @param {number} [opts.credibility=0.9]  amplitud del intervalo creíble; se usa su cota inferior
 * @param {'lower'|'mean'} [opts.reliability='lower']  'lower' = restricción de azar (por defecto); 'mean' = media posterior (comparaciones justas)
 * @param {number} [opts.maxFragments=64]  tope de fragmentos n (Reed-Solomon GF(256) ⇒ ≤ 255)
 * @param {'thorough'|'fast'} [opts.effort='thorough']  'fast' usa arranque en caliente (≈3× más rápido, plan algo peor)
 * @param {number} [opts.minGain=1e-5]  se deja de añadir fragmentos cuando la mejora de P(entrega) por euro es menor
 * @param {number} [opts.budgetEUR=Infinity]
 * @param {boolean} [opts.publicCleartext=false]  permite bandas de aficionado (sin cifrado, solo estado público firmado)
 */
export function planAssuredDelivery(lengthBytes, available, opts = {}) {
  const {
    scenarios = { NORMAL: { ...DEFAULT_HAZARDS.NORMAL, prob: 0.25 }, GRID_DOWN: { ...DEFAULT_HAZARDS.GRID_DOWN, prob: 0.35 }, STORM: { ...DEFAULT_HAZARDS.STORM, prob: 0.2 }, GRID_DOWN_STORM: { ...DEFAULT_HAZARDS.GRID_DOWN_STORM, prob: 0.2 } },
    receipts = {}, credibility = 0.9, reliability = 'lower', maxFragments = 64, minGain = 1e-5, effort = 'thorough', budgetEUR = Infinity, publicCleartext = false, maxShards = 40,
  } = opts;
  if (!(Number.isInteger(lengthBytes) && lengthBytes > 0)) throw new RangeError('lengthBytes entero > 0');

  const learned = {};
  const usable = [];
  for (const a of available) {
    const def = BEARERS[a.id];
    if (!def) continue;
    if (!def.encryptionAllowed && !publicCleartext) continue;
    const r = receipts[a.id] ?? {};
    const post = posteriorReliability({ p0: def.p, successes: r.successes ?? 0, failures: r.failures ?? 0, credibility });
    learned[a.id] = { prior: def.p, mean: +post.mean.toFixed(4), lowerCredible: +post.lower.toFixed(4), observations: post.observations };
    usable.push({ id: a.id, ...def, p: reliability === 'mean' ? post.mean : post.lower, messages: a.messages ?? def.perWindow ?? 1 });
  }
  if (!usable.length) return { feasible: false, reason: 'NO_BEARER', learned };

  const sizes = [...new Set(usable.map((b) => Math.min(b.mtu, 4096) - SHARD_HEADER).filter((s) => s > 8))].sort((a, b) => a - b);
  let best = null;
  for (const s of sizes) {
    const k = Math.ceil(lengthBytes / s);
    if (k > maxShards) continue;
    const slots = buildSlots(usable, s);
    const n = (effort === 'fast' ? allocateAdaptiveN : allocateThoroughN)(slots, k, Math.min(255, maxFragments), scenarios, budgetEUR, minGain);
    if (n < k) continue;
    const chosen = slots.filter((g) => g.shards > 0);
    const corr = correlatedDeliveryProbability(chosen, k, scenarios);
    const cand = {
      shardSize: s, k, n,
      pDelivery: corr.pDelivery,
      pIndependentMarginal: corr.pIndependentMarginal,
      overconfidenceOfIndependence: corr.pIndependentMarginal - corr.pDelivery,
      worstState: corr.byState.reduce((w, x) => (x.pDelivery < w.pDelivery ? x : w)),
      byState: corr.byState,
      costEUR: chosen.reduce((a, g) => a + g.costEUR, 0),
      messages: chosen.map(({ id, shards, p }) => ({ id, shards, pPlanned: +p.toFixed(4) })),
    };
    if (!best || cand.pDelivery > best.pDelivery + 1e-12 || (Math.abs(cand.pDelivery - best.pDelivery) <= 1e-12 && cand.costEUR < best.costEUR)) best = cand;
  }
  if (!best) return { feasible: false, reason: 'TOO_LARGE', learned };
  return { feasible: true, ...best, learned, credibility, reliability, effort, scenarios: normaliseScenarios(scenarios).map(({ name, prob }) => ({ name, prob })) };
}

/**
 * Audita un plan de un planificador que asume independencia (p. ej. bearers.planMultiBearer):
 * devuelve lo que PROMETÍA frente a lo que entrega con fallos de causa común.
 */
export function auditIndependentPlan(plan, scenarios) {
  const groups = plan.messages.map(({ id, p, shards }) => ({ id, p, shards }));
  const corr = correlatedDeliveryProbability(groups, plan.k, scenarios);
  return { claimed: plan.pDelivery, actual: corr.pDelivery, overconfidence: plan.pDelivery - corr.pDelivery, byState: corr.byState };
}

/* ------------------------------------------------------------------ 5. certificado */

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(+value.toPrecision(12)) : JSON.stringify(String(value));
  return JSON.stringify(value);
}

/**
 * Certificado reproducible de una decisión: SHA-256 (hex) de {módulo, versión, entradas, plan}
 * en JSON canónico (claves ordenadas, números a 12 cifras). Mismo input ⇒ mismo hash en
 * navegador, Node o auditoría externa.
 */
export async function certifyPlan(inputs, plan, { moduleVersion = 'delivery-assurance/1.0.0' } = {}) {
  const body = canonical({ module: moduleVersion, inputs, plan });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { sha256: hex, moduleVersion, canonicalBytes: body.length };
}
