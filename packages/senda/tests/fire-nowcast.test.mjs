import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFront, windCheck, etaAt, roadPlan } from '../src/fire-nowcast.mjs';

const ign = { tS: 0, lat: 40.0, lon: -4.0 }, mLat = 1 / 111195, mLon = 1 / (111195 * Math.cos(40 * Math.PI / 180));
const at = (east, north) => ({ lat: ign.lat + north * mLat, lon: ign.lon + east * mLon });
const ne = (d) => at(d * Math.SQRT1_2, d * Math.SQRT1_2);

test('fotos de agentes y vecinos → dirección y velocidad del frente; el humo no cuenta', () => {
  const reps = [
    { tS: 1800, ...ne(600), kind: 'FRONT', from: 'GUARDIA_CIVIL' },
    { tS: 3600, ...ne(1200), kind: 'FRONT', from: 'CIUDADANO' },
    { tS: 5400, ...ne(1800), kind: 'CROSSED_ROAD', road: 'M-501', from: 'POLICIA' },
    { tS: 3000, ...at(-900, 0), kind: 'SMOKE', from: 'CIUDADANO' },
  ];
  const f = fitFront(ign, reps);
  assert.ok(f.ok); assert.ok(Math.abs(f.dirToDeg - 45) < 0.5, f.dirToDeg); assert.ok(Math.abs(f.rosMMin - 20) < 0.2, f.rosMMin);
  assert.equal(f.smoke, 1); assert.equal(f.used, 3); assert.equal(f.trend, 'ESTABLE'); assert.deepEqual(f.crossedRoads, ['M-501']);
  assert.throws(() => fitFront(null, reps));
  // regla del 10 %: 30 km/h → 3 km/h = 50 m/min; observado 20 → 0,4
  const w = windCheck(f, 30); assert.equal(w.expectedMMin, 50); assert.equal(w.ratio, 0.4); assert.equal(w.verdict, 'MAS_LENTO_QUE_LA_REGLA');
});

test('llegada: cabeza = d/ROS; espalda mucho más tarde con viento; sin viento solo la cabeza; cortafuegos declarado', () => {
  const f = fitFront(ign, [{ tS: 3600, ...ne(1200), kind: 'FRONT' }, { tS: 7200, ...ne(2400), kind: 'FRONT' }]);
  assert.ok(Math.abs(etaAt(f, ne(3000), {}).tS - 9000) < 5);
  const back = etaAt(f, at(-3000 * Math.SQRT1_2, -3000 * Math.SQRT1_2), { windKmh: 30 }); assert.ok(back.tS > 9000 * 5, back.tS);
  assert.equal(etaAt(f, at(-3000, 0), {}).ok, false);
  assert.ok(Math.abs(etaAt(f, ne(3000), { windKmh: 30 }).tS - 9000) < 5); // en la cabeza la forma no cambia la llegada
  assert.ok(Math.abs(etaAt(f, ne(3000), { windObsKmh: 20, windNowKmh: 40 }).tS - 4500) < 5); // el viento se dobla → la mitad de tiempo
  assert.equal(etaAt(f, ne(3000), { fuelFactor: (la) => (la > ign.lat + 1500 * mLat ? 0 : 1) }).ok, false);
});

test('plan de carreteras: propuesta de corte por margen declarado y vía ya cruzada', () => {
  const f = fitFront(ign, [{ tS: 3600, ...ne(1200), kind: 'FRONT' }, { tS: 5400, ...ne(1800), kind: 'CROSSED_ROAD', road: 'M-501' }]);
  const road = (n, d) => ({ name: n, coords: [[ne(d).lon - 0.02, ne(d).lat + 0.02 * Math.cos(40 * Math.PI / 180)], [ne(d).lon + 0.02, ne(d).lat - 0.02 * Math.cos(40 * Math.PI / 180)]] });
  assert.throws(() => roadPlan(f, [], { nowS: 5400 }), /sin valores por defecto/);
  const plan = roadPlan(f, [road('M-501', 1800), road('N-403', 3000), road('AV-500', 6000)], { nowS: 5400, cutLeadMin: 90, windKmh: 25 });
  assert.equal(plan[0].name, 'M-501'); assert.equal(plan[0].observed, true);
  const n403 = plan.find((p) => p.name === 'N-403'), av = plan.find((p) => p.name === 'AV-500');
  assert.ok(n403.minutes > 0 && n403.minutes <= 60, `${n403.minutes}`); assert.equal(n403.cut, true);
  assert.ok(av.minutes > 90); assert.equal(av.cut, false);
});
