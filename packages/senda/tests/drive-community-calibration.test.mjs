import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_CAR_SIGNALS,
  describeSignalProximity,
  translateCopilotForHumans,
  composeProximityMessage,
  voteCommunitySignal,
  createCalibrationJournal,
} from '../src/drive-community-calibration.mjs';
import {
  createDriveCopilotEngine,
  PUBLISHED_SURFACE_PRESETS,
  PUBLISHED_VEHICLE_PROFILES,
} from '../src/drive-copilot-physics.mjs';
import { decodeDenmCompact, denmToSenda, isDenmCompact } from '../src/cits-denm.mjs';

test('Traductor humano: convierte física de aquaplaning/riada y radio pasiva a lenguaje claro sin jerga', () => {
  assert.equal(describeSignalProximity(-54).band, 'MUY_CERCA');
  assert.equal(describeSignalProximity(-70).band, 'CERCA');
  assert.equal(describeSignalProximity(-84).band, 'LIMITE');
  assert.equal(describeSignalProximity(null).band, 'SIN_SENAL');

  const eng = createDriveCopilotEngine({ voiceCooldownMs: 0 });
  const floodRes = eng.evaluateTick({
    nowMs: 100_000,
    gripInput: {
      speedMs: 54 / 3.6, axMs2: -1.5, ayMs2: 0.2,
      surfaceMu: PUBLISHED_SURFACE_PRESETS.heavy_rain.muLong,
      tirePressureBar: 2.2, standingWaterMm: 6, gradePct: -4, reactionTimeS: 1.5, visibilityM: 80,
    },
    crossingInput: { vehicleClass: PUBLISHED_VEHICLE_PROFILES.sedan.floodClass, waterDepthM: 0.48, waterSpeedMs: 1.4 },
  });

  const human = translateCopilotForHumans({
    copilotResult: floodRes,
    ekfView: { mode: 'DEAD_RECKONING_IMU', sigmaM: 28 },
    radioScan: { wifiN: 18, bleN: 12, sendaNear: 2, bleBestDbm: -62 },
    officialNearbyCount: 3,
  });

  assert.equal(human.tone, 'ROJO');
  assert.match(human.headline, /No cruces/i);
  assert.equal(human.directChannel.activePeers, 2);
  assert.match(human.directChannel.statusLabel, /2 dispositivos SENDA cerca/);
  assert.equal(human.indirectChannel.meshOpportunity, 'ALTA');
  assert.equal(human.indirectChannel.canShareWithoutApp, true);
  assert.match(human.sensorSummary.gps.label, /Sin GPS/);
});

test('Comunicación directa (C-ITS DENM 36 B) e indirecta (sin app) + votación bayesiana comunitaria', () => {
  assert.ok(Object.keys(QUICK_CAR_SIGNALS).length === 6);
  const msg = composeProximityMessage({
    signalId: 'agua',
    pos: { lat: 39.428, lon: -0.418 },
    speedKmh: 72,
    recommendedMaxKmh: 40,
    roadHint: 'CV-400 Paiporta',
    nowMs: 1_764_000_000_000,
  });

  // Canal DIRECTO: exactamente 36 bytes C-ITS DENM válidos y decodificables con CRC-16
  assert.equal(msg.direct.ready, true);
  assert.equal(msg.direct.byteLength, 36);
  const bytes = new Uint8Array(Buffer.from(msg.direct.base64, 'base64'));
  assert.equal(isDenmCompact(bytes), true);
  const decoded = denmToSenda(decodeDenmCompact(bytes));
  assert.ok(Math.abs(decoded.lat - 39.428) < 0.001);
  assert.ok(Math.abs(decoded.lon - (-0.418)) < 0.001);

  // Canal INDIRECTO: claro para personas sin SENDA
  assert.equal(msg.indirect.requiresAppOnReceiver, false);
  assert.match(msg.indirect.shareText, /Agua \/ Balsa/);
  assert.match(msg.indirect.shareText, /112/);
  assert.match(msg.indirect.shareText, /40 km\/h/);

  // Votación comunitaria bayesiana («Sigue ahí» sube confianza, «Ya despejado» baja)
  const up = voteCommunitySignal(msg.communityEntry, 'conf', 1_764_000_010_000);
  const down = voteCommunitySignal(msg.communityEntry, 'neg', 1_764_000_010_000);
  assert.ok(up.confidencePct > down.confidencePct);
  assert.equal(up.confirmations, 2);
  assert.equal(down.negations, 1);
});

test('Diario de calibración comunitaria en 1 toque: progreso honesto y exportación SHA-256 con 0 PII', async () => {
  const cal = createCalibrationJournal();
  assert.equal(cal.getReadinessReport().stage, 'SIN_CALIBRAR');

  cal.recordGroundTruth({ category: 'alert_feedback', value: 'acierto', context: { speedKmh: 84, effectiveMu: 0.35 } });
  cal.recordGroundTruth({ category: 'alert_feedback', value: 'acierto', context: { speedKmh: 78 } });
  cal.recordGroundTruth({ category: 'alert_feedback', value: 'falsa_alarma', context: { speedKmh: 62 } });
  cal.recordGroundTruth({ category: 'road_condition', value: 'balsas', context: { speedKmh: 70, effectiveMu: 0.35 } });
  cal.recordGroundTruth({ category: 'coverage_check', value: 'sin_red', context: { sigmaPosM: 32 } });
  cal.recordGroundTruth({ category: 'drive_mode_truth', value: 'en_coche', context: { speedKmh: 70 } });
  cal.recordGroundTruth({ category: 'ble_encounter', value: 'ok', context: { rssiDbm: -68, rttMs: 42 } });

  const rep = cal.getReadinessReport();
  assert.equal(rep.stage, 'EN_CALIBRACION');
  assert.equal(rep.totalMarks, 7);
  assert.equal(rep.precisionPct, 66.7);
  assert.equal(rep.falseAlarmPct, 33.3);

  const pack = await cal.exportCalibrationPack();
  assert.equal(pack.schema, 'senda.community-calibration-pack/v1');
  assert.equal(pack.bleMedianRttMs, 42);
  assert.match(pack.sha256, /^[a-f0-9]{64}$/);
  for (const forbidden of ['lat', 'lon', 'mac', 'ssid', 'name', 'email']) {
    assert.equal(pack[forbidden], undefined, `el paquete no debe contener ${forbidden}`);
  }

  assert.throws(() => cal.recordGroundTruth({ category: 'alert_feedback', value: 'invalido' }), RangeError);
});
