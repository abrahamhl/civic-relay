import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utmToLonLat, gridCorners, lengthToBreadth, fireEllipse, briggsX, plumeRings, arrivalRGBA, arrivalAreaHa } from '../src/fire4d.mjs';
import { haversineM } from '../src/route-planner.mjs';

const real = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/smv2026/real.json', import.meta.url)));

test('UTM 30N → WGS84 coincide con las esquinas guardadas de la escena Sentinel-2 (< 2 m)', () => {
  const c = gridCorners(real.malla);
  for (let i = 0; i < 4; i++) assert.ok(haversineM(c[i], real.esquinas_lonlat[i]) < 2, `esquina ${i}: ${c[i]} vs ${real.esquinas_lonlat[i]}`);
});

test('Alexander (1985): sin viento círculo; con viento se alarga', () => {
  assert.equal(lengthToBreadth(0), 1);
  assert.ok(Math.abs(lengthToBreadth(20) - (1 + 8.729 * (1 - Math.exp(-0.6)) ** 2.155)) < 1e-12);
  assert.ok(lengthToBreadth(40) > lengthToBreadth(20));
});

test('elipse de escenario: la cabeza avanza ros·t en la dirección del viento y el área sale de a·b', () => {
  const e = fireEllipse({ lat: 40.362, lon: -4.385, rosHeadMMin: 16.3, windKmh: 23, toDeg: 61, tMin: 60 });
  assert.ok(Math.abs(e.headM - 978) < 1);
  const far = e.ring.reduce((m, p) => Math.max(m, haversineM([-4.385, 40.362], p)), 0);
  assert.ok(Math.abs(far - e.headM) / e.headM < 0.01, `punta ${far} vs ${e.headM}`);
  assert.ok(e.areaHa > 0 && e.LB > 1 && e.HB > 1);
});

test('Briggs (1975): x(z) invierte Δh(x) = 1,6 F^(1/3) x^(2/3) / U', () => {
  const F = 191882, U = 9.8, z = 1500, x = briggsX(z, F, U);
  assert.ok(Math.abs((1.6 * Math.cbrt(F) * x ** (2 / 3)) / U - z) < 1e-6);
  const p = plumeRings({ lat: 40.362, lon: -4.385, F, U, toDeg: 61, zTop: 1880 });
  assert.equal(p.features.length, 14); assert.equal(p.features.at(-1).properties.top, 1880);
  assert.ok(p.features.at(-1).properties.driftM > p.features[0].properties.driftM);
});

test('llegada: solo pinta lo alcanzado hasta t y el área cuenta celdas de 1 ha', () => {
  const arr = new Uint16Array([0, 30, 100, 65535]);
  const px = arrivalRGBA(arr, 2, 2, 60);
  assert.equal(px[3] > 0 && px[7] > 0, true); assert.equal(px[11], 0); assert.equal(px[15], 0);
  assert.equal(arrivalAreaHa(arr, 60), 2); assert.equal(arrivalAreaHa(arr, 1000), 3);
});
