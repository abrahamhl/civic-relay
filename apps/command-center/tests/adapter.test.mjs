import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROVENANCE,
  adaptRegistry,
  assertProvenanceSeparation,
  buildEvidenceBundle,
  buildSimulationScenario,
  getRfCapabilities,
} from '../src/data/adapter.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshot = path.resolve(here, '..', 'src', 'data', 'snapshot');

async function loadJson(name) {
  return JSON.parse(await readFile(path.join(snapshot, name), 'utf8'));
}

const [registry, tfl, caltrans, estado, manifest] = await Promise.all([
  loadJson('source-registry.json'),
  loadJson('tfl-cameras.json'),
  loadJson('caltrans-corridors.json'),
  loadJson('estado.json'),
  loadJson('manifest.json'),
]);

const bundle = buildEvidenceBundle({ registry, tfl, caltrans, estado, manifest });

test('snapshot binds every artefact to its committed SHA-256', async () => {
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(snapshot, path.basename(file.snapshotPath)));
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, file.sha256, `${file.id} hash mismatch`);
    assert.equal(bytes.length, file.bytes, `${file.id} byte-length mismatch`);
  }
});

test('real camera counts are exactly the recorded TfL and Caltrans clips', () => {
  assert.equal(tfl.camaras.length, 12);
  assert.equal(caltrans.camaras.length, 13);
  assert.equal(bundle.cameras.length, 25);
  assert.equal(bundle.cameraGroups.length, 2);
});

test('every bundled camera is model-derived from real input, never a real calibrated measurement', () => {
  for (const camera of bundle.cameras) {
    assert.equal(camera.provenance, PROVENANCE.MODEL_DERIVED_REAL_INPUT);
    assert.equal(camera.calibration.pose, 'NOT_AVAILABLE');
    assert.equal(camera.calibration.homography, 'NOT_AVAILABLE');
    assert.equal(camera.videoPermission, 'NOT_GRANTED');
  }
});

test('no SIMULATOR value leaks into the observation model', () => {
  const separation = assertProvenanceSeparation(bundle);
  assert.equal(separation.ok, true);
  assert.equal(separation.simulationProvenance, PROVENANCE.SIMULATOR);
  for (const camera of bundle.cameras) {
    assert.notEqual(camera.provenance, PROVENANCE.SIMULATOR);
  }
  for (const event of bundle.timeline) {
    assert.notEqual(event.provenance, PROVENANCE.SIMULATOR);
  }
});

test('a missing metric is MISSING_DATA with a null value, never an invented zero', () => {
  const tflCamera = bundle.cameras.find((c) => c.dataset === 'tfl');
  const speed = tflCamera.metrics.find((m) => m.key === 'velMedianaMovKmh');
  if (speed) {
    assert.equal(speed.value, null);
    assert.equal(speed.provenance, PROVENANCE.MISSING_DATA);
  }
  const outOfService = bundle.cameras.find((c) => c.status === 'OUT_OF_SERVICE');
  assert.ok(outOfService, 'expected at least one operator-reported out-of-service camera');
  const flow = outOfService.metrics.find((m) => m.key === 'flujoVehH');
  if (flow && flow.value === null) {
    assert.equal(flow.provenance, PROVENANCE.MISSING_DATA);
  }
});

test('historical fire references are HINDSIGHT_REPLAY and dated apart from the camera', () => {
  const withHistory = bundle.cameras.filter((c) => c.fireHistory.length > 0);
  assert.ok(withHistory.length > 0, 'expected historical fire references');
  for (const camera of withHistory) {
    for (const history of camera.fireHistory) {
      assert.equal(history.provenance, PROVENANCE.HINDSIGHT_REPLAY);
      assert.notEqual(
        history.eventAtUTC.slice(0, 10),
        (camera.observedAtUTC ?? '').slice(0, 10),
        'historical fire and 2026 camera must not share a date',
      );
    }
  }
});

test('registry sources are documentation-only and never claim measurement or granted video rights', () => {
  const adapted = adaptRegistry(registry);
  assert.equal(adapted.sources.length, registry.sources.length);
  assert.equal(adapted.counts.grantVideoPermission, 0);
  for (const source of adapted.sources) {
    assert.equal(source.isMeasurement, false);
    assert.notEqual(source.availability, 'LIVE_VERIFIED');
  }
});

test('RF life-sign capabilities fail closed without hardware', () => {
  const caps = getRfCapabilities();
  assert.equal(caps.length, 4);
  const lifeSigns = caps.filter((c) => c.id.includes('life-signs') || c.id.includes('sdr'));
  assert.ok(lifeSigns.length >= 3);
  for (const cap of lifeSigns) {
    assert.equal(cap.status, 'NOT_AVAILABLE_NO_HARDWARE');
    assert.equal(cap.requiresHardware, true);
  }
  const xray = caps.find((c) => c.id === 'xray-architecture');
  assert.equal(xray.status, 'ARCHITECTURE_VIEWER_ONLY');
});

test('simulation is deterministic for a seed and stays in its own namespace', () => {
  const a = buildSimulationScenario({ seconds: 30, intensity: 0.7, seed: 42 });
  const b = buildSimulationScenario({ seconds: 30, intensity: 0.7, seed: 42 });
  assert.deepEqual(a.points, b.points);
  assert.equal(a.provenance, PROVENANCE.SIMULATOR);
  assert.ok(a.id.startsWith('sim:'));
  assert.ok(a.warning.includes('SINTÉTICOS'));
});
