#!/usr/bin/env node
/**
 * SENDA A2 Protocol V2 Confirmatory Run (H-ARR-R-v2 vs 6 equal-budget baselines & 6 ablations).
 * Uses strictly untouched disjoint seeds (+500000 offset) across 3 independent families + dynamic mid-horizon shock stress.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, bootstrapCi, mean } from '../../senda-arr/src/arr-sim.mjs';
import { buildProblem, hopAlive } from '../../senda-arr/src/arr-core.mjs';
import { ABLATIONS } from '../src/replan-core.mjs';
import { V2_STRATEGIES, runDynamicV2 } from '../src/replan-v2.mjs';
import { buildMobilityCorridorFamily, buildSrlgBlackoutFamily, buildCongestedSrdFamily } from '../src/independent-families.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(here, '..', 'results');
const BLOCKS_PER_FAMILY = 40;
const BUDGET = { maxCopies: 6, airtimeBudgetMs: 95_000, energyBudgetMj: 2_100 };

const BUILDERS = [
  ['MOBILITY_CORRIDOR', buildMobilityCorridorFamily],
  ['SRLG_CORRELATED_BLACKOUT', buildSrlgBlackoutFamily],
  ['EU868_CONGESTED_SRD', buildCongestedSrdFamily],
];

function makeDynamicShockWorld(instance, rng) {
  const problem = buildProblem({ ...instance, maxHops: 8 });
  const truth = {
    nodeDeathMs: { ...instance.truth.nodeDeathMs },
    contactFactor: { ...instance.truth.contactFactor },
  };
  // Mid-horizon brownout/shock outside static forecast t0: breaks one surviving relay domain ~30% of runs
  if (rng() < 0.32) {
    const midNodes = instance.nodes.filter((n) => n.role === 'RELAY' && !truth.nodeDeathMs[n.id]);
    if (midNodes.length) {
      const target = midNodes[Math.floor(rng() * midNodes.length)];
      const shockT = Math.round(instance.deadlineMs * (0.12 + 0.25 * rng()));
      for (const n of instance.nodes) {
        if ((n.srlgDomains ?? []).some((d) => (target.srlgDomains ?? []).includes(d))) {
          truth.nodeDeathMs[n.id] = shockT;
        }
      }
    }
  }
  const fade = new Map();
  for (const c of problem.contactById.values()) {
    fade.set(c.id, rng() < c.probabilityLowerBound * (truth.contactFactor[c.id] ?? 1));
  }
  return { truth, hopWorks: (c, finishMs) => fade.get(c.id) && hopAlive(truth, c, finishMs) };
}

const units = [];
const perFamily = {};
for (const [familyName, build] of BUILDERS) {
  perFamily[familyName] = [];
  for (let i = 0; i < BLOCKS_PER_FAMILY; i++) {
    const seed = 20761117 + i * 7919 + familyName.length * 137;
    const inst = build(seed);
    const world = makeDynamicShockWorld(inst, mulberry32(seed ^ 0x33aa55cc));
    const unit = { family: familyName, block: i, seed, results: {}, ablations: {} };
    for (const strat of V2_STRATEGIES) {
      unit.results[strat] = runDynamicV2(inst, world, strat, { ...BUDGET, seed });
    }
    unit.results.EPIDEMIC_CEILING = runDynamicV2(inst, world, 'EPIDEMIC_CAPPED', {
      ...BUDGET, maxCopies: 999, airtimeBudgetMs: Infinity, energyBudgetMj: Infinity, seed,
    });
    for (const abl of ABLATIONS) {
      unit.ablations[abl] = runDynamicV2(inst, world, 'ARR_REPLAN_V2', { ...BUDGET, ablation: abl, seed });
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

const summaryByStrategy = Object.fromEntries([...V2_STRATEGIES, 'EPIDEMIC_CEILING'].map((s) => [s, statsFor(units, (u) => u.results[s])]));
const ablationSummary = Object.fromEntries(ABLATIONS.map((a) => [a, statsFor(units, (u) => u.ablations[a])]));

const ciVsStatic = bootstrapCi(units.map((u) => (u.results.ARR_REPLAN_V2.delivered ? 1 : 0) - (u.results.ARR_STATIC.delivered ? 1 : 0)), { seed: 91, resamples: 10000 });
const ciVsCgr = bootstrapCi(units.map((u) => (u.results.ARR_REPLAN_V2.delivered ? 1 : 0) - (u.results.CGR_EARLIEST.delivered ? 1 : 0)), { seed: 92, resamples: 10000 });
const ciVsProphet = bootstrapCi(units.map((u) => (u.results.ARR_REPLAN_V2.delivered ? 1 : 0) - (u.results.PROPHET_WARM.delivered ? 1 : 0)), { seed: 93, resamples: 10000 });
const ciVsSpray = bootstrapCi(units.map((u) => (u.results.ARR_REPLAN_V2.delivered ? 1 : 0) - (u.results.SPRAY_AND_FOCUS.delivered ? 1 : 0)), { seed: 94, resamples: 10000 });
const ciTxRatio = bootstrapCi(units.map((u) => u.results.ARR_REPLAN_V2.transmissions / Math.max(1, u.results.ARR_STATIC.transmissions)), { seed: 95, resamples: 10000 });
const ciEnergyRatio = bootstrapCi(units.map((u) => u.results.ARR_REPLAN_V2.energyMj / Math.max(1, u.results.ARR_STATIC.energyMj)), { seed: 96, resamples: 10000 });

const deltaPp = +(100 * ciVsStatic.mean).toFixed(2);
const txRatio = summaryByStrategy.ARR_REPLAN_V2.meanTx / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanTx);
const energyRatio = summaryByStrategy.ARR_REPLAN_V2.meanEnergyMj / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanEnergyMj);
const airtimeRatio = summaryByStrategy.ARR_REPLAN_V2.meanAirtimeMs / Math.max(1e-6, summaryByStrategy.ARR_STATIC.meanAirtimeMs);

const gate = {
  improvementAtLeast2pp: deltaPp >= 2.0,
  ciLowerAboveZero: ciVsStatic.lo > 0,
  txRatioWithin1_5: txRatio <= 1.5 && ciTxRatio.hi <= 1.5,
  energyRatioWithin1_2: energyRatio <= 1.2 && airtimeRatio <= 1.2 && ciEnergyRatio.hi <= 1.2,
  zeroSecurityViolations: summaryByStrategy.ARR_REPLAN_V2.securityViolations === 0,
  cpuP95SimulatedNodeMs: summaryByStrategy.ARR_REPLAN_V2.p95CpuMs,
  androidHardwareCpuMeasured: false,
};

const accepted = gate.improvementAtLeast2pp && gate.ciLowerAboveZero && gate.txRatioWithin1_5 && gate.energyRatioWithin1_2 && gate.zeroSecurityViolations;
const report = {
  schema: 'senda-h-arr-r-v2/1',
  evidenceKind: 'SIMULATED_ONLY',
  generatedAt: new Date().toISOString(),
  totalIndependentBlocks: units.length,
  budget: BUDGET,
  summaryByStrategy,
  ablationSummary,
  pairedDiffs: {
    vsStatic: ciVsStatic,
    vsCgr: ciVsCgr,
    vsProphet: ciVsProphet,
    vsSprayAndFocus: ciVsSpray,
    txRatioVsStatic: ciTxRatio,
    energyRatioVsStatic: ciEnergyRatio,
  },
  perFamilyRates: Object.fromEntries(
    BUILDERS.map(([name]) => [name, Object.fromEntries(V2_STRATEGIES.map((s) => [s, +(100 * statsFor(perFamily[name], (u) => u.results[s]).deliveryRate).toFixed(1)]))]),
  ),
  gate,
  decision: accepted ? 'PROVISIONALLY_ACCEPTED_SIMULATED_ONLY' : 'REJECTED_OR_INCONCLUSIVE',
};

writeFileSync(path.join(RESULTS_DIR, 'replan-v2-confirmatory.json'), JSON.stringify(report, null, 2));
const md = [
  '# SENDA A2 (H-ARR-R-v2) — Resultados Confirmatorios Bajo Choque Mid-Horizon y Coste de Oportunidad',
  '',
  `- **Evidencia:** \`SIMULATED_ONLY\` (${units.length} bloques independientes nuevos, semillas disjuntas, choque regional mid-horizon no anticipado en t0).`,
  `- **V1 anterior archivado honestamente como negativo:** ver \`REPLAN_RESULTS_V1_REJECTED.md\`.`,
  '',
  '| Estrategia | Entrega (%) | TX medias | Airtime medio (ms) | Energía media (mJ) | CPU p95 Node (ms) | Violaciones seg. |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...[...V2_STRATEGIES, 'EPIDEMIC_CEILING'].map((s) => {
    const r = summaryByStrategy[s];
    return `| ${s} | ${(100 * r.deliveryRate).toFixed(1)} | ${r.meanTx.toFixed(2)} | ${r.meanAirtimeMs.toFixed(0)} | ${r.meanEnergyMj.toFixed(0)} | ${r.p95CpuMs.toFixed(2)} | ${r.securityViolations} |`;
  }),
  '',
  '## Diferencias Pareadas V2 (IC 95 %, 10.000 resamples)',
  `- **ARR_REPLAN_V2 − ARR_STATIC:** ${deltaPp.toFixed(2)} pp [${(100 * ciVsStatic.lo).toFixed(2)}, ${(100 * ciVsStatic.hi).toFixed(2)}] pp`,
  `- **ARR_REPLAN_V2 − CGR_EARLIEST:** ${(100 * ciVsCgr.mean).toFixed(2)} pp [${(100 * ciVsCgr.lo).toFixed(2)}, ${(100 * ciVsCgr.hi).toFixed(2)}] pp`,
  `- **ARR_REPLAN_V2 − PROPHET_WARM:** ${(100 * ciVsProphet.mean).toFixed(2)} pp [${(100 * ciVsProphet.lo).toFixed(2)}, ${(100 * ciVsProphet.hi).toFixed(2)}] pp`,
  `- **ARR_REPLAN_V2 − SPRAY_AND_FOCUS:** ${(100 * ciVsSpray.mean).toFixed(2)} pp [${(100 * ciVsSpray.lo).toFixed(2)}, ${(100 * ciVsSpray.hi).toFixed(2)}] pp`,
  `- **Ratio TX vs STATIC:** ${txRatio.toFixed(2)}x (IC sup ${ciTxRatio.hi.toFixed(2)}x) · **Ratio Energía vs STATIC:** ${energyRatio.toFixed(2)}x (IC sup ${ciEnergyRatio.hi.toFixed(2)}x) · **Ratio Airtime:** ${airtimeRatio.toFixed(2)}x`,
  '',
  '## Ablaciones V2',
  '| Ablación | Entrega (%) | TX medias | Energía media (mJ) |',
  '|---|---:|---:|---:|',
  ...ABLATIONS.map((a) => `| ${a} | ${(100 * ablationSummary[a].deliveryRate).toFixed(1)} | ${ablationSummary[a].meanTx.toFixed(2)} | ${ablationSummary[a].meanEnergyMj.toFixed(0)} |`),
  '',
  `## Decisión Protocolo V2: **${report.decision}**`,
].join('\n');
writeFileSync(path.join(RESULTS_DIR, 'REPLAN_RESULTS_V2.md'), md);
console.log(JSON.stringify({ decision: report.decision, deltaPp, ciLo: +(100 * ciVsStatic.lo).toFixed(2), ciHi: +(100 * ciVsStatic.hi).toFixed(2), txRatio: +txRatio.toFixed(3), energyRatio: +energyRatio.toFixed(3), airtimeRatio: +airtimeRatio.toFixed(3), perFamilyRates: report.perFamilyRates }, null, 2));
