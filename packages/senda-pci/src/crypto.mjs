import { createHash } from 'node:crypto';
import { canonicalBytes, canonicalize } from './canonical.mjs';
import { fail, PciError } from './errors.mjs';

const subtle = globalThis.crypto?.subtle;
if (!subtle) throw new PciError('NO_WEBCRYPTO', 'WebCrypto no disponible');

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: 'SHA-256' };
const B64URL = /^[A-Za-z0-9_-]+$/;

export function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  fail('BAD_BYTES', 'se esperaba Uint8Array o ArrayBuffer');
}

export function sha256Hex(value) {
  return createHash('sha256').update(bytesOf(value)).digest('hex');
}

export function sha256B64Url(value) {
  return Buffer.from(createHash('sha256').update(bytesOf(value)).digest()).toString('base64url');
}

export function b64url(bytes) {
  return Buffer.from(bytesOf(bytes)).toString('base64url');
}

export function unb64url(value, expectedLength = null) {
  if (typeof value !== 'string' || !B64URL.test(value)) fail('BAD_BASE64URL', 'base64url no canónico');
  const bytes = new Uint8Array(Buffer.from(value, 'base64url'));
  if (b64url(bytes) !== value) fail('BAD_BASE64URL', 'base64url no canónico');
  if (expectedLength !== null && bytes.length !== expectedLength) fail('BAD_LENGTH', `se esperaban ${expectedLength} bytes`);
  return bytes;
}

function stripJwk(jwk) {
  if (!jwk || typeof jwk !== 'object') fail('BAD_KEY', 'JWK ausente');
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') fail('BAD_KEY', 'solo P-256');
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') fail('BAD_KEY', 'JWK sin coordenadas');
  unb64url(jwk.x, 32);
  unb64url(jwk.y, 32);
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

export function publicJwk(value) {
  return stripJwk(value?.publicKey ?? value?.pub ?? value);
}

export function keyId(value) {
  const jwk = publicJwk(value);
  return `pci1_${sha256B64Url(canonicalBytes(jwk)).slice(0, 22)}`;
}

export function publicJwkFromPrivate(jwk) {
  const copy = { ...jwk };
  delete copy.d;
  delete copy.key_ops;
  delete copy.ext;
  return stripJwk(copy);
}

export async function generateKeyPair() {
  return subtle.generateKey(ALG, true, ['sign', 'verify']);
}

export async function exportPrivateJwk(privateKey) {
  const jwk = await subtle.exportKey('jwk', privateKey);
  return { ...jwk, key_ops: undefined, ext: undefined };
}

export async function importPrivateJwk(jwk) {
  if (!jwk || typeof jwk.d !== 'string') fail('BAD_PRIVATE_KEY', 'JWK privada incompleta');
  try {
    return await subtle.importKey('jwk', jwk, ALG, true, ['sign']);
  } catch {
    fail('BAD_PRIVATE_KEY', 'JWK privada inválida');
  }
}

export async function importPublicJwk(value) {
  const jwk = publicJwk(value);
  try {
    return await subtle.importKey('jwk', { ...jwk, ext: true }, ALG, false, ['verify']);
  } catch {
    fail('BAD_PUBLIC_KEY', 'clave pública inválida');
  }
}

export async function assertKeyPair(privateKey, publicKey) {
  const derived = publicJwkFromPrivate(await exportPrivateJwk(privateKey));
  const declared = publicJwk(publicKey);
  if (canonicalize(derived) !== canonicalize(declared)) fail('KEY_PAIR_MISMATCH', 'la clave privada no corresponde a la pública');
}

export async function generateCustodian({ name, org }) {
  const pair = await generateKeyPair();
  const pub = publicJwkFromPrivate(await exportPrivateJwk(pair.privateKey));
  return {
    privateKey: pair.privateKey,
    custodian: { kid: keyId(pub), name, org, publicKey: pub },
  };
}

export async function signBytes(privateKey, bytes) {
  const sig = new Uint8Array(await subtle.sign(SIGN_ALG, privateKey, bytesOf(bytes)));
  if (sig.length !== 64) fail('BAD_SIGNATURE_LENGTH', 'firma P-256 inesperada');
  return b64url(sig);
}

export async function verifyBytes(publicKey, signature, bytes) {
  if (typeof signature !== 'string' || !B64URL.test(signature)) return false;
  let sig;
  try {
    sig = unb64url(signature, 64);
  } catch {
    return false;
  }
  try {
    const key = await importPublicJwk(publicKey);
    return await subtle.verify(SIGN_ALG, key, sig, bytesOf(bytes));
  } catch {
    return false;
  }
}

export async function signCanonical(privateKey, value) {
  return signBytes(privateKey, canonicalBytes(value));
}

export async function verifyCanonical(publicKey, signature, value) {
  return verifyBytes(publicKey, signature, canonicalBytes(value));
}
