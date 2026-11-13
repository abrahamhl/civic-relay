#!/usr/bin/env node
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, '..');
const run = (directory, extra = []) => {
  const files = readdirSync(resolve(root, directory)).filter(f => f.endsWith('.test.mjs')).sort().map(f => resolve(root, directory, f));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files, ...extra], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const count = key => Number(result.stdout?.match(new RegExp(`^# ${key} (\\d+)`, 'm'))?.[1] ?? NaN);
  const evidence = { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), exitCode: result.status };
  if (result.status !== 0 || !Number.isFinite(evidence.tests) || evidence.tests === 0 || evidence.fail !== 0 || evidence.pass !== evidence.tests) {
    process.stderr.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
    throw new Error(`Release verification failed: ${directory}`);
  }
  return evidence;
};
const core = run('packages/senda/tests');
const defense = run('packages/senda/tests/defense');
const relay = run('packages/senda-relay/tests');
const web = run('investor-next/tests');
const provenance = JSON.parse(readFileSync(resolve(project, 'public/release-provenance.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/i.test(provenance.sourceSha)) throw new Error('Missing release source SHA');
let historicalE2E = null;
try { const old = JSON.parse(readFileSync(resolve(root, 'evidence/senda/offline-e2e.json'), 'utf8')); historicalE2E = { passed: old.passed, total: old.total, status: 'HISTORICAL_NOT_RERUN_BY_THIS_BUILD' }; } catch {}
const status = { core: core.pass, coreTotal: core.tests, defense: defense.pass, relay: relay.pass, web: web.pass,
  sha: provenance.sourceSha, generatedAt: new Date().toISOString(), evidenceKind: 'BUILD_EXECUTED_SOFTWARE_TESTS',
  suites: { core, defense, relay, web }, historicalE2E, physicalValidation: 'NOT_PERFORMED', emergencyService: false };
writeFileSync(resolve(project, 'public/senda/estado.json'), JSON.stringify(status, null, 2) + '\n');
const escaped = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
writeFileSync(resolve(project, 'public/senda/estado.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SENDA · Verificación de la versión</title><link rel="icon" href="/senda/icon.svg"><style>body{margin:0;background:#05090c;color:#f2f4f4;font:16px/1.6 system-ui,sans-serif}main{max-width:920px;margin:auto;padding:32px 20px}a{color:#91d7e8}code{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #294050}.links{display:flex;gap:20px;flex-wrap:wrap}.card{padding:20px;background:#0b141c;border:1px solid #294050;border-radius:14px;margin:20px 0}</style></head><body><main><p>SENDA · Verificación de la versión publicada</p><h1>Software comprobado, evidencia trazable</h1><p>Pruebas ejecutadas al construir esta versión el ${escaped(status.generatedAt)}.</p><p>Fuente: <code>${escaped(status.sha)}</code></p><table><thead><tr><th>Suite</th><th>Superadas</th></tr></thead><tbody>${Object.entries(status.suites).map(([name,s])=>`<tr><td>${escaped(name)}</td><td>${s.pass}/${s.tests}</td></tr>`).join('')}</tbody></table><div class="card"><h2>Qué demuestra</h2><p>Algoritmos, formatos, criptografía y regresiones del software de esta versión. Los escenarios y sus cifras predictivas siguen siendo simulaciones cuando así se indica.</p><h2>Qué queda por medir</h2><p>Los enlaces físicos, sensores y prestaciones en campo requieren ensayos independientes. Esta página no acredita certificación ni conexión operativa con el 112.</p><p>Las pruebas offline de navegador conservadas en el repositorio son evidencia histórica: no se han vuelto a ejecutar en esta compilación.</p></div><nav class="links" aria-label="Aplicaciones SENDA"><a href="/senda">Campo</a><a href="/senda/centro">Centro</a><a href="/senda/mensaje">Mensaje</a><a href="/senda/avisos">Avisos</a><a href="/senda/estado.json">Resultados JSON</a><a href="/release-provenance.json">Procedencia</a></nav></main></body></html>\n`);
console.log(`Release ${status.sha}: civil ${core.pass}, defense ${defense.pass}, relay ${relay.pass}, web ${web.pass}`);
