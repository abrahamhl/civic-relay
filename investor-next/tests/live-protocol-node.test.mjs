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
  assert.equal(sigCheck.reason, 'SIGNED_FIELDS_MISMATCH');
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

test('LiveHardwareAndDealRoomConsole exposes 8 real funding tracks and ChatGPT prompts in EN, ES, and NL', () => {
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
    assert.equal(
      consoleFile.split(`id: '${id}'`).length - 1,
      3,
      `Missing localized funding track ${id}`
    );
  }
});

test('browser privacy guard: denied microphone never generates fictional acoustic FFT', () => {
  const source = readFileSync(resolve(root, 'investor-next/app/live-hardware-console.tsx'), 'utf8');
  const scanner = source.slice(source.indexOf('  const toggleLiveFftScanner = async () => {'), source.indexOf('  const liveOrbits = useMemo'));
  assert.ok(scanner.includes('navigator.mediaDevices.getUserMedia'));
  assert.ok(scanner.includes('setMicActive(false)'));
  assert.ok(scanner.includes('setFftBins(Array.from({ length: 32 }, () => 0))'));
  assert.ok(!scanner.includes('Fallback oscillator'));
  assert.ok(!scanner.includes('Math.sin('));
  assert.match(source, /const \[fftBins, setFftBins\] = useState<number\[\]>\(Array\.from\(\{ length: 32 \}, \(\) => 0\)\)/);
});

test('browser privacy guard: stop and unmount release microphone and FFT resources', () => {
  const source = readFileSync(resolve(root, 'investor-next/app/live-hardware-console.tsx'), 'utf8');
  const cleanup = source.slice(source.indexOf('      window.clearInterval(clockInterval);'), source.indexOf('  const triggerRealSignedTransmission'));
  const scanner = source.slice(source.indexOf('  const toggleLiveFftScanner = async () => {'), source.indexOf('  const liveOrbits = useMemo'));
  for (const block of [cleanup, scanner]) {
    assert.ok(block.includes('micRequestEpochRef.current += 1'));
    assert.ok(block.includes('cancelAnimationFrame(rafRef.current)'));
    assert.ok(block.includes('getTracks().forEach((track) => track.stop())'));
    assert.ok(block.includes('audioCtxRef.current.close()'));
  }
  assert.ok(scanner.includes('requestEpoch !== micRequestEpochRef.current'));
});

test('browser privacy guard: clear invalidates pending signatures and delayed UI updates', () => {
  const source = readFileSync(resolve(root, 'investor-next/app/live-hardware-console.tsx'), 'utf8');
  const transmission = source.slice(source.indexOf('  const triggerRealSignedTransmission = async'), source.indexOf('  const clearDiskQueue = () => {'));
  const clearing = source.slice(source.indexOf('  const clearDiskQueue = () => {'), source.indexOf('  const toggleLiveFftScanner = async'));
  const bootstrap = source.slice(source.indexOf('    const bootstrapEpoch = queueEpochRef.current;'), source.indexOf('    // Listen on BroadcastChannel'));
  assert.ok(clearing.includes('queueEpochRef.current += 1'));
  assert.ok(clearing.includes('window.localStorage.removeItem(STORAGE_KEY)'));
  assert.ok(clearing.includes('setLastPacket(null)'));
  assert.ok(transmission.indexOf('if (queueEpoch !== queueEpochRef.current) return;') < transmission.indexOf('window.localStorage.setItem'));
  assert.equal(transmission.split('if (queueEpoch !== queueEpochRef.current) return;').length - 1, 2);
  assert.ok(bootstrap.includes('if (bootstrapEpoch !== queueEpochRef.current) return;'));
});
