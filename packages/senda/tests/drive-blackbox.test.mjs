import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlackBox, verifyBlackBox, summarizeBlackBox, BLACKBOX_SCHEMA } from '../src/drive-blackbox.mjs';

test('caja negra: grabación, cadena SHA-256 íntegra, privacidad y detección de manipulación', async () => {
  const bb = createBlackBox({ maxFrames: 100 });
  assert.equal(bb.record({ t: 1000 }), null, 'no graba antes de start()');
  bb.start(1_700_000_000_000);

  // Simular 60 s de trayecto con caída de cobertura en el segundo 30 y batería bajando 0,5 %
  for (let i = 0; i <= 60; i += 10) {
    bb.record({
      t: 1_700_000_000_000 + i * 1000,
      pos: [-0.3703, 39.4427 - i * 0.0002],
      accuracyM: 6,
      speedMs: i === 40 ? 15 : 25,
      headingDeg: 180,
      vision: { active: true, count: 1, level: i === 40 ? 'AMBAR' : 'VERDE', minTtcS: i === 40 ? 3.8 : null, clipped: 0, inferMs: 42.5, hz: 4 },
      corridor: i >= 20 ? { mode: 'CONO', dedupedCount: 1, top: { cat: 'ACCIDENTE', road: 'V-31', distM: 1000 - i * 10, urgency: 'AMBAR', source: 'DGT' } } : null,
      rf: { online: i !== 30, netType: i === 30 ? 'none' : '4g', downlinkMbps: i === 30 ? 0 : 12.5, rttMs: i === 30 ? null : 55 },
      battery: { pct: 80 - (i / 60) * 0.5, charging: false },
      ble: { tx: i >= 20 ? 1 : 0, rx: i >= 50 ? 2 : 0, rejected: 0 },
    });
  }

  const doc = await bb.exportSealed(1_700_000_060_000);
  assert.equal(doc.schema, BLACKBOX_SCHEMA);
  assert.deepEqual(doc.privacy, { sharesRawVideo: false, storesFacesOrPlates: false, automaticUpload: false });
  assert.equal(doc.frames.length, 7);
  assert.equal(doc.summary.durationS, 60);
  assert.ok(doc.summary.distanceKm > 1.0 && doc.summary.distanceKm < 2.0);
  assert.equal(doc.summary.offlineTransitions, 1);
  assert.equal(doc.summary.deadZoneSamples, 1);
  assert.equal(doc.summary.deadZones.length, 1);
  assert.equal(doc.summary.batteryDropPct, 0.5);
  assert.equal(doc.summary.batteryDrainPctPerHr, 30);
  assert.equal(doc.summary.adasAmberFrames, 1);
  assert.equal(doc.summary.meanInferMs, 42.5);
  assert.equal(doc.summary.bleTxMax, 1);
  assert.equal(doc.summary.bleRxMax, 2);

  // Verificación criptográfica intacta
  const ok = await verifyBlackBox(doc);
  assert.equal(ok.ok, true);
  assert.equal(ok.count, 7);

  // Manipulación de una velocidad -> detectada en el índice exacto
  const tampered = structuredClone(doc);
  tampered.frames[3].speedMs = 99;
  const bad = await verifyBlackBox(tampered);
  assert.equal(bad.ok, false);
  assert.equal(bad.brokenAt, 3);
});

test('caja negra: sensores ausentes quedan en null (jamás inventados) y el buffer circular respeta maxFrames', async () => {
  const bb = createBlackBox({ maxFrames: 3 });
  bb.start(1000);
  for (let i = 0; i < 5; i++) bb.record({ t: 1000 + i * 1000 });
  assert.equal(bb.count, 3);
  const doc = await bb.exportSealed(6000);
  assert.equal(doc.summary.batteryStartPct, null);
  assert.equal(doc.summary.batteryDrainPctPerHr, null);
  assert.equal(doc.summary.maxSpeedKmh, null);
  assert.equal((await verifyBlackBox(doc)).ok, true);
  assert.equal(summarizeBlackBox([]).frames, 0);
});
