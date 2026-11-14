#!/usr/bin/env node
// SENDA · prueba pública de un comando. Sin red y sin dependencias.
//   node scripts/prove.mjs          → recalcula con el núcleo cada cifra de la película de inversores
//   node scripts/prove.mjs --full   → además ejecuta toda la batería de pruebas del núcleo
// Escribe evidence/proof/proof-<fecha>.json con el SHA del commit, la versión de Node, el resultado de cada
// afirmación y un SHA-256 del JSON canónico. Sale con código ≠ 0 si alguna afirmación falla.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runClaims } from './film-claims.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

const t0 = Date.now();
console.log('SENDA · prueba pública · recalculando cada cifra de la película con el núcleo real…\n');
const claims = await runClaims();
for (const c of claims) console.log(`${c.ok ? '✔' : '✘'} ${c.scene.padEnd(4)} ${c.id.padEnd(20)} ${c.value}`);

let suite = null;
if (full) {
  const dir = path.join(ROOT, 'packages', 'senda', 'tests'), files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join(dir, f));
  console.log(`\nEjecutando ${files.length} ficheros de pruebas del núcleo…`);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const num = (k) => +(r.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? NaN);
  suite = { files: files.length, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), todo: num('todo'), exitCode: r.status };
  console.log(`  ${suite.pass}/${suite.tests} en verde · ${suite.fail} fallos · ${suite.skipped} omitidas · ${suite.todo} pendientes`);
}

const report = {
  format: 'senda-proof/1',
  gitSha: sh('git', ['rev-parse', 'HEAD']),
  gitDirty: (sh('git', ['status', '--porcelain']) ?? '') !== '',
  node: process.version,
  generatedAt: new Date().toISOString(),
  note: 'Cifras recalculadas con packages/senda/src. Las marcadas SIMULATED en la película proceden de modelos y escenarios sintéticos, no de ensayos de campo.',
  claims: claims.map(({ id, scene, claim, value, ok }) => ({ id, scene, claim, value, ok })),
  suite,
};
report.sha256 = crypto.createHash('sha256').update(canon({ ...report, generatedAt: undefined })).digest('hex');
const outDir = path.join(ROOT, 'evidence', 'proof');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `proof-${report.generatedAt.slice(0, 10)}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');

const bad = claims.filter((c) => !c.ok).length + (suite && suite.fail ? 1 : 0);
console.log(`\n${claims.length - claims.filter((c) => !c.ok).length}/${claims.length} afirmaciones verificadas · commit ${report.gitSha?.slice(0, 7) ?? '¿?'}${report.gitDirty ? ' (con cambios sin commit)' : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Huella SHA-256: ${report.sha256}\nInforme: ${path.relative(ROOT, out)}`);
process.exit(bad ? 1 : 0);
