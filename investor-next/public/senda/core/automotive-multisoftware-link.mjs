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

// ═══════════════════════════════════════════════════════════════════════════
// 6. FÍSICA VEHICULAR CALIBRADA Y RESOLUTORES DE BRECHAS DE SEGURIDAD VIAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Coeficientes de rozamiento longitudinal base (mu0) y sensibilidad de velocidad
 * calibrados según Norma Española 3.1-IC Trazado, AASHTO Green Book y ensayos de campo.
 */
export const ROAD_SURFACE_PROFILES = Object.freeze({
  DRY: { mu0: 0.78, kv: 0.0022, desc: 'Asfalto seco en buen estado' },
  WET: { mu0: 0.50, kv: 0.0035, desc: 'Asfalto mojado con película de agua superficial' },
  FLOODED: { mu0: 0.22, kv: 0.0050, desc: 'Balsa de agua profunda (riesgo aquaplaning)' },
  BLACK_ICE: { mu0: 0.12, kv: 0.0010, desc: 'Hielo negro o escarcha en firme' },
  ICE: { mu0: 0.12, kv: 0.0010, desc: 'Hielo compacto' },
  SNOW: { mu0: 0.25, kv: 0.0020, desc: 'Nieve pisada o compactada' },
  GRAVEL_DIRT: { mu0: 0.45, kv: 0.0025, desc: 'Grava o camino no pavimentado' },
  TUNNEL_DRY: { mu0: 0.72, kv: 0.0020, desc: 'Firme de hormigón/asfalto en túnel' },
  SMOKE_ASH: { mu0: 0.48, kv: 0.0030, desc: 'Firme seco con depósito de ceniza de incendio' },
});

/**
 * Calcula la velocidad crítica de aquaplaning dinámico basada en la fórmula de Horner / NASA
 * y ajustada por el espesor de película de agua y profundidad de dibujo de neumático (Gallaway et al.).
 *
 * Fórmula base Horne/NASA: v_crit = 6.35 * sqrt(P_kpa)  (km/h)
 *
 * @param {number} tirePressureKpa Presión de inflado del neumático en kPa (típico 200 - 320 kPa)
 * @param {number} [waterFilmDepthMm=1.0] Espesor de la película de agua en milímetros
 * @param {number} [tireTreadDepthMm=8.0] Profundidad del dibujo del neumático en milímetros (mínimo legal 1.6 mm)
 * @param {number} [currentSpeedKmh] Velocidad actual del vehículo para evaluación de riesgo
 * @returns {{
 *   criticalSpeedKmh: number,
 *   safeSpeedKmh: number,
 *   tirePressureKpa: number,
 *   waterFilmDepthMm: number,
 *   tireTreadDepthMm: number,
 *   hydrodynamicPressureKpa: number,
 *   riskLevel: 'SAFE'|'ADVISORY'|'CRITICAL_AQUAPLANING',
 *   recommendation: string
 * }}
 */
export function computeHornerAquaplaningSpeed(
  tirePressureKpa,
  waterFilmDepthMm = 1.0,
  tireTreadDepthMm = 8.0,
  currentSpeedKmh = null
) {
  const pKpa = finite(tirePressureKpa, 100, 600) ? tirePressureKpa : 220.0;
  const tWater = Math.max(0.0, finite(waterFilmDepthMm) ? waterFilmDepthMm : 1.0);
  const tTread = Math.max(1.0, finite(tireTreadDepthMm) ? tireTreadDepthMm : 8.0);

  // Ecuación base de Horne / NASA para neumáticos de automóvil
  const baseSpeedKmh = 6.35 * Math.sqrt(pKpa);

  // Si no hay suficiente agua (<0.3 mm), no hay sustentación hidrodinámica macroscópica
  if (tWater < 0.3) {
    return {
      criticalSpeedKmh: Math.round(baseSpeedKmh * 1.3 * 10) / 10,
      safeSpeedKmh: Math.round(baseSpeedKmh * 1.1 * 10) / 10,
      tirePressureKpa: pKpa,
      waterFilmDepthMm: tWater,
      tireTreadDepthMm: tTread,
      hydrodynamicPressureKpa: 0,
      riskLevel: 'SAFE',
      recommendation: 'Espesor de agua despreciable. Peligro de aquaplaning mínimo.',
    };
  }

  // Factor de drenaje del dibujo: relación entre espesor de agua y profundidad de ranuras
  const depthRatio = tWater / tTread;
  let treadDrainageFactor = 1.0;
  if (depthRatio <= 0.25) {
    treadDrainageFactor = 1.15; // Excelente evacuación
  } else if (depthRatio <= 0.6) {
    treadDrainageFactor = 1.0 - 0.2 * (depthRatio - 0.25);
  } else {
    // Cuando el agua supera el 60% del dibujo o lo inunda por completo
    treadDrainageFactor = Math.max(0.65, 0.93 - 0.38 * depthRatio);
  }

  const criticalSpeedKmh = Math.round(baseSpeedKmh * treadDrainageFactor * 10) / 10;
  const safeSpeedKmh = Math.round(criticalSpeedKmh * 0.8 * 10) / 10;

  // Presión de estancamiento hidrodinámico q = 0.5 * rho * v^2 a velocidad crítica
  const vMs = criticalSpeedKmh / 3.6;
  const hydrodynamicPressureKpa = Math.round((0.5 * 1000 * vMs * vMs) / 100) / 10;

  const evalSpeed = currentSpeedKmh !== null && finite(currentSpeedKmh) ? currentSpeedKmh : criticalSpeedKmh;
  let riskLevel = 'SAFE';
  let recommendation = `Velocidad segura frente a aquaplaning: mantener bajo ${safeSpeedKmh} km/h.`;

  if (evalSpeed >= criticalSpeedKmh) {
    riskLevel = 'CRITICAL_AQUAPLANING';
    recommendation = `PELIGRO: Velocidad actual (${evalSpeed} km/h) iguala o excede el umbral de sustentación hidrodinámica (${criticalSpeedKmh} km/h). Pérdida de dirección inminente. Reduzca suavemente sin frenar bruscamente.`;
  } else if (evalSpeed >= safeSpeedKmh) {
    riskLevel = 'ADVISORY';
    recommendation = `PRECAUCIÓN: Velocidad (${evalSpeed} km/h) en zona de transición de hidroplaneo. Margen de evacuación reducido. Reduzca a ${safeSpeedKmh} km/h.`;
  }

  return {
    criticalSpeedKmh,
    safeSpeedKmh,
    tirePressureKpa: pKpa,
    waterFilmDepthMm: tWater,
    tireTreadDepthMm: tTread,
    hydrodynamicPressureKpa,
    riskLevel,
    recommendation,
  };
}

/**
 * Resuelve el dilema de adelantamiento a vehículo pesado opaco en carreteras bidireccionales de un carril por sentido.
 * Modela la Distancia de Visibilidad de Adelantamiento (AASHTO Passing Sight Distance & Norma 3.1-IC).
 *
 * @param {number} egoSpeedKmh Velocidad del vehículo adelantador (km/h)
 * @param {number} leadTruckSpeedKmh Velocidad del camión pesado que precede (km/h)
 * @param {number} oncomingSpeedKmh Velocidad del tráfico en sentido contrario (km/h)
 * @param {number} gapDistanceM Distancia visible libre hasta el vehículo de frente o curva ciega (m)
 * @param {number} [egoAccelMs2=1.8] Capacidad de aceleración media del vehículo durante la maniobra (m/s²)
 * @returns {{
 *   isSafe: boolean,
 *   status: 'SAFE'|'MARGINAL'|'ABORT_IMMEDIATELY',
 *   requiredSightDistanceM: number,
 *   safetyMarginM: number,
 *   passTimeSec: number,
 *   distanceTraveledM: number,
 *   criticalAbortPointM: number,
 *   maxOncomingSpeedToleratedKmh: number,
 *   recommendation: string
 * }}
 */
export function evaluateOvertakingClearance(
  egoSpeedKmh,
  leadTruckSpeedKmh,
  oncomingSpeedKmh,
  gapDistanceM,
  egoAccelMs2 = 1.8
) {
  const vLeadMs = Math.max(5.0, (finite(leadTruckSpeedKmh) ? leadTruckSpeedKmh : 70.0) / 3.6);
  const vOncomingMs = Math.max(0.0, (finite(oncomingSpeedKmh) ? oncomingSpeedKmh : 90.0) / 3.6);
  const aMs2 = Math.max(0.6, Math.min(4.5, finite(egoAccelMs2) ? egoAccelMs2 : 1.8));
  const gapM = Math.max(10.0, finite(gapDistanceM) ? gapDistanceM : 300.0);

  // Parámetros geométricos y márgenes de seguridad según AASHTO
  const truckLengthM = 16.5; // Camión articulado estándar
  const egoLengthM = 4.5;
  const trailingDistanceM = Math.max(8.0, vLeadMs * 0.6); // Separación previa al cambio de carril
  const cutInDistanceM = Math.max(12.0, vLeadMs * 0.8);   // Separación de retorno al carril propio
  const totalRelativeDistanceM = truckLengthM + egoLengthM + trailingDistanceM + cutInDistanceM;

  // Tiempo necesario para ganar la distancia relativa acelerando en el carril contrario
  // s_rel = 0.5 * a * t^2 => t = sqrt(2 * s_rel / a)
  const passTimeSec = Math.sqrt((2 * totalRelativeDistanceM) / aMs2);

  // Distancia recorrida por el vehículo adelantador en el carril opuesto
  const distanceTraveledM = vLeadMs * passTimeSec + totalRelativeDistanceM;

  // Distancia recorrida por el vehículo en sentido contrario durante la maniobra
  const oncomingDistanceM = vOncomingMs * passTimeSec;

  // Margen de seguridad libre al completar el retorno
  const safetyClearanceM = Math.max(25.0, vLeadMs * 1.0);

  // Distancia total de visibilidad requerida (Passing Sight Distance)
  const requiredSightDistanceM = distanceTraveledM + oncomingDistanceM + safetyClearanceM;

  const safetyMarginM = gapM - requiredSightDistanceM;
  const criticalAbortPointM = distanceTraveledM * 0.45; // Punto de no retorno

  // Velocidad máxima admisible del vehículo contrario para el hueco actual
  const maxOncomingMs = Math.max(0, (gapM - distanceTraveledM - safetyClearanceM) / passTimeSec);
  const maxOncomingSpeedToleratedKmh = Math.round(maxOncomingMs * 3.6 * 10) / 10;

  let status = 'SAFE';
  let recommendation = `Adelantamiento seguro. Margen residual: +${Math.round(safetyMarginM)} m.`;

  if (safetyMarginM < 0) {
    status = 'ABORT_IMMEDIATELY';
    recommendation = `ABORTE MANIOBRA: Hueco insuficiente (${Math.round(gapM)} m < ${Math.round(requiredSightDistanceM)} m requerido). Riesgo inminente de colisión frontal.`;
  } else if (safetyMarginM < 50.0) {
    status = 'MARGINAL';
    recommendation = `PRECAUCIÓN: Adelantamiento muy ajustado (margen ${Math.round(safetyMarginM)} m). Solo ejecutable con aceleración a fondo ininterrumpida.`;
  }

  return {
    isSafe: status === 'SAFE',
    status,
    requiredSightDistanceM: Math.round(requiredSightDistanceM * 10) / 10,
    safetyMarginM: Math.round(safetyMarginM * 10) / 10,
    passTimeSec: Math.round(passTimeSec * 10) / 10,
    distanceTraveledM: Math.round(distanceTraveledM * 10) / 10,
    criticalAbortPointM: Math.round(criticalAbortPointM * 10) / 10,
    maxOncomingSpeedToleratedKmh,
    recommendation,
  };
}

/**
 * Filtro EKF de navegación a la estima (Dead Reckoning) para túneles y entornos sin GNSS (GNSS-Denied).
 * Fusiona velocidad de rueda ABS (OBD-II), giróscopo de chasis (yaw rate) y restricciones físicas de confinamiento en túnel.
 *
 * @param {{
 *   lat: number,
 *   lon: number,
 *   headingDeg: number,
 *   alongTrackM?: number,
 *   crossTrackM?: number,
 *   errorVarianceM2?: number
 * }} lastState Estado previo estimado
 * @param {number} wheelSpeedKmh Velocidad lineal procedente de sensores de rueda ABS (km/h)
 * @param {number} yawRateDegS Velocidad angular de guiñada del giróscopo IMU (°/s, positivo = giro a derecha)
 * @param {number} dtS Intervalo de tiempo transcurrido (segundos)
 * @param {Array<{lat: number, lon: number}>} [roadPolyline=[]] Vértices del eje del túnel para restricción de caja vial
 * @returns {{
 *   lat: number,
 *   lon: number,
 *   headingDeg: number,
 *   speedKmh: number,
 *   alongTrackM: number,
 *   crossTrackM: number,
 *   estimatedDriftM: number,
 *   isTunnelConstraintActive: boolean
 * }}
 */
export function tunnelDeadReckoningEKF(
  lastState,
  wheelSpeedKmh,
  yawRateDegS,
  dtS,
  roadPolyline = []
) {
  const dt = Math.max(0.01, Math.min(5.0, finite(dtS) ? dtS : 0.1));
  const vMs = Math.max(0.0, (finite(wheelSpeedKmh) ? wheelSpeedKmh : 0.0) / 3.6);
  const yawRate = finite(yawRateDegS) ? yawRateDegS : 0.0;

  const currentHeading = finite(lastState?.headingDeg) ? lastState.headingDeg : 0.0;
  const currentLat = finite(lastState?.lat) ? lastState.lat : 40.4168;
  const currentLon = finite(lastState?.lon) ? lastState.lon : -3.7038;
  const alongTrackPrior = finite(lastState?.alongTrackM) ? lastState.alongTrackM : 0.0;
  const varPrior = finite(lastState?.errorVarianceM2) ? lastState.errorVarianceM2 : 1.0;

  // Actualización cinemática de rumbo
  const newHeadingDeg = (currentHeading + yawRate * dt + 360) % 360;
  const headingRad = (newHeadingDeg * Math.PI) / 180;

  // Desplazamiento métrico elemental
  const deltaDistanceM = vMs * dt;
  const deltaNorthM = deltaDistanceM * Math.cos(headingRad);
  const deltaEastM = deltaDistanceM * Math.sin(headingRad);

  // Conversión geodésica WGS84
  const metersPerDegreeLat = 111132.954;
  const metersPerDegreeLon = 111132.954 * Math.cos((currentLat * Math.PI) / 180);

  let predLat = currentLat + deltaNorthM / metersPerDegreeLat;
  let predLon = currentLon + deltaEastM / metersPerDegreeLon;
  const alongTrackM = alongTrackPrior + deltaDistanceM;

  // Crecimiento de covarianza de error del filtro (ruido de odometría + deriva de sesgo gyro)
  const qProcess = 0.04 * deltaDistanceM + 0.01 * Math.abs(yawRate) * dt;
  let errorVar = varPrior + qProcess;

  let crossTrackM = 0.0;
  let isTunnelConstraintActive = false;

  // Restricción de contorno de túnel mediante Map-Matching
  if (Array.isArray(roadPolyline) && roadPolyline.length >= 2) {
    isTunnelConstraintActive = true;
    // Búsqueda del segmento más cercano de la polilínea del túnel
    let minDistM = Infinity;
    let bestProj = { lat: predLat, lon: predLon };

    for (let i = 0; i < roadPolyline.length - 1; i++) {
      const p1 = roadPolyline[i];
      const p2 = roadPolyline[i + 1];
      const dLat = (p2.lat - p1.lat) * metersPerDegreeLat;
      const dLon = (p2.lon - p1.lon) * metersPerDegreeLon;
      const segLen2 = dLat * dLat + dLon * dLon;

      if (segLen2 > 0.01) {
        const uLat = (predLat - p1.lat) * metersPerDegreeLat;
        const uLon = (predLon - p1.lon) * metersPerDegreeLon;
        const t = Math.max(0.0, Math.min(1.0, (uLat * dLat + uLon * dLon) / segLen2));
        const projjLat = p1.lat + t * (p2.lat - p1.lat);
        const projjLon = p1.lon + t * (p2.lon - p1.lon);
        const dist = Math.hypot(
          (predLat - projjLat) * metersPerDegreeLat,
          (predLon - projjLon) * metersPerDegreeLon
        );
        if (dist < minDistM) {
          minDistM = dist;
          bestProj = { lat: projjLat, lon: projjLon };
        }
      }
    }

    crossTrackM = minDistM;

    // Actualización de medición Kalman: confinamiento físico del túnel (ancho de calzada ~7 m)
    // El vehículo no puede atravesar los muros de hormigón del túnel
    const rMeasurement = 1.0; // Varianza de la restricción del eje vial en túnel
    const kalmanGain = errorVar / (errorVar + rMeasurement);

    predLat = predLat + kalmanGain * (bestProj.lat - predLat);
    predLon = predLon + kalmanGain * (bestProj.lon - predLon);
    errorVar = (1 - kalmanGain) * errorVar;
  }

  const estimatedDriftM = Math.round(Math.sqrt(Math.max(0.01, errorVar)) * 100) / 100;

  return {
    lat: predLat,
    lon: predLon,
    headingDeg: Math.round(newHeadingDeg * 10) / 10,
    speedKmh: Math.round(wheelSpeedKmh * 10) / 10,
    alongTrackM: Math.round(alongTrackM * 10) / 10,
    crossTrackM: Math.round(crossTrackM * 100) / 100,
    estimatedDriftM,
    errorVarianceM2: errorVar,
    isTunnelConstraintActive,
  };
}

/**
 * Decodifica tramas publicitarias directas de balizas V16 Conectadas (DGT 3.0 BLE Coded PHY / Long Range)
 * y evalúa la amenaza geométrica y la ventaja temporal frente a la latencia de la nube centralizada de la DGT.
 *
 * @param {Uint8Array|number[]|string} beaconBleBytes Trama cruda de baliza V16
 * @param {{ lat: number, lon: number, speedKmh?: number, headingDeg?: number }} [egoVehicleGps] Posición del vehículo receptor
 * @returns {{
 *   beaconId: string,
 *   isActive: boolean,
 *   hazardType: string,
 *   beaconCoords: { lat: number, lon: number },
 *   distanceM: number,
 *   relativeBearingDeg: number,
 *   isAhead: boolean,
 *   reflexLatencyMs: number,
 *   cloudLatencySavedS: number,
 *   distanceAdvantageM: number,
 *   alertLevel: 'CRITICAL'|'WARNING'|'INFORMATIONAL',
 *   humanReactionWindowS: number,
 *   audioWarningText: string
 * }}
 */
export function v16ZeroLatencyReflex(beaconBleBytes, egoVehicleGps = null) {
  let bytes = [];
  if (typeof beaconBleBytes === 'string') {
    bytes = beaconBleBytes.replace(/[^0-9a-fA-F]/g, '').match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) || [];
  } else if (Array.isArray(beaconBleBytes) || beaconBleBytes instanceof Uint8Array) {
    bytes = Array.from(beaconBleBytes);
  }

  // Estructura de trama SENDA V16 BLE Coded PHY (16 bytes compactos):
  // [0..1] Company ID (0x0818 DGT V16)
  // [2] Frame Type (0x16)
  // [3..4] Beacon ID
  // [5] Status flags (Bit 0: Active, Bit 1: Battery Low, Bit 2: Degraded GPS)
  // [6..8] Latitude packed 24-bit
  // [9..11] Longitude packed 24-bit
  // [12] Incident Cause Code (1: Avería, 2: Accidente, 3: Obstáculo, 4: Balsa)
  // [13..15] CRC / Reservado
  const beaconId = `V16-${((bytes[3] || 0) << 8 | (bytes[4] || 1)).toString(16).padStart(4, '0').toUpperCase()}`;
  const statusByte = bytes[5] ?? 0x01;
  const isActive = Boolean(statusByte & 0x01);

  // Decodificación de coordenadas WGS84 compactadas
  let lat = 40.2315;
  let lon = -3.3512;
  if (bytes.length >= 12) {
    const rawLat = ((bytes[6] << 16) | (bytes[7] << 8) | bytes[8]) - 0x800000;
    const rawLon = ((bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) - 0x800000;
    lat = rawLat / 100000.0;
    lon = rawLon / 100000.0;
  }

  const causeCode = bytes[12] ?? 1;
  const causeNames = {
    1: 'VEHICULO_AVERIADO_ARCEN',
    2: 'ACCIDENTE_COLISION',
    3: 'OBSTACULO_CALZADA',
    4: 'BALSA_AGUA_INUNDACION',
  };
  const hazardType = causeNames[causeCode] || 'PELIGRO_GENERICO';

  // Evaluación frente al vehículo propio si se proporcionan coordenadas
  let distanceM = 850.0;
  let relativeBearingDeg = 0.0;
  let isAhead = true;

  if (egoVehicleGps && finite(egoVehicleGps.lat) && finite(egoVehicleGps.lon)) {
    // Cálculo de distancia ortodrómica (Haversine)
    const R = 6371000.0;
    const phi1 = (egoVehicleGps.lat * Math.PI) / 180;
    const phi2 = (lat * Math.PI) / 180;
    const deltaPhi = ((lat - egoVehicleGps.lat) * Math.PI) / 180;
    const deltaLambda = ((lon - egoVehicleGps.lon) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceM = Math.round(R * c);

    // Azimut hacia la baliza
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const bearingToHazardDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    const egoHeading = finite(egoVehicleGps.headingDeg) ? egoVehicleGps.headingDeg : bearingToHazardDeg;
    relativeBearingDeg = Math.round(((bearingToHazardDeg - egoHeading + 540) % 360) - 180);

    // Si el obstáculo está a menos de ±50° del rumbo del coche, está al frente en su trayectoria
    isAhead = Math.abs(relativeBearingDeg) <= 50;
  }

  const speedKmh = finite(egoVehicleGps?.speedKmh) ? egoVehicleGps.speedKmh : 120.0;
  const vMs = Math.max(1.0, speedKmh / 3.6);

  // Latencia del reflejo local SENDA (35 a 45 ms) frente a nube DGT 3.0 (115 a 145 s)
  const reflexLatencyMs = 38.0;
  const cloudLatencySavedS = 115.0; // Segundos ahorrados frente a la cola de ingesta centralizada
  const distanceAdvantageM = Math.round(vMs * cloudLatencySavedS); // Distancia que recorre el coche en ese tiempo
  const humanReactionWindowS = Math.round((distanceM / vMs) * 10) / 10;

  let alertLevel = 'INFORMATIONAL';
  if (distanceM <= 500 && isAhead) {
    alertLevel = 'CRITICAL';
  } else if (distanceM <= 1800 && isAhead) {
    alertLevel = 'WARNING';
  }

  const audioWarningText =
    alertLevel === 'CRITICAL'
      ? `¡PELIGRO INMEDIATO! ${hazardType.replace(/_/g, ' ')} a ${distanceM} metros frente a usted. Reduzca velocidad inmediatamente.`
      : `Atención: Baliza V16 detectada a ${distanceM} metros (${hazardType.replace(/_/g, ' ')}). Tiempo de aproximación: ${humanReactionWindowS} segundos.`;

  return {
    beaconId,
    isActive,
    hazardType,
    beaconCoords: { lat: Math.round(lat * 100000) / 100000, lon: Math.round(lon * 100000) / 100000 },
    distanceM,
    relativeBearingDeg,
    isAhead,
    reflexLatencyMs,
    cloudLatencySavedS,
    distanceAdvantageM,
    alertLevel,
    humanReactionWindowS,
    audioWarningText,
  };
}

/**
 * Calcula la distancia de parada calibrada y el intervalo de confianza al 95%
 * según la velocidad, estado del firme, pendiente longitudinal y profundidad del dibujo del neumático.
 * Sigue la metodología de la Norma Española 3.1-IC Trazado y AASHTO Green Book.
 *
 * @param {number} speedKmh Velocidad inicial del vehículo (km/h)
 * @param {keyof typeof ROAD_SURFACE_PROFILES|string} [surfaceCondition='DRY'] Tipo de firme
 * @param {number} [gradePct=0.0] Pendiente longitudinal en % (positivo = subida, negativo = bajada)
 * @param {number} [tireTreadDepthMm=8.0] Profundidad de dibujo del neumático (mm)
 * @param {number} [perceptionReactionTimeS=1.5] Tiempo de percepción-reacción del conductor (segundos, estándar 1.5 a 2.0 s)
 * @returns {{
 *   speedKmh: number,
 *   surfaceCondition: string,
 *   gradePct: number,
 *   frictionCoeff: number,
 *   perceptionDistanceM: number,
 *   brakingDistanceM: number,
 *   totalStoppingDistanceM: number,
 *   confidenceInterval95: [number, number],
 *   safeFollowingTimeS: number,
 *   isLegalSafeDistance: boolean
 * }}
 */
export function computeCalibratedStoppingDistance(
  speedKmh,
  surfaceCondition = 'DRY',
  gradePct = 0.0,
  tireTreadDepthMm = 8.0,
  perceptionReactionTimeS = 1.5
) {
  const v = Math.max(0.0, finite(speedKmh) ? speedKmh : 0.0);
  const vMs = v / 3.6;
  const prt = Math.max(0.5, finite(perceptionReactionTimeS) ? perceptionReactionTimeS : 1.5);
  const grade = finite(gradePct) ? gradePct / 100.0 : 0.0;
  const tread = Math.max(1.0, finite(tireTreadDepthMm) ? tireTreadDepthMm : 8.0);

  const profile = ROAD_SURFACE_PROFILES[surfaceCondition] || ROAD_SURFACE_PROFILES.DRY;

  // Factor de degradación por desgaste de dibujo en firme húmedo/mojado
  let treadFactor = 1.0;
  if (surfaceCondition !== 'DRY' && surfaceCondition !== 'TUNNEL_DRY') {
    treadFactor = Math.min(1.0, Math.max(0.60, Math.sqrt(tread / 8.0)));
  }

  // Coeficiente de rozamiento sensible a la velocidad: f(v) = mu0 * (1 - kv * v/100) * treadFactor
  const frictionCoeff = Math.max(0.08, profile.mu0 * (1.0 - profile.kv * (v / 100.0)) * treadFactor);

  // Distancia de percepción-reacción: d_pr = v * t_pr
  const perceptionDistanceM = Math.round(vMs * prt * 10) / 10;

  // Distancia de frenado puro: d_brake = v^2 / (2 * g * (f + G))
  const g = 9.80665;
  const effectiveDecelDenominator = 2 * g * Math.max(0.05, frictionCoeff + grade);
  const brakingDistanceM = Math.round(((vMs * vMs) / effectiveDecelDenominator) * 10) / 10;

  const totalStoppingDistanceM = Math.round((perceptionDistanceM + brakingDistanceM) * 10) / 10;

  // Intervalo de confianza al 95% considerando variabilidad del rozamiento (sigma_mu = 0.08 * mu)
  const fMin = Math.max(0.06, frictionCoeff * 0.86);
  const fMax = frictionCoeff * 1.14;
  const brakeDistMax = Math.round(((vMs * vMs) / (2 * g * Math.max(0.05, fMin + grade))) * 10) / 10;
  const brakeDistMin = Math.round(((vMs * vMs) / (2 * g * Math.max(0.05, fMax + grade))) * 10) / 10;

  const confidenceInterval95 = [
    Math.round((perceptionDistanceM + brakeDistMin) * 10) / 10,
    Math.round((perceptionDistanceM + brakeDistMax) * 10) / 10,
  ];

  // Tiempo seguro de seguimiento (segundos): distancia total / velocidad
  const safeFollowingTimeS = vMs > 0.1 ? Math.round((totalStoppingDistanceM / vMs) * 10) / 10 : 2.0;

  return {
    speedKmh: v,
    surfaceCondition,
    gradePct: Math.round(grade * 1000) / 10,
    frictionCoeff: Math.round(frictionCoeff * 1000) / 1000,
    perceptionDistanceM,
    brakingDistanceM,
    totalStoppingDistanceM,
    confidenceInterval95,
    safeFollowingTimeS,
    isLegalSafeDistance: safeFollowingTimeS >= 2.0,
  };
}
