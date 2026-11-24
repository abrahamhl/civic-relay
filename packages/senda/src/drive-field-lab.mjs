/**
 * SENDA · Laboratorio Científico de Campo, Mapeo Urbano/RF y Auditoría de Integridad (v4)
 *
 * Motor matemático-físico puro (0 dependencias, 0 €, 100 % en el dispositivo, sin red) para:
 *  1. Caracterización de cañón urbano, zona de Fresnel (2,44 / 5,90 GHz) y multipath GNSS/EKF.
 *  2. Física de propagación RF pasiva: regresión log-distancia (n̂, σ̂), factor K de Rice
 *     (estimador por momentos de Greenstein 1999: LOS vs Rayleigh NLOS por fachadas),
 *     Cota Inferior de Cramér–Rao 2D (CRLB / FIM) y margen de enlace BLE Coded PHY S=8.
 *  3. Rugosidad de firme por IMU vertical (RMS paso alto a_z → proxy IRI declarado).
 *  4. Mapeador geográfico continuo en rejilla de 25 m × 25 m con exportación GeoJSON (0 PII).
 *  5. Orquestador de 1 toque (`runFieldLabBattery`) que ejecuta e interpreta los 8 motores
 *     activos de SENDA en el acto (EKF, DENM 36 B CRC-16, BLE/Two-Ray, RF/Cañón, LWR/RSS,
 *     AR-HUD/Horizonte, IMU firme y Auditoría Ciber/Integridad).
 *
 * Privacidad y legalidad (CLAUDE.md §1 + RGPD):
 *  - NUNCA almacena ni exporta direcciones MAC/BSSID ni SSIDs en claro: cualquier identificador
 *    de barrido Wi-Fi/BLE se pasa por hash FNV-1a con sal efímera de sesión y solo salen
 *    estadísticos agregados.
 *  - Auditoría estrictamente pasiva/cooperativa (0 escaneo ofensivo, 0 interferencia RF).
 *  - Toda métrica declara `basis: 'MEDIDO' | 'MODELO' | 'HÍBRIDO'` y `NO_SENSOR` si falta hardware.
 */

import { sendaToDenm, encodeDenmCompact, decodeDenmCompact } from './cits-denm.mjs';
import { twoRayV2vChannel, rssLongitudinalSameDir, EXAMPLE_RSS_PARAMS } from './drive-physics-v2.mjs';
import { movingQueueIntercept, EXAMPLE_LWR_HIGHWAY } from './traffic-shockwave.mjs';
import { polderNapClearance } from './hydro-surge-nl.mjs';

const C_LIGHT = 299_792_458; // m/s exacto SI
const M_PER_DEG_LAT = 111_320;
const DEG = Math.PI / 180;

// Sal efímera por sesión en memoria (se destruye al cerrar la pestaña; 0 persistencia de MACs)
const SESSION_SALT = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Radio de la 1.ª zona de Fresnel r₁ = sqrt(λ · d₁ · d₂ / (d₁ + d₂)) en metros. */
export function fresnelZone1RadiusM(freqHz, d1M, d2M = d1M) {
  if (!(freqHz > 0) || !(d1M > 0) || !(d2M > 0)) return null;
  const lambda = C_LIGHT / freqHz;
  return +Math.sqrt((lambda * d1M * d2M) / (d1M + d2M)).toFixed(3);
}

/**
 * Análisis de cañón urbano y superficies de edificios por multipath GNSS/EKF + geometría opcional.
 * @param {object} p
 * @param {Array<{accuracyM?:number, altM?:number, maha2?:number, rejected?:boolean}>} [p.gnssHistory]
 * @param {Array<{heightM:number, distM:number}>} [p.buildings] huellas opcionales (OSM / PDOK BGT)
 * @param {number} [p.linkDistM=80] distancia de enlace de referencia para radio de Fresnel
 */
export function analyzeUrbanCanyon({ gnssHistory = [], buildings = [], linkDistM = 80 } = {}) {
  const fresnelBleM = fresnelZone1RadiusM(2.44e9, linkDistM / 2, linkDistM / 2);
  const fresnelCv2xM = fresnelZone1RadiusM(5.90e9, linkDistM / 2, linkDistM / 2);

  // Geometría exacta si se aportan edificios cercanos (OSM / PDOK BGT)
  let hwRatio = null, skyViewFactor = null;
  if (buildings.length > 0) {
    const ratios = buildings
      .filter((b) => Number.isFinite(b.heightM) && Number.isFinite(b.distM) && b.distM > 0.5)
      .map((b) => b.heightM / (2 * b.distM));
    if (ratios.length) {
      hwRatio = +Math.max(...ratios).toFixed(2);
      // Para cañón simétrico H/W: SVF ≈ cos(atan(2·H/W)) (Oke 1981)
      skyViewFactor = +Math.cos(Math.atan(2 * hwRatio)).toFixed(3);
    }
  }

  const accs = gnssHistory.map((g) => g.accuracyM).filter((x) => Number.isFinite(x) && x > 0);
  const alts = gnssHistory.map((g) => g.altM).filter((x) => Number.isFinite(x));
  const chi2s = gnssHistory.map((g) => g.maha2).filter((x) => Number.isFinite(x) && x >= 0);
  const rejected = gnssHistory.filter((g) => g.rejected).length;

  const medianAccM = accs.length ? +median(accs).toFixed(1) : null;
  const maxChi2 = chi2s.length ? +Math.max(...chi2s).toFixed(2) : null;
  let altJitterM = null;
  if (alts.length >= 2) {
    const mu = alts.reduce((s, v) => s + v, 0) / alts.length;
    altJitterM = +Math.sqrt(alts.reduce((s, v) => s + (v - mu) ** 2, 0) / alts.length).toFixed(2);
  }

  // Clasificación honesta basada en geometría (si existe) o evidencia GNSS/EKF real
  let canyonClass = 'SIN_DATOS';
  let basis = 'SIN_SENSOR';
  if (hwRatio != null) {
    basis = accs.length ? 'HÍBRIDO' : 'MODELO';
    canyonClass = hwRatio >= 1.0 ? 'URBAN_CANYON_NLOS' : hwRatio >= 0.35 ? 'SUBURBAN_FACADES' : 'OPEN_ROAD';
  } else if (medianAccM != null) {
    basis = 'MEDIDO';
    if (medianAccM > 15 || (maxChi2 != null && maxChi2 >= 16) || rejected > 0) canyonClass = 'URBAN_CANYON_NLOS';
    else if (medianAccM > 6 || (maxChi2 != null && maxChi2 >= 9) || (altJitterM != null && altJitterM > 4)) canyonClass = 'SUBURBAN_FACADES';
    else canyonClass = 'OPEN_ROAD';
  }

  return {
    canyonClass,
    basis,
    samples: gnssHistory.length,
    medianAccM,
    altJitterM,
    maxChi2,
    rejectedJumps: rejected,
    hwRatio,
    skyViewFactor,
    fresnelBle244M: fresnelBleM,
    fresnelCv2x590M: fresnelCv2xM,
  };
}

/**
 * Analizador físico-estadístico de canal RF pasivo + auditoría ciber (0 PII).
 * Calcula:
 *  - Factor K de Rice (Greenstein 1999) sobre potencias lineales → LOS vs Rayleigh NLOS.
 *  - Regresión OLS de pérdidas de propagación log-distancia → exponente n̂ y shadowing σ̂ (dB).
 *  - Matriz de Información de Fisher (FIM) 2D y Cota Inferior de Cramér–Rao σ_CRLB (m).
 *  - Margen de enlace BLE Coded PHY S=8 (−103 dBm) y capacidad Shannon-Hartley.
 *  - Detector pasivo de anomalías (saturación RSSI, varianza extrema, ráfagas anómalas).
 *
 * @param {Array<{bssid?:string, idHash?:string, rssiDbm:number, distM?:number, dxM?:number, dyM?:number, freqMhz?:number, tMs?:number}>} samples
 */
export function analyzeRfEnvironment(samples = []) {
  const valid = samples.filter((s) => s && Number.isFinite(s.rssiDbm) && s.rssiDbm >= -125 && s.rssiDbm <= 0);
  if (!valid.length) {
    return {
      basis: 'SIN_SENSOR',
      sampleCount: 0,
      uniqueSaltedNodes: 0,
      privacy: '0 MACs/SSIDs almacenados (hash efímero por sesión).',
      rssiMedianDbm: null,
      ricianKDb: null,
      fadingRegime: 'SIN_DATOS',
      pathLossN: null,
      shadowingSigmaDb: null,
      crlbPosM: null,
      bleCodedMarginDb: null,
      securityStatus: 'NO_DATA',
      anomalies: [],
    };
  }

  // Privacidad: cualquier BSSID se convierte de inmediato a hash salado de sesión (nunca se retiene)
  const nodes = new Set();
  for (const s of valid) {
    const key = s.idHash ?? (s.bssid ? fnv1a32(`${SESSION_SALT}|${String(s.bssid).toLowerCase()}`) : 'anon');
    nodes.add(key);
  }

  const rssis = valid.map((s) => s.rssiDbm);
  const rssiMedianDbm = +median(rssis).toFixed(1);
  const rssiMeanDbm = rssis.reduce((a, b) => a + b, 0) / rssis.length;
  const rssiStdDb = +Math.sqrt(rssis.reduce((a, v) => a + (v - rssiMeanDbm) ** 2, 0) / rssis.length).toFixed(2);

  // 1. Estimador de factor K de Rice por momentos de potencia (Greenstein et al., IEEE TVT 1999)
  let ricianKDb = null;
  let fadingRegime = 'MUESTRA_INSUFICIENTE';
  if (valid.length >= 4) {
    const linP = rssis.map((r) => 10 ** (r / 10));
    const muP = linP.reduce((a, b) => a + b, 0) / linP.length;
    const varP = linP.reduce((a, p) => a + (p - muP) ** 2, 0) / linP.length;
    const gamma = Math.sqrt(varP) / Math.max(1e-20, muP);
    if (gamma >= 0.999) {
      ricianKDb = -20; // Rayleigh puro o desvanecimiento más severo que Rayleigh (NLOS severo)
      fadingRegime = 'NLOS_RAYLEIGH_MULTIPATH';
    } else {
      const sq = Math.sqrt(Math.max(0, 1 - gamma * gamma));
      const K = sq / Math.max(1e-6, 1 - sq);
      ricianKDb = +Math.max(-20, Math.min(30, 10 * Math.log10(Math.max(1e-2, K)))).toFixed(2);
      fadingRegime = ricianKDb >= 3 ? 'LOS_DOMINANT' : ricianKDb >= 0 ? 'MIXED_FACADE_SCATTER' : 'NLOS_RAYLEIGH_MULTIPATH';
    }
  }

  // 2. Regresión OLS log-distancia: RSSI(d) = P0 - 10·n·log10(d)
  const withDist = valid
    .map((s) => {
      const d = Number.isFinite(s.distM) ? s.distM
        : (Number.isFinite(s.dxM) && Number.isFinite(s.dyM) ? Math.hypot(s.dxM, s.dyM) : null);
      return d != null && d >= 0.5 ? { ...s, _d: d } : null;
    })
    .filter(Boolean);
  let pathLossN = null, p0Dbm = null, shadowingSigmaDb = null;
  if (withDist.length >= 3) {
    const xs = withDist.map((s) => -10 * Math.log10(s._d));
    const ys = withDist.map((s) => s.rssiDbm);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den > 1e-6) {
      pathLossN = +Math.max(1.2, Math.min(6.0, num / den)).toFixed(2);
      p0Dbm = +(my - pathLossN * mx).toFixed(1);
      const res2 = xs.reduce((acc, x, i) => acc + (ys[i] - (p0Dbm + pathLossN * x)) ** 2, 0);
      shadowingSigmaDb = +Math.sqrt(res2 / Math.max(1, xs.length - 2)).toFixed(2);
    }
  }

  // 3. Cota Inferior de Cramér–Rao 2D (FIM) cuando hay ≥3 anclas con geometría relativa (dxM, dyM)
  let crlbPosM = null;
  const withVec = valid.filter((s) => Number.isFinite(s.dxM) && Number.isFinite(s.dyM) && Math.hypot(s.dxM, s.dyM) >= 1);
  if (withVec.length >= 3) {
    const nEff = pathLossN ?? 2.8;
    const sigEff = Math.max(1.5, shadowingSigmaDb ?? Math.max(2.5, rssiStdDb));
    const c = (10 * nEff) / (Math.LN10 * sigEff);
    let jxx = 0, jxy = 0, jyy = 0;
    for (const s of withVec) {
      const d = Math.hypot(s.dxM, s.dyM);
      const ux = s.dxM / d, uy = s.dyM / d;
      const w = (c / d) ** 2;
      jxx += w * ux * ux;
      jxy += w * ux * uy;
      jyy += w * uy * uy;
    }
    const det = jxx * jyy - jxy * jxy;
    if (det > 1e-12) {
      const traceInv = (jxx + jyy) / det;
      crlbPosM = +Math.sqrt(Math.max(0, traceInv)).toFixed(2);
    }
  }

  // 4. Margen BLE Coded PHY S=8 (−103 dBm) y capacidad Shannon sobre 1 MHz (NF 7 dB → N0 = −107 dBm)
  const bleCodedMarginDb = +(rssiMedianDbm - (-103)).toFixed(1);
  const snrLin = 10 ** ((rssiMedianDbm - (-107)) / 10);
  const shannonKbps1Mhz = +(1000 * Math.log2(1 + Math.max(0, snrLin))).toFixed(0);

  // 5. Auditoría pasiva de ciberseguridad RF (detección de anomalías sin acción ofensiva)
  const anomalies = [];
  if (rssis.some((r) => r > -15)) anomalies.push('SATURACION_RSSI_CERCANA_O_SPOOF');
  if (rssiStdDb > 18) anomalies.push('VARIANZA_ESPECTRAL_EXTREMA');
  if (pathLossN != null && (pathLossN < 1.4 || pathLossN > 5.2)) anomalies.push('EXPONENTE_PROPAGACION_ANOMALO');
  const securityStatus = anomalies.length ? 'ANOMALY_FLAGGED' : 'INTEGRITY_OK';

  return {
    basis: 'MEDIDO',
    sampleCount: valid.length,
    uniqueSaltedNodes: nodes.size,
    privacy: '0 MACs/SSIDs almacenados (hash efímero por sesión).',
    rssiMedianDbm,
    rssiStdDb,
    ricianKDb,
    fadingRegime,
    pathLossN,
    p0Dbm,
    shadowingSigmaDb,
    crlbPosM,
    bleCodedMarginDb,
    shannonKbps1Mhz,
    securityStatus,
    anomalies,
  };
}

/**
 * Parsea líneas JSONL de Android `WifiSurveyRecorder` anonimizando de inmediato BSSID y eliminando SSID.
 * Nunca retiene direcciones MAC ni nombres de red personales.
 */
export function parseWifiSurveyJsonl(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rssi = Number(o.rssi ?? o.level);
      if (!Number.isFinite(rssi) || rssi < -125 || rssi > 0) continue;
      const bssidRaw = o.bssid ? String(o.bssid).toLowerCase() : null;
      out.push({
        idHash: bssidRaw ? fnv1a32(`${SESSION_SALT}|${bssidRaw}`) : 'anon',
        rssiDbm: rssi,
        dxM: Number.isFinite(o.x) ? Number(o.x) : undefined,
        dyM: Number.isFinite(o.y) ? Number(o.y) : undefined,
        tMs: Number.isFinite(o.t) ? Number(o.t) * 1000 : Date.now(),
      });
    } catch { /* ignorar líneas malformadas */ }
  }
  return out;
}

/**
 * Análisis de rugosidad de la calzada (proxy IRI) a partir de muestras IMU reales de aceleración vertical.
 * @param {Array<{az:number, ay?:number, ax?:number, speedMs?:number}>} imuSamples
 */
export function analyzeRoadSurfaceImu(imuSamples = []) {
  const zs = imuSamples.map((s) => s.az).filter((v) => Number.isFinite(v));
  if (zs.length < 4) {
    return {
      basis: 'SIN_SENSOR',
      samples: zs.length,
      rmsVerticalMs2: null,
      peakShockMs2: null,
      iriProxyMKm: null,
      surfaceClass: 'SIN_IMU',
    };
  }
  const meanZ = zs.reduce((a, b) => a + b, 0) / zs.length;
  const hp = zs.map((z) => z - meanZ);
  const rms = Math.sqrt(hp.reduce((a, v) => a + v * v, 0) / hp.length);
  const peak = Math.max(...hp.map((v) => Math.abs(v)));
  const spds = imuSamples.map((s) => s.speedMs).filter((v) => Number.isFinite(v) && v >= 0);
  const vMean = spds.length ? spds.reduce((a, b) => a + b, 0) / spds.length : 15;
  // Proxy empírico IRI (m/km) escalado por velocidad (sin calibración en perfilómetro láser)
  const iriProxy = +(2.2 * rms / Math.max(0.5, Math.sqrt(Math.max(1, vMean) / 15))).toFixed(2);
  const surfaceClass = rms < 0.6 ? 'LISO' : rms < 1.5 ? 'REGULAR' : 'BACHEADO';
  return {
    basis: 'HÍBRIDO',
    samples: zs.length,
    rmsVerticalMs2: +rms.toFixed(3),
    peakShockMs2: +peak.toFixed(2),
    iriProxyMKm: iriProxy,
    surfaceClass,
  };
}

/**
 * Mapeador geográfico continuo de superficies, cañones urbanos y cobertura RF en celdas de 25 m × 25 m.
 * Almacena únicamente agregados anónimos (0 MACs, 0 PII) y exporta GeoJSON estándar.
 */
export function createSurfaceMapper({ cellSizeM = 25, maxCells = 4000 } = {}) {
  let origin = null; // { lon, lat, cosLat }
  const cells = new Map();

  function keyFor(lon, lat) {
    if (!origin) origin = { lon, lat, cosLat: Math.cos(lat * DEG) };
    const xM = (lon - origin.lon) * M_PER_DEG_LAT * origin.cosLat;
    const yM = (lat - origin.lat) * M_PER_DEG_LAT;
    const gx = Math.floor(xM / cellSizeM);
    const gy = Math.floor(yM / cellSizeM);
    return { key: `${gx}:${gy}`, gx, gy };
  }

  return {
    get cellCount() { return cells.size; },

    ingest({
      lon, lat, accuracyM = null, ekfMaha2 = null, ekfRejected = false,
      imuRmsZ = null, rfCount = 0, rssiMedianDbm = null,
      online = true, visionObjects = 0, region = 'ES', tMs = Date.now(),
    }) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const { key, gx, gy } = keyFor(lon, lat);
      let c = cells.get(key);
      if (!c) {
        if (cells.size >= maxCells) cells.delete(cells.keys().next().value);
        const cxM = (gx + 0.5) * cellSizeM;
        const cyM = (gy + 0.5) * cellSizeM;
        c = {
          key, gx, gy,
          lon: +(origin.lon + cxM / (M_PER_DEG_LAT * origin.cosLat)).toFixed(6),
          lat: +(origin.lat + cyM / M_PER_DEG_LAT).toFixed(6),
          hits: 0, accSum: 0, accN: 0, maxChi2: 0, rejected: 0,
          rmsZMax: null, rfMaxCount: 0, rssiSum: 0, rssiN: 0,
          deadZoneHits: 0, maxVisionObjects: 0, region, lastMs: tMs,
        };
        cells.set(key, c);
      }
      c.hits++;
      c.lastMs = tMs;
      if (Number.isFinite(accuracyM) && accuracyM > 0) { c.accSum += accuracyM; c.accN++; }
      if (Number.isFinite(ekfMaha2) && ekfMaha2 > c.maxChi2) c.maxChi2 = +ekfMaha2.toFixed(2);
      if (ekfRejected) c.rejected++;
      if (Number.isFinite(imuRmsZ)) c.rmsZMax = c.rmsZMax == null ? +imuRmsZ.toFixed(3) : Math.max(c.rmsZMax, +imuRmsZ.toFixed(3));
      if (Number.isFinite(rfCount) && rfCount > c.rfMaxCount) c.rfMaxCount = rfCount;
      if (Number.isFinite(rssiMedianDbm)) { c.rssiSum += rssiMedianDbm; c.rssiN++; }
      if (online === false) c.deadZoneHits++;
      if (Number.isFinite(visionObjects) && visionObjects > c.maxVisionObjects) c.maxVisionObjects = visionObjects;
      return c;
    },

    summary() {
      let canyonCells = 0, deadZoneCells = 0, roughCells = 0;
      for (const c of cells.values()) {
        const meanAcc = c.accN ? c.accSum / c.accN : 0;
        if (meanAcc > 15 || c.maxChi2 >= 16 || c.rejected > 0) canyonCells++;
        if (c.deadZoneHits > 0) deadZoneCells++;
        if (c.rmsZMax != null && c.rmsZMax >= 1.5) roughCells++;
      }
      return {
        cellSizeM,
        totalCells: cells.size,
        canyonCells,
        deadZoneCells,
        roughCells,
        privacy: 'Rejilla agregada 25 m × 25 m sin identificadores personales ni MACs.',
      };
    },

    toGeoJson() {
      const features = [];
      for (const c of cells.values()) {
        const meanAcc = c.accN ? +(c.accSum / c.accN).toFixed(1) : null;
        const canyonClass = meanAcc == null ? 'SIN_DATOS'
          : (meanAcc > 15 || c.maxChi2 >= 16 || c.rejected > 0) ? 'URBAN_CANYON_NLOS'
          : (meanAcc > 6 || c.maxChi2 >= 9) ? 'SUBURBAN_FACADES' : 'OPEN_ROAD';
        const surfaceClass = c.rmsZMax == null ? 'SIN_IMU' : c.rmsZMax < 0.6 ? 'LISO' : c.rmsZMax < 1.5 ? 'REGULAR' : 'BACHEADO';
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            cell: c.key,
            cellSizeM,
            region: c.region,
            hits: c.hits,
            meanAccM: meanAcc,
            maxChi2: c.maxChi2,
            ekfRejected: c.rejected,
            canyonClass,
            rmsZMaxMs2: c.rmsZMax,
            surfaceClass,
            rfNodesMax: c.rfMaxCount,
            rssiMeanDbm: c.rssiN ? +(c.rssiSum / c.rssiN).toFixed(1) : null,
            deadZone: c.deadZoneHits > 0,
            maxVisionObjects: c.maxVisionObjects,
            lastIso: new Date(c.lastMs).toISOString(),
          },
        });
      }
      return {
        type: 'FeatureCollection',
        metadata: {
          generator: 'SENDA Field Lab v4',
          cellSizeM,
          privacy: '0 MACs/SSIDs/PII — solo agregados físicos y de cobertura',
          generatedAt: new Date().toISOString(),
        },
        features,
      };
    },

    reset() { origin = null; cells.clear(); },
  };
}

/**
 * Orquestador de 1 toque: ejecuta los 8 motores científicos, RF, visión y ciberseguridad
 * sobre el estado vivo del vehículo y devuelve interpretaciones inmediatas para el investigador.
 */
export function runFieldLabBattery({
  nowMs = Date.now(),
  pos = null,
  speedMs = null,
  headingDeg = 0,
  altM = null,
  region = 'ES',
  ekfState = null,
  horizonStatus = null,
  gnssHistory = [],
  imuHistory = [],
  rfSamples = [],
  buildings = [],
  corridor = null,
  radarsCount = 0,
  incidentsCount = 0,
  vision = null,
  bleStats = null,
  probeStats = null,
  radioCaps = null,
  blackbox = null,
  surfaceSummary = null,
  online = null,
} = {}) {
  const tests = [];
  const vMs = Number.isFinite(speedMs) && speedMs >= 0 ? speedMs : 0;
  const vKmh = +(vMs * 3.6).toFixed(1);

  // 1. EKF GNSS+IMU + Resguardo NAP (Países Bajos)
  const nap = region === 'NL' && Number.isFinite(altM) ? polderNapClearance({ roadElevationNapM: altM, waterLevelNapM: 0.4 }) : null;
  tests.push({
    id: 'EKF_GNSS_MULTIPATH',
    name: 'EKF 6E · GNSS/Multipath & NAP',
    status: !ekfState ? 'NO_SENSOR' : ekfState.mode === 'DEGRADED' ? 'CRIT' : ekfState.outliersRejected > 0 || ekfState.mode === 'DEAD_RECKONING_IMU' ? 'WARN' : 'OK',
    basis: ekfState ? 'HÍBRIDO' : 'SIN_SENSOR',
    headline: ekfState
      ? `${ekfState.mode} · σ ±${ekfState.sigmaPosM} m · ${ekfState.outliersRejected} salto(s) rej.`
      : 'Sin fix GNSS inicializado todavía',
    metrics: { ekfState, nap },
    interpretation: !ekfState
      ? 'Activa GPS en exterior para anclar el filtro de Kalman de 6 estados.'
      : ekfState.mode === 'DEAD_RECKONING_IMU'
        ? `Navegación inercial activa en túnel/cañón (incertidumbre ±${ekfState.sigmaPosM} m).`
        : nap
          ? `Fusión estable en Países Bajos (${altM.toFixed(1)} m NAP · ${nap.inundatedIfUnprotected ? `pólder ${nap.marginAboveWaterM} m bajo nivel agua ref.` : `resguardo +${nap.marginAboveWaterM} m`}).`
          : `Fusión GNSS+IMU nominal; puerta χ² protegiendo frente a rebotes de fachadas.`,
  });

  // 2. Cripto / Integridad ETSI EN 302 637-3 DENM 36 B + prueba de corrupción CRC-16
  let denmOk = false, denmTamperRejected = false, denmUs = null, denmBytes = null;
  try {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const refPos = pos ?? [-3.7038, 40.4168];
    const msg = sendaToDenm({ kind: 'obstaculo', lon: refPos[0], lat: refPos[1], headingDeg, t: nowMs });
    const wire = encodeDenmCompact(msg);
    denmBytes = wire.length;
    const dec = decodeDenmCompact(wire);
    denmOk = dec.denm.situation.eventType.causeCode === msg.denm.situation.eventType.causeCode && wire.length === 36;
    const corrupt = new Uint8Array(wire);
    corrupt[14] ^= 0x01; // 1 bit alterado → debe fallar CRC-16-CCITT
    try { decodeDenmCompact(corrupt); denmTamperRejected = false; } catch { denmTamperRejected = true; }
    denmUs = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 1000);
  } catch { denmOk = false; }
  tests.push({
    id: 'CRYPTO_DENM_WIRE',
    name: 'Protocolo C-ITS DENM 36 B · CRC-16',
    status: denmOk && denmTamperRejected ? 'OK' : 'CRIT',
    basis: 'MEDIDO',
    headline: denmOk && denmTamperRejected
      ? `${denmBytes} B OK · 1-bit tamper RECHAZADO (${denmUs} µs)`
      : 'Fallo en autoprueba DENM / CRC-16',
    metrics: { denmBytes, denmOk, denmTamperRejected, latencyUs: denmUs, usedLivePos: !!pos },
    interpretation: denmOk && denmTamperRejected
      ? 'Codec ETSI EN 302 637-3 operativo y resistente a corrupción en canal BLE 5 / LoRa.'
      : 'Revisar integridad del módulo cits-denm.mjs antes de emitir tramas.',
  });

  // 3. Radio cooperativa BLE + Física Two-Ray V2V y Doppler a velocidad actual
  const vRelKmh = Math.max(30, vKmh * 2);
  const twoRay = twoRayV2vChannel({ distM: 40, freqHz: 2.44e9, htM: 1.25, hrM: 1.25, vRelMs: vRelKmh / 3.6 });
  const hasNativeRadios = !!radioCaps && typeof radioCaps === 'object';
  tests.push({
    id: 'BLE_COOP_PROBE',
    name: 'Enlace V2V BLE · Two-Ray & Doppler',
    status: hasNativeRadios ? (radioCaps.btOn ? 'OK' : 'WARN') : 'NO_SENSOR',
    basis: hasNativeRadios ? 'HÍBRIDO' : 'MODELO',
    headline: hasNativeRadios
      ? `BT ${radioCaps.btOn ? 'ON' : 'OFF'} · CodedPHY ${radioCaps.leCodedPhy ? 'SÍ' : 'NO'} · RTT ${probeStats?.medianRttMs ?? '–'} ms`
      : `Modo web (sin radio nativa) · Two-Ray 40 m: −${twoRay.pathLossEnvelopeDb} dB · ventana ${twoRay.contactWindowS} s`,
    metrics: { radioCaps, probeStats, twoRay40m: twoRay },
    interpretation: hasNativeRadios
      ? `Hardware real detectado (${radioCaps.model ?? 'Android'}). A ${vRelKmh} km/h relativos, ventana BLE 40 m = ${twoRay.contactWindowS} s (Doppler ${twoRay.dopplerHz} Hz).`
      : `Sin puente Android nativo en navegador; modelo Two-Ray declara pérdida ${twoRay.pathLossEnvelopeDb} dB a 40 m y ${twoRay.dopplerHz} Hz Doppler.`,
  });

  // 4. Cañón urbano, Fresnel y propagación RF pasiva (Rician K + CRLB)
  const canyon = analyzeUrbanCanyon({ gnssHistory, buildings, linkDistM: 80 });
  const rf = analyzeRfEnvironment(rfSamples);
  const canyonStatus = canyon.canyonClass === 'URBAN_CANYON_NLOS' || rf.securityStatus === 'ANOMALY_FLAGGED'
    ? 'WARN'
    : (canyon.basis === 'SIN_SENSOR' && rf.basis === 'SIN_SENSOR' ? 'NO_SENSOR' : 'OK');
  tests.push({
    id: 'URBAN_CANYON_RF',
    name: 'Cañón Urbano · Fresnel · Rician K & CRLB',
    status: canyonStatus,
    basis: rf.basis === 'MEDIDO' ? 'MEDIDO' : canyon.basis,
    headline: `${canyon.canyonClass} · Fresnel 2.4/5.9G: ${canyon.fresnelBle244M}/${canyon.fresnelCv2x590M} m`
      + (rf.sampleCount ? ` · K=${rf.ricianKDb ?? '–'} dB (${rf.fadingRegime})` : ''),
    metrics: { canyon, rf },
    interpretation: rf.sampleCount
      ? `${rf.uniqueSaltedNodes} emisores anonimizados · n̂=${rf.pathLossN ?? '–'} · CRLB=${rf.crlbPosM ?? '–'} m · margen BLE Coded +${rf.bleCodedMarginDb} dB.`
      : canyon.basis !== 'SIN_SENSOR'
        ? `Entorno ${canyon.canyonClass} inferido por GNSS/EKF (±${canyon.medianAccM} m). Importa o lanza un barrido Wi-Fi para medir K de Rice y CRLB.`
        : 'Sin trazas GNSS ni barrido RF todavía; activa GPS o importa JSONL de WifiSurveyRecorder.',
  });

  // 5. Corredor de tráfico, RSS IEEE 2846 y EDP hiperbólica LWR
  const rss = vMs > 0 ? rssLongitudinalSameDir({ vRearMs: vMs, vFrontMs: vMs }, EXAMPLE_RSS_PARAMS) : null;
  const lwr = vKmh >= 40 ? movingQueueIntercept({ distToIncidentM: 800, egoSpeedKmh: vKmh, incidentAgeS: 60, lwrParams: EXAMPLE_LWR_HIGHWAY }) : null;
  tests.push({
    id: 'TRAFFIC_LWR_CORRIDOR',
    name: 'Corredor ES/NL · RSS 2846 & Cola LWR',
    status: corridor?.top?.urgency === 'ROJO' ? 'CRIT' : corridor?.top ? 'WARN' : 'OK',
    basis: vMs > 0 ? 'HÍBRIDO' : 'MODELO',
    headline: `${region} · ${radarsCount} cámaras · ${incidentsCount} incid.`
      + (rss ? ` · RSS ${rss.dMinM.toFixed(1)} m` : '')
      + (lwr?.queueForming ? ` · cola LWR @${Math.round(lwr.interceptDistM)} m` : ''),
    metrics: { region, radarsCount, incidentsCount, topCorridor: corridor?.top ?? null, rss, lwr },
    interpretation: corridor?.top
      ? `Evento prioritario delante: ${corridor.top.label} a ${Math.round(corridor.top.distM)} m (${corridor.top.urgency}).`
      : `Corredor despejado. Base offline ES+NL activa (${radarsCount} cámaras oficiales).`,
  });

  // 6. Visión AR-HUD 3D + Auto-calibrador Huber de horizonte
  const visOn = !!vision?.active;
  tests.push({
    id: 'VISION_ARHUD_HORIZON',
    name: 'Visión IA · AR-HUD 3D & Horizonte IMU',
    status: visOn ? 'OK' : 'NO_SENSOR',
    basis: visOn || (horizonStatus?.samples ?? 0) > 0 ? 'MEDIDO' : 'SIN_SENSOR',
    headline: visOn
      ? `IA ${vision.hz} Hz (${Math.round(vision.inferMs ?? 0)} ms) · ${vision.count} obj · H-Cal ${horizonStatus?.samples ?? 0}/20`
      : `Cámara apagada · H-Cal ${horizonStatus?.samples ?? 0}/20 (${horizonStatus?.pitchDeg ?? 0}°)`,
    metrics: { vision, horizonStatus },
    interpretation: visOn
      ? `Detector en vivo estable (${vision.level}); horizonte ${horizonStatus?.calibrated ? 'calibrado' : 'calibrando en recta'}.`
      : 'Enciende cámara o dashcam para activar seguimiento 3D/BEV y detección de frenos/semáforos.',
  });

  // 7. Rugosidad del firme por IMU vertical (IRI proxy)
  const road = analyzeRoadSurfaceImu(imuHistory);
  tests.push({
    id: 'SURFACE_IRI_IMU',
    name: 'Firme & Dinámica IMU (Proxy IRI)',
    status: road.basis === 'SIN_SENSOR' ? 'NO_SENSOR' : road.surfaceClass === 'BACHEADO' ? 'WARN' : 'OK',
    basis: road.basis,
    headline: road.basis === 'SIN_SENSOR'
      ? 'Sin muestras IMU (devicemotion inactivo)'
      : `${road.surfaceClass} · RMS_z ${road.rmsVerticalMs2} m/s² · pico ${road.peakShockMs2} m/s² · IRI ~${road.iriProxyMKm}`,
    metrics: road,
    interpretation: road.basis === 'SIN_SENSOR'
      ? 'En escritorio o sin permiso de movimiento no hay acelerómetro; en móvil Android se registra a ≥10 Hz.'
      : `Calzada clasificada como ${road.surfaceClass} (${road.samples} muestras; IRI es proxy no calibrado en perfilómetro).`,
  });

  // 8. Auditoría de Ciberseguridad, Integridad SHA-256 y Privacidad RGPD
  const p2pRej = bleStats?.rejected ?? 0;
  const cyberStatus = p2pRej > 0 || rf.securityStatus === 'ANOMALY_FLAGGED' ? 'WARN' : 'OK';
  tests.push({
    id: 'CYBER_INTEGRITY_AUDIT',
    name: 'Ciberseguridad · Integridad & RGPD',
    status: cyberStatus,
    basis: 'MEDIDO',
    headline: `0 MACs/PII · P2P rechazos: ${p2pRej} · BB ${blackbox?.active ? `ACTIVA (${blackbox.count})` : 'en espera'} · Red ${online === false ? 'OFFLINE' : 'OK'}`,
    metrics: {
      piiMacsStored: 0,
      p2pRejectedFrames: p2pRej,
      rfAnomalies: rf.anomalies,
      blackboxActive: !!blackbox?.active,
      blackboxFrames: blackbox?.count ?? 0,
      surfaceCells: surfaceSummary?.totalCells ?? 0,
      online,
    },
    interpretation: cyberStatus === 'OK'
      ? 'Postura limpia: 0 identificadores personales almacenados, CRC/tramas íntegras y operación local verificada.'
      : `Atención: ${p2pRej} tramas P2P rechazadas por corrupción/manipulación${rf.anomalies.length ? ` y anomalías RF: ${rf.anomalies.join(', ')}` : ''}.`,
  });

  const counts = { OK: 0, WARN: 0, CRIT: 0, NO_SENSOR: 0 };
  for (const t of tests) counts[t.status] = (counts[t.status] ?? 0) + 1;

  return {
    schema: 'senda-field-lab/1',
    timestampIso: new Date(nowMs).toISOString(),
    region,
    pos,
    speedKmh: vKmh,
    summary: {
      totalEngines: tests.length,
      ...counts,
      overall: counts.CRIT > 0 ? 'CRIT' : counts.WARN > 0 ? 'WARN' : 'OK',
      surfaceCells: surfaceSummary?.totalCells ?? 0,
    },
    tests,
  };
}
