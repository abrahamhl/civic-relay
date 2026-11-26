#!/usr/bin/env node
/**
 * SENDA · F2 Cobertura V8 con c8 sobre `packages/senda/src/*.mjs` (superficie civil).
 * Genera `evidence/quality/coverage-report.json` con resumen global, desglose por módulo
 * de cálculo y huella SHA-256, comprobando ≥ 90 % de líneas en los módulos de cálculo críticos.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = resolve(ROOT, 'evidence/quality');
mkdirSync(OUT_DIR, { recursive: true });

const TMP_COV = join(tmpdir(), `senda-c8-${Date.now()}`);
const TEST_DIR = resolve(ROOT, 'packages/senda/tests');
const testFiles = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => resolve(TEST_DIR, f));

const CRITICAL_CALC_MODULES = [
  'packages/senda/src/erasure.mjs',
  'packages/senda/src/heading-fusion.mjs',
  'packages/senda/src/mmwave-radar.mjs',
  'packages/senda/src/shallow-water.mjs',
  'packages/senda/src/rail-reconstruct.mjs',
  'packages/senda/src/shallow-water-fv.mjs',
  'packages/senda/src/fire-rothermel.mjs',
  'packages/senda/src/rail-physics-etcs.mjs',
  'packages/senda/src/flood-science.mjs',
  'packages/senda/src/flood-warning.mjs',
  'packages/senda/src/hydro-estimates.mjs',
  'packages/senda/src/drive-copilot-physics.mjs',
  'packages/senda/src/drive-community-calibration.mjs',
  'packages/senda/src/citizen-report.mjs',
  'packages/senda/src/report-forensics.mjs',
];

const t0 = Date.now();
try {
  execFileSync(
    resolve(ROOT, 'node_modules/.bin/c8'),
    [
      '--all',
      '--include=packages/senda/src/*.mjs',
      '--exclude=packages/senda/src/defense/**',
      '--reporter=json-summary',
      `--reports-dir=${TMP_COV}`,
      process.execPath,
      '--test',
      ...testFiles,
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }
  );
} finally {
  /* leído a continuación */
}

const raw = JSON.parse(readFileSync(join(TMP_COV, 'coverage-summary.json'), 'utf8'));
rmSync(TMP_COV, { recursive: true, force: true });

const byFile = {};
for (const [absPath, metrics] of Object.entries(raw)) {
  if (absPath === 'total') continue;
  const rel = relative(ROOT, absPath).replace(/\\/g, '/');
  byFile[rel] = {
    linesPct: metrics.lines.pct,
    linesCovered: metrics.lines.covered,
    linesTotal: metrics.lines.total,
    branchesPct: metrics.branches.pct,
    functionsPct: metrics.functions.pct,
  };
}

let calcCovered = 0;
let calcTotal = 0;
const criticalModules = CRITICAL_CALC_MODULES.map((mod) => {
  const m = byFile[mod] ?? { linesPct: 0, linesCovered: 0, linesTotal: 0, branchesPct: 0, functionsPct: 0 };
  calcCovered += m.linesCovered;
  calcTotal += m.linesTotal;
  return { module: mod, ...m };
});
const criticalLinesPct = calcTotal > 0 ? +((calcCovered / calcTotal) * 100).toFixed(2) : 0;

let gitSha = null;
try { gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* */ }

const reportBody = {
  schema: 'senda.coverage-report/v1',
  tool: 'c8 (V8 coverage)',
  basis: 'MEASURED',
  generatedAtUtc: new Date().toISOString(),
  durationSec: +((Date.now() - t0) / 1000).toFixed(1),
  gitSha,
  nodeVersion: process.version,
  thresholdCriticalLinesPct: 90,
  totalCivilCore: {
    files: Object.keys(byFile).length,
    linesPct: raw.total.lines.pct,
    linesCovered: raw.total.lines.covered,
    linesTotal: raw.total.lines.total,
    branchesPct: raw.total.branches.pct,
    functionsPct: raw.total.functions.pct,
  },
  criticalCalculationModules: {
    count: criticalModules.length,
    linesPct: criticalLinesPct,
    linesCovered: calcCovered,
    linesTotal: calcTotal,
    pass: criticalLinesPct >= 90,
    modules: criticalModules,
  },
};

const sha256 = createHash('sha256').update(JSON.stringify(reportBody)).digest('hex');
const finalReport = { ...reportBody, sha256 };
const outPath = resolve(OUT_DIR, 'coverage-report.json');
writeFileSync(outPath, JSON.stringify(finalReport, null, 2) + '\n');

console.log(`C8 COBERTURA NÚCLEO CIVIL (${reportBody.totalCivilCore.files} módulos): líneas ${raw.total.lines.pct}% · ramas ${raw.total.branches.pct}% · funciones ${raw.total.functions.pct}% [${reportBody.durationSec}s]`);
console.log(`MÓDULOS DE CÁLCULO CRÍTICOS (${criticalModules.length}): líneas ${criticalLinesPct}% (${calcCovered}/${calcTotal})`);
for (const cm of criticalModules) {
  console.log(`  ${cm.module.padEnd(46)} lines=${cm.linesPct}% (${cm.linesCovered}/${cm.linesTotal}) branches=${cm.branchesPct}%`);
}
console.log(`SHA-256: ${sha256}\nInforme: evidence/quality/coverage-report.json`);

if (criticalLinesPct < 90) {
  console.error(`FALLO: cobertura en módulos críticos ${criticalLinesPct}% < 90%`);
  process.exit(1);
}
