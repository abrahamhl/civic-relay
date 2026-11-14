// Signed message envelope (SENDA/1).
//
// A signature covers every field except the signature itself. The payload hash
// is redundant with the signed payload on purpose: it lets a store-and-forward
// relay deduplicate without decrypting, and it makes a tampered payload fail
// twice.
//
// This is a message format, not a transport. It says nothing about how bytes
// move. Offline delivery is handled by the outbox, which never marks a message
// delivered without an explicit acknowledgement.

import { canonicalBytes, canonicalize } from './canonical.mjs';
import {
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  sha256Hex,
  signBytes,
  verifyBytes,
} from './crypto.mjs';

export const ENVELOPE_SCHEMA = 'senda-secure-envelope/v1';
export const ENVELOPE_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

const SIGNED_FIELDS = [
  'schema',
  'kind',
  'sender',
  'recipient',
  'createdAt',
  'expiresAt',
  'nonce',
  'payloadSha256',
  'payload',
];

function signedBody(envelope) {
  const body = {};
  for (const field of SIGNED_FIELDS) body[field] = envelope[field];
  return body;
}

export async function createEnvelope({
  kind,
  payload,
  senderPublicKeyRaw,
  privateKey,
  recipient = 'BROADCAST',
  createdAt = new Date().toISOString(),
  ttlSeconds = 60 * 60,
}) {
  if (!kind || typeof kind !== 'string') throw new TypeError('envelope kind is required');
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > ENVELOPE_MAX_TTL_SECONDS) {
    throw new RangeError(`ttlSeconds must be in (0, ${ENVELOPE_MAX_TTL_SECONDS}]`);
  }
  if (!senderPublicKeyRaw) throw new TypeError('senderPublicKeyRaw is required');

  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) throw new TypeError('createdAt must be an ISO date');

  const envelope = {
    schema: ENVELOPE_SCHEMA,
    kind,
    sender: await sha256Hex(senderPublicKeyRaw),
    recipient,
    createdAt: new Date(createdMs).toISOString(),
    expiresAt: new Date(createdMs + ttlSeconds * 1000).toISOString(),
    nonce: bytesToBase64(randomBytes(16)),
    payloadSha256: await sha256Hex(canonicalBytes(payload)),
    payload,
  };

  const signature = await signBytes(privateKey, canonicalBytes(signedBody(envelope)));
  return {
    ...envelope,
    signature,
    sigAlg: 'Ed25519',
    canonicalization: 'SJSON-1',
  };
}

export async function envelopeId(envelope) {
  return sha256Hex(canonicalBytes(signedBody(envelope)));
}

/**
 * @typedef {Object} VerifyEnvelopeOptions
 * @property {CryptoKey | null} [publicKey]
 * @property {Uint8Array | null} [publicKeyRaw]
 * @property {Date} [now]
 * @property {number} [maxSkewMs]
 */

/**
 * @param {any} envelope
 * @param {VerifyEnvelopeOptions} [options]
 */
export async function verifyEnvelope(
  envelope,
  { publicKey = null, publicKeyRaw = null, now = new Date(), maxSkewMs = 5 * 60 * 1000 } = {},
) {
  const reasons = [];
  const checks = [];

  const requireField = (name, predicate) => {
    const ok = predicate(envelope?.[name]);
    checks.push({ name, ok });
    if (!ok) reasons.push(`FIELD_INVALID:${name}`);
  };

  requireField('schema', (v) => v === ENVELOPE_SCHEMA);
  requireField('sigAlg', (v) => v === 'Ed25519');
  requireField('canonicalization', (v) => v === 'SJSON-1');
  requireField('kind', (v) => typeof v === 'string' && v.length > 0 && v.length <= 64);
  requireField('sender', (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v));
  requireField('recipient', (v) => typeof v === 'string' && v.length > 0 && v.length <= 64);
  requireField('nonce', (v) => {
    try {
      return typeof v === 'string' && base64ToBytes(v).length === 16;
    } catch {
      return false;
    }
  });
  requireField('payloadSha256', (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v));
  requireField('signature', (v) => typeof v === 'string' && v.length > 0);

  const createdMs = Date.parse(envelope?.createdAt);
  const expiresMs = Date.parse(envelope?.expiresAt);
  const nowMs = now.getTime();

  checks.push({ name: 'createdAt', ok: Number.isFinite(createdMs) });
  if (!Number.isFinite(createdMs)) reasons.push('FIELD_INVALID:createdAt');

  checks.push({ name: 'expiresAt', ok: Number.isFinite(expiresMs) && expiresMs > createdMs });
  if (!Number.isFinite(expiresMs) || expiresMs <= createdMs) reasons.push('FIELD_INVALID:expiresAt');

  const notExpired = Number.isFinite(expiresMs) && nowMs < expiresMs;
  checks.push({ name: 'notExpired', ok: notExpired });
  if (!notExpired) reasons.push('EXPIRED');

  const notFuture = Number.isFinite(createdMs) && createdMs <= nowMs + maxSkewMs;
  checks.push({ name: 'notFuture', ok: notFuture });
  if (!notFuture) reasons.push('CREATED_IN_FUTURE');

  let payloadHashOk = false;
  try {
    payloadHashOk = (await sha256Hex(canonicalBytes(envelope.payload))) === envelope.payloadSha256;
  } catch {
    payloadHashOk = false;
  }
  checks.push({ name: 'payloadSha256', ok: payloadHashOk });
  if (!payloadHashOk) reasons.push('PAYLOAD_TAMPERED');

  if (publicKeyRaw) {
    const fingerprint = await sha256Hex(publicKeyRaw);
    const senderOk = fingerprint === envelope.sender;
    checks.push({ name: 'senderFingerprint', ok: senderOk });
    if (!senderOk) reasons.push('SENDER_MISMATCH');
  }

  let signatureOk = false;
  if (publicKey && typeof envelope.signature === 'string') {
    try {
      signatureOk = await verifyBytes(
        publicKey,
        envelope.signature,
        canonicalBytes(signedBody(envelope)),
      );
    } catch {
      signatureOk = false;
    }
  }
  checks.push({ name: 'signature', ok: signatureOk });
  if (!signatureOk) reasons.push('SIGNATURE_INVALID');

  return {
    ok: reasons.length === 0,
    reasons,
    checks,
    id: await envelopeId(envelope),
  };
}

export { signedBody as __signedBodyForTests, canonicalize as __canonicalizeForTests };
