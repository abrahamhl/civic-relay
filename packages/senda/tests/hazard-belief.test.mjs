import test from 'node:test';
import assert from 'node:assert/strict';
import { hazardBelief, bayesUpdate, observe, fitReliability, beliefText, BELIEF_RULES } from '../src/hazard-belief.mjs';
import { REPORT_KINDS } from '../src/road-guard.mjs';

const MIN = 60_000, T0 = 1_800_000_000_000;

test('primer aviso: Bayes desde ½ da s/(s+1−c)', () => {
  const { s, c } = BELIEF_RULES.person;
  const b = hazardBelief({ kind: 'accidente', t: T0 }, T0);
  assert.ok(Math.abs(b.p - s / (s + 1 - c)) < 1e-12);
});

test('sin noticias, la creencia cae exactamente con la semivida del tipo', () => {
  const h = REPORT_KINDS.accidente.hlMin;
  const p0 = hazardBelief({ kind: 'accidente', t: T0 }, T0).p;
  const p1 = hazardBelief({ kind: 'accidente', t: T0 }, T0 + h * MIN).p;
  assert.ok(Math.abs(p1 - p0 / 2) < 1e-12);
});

test('t½ cerrado: en t½ la creencia vale ½', () => {
  const r = { kind: 'parado', t: T0 };
  const b = hazardBelief(r, T0);
  const later = hazardBelief(r, T0 + b.tHalfMin * MIN);
  assert.ok(Math.abs(later.p - 0.5) < 1e-9);
});

test('confirmaciones de otros móviles suben la creencia; «ya no está» la baja', () => {
  let r = { kind: 'obstaculo', t: T0 };
  const base = hazardBelief(r, T0 + 5 * MIN).p;
  r = observe(r, 'conf', T0 + 4 * MIN);
  const up = hazardBelief(r, T0 + 5 * MIN).p;
  r = observe(r, 'neg', T0 + 5 * MIN);
  const down = hazardBelief(r, T0 + 5 * MIN).p;
  assert.ok(up > base && down < up, `${base} ${up} ${down}`);
});

test('un aviso viejo desaparece (por debajo del umbral) y nunca sale de [0,1]', () => {
  const b = hazardBelief({ kind: 'retencion', t: T0 }, T0 + 2 * 24 * 60 * MIN);
  assert.ok(b.p >= 0 && b.p < BELIEF_RULES.dropBelow);
  assert.equal(bayesUpdate(0, 'conf', { s: 1, c: 1 }), 0); // 0·L / (0 + 1·0) → se queda
});

test('fitReliability: sin datos no se declara calibrado; con datos estima s y c', () => {
  assert.equal(fitReliability([]).calibrated, false);
  const outs = [...Array(18).fill({ said: 'conf', truth: true }), ...Array(2).fill({ said: 'neg', truth: true }), ...Array(15).fill({ said: 'neg', truth: false }), ...Array(5).fill({ said: 'conf', truth: false })];
  const f = fitReliability(outs);
  assert.ok(Math.abs(f.s - 19 / 22) < 1e-12 && Math.abs(f.c - 16 / 22) < 1e-12 && f.calibrated);
});

test('texto de interfaz', () => {
  const t = beliefText(hazardBelief(observe({ kind: 'accidente', t: T0 }, 'conf', T0 + MIN), T0 + 2 * MIN));
  assert.match(t, /sigue ahí \d+ % · 2 confirmaciones · probablemente despejado en ~\d+ min/);
});
