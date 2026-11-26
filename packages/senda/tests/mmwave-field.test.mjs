import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame } from '../src/mmwave-radar.mjs';
import { buildFieldPackage, verifyFieldPackage, summarizeFieldPackage, FIELD_FORMAT } from '../src/mmwave-field.mjs';

const SETTINGS = { minMm: 100, maxMm: 8000, mergeMm: 1000, gateMm: 900, qMmS2: 1500, rMm: 120, maxMissS: 1.5 };
const b64 = (u8) => Buffer.from(u8).toString('base64');

function session(extra = {}) {
  const raw = []; for (let k = 0; k < 40; k++) raw.push({ tMs: k * 100, b64: b64(encodeFrame([{ xMm: -1500 + k * 75, yMm: 3000, speedCms: -12, resMm: 360 }, { xMm: 1500 - k * 75, yMm: 4000, speedCms: 10, resMm: 360 }])) });
  return {
    session: { basis: 'SIMULATION', startedAtUtc: '2026-11-26T10:00:00Z', endedAtUtc: '2026-11-26T10:00:04Z', timeZone: 'Europe/Madrid', scenario: 'dos personas cruzándose', source: 'prueba' },
    raw, tracks: [], marks: [{ tMs: 1000, label: 'cruce' }], settings: SETTINGS,
    calibration: { rangePairs: [{ measuredMm: 2050, trueMm: 2000 }, { measuredMm: 4100, trueMm: 4000 }], yawPairs: [] }, ...extra,
  };
}

test('paquete de campo: exige base y hora con zona; huellas por parte y global', async () => {
  await assert.rejects(buildFieldPackage({ session: { basis: 'INVENTADO' } }), /basis/);
  await assert.rejects(buildFieldPackage({ session: { basis: 'MEASURED', startedAtUtc: '2026-11-26 10:00', timeZone: 'Europe/Madrid' } }), /zona horaria/);
  const pkg = await buildFieldPackage(session());
  assert.equal(pkg.format, FIELD_FORMAT); assert.match(pkg.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(await verifyFieldPackage(pkg), { ok: true, errors: [] });
  const tampered = structuredClone(pkg); tampered.calibration.rangePairs[0].trueMm = 1990; // alguien «retoca» la cinta métrica
  const v = await verifyFieldPackage(tampered); assert.equal(v.ok, false); assert.match(v.errors.join(' '), /calibration/);
});

test('análisis reproducible: vuelve a pasar los bytes por lector, limpieza y seguimiento', async () => {
  const s = summarizeFieldPackage(await buildFieldPackage(session()));
  assert.equal(s.frames, 40); assert.equal(s.corruptFrames, 0); assert.equal(s.durationS, 3.9); assert.equal(s.frameRateHz, 10);
  assert.equal(s.meanTargetsPerFrame, 2); assert.equal(s.tracksStarted, 2); assert.equal(s.maxSimultaneousTracks, 2);
  assert.equal(s.marks, 1); assert.ok(Math.abs(s.rangeCalibration.scale - 2000 / 2050) < 1e-4);
});
