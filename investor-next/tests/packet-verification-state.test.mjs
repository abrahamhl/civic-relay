import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assessPacketVerification } from '../lib/packet-verification-state.mjs';

const packet = Object.freeze({ messageId: 'synthetic-test-only', signatureHex: 'DEADBEEF' });

test('invalid ECDSA signature cannot enter the accepted packet view', () => {
  assert.deepEqual(assessPacketVerification(packet, { valid: false, reason: 'INVALID_ECDSA_SIGNATURE' }),
    { packet: null, status: 'SIGNATURE_INVALID' });
});

test('CRC mismatch cannot enter the accepted packet view', () => {
  assert.deepEqual(assessPacketVerification(packet, { valid: false, reason: 'CRC_MISMATCH' }),
    { packet: null, status: 'SIGNATURE_INVALID' });
});

test('malformed or missing verification fails closed', () => {
  assert.equal(assessPacketVerification(packet, null).packet, null);
  assert.equal(assessPacketVerification(null, { valid: true }).packet, null);
  assert.equal(assessPacketVerification(packet, { valid: 'true' }).packet, null);
});

test('valid self-signed packet is displayed as untrusted, not authorized', () => {
  const result = assessPacketVerification(packet, { valid: true });
  assert.equal(result.packet, packet);
  assert.equal(result.status, 'SIGNATURE_VALID_UNTRUSTED');
  assert.notEqual(result.status, 'SENDER_TRUSTED');
});

test('BroadcastChannel UI uses assessed packets and renders verification failures', () => {
  const source = readFileSync(new URL('../app/live-hardware-console.tsx', import.meta.url), 'utf8');
  assert.match(source, /setLastPacket\(assessPacketVerification\(incoming, ver\)\.packet\)/);
  assert.doesNotMatch(source, /setLastPacket\(incoming\)/);
  assert.match(source, /\{verifyState && \(/);
  assert.match(source, /STATUS: \{verifyState\.trustStatus\}/);
  assert.match(source, /role="status"/);
});
