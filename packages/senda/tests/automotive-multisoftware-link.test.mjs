import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  ROAD_SURFACE_PROFILES,
  computeHornerAquaplaningSpeed,
  evaluateOvertakingClearance,
  tunnelDeadReckoningEKF,
  v16ZeroLatencyReflex,
  computeCalibratedStoppingDistance,
} from '../src/automotive-multisoftware-link.mjs';
import { HAZARD } from '../src/road-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

test('Física de Aquaplaning Horner: cálculo de velocidad crítica y sustentación hidrodinámica', () => {
  // Caso 1: Asfalto casi seco (<0.3 mm)
  const dryResult = computeHornerAquaplaningSpeed(220, 0.1, 8.0, 100);
  assert.equal(dryResult.riskLevel, 'SAFE');
  assert.ok(dryResult.criticalSpeedKmh > 110);

  // Caso 2: Presión normal 220 kPa, película de agua 1.5 mm, neumáticos estándar 8.0 mm
  // v_base = 6.35 * sqrt(220) ≈ 94.2 km/h; con dibujo nuevo v_crit ≈ 108.3 km/h; v_safe ≈ 86.6 km/h
  const wetSafe = computeHornerAquaplaningSpeed(220, 1.5, 8.0, 80);
  assert.ok(Math.abs(wetSafe.criticalSpeedKmh - 108.3) < 2.0); // drenaje favorable
  assert.equal(wetSafe.riskLevel, 'SAFE');

  const wetAdvisory = computeHornerAquaplaningSpeed(220, 1.5, 8.0, 90);
  assert.equal(wetAdvisory.riskLevel, 'ADVISORY');

  // Caso 3: Balsa profunda 6.5 mm con neumático desgastado 3.0 mm (relación > 1.0)
  // Como en CASE-02-V31-AQUAPLANING-SURFACE
  const balsaDanger = computeHornerAquaplaningSpeed(220, 6.5, 3.0, 95);
  assert.ok(balsaDanger.criticalSpeedKmh < 75.0, 'La velocidad crítica debe caer drásticamente');
  assert.equal(balsaDanger.riskLevel, 'CRITICAL_AQUAPLANING');
  assert.ok(balsaDanger.hydrodynamicPressureKpa > 100.0);
  assert.ok(balsaDanger.recommendation.includes('PELIGRO'));

  // Caso 4: Velocidad en zona de transición (ADVISORY)
  const advisory = computeHornerAquaplaningSpeed(220, 3.0, 5.0, 75);
  assert.ok(advisory.riskLevel === 'ADVISORY' || advisory.riskLevel === 'CRITICAL_AQUAPLANING');
});

test('Resolutor de Adelantamiento Opaque Truck: AASHTO Passing Sight Distance y prevención de choque frontal', () => {
  // Caso 1: Hueco amplio (600 m) detrás de camión a 70 km/h, tráfico de frente a 80 km/h
  const safeOvertake = evaluateOvertakingClearance(70, 70, 80, 600, 2.0);
  assert.equal(safeOvertake.isSafe, true);
  assert.equal(safeOvertake.status, 'SAFE');
  assert.ok(safeOvertake.passTimeSec >= 5.0 && safeOvertake.passTimeSec <= 8.0);
  assert.ok(safeOvertake.safetyMarginM > 100.0);
  assert.ok(safeOvertake.criticalAbortPointM > 0);

  // Caso 2: Hueco insuficiente (180 m) con vehículo aproximándose de frente a 90 km/h
  // Peligro inminente de choque frontal
  const dangerousOvertake = evaluateOvertakingClearance(70, 75, 90, 180, 1.8);
  assert.equal(dangerousOvertake.isSafe, false);
  assert.equal(dangerousOvertake.status, 'ABORT_IMMEDIATELY');
  assert.ok(dangerousOvertake.safetyMarginM < 0);
  assert.ok(dangerousOvertake.recommendation.includes('ABORTE MANIOBRA'));

  // Caso 3: Hueco marginal (margen entre 0 y 50 m)
  const marginalOvertake = evaluateOvertakingClearance(70, 65, 70, 380, 2.2);
  assert.ok(['SAFE', 'MARGINAL'].includes(marginalOvertake.status));
});

test('Filtro EKF de Túnel: navegación inercial sin GNSS con restricción geométrica de confinamiento', () => {
  // Polilínea representativa del túnel M-30 (eje norte-sur)
  const tunnelCenterline = [
    { lat: 40.4000, lon: -3.7000 },
    { lat: 40.4020, lon: -3.7000 },
    { lat: 40.4040, lon: -3.7000 },
  ];

  let state = {
    lat: 40.4000,
    lon: -3.7000,
    headingDeg: 0.0, // Rumbo Norte
    alongTrackM: 0,
    crossTrackM: 0,
    errorVarianceM2: 0.5,
  };

  // 10 iteraciones de 0.1 s a 70 km/h (~19.4 m/s) -> ~19.4 m recorridos
  for (let i = 0; i < 10; i++) {
    state = tunnelDeadReckoningEKF(state, 70.0, 0.0, 0.1, tunnelCenterline);
  }

  assert.equal(state.isTunnelConstraintActive, true);
  assert.ok(state.alongTrackM >= 18.0 && state.alongTrackM <= 21.0);
  assert.ok(state.crossTrackM < 1.0, 'Debe mantenerse estrictamente centrado en el tubo del túnel');
  assert.ok(state.estimatedDriftM < 3.0, 'La deriva debe estar contenida por el confinamiento físico');
  assert.ok(state.lat > 40.4001, 'Debe haber avanzado hacia el norte');
});

test('Reflejo Zero-Latency V16: decodificación BLE Coded PHY directa y ventaja frente a la nube DGT 3.0', () => {
  // Trama raw V16 BLE (16 bytes compactos)
  // Company ID: 0x0818, Type: 0x16, Beacon ID: 0x1234, Status: 0x01 (activo), Coords: Perales A-3 PK 42.5
  // Lat: 40.2315 -> packed: round(40.2315 * 100000) + 0x800000 = 4023150 + 8388608 = 12411758 = 0xBD636E
  // Lon: -3.3512 -> packed: round(-3.3512 * 100000) + 0x800000 = -335120 + 8388608 = 8053488 = 0x7AE2F0
  const rawBleBytes = [
    0x08, 0x18, 0x16, 0x12, 0x34, 0x01,
    0xbd, 0x63, 0x6e,
    0x7a, 0xe2, 0xf0,
    0x01, // Causa 1: Vehículo averiado
    0x00, 0x00, 0x00,
  ];

  // Vehículo ego aproximándose a 120 km/h desde 1.5 km de distancia
  const egoGps = {
    lat: 40.2200,
    lon: -3.3512,
    speedKmh: 120.0,
    headingDeg: 0.0, // Rumbo Norte hacia la baliza
  };

  const reflex = v16ZeroLatencyReflex(rawBleBytes, egoGps);
  assert.equal(reflex.beaconId, 'V16-1234');
  assert.equal(reflex.isActive, true);
  assert.equal(reflex.hazardType, 'VEHICULO_AVERIADO_ARCEN');
  assert.ok(reflex.distanceM > 1000 && reflex.distanceM < 1600);
  assert.equal(reflex.isAhead, true);
  assert.ok(reflex.reflexLatencyMs < 50.0, 'Reflejo local ultra-rápido < 50 ms');
  assert.ok(reflex.cloudLatencySavedS >= 100.0, 'Ahorra más de 100 segundos frente a la nube');
  assert.ok(reflex.distanceAdvantageM > 3000, 'Ahorra más de 3 km de avance a ciegas a 120 km/h');
  assert.ok(reflex.humanReactionWindowS > 30.0);
  assert.ok(reflex.audioWarningText.includes('Baliza V16 detectada'));
});

test('Distancia de Parada Calibrada: Norma 3.1-IC Trazado, rozamiento dependiente de velocidad e intervalos al 95%', () => {
  // 120 km/h en SECO (mu0 = 0.78)
  const dryStop = computeCalibratedStoppingDistance(120, 'DRY', 0.0, 8.0, 1.5);
  assert.equal(dryStop.surfaceCondition, 'DRY');
  assert.ok(dryStop.frictionCoeff > 0.55);
  assert.equal(dryStop.perceptionDistanceM, 50.0); // 120 / 3.6 * 1.5 = 50.0 m
  assert.ok(dryStop.brakingDistanceM >= 70.0 && dryStop.brakingDistanceM <= 110.0);
  assert.ok(dryStop.totalStoppingDistanceM > 120.0);
  assert.ok(dryStop.confidenceInterval95[0] < dryStop.totalStoppingDistanceM);
  assert.ok(dryStop.confidenceInterval95[1] > dryStop.totalStoppingDistanceM);

  // 120 km/h en HIELO NEGRO (mu0 = 0.12)
  const iceStop = computeCalibratedStoppingDistance(120, 'BLACK_ICE', 0.0, 8.0, 1.5);
  assert.ok(iceStop.frictionCoeff < 0.15);
  assert.ok(iceStop.brakingDistanceM > 450.0, 'Sobre hielo la distancia de frenado se cuadruplica');
  assert.ok(iceStop.totalStoppingDistanceM > 500.0);

  // Efecto de la pendiente: bajada al 5% (-5%) alarga la frenada
  const downhillStop = computeCalibratedStoppingDistance(100, 'WET', -5.0, 8.0, 1.5);
  const flatStop = computeCalibratedStoppingDistance(100, 'WET', 0.0, 8.0, 1.5);
  assert.ok(downhillStop.brakingDistanceM > flatStop.brakingDistanceM);
});

test('Fixtures SINTÉTICOS (no reales) de telemetría OBD-II e incidentes DGT: coherencia interna', () => {
  // Fixtures sintéticos: generados para pruebas, NO son medidas ni incidentes reales (ver avisoVeracidad)
  const telemetryPath = path.resolve(__dirname, '../../../investor-next/public/senda/data/referencias/vehicular_telemetry_real.json');
  const incidentsPath = path.resolve(__dirname, '../../../investor-next/public/senda/data/referencias/dgt_v16_corridor_incidents.json');

  assert.ok(fs.existsSync(telemetryPath), 'El dataset vehicular_telemetry_real.json debe existir');
  assert.ok(fs.existsSync(incidentsPath), 'El dataset dgt_v16_corridor_incidents.json debe existir');

  const telemetryData = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
  const incidentsData = JSON.parse(fs.readFileSync(incidentsPath, 'utf8'));
  assert.equal(telemetryData.basis, 'SYNTHETIC_FIXTURE_NOT_REAL');
  assert.equal(incidentsData.basis, 'SYNTHETIC_FIXTURE_NOT_REAL');

  // 1. Verificación de casos cinemáticos reales
  assert.equal(telemetryData.casos.length, 5);

  // Caso 1: Frenada brusca en A-3
  const caseA3 = telemetryData.casos.find((c) => c.id === 'CASE-01-A3-HARD-BRAKE-AVOIDANCE');
  assert.ok(caseA3 != null);
  const kinematicsA3 = analyzeObdKinematics(caseA3.puntos);
  assert.equal(kinematicsA3.isEmergencyBraking, true);
  assert.ok(kinematicsA3.decelMs2 >= 8.5);

  // Caso 2: Pérdida de tracción en V-31 por balsa
  const caseV31 = telemetryData.casos.find((c) => c.id === 'CASE-02-V31-AQUAPLANING-SURFACE');
  assert.ok(caseV31 != null);
  const aquaplaningV31 = computeHornerAquaplaningSpeed(220, caseV31.espesorAguaMm, 4.0, 95.0);
  assert.equal(aquaplaningV31.riskLevel, 'CRITICAL_AQUAPLANING');

  // 2. Verificación de los 12 incidentes viales DGT
  assert.equal(incidentsData.incidentes.length, 12);
  for (const inc of incidentsData.incidentes) {
    assert.ok(inc.id.startsWith('DGT-INC-'));
    assert.ok(inc.coordenadas.lat >= 36.0 && inc.coordenadas.lat <= 44.0, 'Latitud española válida');
    assert.ok(inc.coordenadas.lon >= -9.5 && inc.coordenadas.lon <= 4.5, 'Longitud española válida');
    assert.ok(inc.firme.coefRozamientoMu > 0.05 && inc.firme.coefRozamientoMu < 1.0);
    assert.ok(inc.latenciaLocalSendaMs < 50.0, 'Latencia local SENDA < 50 ms');
    assert.ok(inc.latenciaNubeDgt30Seg >= 90.0, 'Latencia nube DGT 3.0 >= 90 s');
    assert.ok(inc.tiempoAntelacionAproximacion120KmhSeg >= 40.0, 'Tiempo de antelación al conductor >= 40 s');
  }
});
