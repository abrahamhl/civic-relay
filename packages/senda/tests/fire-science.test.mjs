import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lonLatToUtm, cellOf, slopeAspect, burnedByFuel, burnedBySlope, burnRGBA, fuelRGBA, FUEL_CLASSES, cardinal } from '../src/fire-science.mjs';
import { utmToLonLat } from '../src/fire4d.mjs';

const dir = new URL('../../../investor-next/public/senda/data/smv2026/', import.meta.url);
const fire = JSON.parse(readFileSync(new URL('fire3d.json', dir)));
const M = fire.malla;

test('UTM ida y vuelta < 1 mm', () => {
  const [x, y] = lonLatToUtm(-4.385, 40.362); const [lon, lat] = utmToLonLat(x, y);
  assert.ok(Math.abs(lon + 4.385) < 1e-8 && Math.abs(lat - 40.362) < 1e-8);
});

test('la ignición cae en la celda guardada por el modelo (i, j de fire3d.json)', () => {
  const c = cellOf({ x0: M.x0, y1: M.y1, dx: M.dx, w: M.w, h: M.h }, fire.ignicion.lon, fire.ignicion.lat);
  assert.ok(Math.abs(c.i - fire.ignicion.i) <= 1 && Math.abs(c.j - fire.ignicion.j) <= 1, `${c.i},${c.j} vs ${fire.ignicion.i},${fire.ignicion.j}`);
});

test('Horn: rampa hacia el este de 10 m por celda de 100 m → 5,71° y ladera que cae al oeste (270°)', () => {
  const w = 5, h = 5, dem = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dem[j * w + i] = 10 * i;
  const { slope, aspect } = slopeAspect(dem, w, h, 100);
  assert.ok(Math.abs(slope[2 * w + 2] - Math.atan(0.1) * 180 / Math.PI) < 1e-4);
  assert.ok(Math.abs(aspect[2 * w + 2] - 270) < 1e-4); assert.equal(cardinal(270), 'O');
});

test('datos reales: lo quemado por combustible suma la cicatriz y la biomasa usa la carga declarada', () => {
  const burn = new Uint8Array(readFileSync(new URL('burn_100m.bin', dir))), fuel = new Uint8Array(readFileSync(new URL('fuel_100m.bin', dir)));
  assert.equal(burn.length, M.w * M.h); assert.equal(fuel.length, M.w * M.h);
  const r = burnedByFuel(burn, fuel, 2);
  let cells = 0; for (const b of burn) if (b & 7) cells++;
  assert.ok(Math.abs(r.totalHa - cells) < 1e-6, 'cada celda de 100 m = 1 ha');
  const mat = r.rows.find((x) => x.key === 'matorral'); assert.ok(Math.abs(mat.biomassT - mat.ha * 10_000 * FUEL_CLASSES[2].loadKgM2 / 1000) < 1e-6);
  const early = burnedByFuel(burn, fuel, 0).totalHa; assert.ok(early <= r.totalHa);
  assert.equal(burnRGBA(new Uint8Array([1, 2, 4, 0]), 1)[3] > 0, true); assert.equal(burnRGBA(new Uint8Array([4]), 1)[3], 0);
  assert.equal(fuelRGBA(new Uint8Array([3]))[1], 110);
  const sl = burnedBySlope(burn, new Float32Array(burn.length).fill(5), 2); assert.ok(Math.abs(sl[0].ha - cells) < 1e-6);
});
