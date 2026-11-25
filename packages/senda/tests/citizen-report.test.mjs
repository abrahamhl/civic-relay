import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITIZEN_HAZARD_TYPES,
  canonicalJson,
  sha256HexCanonical,
  createCitizenKeyPair,
  exportCitizenKeyPair,
  importCitizenKeyPair,
  stripJpegExif,
  redactRgbaRegions,
  fuzzLocation,
  createConsentRecord,
  createCitizenReport,
  verifyCitizenReport,
  reportToCompactSnd3,
  reportToEncryptedAuthorityEnvelope,
  reportToCourierShards,
  reassembleCourierReport,
  reportToQrChunks,
  reassembleQrChunks,
  reportToGeoUri,
  parseGeoUri,
  reportToSharePack,
  createEvidenceChain,
  verifyEvidenceChainIntegrity,
  compareRunEvidence,
} from '../src/citizen-report.mjs';
import { decodeReports } from '../src/hazard-reports.mjs';
import { generateIdentity, openMessage, unpackEnvelope } from '../src/envelope.mjs';
import { unpackReports } from '../src/hazard-share.mjs';

const CONSENT_OK = {
  accepted: true,
  purpose: 'peritaje_civil_emergencia',
  shareWithAuthorities: true,
  allowVerificationByPassersby: true,
  redactBeforeShare: true,
  consentVersion: 'senda-consent-v1.0',
  acceptedAtIso: '2026-11-25T17:40:00+01:00',
};

const BASE_INPUT = {
  kind: 'nivel_agua',
  operationalStatus: 'EXERCISE',
  modalities: ['foto', 'ubicacion', 'texto'],
  capturedAtIso: '2026-11-25T17:41:00+01:00',
  location: { lat: 39.42691, lon: -0.41742, accuracyM: 8.5, altitudeM: 18.2 },
  camera: { headingDeg: 275, pitchDeg: -12, rollDeg: 1.5, fovDeg: 68 },
  sensors: { accelMs2: { x: 0.12, y: -0.05, z: 9.79 }, barometerHpa: 1011.4, ambientTempC: 19.5 },
  text: 'Agua subiendo rápido junto al puente de Paiporta',
  people: { trapped: 0, injured: 0 },
  measurement: { levelM: 2.35, rise: { cmPerMin: 2.4, stdErr: 0.15 } },
  consent: CONSENT_OK,
};

test('canonicalJson es determinista independientemente del orden de claves y rechaza NaN/Infinity', async () => {
  const a = { b: 1, a: { d: 2, c: [3, -0] } };
  const b = { a: { c: [3, 0], d: 2 }, b: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(await sha256HexCanonical(a), await sha256HexCanonical(b));
  assert.throws(() => canonicalJson({ x: NaN }), /no finito/);
  assert.throws(() => canonicalJson({ x: Infinity }), /no finito/);
});

test('sobre multimodal Ed25519: firma, verificación, exportación de claves y canPublicWarn=false', async () => {
  const kp = await createCitizenKeyPair();
  const exported = await exportCitizenKeyPair(kp);
  const reimported = await importCitizenKeyPair(exported);
  assert.equal(reimported.pseudonymId, kp.pseudonymId);

  const mediaBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6]);
  const env = await createCitizenReport(
    {
      ...BASE_INPUT,
      media: [{ modality: 'foto', mimeType: 'image/png', bytes: mediaBytes, width: 640, height: 480, redacted: true, exifStripped: true }],
    },
    reimported
  );

  assert.equal(env.basis, 'CITIZEN');
  assert.equal(env.canPublicWarn, false);
  assert.equal(env.individualHumanIdentityVerified, false);
  assert.equal(env.payload.media.length, 1);
  assert.equal(env.payload.media[0].byteLength, mediaBytes.length);
  assert.equal(env.payload.privacyFlags.pendingRedaction, false);

  const ver = await verifyCitizenReport(env);
  assert.equal(ver.ok, true);
  assert.equal(ver.pseudonymId, kp.pseudonymId);
  assert.equal(ver.canPublicWarn, false);
});

test('rechazo cerrado ante falta de consentimiento, falta de zona horaria, operationalStatus o manipulación', async () => {
  const kp = await createCitizenKeyPair();
  await assert.rejects(createCitizenReport({ ...BASE_INPUT, consent: { ...CONSENT_OK, accepted: false } }, kp), /CONSENT_REQUIRED/);
  await assert.rejects(createCitizenReport({ ...BASE_INPUT, capturedAtIso: '2026-11-25T17:41:00' }, kp), /zona horaria/);
  await assert.rejects(createCitizenReport({ ...BASE_INPUT, operationalStatus: undefined }, kp), /operationalStatus/);
  await assert.rejects(createCitizenReport({ ...BASE_INPUT, kind: 'inventado' }, kp), /desconocido/);
  await assert.rejects(createCitizenReport({ ...BASE_INPUT, location: { lat: 95, lon: 0, accuracyM: 5 } }, kp), /coordenadas/);
  assert.throws(() => createConsentRecord({ accepted: true, consentVersion: 'v1', acceptedAtIso: 'sin-tz' }), /ISO-8601/);

  const valid = await createCitizenReport(BASE_INPUT, kp);
  // Manipulación del texto tras firmar
  const tamperedText = structuredClone(valid);
  tamperedText.payload.text = 'texto manipulado';
  assert.equal((await verifyCitizenReport(tamperedText)).ok, false);
  assert.equal((await verifyCitizenReport(tamperedText)).reason, 'CONTENT_HASH_MISMATCH');

  // Manipulación de firma
  const tamperedSig = structuredClone(valid);
  tamperedSig.signature.sigB64u = 'A'.repeat(valid.signature.sigB64u.length);
  const resSig = await verifyCitizenReport(tamperedSig);
  assert.equal(resSig.ok, false);
});

test('privacidad: stripJpegExif elimina APP1/APP13/COM y redactRgbaRegions pixeliza exactamente las cajas', async () => {
  // JPEG sintético mínimo con SOI + APP1 (EXIF con GPS/nombre) + COM + DQT + SOS + datos + EOI
  const app1Data = new TextEncoder().encode('Exif\0\0JuanPerezGPS39.42');
  const app1Len = app1Data.length + 2;
  const comData = new TextEncoder().encode('IMEI-PRIVADO');
  const comLen = comData.length + 2;
  const dqtPayload = new Uint8Array([0, 16, 16, 16]);
  const dqtLen = dqtPayload.length + 2;
  const jpeg = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...app1Data, // APP1 EXIF
    0xff, 0xfe, comLen >> 8, comLen & 0xff, ...comData,    // COM
    0xff, 0xdb, dqtLen >> 8, dqtLen & 0xff, ...dqtPayload, // DQT (se conserva)
    0xff, 0xda, 0x00, 0x04, 0x11, 0x22, 0x33, 0x44,        // SOS + datos
    0xff, 0xd9, // EOI
  ]);
  const cleaned = await stripJpegExif(jpeg);
  assert.deepEqual(cleaned.strippedSegments, ['0xFFE1', '0xFFFE']);
  assert.equal(cleaned.exifStripped, true);
  assert.notEqual(cleaned.originalSha256, cleaned.redactedSha256);
  const txt = new TextDecoder('latin1').decode(cleaned.bytes);
  assert.equal(txt.includes('JuanPerez'), false);
  assert.equal(txt.includes('IMEI-PRIVADO'), false);
  assert.equal(cleaned.bytes[0], 0xff);
  assert.equal(cleaned.bytes[1], 0xd8);
  await assert.rejects(stripJpegExif(new Uint8Array([0, 1, 2, 3])), /SOI de JPEG/);

  // Difuminado RGBA: imagen 16x16 con patrón de alto contraste dentro de la caja [0,0,8,8]
  const w = 16, h = 16, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = (x + y) % 2 === 0 ? 250 : 10;
      rgba[idx] = v; rgba[idx + 1] = v; rgba[idx + 2] = v; rgba[idx + 3] = 255;
    }
  }
  const red = await redactRgbaRegions(rgba, w, h, [{ x: 0, y: 0, w: 8, h: 8, label: 'face' }], { blockSize: 4 });
  assert.equal(red.redacted, true);
  assert.equal(red.regions.length, 1);
  // Todos los píxeles del bloque [0..3, 0..3] deben ser iguales a la media (130)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      assert.equal(red.rgba[(y * w + x) * 4], 130);
    }
  }
  // Fuera de la caja (ej. x=12, y=12), la imagen permanece intacta
  assert.equal(red.rgba[(12 * w + 12) * 4], 250);
  // Sin blockSize falla (regla de no inventar parámetros ocultos)
  await assert.rejects(redactRgbaRegions(rgba, w, h, []), /blockSize obligatorio/);

  // Difuminado espacial
  const fz = fuzzLocation({ lat: 39.42691, lon: -0.41742 }, 500);
  assert.equal(fz.fuzzed, true);
  assert.ok(Math.abs(fz.lat - 39.42691) < 0.01);
});

test('adaptadores multicanal: SND3 (160 car.), sobre E2E, fragmentos Reed-Solomon con pérdidas, QR, geo: y BLE', async () => {
  const kp = await createCitizenKeyPair();
  const env = await createCitizenReport({ ...BASE_INPUT, kind: 'desprendimiento' }, kp);

  // 1. SND3 compacto (160 caracteres)
  const snd3 = await reportToCompactSnd3(env, kp);
  assert.equal(snd3.length, 160);
  const decSnd3 = await decodeReports(snd3);
  assert.equal(decSnd3.reports.length, 1);
  assert.equal(decSnd3.rejected.length, 0);

  // 2. Sobre cifrado E2E para comité (envelope.mjs)
  const senderId = await generateIdentity();
  const committeeId = await generateIdentity();
  const now = Date.parse('2026-11-25T17:42:00Z');
  const sealed = await reportToEncryptedAuthorityEnvelope(env, {
    senderIdentity: senderId,
    recipientPublicIdentity: committeeId.publicIdentity,
    now,
  });
  const unpacked = unpackEnvelope(sealed.binary);
  const opened = await openMessage({ recipient: committeeId, envelope: unpacked, now: now + 1000, expectedSender: senderId.publicIdentity });
  const recoveredEnv = JSON.parse(opened.body);
  assert.equal((await verifyCitizenReport(recoveredEnv)).ok, true);
  assert.equal(recoveredEnv.reportId, env.reportId);

  // 3. Fragmentos Reed-Solomon k=4 de n=7: perdemos 3 fragmentos y reconstruimos en desorden
  const rs = await reportToCourierShards(env, { k: 4, n: 7 });
  assert.equal(rs.frames.length, 7);
  const subset = [rs.frames[6], rs.frames[1], rs.frames[4], rs.frames[2]];
  const rebuilt = await reassembleCourierReport(subset, { via: 'LORA+BLE' });
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.envelope.reportId, env.reportId);

  // 4. QR multiparte (desordenados + duplicado)
  const qr = await reportToQrChunks(env, { maxChunkChars: 240 });
  assert.ok(qr.length >= 2);
  const rebuiltQr = await reassembleQrChunks([...qr].reverse().concat(qr[0]));
  assert.equal(rebuiltQr.ok, true);
  assert.equal(rebuiltQr.envelope.reportId, env.reportId);

  // 5. geo: URI (RFC 5870)
  const uri = reportToGeoUri(env);
  assert.match(uri, /^geo:39\.42691,-0\.41742,18\.2;u=8\.5$/);
  const parsedUri = parseGeoUri(uri);
  assert.equal(parsedUri.lat, 39.42691);
  assert.equal(parsedUri.accuracyM, 8.5);

  // 6. Paquete BLE vial (hazard-share)
  const pack = reportToSharePack([env], { now: env.payload.capturedAtMs + 1000 });
  const unpackedBle = unpackReports(pack);
  assert.equal(unpackedBle.reports.length, 1);
  assert.equal(unpackedBle.reports[0].kind, 'obstaculo');
});

test('cadena inmutable de evidencia: verifica hash-chain, separa ABSENT de COLLECTION_ERROR y detecta alteraciones', async () => {
  const chain = createEvidenceChain();
  const e1 = await chain.append({
    runId: 'run-1',
    source: 'SAIH_POYO_A3',
    sourceType: 'GAUGE',
    basis: 'MEASURED',
    observationStatus: 'ABSENT',
    confidence: 'VERIFIED',
    observedAtIso: '2026-11-25T17:00:00Z',
    rawValue: { flowM3s: 1.2 },
    normalizedValue: { anomaly: false },
  });
  const e2 = await chain.append({
    runId: 'run-1',
    source: 'AEMET_STATION_42',
    sourceType: 'RAIN_GAUGE',
    basis: 'MEASURED',
    observationStatus: 'COLLECTION_ERROR',
    confidence: 'VERIFIED', // debe degradarse automáticamente a UNKNOWN
    observedAtIso: '2026-11-25T17:05:00Z',
    rawValue: { error: 'ETIMEDOUT' },
  });
  assert.equal(e1.observationStatus, 'ABSENT');
  assert.equal(e1.confidence, 'VERIFIED');
  assert.equal(e2.confidence, 'UNKNOWN');

  const entries = chain.entries();
  assert.equal((await verifyEvidenceChainIntegrity(entries)).ok, true);

  // Alterar un metadato (ej. confidence) rompe la cadena (corrige hueco de civil-sentry)
  const badMeta = structuredClone(entries);
  badMeta[0].confidence = 'CONTRADICTED';
  const rMeta = await verifyEvidenceChainIntegrity(badMeta);
  assert.equal(rMeta.ok, false);
  assert.equal(rMeta.reason, 'METADATA_OR_CHAIN_TAMPERED');

  // Alterar rawValue rompe la cadena
  const badRaw = structuredClone(entries);
  badRaw[0].rawValue.flowM3s = 2500;
  const rRaw = await verifyEvidenceChainIntegrity(badRaw);
  assert.equal(rRaw.ok, false);
  assert.equal(rRaw.reason, 'RAW_VALUE_TAMPERED');

  // Comparación temporal T0 → T1 (ESCALATED)
  const chain2 = createEvidenceChain();
  await chain2.append({
    runId: 'run-2',
    source: 'SAIH_POYO_A3',
    sourceType: 'GAUGE',
    basis: 'MEASURED',
    observationStatus: 'OBSERVED',
    confidence: 'VERIFIED',
    observedAtIso: '2026-11-25T18:55:00Z',
    rawValue: { flowM3s: 2282 },
    normalizedValue: { anomaly: true },
  });
  const diff = compareRunEvidence(chain.entries(), chain2.entries());
  assert.equal(diff.proofs.some((p) => p.kind === 'ESCALATED' && p.key === 'SAIH_POYO_A3|GAUGE'), true);
});

test('catálogo CITIZEN_HAZARD_TYPES cubre todos los peligros pedidos en el protocolo', () => {
  for (const k of ['fuego', 'combustible', 'inundacion', 'nivel_agua', 'desprendimiento', 'carretera', 'visibilidad', 'accidente', 'ferrocarril', 'sos', 'otro']) {
    assert.ok(k in CITIZEN_HAZARD_TYPES, `falta tipo ${k}`);
  }
});
