#!/usr/bin/env node
/**
 * Benchmark reproducible de estrategias de enrutado oportunista sobre grafos de
 * contactos sintéticos. No sustituye una prueba de campo ni mide radios reales.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScenario, runBenchmark, SCENARIO_NAMES, SCENARIO_NOTES, STRATEGIES, simulateRouting } from '../src/opportunistic-routing.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const args = process.argv.slice(2);
const seeds = Number(args.find((a) => a.startsWith('--seeds='))?.split('=')[1] ?? 20);
const seedBase = Number(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 20261107);
const outPath = resolve(repo, args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'evidence/senda/routing-benchmark-2026-11-07.json');

const pct = (values, q) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round = (n) => (n === null || n === undefined || !Number.isFinite(n) ? n : Math.round(n * 1000) / 1000);
const git = (a) => { try { return execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

const rows = runBenchmark({ seeds, seedBase });
const results = rows.map(({ scenario, strategy, runs }) => {
  const delivered = runs.filter((r) => r.delivered);
  const latency = delivered.map((r) => r.latencyS);
  const dropReasons = runs.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r.dropReasons)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const first = buildScenario(scenario, { seed: seedBase });
  const repeat = simulateRouting({ ...first, strategy, sizeBytes: first.sizeBytes, seed: seedBase });
  const deterministic = repeat.delivered === runs[0].delivered && repeat.latencyS === runs[0].latencyS && repeat.transfers === runs[0].transfers;
  return {
    scenario, strategy, runs: runs.length,
    delivered: delivered.length, deliveryRate: round(delivered.length / runs.length),
    latencyS: { p50: pct(latency, 0.5), p95: pct(latency, 0.95), mean: round(mean(latency)), min: latency.length ? Math.min(...latency) : null, max: latency.length ? Math.max(...latency) : null },
    transfers: { mean: round(mean(runs.map((r) => r.transfers))), p95: pct(runs.map((r) => r.transfers), 0.95) },
    uniqueTransfers: { mean: round(mean(runs.map((r) => r.uniqueTransfers))) },
    overheadRatio: { mean: round(mean(runs.map((r) => r.overheadRatio).filter((x) => x !== null))) },
    hopCount: { mean: round(mean(delivered.map((r) => r.hopCount))) },
    bytesOnAir: { mean: round(mean(runs.map((r) => r.bytesOnAir))) },
    energyProxy: { mean: round(mean(runs.map((r) => r.energyProxy))), unit: 'unidades de energía del catálogo (NO julios)' },
    dropReasons, deterministic,
  };
});

const summary = results.map((r) => ({ scenario: r.scenario, strategy: r.strategy, deliveryRate: r.deliveryRate, p50LatencyS: r.latencyS.p50, overheadRatio: r.overheadRatio.mean, energyProxy: r.energyProxy.mean, hops: r.hopCount.mean }));
const evidence = {
  schema: 'senda-routing-benchmark/1',
  status: 'SIMULATED_BENCHMARK',
  physicalValidation: 'PHYSICAL_TEST_PENDING',
  notFieldValidation: true,
  generatedAt: new Date().toISOString(),
  source: {
    script: 'packages/senda/scripts/routing-benchmark.mjs',
    module: 'packages/senda/src/opportunistic-routing.mjs',
    commitAtGeneration: git(['rev-parse', 'HEAD']),
    worktreeDirty: Boolean(git(['status', '--porcelain'])),
  },
  parameters: { seeds, seedBase, sizeBytesDefault: 512, scenarios: SCENARIO_NAMES, strategies: STRATEGIES },
  scenarios: Object.fromEntries(SCENARIO_NAMES.map((name) => {
    const s = buildScenario(name, { seed: seedBase });
    return [name, { note: s.note ?? SCENARIO_NOTES[name], contacts: s.contacts.length, source: s.source, dest: s.dest, t0: s.t0, tEnd: s.tEnd, sizeBytes: s.sizeBytes }];
  })),
  strategyNotes: {
    direct: 'Solo fuente→destino; no hay relés.',
    flooding: 'Cada portador intenta enviar en cada contacto; no deduplica antes de transmitir.',
    epidemic: 'Inunda solo a nodos que aún no tienen el mensaje.',
    spray: 'Spray-and-wait con 16 copias; reparte la mitad y con 1 copia solo entrega al destino.',
    earliest: 'Ruta de llegada más temprana calculada una vez (tipo CGR); sin replanificación.',
    adaptive: 'Enrutado por grafo de contactos con replanificación, tope de 12 portadores y política de energía que evita relés con coste ≥3.',
  },
  results,
  summary,
  limitations: [
    'Contactos y ventanas son sintéticos y sembrados; no provienen de radio real.',
    'No hay Android, BLE, Wi-Fi Direct, LoRa ni Nearby; PHYSICAL_TEST_PENDING.',
    'La energía es un proxy del catálogo de canales, no una medición en julios.',
    'No se modelan colas, contención, pérdida de paquetes por SNR ni consumo en reposo.',
    'El benchmark no certifica el sistema ni demuestra comportamiento en una emergencia real.',
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ out: outPath, status: evidence.status, summary }, null, 2));
