import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrate } from '../scripts/crash-calibrate.mjs';
import { syntheticTrace, SYNTHETIC_KINDS, detectCrashEvent, EXAMPLE_DETECTION_CONFIG } from '../src/roadsafe-crash-detect.mjs';

// Trazas SINTÉTICAS: verifican el ARNÉS de calibración, no estiman la precisión real (eso exige VZCrash u otro dataset etiquetado).
const set = () => SYNTHETIC_KINDS.flatMap((kind) => [8, 10, 12, 14].map((t0, i) => ({ ...syntheticTrace(kind, { t0 }), kind, synthetic: true, split: i < 3 ? 'train' : 'test' })));

test('calibración · ajusta LR en train, evalúa en test, mantiene la previa declarada y avisa de licencia NC', () => {
  const r = calibrate(set(), EXAMPLE_DETECTION_CONFIG, { dataset: 'SINTETICO', license: 'CC BY-NC 4.0' });
  assert.equal(r.priorOddsUsed, EXAMPLE_DETECTION_CONFIG.priorOdds, 'la previa no se ajusta con la proporción del dataset');
  assert.ok(r.lr.speedDrop.lr > 1, `la caída de velocidad debe favorecer el choque: ${JSON.stringify(r.lr.speedDrop)}`);
  assert.ok(r.test.calibrated.sensitivity.ci && r.test.calibrated.specificity.ci, 'métricas con intervalo de Wilson');
  assert.match(r.licenseWarning, /no comercial|NO comercial/);
  assert.match(r.config.basis, /CALIBRATED_LR · SINTETICO/);
});

test('calibración · sin separar train/test o sin declarar dataset y licencia no se calibra', () => {
  assert.throws(() => calibrate(set().map((t) => ({ ...t, split: 'train' })), EXAMPLE_DETECTION_CONFIG, { dataset: 'x', license: 'y' }), /train y de test/);
  assert.throws(() => calibrate(set(), EXAMPLE_DETECTION_CONFIG, { dataset: 'x' }), /debe(n)? declararse/);
});

test('detector · el giro tras el impacto (trompo, caso real doc 18) se mide con el giroscopio; sin LR declarada no suma', () => {
  const base = syntheticTrace('CRASH_REAR_END');
  const gyro = (dps) => Array.from({ length: 300 }, (_, i) => ({ t: 10 + i * 0.01, x: 0, y: 0, z: dps }));
  const spun = detectCrashEvent({ ...base, gyro: gyro(120) }, EXAMPLE_DETECTION_CONFIG), still = detectCrashEvent({ ...base, gyro: gyro(5) }, EXAMPLE_DETECTION_CONFIG);
  assert.equal(spun.evidence.spinAfter, true); assert.equal(still.evidence.spinAfter, false);
  assert.ok(!spun.used.some((u) => u.evidence === 'spinAfter'), 'LR del giro sin calibrar: no se usa en el posterior');
  assert.ok(spun.why.some((w) => /spinAfter/.test(w)));
});
