import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fitLogistic, predict, auc, brier, calibrationTable, fitSeverityModel, severityProbability, FEATURE_NAMES } from '../src/roadsafe-severity-model.mjs';
import { assessIncidentRisk } from '../src/roadsafe-risk-factors.mjs';

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test('IRLS recupera coeficientes conocidos (verificación numérica con datos sintéticos)', () => {
  const r = rng(1), trueBeta = [-2, 1.2, -0.7], X = [], y = [];
  for (let i = 0; i < 20000; i++) { const x = Float64Array.from([1, r() < 0.4 ? 1 : 0, r() < 0.5 ? 1 : 0]); X.push(x); y.push(r() < 1 / (1 + Math.exp(-(trueBeta[0] + trueBeta[1] * x[1] + trueBeta[2] * x[2]))) ? 1 : 0); }
  assert.throws(() => fitLogistic(X, y, {}), /λ/);
  const m = fitLogistic(X, y, { l2: 0 });
  m.beta.forEach((b, j) => assert.ok(Math.abs(b - trueBeta[j]) < 0.1, `beta${j}=${b}`));
  const s = X.map((x) => predict(m, x)); assert.ok(auc(s, y) > 0.6); assert.ok(brier(s, y) < 0.25);
  const cal = calibrationTable(s, y, 5); assert.ok(cal.every((b) => Math.abs(b.predicted - b.observed) < 0.05));
});

test('AUC: perfecto 1, inverso 0, empates 0,5', () => {
  assert.equal(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1); assert.equal(auc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]), 0); assert.equal(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]), 0.5);
});

test('modelo sobre registros armonizados: OR ajustado recupera el efecto plantado y valida en prueba', () => {
  const r = rng(7), recs = [];
  for (let i = 0; i < 30000; i++) {
    const dark = r() < 0.3, rural = r() < 0.4, z = -4 + 0.8 * dark + 1.3 * rural;
    recs.push({ severity: r() < 1 / (1 + Math.exp(-z)) ? 'FATAL' : 'SLIGHT', light: dark ? 'DARK_LIT' : 'DAY', area: rural ? 'RURAL' : 'URBAN', surface: 'DRY', weather: 'CLEAR', roadClass: 'SINGLE_CARRIAGEWAY', collision: 'SIDE', country: 'ES', involves: {}, hour: 12 });
  }
  const m = fitSeverityModel(recs, { l2: 1 });
  const dark = m.coefficients.find((c) => c.name === 'dark'), rural = m.coefficients.find((c) => c.name === 'rural');
  assert.ok(dark.ci[0] < Math.exp(0.8) && Math.exp(0.8) < dark.ci[1], JSON.stringify(dark)); assert.ok(rural.ci[0] < Math.exp(1.3) && Math.exp(1.3) < rural.ci[1]);
  assert.ok(!m.model.names.includes('cDE'), 'columnas constantes (países ausentes) se excluyen');
  assert.match(m.basis, /no causalidad/); assert.ok(m.test.auc > 0.6);
});

test('probabilidad de gravedad: sin modelo ⇒ null; con el modelo publicado ⇒ más alta de noche sin alumbrado en interurbano con pesado', () => {
  assert.equal(severityProbability({}, null).p, null);
  const path = new URL('../../../investor-next/public/senda/data/roadsafe-severity-model-2024.json', import.meta.url);
  if (!existsSync(path)) return; // el modelo publicado se genera con build-dataset (datos oficiales)
  const pub = JSON.parse(readFileSync(path, 'utf8'));
  const day = severityProbability({ light: 'DAY', area: 'URBAN', country: 'ES', involves: {} }, pub).p;
  const worst = severityProbability({ light: 'DARK_UNLIT', area: 'RURAL', onHardShoulder: true, country: 'ES', involves: { hgv: true }, hour: 3 }, pub).p;
  assert.ok(worst > 5 * day, `${worst} vs ${day}`);
  const risk = assessIncidentRisk({ night: true, unlit: true, rural: true, laneBlocked: 'SHOULDER', hour: 3, hgvInvolved: true }, { severityModel: pub, severityProbability });
  assert.ok(risk.severityIfCrash.p > 0); assert.ok(risk.drivers.some((d) => d.factor === 'NIGHT_HOURS'));
  assert.ok(FEATURE_NAMES.includes('hardShoulder'));
});
