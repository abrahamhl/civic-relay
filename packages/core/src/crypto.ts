/** Experimental primitives only; the demo dispatch path does not provide E2E. */
import type { MessageEnvelope } from '@civic-relay/schemas';
import sodium from 'libsodium-wrappers-sumo';

async function getSodium() {
  await sodium.ready;
  return sodium;
}

/** Keys are libsodium ORIGINAL Base64 (standard alphabet, with padding). */
export interface SigningKeyPair {
  readonly algorithm: 'Ed25519';
  readonly publicKey: string;
  readonly secretKey: string;
}

export interface EncryptionKeyPair {
  readonly algorithm: 'X25519';
  readonly publicKey: string;
  readonly secretKey: string;
}

/** Generate signing keys only. Never pass this public key to encryptMessage. */
export async function generateKeyPair(): Promise<SigningKeyPair> {
  const lib = await getSodium();
  const keys = lib.crypto_sign_keypair();
  return {
    algorithm: 'Ed25519',
    publicKey: lib.to_base64(keys.publicKey, lib.base64_variants.ORIGINAL),
    secretKey: lib.to_base64(keys.privateKey, lib.base64_variants.ORIGINAL),
  };
}

export async function generateEncryptionKeyPair(): Promise<EncryptionKeyPair> {
  const lib = await getSodium();
  const keys = lib.crypto_box_keypair();
  return {
    algorithm: 'X25519',
    publicKey: lib.to_base64(keys.publicKey, lib.base64_variants.ORIGINAL),
    secretKey: lib.to_base64(keys.privateKey, lib.base64_variants.ORIGINAL),
  };
}

/** Optional browser helper, not called by KeySetup. No recovery API is provided. */
export async function storeKeyPair(
  keyPair: SigningKeyPair | EncryptionKeyPair,
  passphrase: string
): Promise<void> {
  if (!passphrase.trim()) throw new Error('A non-empty passphrase is required');
  if (keyPair.algorithm !== 'Ed25519' && keyPair.algorithm !== 'X25519') {
    throw new Error('Unsupported key algorithm');
  }

  const lib = await getSodium();
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const metadata = { algorithm: keyPair.algorithm, publicKey: keyPair.publicKey };
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(metadata)) },
    aesKey,
    encoder.encode(keyPair.secretKey)
  );

  // Bind the public key and its purpose to the encrypted secret, in separate slots.
  localStorage.setItem(`civic-relay-keypair:${keyPair.algorithm}`, JSON.stringify({
    ...metadata,
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    cipher: 'AES-256-GCM',
    encryptedSecretKey: lib.to_base64(new Uint8Array(encrypted), lib.base64_variants.ORIGINAL),
    salt: lib.to_base64(salt, lib.base64_variants.ORIGINAL),
    iv: lib.to_base64(iv, lib.base64_variants.ORIGINAL),
  }));
}

const SEALED_BOX_ALGORITHM = 'X25519-XSalsa20-Poly1305-SealedBox';

/**
 * Encrypt payload only, using generateEncryptionKeyPair().publicKey.
 * A raw Base64 public key cannot identify its curve; callers must select X25519.
 * Sealed boxes do not authenticate the sender or protect envelope metadata.
 */
export async function encryptMessage(
  message: MessageEnvelope,
  recipientPublicKey: string
): Promise<MessageEnvelope> {
  const lib = await getSodium();
  const payloadBytes = new TextEncoder().encode(JSON.stringify(message.payload));
  const publicKey = lib.from_base64(recipientPublicKey, lib.base64_variants.ORIGINAL);
  const ciphertext = lib.crypto_box_seal(payloadBytes, publicKey);

  return {
    ...message,
    payload: {
      encrypted: true,
      ciphertext: lib.to_base64(ciphertext, lib.base64_variants.ORIGINAL),
      algorithm: SEALED_BOX_ALGORITHM,
    },
  };
}

/** Throws on unsupported payloads, wrong keys or corrupted ciphertext. */
export async function decryptMessage(
  message: MessageEnvelope,
  recipientKeys: EncryptionKeyPair
): Promise<MessageEnvelope> {
  const lib = await getSodium();
  if (recipientKeys.algorithm !== 'X25519') throw new Error('X25519 keys are required');
  const payload = message.payload;
  if (payload.encrypted !== true || payload.algorithm !== SEALED_BOX_ALGORITHM ||
      typeof payload.ciphertext !== 'string') {
    throw new Error('Unsupported encrypted payload');
  }

  const plaintext = lib.crypto_box_seal_open(
    lib.from_base64(payload.ciphertext, lib.base64_variants.ORIGINAL),
    lib.from_base64(recipientKeys.publicKey, lib.base64_variants.ORIGINAL),
    lib.from_base64(recipientKeys.secretKey, lib.base64_variants.ORIGINAL)
  );
  if (!plaintext) throw new Error('Decryption failed');
  const decrypted: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) {
    throw new Error('Decrypted payload must be a JSON object');
  }
  return { ...message, payload: decrypted as MessageEnvelope['payload'] };
}

function signedMessageBytes(message: MessageEnvelope): Uint8Array {
  // Explicit immutable fields exclude signatures and mutable routing/delivery history.
  const fields: Omit<MessageEnvelope, 'deliveryHistory'> = {
    id: message.id,
    incidentId: message.incidentId,
    createdAt: message.createdAt,
    origin: message.origin,
    payloadType: message.payloadType,
    payload: message.payload,
    priority: message.priority,
    approximateLocation: message.approximateLocation,
    ttl: message.ttl,
    verificationState: message.verificationState,
  };
  const serialized = JSON.stringify(fields, (_key, value) => {
    // Normalize object key order, including nested payload/location objects, not arrays.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    }
    return value;
  });
  return new TextEncoder().encode(`civic-relay:message:v1\n${serialized}`);
}

/** Sign the immutable JSON envelope using an Ed25519 secret key. */
export async function signMessage(message: MessageEnvelope, secretKey: string): Promise<string> {
  const lib = await getSodium();
  const signature = lib.crypto_sign_detached(
    signedMessageBytes(message),
    lib.from_base64(secretKey, lib.base64_variants.ORIGINAL)
  );
  return lib.to_base64(signature, lib.base64_variants.ORIGINAL);
}

/** A valid signature proves key possession, not an origin's identity or OFFICIAL authority. */
export async function verifySignature(
  message: MessageEnvelope,
  signature: string,
  publicKey: string
): Promise<boolean> {
  const lib = await getSodium();
  try {
    return lib.crypto_sign_verify_detached(
      lib.from_base64(signature, lib.base64_variants.ORIGINAL),
      signedMessageBytes(message),
      lib.from_base64(publicKey, lib.base64_variants.ORIGINAL)
    );
  } catch {
    return false;
  }
}

export const CryptoManager = {
  generateKeyPair,
  generateEncryptionKeyPair,
  storeKeyPair,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
};
