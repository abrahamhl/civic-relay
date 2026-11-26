import test from 'node:test';
import assert from 'node:assert/strict';
import { createInsights, objectLine } from '../src/camera-insights.mjs';

test('coche delante: acercamiento, velocidad del otro y regla de los 2 s', () => {
  assert.throws(() => createInsights({}), /windowS/);
  const ins = createInsights({ windowS: 3 });
  let r; for (let k = 0; k <= 8; k++) { const t = k * 0.25; r = ins.update([{ id: 1, label: 'car', zone: 'TU_CARRIL', p3: { zM: 30 - 4 * t, xM: 0, widthM: 1.8 } }], t, 25); } // me acerco a 4 m/s; yo a 25 m/s
  const c = r[0];
  assert.equal(c.closingKmh, 14); assert.equal(c.sameDirKmh, 76); assert.equal(c.gapS, 0.9); assert.equal(c.gapBelow2s, true); assert.equal(c.ttcS, 5.5); // a 22 m: 22/25 s y 22/4 s
  assert.deepEqual(objectLine(c), ['coche · 22 m · se acerca 14 km/h', '0,9 s < 2 s · choque en 5,5 s · va a ~76 km/h']);
  assert.equal(ins.summary(r, 2).leadBelow2s, true);
});

test('sin geometría declarada no hay metros ni velocidades', () => {
  const ins = createInsights({ windowS: 3 });
  const [o] = ins.update([{ id: 7, label: 'person', zone: 'DERECHA', box: { x: 0.8, y: 0.5, w: 0.05, h: 0.2 } }], 0, 10);
  assert.equal(o.distM, null); assert.equal(o.closingKmh, null); assert.deepEqual(objectLine(o), ['persona']);
});

test('bici mirando atrás: un coche te adelanta a 0,65 m → por debajo de 1,5 m (RGC art. 85.4)', () => {
  const ins = createInsights({ windowS: 3, egoHalfWidthM: 0.35, mode: 'BICI_ATRAS' });
  for (let k = 0; k <= 6; k++) { const t = k * 0.25; ins.update([{ id: 3, label: 'car', p3: { zM: 14 - 2 * k, xM: 0.4 + 0.25 * k, widthM: 1.8 } }], t, 5); }
  ins.update([], 2, 5); // sale del encuadre por el lateral
  const s = ins.summary([], 2);
  assert.equal(s.overtakes.length, 1); assert.equal(s.overtakes[0].clearanceM, 0.65); // |1,9| − 1,8/2 − 0,35 assert.equal(s.closeOvertakes, 1);
  // sin medio ancho declarado no se estima la separación
  const ins2 = createInsights({ windowS: 3, mode: 'BICI_ATRAS' });
  for (let k = 0; k <= 6; k++) ins2.update([{ id: 3, label: 'car', p3: { zM: 14 - 2 * k, xM: 0.4 + 0.25 * k, widthM: 1.8 } }], k * 0.25, 5);
  ins2.update([], 2, 5); assert.equal(ins2.summary([], 2).overtakes.length, 0);
});
