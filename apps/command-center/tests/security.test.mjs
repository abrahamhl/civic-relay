import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalize, canonicalBytes } from '../src/security/canonical.mjs';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  deriveSharedAesKey,
  decryptJson,
  encryptJson,
  generateAgreementIdentity,
  generateSigningIdentity,
  hexToBytes,
  importSigningPublicKey,
  sha256Hex,
  signBytes,
  verifyBytes,
} from '../src/security/crypto.mjs';
import { createEnvelope, envelopeId, verifyEnvelope } from '../src/security/envelope.mjs';
import {
  createOutbox,
  createReplayGuard,
  getTransportInventory,
  TRANSPORT_STATUS,
} from '../src/security/transport.mjs';
import { verifySnapshotManifest } from '../src/security/manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const repoRoot = path.resolve(appDir, '..', '..');

test('canonical JSON is stable across key order and normalises -0', () => {
  const a = { b: 1, a: { d: [3, 2, 1], c: 'x' } };
  const b = { a: { c: 'x', d: [3, 2, 1] }, b: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(canonicalize({ z: -0 }), '{"z":0}');
  assert.equal(canonicalize({ a: undefined, b: 1 }), '{"b":1}');
});

test('canonical JSON rejects values that cannot be signed unambiguously', () => {
  assert.throws(() => canonicalize({ x: Number.NaN }), /non-finite/);
  assert.throws(() => canonicalize({ x: Number.POSITIVE_INFINITY }), /non-finite/);
  assert.throws(() => canonicalize({ x: 1n }), /bigint/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalize(cyclic), /cyclic/);
});

test('SHA-256 matches the published test vector', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('base64 and hex helpers round-trip arbitrary bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
  assert.deepEqual(hexToBytes(bytesToHex(bytes)), bytes);
});

test('Ed25519 signs and verifies, and rejects a tampered message', async () => {
  const identity = await generateSigningIdentity();
  const message = canonicalBytes({ hello: 'senda', n: 1 });
  const signature = await signBytes(identity.privateKey, message);

  assert.equal(await verifyBytes(identity.publicKey, signature, message), true);
  assert.equal(await verifyBytes(identity.publicKey, signature, canonicalBytes({ hello: 'senda', n: 2 })), false);

  const imported = await importSigningPublicKey(identity.publicKeyRaw);
  assert.equal(await verifyBytes(imported, signature, message), true);
  assert.equal(identity.fingerprint, await sha256Hex(identity.publicKeyRaw));
});

test('X25519 + HKDF + AES-256-GCM round-trips and fails with the wrong peer', async () => {
  const alice = await generateAgreementIdentity();
  const bob = await generateAgreementIdentity();
  const mallory = await generateAgreementIdentity();

  const salt = new Uint8Array(16).fill(7);
  const info = 'senda/transport/v1';

  const aliceKey = await deriveSharedAesKey(alice.privateKey, bob.publicKeyRaw, { salt, info });
  const bobKey = await deriveSharedAesKey(bob.privateKey, alice.publicKeyRaw, { salt, info });

  const box = await encryptJson(aliceKey, { order: 'evacuate', zone: 'B' }, 'aad-1');
  assert.deepEqual(await decryptJson(bobKey, box, 'aad-1'), { order: 'evacuate', zone: 'B' });

  await assert.rejects(() => decryptJson(bobKey, box, 'aad-2'));

  const malloryKey = await deriveSharedAesKey(mallory.privateKey, bob.publicKeyRaw, { salt, info });
  await assert.rejects(() => decryptJson(malloryKey, box, 'aad-1'));
});

test('envelope verifies, and detects payload tampering, expiry and sender mismatch', async () => {
  const identity = await generateSigningIdentity();
  const other = await generateSigningIdentity();

  const envelope = await createEnvelope({
    kind: 'SITREP',
    payload: { status: 'green', people: 0 },
    senderPublicKeyRaw: identity.publicKeyRaw,
    privateKey: identity.privateKey,
    ttlSeconds: 600,
  });

  const good = await verifyEnvelope(envelope, {
    publicKey: identity.publicKey,
    publicKeyRaw: identity.publicKeyRaw,
  });
  assert.equal(good.ok, true, good.reasons.join(','));
  assert.equal(good.id, await envelopeId(envelope));

  const tampered = { ...envelope, payload: { status: 'red', people: 0 } };
  const tamperedResult = await verifyEnvelope(tampered, {
    publicKey: identity.publicKey,
    publicKeyRaw: identity.publicKeyRaw,
  });
  assert.equal(tamperedResult.ok, false);
  assert.ok(tamperedResult.reasons.includes('PAYLOAD_TAMPERED'));
  assert.ok(tamperedResult.reasons.includes('SIGNATURE_INVALID'));

  const wrongSender = await verifyEnvelope(envelope, {
    publicKey: other.publicKey,
    publicKeyRaw: other.publicKeyRaw,
  });
  assert.equal(wrongSender.ok, false);
  assert.ok(wrongSender.reasons.includes('SENDER_MISMATCH'));

  const expired = await createEnvelope({
    kind: 'SITREP',
    payload: { status: 'green' },
    senderPublicKeyRaw: identity.publicKeyRaw,
    privateKey: identity.privateKey,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    ttlSeconds: 1,
  });
  const expiredResult = await verifyEnvelope(expired, {
    publicKey: identity.publicKey,
    publicKeyRaw: identity.publicKeyRaw,
  });
  assert.equal(expiredResult.ok, false);
  assert.ok(expiredResult.reasons.includes('EXPIRED'));
});

test('outbox rejects duplicates, replays and expired messages, and orders deterministically', async () => {
  const identity = await generateSigningIdentity();
  const clock = { t: new Date('2026-11-06T12:00:00.000Z') };
  const outbox = createOutbox({ now: () => clock.t, maxItems: 2 });

  const make = (kind, createdAt) =>
    createEnvelope({
      kind,
      payload: { kind },
      senderPublicKeyRaw: identity.publicKeyRaw,
      privateKey: identity.privateKey,
      createdAt,
      ttlSeconds: 3600,
    });

  const first = await make('A', '2026-11-06T12:00:00.000Z');
  const second = await make('B', '2026-11-06T11:59:00.000Z');

  assert.equal((await outbox.enqueue(first)).status, TRANSPORT_STATUS.MESSAGE_ACCEPTED);
  assert.equal((await outbox.enqueue(first)).status, TRANSPORT_STATUS.DUPLICATE_REJECTED);
  assert.equal((await outbox.enqueue(second)).status, TRANSPORT_STATUS.MESSAGE_ACCEPTED);

  const pending = outbox.pending();
  assert.equal(pending.length, 2);
  assert.equal(pending[0].envelope.kind, 'B', 'earlier createdAt sorts first');

  const third = await make('C', '2026-11-06T12:01:00.000Z');
  assert.equal((await outbox.enqueue(third)).status, TRANSPORT_STATUS.OUTBOX_FULL);

  const ack = outbox.ack(pending[0].id);
  assert.equal(ack.ok, true);
  assert.equal(outbox.stats().ACKNOWLEDGED, 1);

  clock.t = new Date('2026-11-06T14:00:00.000Z');
  const expired = outbox.expire();
  assert.equal(expired.length, 1);
  assert.equal(outbox.stats().EXPIRED, 1);
});

test('replay guard rejects a second commit of the same id or nonce', () => {
  const guard = createReplayGuard();
  assert.equal(guard.commit('id-1', 'nonce-1').ok, true);
  assert.equal(guard.commit('id-1', 'nonce-2').ok, false);
  assert.equal(guard.commit('id-2', 'nonce-1').ok, false);
  assert.equal(guard.commit('id-2', 'nonce-2').ok, true);
  assert.equal(guard.has('id-1', 'nonce-1'), true);
});

test('transport inventory never claims a working radio link', () => {
  const inventory = getTransportInventory();
  assert.equal(inventory.status, TRANSPORT_STATUS.NO_NETWORK_TRANSPORT_CONFIGURED);
  assert.equal(inventory.offlineQueue, TRANSPORT_STATUS.OFFLINE_STORE_AND_FORWARD_READY);
  assert.equal(inventory.configuredPaths.length, 0);
  assert.ok(inventory.nonGuarantees.some((line) => line.includes('No radio link')));
});

test('snapshot manifest verifies against the exact bytes on disk', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(appDir, 'src/data/snapshot/manifest.json'), 'utf8'),
  );

  const readText = (snapshotPath) => readFile(path.join(appDir, snapshotPath), 'utf8');

  const result = await verifySnapshotManifest(manifest, readText);
  assert.equal(result.ok, true, JSON.stringify(result.results.filter((r) => !r.ok)));
  assert.equal(result.fileCount, 4);

  const tampered = await verifySnapshotManifest(manifest, async (snapshotPath) => {
    const text = await readText(snapshotPath);
    return snapshotPath.endsWith('estado.json') ? `${text} ` : text;
  });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.results.find((r) => r.id === 'estado').ok, false);
});

test('snapshot files are byte-identical to their repository sources', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(appDir, 'src/data/snapshot/manifest.json'), 'utf8'),
  );

  for (const file of manifest.files) {
    const snapshot = await readFile(path.join(appDir, file.snapshotPath));
    const source = await readFile(path.join(repoRoot, file.repositoryPath));
    assert.deepEqual(snapshot, source, `${file.id} drifted from ${file.repositoryPath}`);
  }
});
