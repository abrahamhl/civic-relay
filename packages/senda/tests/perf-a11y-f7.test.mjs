import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('F7 · perf-a11y-report.json sellado con SHA-256 cumple LCP < 2,5 s (4G), JS inicial < 300 KB, 0 violaciones axe WCAG 2.2 AA y reduced-motion', () => {
  const report = JSON.parse(readFileSync(resolve(ROOT, 'evidence/quality/perf-a11y-report.json'), 'utf8'));
  const { sha256, ...body } = report;
  const expectedSha = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.equal(sha256, expectedSha, 'SHA-256 del informe F7 debe coincidir exactamente');
  assert.equal(report.allOk, true, 'Todas las puertas F7 deben estar en PASS');
  assert.equal(report.routes.length, 3);

  for (const r of report.routes) {
    assert.ok(r.perf.lcpMs < 2500, `${r.path}: LCP ${r.perf.lcpMs} ms >= 2500 ms`);
    assert.ok(r.perf.initialJsTransferBytes < 300 * 1024, `${r.path}: JS inicial ${r.perf.initialJsTransferKB} KB >= 300 KB`);
    assert.equal(r.a11y.violationsCount, 0, `${r.path}: ${r.a11y.violationsCount} violaciones axe WCAG AA`);
    assert.equal(r.a11y.reducedMotion.hasReducedMotionRule, true, `${r.path}: falta regla prefers-reduced-motion`);
    assert.equal(r.consoleErrors.length, 0, `${r.path}: errores JS en consola`);
  }
});

test('F7 · lighthouserc.json y flujo CI senda-perf-a11y-ci.yml fijan presupuestos y timeout-minutes', () => {
  const lh = JSON.parse(readFileSync(resolve(ROOT, 'lighthouserc.json'), 'utf8'));
  assert.equal(lh.ci.assert.assertions['largest-contentful-paint'][1].maxNumericValue, 2500);
  assert.equal(lh.ci.assert.assertions['resource-summary:script:size'][1].maxNumericValue, 307200);
  const wf = readFileSync(resolve(ROOT, '.github/workflows/senda-perf-a11y-ci.yml'), 'utf8');
  assert.ok(wf.includes('timeout-minutes: 10'), 'Flujo F7 debe fijar timeout-minutes: 10');
  assert.ok(wf.includes('run-perf-a11y-f7.mjs'), 'Flujo F7 debe ejecutar la auditoría real en Chromium');
});
