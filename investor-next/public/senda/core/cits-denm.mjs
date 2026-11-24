/**
 * SENDA · Interoperabilidad ETSI C-ITS DENM (EN 302 637-3 V1.3.1 / TS 102 894-2 CDD, 0 €, sin red).
 *
 * Implementa el formato normalizado europeo de Avisos Ambientales Descentralizados (DENM) que hablan
 * los vehículos C-ITS, la plataforma DGT 3.0 (V-16 conectada) y NDW / Talking Traffic en Países Bajos:
 *  - Códigos oficiales de causa ETSI TS 102 894-2 (accident=2, roadworks=3, adverseWeatherAdhesion=6,
 *    animal=11, wrongWay=14, visibility=18, endOfQueue=27, vehicleBreakdown/V-16=91, stationary=94,
 *    collisionRisk=97, dangerousSituation=99).
 *  - Marca temporal oficial `TimestampIts` (ms desde 2004-01-01T00:00:00Z en escala TAI, +5 s intercalares
 *    desde 2004 hasta 2026) y coordenadas WGS84 en décimas de microgrado (1e7).
 *  - Códec binario compacto de 36 bytes con CRC-16-CCITT (`MAGIC = 0xD3`) apto para una sola trama
 *    BLE 5 Extended Advertising, LoRa SF12 o SMS sin red, además de JSON canónico ETSI DENM.
 */
import { haversineM } from './route-planner.mjs';

export const DENM_PROTOCOL_VERSION = 2;
export const DENM_MESSAGE_ID = 1; // ETSI TS 102 894-2 ItsPduHeader.messageID = denm(1)
export const DENM_COMPACT_MAGIC = 0xd3;
export const DENM_COMPACT_BYTES = 36;

// Época TAI ETSI ITS: 2004-01-01T00:00:00Z; entre 2004 y 2026 hubo 5 segundos intercalares (2005,2008,2012,2015,2016)
export const ETSI_ITS_EPOCH_MS = Date.UTC(2004, 0, 1, 0, 0, 0);
export const LEAP_SECONDS_SINCE_2004 = 5;

export const ETSI_CAUSE_CODES = Object.freeze({
  TRAFFIC_CONDITION: 1,
  ACCIDENT: 2,
  ROADWORKS: 3,
  ADVERSE_WEATHER_ADHESION: 6,
  HAZARDOUS_SURFACE: 9,
  ANIMAL_ON_ROAD: 11,
  WRONG_WAY_DRIVING: 14,
  ADVERSE_WEATHER_VISIBILITY: 18,
  SLOW_VEHICLE: 26,
  DANGEROUS_END_OF_QUEUE: 27,
  VEHICLE_BREAKDOWN: 91, // V-16 conectada DGT 3.0 / avería
  STATIONARY_VEHICLE: 94,
  EMERGENCY_VEHICLE_APPROACHING: 95,
  COLLISION_RISK: 97,
  DANGEROUS_SITUATION: 99,
});

const SENDA_TO_ETSI = Object.freeze({
  retencion: { causeCode: 1, subCauseCode: 1 },
  accidente: { causeCode: 2, subCauseCode: 0 },
  obras: { causeCode: 3, subCauseCode: 0 },
  hielo: { causeCode: 6, subCauseCode: 2 },
  animal: { causeCode: 11, subCauseCode: 0 },
  niebla: { causeCode: 18, subCauseCode: 1 },
  parado: { causeCode: 94, subCauseCode: 1 },
  v16: { causeCode: 91, subCauseCode: 0 },
  obstaculo: { causeCode: 99, subCauseCode: 0 },
  puente: { causeCode: 3, subCauseCode: 6 },
});

const ETSI_TO_SENDA = Object.freeze({
  1: 'retencion',
  2: 'accidente',
  3: 'obras',
  6: 'hielo',
  11: 'animal',
  18: 'niebla',
  27: 'retencion',
  91: 'parado',
  94: 'parado',
  97: 'accidente',
  99: 'obstaculo',
});

export function utcMsToTimestampIts(utcMs) {
  return Math.max(0, Math.round(utcMs - ETSI_ITS_EPOCH_MS + LEAP_SECONDS_SINCE_2004 * 1000));
}

export function timestampItsToUtcMs(tsIts) {
  return Math.round(tsIts + ETSI_ITS_EPOCH_MS - LEAP_SECONDS_SINCE_2004 * 1000);
}

/** CRC-16-CCITT (polinomio 0x1021, semilla 0xFFFF) para tramas binarias compactas DENM. */
export function crc16Ccitt(bytes, len = bytes.length) {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/**
 * Convierte un aviso SENDA / DGT / NDW en un objeto canónico ETSI EN 302 637-3 DENM.
 */
export function sendaToDenm({
  kind = 'obstaculo',
  lat,
  lon,
  headingDeg = null,
  tMs = Date.now(),
  stationId = 0,
  sequenceNumber = 1,
  validityDurationS = 600,
  relevanceDistanceM = 1000,
  informationQuality = 4, // 0=desconocido .. 7=máxima (ETSI CDD)
} = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('DENM: lat/lon obligatorios');
  const map = SENDA_TO_ETSI[kind] ?? { causeCode: 99, subCauseCode: 0 };
  const tsIts = utcMsToTimestampIts(tMs);
  return {
    standard: 'ETSI EN 302 637-3 V1.3.1 (DENM)',
    header: {
      protocolVersion: DENM_PROTOCOL_VERSION,
      messageID: DENM_MESSAGE_ID,
      stationID: stationId >>> 0,
    },
    denm: {
      management: {
        actionID: { originatingStationID: stationId >>> 0, sequenceNumber: sequenceNumber & 0xffff },
        detectionTime: tsIts,
        referenceTime: tsIts,
        eventPosition: {
          latitude: Math.round(lat * 1e7),   // 0,1 microgrado (ETSI TS 102 894-2)
          longitude: Math.round(lon * 1e7),
        },
        relevanceDistanceM: Math.max(50, Math.min(10000, Math.round(relevanceDistanceM))),
        validityDurationS: Math.max(1, Math.min(86400, Math.round(validityDurationS))),
        stationType: 5, // passengerCar(5)
      },
      situation: {
        informationQuality: Math.max(0, Math.min(7, Math.round(informationQuality))),
        eventType: { causeCode: map.causeCode, subCauseCode: map.subCauseCode },
      },
      location: {
        eventPositionHeadingDeg: headingDeg != null && Number.isFinite(headingDeg) ? +(((headingDeg % 360) + 360) % 360).toFixed(1) : null,
      },
    },
  };
}

/** Convierte un DENM ETSI canónico de vuelta al formato de aviso SENDA. */
export function denmToSenda(msg) {
  const m = msg?.denm?.management;
  const s = msg?.denm?.situation;
  if (!m?.eventPosition || !s?.eventType) throw new Error('DENM: estructura no válida');
  const cause = s.eventType.causeCode;
  return {
    kind: ETSI_TO_SENDA[cause] ?? 'obstaculo',
    causeCode: cause,
    subCauseCode: s.eventType.subCauseCode ?? 0,
    lat: +(m.eventPosition.latitude / 1e7).toFixed(7),
    lon: +(m.eventPosition.longitude / 1e7).toFixed(7),
    headingDeg: msg.denm?.location?.eventPositionHeadingDeg ?? null,
    t: timestampItsToUtcMs(m.detectionTime),
    stationId: m.actionID?.originatingStationID ?? 0,
    sequenceNumber: m.actionID?.sequenceNumber ?? 0,
    validityDurationS: m.validityDurationS ?? 600,
    relevanceDistanceM: m.relevanceDistanceM ?? 1000,
    informationQuality: s.informationQuality ?? 0,
    source: 'C-ITS_DENM',
  };
}

export const isDenmCompact = (bytes) => bytes instanceof Uint8Array && bytes.length === DENM_COMPACT_BYTES && bytes[0] === DENM_COMPACT_MAGIC;

/**
 * Codifica un DENM ETSI en 36 bytes compactos con CRC-16-CCITT para BLE 5 / LoRa / SMS sin red:
 *   [0] MAGIC 0xD3 | [1] protoVer(2) | [2..5] stationID u32 | [6..7] seq u16
 *   [8..11] detectionTimeSec (s desde época ITS 2004) u32 | [12..15] lat*1e7 i32 | [16..19] lon*1e7 i32
 *   [20] causeCode u8 | [21] subCauseCode u8 | [22] infoQuality u8 | [23..24] heading*10 u16 (0xFFFF=null)
 *   [25..26] validityS u16 | [27..28] relevanceM u16 | [29..33] reserved(0) | [34..35] CRC-16-CCITT
 */
export function encodeDenmCompact(denmObj) {
  const m = denmObj?.denm?.management;
  const s = denmObj?.denm?.situation;
  if (!m?.eventPosition || !s?.eventType) throw new Error('DENM compacto: objeto no válido');
  const buf = new ArrayBuffer(DENM_COMPACT_BYTES), dv = new DataView(buf), u = new Uint8Array(buf);
  const hdg = denmObj.denm?.location?.eventPositionHeadingDeg;
  dv.setUint8(0, DENM_COMPACT_MAGIC);
  dv.setUint8(1, DENM_PROTOCOL_VERSION);
  dv.setUint32(2, (m.actionID?.originatingStationID ?? 0) >>> 0);
  dv.setUint16(6, (m.actionID?.sequenceNumber ?? 0) & 0xffff);
  dv.setUint32(8, Math.floor((m.detectionTime ?? 0) / 1000) >>> 0);
  dv.setInt32(12, Math.round(m.eventPosition.latitude));
  dv.setInt32(16, Math.round(m.eventPosition.longitude));
  dv.setUint8(20, s.eventType.causeCode & 0xff);
  dv.setUint8(21, (s.eventType.subCauseCode ?? 0) & 0xff);
  dv.setUint8(22, (s.informationQuality ?? 0) & 0x07);
  dv.setUint16(23, hdg != null && Number.isFinite(hdg) ? Math.round(hdg * 10) : 0xffff);
  dv.setUint16(25, Math.min(65535, Math.max(1, Math.round(m.validityDurationS ?? 600))));
  dv.setUint16(27, Math.min(65535, Math.max(50, Math.round(m.relevanceDistanceM ?? 1000))));
  dv.setUint16(34, crc16Ccitt(u, 34));
  return u;
}

/** Decodifica y verifica CRC-16-CCITT de una trama DENM compacta de 36 bytes. */
export function decodeDenmCompact(bytes) {
  if (!isDenmCompact(bytes)) throw new Error('DENM compacto: cabecera o tamaño inválido');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gotCrc = dv.getUint16(34), expCrc = crc16Ccitt(bytes, 34);
  if (gotCrc !== expCrc) throw new Error('DENM compacto: CRC-16 corrupto');
  const hdgRaw = dv.getUint16(23);
  const causeCode = dv.getUint8(20), subCauseCode = dv.getUint8(21);
  const tsIts = dv.getUint32(8) * 1000;
  return {
    standard: 'ETSI EN 302 637-3 V1.3.1 (DENM)',
    header: { protocolVersion: dv.getUint8(1), messageID: DENM_MESSAGE_ID, stationID: dv.getUint32(2) },
    denm: {
      management: {
        actionID: { originatingStationID: dv.getUint32(2), sequenceNumber: dv.getUint16(6) },
        detectionTime: tsIts,
        referenceTime: tsIts,
        eventPosition: { latitude: dv.getInt32(12), longitude: dv.getInt32(16) },
        validityDurationS: dv.getUint16(25),
        relevanceDistanceM: dv.getUint16(27),
        stationType: 5,
      },
      situation: {
        informationQuality: dv.getUint8(22),
        eventType: { causeCode, subCauseCode },
      },
      location: { eventPositionHeadingDeg: hdgRaw === 0xffff ? null : +(hdgRaw / 10).toFixed(1) },
    },
  };
}

/** Comprueba si una posición `[lon, lat]` está dentro del área y ventana temporal de relevancia de un DENM. */
export function isInsideDenmRelevance(denmObj, pos, nowMs = Date.now()) {
  const s = denmToSenda(denmObj);
  const ageS = (nowMs - s.t) / 1000;
  if (ageS < -30 || ageS > s.validityDurationS) return { relevant: false, reason: 'caducado', distM: null };
  const distM = Math.round(haversineM(pos, [s.lon, s.lat]));
  return { relevant: distM <= s.relevanceDistanceM, reason: distM <= s.relevanceDistanceM ? 'dentro_area' : 'fuera_area', distM };
}
