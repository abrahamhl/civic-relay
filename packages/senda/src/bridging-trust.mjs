/**
 * SENDA · Credibilidad por «consenso amplio» (bridging) para confirmaciones de reportes ciudadanos.
 *
 * Adaptación en JavaScript del modelo central de las Notas de la Comunidad de X (github.com/twitter/communitynotes,
 * Apache-2.0, scoring/src/scoring/matrix_factorization/matrix_factorization.py y mf_base_scorer.py):
 *   valoración ≈ μ + i_vecino + i_reporte + f_vecino · f_reporte
 * con 1 factor latente, pérdida cuadrática y regularización L2 (media) con los valores por defecto del original:
 * factores 0,03 e interceptos 0,15 (0,03 × 5); optimizador Adam con tasa 0,2. Un reporte queda «confirmado por
 * consenso amplio» si su intercepto ≥ 0,40 con ≥ 5 valoraciones, y «desmentido» si intercepto ≤ −0,05 − 0,8·|f|
 * (umbrales crhThreshold y crnhThreshold* de mf_base_scorer.py).
 *
 * Idea: el factor f absorbe el acuerdo que se explica por «bando» (p. ej. vecinos de un mismo grupo que se apoyan
 * siempre); el intercepto solo crece cuando confirman personas que normalmente discrepan. Diferencias con el original:
 * descenso por lotes completos y semilla fija (reproducible); no incluye las capas adicionales de producción de X.
 */
export const CN_DEFAULTS = Object.freeze({ numFactors: 1, userFactorLambda: 0.03, noteFactorLambda: 0.03, userInterceptLambda: 0.15, noteInterceptLambda: 0.15, globalInterceptLambda: 0.15,
  lr: 0.2, convergence: 1e-7, maxIters: 3000, crhThreshold: 0.40, crnhThresholdIntercept: -0.05, crnhThresholdNoteFactorMultiplier: -0.8, minRatingsNeeded: 5 });

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/**
 * Ajusta el modelo. ratings = [{ rater, item, helpful: 0|1 }]. Devuelve interceptos y factores de cada reporte y vecino.
 */
export function fitBridging(ratings, opts = {}) {
  const o = { ...CN_DEFAULTS, ...opts }, R = ratings.filter((r) => r.helpful === 0 || r.helpful === 1);
  if (!R.length) throw new Error('sin valoraciones');
  const users = [...new Set(R.map((r) => r.rater))], items = [...new Set(R.map((r) => r.item))];
  const ui = new Map(users.map((u, k) => [u, k])), ii = new Map(items.map((n, k) => [n, k])), rand = rng(o.seed ?? 42);
  // parámetros: [mu, iu(U), in(N), fu(U), fn(N)] con Adam
  const U = users.length, N = items.length, P = 1 + 2 * U + 2 * N, p = new Float64Array(P), m = new Float64Array(P), v = new Float64Array(P);
  for (let k = 1 + U + N; k < P; k++) p[k] = (rand() - 0.5) * 0.2;
  const iU = (u) => 1 + u, iN = (n) => 1 + U + n, fU = (u) => 1 + U + N + u, fN = (n) => 1 + 2 * U + N + n;
  const data = R.map((r) => [ui.get(r.rater), ii.get(r.item), r.helpful]);
  let prev = Infinity, it = 0, loss = 0;
  for (; it < o.maxIters; it++) {
    const g = new Float64Array(P); loss = 0;
    for (const [u, n, y] of data) { const pred = p[0] + p[iU(u)] + p[iN(n)] + p[fU(u)] * p[fN(n)], e = pred - y; loss += e * e; const d = (2 * e) / data.length;
      g[0] += d; g[iU(u)] += d; g[iN(n)] += d; g[fU(u)] += d * p[fN(n)]; g[fN(n)] += d * p[fU(u)]; }
    loss /= data.length;
    const reg = (lo, hi, lam) => { for (let k = lo; k < hi; k++) { loss += (lam * p[k] * p[k]) / (hi - lo); g[k] += (2 * lam * p[k]) / (hi - lo); } };
    reg(1, 1 + U, o.userInterceptLambda); reg(1 + U, 1 + U + N, o.noteInterceptLambda); reg(1 + U + N, 1 + 2 * U + N, o.userFactorLambda); reg(1 + 2 * U + N, P, o.noteFactorLambda);
    loss += o.globalInterceptLambda * p[0] * p[0]; g[0] += 2 * o.globalInterceptLambda * p[0];
    const b1 = 0.9, b2 = 0.999, t = it + 1;
    for (let k = 0; k < P; k++) { m[k] = b1 * m[k] + (1 - b1) * g[k]; v[k] = b2 * v[k] + (1 - b2) * g[k] * g[k]; p[k] -= (o.lr * (m[k] / (1 - b1 ** t))) / (Math.sqrt(v[k] / (1 - b2 ** t)) + 1e-8); }
    if (Math.abs(prev - loss) < o.convergence) break; prev = loss;
  }
  const count = new Map(); for (const r of R) count.set(r.item, (count.get(r.item) ?? 0) + 1);
  return { globalIntercept: p[0], iters: it + 1, loss,
    items: Object.fromEntries(items.map((n, k) => [n, { intercept: p[iN(k)], factor: p[fN(k)], ratings: count.get(n) }])),
    raters: Object.fromEntries(users.map((u, k) => [u, { intercept: p[iU(k)], factor: p[fU(k)] }])) };
}

/** Estado de cada reporte con los umbrales del original. */
export function bridgingStatus(model, opts = {}) {
  const o = { ...CN_DEFAULTS, ...opts };
  return Object.fromEntries(Object.entries(model.items).map(([id, x]) => {
    const st = x.ratings < o.minRatingsNeeded ? 'POCAS_VALORACIONES'
      : x.intercept >= o.crhThreshold ? 'CONFIRMADO_CONSENSO_AMPLIO'
      : x.intercept <= o.crnhThresholdIntercept + o.crnhThresholdNoteFactorMultiplier * Math.abs(x.factor) ? 'DESMENTIDO'
      : 'SIN_CONSENSO';
    return [id, { ...x, status: st }];
  }));
}

/** Referencia ingenua para comparar: mayoría simple de «sí». */
export function majorityStatus(ratings, { minRatingsNeeded = CN_DEFAULTS.minRatingsNeeded } = {}) {
  const agg = {}; for (const r of ratings) { (agg[r.item] ??= { yes: 0, n: 0 }); agg[r.item].yes += r.helpful; agg[r.item].n++; }
  return Object.fromEntries(Object.entries(agg).map(([id, a]) => [id, { share: a.yes / a.n, status: a.n < minRatingsNeeded ? 'POCAS_VALORACIONES' : a.yes / a.n > 0.5 ? 'MAYORIA_SI' : 'MAYORIA_NO' }]));
}

/**
 * Escenario SINTÉTICO de demostración (basis: SIMULATION): 20 vecinos en dos «bandos» que suelen discrepar.
 * «inundacion» la confirman 8 + 8 de ambos bandos; «bulo» lo empuja un solo bando (11 sí de 14).
 */
export function syntheticPolarizedScenario() {
  const A = Array.from({ length: 10 }, (_, k) => `a${k}`), B = Array.from({ length: 10 }, (_, k) => `b${k}`), r = [];
  for (let k = 0; k < 6; k++) { for (const u of A) r.push({ rater: u, item: `soloA${k}`, helpful: 1 }); for (const u of B) r.push({ rater: u, item: `soloA${k}`, helpful: 0 }); }
  for (let k = 0; k < 6; k++) { for (const u of B) r.push({ rater: u, item: `soloB${k}`, helpful: 1 }); for (const u of A) r.push({ rater: u, item: `soloB${k}`, helpful: 0 }); }
  for (const u of [...A.slice(0, 8), ...B.slice(0, 8)]) r.push({ rater: u, item: 'inundacion', helpful: 1 });
  for (const u of [...A.slice(8), ...B.slice(8)]) r.push({ rater: u, item: 'inundacion', helpful: 0 });
  for (const u of A) r.push({ rater: u, item: 'bulo', helpful: 1 }); for (const u of B.slice(0, 3)) r.push({ rater: u, item: 'bulo', helpful: 0 }); r.push({ rater: 'b9', item: 'bulo', helpful: 1 });
  return { basis: 'SIMULATION', ratings: r, focus: ['inundacion', 'bulo'] };
}
