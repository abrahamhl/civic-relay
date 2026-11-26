#!/usr/bin/env node
/**
 * SENDA · F4 Validación científica y validación cruzada espacial de la DANA 29-10-2024 (Poyo, l'Horta Sud).
 *
 * Qué hace (100 % sin red, reproducible con los datos abiertos del repo):
 *  1. Explica con física hidráulica exacta la brecha de celeridad (≈ 1 m/s en malla gruesa 59–118 m
 *     frente a los 14 m/s preliminares del CEDEX en el barranco encajonado de Chiva):
 *     calcula la velocidad de Manning + celeridad dinámica/cinemática en función del ancho real del cauce
 *     (B = 25–40 m en Chiva vs B_eff = 118 m en malla gruesa vs B ≈ 1500 m en el cono aluvial).
 *  2. Construye un campo heterogéneo de rugosidad de Manning basado en clases CORINE/SIOSE
 *     (coeficientes literales de Chow 1959 Tabla 5-6 y Kalyanapu et al. 2009 Tabla 1; zonificación
 *     proxy DEM+OSM declarada explícitamente como `MODEL_PROXY_FROM_DEM_OSM` al no incluir el ráster CLC).
 *  3. Ejecuta validación cruzada espacial (partición Norte/Sur y Oeste/Este de la ROI de Copernicus EMSR773 AOI03):
 *     selecciona el mejor escenario físico solo en la mitad de entrenamiento y evalúa fuera de muestra en la
 *     otra mitad, reportando la brecha de sobreajuste (CSI_train − CSI_test).
 *  4. Guarda `evidence/quality/dana-f4-crossval.json` sellado con SHA-256.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lonToTileX, latToTileY, gridToLonLat } from '../src/geo-survey.mjs';
import { rasterize, agreement } from '../src/flood-science.mjs';
import { createSim, runUntil, piecewise, storedVolume } from '../src/shallow-water.mjs';
import {
  createFvSim,
  fvRunUntil,
  fvStoredVolume,
  enforceHydrologicBreach,
  buildUrbanPorosityField,
} from '../src/shallow-water-fv.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA = resolve(ROOT, 'investor-next/public/senda/data/dana2024');
const RADIO = resolve(ROOT, 'investor-next/public/senda/data/radio/poyo.json');
const OUT = resolve(ROOT, 'evidence/quality/dana-f4-crossval.json');

/**
 * Física analítica de Manning en sección rectangular de ancho B (m), pendiente S0, Manning n y caudal Q (m³/s):
 * resuelve Q = (B·h / n) · (B·h / (B + 2h))^(2/3) · S0^(1/2) por bisección.
 * Fuente: Chow, V. T. (1959), Open-Channel Hydraulics, McGraw-Hill, Ec. 5-6 y Tabla 5-6.
 */
function solveManningChannel({ Q, widthM, slope, manningN }) {
  let lo = 0.01, hi = 30.0;
  for (let it = 0; it < 60; it++) {
    const h = 0.5 * (lo + hi);
    const A = widthM * h;
    const P = widthM + 2 * h;
    const Rh = A / P;
    const qCalc = (A / manningN) * Math.pow(Rh, 2 / 3) * Math.sqrt(slope);
    if (qCalc < Q) lo = h;
    else hi = h;
  }
  const h = 0.5 * (lo + hi);
  const v = Q / (widthM * h);
  const cDynamic = v + Math.sqrt(9.81 * h);
  const cKinematic = (5 / 3) * v;
  const froude = v / Math.sqrt(9.81 * h);
  return {
    Q,
    widthM,
    slope,
    manningN,
    depthM: +h.toFixed(2),
    velocityMs: +v.toFixed(2),
    kinematicCelerityMs: +cKinematic.toFixed(2),
    dynamicCelerityMs: +cDynamic.toFixed(2),
    froude: +froude.toFixed(2),
  };
}

// 1. Diagnóstico físico exacto de la brecha de velocidad (1 m/s vs 14 m/s CEDEX)
const celerityPhysics = {
  basis: 'CALCULATED_MANNING_CHOW_1959',
  referenceObserved: {
    velocityMs: 14,
    peakFlowM3s: 3500,
    source: 'CEDEX preliminar vía Roldán Cañas (2025), BRAC 174:775-795',
  },
  regimes: {
    chivaConfinedGorge30m: solveManningChannel({ Q: 3500, widthM: 30, slope: 0.015, manningN: 0.030 }),
    chivaConfinedGorge40m: solveManningChannel({ Q: 3500, widthM: 40, slope: 0.012, manningN: 0.032 }),
    coarseGridCell118m: solveManningChannel({ Q: 3500, widthM: 118.1, slope: 0.008, manningN: 0.045 }),
    alluvialFanHortaSud1500m: solveManningChannel({ Q: 3500, widthM: 1500, slope: 0.0025, manningN: 0.060 }),
  },
  explanation: 'En el barranco encajonado de Chiva (B ≈ 30 m, S0 ≈ 1,5 %, n = 0,030), Manning + celeridad cinemática produce velocidades del orden de 10–14 m/s compatibles con la cifra preliminar del CEDEX. Al resolver el cauce en una malla gruesa de 59–118 m sin sección subcelda real (o al abrirse el agua en el cono aluvial de l’Horta Sud con B > 1 km y pendiente 0,25 %), el flujo se extiende lateralmente y su velocidad cae físicamente a 1–5 m/s.',
};

// 2. Cargar MDE real dem_d4.bin, D8 y mancha Copernicus EMSR773 AOI03
const hm = JSON.parse(readFileSync(resolve(DATA, 'hidro.json'), 'utf8'));
const GM = hm.malla;
const D4 = hm.relieveD4;
const rawDem = readFileSync(resolve(DATA, 'dem_d4.bin'));
const demFull = new Int16Array(rawDem.buffer, rawDem.byteOffset, rawDem.byteLength / 2);
const TOWNS = JSON.parse(readFileSync(RADIO, 'utf8')).municipios;

const BOX = [-0.62, 39.33, -0.33, 39.51];
const fullPx = ([lon, lat]) => [
  (lonToTileX(lon, GM.z) - GM.x0) * GM.size,
  (latToTileY(lat, GM.z) - GM.y0) * GM.size,
];
const [fx0, fy0] = fullPx([BOX[0], BOX[3]]).map((v) => Math.floor(v / D4.factor));
const [fx1, fy1] = fullPx([BOX[2], BOX[1]]).map((v) => Math.ceil(v / D4.factor));
const W = fx1 - fx0;
const H = fy1 - fy0;
const dx = D4.celdaM;

const zRaw = new Float64Array(W * H);
const sink = new Uint8Array(W * H);
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const v = demFull[(fy0 + j) * D4.w + (fx0 + i)];
    const k = j * W + i;
    if (v === -32768 || v <= 0) {
      zRaw[k] = 0;
      sink[k] = 1;
    } else {
      zRaw[k] = v;
    }
    if (i === 0 || j === 0 || i === W - 1 || j === H - 1) sink[k] = 1;
  }
}
const toCell = ([lon, lat]) => {
  const [gx, gy] = fullPx([lon, lat]);
  return [gx / D4.factor - fx0, gy / D4.factor - fy0];
};

// Cauce principal D8 desde Chiva
const DP = readFileSync(resolve(DATA, 'dir_z12.bin'));
const dirAt = (k) => (DP[k >> 1] >> ((k & 1) * 4)) & 15;
const DI = [1, 1, 0, -1, -1, -1, 0, 1];
const DJ = [0, 1, 1, 1, 0, -1, -1, -1];
const chiva = TOWNS.find((m) => m.nombre === 'Chiva');
let [pi, pj] = fullPx([chiva.lon, chiva.lat]).map(Math.floor);
let kin = -1;
const channelSet = new Set();
const channelOrdered = [];
for (let s = 0; s < 100000; s++) {
  const ll = gridToLonLat({ ...GM }, pi + 0.5, pj + 0.5);
  const [ci, cj] = toCell(ll).map(Math.floor);
  if (ci >= 1 && ci < W - 1 && cj >= 1 && cj < H - 1) {
    const ck = cj * W + ci;
    if (kin < 0 && ci >= 2) kin = ck;
    if (!channelSet.has(ck) && !sink[ck]) {
      channelSet.add(ck);
      channelOrdered.push(ck);
    }
  }
  const d = dirAt(pj * GM.w + pi);
  if (d > 7) break;
  pi += DI[d];
  pj += DJ[d];
}

// Mancha Copernicus EMSR773 AOI03 y ROI oficial
const gj = JSON.parse(readFileSync(resolve(DATA, 'emsr773_inundacion.geojson'), 'utf8'));
const aoi = gj.features.find((f) => f.properties.aoi === 3);
const obs = rasterize([aoi], W, H, toCell);
const rb = hm.roi.bbox;
const [rx0, ry0] = toCell([rb[0], rb[3]]).map(Math.floor);
const [rx1, ry1] = toCell([rb[2], rb[1]]).map(Math.ceil);
const roiFull = new Uint8Array(W * H);
const roiNorth = new Uint8Array(W * H);
const roiSouth = new Uint8Array(W * H);
const roiWest = new Uint8Array(W * H);
const roiEast = new Uint8Array(W * H);
const midY = Math.floor((ry0 + ry1) / 2);
const midX = Math.floor((rx0 + rx1) / 2);

for (let j = Math.max(0, ry0); j < Math.min(H, ry1); j++) {
  for (let i = Math.max(0, rx0); i < Math.min(W, rx1); i++) {
    const k = j * W + i;
    roiFull[k] = 1;
    if (j < midY) roiNorth[k] = 1; else roiSouth[k] = 1;
    if (i < midX) roiWest[k] = 1; else roiEast[k] = 1;
  }
}

// Máscara urbana de núcleos OSM de l'Horta Sud
const URBAN_NAMES = new Set([
  'Torrent', 'Picanya', 'Paiporta', 'Alaquàs', 'Aldaia', 'Catarroja',
  'Massanassa', 'Alfafar', 'Benetússer', 'Sedaví', 'Xirivella', 'Quart de Poblet', 'Alcàsser',
]);
const urbanMask = new Uint8Array(W * H);
const rCells = Math.round(900 / dx);
for (const m of TOWNS) {
  if (!URBAN_NAMES.has(m.nombre)) continue;
  const [ci, cj] = toCell([m.lon, m.lat]).map(Math.floor);
  for (let b = -rCells; b <= rCells; b++) {
    for (let a = -rCells; a <= rCells; a++) {
      if (a * a + b * b > rCells * rCells) continue;
      const ni = ci + a, nj = cj + b;
      if (ni >= 0 && ni < W && nj >= 0 && nj < H) urbanMask[nj * W + ni] = 1;
    }
  }
}

/**
 * Campo heterogéneo de rugosidad de Manning por clase de uso del suelo (proxy CLC/SIOSE):
 *  - Cauce del Poyo (CLC 511): n = 0,030 (Chow 1959 Tabla 5-6: canal grava/hormigón)
 *  - Tejido urbano l'Horta Sud (CLC 111/112): n = 0,100 (Kalyanapu et al. 2009 Tabla 1)
 *  - Huerta / cultivos de regadío (CLC 212/222, z < 30 m): n = 0,045 (Chow 1959 Tabla 5-6)
 *  - Piedemonte / matorral mediterráneo (CLC 323, z >= 30 m): n = 0,070 (Chow 1959 Tabla 5-6)
 */
const LAND_USE_MANNING = Object.freeze({
  channel_clc511: { n: 0.030, source: 'Chow (1959) Open-Channel Hydraulics, Tabla 5-6 (canal encauzado / grava limpia)' },
  urban_clc111_112: { n: 0.100, source: 'Kalyanapu et al. (2009) J. Flood Risk Management 2(2):100-111, Tabla 1 (tejido urbano)' },
  cropland_clc212_222: { n: 0.045, source: 'Chow (1959) Tabla 5-6 (cultivos maduros en hileras / huerta)' },
  shrub_clc323: { n: 0.070, source: 'Chow (1959) Tabla 5-6 (matorral medio a denso)' },
});

function buildLandUseManningField() {
  const nField = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) {
    if (channelSet.has(k)) nField[k] = LAND_USE_MANNING.channel_clc511.n;
    else if (urbanMask[k]) nField[k] = LAND_USE_MANNING.urban_clc111_112.n;
    else if (zRaw[k] < 30) nField[k] = LAND_USE_MANNING.cropland_clc212_222.n;
    else nField[k] = LAND_USE_MANNING.shrub_clc323.n;
  }
  return nField;
}

const T = (hh, mm) => ((hh - 16) * 60 + (mm - 55)) * 60;
const hydroPts = (R) => [[T(16, 55), 0], [T(18, 55), 2282], [T(19, 35), 3500], [T(19, 35) + R * 3600, 0]];
const H_WET = 0.1;

function measureFrontSpeedToPaiporta(S) {
  const paiporta = TOWNS.find((m) => m.nombre === 'Paiporta');
  const [piC, pjC] = toCell([paiporta.lon, paiporta.lat]).map(Math.floor);
  let arrS = NaN;
  for (let b = -2; b <= 2; b++) {
    for (let a = -2; a <= 2; a++) {
      const k = (pjC + b) * W + (piC + a);
      if (k >= 0 && k < W * H && Number.isFinite(S.arrive[k]) && !(arrS <= S.arrive[k])) arrS = S.arrive[k];
    }
  }
  const inI = kin % W, inJ = (kin / W) | 0;
  const distM = Math.hypot(piC - inI, pjC - inJ) * dx;
  const speedMs = Number.isFinite(arrS) && arrS > 0 ? +(distM / arrS).toFixed(2) : null;
  return { distEntradaPaiportaM: Math.round(distM), llegadaPaiportaMin: Number.isFinite(arrS) ? Math.round(arrS / 60) : null, velMediaFrenteMs: speedMs };
}

function evalSplits(mask) {
  const f = agreement(mask, obs, roiFull);
  const n = agreement(mask, obs, roiNorth);
  const s = agreement(mask, obs, roiSouth);
  const w = agreement(mask, obs, roiWest);
  const e = agreement(mask, obs, roiEast);
  return {
    full: { csi: +f.csi.toFixed(4), hitRate: +f.hitRate.toFixed(4), far: +f.falseAlarmRatio.toFixed(4) },
    north: { csi: +n.csi.toFixed(4), hitRate: +n.hitRate.toFixed(4), far: +n.falseAlarmRatio.toFixed(4) },
    south: { csi: +s.csi.toFixed(4), hitRate: +s.hitRate.toFixed(4), far: +s.falseAlarmRatio.toFixed(4) },
    west: { csi: +w.csi.toFixed(4), hitRate: +w.hitRate.toFixed(4), far: +w.falseAlarmRatio.toFixed(4) },
    east: { csi: +e.csi.toFixed(4), hitRate: +e.hitRate.toFixed(4), far: +e.falseAlarmRatio.toFixed(4) },
  };
}

// 3. Línea base Bates (2010) uniforme (referencia "Antes")
const ptsBase = hydroPts(6);
const sBase = createSim({ w: W, h: H, z: Float32Array.from(zRaw), dx, n: 0.10, sink, hArrive: H_WET });
runUntil(sBase, ptsBase.at(-1)[0] + 3 * 3600, { inflow: piecewise(ptsBase), cells: [kin], dtMax: 10 });
const maskBase = Uint8Array.from(sBase.maxD, (v) => (v >= H_WET ? 1 : 0));
const baselineBates = {
  id: 'bates2010_uniform_n010_R6',
  label: 'Antes · Bates (2010) inercial uniforme (n=0,10, R=6 h, MDE bruto 118 m)',
  splits: evalSplits(maskBase),
  front: measureFrontSpeedToPaiporta(sBase),
  massError: +((sBase.volIn - sBase.volOut - storedVolume(sBase)) / sBase.volIn).toExponential(2),
};

// 4. Candidatos físicos FV 2D Audusse-HLLC + rugosidad heterogénea CLC-proxy + porosidad urbana Sanders (2008)
const nLandUse = buildLandUseManningField();
const gorgeCells = channelOrdered.filter((k) => {
  const ci = k % W, cj = (k / W) | 0;
  const [lon] = gridToLonLat({ ...GM }, (fx0 + ci + 0.5) * D4.factor, (fy0 + cj + 0.5) * D4.factor);
  return lon <= -0.44;
});

const CANDIDATES = [
  { id: 'fv_clc_breach0_R3', incisionM: 0, breachSlope: 0.004, urbanPhi: 0.75, urbanDrag: 0.02, orchardN: 0.045, R: 3 },
  { id: 'fv_clc_breach0_R6', incisionM: 0, breachSlope: 0.004, urbanPhi: 0.75, urbanDrag: 0.02, orchardN: 0.045, R: 6 },
  { id: 'fv_clc_orchard08_R6', incisionM: 0, breachSlope: 0.004, urbanPhi: 0.72, urbanDrag: 0.02, orchardN: 0.080, R: 6 },
  { id: 'fv_clc_inc2_R3', incisionM: 2.0, breachSlope: 0.005, urbanPhi: 0.75, urbanDrag: 0.02, orchardN: 0.045, R: 3 },
  { id: 'fv_clc_inc2_R6', incisionM: 2.0, breachSlope: 0.005, urbanPhi: 0.75, urbanDrag: 0.02, orchardN: 0.045, R: 6 },
];

const candidateRuns = [];
for (const c of CANDIDATES) {
  const nField = new Float64Array(nLandUse);
  if (c.orchardN !== LAND_USE_MANNING.cropland_clc212_222.n) {
    for (let k = 0; k < W * H; k++) {
      if (!channelSet.has(k) && !urbanMask[k] && zRaw[k] < 30) nField[k] = c.orchardN;
    }
  }
  const br = enforceHydrologicBreach(zRaw, gorgeCells, dx, { minSlope: c.breachSlope, extraIncisionM: c.incisionM });
  const u = buildUrbanPorosityField(W, H, { urbanMask, urbanPhi: c.urbanPhi, urbanDragCoeff: c.urbanDrag });
  const pts = hydroPts(c.R);
  const tEnd = pts.at(-1)[0] + 3 * 3600;
  const sim = createFvSim({
    w: W, h: H, z: br.z, dx, n: nField, sink,
    phi: u.phi, dragCoeff: u.dragCoeff, cfl: 0.45, hArrive: H_WET,
  });
  const t0 = performance.now();
  fvRunUntil(sim, tEnd, { inflow: piecewise(pts), cells: [kin], dtMax: 8 });
  const cpuSec = +((performance.now() - t0) / 1000).toFixed(2);
  const mask = Uint8Array.from(sim.maxD, (v) => (v >= H_WET ? 1 : 0));
  const bal = (sim.volIn - sim.volOut - fvStoredVolume(sim)) / sim.volIn;
  const maxVelGorge = gorgeCells.reduce((m, k) => Math.max(m, sim.maxSpeed[k]), 0);
  candidateRuns.push({
    ...c,
    breachedCells: br.breachedCount,
    cpuSec,
    massError: +bal.toExponential(2),
    maxVelGorgeMs: +maxVelGorge.toFixed(2),
    front: measureFrontSpeedToPaiporta(sim),
    splits: evalSplits(mask),
  });
}

// 5. Validación cruzada espacial (2 particiones: Norte→Sur y Sur→Norte; Oeste→Este y Este→Oeste)
function crossValidate(trainKey, testKey) {
  const picked = [...candidateRuns].sort((a, b) => b.splits[trainKey].csi - a.splits[trainKey].csi)[0];
  const trainCsi = picked.splits[trainKey].csi;
  const testCsi = picked.splits[testKey].csi;
  return {
    trainSplit: trainKey,
    testSplit: testKey,
    selectedCandidate: picked.id,
    trainCsi,
    testCsi,
    overfitGap: +(trainCsi - testCsi).toFixed(4),
    baselineTestCsi: baselineBates.splits[testKey].csi,
    deltaVsBaselineTestCsi: +(testCsi - baselineBates.splits[testKey].csi).toFixed(4),
  };
}

const cvFolds = [
  crossValidate('north', 'south'),
  crossValidate('south', 'north'),
  crossValidate('west', 'east'),
  crossValidate('east', 'west'),
];
const meanOutOfSampleCsi = +(cvFolds.reduce((s, f) => s + f.testCsi, 0) / cvFolds.length).toFixed(4);
const meanBaselineOutOfSampleCsi = +(cvFolds.reduce((s, f) => s + f.baselineTestCsi, 0) / cvFolds.length).toFixed(4);
const meanOverfitGap = +(cvFolds.reduce((s, f) => s + f.overfitGap, 0) / cvFolds.length).toFixed(4);

const bestFv = [...candidateRuns].sort((a, b) => b.splits.full.csi - a.splits.full.csi)[0];

const reportBody = {
  schema: 'senda.dana-f4-crossval/v1',
  basis: 'MODEL_CROSSVALIDATED_AGAINST_COPERNICUS_EMSR773',
  landUseProxyNotice: 'Clases de rugosidad con coeficientes literales publicados (Chow 1959; Kalyanapu 2009) asignadas mediante proxy DEM+OSM (sin ráster oficial CORINE/SIOSE CNIG todavía).',
  generatedAtUtc: new Date().toISOString(),
  domain: { w: W, h: H, dxM: dx, bbox: BOX },
  landUseManning: LAND_USE_MANNING,
  celerityPhysics,
  baselineBates,
  bestFvLandUse: bestFv,
  candidates: candidateRuns,
  spatialCrossValidation: {
    folds: cvFolds,
    meanOutOfSampleCsi,
    meanBaselineOutOfSampleCsi,
    meanOverfitGap,
  },
};

const sha256 = createHash('sha256').update(JSON.stringify(reportBody)).digest('hex');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...reportBody, sha256 }, null, 2) + '\n');

console.log('=== F4 · FÍSICA DE CELERIDAD (MANNING, CHOW 1959) ===');
console.log('  Chiva encajonado (B=30 m, S=1,5%, n=0,030):', celerityPhysics.regimes.chivaConfinedGorge30m);
console.log('  Malla gruesa (B=118 m, S=0,8%, n=0,045):   ', celerityPhysics.regimes.coarseGridCell118m);
console.log('  Cono aluvial (B=1500 m, S=0,25%, n=0,060): ', celerityPhysics.regimes.alluvialFanHortaSud1500m);
console.log('\n=== F4 · BASELINE BATES (118 m) VS FV2D + MANNING HETEROGÉNEO CLC-PROXY ===');
console.log(`  Antes (Bates n=0.10 R=6h): CSI=${baselineBates.splits.full.csi} · frente Paiporta=${baselineBates.front.velMediaFrenteMs} m/s (${baselineBates.front.llegadaPaiportaMin} min)`);
console.log(`  Después (FV2D ${bestFv.id}): CSI=${bestFv.splits.full.csi} · maxVelGorge=${bestFv.maxVelGorgeMs} m/s · frente Paiporta=${bestFv.front.velMediaFrenteMs} m/s (${bestFv.front.llegadaPaiportaMin} min)`);
console.log('\n=== F4 · VALIDACIÓN CRUZADA ESPACIAL (4 PARTICIONES) ===');
for (const f of cvFolds) {
  console.log(`  ${f.trainSplit}→${f.testSplit}: pick=${f.selectedCandidate} · train=${f.trainCsi} · test=${f.testCsi} (gap=${f.overfitGap}) vs base=${f.baselineTestCsi}`);
}
console.log(`  Media fuera de muestra: FV2D=${meanOutOfSampleCsi} vs Bates=${meanBaselineOutOfSampleCsi} · gap medio=${meanOverfitGap}`);
console.log(`SHA-256: ${sha256}\nInforme: evidence/quality/dana-f4-crossval.json`);
