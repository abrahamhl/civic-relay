import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePolarPatternResponse,
  computeShotgunInterferenceResponse,
  computeDelayAndSumBeamformingWeights,
  computeAcousticArrayFactor,
  synthesizeAcousticCameraHeatmap,
  computeSentinelGatewayBOM,
  generateUltrasonicRescueBeacon,
  calculateTacticalSurvivalVector,
  POLAR_PATTERNS
} from '../src/acoustic-beamforming-survival.mjs';

test('Patrones polares: Cardioide e Hipercardioide cumplen la teoría electroacústica', () => {
  // On-axis (theta = 0)
  const cardioidOn = computePolarPatternResponse('CARDIOID', 0);
  assert.equal(cardioidOn.linearGain, 1.0);
  assert.equal(cardioidOn.gainDb, 0.0);

  // Cardioide en 180° (cancelación en eje trasero)
  const cardioidBack = computePolarPatternResponse('CARDIOID', Math.PI);
  assert.equal(cardioidBack.linearGain, 0.0);
  assert.ok(cardioidBack.gainDb <= -60.0);

  // Hipercardioide en 180° (rechazo ~6 dB)
  const hyperBack = computePolarPatternResponse('HYPERCARDIOID', Math.PI);
  assert.ok(Math.abs(hyperBack.gainDb - (-6.02)) < 0.2);

  // Hipercardioide tiene el DI más alto (6.02 dB)
  assert.equal(POLAR_PATTERNS.HYPERCARDIOID.diDb, 6.02);
});

test('Micrófono Shotgun (tubo de interferencia): Cancelación de fase fuera del eje', () => {
  const tubeLength = 0.25; // 25 cm
  const freq = 2500; // 2.5 kHz (armónico de rotor UAV)

  // En el eje (theta = 0°) no hay atenuación
  const onAxis = computeShotgunInterferenceResponse(tubeLength, freq, 0);
  assert.equal(onAxis.linearMag, 1.0);
  assert.equal(onAxis.attenuationDb, 0.0);

  // Fuera del eje a 45°
  const offAxis45 = computeShotgunInterferenceResponse(tubeLength, freq, (45 * Math.PI) / 180);
  assert.ok(offAxis45.linearMag < 0.65);
  assert.ok(offAxis45.attenuationDb < -4.0);

  // Fuera del eje a 90° (atenuación severa > 20 dB)
  const offAxis90 = computeShotgunInterferenceResponse(tubeLength, freq, Math.PI / 2);
  assert.ok(offAxis90.linearMag < 0.15);
  assert.ok(offAxis90.attenuationDb < -18.0);
});

test('Delay-and-Sum Beamforming: Factor de array unitario en el apuntamiento y atenuación lateral', () => {
  // Array lineal de 4 micrófonos espaciados 4 cm
  const sensors = [
    { x: -0.06, y: 0, z: 0 },
    { x: -0.02, y: 0, z: 0 },
    { x: 0.02, y: 0, z: 0 },
    { x: 0.06, y: 0, z: 0 }
  ];

  const targetAzRad = (30 * Math.PI) / 180;
  const targetElRad = (20 * Math.PI) / 180;
  const freq = 1500; // 1.5 kHz

  const weights = computeDelayAndSumBeamformingWeights(sensors, targetAzRad, targetElRad);
  assert.equal(weights.delaysS.length, 4);

  // En la dirección objetivo exacta, el factor de array es 1.0 (0 dB)
  const onTarget = computeAcousticArrayFactor(
    sensors,
    targetAzRad,
    targetElRad,
    targetAzRad,
    targetElRad,
    freq
  );
  assert.equal(onTarget.arrayFactorLinear, 1.0);
  assert.equal(onTarget.arrayGainDb, 0.0);

  // En una dirección desviada 90°, el factor de array cae drásticamente
  const offTarget = computeAcousticArrayFactor(
    sensors,
    targetAzRad,
    targetElRad,
    targetAzRad + Math.PI / 2,
    targetElRad,
    freq
  );
  assert.ok(offTarget.arrayFactorLinear < 0.5);
  assert.ok(offTarget.arrayGainDb < -6.0);
});

test('Cámara Acústica 2D: Localización del pico acústico en cuadrícula esférica', () => {
  const sensors = [
    { x: -0.05, y: -0.05, z: 0 },
    { x: 0.05, y: -0.05, z: 0 },
    { x: 0.05, y: 0.05, z: 0 },
    { x: -0.05, y: 0.05, z: 0 }
  ];

  const target = { azimuthDeg: 45, elevationDeg: 30, frequencyHz: 1200 };
  const result = synthesizeAcousticCameraHeatmap(sensors, target, 15);

  assert.ok(result.heatmap.length > 0);
  // El pico detectado debe coincidir con la posición del blanco
  assert.equal(result.peakAzimuthDeg, 45);
  assert.equal(result.peakElevationDeg, 30);
});

test('BOM de Centinela Gateway COTS: Coste acotado inferior a 15 € y multimodalidad', () => {
  const bom = computeSentinelGatewayBOM();
  assert.ok(bom.totalCostEur < bom.targetBudgetLimitEur);
  assert.ok(bom.totalCostEur > 8.0); // Coste real de componentes
  assert.ok(bom.batteryAutonomyHours10Ah > 60.0); // Más de 2 días de autonomía continua

  const hasEsp32 = bom.items.some((i) => i.part.includes('ESP32'));
  const hasMems = bom.items.some((i) => i.part.includes('MEMS'));
  const hasRadar = bom.items.some((i) => i.part.includes('Radar'));
  assert.ok(hasEsp32 && hasMems && hasRadar);
});

test('Kit de Supervivencia: Baliza ultrasónica inaudible y cálculo de vector de evasión', () => {
  const coords = { lat: 40.4168, lon: -3.7038, altM: 650 };
  const beacon = generateUltrasonicRescueBeacon(coords, 42);

  assert.equal(beacon.inaudibleHuman, true);
  assert.ok(beacon.centerFreqHz >= 19000);
  assert.ok(beacon.payloadHex.length > 10);

  // Vector de supervivencia
  const civilian = { x: 0, y: 0, z: 0 };
  const drones = [
    { id: 'FPV_HOSTILE_1', x: 40, y: 30, z: 25, speedMs: 20 }
  ];

  const survival = calculateTacticalSurvivalVector(civilian, drones);
  assert.equal(survival.threatLevel, 'CRITICAL'); // Menor a 80 m
  assert.ok(survival.nearestDroneDistanceM < 60);
  assert.ok(survival.timeToInterceptS < 5.0);
  // Azimut de evasión debe apuntar en dirección opuesta (aprox 216.9°)
  assert.ok(survival.recommendedEvasionAzimuthDeg > 180);
});
