import test from 'node:test';
import assert from 'node:assert/strict';
import * as FF from '../src/fire-field.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const field = (w = 81, h = 81, fuelClass = 1, elevFn = () => 0) => ({ w, h, dx: 50, fuel: new Uint8Array(w * h).fill(fuelClass), elev: Float32Array.from({ length: w * h }, (_, k) => elevFn(k % w, Math.floor(k / w))) });

test('propagación: sin viento ni pendiente es casi circular; con viento se estira hacia sotavento; cuesta arriba corre más', () => {
  const F = field(), ign = [{ i: 40, j: 40 }];
  const T = FF.arrivalOnField(F, ign, () => ({ u: 0, v: 0 }));
  const r = (di, dj) => T[(40 + dj) * F.w + 40 + di];
  assert.ok(Math.abs(r(20, 0) - r(0, 20)) / r(20, 0) < 0.1 && Math.abs(r(20, 0) - r(-20, 0)) < 1e-3);
  const Tw = FF.arrivalOnField(F, ign, () => ({ u: 8, v: 0 })), rw = (di, dj) => Tw[(40 + dj) * F.w + 40 + di];
  assert.ok(rw(20, 0) * 3 < rw(-20, 0), 'viento del oeste: llega antes al este');
  const Tn = FF.arrivalOnField(F, ign, () => ({ u: 0, v: 8 })); assert.ok(Tn[20 * F.w + 40] < Tn[60 * F.w + 40], 'v>0 empuja al NORTE (fila menor)');
  const Fs = field(81, 81, 1, (i) => i * 5), Ts = FF.arrivalOnField(Fs, ign, () => ({ u: 0, v: 0 }));
  assert.ok(Ts[40 * 81 + 60] < Ts[40 * 81 + 20], 'ladera arriba (este) antes que abajo');
  const Fw = field(); for (let j = 0; j < 81; j++) for (const i of [50, 51, 52]) Fw.fuel[j * 81 + i] = 0; const Tb = FF.arrivalOnField(Fw, ign, () => ({ u: 8, v: 0 }));
  assert.ok(!Number.isFinite(Tb[40 * 81 + 60]), 'una franja de 3 celdas sin combustible lo detiene (con 16 vecinos, una de 1 celda se salta)');
});

test('conjunto: probabilidad monótona en el tiempo, determinista con semilla y con más dispersión lateral que un solo miembro', () => {
  const F = field(61, 61), ign = [{ i: 30, j: 30 }], wind = () => ({ u: 6, v: 0 });
  const E = FF.ensembleArrival(F, ign, wind, { members: 12, seed: 3 }), E2 = FF.ensembleArrival(F, ign, wind, { members: 12, seed: 3 });
  const p1 = E.pAt(30), p2 = E.pAt(90); let mono = true; for (let k = 0; k < p1.length; k++) if (p2[k] < p1[k]) mono = false; assert.ok(mono);
  assert.deepEqual([...E.pAt(60)], [...E2.pAt(60)]);
  assert.ok(p2.reduce((m, x) => Math.max(m, x), 0) === 100 && p2[30 * 61 + 30] === 100);
});

test('validación: Jaccard, Sørensen, área igual y habilidad frente al círculo', () => {
  const a = Uint8Array.from([1, 1, 0, 0]), b = Uint8Array.from([1, 0, 1, 0]);
  assert.equal(FF.jaccard(a, b), 1 / 3); assert.equal(FF.sorensen(a, b), 0.5); assert.equal(FF.countOnes(a), 2);
  const T = Float32Array.from([5, 1, Infinity, 3]); assert.equal(FF.timeForArea(T, 2), 3); assert.deepEqual([...FF.burnedMask(T, 3)], [0, 1, 0, 1]);
  const F = field(21, 21), c = FF.circleNull(F, { i: 10, j: 10 }, 13); assert.equal(FF.countOnes(c), 13); assert.equal(c[10 * 21 + 10], 1);
  assert.ok(Math.abs(FF.skillVsNull(0.5, 0.2) - 0.375) < 1e-12); assert.ok(FF.skillVsNull(0.1, 0.2) < 0);
});

test('cámaras: píxel ↔ rayo, una cámara + terreno geolocaliza, la línea de visión detecta el relieve y varias triangulan en 3D', () => {
  const cam = FF.makeCamera({ x: 0, y: 0, z: 100, azDeg: 90, tiltDeg: -5, hfovDeg: 60, w: 1000, h: 600 });
  const c = FF.pixelRay(cam, 500, 300); assert.ok(Math.abs(c.d[0] - Math.cos((5 * Math.PI) / 180)) < 1e-9 && c.d[2] < 0);
  const p = [1000, 200, 30], pr = FF.projectPoint(cam, p), back = FF.pixelRay(cam, pr.u, pr.v), t = (p[0] - cam.o[0]) / back.d[0];
  assert.ok(Math.abs(cam.o[1] + back.d[1] * t - p[1]) < 1e-6 && Math.abs(cam.o[2] + back.d[2] * t - p[2]) < 1e-6);
  const hit = FF.rayTerrain(c, () => 0); assert.ok(hit.hit && Math.abs(hit.p[0] - 100 / Math.tan((5 * Math.PI) / 180)) < 1, 'distancia = h / tan(depresión)');
  const ridge = (x) => (x > 400 && x < 450 ? 200 : 0); assert.equal(FF.lineOfSight([0, 0, 100], [1000, 0, 10], ridge), false); assert.equal(FF.lineOfSight([0, 0, 100], [1000, 0, 10], () => 0), true);
  const target = [3000, 2000, 900], rays = [[0, 0, 600], [6000, 0, 500], [3000, 6000, 700]].map((o) => { const d = [target[0] - o[0], target[1] - o[1], target[2] - o[2]], n = Math.hypot(...d); return { o, d: d.map((x) => x / n) }; });
  const tri = FF.closestPointToRays(rays); assert.ok(tri.ok && Math.hypot(tri.p[0] - 3000, tri.p[1] - 2000, tri.p[2] - 900) < 1e-6 && tri.residualRmsM < 1e-6);
});

test('calor desde la columna: inversión de Briggs coherente (ida y vuelta)', () => {
  const F = 1.2e5, U = 9, x = 1500, rise = (1.6 * F ** (1 / 3) * x ** (2 / 3)) / U, back = FF.plumeHeatFromRise({ riseM: rise, xM: x, U });
  assert.ok(Math.abs(back.F - F) / F < 1e-9 && back.qW > 1e9);
  assert.ok(FF.plumeHeatFromHeight({ riseM: 2000, U: 8, N2: 1e-4 }).qW > FF.plumeHeatFromHeight({ riseM: 1000, U: 8, N2: 1e-4 }).qW);
});

test('parpadeo y destellos: frecuencia de llama, anchura aproximada y sincronización de cámaras', () => {
  const fps = 30, s = Array.from({ length: 300 }, (_, t) => 100 + 20 * Math.sin((2 * Math.PI * 4 * t) / fps));
  const f = FF.flickerSpectrum(s, fps); assert.ok(Math.abs(f.peakHz - 4) < 0.15 && f.bandRatio > 0.9);
  assert.ok(Math.abs(FF.flickerToWidthM(1.5) - 1) < 1e-12 && FF.flickerToWidthM(0.5) > FF.flickerToWidthM(1));
  const a = Array.from({ length: 200 }, (_, t) => (t === 60 ? 255 : 10)), b = Array.from({ length: 200 }, (_, t) => (t === 73 ? 250 : 12));
  assert.equal(FF.syncOffset(a, b, 30).lag, 13);
});

const D = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/smv2026');
test('datos reales del caso: terreno, combustible, cicatrices y resultados coherentes con sus fuentes', { skip: !existsSync(resolve(D, 'fire3d.json')) }, () => {
  const meta = JSON.parse(readFileSync(resolve(D, 'real.json'), 'utf8')), r = JSON.parse(readFileSync(resolve(D, 'fire3d.json'), 'utf8'));
  assert.match(meta.fuente, /Copernicus Sentinel/); assert.match(meta.fuente, /Copernicus DEM/);
  const dem = new Int16Array(readFileSync(resolve(D, 'dem_100m.bin')).buffer.slice(0)); assert.equal(dem.length, meta.dem.w * meta.dem.h); let mn = Infinity, mx = -Infinity; for (const v of dem) { mn = Math.min(mn, v); mx = Math.max(mx, v); } assert.ok(mn > 300 && mx < 2600);
  const bits = new Uint8Array(readFileSync(resolve(D, 'burn_100m.bin'))); let n1 = 0, n4 = 0; for (const b of bits) { n1 += b & 1; n4 += (b >> 2) & 1; } assert.ok(n4 > n1 * 2, 'la cicatriz crece del 24-07 al 08-08');
  const ig = r.ignicion; let near = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) near |= bits[(ig.j + dj) * meta.dem.w + ig.i + di] & 1;
  assert.equal(near, 1, 'a ≤ 200 m del km 57 de la M-501 ya hay quemado el 24-07 (la calzada en sí no da señal)');
  assert.ok(r.masaDeAire[1].haines === 6 && r.masaDeAire[1].t2 > 30 && r.masaDeAire[1].rh2 < 30, '15 UTC: Haines 6, calor y sequedad');
  assert.ok(r.viento3D.divergencia.every((d) => d.despues < d.antes / 100));
  assert.ok(r.validacion.calibracionEnMuestra.mejorForma.jaccard > r.validacion.jaccardCirculo, 'asimilar la cicatriz supera al círculo');
});
