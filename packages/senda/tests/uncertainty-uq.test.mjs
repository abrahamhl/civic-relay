import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inverseNormalCdf,
  latinHypercubeSample,
  summarizeEnsemble,
  propagateUncertainty,
  sobolSensitivitySaltelli,
  empiricalCrps,
  evaluateForecastSkill,
} from '../src/uncertainty-uq.mjs';

test('Hipercubo Latino (McKay 1979): estratificación marginal exacta 1-por-estrato y determinismo por semilla', () => {
  // Verificación exacta de Acklam Φ⁻¹(p): Φ⁻¹(0.5)=0, Φ⁻¹(0.975)=1.95996398
  assert.ok(Math.abs(inverseNormalCdf(0.5)) < 1e-9);
  assert.ok(Math.abs(inverseNormalCdf(0.975) - 1.9599639845) < 1e-7);

  const N = 40;
  const lhs = latinHypercubeSample({
    dimensions: [
      { name: 'u', dist: 'uniform', min: 0, max: 1 },
      { name: 'g', dist: 'normal', mean: 10, std: 2 },
      { name: 't', dist: 'triangular', min: 1, mode: 3, max: 7 },
      { name: 'l', dist: 'lognormal', muLog: 0, sigmaLog: 0.3 },
    ],
    samples: N,
    seed: 12345,
  });

  assert.equal(lhs.design.length, N);
  // Cada estrato [k/N, (k+1)/N) en la dimensión uniforme debe contener EXACTAMENTE 1 punto
  const seen = new Set(lhs.design.map((pt) => Math.floor(pt.u * N)));
  assert.equal(seen.size, N, 'LHS debe visitar los N estratos exactamente una vez');

  // Reproducibilidad exacta con misma semilla
  const lhs2 = latinHypercubeSample({
    dimensions: [
      { name: 'u', dist: 'uniform', min: 0, max: 1 },
      { name: 'g', dist: 'normal', mean: 10, std: 2 },
      { name: 't', dist: 'triangular', min: 1, mode: 3, max: 7 },
      { name: 'l', dist: 'lognormal', muLog: 0, sigmaLog: 0.3 },
    ],
    samples: N,
    seed: 12345,
  });
  assert.deepEqual(lhs.design, lhs2.design);
});

test('Verificación analítica de Sobol-Saltelli (2010): función de Ishigami (S1, S2, S3 y ST1, ST2, ST3 exactos)', () => {
  // Función de prueba clásica de Ishigami & Homma (1990):
  //   Y = sin(x1) + a·sin²(x2) + b·x3⁴·sin(x1), con x_i ~ U(-π, π), a = 7, b = 0,1
  // Valores analíticos exactos (Saltelli et al. 2010):
  //   S1 ≈ 0.3139, S2 ≈ 0.4424, S3 = 0.0000
  //   ST1 ≈ 0.5576, ST2 ≈ 0.4424, ST3 ≈ 0.2437 (interacción pura x1–x3!)
  const a = 7, b = 0.1;
  const res = sobolSensitivitySaltelli({
    dimensions: [
      { name: 'x1', dist: 'uniform', min: -Math.PI, max: Math.PI },
      { name: 'x2', dist: 'uniform', min: -Math.PI, max: Math.PI },
      { name: 'x3', dist: 'uniform', min: -Math.PI, max: Math.PI },
    ],
    baseSamples: 2048,
    seed: 20261125,
    evaluate: ({ x1, x2, x3 }) => Math.sin(x1) + a * Math.sin(x2) ** 2 + b * (x3 ** 4) * Math.sin(x1),
  });

  const byName = Object.fromEntries(res.indices.map((i) => [i.name, i]));
  assert.ok(Math.abs(byName.x1.S1 - 0.3139) < 0.06, `S1(x1)=${byName.x1.S1}`);
  assert.ok(Math.abs(byName.x2.S1 - 0.4424) < 0.06, `S1(x2)=${byName.x2.S1}`);
  assert.ok(Math.abs(byName.x3.S1 - 0.0000) < 0.05, `S1(x3)=${byName.x3.S1}`);
  assert.ok(Math.abs(byName.x1.ST - 0.5576) < 0.06, `ST(x1)=${byName.x1.ST}`);
  assert.ok(Math.abs(byName.x2.ST - 0.4424) < 0.06, `ST(x2)=${byName.x2.ST}`);
  assert.ok(Math.abs(byName.x3.ST - 0.2437) < 0.06, `ST(x3)=${byName.x3.ST}`);
  assert.ok(byName.x3.interaction > 0.15, 'x3 tiene efecto nulo aislado (S3≈0) pero interacción fuerte con x1 (ST3≈0.24)');
});

test('Propagación de horquillas + evaluación probabilista (MAE, RMSE, CSI, Brier, CRPS y cobertura empírica)', () => {
  const prop = propagateUncertainty({
    dimensions: [
      { name: 'n', dist: 'uniform', min: 0.025, max: 0.065 },
      { name: 'slope', dist: 'triangular', min: 0.002, mode: 0.005, max: 0.01 },
    ],
    samples: 100,
    seed: 77,
    outputUnit: 'm/s',
    label: 'Velocidad de Manning (R_h=2m)',
    modelFn: ({ n, slope }) => (1 / n) * Math.pow(2, 2 / 3) * Math.sqrt(slope),
  });
  const s = prop.summary;
  assert.equal(s.unit, 'm/s');
  assert.ok(s.p05 < s.p50 && s.p50 < s.p95);
  assert.equal(s.ci90[0], s.p05);
  assert.equal(s.ci90[1], s.p95);

  // CRPS estrictamente propio: un conjunto concentrado en la verdad tiene menor CRPS que uno sesgado o disperso
  const crpsExact = empiricalCrps([1.0, 1.0, 1.0, 1.0], 1.0);
  const crpsGood = empiricalCrps([0.9, 1.0, 1.05, 1.1], 1.0);
  const crpsBad = empiricalCrps([2.0, 2.2, 2.5, 2.8], 1.0);
  assert.equal(crpsExact, 0);
  assert.ok(crpsGood < crpsBad);

  const skill = evaluateForecastSkill({
    forecasts: [0.2, 0.8, 1.5, 0.05],
    observations: [0.1, 1.0, 1.4, 0.0],
    ensembleMatrix: [
      [0.1, 0.2, 0.3],
      [0.7, 0.9, 1.1],
      [1.3, 1.5, 1.7],
      [0.0, 0.05, 0.1],
    ],
    binaryThreshold: 0.5,
    intervalLower: [0.05, 0.6, 1.2, 0.0],
    intervalUpper: [0.35, 1.1, 1.8, 0.15],
    probForecasts: [0.1, 0.85, 0.95, 0.02],
  });
  assert.equal(skill.basis, 'MEASURED');
  assert.equal(skill.binary.csi, 1);
  assert.equal(skill.coverage.empiricalCoverage, 1);
  assert.ok(skill.meanCrps < 0.1);
  assert.ok(skill.brierScore < 0.02);
});

test('Regla de veracidad: rechaza parámetros incompletos o inválidos', () => {
  assert.throws(() => latinHypercubeSample({ dimensions: [], samples: 10, seed: 1 }), /dimensions/);
  assert.throws(() => latinHypercubeSample({ dimensions: [{ name: 'a', dist: 'uniform', min: 5, max: 2 }], samples: 10, seed: 1 }), /min < max/);
  assert.throws(() => summarizeEnsemble([NaN]), /al menos 1/);
  assert.throws(() => evaluateForecastSkill({ forecasts: [1], observations: [1, 2] }), /igual longitud/);
});
