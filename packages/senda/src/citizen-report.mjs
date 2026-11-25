/**
 * SENDA · Entrada ciudadana multimodal, privacidad por diseño y cadena de evidencia inmutable.
 *
 * Un único formato de sobre firmado con Ed25519 (WebCrypto) para avisos de ciudadanía:
 * foto, vídeo, audio, texto, ubicación, SOS y compartir. Incluye:
 *  - Hora con zona horaria obligatoria (ISO-8601 con Z o ±HH:MM), posición con precisión,
 *    orientación de cámara y lecturas de sensores móviles (acelerómetro, barómetro).
 *  - Consentimiento explícito obligatorio y minimización de datos.
 *  - Redacción de privacidad antes de compartir: borrado de segmentos EXIF/IPTC en JPEG
 *    (`stripJpegExif`), difuminado/pixelado real de regiones de caras y matrículas en RGBA
 *    (`redactRgbaRegions`) y difuminado espacial opcional (`fuzzLocation`).
 *  - Adaptadores multicanal reutilizando `envelope.mjs` (cifrado E2E), `hazard-reports.mjs`
 *    (línea compacta SND3 de 160 caracteres para SMS/satélite), `erasure.mjs` / `courier.mjs`
 *    (fragmentos Reed-Solomon k-de-n), `hazard-share.mjs` (malla BLE), QR multiparte y URI RFC 5870 `geo:`.
 *  - Cadena de evidencia inmutable con JSON canónico (inspirado en RFC 8785 / JCS), enlaces
 *    SHA-256 `prevHash`, separación estricta entre ausencia observada (`ABSENT`) y fallo de
 *    recolección (`COLLECTION_ERROR`), y estado operacional obligatorio (`ACTUAL | EXERCISE | SIMULATION | TEST`).
 *
 * Referencias:
 *  - RFC 8032 (Edwards-Curve Digital Signature Algorithm — Ed25519).
 *  - RFC 8785 (JSON Canonicalization Scheme — JCS).
 *  - RFC 5870 (A Uniform Resource Identifier for Geographic Locations — `geo:` URI).
 *  - Reglamento (UE) 2016/679 (RGPD), arts. 5 (minimización) y 6/7 (consentimiento explícito).
 *
 * Regla de veracidad y autoridad (CLAUDE.md): ningún sobre ciudadano activa `canPublicWarn`.
 */

import { b64, unb64 } from './b64.mjs';
import { encodeReport } from './hazard-reports.mjs';
import { sealMessage, packEnvelope } from './envelope.mjs';
import { encodeShards, packShard, createReassembler } from './erasure.mjs';
import { packReports } from './hazard-share.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const CITIZEN_REPORT_SCHEMA = 'senda.citizen-report/v1';
export const QR_CHUNK_PREFIX = 'SENDA-CRQ1';

/** Tipos de peligro admitidos en el peritaje ciudadano multimodal. */
export const CITIZEN_HAZARD_TYPES = Object.freeze({
  fuego: Object.freeze({
    id: 'fuego',
    family: 'FIRE',
    hazardReportKind: 'FIRE',
    capCategory: 'Fire',
    roadShareKind: null,
    baseSeverity: 0.8,
    lifeRisk: true,
    label: 'Incendio o columna de humo',
  }),
  combustible: Object.freeze({
    id: 'combustible',
    family: 'FIRE',
    hazardReportKind: 'SMOKE',
    capCategory: 'Env',
    roadShareKind: null,
    baseSeverity: 0.45,
    lifeRisk: false,
    label: 'Acumulación de combustible forestal / monte seco',
  }),
  inundacion: Object.freeze({
    id: 'inundacion',
    family: 'WATER',
    hazardReportKind: 'STREET_FLOODED',
    capCategory: 'Met',
    roadShareKind: null,
    baseSeverity: 0.85,
    lifeRisk: true,
    label: 'Inundación o agua en calzada/viviendas',
  }),
  nivel_agua: Object.freeze({
    id: 'nivel_agua',
    family: 'WATER',
    hazardReportKind: 'RIVER_RISING',
    capCategory: 'Met',
    roadShareKind: null,
    baseSeverity: 0.7,
    lifeRisk: false,
    label: 'Subida de nivel en río, rambla o presa',
  }),
  desprendimiento: Object.freeze({
    id: 'desprendimiento',
    family: 'GEO',
    hazardReportKind: 'ROAD_BLOCKED',
    capCategory: 'Geo',
    roadShareKind: 'obstaculo',
    baseSeverity: 0.75,
    lifeRisk: true,
    label: 'Desprendimiento de ladera, rocas o talud',
  }),
  carretera: Object.freeze({
    id: 'carretera',
    family: 'ROAD',
    hazardReportKind: 'ROAD_BLOCKED',
    capCategory: 'Transport',
    roadShareKind: 'obstaculo',
    baseSeverity: 0.55,
    lifeRisk: false,
    label: 'Carretera cortada, obstáculo o calzada dañada',
  }),
  visibilidad: Object.freeze({
    id: 'visibilidad',
    family: 'ROAD',
    hazardReportKind: 'ROAD_BLOCKED',
    capCategory: 'Met',
    roadShareKind: 'niebla',
    baseSeverity: 0.5,
    lifeRisk: false,
    label: 'Visibilidad reducida (niebla, humo o polvo)',
  }),
  accidente: Object.freeze({
    id: 'accidente',
    family: 'ROAD',
    hazardReportKind: 'CAR_SWEPT',
    capCategory: 'Transport',
    roadShareKind: 'accidente',
    baseSeverity: 0.9,
    lifeRisk: true,
    label: 'Accidente con posibles víctimas o riesgo vial',
  }),
  ferrocarril: Object.freeze({
    id: 'ferrocarril',
    family: 'RAIL',
    hazardReportKind: 'COLLAPSE',
    capCategory: 'Transport',
    roadShareKind: null,
    baseSeverity: 0.9,
    lifeRisk: true,
    label: 'Incidencia en vía férrea, paso a nivel o tren',
  }),
  sos: Object.freeze({
    id: 'sos',
    family: 'STRUCTURE',
    hazardReportKind: 'PERSON_TRAPPED',
    capCategory: 'Rescue',
    roadShareKind: null,
    baseSeverity: 1.0,
    lifeRisk: true,
    label: 'SOS · Persona atrapada o peligro inmediato para la vida',
  }),
  otro: Object.freeze({
    id: 'otro',
    family: 'OTHER',
    hazardReportKind: 'ROAD_BLOCKED',
    capCategory: 'Safety',
    roadShareKind: null,
    baseSeverity: 0.4,
    lifeRisk: false,
    label: 'Otro peligro civil relevante',
  }),
});

export const REPORT_MODALITIES = Object.freeze([
  'foto',
  'video',
  'audio',
  'texto',
  'ubicacion',
  'sos',
  'compartir',
]);

/** Estado operacional obligatorio (sin valor por defecto para impedir fuga de simulaciones a alertas reales). */
export const OPERATIONAL_STATUSES = Object.freeze(['ACTUAL', 'EXERCISE', 'SIMULATION', 'TEST']);

/** Estados epistémicos de confianza (adaptado de Civil Sentry con CONTRADICTED de primer orden). */
export const CONFIDENCE_STATES = Object.freeze([
  'VERIFIED',
  'SUPPORTED',
  'INFERRED',
  'UNKNOWN',
  'CONTRADICTED',
]);

/** Distinción explícita entre dato observado, ausencia observada y fallo de sensor/red. */
export const OBSERVATION_STATUSES = Object.freeze(['OBSERVED', 'ABSENT', 'COLLECTION_ERROR']);

const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

/* ───────────── 1. Serialización canónica y SHA-256 (WebCrypto) ───────────── */

/**
 * Serialización JSON determinista con claves ordenadas lexicográficamente (estilo RFC 8785 / JCS).
 * Rechaza NaN, Infinity, funciones y undefined en raíz para evitar ambigüedad entre nodos.
 */
export function canonicalJson(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalJson: número no finito no permitido');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',') + '}';
  }
  throw new TypeError(`canonicalJson: tipo no serializable (${t})`);
}

function bytesToHex(u8) {
  let out = '';
  for (let i = 0; i < u8.length; i++) out += u8[i].toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 en hexadecimal (minúsculas) sobre Uint8Array o string UTF-8. */
export async function sha256HexBytes(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = await subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

/** SHA-256 en hexadecimal del JSON canónico de cualquier objeto serializable. */
export async function sha256HexCanonical(obj) {
  return sha256HexBytes(enc.encode(canonicalJson(obj)));
}

/* ───────────── 2. Claves Ed25519 seudónimas del emisor ───────────── */

/** Genera un par de claves Ed25519 y su seudónimo público (huella SHA-256 truncada, sin PII). */
export async function createCitizenKeyPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const pseudonymId = await pseudonymIdFromPublicRaw(publicRaw);
  return { privateKey: kp.privateKey, publicKey: kp.publicKey, publicRaw, pseudonymId };
}

/** Identificador seudónimo estable derivado únicamente de la clave pública Ed25519 (sin datos personales). */
export async function pseudonymIdFromPublicRaw(publicRaw) {
  if (!(publicRaw instanceof Uint8Array) || publicRaw.length !== 32) {
    throw new TypeError('clave pública Ed25519 debe tener exactamente 32 bytes');
  }
  const digest = new Uint8Array(await subtle.digest('SHA-256', publicRaw));
  return 'pse_' + b64(digest.subarray(0, 12));
}

export async function exportCitizenKeyPair(kp) {
  return {
    privateJwk: await subtle.exportKey('jwk', kp.privateKey),
    publicRawB64u: b64(kp.publicRaw),
    pseudonymId: kp.pseudonymId,
  };
}

export async function importCitizenKeyPair({ privateJwk, publicRawB64u }) {
  const privateKey = await subtle.importKey('jwk', privateJwk, { name: 'Ed25519' }, true, ['sign']);
  const publicRaw = unb64(publicRawB64u);
  const publicKey = await subtle.importKey('raw', publicRaw, { name: 'Ed25519' }, true, ['verify']);
  return { privateKey, publicKey, publicRaw, pseudonymId: await pseudonymIdFromPublicRaw(publicRaw) };
}

/* ───────────── 3. Privacidad por diseño: EXIF, difuminado y consentimiento ───────────── */

/**
 * Elimina segmentos de metadatos personales (APP1 EXIF/XMP, APP2 ICC opcionalmente conservado,
 * APP13 IPTC y comentarios COM 0xFFFE) de un búfer JPEG sin recodificar la imagen.
 * Si no es JPEG, falla de forma explícita para no dar falsa sensación de limpieza.
 */
export async function stripJpegExif(jpegBytes) {
  const u = jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes);
  if (u.length < 4 || u[0] !== 0xff || u[1] !== 0xd8) {
    throw new TypeError('stripJpegExif: el búfer no comienza con la marca SOI de JPEG (FFD8)');
  }
  const originalSha256 = await sha256HexBytes(u);
  const kept = [u.subarray(0, 2)];
  const strippedSegments = [];
  let pos = 2;
  while (pos < u.length) {
    if (u[pos] !== 0xff) {
      // Datos comprimidos tras SOS o relleno anómalo: copiar el resto íntegro.
      kept.push(u.subarray(pos));
      break;
    }
    while (pos < u.length && u[pos] === 0xff) pos++;
    if (pos >= u.length) break;
    const marker = u[pos];
    pos++;
    if (marker === 0xd9) {
      // EOI
      kept.push(new Uint8Array([0xff, 0xd9]));
      break;
    }
    if (marker === 0xda) {
      // SOS (Start of Scan): de aquí al final van los datos de imagen hasta EOI.
      kept.push(new Uint8Array([0xff, marker]));
      kept.push(u.subarray(pos));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(new Uint8Array([0xff, marker]));
      continue;
    }
    if (pos + 2 > u.length) throw new RangeError('stripJpegExif: segmento JPEG truncado');
    const segLen = (u[pos] << 8) | u[pos + 1];
    if (segLen < 2 || pos + segLen > u.length) throw new RangeError('stripJpegExif: longitud de segmento JPEG inválida');
    // Eliminar APP1 (0xE1: EXIF/XMP), APP13 (0xED: IPTC) y COM (0xFE: comentario).
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      strippedSegments.push(`0xFF${marker.toString(16).toUpperCase()}`);
    } else {
      kept.push(new Uint8Array([0xff, marker]));
      kept.push(u.subarray(pos, pos + segLen));
    }
    pos += segLen;
  }
  const totalLen = kept.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const chunk of kept) {
    out.set(chunk, off);
    off += chunk.length;
  }
  const redactedSha256 = await sha256HexBytes(out);
  return {
    bytes: out,
    strippedSegments,
    originalSha256,
    redactedSha256,
    exifStripped: true,
  };
}

/**
 * Difumina (pixelado determinista por bloques) las regiones declaradas (caras y matrículas)
 * sobre una imagen RGBA sin mutar el búfer original.
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @param {Array<{x:number,y:number,w:number,h:number,label?:'face'|'plate'|'other'}>} boxes
 * @param {{blockSize:number}} opts  blockSize obligatorio (≥ 4 px)
 */
export async function redactRgbaRegions(rgba, width, height, boxes, { blockSize } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('redactRgbaRegions: dimensiones inválidas');
  }
  if (rgba.length !== width * height * 4) {
    throw new RangeError('redactRgbaRegions: longitud RGBA no coincide con width*height*4');
  }
  if (!Number.isInteger(blockSize) || blockSize < 4) {
    throw new RangeError('redactRgbaRegions: blockSize obligatorio (entero ≥ 4 píxeles)');
  }
  if (!Array.isArray(boxes)) throw new TypeError('redactRgbaRegions: boxes debe ser un array');

  const originalSha256 = await sha256HexBytes(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength));
  const out = new Uint8ClampedArray(rgba);
  const applied = [];

  for (const b of boxes) {
    if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue;
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(width, Math.ceil(b.x + b.w));
    const y1 = Math.min(height, Math.ceil(b.y + b.h));
    if (x1 <= x0 || y1 <= y0) continue;

    for (let by = y0; by < y1; by += blockSize) {
      const ey = Math.min(y1, by + blockSize);
      for (let bx = x0; bx < x1; bx += blockSize) {
        const ex = Math.min(x1, bx + blockSize);
        let r = 0, g = 0, bl = 0, a = 0, cnt = 0;
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const idx = (y * width + x) * 4;
            r += out[idx];
            g += out[idx + 1];
            bl += out[idx + 2];
            a += out[idx + 3];
            cnt++;
          }
        }
        const mr = Math.round(r / cnt);
        const mg = Math.round(g / cnt);
        const mb = Math.round(bl / cnt);
        const ma = Math.round(a / cnt);
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const idx = (y * width + x) * 4;
            out[idx] = mr;
            out[idx + 1] = mg;
            out[idx + 2] = mb;
            out[idx + 3] = ma;
          }
        }
      }
    }
    applied.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, label: b.label ?? 'redacted' });
  }

  const redactedSha256 = await sha256HexBytes(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
  return {
    rgba: out,
    width,
    height,
    blockSize,
    regions: applied,
    redacted: applied.length > 0,
    originalSha256,
    redactedSha256,
  };
}

/**
 * Redondea coordenadas a una cuadrícula aproximada (en metros) para compartir públicamente
 * sin revelar el domicilio exacto de quien informa.
 */
export function fuzzLocation({ lat, lon }, gridMeters) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new RangeError('fuzzLocation: coordenadas inválidas');
  }
  if (!Number.isFinite(gridMeters) || gridMeters <= 0) {
    throw new RangeError('fuzzLocation: gridMeters obligatorio (> 0 m)');
  }
  const dLat = gridMeters / 111_320;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLon = gridMeters / (111_320 * cosLat);
  return {
    lat: +(Math.round(lat / dLat) * dLat).toFixed(5),
    lon: +(Math.round(lon / dLon) * dLon).toFixed(5),
    gridMeters,
    fuzzed: true,
  };
}

/** Valida y congela el registro de consentimiento explícito del ciudadano. */
export function createConsentRecord({
  accepted,
  purpose = 'peritaje_civil_emergencia',
  shareWithAuthorities = true,
  allowVerificationByPassersby = false,
  redactBeforeShare = true,
  consentVersion,
  acceptedAtIso,
} = {}) {
  if (accepted !== true) {
    throw new Error('CONSENT_REQUIRED: se requiere consentimiento explícito (accepted: true)');
  }
  if (typeof consentVersion !== 'string' || !consentVersion.trim()) {
    throw new TypeError('CONSENT_VERSION_REQUIRED: falta consentVersion');
  }
  if (typeof acceptedAtIso !== 'string' || !ISO_WITH_TZ.test(acceptedAtIso) || !Number.isFinite(Date.parse(acceptedAtIso))) {
    throw new RangeError('CONSENT_TIMESTAMP_INVALID: acceptedAtIso debe incluir zona horaria explícita (ISO-8601)');
  }
  return Object.freeze({
    accepted: true,
    purpose: String(purpose),
    shareWithAuthorities: Boolean(shareWithAuthorities),
    allowVerificationByPassersby: Boolean(allowVerificationByPassersby),
    redactBeforeShare: Boolean(redactBeforeShare),
    consentVersion: consentVersion.trim(),
    acceptedAtIso,
  });
}

/* ───────────── 4. Creación y verificación del sobre ciudadano multimodal ───────────── */

function validateLocation(loc) {
  if (!loc || typeof loc !== 'object') throw new TypeError('ubicación obligatoria');
  const { lat, lon, accuracyM, altitudeM = null, source = 'GPS' } = loc;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError('coordenadas inválidas (lat ∈ [-90,90], lon ∈ [-180,180])');
  }
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100_000) {
    throw new RangeError('precisión de ubicación (accuracyM) obligatoria y en [0, 100000] m');
  }
  if (altitudeM !== null && (!Number.isFinite(altitudeM) || altitudeM < -500 || altitudeM > 9000)) {
    throw new RangeError('altitud fuera de rango terrestre [-500, 9000] m');
  }
  return Object.freeze({
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    accuracyM: +accuracyM.toFixed(1),
    altitudeM: altitudeM === null ? null : +altitudeM.toFixed(1),
    source: String(source),
  });
}

function validateCamera(cam) {
  if (cam == null) return null;
  if (typeof cam !== 'object') throw new TypeError('camera debe ser un objeto');
  const headingDeg = cam.headingDeg ?? null;
  const pitchDeg = cam.pitchDeg ?? null;
  const rollDeg = cam.rollDeg ?? null;
  const fovDeg = cam.fovDeg ?? null;
  if (headingDeg !== null && (!Number.isFinite(headingDeg) || headingDeg < 0 || headingDeg >= 360)) {
    throw new RangeError('camera.headingDeg debe estar en [0, 360)');
  }
  if (pitchDeg !== null && (!Number.isFinite(pitchDeg) || pitchDeg < -90 || pitchDeg > 90)) {
    throw new RangeError('camera.pitchDeg debe estar en [-90, 90]');
  }
  if (rollDeg !== null && (!Number.isFinite(rollDeg) || rollDeg < -180 || rollDeg > 180)) {
    throw new RangeError('camera.rollDeg debe estar en [-180, 180]');
  }
  if (fovDeg !== null && (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg > 180)) {
    throw new RangeError('camera.fovDeg debe estar en (0, 180]');
  }
  return Object.freeze({ headingDeg, pitchDeg, rollDeg, fovDeg });
}

function validateSensors(sensors) {
  if (sensors == null) return null;
  if (typeof sensors !== 'object') throw new TypeError('sensors debe ser un objeto');
  let accelMs2 = null;
  if (sensors.accelMs2 != null) {
    const { x, y, z } = sensors.accelMs2;
    if (![x, y, z].every(Number.isFinite)) throw new RangeError('sensors.accelMs2 requiere x, y, z finitos');
    accelMs2 = Object.freeze({ x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3) });
  }
  const barometerHpa = sensors.barometerHpa ?? null;
  if (barometerHpa !== null && (!Number.isFinite(barometerHpa) || barometerHpa < 300 || barometerHpa > 1100)) {
    throw new RangeError('sensors.barometerHpa fuera de rango físico [300, 1100] hPa');
  }
  const ambientTempC = sensors.ambientTempC ?? null;
  if (ambientTempC !== null && (!Number.isFinite(ambientTempC) || ambientTempC < -60 || ambientTempC > 80)) {
    throw new RangeError('sensors.ambientTempC fuera de rango [-60, 80] °C');
  }
  return Object.freeze({ accelMs2, barometerHpa, ambientTempC });
}

async function normalizeMediaItem(m) {
  if (!m || typeof m !== 'object') throw new TypeError('elemento multimedia inválido');
  if (!['foto', 'video', 'audio'].includes(m.modality)) {
    throw new RangeError(`modalidad multimedia no válida: ${m.modality}`);
  }
  let sha256 = m.sha256 ? String(m.sha256).toLowerCase() : null;
  let byteLength = m.byteLength ?? null;
  if (m.bytes != null) {
    const u = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes);
    sha256 = await sha256HexBytes(u);
    byteLength = u.length;
  }
  if (!sha256 || !SHA256_RE.test(sha256)) {
    throw new RangeError('cada elemento multimedia requiere bytes o sha256 válido (64 hex)');
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError('byteLength multimedia inválido');
  }
  return Object.freeze({
    modality: m.modality,
    mimeType: String(m.mimeType || 'application/octet-stream'),
    sha256,
    byteLength,
    width: Number.isInteger(m.width) ? m.width : null,
    height: Number.isInteger(m.height) ? m.height : null,
    durationS: Number.isFinite(m.durationS) ? +m.durationS.toFixed(2) : null,
    redacted: Boolean(m.redacted),
    exifStripped: Boolean(m.exifStripped),
    redactionRegionsCount: Number.isInteger(m.redactionRegionsCount) ? m.redactionRegionsCount : 0,
    perceptualHashHex: typeof m.perceptualHashHex === 'string' ? m.perceptualHashHex.toLowerCase() : null,
    c2paManifestPresent: Boolean(m.c2paManifestPresent),
    c2paIssuerClaim: typeof m.c2paIssuerClaim === 'string' ? m.c2paIssuerClaim : null,
    exifCapturedAtIso: typeof m.exifCapturedAtIso === 'string' ? m.exifCapturedAtIso : null,
    exifLocation: m.exifLocation && Number.isFinite(m.exifLocation.lat) && Number.isFinite(m.exifLocation.lon)
      ? Object.freeze({ lat: m.exifLocation.lat, lon: m.exifLocation.lon })
      : null,
  });
}

/**
 * Crea y firma un sobre ciudadano multimodal único (`senda.citizen-report/v1`).
 * Exige `operationalStatus`, `capturedAtIso` con zona horaria, `location` con `accuracyM` y `consent`.
 */
export async function createCitizenReport(input, keyPair) {
  if (!input || typeof input !== 'object') throw new TypeError('input obligatorio');
  if (!keyPair?.privateKey || !(keyPair?.publicRaw instanceof Uint8Array)) {
    throw new TypeError('se requiere keyPair Ed25519 (createCitizenKeyPair)');
  }
  if (!(input.kind in CITIZEN_HAZARD_TYPES)) {
    throw new RangeError(`tipo de peligro desconocido: ${input.kind}`);
  }
  if (!OPERATIONAL_STATUSES.includes(input.operationalStatus)) {
    throw new RangeError(`operationalStatus obligatorio (${OPERATIONAL_STATUSES.join(' | ')})`);
  }
  if (typeof input.capturedAtIso !== 'string' || !ISO_WITH_TZ.test(input.capturedAtIso) || !Number.isFinite(Date.parse(input.capturedAtIso))) {
    throw new RangeError('capturedAtIso obligatorio con zona horaria explícita (ej. 2026-11-25T18:10:00+01:00)');
  }
  const modalities = [...new Set(Array.isArray(input.modalities) ? input.modalities : [])];
  if (!modalities.length || !modalities.every((m) => REPORT_MODALITIES.includes(m))) {
    throw new RangeError(`modalities debe ser una lista no vacía de: ${REPORT_MODALITIES.join(', ')}`);
  }

  const consent = createConsentRecord(input.consent);
  const location = validateLocation(input.location);
  const camera = validateCamera(input.camera);
  const sensors = validateSensors(input.sensors);
  const media = [];
  for (const item of input.media ?? []) {
    media.push(await normalizeMediaItem(item));
  }

  // Si hay consentimiento de redactar antes de compartir y hay foto/vídeo, advertir si aún no se redactó.
  const pendingRedaction = consent.redactBeforeShare && media.some((m) => (m.modality === 'foto' || m.modality === 'video') && !m.redacted);

  const text = typeof input.text === 'string' ? input.text.trim().slice(0, 2000) : '';
  const people = {
    trapped: Number.isSafeInteger(input.people?.trapped) && input.people.trapped >= 0 ? Math.min(255, input.people.trapped) : 0,
    injured: Number.isSafeInteger(input.people?.injured) && input.people.injured >= 0 ? Math.min(255, input.people.injured) : 0,
  };
  const measurement = input.measurement && typeof input.measurement === 'object' ? Object.freeze({ ...input.measurement }) : null;
  const groupHint = typeof input.groupHint === 'string' && input.groupHint.trim() ? input.groupHint.trim().slice(0, 64) : null;
  const channelOrigin = typeof input.channelOrigin === 'string' && input.channelOrigin.trim() ? input.channelOrigin.trim() : 'web';

  const payload = Object.freeze({
    schema: CITIZEN_REPORT_SCHEMA,
    basis: 'CITIZEN',
    operationalStatus: input.operationalStatus,
    kind: input.kind,
    modalities: Object.freeze(modalities),
    capturedAtIso: input.capturedAtIso,
    capturedAtMs: Date.parse(input.capturedAtIso),
    location,
    camera,
    sensors,
    text,
    people: Object.freeze(people),
    measurement,
    media: Object.freeze(media),
    consent,
    groupHint,
    channelOrigin,
    privacyFlags: Object.freeze({
      pendingRedaction,
      containsRawMediaBytes: false,
      piiMinimized: true,
    }),
  });

  const payloadBytes = enc.encode(canonicalJson(payload));
  const contentSha256 = await sha256HexBytes(payloadBytes);
  const sigBytes = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, payloadBytes));
  const pseudonymId = keyPair.pseudonymId ?? (await pseudonymIdFromPublicRaw(keyPair.publicRaw));
  const reportId = `cr_${contentSha256.slice(0, 20)}`;

  return Object.freeze({
    schema: CITIZEN_REPORT_SCHEMA,
    basis: 'CITIZEN',
    operationalStatus: input.operationalStatus,
    reportId,
    payload,
    contentSha256,
    signature: Object.freeze({
      alg: 'Ed25519',
      publicKeyB64u: b64(keyPair.publicRaw),
      pseudonymId,
      sigB64u: b64(sigBytes),
    }),
    // Regla permanente de SENDA: ningún reporte ciudadano puede emitir aviso público.
    canPublicWarn: false,
    individualHumanIdentityVerified: false,
  });
}

/**
 * Verifica de forma cerrada (fail-closed) un sobre ciudadano multimodal:
 * estructura, zona horaria, consentimiento, SHA-256 canónico, firma Ed25519 y seudónimo.
 */
export async function verifyCitizenReport(envelope) {
  const fail = (reason) => Object.freeze({ ok: false, reason, canPublicWarn: false });
  if (!envelope || typeof envelope !== 'object') return fail('ENVELOPE_MALFORMED');
  if (envelope.schema !== CITIZEN_REPORT_SCHEMA) return fail('UNSUPPORTED_SCHEMA');
  if (!envelope.payload || typeof envelope.payload !== 'object') return fail('PAYLOAD_MISSING');
  if (!OPERATIONAL_STATUSES.includes(envelope.operationalStatus) || envelope.payload.operationalStatus !== envelope.operationalStatus) {
    return fail('INVALID_OPERATIONAL_STATUS');
  }
  if (!(envelope.payload.kind in CITIZEN_HAZARD_TYPES)) return fail('UNKNOWN_HAZARD_KIND');
  if (typeof envelope.payload.capturedAtIso !== 'string' || !ISO_WITH_TZ.test(envelope.payload.capturedAtIso)) {
    return fail('MISSING_EXPLICIT_TIMEZONE');
  }
  const parsedMs = Date.parse(envelope.payload.capturedAtIso);
  if (!Number.isFinite(parsedMs) || parsedMs !== envelope.payload.capturedAtMs) {
    return fail('TIMESTAMP_MISMATCH');
  }
  if (envelope.payload.consent?.accepted !== true || !ISO_WITH_TZ.test(String(envelope.payload.consent?.acceptedAtIso ?? ''))) {
    return fail('INVALID_CONSENT');
  }
  const loc = envelope.payload.location;
  if (!loc || !Number.isFinite(loc.lat) || Math.abs(loc.lat) > 90 || !Number.isFinite(loc.lon) || Math.abs(loc.lon) > 180 || !Number.isFinite(loc.accuracyM) || loc.accuracyM < 0) {
    return fail('INVALID_LOCATION');
  }
  let payloadBytes;
  try {
    payloadBytes = enc.encode(canonicalJson(envelope.payload));
  } catch {
    return fail('NON_CANONICAL_PAYLOAD');
  }
  const computedHash = await sha256HexBytes(payloadBytes);
  if (computedHash !== envelope.contentSha256) return fail('CONTENT_HASH_MISMATCH');
  if (envelope.reportId !== `cr_${computedHash.slice(0, 20)}`) return fail('REPORT_ID_MISMATCH');

  const sig = envelope.signature;
  if (!sig || sig.alg !== 'Ed25519' || typeof sig.publicKeyB64u !== 'string' || typeof sig.sigB64u !== 'string') {
    return fail('SIGNATURE_SHAPE_INVALID');
  }
  let pubRaw, sigRaw;
  try {
    pubRaw = unb64(sig.publicKeyB64u);
    sigRaw = unb64(sig.sigB64u);
  } catch {
    return fail('SIGNATURE_ENCODING_INVALID');
  }
  if (pubRaw.length !== 32 || sigRaw.length !== 64) return fail('SIGNATURE_LENGTH_INVALID');
  const expectedPseudonym = await pseudonymIdFromPublicRaw(pubRaw);
  if (sig.pseudonymId !== expectedPseudonym) return fail('PSEUDONYM_MISMATCH');

  try {
    const pubKey = await subtle.importKey('raw', pubRaw, { name: 'Ed25519' }, false, ['verify']);
    const valid = await subtle.verify({ name: 'Ed25519' }, pubKey, sigRaw, payloadBytes);
    if (!valid) return fail('BAD_ED25519_SIGNATURE');
  } catch {
    return fail('SIGNATURE_VERIFICATION_ERROR');
  }

  return Object.freeze({
    ok: true,
    reportId: envelope.reportId,
    pseudonymId: expectedPseudonym,
    contentSha256: computedHash,
    operationalStatus: envelope.operationalStatus,
    canPublicWarn: false,
  });
}

/* ───────────── 5. Adaptadores de transporte (SMS/SND3, E2E, RS/Malla, QR, geo:, BLE) ───────────── */

/**
 * Convierte un sobre multimodal en una línea compacta `SND3` de 160 caracteres (reutiliza `hazard-reports.mjs`)
 * apta para SMS, mensajero satelital o módem acústico.
 */
export async function reportToCompactSnd3(envelope, keyPair) {
  const v = await verifyCitizenReport(envelope);
  if (!v.ok) throw new Error(`reportToCompactSnd3: sobre inválido (${v.reason})`);
  const meta = CITIZEN_HAZARD_TYPES[envelope.payload.kind];
  const r = {
    kind: meta.hazardReportKind,
    lat: envelope.payload.location.lat,
    lon: envelope.payload.location.lon,
    at: envelope.payload.capturedAtMs,
    people: envelope.payload.people,
    ...(envelope.payload.measurement?.rise ? { measurement: { rise: envelope.payload.measurement.rise } } : {}),
  };
  return encodeReport(r, { privateKey: keyPair.privateKey, publicRaw: keyPair.publicRaw });
}

/** Cifra el sobre multimodal de extremo a extremo para una sala de comité usando `envelope.mjs`. */
export async function reportToEncryptedAuthorityEnvelope(envelope, { senderIdentity, recipientPublicIdentity, priority = 7, ttlS = 86400, now }) {
  if (!Number.isFinite(now)) throw new TypeError('now (ms) obligatorio');
  const v = await verifyCitizenReport(envelope);
  if (!v.ok) throw new Error(`reportToEncryptedAuthorityEnvelope: sobre inválido (${v.reason})`);
  const sealed = await sealMessage({
    sender: senderIdentity,
    recipient: recipientPublicIdentity,
    body: canonicalJson(envelope),
    priority,
    ttlS,
    now,
    kind: envelope.payload.kind === 'sos' ? 'SOS' : 'COORDINATION',
  });
  return { envelope: sealed, binary: packEnvelope(sealed) };
}

/**
 * Fragmenta el sobre multimodal firmado en fragmentos Reed-Solomon k-de-n (`erasure.mjs` / `courier.mjs`)
 * para transmisión por malla BLE, LoRa, ficheros o múltiples portadores.
 */
export async function reportToCourierShards(envelope, { k, n, id } = {}) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 1 || n < k || n > 255) {
    throw new RangeError('reportToCourierShards: se requieren enteros 1 ≤ k ≤ n ≤ 255');
  }
  const v = await verifyCitizenReport(envelope);
  if (!v.ok) throw new Error(`reportToCourierShards: sobre inválido (${v.reason})`);
  const data = enc.encode(canonicalJson(envelope));
  if (data.length > 65535) throw new RangeError('sobre demasiado grande para empaquetado binario de fragmentos (> 65535 B)');
  const shardId = id instanceof Uint8Array && id.length >= 8 ? id.subarray(0, 8) : unb64(b64(new Uint8Array(await subtle.digest('SHA-256', data)).subarray(0, 8)));
  const encoded = encodeShards(data, k, n);
  const frames = encoded.shards.map((shardData, index) =>
    packShard({ id: shardId, k, n, len: data.length, index, data: shardData })
  );
  return { k, n, totalBytes: data.length, shardBytes: frames[0].length, frames };
}

/** Reconstruye y verifica un sobre multimodal a partir de k fragmentos cualesquiera (en cualquier orden). */
export async function reassembleCourierReport(frames, { via = 'MESH' } = {}) {
  const re = createReassembler();
  let done = null;
  for (const frame of frames) {
    done = re.add(frame, via);
    if (done) break;
  }
  if (!done) return { ok: false, reason: 'INCOMPLETE_SHARDS', pending: re.pending() };
  let parsed;
  try {
    parsed = JSON.parse(dec.decode(done.data));
  } catch {
    return { ok: false, reason: 'CORRUPT_JSON' };
  }
  const ver = await verifyCitizenReport(parsed);
  if (!ver.ok) return { ok: false, reason: ver.reason };
  return { ok: true, envelope: parsed, vias: done.via };
}

/** Divide un sobre firmado en cadenas compactas listas para códigos QR secuenciales sin red. */
export async function reportToQrChunks(envelope, { maxChunkChars = 600 } = {}) {
  if (!Number.isInteger(maxChunkChars) || maxChunkChars < 80) {
    throw new RangeError('maxChunkChars debe ser entero ≥ 80');
  }
  const v = await verifyCitizenReport(envelope);
  if (!v.ok) throw new Error(`reportToQrChunks: sobre inválido (${v.reason})`);
  const encoded = b64(enc.encode(canonicalJson(envelope)));
  const idShort = envelope.reportId.slice(3, 11);
  const chunks = [];
  const total = Math.ceil(encoded.length / maxChunkChars);
  for (let i = 0; i < total; i++) {
    chunks.push(`${QR_CHUNK_PREFIX}:${idShort}:${i + 1}/${total}:${encoded.slice(i * maxChunkChars, (i + 1) * maxChunkChars)}`);
  }
  return chunks;
}

/** Reensambla y verifica cadenas QR multiparte (tolera duplicados y desorden). */
export async function reassembleQrChunks(chunks) {
  const byId = new Map();
  for (const raw of chunks ?? []) {
    const m = String(raw).trim().match(/^SENDA-CRQ1:([a-f0-9]+):(\d+)\/(\d+):([A-Za-z0-9_-]+)$/);
    if (!m) continue;
    const [, id, idxStr, totalStr, part] = m;
    const idx = Number(idxStr), total = Number(totalStr);
    if (idx < 1 || idx > total || total > 64) continue;
    if (!byId.has(id)) byId.set(id, { total, parts: new Map() });
    byId.get(id).parts.set(idx, part);
  }
  for (const [id, entry] of byId.entries()) {
    if (entry.parts.size === entry.total) {
      let joined = '';
      for (let i = 1; i <= entry.total; i++) joined += entry.parts.get(i);
      try {
        const parsed = JSON.parse(dec.decode(unb64(joined)));
        const ver = await verifyCitizenReport(parsed);
        if (ver.ok) return { ok: true, id, envelope: parsed };
        return { ok: false, reason: ver.reason };
      } catch {
        return { ok: false, reason: 'QR_DECODE_ERROR' };
      }
    }
  }
  return { ok: false, reason: 'QR_INCOMPLETE' };
}

/** Exporta la posición del reporte como URI estándar RFC 5870 `geo:` para compartir por cualquier canal. */
export function reportToGeoUri(envelope) {
  const loc = envelope?.payload?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) {
    throw new TypeError('reportToGeoUri: sobre sin ubicación válida');
  }
  const alt = loc.altitudeM != null ? `,${loc.altitudeM}` : '';
  return `geo:${loc.lat},${loc.lon}${alt};u=${loc.accuracyM}`;
}

/** Parsea una URI `geo:lat,lon[,alt][;u=accuracy]` (RFC 5870). */
export function parseGeoUri(uri) {
  const m = String(uri).trim().match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?(?:;u=(\d+(?:\.\d+)?))?/i);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  const altitudeM = m[3] != null ? Number(m[3]) : null;
  const accuracyM = m[4] != null ? Number(m[4]) : null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, altitudeM, accuracyM };
}

/** Empaqueta reportes viales compatibles en tramas BLE compactas reutilizando `hazard-share.mjs`. */
export function reportToSharePack(envelopes, { now } = {}) {
  if (!Number.isFinite(now)) throw new TypeError('now (ms) obligatorio');
  const roadReports = [];
  for (const e of envelopes) {
    const roadKind = CITIZEN_HAZARD_TYPES[e?.payload?.kind]?.roadShareKind;
    if (!roadKind) continue;
    roadReports.push({
      kind: roadKind,
      lat: e.payload.location.lat,
      lon: e.payload.location.lon,
      t: e.payload.capturedAtMs,
    });
  }
  return packReports(roadReports, { now });
}

/* ───────────── 6. Cadena inmutable de evidencias y comparación temporal (Civil Sentry endurecido) ───────────── */

/**
 * Crea un registro de evidencia encadenada criptográficamente (SHA-256 sobre dato crudo + metadatos + prevHash).
 * Distingue explícitamente `OBSERVED`, `ABSENT` y `COLLECTION_ERROR` para no confundir fallos de red con ausencia.
 */
export function createEvidenceChain() {
  const entries = [];
  return {
    async append({
      runId,
      source,
      sourceType = 'CITIZEN',
      basis,
      observationStatus,
      confidence,
      observedAtIso,
      rawValue,
      normalizedValue = null,
      metadata = {},
    }) {
      if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('runId obligatorio');
      if (typeof source !== 'string' || !source.trim()) throw new TypeError('source obligatorio');
      if (!['MEASURED', 'OFFICIAL', 'ESTIMATED', 'MODEL', 'SCENARIO', 'CITIZEN'].includes(basis)) {
        throw new RangeError(`basis no válido: ${basis}`);
      }
      if (!OBSERVATION_STATUSES.includes(observationStatus)) {
        throw new RangeError(`observationStatus obligatorio (${OBSERVATION_STATUSES.join(' | ')})`);
      }
      if (!CONFIDENCE_STATES.includes(confidence)) {
        throw new RangeError(`confidence obligatorio (${CONFIDENCE_STATES.join(' | ')})`);
      }
      if (typeof observedAtIso !== 'string' || !ISO_WITH_TZ.test(observedAtIso)) {
        throw new RangeError('observedAtIso obligatorio con zona horaria explícita');
      }
      // Regla de veracidad: un error de recolección nunca puede declararse VERIFIED ni ABSENT.
      const effectiveConfidence = observationStatus === 'COLLECTION_ERROR' ? 'UNKNOWN' : confidence;
      const rawSha256 = await sha256HexCanonical(rawValue ?? null);
      const seq = entries.length;
      const prevHash = seq > 0 ? entries[seq - 1].entryHash : '0'.repeat(64);
      const id = `evd_${(await sha256HexCanonical([runId, source, observedAtIso, seq, rawSha256])).slice(0, 20)}`;
      const entryCore = {
        seq,
        prevHash,
        id,
        runId: runId.trim(),
        source: source.trim(),
        sourceType: String(sourceType),
        basis,
        observationStatus,
        confidence: effectiveConfidence,
        observedAtIso,
        rawSha256,
        normalizedValue,
        metadata: { redacted: Boolean(metadata?.redacted), ...metadata },
      };
      const entryHash = await sha256HexCanonical(entryCore);
      const frozen = Object.freeze({ ...entryCore, rawValue, entryHash });
      entries.push(frozen);
      return frozen;
    },
    entries: () => entries.map((e) => ({ ...e })),
    head: () => (entries.length ? entries[entries.length - 1].entryHash : '0'.repeat(64)),
  };
}

/**
 * Verifica integridad de toda la cadena de evidencia: hash de cada `rawValue`,
 * hash completo de metadatos (`entryHash`) y enlace criptográfico `prevHash`.
 */
export async function verifyEvidenceChainIntegrity(entries) {
  if (!Array.isArray(entries)) return { ok: false, brokenAt: 0, reason: 'NOT_AN_ARRAY' };
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i) return { ok: false, brokenAt: i, reason: 'SEQ_MISMATCH' };
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: i, reason: 'PREV_HASH_MISMATCH' };
    const rawSha256 = await sha256HexCanonical(e.rawValue ?? null);
    if (rawSha256 !== e.rawSha256) return { ok: false, brokenAt: i, reason: 'RAW_VALUE_TAMPERED' };
    const { rawValue: _raw, entryHash: storedHash, ...core } = e;
    const expectedHash = await sha256HexCanonical(core);
    if (expectedHash !== storedHash) return { ok: false, brokenAt: i, reason: 'METADATA_OR_CHAIN_TAMPERED' };
    prevHash = storedHash;
  }
  return { ok: true, length: entries.length, head: prevHash };
}

/**
 * Compara dos ejecuciones o instantáneas de evidencia (`T0` → `T1`) para emitir pruebas auditables
 * de escalada, remisión, contradicción o degradación de sensor (inspirado en Civil Sentry `compareRuns`).
 */
export function compareRunEvidence(runA = [], runB = []) {
  const byKey = (arr) => {
    const m = new Map();
    for (const e of arr) m.set(`${e.source}|${e.sourceType}`, e);
    return m;
  };
  const mapA = byKey(runA);
  const mapB = byKey(runB);
  const proofs = [];

  for (const [k, b] of mapB.entries()) {
    const a = mapA.get(k);
    if (!a) {
      proofs.push({
        kind: b.observationStatus === 'ABSENT' ? 'CONFIRMED_ABSENCE' : b.observationStatus === 'COLLECTION_ERROR' ? 'COLLECTION_DEGRADED' : 'NEW_OBSERVATION',
        key: k,
        fromEvidenceId: null,
        toEvidenceId: b.id,
        toStatus: b.observationStatus,
        toConfidence: b.confidence,
      });
      continue;
    }
    if (b.observationStatus === 'COLLECTION_ERROR' && a.observationStatus !== 'COLLECTION_ERROR') {
      proofs.push({ kind: 'COLLECTION_DEGRADED', key: k, fromEvidenceId: a.id, toEvidenceId: b.id, fromStatus: a.observationStatus, toStatus: b.observationStatus });
    } else if (a.observationStatus === 'OBSERVED' && b.observationStatus === 'ABSENT') {
      proofs.push({ kind: 'ABATED', key: k, fromEvidenceId: a.id, toEvidenceId: b.id, fromConfidence: a.confidence, toConfidence: b.confidence });
    } else if (a.observationStatus === 'ABSENT' && b.observationStatus === 'OBSERVED') {
      proofs.push({ kind: 'ESCALATED', key: k, fromEvidenceId: a.id, toEvidenceId: b.id, fromConfidence: a.confidence, toConfidence: b.confidence });
    } else if (b.confidence === 'CONTRADICTED' && a.confidence !== 'CONTRADICTED') {
      proofs.push({ kind: 'CONFLICT_APPEARED', key: k, fromEvidenceId: a.id, toEvidenceId: b.id });
    } else if (a.rawSha256 !== b.rawSha256) {
      proofs.push({ kind: 'VALUE_CHANGED', key: k, fromEvidenceId: a.id, toEvidenceId: b.id, fromConfidence: a.confidence, toConfidence: b.confidence });
    }
  }
  return Object.freeze({ basis: 'MODEL', comparedAtCount: { runA: runA.length, runB: runB.length }, proofs });
}
