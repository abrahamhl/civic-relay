import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBD_PIDS,
  decodeObdPid,
  analyzeObdKinematics,
  TMC_EVENT_CODES,
  encodeRdsTmcGroup8A,
  encodeRdsDisplayText,
  encodeDabPlusEwf,
  AUTOMOTIVE_SAFETY_PROFILES,
  computeAutomotiveCockpitState,
  decodeV16BeaconTelemetry,
  generateV2xCamMessage,
  generateV2xDenmMessage,
  AutomotiveMultisoftwareGateway,
} from '../src/automotive-multisoftware-link.mjs';
import { HAZARD } from '../src/road-guard.mjs';

test('OBD-II & CAN Bus: decodificación precisa de PIDs SAE J1979 en bytes y hex', () => {
  // Velocidad (PID 0x0D): 75 km/h
  const speed = decodeObdPid(OBD_PIDS.VEHICLE_SPEED, [75]);
  assert.equal(speed.name, 'VEHICLE_SPEED');
  assert.equal(speed.value, 75);
  assert.equal(speed.unit, 'km/h');

  // RPM (PID 0x0C): 26, 248 -> (256 * 26 + 248) / 4 = 1726 rpm
  const rpm = decodeObdPid(OBD_PIDS.ENGINE_RPM, [26, 248]);
  assert.equal(rpm.name, 'ENGINE_RPM');
  assert.equal(rpm.value, 1726);
  assert.equal(rpm.unit, 'rpm');

  // Acelerador (PID 0x11): 128 -> (128 * 100) / 255 = 50.2%
  const throttle = decodeObdPid(OBD_PIDS.THROTTLE_POSITION, [128]);
  assert.equal(throttle.name, 'THROTTLE_POSITION');
  assert.ok(Math.abs(throttle.value - 50.2) < 0.2);
  assert.equal(throttle.unit, '%');

  // Barómetro (PID 0x33): 101 kPa
  const baro = decodeObdPid(OBD_PIDS.BAROMETRIC_PRESSURE, [101]);
  assert.equal(baro.value, 101);
  assert.equal(baro.unit, 'kPa');

  // Temperatura ambiente (PID 0x46): 65 -> 65 - 40 = 25 °C
  const temp = decodeObdPid(OBD_PIDS.AMBIENT_AIR_TEMP, [65]);
  assert.equal(temp.value, 25);
  assert.equal(temp.unit, '°C');

  // Cadena hex ELM327 '41 0D 5A' -> 90 km/h
  const elmSpeed = decodeObdPid(OBD_PIDS.VEHICLE_SPEED, '41 0D 5A');
  assert.equal(elmSpeed.value, 90);
});

test('OBD-II Cinemática: detección de frenada de emergencia asistida por CAN y umbrales de colisión', () => {
  // Conducción suave: deceleración leve
  const gentleDrive = [
    { tSec: 0.0, speedKmh: 100, throttlePct: 35 },
    { tSec: 1.0, speedKmh: 95, throttlePct: 15 },
  ];
  const gentleResult = analyzeObdKinematics(gentleDrive);
  assert.equal(gentleResult.isEmergencyBraking, false);
  assert.ok(gentleResult.decelMs2 < 2.0);

  // Frenada de emergencia masiva: de 120 km/h a 30 km/h en 1.8 s (decel ≈ 13.9 m/s²)
  const hardBrake = [
    { tSec: 0.0, speedKmh: 120, throttlePct: 40 },
    { tSec: 1.8, speedKmh: 30, throttlePct: 0 },
  ];
  const hardResult = analyzeObdKinematics(hardBrake);
  assert.equal(hardResult.isEmergencyBraking, true);
  assert.ok(hardResult.decelMs2 >= 12.0);
  assert.equal(hardResult.hazardType, HAZARD.CRASH);
  assert.ok(hardResult.confidence >= 0.9);
});

test('Radios de Coche RDS/TMC: codificación de grupo 8A y textos PS/RT con banderas TA/TP', () => {
  // Grupo RDS 8A para accidente con múltiples vehículos en PK 4210
  const tmc = encodeRdsTmcGroup8A(TMC_EVENT_CODES.MULTI_VEHICLE_ACCIDENT, 4210, 0, 2);
  assert.equal(tmc.blockA, 0xe201); // PI Code de radiodifusión
  assert.equal(typeof tmc.blockB, 'number');
  assert.equal(typeof tmc.blockC, 'number');
  assert.equal(tmc.blockD, 4210); // Ubicación TMC
  assert.match(tmc.hexString, /^E201 [0-9A-F]{4} [0-9A-F]{4} 1072$/);

  // Texto de pantalla RDS (PS 8 caracteres y RT 64 caracteres)
  const rdsText = encodeRdsDisplayText('FRENA!', 'ALERTA SENDA: FRENADA EN CADENA EN AUTOVIA A-3 KM 42', true);
  assert.equal(rdsText.programServicePs, 'FRENA!  ');
  assert.equal(rdsText.programServicePs.length, 8);
  assert.ok(rdsText.radioTextRt.startsWith('ALERTA SENDA: FRENADA EN CADENA'));
  assert.equal(rdsText.radioTextRt.length, 64);
  assert.equal(rdsText.trafficAnnouncementTa, true, 'Debe activar interrupción sonora TA');
  assert.equal(rdsText.trafficProgramTp, true);
});

test('DAB+ EWF: estructura de alerta de protección civil de conmutación forzada', () => {
  const ewf = encodeDabPlusEwf(9912, 'ALERTA INUNDACION BARRANCO DEL POYO. EVACUAR VADOS INMEDIATAMENTE', {
    lat: 39.4699,
    lon: -0.3763,
    radiusKm: 15.0,
  });
  assert.equal(ewf.standard, 'ETSI_TS_104_090_DAB_EWF');
  assert.equal(ewf.alarmFlag, true);
  assert.equal(ewf.emergencyId, 9912);
  assert.equal(ewf.audioReconfigurationTrigger, true);
  assert.equal(ewf.targetZone.radiusKm, 15.0);
});

test('Pantallas Android Automotive (AAOS): reglas NHTSA contra distracción del conductor y modo nocturno HUD', () => {
  // Coche detenido (0 km/h): permite interacción completa
  const stoppedState = computeAutomotiveCockpitState(0, false, null);
  assert.equal(stoppedState.isMoving, false);
  assert.equal(stoppedState.driverDistractionRulesEnforced, false);
  assert.equal(stoppedState.minTouchTargetPx, 48);
  assert.equal(stoppedState.allowComplexInput, true);

  // Coche en autopista (110 km/h) con alerta vial activa de noche
  const hazard = {
    title: 'Frenada en cadena',
    distanceM: 350,
    advice: 'Reduzca a 60 km/h',
    severity: 'CRITICAL',
  };
  const highwayState = computeAutomotiveCockpitState(110, true, hazard);
  assert.equal(highwayState.isMoving, true);
  assert.equal(highwayState.driverDistractionRulesEnforced, true);
  assert.equal(highwayState.minTouchTargetPx, 72, 'Debe exigir touch target grande de 72px');
  assert.equal(highwayState.allowComplexInput, false, 'Prohibido introducir texto en marcha');

  // Paleta ergonómica nocturna
  assert.equal(highwayState.theme.background, '#000000', 'Fondo negro OLED puro');
  assert.equal(highwayState.theme.accentColor, '#FF2A2A', 'Acento rojo de peligro');

  // Síntesis de voz para cabina
  assert.ok(highwayState.speechAnnouncement.includes('Frenada en cadena en 350 metros'));
  assert.ok(highwayState.speechAnnouncement.includes('Reduzca a 60 km/h'));
});

test('Balizas V16 Conectadas (DGT 3.0): decodificación y georreferenciación de avería', () => {
  const rawV16 = {
    beaconId: 'V16-ESP-2026-9941',
    latitude: 39.4699,
    longitude: -0.3763,
    active: true,
    batteryPct: 88,
    timestampUtc: '2026-11-09T13:00:00.000Z',
  };
  const v16 = decodeV16BeaconTelemetry(rawV16);
  assert.equal(v16.beaconId, 'V16-ESP-2026-9941');
  assert.equal(v16.lat, 39.4699);
  assert.equal(v16.lon, -0.3763);
  assert.equal(v16.status, 'ACTIVE_FLASHING_ON_ROAD');
  assert.equal(v16.batteryPct, 88);

  // Rechazo de coordenadas imposibles
  assert.throws(() => decodeV16BeaconTelemetry({ lat: 195, lon: 0 }), /fuera de rango/);
});

test('Mensajes V2X Cooperativos: generación de tramas ETSI CAM y DENM de aviso entre vehículos', () => {
  // Mensaje CAM periódico
  const cam = generateV2xCamMessage({
    stationId: 0x99aaff11,
    lat: 40.4168,
    lon: -3.7038,
    speedKmh: 120,
    headingDeg: 90,
    decelMs2: 5.5,
  });
  assert.equal(cam.standard, 'ETSI_EN_302_637_2_CAM');
  assert.equal(cam.basicContainer.stationType, 5);
  assert.equal(cam.highFrequencyContainer.speedMs, 33.3);
  assert.equal(cam.highFrequencyContainer.longitudinalAccelerationMs2, -5.5);

  // Mensaje DENM de frenada de emergencia electrónica (EEBL)
  const denm = generateV2xDenmMessage({
    stationId: 0x99aaff11,
    actionId: 42,
    causeCode: 1, // Braking event
    lat: 40.4168,
    lon: -3.7038,
    relevanceDistanceM: 800,
  });
  assert.equal(denm.standard, 'ETSI_EN_302_637_3_DENM');
  assert.equal(denm.managementContainer.relevanceDistanceM, 800);
  assert.equal(denm.managementContainer.relevanceTrafficDirection, 'UPSTREAM_SAME_DIRECTION');
  assert.equal(denm.situationContainer.eventType.causeCode, 1);
});

test('AutomotiveMultisoftwareGateway: orquestación simultánea de OBD, RDS, Pantalla Android y V2X', () => {
  const gateway = new AutomotiveMultisoftwareGateway({ vehicleId: 'TEST-CAR-01' });

  // 1. Inyección de telemetría OBD-II con frenada severa
  const obdPoints = [
    { tSec: 0.0, speedKmh: 110, throttlePct: 30 },
    { tSec: 1.5, speedKmh: 20, throttlePct: 0 },
  ];
  const { triggeredHazard, analysis } = gateway.processObdInput(obdPoints);
  assert.ok(triggeredHazard != null, 'Debe disparar evento de peligro por deceleración');
  assert.equal(analysis.isEmergencyBraking, true);

  // 2. Despacho coordinado a todos los subsistemas multisoftware
  const outputs = gateway.dispatchMultiSoftwareOutputs({ lat: 40.4168, lon: -3.7038, speedKmh: 20 });
  assert.equal(outputs.vehicleId, 'TEST-CAR-01');

  // Radio RDS
  assert.equal(outputs.carRadioRds.display.trafficAnnouncementTa, true);
  assert.ok(outputs.carRadioRds.display.programServicePs.includes('FRENA'));

  // Pantalla Android Automotive
  assert.equal(outputs.androidCockpit.driverDistractionRulesEnforced, true);
  assert.ok(outputs.androidCockpit.theme.hudGlow !== 'none');
  assert.ok(outputs.androidCockpit.speechAnnouncement.includes('Atención'));

  // V2X
  assert.equal(outputs.v2xTransmission.cam.standard, 'ETSI_EN_302_637_2_CAM');
  assert.equal(outputs.v2xTransmission.denm.standard, 'ETSI_EN_302_637_3_DENM');
});
