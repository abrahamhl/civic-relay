import test from 'node:test';
import assert from 'node:assert/strict';
import { rfCensus, rfCensusScenario, maxConcurrent, peopleFromPhones } from '../src/rf-census.mjs';

test('concurrencia máxima de intervalos: un dispositivo que rota de dirección cuenta una vez', () => {
  assert.equal(maxConcurrent([[0, 10], [11, 20], [21, 30]]), 1); // mismo móvil, tres direcciones seguidas
  assert.equal(maxConcurrent([[0, 10], [5, 15], [12, 20]]), 2);
});

test('teléfonos por planta: con rotación BLE (5, 10 y 15 min) la concurrencia recupera el número exacto', () => {
  for (const rotateS of [300, 600, 900]) for (const seed of [9, 3, 21]) {
    const sc = rfCensusScenario({ seed, rotateS }), r = rfCensus(sc.obs, sc.building);
    r.floors.forEach((f) => assert.equal(f.phones.lo, sc.phones[f.floor], `rot ${rotateS} seed ${seed} planta ${f.floor}`));
  }
});

test('personas: el intervalo creíble del 90 % cubre la verdad en ≥ 85 % de 240 plantas simuladas', () => {
  let hit = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sc = rfCensusScenario({ seed }), r = rfCensus(sc.obs, sc.building);
    r.floors.forEach((f) => { n++; if (f.people.lo <= sc.truth[f.floor] && sc.truth[f.floor] <= f.people.hi) hit++; });
  }
  assert.ok(hit / n >= 0.85, `${hit}/${n}`);
});

test('planta sin teléfonos: estimación 0, pero la radio no descarta a alguien sin móvil (cota 1)', () => {
  const sc = rfCensusScenario(), r = rfCensus(sc.obs, sc.building), f = r.floors[3];
  assert.equal(f.phones.hi, 0); assert.equal(f.people.mid, 0); assert.equal(f.people.hi, 1);
  assert.ok(f.people.pEmpty > 0.8 && f.people.pEmpty < 0.95);
});

test('inferencia exacta: con pocos teléfonos el intervalo es relativamente más ancho', () => {
  const a = peopleFromPhones(1), b = peopleFromPhones(8);
  assert.ok(a.lo <= 1 && 1 <= a.hi && b.lo <= 8 && 8 <= b.hi);
  assert.ok((a.hi - a.lo) / 1 > (b.hi - b.lo) / 8);
});

test('contar direcciones distintas sobreestima mucho: por eso SENDA usa la concurrencia', () => {
  const sc = rfCensusScenario(), r = rfCensus(sc.obs, sc.building);
  assert.ok(r.addresses > 2.5 * r.total.mid, `${r.addresses} direcciones vs ${r.total.mid} personas`);
});

test('los dispositivos fijos (TV, sensores) no cuentan y la salida solo contiene recuentos', () => {
  const sc = rfCensusScenario({ people: [0, 0, 0, 0, 0, 0] }), r = rfCensus(sc.obs, sc.building);
  assert.equal(r.total.mid, 0); r.floors.forEach((f) => assert.equal(f.phones.hi, 0));
  assert.ok(!JSON.stringify(r).includes('#'), 'no se filtran identificadores');
  assert.match(r.privacy, /recuentos/);
});

test('modo explicación: intervalos por grupo sin identificadores y posterior que suma 1', () => {
  const sc = rfCensusScenario(), r = rfCensus(sc.obs, sc.building, { explain: true });
  const g = r.floors[1].groups.filter((x) => x.cls === 'phone');
  assert.equal(g.reduce((s, x) => s + x.min, 0), r.floors[1].phones.lo);
  assert.ok(!JSON.stringify(r).includes('#'));
  const p = peopleFromPhones(5).post; assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
