import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateCalibrationRows, evaluateHeldOutCalibration } from '../src/calibration-gates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(resolve(here, '../calibration/sources.v1.json'), 'utf8'));
const HASH = 'sha256:' + 'a'.repeat(64);

// ONLY controlled synthetic fixtures for unit tests; never use as observed sensor data.
function sampleRows(kind = 'REGRESSION', engine = 'traffic-speed-flow') {
  const feature = engine === 'traffic-speed-flow' ? 'digitraffic-weathercam' : 'noaa-goes-fhs';
  const truth = engine === 'traffic-speed-flow' ? 'digitraffic-tms' : 'nist-camp-fire';
  const rows = [];
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < (c === 0 ? 4 : 10); i++) {
      const actual = kind === 'PROBABILITY' ? (i % 2) : 30 + i + c;
      const p = kind === 'PROBABILITY' ? (actual ? 0.8 : 0.2) : actual + 1;
      rows.push({
        id: `synthetic-${engine}-${c}-${i}`,
        engine, case_id: `synthetic-event-${c}`, model_version: '0.1.0-frozen',
        kind, fold: c === 0 ? 'TRAIN' : 'TEST', unit: kind === 'PROBABILITY' ? 'probability' : 'km/h',
        feature_source_id: feature, truth_source_id: truth,
        raw_sha256: HASH, prediction: p, truth: actual,
        predicted_at_utc: '2026-11-01T00:10:00Z',
        feature_available_at_utc: '2026-11-01T00:05:00Z',
        truth_observed_at_utc: '2026-11-01T00:20:00Z',
        truth_available_at_utc: '2026-11-01T00:30:00Z',
        rights_verified: true, access_authorized: true, quality_masks_preserved: true,
        units_checked: true, spatial_alignment_checked: true,
        independent_truth_verified: true, privacy_review_passed: true,
        ...(kind === 'REGRESSION' ? { lower: p - 2, upper: p + 2 } : {})
      });
    }
  }
  return rows;
}

test('official source registry covers 14 engine families; no dataset is impersonated as ingested', () => {
  assert.equal(registry.sources.length, 17);
  assert.equal(Object.keys(registry.engines).length, 14);
  assert.ok(registry.sources.every((s) => s.official_url.startsWith('https://')));
  assert.ok(registry.sources.every((s) => s.ingestion === 'NOT_INGESTED'));
  assert.ok(registry.sources.every((s) => s.rights === 'REVIEW_PER_PRODUCT_AND_USE_CASE'));
  for (const [engine, ids] of Object.entries(registry.engines)) {
    assert.ok(ids.length > 0, engine);
    for (const id of ids) {
      if (id === 'FIELD_TRIAL_REQUIRED') continue;
      assert.ok(registry.sources.some((s) => s.id === id && s.engines.includes(engine)), engine + '/' + id);
    }
  }
});
test('synthetic regression benchmark is scored only on held-out event groups', () => {
  const rows = sampleRows();
  const result = evaluateHeldOutCalibration(rows, registry);
  assert.equal(result.status, 'HELD_OUT_RESEARCH_EVALUATION_ONLY');
  assert.equal(result.calibrated, false);
  assert.equal(result.canIssueOfficialAlert, false);
  assert.equal(result.metrics['traffic-speed-flow/REGRESSION'].sampleCount, 30);
  assert.equal(result.metrics['traffic-speed-flow/REGRESSION'].testCases, 3);
  assert.equal(result.metrics['traffic-speed-flow/REGRESSION'].mae, 1);
  assert.equal(result.metrics['traffic-speed-flow/REGRESSION'].rmse, 1);
  assert.equal(result.metrics['traffic-speed-flow/REGRESSION'].intervalCoverage, 1);
});
test('synthetic held-out probabilistic benchmark computes finite Brier and calibration metrics', () => {
  const result = evaluateHeldOutCalibration(sampleRows('PROBABILITY', 'fire-spread-3d'), registry);
  assert.equal(result.status, 'HELD_OUT_RESEARCH_EVALUATION_ONLY');
  assert.ok(Math.abs(result.metrics['fire-spread-3d/PROBABILITY'].brier - .04) < 1e-12);
  assert.ok(result.metrics['fire-spread-3d/PROBABILITY'].brierSkill > 0);
});
test('future feature timestamps always block retrospective prediction claims', () => {
  const rows = sampleRows(); rows[0].feature_available_at_utc = '2026-11-01T00:40:00Z';
  assert.ok(validateCalibrationRows(rows, registry).errors.some((e) => e.includes('FUTURE_FEATURE_LEAKAGE')));
  assert.equal(evaluateHeldOutCalibration(rows, registry).status, 'BLOCKED');
});
test('event leakage between TRAIN and TEST blocks a holdout score', () => {
  const rows = sampleRows(); rows[0].case_id = 'synthetic-event-1';
  assert.ok(validateCalibrationRows(rows, registry).errors.some((e) => e.includes('CASE_LEAKAGE_ACROSS_FOLDS')));
});
test('unverified licence, access, mask and privacy block evaluation', () => {
  for (const flag of ['rights_verified', 'access_authorized', 'quality_masks_preserved', 'privacy_review_passed']) {
    const rows = sampleRows(); rows[0][flag] = false;
    assert.equal(validateCalibrationRows(rows, registry).ok, false, flag);
  }
});
test('missing digests, fake independent labels and unknown sources are rejected', () => {
  const rows = sampleRows();
  rows[0].raw_sha256 = 'sha256:invented';
  rows[1].truth_source_id = rows[1].feature_source_id;
  rows[2].feature_source_id = 'unknown-website';
  const errors = validateCalibrationRows(rows, registry).errors.join('|');
  for (const expected of ['MISSING_RAW_DIGEST','NONINDEPENDENT_TRUTH','UNKNOWN_FEATURE_SOURCE']) assert.ok(errors.includes(expected));
});
test('insufficient independent cases, rows, non-finite forecasts and mixed units fail closed', () => {
  const rows = sampleRows().slice(0, 14);
  rows[0].prediction = Infinity;
  rows[1].unit = 'm/s';
  const errors = validateCalibrationRows(rows, registry).errors.join('|');
  for (const expected of ['INSUFFICIENT_TEST_ROWS','INSUFFICIENT_INDEPENDENT_TEST_CASES','NON_FINITE_RESULT','MIXED_UNITS']) assert.ok(errors.includes(expected));
});
test('a malformed or swapped prediction interval never receives a calibrated label', () => {
  const rows = sampleRows(); rows[0].lower = 1000; rows[0].upper = -1;
  assert.ok(validateCalibrationRows(rows, registry).errors.some((e) => e.includes('INVALID_INTERVAL')));
});
