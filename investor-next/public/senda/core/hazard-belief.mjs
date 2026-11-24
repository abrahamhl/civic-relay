/**
 * SENDA · ¿sigue ahí el aviso? Filtro bayesiano exacto de un estado oculto con muerte absorbente.
 *
 * Estado X(t) ∈ {PRESENTE, DESPEJADO}; DESPEJADO es absorbente (lo que se ha retirado no reaparece solo).
 * Dinámica: vida exponencial con semivida h del tipo de aviso → P(sigue | seguía hace Δt) = 2^(−Δt/h).
 * Observaciones (independientes dado el estado):
 *   «lo veo» (confirmación):  P(conf | PRESENTE) = s,       P(conf | DESPEJADO) = 1 − c
 *   «ya no está» (negación):  P(neg  | PRESENTE) = 1 − s,   P(neg  | DESPEJADO) = c
 * con s = sensibilidad y c = especificidad de quien observa (persona o cámara).
 * Antes del primer aviso: p = ½ (máxima entropía, sin información). Cada paso es Bayes exacto:
 *   predicción  p ← p · 2^(−Δt/h)
 *   corrección  p ← p·L₁ / (p·L₁ + (1−p)·L₀)
 * Consecuencias cerradas: con p > ½ y sin noticias, el instante en que la creencia cae a ½ es
 *   t½ = h · log₂(2p)   («probablemente despejado en …»).
 *
 * Veracidad (CLAUDE.md): h = `hlMin` de road-guard (valores de ejemplo declarados, fuente no verificada);
 * s y c = REGLAS DE LA APP no calibradas. `fitReliability()` las estima con resultados reales (avisos que
 * luego se comprobaron) con suavizado de Laplace; mientras no haya datos, se dice «no calibrado».
 */
import { REPORT_KINDS } from './road-guard.mjs';

export const BELIEF_RULES = Object.freeze({
  person: { s: 0.9, c: 0.8 },   // persona que avisa o confirma (regla de la app, no calibrada)
  camera: { s: 0.8, c: 0.95 },  // verificación con cámara (hazard-verify; regla de la app, no calibrada)
  dropBelow: 0.2,               // por debajo, el aviso deja de mostrarse (regla de la app)
  basis: 'FILTRO_BAYESIANO_EXACTO · semivida hlMin (ejemplo declarado) · s/c reglas de la app no calibradas',
});

const MIN = 60_000;
const halfLifeMs = (kind) => (REPORT_KINDS[kind]?.hlMin ?? 30) * MIN;

/** Una corrección de Bayes. `obs` ∈ {'conf','neg'}; `rel` = {s, c}. */
export function bayesUpdate(p, obs, rel) {
  const L1 = obs === 'conf' ? rel.s : 1 - rel.s;
  const L0 = obs === 'conf' ? 1 - rel.c : rel.c;
  const num = p * L1, den = num + (1 - p) * L0;
  return den > 0 ? num / den : p;
}

/** Evidencias de un aviso en orden temporal: [{t, obs, by:'person'|'camera'}]. Compatible con avisos antiguos. */
export function evidenceOf(r) {
  const ev = [{ t: r.t, obs: 'conf', by: 'person' }];
  for (const t of r.seen ?? []) ev.push({ t, obs: 'conf', by: 'person' });
  for (const t of r.gone ?? []) ev.push({ t, obs: 'neg', by: 'person' });
  if (r.verified === true && r.verifiedT) ev.push({ t: r.verifiedT, obs: 'conf', by: 'camera' });
  return ev.filter((e) => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
}

/**
 * Probabilidad de que el aviso siga presente en `now` (ms), con su explicación.
 * Devuelve { p, tHalfMin, confirmations, denials, halfLifeMin, basis }.
 */
export function hazardBelief(r, now = Date.now(), rules = BELIEF_RULES) {
  const h = halfLifeMs(r.kind);
  let p = 0.5, tPrev = null, conf = 0, neg = 0;
  for (const e of evidenceOf(r)) {
    if (tPrev != null && e.t > tPrev) p *= 2 ** (-(e.t - tPrev) / h);
    p = bayesUpdate(p, e.obs, rules[e.by] ?? rules.person);
    if (e.obs === 'conf') conf++; else neg++;
    tPrev = e.t;
  }
  if (tPrev != null && now > tPrev) p *= 2 ** (-(now - tPrev) / h);
  const tHalfMin = p > 0.5 ? (h / MIN) * Math.log2(2 * p) : 0;
  return { p, tHalfMin, confirmations: conf, denials: neg, halfLifeMin: h / MIN, basis: rules.basis };
}

/** Añade una observación a un aviso sin mutarlo. */
export function observe(r, obs, t = Date.now()) {
  const key = obs === 'neg' ? 'gone' : 'seen';
  return { ...r, [key]: [...(r[key] ?? []), t] };
}

/**
 * Estima s y c con resultados comprobados: [{ said:'conf'|'neg', truth:true|false }].
 * Laplace (+1/+2): sin datos devuelve ½ y `calibrated:false`. Nunca inventa precisión.
 */
export function fitReliability(outcomes) {
  let tp = 0, fn = 0, tn = 0, fp = 0;
  for (const o of outcomes ?? []) {
    if (o.truth === true) (o.said === 'conf' ? tp++ : fn++);
    else if (o.truth === false) (o.said === 'neg' ? tn++ : fp++);
  }
  const nPos = tp + fn, nNeg = tn + fp;
  return { s: (tp + 1) / (nPos + 2), c: (tn + 1) / (nNeg + 2), nPos, nNeg, calibrated: nPos >= 10 && nNeg >= 10, basis: nPos + nNeg ? 'ESTIMADO_CON_RESULTADOS_REALES (Laplace)' : 'SIN_DATOS' };
}

/** Texto corto para la interfaz. */
export function beliefText(b) {
  const pct = Math.round(b.p * 100);
  const when = b.tHalfMin >= 1 ? ` · probablemente despejado en ~${Math.round(b.tHalfMin)} min` : '';
  return `sigue ahí ${pct} %${b.confirmations > 1 ? ` · ${b.confirmations} confirmaciones` : ''}${b.denials ? ` · ${b.denials} «ya no está»` : ''}${when}`;
}
