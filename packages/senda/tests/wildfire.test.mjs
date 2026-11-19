import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalTimes, assessAssets, parseFirmsCsv, firmsToIgnitions, syntheticLandscape, directionalRos, perimeterAt } from '../src/wildfire.mjs';

const flat = (w = 41, h = 41, f = 1) => ({ w, h, cellM: 50, fuel: new Uint8Array(w * h).fill(f), elev: new Float32Array(w * h) });
const at = (g, T, x, y) => T[y * g.w + x];

test('sin viento ni pendiente el frente es casi isótropo', () => {
  const g = flat(), T = arrivalTimes(g, [{ x: 20, y: 20 }], { windKmh: 0, windToDeg: 0 });
  const d = [at(g, T, 35, 20), at(g, T, 5, 20), at(g, T, 20, 35), at(g, T, 20, 5)];
  assert.ok(Math.max(...d) / Math.min(...d) < 1.05, d.join(' '));
  assert.ok(Math.abs(at(g, T, 35, 20) - (15 * 50) / 6) < 15); // 750 m a 6 m/min ≈ 125 min
});

test('con viento hacia el este, el fuego llega antes al este y mucho después al oeste', () => {
  const g = flat(), T = arrivalTimes(g, [{ x: 20, y: 20 }], { windKmh: 30, windToDeg: 0 });
  assert.ok(at(g, T, 35, 20) * 5 < at(g, T, 5, 20), `${at(g, T, 35, 20)} vs ${at(g, T, 5, 20)}`);
});

test('ladera arriba más rápido que ladera abajo', () => {
  const g = flat(); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.elev[y * g.w + x] = x * 15; // sube hacia el este
  const T = arrivalTimes(g, [{ x: 20, y: 20 }], { windKmh: 0, windToDeg: 0 });
  assert.ok(at(g, T, 35, 20) < at(g, T, 5, 20) / 2);
  assert.ok(directionalRos(3, 0, { windKmh: 0, windToRad: 0 }, 0.3) > 3 * 2);
});

test('un cortafuegos sin combustible detiene el frente', () => {
  const g = flat(); for (let y = 0; y < g.h; y++) for (const x of [28, 29]) g.fuel[y * g.w + x] = 0;
  const T = arrivalTimes(g, [{ x: 20, y: 20 }], { windKmh: 40, windToDeg: 0 });
  assert.equal(at(g, T, 35, 20), Infinity);
  assert.ok(perimeterAt(g, T, 60).burnedHa > 0);
});

test('la población cuya antena arde antes de la hora límite recibe aviso por portadores sin red', () => {
  const g = flat(61, 21, 3), T = arrivalTimes(g, [{ x: 2, y: 10 }], { windKmh: 20, windToDeg: 0 }); // arbolado
  const towns = [{ id: 'P', name: 'Pueblo', x: 55, y: 10, r: 1, population: 500, evacMin: 40 }];
  const towers = [{ id: 'T', x: 25, y: 10, serves: ['P'] }];
  const [a] = assessAssets(g, T, towns, towers, { nowMin: at(g, T, 25, 10) });
  assert.ok(a.antennaFirst && a.commsLossMin < a.deadlineMin);
  assert.equal(a.channel, 'PORTADORES_SIN_RED');
  assert.ok(a.offlinePlan.pDelivery >= 0.99 && !a.offlinePlan.bearers.includes('CELL_DATA'));
});

test('paisaje sintético: determinista y con una población fuera de alcance tras el río', () => {
  const L = syntheticLandscape(), T1 = arrivalTimes(L.grid, [{ x: 30, y: 20 }], { windKmh: 30, windToDeg: 15 }), T2 = arrivalTimes(L.grid, [{ x: 30, y: 20 }], { windKmh: 30, windToDeg: 15 });
  assert.deepEqual([...T1], [...T2]);
  const r = assessAssets(L.grid, T1, L.towns, L.towers);
  assert.equal(r.find((x) => x.id === 'C').status, 'FUERA_DE_ALCANCE');
  assert.ok(r[0].sendByMin <= r[1].sendByMin);
});

test('FIRMS: CSV por nombre de columna y conversión a celdas', () => {
  const csv = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n40.40,-4.50,340.1,0.4,0.4,2026-08-12,1342,N,VIIRS,h,2.0NRT,295.2,12.5,D';
  const [p] = parseFirmsCsv(csv);
  assert.equal(p.when, '2026-08-12T13:42Z'); assert.equal(p.frp, 12.5);
  const [c] = firmsToIgnitions([p], { w: 100, h: 100, cellM: 100 }, { lat: 40.45, lon: -4.55 });
  assert.ok(c.x >= 40 && c.x <= 44 && c.y >= 54 && c.y <= 57, JSON.stringify(c));
});
