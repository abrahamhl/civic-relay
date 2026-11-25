/**
 * SENDA · Cuantificación transversal de incertidumbre (UQ), muestreo por Hipercubo Latino,
 * índices globales de sensibilidad de Sobol-Saltelli y métricas de verificación probabilista (`uncertainty-uq.mjs`).
 *
 * Unifica la propagación de horquillas en todos los simuladores de SENDA (inundación, incendio,
 * ferrocarril, radio y peritaje) e incorpora la especificación de evaluación de predicciones
 * (MAE, RMSE, sesgo, cobertura empírica y CRPS) adaptada desde CalmPath Maps Pro.
 *
 * Referencias publicadas:
 *  - Muestreo estratificado por Hipercubo Latino (LHS):
 *    McKay, M. D., Beckman, R. J. & Conover, W. J. (1979). «A Comparison of Three Methods for Selecting
 *    Values of Input Variables in the Analysis of Output from a Computer Code». Technometrics 21(2):239-245.
 *    DOI: 10.1080/00401706.1979.10489755.
 *  - Índices globales de sensibilidad de Sobol (estimadores de Jansen / Saltelli):
 *    Sobol', I. M. (2001). Math. Comput. Simul. 55(1-3):271-280. DOI: 10.1016/S0378-4754(00)00270-6;
 *    Saltelli, A. et al. (2010). «Variance based sensitivity analysis of model output. Design and estimator
 *    for the total sensitivity index». Comput. Phys. Commun. 181(2):259-270. DOI: 10.1016/j.cpc.2009.09.018.
 *  - Reglas de puntuación estrictamente propias (CRPS y Brier):
 *    Gneiting, T. & Raftery, A. E. (2007). «Strictly Proper Scoring Rules, Prediction, and Estimation».
 *    J. Am. Stat. Assoc. 102(477):359-378. DOI: 10.1198/016214506000001437;
 *    Brier, G. W. (1950). Monthly Weather Review 78(1):1-3.
 *
 * Regla de veracidad (CLAUDE.md): toda distribución marginal exige parámetros explícitos; ninguna salida
 * se presenta sin horquilla o dispersión.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inversa normal estándar Φ⁻¹(p) con precisión < 1,15e-9 (Acklam 2003). */
export function inverseNormalCdf(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('inverseNormalCdf: p debe estar en (0, 1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5, r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function mapMarginal(u, spec) {
  const uClip = Math.min(1 - 1e-12, Math.max(1e-12, u));
  switch (spec.dist) {
    case 'uniform': {
      if (!(Number.isFinite(spec.min) && Number.isFinite(spec.max) && spec.max > spec.min)) {
        throw new RangeError(`uniform '${spec.name}': min < max obligatorio`);
      }
      return spec.min + uClip * (spec.max - spec.min);
    }
    case 'normal': {
      if (!(Number.isFinite(spec.mean) && Number.isFinite(spec.std) && spec.std > 0)) {
        throw new RangeError(`normal '${spec.name}': mean y std > 0 obligatorios`);
      }
      const x = spec.mean + spec.std * inverseNormalCdf(uClip);
      const lo = Number.isFinite(spec.min) ? spec.min : -Infinity;
      const hi = Number.isFinite(spec.max) ? spec.max : Infinity;
      return Math.min(hi, Math.max(lo, x));
    }
    case 'triangular': {
      if (!(Number.isFinite(spec.min) && Number.isFinite(spec.mode) && Number.isFinite(spec.max) && spec.min <= spec.mode && spec.mode <= spec.max && spec.max > spec.min)) {
        throw new RangeError(`triangular '${spec.name}': min ≤ mode ≤ max y min < max obligatorios`);
      }
      const fc = (spec.mode - spec.min) / (spec.max - spec.min);
      return uClip < fc
        ? spec.min + Math.sqrt(uClip * (spec.max - spec.min) * (spec.mode - spec.min))
        : spec.max - Math.sqrt((1 - uClip) * (spec.max - spec.min) * (spec.max - spec.mode));
    }
    case 'lognormal': {
      if (!(Number.isFinite(spec.muLog) && Number.isFinite(spec.sigmaLog) && spec.sigmaLog > 0)) {
        throw new RangeError(`lognormal '${spec.name}': muLog y sigmaLog > 0 obligatorios`);
      }
      return Math.exp(spec.muLog + spec.sigmaLog * inverseNormalCdf(uClip));
    }
    default:
      throw new RangeError(`distribución no soportada '${spec.dist}' en '${spec.name}'`);
  }
}

/* ───────────── 1. Muestreo por Hipercubo Latino (McKay, Beckman & Conover 1979) ───────────── */

/**
 * Genera `samples` vectores de entrada estratificados por Hipercubo Latino (LHS).
 * Garantiza exactamente 1 muestra por estrato `[i/N, (i+1)/N)` en cada dimensión marginal.
 *
 * @param {object} cfg
 *   - `dimensions`: array de `{ name, dist: 'uniform'|'normal'|'triangular'|'lognormal', ...parámetros }`
 *   - `samples`: número de miembros N (≥ 2)
 *   - `seed`: semilla determinista reproducible (obligatoria para trazabilidad)
 */
export function latinHypercubeSample({ dimensions, samples, seed }) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new RangeError('latinHypercubeSample: dimensions no vacío obligatorio');
  }
  if (!(Number.isInteger(samples) && samples >= 2)) {
    throw new RangeError('latinHypercubeSample: samples entero ≥ 2 obligatorio');
  }
  if (!Number.isInteger(seed)) throw new RangeError('latinHypercubeSample: seed entero obligatorio');

  const rng = mulberry32(seed);
  const cols = dimensions.map((dim) => {
    const strata = new Float64Array(samples);
    for (let i = 0; i < samples; i++) strata[i] = (i + rng()) / samples;
    // Permutación Fisher-Yates independiente por dimensión
    for (let i = samples - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = strata[i];
      strata[i] = strata[j];
      strata[j] = tmp;
    }
    return { dim, strata };
  });

  const design = [];
  for (let i = 0; i < samples; i++) {
    const point = {};
    for (const { dim, strata } of cols) {
      point[dim.name] = mapMarginal(strata[i], dim);
    }
    design.push(Object.freeze(point));
  }
  return Object.freeze({
    basis: 'MODEL',
    method: 'Latin Hypercube Sampling (McKay, Beckman & Conover 1979)',
    seed,
    samples,
    dimensions: dimensions.map((d) => d.name),
    design,
  });
}

/* ───────────── 2. Resumen de conjunto con horquilla (percentiles e intervalos de confianza) ───────────── */

function sortedQuantile(sorted, p) {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Resume un conjunto numérico devolviendo media, desviación estándar y horquillas p05–p95 / p10–p90 / IQR. */
export function summarizeEnsemble(values, { label = null, unit = null } = {}) {
  const finite = Array.from(values).filter((v) => Number.isFinite(v));
  if (finite.length === 0) throw new RangeError('summarizeEnsemble: se requiere al menos 1 valor finito');
  const sorted = [...finite].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const p05 = sortedQuantile(sorted, 0.05);
  const p10 = sortedQuantile(sorted, 0.10);
  const p25 = sortedQuantile(sorted, 0.25);
  const p50 = sortedQuantile(sorted, 0.50);
  const p75 = sortedQuantile(sorted, 0.75);
  const p90 = sortedQuantile(sorted, 0.90);
  const p95 = sortedQuantile(sorted, 0.95);
  return Object.freeze({
    basis: 'MODEL',
    label,
    unit,
    n,
    mean: +mean.toFixed(6),
    std: +Math.sqrt(variance).toFixed(6),
    min: +sorted[0].toFixed(6),
    p05: +p05.toFixed(6),
    p10: +p10.toFixed(6),
    p25: +p25.toFixed(6),
    p50: +p50.toFixed(6),
    p75: +p75.toFixed(6),
    p90: +p90.toFixed(6),
    p95: +p95.toFixed(6),
    max: +sorted[n - 1].toFixed(6),
    ci90: Object.freeze([+p05.toFixed(6), +p95.toFixed(6)]),
    ci80: Object.freeze([+p10.toFixed(6), +p90.toFixed(6)]),
    iqr: +(p75 - p25).toFixed(6),
  });
}

/**
 * Propaga incertidumbre sobre cualquier función determinista `modelFn(params)` mediante LHS
 * y devuelve la salida estructurada con horquilla completa.
 */
export function propagateUncertainty({ dimensions, samples, seed, modelFn, outputUnit = null, label = null }) {
  if (typeof modelFn !== 'function') throw new TypeError('propagateUncertainty: modelFn debe ser una función');
  const lhs = latinHypercubeSample({ dimensions, samples, seed });
  const outputs = lhs.design.map((pt, idx) => {
    const y = modelFn(pt, idx);
    if (!Number.isFinite(y)) throw new RangeError(`modelFn devolvió valor no finito en miembro ${idx}`);
    return y;
  });
  return Object.freeze({
    basis: 'MODEL',
    method: 'Propagación de incertidumbre por Hipercubo Latino (McKay et al. 1979)',
    seed,
    samples,
    summary: summarizeEnsemble(outputs, { label, unit: outputUnit }),
    outputs,
  });
}

/* ───────────── 3. Análisis global de sensibilidad Sobol-Saltelli (Saltelli et al. 2010 / Jansen 1999) ───────────── */

/**
 * Calcula los índices globales de sensibilidad de primer orden (S_i) y de efecto total (S_Ti)
 * mediante el diseño cruzado de Saltelli (2010) y los estimadores de Jansen (1999):
 *   S_i  = 1 − (1 / (2N)) · Σ (f(B)_j − f(A_B^(i))_j)² / Var(Y)
 *   S_Ti =     (1 / (2N)) · Σ (f(A)_j − f(A_B^(i))_j)² / Var(Y)
 * Coste total: N · (k + 2) evaluaciones del modelo (k = número de dimensiones).
 */
export function sobolSensitivitySaltelli({ dimensions, baseSamples, evaluate, seed }) {
  if (!Array.isArray(dimensions) || dimensions.length < 2) {
    throw new RangeError('sobolSensitivitySaltelli: se requieren ≥ 2 dimensiones');
  }
  if (!(Number.isInteger(baseSamples) && baseSamples >= 32)) {
    throw new RangeError('sobolSensitivitySaltelli: baseSamples entero ≥ 32 obligatorio');
  }
  if (typeof evaluate !== 'function') throw new TypeError('evaluate debe ser función');
  if (!Number.isInteger(seed)) throw new RangeError('seed entero obligatorio');

  const A = latinHypercubeSample({ dimensions, samples: baseSamples, seed }).design;
  const B = latinHypercubeSample({ dimensions, samples: baseSamples, seed: seed + 104729 }).design;

  const fA = new Float64Array(baseSamples);
  const fB = new Float64Array(baseSamples);
  for (let j = 0; j < baseSamples; j++) {
    fA[j] = evaluate(A[j]);
    fB[j] = evaluate(B[j]);
  }

  // Varianza muestral combinada de A y B
  let sum = 0;
  for (let j = 0; j < baseSamples; j++) sum += fA[j] + fB[j];
  const meanY = sum / (2 * baseSamples);
  let varSum = 0;
  for (let j = 0; j < baseSamples; j++) varSum += (fA[j] - meanY) ** 2 + (fB[j] - meanY) ** 2;
  const varY = varSum / (2 * baseSamples - 1);
  if (!(varY > 0)) {
    return Object.freeze({
      basis: 'MODEL',
      method: 'Sobol-Saltelli (2010) / Jansen (1999)',
      totalEvaluations: baseSamples * (dimensions.length + 2),
      outputVariance: 0,
      indices: dimensions.map((d) => ({ name: d.name, S1: 0, ST: 0, interaction: 0 })),
    });
  }

  const indices = dimensions.map((dim) => {
    let sumS1 = 0;
    let sumST = 0;
    for (let j = 0; j < baseSamples; j++) {
      // A_B^(i): fila j de A excepto columna i tomada de B
      const mixed = { ...A[j], [dim.name]: B[j][dim.name] };
      const fAB = evaluate(mixed);
      const diffB = fB[j] - fAB;
      const diffA = fA[j] - fAB;
      sumS1 += diffB * diffB;
      sumST += diffA * diffA;
    }
    const s1 = 1 - sumS1 / (2 * baseSamples * varY);
    const st = sumST / (2 * baseSamples * varY);
    return Object.freeze({
      name: dim.name,
      S1: +s1.toFixed(4),
      ST: +st.toFixed(4),
      interaction: +(st - s1).toFixed(4),
    });
  });

  return Object.freeze({
    basis: 'MODEL',
    method: 'Sobol-Saltelli (2010) / estimadores de Jansen (1999)',
    ref: 'Saltelli et al. (2010), Comput. Phys. Commun. 181(2):259-270, DOI 10.1016/j.cpc.2009.09.018',
    baseSamples,
    totalEvaluations: baseSamples * (dimensions.length + 2),
    outputMean: +meanY.toFixed(6),
    outputVariance: +varY.toFixed(6),
    indices,
  });
}

/* ───────────── 4. Métricas de verificación de predicciones y conjuntos (Gneiting & Raftery 2007) ───────────── */

/**
 * CRPS empírico (Continuous Ranked Probability Score, Gneiting & Raftery 2007) para un conjunto
 * finito `{x_1, ..., x_M}` frente a una observación escalar `y`:
 *   CRPS(F_ens, y) = (1/M) Σ |x_m − y| − (1/(2 M²)) Σ_m Σ_n |x_m − x_n|
 * Menor es mejor (0 = conjunto determinista exacto sobre y).
 */
export function empiricalCrps(ensembleMembers, observation) {
  const m = ensembleMembers.length;
  if (m === 0 || !Number.isFinite(observation)) throw new RangeError('empiricalCrps: miembros no vacíos y observación finita obligatorios');
  let term1 = 0;
  for (let i = 0; i < m; i++) term1 += Math.abs(ensembleMembers[i] - observation);
  term1 /= m;

  // Cálculo O(M log M) de la media de diferencias por pares (ordenado):
  // Σ_i Σ_j |x_i - x_j| = 2 Σ_{k=0}^{M-1} (2k - M + 1) x_(k)
  const s = [...ensembleMembers].sort((a, b) => a - b);
  let pairSum = 0;
  for (let k = 0; k < m; k++) pairSum += (2 * k - m + 1) * s[k];
  const term2 = pairSum / (m * m);
  return Math.max(0, term1 - term2);
}

/**
 * Evaluación integral de habilidad predictiva (determinista, binaria, cobertura de horquillas y probabilista).
 */
export function evaluateForecastSkill({
  forecasts,
  observations,
  ensembleMatrix = null,
  binaryThreshold = null,
  intervalLower = null,
  intervalUpper = null,
  probForecasts = null,
}) {
  if (!Array.isArray(forecasts) || !Array.isArray(observations) || forecasts.length === 0 || forecasts.length !== observations.length) {
    throw new RangeError('evaluateForecastSkill: forecasts y observations deben ser arrays no vacíos de igual longitud');
  }
  const n = forecasts.length;
  let absSum = 0, sqSum = 0, biasSum = 0;
  let obsMean = observations.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const err = forecasts[i] - observations[i];
    absSum += Math.abs(err);
    sqSum += err * err;
    biasSum += err;
    ssTot += (observations[i] - obsMean) ** 2;
  }
  const mae = absSum / n;
  const rmse = Math.sqrt(sqSum / n);
  const bias = biasSum / n;
  const r2 = ssTot > 0 ? 1 - sqSum / ssTot : null;

  let binary = null;
  if (Number.isFinite(binaryThreshold)) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (let i = 0; i < n; i++) {
      const pf = forecasts[i] >= binaryThreshold;
      const po = observations[i] >= binaryThreshold;
      if (pf && po) tp++;
      else if (pf && !po) fp++;
      else if (!pf && po) fn++;
      else tn++;
    }
    const csi = tp + fp + fn > 0 ? tp / (tp + fp + fn) : 1;
    const pod = tp + fn > 0 ? tp / (tp + fn) : 1;
    const far = tp + fp > 0 ? fp / (tp + fp) : 0;
    const f1 = 2 * tp + fp + fn > 0 ? (2 * tp) / (2 * tp + fp + fn) : 1;
    binary = Object.freeze({ threshold: binaryThreshold, tp, fp, fn, tn, csi: +csi.toFixed(4), pod: +pod.toFixed(4), far: +far.toFixed(4), f1: +f1.toFixed(4) });
  }

  let coverage = null;
  if (Array.isArray(intervalLower) && Array.isArray(intervalUpper) && intervalLower.length === n && intervalUpper.length === n) {
    let inside = 0, widthSum = 0;
    for (let i = 0; i < n; i++) {
      if (observations[i] >= intervalLower[i] && observations[i] <= intervalUpper[i]) inside++;
      widthSum += Math.max(0, intervalUpper[i] - intervalLower[i]);
    }
    coverage = Object.freeze({
      empiricalCoverage: +(inside / n).toFixed(4),
      meanIntervalWidth: +(widthSum / n).toFixed(4),
    });
  }

  let meanCrps = null;
  if (Array.isArray(ensembleMatrix) && ensembleMatrix.length === n) {
    let crpsSum = 0;
    for (let i = 0; i < n; i++) crpsSum += empiricalCrps(ensembleMatrix[i], observations[i]);
    meanCrps = +(crpsSum / n).toFixed(6);
  }

  let brierScore = null;
  if (Array.isArray(probForecasts) && probForecasts.length === n && Number.isFinite(binaryThreshold)) {
    let bSum = 0;
    for (let i = 0; i < n; i++) {
      const y = observations[i] >= binaryThreshold ? 1 : 0;
      bSum += (probForecasts[i] - y) ** 2;
    }
    brierScore = +(bSum / n).toFixed(6);
  }

  return Object.freeze({
    basis: 'MEASURED',
    n,
    mae: +mae.toFixed(6),
    rmse: +rmse.toFixed(6),
    bias: +bias.toFixed(6),
    r2: r2 === null ? null : +r2.toFixed(4),
    binary,
    coverage,
    meanCrps,
    brierScore,
    refs: Object.freeze([
      'Gneiting & Raftery (2007), JASA 102(477):359-378, DOI 10.1198/016214506000001437',
      'Brier (1950), Monthly Weather Review 78(1):1-3',
    ]),
  });
}
