/**
 * Sobre cifrado de extremo a extremo SENDA v2 (WebCrypto estándar, sin dependencias;
 * idéntico en navegador, service worker y Node):
 *  - Firma del emisor: ECDSA P-256 / SHA-256 sobre cabecera + texto cifrado.
 *  - Cifrado: ECDH P-256 efímero-estático → HKDF-SHA-256 → AES-256-GCM (cabecera como AAD).
 *  - Recibo infalsificable: solo el destinatario conoce `ackSecret` (va cifrado); la
 *    cabecera lleva los 16 primeros bytes de su SHA-256.
 * Los relés solo ven la CABECERA: id, destino (huella), prioridad, caducidad, tipo.
 * `packEnvelope` produce un binario compacto (~300 B + texto) apto para sonido, SMS o QR.
 */
import { b64, unb64 } from './b64.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export const KINDS = ['PERSONAL', 'SOS', 'HUMAN_STATUS', 'OFFICIAL_ALERT', 'COORDINATION', 'RECEIPT'];
export const MAX_ENVELOPE_BYTES = 512 * 1024;
export const MAX_TTL_S = 90 * 86400;
const MAX_PRIORITY = 9;
const MAX_EXPIRES_AT = 2 ** 48 - 1;

/**
 * Valida la forma de un sobre ANTES de almacenarlo o reenviarlo. No verifica la firma
 * (un relé no puede: la clave del emisor viaja dentro del cifrado); solo impide que
 * entren objetos gigantes, con base64 ambiguo, tipos desconocidos o vencimientos absurdos.
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateEnvelopeShape(envelope, { now = Date.now(), maxBytes = MAX_ENVELOPE_BYTES, maxTtlS = MAX_TTL_S } = {}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return fail('MALFORMED_ENVELOPE');
  const { header, eph, iv, ct, sig } = envelope;
  if (!header || typeof header !== 'object' || Array.isArray(header)) return fail('MALFORMED_HEADER');
  if (header.v !== 2) return fail('UNSUPPORTED_VERSION');
  if (!isB64Url(header.id, 16)) return fail('BAD_ID');
  if (!isB64Url(header.to, 16)) return fail('BAD_RECIPIENT');
  if (!isB64Url(header.ackHash, 16)) return fail('BAD_ACK_HASH');
  if (!Number.isSafeInteger(header.priority) || header.priority < 0 || header.priority > MAX_PRIORITY) return fail('BAD_PRIORITY');
  if (!Number.isSafeInteger(header.expiresAt) || header.expiresAt < 0 || header.expiresAt > MAX_EXPIRES_AT) return fail('BAD_EXPIRY');
  if (!KINDS.includes(header.kind)) return fail('BAD_KIND');
  if (Number.isFinite(now) && Number.isFinite(maxTtlS) && header.expiresAt - now > maxTtlS * 1000 + 300_000) return fail('TTL_TOO_LONG');
  if (!eph || typeof eph !== 'object' || !isB64Url(eph.x, 32) || !isB64Url(eph.y, 32)) return fail('BAD_EPHEMERAL_KEY');
  if (!isB64Url(iv, 12)) return fail('BAD_IV');
  if (!isB64Url(sig, 64)) return fail('BAD_SIGNATURE_SHAPE');
  const ctBytes = b64UrlBytes(ct);
  if (ctBytes === null) return fail('BAD_CIPHERTEXT');
  if (ctBytes < 17) return fail('BAD_CIPHERTEXT');
  if (ctBytes > maxBytes) return fail('ENVELOPE_TOO_LARGE');
  return { ok: true };
}

function b64UrlBytes(value) {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const bytes = unb64(value);
    return b64(bytes) === value ? bytes.length : null;
  } catch {
    return null;
  }
}

function isB64Url(value, byteLength) {
  return b64UrlBytes(value) === byteLength;
}

export async function sha256b64(bytes) { return b64(await subtle.digest('SHA-256', bytes)); }
export async function ackHashOf(secretBytes) { return b64(new Uint8Array(await subtle.digest('SHA-256', secretBytes)).subarray(0, 16)); }

/** Huella pública = 16 primeros bytes de SHA-256(x‖y) de una clave P-256 (cifrado o firma). */
export async function fingerprint(jwk) {
  const h = new Uint8Array(await subtle.digest('SHA-256', new Uint8Array([...unb64(jwk.x), ...unb64(jwk.y)])));
  return b64(h.subarray(0, 16));
}

const strip = (j) => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
const rawFromJwk = (jwk) => new Uint8Array([4, ...unb64(jwk.x), ...unb64(jwk.y)]);
const jwkFromRaw = (raw) => ({ kty: 'EC', crv: 'P-256', x: b64(raw.subarray(1, 33)), y: b64(raw.subarray(33, 65)) });

export async function generateIdentity() {
  const sign = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const box = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return identityFromKeys({ sign, box });
}

export async function identityFromKeys({ sign, box }) {
  const signPub = strip(await subtle.exportKey('jwk', sign.publicKey));
  const boxPub = strip(await subtle.exportKey('jwk', box.publicKey));
  return { sign, box, publicIdentity: { signPub, boxPub, fingerprint: await fingerprint(boxPub) } };
}

/** Exporta/importa la identidad completa (se guarda solo en el propio teléfono). */
export async function exportIdentity(id) {
  return { sign: await subtle.exportKey('jwk', id.sign.privateKey), box: await subtle.exportKey('jwk', id.box.privateKey) };
}
export async function importIdentity({ sign, box }) {
  const pub = (j) => ({ ...strip(j), ext: true });
  const s = { privateKey: await subtle.importKey('jwk', sign, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']), publicKey: await subtle.importKey('jwk', pub(sign), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']) };
  const b = { privateKey: await subtle.importKey('jwk', box, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']), publicKey: await subtle.importKey('jwk', pub(box), { name: 'ECDH', namedCurve: 'P-256' }, true, []) };
  return identityFromKeys({ sign: s, box: b });
}

const IDENTITY_AAD = enc.encode('SENDA-identity-v1');
const IDENTITY_KDF_ITERATIONS = 210_000;
const IDENTITY_MIN_PASSPHRASE = 12;

function assertPassphrase(passphrase) {
  if (typeof passphrase !== 'string') throw new Error('BAD_PASSPHRASE');
  if ([...passphrase].length < IDENTITY_MIN_PASSPHRASE) throw new Error(`La frase de paso debe tener al menos ${IDENTITY_MIN_PASSPHRASE} caracteres`);
  if (passphrase.length > 1024) throw new Error('La frase de paso es demasiado larga');
}

async function identityKey(passphrase, salt, iterations) {
  const material = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Exporta la identidad cifrada con PBKDF2-SHA-256 + AES-256-GCM.
 * El resultado es un objeto JSON serializable; no contiene claves en claro.
 */
export async function exportIdentityEncrypted(id, passphrase, { iterations = IDENTITY_KDF_ITERATIONS, salt } = {}) {
  assertPassphrase(passphrase);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) throw new Error('ITERACIONES_INVÁLIDAS');
  const saltBytes = salt ?? rand(16);
  if (!(saltBytes instanceof Uint8Array) || saltBytes.length !== 16) throw new Error('SAL_INVÁLIDA');
  const iv = rand(12);
  const plain = enc.encode(JSON.stringify(await exportIdentity(id)));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: IDENTITY_AAD }, await identityKey(passphrase, saltBytes, iterations), plain));
  return { v: 1, kdf: 'PBKDF2-SHA-256', iterations, salt: b64(saltBytes), iv: b64(iv), ct: b64(ct) };
}

/** Importa una identidad exportada con `exportIdentityEncrypted`. Falla de forma cerrada con frase incorrecta o blob alterado. */
export async function importIdentityEncrypted(blob, passphrase) {
  assertPassphrase(passphrase);
  if (!blob || typeof blob !== 'object' || blob.v !== 1 || blob.kdf !== 'PBKDF2-SHA-256') throw new Error('FORMATO_DE_IDENTIDAD_NO_SOPORTADO');
  const iterations = blob.iterations;
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) throw new Error('ITERACIONES_INVÁLIDAS');
  const salt = unb64(blob.salt), iv = unb64(blob.iv), ct = unb64(blob.ct);
  if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) throw new Error('BLOB_DE_IDENTIDAD_INVÁLIDO');
  let plain;
  try {
    plain = await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: IDENTITY_AAD }, await identityKey(passphrase, salt, iterations), ct);
  } catch {
    throw new Error('BAD_PASSPHRASE');
  }
  let material;
  try {
    material = JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('IDENTIDAD_CORRUPTA');
  }
  return importIdentity(material);
}

/** Tarjeta de contacto compacta (132 B + nombre) para intercambiar por sonido/archivo/texto. */
export function packContact(publicIdentity, name = '') {
  const n = enc.encode(name).subarray(0, 60);
  return new Uint8Array([0xc1, ...rawFromJwk(publicIdentity.signPub), ...rawFromJwk(publicIdentity.boxPub), n.length, ...n]);
}
export async function unpackContact(bytes) {
  if (bytes[0] !== 0xc1 || bytes.length < 132) throw new Error('No es una tarjeta SENDA');
  const signPub = jwkFromRaw(bytes.subarray(1, 66)), boxPub = jwkFromRaw(bytes.subarray(66, 131));
  const name = dec.decode(bytes.subarray(132, 132 + bytes[131]));
  return { name, signPub, boxPub, fingerprint: await fingerprint(boxPub) };
}

async function aesKey(sharedBits, salt) {
  const ikm = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('SENDA-v2-envelope') }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const headerBytes = (h) => enc.encode(JSON.stringify([h.v, h.id, h.to, h.priority, h.expiresAt, h.kind, h.ackHash]));

/**
 * Cifra y firma. `recipient` = identidad pública {boxPub, fingerprint}.
 * La versión interna 3 incluye la huella de la clave de caja del emisor dentro del
 * plaintext firmado; el receptor puede ligarla a la tarjeta de contacto (F-02).
 */
export async function sealMessage({ sender, recipient, body, priority, ttlS, now, kind = 'PERSONAL', innerVersion = 3 }) {
  // validar aquí: un sobre con prioridad no válida se crearía bien pero nadie podría abrirlo después
  if (!Number.isSafeInteger(priority) || priority < 0 || priority > MAX_PRIORITY) throw new RangeError(`prioridad no válida: ${priority}`);
  if (!KINDS.includes(kind)) throw new Error(`Tipo desconocido: ${kind}`);
  if (innerVersion !== 2 && innerVersion !== 3) throw new Error('VERSIÓN_INTERNA_INVÁLIDA');
  const ackSecret = rand(16), idBytes = rand(16);
  const header = { v: 2, id: b64(idBytes), to: recipient.fingerprint, priority, expiresAt: now + ttlS * 1000, kind, ackHash: await ackHashOf(ackSecret) };
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const rPub = await subtle.importKey('jwk', { ...strip(recipient.boxPub), ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: rPub }, eph.privateKey, 256);
  const iv = rand(12);
  const binary = typeof body !== 'string';
  const bodyBytes = binary ? body : enc.encode(body);
  const inner = innerVersion === 3
    ? new Uint8Array([3, ...rawFromJwk(sender.publicIdentity.signPub), ...unb64(sender.publicIdentity.fingerprint ?? await fingerprint(sender.publicIdentity.boxPub)), ...ackSecret, binary ? 1 : 0, ...bodyBytes])
    : new Uint8Array([...rawFromJwk(sender.publicIdentity.signPub), ...ackSecret, binary ? 1 : 0, ...bodyBytes]);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(header) }, await aesKey(shared, idBytes), inner));
  const ephPub = await subtle.exportKey('jwk', eph.publicKey);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sender.sign.privateKey, new Uint8Array([...headerBytes(header), ...ct]));
  return { header, eph: { x: ephPub.x, y: ephPub.y }, iv: b64(iv), ct: b64(ct), sig: b64(sig) };
}

/** Lo único que un relé puede saber de un sobre. */
export function relayView(envelope, now) {
  const { header } = envelope;
  return { id: header.id, to: header.to, priority: header.priority, kind: header.kind, expired: now > header.expiresAt, sizeBytes: packEnvelope(envelope).length };
}

async function bindExpectedSender({ expectedSender, from, fromFingerprint }) {
  const contact = expectedSender?.publicIdentity ?? expectedSender;
  const signPub = contact?.signPub ?? contact?.publicIdentity?.signPub;
  if (!signPub || typeof signPub.x !== 'string' || typeof signPub.y !== 'string') throw new Error('EXPECTED_SENDER_INVÁLIDO');
  if (from.x !== signPub.x || from.y !== signPub.y) throw new Error('SENDER_NOT_PINNED');
  const expectedBoxFingerprint = contact.fingerprint ?? (contact.boxPub ? await fingerprint(contact.boxPub) : null);
  if (!expectedBoxFingerprint) return 'SIGN_ONLY';
  if (!fromFingerprint) throw new Error('SENDER_BINDING_MISSING');
  if (fromFingerprint !== expectedBoxFingerprint) throw new Error('SENDER_NOT_PINNED');
  return 'SIGN_AND_BOX';
}

/**
 * Abre un sobre. `expectedSender` (opcional) es una tarjeta de contacto o identidad
 * pública; si se aporta, la firma y la huella de caja deben coincidir (fail-closed).
 * Los sobres antiguos sin huella de caja se rechazan cuando se exige vinculación.
 */
export async function openMessage({ recipient, envelope, now, expectedSender = null }) {
  const shape = validateEnvelopeShape(envelope, { now });
  if (!shape.ok) throw new Error(shape.reason);
  const { header } = envelope;
  if (header.to !== recipient.publicIdentity.fingerprint) throw new Error('NOT_FOR_ME');
  if (now > header.expiresAt) throw new Error('EXPIRED');
  const ephPub = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: envelope.eph.x, y: envelope.eph.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: ephPub }, recipient.box.privateKey, 256);
  const ct = unb64(envelope.ct);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv), additionalData: headerBytes(header) }, await aesKey(shared, unb64(header.id)), ct));
  const innerVersion = pt[0] === 3 ? 3 : 2;
  let signRaw, fromFingerprint = null, ackSecret, binaryFlag, bodyBytes;
  if (innerVersion === 3) {
    if (pt.length < 99) throw new Error('INNER_TRUNCADO');
    signRaw = pt.subarray(1, 66);
    fromFingerprint = b64(pt.subarray(66, 82));
    ackSecret = pt.slice(82, 98);
    binaryFlag = pt[98];
    bodyBytes = pt.slice(99);
  } else {
    if (pt.length < 82) throw new Error('INNER_TRUNCADO');
    signRaw = pt.subarray(0, 65);
    ackSecret = pt.slice(65, 81);
    binaryFlag = pt[81];
    bodyBytes = pt.slice(82);
  }
  if (signRaw.length !== 65) throw new Error('INNER_TRUNCADO');
  if (binaryFlag !== 0 && binaryFlag !== 1) throw new Error('BAD_BODY_FLAG');
  const from = jwkFromRaw(signRaw);
  const verifyKey = await subtle.importKey('jwk', { ...from, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64(envelope.sig), new Uint8Array([...headerBytes(header), ...ct])))) throw new Error('BAD_SIGNATURE');
  if ((await ackHashOf(ackSecret)) !== header.ackHash) throw new Error('BAD_ACK_COMMITMENT');
  const fromSignFingerprint = await fingerprint(from);
  const senderBinding = expectedSender ? await bindExpectedSender({ expectedSender, from, fromFingerprint }) : null;
  return { header, from, fromFingerprint, fromSignFingerprint, innerVersion, senderBinding, body: binaryFlag === 1 ? bodyBytes : dec.decode(bodyBytes), receipt: { id: header.id, ackSecret: b64(ackSecret) } };
}

/* ---------- Codificación binaria compacta (sonido / SMS / QR) ---------- */
export function packEnvelope(e) {
  const h = e.header, ct = unb64(e.ct), exp = h.expiresAt;
  const ki = KINDS.indexOf(h.kind);
  if (ki < 0) throw new Error(`Tipo desconocido: ${h.kind}`);
  if (unb64(h.id).length !== 16 || unb64(h.to).length !== 16 || unb64(h.ackHash).length !== 16) throw new Error('Cabecera INVÁLIDA');
  if (unb64(e.eph.x).length !== 32 || unb64(e.eph.y).length !== 32 || unb64(e.iv).length !== 12 || unb64(e.sig).length !== 64) throw new Error('Criptografía INVÁLIDA');
  if (!Number.isSafeInteger(exp) || exp < 0 || exp > MAX_EXPIRES_AT) throw new Error('Caducidad INVÁLIDA');
  if (ct.length > 0xffff) throw new Error('Ciphertext demasiado grande para el formato binario (máx. 65535 B)');
  const out = new Uint8Array(1 + 16 + 16 + 1 + 6 + 1 + 16 + 64 + 12 + 64 + 2 + ct.length);
  let o = 0; const put = (bytes) => { out.set(bytes, o); o += bytes.length; };
  put([0xe2]); put(unb64(h.id)); put(unb64(h.to)); put([h.priority & 0xff]);
  put([Math.floor(exp / 2 ** 40) & 0xff, Math.floor(exp / 2 ** 32) & 0xff, Math.floor(exp / 2 ** 24) & 0xff, Math.floor(exp / 2 ** 16) & 0xff, Math.floor(exp / 2 ** 8) & 0xff, exp & 0xff]);
  put([ki]); put(unb64(h.ackHash)); put(unb64(e.eph.x)); put(unb64(e.eph.y)); put(unb64(e.iv)); put(unb64(e.sig));
  put([ct.length >> 8, ct.length & 0xff]); put(ct);
  return out;
}
export function unpackEnvelope(b) {
  if (b[0] !== 0xe2) throw new Error('No es un sobre SENDA v2');
  let o = 1; const take = (n) => { const s = b.subarray(o, o + n); o += n; if (s.length !== n) throw new Error('Sobre truncado'); return s; };
  const id = b64(take(16)), to = b64(take(16)), priority = take(1)[0];
  const e6 = take(6); let expiresAt = 0; for (const x of e6) expiresAt = expiresAt * 256 + x;
  const kind = KINDS[take(1)[0]], ackHash = b64(take(16));
  if (!kind) throw new Error('Tipo desconocido en sobre');
  const eph = { x: b64(take(32)), y: b64(take(32)) }, iv = b64(take(12)), sig = b64(take(64));
  const l = take(2), ct = b64(take((l[0] << 8) | l[1]));
  if (o !== b.length) throw new Error('Sobre con bytes sobrantes');
  return { header: { v: 2, id, to, priority, expiresAt, kind, ackHash }, eph, iv, ct, sig };
}

/** Deduplicación en el receptor: la carrera multicanal puede entregar el mismo sobre varias veces. */
export function createInbox() {
  const seen = new Map();
  return {
    accept(envelope, via, now) {
      const id = envelope.header.id;
      if (seen.has(id)) { seen.get(id).duplicates.push({ via, at: now }); return { fresh: false }; }
      seen.set(id, { firstVia: via, at: now, duplicates: [] });
      return { fresh: true };
    },
    stats: (id) => seen.get(id),
  };
}
