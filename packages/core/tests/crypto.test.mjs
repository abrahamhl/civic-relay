import assert from 'node:assert/strict';
import { test } from 'node:test';
import sodium from 'libsodium-wrappers-sumo';
import {
  CryptoManager,
  generateKeyPair,
  generateEncryptionKeyPair,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
  storeKeyPair,
} from '../dist/crypto.js';

await sodium.ready;
const encoding = sodium.base64_variants.ORIGINAL;

const localStorageRecords = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: { setItem: (key, value) => localStorageRecords.set(key, value) },
  configurable: true,
});

function message() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    incidentId: null,
    createdAt: '2026-09-09T12:00:00.000Z',
    priority: 'HIGH',
    origin: 'demo-citizen',
    payloadType: 'SOS',
    payload: { text: 'Fictional test only', nested: { b: 2, a: 1 }, items: [1, 2] },
    approximateLocation: { lat: 40.4168, lon: -3.7038, confidence: 'MEDIUM', source: 'MANUAL' },
    ttl: 3600,
    verificationState: 'UNVERIFIED',
    deliveryHistory: [],
  };
}

test('generates separate Ed25519 and X25519 keys with consistent Base64', async () => {
  const signing = await generateKeyPair();
  const encryption = await generateEncryptionKeyPair();
  assert.equal(signing.algorithm, 'Ed25519');
  assert.equal(encryption.algorithm, 'X25519');
  for (const [keys, secretLength] of [[signing, 64], [encryption, 32]]) {
    assert.equal(sodium.from_base64(keys.publicKey, encoding).length, 32);
    assert.equal(sodium.from_base64(keys.secretKey, encoding).length, secretLength);
    for (const key of [keys.publicKey, keys.secretKey]) {
      assert.equal(sodium.to_base64(sodium.from_base64(key, encoding), encoding), key);
    }
  }
  assert.notEqual(signing.publicKey, (await generateKeyPair()).publicKey);
  assert.notEqual(encryption.publicKey, (await generateEncryptionKeyPair()).publicKey);
  assert.equal('generateMnemonic' in CryptoManager, false);
});

test('sealed boxes round-trip JSON payloads without mutating the original envelope', async () => {
  const keys = await generateEncryptionKeyPair();
  const original = message();
  const snapshot = structuredClone(original);
  const encrypted = await encryptMessage(original, keys.publicKey);
  assert.equal(encrypted.payload.encrypted, true);
  assert.equal(encrypted.payload.algorithm, 'X25519-XSalsa20-Poly1305-SealedBox');
  assert.equal('text' in encrypted.payload, false);
  assert.deepEqual(encrypted.approximateLocation, original.approximateLocation);
  assert.deepEqual(await decryptMessage(encrypted, keys), original);
  assert.deepEqual(original, snapshot);
});

test('sealed boxes produce different ciphertexts for the same payload and recipient', async () => {
  const keys = await generateEncryptionKeyPair();
  const first = await encryptMessage(message(), keys.publicKey);
  const second = await encryptMessage(message(), keys.publicKey);
  assert.notEqual(first.payload.ciphertext, second.payload.ciphertext);
});

test('decrypt rejects the wrong recipient and signing keys', async () => {
  const keys = await generateEncryptionKeyPair();
  const encrypted = await encryptMessage(message(), keys.publicKey);
  await assert.rejects(decryptMessage(encrypted, await generateEncryptionKeyPair()));
  await assert.rejects(decryptMessage(encrypted, await generateKeyPair()), /X25519/);
});

test('decrypt rejects tampered and truncated ciphertext', async () => {
  const keys = await generateEncryptionKeyPair();
  const encrypted = await encryptMessage(message(), keys.publicKey);
  const bytes = sodium.from_base64(encrypted.payload.ciphertext, encoding);
  bytes[bytes.length - 1] ^= 1;
  for (const ciphertext of [sodium.to_base64(bytes, encoding), sodium.to_base64(bytes.slice(0, 8), encoding)]) {
    await assert.rejects(decryptMessage({
      ...encrypted, payload: { ...encrypted.payload, ciphertext },
    }, keys));
  }
});

test('decrypt fails closed on plain payloads, unsupported algorithms and malformed Base64', async () => {
  const keys = await generateEncryptionKeyPair();
  const encrypted = await encryptMessage(message(), keys.publicKey);
  await assert.rejects(decryptMessage(message(), keys), /Unsupported/);
  for (const patch of [{ algorithm: 'unknown' }, { encrypted: false }, { ciphertext: '%%%' }]) {
    await assert.rejects(decryptMessage({ ...encrypted, payload: { ...encrypted.payload, ...patch } }, keys));
  }
});

test('decrypt rejects valid sealed boxes containing a non-object JSON payload', async () => {
  const keys = await generateEncryptionKeyPair();
  const encrypted = await encryptMessage(message(), keys.publicKey);
  for (const plaintext of ['null', '[]', '"text"', 'not JSON']) {
    const ciphertext = sodium.to_base64(sodium.crypto_box_seal(
      new TextEncoder().encode(plaintext), sodium.from_base64(keys.publicKey, encoding)
    ), encoding);
    await assert.rejects(decryptMessage({ ...encrypted, payload: { ...encrypted.payload, ciphertext } }, keys));
  }
});

test('Ed25519 verifies the original envelope and rejects a different signer', async () => {
  const keys = await generateKeyPair();
  const original = message();
  const signature = await signMessage(original, keys.secretKey);
  assert.equal(await verifySignature(original, signature, keys.publicKey), true);
  assert.equal(await verifySignature(original, signature, (await generateKeyPair()).publicKey), false);
});

test('signatures reject changed payload and every immutable metadata field', async () => {
  const keys = await generateKeyPair();
  const original = message();
  const signature = await signMessage(original, keys.secretKey);
  const patches = [
    { payload: { ...original.payload, text: 'Forged payload' } },
    { verificationState: 'OFFICIAL' },
    { origin: 'forged-authority' },
    { id: '22222222-2222-4222-8222-222222222222' },
    { incidentId: '22222222-2222-4222-8222-222222222222' },
    { createdAt: '2026-09-10T12:00:00.000Z' },
    { payloadType: 'SAFE' },
    { priority: 'CRITICAL' },
    { ttl: 7200 },
    { approximateLocation: null },
    ...Object.entries({ lat: 0, lon: 0, confidence: 'HIGH', source: 'GPS' }).map(([field, value]) => ({
      approximateLocation: { ...original.approximateLocation, [field]: value },
    })),
  ];
  for (const patch of patches) {
    assert.equal(await verifySignature({ ...original, ...patch }, signature, keys.publicKey), false,
      `Accepted modified fields: ${JSON.stringify(patch)}`);
  }
});

test('signatures ignore routing history and signature fields, but normalize nested object order', async () => {
  const keys = await generateKeyPair();
  const original = message();
  const signature = await signMessage(original, keys.secretKey);
  const forwarded = {
    ...original,
    payload: { items: [1, 2], nested: { a: 1, b: 2 }, text: original.payload.text },
    approximateLocation: { source: 'MANUAL', confidence: 'MEDIUM', lon: -3.7038, lat: 40.4168 },
    signature,
    routingHistory: ['demo-relay'],
    deliveryHistory: [{ transportId: 'demo', attemptedAt: original.createdAt, status: 'DELIVERED' }],
  };
  assert.equal(await verifySignature(forwarded, signature, keys.publicKey), true);
  forwarded.payload.items.reverse();
  assert.equal(await verifySignature(forwarded, signature, keys.publicKey), false);
});

test('malformed signatures and public keys return false', async () => {
  const keys = await generateKeyPair();
  const original = message();
  const signature = await signMessage(original, keys.secretKey);
  for (const malformed of ['%%%', '', 'AA==']) {
    assert.equal(await verifySignature(original, malformed, keys.publicKey), false);
    assert.equal(await verifySignature(original, signature, malformed), false);
  }
});

test('encrypt then sign allows verification before decrypting, not after replacing the payload', async () => {
  const signing = await generateKeyPair();
  const encryption = await generateEncryptionKeyPair();
  const original = message();
  const encrypted = await encryptMessage(original, encryption.publicKey);
  const signature = await signMessage(encrypted, signing.secretKey);
  assert.equal(await verifySignature(encrypted, signature, signing.publicKey), true);
  const decrypted = await decryptMessage(encrypted, encryption);
  assert.deepEqual(decrypted, original);
  assert.equal(await verifySignature(decrypted, signature, signing.publicKey), false);
});

test('optional storage encrypts secrets with fresh salt/IV, authenticates metadata and rejects empty passphrases', async () => {
  const records = localStorageRecords;
  records.clear();
  const passphrase = 'Fictional test passphrase, never use for real keys';
  for (const keys of [await generateKeyPair(), await generateEncryptionKeyPair()]) {
    await assert.rejects(storeKeyPair(keys, '   '), /passphrase/);
    const slot = `civic-relay-keypair:${keys.algorithm}`;
    assert.equal(records.has(slot), false);
    await storeKeyPair(keys, passphrase);
    const serialized = records.get(slot);
    const stored = JSON.parse(serialized);
    assert.equal(serialized.includes(keys.secretKey), false);
    assert.equal(serialized.includes(passphrase), false);
    assert.equal('secretKey' in stored, false);
    assert.equal(stored.publicKey, keys.publicKey);
    assert.equal(stored.kdf, 'PBKDF2-SHA256');
    assert.equal(stored.cipher, 'AES-256-GCM');
    assert.equal(stored.iterations, 100000);
    assert.equal(sodium.from_base64(stored.salt, encoding).length, 16);
    assert.equal(sodium.from_base64(stored.iv, encoding).length, 12);

    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: sodium.from_base64(stored.salt, encoding), iterations: stored.iterations, hash: 'SHA-256' },
      passphraseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const options = {
      name: 'AES-GCM',
      iv: sodium.from_base64(stored.iv, encoding),
      additionalData: encoder.encode(JSON.stringify({ algorithm: stored.algorithm, publicKey: stored.publicKey })),
    };
    const ciphertext = sodium.from_base64(stored.encryptedSecretKey, encoding);
    assert.equal(new TextDecoder().decode(await crypto.subtle.decrypt(options, aesKey, ciphertext)), keys.secretKey);
    await assert.rejects(crypto.subtle.decrypt({ ...options, additionalData: encoder.encode('forged metadata') }, aesKey, ciphertext));
    await storeKeyPair(keys, passphrase);
    const second = JSON.parse(records.get(slot));
    assert.notEqual(second.salt, stored.salt);
    assert.notEqual(second.iv, stored.iv);
    assert.notEqual(second.encryptedSecretKey, stored.encryptedSecretKey);
  }
  assert.equal(records.size, 2);
});
