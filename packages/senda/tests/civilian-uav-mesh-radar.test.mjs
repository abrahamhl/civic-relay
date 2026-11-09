import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBladePassingFrequency,
  computeTheoreticalTdoa,
  triangulateUavFromMeshTdoa,
  detectFiberOpticSilentDrone,
  generatePhantomUavDecoys,
  computeOpticalCameraDisruptionParams,
} from '../src/civilian-uav-mesh-radar.mjs';

test('Firma Acústica de Rotores: cálculo exacto de BPF y armónicos', () => {
  const bpf = computeBladePassingFrequency(5400, 3);
  assert.equal(bpf.fundamentalBpfHz, 270, 'Para 5400 RPM y 3 palas la fundamental debe ser 270 Hz');
  assert.equal(bpf.harmonics.length, 4, 'Deben computarse 4 armónicos');
  assert.equal(bpf.harmonics[1].freqHz, 540, 'El segundo armónico debe ser 540 Hz');
  assert.equal(bpf.harmonics[2].freqHz, 810, 'El tercer armónico debe ser 810 Hz');
});

test('Triangulación TDoA por Malla Ciudadana: recuperación de coordenadas de dron', () => {
  // 4 teléfonos móviles distribuidos en una manzana urbana
  const sensors = [
    { id: 'phone-1', x: 0, y: 0, z: 2 },
    { id: 'phone-2', x: 120, y: 0, z: 5 },
    { id: 'phone-3', x: 120, y: 120, z: 12 },
    { id: 'phone-4', x: 0, y: 120, z: 8 },
  ];

  // Posición real del dron hostil que sobrevuela la zona
  const realUavPos = { x: 45, y: 65, z: 35 };

  // Generación de retardos TDoA teóricos
  const pairs = [
    ['phone-1', 'phone-2'],
    ['phone-2', 'phone-3'],
    ['phone-3', 'phone-4'],
    ['phone-4', 'phone-1'],
  ];

  const measurements = pairs.map(([idA, idB]) => {
    const sA = sensors.find((s) => s.id === idA);
    const sB = sensors.find((s) => s.id === idB);
    const delay = computeTheoreticalTdoa(sA, sB, realUavPos, 'ACOUSTIC');
    return { sensorAId: idA, sensorBId: idB, tdoaSec: delay };
  });

  const fix = triangulateUavFromMeshTdoa(sensors, measurements, 'ACOUSTIC');

  assert.ok(fix.success, 'La triangulación debe converger con éxito');
  const errX = Math.abs(fix.estimatedPos.xM - realUavPos.x);
  const errY = Math.abs(fix.estimatedPos.yM - realUavPos.y);
  assert.ok(errX < 2.0, `Error en X debe ser submétrico (< 2 m), obtenido: ${errX}`);
  assert.ok(errY < 2.0, `Error en Y debe ser submétrico (< 2 m), obtenido: ${errY}`);
  assert.ok(fix.confidencePct > 80, 'La confianza calculada debe superar el 80%');
});

test('Detección de Drones Guiados por Fibra Óptica (Silencio de Radio)', () => {
  // Dron hostil con bobina de fibra óptica (emisión RF = 0, pero sonido mecánico + perturbación Wi-Fi CSI)
  const silentDroneDetected = detectFiberOpticSilentDrone(
    { rotorPeakDetected: true, measuredBpfHz: 270, acousticSnrDb: 6.5 },
    { csiVarianceRatio: 3.1, dopplerShiftDetected: true, estimatedSpeedMps: 14 }
  );

  assert.equal(silentDroneDetected.detected, true, 'El dron de fibra óptica debe ser detectado por fusión acústica y CSI');
  assert.equal(silentDroneDetected.threatClassification, 'DRON_SILENCIOSO_FIBRA_OPTICA_O_AUTONOMO');
  assert.ok(silentDroneDetected.confidenceScore >= 0.8, 'Confianza alta con ambas fuentes corroboradas');

  // Caso negativo: ruido ambiental estático sin rotores
  const normalEnvironment = detectFiberOpticSilentDrone(
    { rotorPeakDetected: false, measuredBpfHz: 0, acousticSnrDb: -2.0 },
    { csiVarianceRatio: 1.1, dopplerShiftDetected: false, estimatedSpeedMps: 0 }
  );
  assert.equal(normalEnvironment.detected, false, 'El entorno normal sin firmas no debe disparar falsa alarma');
});

test('Generación de Señuelos Virtuales ASTM F3411 y Desorientación Óptica', () => {
  const decoys = generatePhantomUavDecoys(8, { lat: 39.4699, lon: -0.3763, altM: 45 }, 250, 5.0);
  assert.equal(decoys.length, 8, 'Deben generarse exactamente 8 blancos señuelo');
  assert.ok(decoys[0].uasId.startsWith('SENDA-DECOY'), 'Formato compatible Open Drone ID');
  assert.ok(decoys[0].speedMps > 5 && decoys[0].speedMps < 25, 'Velocidades de vuelo realistas');

  const optical = computeOpticalCameraDisruptionParams(60, 0.001);
  assert.ok(optical.primaryStrobeFreqHz > 100, 'Frecuencia estroboscópica anti-obturador activa');
  assert.equal(optical.civilianSafetyRating, 'SEGURO_NO_LASER_SIN_RIESGO_OCULAR');
});
