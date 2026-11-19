/**
 * SENDA · Núcleo de precisión e inferencia.
 *
 * Formulaciones cerradas y numéricas que sostienen la capa offline:
 * - Actualización Beta-Binomial (conjugada) de la fiabilidad de cada portador.
 * - Cola binomial exacta y Poisson-binomial (DP) para entrega con borrado k-de-n.
 * - Modelo DTN de inter-contacto exponencial con réplicas (Spray-and-Wait de referencia).
 * - Rango por RSSI con cota de Cramér-Rao para el error de distancia.
 * - SEIR integrado con Dormand-Prince RK45 adaptativo (control de error por paso).
 * - Libro local de observaciones (ledger) y sello canónico SHA-256 de los priors.
 *
 * Todo es determinista salvo que se pase un generador aleatorio explícito.
 * No hay datos inventados: los priors son rangos de ejercicio, marcados como tales.
 */

export const PRECISION_PROVENANCE = 'NUMERIC_MODEL_EXERCISE_ONLY';
export const PRIORS_SCHEMA = 'senda-inference-priors/1';
export const LEDGER_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Gamma / Beta                                                        */
/* ------------------------------------------------------------------ */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** @param {number} z @returns {number} */
export function logGamma(z) {
  if (!(z > 0) || !Number.isFinite(z)) throw new Error('logGamma requiere z > 0');
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const x = z - 1;
  let a = LANCZOS[0];
  for (let i = 1; i < 9; i += 1) a += LANCZOS[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** @param {number} a @param {number} b @returns {number} */
export function logBeta(a, b) {
  if (!(a > 0) || !(b > 0)) throw new Error('logBeta requiere a,b > 0');
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** Fracción continuada de Lentz para la beta incompleta. */
function betaContinuedFraction(a, b, x) {
  const MAX_ITER = 300;
  const EPS = 3e-15;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return h;
}

/**
 * Beta incompleta regularizada I_x(a,b).
 * @param {number} x @param {number} a @param {number} b @returns {number}
 */
export function regularizedIncompleteBeta(x, a, b) {
  if (!(a > 0) || !(b > 0)) throw new Error('regularizedIncompleteBeta requiere a,b > 0');
  if (!(x >= 0 && x <= 1)) throw new Error('x debe estar en [0,1]');
  if (x === 0) return 0;
  if (x === 1) return 1;
  const bt = Math.exp(logBeta(a, b) * -1 + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a;
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * Densidad Beta(a,b) con manejo de bordes.
 * @param {number} x @param {number} a @param {number} b @returns {number}
 */
export function betaPdf(x, a, b) {
  if (!(a > 0) || !(b > 0)) throw new Error('betaPdf requiere a,b > 0');
  if (!(x >= 0 && x <= 1)) throw new Error('x debe estar en [0,1]');
  if (x === 0) return a < 1 ? Infinity : a === 1 ? b : 0;
  if (x === 1) return b < 1 ? Infinity : b === 1 ? a : 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

/**
 * Cuantil de Beta(a,b) por bisección sobre la CDF regularizada.
 * @param {number} p @param {number} a @param {number} b @returns {number}
 */
export function betaQuantile(p, a, b) {
  if (!(p >= 0 && p <= 1)) throw new Error('p debe estar en [0,1]');
  if (!(a > 0) || !(b > 0)) throw new Error('betaQuantile requiere a,b > 0');
  if (p === 0) return 0;
  if (p === 1) return 1;
  let lo = 0;
  let hi = 1;
  let mid = a / (a + b);
  for (let i = 0; i < 140; i += 1) {
    mid = (lo + hi) / 2;
    const cdf = regularizedIncompleteBeta(mid, a, b);
    if (cdf < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-15) break;
  }
  return (lo + hi) / 2;
}

/**
 * Actualización conjugada Beta-Binomial.
 * @param {{alpha:number,beta:number}} prior
 * @param {number} successes
 * @param {number} failures
 * @returns {{alpha:number,beta:number,mean:number,variance:number,ci95:[number,number],median:number,predictive:number,observations:number,provenance:string}}
 */
export function betaBinomialUpdate(prior, successes, failures) {
  if (!prior || !(prior.alpha > 0) || !(prior.beta > 0)) throw new Error('prior Beta inválido');
  if (!Number.isInteger(successes) || successes < 0) throw new Error('successes debe ser entero ≥ 0');
  if (!Number.isInteger(failures) || failures < 0) throw new Error('failures debe ser entero ≥ 0');
  const alpha = prior.alpha + successes;
  const beta = prior.beta + failures;
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  return {
    alpha,
    beta,
    mean,
    variance,
    ci95: [betaQuantile(0.025, alpha, beta), betaQuantile(0.975, alpha, beta)],
    median: betaQuantile(0.5, alpha, beta),
    predictive: mean,
    observations: successes + failures,
    provenance: PRECISION_PROVENANCE,
  };
}

/* ------------------------------------------------------------------ */
/* Binomial / Poisson-binomial / erasure k-de-n                        */
/* ------------------------------------------------------------------ */

/**
 * @param {number} k @param {number} n @param {number} p @returns {number}
 */
export function binomialPmf(k, n, p) {
  if (!Number.isInteger(n) || n < 0) throw new Error('n debe ser entero ≥ 0');
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  if (!(p >= 0 && p <= 1)) throw new Error('p debe estar en [0,1]');
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(
    logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1)
    + k * Math.log(p) + (n - k) * Math.log(1 - p),
  );
}

/**
 * P(X ≥ k) para X ~ Bin(n,p), suma logarítmica directa.
 * @param {number} k @param {number} n @param {number} p @returns {number}
 */
export function binomialCcdf(k, n, p) {
  if (!Number.isInteger(n) || n < 0) throw new Error('n debe ser entero ≥ 0');
  if (!(p >= 0 && p <= 1)) throw new Error('p debe estar en [0,1]');
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p === 0) return 0;
  if (p === 1) return 1;
  const logP = Math.log(p);
  const logQ = Math.log(1 - p);
  let sum = 0;
  for (let i = k; i <= n; i += 1) {
    sum += Math.exp(
      logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1)
      + i * logP + (n - i) * logQ,
    );
  }
  return Math.min(1, Math.max(0, sum));
}

/**
 * Cola P(X ≥ k) para suma de Bernoulli independientes con p_i distintos.
 * Programación dinámica exacta O(n²).
 * @param {number[]} probabilities @param {number} k @returns {number}
 */
export function poissonBinomialCcdf(probabilities, k) {
  if (!Array.isArray(probabilities)) throw new Error('probabilities debe ser un array');
  for (const p of probabilities) if (!(p >= 0 && p <= 1)) throw new Error('cada p debe estar en [0,1]');
  const n = probabilities.length;
  if (k <= 0) return 1;
  if (k > n) return 0;
  let dist = [1];
  for (const p of probabilities) {
    const next = new Array(dist.length + 1).fill(0);
    for (let j = 0; j < dist.length; j += 1) {
      next[j] += dist[j] * (1 - p);
      next[j + 1] += dist[j] * p;
    }
    dist = next;
  }
  let tail = 0;
  for (let j = k; j <= n; j += 1) tail += dist[j];
  return Math.min(1, Math.max(0, tail));
}

/**
 * Entrega de un mensaje troceado en n fragmentos (k necesarios).
 * @param {{k:number,n:number,perShard:number|number[]}} input
 * @returns {{probability:number,overhead:number,redundancy:number,shardsNeeded:number,shardsSent:number,expectedReceived:number,provenance:string}}
 */
export function erasureDelivery({ k, n, perShard }) {
  if (!Number.isInteger(k) || k < 1) throw new Error('k debe ser entero ≥ 1');
  if (!Number.isInteger(n) || n < k || n > 255) throw new Error('requiere 1 ≤ k ≤ n ≤ 255');
  const probs = Array.isArray(perShard) ? perShard : new Array(n).fill(perShard);
  if (probs.length !== n) throw new Error('perShard[] debe tener longitud n');
  for (const p of probs) if (!(p >= 0 && p <= 1)) throw new Error('cada p debe estar en [0,1]');
  const probability = Array.isArray(perShard) ? poissonBinomialCcdf(probs, k) : binomialCcdf(k, n, perShard);
  const expectedReceived = probs.reduce((acc, p) => acc + p, 0);
  return {
    probability,
    overhead: n / k,
    redundancy: (n - k) / k,
    shardsNeeded: k,
    shardsSent: n,
    expectedReceived,
    provenance: PRECISION_PROVENANCE,
  };
}

/* ------------------------------------------------------------------ */
/* DTN · inter-contacto exponencial con réplicas                       */
/* ------------------------------------------------------------------ */

/**
 * Tiempo hasta la primera entrega con `copies` réplicas independientes,
 * cada una con contactos Poisson de tasa λ (por hora): T ~ Exp(copies·λ).
 * @param {{contactRatePerHour:number,copies:number,horizonHours:number}} input
 * @returns {{probability:number,expectedDelayHours:number,p50:number,p90:number,p99:number,copyCost:number,ratePerHour:number,provenance:string}}
 */
export function dtnDelivery({ contactRatePerHour, copies, horizonHours }) {
  if (!(contactRatePerHour > 0) || !Number.isFinite(contactRatePerHour)) throw new Error('contactRatePerHour debe ser > 0');
  if (!Number.isInteger(copies) || copies < 1) throw new Error('copies debe ser entero ≥ 1');
  if (!(horizonHours >= 0) || !Number.isFinite(horizonHours)) throw new Error('horizonHours debe ser ≥ 0');
  const ratePerHour = contactRatePerHour * copies;
  const quantile = (q) => -Math.log(1 - q) / ratePerHour;
  return {
    probability: 1 - Math.exp(-ratePerHour * horizonHours),
    expectedDelayHours: 1 / ratePerHour,
    p50: quantile(0.5),
    p90: quantile(0.9),
    p99: quantile(0.99),
    copyCost: copies,
    ratePerHour,
    provenance: PRECISION_PROVENANCE,
  };
}

/* ------------------------------------------------------------------ */
/* RSSI · rango y cota de Cramér-Rao                                   */
/* ------------------------------------------------------------------ */

/**
 * Pérdida log-distancia: PL(d) = PL0 + 10·n·log10(d/d0), RSSI = Ptx − PL(d).
 * Inversión exacta y cota CRLB con ruido gaussiano σ dB en RSSI.
 * @param {{txPowerDbm:number,rssiDbm:number,pathLossExponent:number,sigmaDb:number,referenceDistanceM?:number,referenceLossDb?:number}} input
 * @returns {{distanceM:number,sigmaM:number,relativeSigma:number,varianceM2:number,pathLossDb:number,provenance:string}}
 */
export function rssiRanging({
  txPowerDbm,
  rssiDbm,
  pathLossExponent,
  sigmaDb,
  referenceDistanceM = 1,
  referenceLossDb = 40,
}) {
  if (!Number.isFinite(txPowerDbm)) throw new Error('txPowerDbm inválido');
  if (!Number.isFinite(rssiDbm)) throw new Error('rssiDbm inválido');
  if (!(pathLossExponent > 0)) throw new Error('pathLossExponent debe ser > 0');
  if (!(sigmaDb >= 0)) throw new Error('sigmaDb debe ser ≥ 0');
  if (!(referenceDistanceM > 0)) throw new Error('referenceDistanceM debe ser > 0');
  const pathLossDb = txPowerDbm - rssiDbm;
  const exponent = (pathLossDb - referenceLossDb) / (10 * pathLossExponent);
  const distanceM = referenceDistanceM * 10 ** exponent;
  const sigmaM = (Math.LN10 * sigmaDb * distanceM) / (10 * pathLossExponent);
  return {
    distanceM,
    sigmaM,
    relativeSigma: distanceM > 0 ? sigmaM / distanceM : 0,
    varianceM2: sigmaM * sigmaM,
    pathLossDb,
    provenance: PRECISION_PROVENANCE,
  };
}

/* ------------------------------------------------------------------ */
/* SEIR · Dormand-Prince RK45 adaptativo                               */
/* ------------------------------------------------------------------ */

const DP = {
  c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
  a: [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ],
  b5: [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
  b4: [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40],
};

function dpStep(y, h, f) {
  const k1 = f(y);
  const k = [k1];
  for (let s = 1; s < 7; s += 1) {
    const ys = y.map((yi, i) => {
      let acc = yi;
      for (let j = 0; j < s; j += 1) acc += h * DP.a[s][j] * k[j][i];
      return acc;
    });
    k.push(f(ys));
  }
  const y5 = y.map((yi, i) => {
    let acc = yi;
    for (let j = 0; j < 7; j += 1) acc += h * DP.b5[j] * k[j][i];
    return acc;
  });
  const y4 = y.map((yi, i) => {
    let acc = yi;
    for (let j = 0; j < 7; j += 1) acc += h * DP.b4[j] * k[j][i];
    return acc;
  });
  return { y5, y4 };
}

/**
 * Integra el modelo SEIR con RK45 adaptativo y muestrea a días enteros.
 * @param {{population:number,contactsPerDay:number,beta:number,latencyDays:number,infectiousDays:number,days:number,initialExposed?:number,initialInfectious?:number,rtol?:number,atol?:number,dtMax?:number}} input
 * @returns {{series:Array<{day:number,susceptible:number,exposed:number,infectious:number,recovered:number,cumulative:number}>,r0:number,peakInfectious:number,peakDay:number,attackRate:number,steps:number,maxConservationError:number,tolerances:{rtol:number,atol:number},provenance:string}}
 */
export function seirRK45({
  population,
  contactsPerDay,
  beta,
  latencyDays,
  infectiousDays,
  days,
  initialExposed = 0,
  initialInfectious = 1,
  rtol = 1e-7,
  atol = 1e-9,
  dtMax = 0.5,
}) {
  if (!(population >= 2) || !Number.isInteger(population)) throw new Error('population debe ser entero ≥ 2');
  if (!(contactsPerDay > 0) || !Number.isFinite(contactsPerDay)) throw new Error('contactsPerDay debe ser > 0');
  if (!(beta >= 0 && beta <= 1)) throw new Error('beta debe estar en [0,1]');
  if (!(latencyDays > 0)) throw new Error('latencyDays debe ser > 0');
  if (!(infectiousDays > 0)) throw new Error('infectiousDays debe ser > 0');
  if (!(days >= 1) || !Number.isInteger(days)) throw new Error('days debe ser entero ≥ 1');
  if (!(initialExposed >= 0) || !(initialInfectious >= 0)) throw new Error('iniciales deben ser ≥ 0');
  if (initialExposed + initialInfectious >= population) throw new Error('iniciales deben sumar menos que population');
  if (!(rtol > 0) || !(atol > 0) || !(dtMax > 0)) throw new Error('tolerancias y dtMax deben ser > 0');

  const N = population;
  const sigma = 1 / latencyDays;
  const gamma = 1 / infectiousDays;
  const transmission = beta * contactsPerDay;
  const derivative = (s) => {
    const force = (transmission * s[0] * s[2]) / N;
    return [-force, force - sigma * s[1], sigma * s[1] - gamma * s[2], gamma * s[2]];
  };

  let y = [N - initialExposed - initialInfectious, initialExposed, initialInfectious, 0];
  let t = 0;
  let h = Math.min(dtMax, 1e-3);
  let nextSample = 1;
  let steps = 0;
  let maxConservationError = 0;
  const series = [{
    day: 0, susceptible: y[0], exposed: y[1], infectious: y[2], recovered: y[3], cumulative: N - y[0],
  }];
  const sample = () => {
    maxConservationError = Math.max(maxConservationError, Math.abs(y[0] + y[1] + y[2] + y[3] - N));
    series.push({
      day: nextSample, susceptible: y[0], exposed: y[1], infectious: y[2], recovered: y[3], cumulative: N - y[0],
    });
    nextSample += 1;
  };

  while (nextSample <= days) {
    if (steps > 2_000_000) throw new Error('RK45 no converge');
    const remaining = nextSample - t;
    if (remaining <= 1e-12) {
      sample();
      continue;
    }
    const step = Math.min(h, remaining);
    const { y5, y4 } = dpStep(y, step, derivative);
    let error = 0;
    for (let i = 0; i < 4; i += 1) {
      const scale = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
      error = Math.max(error, Math.abs(y5[i] - y4[i]) / scale);
    }
    if (error <= 1) {
      t += step;
      y = y5;
      steps += 1;
      const factor = Math.min(5, Math.max(0.2, 0.9 * error ** -0.2));
      h = Math.min(dtMax, step * factor);
      if (Math.abs(t - nextSample) < 1e-9) {
        y = y.map((v) => Math.max(0, v));
        sample();
      }
    } else {
      h = Math.max(step * Math.max(0.2, 0.9 * error ** -0.2), 1e-9);
    }
  }

  let peakInfectious = 0;
  let peakDay = 0;
  for (const point of series) {
    if (point.infectious > peakInfectious) {
      peakInfectious = point.infectious;
      peakDay = point.day;
    }
  }
  const final = series[series.length - 1];
  return {
    series,
    r0: transmission / gamma,
    peakInfectious,
    peakDay,
    attackRate: final.cumulative / N,
    steps,
    maxConservationError,
    tolerances: { rtol, atol },
    provenance: PRECISION_PROVENANCE,
  };
}

/* ------------------------------------------------------------------ */
/* Ledger local de observaciones                                       */
/* ------------------------------------------------------------------ */

/** @returns {{version:number,observations:Array}} */
export function emptyLedger() {
  return { version: LEDGER_VERSION, observations: [] };
}

/**
 * Añade una observación (éxitos/fallos de un portador) sin mutar el ledger.
 * @param {object} ledger
 * @param {{bearer:string,successes:number,failures:number,at?:string}} observation
 * @returns {object}
 */
export function recordObservation(ledger, { bearer, successes, failures, at }) {
  if (!ledger || ledger.version !== LEDGER_VERSION || !Array.isArray(ledger.observations)) {
    throw new Error('ledger inválido');
  }
  if (typeof bearer !== 'string' || bearer.length === 0) throw new Error('bearer requerido');
  if (!Number.isInteger(successes) || successes < 0) throw new Error('successes debe ser entero ≥ 0');
  if (!Number.isInteger(failures) || failures < 0) throw new Error('failures debe ser entero ≥ 0');
  if (successes + failures === 0) throw new Error('observación vacía');
  const timestamp = at ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('at debe ser fecha ISO');
  const observations = [...ledger.observations, { bearer, successes, failures, at: timestamp }].slice(-400);
  return { version: LEDGER_VERSION, observations };
}

/**
 * Totales por portador.
 * @param {object} ledger
 * @returns {Record<string,{successes:number,failures:number,observations:number}>}
 */
export function tallyLedger(ledger) {
  const out = {};
  for (const obs of ledger?.observations ?? []) {
    const row = out[obs.bearer] ?? { successes: 0, failures: 0, observations: 0 };
    row.successes += obs.successes;
    row.failures += obs.failures;
    row.observations += 1;
    out[obs.bearer] = row;
  }
  return out;
}

/**
 * Posterior por portador: prior Beta del JSON + recuentos observados.
 * @param {object} priors
 * @param {object} ledger
 * @returns {Array<{id:string,label:string,prior:{alpha:number,beta:number},successes:number,failures:number,observations:number,posterior:object}>}
 */
export function summarizePosteriors(priors, ledger) {
  if (!priors || !priors.bearers) throw new Error('priors inválidos');
  const totals = tallyLedger(ledger);
  return Object.entries(priors.bearers).map(([id, bearer]) => {
    const tally = totals[id] ?? { successes: 0, failures: 0, observations: 0 };
    const posterior = betaBinomialUpdate(
      { alpha: bearer.successAlpha, beta: bearer.successBeta },
      tally.successes,
      tally.failures,
    );
    return { id, label: bearer.label, prior: { alpha: bearer.successAlpha, beta: bearer.successBeta }, ...tally, posterior };
  });
}

/**
 * Thompson sampling: una muestra Beta por portador, elige el mayor.
 * @param {Array<{id:string,posterior:{alpha:number,beta:number}}>} posteriors
 * @param {() => number} rng
 * @returns {{id:string,sample:number}|null}
 */
export function recommendBearer(posteriors, rng = Math.random) {
  let best = null;
  for (const row of posteriors) {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, rng()));
    const sample = betaQuantile(u, row.posterior.alpha, row.posterior.beta);
    if (!best || sample > best.sample) best = { id: row.id, sample };
  }
  return best;
}

/** @param {object} ledger @returns {string} */
export function exportLedger(ledger) {
  return JSON.stringify(ledger, null, 2);
}

/* ------------------------------------------------------------------ */
/* Sello canónico de los priors                                        */
/* ------------------------------------------------------------------ */

/**
 * JSON canónico: claves ordenadas recursivamente, sin espacios.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Payload sellado: todo menos el campo integrity. */
export function priorsPayload(priors) {
  if (!priors || typeof priors !== 'object') throw new Error('priors inválidos');
  const { integrity: _integrity, ...rest } = priors;
  return rest;
}

/** @param {object} priors @returns {string} */
export function canonicalPriors(priors) {
  return canonicalize(priorsPayload(priors));
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto no disponible');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica el sello del JSON de priors en el navegador.
 * @param {object} priors
 * @returns {Promise<{ok:boolean,expected:string|null,actual:string}>}
 */
export async function verifyPriorsIntegrity(priors) {
  const actual = await sha256Hex(canonicalPriors(priors));
  const expected = priors?.integrity?.digest ?? null;
  return { ok: expected === actual, expected, actual };
}
