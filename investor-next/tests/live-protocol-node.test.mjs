import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateRealEcdsaKeyPair,
  signAndPackRealOepPacket,
  verifyRealOepPacket,
  computeLiveOrbitalEphemeris
} from '../lib/live-protocol-node.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('real WebCrypto ECDSA P-256 key generation, signing, and verification succeed without simulation', async () => {
  const bundle = await generateRealEcdsaKeyPair();
  assert.equal(bundle.algorithm, 'ECDSA-P256-SHA256');
  assert.ok(bundle.publicKeySpkiHex.length > 60);
  assert.match(bundle.fingerprint, /^([0-9A-F]{2}:){7}[0-9A-F]{2}$/);

  const packet = await signAndPackRealOepPacket({
    privateKey: bundle.keyPair.privateKey,
    publicKeySpkiHex: bundle.publicKeySpkiHex,
    fingerprint: bundle.fingerprint,
    messageId: 'MSG-REAL-01',
    status: 'SOS_EXPLICIT',
    zoneId: 'ZONE-VLC-01',
    sectorIndex: 3,
    batteryPct: 81,
    timestampMs: 1792569600000
  });

  assert.equal(packet.protocol, 'OEP_REAL_EXECUTION_V1');
  assert.equal(packet.byteLength, 24);
  assert.ok(packet.signatureHex.length >= 120);

  const verified = await verifyRealOepPacket(packet);
  assert.equal(verified.valid, true);
  assert.equal(verified.crc16Verified, true);
  assert.equal(verified.ecdsaVerified, true);
  assert.equal(verified.reason, 'CRYPTOGRAPHICALLY_VERIFIED_ECDSA_P256');
});

test('real WebCrypto verifier rejects tampered binary CRC-16 frames and forged ECDSA signatures', async () => {
  const bundle = await generateRealEcdsaKeyPair();
  const packet = await signAndPackRealOepPacket({
    privateKey: bundle.keyPair.privateKey,
    publicKeySpkiHex: bundle.publicKeySpkiHex,
    fingerprint: bundle.fingerprint,
    messageId: 'MSG-REAL-02',
    status: 'SAFE'
  });

  // Tamper with the binary frame hex
  const tamperedCrcPacket = {
    ...packet,
    binaryFrameHex: packet.binaryFrameHex.replace(/^4F 45/, '4F 46')
  };
  const crcCheck = await verifyRealOepPacket(tamperedCrcPacket);
  assert.equal(crcCheck.valid, false);
  assert.equal(crcCheck.reason, 'CRC16_MISMATCH');

  // Tamper with canonical string while keeping CRC intact
  const tamperedSigPacket = {
    ...packet,
    canonicalString: packet.canonicalString.replace('|SAFE|', '|SOS_EXPLICIT|')
  };
  const sigCheck = await verifyRealOepPacket(tamperedSigPacket);
  assert.equal(sigCheck.valid, false);
  assert.equal(sigCheck.reason, 'INVALID_ECDSA_SIGNATURE');
});

test('real-time Keplerian orbital ephemeris computes elevation, azimuth, slant range and Doppler across 4 shells', () => {
  const passes = computeLiveOrbitalEphemeris(1792569600000, 39.4699, -0.3763);
  assert.equal(passes.length, 4);
  for (const p of passes) {
    assert.ok(p.elevationDeg >= 12 && p.elevationDeg <= 89);
    assert.ok(p.azimuthDeg >= 0 && p.azimuthDeg <= 360);
    assert.ok(p.slantRangeKm >= p.altitudeKm);
    assert.ok(Number.isFinite(p.dopplerShiftHz));
    assert.ok(p.fsplDb > 130);
  }
});

test('funding catalogue has eight source-gated options shared by the three locales', () => {
  const page = readFileSync(resolve(root, 'investor-next/app/investor-page.tsx'), 'utf8');
  const consoleFile = readFileSync(resolve(root, 'investor-next/app/live-hardware-console.tsx'), 'utf8');
  assert.ok(page.includes('<LiveHardwareAndDealRoomConsole locale={locale}/>'));
  for (const id of [
    'F01-NLNET',
    'F02-HORIZON-CL3',
    'F03-NATO-DIANA',
    'F04-EIC-ACCELERATOR',
    'F05-GSMA-HUMANITARIAN',
    'F06-CDTI-NEOTEC-SPAIN',
    'F07-RVO-NETHERLANDS',
    'F08-VC-DEEPTECH-SEED'
  ]) {
    assert.equal(consoleFile.split(`id: '${id}'`).length - 1, 1, `Missing unique catalogue entry ${id}`);
  }
  assert.ok(consoleFile.includes('const fundingDescriptions: Record<Locale, string[]>'), 'missing trilingual descriptions');
  assert.ok(consoleFile.includes("(['es','en','nl'] as const).reduce"), 'all locales must render the same sourced catalogue');
  assert.ok(consoleFile.includes("target.id === 'F01-NLNET' ? ''"), 'NLnet must not auto-generate applications');
});
