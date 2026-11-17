import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSpatialIoU,
  evaluateClassificationPerformance,
  calculateRfLinkBudgetItu526,
  evaluateSatelliteTechnicalLink,
} from '../src/scientific-evaluation.mjs';

test('Scientific Evaluation: spatial IoU (Jaccard index) and Dice overlap', () => {
  // Case 1: Identical grids
  const gridA = [1, 1, 0, 0, 1];
  const gridB = [1, 1, 0, 0, 1];
  const identical = evaluateSpatialIoU(gridA, gridB);
  assert.equal(identical.iou, 1.0);
  assert.equal(identical.diceCoefficient, 1.0);
  assert.equal(identical.falsePositiveCells, 0);
  assert.equal(identical.falseNegativeCells, 0);

  // Case 2: Disjoint grids
  const gridC = [0, 0, 1, 1, 0];
  const disjoint = evaluateSpatialIoU(gridA, gridC);
  assert.equal(disjoint.iou, 0.0);
  assert.equal(disjoint.diceCoefficient, 0.0);

  // Case 3: Partial overlap (Intersection = 2, Union = 4 -> IoU = 0.5)
  const gridD = [1, 1, 1, 0, 0];
  const gridE = [1, 1, 0, 1, 0];
  const partial = evaluateSpatialIoU(gridD, gridE);
  assert.equal(partial.intersectionCells, 2);
  assert.equal(partial.unionCells, 4);
  assert.equal(partial.iou, 0.5);
  assert.equal(partial.diceCoefficient, 0.6667);

  // Case 4: Invalid dimensions throw error
  assert.throws(() => evaluateSpatialIoU([1], [1, 0]), /INVALID_GRID_DIMENSIONS/);
});

test('Scientific Evaluation: classification precision, recall, FPR, and F1', () => {
  // Truth: 5 positives, 5 negatives
  const truth = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
  // Model predictions (probabilities)
  const preds = [0.9, 0.8, 0.7, 0.6, 0.4, 0.6, 0.2, 0.1, 0.3, 0.2];

  const metrics = evaluateClassificationPerformance(truth, preds, 0.5);
  // Positives above 0.5: 4 TP (indices 0..3), 1 FN (index 4)
  // Negatives above 0.5: 1 FP (index 5), 4 TN (indices 6..9)
  assert.equal(metrics.truePositives, 4);
  assert.equal(metrics.falsePositives, 1);
  assert.equal(metrics.trueNegatives, 4);
  assert.equal(metrics.falseNegatives, 1);
  assert.equal(metrics.precision, 0.8); // 4 / (4+1) = 0.8
  assert.equal(metrics.recall, 0.8);    // 4 / (4+1) = 0.8
  assert.equal(metrics.specificity, 0.8); // 4 / (4+1) = 0.8
  assert.equal(metrics.falsePositiveRate, 0.2); // 1 / (1+4) = 0.2
  assert.equal(metrics.f1Score, 0.8);
});

test('Scientific Evaluation: ITU-R P.526 RF diffraction loss and link budget', () => {
  // Free space unobstructed link (10 km, 868 MHz)
  const losLink = calculateRfLinkBudgetItu526({
    frequencyMHz: 868,
    distanceKm: 10,
    txPowerDbm: 14,
    txGainDbi: 2.15,
    rxGainDbi: 2.15,
    rxSensitivityDbm: -126,
    obstacleHeightAboveRayM: -15, // obstacle is well below the ray (clear Fresnel)
    d1Km: 5,
    d2Km: 5,
  });

  assert.ok(losLink.fsplDb > 110 && losLink.fsplDb < 112, `FSPL expected ~111 dB, got ${losLink.fsplDb}`);
  assert.equal(losLink.diffractionLossDb, 0); // No diffraction loss when unobstructed
  assert.ok(losLink.linkMarginDb > 15);
  assert.equal(losLink.linkViability, 'RELIABLE_WITH_FADING_MARGIN');

  // Obstructed link by ridge (+25m above line of sight)
  const obstructedLink = calculateRfLinkBudgetItu526({
    frequencyMHz: 868,
    distanceKm: 10,
    txPowerDbm: 14,
    txGainDbi: 2.15,
    rxGainDbi: 2.15,
    rxSensitivityDbm: -126,
    obstacleHeightAboveRayM: 25, // ridge blocks line of sight
    d1Km: 5,
    d2Km: 5,
  });

  assert.ok(obstructedLink.diffractionLossDb > 12, 'Diffraction loss must exceed 12 dB for 25m knife-edge obstruction');
  assert.ok(obstructedLink.linkMarginDb < losLink.linkMarginDb);
});

test('Scientific Evaluation: satellite Doppler and hardware constraint evaluation', () => {
  // LEO satellite at 35° elevation with uncompensated COTS terminal
  const leoUncompensated = evaluateSatelliteTechnicalLink({
    orbitAltitudeKm: 550,
    elevationDeg: 35,
    frequencyMHz: 433,
    terminalHardware: {
      hasDopplerCorrection: false,
      hasBeamSteering: false,
      minElevationDeg: 15,
    },
  });

  assert.equal(leoUncompensated.isMathematicallyVisible, true);
  assert.equal(leoUncompensated.isAboveMaskAngle, true);
  assert.ok(Math.abs(leoUncompensated.maxDopplerShiftHz) > 5000);
  assert.equal(leoUncompensated.technicallyConnectable, false);
  assert.ok(leoUncompensated.technicalBlockers.includes('EXCESSIVE_DOPPLER_SHIFT_WITHOUT_HARDWARE_CORRECTION'));

  // Satellite below mask angle
  const belowMask = evaluateSatelliteTechnicalLink({
    orbitAltitudeKm: 550,
    elevationDeg: 8,
    frequencyMHz: 433,
    terminalHardware: {
      hasDopplerCorrection: true,
      hasBeamSteering: false,
      minElevationDeg: 15,
    },
  });

  assert.equal(belowMask.isMathematicallyVisible, true);
  assert.equal(belowMask.isAboveMaskAngle, false);
  assert.equal(belowMask.technicallyConnectable, false);
  assert.ok(belowMask.technicalBlockers.includes('BELOW_TERMINAL_TERRAIN_MASK_ANGLE'));
});
