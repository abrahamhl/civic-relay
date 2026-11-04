/**
 * SENDA · Baliza BLE y formato de barrido compartidos por web, Android (apps/senda-android)
 * y el accesorio ESP32 (hardware/esp32-survey). Los tres producen/consumen exactamente
 * los mismos bytes; los vectores de prueba están duplicados en los tests de cada lado.
 *
 * Trama (18 bytes) dentro de «Manufacturer Specific Data» de un anuncio BLE heredado:
 *   0-1  'S''N' (0x53 0x4E)       6     unidad (ASCII, 0 = desconocida)
 *   2    versión (1)               7-14  id de baliza (8 bytes = SHA-256(huella)[0..7])
 *   3    estado (STATUS_CODES)     15-16 secuencia (big-endian)
 *   4    batería 0-100 (255 = ?)   17    CRC-8 (polinomio 0x07) de los bytes 0-16
 *   5    planta int8 (-128 = ?)
 * Company ID: 0xFFFF es el identificador de PRUEBAS del Bluetooth SIG; un despliegue real
 * debe solicitar su propio Company Identifier y cambiar COMPANY_ID (y las otras dos copias).
 */
const enc = new TextEncoder();

export const COMPANY_ID = 0xffff;
export const FRAME_LEN = 18;
export const STATUS_CODES = Object.freeze(['UNKNOWN', 'SAFE', 'NEED_HELP', 'TRAPPED', 'AWAY', 'NO_RESPONSE']);

export function crc8(bytes, end = bytes.length) {
  let c = 0;
  for (let i = 0; i < end; i++) { c ^= bytes[i]; for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff; }
  return c;
}

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));

/** Id de baliza (16 caracteres hex) derivado de la huella pública: el coordinador puede correlacionarlo. */
export async function beaconIdOf(fingerprint) {
  return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', enc.encode(String(fingerprint)))).subarray(0, 8));
}

export function encodeBeaconFrame({ status = 'UNKNOWN', battery = null, floor = null, unit = null, beaconId, seq = 0 }) {
  const s = STATUS_CODES.indexOf(status); if (s < 0) throw new Error(`Estado no válido: ${status}`);
  if (!/^[0-9a-f]{16}$/.test(beaconId)) throw new Error('beaconId debe ser 16 hex');
  const f = new Uint8Array(FRAME_LEN);
  f[0] = 0x53; f[1] = 0x4e; f[2] = 1; f[3] = s;
  f[4] = battery == null ? 255 : Math.max(0, Math.min(100, Math.round(battery)));
  f[5] = floor == null ? 0x80 : (Math.max(-127, Math.min(127, floor)) & 0xff);
  f[6] = unit ? unit.charCodeAt(0) & 0x7f : 0;
  f.set(unhex(beaconId), 7);
  f[15] = (seq >> 8) & 0xff; f[16] = seq & 0xff;
  f[17] = crc8(f, 17);
  return f;
}

export function decodeBeaconFrame(f) {
  if (f.length !== FRAME_LEN || f[0] !== 0x53 || f[1] !== 0x4e) return null;
  if (f[2] !== 1 || crc8(f, 17) !== f[17]) return null;
  const floor = f[5] === 0x80 ? null : (f[5] << 24) >> 24;
  return { status: STATUS_CODES[f[3]] ?? 'UNKNOWN', battery: f[4] === 255 ? null : f[4], floor, unit: f[6] ? String.fromCharCode(f[6]) : null, beaconId: hex(f.subarray(7, 15)), seq: (f[15] << 8) | f[16] };
}
export const frameToHex = hex;
export const frameFromHex = unhex;

/* ---------- puente web → app nativa (el SO exige el toque del usuario) ---------- */
export const NATIVE_SCHEME = 'senda://accion';
/** Enlace que abre SENDA Android con las acciones que el navegador no puede ejecutar (BLE, barrido Wi-Fi). */
export function nativeActionLink({ actions, beaconId, profile = {}, battery = null, cmdId = '' }) {
  const q = new URLSearchParams({ a: actions.join(','), id: beaconId, b: profile.buildingId ?? '', f: profile.floor ?? '', u: profile.unit ?? '', bat: battery ?? '', cmd: cmdId });
  return `${NATIVE_SCHEME}?${q}`;
}

/* ---------- formato de barrido (JSONL) que entiende building-twin.locateAccessPoints ---------- */
/** Una línea por lectura: {x,y,z (m locales), bssid, ssid, rssi (dBm), t (s epoch), connected?, internet?}. */
export function parseSurvey(text) {
  const t = String(text).trim(); if (!t) return [];
  const rows = t.startsWith('[') ? JSON.parse(t) : t.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  return rows.map((r, i) => {
    for (const k of ['x', 'y', 'z', 'rssi', 't']) if (!Number.isFinite(r[k])) throw new Error(`Línea ${i + 1}: ${k} no numérico`);
    if (typeof r.bssid !== 'string' || !r.bssid) throw new Error(`Línea ${i + 1}: falta bssid`);
    if (r.rssi > 0 || r.rssi < -127) throw new Error(`Línea ${i + 1}: rssi fuera de rango`);
    return { x: r.x, y: r.y, z: r.z, bssid: r.bssid.toLowerCase(), ssid: r.ssid ?? null, rssi: r.rssi, t: r.t, connected: !!r.connected, internet: !!r.internet, source: r.source ?? null };
  });
}
