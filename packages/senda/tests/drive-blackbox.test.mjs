import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlackBox, verifyBlackBox, summarizeBlackBox, BLACKBOX_SCHEMA } from '../src/drive-blackbox.mjs';

test('caja negra v2: grabación sin recortes (IMU, RSS, pistas ADAS, radar, sonda BLE, OSINT), cadena SHA-256 íntegra y detección de manipulación', async () => {
  const bb = createBlackBox({ maxFrames: 100 });
  assert.equal(bb.record({ t: 1000 }), null, 'no graba antes de start()');
  bb.start(1_700_000_000_000);

  // Simular 60 s de trayecto con caída de cobertura en t=30 s, radar fijo/tramo, pistas ADAS y sonda BLE
  for (let i = 0; i <= 60; i += 10) {
    bb.record({
      t: 1_700_000_000_000 + i * 1000,
      pos: [-0.3703, 39.4427 - i * 0.0002],
      accuracyM: 6,
      altM: 18.4,
      altAccuracyM: 4.0,
      speedMs: i === 40 ? 15 : 25,
      headingDeg: 180,
      imu: { ax: i === 40 ? -3.2 : 0.1, ay: 0.4, az: 9.81, gx: 0.1, gy: -0.2, gz: 0.05, alpha: 180, beta: 2, gamma: -1 },
      vision: {
        active: true, count: 1, level: i === 40 ? 'AMBAR' : 'VERDE', minTtcS: i === 40 ? 3.8 : null,
        clipped: 0, inferMs: 42.5, hz: 4,
        tracks: [{ id: 1, label: 'car', zone: 'TU_CARRIL', box: { x: 0.4, y: 0.45, w: 0.15, h: 0.14 }, ttcS: i === 40 ? 3.8 : null, lateral: 0.01, level: i === 40 ? 'AMBAR' : 'VERDE', clipped: false, reasons: i === 40 ? ['se acerca (3.8 s)'] : [] }],
      },
      corridor: i >= 20 ? {
        mode: 'CONO', dedupedCount: 1,
        top: { cat: 'ACCIDENTE', road: 'V-31', distM: 1000 - i * 10, urgency: 'AMBAR', source: 'DGT' },
        items: [{ cat: 'ACCIDENTE', road: 'V-31', distM: 1000 - i * 10, urgency: 'AMBAR', source: 'DGT' }],
      } : null,
      radar: i >= 20 ? { items: [{ id: 'dgt-1' }], top: { id: 'dgt-1', kind: 'fixed', road: 'V-31', distM: 450, maxspeed: 100, overLimit: false, src: 'dgt' } } : null,
      section: i >= 40 ? { id: 'madrid-28', avgKmh: 52.4, maxspeed: 50, remainingM: 320, overAverage: true } : null,
      rf: { online: i !== 30, netType: i === 30 ? 'none' : '4g', downlinkMbps: i === 30 ? 0 : 12.5, rttMs: i === 30 ? null : 55 },
      battery: { pct: 80 - (i / 60) * 0.5, charging: false },
      ble: { tx: i >= 20 ? 1 : 0, rx: i >= 50 ? 2 : 0, rejected: 0 },
      bleProbe: { pingsSent: 3, pongsReceived: 2, pingsAnswered: 1, corrupted: 0, responseRate: 0.667, medianRttMs: 38.5, lastRttMs: 41.2 },
      osint: { count: 1, closestKm: 64.2, topType: 'WF', topLevel: 'Orange' },
    });
  }

  const doc = await bb.exportSealed(1_700_000_060_000);
  assert.equal(doc.schema, BLACKBOX_SCHEMA);
  assert.equal(doc.schema, 'senda-drive-blackbox/2');
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
  assert.equal(doc.summary.rawTracksRecorded, 7);
  assert.equal(doc.summary.aiHzMin, 4);
  assert.equal(doc.summary.aiHzMax, 4);
  assert.equal(doc.summary.radarAlertFrames, 5);
  assert.equal(doc.summary.sectionTrackedFrames, 3);
  assert.ok(doc.summary.maxImuG > 1.0);
  assert.equal(doc.summary.bleTxMax, 1);
  assert.equal(doc.summary.bleRxMax, 2);
  assert.equal(doc.summary.bleProbePings, 3);
  assert.equal(doc.summary.bleProbePongs, 2);
  assert.equal(doc.summary.bleProbeMedianRttMs, 38.5);
  assert.ok(doc.frames[0].rss.sameDirStoppedM > 80);
  assert.ok(doc.frames[0].rss.oppDirM > doc.frames[0].rss.sameDirStoppedM);
  assert.equal(doc.frames[0].vision.tracks[0].box.length, 4);
  assert.equal(doc.frames[0].altM, 18.4);

  // Verificación criptográfica intacta
  const ok = await verifyBlackBox(doc);
  assert.equal(ok.ok, true);
  assert.equal(ok.count, 7);

  // Manipulación de un campo v2 (IMU o radar) -> detectada en el índice exacto
  const tampered = structuredClone(doc);
  tampered.frames[3].imu.ax = 0;
  const bad = await verifyBlackBox(tampered);
  assert.equal(bad.ok, false);
  assert.equal(bad.brokenAt, 3);
});

test('caja negra v2: sensores ausentes quedan en null (jamás inventados) y el buffer circular respeta maxFrames', async () => {
  const bb = createBlackBox({ maxFrames: 3 });
  bb.start(1000);
  for (let i = 0; i < 5; i++) bb.record({ t: 1000 + i * 1000 });
  assert.equal(bb.count, 3);
  const doc = await bb.exportSealed(6000);
  assert.equal(doc.summary.batteryStartPct, null);
  assert.equal(doc.summary.batteryDrainPctPerHr, null);
  assert.equal(doc.summary.maxSpeedKmh, null);
  assert.equal(doc.summary.maxImuG, null);
  assert.equal(doc.frames[0].imu, null);
  assert.equal(doc.frames[0].rss, null);
  assert.equal(doc.frames[0].radar, null);
  assert.equal(doc.frames[0].bleProbe, null);
  assert.equal((await verifyBlackBox(doc)).ok, true);
  assert.equal(summarizeBlackBox([]).frames, 0);
});

