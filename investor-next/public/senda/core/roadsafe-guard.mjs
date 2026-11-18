/**
 * SENDA RoadSafe · Blindaje: cifrado, custodia firmada, anti-abuso y privacidad.
 *
 * Amenazas que cubre (ver docs/roadsafe/09_DIFFERENTIATION_AND_SECURITY.md):
 *  - Fuga de datos personales del expediente → cifrado AES-256-GCM con clave por incidente derivada por
 *    HKDF-SHA-256 de una clave maestra (la clave maestra no sale del dispositivo/servidor; WebCrypto).
 *    El identificador del incidente y el propósito van como datos asociados (AAD): no se puede
 *    «trasplantar» un sobre a otro incidente sin que falle la verificación.
 *  - Manipulación del registro tras un accidente (seguros, juzgados) → firma ECDSA P-256 de la cabeza de la
 *    cadena de auditoría (roadsafe-incident-twin.verifyAudit) con marca de tiempo y longitud.
 *  - Ataques de tiempo sobre MAC/HMAC → comparación en tiempo constante.
 *  - Inundación de avisos falsos / bots → cubeta de fichas por identidad + detección de ráfagas y de
 *    desplazamientos físicamente imposibles entre avisos del mismo emisor.
 *  - Uso de SENDA para seguir a personas o a la policía → vistas públicas con ubicación difuminada, sin
 *    identificadores; posiciones de servicios solo para coordinadores (roadsafe-responders).
 * Todo con WebCrypto estándar; sin criptografía propia.
 */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => (typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...u8)));
const unb64 = (s) => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
const canon = (v) => (v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`);

/** Comparación en tiempo constante de dos cadenas/bytes (no corta en el primer byte distinto). */
export function constantTimeEqual(a, b) {
  const A = typeof a === 'string' ? enc.encode(a) : a, B = typeof b === 'string' ? enc.encode(b) : b;
  let diff = A.length ^ B.length; const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}

// ------------------------------------------------------------------ Cifrado por incidente
export async function createMasterKey() { return subtle.importKey('raw', globalThis.crypto.getRandomValues(new Uint8Array(32)), 'HKDF', false, ['deriveKey']); }
async function incidentKey(master, incidentId, purpose) {
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(`senda-roadsafe/v1/${incidentId}`), info: enc.encode(purpose) }, master, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** Sella datos protegidos (personas, salud, teléfonos) ligados a un incidente y a un propósito. */
export async function sealProtected(obj, master, { incidentId, purpose }) {
  if (!incidentId || !purpose) throw new Error('sealProtected exige incidentId y propósito');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)), aad = enc.encode(`${incidentId}|${purpose}`);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, await incidentKey(master, incidentId, purpose), enc.encode(canon(obj))));
  return { v: 1, alg: 'HKDF-SHA256/AES-256-GCM', incidentId, purpose, iv: b64(iv), ct: b64(ct) };
}
export async function openProtected(env, master, { incidentId, purpose }) {
  if (env?.v !== 1 || env.incidentId !== incidentId || env.purpose !== purpose) throw new Error('sobre no corresponde a este incidente o propósito');
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: enc.encode(`${incidentId}|${purpose}`) }, await incidentKey(master, incidentId, purpose), unb64(env.ct));
    return JSON.parse(dec.decode(pt));
  } catch { throw new Error('sobre alterado o clave incorrecta'); }
}

// ------------------------------------------------------------------ Custodia firmada
export async function createCustodyKey() { return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); }
/** Firma la cabeza de la cadena de auditoría (head, longitud, hora): prueba de no manipulación posterior. */
export async function signAuditHead({ incidentId, head, length, at }, privateKey) {
  const body = canon({ schema: 'senda-roadsafe-custody/1', incidentId, head, length, at });
  return { body, sig: b64(new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(body)))) };
}
export async function verifyAuditHead(signed, publicKey, { head, length } = {}) {
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, unb64(signed.sig), enc.encode(signed.body));
  if (!ok) return { ok: false, why: 'firma no válida' };
  const b = JSON.parse(signed.body);
  if (head && b.head !== head) return { ok: false, why: 'la cadena actual no coincide con la firmada' };
  if (length != null && b.length !== length) return { ok: false, why: 'longitud distinta: registros añadidos o eliminados' };
  return { ok: true, signed: b };
}

// ------------------------------------------------------------------ Anti-abuso
/** Cubeta de fichas por identidad (capacidad y recarga DECLARADAS por quien la usa). */
export function createRateLimiter({ capacity, refillPerS }) {
  if (!(capacity > 0) || !(refillPerS > 0)) throw new Error('rate limiter: capacidad y recarga deben declararse');
  const b = new Map();
  return {
    allow(id, now, cost = 1) {
      const s = b.get(id) ?? { tokens: capacity, at: now };
      s.tokens = Math.min(capacity, s.tokens + Math.max(0, now - s.at) * refillPerS); s.at = now;
      if (s.tokens < cost) { b.set(id, s); return { ok: false, retryInS: +((cost - s.tokens) / refillPerS).toFixed(1) }; }
      s.tokens -= cost; b.set(id, s); return { ok: true, remaining: +s.tokens.toFixed(2) };
    },
  };
}
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
/**
 * Señales de abuso de un emisor: ráfagas (muchos avisos en poco tiempo) y saltos imposibles (velocidad
 * implícita entre avisos consecutivos por encima de `maxSpeedMs`). Umbrales declarados por el operador.
 */
export function abuseSignals(reports, { burstWindowS, burstMax, maxSpeedMs }) {
  if (![burstWindowS, burstMax, maxSpeedMs].every(Number.isFinite)) throw new Error('abuseSignals exige umbrales declarados');
  const byId = new Map(); for (const r of reports) { const a = byId.get(r.reporterId) ?? []; a.push(r); byId.set(r.reporterId, a); }
  const out = [];
  for (const [id, rs] of byId) {
    rs.sort((a, b) => a.at - b.at); const flags = [];
    for (let i = 0, j = 0; i < rs.length; i++) { while (rs[i].at - rs[j].at > burstWindowS) j++; if (i - j + 1 > burstMax) { flags.push('RAFAGA'); break; } }
    for (let i = 1; i < rs.length; i++) { const dt = rs[i].at - rs[i - 1].at, d = distM(rs[i - 1], rs[i]); if (dt <= 0 ? d > 50 : d / dt > maxSpeedMs) { flags.push('SALTO_IMPOSIBLE'); break; } }
    if (flags.length) out.push({ reporterId: id, flags, reports: rs.length, action: 'degradar a pista no verificada y revisar; nunca borrar en silencio' });
  }
  return out;
}

// ------------------------------------------------------------------ Privacidad
/** Difumina una posición a una rejilla (p. ej. 0,005° ≈ 500 m) para vistas públicas o agregados. */
export function coarsen({ lat, lon }, gridDeg) {
  if (!(gridDeg > 0)) throw new Error('coarsen: rejilla obligatoria');
  return { lat: +(Math.round(lat / gridDeg) * gridDeg).toFixed(6), lon: +(Math.round(lon / gridDeg) * gridDeg).toFixed(6), gridDeg };
}
/** Supresión de celdas pequeñas (k-anonimato) en agregados publicados. */
export const suppressSmallCells = (cells, k) => cells.map((c) => (c.count < k ? { ...c, count: null, suppressed: true } : c));
