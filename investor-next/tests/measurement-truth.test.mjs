import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveOrbitalEphemeris } from '../lib/live-protocol-node.mjs';
import { runThroughWallRfRadar } from '../lib/telecom-suite.mjs';

test('without RF hardware there are no inferred emitters, persons, CSI bins or confidence scores', () => {
  const result = runThroughWallRfRadar();
  assert.equal(result.engineeringStatus, 'HARDWARE_REQUIRED');
  assert.deepEqual(result.targets, []);
  assert.deepEqual(result.csiSubcarriers, []);
  assert.equal(result.detectedCount, 0);
});

test('RF demonstration is opt-in, labelled synthetic and never identifies people', () => {
  const result = runThroughWallRfRadar({ mode: 'DEMO' });
  assert.equal(result.evidence, 'SIMULATED');
  assert.equal(result.engineeringStatus, 'DEMO_ONLY');
  for (const target of result.targets) {
    assert.ok(!/human|person|respiration|SOS|battery/i.test(target.label));
    assert.equal(target.hasHumanMicroDoppler, false);
    assert.equal(target.confidencePct, null);
  }
});

test('orbital illustrations explicitly lack observational elements and do not move with the observer', () => {
  const now = 1792569600000;
  const a = computeLiveOrbitalEphemeris(now, 39, -0.3);
  const b = computeLiveOrbitalEphemeris(now, -35, 110);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].evidence, 'SIMULATED');
    assert.equal(a[i].status, 'DEMO_ONLY');
    assert.equal(a[i].uncertainty, 'UNKNOWN');
    assert.equal(a[i].orbitalElementsEpoch, null);
    assert.equal(a[i].subLatDeg, b[i].subLatDeg);
    assert.equal(a[i].subLonDeg, b[i].subLonDeg);
  }
});
