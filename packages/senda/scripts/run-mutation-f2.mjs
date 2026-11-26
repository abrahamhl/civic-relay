#!/usr/bin/env node
/**
 * SENDA · F2 Pruebas de mutación con Stryker (@stryker-mutator/core) en los 5 módulos críticos.
 * Ejecuta Stryker por módulo con su subconjunto exacto de pruebas (propiedades + unitarias),
 * evitando sobrecarga cruzada de otros módulos, agrega los 5 informes oficiales de Stryker
 * y sella `evidence/quality/mutation-report.json` con huella SHA-256.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = resolve(ROOT, 'evidence/quality');
mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  {
    name: 'erasure.mjs',
    file: 'packages/senda/src/erasure.mjs',
    cmd: 'node --test --test-name-pattern="\\[erasure\\]" packages/senda/tests/properties-critical.test.mjs',
  },
  {
    name: 'heading-fusion.mjs',
    file: 'packages/senda/src/heading-fusion.mjs',
    cmd: 'node --test --test-name-pattern="heading-fusion|matriz W3C|brújula|móvil vertical|fusión|autocalibración|suavizado" packages/senda/tests/properties-critical.test.mjs packages/senda/tests/heading-fusion.test.mjs',
  },
  {
    name: 'rail-reconstruct.mjs',
    file: 'packages/senda/src/rail-reconstruct.mjs',
    cmd: 'node --test --test-name-pattern="rail-reconstruct|integración exacta|distancia de parada|Adamuz" packages/senda/tests/properties-critical.test.mjs packages/senda/tests/rail-reconstruct.test.mjs',
  },
  {
    name: 'mmwave-radar.mjs',
    file: 'packages/senda/src/mmwave-radar.mjs',
    cmd: 'node --test --test-name-pattern="mmwave-radar|convención de signo|lector de flujo|limpieza|seguimiento|proyección|rumbo de la marcha" packages/senda/tests/properties-critical.test.mjs packages/senda/tests/mmwave-radar.test.mjs',
  },
  {
    name: 'shallow-water.mjs',
    file: 'packages/senda/src/shallow-water.mjs',
    cmd: 'node --test --test-name-pattern="\\[shallow-water\\]" packages/senda/tests/properties-critical.test.mjs',
  },
];

const modules = [];
let totalKilled = 0;
let totalTimeout = 0;
let totalSurvived = 0;
let totalNoCov = 0;
let totalRuntimeErr = 0;

for (const t of TARGETS) {
  const tmpCfg = resolve(ROOT, `.stryker-tmp-${t.name}.json`);
  const tmpOut = resolve(OUT_DIR, `stryker-${t.name}.json`);
  const cfg = {
    testRunner: 'command',
    commandRunner: { command: t.cmd },
    mutate: [t.file],
    disableTypeChecks: false,
    ignorePatterns: [
      'apps/**',
      'investor-next/**',
      '!investor-next/public/senda/data/adamuz2026/**',
      'docs/**',
      'evidence/**',
      'experimental/**',
      'hardware/**',
      'scripts/**',
      'packages/api/**',
      'packages/core/**',
      'packages/schemas/**',
      'packages/transports/**',
      'packages/senda-pci/**',
      'packages/senda-relay/**',
      'packages/senda-vision/**',
      'packages/senda/data/**',
      'packages/senda/calibration/**',
    ],
    coverageAnalysis: 'off',
    concurrency: 6,
    timeoutMS: 10000,
    reporters: ['json'],
    jsonReporter: { fileName: tmpOut },
    thresholds: { high: 85, low: 80, break: null },
    tempDirName: `.stryker-tmp-${t.name.replace('.mjs', '')}`,
    cleanTempDir: true,
  };
  writeFileSync(tmpCfg, JSON.stringify(cfg, null, 2));
  const t0 = Date.now();
  try {
    execFileSync(resolve(ROOT, 'node_modules/.bin/stryker'), ['run', tmpCfg], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } finally {
    rmSync(tmpCfg, { force: true });
    rmSync(resolve(ROOT, cfg.tempDirName), { recursive: true, force: true });
  }
  const raw = JSON.parse(readFileSync(tmpOut, 'utf8'));
  const fileReport = raw.files[t.file] ?? Object.values(raw.files)[0];
  const mutants = fileReport?.mutants ?? [];
  let killed = 0, timeout = 0, survived = 0, noCov = 0, runtimeErr = 0, ignored = 0;
  const survivedList = [];
  for (const m of mutants) {
    if (m.status === 'Killed') killed++;
    else if (m.status === 'Timeout') timeout++;
    else if (m.status === 'Survived') {
      survived++;
      survivedList.push({
        id: m.id,
        mutatorName: m.mutatorName,
        line: m.location?.start?.line ?? null,
        replacement: String(m.replacement ?? '').slice(0, 60),
      });
    } else if (m.status === 'NoCoverage') noCov++;
    else if (m.status === 'RuntimeError') runtimeErr++;
    else ignored++;
  }
  const detected = killed + timeout;
  const valid = detected + survived + noCov;
  const scorePct = valid > 0 ? +((detected / valid) * 100).toFixed(2) : 0;
  totalKilled += killed;
  totalTimeout += timeout;
  totalSurvived += survived;
  totalNoCov += noCov;
  totalRuntimeErr += runtimeErr;

  const entry = {
    module: t.file,
    durationSec: +((Date.now() - t0) / 1000).toFixed(1),
    totalMutants: valid,
    killed,
    timeout,
    survived,
    noCoverage: noCov,
    runtimeError: runtimeErr,
    ignored,
    mutationScorePct: scorePct,
    survivedSample: survivedList.slice(0, 25),
  };
  modules.push(entry);
  console.log(`  ${t.name.padEnd(22)} score=${scorePct.toFixed(2)}% (killed=${killed} timeout=${timeout} survived=${survived} noCov=${noCov}) [${entry.durationSec}s]`);
  rmSync(tmpOut, { force: true });
}

const totalDetected = totalKilled + totalTimeout;
const totalValid = totalDetected + totalSurvived + totalNoCov;
const overallScorePct = totalValid > 0 ? +((totalDetected / totalValid) * 100).toFixed(2) : 0;

let gitSha = null;
try { gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* */ }

const reportBody = {
  schema: 'senda.mutation-report/v1',
  tool: '@stryker-mutator/core',
  basis: 'MEASURED',
  generatedAtUtc: new Date().toISOString(),
  gitSha,
  nodeVersion: process.version,
  thresholdPct: 80,
  overall: {
    totalMutants: totalValid,
    killed: totalKilled,
    timeout: totalTimeout,
    survived: totalSurvived,
    noCoverage: totalNoCov,
    runtimeError: totalRuntimeErr,
    mutationScorePct: overallScorePct,
    pass: overallScorePct >= 80,
  },
  modules,
};

const sha256 = createHash('sha256').update(JSON.stringify(reportBody)).digest('hex');
const finalReport = { ...reportBody, sha256 };
const outPath = resolve(OUT_DIR, 'mutation-report.json');
writeFileSync(outPath, JSON.stringify(finalReport, null, 2) + '\n');
console.log(`\nGLOBAL STRYKER SCORE: ${overallScorePct.toFixed(2)}% (${totalDetected}/${totalValid}) · SHA-256: ${sha256}`);
console.log(`Informe: evidence/quality/mutation-report.json`);
if (overallScorePct < 80) {
  console.error(`FALLO: puntuación de mutación ${overallScorePct}% < 80%`);
  process.exit(1);
}
