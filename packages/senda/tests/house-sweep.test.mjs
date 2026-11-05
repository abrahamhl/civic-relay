import test from 'node:test';
import assert from 'node:assert/strict';
import { orderHouses, planSweep, sweepBoard, sweepScenario } from '../src/house-sweep.mjs';

test('ruta: visita cada casa una vez y el 2-opt no empeora al vecino más cercano', () => {
  const { base, houses } = sweepScenario(), r = orderHouses(houses, base);
  assert.equal(new Set(r.order.map((h) => h.id)).size, houses.length);
  let nnLen = 0, cur = base; const left = [...houses];
  while (left.length) { let k = 0; for (let i = 1; i < left.length; i++) if (Math.hypot(cur.x - left[i].x, cur.y - left[i].y) < Math.hypot(cur.x - left[k].x, cur.y - left[k].y)) k = i; nnLen += Math.hypot(cur.x - left[k].x, cur.y - left[k].y); cur = left.splice(k, 1)[0]; }
  nnLen += Math.hypot(cur.x - base.x, cur.y - base.y);
  assert.ok(r.lengthM <= nnLen + 1e-6);
});

test('salidas: ninguna supera la autonomía útil (con reserva) y todas las casas tienen hora estimada', () => {
  const { base, houses } = sweepScenario(), p = planSweep(houses, { base, enduranceMin: 25, reserve: 0.2 });
  assert.ok(p.sorties.every((s) => s.timeS <= p.usableS + 1), JSON.stringify(p.sorties.map((s) => s.timeS)));
  assert.equal(Object.keys(p.etaS).length, houses.length); assert.ok(p.sorties.length >= 2);
});

test('tablero: más personas probables y más daño → más prioridad; sin daño, prioridad 0', () => {
  const b = sweepBoard([{ id: 'X', floors: 3, damage: 4, phones: 8, thermal: true }, { id: 'Y', floors: 3, damage: 4, phones: 2, thermal: false }, { id: 'Z', floors: 3, damage: 0, phones: 9, thermal: true }]);
  assert.deepEqual(b.map((h) => h.id), ['X', 'Y', 'Z']); assert.equal(b[2].score, 0);
});
