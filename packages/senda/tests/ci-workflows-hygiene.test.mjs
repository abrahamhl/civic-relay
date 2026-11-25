import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WF_DIR = resolve(ROOT, '.github/workflows');

/**
 * Extrae los jobs de primer nivel bajo `jobs:` en un workflow YAML de GitHub Actions
 * y verifica que cada job declara explícitamente `timeout-minutes` numérico > 0.
 */
function parseWorkflowJobs(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const jobs = new Map();
  let inJobs = false;
  let currentJob = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (/^\s*$/.test(line)) continue;
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      currentJob = null;
      continue;
    }
    if (inJobs && /^[A-Za-z0-9_-]+:\s*/.test(line)) {
      inJobs = false;
      currentJob = null;
      continue;
    }
    if (!inJobs) continue;

    const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobs.set(currentJob, { timeoutMinutes: null });
      continue;
    }
    if (currentJob) {
      const tmMatch = line.match(/^    timeout-minutes:\s*(\d+)\s*$/);
      if (tmMatch) {
        jobs.get(currentJob).timeoutMinutes = Number(tmMatch[1]);
      }
    }
  }
  return jobs;
}

test('F1 CI: todos los jobs de .github/workflows/*.yml declaran timeout-minutes > 0', () => {
  const files = readdirSync(WF_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
  assert.ok(files.length >= 20, `se esperaban ≥20 workflows, encontrados ${files.length}`);

  const missing = [];
  let totalJobs = 0;

  for (const file of files) {
    const text = readFileSync(resolve(WF_DIR, file), 'utf8');
    const jobs = parseWorkflowJobs(text);
    assert.ok(jobs.size >= 1, `${file} debe contener al menos un job`);
    for (const [jobName, meta] of jobs.entries()) {
      totalJobs += 1;
      if (!(meta.timeoutMinutes > 0 && meta.timeoutMinutes <= 60)) {
        missing.push(`${file}::${jobName}`);
      }
    }
  }

  assert.deepEqual(missing, [], `jobs sin timeout-minutes válido (1..60): ${missing.join(', ')}`);
  assert.ok(totalJobs >= 25, `totalJobs=${totalJobs}`);
});

test('F1 CI: ci.yml mantiene presupuesto <= 10 min, matriz Node 22 y 24 y caché pnpm', () => {
  const ciText = readFileSync(resolve(WF_DIR, 'ci.yml'), 'utf8');
  const jobs = parseWorkflowJobs(ciText);
  const build = jobs.get('build');
  assert.ok(build, 'ci.yml debe definir job build');
  assert.ok(build.timeoutMinutes <= 10, `ci.yml build timeout debe ser <= 10 min (es ${build.timeoutMinutes})`);
  assert.match(ciText, /22\.x/);
  assert.match(ciText, /24\.x/);
  assert.match(ciText, /cache:\s*['"]?pnpm['"]?/);
});
