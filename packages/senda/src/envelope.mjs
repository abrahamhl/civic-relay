/**
 * Sobre cifrado de extremo a extremo (WebCrypto estándar, sin dependencias):
 *  - Firma del emisor: ECDSA P-256 / SHA-256.
 *  - Cifrado: ECDH P-256 efímero-estático → HKDF-SHA-256 → AES-256-GCM.
 * Los relés (vecinos, teléfonos en la zona, gateways) solo ven la CABECERA de
 * enrutamiento: id, destino (huella de clave), prioridad y caducidad. No pueden leer
 * ni alterar el contenido sin que el destinatario lo detecte.
 */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64url');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64url'));

export async function generateIdentity() {
  const sign = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const box = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const signPub = await subtle.exportKey('jwk', sign.publicKey);
  const boxPub = await subtle.exportKey('jwk', box.publicKey);
  return { sign, box, publicIdentity: { signPub, boxPub, fingerprint: await fingerprint(boxPub) } };
}

export async function fingerprint(jwk) {
  const h = await subtle.digest('SHA-256', enc.encode(`${jwk.x}.${jwk.y}`));
  return b64(h).slice(0, 22);
}

async function aesKey(sharedBits, salt) {
  const ikm = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('SENDA-v1-envelope') }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const headerBytes = (h) => enc.encode(JSON.stringify([h.v, h.id, h.to, h.priority, h.expiresAt, h.kind]));

/** Cifra y firma. `recipient` = identidad pública {boxPub, fingerprint}. */
export async function sealMessage({ sender, recipient, body, priority, ttlS, now, kind = 'PERSONAL' }) {
  const header = { v: 1, id: b64(globalThis.crypto.getRandomValues(new Uint8Array(16))), to: recipient.fingerprint,
    priority, expiresAt: now + ttlS * 1000, kind };
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const rPub = await subtle.importKey('jwk', recipient.boxPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: rPub }, eph.privateKey, 256);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const binary = typeof body !== 'string';
  const inner = JSON.stringify({ from: sender.publicIdentity.signPub, body: binary ? b64(body) : body, binary });
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(header) }, await aesKey(shared, salt), enc.encode(inner));
  const ephPub = await subtle.exportKey('jwk', eph.publicKey);
  const toSign = new Uint8Array([...headerBytes(header), ...new Uint8Array(ct)]);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sender.sign.privateKey, toSign);
  return { header, eph: { x: ephPub.x, y: ephPub.y }, salt: b64(salt), iv: b64(iv), ct: b64(ct), sig: b64(sig) };
}

/** Lo único que un relé puede saber de un sobre. */
export function relayView(envelope, now) {
  const { header } = envelope;
  return { id: header.id, to: header.to, priority: header.priority, expired: now > header.expiresAt, sizeBytes: JSON.stringify(envelope).length };
}

export async function openMessage({ recipient, envelope, now }) {
  const { header } = envelope;
  if (header.to !== recipient.publicIdentity.fingerprint) throw new Error('NOT_FOR_ME');
  if (now > header.expiresAt) throw new Error('EXPIRED');
  const ephPub = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: envelope.eph.x, y: envelope.eph.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: ephPub }, recipient.box.privateKey, 256);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv), additionalData: headerBytes(header) }, await aesKey(shared, unb64(envelope.salt)), unb64(envelope.ct));
  const inner = JSON.parse(dec.decode(pt));
  const verifyKey = await subtle.importKey('jwk', inner.from, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const signed = new Uint8Array([...headerBytes(header), ...unb64(envelope.ct)]);
  if (!(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64(envelope.sig), signed))) throw new Error('BAD_SIGNATURE');
  return { header, from: inner.from, body: inner.binary ? unb64(inner.body) : inner.body };
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
