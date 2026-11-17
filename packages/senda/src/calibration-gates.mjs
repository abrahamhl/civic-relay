/**
 * SENDA independent offline calibration gate v1.
 * Evaluates only HELD-OUT cases. Does not fit models, fetch feeds,
 * or grant permission to issue emergency alerts.
 * Any "verified" flags here are auditable assertions, NOT independent proof.
 */
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /(?:Z|[+-]\d{2}:\d{2})$/;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const squared = (x) => x * x;

function timestamp(value) {
  if (typeof value !== 'string' || !ISO.test(value)) return NaN;
  return Date.parse(value);
}

function sourceKnown(id, registry, engine) {
  return registry.sources.some((s) => s.id === id && s.engines.includes(engine));
}

export function validateCalibrationRows(rows, registry, { minTestCases = 3, minTestRows = 20 } = {}) {
  const errors = [];
  if (!Array.isArray(rows) || !rows.length) return { ok: false, errors: ['EMPTY_EVIDENCE'], counts: {} };
  if (!registry || registry.schema !== 'senda-calibration-sources/1' ||
      !Array.isArray(registry.sources) || typeof registry.engines !== 'object') {
    return { ok: false, errors: ['UNKNOWN_SOURCE_REGISTRY'], counts: {} };
  }
  const seen = new Set();
  const splits = new Map();
  const countByEngine = new Map();
  for (const [i, r] of rows.entries()) {
    const prefix = `row[${i}]`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      errors.push(prefix + ':INVALID_ROW');
      continue;
    }
    if (typeof r.id !== 'string' || !r.id || seen.has(r.id)) errors.push(prefix + ':MISSING_OR_DUPLICATE_ID');
    else seen.add(r.id);
    if (!Object.hasOwn(registry.engines, r.engine)) errors.push(prefix + ':UNKNOWN_ENGINE');
    if (!['TRAIN', 'TEST'].includes(r.fold)) errors.push(prefix + ':INVALID_FOLD');
    if (!['PROBABILITY', 'REGRESSION'].includes(r.kind)) errors.push(prefix + ':INVALID_KIND');
    if (!r.case_id || typeof r.case_id !== 'string') errors.push(prefix + ':MISSING_CASE_ID');
    if (!r.model_version || typeof r.model_version !== 'string') errors.push(prefix + ':UNVERSIONED_MODEL');
    if (!r.unit || typeof r.unit !== 'string') errors.push(prefix + ':MISSING_UNIT');
    if (!sourceKnown(r.feature_source_id, registry, r.engine)) errors.push(prefix + ':UNKNOWN_FEATURE_SOURCE');
    if (!sourceKnown(r.truth_source_id, registry, r.engine)) errors.push(prefix + ':UNKNOWN_TRUTH_SOURCE');
    if (r.feature_source_id === r.truth_source_id) errors.push(prefix + ':NONINDEPENDENT_TRUTH');
    if (!SHA256.test(r.raw_sha256 ?? '')) errors.push(prefix + ':MISSING_RAW_DIGEST');
    for (const key of ['rights_verified', 'access_authorized', 'quality_masks_preserved', 'units_checked',
      'spatial_alignment_checked', 'independent_truth_verified', 'privacy_review_passed']) {
      if (r[key] !== true) errors.push(prefix + ':EVIDENCE_REQUIRED_' + key.toUpperCase());
    }
    const predT = timestamp(r.predicted_at_utc);
    const featureT = timestamp(r.feature_available_at_utc);
    const truthT = timestamp(r.truth_observed_at_utc);
    const labelT = timestamp(r.truth_available_at_utc);
    if (![predT, featureT, truthT, labelT].every(Number.isFinite)) errors.push(prefix + ':INVALID_TIME');
    if (finite(predT) && finite(featureT) && featureT > predT) errors.push(prefix + ':FUTURE_FEATURE_LEAKAGE');
    if (finite(truthT) && finite(labelT) && labelT < truthT) errors.push(prefix + ':LABEL_AVAILABLE_BEFORE_OBSERVATION');
    if (!finite(r.prediction) || !finite(r.truth)) errors.push(prefix + ':NON_FINITE_RESULT');
    if (r.kind === 'PROBABILITY' && (!finite(r.prediction) || r.prediction < 0 || r.prediction > 1 ||
        ![0, 1].includes(r.truth))) errors.push(prefix + ':INVALID_PROBABILITY');
    if (r.kind === 'PROBABILITY' && r.unit !== 'probability') errors.push(prefix + ':WRONG_PROBABILITY_UNIT');
    if (r.lower !== undefined || r.upper !== undefined) {
      if (r.kind !== 'REGRESSION' || !finite(r.lower) || !finite(r.upper) || r.lower > r.upper)
        errors.push(prefix + ':INVALID_INTERVAL');
    }
    const group = String(r.engine) + '/' + String(r.kind);
    if (!countByEngine.has(group)) countByEngine.set(group, { train: [], test: [], testCases: new Set(), units: new Set(), versions: new Set() });
    const v = countByEngine.get(group);
    if (r.fold === 'TRAIN') v.train.push(r);
    if (r.fold === 'TEST') { v.test.push(r); v.testCases.add(r.case_id); }
    v.units.add(r.unit); v.versions.add(r.model_version);
    const key = String(r.engine) + '/' + String(r.case_id);
    if (splits.has(key) && splits.get(key) !== r.fold) errors.push(prefix + ':CASE_LEAKAGE_ACROSS_FOLDS');
    else splits.set(key, r.fold);
  }
  for (const [engine, v] of countByEngine) {
    if (v.train.length < 1) errors.push(engine + ':NO_TRAIN_REFERENCE');
    if (v.test.length < minTestRows) errors.push(engine + ':INSUFFICIENT_TEST_ROWS');
    if (v.testCases.size < minTestCases) errors.push(engine + ':INSUFFICIENT_INDEPENDENT_TEST_CASES');
    if (v.units.size !== 1) errors.push(engine + ':MIXED_UNITS');
    if (v.versions.size !== 1) errors.push(engine + ':MIXED_MODEL_VERSIONS');
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)],
    counts: Object.fromEntries([...countByEngine].map(([k,v]) => [k, {
      trainRows: v.train.length, testRows: v.test.length, independentTestCases: v.testCases.size
    }])) };
}

function probabilityMetrics(train, test) {
  const prevalence = mean(train.map((r) => r.truth));
  const brier = mean(test.map((r) => squared(r.prediction - r.truth)));
  const baselineBrier = mean(test.map((r) => squared(prevalence - r.truth)));
  const logLoss = mean(test.map((r) => -(r.truth * Math.log(Math.max(1e-15, r.prediction)) +
    (1 - r.truth) * Math.log(Math.max(1e-15, 1 - r.prediction)))));
  let ece = 0;
  for (let b = 0; b < 10; b++) {
    const bin = test.filter((r) => Math.min(9, Math.floor(r.prediction * 10)) === b);
    if (bin.length) ece += bin.length / test.length *
      Math.abs(mean(bin.map((r) => r.prediction)) - mean(bin.map((r) => r.truth)));
  }
  return { brier, referenceBrier: baselineBrier, brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    logLoss, expectedCalibrationError10: ece, trainingPrevalence: prevalence };
}

function regressionMetrics(train, test) {
  const errors = test.map((r) => r.prediction - r.truth);
  const baseline = mean(train.map((r) => r.truth));
  const rmse = Math.sqrt(mean(errors.map(squared)));
  const baselineRmse = Math.sqrt(mean(test.map((r) => squared(baseline - r.truth))));
  const metrics = {
    mae: mean(errors.map(Math.abs)), rmse, bias: mean(errors), trainingMean: baseline,
    referenceRmse: baselineRmse, rmseSkill: baselineRmse > 0 ? 1 - rmse / baselineRmse : null
  };
  const intervals = test.filter((r) => finite(r.lower) && finite(r.upper));
  if (intervals.length) {
    metrics.intervalCoverage = mean(intervals.map((r) => +(r.truth >= r.lower && r.truth <= r.upper)));
    metrics.intervalCount = intervals.length;
  }
  return metrics;
}

export function evaluateHeldOutCalibration(rows, registry, options = {}) {
  const gate = validateCalibrationRows(rows, registry, options);
  if (!gate.ok) return { status: 'BLOCKED', canIssueOfficialAlert: false, gate };
  const groups = new Map();
  for (const r of rows) {
    const key = r.engine + '/' + r.kind;
    if (!groups.has(key)) groups.set(key, { train: [], test: [] });
    groups.get(key)[r.fold.toLowerCase()].push(r);
  }
  const metrics = {};
  for (const [key, data] of groups) {
    metrics[key] = {
      sampleCount: data.test.length,
      testCases: new Set(data.test.map((r) => r.case_id)).size,
      unit: data.test[0].unit,
      modelVersion: data.test[0].model_version,
      ... (key.endsWith('/PROBABILITY') ? probabilityMetrics(data.train, data.test)
        : regressionMetrics(data.train, data.test))
    };
  }
  return { status: 'HELD_OUT_RESEARCH_EVALUATION_ONLY', canIssueOfficialAlert: false,
    calibrated: false, // Validation is not fitting or physical calibration.
    gate, metrics, limitations: [
      'Metrics are meaningful only if evidence assertions, independence and data rights are externally audited.',
      'No model tuning is allowed on TEST rows; evaluate once with frozen model and split.',
      'This evaluation never authorises emergency decisions or field deployment.'
    ] };
}
