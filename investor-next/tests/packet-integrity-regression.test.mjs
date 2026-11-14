import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRealEcdsaKeyPair, signAndPackRealOepPacket, verifyRealOepPacket } from '../lib/live-protocol-node.mjs';

test('signed fields, frame metadata and key fingerprint cannot be silently altered', async () => {
  const key = await generateRealEcdsaKeyPair();
  const packet = await signAndPackRealOepPacket({
    privateKey: key.keyPair.privateKey,
    publicKeySpkiHex: key.publicKeySpkiHex,
    fingerprint: key.fingerprint,
    messageId: 'TEST-INTEGRITY-1', status: 'SOS_EXPLICIT', zoneId: 'ZONE-LAB',
    sectorIndex: 3, batteryPct: 80, timestampMs: 1792700000000
  });
  assert.equal((await verifyRealOepPacket(packet)).valid, true);
  for (const [field, value, reason] of [
    ['messageId', 'IMPERSONATED', 'SIGNED_FIELDS_MISMATCH'],
    ['status', 'SAFE', 'SIGNED_FIELDS_MISMATCH'],
    ['zoneId', 'ZONE-OTHER', 'SIGNED_FIELDS_MISMATCH'],
    ['sectorIndex', 9, 'SIGNED_FIELDS_MISMATCH'],
    ['batteryPct', 1, 'SIGNED_FIELDS_MISMATCH'],
    ['timestampMs', packet.timestampMs + 1000, 'SIGNED_FIELDS_MISMATCH'],
    ['canonicalString', 'OEP_V1|FAKE', 'SIGNED_FIELDS_MISMATCH'],
    ['signerFingerprint', '00:00:00:00:00:00:00:00', 'SIGNER_FINGERPRINT_MISMATCH'],
    ['protocol', 'UNTRUSTED', 'FRAME_METADATA_MISMATCH'],
    ['byteLength', 25, 'FRAME_METADATA_MISMATCH'],
    ['crc16Hex', '0x0000', 'FRAME_METADATA_MISMATCH'],
    ['binaryFrameHex', packet.binaryFrameHex.replace(/^4F 45/, '4F 46'), 'CRC16_MISMATCH']
  ]) {
    const result = await verifyRealOepPacket({ ...packet, [field]: value });
    assert.equal(result.valid, false, `${field} tampering must fail closed`);
    assert.equal(result.reason, reason, `${field} reason`);
  }
});
