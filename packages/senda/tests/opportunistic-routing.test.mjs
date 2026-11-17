import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenario, simulateRouting, STRATEGIES, SCENARIO_NAMES } from '../src/opportunistic-routing.mjs';

const run = (scenario, strategy, seed = 20261107) => {
  const s = buildScenario(scenario, { seed });
  return simulateRouting({ ...s, strategy, sizeBytes: s.sizeBytes, seed });
};

test('el benchmark es determinista para la misma semilla y escenario', () => {
  for (const scenario of SCENARIO_NAMES) {
    for (const strategy of STRATEGIES) {
      const a = run(scenario, strategy, 424242);
      const b = run(scenario, strategy, 424242);
      assert.deepEqual(a, b, `${scenario}/${strategy}`);
    }
  }
});

test('sin enlace directo, direct no entrega y earliest sí', () => {
  const direct = run('scheduled-line', 'direct');
  assert.equal(direct.delivered, false);
  assert.equal(direct.endReason, 'NO_DELIVERY_BY_HORIZON');
  const earliest = run('scheduled-line', 'earliest');
  assert.equal(earliest.delivered, true);
  assert.ok(Math.abs(earliest.latencyS - earliest.plannedEta) < 0.01);
  assert.equal(earliest.hopCount, 4);
});

test('adaptive prefiere la cadena BLE barata frente a WiFi Direct rápida y cara', () => {
  const earliest = run('energy-scarce', 'earliest');
  const adaptive = run('energy-scarce', 'adaptive');
  assert.equal(earliest.delivered, true);
  assert.equal(adaptive.delivered, true);
  assert.ok(adaptive.energyProxy < earliest.energyProxy);
  assert.ok(adaptive.latencyS > earliest.latencyS);
  assert.ok(adaptive.dropReasons.ENERGY_POLICY > 0);
});

test('flooding desperdicia más que epidemic en una multitud con atajos', () => {
  const flooding = run('crowd', 'flooding');
  const epidemic = run('crowd', 'epidemic');
  assert.equal(flooding.delivered, true);
  assert.equal(epidemic.delivered, true);
  assert.ok(flooding.duplicateSends > 0);
  assert.ok(flooding.overheadRatio > epidemic.overheadRatio);
  assert.ok(flooding.energyProxy > epidemic.energyProxy);
});

test('spray respeta su presupuesto de copias', () => {
  const spray = run('scheduled-line', 'spray', 7);
  assert.equal(spray.delivered, true);
  assert.ok(spray.uniqueTransfers <= 16);
  assert.equal(spray.overheadRatio, 1);
});

test('estrategia y escenario inválidos fallan explícitamente', () => {
  assert.throws(() => run('scheduled-line', 'mágica'), /Estrategia desconocida/);
  assert.throws(() => buildScenario('inexistente'), /Escenario desconocido/);
});
