import test from 'node:test';
import assert from 'node:assert/strict';
import * as FF from '../src/fire-field.mjs';
import { arrivalTimes, assessAssets, windShape } from '../src/wildfire.mjs';

const flatField = (w = 61, h = 61, fuelClass = 1, dx = 50) => ({
  w, h, dx,
  fuel: new Uint8Array(w * h).fill(fuelClass),
  elev: new Float32Array(w * h),
});

test('arrivalOnField: no negatividad, causalidad y consistencia analítica sin viento', () => {
  const F = flatField(), ign = [{ i: 30, j: 30, t: 5 }];
  const T = FF.arrivalOnField(F, ign, () => ({ u: 0, v: 0 }));
  for (const t of T) if (Number.isFinite(t)) assert.ok(t >= 5);
  const expected = 5 + (10 * 50) / 6;
  assert.ok(Math.abs(T[30 * F.w + 40] - expected) / expected < 0.01, `${T[30 * F.w + 40]} vs ${expected}`);
  const Tcut = FF.arrivalOnField(F, ign, () => ({ u: 0, v: 0 }), { maxMin: 20 });
  assert.equal(Tcut[30 * F.w + 40], Infinity);
});

test('arrivalOnField: el mismo caso coincide con wildfire en dirección cardinal', () => {
  const F = flatField(), ign = [{ i: 30, j: 30 }];
  const Tf = FF.arrivalOnField(F, ign, () => ({ u: 0, v: 0 }));
  const Tw = arrivalTimes({ ...F, cellM: F.dx }, [{ x: 30, y: 30 }], { windKmh: 0, windToDeg: 0 });
  assert.ok(Math.abs(Tf[30 * F.w + 50] - Tw[30 * F.w + 50]) < 1e-3, `${Tf[30 * F.w + 50]} vs ${Tw[30 * F.w + 50]}`);
});

test('arrivalOnField: viento más fuerte llega antes a sotavento y no viola la cota física', () => {
  const F = flatField(), ign = [{ i: 30, j: 30 }];
  const a = FF.arrivalOnField(F, ign, () => ({ u: 4, v: 0 }))[30 * F.w + 45];
  const b = FF.arrivalOnField(F, ign, () => ({ u: 12, v: 0 }))[30 * F.w + 45];
  assert.ok(b < a);
  const ea = 750 / (6 * windShape(4 * 3.6).head), eb = 750 / (6 * windShape(12 * 3.6).head);
  assert.ok(Math.abs(a - ea) / ea < 0.01, `${a} vs ${ea}`);
  assert.ok(Math.abs(b - eb) / eb < 0.01, `${b} vs ${eb}`);
});

test('arrivalOnField: entradas no finitas o mallas inválidas fallan cerrado', () => {
  const F = flatField();
  assert.throws(() => FF.arrivalOnField({ ...F, dx: 0 }, [{ i: 1, j: 1 }], () => ({ u: 0, v: 0 })), /dx/);
  assert.throws(() => FF.arrivalOnField({ ...F, dx: NaN }, [{ i: 1, j: 1 }], () => ({ u: 0, v: 0 })), /dx/);
  assert.throws(() => FF.arrivalOnField({ ...F, elev: new Float32Array(F.w * F.h).fill(NaN) }, [{ i: 1, j: 1 }], () => ({ u: 0, v: 0 })), /elevación/);
  assert.throws(() => FF.arrivalOnField(F, [{ i: 1, j: 1 }], () => ({ u: NaN, v: 0 })), /windAt/);
  assert.throws(() => FF.arrivalOnField(F, [{ i: 1, j: 1, t: NaN }], () => ({ u: 0, v: 0 })), /t inválido/);
  assert.throws(() => FF.arrivalOnField({ ...F, fuel: new Uint8Array(F.w * F.h).fill(9) }, [{ i: 1, j: 1 }], () => ({ u: 0, v: 0 })), /combustible/);
  const out = FF.arrivalOnField(F, [{ i: -5, j: -5 }], () => ({ u: 0, v: 0 }));
  assert.ok(out.every((x) => x === Infinity));
});

test('ensembleArrival: miembros y semillas inválidos fallan cerrado', () => {
  const F = flatField(21, 21);
  assert.throws(() => FF.ensembleArrival(F, [{ i: 10, j: 10 }], () => ({ u: 0, v: 0 }), { members: 0 }), /members/);
  assert.throws(() => FF.ensembleArrival(F, [{ i: 10, j: 10 }], () => ({ u: 0, v: 0 }), { members: 2.5 }), /members/);
  assert.throws(() => FF.ensembleArrival(F, [{ i: 10, j: 10 }], () => ({ u: 0, v: 0 }), { seed: NaN }), /seed/);
});

test('métricas: longitudes distintas, área y habilidad indefinida fallan cerrado', () => {
  assert.throws(() => FF.jaccard(new Uint8Array(2), new Uint8Array(3)), /longitudes/);
  assert.throws(() => FF.sorensen(new Uint8Array(2), new Uint8Array(3)), /longitudes/);
  assert.equal(FF.jaccard(new Uint8Array(0), new Uint8Array(0)), 1);
  assert.throws(() => FF.timeForArea(Float32Array.from([1, 2]), 0), /cells/);
  assert.equal(FF.timeForArea(Float32Array.from([1, 2]), 3), Infinity);
  assert.throws(() => FF.skillVsNull(1, 1), /no está definida/);
  assert.throws(() => FF.skillVsNull(NaN, 0.2), /no finitos/);
});

test('cámaras y señales: entradas inválidas fallan cerrado', () => {
  assert.throws(() => FF.makeCamera({ x: 0, y: 0, z: 0, azDeg: NaN }), /azDeg/);
  assert.throws(() => FF.flickerSpectrum([1, 2], 30), /4 muestras/);
  assert.throws(() => FF.flickerSpectrum([1, 2, 3, 4], NaN), /fps/);
  assert.throws(() => FF.flickerToWidthM(0), /fHz/);
  assert.throws(() => FF.syncOffset([], [1, 2]), /2 muestras/);
  assert.throws(() => FF.syncOffset([1, 2], [1, 2], -1), /maxLag/);
  assert.throws(() => FF.closestPointToRays([]), /al menos un rayo/);
});

test('assessAssets: sin antena declarada no inventa cobertura ni una hora de caída', () => {
  const g = { w: 21, h: 21, cellM: 50, fuel: new Uint8Array(21 * 21).fill(1), elev: new Float32Array(21 * 21) };
  const T = arrivalTimes(g, [{ x: 2, y: 10 }], { windKmh: 10, windToDeg: 0 });
  const towns = [{ id: 'P', name: 'Pueblo', x: 18, y: 10, r: 1, population: 100, evacMin: 30 }];
  const [a] = assessAssets(g, T, towns, [], { nowMin: 0 });
  assert.equal(a.coverage, 'SIN_ANTENA_DECLARADA');
  assert.equal(a.commsLossMin, null);
  assert.equal(a.antennaFirst, true);
  assert.equal(a.sendByMin, a.deadlineMin);
  assert.ok(a.offlinePlan && a.offlinePlan.pDelivery > 0);
});

test('assessAssets: radios y tiempos no enteros o no finitos fallan cerrado', () => {
  const g = { w: 21, h: 21, cellM: 50, fuel: new Uint8Array(21 * 21).fill(1), elev: new Float32Array(21 * 21) };
  const T = arrivalTimes(g, [{ x: 2, y: 10 }], { windKmh: 10, windToDeg: 0 });
  const base = { id: 'P', name: 'Pueblo', x: 18, y: 10, population: 100, evacMin: 30 };
  assert.throws(() => assessAssets(g, T, [{ ...base, r: 1.5 }], []), /r inválido/);
  assert.throws(() => assessAssets(g, T, [{ ...base, evacMin: NaN }], []), /evacMin/);
  assert.throws(() => assessAssets(g, T, [base], [{ id: 'T', x: 1.5, y: 2, serves: ['P'] }]), /enteros/);
});
