import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interlockingConflictWatch,
  thermalTrackBucklingWatch,
  guidedWaveRailCrackDetector,
  levelCrossingActiveGuard,
  buildRailEmergencyBeacon,
  verifyRailEmergencyBeacon,
  RAIL_60E1_IZ_LATERAL_M4,
  STEEL_GUIDED_WAVE_GROUP_VELOCITY_MS
} from '../src/rail-advanced-safety.mjs';

test('interlockingConflictWatch: Patrón Tempi — dos trenes en vía única en sentidos opuestos disparan aviso de emergencia T2T y distancia combinada', () => {
  const blocks = new Map([
    ['CANTON-101', { id: 'CANTON-101', fromPk: 10000, toPk: 25000, singleTrack: true, nextSignal: 'STOP' }]
  ]);

  const trains = [
    { id: 'INTERCITY-62', pk: 11000, speedKmh: 140, headingDeg: 45, currentBlockId: 'CANTON-101', nextBlockId: 'CANTON-101' },
    { id: 'MERCANTE-805', pk: 24000, speedKmh: 90, headingDeg: 225, currentBlockId: 'CANTON-101', nextBlockId: 'CANTON-101' }
  ];

  const result = interlockingConflictWatch(trains, blocks);
  assert.equal(result.safe, false);
  assert.equal(result.hazards.length, 1);

  const h = result.hazards[0];
  assert.equal(h.type, 'HEAD_ON_COLLISION_RISK');
  assert.equal(h.severity, 'IMMINENT_CRASH');
  assert.equal(h.verdict, 'PROPUESTA_AVISO_FRENADO_EMERGENCIA_T2T');
  assert.equal(h.distanceM, 13000);
  assert.ok(h.combinedStoppingDistanceM > 500);
  assert.ok(h.functionalSafetyNotice.includes('SIL-4'));
  assert.ok(h.ttcSec > 180 && h.ttcSec < 220);
});

test('interlockingConflictWatch: Colisión por alcance — tren posterior más rápido acercándose en el mismo cantón', () => {
  const blocks = new Map([
    ['CANTON-202', { id: 'CANTON-202', fromPk: 1000, toPk: 8000, singleTrack: false, nextSignal: 'PROCEED' }]
  ]);

  const trains = [
    { id: 'AVE-101', pk: 2000, speedKmh: 200, headingDeg: 90, currentBlockId: 'CANTON-202', nextBlockId: 'CANTON-202' },
    { id: 'REGIONAL-50', pk: 2500, speedKmh: 80, headingDeg: 90, currentBlockId: 'CANTON-202', nextBlockId: 'CANTON-202' }
  ];

  const result = interlockingConflictWatch(trains, blocks);
  assert.equal(result.safe, false);
  assert.equal(result.hazards.length, 1);
  assert.equal(result.hazards[0].type, 'REAR_END_COLLISION_RISK');
  assert.equal(result.hazards[0].rearTrain, 'AVE-101');
  assert.equal(result.hazards[0].leadTrain, 'REGIONAL-50');
  // relSpeed = (200 - 80) / 3.6 = 33.33 m/s -> dist = 500 m -> TTC = 15 s
  assert.equal(result.hazards[0].ttcSec, 15);
  assert.equal(result.hazards[0].severity, 'IMMINENT_CRASH');
});

test('interlockingConflictWatch: Tren posterior más lento en el mismo sentido no genera riesgo de colisión por alcance', () => {
  const blocks = new Map([
    ['CANTON-202', { id: 'CANTON-202', fromPk: 1000, toPk: 8000, singleTrack: false, nextSignal: 'PROCEED' }]
  ]);

  const trains = [
    { id: 'CERCANIAS-1', pk: 2000, speedKmh: 60, headingDeg: 90, currentBlockId: 'CANTON-202', nextBlockId: 'CANTON-202' },
    { id: 'ALVIA-2', pk: 3000, speedKmh: 140, headingDeg: 90, currentBlockId: 'CANTON-202', nextBlockId: 'CANTON-202' }
  ];

  const result = interlockingConflictWatch(trains, blocks);
  assert.equal(result.safe, true);
  assert.equal(result.hazards.length, 0);
});

test('interlockingConflictWatch: Patrón Balasore — aguja en posición inversa discordante con el CTC dispara alarma crítica', () => {
  const blocks = new Map();
  const trains = [];
  const switches = [
    {
      id: 'AGUJA-17A',
      pk: 45200,
      normalBlockId: 'VIA-PRINCIPAL',
      reverseBlockId: 'VIA-APARTADO',
      position: 'REVERSE',
      ctcCommanded: 'NORMAL'
    }
  ];

  const result = interlockingConflictWatch(trains, blocks, switches);
  assert.equal(result.safe, false);
  assert.equal(result.hazards.length, 1);
  assert.equal(result.hazards[0].type, 'SWITCH_DISCREPANCY_RISK');
  assert.equal(result.hazards[0].verdict, 'AGUJA_NO_CONCORDANTE_DETENER_ITINERARIO');
});

test('thermalTrackBucklingWatch: Pandeo térmico — evalúa inercia lateral I_z = 512 cm^4 y degradación por curva CWR-SAFE', () => {
  assert.equal(RAIL_60E1_IZ_LATERAL_M4, 5.12e-6);

  // Vía recta bajo ola de calor: 42°C aire, 950 W/m² radiación solar
  const recta = thermalTrackBucklingWatch({
    ambientTempC: 42,
    solarRadiationWm2: 950,
    windSpeedMs: 1.0,
    neutralTempC: 28,
    ballastResistanceKNm: 6.0,
    initialMisalignmentM: 0.012,
    curveRadiusM: null
  });

  assert.equal(recta.trackGeometry, 'SOLO_VIA_RECTA');
  assert.ok(recta.railTempC > 60);
  assert.ok(recta.stabilityRatio >= 0.85);
  assert.equal(recta.status, 'CRITICAL_BUCKLING_RISK');
  assert.equal(recta.maxSafeSpeedKmh, 30);

  // Misma condición en curva de radio R = 600 m -> CWR-SAFE reduce la fuerza crítica
  const curva = thermalTrackBucklingWatch({
    ambientTempC: 42,
    solarRadiationWm2: 950,
    windSpeedMs: 1.0,
    neutralTempC: 28,
    ballastResistanceKNm: 6.0,
    initialMisalignmentM: 0.012,
    curveRadiusM: 600
  });

  assert.equal(curva.trackGeometry, 'VIA_CURVA_R_600M');
  assert.ok(curva.criticalBucklingForceKN < recta.criticalBucklingForceKN, 'La curva debe degradar la carga crítica');
  assert.ok(curva.stabilityRatio > recta.stabilityRatio, 'La curva debe elevar la razón de inestabilidad');
});

test('guidedWaveRailCrackDetector: Detección acústica guiada — velocidad de grupo 5100 m/s y advertencia sobre PZT en aire', () => {
  assert.equal(STEEL_GUIDED_WAVE_GROUP_VELOCITY_MS, 5100);

  const signal = [
    { tSec: 0.001, amp: 1.0 },
    { tSec: 0.200, amp: 0.85 } // Eco a 0.2 s -> d = (5100 * 0.2) / 2 = 510 m
  ];

  const res = guidedWaveRailCrackDetector(signal, { pulseOriginPk: 10000 });
  assert.equal(res.detected, true);
  assert.equal(res.distanceM, 510);
  assert.equal(res.estimatedPk, 10510);
  assert.equal(res.severity, 'FULL_RAIL_BREAK');
  assert.ok(res.physicalBounds.airPztWarning.includes('desajuste de impedancia'));
  assert.equal(res.physicalBounds.maxReliableRangeM, 1200);
});

test('levelCrossingActiveGuard: C-ITS Tren-Vehículo — emite aviso ITS-G5 5.9 GHz simulado y calcula frenada', () => {
  const res = levelCrossingActiveGuard({
    trainSpeedKmh: 120,
    trainDistanceToPnM: 1200,
    carTrappedOnCrossing: true,
    emergencyDecelMs2: 1.3,
    driverReactionSec: 1.5
  });

  assert.equal(res.canStopBeforePn, true);
  assert.equal(res.collisionAvoidable, true);
  assert.equal(res.trainAction, 'EMERGENCY_BRAKE');
  assert.ok(res.warningToCars.includes('ITS-G5 5.9 GHz'));
  assert.ok(res.channelNotice.includes('38 ms'));
});

test('buildRailEmergencyBeacon y verifyRailEmergencyBeacon: trama autenticada de 28 bytes con HMAC-4, anti-replay y LoRa duty cycle', () => {
  const sharedKey = 'SECRET-RAIL-KEY-TEST-2026';

  const beacon = buildRailEmergencyBeacon({
    trainId: 'ALVIA-04155',
    pk: 35200,
    lat: 38.01234,
    lon: -4.56789,
    trappedCount: 8,
    severeCount: 14,
    seq: 105,
    sharedKey,
    trackObstructed: true
  });

  // Trama exacta de 28 bytes = 56 caracteres hexadecimales
  assert.equal(beacon.byteLength, 28);
  assert.equal(beacon.rawHex.length, 56);
  assert.ok(beacon.rawHex.startsWith('AA'));

  // LoRa Duty cycle normativo (ETSI EN 300 220-1)
  assert.equal(beacon.loraDutyCycle.maxDutyCyclePct, 1.0);
  assert.equal(beacon.loraDutyCycle.minIntervalBetweenBurstsSec, 132);

  // Verificación exitosa de trama auténtica
  const ver1 = verifyRailEmergencyBeacon(beacon.rawHex, sharedKey, 100);
  assert.equal(ver1.valid, true);
  assert.equal(ver1.seq, 105);

  // Rechazo de replay attack (seq 105 <= lastSeenSeq 105)
  const verReplay = verifyRailEmergencyBeacon(beacon.rawHex, sharedKey, 105);
  assert.equal(verReplay.valid, false);
  assert.equal(verReplay.reason, 'REPLAY_ATTACK_DETECTED');

  // Rechazo por manipulación de payload (falsificación)
  const tamperedHex = beacon.rawHex.slice(0, 10) + 'FF' + beacon.rawHex.slice(12);
  const verTampered = verifyRailEmergencyBeacon(tamperedHex, sharedKey, 100);
  assert.equal(verTampered.valid, false);
});
