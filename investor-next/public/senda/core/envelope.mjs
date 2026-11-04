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
const KINDS = ['PERSONAL', 'SOS', 'HUMAN_STATUS', 'OFFICIAL_ALERT', 'COORDINATION', 'RECEIPT'];

export async function sha256b64(bytes) { return b64(await subtle.digest('SHA-256', bytes)); }
export async function ackHashOf(secretBytes) { return b64(new Uint8Array(await subtle.digest('SHA-256', secretBytes)).subarray(0, 16)); }

/** Huella pública = 16 primeros bytes de SHA-256(x‖y) de la clave de cifrado. */
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

/** Cifra y firma. `recipient` = identidad pública {boxPub, fingerprint}. */
export async function sealMessage({ sender, recipient, body, priority, ttlS, now, kind = 'PERSONAL' }) {
  if (!KINDS.includes(kind)) throw new Error(`Tipo desconocido: ${kind}`);
  const ackSecret = rand(16), idBytes = rand(16);
  const header = { v: 2, id: b64(idBytes), to: recipient.fingerprint, priority, expiresAt: now + ttlS * 1000, kind, ackHash: await ackHashOf(ackSecret) };
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const rPub = await subtle.importKey('jwk', { ...strip(recipient.boxPub), ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: rPub }, eph.privateKey, 256);
  const iv = rand(12);
  const binary = typeof body !== 'string';
  const bodyBytes = binary ? body : enc.encode(body);
  const inner = new Uint8Array([...rawFromJwk(sender.publicIdentity.signPub), ...ackSecret, binary ? 1 : 0, ...bodyBytes]);
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

export async function openMessage({ recipient, envelope, now }) {
  const { header } = envelope;
  if (header.to !== recipient.publicIdentity.fingerprint) throw new Error('NOT_FOR_ME');
  if (now > header.expiresAt) throw new Error('EXPIRED');
  const ephPub = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: envelope.eph.x, y: envelope.eph.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: ephPub }, recipient.box.privateKey, 256);
  const ct = unb64(envelope.ct);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv), additionalData: headerBytes(header) }, await aesKey(shared, unb64(header.id)), ct));
  const from = jwkFromRaw(pt.subarray(0, 65));
  const ackSecret = pt.slice(65, 81), binary = pt[81] === 1, bodyBytes = pt.slice(82);
  const verifyKey = await subtle.importKey('jwk', { ...from, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64(envelope.sig), new Uint8Array([...headerBytes(header), ...ct])))) throw new Error('BAD_SIGNATURE');
  if ((await ackHashOf(ackSecret)) !== header.ackHash) throw new Error('BAD_ACK_COMMITMENT');
  return { header, from, fromFingerprint: null, body: binary ? bodyBytes : dec.decode(bodyBytes), receipt: { id: header.id, ackSecret: b64(ackSecret) } };
}

/* ---------- Codificación binaria compacta (sonido / SMS / QR) ---------- */
export function packEnvelope(e) {
  const h = e.header, ct = unb64(e.ct), exp = h.expiresAt;
  const out = new Uint8Array(1 + 16 + 16 + 1 + 6 + 1 + 16 + 64 + 12 + 64 + 2 + ct.length);
  let o = 0; const put = (bytes) => { out.set(bytes, o); o += bytes.length; };
  put([0xe2]); put(unb64(h.id)); put(unb64(h.to)); put([h.priority & 0xff]);
  put([Math.floor(exp / 2 ** 40) & 0xff, Math.floor(exp / 2 ** 32) & 0xff, Math.floor(exp / 2 ** 24) & 0xff, Math.floor(exp / 2 ** 16) & 0xff, Math.floor(exp / 2 ** 8) & 0xff, exp & 0xff]);
  put([KINDS.indexOf(h.kind)]); put(unb64(h.ackHash)); put(unb64(e.eph.x)); put(unb64(e.eph.y)); put(unb64(e.iv)); put(unb64(e.sig));
  put([ct.length >> 8, ct.length & 0xff]); put(ct);
  return out;
}
export function unpackEnvelope(b) {
  if (b[0] !== 0xe2) throw new Error('No es un sobre SENDA v2');
  let o = 1; const take = (n) => { const s = b.subarray(o, o + n); o += n; if (s.length !== n) throw new Error('Sobre truncado'); return s; };
  const id = b64(take(16)), to = b64(take(16)), priority = take(1)[0];
  const e6 = take(6); let expiresAt = 0; for (const x of e6) expiresAt = expiresAt * 256 + x;
  const kind = KINDS[take(1)[0]], ackHash = b64(take(16));
  const eph = { x: b64(take(32)), y: b64(take(32)) }, iv = b64(take(12)), sig = b64(take(64));
  const l = take(2), ct = b64(take((l[0] << 8) | l[1]));
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
