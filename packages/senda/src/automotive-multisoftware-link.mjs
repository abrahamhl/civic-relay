/**
 * SENDA · Enlace Multisoftware para Vehículos Conectados, Radios de Coche, Pantallas Android y Dispositivos Viales
 *
 * Módulo isomórfico (Node.js + Navegador / Android WebView / PWA / Head Units)
 * Proporciona conectividad unificada con:
 *  1. OBD-II & CAN Bus (SAE J1979 / ELM327 / STN1110 / ESP32-CAN)
 *  2. Radios de Auto (RDS / RBDS / TMC ISO 14819 & DAB+ EWF ETSI TS 104 090)
 *  3. Pantallas Android / Android Automotive OS (AAOS) / Android Auto / Apple CarPlay
 *  4. Balizas V16 Conectadas (DGT 3.0 IoT) y V2X (ETSI ITS-G5 CAM / DENM)
 *  5. Puerta de Enlace Orquestadora Multisoftware (AutomotiveMultisoftwareGateway)
 */

import { HAZARD, ROAD, encodeHazard, decodeHazard } from './road-guard.mjs';
import { VEHICLE_SOURCES, SRTI, vehicleEventToHazard } from './vehicle-link.mjs';

function finite(val, min = -Infinity, max = Infinity) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. ADAPTADOR OBD-II & CAN BUS (SAE J1979 / ELM327 / CAN-FD)
// ═══════════════════════════════════════════════════════════════════════════

export const OBD_PIDS = Object.freeze({
  ENGINE_COOLANT_TEMP: 0x05, // A - 40 (°C)
  FUEL_PRESSURE: 0x0a,       // 3 * A (kPa)
  ENGINE_RPM: 0x0c,          // (256 * A + B) / 4 (rpm)
  VEHICLE_SPEED: 0x0d,       // A (km/h)
  THROTTLE_POSITION: 0x11,   // (A * 100) / 255 (%)
  BAROMETRIC_PRESSURE: 0x33, // A (kPa)
  AMBIENT_AIR_TEMP: 0x46,    // A - 40 (°C)
  HYBRID_BATTERY_PCT: 0x5b,  // (A * 100) / 255 (%)
});

/**
 * Decodifica una respuesta estándar OBD-II Modo 01 (SAE J1979) desde bytes en bruto o cadena hexadecimal.
 *
 * @param {number} pid Identificador de PID (0x0C, 0x0D, 0x11, 0x33, etc.)
 * @param {number|number[]|Uint8Array|string} dataBytes Datos de respuesta (ej: [A, B] o '41 0D 78')
 * @returns {{ pid: number, name: string, value: number, unit: string }}
 */
export function decodeObdPid(pid, dataBytes) {
  let a = 0;
  let b = 0;

  if (typeof dataBytes === 'string') {
    const tokens = dataBytes.trim().split(/\s+/).map((t) => parseInt(t, 16));
    // Si incluye cabecera '41 <PID> A B', extraemos A y B
    if (tokens.length >= 3 && tokens[0] === 0x41 && tokens[1] === pid) {
      a = tokens[2] ?? 0;
      b = tokens[3] ?? 0;
    } else {
      a = tokens[0] ?? 0;
      b = tokens[1] ?? 0;
    }
  } else if (Array.isArray(dataBytes) || dataBytes instanceof Uint8Array) {
    a = dataBytes[0] ?? 0;
    b = dataBytes[1] ?? 0;
  } else if (typeof dataBytes === 'number') {
    a = dataBytes;
    b = 0;
  }

  switch (pid) {
    case OBD_PIDS.VEHICLE_SPEED:
      return { pid, name: 'VEHICLE_SPEED', value: a, unit: 'km/h' };

    case OBD_PIDS.ENGINE_RPM:
      return { pid, name: 'ENGINE_RPM', value: Math.round(((256 * a + b) / 4) * 10) / 10, unit: 'rpm' };

    case OBD_PIDS.THROTTLE_POSITION:
      return { pid, name: 'THROTTLE_POSITION', value: Math.round(((a * 100) / 255) * 10) / 10, unit: '%' };

    case OBD_PIDS.BAROMETRIC_PRESSURE:
      return { pid, name: 'BAROMETRIC_PRESSURE', value: a, unit: 'kPa' };

    case OBD_PIDS.AMBIENT_AIR_TEMP:
      return { pid, name: 'AMBIENT_AIR_TEMP', value: a - 40, unit: '°C' };

    case OBD_PIDS.ENGINE_COOLANT_TEMP:
      return { pid, name: 'ENGINE_COOLANT_TEMP', value: a - 40, unit: '°C' };

    case OBD_PIDS.FUEL_PRESSURE:
      return { pid, name: 'FUEL_PRESSURE', value: 3 * a, unit: 'kPa' };

    case OBD_PIDS.HYBRID_BATTERY_PCT:
      return { pid, name: 'HYBRID_BATTERY_PCT', value: Math.round(((a * 100) / 255) * 10) / 10, unit: '%' };

    default:
      return { pid, name: 'UNKNOWN_PID', value: a, unit: 'raw' };
  }
}

/**
 * Analiza la cinemática vehicular combinando telemetría OBD-II con inercial (CAN/IMU)
 * para detectar frenadas de emergencia, pérdida de tracción o parada súbita en vía.
 *
 * @param {Array<{tSec: number, speedKmh: number, throttlePct?: number, brakeActive?: boolean, baroKpa?: number}>} telemetrySeries
 * @returns {{ isEmergencyBraking: boolean, decelMs2: number, hazardType: number, confidence: number, adviceText: string }}
 */
export function analyzeObdKinematics(telemetrySeries = []) {
  if (telemetrySeries.length < 2) {
    return {
      isEmergencyBraking: false,
      decelMs2: 0,
      hazardType: HAZARD.STOPPED,
      confidence: 0,
      adviceText: 'Telemetría insuficiente',
    };
  }

  const p1 = telemetrySeries[telemetrySeries.length - 2];
  const p2 = telemetrySeries[telemetrySeries.length - 1];

  const dt = Math.max(0.01, p2.tSec - p1.tSec);
  const v1 = (p1.speedKmh * 1000) / 3600;
  const v2 = (p2.speedKmh * 1000) / 3600;

  const decelMs2 = (v1 - v2) / dt;
  const isEmergency = decelMs2 >= ROAD.hardBrakeMs2 && (p2.throttlePct ?? 0) <= 5.0;
  const isImpact = decelMs2 >= 12.0;

  let hazardType = HAZARD.BRAKE;
  let confidence = 0.5;
  let adviceText = 'Conducción nominal';

  if (isImpact) {
    hazardType = HAZARD.CRASH;
    confidence = 0.95;
    adviceText = '¡COLISIÓN DETECTADA POR TELEMETRÍA CAN! Activando protocolo SOS eCall';
  } else if (isEmergency) {
    hazardType = HAZARD.BRAKE;
    confidence = 0.88;
    adviceText = `¡FRENADA DE EMERGENCIA OBD! Deceleración ${decelMs2.toFixed(1)} m/s²`;
  } else if (p2.speedKmh < 3 && p1.speedKmh > 30) {
    hazardType = HAZARD.STOPPED;
    confidence = 0.80;
    adviceText = 'Vehículo detenido tras deceleración brusca en calzada';
  }

  return {
    isEmergencyBraking: isEmergency || isImpact,
    decelMs2: Math.round(decelMs2 * 10) / 10,
    hazardType,
    confidence,
    adviceText,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CODIFICADOR PARA RADIOS DE AUTO (RDS / RBDS / TMC ISO 14819 & DAB+ EWF)
// ═══════════════════════════════════════════════════════════════════════════

export const TMC_EVENT_CODES = Object.freeze({
  MULTI_VEHICLE_ACCIDENT: 101, // Accidente con múltiples vehículos
  HARD_BRAKING_AHEAD: 108,     // Frenada brusca en cola
  QUEUE_AHEAD: 401,            // Cola o retención
  ROAD_BLOCKED_FLOOD: 901,     // Carretera cortada por inundación
  ROAD_BLOCKED_FIRE: 905,      // Vía cortada por incendio forestal
  DENSE_FOG: 1001,             // Niebla densa
  BLACK_ICE: 1006,             // Hielo negro deslizante
});

/**
 * Codifica un paquete RDS Tipo 8A (Traffic Message Channel - TMC ISO 14819-1).
 * Estructura de bloques A, B, C, D de 16 bits para inyección en chip sintonizador (ej: Si4713 / QN8027 / SDR).
 *
 * @param {number} eventCode Código de evento TMC estándar (101, 401, 901, etc.)
 * @param {number} locationCode Código de localización de la tabla TMC de la DGT/Rijkswaterstaat (1..65535)
 * @param {number} direction Sentido de la marcha (0 = creciente, 1 = decreciente)
 * @param {number} extent Longitud del tramo afectado en pasos TMC (0..7)
 * @returns {{ blockA: number, blockB: number, blockC: number, blockD: number, hexString: string }}
 */
export function encodeRdsTmcGroup8A(eventCode = 101, locationCode = 4210, direction = 0, extent = 1) {
  // Bloque A: PI Code (Identificador de Programa de la emisora, ej: 0xE201 para RNE)
  const blockA = 0xe201;

  // Bloque B: Grupo 8A (Tipo 8, Versión A) + banderas TP (1) + PTY (31 = Alarma) + TA (1)
  // [0..4 Group Type: 8 (01000)] [5 Version: 0] [6 TP: 1] [7..11 PTY: 31 (11111)] [12..15 Flags/Extent]
  const groupType = 8;
  const version = 0;
  const tp = 1;
  const pty = 31; // ALARM_TEST
  const blockB =
    ((groupType & 0x0f) << 12) |
    ((version & 0x01) << 11) |
    ((tp & 0x01) << 10) |
    ((pty & 0x1f) << 5) |
    (1 << 4) | // Bandera de mensaje de usuario
    (extent & 0x07);

  // Bloque C: Información del evento TMC (Duración 3 bits, Dirección 1 bit, Evento 11 bits)
  const durationFlag = 1; // Evento dinámico
  const dirBit = direction ? 1 : 0;
  const blockC =
    ((durationFlag & 0x07) << 13) |
    ((dirBit & 0x01) << 12) |
    (eventCode & 0x0fff);

  // Bloque D: Código de ubicación geográfica de la tabla de carreteras
  const blockD = locationCode & 0xffff;

  const toHex = (n) => n.toString(16).padStart(4, '0').toUpperCase();
  const hexString = `${toHex(blockA)} ${toHex(blockB)} ${toHex(blockC)} ${toHex(blockD)}`;

  return {
    blockA,
    blockB,
    blockC,
    blockD,
    hexString,
  };
}

/**
 * Codifica las tramas RDS de texto para pantalla de radio (PS: 8 caracteres y RT: 64 caracteres)
 * junto con la activación obligatoria de las banderas TA/TP para forzar interrupción en la radio del coche.
 *
 * @param {string} shortText Texto de 8 caracteres para pantalla de dial (ej: 'SENDA SOS')
 * @param {string} fullMessage Texto descriptivo de hasta 64 caracteres para RadioText
 * @param {boolean} forceInterrupt Si activa TA para interrumpir la música en la cabina
 * @returns {{ programServicePs: string, radioTextRt: string, trafficAnnouncementTa: boolean, trafficProgramTp: boolean }}
 */
export function encodeRdsDisplayText(shortText = 'SENDA', fullMessage = 'ALERTA SENDA: PELIGRO VIAL', forceInterrupt = true) {
  const psClean = shortText.toUpperCase().slice(0, 8).padEnd(8, ' ');
  const rtClean = fullMessage.slice(0, 64).padEnd(64, ' ');

  return {
    programServicePs: psClean,
    radioTextRt: rtClean,
    trafficAnnouncementTa: forceInterrupt,
    trafficProgramTp: true,
  };
}

/**
 * Genera la estructura de paquete DAB+ EWF (Emergency Warning Functionality - ETSI TS 104 090).
 * Permite a receptores DAB+ automotrices encenderse automáticamente o sintonizar el canal de socorro.
 *
 * @param {number} emergencyId Identificador único del suceso de socorro
 * @param {string} warningText Texto de alarma nacional/regional
 * @param {{ lat: number, lon: number, radiusKm: number }} targetZone
 * @returns {object} Mensaje EWF estandarizado
 */
export function encodeDabPlusEwf(emergencyId, warningText, targetZone) {
  return {
    standard: 'ETSI_TS_104_090_DAB_EWF',
    alarmFlag: true,
    emergencyId: emergencyId >>> 0,
    priorityLevel: 'NATIONAL_CIVIL_PROTECTION_HIGH',
    warningText: warningText.slice(0, 128),
    targetZone: {
      latitude: targetZone?.lat ?? 40.0,
      longitude: targetZone?.lon ?? -3.0,
      radiusKm: targetZone?.radiusKm ?? 25.0,
    },
    audioReconfigurationTrigger: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PANTALLAS ANDROID / ANDROID AUTOMOTIVE OS (AAOS) & HEAD UNITS (HUD)
// ═══════════════════════════════════════════════════════════════════════════

export const AUTOMOTIVE_SAFETY_PROFILES = Object.freeze({
  STATIONARY: { maxTouchAllowed: Infinity, allowTextEntry: true, minTargetSizePx: 48 },
  MOVING: { maxTouchAllowed: 3, allowTextEntry: false, minTargetSizePx: 72 }, // Conforme NHTSA Driver Distraction
});

/**
 * Genera el estado de interfaz visual para pantallas Android de cabina / salpicadero.
 * Aplica restricciones automáticas de seguridad si el coche está en movimiento y calcula
 * la paleta cromática nocturna/diurna para prevenir el deslumbramiento del conductor.
 *
 * @param {number} speedKmh Velocidad actual del coche
 * @param {boolean} isNightMode Si es de noche o se transita por túnel
 * @param {object} activeHazard Alerta vial activa (si existe)
 * @returns {object} Estado de renderizado para Android Automotive / CarPlay Web View
 */
export function computeAutomotiveCockpitState(speedKmh = 0, isNightMode = true, activeHazard = null) {
  const isMoving = speedKmh > 5.0;
  const safety = isMoving ? AUTOMOTIVE_SAFETY_PROFILES.MOVING : AUTOMOTIVE_SAFETY_PROFILES.STATIONARY;

  // Paleta ergonómica: De noche negro absoluto OLED (#000000) con ámbar/rojo tenue
  const theme = isNightMode
    ? {
        background: '#000000',
        cardBackground: '#121212',
        textColor: '#FFFFFF',
        accentColor: activeHazard ? '#FF2A2A' : '#FFAA00',
        hudGlow: activeHazard ? 'rgba(255, 42, 42, 0.4)' : 'rgba(255, 170, 0, 0.2)',
      }
    : {
        background: '#F4F5F7',
        cardBackground: '#FFFFFF',
        textColor: '#1A1A1A',
        accentColor: activeHazard ? '#D32F2F' : '#E65100',
        hudGlow: 'none',
      };

  let speechAnnouncement = null;
  if (activeHazard) {
    const distText = activeHazard.distanceM ? `en ${Math.round(activeHazard.distanceM)} metros` : 'inmediato';
    speechAnnouncement = `Atención: ${activeHazard.title || 'Peligro en calzada'} ${distText}. ${activeHazard.advice || 'Reduzca la velocidad'}.`;
  }

  return {
    isMoving,
    driverDistractionRulesEnforced: isMoving,
    minTouchTargetPx: safety.minTargetSizePx,
    allowComplexInput: safety.allowTextEntry,
    theme,
    speechAnnouncement,
    activeAlert: activeHazard
      ? {
          title: activeHazard.title || 'AVISO DE TRÁFICO',
          severity: activeHazard.severity || 'WARNING',
          icon: activeHazard.icon || 'warning-triangle',
          speedLimitKmh: activeHazard.speedLimitKmh || null,
        }
      : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. BALIZAS V16 CONECTADAS (DGT 3.0) & MENSAJES COOPERATIVOS V2X (CAM / DENM)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decodifica una trama telemétrica de baliza V16 conectada (DGT 3.0 IoT Narrowband).
 *
 * @param {string|object} rawPayload Carga útil en formato JSON o binario hex de baliza V16
 * @returns {{ beaconId: string, lat: number, lon: number, status: string, timestampUtc: string }}
 */
export function decodeV16BeaconTelemetry(rawPayload) {
  let data = rawPayload;
  if (typeof rawPayload === 'string') {
    try {
      data = JSON.parse(rawPayload);
    } catch {
      throw new TypeError('Payload de Baliza V16 inválido (no JSON)');
    }
  }

  if (!data || typeof data !== 'object') {
    throw new TypeError('Estructura de Baliza V16 requerida');
  }

  const lat = data.lat ?? data.latitude;
  const lon = data.lon ?? data.longitude;

  if (!finite(lat, -90, 90) || !finite(lon, -180, 180)) {
    throw new TypeError('Coordenadas geográficas de Baliza V16 fuera de rango');
  }

  return {
    beaconId: String(data.beaconId || data.id || 'V16-ANONYMOUS'),
    lat: Math.round(lat * 1e7) / 1e7,
    lon: Math.round(lon * 1e7) / 1e7,
    status: data.active ? 'ACTIVE_FLASHING_ON_ROAD' : 'STANDBY',
    batteryPct: data.batteryPct ?? 100,
    timestampUtc: data.timestampUtc || new Date().toISOString(),
  };
}

/**
 * Genera un mensaje cooperativo de concienciación V2X (ETSI EN 302 637-2 CAM).
 *
 * @param {object} egoState Estado cinemático del propio vehículo
 * @returns {object} Mensaje CAM listo para difusión V2X
 */
export function generateV2xCamMessage(egoState = {}) {
  const {
    stationId = 0x12345678,
    lat = 40.4168,
    lon = -3.7038,
    speedKmh = 90,
    headingDeg = 180,
    decelMs2 = 0,
    vehicleRole = 'PASSENGER_CAR',
  } = egoState;

  return {
    standard: 'ETSI_EN_302_637_2_CAM',
    stationId: stationId >>> 0,
    generationTimeUtc: new Date().toISOString(),
    basicContainer: {
      stationType: 5, // Passenger Car
      referencePosition: {
        latitude: Math.round(lat * 1e7),
        longitude: Math.round(lon * 1e7),
        altitudeM: Math.round(egoState.altM || 650),
      },
    },
    highFrequencyContainer: {
      headingDeg: Math.round(headingDeg * 10) / 10,
      speedMs: Math.round(((speedKmh * 1000) / 3600) * 10) / 10,
      longitudinalAccelerationMs2: Math.round(-decelMs2 * 10) / 10,
      curvatureRadM: 0,
    },
  };
}

/**
 * Genera un mensaje de notificación de entorno descentralizado V2X (ETSI EN 302 637-3 DENM)
 * para avisar a otros vehículos de una frenada de emergencia en cadena o peligro en calzada.
 *
 * @param {object} hazardEvent Evento de peligro detectado
 * @returns {object} Mensaje DENM estandarizado
 */
export function generateV2xDenmMessage(hazardEvent = {}) {
  const {
    stationId = 0x12345678,
    actionId = 1,
    causeCode = 1, // 1 = Traffic condition / braking
    subCauseCode = 1,
    lat = 40.4168,
    lon = -3.7038,
    relevanceDistanceM = 1000,
    validityDurationS = 60,
  } = hazardEvent;

  return {
    standard: 'ETSI_EN_302_637_3_DENM',
    managementContainer: {
      actionId: { stationId: stationId >>> 0, sequenceNumber: actionId },
      detectionTimeUtc: new Date().toISOString(),
      eventPosition: {
        latitude: Math.round(lat * 1e7),
        longitude: Math.round(lon * 1e7),
      },
      validityDurationS,
      relevanceDistanceM,
      relevanceTrafficDirection: 'UPSTREAM_SAME_DIRECTION',
    },
    situationContainer: {
      informationQuality: 3, // Máxima calidad directa de sensor
      eventType: {
        causeCode,
        subCauseCode,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PUERTA DE ENLACE MULTISOFTWARE INTEGRADA (AUTOMOTIVE GATEWAY)
// ═══════════════════════════════════════════════════════════════════════════

export class AutomotiveMultisoftwareGateway {
  constructor(options = {}) {
    this.vehicleId = options.vehicleId || 'SENDA-AUTO-NODE-01';
    this.subsystems = {
      obdConnected: false,
      rdsBroadcasterReady: true,
      androidAutoActive: false,
      v2xTransceiverReady: true,
    };
    this.lastKinematics = null;
    this.activeHazards = [];
  }

  /**
   * Procesa una ráfaga de telemetría OBD-II proveniente de un dongle Bluetooth/Wi-Fi.
   */
  processObdInput(telemetryPoints = []) {
    const analysis = analyzeObdKinematics(telemetryPoints);
    this.lastKinematics = analysis;
    this.subsystems.obdConnected = true;

    if (analysis.isEmergencyBraking) {
      const hazard = {
        id: `OBD-HAZARD-${Date.now()}`,
        type: analysis.hazardType,
        decelMs2: analysis.decelMs2,
        title: analysis.hazardType === HAZARD.CRASH ? 'COLISIÓN EN CALZADA' : 'FRENADA DE EMERGENCIA',
        severity: 'CRITICAL',
        advice: analysis.adviceText,
      };
      this.activeHazards.push(hazard);
      return { triggeredHazard: hazard, analysis };
    }

    return { triggeredHazard: null, analysis };
  }

  /**
   * Genera las tramas de difusión simultáneas para radio (RDS), pantalla (Android Cockpit) y V2X.
   */
  dispatchMultiSoftwareOutputs(currentGps = { lat: 40.4168, lon: -3.7038, speedKmh: 90 }) {
    const topHazard = this.activeHazards[this.activeHazards.length - 1] || null;

    // 1. Salida para Radio de Auto (RDS / TMC)
    const rdsDisplay = encodeRdsDisplayText(
      topHazard ? 'FRENA!' : 'SENDA',
      topHazard ? `ALERTA SENDA: ${topHazard.title}` : 'SENDA RED VIAL ACTIVA',
      Boolean(topHazard)
    );
    const rdsTmc = encodeRdsTmcGroup8A(
      topHazard?.type === HAZARD.CRASH ? TMC_EVENT_CODES.MULTI_VEHICLE_ACCIDENT : TMC_EVENT_CODES.HARD_BRAKING_AHEAD,
      4210,
      0,
      1
    );

    // 2. Salida para Pantalla Android / HUD
    const cockpit = computeAutomotiveCockpitState(currentGps.speedKmh, true, topHazard);

    // 3. Salida para V2X CAM y DENM
    const cam = generateV2xCamMessage({
      lat: currentGps.lat,
      lon: currentGps.lon,
      speedKmh: currentGps.speedKmh,
      decelMs2: this.lastKinematics?.decelMs2 || 0,
    });
    const denm = topHazard
      ? generateV2xDenmMessage({
          lat: currentGps.lat,
          lon: currentGps.lon,
          causeCode: topHazard.type === HAZARD.CRASH ? 2 : 1,
        })
      : null;

    return {
      vehicleId: this.vehicleId,
      timestampUtc: new Date().toISOString(),
      carRadioRds: {
        display: rdsDisplay,
        tmcGroup8A: rdsTmc,
      },
      androidCockpit: cockpit,
      v2xTransmission: {
        cam,
        denm,
      },
    };
  }
}
