import test from 'node:test';
import assert from 'node:assert/strict';
import { pSignal, toblerKmh, coverageAt, bestEscape, reboteScenario } from '../src/coverage-memory.mjs';

test('señal y paso: más dBm, más probabilidad; Tobler da ~5 km/h en llano y menos cuesta arriba', () => {
  assert.ok(pSignal(-80) > 0.99 && pSignal(-120) < 0.1 && pSignal(-108) === 0.5);
  assert.ok(Math.abs(toblerKmh(0) - 5.04) < 0.01 && toblerKmh(0.2) < toblerKmh(0));
});

test('las huellas de una misma antena no se suman como independientes: una antena muerta anula todas', () => {
  const towers = [{ id: 'A', backup: 'BATTERY' }], at = { lat: 40, lon: -3 };
  const prints = Array.from({ length: 20 }, () => ({ lat: 40, lon: -3, dbm: -80, tH: -2, towerId: 'A' }));
  assert.ok(coverageAt(at, prints, towers, 6).p < 0.05); // batería estándar agotada a las 6 h
  assert.ok(coverageAt(at, prints, towers, 0).p > 0.9);
});

test('rebote: el cerro con antena de grupo electrógeno y huellas tras el corte gana a la plaza cercana y al satélite', () => {
  const r = bestEscape(reboteScenario());
  assert.equal(r.best.id, 'ermita'); assert.ok(r.best.p > 0.9);
  const plaza = r.options.find((o) => o.id === 'plaza'); assert.ok(plaza.p < 0.1 && plaza.walkMin < 5);
  assert.ok(r.options.find((o) => o.id === 'sat').expectedMin > r.best.expectedMin);
});
