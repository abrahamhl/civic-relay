import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWilsonScoreInterval,
  computeReliabilityDiagram,
  generateSyntheticCalibrationDataset,
  ingestPilotReceiptsIntoCalibration,
  BEARER_CALIBRATION_PROFILES
} from '../src/calibration-diagram.mjs';

test('Wilson score interval: handles boundaries and nominal cases safely', () => {
  // Empty
  const zero = computeWilsonScoreInterval(0, 0);
  assert.equal(zero.lower, 0);
  assert.equal(zero.upper, 1);

  // 0 of 10: does not collapse to exactly [0, 0]
  const low = computeWilsonScoreInterval(0, 10);
  assert.ok(low.lower >= 0);
  assert.ok(low.upper > 0 && low.upper <= 0.35);

  // 10 of 10: does not collapse to exactly [1, 1]
  const high = computeWilsonScoreInterval(10, 10);
  assert.ok(high.lower >= 0.65 && high.lower < 1);
  assert.ok(high.upper <= 1.0);

  // 50 of 100: symmetric around 0.5
  const mid = computeWilsonScoreInterval(50, 100);
  assert.ok(mid.lower > 0.39 && mid.lower < 0.41);
  assert.ok(mid.upper > 0.59 && mid.upper < 0.61);
  assert.equal(Math.round(mid.center * 100) / 100, 0.5);
});

test('Reliability diagram: empty or invalid sample set returns safe defaults', () => {
  const res = computeReliabilityDiagram([]);
  assert.equal(res.sampleCount, 0);
  assert.equal(res.brierScore, 0);
  assert.equal(res.isCalibrated, false);
});

test('Reliability diagram: Murphy decomposition identity holds exactly', () => {
  // Discrete forecast case: all predictions in bin m are equal to bin center
  const discreteSamples = [
    { predicted: 0.1, observed: 0 },
    { predicted: 0.1, observed: 0 },
    { predicted: 0.3, observed: 0 },
    { predicted: 0.3, observed: 1 },
    { predicted: 0.5, observed: 1 },
    { predicted: 0.5, observed: 0 },
    { predicted: 0.7, observed: 1 },
    { predicted: 0.7, observed: 1 },
    { predicted: 0.9, observed: 1 },
    { predicted: 0.9, observed: 1 }
  ];

  const discreteRes = computeReliabilityDiagram(discreteSamples, { numBins: 5 });
  assert.equal(discreteRes.sampleCount, 10);
  assert.equal(discreteRes.bins.length, 5);

  // For discrete forecasts, raw Brier Score exactly equals Murphy decomposed score
  const discreteMurphy = discreteRes.murphy.reliability - discreteRes.murphy.resolution + discreteRes.murphy.uncertainty;
  assert.ok(
    Math.abs(discreteRes.brierScore - discreteMurphy) < 1e-6,
    `Discrete Brier (${discreteRes.brierScore}) and Murphy (${discreteMurphy}) must match within 1e-6`
  );

  // Continuous forecast case with within-bin discretization error
  const continuousSamples = [
    { predicted: 0.08, observed: 0 },
    { predicted: 0.15, observed: 0 },
    { predicted: 0.32, observed: 0 },
    { predicted: 0.38, observed: 1 },
    { predicted: 0.54, observed: 1 },
    { predicted: 0.52, observed: 0 },
    { predicted: 0.71, observed: 1 },
    { predicted: 0.79, observed: 1 },
    { predicted: 0.88, observed: 1 },
    { predicted: 0.96, observed: 1 }
  ];

  const res = computeReliabilityDiagram(continuousSamples, { numBins: 5 });
  assert.equal(res.sampleCount, 10);
  assert.ok(Math.abs(res.brierScore - (res.brierScoreBinned + res.withinBinDiscretization)) < 1e-6);
  assert.ok(Math.abs(res.murphy.decomposedScore - res.brierScoreBinned) < 1e-6);

  // Bins have valid Wilson intervals
  for (const b of res.bins) {
    if (b.count > 0) {
      assert.ok(b.confidenceInterval.lower <= b.meanObserved);
      assert.ok(b.confidenceInterval.upper >= b.meanObserved);
    }
  }
});

test('Synthetic calibration dataset: deterministic PRNG and honest [SIMULADO] epistemic tagging', () => {
  const d1 = generateSyntheticCalibrationDataset({ count: 100, seed: 1337, stress: 'NORMAL' });
  const d2 = generateSyntheticCalibrationDataset({ count: 100, seed: 1337, stress: 'NORMAL' });
  const d3 = generateSyntheticCalibrationDataset({ count: 100, seed: 9999, stress: 'RAIN_DANA' });

  // Determinism
  assert.deepEqual(d1.samples, d2.samples);
  assert.notDeepEqual(d1.samples, d3.samples);

  // Epistemic status
  assert.equal(d1.metadata.epistemicStatus, 'SIMULADO');
  assert.ok(d1.metadata.warning.includes('SIMULADO') || d1.metadata.warning.includes('sintéticos'));

  // Calibration metrics on synthetic data
  const diag = computeReliabilityDiagram(d1.samples, { numBins: 5 });
  assert.equal(diag.sampleCount, 100);
  assert.ok(diag.brierScore > 0 && diag.brierScore < 0.25);
  assert.ok(diag.ece < 0.20);
});

test('Bearer profiles: covers all 6 primary OEP multi-bearer channels with stress penalties', () => {
  const expected = ['MESHTASTIC', 'PHONE_MESH', 'SMS', 'SAT_D2C_SMS', 'CELL_DATA', 'IRIDIUM_SBD'];
  for (const b of expected) {
    assert.ok(BEARER_CALIBRATION_PROFILES[b], `Bearer ${b} must be present`);
    assert.ok(BEARER_CALIBRATION_PROFILES[b].nominalDeliveryRate > 0.5);
    assert.ok(BEARER_CALIBRATION_PROFILES[b].stressPenalty.JAMMING >= 0.3);
  }
});

test('Field pilot receipt ingestion: maps DeliveryReceipt v1 to real calibration samples', () => {
  // Empty returns pending
  const empty = ingestPilotReceiptsIntoCalibration([]);
  assert.equal(empty.metadata.epistemicStatus, 'VALIDACION_FISICA_PENDIENTE');

  // Real receipts
  const receipts = [
    {
      receipt_id: 'rec-001',
      bearer_id: 'MESHTASTIC',
      zone_h3: '87391a45bffffff',
      predicted_probability: 0.85,
      outcome: 'DELIVERED',
      sent_at: '2026-11-10T12:00:00Z'
    },
    {
      receipt_id: 'rec-002',
      bearer_id: 'PHONE_MESH',
      zone_h3: '87391a45bffffff',
      predicted_probability: 0.65,
      outcome: 'TIMEOUT',
      sent_at: '2026-11-10T12:02:00Z'
    }
  ];

  const ingested = ingestPilotReceiptsIntoCalibration(receipts);
  assert.equal(ingested.metadata.epistemicStatus, 'DATO_REAL_CAPTURADO');
  assert.equal(ingested.samples.length, 2);
  assert.equal(ingested.samples[0].observed, 1);
  assert.equal(ingested.samples[1].observed, 0);

  const diag = computeReliabilityDiagram(ingested.samples, { numBins: 5 });
  assert.equal(diag.sampleCount, 2);
});
