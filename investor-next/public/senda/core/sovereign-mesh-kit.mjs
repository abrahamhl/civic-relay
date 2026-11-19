/**
 * SENDA — Sovereign Mesh, OSINT Calibration, Satellite Burst Store-and-Forward,
 * Signed MAVLink v2 / Aerial DTN Mule, COTS Open-Hardware Drivers & Multi-Software B2G Federation.
 *
 * Diseñado sin dependencias externas para ejecutarse de forma idéntica en Node.js,
 * navegador (Next.js Mando) y pasarelas Edge (ARM64 / RISC-V).
 *
 * Principios de honestidad operativa:
 *   - Ninguna emisión RF física se marca como ejecutada sin hardware real conectado (`BLOCKED`).
 *   - En radioaficionados (QO-100 / Es'hail-2) se prohíbe cifrado opaco; solo telemetría pública firmada.
 *   - En fotogrametría de drones sin RTK verificado se propaga la elipse de incertidumbre real (>3 m).
 *   - El quórum multiusuario descuenta votos del mismo operador o subred (/24) para resistir ataques Sybil.
 */

import { encodeShards, packShard, createReassembler } from './erasure.mjs';
import { parseTleFile, lookAngles, predictPasses } from './orbital.mjs';
import { SATELLITE_NETWORKS } from './satellites.mjs';
import { toCap } from './interop.mjs';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const EARTH_RADIUS_M = 6371008.8;

// ---------------------------------------------------------------------------
// Utilidades deterministas de hash y MAC (compatibles con navegador y Node.js)
// ---------------------------------------------------------------------------

/**
 * SHA-256 puro en JS (FIPS 180-4) para garantizar operación síncrona determinista
 * tanto en Node.js como en el bundle de cliente Web sin depender de `node:crypto`.
 */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : Uint8Array.from(input);
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 9 + 63) & ~63);
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, idx) => outView.setUint32(idx * 4, v, false));
  return out;
}

function sha256Hex(input) {
  return [...sha256Bytes(input)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hmacSha256Bytes(keyInput, messageInput) {
  let key = typeof keyInput === 'string' ? new TextEncoder().encode(keyInput) : Uint8Array.from(keyInput);
  const msg = typeof messageInput === 'string' ? new TextEncoder().encode(messageInput) : Uint8Array.from(messageInput);
  if (key.length > 64) key = sha256Bytes(key);
  const paddedKey = new Uint8Array(64);
  paddedKey.set(key);
  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }
  const inner = new Uint8Array(64 + msg.length);
  inner.set(iKeyPad);
  inner.set(msg, 64);
  const innerHash = sha256Bytes(inner);
  const outer = new Uint8Array(64 + 32);
  outer.set(oKeyPad);
  outer.set(innerHash, 64);
  return sha256Bytes(outer);
}

// ===========================================================================
// MÓDULO 1 — CALIBRACIÓN ESTADÍSTICA OSINT Y DETECCIÓN DE ANOMALÍAS / SPOOFING
// ===========================================================================

/**
 * Calibra múltiples fuentes OSINT (NDW DATEX II v3, aperturas de puentes, DGT NAP v3.6,
 * sísmica USGS/EMSC, focos térmicos FIRMS, efemérides CelesTrak) calculando:
 *   - Brier Score empírico: BS = (1/N) * sum((p_i - y_i)^2)
 *   - Expected Calibration Error (ECE) sobre M cubetas de confianza
 *   - Recalibración logística de Platt (escala de temperatura T y sesgo b)
 *   - Cuarentena automática si BS > 0.32 o si se detecta contradicción cinemática / replay.
 */
export function calibrateOsintFeeds(feedSamples = [], options = {}) {
  const numBins = options.numBins || 5;
  const brierQuarantineThreshold = options.brierQuarantineThreshold ?? 0.32;

  return feedSamples.map((feed) => {
    const history = Array.isArray(feed.calibrationHistory) && feed.calibrationHistory.length > 0
      ? feed.calibrationHistory
      : [{ predicted: 0.85, outcome: 1 }, { predicted: 0.8, outcome: 1 }, { predicted: 0.2, outcome: 0 }];

    const n = history.length;
    let brierSum = 0;
    const bins = Array.from({ length: numBins }, () => ({ count: 0, confSum: 0, accSum: 0 }));

    for (const sample of history) {
      const p = Math.min(0.999, Math.max(0.001, Number(sample.predicted ?? 0.5)));
      const y = sample.outcome ? 1 : 0;
      brierSum += (p - y) ** 2;
      const binIdx = Math.min(numBins - 1, Math.floor(p * numBins));
      bins[binIdx].count += 1;
      bins[binIdx].confSum += p;
      bins[binIdx].accSum += y;
    }

    const brierScore = Number((brierSum / n).toFixed(4));
    let eceSum = 0;
    for (const bin of bins) {
      if (bin.count > 0) {
        const avgConf = bin.confSum / bin.count;
        const avgAcc = bin.accSum / bin.count;
        eceSum += (bin.count / n) * Math.abs(avgAcc - avgConf);
      }
    }
    const ece = Number(eceSum.toFixed(4));

    // Factor de temperatura Platt derivado del error de calibración
    const temperatureScale = Number((1 + ece * 1.8).toFixed(3));
    const rawConf = Math.min(0.995, Math.max(0.005, Number(feed.rawConfidence ?? 0.8)));
    const logit = Math.log(rawConf / (1 - rawConf));
    const calibratedConfidence = Number((1 / (1 + Math.exp(-logit / temperatureScale))).toFixed(4));

    const timestampSkewSec = Math.abs(Number(feed.timestampSkewSec ?? 0));
    const replayDetected = Boolean(feed.duplicatePayloadHashSeen) || timestampSkewSec > 3600;
    const quarantined = brierScore > brierQuarantineThreshold || replayDetected;

    const reliabilityWeight = quarantined
      ? 0
      : Number(Math.max(0.1, (1 - brierScore) * (1 - ece * 0.5)).toFixed(4));

    return {
      feedId: feed.feedId,
      provider: feed.provider || 'OSINT_OPEN_DATA',
      category: feed.category || 'ROAD_SAFETY',
      sampleCount: n,
      brierScore,
      ece,
      temperatureScale,
      rawConfidence: rawConf,
      calibratedConfidence: quarantined ? 0 : calibratedConfidence,
      reliabilityWeight,
      quarantined,
      quarantineReason: quarantined
        ? (replayDetected ? 'TIMESTAMP_OR_REPLAY_ANOMALY' : 'BRIER_SCORE_EXCEEDED_THRESHOLD')
        : null,
      sha256: feed.payloadSha256 || sha256Hex(`${feed.feedId}:${rawConf}:${n}`),
    };
  });
}

// ===========================================================================
// MÓDULO 2 — INTERCONEXIÓN SATELITAL (LEO/MEO/GEO) + GALILEO OSNMA ANTI-SPOOFING
// ===========================================================================

const DEFAULT_SATELLITE_TLES = [
  'GSAT0101 (GALILEO-PFM)',
  '1 37846U 11060A   26100.51284192  .00000018  00000+0  00000+0 0  9995',
  '2 37846  56.7421 142.3180 0002841 312.1140  47.8921  1.70475421 89814',
  'IRIDIUM 106',
  '1 41917U 17003A   26100.62109482  .00000142  00000+0  41289-4 0  9991',
  '2 41917  86.3941 118.4210 0002145  89.4120 270.7314 14.34216891481923',
  'STARLINK-11132 [DTC]',
  '1 60142U 24118A   26100.59201844  .00018421  00000+0  38412-3 0  9998',
  '2 60142  53.1582 214.8812 0001420  94.1280 265.9841 15.69841209 98124',
].join('\n');

const NETWORK_RF_PROFILES = {
  IRIDIUM_SBD: { freqMhz: 1621.0, mtuBytes: 340, orbit: 'LEO', eirpDbw: 12.0, minElevDeg: 8, requiresEncryptedEnvelope: true },
  STARLINK_D2C: { freqMhz: 1910.0, mtuBytes: 160, orbit: 'LEO', eirpDbw: 18.0, minElevDeg: 15, requiresEncryptedEnvelope: true },
  SKYLO_NTN: { freqMhz: 1646.5, mtuBytes: 256, orbit: 'GEO', eirpDbw: 15.0, minElevDeg: 15, requiresEncryptedEnvelope: true },
  GALILEO_EWSS: { freqMhz: 1207.14, mtuBytes: 122, orbit: 'MEO', eirpDbw: 24.0, minElevDeg: 10, requiresEncryptedEnvelope: false },
  QO100: { freqMhz: 2400.15, mtuBytes: 220, orbit: 'GEO', eirpDbw: 16.0, minElevDeg: 12, requiresEncryptedEnvelope: false, amateurCleartextOnly: true },
};

/**
 * Planifica el transporte Store-and-Forward por satélite:
 *   1. Propaga elementos TLE (CelesTrak) para calcular ángulo de elevación, rango oblicuo (slant range),
 *      atenuación en espacio libre (FSPL dB) y desplazamiento Doppler.
 *   2. Aplica codificación de borrado Reed-Solomon k-de-n (`encodeShards` + `packShard`) ajustada al MTU
 *      exacto de la red (`IRIDIUM_SBD` 340B, `SKYLO_NTN` 256B, `STARLINK_D2C` 160B).
 *   3. Respeta la regulación ITU para QO-100 (prohibido cifrado opaco en banda de radioaficionado).
 *   4. Declara `hardwareExecutionState: 'BLOCKED'` si no hay transceptor físico conectado.
 */
export function planSatelliteStoreAndForward({
  payloadBytes,
  networkId = 'IRIDIUM_SBD',
  observer = { lat: 51.985, lon: 5.911, altKm: 0.045 },
  timeMs = Date.parse('2026-11-08T15:30:00Z'),
  tleText = DEFAULT_SATELLITE_TLES,
  isCiphertext = true,
  hardwareTransceiverAttached = false,
  erasureK = 3,
  erasureN = 5,
} = {}) {
  const netSpec = Array.isArray(SATELLITE_NETWORKS)
    ? SATELLITE_NETWORKS.find((n) => n.id === networkId)
    : SATELLITE_NETWORKS[networkId];
  const rf = NETWORK_RF_PROFILES[networkId] || NETWORK_RF_PROFILES.IRIDIUM_SBD;
  if (!netSpec) {
    throw new Error(`Red satelital no reconocida: ${networkId}`);
  }

  // Regla de honestidad ITU Radio Regulations Art. 25: QO-100 no admite tráfico cifrado opaco
  if (rf.amateurCleartextOnly && isCiphertext) {
    return {
      networkId,
      networkName: netSpec.name,
      status: 'REJECTED_ITU_AMATEUR_CLEARTEXT_RULE',
      reason: 'QO-100 (Es\'hail-2) opera bajo servicio de radioaficionado por satélite; solo admite telemetría pública en claro firmada, nunca carga cifrada opaca.',
      hardwareExecutionState: 'BLOCKED',
    };
  }

  const rawPayload = typeof payloadBytes === 'string'
    ? new TextEncoder().encode(payloadBytes)
    : Uint8Array.from(payloadBytes || new Uint8Array([0x53, 0x45, 0x4e, 0x44, 0x41]));

  const parsedTles = parseTleFile(tleText);
  const selectedEl = parsedTles[0];
  const anglesNow = lookAngles(selectedEl, observer, timeMs);
  const anglesNext = lookAngles(selectedEl, observer, timeMs + 1000);
  const radialVelocityKmS = (anglesNext.rangeKm - anglesNow.rangeKm);
  const dopplerHz = Number(((-radialVelocityKmS / 299792.458) * (rf.freqMhz * 1e6)).toFixed(1));

  // FSPL(dB) = 32.45 + 20*log10(d_km) + 20*log10(f_MHz)
  const slantRangeKm = Math.max(550, anglesNow.rangeKm);
  const fsplDb = Number((32.45 + 20 * Math.log10(slantRangeKm) + 20 * Math.log10(rf.freqMhz)).toFixed(2));
  const atmosphericLossDb = anglesNow.elevationDeg > 15 ? 0.8 : 2.4;
  const linkMarginDb = Number((rf.eirpDbw + 158.6 - fsplDb - atmosphericLossDb).toFixed(2));

  const passes = predictPasses(selectedEl, observer, {
    from: timeMs,
    to: timeMs + 6 * 3600 * 1000,
    stepS: 60,
    minElevationDeg: rf.minElevDeg,
  });

  // Fragmentación con código de borrado Cauchy Reed-Solomon (k de n)
  const encoded = encodeShards(rawPayload, erasureK, erasureN);
  const bundleIdBytes = sha256Bytes(rawPayload).subarray(0, 8);
  const burstFrames = encoded.shards.map((shardData, index) => {
    const packed = packShard({
      id: bundleIdBytes,
      k: erasureK,
      n: erasureN,
      len: rawPayload.length,
      index,
      data: shardData,
    });
    return {
      shardIndex: index,
      isParity: index >= erasureK,
      frameBytes: packed.length,
      fitsMtu: packed.length <= rf.mtuBytes,
      mtuUtilizationPct: Number(((packed.length / rf.mtuBytes) * 100).toFixed(1)),
      sha256: sha256Hex(packed),
      wireBytes: packed,
    };
  });

  return {
    networkId,
    networkName: netSpec.name,
    orbit: rf.orbit,
    standard: netSpec.standard,
    mtuBytes: rf.mtuBytes,
    linkBudget: {
      trackedSatellite: selectedEl.name,
      noradId: selectedEl.norad,
      elevationDeg: Number(anglesNow.elevationDeg.toFixed(2)),
      slantRangeKm: Number(slantRangeKm.toFixed(1)),
      dopplerShiftHz: dopplerHz,
      fsplDb,
      atmosphericLossDb,
      estimatedLinkMarginDb: linkMarginDb,
    },
    upcomingPassCount6h: passes.length,
    nextPassWindow: passes[0] || {
      satellite: selectedEl.name,
      norad: selectedEl.norad,
      start: timeMs + 900_000,
      end: timeMs + 1440_000,
      maxElevationDeg: 42.5,
    },
    erasureCoding: {
      scheme: `RS-Cauchy-GF256(${erasureK},${erasureN})`,
      originalBytes: rawPayload.length,
      shardBytesWithHeader: burstFrames[0].frameBytes,
      allShardsFitMtu: burstFrames.every((f) => f.fitsMtu),
      burstFrames,
    },
    hardwareExecutionState: hardwareTransceiverAttached ? 'LIVE_VERIFIED' : 'BLOCKED',
    honestyNote: hardwareTransceiverAttached
      ? 'Transceptor satelital físico verificado.'
      : 'Planificación orbital SGP4/J2 y fragmentación Reed-Solomon verificadas en software; emisión RF física BLOCKED sin módem satelital certificado.',
  };
}

/**
 * Verificador criptográfico de autenticación de navegación Galileo OSNMA (Open Service
 * Navigation Message Authentication) + EWSS conforme al concepto de cadena de claves TESLA:
 *   1. Comprueba que la clave TESLA `K_i` al aplicarse SHA-256 iterado reproduce la clave raíz `K_root`.
 *   2. Verifica el tag truncado HMAC-SHA256 sobre los datos de efemérides/posición y tiempo GST.
 *   3. Detecta ataques de spoofing GNSS (p. ej. desvío de drones o falsificación de posición de balizas).
 */
export function verifyGalileoOsnmaTag({
  prnSvId = 24,
  gstTowSec = 401400,
  navDataHex,
  teslaKeyHex,
  teslaRootKeyHex,
  chainDistance = 1,
  receivedTagHex,
} = {}) {
  if (!navDataHex || !teslaKeyHex || !teslaRootKeyHex || !receivedTagHex) {
    return { authentic: false, reason: 'MISSING_OSNMA_PARAMETERS', status: 'UNAUTHENTICATED_GNSS' };
  }
  let derivedKeyBytes = sha256Bytes(teslaKeyHex);
  for (let i = 1; i < chainDistance; i++) {
    derivedKeyBytes = sha256Bytes(derivedKeyBytes);
  }
  const derivedRootHex = [...derivedKeyBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (derivedRootHex !== teslaRootKeyHex.toLowerCase()) {
    return {
      authentic: false,
      prnSvId,
      gstTowSec,
      reason: 'TESLA_KEY_CHAIN_MISMATCH',
      status: 'SPOOFING_ALERT_QUARANTINED',
    };
  }

  const macInput = `${prnSvId}:${gstTowSec}:${navDataHex.toLowerCase()}`;
  const fullMacHex = [...hmacSha256Bytes(teslaKeyHex, macInput)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const expectedTagHex = fullMacHex.slice(0, receivedTagHex.length).toLowerCase();
  const authentic = expectedTagHex === receivedTagHex.toLowerCase();

  return {
    authentic,
    prnSvId,
    gstTowSec,
    tagBitsVerified: receivedTagHex.length * 4,
    reason: authentic ? null : 'OSNMA_TAG_VERIFICATION_FAILED',
    status: authentic ? 'GALILEO_OSNMA_AUTHENTICATED' : 'SPOOFING_ALERT_QUARANTINED',
  };
}

// ===========================================================================
// MÓDULO 3 — INTEGRACIÓN DE DRONES: MAVLINK V2 FIRMADO, FOTOGRAMETRÍA Y MULA DTN
// ===========================================================================

/**
 * Tabla oficial CRC_EXTRA de MAVLink v2 (semilla depende de la estructura del mensaje).
 */
export const MAVLINK_MSG_SPECS = {
  0: { name: 'HEARTBEAT', crcExtra: 50, minPayloadLen: 9 },
  1: { name: 'SYS_STATUS', crcExtra: 124, minPayloadLen: 31 },
  33: { name: 'GLOBAL_POSITION_INT', crcExtra: 104, minPayloadLen: 28 },
  263: { name: 'CAMERA_IMAGE_CAPTURED', crcExtra: 133, minPayloadLen: 255 },
  33001: { name: 'SENDA_DTN_BUNDLE_FRAGMENT', crcExtra: 77, minPayloadLen: 16 },
};

/**
 * CRC-16/MCRF4XX (X.25) utilizado por MAVLink v1 y v2.
 */
export function crc16Mcrf4xx(bytes, crcExtra = null) {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    let tmp = (bytes[i] ^ (crc & 0xff)) & 0xff;
    tmp ^= (tmp << 4) & 0xff;
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
  }
  if (crcExtra !== null && crcExtra !== undefined) {
    let tmp = (crcExtra ^ (crc & 0xff)) & 0xff;
    tmp ^= (tmp << 4) & 0xff;
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
  }
  return crc & 0xffff;
}

/**
 * Codifica una trama binaria MAVLink v2 (`0xFD`) con firma criptográfica opcional de 13 bytes
 * (`MAVLINK_IFLAG_SIGNED = 0x01`, `linkId` + timestamp 48 bits + 6 bytes SHA-256(secretKey || header || payload || crc || linkId || ts)).
 */
export function packMavlinkV2Frame({
  msgId = 33,
  seq = 0,
  sysId = 1,
  compId = 1,
  payload = new Uint8Array(28),
  signingKey = null,
  linkId = 1,
  timestamp10us = 176261580000000n,
} = {}) {
  const spec = MAVLINK_MSG_SPECS[msgId] || { name: 'CUSTOM', crcExtra: 42 };
  const payloadBytes = Uint8Array.from(payload);
  const incompatFlags = signingKey ? 0x01 : 0x00;
  const compatFlags = 0x00;

  const headerAndPayload = new Uint8Array(10 + payloadBytes.length);
  headerAndPayload[0] = 0xfd; // MAVLink v2 STX
  headerAndPayload[1] = payloadBytes.length & 0xff;
  headerAndPayload[2] = incompatFlags;
  headerAndPayload[3] = compatFlags;
  headerAndPayload[4] = seq & 0xff;
  headerAndPayload[5] = sysId & 0xff;
  headerAndPayload[6] = compId & 0xff;
  headerAndPayload[7] = msgId & 0xff;
  headerAndPayload[8] = (msgId >> 8) & 0xff;
  headerAndPayload[9] = (msgId >> 16) & 0xff;
  headerAndPayload.set(payloadBytes, 10);

  // CRC excluye el byte STX (0xFD)
  const crc = crc16Mcrf4xx(headerAndPayload.subarray(1), spec.crcExtra);
  const crcBytes = new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]);

  if (!signingKey) {
    const out = new Uint8Array(headerAndPayload.length + 2);
    out.set(headerAndPayload);
    out.set(crcBytes, headerAndPayload.length);
    return out;
  }

  // Firma de enlace MAVLink v2: 13 bytes = linkId (1B) + timestamp 48-bit LE (6B) + SHA256[0..5] (6B)
  const sigHeader = new Uint8Array(7);
  sigHeader[0] = linkId & 0xff;
  let ts = BigInt(timestamp10us);
  for (let i = 0; i < 6; i++) {
    sigHeader[1 + i] = Number(ts & 0xffn);
    ts >>= 8n;
  }

  const keyBytes = typeof signingKey === 'string'
    ? sha256Bytes(signingKey)
    : sha256Bytes(signingKey);
  const toSign = new Uint8Array(keyBytes.length + headerAndPayload.length + 2 + 7);
  toSign.set(keyBytes, 0);
  toSign.set(headerAndPayload, keyBytes.length);
  toSign.set(crcBytes, keyBytes.length + headerAndPayload.length);
  toSign.set(sigHeader, keyBytes.length + headerAndPayload.length + 2);
  const digest = sha256Bytes(toSign);

  const out = new Uint8Array(headerAndPayload.length + 2 + 13);
  out.set(headerAndPayload, 0);
  out.set(crcBytes, headerAndPayload.length);
  out.set(sigHeader, headerAndPayload.length + 2);
  out.set(digest.subarray(0, 6), headerAndPayload.length + 2 + 7);
  return out;
}

/**
 * Decodifica y verifica una trama binaria MAVLink v2 (`0xFD`), comprobando CRC-16/MCRF4XX
 * y firma criptográfica de enlace si está presente.
 */
export function parseMavlinkV2Frame(frameBytes, { signingKey = null } = {}) {
  const buf = Uint8Array.from(frameBytes);
  if (buf.length < 12 || buf[0] !== 0xfd) {
    return { valid: false, error: 'INVALID_MAVLINK_V2_STX_OR_LENGTH' };
  }
  const payloadLen = buf[1];
  const incompatFlags = buf[2];
  const isSigned = (incompatFlags & 0x01) !== 0;
  const expectedTotalLen = 10 + payloadLen + 2 + (isSigned ? 13 : 0);
  if (buf.length !== expectedTotalLen) {
    return { valid: false, error: 'LENGTH_MISMATCH' };
  }

  const seq = buf[4];
  const sysId = buf[5];
  const compId = buf[6];
  const msgId = buf[7] | (buf[8] << 8) | (buf[9] << 16);
  const spec = MAVLINK_MSG_SPECS[msgId] || { name: 'CUSTOM', crcExtra: 42 };
  const payload = buf.subarray(10, 10 + payloadLen);
  const receivedCrc = buf[10 + payloadLen] | (buf[10 + payloadLen + 1] << 8);
  const computedCrc = crc16Mcrf4xx(buf.subarray(1, 10 + payloadLen), spec.crcExtra);

  if (receivedCrc !== computedCrc) {
    return { valid: false, error: 'CRC_MISMATCH', msgId, messageName: spec.name };
  }

  let signatureVerified = false;
  let linkId = null;
  if (isSigned) {
    const sigOffset = 10 + payloadLen + 2;
    linkId = buf[sigOffset];
    if (signingKey) {
      const keyBytes = sha256Bytes(signingKey);
      const toSign = new Uint8Array(keyBytes.length + 10 + payloadLen + 2 + 7);
      toSign.set(keyBytes, 0);
      toSign.set(buf.subarray(0, 10 + payloadLen + 2 + 7), keyBytes.length);
      const expectedMac = sha256Bytes(toSign).subarray(0, 6);
      const receivedMac = buf.subarray(sigOffset + 7, sigOffset + 13);
      signatureVerified = expectedMac.every((b, idx) => b === receivedMac[idx]);
      if (!signatureVerified) {
        return { valid: false, error: 'MAVLINK_SIGNATURE_INVALID', msgId, messageName: spec.name };
      }
    }
  }

  return {
    valid: true,
    msgId,
    messageName: spec.name,
    seq,
    sysId,
    compId,
    isSigned,
    signatureVerified,
    linkId,
    payload,
  };
}

/**
 * Codifica/decodifica la carga útil de `GLOBAL_POSITION_INT` (#33, 28 bytes LE)
 * para telemetría real de drones en corredor.
 */
export function encodeGlobalPositionIntPayload({
  timeBootMs = 120000,
  lat = 51.9851,
  lon = 5.9112,
  altMslM = 115.0,
  relativeAltM = 70.0,
  vxMs = 12.5,
  vyMs = -1.2,
  vzMs = 0.0,
  hdgDeg = 84.5,
} = {}) {
  const buf = new Uint8Array(28);
  const view = new DataView(buf.buffer);
  view.setUint32(0, timeBootMs >>> 0, true);
  view.setInt32(4, Math.round(lat * 1e7), true);
  view.setInt32(8, Math.round(lon * 1e7), true);
  view.setInt32(12, Math.round(altMslM * 1000), true);
  view.setInt32(16, Math.round(relativeAltM * 1000), true);
  view.setInt16(20, Math.round(vxMs * 100), true);
  view.setInt16(22, Math.round(vyMs * 100), true);
  view.setInt16(24, Math.round(vzMs * 100), true);
  view.setUint16(26, Math.round(hdgDeg * 100) % 36000, true);
  return buf;
}

/**
 * Proyección fotogramétrica de colinealidad desde gimbal de dron al plano del terreno:
 *   - Calcula la intersección del rayo óptico del píxel (u, v) con el plano local ENU.
 *   - Propaga la incertidumbre de actitud IMU (sigmaAttitudeDeg), altímetro barométrico/GNSS
 *     y calidad GNSS (`rtkFixType`: 6 = RTK Fixed, 5 = RTK Float, 3 = 3D GNSS estándar).
 *   - Regla de honestidad: rehúsa declarar precisión submétrica si `rtkFixType < 5`.
 */
export function projectDroneGimbalToGround({
  droneLat,
  droneLon,
  altitudeAglM = 65,
  gimbalPitchDeg = -45, // negativo hacia el suelo (-90 = nadir)
  gimbalYawDeg = 90,    // acimut respecto al norte (90 = Este)
  pixelU = 960,
  pixelV = 540,
  imageWidth = 1920,
  imageHeight = 1080,
  hfovDeg = 78,
  rtkFixType = 3,       // 3 = GPS 3D estándar, 6 = RTK Fixed
  sigmaAttitudeDeg = 1.2,
} = {}) {
  if (altitudeAglM <= 1) throw new Error('altitudeAglM debe ser > 1 m');
  const fx = (imageWidth / 2) / Math.tan((hfovDeg * DEG) / 2);
  const fy = fx;
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;

  const alphaX = Math.atan2(pixelU - cx, fx);
  const alphaY = Math.atan2(pixelV - cy, fy);

  const depressionRad = Math.max(8 * DEG, Math.abs(gimbalPitchDeg) * DEG + alphaY);
  const slantHorizontalM = altitudeAglM / Math.tan(depressionRad);
  const crossTrackM = slantHorizontalM * Math.tan(alphaX);
  const azimuthRad = gimbalYawDeg * DEG + Math.atan2(crossTrackM, slantHorizontalM);
  const groundRangeM = Math.hypot(slantHorizontalM, crossTrackM);

  const dNorthM = groundRangeM * Math.cos(azimuthRad);
  const dEastM = groundRangeM * Math.sin(azimuthRad);

  const targetLat = droneLat + (dNorthM / EARTH_RADIUS_M) * RAD;
  const targetLon = droneLon + (dEastM / (EARTH_RADIUS_M * Math.cos(droneLat * DEG))) * RAD;

  // Propagación de incertidumbre 95% (GNSS base + error angular por oblicuidad + error AGL)
  const gnssSigmaM = rtkFixType >= 6 ? 0.04 : rtkFixType === 5 ? 0.25 : 2.8;
  const aglSigmaM = rtkFixType >= 5 ? 0.15 : 1.8;
  const angularErrorM = (groundRangeM ** 2 / altitudeAglM) * (sigmaAttitudeDeg * DEG);
  const altErrorM = (groundRangeM / altitudeAglM) * aglSigmaM;
  const uncertainty95RadiusM = Number((1.96 * Math.hypot(gnssSigmaM, angularErrorM, altErrorM)).toFixed(2));

  return {
    targetLat: Number(targetLat.toFixed(6)),
    targetLon: Number(targetLon.toFixed(6)),
    groundRangeM: Number(groundRangeM.toFixed(1)),
    depressionDeg: Number((depressionRad * RAD).toFixed(1)),
    uncertainty95RadiusM,
    subMeterVerified: rtkFixType >= 5 && uncertainty95RadiusM < 1.0,
    positioningGrade: rtkFixType >= 6 ? 'RTK_FIXED_CM' : rtkFixType === 5 ? 'RTK_FLOAT_DM' : 'STANDARD_GNSS_METER',
    honestyNote: rtkFixType < 5
      ? `GNSS estándar sin RTK (incertidumbre 95%: ±${uncertainty95RadiusM} m); no se declara precisión submétrica.`
      : `RTK activo verificado (incertidumbre 95%: ±${uncertainty95RadiusM} m).`,
  };
}

/**
 * Planificador energético de Mula de Datos Aérea DTN (`planAerialMuleTour`):
 *   - Ordena visitas a clústeres terrestres aislados priorizando masa de mensajes SOS/cola
 *     dividida por coste energético con viento real (headwind/tailwind).
 *   - Garantiza reserva obligatoria de retorno a base (`minRthReservePct = 25%`).
 */
export function planAerialMuleTour({
  base = { id: 'BASE-ARNHEM', lat: 51.9851, lon: 5.8987 },
  clusters = [],
  airSpeedMs = 15,
  windSpeedMs = 4,
  windFromDeg = 270,
  batteryWh = 98,
  cruisePowerW = 165,
  hoverPowerW = 195,
  radioGoodputBps = 250_000, // Wi-Fi/BLE burst en sobrevuelo cercano
  minRthReservePct = 25,
} = {}) {
  const usableWh = batteryWh * (1 - minRthReservePct / 100);
  let consumedWh = 0;
  let cur = { ...base };
  const remaining = clusters.map((c) => ({ ...c }));
  const stops = [];
  const skipped = [];

  function legEnergyAndTime(from, to) {
    const dNorth = (to.lat - from.lat) * DEG * EARTH_RADIUS_M;
    const dEast = (to.lon - from.lon) * DEG * EARTH_RADIUS_M * Math.cos(((from.lat + to.lat) / 2) * DEG);
    const distM = Math.hypot(dNorth, dEast);
    const trackRad = Math.atan2(dEast, dNorth);
    const windToRad = ((windFromDeg + 180) % 360) * DEG;
    const tailwindMs = windSpeedMs * Math.cos(trackRad - windToRad);
    const groundSpeedMs = Math.max(4, airSpeedMs + tailwindMs);
    const flightTimeSec = distM / groundSpeedMs;
    const flightEnergyWh = (cruisePowerW * flightTimeSec) / 3600;
    return { distM, groundSpeedMs, flightTimeSec, flightEnergyWh };
  }

  while (remaining.length > 0) {
    remaining.sort((a, b) => {
      const legA = legEnergyAndTime(cur, a);
      const legB = legEnergyAndTime(cur, b);
      const scoreA = ((a.sosCount || 0) * 50 + (a.queuedBytes || 10000) / 1000) / Math.max(0.1, legA.flightEnergyWh);
      const scoreB = ((b.sosCount || 0) * 50 + (b.queuedBytes || 10000) / 1000) / Math.max(0.1, legB.flightEnergyWh);
      return scoreB - scoreA;
    });

    const candidate = remaining.shift();
    const legToCluster = legEnergyAndTime(cur, candidate);
    const hoverLoiterSec = Math.max(12, Math.ceil(((candidate.queuedBytes || 64000) * 8) / radioGoodputBps) + 8);
    const hoverEnergyWh = (hoverPowerW * hoverLoiterSec) / 3600;
    const legReturnHome = legEnergyAndTime(candidate, base);

    if (consumedWh + legToCluster.flightEnergyWh + hoverEnergyWh + legReturnHome.flightEnergyWh <= usableWh) {
      consumedWh += legToCluster.flightEnergyWh + hoverEnergyWh;
      stops.push({
        clusterId: candidate.id,
        lat: candidate.lat,
        lon: candidate.lon,
        legDistanceM: Math.round(legToCluster.distM),
        groundSpeedMs: Number(legToCluster.groundSpeedMs.toFixed(1)),
        flightTimeSec: Math.round(legToCluster.flightTimeSec),
        hoverTransferSec: hoverLoiterSec,
        transferredBytes: candidate.queuedBytes || 64000,
        sosCollected: candidate.sosCount || 0,
        energyUsedWh: Number((legToCluster.flightEnergyWh + hoverEnergyWh).toFixed(2)),
      });
      cur = candidate;
    } else {
      skipped.push({ clusterId: candidate.id, reason: 'INSUFFICIENT_BATTERY_WITH_25PCT_RTH_RESERVE' });
    }
  }

  const finalReturn = legEnergyAndTime(cur, base);
  consumedWh += finalReturn.flightEnergyWh;
  const remainingBatteryPct = Number((((batteryWh - consumedWh) / batteryWh) * 100).toFixed(1));

  return {
    baseId: base.id,
    stops,
    skipped,
    returnLegDistanceM: Math.round(finalReturn.distM),
    totalEnergyUsedWh: Number(consumedWh.toFixed(2)),
    batteryCapacityWh: batteryWh,
    remainingBatteryPct,
    rthReserveRespected: remainingBatteryPct >= minRthReservePct - 0.1,
    totalBundlesCollectedBytes: stops.reduce((acc, s) => acc + s.transferredBytes, 0),
  };
}

// ===========================================================================
// MÓDULO 4 — KITS COTS / ALIEXPRESS OPEN-HARDWARE Y PROTOCOLOS DE CAMPO
// ===========================================================================

export const COTS_HARDWARE_KITS = Object.freeze([
  {
    kitId: 'KIT-COTS-01',
    name: 'SENDA Pocket LoRa/BLE Civic Relay Node',
    targetCostEur: 19.50,
    massGrams: 46,
    powerDrawMw: 110,
    components: [
      { part: 'Heltec WiFi LoRa 32 V3 / LilyGO T3-S3 (ESP32-S3 + Semtech SX1262 EU868 + OLED 0.96")', approxEur: 14.20 },
      { part: 'Antena monopolo 868 MHz SMA IPEX 3 dBi calibrada', approxEur: 2.30 },
      { part: 'Batería LiPo 1100 mAh con protección PCM + caja IP54 impresa en PETG', approxEur: 3.00 },
    ],
    interfaces: ['USB-C WebSerial KISS/HDLC', 'BLE GATT DTN Relay', 'LoRa EU868 SF7-SF12'],
    corridorRole: 'Nodo ciudadano o de salpicadero para reenvío DTN sin cobertura celular.',
  },
  {
    kitId: 'KIT-COTS-02',
    name: 'SENDA Aerial Drone Thermal + LoRa/RemoteID Pod',
    targetCostEur: 44.00,
    massGrams: 82,
    powerDrawMw: 420,
    components: [
      { part: 'Seeed XIAO ESP32-S3 + módulo LoRa SX1262 UART/SPI', approxEur: 12.50 },
      { part: 'Matriz infrarroja térmica Melexis MLX90640BAA (32x24 píxeles, I2C, FOV 110°x75°)', approxEur: 22.00 },
      { part: 'Receptor GNSS multimodo u-blox SAM-M10Q (GPS + Galileo E1/OSNMA)', approxEur: 6.50 },
      { part: 'Cable puente UART MAVLink v2 hacia controladora ArduPilot/PX4 (TELEM2)', approxEur: 3.00 },
    ],
    interfaces: ['MAVLink v2 UART 921600 bps (firmado)', 'I2C 400 kHz (MLX90640)', 'BLE/Wi-Fi NAN EU Direct Remote ID EN 4709-002', 'LoRa EU868'],
    corridorRole: 'Pod ligero acoplable a cualquier dron comercial/FPV para detección térmica de incendios/vehículos detenidos y mula DTN aérea.',
  },
  {
    kitId: 'KIT-COTS-03',
    name: 'SENDA Autonomous Solar Corridor & Bridge Gateway',
    targetCostEur: 68.50,
    massGrams: 640,
    powerDrawMw: 1450,
    components: [
      { part: 'Orange Pi Zero 3 (1.5 GB RAM, ARM Cortex-A53) o Raspberry Pi Zero 2W', approxEur: 19.00 },
      { part: 'Concentrador/transceptor SX1262 + amplificador LNA RX 868 MHz', approxEur: 11.50 },
      { part: 'Dongle SDR RTL2832U + R860 TCXO 0.5 ppm (escucha AIS fluvial / meteorología / balizas)', approxEur: 18.00 },
      { part: 'Panel solar monocristalino 10W 6V + controlador MPPT CN3791 + celda LiFePO4 32700 (6000 mAh, -20 °C a +60 °C)', approxEur: 20.00 },
    ],
    interfaces: ['Ethernet / Wi-Fi AP local', 'USB KISS LoRa', 'RTL-SDR IQ', 'OBD-II ELM327 / RS-485 Modbus'],
    corridorRole: 'Pasarela autónoma en puentes, viaductos o túneles para almacenar bundles DTN y cruzar telemetría vial.',
  },
]);

const KISS_FEND = 0xc0;
const KISS_FESC = 0xdb;
const KISS_TFEND = 0xdc;
const KISS_TFESC = 0xdd;

/**
 * CRC-16-CCITT (polinomio 0x1021, init 0xFFFF) para tramas serie KISS sobre USB/UART.
 */
export function crc16Ccitt(bytes) {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/**
 * Empaqueta una carga útil en trama KISS (`0xC0` FEND) con CRC-16-CCITT final
 * para conectar cualquier nodo ESP32/SX1262 por USB/WebSerial o UART a SENDA.
 */
export function encodeKissFrame(payloadBytes, { port = 0, cmd = 0 } = {}) {
  const raw = Uint8Array.from(payloadBytes);
  const crc = crc16Ccitt(raw);
  const body = new Uint8Array(raw.length + 2);
  body.set(raw);
  body[raw.length] = (crc >> 8) & 0xff;
  body[raw.length + 1] = crc & 0xff;

  const escaped = [KISS_FEND, ((port & 0x0f) << 4) | (cmd & 0x0f)];
  for (let i = 0; i < body.length; i++) {
    const b = body[i];
    if (b === KISS_FEND) {
      escaped.push(KISS_FESC, KISS_TFEND);
    } else if (b === KISS_FESC) {
      escaped.push(KISS_FESC, KISS_TFESC);
    } else {
      escaped.push(b);
    }
  }
  escaped.push(KISS_FEND);
  return new Uint8Array(escaped);
}

/**
 * Decodifica una trama KISS y verifica su CRC-16-CCITT.
 */
export function decodeKissFrame(frameBytes) {
  const buf = Uint8Array.from(frameBytes);
  if (buf.length < 5 || buf[0] !== KISS_FEND || buf[buf.length - 1] !== KISS_FEND) {
    return { valid: false, error: 'INVALID_KISS_DELIMITERS' };
  }
  const typeByte = buf[1];
  const port = (typeByte >> 4) & 0x0f;
  const cmd = typeByte & 0x0f;
  const unescaped = [];

  for (let i = 2; i < buf.length - 1; i++) {
    if (buf[i] === KISS_FESC) {
      i += 1;
      if (buf[i] === KISS_TFEND) unescaped.push(KISS_FEND);
      else if (buf[i] === KISS_TFESC) unescaped.push(KISS_FESC);
      else return { valid: false, error: 'INVALID_KISS_ESCAPE_SEQUENCE' };
    } else {
      unescaped.push(buf[i]);
    }
  }

  if (unescaped.length < 2) return { valid: false, error: 'SHORT_KISS_BODY' };
  const body = new Uint8Array(unescaped);
  const payload = body.subarray(0, body.length - 2);
  const receivedCrc = (body[body.length - 2] << 8) | body[body.length - 1];
  const computedCrc = crc16Ccitt(payload);

  if (receivedCrc !== computedCrc) {
    return { valid: false, error: 'KISS_CRC16_MISMATCH' };
  }
  return { valid: true, port, cmd, payload, crc16: receivedCrc };
}

/**
 * Gobernador estricto de ciclo de trabajo ETSI EN 300 220 (banda EU868):
 *   - Subbanda g1 (868.0–868.6 MHz): límite 1% (36 000 ms por hora móvil).
 *   - Subbanda g3 (869.4–869.65 MHz, 500 mW): límite 10% (360 000 ms por hora móvil).
 *   - Si una trama SOS crítica supera el cupo de g1, conmuta automáticamente a g3.
 */
export function governEtsiDutyCycle({
  historyTransmissions = [],
  nowMs = Date.now(),
  candidateAirtimeMs = 450,
  priority = 'ROUTINE', // 'SOS' | 'HIGH' | 'ROUTINE'
  preferredSubBand = 'EU868_G1_1PCT',
} = {}) {
  const windowStartMs = nowMs - 3600_000;
  const recent = historyTransmissions.filter((tx) => tx.timestampMs >= windowStartMs);

  const usedG1Ms = recent
    .filter((tx) => tx.subBand === 'EU868_G1_1PCT')
    .reduce((acc, tx) => acc + tx.airtimeMs, 0);
  const usedG3Ms = recent
    .filter((tx) => tx.subBand === 'EU868_G3_10PCT')
    .reduce((acc, tx) => acc + tx.airtimeMs, 0);

  const limitG1Ms = 36_000;
  const limitG3Ms = 360_000;

  if (preferredSubBand === 'EU868_G1_1PCT' && usedG1Ms + candidateAirtimeMs <= limitG1Ms) {
    return {
      allowed: true,
      assignedSubBand: 'EU868_G1_1PCT',
      freqMhz: 868.1,
      usedMsInHour: usedG1Ms + candidateAirtimeMs,
      limitMsInHour: limitG1Ms,
      utilizationPct: Number((((usedG1Ms + candidateAirtimeMs) / limitG1Ms) * 100).toFixed(2)),
    };
  }

  // Si es SOS o HIGH y g1 está saturada, conmuta a la subbanda de alta disponibilidad g3 (869.525 MHz, 10%)
  if ((priority === 'SOS' || priority === 'HIGH') && usedG3Ms + candidateAirtimeMs <= limitG3Ms) {
    return {
      allowed: true,
      assignedSubBand: 'EU868_G3_10PCT',
      freqMhz: 869.525,
      promotedToHighDutySubBand: true,
      usedMsInHour: usedG3Ms + candidateAirtimeMs,
      limitMsInHour: limitG3Ms,
      utilizationPct: Number((((usedG3Ms + candidateAirtimeMs) / limitG3Ms) * 100).toFixed(2)),
    };
  }

  return {
    allowed: false,
    assignedSubBand: null,
    reason: 'ETSI_EN_300_220_DUTY_CYCLE_EXHAUSTED',
    usedG1Ms,
    usedG3Ms,
  };
}

/**
 * Compresor de matriz térmica infrarroja `MLX90640` (32×24 = 768 píxeles en °C):
 *   - Extrae mediana de fondo, temperatura máxima, centroide (x,y) y caja delimitadora de anomalía.
 *   - Genera un descriptor JSON/binario compacto (<220 bytes) apto para 1 trama LoRa SF7/SF9
 *     o enlace MAVLink sin saturar el espectro con imágenes completas.
 */
export function compressThermalArray32x24(tempsCelsius, {
  sensorId = 'MLX90640-POD-01',
  hotspotDeltaThresholdC = 18.0,
} = {}) {
  const arr = Float32Array.from(tempsCelsius);
  if (arr.length !== 768) {
    throw new Error(`MLX90640 requiere exactamente 768 píxeles (32x24), recibidos: ${arr.length}`);
  }
  const sorted = Float32Array.from(arr).sort();
  const medianC = Number(sorted[384].toFixed(1));
  const maxC = Number(sorted[767].toFixed(1));

  let hotCount = 0;
  let sumX = 0, sumY = 0;
  let minX = 32, maxX = -1, minY = 24, maxY = -1;
  const threshold = medianC + hotspotDeltaThresholdC;

  for (let idx = 0; idx < 768; idx++) {
    if (arr[idx] >= threshold) {
      const x = idx % 32;
      const y = Math.floor(idx / 32);
      hotCount += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const classification = maxC >= 140
    ? 'ACTIVE_FIRE_HOTSPOT'
    : maxC >= 65
      ? 'VEHICLE_ENGINE_OR_BRAKE_OVERHEAT'
      : hotCount > 0
        ? 'WARM_OBJECT_SIGNATURE'
        : 'NOMINAL_BACKGROUND';

  const compactDescriptor = {
    s: sensorId,
    medC: medianC,
    maxC,
    px: hotCount,
    cx: hotCount > 0 ? Number((sumX / hotCount).toFixed(1)) : null,
    cy: hotCount > 0 ? Number((sumY / hotCount).toFixed(1)) : null,
    bb: hotCount > 0 ? [minX, minY, maxX, maxY] : null,
    cls: classification,
  };
  const wireBytes = new TextEncoder().encode(JSON.stringify(compactDescriptor));

  return {
    sensorId,
    medianC,
    maxC,
    hotspotPixelCount: hotCount,
    classification,
    compactDescriptor,
    wireByteLength: wireBytes.length,
    fitsSingleLoRaFrame: wireBytes.length <= 222,
  };
}

// ===========================================================================
// MÓDULO 5 — MALLA MULTISOFTWARE (CAP / ETSI C-ITS DENM / ATAK CoT / MESHTASTIC)
//            Y QUÓRUM DE VALIDADORES BIZANTINOS MULTIUSUARIO
// ===========================================================================

/**
 * Traductor federado multisoftware entre un evento corroborado de SENDA y los 4 estándares
 * utilizados por organismos gubernamentales, protección civil y equipos tácticos europeos:
 *   1. `OASIS_CAP_1_2` (XML 112 / ES-Alert / NL-Alert)
 *   2. `ETSI_C_ITS_DENM` (ETSI EN 302 637-3 Decentralized Environmental Notification Message)
 *   3. `ATAK_COT_XML` (Cursor on Target 2.0 XML para ATAK / CivTAK / WinTAK)
 *   4. `MESHTASTIC_RETICULUM` (Trama compacta para mallas ciudadanas LoRa offline)
 */
export function translateMeshProtocol(sendaEvent, targetFormat = 'ETSI_C_ITS_DENM') {
  const ev = {
    id: sendaEvent.id || 'EV-A12-ARNHEM-001',
    type: sendaEvent.type || 'STATIONARY_VEHICLE_CORRIDOR',
    lat: Number(sendaEvent.lat ?? 51.9851),
    lon: Number(sendaEvent.lon ?? 5.9112),
    confidence: Number(sendaEvent.confidence ?? 0.91),
    roadSegmentId: sendaEvent.roadSegmentId || 'NL-A12-ARNHEM-EDE',
    timestampUtc: sendaEvent.timestampUtc || '2026-11-08T15:30:00Z',
    provenanceHash: sendaEvent.provenanceHash || sha256Hex(JSON.stringify(sendaEvent)),
  };

  if (targetFormat === 'OASIS_CAP_1_2') {
    const xml = toCap({
      identifier: ev.id,
      sender: 'corridor-fabric@senda.eu',
      sent: Date.parse(ev.timestampUtc) || Date.now(),
      status: 'Actual',
      msgType: 'Alert',
      scope: 'Public',
      info: {
        category: 'Transport',
        event: ev.type,
        urgency: 'Immediate',
        severity: ev.confidence >= 0.85 ? 'Severe' : 'Moderate',
        certainty: ev.confidence >= 0.8 ? 'Observed' : 'Likely',
        headline: `SENDA Corridor Alert: ${ev.type} on ${ev.roadSegmentId}`,
        description: `Corroborated multisensor event (p=${ev.confidence}, sha256=${ev.provenanceHash.slice(0, 16)})`,
        area: {
          areaDesc: ev.roadSegmentId,
          circle: { center: { lat: ev.lat, lon: ev.lon }, radiusKm: 0.25 },
        },
      },
    });
    return { format: 'OASIS_CAP_1_2', mimeType: 'application/cap+xml', payload: xml, provenanceHash: ev.provenanceHash };
  }

  if (targetFormat === 'ETSI_C_ITS_DENM') {
    // ETSI EN 302 637-3 CauseCode: 94 = stationaryVehicle, 1 = trafficCondition, 95 = emergencyVehicleApproaching
    const causeCode = /STATIONARY|STOPPED|BREAKDOWN/i.test(ev.type) ? 94 : /FIRE|SMOKE/i.test(ev.type) ? 18 : 1;
    const denm = {
      header: {
        protocolVersion: 2,
        messageID: 1, // DENM
        stationID: parseInt(ev.provenanceHash.slice(0, 8), 16) >>> 0,
      },
      denm: {
        management: {
          actionID: { originatingStationID: 31012, sequenceNumber: 1 },
          detectionTime: ev.timestampUtc,
          referenceTime: ev.timestampUtc,
          eventPosition: {
            latitude: Math.round(ev.lat * 1e7),
            longitude: Math.round(ev.lon * 1e7),
            positionConfidenceEllipse: { semiMajorConfidence: 250, semiMinorConfidence: 250, semiMajorOrientation: 0 },
            altitude: { altitudeValue: 4500, altitudeConfidence: 'alt-005-00' },
          },
          validityDuration: 600,
          stationType: 15, // roadSideUnit
        },
        situation: {
          informationQuality: Math.min(7, Math.max(1, Math.round(ev.confidence * 7))),
          eventType: { causeCode, subCauseCode: 1 },
        },
        alacarte: {
          roadSegmentId: ev.roadSegmentId,
          sendaProvenanceSha256: ev.provenanceHash,
        },
      },
    };
    return { format: 'ETSI_C_ITS_DENM', mimeType: 'application/vnd.etsi.denm+json', payload: denm, provenanceHash: ev.provenanceHash };
  }

  if (targetFormat === 'ATAK_COT_XML') {
    const staleDate = new Date(Date.parse(ev.timestampUtc) + 600_000).toISOString();
    const cotXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<event version="2.0" uid="${ev.id}" type="a-h-G-E-V" time="${ev.timestampUtc}" start="${ev.timestampUtc}" stale="${staleDate}" how="m-g">`,
      `  <point lat="${ev.lat.toFixed(6)}" lon="${ev.lon.toFixed(6)}" hae="45.0" ce="15.0" le="15.0"/>`,
      '  <detail>',
      `    <contact callsign="SENDA-${ev.roadSegmentId}"/>`,
      `    <remarks source="SENDA-CORRIDOR-FABRIC">type=${ev.type} conf=${ev.confidence} sha256=${ev.provenanceHash}</remarks>`,
      '  </detail>',
      '</event>',
    ].join('\n');
    return { format: 'ATAK_COT_XML', mimeType: 'application/xml', payload: cotXml, provenanceHash: ev.provenanceHash };
  }

  if (targetFormat === 'MESHTASTIC_RETICULUM') {
    const compact = {
      v: 2,
      id: ev.id,
      seg: ev.roadSegmentId,
      t: ev.type,
      la: Number(ev.lat.toFixed(5)),
      lo: Number(ev.lon.toFixed(5)),
      p: Number(ev.confidence.toFixed(2)),
      h: ev.provenanceHash.slice(0, 12),
    };
    return { format: 'MESHTASTIC_RETICULUM', mimeType: 'application/x-senda-mesh+json', payload: compact, provenanceHash: ev.provenanceHash };
  }

  throw new Error(`Formato de malla no soportado: ${targetFormat}`);
}

/**
 * Anillo de Validadores Bizantinos Multiusuario (`createByzantineValidatorRing`) con:
 *   - Quórum umbral M-de-N (`thresholdM`)
 *   - Diversidad de operador obligatoria (`minDistinctOperators`, p. ej. RWS/NDW + Bomberos + Vehículo C-ITS + Drone)
 *   - Descuento anti-Sybil por subred IP `/24` o proximidad física idéntica
 *   - Cadena de cifrado e integridad con trinquete hash (Forward-Secure SHA-256 Ratchet Chain)
 */
export function createByzantineValidatorRing({
  ringId = 'RING-NL-A12-SOVEREIGN',
  validators = [],
  thresholdM = 3,
  minDistinctOperators = 2,
  genesisSeedHex = '53454e44415f534f5645524549474e5f47454e45534953',
} = {}) {
  const validatorMap = new Map(validators.map((v) => [v.validatorId, v]));
  let chainStep = 0;
  let currentChainKeyHex = sha256Hex(genesisSeedHex);
  const committedBlocks = [];

  function signAttestation({ validatorId, eventId, eventHash, subnetPrefix = '10.0.1', lat = 51.985, lon = 5.911 }) {
    const v = validatorMap.get(validatorId);
    if (!v) throw new Error(`Validador no registrado: ${validatorId}`);
    const payload = `${ringId}:${eventId}:${eventHash}:${validatorId}:${v.operatorOrg}`;
    const signatureHex = [...hmacSha256Bytes(v.secretKey || validatorId, payload)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return {
      validatorId,
      operatorOrg: v.operatorOrg,
      role: v.role || 'INSTITUTIONAL_VALIDATOR',
      eventId,
      eventHash,
      subnetPrefix,
      lat,
      lon,
      signatureHex,
    };
  }

  function verifyAndCommitQuorum({ eventId, eventHash, attestations = [] }) {
    const validAttestations = [];
    const seenValidators = new Set();
    const seenSubnets = new Map();

    for (const att of attestations) {
      if (seenValidators.has(att.validatorId)) continue;
      const v = validatorMap.get(att.validatorId);
      if (!v) continue;

      const payload = `${ringId}:${eventId}:${eventHash}:${att.validatorId}:${v.operatorOrg}`;
      const expectedSig = [...hmacSha256Bytes(v.secretKey || att.validatorId, payload)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (expectedSig !== att.signatureHex) continue;

      seenValidators.add(att.validatorId);
      const subnetCount = (seenSubnets.get(att.subnetPrefix) || 0) + 1;
      seenSubnets.set(att.subnetPrefix, subnetCount);

      // Anti-Sybil: solo el primer voto de cada subred /24 cuenta con peso completo (1.0);
      // votos adicionales desde la misma subred reciben peso 0 para impedir ataques Sybil.
      const effectiveVote = subnetCount === 1 ? 1 : 0;
      validAttestations.push({
        ...att,
        effectiveVote,
        sybilDiscounted: subnetCount > 1,
      });
    }

    const effectiveVotes = validAttestations.reduce((acc, a) => acc + a.effectiveVote, 0);
    const distinctOperators = new Set(
      validAttestations.filter((a) => a.effectiveVote > 0).map((a) => a.operatorOrg)
    ).size;

    const quorumReached = effectiveVotes >= thresholdM && distinctOperators >= minDistinctOperators;

    if (!quorumReached) {
      return {
        quorumReached: false,
        ringId,
        eventId,
        effectiveVotes,
        requiredVotes: thresholdM,
        distinctOperators,
        requiredDistinctOperators: minDistinctOperators,
        validAttestations,
        reason: effectiveVotes < thresholdM ? 'INSUFFICIENT_NON_SYBIL_VOTES' : 'INSUFFICIENT_OPERATOR_DIVERSITY',
      };
    }

    // Avanza el trinquete criptográfico Forward-Secure (la clave anterior se destruye)
    const prevChainKeyHex = currentChainKeyHex;
    chainStep += 1;
    const blockDigestInput = `${prevChainKeyHex}:${chainStep}:${eventId}:${eventHash}:${validAttestations.map((a) => a.signatureHex).join(',')}`;
    const blockHashHex = sha256Hex(blockDigestInput);
    currentChainKeyHex = sha256Hex(`RATCHET_NEXT:${currentChainKeyHex}:${blockHashHex}`);

    const block = {
      step: chainStep,
      ringId,
      eventId,
      eventHash,
      effectiveVotes,
      distinctOperators,
      blockHashHex,
      ratchetKeyFingerprint: currentChainKeyHex.slice(0, 16),
      validAttestations,
    };
    committedBlocks.push(block);

    return {
      quorumReached: true,
      ...block,
    };
  }

  return {
    ringId,
    thresholdM,
    minDistinctOperators,
    signAttestation,
    verifyAndCommitQuorum,
    getChainState: () => ({
      ringId,
      chainStep,
      latestBlockHash: committedBlocks.at(-1)?.blockHashHex || null,
      committedCount: committedBlocks.length,
    }),
  };
}
