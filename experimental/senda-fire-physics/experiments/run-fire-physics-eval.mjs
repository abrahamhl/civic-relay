#!/usr/bin/env node
/**
 * SENDA A3 (H-FIRE-B) — GeoMAC 2018 Development/Diagnostic Censoring Audit + External Gate Check.
 * NEVER uses GeoMAC 2018 (camp/carr/woolsey) as external confirmatory proof!
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projector, mulberry32 } from '../../senda-arr/src/arr-sim.mjs';
import { pointGeometry } from '../../senda-arr/src/arr-forecast.mjs';
import { auditCensoredHorizonLabels } from '../src/censor-audit.mjs';
import { solveLevelSetUpwind, ensembleLevelSetForecast } from '../src/level-set-solver.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(here, '..', 'results');
mkdirSync(RESULTS_DIR, { recursive: true });

const HOUR = 3_600_000;
const HORIZON_H = 24;

// 1. Audit censoring rate across GeoMAC 2018 diagnostic fires
const diagnosticFires = {};
for (const key of ['camp', 'carr', 'woolsey']) {
  const d = JSON.parse(readFileSync(path.join(here, '..', '..', 'senda-arr', 'data', `geomac-2018-${key}.json`), 'utf8'));
  const all = d.perimeters.flatMap((p) => p.rings.flat());
  const lon = all.map((p) => p[0]);
  const lat = all.map((p) => p[1]);
  const lo = [Math.min(...lon), Math.min(...lat)];
  const hi = [Math.max(...lon), Math.max(...lat)];
  const pad = [(hi[0] - lo[0]) * 0.25, (hi[1] - lo[1]) * 0.25];
  const toKm = projector(lo[0] - pad[0], lo[1] - pad[1]);
  const area = toKm([hi[0] + pad[0], hi[1] + pad[1]]);
  const per = d.perimeters.map((p) => ({ tMs: Date.parse(p.t), rings: p.rings.map((r) => r.map(toKm)) }));

  let totalPts = 0, totalCensored = 0, totalBurnt = 0, totalUnburnt = 0, units = 0;
  for (let k0 = 1; k0 <= Math.min(12, per.length - 2); k0++) {
    const hasAfter = per.slice(k0 + 1).some((p) => p.tMs > per[k0].tMs);
    if (!hasAfter) continue;
    units++;
    const rng = mulberry32(7000 + k0 * 131 + key.length);
    const pts = [];
    while (pts.length < 300) {
      const pt = [rng() * area[0], rng() * area[1]];
      if (!pointGeometry(per, k0, [pt])[0].burnt) pts.push(pt);
    }
    const audit = auditCensoredHorizonLabels(per, k0, pts, { horizonMs: HORIZON_H * HOUR });
    totalPts += audit.counts.total;
    totalCensored += audit.counts.censored;
    totalBurnt += audit.counts.burnt;
    totalUnburnt += audit.counts.unburntConfirmed;
  }
  diagnosticFires[key] = {
    splitTag: 'DEVELOPMENT_DIAGNOSTIC_ONLY',
    units,
    points: totalPts,
    burntConfirmed: totalBurnt,
    unburntConfirmed: totalUnburnt,
    censoredAtHorizon: totalCensored,
    censoredRate: +(totalCensored / Math.max(1, totalPts)).toFixed(4),
  };
}

// 2. Run controlled synthetic Rothermel Level-Set vs Persistence benchmark (analytical physical check, NOT real wildfire proof)
const w = 45, h = 45, dxM = 60;
const grid = { w, h, dxM, fuel: new Uint8Array(w * h).fill(2), elev: new Float32Array(w * h).fill(120) };
const phi0 = new Float64Array(w * h);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) phi0[j * w + i] = Math.hypot((i - 14) * dxM, (j - 22) * dxM) - 110;
const truthRun = solveLevelSetUpwind({ grid, phi0, weather: { windU_mps: 6.5, windV_mps: 1.5, availableAtMs: 0 }, horizonMin: 60, t0Ms: 1000 });
const ensRun = ensembleLevelSetForecast({ grid, phi0, weather: { windU_mps: 6.2, windV_mps: 1.2, availableAtMs: 0 }, horizonMin: 60, members: 16, t0Ms: 1000 });

let brierPers = 0, brierModel = 0, unburntCount = 0;
for (let k = 0; k < w * h; k++) {
  if (phi0[k] <= 0) continue; // unburnt at t0 only
  const y = truthRun.burnedMask[k];
  brierPers += (0 - y) ** 2;
  brierModel += (ensRun.probGrid[k] - y) ** 2;
  unburntCount++;
}

const report = {
  schema: 'senda-h-fire-b/1',
  generatedAt: new Date().toISOString(),
  externalConfirmatoryStatus: 'DATASET_BLOCKED',
  hypothesisDecision: 'INCONCLUSIVE_DATASET_BLOCKED',
  reason: 'GeoMAC 2018 fires (camp/carr/woolsey) are frozen as DEVELOPMENT_DIAGNOSTIC_ONLY; >=10 independent external wildfires (>=6 train, >=4 test) with causal issue-time NOAA HRRR/LANDFIRE/EFFIS archives are not present in this local environment.',
  diagnosticCensoringAudit2018: diagnosticFires,
  syntheticPhysicalSanityOnly: {
    evidenceKind: 'SIMULATED_NUMERICAL_VERIFICATION_ONLY',
    horizonMin: 60,
    unburntCellsEvaluated: unburntCount,
    persistenceBrier: +(brierPers / Math.max(1, unburntCount)).toFixed(5),
    levelSetBrier: +(brierModel / Math.max(1, unburntCount)).toFixed(5),
    cflObserved: truthRun.maxObservedCfl,
  },
  h2LegacyStatus: 'EXPERIMENTAL_REJECTED',
  canIssueEvacuationOrder: false,
  canPublicWarn: false,
};

writeFileSync(path.join(RESULTS_DIR, 'fire-physics-eval.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
