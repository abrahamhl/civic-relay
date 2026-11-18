import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttentionPlanner, bleRelayReach } from '../src/roadsafe-attention.mjs';

// Política DECLARADA de prueba (escenario, no valores medidos).
const POLICY = { tMinS: 8, tMaxS: 600, budgetPerWindow: 3, windowS: 300, minGapS: 20 };
const item = (warningId, kind, ceiling, etaS, aheadM) => ({ warningId, kind, ceiling, etaS, aheadM });

test('planificador: sin política declarada no arranca', () => {
  assert.throws(() => createAttentionPlanner({}), /debe declararse/);
  assert.throws(() => createAttentionPlanner({ ...POLICY, minGapS: undefined }), /minGapS/);
});

test('planificador: un aviso por turno, WARNING y tipo grave primero', () => {
  const p = createAttentionPlanner(POLICY);
  const items = [item('obras', 'ROADWORKS', 'ADVISORY', 60, 1500), item('choque', 'ACCIDENT', 'WARNING', 120, 3000), item('cola', 'QUEUE_TAIL', 'ADVISORY', 40, 900)];
  const r = p.next(items, 0);
  assert.equal(r.speak.warningId, 'choque');
  assert.deepEqual(r.queued, ['cola', 'obras']);
});

test('planificador: ventana útil (tardío / lejano / parado) no se anuncia', () => {
  const p = createAttentionPlanner(POLICY);
  const r = p.next([item('tarde', 'ACCIDENT', 'WARNING', 3, 50), item('lejos', 'ACCIDENT', 'WARNING', 900, 20000), item('parado', 'ACCIDENT', 'WARNING', Infinity, 500)], 0);
  assert.equal(r.speak, null);
  assert.equal(r.reasons.length, 3);
});

test('planificador: separación mínima salvo urgencia; no repite a la misma distancia', () => {
  const p = createAttentionPlanner(POLICY);
  assert.equal(p.next([item('obras', 'ROADWORKS', 'ADVISORY', 60, 1500)], 0).speak.warningId, 'obras');
  // 5 s después: un aviso no urgente espera
  assert.equal(p.next([item('niebla', 'FOG', 'ADVISORY', 60, 1500)], 5).speak, null);
  // pero una escena con personas (WARNING, prioridad ≥ 6) pasa
  assert.equal(p.next([item('gente', 'PEOPLE_ON_ROAD', 'WARNING', 60, 1500)], 6).speak.warningId, 'gente');
  // el mismo aviso 100 m más cerca no se repite
  const r = p.next([item('gente', 'PEOPLE_ON_ROAD', 'WARNING', 55, 1400)], 40);
  assert.equal(r.speak, null);
  assert.match(r.reasons[0].why, /ya anunciado/);
});

test('planificador: presupuesto por ventana y contexto solo con sobrante', () => {
  const p = createAttentionPlanner({ ...POLICY, minGapS: 0, budgetPerWindow: 2 });
  assert.ok(p.next([item('a', 'ACCIDENT', 'WARNING', 60, 1500)], 0).speak);
  // queda 1 → un punto negro (contexto) no lo consume
  const ctx = p.next([item('negro', 'HOTSPOT_CONTEXT', 'ADVISORY', 60, 1500)], 1);
  assert.equal(ctx.speak, null);
  assert.match(ctx.reasons.at(-1).why, /sobrante/);
  assert.ok(p.next([item('b', 'QUEUE_TAIL', 'WARNING', 60, 1500)], 2).speak);
  const r = p.next([item('c', 'ACCIDENT', 'WARNING', 60, 1500)], 3);
  assert.equal(r.speak, null);
  assert.match(r.reasons.at(-1).why, /agotado/);
  // fuera de la ventana el presupuesto se recupera
  assert.equal(p.next([item('c', 'ACCIDENT', 'WARNING', 60, 1500)], 400).speak.warningId, 'c');
});

test('BLE: parámetros obligatorios', () => {
  assert.throws(() => bleRelayReach({ densityVehKm: 25, penetration: 0.1, maxHops: 10, targetM: 1000 }), /rangeM/);
});

test('BLE: alcance monótono en penetración y acotado por saltos', () => {
  const base = { densityVehKm: 25, rangeM: 200, maxHops: 10, targetM: 1000 };
  const reach = [0.01, 0.05, 0.2, 0.5].map((penetration) => bleRelayReach({ ...base, penetration }));
  for (let i = 1; i < reach.length; i++) assert.ok(reach[i].expectedReachM > reach[i - 1].expectedReachM);
  for (const r of reach) {
    assert.ok(r.expectedReachM <= base.maxHops * base.rangeM);
    assert.ok(r.pReachTarget >= 0 && r.pReachTarget <= 1);
    assert.match(r.basis, /no medidos/);
  }
  // penetración 0: no hay cadena
  assert.equal(bleRelayReach({ ...base, penetration: 0 }).expectedReachM, 0);
});
