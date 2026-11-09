import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interlockingConflictWatch,
  thermalTrackBucklingWatch,
  guidedWaveRailCrackDetector,
  levelCrossingActiveGuard,
  buildRailEmergencyBeacon
} from '../src/rail-advanced-safety.mjs';

test('interlockingConflictWatch: Patrón Tempi — dos trenes en vía única en sentidos opuestos disparan colisión inminente y orden de frenado T2T', () => {
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
  assert.equal(h.verdict, 'ORDEN_FRENADO_EMERGENCIA_AUTOMATICO_T2T');
  assert.equal(h.distanceM, 13000);
  // (140 + 90) / 3.6 = 63.88 m/s -> 13000 / 63.88 = ~203 s
  assert.ok(h.ttcSec > 180 && h.ttcSec < 220);
});

test('interlockingConflictWatch: Patrón Balasore — aguja en posición inversa discordante con el CTC dispara alarma crítica de desvío', () => {
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

test('thermalTrackBucklingWatch: Pandeo térmico de vía — ola de calor estival y fuerte radiación solar disparan riesgo crítico y limitación de velocidad', () => {
  // Simulación ola de calor: 42°C aire, 950 W/m² radiación solar, viento bajo
  const res = thermalTrackBucklingWatch({
    ambientTempC: 42,
    solarRadiationWm2: 950,
    windSpeedMs: 1.0,
    neutralTempC: 28,
    ballastResistanceKNm: 6.0, // banqueta descompactada
    initialMisalignmentM: 0.012
  });

  assert.ok(res.railTempC > 60, `Temperatura de carril ${res.railTempC} debe superar 60°C`);
  assert.ok(res.axialForceKN > 1000, `Fuerza axial ${res.axialForceKN} kN debe ser de compresión severa`);
  assert.ok(res.stabilityRatio >= 0.85, `Razón de estabilidad ${res.stabilityRatio} debe entrar en riesgo crítico`);
  assert.equal(res.status, 'CRITICAL_BUCKLING_RISK');
  assert.equal(res.maxSafeSpeedKmh, 30);
});

test('thermalTrackBucklingWatch: Condiciones templadas y balasto compactado mantienen la vía en estado SAFE', () => {
  const res = thermalTrackBucklingWatch({
    ambientTempC: 22,
    solarRadiationWm2: 300,
    windSpeedMs: 3.0,
    neutralTempC: 28,
    ballastResistanceKNm: 11.0,
    initialMisalignmentM: 0.005
  });

  assert.ok(res.railTempC < 35);
  assert.ok(res.stabilityRatio < 0.65);
  assert.equal(res.status, 'SAFE');
  assert.equal(res.maxSafeSpeedKmh, 300);
});

test('guidedWaveRailCrackDetector: Detección acústica guiada en carril — eco a 0.98 s localiza fractura completa a ~2.5 km', () => {
  // Pulso acústico a 5100 m/s: eco a 0.98 s -> d = (5100 * 0.98) / 2 = 2499 m
  const signal = [
    { tSec: 0.001, amp: 1.0 }, // Pulso de emisión inicial
    { tSec: 0.400, amp: 0.04 }, // Ruido de rodadura
    { tSec: 0.980, amp: 0.85 }, // Eco fuerte de carril quebrado
    { tSec: 1.200, amp: 0.02 }
  ];

  const res = guidedWaveRailCrackDetector(signal, { pulseOriginPk: 20000 });
  assert.equal(res.detected, true);
  assert.equal(res.severity, 'FULL_RAIL_BREAK');
  assert.equal(res.verdict, 'ROTURA_TOTAL_CARRIL_ALERTA_CRITICA');
  assert.equal(res.distanceM, 2499);
  assert.equal(res.estimatedPk, 22499);
});

test('levelCrossingActiveGuard: C-ITS Tren-Vehículo — coche atrapado en PN con distancia suficiente permite frenada y evita choque', () => {
  // Tren a 120 km/h a 1.200 m de paso a nivel con coche calado en vía
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
  assert.ok(res.trainBrakingDistanceM < 600, `Distancia de frenado ${res.trainBrakingDistanceM} m debe ser < 600 m`);
  assert.ok(res.warningToCars.includes('PROHIBIDO EL CRUCE'));
});

test('levelCrossingActiveGuard: C-ITS Tren-Vehículo — tren sin distancia de frenado advierte colisión inminente', () => {
  // Tren a 140 km/h a solo 150 m del paso a nivel
  const res = levelCrossingActiveGuard({
    trainSpeedKmh: 140,
    trainDistanceToPnM: 150,
    carTrappedOnCrossing: true
  });

  assert.equal(res.canStopBeforePn, false);
  assert.equal(res.collisionAvoidable, false);
});

test('buildRailEmergencyBeacon: genera baliza compacta hexadecimal de 20 bytes con canales BLE, LoRa y Ultrasonido', () => {
  const beacon = buildRailEmergencyBeacon({
    trainId: 'ALVIA-04155',
    pk: 35200,
    lat: 38.01234,
    lon: -4.56789,
    trappedCount: 8,
    severeCount: 14,
    trackObstructed: true
  });

  assert.ok(beacon.rawHex.startsWith('AA')); // Magic header
  assert.ok(beacon.channels.includes('BLE_CITS_V16'));
  assert.ok(beacon.channels.includes('LORA_868MHZ'));
  assert.ok(beacon.channels.includes('RAIL_ULTRASOUND_19KHZ'));
  assert.equal(beacon.jsonSummary.protocol, 'OEP-RAIL-v1');
});
