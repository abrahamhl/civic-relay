import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_FORECASTS,
  brierScore,
  brierSkillScore,
  briggsDispersion,
  cToF,
  crpsEnsemble,
  dewPointC,
  fToC,
  fosbergFireWeatherIndex,
  gaussianPlumeGroundLevel,
  hainesIndex,
  heatIndexC,
  reliabilityBins,
  relativeHumidity,
  rocAuc,
  summarizeVerification,
  windChillC,
  windSpeedDirFromVector,
  windVectorFromSpeedDir,
} from '../src/science/meteorology.mjs';

test('temperature conversions round-trip', () => {
  for (const c of [-40, -10, 0, 21.5, 37]) {
    assert.ok(Math.abs(fToC(cToF(c)) - c) < 1e-9);
  }
  assert.equal(cToF(0), 32);
  assert.equal(cToF(100), 212);
});

test('dew point and relative humidity are consistent', () => {
  const dew = dewPointC(25, 50);
  assert.ok(Math.abs(dew - 13.86) < 0.15, `dew point was ${dew}`);
  assert.ok(Math.abs(relativeHumidity(25, dew) - 50) < 0.5);
  assert.throws(() => dewPointC(25, 0), /rhPercent/);
});

test('heat index and wind chill match their published ranges', () => {
  const hi = heatIndexC(32, 70);
  assert.ok(hi > 38 && hi < 45, `heat index was ${hi}`);
  assert.equal(heatIndexC(20, 50), 20, 'below the valid range returns air temperature');

  const wc = windChillC(0, 20);
  assert.ok(Math.abs(wc - -5.24) < 0.3, `wind chill was ${wc}`);
  assert.equal(windChillC(15, 20), 15, 'above 10 C returns air temperature');
});

test('wind vector and speed/direction round-trip', () => {
  const vector = windVectorFromSpeedDir(10, 90);
  assert.ok(Math.abs(vector.u - -10) < 1e-9);
  assert.ok(Math.abs(vector.v) < 1e-9);

  for (const [speed, direction] of [
    [0, 0],
    [5, 45],
    [12, 180],
    [3, 270],
    [8, 315],
  ]) {
    const round = windSpeedDirFromVector(windVectorFromSpeedDir(speed, direction));
    assert.ok(Math.abs(round.speedMs - speed) < 1e-9);
    if (speed > 0) {
      const diff = Math.abs(((round.directionFromDeg - direction + 540) % 360) - 180);
      assert.ok(diff < 1e-9, `${direction} -> ${round.directionFromDeg}`);
    }
  }
});

test('Fosberg index rises with heat, dryness and wind', () => {
  const calmHumid = fosbergFireWeatherIndex({ tempC: 15, rhPercent: 80, windKmh: 2 });
  const hotDryWindy = fosbergFireWeatherIndex({ tempC: 35, rhPercent: 15, windKmh: 40 });
  assert.ok(hotDryWindy.ffwi > calmHumid.ffwi);
  assert.ok(calmHumid.ffwi >= 0 && hotDryWindy.ffwi <= 200);
  assert.ok(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(hotDryWindy.class));
});

test('Haines index combines stability and moisture terms', () => {
  const low = hainesIndex({ lowLapseC: 2, lowDepressionC: 2, midLapseC: 2, midDepressionC: 2 });
  const high = hainesIndex({ lowLapseC: 9, lowDepressionC: 14, midLapseC: 9, midDepressionC: 14 });
  assert.equal(low.value, 2);
  assert.equal(high.value, 6);
  assert.equal(high.class, 'VERY_HIGH');
});

test('Briggs dispersion grows downwind and differs by stability class', () => {
  const near = briggsDispersion('D', 100);
  const far = briggsDispersion('D', 1000);
  assert.ok(far.sigmaYM > near.sigmaYM);
  assert.ok(far.sigmaZM > near.sigmaZM);

  const unstable = briggsDispersion('A', 500);
  const stable = briggsDispersion('F', 500);
  assert.ok(unstable.sigmaZM > stable.sigmaZM);
});

test('Gaussian plume decreases downwind and is stronger under stable conditions', () => {
  const base = {
    emissionRateGps: 10,
    windSpeedMs: 3,
    stackHeightM: 0,
    stabilityClass: 'D',
  };
  const near = gaussianPlumeGroundLevel({ ...base, downwindM: 100 });
  const far = gaussianPlumeGroundLevel({ ...base, downwindM: 1000 });
  assert.ok(near.concentrationUgM3 > far.concentrationUgM3);

  const unstable = gaussianPlumeGroundLevel({ ...base, stabilityClass: 'A', downwindM: 500 });
  const stable = gaussianPlumeGroundLevel({ ...base, stabilityClass: 'F', downwindM: 500 });
  assert.ok(stable.concentrationUgM3 > unstable.concentrationUgM3);
  assert.equal(near.provenance, 'MODEL_DERIVED');
  assert.ok(near.assumptions.length >= 4);
});

test('Brier score and skill behave on known cases', () => {
  assert.equal(brierScore([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]), 0);
  assert.equal(brierScore([{ probability: 0.5, outcome: 1 }]), 0.25);
  assert.equal(
    brierSkillScore([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]),
    1,
  );
  assert.throws(() => brierScore([]), /empty/);
  assert.throws(() => brierScore([{ probability: 1.5, outcome: 1 }]), /probability/);
});

test('CRPS for an ensemble matches hand-computed cases', () => {
  assert.ok(Math.abs(crpsEnsemble([10, 10], 12) - 2) < 1e-12);
  assert.ok(Math.abs(crpsEnsemble([0, 10], 5) - 2.5) < 1e-12);
});

test('reliability bins partition the forecasts', () => {
  const bins = reliabilityBins(DEMO_FORECASTS, 5);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  assert.equal(total, DEMO_FORECASTS.length);
  assert.ok(bins.every((bin) => Math.abs(bin.calibrationGap) <= 1));
});

test('ROC AUC handles perfect, reversed and fully tied forecasts', () => {
  const perfect = [
    { probability: 0.9, outcome: 1 },
    { probability: 0.8, outcome: 1 },
    { probability: 0.2, outcome: 0 },
    { probability: 0.1, outcome: 0 },
  ];
  assert.equal(rocAuc(perfect), 1);

  const reversed = perfect.map((forecast) => ({ ...forecast, outcome: 1 - forecast.outcome }));
  assert.equal(rocAuc(reversed), 0);

  const tied = [
    { probability: 0.5, outcome: 1 },
    { probability: 0.5, outcome: 0 },
  ];
  assert.equal(rocAuc(tied), 0.5);
  assert.throws(() => rocAuc([{ probability: 0.5, outcome: 1 }]), /positive and one negative/);
});

test('demo verification summary is internally consistent', () => {
  const summary = summarizeVerification(DEMO_FORECASTS);
  assert.equal(summary.provenance, 'SIMULATOR');
  assert.equal(summary.count, DEMO_FORECASTS.length);
  assert.ok(summary.brier > 0 && summary.brier < 0.5);
  assert.ok(summary.auc > 0.5 && summary.auc <= 1);
  assert.ok(summary.brierSkill > 0);
  assert.equal(summary.reliability.reduce((sum, bin) => sum + bin.count, 0), DEMO_FORECASTS.length);
});
