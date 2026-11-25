#!/usr/bin/env node
/**
 * SENDA · Benchmark reproducible en hardware real para todos los módulos de peritaje ciudadano,
 * física avanzada e integración CalmPath/Civil Sentry.
 *
 * Regla de veracidad: todas las cifras de rendimiento salen de `performance.now()` en este equipo;
 * declara explícitamente CPU, núcleos, RAM, Node.js y ausencia de GPU si no hay adaptador WebGPU.
 *
 * Uso:
 *   node packages/senda/scripts/benchmark-peritaje-fisica.mjs [--json]
 */
import os from 'node:os';
import { readFileSync } from 'node:fs';
import {
  createCitizenKeyPair,
  createConsentRecord,
  createCitizenReport,
  verifyCitizenReport,
} from '../src/citizen-report.mjs';
import { computeDHash64, fitDawidSkene, runForensicAssessment } from '../src/report-forensics.mjs';
import {
  evaluateReportProtocol,
  createAuthorityKeyPair,
  issueAuthorityGrant,
  authorizePublicWarningN5,
  PUBLISHED_RISK_THRESHOLDS,
} from '../src/report-protocol.mjs';
import { enkfUpdate, runFloodAssimilationExperiment } from '../src/data-assimilation.mjs';
import { createFvSim, fvRunUntil, verifyPrecisionParity } from '../src/shallow-water-fv.mjs';
import { rothermelSpread, createLevelSetFireSim, runLevelSetFireUntil } from '../src/fire-rothermel.mjs';
import { computeEtcsBrakingCurves, assessCwrThermalBuckling, evaluateNadalDerailment } from '../src/rail-physics-etcs.mjs';
import { sampleDemProfile, evaluateMeshLinkWithUncertainty } from '../src/radio-propagation-advanced.mjs';
import { sobolSensitivitySaltelli } from '../src/uncertainty-uq.mjs';
import { routeEvacuationGraph, rankEmergencySafeZones } from '../src/emergency-routing-zones.mjs';
import { runCommitteeTriagePanel, runEpistemicSecurityAudit } from '../src/triage-governance.mjs';

const JSON_OUT = process.argv.includes('--json');

async function bench(name, runs, fn) {
  await fn();
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((s, v) => s + v, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
  return { name, runs, meanMs: +mean.toFixed(3), p50Ms: +p50.toFixed(3), p95Ms: +p95.toFixed(3) };
}

const hw = {
  generatedUtc: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  platform: `${os.platform()} ${os.release()} (${os.arch()})`,
  nodeVersion: process.version,
  cpuModel: os.cpus()[0]?.model ?? 'desconocido',
  cpuCores: os.cpus().length,
  totalRamGib: +(os.totalmem() / 1024 ** 3).toFixed(2),
  gpuAvailable: false,
  gpuNote: 'Entorno virtual sin GPU ni adaptador WebGPU; no se reportan tiempos de GPU ni de móvil de gama media (ver IDEAS_NO_VALIDADAS.md).',
};

const results = [];
const tNowMs = Date.parse('2026-11-25T17:00:10Z');

// 1. Firma + verificación Ed25519 citizen-report
const kp = await createCitizenKeyPair();
const consent = createConsentRecord({ accepted: true, consentVersion: '1.0', acceptedAtIso: '2026-11-25T18:00:00+01:00' });
let sampleRep;
results.push(await bench('citizen-report: crear + firmar + verificar Ed25519', 25, async () => {
  sampleRep = await createCitizenReport({
    kind: 'inundacion',
    operationalStatus: 'ACTUAL',
    capturedAtIso: '2026-11-25T18:00:00+01:00',
    modalities: ['texto', 'ubicacion'],
    location: { lat: 39.428, lon: -0.418, accuracyM: 10 },
    text: 'Agua rebosando puente de Picanya',
    consent,
  }, kp);
  await verifyCitizenReport(sampleRep);
}));

// 2. dHash-64 + Dawid-Skene + peritaje completo
const fakeImg = new Uint8Array(64 * 64 * 4).fill(140);
let foren;
results.push(await bench('report-forensics: dHash-64 (64×64) + Dawid-Skene + peritaje 5 pilares', 15, async () => {
  computeDHash64(fakeImg, 64, 64);
  fitDawidSkene([
    { itemId: 'i1', raterId: 'r1', label: 1 },
    { itemId: 'i1', raterId: 'r2', label: 1 },
    { itemId: 'i2', raterId: 'r1', label: 0 },
    { itemId: 'i2', raterId: 'r2', label: 0 },
  ]);
  foren = await runForensicAssessment(sampleRep, {
    receivedAtMs: tNowMs,
    priorProbability: 0.15,
    physicalContext: {
      rainfallMm: 120,
      rainfallDurationH: 1,
      gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true },
    },
  });
}));

// 3. Protocolo N0-N4 + puerta criptográfica humana N5 + CAP 1.2
const rootAuth = await createAuthorityKeyPair();
const officerAuth = await createAuthorityKeyPair();
const officerPubB64u = Buffer.from(officerAuth.publicRaw).toString('base64url');
const grant = await issueAuthorityGrant({
  grantId: 'grant-cecopi-01',
  authorityId: 'cecopi-valencia-01',
  authorityName: 'Dirección de Emergencia',
  role: 'DIRECTOR_PMA',
  organization: 'Protección Civil',
  authorityPublicKeyB64u: officerPubB64u,
  allowedHazardKinds: ['inundacion'],
  scopeCircle: { lat: 39.43, lon: -0.42, radiusKm: 50 },
  grantedAtIso: '2026-11-25T16:00:00Z',
  expiresAtIso: '2026-11-25T23:00:00Z',
  documentHash: 'a'.repeat(64),
}, rootAuth);

results.push(await bench('report-protocol: evaluación N0-N4 + autorización humana Ed25519 N5 + CAP 1.2', 15, async () => {
  const st = await evaluateReportProtocol(sampleRep, {
    receivedAtMs: tNowMs,
    nowMs: tNowMs + 60_000,
    priorProbability: 0.15,
    physicalContext: {
      rainfallMm: 120,
      rainfallDurationH: 1,
      gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true },
    },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'MEASURED' },
  });
  await authorizePublicWarningN5(st, sampleRep, {
    grant,
    trustAnchorPublicRaw: rootAuth.publicRaw,
    authorityKeyPair: officerAuth,
    rationale: 'Confirmado en aforo SAIH y campo',
    instruction: 'Suba a plantas altas y evite garajes o cauces.',
    expiresAtMs: tNowMs + 3 * 3600_000,
    nowMs: tNowMs + 120_000,
  });
}));

// 4. Asimilación EnKF (Evensen 1994/2003, 20 miembros × 60 variables de estado + acoplamiento shallow-water)
const wE = 14, hE = 8, dxE = 25;
const zE = new Float32Array(wE * hE);
const sinkE = new Uint8Array(wE * hE);
for (let j = 0; j < hE; j++) for (let i = 0; i < wE; i++) {
  zE[j * wE + i] = 10 - 0.3 * i + 0.5 * Math.abs(j - 4);
  if (i === wE - 1) sinkE[j * wE + i] = 1;
}
const priorMembers = Array.from({ length: 12 }, (_, m) => ({ inflowScale: 0.6 + 0.08 * m, manningN: 0.04 }));
results.push(await bench('data-assimilation: EnKF acoplado a shallow-water (12 miembros, 14×8)', 5, () => {
  runFloodAssimilationExperiment({
    w: wE,
    h: hE,
    z: zE,
    dx: dxE,
    sink: sinkE,
    inflowCells: [4 * wE + 1],
    baseHydrograph: [[0, 60], [180, 120], [360, 40]],
    truthParams: { inflowScale: 1.15, manningN: 0.04 },
    priorMembers,
    fieldMarks: [{ id: 'm1', level: 'N2', cellIndex: 4 * wE + 6, observationStd: 0.05 }],
    tAssimilateS: 120,
    tEndS: 240,
    dtMax: 5,
  });
}));
void enkfUpdate;

// 5. Solver FV 2D Audusse-HLLC (64x64, 120 s) f64 vs f32 + paridad
const wF = 64, hF = 64, dxF = 20;
const zF = new Float64Array(wF * hF);
for (let j = 0; j < hF; j++) for (let i = 0; i < wF; i++) zF[j * wF + i] = 15 - 0.12 * i + 0.3 * Math.abs(j - 32);
results.push(await bench('shallow-water-fv: malla 64×64, t=60 s en CPU f64', 5, () => {
  const s = createFvSim({ w: wF, h: hF, z: zF, dx: dxF, n: 0.04, precision: 'f64' });
  fvRunUntil(s, 60, { inflow: () => 180, cells: [32 * wF + 2], dtMax: 2 });
}));
results.push(await bench('shallow-water-fv: malla 64×64, t=60 s en CPU f32 (paridad WGSL)', 5, () => {
  const s = createFvSim({ w: wF, h: hF, z: zF, dx: dxF, n: 0.04, precision: 'f32' });
  fvRunUntil(s, 60, { inflow: () => 180, cells: [32 * wF + 2], dtMax: 2 });
}));
const paritySample = verifyPrecisionParity({ w: 32, h: 32, z: zF.subarray(0, 1024), dx: 20, n: 0.04 }, { tEnd: 40, inflow: () => 100, cells: [16 * 32 + 2], dtMax: 2 });

// 6. Incendio Rothermel + Level-Set 2D (61×61, 1 h)
const fuel61 = new Array(61 * 61).fill('SH5');
const fireWx = { dead1hMoisture: 0.05, dead10hMoisture: 0.07, dead100hMoisture: 0.09, liveHerbMoisture: 0.6, liveWoodyMoisture: 0.85, midflameWindMs: 2.5, windToDeg: 115 };
results.push(await bench('fire-rothermel: 1000 evaluaciones Rothermel (1972) / Scott & Burgan', 10, () => {
  for (let i = 0; i < 1000; i++) rothermelSpread('SH5', { ...fireWx, slopeDeg: 12 });
}));
results.push(await bench('fire-rothermel: Level-Set Huygens 2D (61×61, t=1 h)', 5, () => {
  const s = createLevelSetFireSim({ w: 61, h: 61, dx: 50, fuelGrid: fuel61, ignition: { i: 20, j: 30, radiusM: 75 } });
  runLevelSetFireUntil(s, 3600, fireWx, { dtMax: 60 });
}));

// 7. Física ferroviaria (1000 evaluaciones ETCS + CWR + Nadal)
results.push(await bench('rail-physics-etcs: 1000 evaluaciones ETCS + CWR Kish-Samavedam + Nadal', 10, () => {
  for (let i = 0; i < 1000; i++) {
    computeEtcsBrakingCurves({ vInitialKmh: 200, vTargetKmh: 80, aSafeEmergencyMs2: 1.1, aServiceMs2: 0.75, tBrakeEmergencyS: 3, tBrakeServiceS: 4, tTractionCutoffS: 1.5, aEstTractionMs2: 0.3, tWarningS: 2, tDriverS: 4, tIndicationS: 5, gradientPermille: -5, dTargetM: 1800 });
    assessCwrThermalBuckling({ railTempC: 54, neutralTempC: 25, railAreaM2: 7.684e-3, railIzM4: 5.12e-6, youngModulusPa: 210e9, thermalAlphaPerK: 11.5e-6, lateralBallastPeakNPerM: 14000, lateralBallastLimitNPerM: 9500, initialMisalignmentMm: 5, curveRadiusM: 600 });
    evaluateNadalDerailment({ flangeAngleDeg: 70, wheelRailFriction: 0.36, lateralForceKN: 45, verticalForceKN: 80 });
  }
}));

// 8. Radio avanzada sobre MDE real del Poyo (120 puntos, banda k ×3)
const poyo = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/radio/poyo.json', import.meta.url), 'utf8'));
const chiva = poyo.municipios.find((m) => m.nombre === 'Chiva');
const paiporta = poyo.municipios.find((m) => m.nombre === 'Paiporta');
const poyoProf = sampleDemProfile(poyo.dem, [chiva.lon, chiva.lat], [paiporta.lon, paiporta.lat], 120);
results.push(await bench('radio-propagation-advanced: ITU-R P.526-15 Delta-Bullington + ITM + banda k (120 pts Poyo)', 50, () => {
  evaluateMeshLinkWithUncertainty(poyoProf, { freqHz: 868.1e6, hTxAglM: 6, hRxAglM: 6, txPowerDbm: 14, txGainDbi: 2, rxGainDbi: 2, rxSensitivityDbm: -134, kMin: 2 / 3, kNom: 4 / 3, kMax: 2.0 });
}));

// 9. Sobol-Saltelli (Ishigami, 1024×5 = 5120 evaluaciones)
results.push(await bench('uncertainty-uq: Sobol-Saltelli (Ishigami, N=1024, 5120 evals)', 10, () => {
  sobolSensitivitySaltelli({
    dimensions: [
      { name: 'x1', dist: 'uniform', min: -Math.PI, max: Math.PI },
      { name: 'x2', dist: 'uniform', min: -Math.PI, max: Math.PI },
      { name: 'x3', dist: 'uniform', min: -Math.PI, max: Math.PI },
    ],
    baseSamples: 1024,
    seed: 1,
    evaluate: ({ x1, x2, x3 }) => Math.sin(x1) + 7 * Math.sin(x2) ** 2 + 0.1 * (x3 ** 4) * Math.sin(x1),
  });
}));

// 10. Fase 3: Enrutamiento A*, zonas seguras, panel de 4 especialistas y auditoría epistémica
const graphNodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, lat: 39.4 + (i % 8) * 0.004, lon: -0.45 + Math.floor(i / 8) * 0.005 }));
const graphEdges = [];
for (let i = 0; i < 39; i++) {
  graphEdges.push({ from: `n${i}`, to: `n${i + 1}`, lengthM: 320, slopeDeg: 3, accessible: true });
  if (i + 8 < 40) graphEdges.push({ from: `n${i}`, to: `n${i + 8}`, lengthM: 400, slopeDeg: 4, accessible: true });
}
results.push(await bench('emergency-routing-zones + triage-governance: A* (40 nodos) + zonas + panel 4 especialistas + auditoría', 25, async () => {
  const route = routeEvacuationGraph({ nodes: graphNodes, edges: graphEdges, startId: 'n0', goalIds: ['n39'], profile: 'pedestrian', debrisFactor: 0.5 });
  const ranked = rankEmergencySafeZones([
    { id: 'z1', name: 'Alto', handMarginM: 8, fireDistanceKm: 9, pm25UgM3: 15, wheelchairAccessible: true, occupancyRatio: 0.2, radioMarginDb: 10, etaMinutes: 10, provenance: 'OBSERVED' },
  ], { weights: { floodMargin: 3, fireDistance: 2, airQuality: 1, accessibility: 2, capacity: 1, comms: 1, proximity: 1 } });
  runCommitteeTriagePanel({ report: sampleRep.payload, forensicAssessment: foren, protocolState: { level: 'N4', canPublicWarn: false }, shelterRanking: ranked, evacuationRoute: route });
  await runEpistemicSecurityAudit({ reports: [sampleRep], protocolStates: [{ reportId: sampleRep.payload.reportId, level: 'N4', canPublicWarn: false }] });
}));

const payload = { hardware: hw, paritySample, benchmarks: results };
if (JSON_OUT) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log('\n=== SENDA · Benchmark real medido ===');
  console.log(`Hardware: ${hw.cpuModel} (${hw.cpuCores} núcleos) · ${hw.totalRamGib} GiB RAM · ${hw.platform} · Node ${hw.nodeVersion}`);
  console.log(`GPU: ${hw.gpuAvailable ? 'Sí' : 'No (solo CPU)'}`);
  console.log(`Paridad f32↔f64 (32×32, t=40s): maxAbsDiff=${paritySample.maxAbsDiffM} m (tolerancia ${paritySample.toleranceM} m, ok=${paritySample.withinTolerance})\n`);
  for (const r of results) {
    console.log(`- ${r.name}: media ${r.meanMs} ms · p50 ${r.p50Ms} ms · p95 ${r.p95Ms} ms (${r.runs} corridas)`);
  }
}
