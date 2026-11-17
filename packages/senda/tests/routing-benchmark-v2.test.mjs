import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const script = resolve(repo, 'packages/senda/scripts/routing-benchmark-v2.mjs');

test('benchmark v2: esquema, casos independientes y deltas pareados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'senda-bench-v2-'));
  const out = join(dir, 'ev.json');
  try {
    execFileSync(process.execPath, [script, '--graphs=2', '--realizations=2', '--bootstrap=40', '--repeats=2', `--seed=17`, `--out=${out}`], { cwd: repo, stdio: 'ignore', timeout: 120000 });
    const e = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(e.schema, 'senda.routing-benchmark/2');
    assert.equal(e.status, 'SIMULATED_BENCHMARK');
    assert.equal(e.notFieldValidation, true);
    assert.ok(['UNCOMMITTED_BUILD', 'SOURCE_ONLY', 'ARTIFACT_HASHED'].includes(e.source.manifestClaim));
    assert.match(e.source.scriptSha256, /^[0-9a-f]{64}$/);
    assert.equal(e.results.length, e.parameters.scenarios.length * e.parameters.strategies.length);
    const det = e.results.find((r) => r.scenario === 'scheduled-line' && r.strategy === 'earliest');
    assert.equal(det.independentGraphs, 1);
    assert.equal(det.realizationsPerGraph, 2);
    assert.equal(det.deterministicScenario, true);
    assert.equal(det.deliveryRate.ci95.n, 1);
    const unreliable = e.results.find((r) => r.scenario === 'unreliable-contacts' && r.strategy === 'eaor');
    assert.equal(unreliable.independentGraphs, 2);
    assert.equal(unreliable.trials, 4);
    assert.ok(e.pairedDeltas.some((d) => d.scenario === 'unreliable-contacts' && d.strategy === 'eaor' && d.baseline === 'earliest'));
    assert.ok(e.limitations.some((x) => /no certifica/i.test(x)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
