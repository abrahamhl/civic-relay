import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLevelSetUpwind, ensembleLevelSetForecast } from '../src/level-set-solver.mjs';
import { auditCensoredHorizonLabels, scorePredictionsOnUncensored } from '../src/censor-audit.mjs';

function makeFlatGrid({ w = 41, h = 41, dxM = 50, fuelCode = 1 } = {}) {
  return {
    w, h, dxM,
    fuel: new Uint8Array(w * h).fill(fuelCode),
    elev: new Float32Array(w * h).fill(100),
  };
}

function makeCircularPhi0(w, h, dxM, cx, cy, rM) {
  const phi0 = new Float64Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    phi0[j * w + i] = Math.hypot((i - cx) * dxM, (j - cy) * dxM) - rM;
  }
  return phi0;
}

test('H-FIRE-B math: zero fuel / zero speed leaves phi invariant', () => {
  const grid = makeFlatGrid({ fuelCode: 0 });
  const phi0 = makeCircularPhi0(41, 41, 50, 20, 20, 120);
  const res = solveLevelSetUpwind({
    grid, phi0,
    weather: { windU_mps: 10, windV_mps: 0, availableAtMs: 0 },
    horizonMin: 30, t0Ms: 1000,
  });
  assert.equal(res.abstained, false);
  for (let k = 0; k < phi0.length; k++) assert.equal(res.phi[k], phi0[k]);
});

test('H-FIRE-B math: analytical isotropic disk radius matches R0 + V*t under CFL <= 0.45', () => {
  // Fuel 1 has base ROS0 = 6 m/min with zero wind and flat DEM
  const dxM = 40;
  const grid = makeFlatGrid({ w: 51, h: 51, dxM, fuelCode: 1 });
  const r0 = 120;
  const phi0 = makeCircularPhi0(51, 51, dxM, 25, 25, r0);
  const horizonMin = 40; // expected expansion: 6 m/min * 40 min = +240m -> R = 360m
  const res = solveLevelSetUpwind({
    grid, phi0,
    weather: { windU_mps: 0, windV_mps: 0, availableAtMs: 0 },
    horizonMin, cflTarget: 0.35, t0Ms: 1000,
  });
  assert.ok(res.maxObservedCfl <= 0.45);
  // Measure mean radius of newly burned boundary along cardinal axes from center (25,25)
  let eastIdx = 25;
  while (eastIdx < 50 && res.burnedMask[25 * 51 + (eastIdx + 1)] === 1) eastIdx++;
  const estRadiusM = (eastIdx - 25) * dxM;
  const expectedM = r0 + 6 * horizonMin;
  assert.ok(Math.abs(estRadiusM - expectedM) <= 1.5 * dxM, `est=${estRadiusM} vs expected=${expectedM}`);
});

test('H-FIRE-B physics: east wind creates downwind > crosswind asymmetry', () => {
  const dxM = 40;
  const grid = makeFlatGrid({ w: 55, h: 55, dxM, fuelCode: 1 });
  const phi0 = makeCircularPhi0(55, 55, dxM, 18, 27, 80);
  const res = solveLevelSetUpwind({
    grid, phi0,
    weather: { windU_mps: 8, windV_mps: 0, availableAtMs: 0 },
    horizonMin: 15, t0Ms: 1000,
  });
  let eastCells = 0, westCells = 0;
  for (let i = 19; i < 55; i++) if (res.burnedMask[27 * 55 + i]) eastCells++;
  for (let i = 0; i < 18; i++) if (res.burnedMask[27 * 55 + i]) westCells++;
  assert.ok(eastCells > westCells + 2, `Expected east(${eastCells}) >> west(${westCells})`);
});

test('H-FIRE-B physics: uphill slope accelerates upslope advance relative to flat ground', () => {
  const dxM = 40;
  const flatGrid = makeFlatGrid({ w: 41, h: 41, dxM, fuelCode: 2 });
  const slopeGrid = makeFlatGrid({ w: 41, h: 41, dxM, fuelCode: 2 });
  for (let j = 0; j < 41; j++) for (let i = 0; i < 41; i++) slopeGrid.elev[j * 41 + i] = 100 + i * 16; // 0.4 tan slope ascending east

  const phi0 = makeCircularPhi0(41, 41, dxM, 15, 20, 80);
  const w = { windU_mps: 0, windV_mps: 0, availableAtMs: 0 };
  const rFlat = solveLevelSetUpwind({ grid: flatGrid, phi0, weather: w, horizonMin: 25, t0Ms: 1000 });
  const rSlope = solveLevelSetUpwind({ grid: slopeGrid, phi0, weather: w, horizonMin: 25, t0Ms: 1000 });

  let flatEast = 0, slopeEast = 0;
  for (let i = 16; i < 41; i++) {
    if (rFlat.burnedMask[20 * 41 + i]) flatEast++;
    if (rSlope.burnedMask[20 * 41 + i]) slopeEast++;
  }
  assert.ok(slopeEast > flatEast, `Uphill slope(${slopeEast}) must exceed flat(${flatEast})`);
});

test('H-FIRE-B causal gate: deliberate future observation / ERA5 reanalysis leakage fails closed with ABSTAIN', () => {
  const grid = makeFlatGrid();
  const phi0 = makeCircularPhi0(41, 41, 50, 20, 20, 100);
  const leakRes = solveLevelSetUpwind({
    grid, phi0,
    weather: { windU_mps: 5, windV_mps: 0, availableAtMs: 2000 },
    t0Ms: 1000,
  });
  assert.equal(leakRes.abstained, true);
  assert.equal(leakRes.reason, 'TEMPORAL_LEAKAGE_FUTURE_FEATURE');
  assert.equal(leakRes.canIssueEvacuationOrder, false);

  const era5Res = ensembleLevelSetForecast({
    grid, phi0,
    weather: { windU_mps: 5, windV_mps: 0, availableAtMs: 500, isPostHocReanalysis: true },
    t0Ms: 1000,
  });
  assert.equal(era5Res.abstained, true);
  assert.equal(era5Res.reason, 'TEMPORAL_LEAKAGE_POSTHOC_REANALYSIS_FORBIDDEN');
});

test('H-FIRE-B censoring audit: incomplete 24h observation produces CENSORED rather than false 0 negatives', () => {
  const HOUR = 3_600_000;
  const square = (r) => [[[-r, -r], [r, -r], [r, r], [-r, r]]];
  const perimetersKm = [
    { tMs: 0, rings: square(1) },
    { tMs: 2 * HOUR, rings: square(2) }, // k0 = 1 (t0 = 2h)
    { tMs: 6 * HOUR, rings: square(3) }, // last perimeter is t0+4h (< t0+24h!)
  ];
  const points = [[1.5, 0], [2.5, 0], [4.0, 4.0]]; // already burnt in k0, burnt by k=2, outside k=2
  const audit = auditCensoredHorizonLabels(perimetersKm, 1, points, { horizonMs: 24 * HOUR });
  assert.equal(audit.labels[1], 1);
  assert.equal(audit.labels[2], 'CENSORED');
  const score = scorePredictionsOnUncensored([0.5, 0.8, 0.1], audit.labels);
  assert.equal(score.evaluableCount, 2);
});
