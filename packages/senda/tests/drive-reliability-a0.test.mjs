import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPORT_PATH = resolve(ROOT, 'evidence/drive-reliability/2026-11-27.json');

test('A0 · informe E2E de fiabilidad de conducción sellado con SHA-256 y 100 % casos aprobados', () => {
  const raw = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
  const { sha256, ...body } = raw;
  const expectedSha = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.equal(sha256, expectedSha, 'SHA-256 del informe A0 íntegro');
  assert.equal(raw.schema, 'senda-drive-reliability/v1');
  assert.equal(raw.summary.failedCases, 0);
  assert.equal(raw.summary.allPassed, true);
  assert.ok(raw.summary.totalCases >= 12);

  const byId = new Map(raw.cases.map((c) => [c.id, c]));
  for (const id of [
    'PIXEL7_PORTRAIT_1X_FULL',
    'TABLET_LANDSCAPE_4X_FULL',
    'SPEED_30KMH_1X', 'SPEED_30KMH_4X',
    'SPEED_50KMH_1X', 'SPEED_50KMH_4X',
    'SPEED_90KMH_1X', 'SPEED_90KMH_4X',
    'SPEED_120KMH_1X', 'SPEED_120KMH_4X',
    'CRASH_SYNTHETIC_MATRIX',
    'SOAK_2H_7200S_MEMORY',
  ]) {
    const c = byId.get(id);
    assert.ok(c, `caso obligatorio presente: ${id}`);
    assert.equal(c.passed, true, `caso aprobado: ${id}`);
  }

  const p7 = byId.get('PIXEL7_PORTRAIT_1X_FULL');
  assert.ok(p7.metrics.minEaseIntervalMs >= 800, 'ningún easeTo en menos de 800 ms');
  assert.equal(p7.metrics.duplicateNavAnnouncements, 0, 'voz sin repeticiones');
  assert.equal(p7.metrics.rotationOk, true, 'giro de pantalla 412×915 ↔ 915×412 aprobado');
  assert.equal(p7.metrics.offlineOk, true, 'corte de red a mitad de ruta aprobado');
  assert.equal(p7.metrics.reroutedOk, true, 'recálculo fuera de ruta aprobado');
  assert.equal(p7.metrics.tunnelOk, true, 'túnel de 60 s sin GPS aprobado');

  const crash = byId.get('CRASH_SYNTHETIC_MATRIX');
  assert.equal(crash.metrics.falsePositivesOnNonCrash, 0, '0 falsas alarmas en baches, frenazos y caídas');

  const soak = byId.get('SOAK_2H_7200S_MEMORY');
  assert.equal(soak.metrics.simulatedDurationS, 7200);
  assert.ok(Math.abs(soak.metrics.heapDriftPct) <= 10.0, `heap estable ±10 % (medido ${soak.metrics.heapDriftPct} %)`);
});
