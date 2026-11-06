import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveCatalog, planReserve, freshness, urgentHalfLifeH, refreshPlan, windowMB, broadcastMB, drainIntents } from '../src/net-reserve.mjs';

test('mochila 0/1: respeta el presupuesto, lo esencial siempre entra y es óptima frente a fuerza bruta', () => {
  const items = [{ id: 'e', mb: 2, u: 50, essential: true, hl: Infinity }, { id: 'a', mb: 5, u: 10, hl: 1 }, { id: 'b', mb: 4, u: 9, hl: 1 }, { id: 'c', mb: 3, u: 7, hl: 1 }, { id: 'd', mb: 6, u: 13, hl: 1 }];
  const r = planReserve(items, 12); assert.ok(r.usedMB <= 12); assert.ok(r.chosen.some((i) => i.id === 'e'));
  let best = 0; const rest = items.slice(1);
  for (let m = 0; m < 16; m++) { let w = 2, v = 50; rest.forEach((it, j) => { if (m & (1 << j)) { w += it.mb; v += it.u; } }); if (w <= 12) best = Math.max(best, v); }
  assert.equal(r.value, best);
});

test('reserva de 1 GB para una zona de riada: cubre ≥ 95 % del valor y deja fuera solo la Wikipedia completa (~9 GB)', () => {
  const cat = reserveCatalog({ hazards: ['riada'] }), r = planReserve(cat, 1024);
  assert.ok(r.coverage >= 0.95, String(r.coverage)); assert.deepEqual(r.skipped.map((i) => i.id), ['wiki-completa']);
  assert.ok(planReserve(cat, 200).coverage > 0.85, 'lo esencial cabe en 200 MB');
  assert.ok(cat.find((i) => i.id === 'inundables').u > reserveCatalog({ hazards: [] }).find((i) => i.id === 'inundables').u);
});

test('frescura: semivida de lo urgente en horas; en una ventana corta se actualiza primero lo que más valor recupera por mega', () => {
  assert.equal(freshness(6, 6), 0.5); assert.equal(freshness(1e6, Infinity), 1);
  const cat = reserveCatalog({ hazards: ['riada'] }), chosen = planReserve(cat, 1024).chosen;
  const h = urgentHalfLifeH(chosen); assert.ok(h > 4 && h < 48, String(h));
  const plan = refreshPlan(chosen.map((i) => ({ ...i, ageH: 30 })), windowMB(30, 2000));
  assert.equal(plan.items[0].id, 'avisos'); assert.ok(plan.usedMB <= windowMB(30, 2000));
});

test('recarga por difusión y salida de intenciones por prioridad', () => {
  assert.equal(broadcastMB(32, 24), 337.5);
  const d = drainIntents([{ id: 'foto', priority: 3, kb: 900 }, { id: 'sos', priority: 0, kb: 1 }, { id: 'estoy-bien', priority: 1, kb: 1 }, { id: 'mapa', priority: 2, kb: 400 }], 500);
  assert.deepEqual(d.sent, ['sos', 'estoy-bien', 'mapa']); assert.deepEqual(d.left, ['foto']);
});
