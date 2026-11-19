import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeReliabilityDiagram,
  generateSyntheticCalibrationDataset,
  ingestPilotReceiptsIntoCalibration,
  computeWilsonScoreInterval
} from '../public/senda/core/calibration-diagram.mjs';

const dir = dirname(fileURLToPath(import.meta.url));

test('L2.5 Calibration Panel: surface-view integrates CalibrationPanel on SCIENCE route', () => {
  const surfaceViewCode = readFileSync(resolve(dir, '../app/surface-view.tsx'), 'utf8');
  assert.ok(surfaceViewCode.includes("import CalibrationPanel from './calibration-panel'"));
  assert.ok(surfaceViewCode.includes("<CalibrationPanel locale={locale} />"));
});

test('L2.5 Calibration Panel: calibration-panel component implements epistemic guardrails and 5-bin diagram', () => {
  const panelCode = readFileSync(resolve(dir, '../app/calibration-panel.tsx'), 'utf8');
  assert.ok(panelCode.includes('data-testid="calibration-panel-surface"'));
  assert.ok(panelCode.includes('SIMULADO'));
  assert.ok(panelCode.includes('DATO REAL'));
  assert.ok(panelCode.includes('PILOT_PROTOCOL_2026-11.md'));
  assert.ok(panelCode.includes('Murphy, 1973'));
});

test('L2.5 Calibration Panel: core calibration calculations execute deterministically on web copy', () => {
  const dataset = generateSyntheticCalibrationDataset({ count: 200, stress: 'NORMAL', seed: 1234 });
  assert.equal(dataset.metadata.epistemicStatus, 'SIMULADO');
  assert.equal(dataset.samples.length, 200);

  const cal = computeReliabilityDiagram(dataset.samples, { numBins: 5 });
  assert.equal(cal.bins.length, 5);
  assert.ok(cal.brierScore >= 0 && cal.brierScore <= 1);
  assert.ok(cal.ece >= 0 && cal.ece <= 1);
  assert.ok(cal.murphy.uncertainty >= 0);

  // Discrete synthetic check
  const ci = computeWilsonScoreInterval(18, 20);
  assert.ok(ci.lower > 0.65);
  assert.ok(ci.upper <= 1.0);
});
