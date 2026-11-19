import test from 'node:test';
import assert from 'node:assert/strict';
import { resection, monteScenario, localFrame, detectSteps, deadReckon, tilePack, tileXY, stepLengthM } from '../src/geo-offline.mjs';

test('resección: con rumbos exactos a 3 marcas, error < 5 m; con ±2° de brújula, dentro de 2,5× la elipse', () => {
  const sc = monteScenario(), F = localFrame(sc.me.lat, sc.me.lon), err = (r) => { const p = F.toXY(r.lat, r.lon); return Math.hypot(p.x, p.y); };
  assert.ok(err(resection(sc.marks.slice(0, 3).map((m) => ({ ...m, bearingDeg: m.trueBearing })))) < 5);
  const noisy = resection(sc.marks.slice(0, 3).map((m, i) => ({ ...m, bearingDeg: m.trueBearing + [1.5, -1.8, 1][i], sigmaDeg: 2 })));
  assert.ok(err(noisy) < 2.5 * noisy.errMajorM, `${err(noisy)} vs ${noisy.errMajorM}`);
  assert.throws(() => resection([sc.marks[0]].map((m) => ({ ...m, bearingDeg: 10 }))));
});

test('pasos: 108 pasos en 60 s a 1,8 Hz y estima por pasos en línea recta', () => {
  const sr = 50, mag = Array.from({ length: 60 * sr }, (_, i) => 9.81 + 1.5 * Math.max(0, Math.sin((2 * Math.PI * 1.8 * i) / sr)) ** 3);
  assert.ok(Math.abs(detectSteps(mag, sr).length - 108) <= 2);
  const p = deadReckon({ x: 0, y: 0 }, new Array(100).fill(90), stepLengthM(1.7)); assert.ok(Math.abs(p.at(-1).x - 70.55) < 0.1);
});

test('teselas: nivel 0 = 1, nivel 1 = 4 (mundo entero) y una zona de montaña cabe en el móvil', () => {
  assert.equal(tilePack({ minLat: -85, minLon: -180, maxLat: 85, maxLon: 179.99 }, 0, 1).tiles, 5);
  assert.deepEqual(tileXY(0, 0, 1), { x: 1, y: 1 });
  assert.ok(tilePack({ minLat: 43.1, minLon: -5.0, maxLat: 43.3, maxLon: -4.6 }, 10, 16).mb < 200);
});
