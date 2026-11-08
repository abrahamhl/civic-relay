#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_STRATEGIES, BENCH_SCENARIO_NAMES, SCENARIO_NOTES, buildScenario,
  mulberry32, simulateRouting,
} from '../src/opportunistic-routing.mjs';
import { buildManifest, hashFile } from '../../../scripts/release-manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const DETERMINISTIC = new Set(['scheduled-line', 'scheduled-partition', 'energy-scarce']);
const STOCHASTIC = new Set(['crowd', 'held-out', 'unreliable-contacts']);
const BASELINE = 'earliest';

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function intArg(name, fallback, min = 1) {
  const v = Number(arg(name, fallback));
  if (!Number.isInteger(v) || v < min) throw new RangeError(`--${name} debe ser un entero ≥ ${min} (${v})`);
  return v;
}

const graphs = intArg('graphs', 30);
const realizations = intArg('realizations', 20);
const bootstrapB = intArg('bootstrap', 2000);
const repeats = intArg('repeats', 10);
const seedBase = intArg('seed', 20261107);
const outPath = resolve(repo, arg('out', 'evidence/senda/mission-95/routing-benchmark-m95.json'));
const bootstrapSeed = 0x5eed5eed;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const round = (n) => (n === null || n === undefined || !Number.isFinite(n) ? n : Math.round(n * 1000) / 1000);

function bootstrapMeanCI(values, B = bootstrapB, seed = bootstrapSeed) {
  if (!values.length) return null;
  if (values.length === 1) return { lo: round(values[0]), hi: round(values[0]), n: 1 };
  const r = mulberry32(seed), means = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[Math.floor(r() * values.length)];
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  return { lo: round(pct(means, 0.025)), hi: round(pct(means, 0.975)), n: values.length };
}

function pairedBootstrapCI(pairs, B = bootstrapB, seed = bootstrapSeed) {
  if (!pairs.length) return null;
  if (pairs.length === 1) return { lo: round(pairs[0]), hi: round(pairs[0]), n: 1 };
  const r = mulberry32(seed), means = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < pairs.length; i++) s += pairs[Math.floor(r() * pairs.length)];
    means.push(s / pairs.length);
  }
  means.sort((a, b) => a - b);
  return { lo: round(pct(means, 0.025)), hi: round(pct(means, 0.975)), n: pairs.length };
}

function perGraphGraphStats(scenario, graphSeed, reps) {
  const base = buildScenario(scenario, { seed: graphSeed });
  const byStrategy = Object.fromEntries(ALL_STRATEGIES.map((s) => [s, []]));
  let deterministicMismatch = null;
  for (let rep = 0; rep < reps; rep++) {
    let contacts = base.contacts;
    if (scenario === 'unreliable-contacts') {
      const r = mulberry32(graphSeed + rep * 7919 + 13);
      contacts = base.contacts.map((c) => ({ ...c, failed: r() >= c.confidence }));
    }
    for (const strategy of ALL_STRATEGIES) {
      const stats = simulateRouting({
        ...base, contacts, planningContacts: base.contacts, strategy, seed: graphSeed,
      });
      byStrategy[strategy].push(stats);
      if (DETERMINISTIC.has(scenario) && rep > 0 && JSON.stringify(stats) !== JSON.stringify(byStrategy[strategy][0])) {
        deterministicMismatch = deterministicMismatch ?? strategy;
      }
    }
  }
  if (deterministicMismatch) throw new Error(`escenario determinista no reproducible: ${scenario}/${deterministicMismatch}`);
  const summarize = (runs) => {
    const delivered = runs.filter((r) => r.delivered);
    return {
      trials: runs.length,
      deliveryRate: delivered.length / runs.length,
      latencyMean: mean(delivered.map((r) => r.latencyS)),
      latencyP50: pct(delivered.map((r) => r.latencyS), 0.5),
      latencyP95: pct(delivered.map((r) => r.latencyS), 0.95),
      transmissionsPerDelivery: mean(delivered.map((r) => r.transmissionsPerDelivery)),
      energyPerDelivery: mean(delivered.map((r) => r.energyProxy)),
      bytesPerDelivery: mean(delivered.map((r) => r.bytesOnAir)),
      hopCount: mean(delivered.map((r) => r.hopCount)),
      transfersMean: mean(runs.map((r) => r.transfers)),
      uniqueTransfersMean: mean(runs.map((r) => r.uniqueTransfers)),
      redundantTransmissionsMean: mean(runs.map((r) => r.redundantTransmissions)),
      overheadRatioMean: mean(runs.map((r) => r.overheadRatio).filter((x) => x !== null)),
      energyProxyMean: mean(runs.map((r) => r.energyProxy)),
      failedContactsMean: mean(runs.map((r) => r.failedContacts)),
      reopenedContactsMean: mean(runs.map((r) => r.reopenedContacts)),
      dropReasons: runs.reduce((acc, r) => {
        for (const [k, v] of Object.entries(r.dropReasons)) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
    };
  };
  const perStrategy = Object.fromEntries(ALL_STRATEGIES.map((s) => [s, summarize(byStrategy[s])]));
  if (scenario === 'unreliable-contacts') {
    const failureRate = base.contacts.map((c) => c.confidence);
    perStrategy.__declared = { contacts: base.contacts.length, meanDeclaredSuccess: round(mean(failureRate)), contactsDeclared: failureRate.map(round) };
    perStrategy.__observed = {
      meanFailedContacts: round(mean(byStrategy[BASELINE].map((r) => r.failedContacts))),
      trials: reps,
    };
  }
  return { scenario, graphSeed, reps, perStrategy };
}

const graphRows = [];
for (const scenario of BENCH_SCENARIO_NAMES) {
  if (!DETERMINISTIC.has(scenario) && !STOCHASTIC.has(scenario)) throw new Error(`escenario sin clasificar: ${scenario}`);
  const nGraphs = DETERMINISTIC.has(scenario) ? 1 : graphs;
  const reps = DETERMINISTIC.has(scenario) ? repeats : scenario === 'unreliable-contacts' ? realizations : 1;
  for (let g = 0; g < nGraphs; g++) graphRows.push(perGraphGraphStats(scenario, seedBase + g * 104729, reps));
}

const results = [];
for (const scenario of BENCH_SCENARIO_NAMES) {
  const rows = graphRows.filter((r) => r.scenario === scenario);
  const first = buildScenario(scenario, { seed: seedBase });
  for (const strategy of ALL_STRATEGIES) {
    const gs = rows.map((r) => r.perStrategy[strategy]);
    const deliveredGraphRate = gs.map((g) => g.deliveryRate);
    const latencies = gs.flatMap((g) => (g.latencyMean === null ? [] : [g.latencyMean]));
    const tpd = gs.flatMap((g) => (g.transmissionsPerDelivery === null ? [] : [g.transmissionsPerDelivery]));
    const energy = gs.flatMap((g) => (g.energyPerDelivery === null ? [] : [g.energyPerDelivery]));
    const bytes = gs.flatMap((g) => (g.bytesPerDelivery === null ? [] : [g.bytesPerDelivery]));
    const hops = gs.flatMap((g) => (g.hopCount === null ? [] : [g.hopCount]));
    results.push({
      scenario, strategy,
      independentGraphs: rows.length,
      realizationsPerGraph: rows.length ? rows[0].reps : 0,
      trials: gs.reduce((a, g) => a + g.trials, 0),
      deterministicScenario: DETERMINISTIC.has(scenario),
      clusterBootstrap: {
        method: 'percentile over independent graphs',
        B: bootstrapB,
        seed: bootstrapSeed,
        nominalCoverage: 0.95,
        caveat: scenario === 'unreliable-contacts'
          ? 'Las realizaciones de fallos dentro de un grafo no son independientes; el IC remuestrea grafos.'
          : 'El IC remuestrea casos independientes; no corrige comparaciones múltiples.',
      },
      deliveryRate: {
        mean: round(mean(deliveredGraphRate)),
        ci95: bootstrapMeanCI(deliveredGraphRate),
        graphsDelivered: deliveredGraphRate.filter((x) => x > 0).length,
      },
      latencyS: {
        mean: round(mean(latencies)),
        p50: round(pct(latencies, 0.5)),
        p95: round(pct(latencies, 0.95)),
        ci95OfGraphMeans: bootstrapMeanCI(latencies, bootstrapB, bootstrapSeed + 1),
        conditionalOnDelivery: true,
      },
      transmissionsPerDelivery: {
        mean: round(mean(tpd)),
        ci95OfGraphMeans: bootstrapMeanCI(tpd, bootstrapB, bootstrapSeed + 2),
        conditionalOnDelivery: true,
      },
      energyPerDelivery: {
        mean: round(mean(energy)),
        ci95OfGraphMeans: bootstrapMeanCI(energy, bootstrapB, bootstrapSeed + 3),
        unit: 'unidades del catálogo de canales (proxy, NO julios)',
        conditionalOnDelivery: true,
      },
      bytesPerDelivery: {
        mean: round(mean(bytes)),
        ci95OfGraphMeans: bootstrapMeanCI(bytes, bootstrapB, bootstrapSeed + 4),
        conditionalOnDelivery: true,
      },
      hopCount: { mean: round(mean(hops)), conditionalOnDelivery: true },
      transfersMean: round(mean(gs.map((g) => g.transfersMean))),
      uniqueTransfersMean: round(mean(gs.map((g) => g.uniqueTransfersMean))),
      redundantTransmissionsMean: round(mean(gs.map((g) => g.redundantTransmissionsMean))),
      overheadRatioMeanLegacy: round(mean(gs.map((g) => g.overheadRatioMean).filter((x) => x !== null))),
      energyProxyMean: round(mean(gs.map((g) => g.energyProxyMean))),
      failedContactsMean: round(mean(gs.map((g) => g.failedContactsMean))),
      reopenedContactsMean: round(mean(gs.map((g) => g.reopenedContactsMean))),
      dropReasons: gs.reduce((acc, g) => {
        for (const [k, v] of Object.entries(g.dropReasons)) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
      notes: {
        scenario: first.note ?? SCENARIO_NOTES[scenario],
        deterministicScenario: DETERMINISTIC.has(scenario),
        legacyOverheadRatio: 'transfers/uniqueTransfers; se conserva solo para comparar con la evidencia v1',
      },
    });
  }
}

const pairedDeltas = [];
for (const scenario of BENCH_SCENARIO_NAMES) {
  const rows = graphRows.filter((r) => r.scenario === scenario);
  for (const strategy of ALL_STRATEGIES.filter((s) => s !== BASELINE)) {
    const deltas = (metric) => rows.flatMap((r) => {
      const a = r.perStrategy[strategy], b = r.perStrategy[BASELINE];
      const x = metric(a), y = metric(b);
      return x === null || y === null ? [] : [x - y];
    });
    const dDelivery = rows.map((r) => r.perStrategy[strategy].deliveryRate - r.perStrategy[BASELINE].deliveryRate);
    const dLatency = deltas((g) => g.latencyMean);
    const dTpd = deltas((g) => g.transmissionsPerDelivery);
    const dEnergy = deltas((g) => g.energyPerDelivery);
    pairedDeltas.push({
      scenario, strategy, baseline: BASELINE,
      independentGraphs: rows.length,
      deliveryRateDelta: { mean: round(mean(dDelivery)), ci95: pairedBootstrapCI(dDelivery, bootstrapB, bootstrapSeed + 10) },
      latencySDelta: { mean: round(mean(dLatency)), ci95: pairedBootstrapCI(dLatency, bootstrapB, bootstrapSeed + 11), conditionalOnBothDelivered: true },
      transmissionsPerDeliveryDelta: { mean: round(mean(dTpd)), ci95: pairedBootstrapCI(dTpd, bootstrapB, bootstrapSeed + 12), conditionalOnBothDelivered: true },
      energyPerDeliveryDelta: { mean: round(mean(dEnergy)), ci95: pairedBootstrapCI(dEnergy, bootstrapB, bootstrapSeed + 13), conditionalOnBothDelivered: true, unit: 'proxy del catálogo' },
      exploratory: true,
      multiplicity: 'sin corrección; IC nominales del 95 %',
    });
  }
}

const manifest = buildManifest(repo);
const sourceModule = resolve(here, '../src/opportunistic-routing.mjs');
const sourceScript = fileURLToPath(import.meta.url);
const evidence = {
  schema: 'senda.routing-benchmark/2',
  status: 'SIMULATED_BENCHMARK',
  physicalValidation: 'PHYSICAL_TEST_PENDING',
  notFieldValidation: true,
  generatedAt: new Date().toISOString(),
  source: {
    script: 'packages/senda/scripts/routing-benchmark-v2.mjs',
    scriptSha256: hashFile(sourceScript),
    module: 'packages/senda/src/opportunistic-routing.mjs',
    moduleSha256: hashFile(sourceModule),
    manifestSchema: manifest.schema,
    manifestClaim: manifest.claim,
    commitAtGeneration: manifest.git.commit,
    gitTree: manifest.git.tree,
    sourceTreeSha256: manifest.source.treeSha256,
    sourceFileCount: manifest.source.fileCount,
    lockfileSha256: manifest.source.lockfileSha256,
    worktreeDirty: manifest.git.dirty,
    dirtyPaths: manifest.git.dirtyPaths,
  },
  parameters: {
    seedBase, independentGraphs: graphs, realizationsPerGraph: realizations,
    deterministicRepeats: repeats, sizeBytes: 512,
    scenarios: BENCH_SCENARIO_NAMES, strategies: ALL_STRATEGIES, baseline: BASELINE,
    bootstrap: { B: bootstrapB, seed: bootstrapSeed, method: 'percentile', nominalCoverage: 0.95 },
    scenarioClass: { deterministic: [...DETERMINISTIC], stochastic: [...STOCHASTIC] },
  },
  scenarios: Object.fromEntries(BENCH_SCENARIO_NAMES.map((name) => {
    const s = buildScenario(name, { seed: seedBase });
    return [name, {
      note: s.note ?? SCENARIO_NOTES[name],
      deterministic: DETERMINISTIC.has(name),
      contacts: s.contacts.length,
      declaredSuccessMean: round(mean(s.contacts.map((c) => c.confidence))),
      source: s.source, dest: s.dest, t0: s.t0, tEnd: s.tEnd, sizeBytes: s.sizeBytes,
    }];
  })),
  results,
  pairedDeltas,
  limitations: [
    'Contactos y ventanas son sintéticos y sembrados; no provienen de radio real ni de trazas de movilidad.',
    'No hay Android, BLE, Wi-Fi Direct, LoRa ni Nearby; PHYSICAL_TEST_PENDING.',
    'La energía es un proxy del catálogo de canales (unidades adimensionales), no una medida en julios.',
    'No se modelan colas, contención, pérdida por SNR ni consumo en reposo.',
    'Los escenarios deterministas se repiten para verificar reproducibilidad, pero aportan UN caso independiente; no se cuentan como réplicas.',
    'En unreliable-contacts las realizaciones de fallos comparten grafo; el IC remuestrea grafos, no realizaciones.',
    'Los deltas pareados son exploratorios y no llevan corrección por comparaciones múltiples.',
    'El benchmark no certifica el sistema ni demuestra comportamiento en una emergencia real.',
    'El árbol puede estar sucio: manifestClaim=UNCOMMITTED_BUILD no es una release verificada.',
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
const summary = results.map((r) => ({
  scenario: r.scenario, strategy: r.strategy,
  deliveryRate: r.deliveryRate.mean, deliveryCI: r.deliveryRate.ci95,
  latencyMean: r.latencyS.mean, tpd: r.transmissionsPerDelivery.mean, energyPerDelivery: r.energyPerDelivery.mean,
}));
console.log(JSON.stringify({ out: outPath, status: evidence.status, manifestClaim: evidence.source.manifestClaim, summary }, null, 2));
