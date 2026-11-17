#!/usr/bin/env node
/**
 * SENDA A2 Confirmatory Evaluation — H-ARR-R vs 6 fair equal-budget baselines & 6 ablations.
 * Runs N=40 independent session blocks per family (120 external units), 10,000-sample paired bootstrap CI.
 * Preserves negative results faithfully without touching thresholds.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, bootstrapCi, mean } from '../../senda-arr/src/arr-sim.mjs';
import { buildProblem, hopAlive } from '../../senda-arr/src/arr-core.mjs';
import { STRATEGIES, ABLATIONS, runDynamicProtocol } from '../src/replan-core.mjs';
import { buildMobilityCorridorFamily, buildSrlgBlackoutFamily, buildCongestedSrdFamily } from '../src/independent-families.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(here, '..', 'results');
mkdirSync(RESULTS_DIR, { recursive: true });

const BLOCKS_PER_FAMILY = 40;
const BUDGET = { maxCopies: 6, airtimeBudgetMs: 95_000, energyBudgetMj: 2_100 };

const BUILDERS = [
  ['MOBILITY_CORRIDOR', buildMobilityCorridorFamily],
  ['SRLG_CORRELATED_BLACKOUT', buildSrlgBlackoutFamily],
  ['EU868_CONGESTED_SRD', buildCongestedSrdFamily],
];

function makeWorld(instance, rng) {
  const problem = buildProblem({ ...instance, maxHops: 8 });
  const fade = new Map();
  for (const c of problem.contactById.values()) {
    fade.set(c.id, rng() < c.probabilityLowerBound * (instance.truth.contactFactor[c.id] ?? 1));
  }
  return {
    truth: instance.truth,
    hopWorks: (c, finishMs) => fade.get(c.id) && hopAlive(instance.truth, c, finishMs),
  };
}

const units = [];
const perFamily = {};

for (const [familyName, build] of BUILDERS) {
  perFamily[familyName] = [];
  for (let i = 0; i < BLOCKS_PER_FAMILY; i++) {
    const seed = 20261117 + i * 7919 + familyName.length * 131;
    const inst = build(seed);
    const world = makeWorld(inst, mulberry32(seed ^ 0x55aa33cc));
    const unit = { family: familyName, block: i, seed, results: {}, ablations: {} };
    for (const strat of STRATEGIES) {
      unit.results[strat] = runDynamicProtocol(inst, world, strat, BUDGET);
    }
    unit.results.EPIDEMIC_CEILING = runDynamicProtocol(inst, world, 'EPIDEMIC_CAPPED', {
      ...BUDGET, maxCopies: 999, airtimeBudgetMs: Infinity, energyBudgetMj: Infinity,
    });
    for (const abl of ABLATIONS) {
      unit.ablations[abl] = runDynamicProtocol(inst, world, 'ARR_REPLAN', { ...BUDGET, ablation: abl });
    }
    units.push(unit);
    perFamily[familyName].push(unit);
  }
}

const statsFor = (list, keyFn) => ({
  deliveryRate: mean(list.map((u) => (keyFn(u).delivered ? 1 : 0))),
  meanTx: mean(list.map((u) => keyFn(u).transmissions)),
  meanAirtimeMs: mean(list.map((u) => keyFn(u).airtimeMs)),
  meanEnergyMj: mean(list.map((u) => keyFn(u).energyMj)),
  p95CpuMs: [...list.map((u) => keyFn(u).cpuMs)].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(0.95 * list.length))],
  securityViolations: list.reduce((s, u) => s + keyFn(u).securityViolations, 0),
});

const summaryByStrategy = {};
for (const strat of [...STRATEGIES, 'EPIDEMIC_CEILING']) {
  summaryByStrategy[strat] = statsFor(units, (u) => u.results[strat]);
}
const ablationSummary = {};
for (const abl of ABLATIONS) {
  ablationSummary[abl] = statsFor(units, (u) => u.ablations[abl]);
}

const ciVsStatic = bootstrapCi(
  units.map((u) => (u.results.ARR_REPLAN.delivered ? 1 : 0) - (u.results.ARR_STATIC.delivered ? 1 : 0)),
  { seed: 77, resamples: 10000 },
);
const ciVsCgr = bootstrapCi(
  units.map((u) => (u.results.ARR_REPLAN.delivered ? 1 : 0) - (u.results.CGR_EARLIEST.delivered ? 1 : 0)),
  { seed: 78, resamples: 10000 },
);
const ciVsProphet = bootstrapCi(
  units.map((u) => (u.results.ARR_REPLAN.delivered ? 1 : 0) - (u.results.PROPHET.delivered ? 1 : 0)),
  { seed: 79, resamples: 10000 },
);
const ciTxRatio = bootstrapCi(
  units.map((u) => u.results.ARR_REPLAN.transmissions / Math.max(1, u.results.ARR_STATIC.transmissions)),
  { seed: 80, resamples: 10000 },
);
const ciEnergyRatio = bootstrapCi(
  units.map((u) => u.results.ARR_REPLAN.energyMj / Math.max(1, u.results.ARR_STATIC.energyMj)),
  { seed: 81, resamples: 10000 },
);

const deltaPp = +(100 * ciVsStatic.mean).toFixed(2);
const txRatio = summaryByStrategy.ARR_REPLAN.meanTx / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanTx);
const energyRatio = summaryByStrategy.ARR_REPLAN.meanEnergyMj / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanEnergyMj);
const airtimeRatio = summaryByStrategy.ARR_REPLAN.meanAirtimeMs / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanAirtimeMs);

const gate = {
  improvementAtLeast2pp: deltaPp >= 2.0,
  ciLowerAboveZero: ciVsStatic.lo > 0,
  txRatioWithin1_5: txRatio <= 1.5 && ciTxRatio.hi <= 1.5,
  energyRatioWithin1_2: energyRatio <= 1.2 && airtimeRatio <= 1.2 && ciEnergyRatio.hi <= 1.2,
  zeroSecurityViolations: summaryByStrategy.ARR_REPLAN.securityViolations === 0,
  cpuP95SimulatedNodeMs: summaryByStrategy.ARR_REPLAN.p95CpuMs,
  androidHardwareCpuMeasured: false,
  cpuNote: 'CPU p95 measured on Node.js PC host ONLY (SIMULATED_ONLY); Android hardware p95 remains NOT_TESTED.',
};

const acceptedProvisionalSim =
  gate.improvementAtLeast2pp &&
  gate.ciLowerAboveZero &&
  gate.txRatioWithin1_5 &&
  gate.energyRatioWithin1_2 &&
  gate.zeroSecurityViolations;

const report = {
  schema: 'senda-h-arr-r/1',
  evidenceKind: 'SIMULATED_ONLY',
  generatedAt: new Date().toISOString(),
  blocksPerFamily: BLOCKS_PER_FAMILY,
  totalIndependentBlocks: units.length,
  budget: BUDGET,
  summaryByStrategy,
  ablationSummary,
  pairedDiffs: {
    arrReplanMinusArrStatic: ciVsStatic,
    arrReplanMinusCgrEarliest: ciVsCgr,
    arrReplanMinusProphet: ciVsProphet,
    txRatioVsStatic: ciTxRatio,
    energyRatioVsStatic: ciEnergyRatio,
  },
  perFamilyRates: Object.fromEntries(
    BUILDERS.map(([name]) => [
      name,
      Object.fromEntries(STRATEGIES.map((s) => [s, +(100 * statsFor(perFamily[name], (u) => u.results[s]).deliveryRate).toFixed(1)])),
    ]),
  ),
  gate,
  decision: acceptedProvisionalSim ? 'PROVISIONALLY_ACCEPTED_SIMULATED_ONLY' : 'REJECTED_OR_INCONCLUSIVE',
};

writeFileSync(path.join(RESULTS_DIR, 'replan-confirmatory.json'), JSON.stringify(report, null, 2));
const md = [
  '# SENDA A2 (H-ARR-R) — Resultados Confirmatorios en Simulación',
  '',
  `- **Evidencia:** \`SIMULATED_ONLY\` (${units.length} sesiones independientes = ${BLOCKS_PER_FAMILY} por familia × 3 familias no derivadas de #44, bootstrap pareado 10.000 muestras).`,
  `- **Presupuesto igual para comparadores acotados:** maxCopies=${BUDGET.maxCopies}, airtimeMax=${BUDGET.airtimeBudgetMs} ms, energyMax=${BUDGET.energyBudgetMj} mJ.`,
  '',
  '| Estrategia | Entrega (%) | TX medias | Airtime medio (ms) | Energía media (mJ) | CPU p95 Node (ms) | Violaciones seg. |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...[...STRATEGIES, 'EPIDEMIC_CEILING'].map((s) => {
    const r = summaryByStrategy[s];
    return `| ${s} | ${(100 * r.deliveryRate).toFixed(1)} | ${r.meanTx.toFixed(2)} | ${r.meanAirtimeMs.toFixed(0)} | ${r.meanEnergyMj.toFixed(0)} | ${r.p95CpuMs.toFixed(2)} | ${r.securityViolations} |`;
  }),
  '',
  '## Diferencias Pareadas (IC 95 %, 10.000 resamples)',
  `- **ARR_REPLAN − ARR_STATIC:** ${deltaPp.toFixed(2)} pp [${(100 * ciVsStatic.lo).toFixed(2)}, ${(100 * ciVsStatic.hi).toFixed(2)}] pp`,
  `- **ARR_REPLAN − CGR_EARLIEST:** ${(100 * ciVsCgr.mean).toFixed(2)} pp [${(100 * ciVsCgr.lo).toFixed(2)}, ${(100 * ciVsCgr.hi).toFixed(2)}] pp`,
  `- **ARR_REPLAN − PROPHET:** ${(100 * ciVsProphet.mean).toFixed(2)} pp [${(100 * ciVsProphet.lo).toFixed(2)}, ${(100 * ciVsProphet.hi).toFixed(2)}] pp`,
  `- **Ratio TX vs STATIC:** ${txRatio.toFixed(2)}x (IC sup ${ciTxRatio.hi.toFixed(2)}x) · **Ratio Energía vs STATIC:** ${energyRatio.toFixed(2)}x (IC sup ${ciEnergyRatio.hi.toFixed(2)}x) · **Ratio Airtime:** ${airtimeRatio.toFixed(2)}x`,
  '',
  '## Ablaciones (`ARR_REPLAN`)',
  '| Ablación | Entrega (%) | TX medias | Energía media (mJ) |',
  '|---|---:|---:|---:|',
  ...ABLATIONS.map((a) => `| ${a} | ${(100 * ablationSummary[a].deliveryRate).toFixed(1)} | ${ablationSummary[a].meanTx.toFixed(2)} | ${ablationSummary[a].meanEnergyMj.toFixed(0)} |`),
  '',
  `## Decisión Prerregistrada: **${report.decision}**`,
  `> Nota obligatoria: CPU p95 (${gate.cpuP95SimulatedNodeMs} ms) medido en Node.js PC; la latencia en Android real y el PDR físico RF permanecen **NOT_TESTED**.`,
].join('\n');
writeFileSync(path.join(RESULTS_DIR, 'REPLAN_RESULTS.md'), md);
console.log(JSON.stringify({ decision: report.decision, deltaPp, ciLo: +(100 * ciVsStatic.lo).toFixed(2), ciHi: +(100 * ciVsStatic.hi).toFixed(2), txRatio: +txRatio.toFixed(3), energyRatio: +energyRatio.toFixed(3), airtimeRatio: +airtimeRatio.toFixed(3), perFamilyRates: report.perFamilyRates }, null, 2));
