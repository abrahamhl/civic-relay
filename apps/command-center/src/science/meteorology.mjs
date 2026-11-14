// Meteorology and forecast verification.
//
// Two distinct things live here and must never be confused:
//   1. Deterministic physics/diagnostics (dew point, heat index, wind chill,
//      fire-weather indices, Gaussian dispersion). These are MODEL_DERIVED.
//   2. Verification scores for probabilistic forecasts (Brier, Brier skill,
//      CRPS, reliability, ROC AUC). These measure a forecast against outcomes.
//
// No live ingestion is performed in this module. When a real NOAA/ERA5
// acquisition is wired in, it enters as REAL_MEASUREMENT with its own hash and
// timestamp; the UI must not relabel these synthetic demo inputs as measured.

export const WEATHER_PROVENANCE = 'MODEL_DERIVED';
export const FORECAST_PROVENANCE = 'SIMULATOR';

const KELVIN_OFFSET = 273.15;

export function cToF(c) {
  return (c * 9) / 5 + 32;
}

export function fToC(f) {
  return ((f - 32) * 5) / 9;
}

export function cToK(c) {
  return c + KELVIN_OFFSET;
}

export function kToC(k) {
  return k - KELVIN_OFFSET;
}

export function msToKmh(ms) {
  return ms * 3.6;
}

export function kmhToMs(kmh) {
  return kmh / 3.6;
}

export function paToHpa(pa) {
  return pa / 100;
}

export function hpaToPa(hpa) {
  return hpa * 100;
}

/** Magnus-Tetens dew point. Returns null outside the valid humidity range. */
export function dewPointC(tempC, rhPercent) {
  if (!(rhPercent > 0 && rhPercent <= 100)) throw new RangeError('rhPercent must be in (0, 100]');
  const gamma =
    Math.log(rhPercent / 100) + (17.625 * tempC) / (243.04 + tempC);
  return (243.04 * gamma) / (17.625 - gamma);
}

export function relativeHumidity(tempC, dewPoint) {
  const numerator = Math.exp((17.625 * dewPoint) / (243.04 + dewPoint));
  const denominator = Math.exp((17.625 * tempC) / (243.04 + tempC));
  return 100 * (numerator / denominator);
}

/** NOAA Rothfusz heat index. Returns the air temperature below the valid range. */
export function heatIndexC(tempC, rhPercent) {
  if (!(rhPercent >= 0 && rhPercent <= 100)) throw new RangeError('rhPercent must be in [0, 100]');
  if (tempC < 27 || rhPercent < 40) return tempC;
  const t = cToF(tempC);
  const rh = rhPercent;
  const hiF =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;
  return fToC(hiF);
}

/** JAG/TI wind chill. Below the valid range it returns the air temperature. */
export function windChillC(tempC, windKmh) {
  if (!(windKmh >= 0)) throw new RangeError('windKmh must be >= 0');
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const v = windKmh ** 0.16;
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

/**
 * Meteorological wind vector. `directionFromDeg` is where the wind comes from
 * (0 = north, 90 = east). u is eastward, v is northward.
 */
export function windVectorFromSpeedDir(speedMs, directionFromDeg) {
  const rad = (directionFromDeg * Math.PI) / 180;
  return {
    u: -speedMs * Math.sin(rad),
    v: -speedMs * Math.cos(rad),
  };
}

export function windSpeedDirFromVector({ u, v }) {
  const speedMs = Math.hypot(u, v);
  let directionFromDeg = (Math.atan2(-u, -v) * 180) / Math.PI;
  if (directionFromDeg < 0) directionFromDeg += 360;
  return { speedMs, directionFromDeg };
}

/** Fosberg Fire Weather Index (0-100+). Inputs metric, formula uses mph/°F. */
export function fosbergFireWeatherIndex({ tempC, rhPercent, windKmh }) {
  if (!(rhPercent >= 0 && rhPercent <= 100)) throw new RangeError('rhPercent must be in [0, 100]');
  if (!(windKmh >= 0)) throw new RangeError('windKmh must be >= 0');
  const tempF = cToF(tempC);
  const windMph = windKmh / 1.609344;
  const m = Math.max(
    0,
    0.03229 + 0.281073 * rhPercent - 0.000578 * rhPercent * tempF,
  );
  const ratio = m / 30;
  const eta = 1 - 2 * ratio + 1.5 * ratio * ratio - 0.5 * ratio * ratio * ratio;
  const ffwi = Math.max(0, eta * Math.sqrt(1 + windMph * windMph));
  return { ffwi, moisturePercent: m, class: fireDangerClass(ffwi) };
}

export function fireDangerClass(ffwi) {
  if (!Number.isFinite(ffwi)) throw new TypeError('ffwi must be finite');
  if (ffwi < 25) return 'LOW';
  if (ffwi < 50) return 'MODERATE';
  if (ffwi < 75) return 'HIGH';
  return 'EXTREME';
}

/**
 * Haines index (2-6): stability term A + moisture term B. Simplified table
 * operating on low/mid level temperature and dew-point depression in °C.
 */
export function hainesIndex({ lowLapseC, lowDepressionC, midLapseC, midDepressionC }) {
  const stability = (lapse) => {
    if (lapse < 4) return 1;
    if (lapse < 8) return 2;
    return 3;
  };
  const moisture = (depression) => {
    if (depression < 6) return 1;
    if (depression < 10) return 2;
    return 3;
  };
  const a = stability(lowLapseC);
  const b = moisture(lowDepressionC);
  const c = stability(midLapseC);
  const d = moisture(midDepressionC);
  const low = a + b;
  const mid = c + d;
  const value = Math.max(low, mid);
  const classLabel = value <= 3 ? 'LOW' : value === 4 ? 'MODERATE' : value === 5 ? 'HIGH' : 'VERY_HIGH';
  return { value, low, mid, class: classLabel };
}

const BRIGGS_OPEN_COUNTRY = {
  A: { y: (x) => 0.22 * x * (1 + 0.0001 * x) ** -0.5, z: (x) => 0.2 * x },
  B: { y: (x) => 0.16 * x * (1 + 0.0001 * x) ** -0.5, z: (x) => 0.12 * x },
  C: {
    y: (x) => 0.11 * x * (1 + 0.0001 * x) ** -0.5,
    z: (x) => 0.08 * x * (1 + 0.0002 * x) ** -0.5,
  },
  D: {
    y: (x) => 0.08 * x * (1 + 0.0001 * x) ** -0.5,
    z: (x) => 0.06 * x * (1 + 0.0015 * x) ** -0.5,
  },
  E: {
    y: (x) => 0.06 * x * (1 + 0.0001 * x) ** -0.5,
    z: (x) => 0.03 * x * (1 + 0.0003 * x) ** -1,
  },
  F: {
    y: (x) => 0.04 * x * (1 + 0.0001 * x) ** -0.5,
    z: (x) => 0.016 * x * (1 + 0.0003 * x) ** -1,
  },
};

export function briggsDispersion(stabilityClass, downwindM) {
  const model = BRIGGS_OPEN_COUNTRY[stabilityClass];
  if (!model) throw new RangeError(`unknown stability class: ${stabilityClass}`);
  if (!(downwindM > 0)) throw new RangeError('downwindM must be positive');
  return { sigmaYM: model.y(downwindM), sigmaZM: model.z(downwindM) };
}

/**
 * Steady-state Gaussian plume at ground level. Assumptions are declared, not
 * hidden: flat terrain, no chemistry, no deposition, constant wind.
 */
export function gaussianPlumeGroundLevel({
  emissionRateGps,
  windSpeedMs,
  stackHeightM,
  stabilityClass = 'D',
  downwindM,
  crosswindM = 0,
}) {
  if (!(emissionRateGps >= 0)) throw new RangeError('emissionRateGps must be >= 0');
  if (!(windSpeedMs > 0)) throw new RangeError('windSpeedMs must be positive');
  if (!(stackHeightM >= 0)) throw new RangeError('stackHeightM must be >= 0');
  if (!(downwindM > 0)) throw new RangeError('downwindM must be positive');

  const { sigmaYM, sigmaZM } = briggsDispersion(stabilityClass, downwindM);
  const crosswind = Math.exp(-(crosswindM * crosswindM) / (2 * sigmaYM * sigmaYM));
  const vertical =
    Math.exp(-(stackHeightM * stackHeightM) / (2 * sigmaZM * sigmaZM)) +
    Math.exp(-(stackHeightM * stackHeightM) / (2 * sigmaZM * sigmaZM));
  const concentrationGm3 =
    (emissionRateGps / (Math.PI * windSpeedMs * sigmaYM * sigmaZM)) * crosswind * vertical;
  return {
    concentrationUgM3: concentrationGm3 * 1e6,
    sigmaYM,
    sigmaZM,
    stabilityClass,
    provenance: WEATHER_PROVENANCE,
    assumptions: [
      'terreno plano y homogéneo',
      'viento estacionario',
      'sin reacciones químicas ni deposición',
      'sin obstáculos ni edificios',
    ],
  };
}

// --- Forecast verification --------------------------------------------------

/**
 * @typedef {Object} Forecast
 * @property {number} probability
 * @property {number} outcome
 */

/**
 * @param {Forecast[]} forecasts
 */
export function brierScore(forecasts) {
  if (!forecasts.length) throw new RangeError('forecasts must not be empty');
  let sum = 0;
  for (const { probability, outcome } of forecasts) {
    if (!(probability >= 0 && probability <= 1)) throw new RangeError('probability must be in [0,1]');
    if (outcome !== 0 && outcome !== 1) throw new RangeError('outcome must be 0 or 1');
    sum += (probability - outcome) ** 2;
  }
  return sum / forecasts.length;
}

/**
 * @param {Forecast[]} forecasts
 * @param {number} referenceProbability
 */
export function brierSkillScore(forecasts, referenceProbability = 0.5) {
  const referenceForecasts = forecasts.map((forecast) => ({
    probability: referenceProbability,
    outcome: forecast.outcome,
  }));
  const referenceScore = brierScore(referenceForecasts);
  if (referenceScore === 0) return 0;
  return 1 - brierScore(forecasts) / referenceScore;
}

/**
 * Empirical CRPS for an ensemble forecast.
 * @param {number[]} ensemble
 * @param {number} observation
 */
export function crpsEnsemble(ensemble, observation) {
  if (!ensemble.length) throw new RangeError('ensemble must not be empty');
  const n = ensemble.length;
  let first = 0;
  for (const member of ensemble) first += Math.abs(member - observation);
  first /= n;

  let second = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) second += Math.abs(ensemble[i] - ensemble[j]);
  }
  second /= 2 * n * n;

  return first - second;
}

/**
 * @param {Forecast[]} forecasts
 * @param {number} binCount
 */
export function reliabilityBins(forecasts, binCount = 10) {
  if (!(binCount > 0)) throw new RangeError('binCount must be positive');
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: index / binCount,
    upper: (index + 1) / binCount,
    count: 0,
    probabilitySum: 0,
    outcomeSum: 0,
  }));

  for (const { probability, outcome } of forecasts) {
    const index = Math.min(binCount - 1, Math.floor(probability * binCount));
    bins[index].count += 1;
    bins[index].probabilitySum += probability;
    bins[index].outcomeSum += outcome;
  }

  return bins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      lower: bin.lower,
      upper: bin.upper,
      count: bin.count,
      meanProbability: bin.probabilitySum / bin.count,
      observedFrequency: bin.outcomeSum / bin.count,
      calibrationGap: bin.outcomeSum / bin.count - bin.probabilitySum / bin.count,
    }));
}

/**
 * Rank-based ROC AUC with 0.5 credit for ties.
 * @param {Forecast[]} forecasts
 */
export function rocAuc(forecasts) {
  const positives = forecasts.filter((f) => f.outcome === 1).map((f) => f.probability);
  const negatives = forecasts.filter((f) => f.outcome === 0).map((f) => f.probability);
  if (!positives.length || !negatives.length) {
    throw new RangeError('rocAuc needs at least one positive and one negative');
  }

  let score = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) score += 1;
      else if (p === n) score += 0.5;
    }
  }
  return score / (positives.length * negatives.length);
}

/**
 * @param {Forecast[]} forecasts
 */
export function summarizeVerification(forecasts) {
  return {
    provenance: FORECAST_PROVENANCE,
    count: forecasts.length,
    brier: brierScore(forecasts),
    brierSkill: brierSkillScore(forecasts),
    auc: rocAuc(forecasts),
    reliability: reliabilityBins(forecasts),
  };
}

/** A synthetic, clearly labelled verification set for the UI. */
export const DEMO_FORECASTS = Object.freeze([
  { probability: 0.9, outcome: 1 },
  { probability: 0.8, outcome: 1 },
  { probability: 0.75, outcome: 1 },
  { probability: 0.7, outcome: 0 },
  { probability: 0.65, outcome: 1 },
  { probability: 0.6, outcome: 0 },
  { probability: 0.55, outcome: 1 },
  { probability: 0.5, outcome: 0 },
  { probability: 0.45, outcome: 0 },
  { probability: 0.4, outcome: 1 },
  { probability: 0.35, outcome: 0 },
  { probability: 0.3, outcome: 0 },
  { probability: 0.25, outcome: 0 },
  { probability: 0.2, outcome: 0 },
  { probability: 0.15, outcome: 1 },
  { probability: 0.1, outcome: 0 },
]);
