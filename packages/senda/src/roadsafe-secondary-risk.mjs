/**
 * SENDA RoadSafe · H-ROAD-1 — Riesgo de colisión secundaria y política de advertencia con abstención.
 *
 * Física contrastable (cinemática de frenado en régimen constante):
 *     d_stop = v · t_r + v² / (2 · a_eff) + margen
 * con a_eff = η · μ · g (η: eficacia de frenada/ABS; μ: adherencia). La ecuación NO es un piloto
 * automático: se usa para estimar la PROBABILIDAD de que un conductor que se aproxima no pueda
 * detenerse a tiempo, propagando la incertidumbre de v, t_r, μ, la posición GNSS y la latencia.
 *
 * Política de advertencia (factores humanos): un aviso solo tiene valor dentro de una VENTANA ÚTIL.
 *  - Demasiado tarde (tiempo hasta el peligro < t_min): el conductor debe mirar la carretera; un aviso
 *    que exige leer o mirar la pantalla puede retrasar la reacción ⇒ se SUPRIME. Referencia de límite
 *    de distracción: las guías de NHTSA (2013) para interfaces visuo-manuales fijan miradas ≤ 2 s.
 *  - Demasiado pronto (> t_max): se olvida o se habitúa ⇒ solo ADVISORY.
 *  - Con calzada desconocida, posición imprecisa, confianza baja o fuente sin autenticar, se baja el
 *    nivel o se ABSTIENE. Nunca se emiten órdenes de maniobra; solo se describe el peligro.
 *  Los umbrales concretos (t_min, t_max, beneficio mínimo) son HIPÓTESIS DE DISEÑO a validar con
 *  estudios de simulador/conducción (ver docs/roadsafe/04_HYPOTHESES.md, H-ROAD-1).
 */

export const G = 9.80665;

/** Generador reproducible (mulberry32) y muestreadores. */
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export const lognormal = (r, median, sigma) => median * Math.exp(sigma * normal(r));
export const uniform = (r, a, b) => a + (b - a) * r();

/** Distancia de parada (m). */
export function stoppingDistance({ vMs, reactS, aEffMs2, marginM = 0 }) {
  if (![vMs, reactS, aEffMs2].every(Number.isFinite) || aEffMs2 <= 0 || vMs < 0) return NaN;
  return vMs * reactS + vMs * vMs / (2 * aEffMs2) + marginM;
}

/** Velocidad residual de impacto (m/s) si el obstáculo está a `distM` y se frena tras t_r. 0 si se para antes. */
export function impactSpeed({ vMs, reactS, aEffMs2, distM }) {
  const brakeDist = distM - vMs * reactS;
  if (brakeDist <= 0) return vMs;
  const v2 = vMs * vMs - 2 * aEffMs2 * brakeDist;
  return v2 > 0 ? Math.sqrt(v2) : 0;
}

/**
 * Onda de choque (Lighthill–Whitham–Richards): velocidad de la cola w = (q2 − q1)/(k2 − k1).
 * q en veh/h, k en veh/km ⇒ w en km/h (negativa = la cola crece aguas arriba).
 */
export function shockwaveSpeed({ q1, k1, q2, k2 }) {
  if (![q1, k1, q2, k2].every(Number.isFinite) || k2 === k1) return NaN;
  return (q2 - q1) / (k2 - k1);
}

/** Intervalo de Wilson para una proporción. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, +(c - h).toFixed(4)), Math.min(1, +(c + h).toFixed(4))];
}

/**
 * Monte Carlo de «no puede detenerse antes del peligro» con y sin aviso (números aleatorios comunes).
 * dist: { vMs:[med,σrel], reactS:[median,σlog], mu:[a,b], eta:[a,b] }, distToHazardM, sightM (visibilidad
 * efectiva: el conductor solo empieza a percibir cuando el peligro entra en su campo visual).
 * warning: { leadS (antelación con que llega), pDeliver, pAccept, expectedReactS:[median,σlog], speedReduction:[a,b] }
 */
export function secondaryRiskMC({ n = 4000, seed = 11, distToHazardM, sightM = 150, dist = {}, warning = null, marginM = 2 } = {}) {
  const D = { vMs: [25, 0.1], reactS: [1.25, 0.35], mu: [0.7, 0.85], eta: [0.85, 0.95], ...dist };
  const r = rng(seed);
  let failNo = 0, failW = 0, delivered = 0;
  const impactsNo = [], impactsW = [];
  for (let i = 0; i < n; i++) {
    const v = Math.max(1, D.vMs[0] * (1 + D.vMs[1] * normal(r))), tr = lognormal(r, D.reactS[0], D.reactS[1]);
    const a = uniform(r, D.eta[0], D.eta[1]) * uniform(r, D.mu[0], D.mu[1]) * G;
    // Percepción visual: el peligro se percibe a min(distancia, visibilidad).
    const dPerceive = Math.min(distToHazardM, sightM);
    const vi = impactSpeed({ vMs: v, reactS: tr, aEffMs2: a, distM: dPerceive - marginM });
    if (vi > 0) { failNo++; impactsNo.push(vi); }
    // Con aviso: si llega y se acepta con antelación suficiente, reacción «esperada» y reducción de velocidad.
    const uD = r(), uA = r(), trE = lognormal(r, warning?.expectedReactS?.[0] ?? 0.75, warning?.expectedReactS?.[1] ?? 0.3), red = uniform(r, warning?.speedReduction?.[0] ?? 0, warning?.speedReduction?.[1] ?? 0);
    let viW = vi;
    if (warning && uD < warning.pDeliver && uA < warning.pAccept && warning.leadS > 0) {
      delivered++;
      const vW = v * (1 - red);
      viW = impactSpeed({ vMs: vW, reactS: Math.min(tr, trE), aEffMs2: a, distM: dPerceive - marginM });
    }
    if (viW > 0) { failW++; impactsW.push(viW); }
  }
  const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
  return {
    n, pFailNoWarning: +(failNo / n).toFixed(4), ciNoWarning: wilson(failNo, n),
    pFailWithWarning: +(failW / n).toFixed(4), ciWithWarning: wilson(failW, n),
    absoluteRiskReduction: +((failNo - failW) / n).toFixed(4), deliveredAccepted: +(delivered / n).toFixed(4),
    impactNoP50: q(impactsNo, 0.5), impactNoP95: q(impactsNo, 0.95), impactWP50: q(impactsW, 0.5), impactWP95: q(impactsW, 0.95),
    disclaimer: 'Simulación con parámetros declarados; no es una medida de eficacia real.',
  };
}

/** Umbrales de la política (HIPÓTESIS DE DISEÑO, sustituibles tras validación de factores humanos). */
export const WARNING_POLICY = Object.freeze({
  tMinS: 4,              // por debajo: aviso tardío ⇒ riesgo de distracción > beneficio
  tMaxS: 90,             // por encima: solo informativo
  maxPosErrM: 50,        // error de posición máximo para avisar con distancia
  minConfidence: 0.5,    // probabilidad de que el peligro exista
  minBenefit: 0.005,     // reducción absoluta de riesgo mínima estimada para elevar a WARNING
});
const LEVELS = ['SUPPRESS', 'ABSTAIN', 'ADVISORY', 'WARNING'];
const minLevel = (a, b) => (LEVELS.indexOf(a) <= LEVELS.indexOf(b) ? a : b);

/**
 * Decide si avisar y con qué nivel. Devuelve SIEMPRE las razones (auditables).
 * input: { trustCeiling ('ADVISORY'|'WARNING'|'NONE'), carriageway ('SAME'|'OPPOSITE'|'UNKNOWN'), areaHazard?,
 *          posErrM, timeToHazardS, confidenceP, risk?: resultado de secondaryRiskMC, official?: boolean }
 */
export function warningDecision(input, policy = {}) {
  const P = { ...WARNING_POLICY, ...policy }, why = [];
  const { trustCeiling = 'NONE', carriageway = 'UNKNOWN', areaHazard = false, posErrM, timeToHazardS, confidenceP, risk = null, official = false } = input;
  if (trustCeiling === 'NONE') { why.push('fuente no admitida para presentación'); return { level: 'SUPPRESS', why }; }
  if (!Number.isFinite(timeToHazardS) || !Number.isFinite(confidenceP)) { why.push('faltan tiempo hasta el peligro o confianza'); return { level: 'ABSTAIN', why }; }
  if (carriageway === 'OPPOSITE' && !areaHazard) { why.push('peligro en la calzada contraria'); return { level: 'SUPPRESS', why }; }
  if (timeToHazardS < P.tMinS) { why.push(`aviso tardío (${timeToHazardS.toFixed(1)} s < ${P.tMinS} s): prioridad a la percepción directa`); return { level: 'SUPPRESS', why }; }
  if (confidenceP < P.minConfidence && !official) { why.push(`confianza insuficiente (${confidenceP})`); return { level: 'ABSTAIN', why }; }
  let level = 'WARNING';
  if (!Number.isFinite(posErrM) || posErrM > P.maxPosErrM) { level = minLevel(level, 'ADVISORY'); why.push('posición imprecisa: sin distancia exacta'); }
  if (carriageway === 'UNKNOWN' && !areaHazard) { level = minLevel(level, 'ADVISORY'); why.push('calzada no determinada'); }
  if (timeToHazardS > P.tMaxS) { level = minLevel(level, 'ADVISORY'); why.push('peligro lejano: informativo'); }
  if (risk) {
    const lowerBenefit = risk.ciNoWarning[0] - risk.ciWithWarning[1];
    if (risk.absoluteRiskReduction < P.minBenefit || lowerBenefit <= 0) { level = minLevel(level, 'ADVISORY'); why.push(`beneficio estimado no demostrado (ARR=${risk.absoluteRiskReduction})`); }
  } else { level = minLevel(level, 'ADVISORY'); why.push('sin estimación de beneficio'); }
  level = minLevel(level, trustCeiling === 'WARNING' ? 'WARNING' : 'ADVISORY');
  if (trustCeiling !== 'WARNING') why.push('techo por confianza de la fuente');
  return { level, why, describesHazardOnly: true, issuesManeuverCommands: false };
}
