import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRouting, EAOR, ALL_STRATEGIES, buildScenario } from '../src/opportunistic-routing.mjs';

const c = (from, to, start, end, channel = 'BLE', confidence = 1) => ({ from, to, start, end, channel, confidence });
const base = { source: 'S', dest: 'T', t0: 0, tEnd: 400, sizeBytes: 512, seed: 7 };

function fastSlow() {
  return [
    c('S', 'F', 0, 30, 'WIFI_DIRECT'), c('F', 'T', 80, 110, 'WIFI_DIRECT'),
    c('S', 'R', 0, 60, 'BLE'), c('R', 'T', 200, 230, 'BLE'),
  ];
}

test('EAOR planifica varias rutas y respeta el número de copias', () => {
  const contacts = fastSlow();
  const r = simulateRouting({ ...base, contacts, strategy: EAOR, eaorCopies: 2 });
  assert.equal(r.delivered, true);
  assert.equal(r.eaor.copies, 2);
  assert.equal(r.eaor.routes.length, 2);
  assert.ok(r.eaor.routes.every((x) => x.score >= 0 && x.confidence === 1));
  assert.deepEqual([...new Set(r.eaor.routes.map((x) => x.path.join('>')) )].length, 2);
});

test('EAOR entrega por la ruta fiable cuando la ruta rápida falla; earliest no', () => {
  const planned = fastSlow();
  const realized = planned.map((x) => ({ ...x, failed: (x.from === 'S' && x.to === 'F') || (x.from === 'F' && x.to === 'T') }));
  const earliest = simulateRouting({ ...base, contacts: realized, planningContacts: planned, strategy: 'earliest' });
  const eaor = simulateRouting({ ...base, contacts: realized, planningContacts: planned, strategy: EAOR, eaorCopies: 2 });
  assert.equal(earliest.delivered, false);
  assert.equal(eaor.delivered, true);
  assert.ok(eaor.latencyS > 200 && eaor.latencyS < 201);
  assert.ok(eaor.eaor.routes.some((x) => x.path.join('>') === 'S>R>T'));
});

test('EAOR respeta el presupuesto de energía y falla cerrado si no cabe', () => {
  const contacts = fastSlow();
  const r = simulateRouting({ ...base, contacts, strategy: EAOR, eaorEnergyBudget: 0 });
  assert.equal(r.delivered, false);
  assert.ok(r.dropReasons.ENERGY_POLICY > 0);
  assert.throws(() => simulateRouting({ ...base, contacts, strategy: EAOR, eaorCopies: 0 }), /eaorCopies/);
  assert.throws(() => simulateRouting({ ...base, contacts, strategy: EAOR, eaorMinConfidence: 2 }), /eaorMinConfidence/);
  assert.throws(() => simulateRouting({ ...base, contacts, strategy: EAOR, eaorEnergyBudget: -1 }), /eaorEnergyBudget/);
});

test('un contacto abierto a mitad de ventana se reutiliza al llegar el portador', () => {
  const contacts = [c('S', 'A', 90, 120, 'LORA'), c('A', 'T', 95, 200, 'LORA')];
  const r = simulateRouting({ ...base, contacts, strategy: 'earliest' });
  assert.equal(r.delivered, true);
  assert.equal(r.reopenedContacts, 1);
  assert.ok(r.latencyS > 117 && r.latencyS < 118);
  assert.ok(Math.abs(r.latencyS - r.plannedEta) < 0.01);
});

test('todas las estrategias siguen siendo deterministas con la misma semilla', () => {
  for (const scenario of ['crowd', 'held-out', 'unreliable-contacts']) {
    for (const strategy of ALL_STRATEGIES) {
      const sc = buildScenario(scenario, { seed: 424242 });
      const a = simulateRouting({ ...sc, strategy, seed: 424242 });
      const b = simulateRouting({ ...sc, strategy, seed: 424242 });
      assert.deepEqual(a, b, `${scenario}/${strategy}`);
    }
  }
});
