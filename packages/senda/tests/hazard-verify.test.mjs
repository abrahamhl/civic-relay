import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyReport, EXPECTS, GROUPS } from '../src/hazard-verify.mjs';
import { REPORT_KINDS } from '../src/road-guard.mjs';

const O = { minScore: 0.5, minFrames: 2 };

test('cada tipo de aviso de SENDA tiene una regla de verificación', () => {
  for (const k of Object.keys(REPORT_KINDS)) assert.ok(k in EXPECTS, k);
});

test('todas las clases usadas existen en el labelmap del modelo incluido', () => {
  const labels = new Set(readFileSync(new URL('../../../investor-next/public/senda/vendor/models/efficientdet_lite0_labelmap.txt', import.meta.url), 'utf8').split('\n').map((s) => s.trim()));
  for (const g of Object.values(GROUPS)) for (const c of g.classes) assert.ok(labels.has(c), c);
});

test('vehículo parado visto en varios fotogramas → compatible, sin compartir imagen', () => {
  const r = verifyReport('parado', [[{ label: 'car', score: 0.8 }], [{ label: 'car', score: 0.7 }, { label: 'person', score: 0.9 }]], O);
  assert.equal(r.verdict, 'COMPATIBLE');
  assert.equal(r.es, 'coche');
  assert.equal(r.sharesImage, false);
});

test('un solo fotograma o baja confianza no basta', () => {
  assert.equal(verifyReport('parado', [[{ label: 'car', score: 0.9 }], []], O).verdict, 'NO_VISTO');
  assert.equal(verifyReport('animal', [[{ label: 'dog', score: 0.3 }], [{ label: 'dog', score: 0.4 }]], O).verdict, 'NO_VISTO');
});

test('animal suelto → compatible con un perro; un accidente solo es «se ve un vehículo»', () => {
  assert.equal(verifyReport('animal', [[{ label: 'dog', score: 0.6 }], [{ label: 'dog', score: 0.7 }]], O).es, 'perro');
  assert.match(verifyReport('accidente', [[{ label: 'truck', score: 0.6 }], [{ label: 'truck', score: 0.6 }]], O).note, /no puede confirmar/);
});

test('piedras, niebla u obras: no verificable con este modelo (no se inventa)', () => {
  assert.equal(verifyReport('obstaculo', [[{ label: 'car', score: 0.9 }], [{ label: 'car', score: 0.9 }]], O).verdict, 'NO_VERIFICABLE');
  assert.equal(verifyReport('niebla', [[]], O).verdict, 'NO_VERIFICABLE');
  assert.equal(verifyReport('obstaculo', [[{ label: 'suitcase', score: 0.7 }], [{ label: 'suitcase', score: 0.8 }]], O).verdict, 'COMPATIBLE');
});

test('sin umbral declarado no funciona', () => {
  assert.throws(() => verifyReport('parado', [[]], {}), /obligatorio/);
  assert.throws(() => verifyReport('parado', [[]], { minScore: 0.5 }), /minFrames/);
});
