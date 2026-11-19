import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sha256Hex,
  hmacSha256Bytes,
  calibrateOsintFeeds,
  planSatelliteStoreAndForward,
  verifyGalileoOsnmaTag,
  packMavlinkV2Frame,
  parseMavlinkV2Frame,
  encodeGlobalPositionIntPayload,
  projectDroneGimbalToGround,
  planAerialMuleTour,
  COTS_HARDWARE_KITS,
  encodeKissFrame,
  decodeKissFrame,
  governEtsiDutyCycle,
  compressThermalArray32x24,
  translateMeshProtocol,
  createByzantineValidatorRing,
  createReassembler,
  parseNdwDatexPayload,
} from '../src/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../../evidence/senda/corridor-fabric/fixtures');

describe('SENDA Sovereign Mesh, OSINT Calibration, Satellite NTN, Drones & COTS Hardware Kits', () => {
  it('1. Verifica fixtures reales ampliados (NDW Bridge Openings v3 + CelesTrak Galileo TLE) y calibración OSINT (Brier / ECE / Cuarentena)', () => {
    const prov = JSON.parse(readFileSync(resolve(FIXTURES_DIR, 'fixtures-provenance.json'), 'utf8'));
    const bridgeXml = readFileSync(resolve(FIXTURES_DIR, 'ndw-bridge-openings-v3.xml'), 'utf8');
    const tleText = readFileSync(resolve(FIXTURES_DIR, 'celestrak-galileo-iridium.tle'), 'utf8');

    assert.equal(sha256Hex(bridgeXml), prov.sources.ndwBridgeOpeningsV3.fixtureSha256);
    assert.equal(sha256Hex(tleText), prov.sources.celestrakGalileoOrbitals.fixtureSha256);

    const parsedBridges = parseNdwDatexPayload(bridgeXml, {
      sourceId: 'NDW-NL-BRIDGES-V3',
      roadSegmentId: 'NL-WATERWAY-CORRIDOR',
      capturedFromFixture: true,
    });
    assert.ok(parsedBridges.observations.length >= 4, 'Debe extraer aperturas reales de puentes desde NDW');

    const calibrated = calibrateOsintFeeds([
      {
        feedId: 'NDW-SRTI-V3',
        provider: 'NDW Open Data',
        rawConfidence: 0.90,
        payloadSha256: prov.sources.ndwSituationsV3.fixtureSha256,
        calibrationHistory: [
          { predicted: 0.9, outcome: 1 },
          { predicted: 0.85, outcome: 1 },
          { predicted: 0.15, outcome: 0 },
          { predicted: 0.88, outcome: 1 },
        ],
      },
      {
        feedId: 'UNVERIFIED-SPOOFED-FEED',
        provider: 'UNTRUSTED_SCRAPER',
        rawConfidence: 0.95,
        duplicatePayloadHashSeen: true,
        calibrationHistory: [
          { predicted: 0.95, outcome: 0 },
          { predicted: 0.90, outcome: 0 },
        ],
      },
    ]);

    assert.equal(calibrated[0].quarantined, false);
    assert.ok(calibrated[0].brierScore < 0.05);
    assert.ok(calibrated[0].reliabilityWeight > 0.85);

    assert.equal(calibrated[1].quarantined, true);
    assert.equal(calibrated[1].calibratedConfidence, 0);
    assert.equal(calibrated[1].reliabilityWeight, 0);
    assert.equal(calibrated[1].quarantineReason, 'TIMESTAMP_OR_REPLAY_ANOMALY');
  });

  it('2. Planifica Store-and-Forward satelital (Iridium SBD / Starlink D2C) con Reed-Solomon k-de-n y bloquea cifrado en QO-100', () => {
    const tleText = readFileSync(resolve(FIXTURES_DIR, 'celestrak-galileo-iridium.tle'), 'utf8');
    const secretEnvelopeBytes = new TextEncoder().encode(
      JSON.stringify({ schema: 'senda.envelope/2.0', id: 'SOS-A12-001', lat: 51.9851, lon: 5.9112, msg: 'COLISION MULTIPLES VEHICULOS A12' })
    );

    const plan = planSatelliteStoreAndForward({
      payloadBytes: secretEnvelopeBytes,
      networkId: 'IRIDIUM_SBD',
      tleText,
      isCiphertext: true,
      hardwareTransceiverAttached: false,
      erasureK: 3,
      erasureN: 5,
    });

    assert.equal(plan.hardwareExecutionState, 'BLOCKED');
    assert.equal(plan.erasureCoding.allShardsFitMtu, true);
    assert.equal(plan.erasureCoding.burstFrames.length, 5);
    assert.ok(plan.linkBudget.fsplDb > 150);

    // Simulamos pérdida del 40% de las ráfagas satelitales (solo llegan los fragmentos 1, 3 y 4)
    const reassembler = createReassembler();
    assert.equal(reassembler.add(plan.erasureCoding.burstFrames[1].wireBytes, 'IRIDIUM_SBD'), null);
    assert.equal(reassembler.add(plan.erasureCoding.burstFrames[3].wireBytes, 'STARLINK_D2C'), null);
    const recovered = reassembler.add(plan.erasureCoding.burstFrames[4].wireBytes, 'SKYLO_NTN');
    assert.ok(recovered, 'Con k=3 de n=5 fragmentos debe reconstruirse el sobre íntegro');
    assert.equal(
      new TextDecoder().decode(recovered.data),
      new TextDecoder().decode(secretEnvelopeBytes)
    );

    // Regla ITU: QO-100 rechaza tráfico cifrado opaco
    const qo100Cipher = planSatelliteStoreAndForward({
      payloadBytes: secretEnvelopeBytes,
      networkId: 'QO100',
      isCiphertext: true,
    });
    assert.equal(qo100Cipher.status, 'REJECTED_ITU_AMATEUR_CLEARTEXT_RULE');
  });

  it('3. Verifica autenticación Galileo OSNMA (cadena TESLA + tag HMAC) y detecta spoofing GNSS', () => {
    const teslaKeyHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const teslaRootKeyHex = sha256Hex(teslaKeyHex);
    const navDataHex = '0151f8a20039bc12';
    const prnSvId = 24;
    const gstTowSec = 401400;

    const fullMac = [...hmacSha256Bytes(teslaKeyHex, `${prnSvId}:${gstTowSec}:${navDataHex}`)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const tag40BitHex = fullMac.slice(0, 10);

    const validRes = verifyGalileoOsnmaTag({
      prnSvId,
      gstTowSec,
      navDataHex,
      teslaKeyHex,
      teslaRootKeyHex,
      chainDistance: 1,
      receivedTagHex: tag40BitHex,
    });
    assert.equal(validRes.authentic, true);
    assert.equal(validRes.status, 'GALILEO_OSNMA_AUTHENTICATED');

    const spoofedRes = verifyGalileoOsnmaTag({
      prnSvId,
      gstTowSec,
      navDataHex: 'ffffffff0039bc12', // coordenadas alteradas por spoofer SDR
      teslaKeyHex,
      teslaRootKeyHex,
      chainDistance: 1,
      receivedTagHex: tag40BitHex,
    });
    assert.equal(spoofedRes.authentic, false);
    assert.equal(spoofedRes.status, 'SPOOFING_ALERT_QUARANTINED');
  });

  it('4. Codifica/verifica tramas MAVLink v2 firmadas, proyecta gimbal a tierra con honestidad RTK y planifica Mula Aérea DTN', () => {
    const posPayload = encodeGlobalPositionIntPayload({
      lat: 51.9852,
      lon: 5.9675,
      altMslM: 112,
      relativeAltM: 68,
    });
    const frame = packMavlinkV2Frame({
      msgId: 33,
      seq: 17,
      sysId: 1,
      compId: 1,
      payload: posPayload,
      signingKey: 'senda-drone-corridor-key-2026',
      linkId: 2,
    });

    const parsed = parseMavlinkV2Frame(frame, { signingKey: 'senda-drone-corridor-key-2026' });
    assert.equal(parsed.valid, true);
    assert.equal(parsed.messageName, 'GLOBAL_POSITION_INT');
    assert.equal(parsed.isSigned, true);
    assert.equal(parsed.signatureVerified, true);

    // Si un atacante modifica 1 bit de la latitud en tránsito, falla el CRC o la firma
    const tampered = Uint8Array.from(frame);
    tampered[15] ^= 0x01;
    const rejected = parseMavlinkV2Frame(tampered, { signingKey: 'senda-drone-corridor-key-2026' });
    assert.equal(rejected.valid, false);

    // Fotogrametría sin RTK vs con RTK Fixed
    const nonRtkProj = projectDroneGimbalToGround({
      droneLat: 51.9852,
      droneLon: 5.9675,
      altitudeAglM: 65,
      gimbalPitchDeg: -45,
      gimbalYawDeg: 90,
      rtkFixType: 3, // GNSS estándar
    });
    assert.equal(nonRtkProj.subMeterVerified, false);
    assert.ok(nonRtkProj.uncertainty95RadiusM > 3.0);

    const rtkProj = projectDroneGimbalToGround({
      droneLat: 51.9852,
      droneLon: 5.9675,
      altitudeAglM: 40,
      gimbalPitchDeg: -85,
      gimbalYawDeg: 90,
      rtkFixType: 6, // RTK Fixed
      sigmaAttitudeDeg: 0.15,
    });
    assert.equal(rtkProj.subMeterVerified, true);
    assert.ok(rtkProj.uncertainty95RadiusM < 1.0);

    // Planificador de mula aérea DTN respetando 25% de reserva RTH
    const tour = planAerialMuleTour({
      base: { id: 'BASE-ARNHEM', lat: 51.9851, lon: 5.8987 },
      clusters: [
        { id: 'CLUSTER-VELPERBROEK', lat: 51.9880, lon: 5.9520, sosCount: 3, queuedBytes: 120_000 },
        { id: 'CLUSTER-DUIVEN', lat: 51.9510, lon: 6.0120, sosCount: 1, queuedBytes: 85_000 },
      ],
      batteryWh: 98,
      minRthReservePct: 25,
    });
    assert.equal(tour.rthReserveRespected, true);
    assert.ok(tour.remainingBatteryPct >= 25);
    assert.equal(tour.stops.length, 2);
  });

  it('5. Valida kits COTS Open-Hardware, tramas KISS CRC-16, gobernador ETSI EU868 y compresor térmico MLX90640', () => {
    assert.equal(COTS_HARDWARE_KITS.length, 3);
    assert.ok(COTS_HARDWARE_KITS.every((k) => k.targetCostEur < 75));

    // Trama KISS con bytes especiales 0xC0 y 0xDB que requieren byte-stuffing
    const samplePayload = new Uint8Array([0x01, 0xc0, 0x55, 0xdb, 0x99]);
    const kissEncoded = encodeKissFrame(samplePayload, { port: 1, cmd: 0 });
    const kissDecoded = decodeKissFrame(kissEncoded);
    assert.equal(kissDecoded.valid, true);
    assert.equal(kissDecoded.port, 1);
    assert.deepEqual([...kissDecoded.payload], [...samplePayload]);

    // Gobernador ETSI EN 300 220: cuando g1 (1%, 36s) está llena, promueve SOS a g3 (10%, 869.525 MHz)
    const nowMs = Date.now();
    const saturatedHistory = [{ timestampMs: nowMs - 10_000, subBand: 'EU868_G1_1PCT', airtimeMs: 35_800 }];
    const routineTx = governEtsiDutyCycle({
      historyTransmissions: saturatedHistory,
      nowMs,
      candidateAirtimeMs: 500,
      priority: 'ROUTINE',
    });
    assert.equal(routineTx.allowed, false);

    const sosTx = governEtsiDutyCycle({
      historyTransmissions: saturatedHistory,
      nowMs,
      candidateAirtimeMs: 500,
      priority: 'SOS',
    });
    assert.equal(sosTx.allowed, true);
    assert.equal(sosTx.assignedSubBand, 'EU868_G3_10PCT');
    assert.equal(sosTx.promotedToHighDutySubBand, true);

    // Matriz térmica MLX90640 (32x24 = 768 píxeles) con foco de incendio a 168 °C
    const thermalFrame = new Float32Array(768).fill(21.5);
    thermalFrame[10 * 32 + 14] = 152.0;
    thermalFrame[10 * 32 + 15] = 168.4;
    thermalFrame[11 * 32 + 15] = 144.2;
    const compressed = compressThermalArray32x24(thermalFrame);
    assert.equal(compressed.classification, 'ACTIVE_FIRE_HOTSPOT');
    assert.equal(compressed.hotspotPixelCount, 3);
    assert.equal(compressed.fitsSingleLoRaFrame, true);
    assert.ok(compressed.wireByteLength < 180);
  });

  it('6. Traduce eventos a CAP 1.2 / ETSI DENM / ATAK CoT / Meshtastic y verifica quórum bizantino anti-Sybil', () => {
    const sampleEvent = {
      id: 'EV-A12-VELPERBROEK-09',
      type: 'STATIONARY_VEHICLE_AND_SMOKE',
      lat: 51.9852,
      lon: 5.9675,
      confidence: 0.93,
      roadSegmentId: 'NL-A12-ARNHEM-EDE',
      timestampUtc: '2026-11-08T15:30:00Z',
    };

    const cap = translateMeshProtocol(sampleEvent, 'OASIS_CAP_1_2');
    const denm = translateMeshProtocol(sampleEvent, 'ETSI_C_ITS_DENM');
    const cot = translateMeshProtocol(sampleEvent, 'ATAK_COT_XML');
    const mesh = translateMeshProtocol(sampleEvent, 'MESHTASTIC_RETICULUM');

    assert.ok(cap.payload.includes('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">'));
    assert.equal(denm.payload.denm.situation.eventType.causeCode, 94);
    assert.ok(cot.payload.includes('<event version="2.0"'));
    assert.equal(mesh.payload.seg, 'NL-A12-ARNHEM-EDE');

    // Quórum bizantino multiusuario (3 de 4, mínimo 2 operadores distintos, descuento anti-Sybil por subred)
    const ring = createByzantineValidatorRing({
      ringId: 'RING-NL-A12',
      thresholdM: 3,
      minDistinctOperators: 2,
      validators: [
        { validatorId: 'VAL-RWS-01', operatorOrg: 'RIJKSWATERSTAAT_NDW', secretKey: 'k-rws-1' },
        { validatorId: 'VAL-BRANDWEER-01', operatorOrg: 'VEILIGHEIDSREGIO_GELDERLAND', secretKey: 'k-bw-1' },
        { validatorId: 'VAL-SYBIL-A', operatorOrg: 'FLEET_PARTNER_X', secretKey: 'k-fl-a' },
        { validatorId: 'VAL-SYBIL-B', operatorOrg: 'FLEET_PARTNER_X', secretKey: 'k-fl-b' },
      ],
    });

    // Intento 1: VAL-SYBIL-A y VAL-SYBIL-B firman desde la misma subred 192.168.40 -> 1 queda descontado por anti-Sybil
    const attRws = ring.signAttestation({ validatorId: 'VAL-RWS-01', eventId: sampleEvent.id, eventHash: denm.provenanceHash, subnetPrefix: '10.10.1' });
    const attSybilA = ring.signAttestation({ validatorId: 'VAL-SYBIL-A', eventId: sampleEvent.id, eventHash: denm.provenanceHash, subnetPrefix: '192.168.40' });
    const attSybilB = ring.signAttestation({ validatorId: 'VAL-SYBIL-B', eventId: sampleEvent.id, eventHash: denm.provenanceHash, subnetPrefix: '192.168.40' });

    const sybilAttempt = ring.verifyAndCommitQuorum({
      eventId: sampleEvent.id,
      eventHash: denm.provenanceHash,
      attestations: [attRws, attSybilA, attSybilB],
    });
    assert.equal(sybilAttempt.quorumReached, false);
    assert.equal(sybilAttempt.effectiveVotes, 2);
    assert.equal(sybilAttempt.reason, 'INSUFFICIENT_NON_SYBIL_VOTES');

    // Intento 2: Se incorpora VAL-BRANDWEER-01 desde subred independiente 172.16.8 -> Quórum 3/3 alcanzado y cadena ratcheted
    const attBrandweer = ring.signAttestation({ validatorId: 'VAL-BRANDWEER-01', eventId: sampleEvent.id, eventHash: denm.provenanceHash, subnetPrefix: '172.16.8' });
    const committed = ring.verifyAndCommitQuorum({
      eventId: sampleEvent.id,
      eventHash: denm.provenanceHash,
      attestations: [attRws, attSybilA, attSybilB, attBrandweer],
    });
    assert.equal(committed.quorumReached, true);
    assert.equal(committed.effectiveVotes, 3);
    assert.equal(committed.distinctOperators, 3);
    assert.equal(ring.getChainState().chainStep, 1);
  });
});
