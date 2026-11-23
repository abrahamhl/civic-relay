import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, zoneOf, topAlert, RULES } from '../src/drive-hazard.mjs';
import { AASHTO_SSD } from '../src/road-guard.mjs';

const box = (cxv, s, label = 'car') => ({ label, score: 0.8, x: cxv - s / 2, y: 0.5 - s / 2, w: s, h: s });

test('el rojo usa el tiempo de percepción-reacción de AASHTO (con fuente)', () => {
  assert.equal(RULES.redTtcS, AASHTO_SSD.perceptionReactionS);
  assert.match(RULES.source, /no calibradas/);
});

test('zonas: izquierda, tu carril, derecha', () => {
  assert.equal(zoneOf(box(0.2, 0.1)), 'IZQUIERDA');
  assert.equal(zoneOf(box(0.5, 0.1)), 'TU_CARRIL');
  assert.equal(zoneOf(box(0.8, 0.1)), 'DERECHA');
});

test('coche delante acercándose: TTC por expansión del recuadro → rojo cuando baja de 2,5 s', () => {
  // Distancia D(t)=20-10t m (cierra a 10 m/s); tamaño aparente ∝ 1/D → TTC real = D/10.
  const tr = createTracker(); let last;
  for (let i = 0; i <= 15; i++) { const t = i * 0.1, D = 20 - 10 * t; last = tr.update([box(0.5, 2 / D)], t); }
  const o = last[0];
  assert.ok(Math.abs(o.ttcS - 0.5) < 0.35, `TTC estimado ${o.ttcS} frente a 0,5 s real`);
  assert.equal(o.level, 'ROJO');
});

test('coche que se aleja o va a tu misma velocidad: verde', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i <= 10; i++) last = tr.update([box(0.5, 0.1 - i * 0.002)], i * 0.1);
  assert.equal(last[0].level, 'VERDE');
  const tr2 = createTracker(); let l2;
  for (let i = 0; i <= 10; i++) l2 = tr2.update([box(0.5, 0.1)], i * 0.1);
  assert.equal(l2[0].ttcS, null);
});

test('coche a la derecha que se mete en tu carril: ámbar con motivo', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i <= 8; i++) last = tr.update([box(0.85 - i * 0.04, 0.12)], i * 0.1);
  assert.equal(last[0].level, 'AMBAR');
  assert.ok(last[0].reasons.some((r) => /derecha/.test(r)));
  assert.equal(topAlert(last).id, last[0].id);
});

test('seguimiento estable: dos coches distintos mantienen su identidad; objetos no vigilados se ignoran', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i < 5; i++) last = tr.update([box(0.2, 0.1), box(0.8, 0.1), { label: 'traffic light', score: 0.9, x: 0.5, y: 0.1, w: 0.05, h: 0.1 }], i * 0.1);
  assert.equal(last.length, 2);
  assert.deepEqual(last.map((o) => o.id).sort(), [1, 2]);
  assert.equal(topAlert(last), null);
});
