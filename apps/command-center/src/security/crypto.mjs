// Thin, auditable wrapper over WebCrypto.
//
// Algorithms are pinned:
//   * SHA-256 for content addressing.
//   * Ed25519 for signatures (identity, non-repudiation).
//   * X25519 + HKDF-SHA-256 + AES-256-GCM for transport.
//
// No third-party crypto dependency. No custom construction. If a runtime lacks
// one of these primitives the call rejects; it never silently downgrades.

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('WebCrypto is unavailable in this runtime');
  return api;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('expected string, Uint8Array or ArrayBuffer');
}

export function randomBytes(length) {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function bytesToHex(bytes) {
  let hex = '';
  for (const byte of toBytes(bytes)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new TypeError('invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBase64(bytes) {
  const view = toBytes(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sha256Hex(value) {
  const digest = await subtle().digest('SHA-256', toBytes(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function sha256Base64(value) {
  const digest = await subtle().digest('SHA-256', toBytes(value));
  return bytesToBase64(new Uint8Array(digest));
}

// --- Ed25519 identity -------------------------------------------------------

export async function generateSigningIdentity() {
  const pair = await subtle().generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicKeyRaw = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  return {
    algorithm: 'Ed25519',
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyRaw,
    fingerprint: await sha256Hex(publicKeyRaw),
    publicKeyHex: bytesToHex(publicKeyRaw),
  };
}

export async function importSigningPublicKey(publicKeyRaw) {
  return subtle().importKey('raw', toBytes(publicKeyRaw), { name: 'Ed25519' }, true, ['verify']);
}

export async function signBytes(privateKey, value) {
  const signature = await subtle().sign({ name: 'Ed25519' }, privateKey, toBytes(value));
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyBytes(publicKey, signatureBase64, value) {
  try {
    return await subtle().verify(
      { name: 'Ed25519' },
      publicKey,
      base64ToBytes(signatureBase64),
      toBytes(value),
    );
  } catch {
    return false;
  }
}

// --- X25519 key agreement ---------------------------------------------------

export async function generateAgreementIdentity() {
  const pair = await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const publicKeyRaw = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  return {
    algorithm: 'X25519',
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyRaw,
    publicKeyHex: bytesToHex(publicKeyRaw),
  };
}

export async function importAgreementPublicKey(publicKeyRaw) {
  return subtle().importKey('raw', toBytes(publicKeyRaw), { name: 'X25519' }, true, []);
}

/**
 * X25519 -> HKDF-SHA-256 -> AES-256-GCM.
 * `info` must be unique per protocol context; `salt` must be shared and random.
 */
export async function deriveSharedAesKey(privateKey, peerPublicKeyRaw, { salt, info } = {}) {
  if (!salt || !info) throw new Error('deriveSharedAesKey requires salt and info');
  const peer = await importAgreementPublicKey(peerPublicKeyRaw);
  const sharedBits = await subtle().deriveBits({ name: 'X25519', public: peer }, privateKey, 256);
  const hkdfKey = await subtle().importKey('raw', new Uint8Array(sharedBits), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toBytes(salt),
      info: toBytes(info),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// --- AES-256-GCM ------------------------------------------------------------

export async function encryptJson(aesKey, value, associatedData = '') {
  const iv = randomBytes(12);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await subtle().encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: toBytes(associatedData),
      tagLength: 128,
    },
    aesKey,
    plaintext,
  );
  return {
    schema: 'senda-aesgcm/v1',
    alg: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson(aesKey, box, associatedData = '') {
  if (!box || box.schema !== 'senda-aesgcm/v1' || box.alg !== 'AES-256-GCM') {
    throw new Error('unsupported ciphertext box');
  }
  const plaintext = await subtle().decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(box.iv),
      additionalData: toBytes(associatedData),
      tagLength: 128,
    },
    aesKey,
    base64ToBytes(box.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext));
}
