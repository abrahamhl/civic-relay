import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, runUntil, storedVolume, piecewise, hydrographVolume } from '../src/shallow-water.mjs';

test('sin rugosidad no arranca (no hay valor por defecto)', () => {
  assert.throws(() => createSim({ w: 3, h: 3, z: new Float32Array(9), dx: 10 }), /Manning/);
});

test('lago en reposo sobre fondo irregular: el agua no se mueve (esquema bien equilibrado)', () => {
  const w = 20, h = 20, z = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) z[j * w + i] = 0.3 * Math.sin(i / 3) + 0.2 * Math.cos(j / 4);
  const S = createSim({ w, h, z, dx: 10, n: 0.03 });
  for (let k = 0; k < w * h; k++) S.d[k] = 2 - z[k]; S.box = [0, w - 1, 0, h - 1];
  for (let s = 0; s < 200; s++) step(S, 5);
  let qmax = 0; for (const q of S.qx) qmax = Math.max(qmax, Math.abs(q)); for (const q of S.qy) qmax = Math.max(qmax, Math.abs(q));
  assert.ok(qmax < 1e-9, `q máx ${qmax}`);
  for (let k = 0; k < w * h; k++) assert.ok(Math.abs(S.d[k] + z[k] - 2) < 1e-9);
});

test('conservación de la masa en un recinto cerrado: lo que entra = lo almacenado', () => {
  const w = 30, h = 30, z = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) z[j * w + i] = 0.01 * Math.hypot(i - 15, j - 15) + 0.05 * Math.sin(i + j);
  const S = createSim({ w, h, z, dx: 25, n: 0.05 });
  const hyd = [[0, 0], [600, 40], [1800, 0]];
  runUntil(S, 3600, { inflow: piecewise(hyd), cells: [5 * w + 5, 5 * w + 6], dtMax: 5 });
  const V = hydrographVolume(hyd);
  assert.ok(Math.abs(S.volIn - V) / V < 0.01, `entra ${S.volIn} frente a ${V}`); // discretización temporal del hidrograma
  assert.ok(Math.abs(storedVolume(S) - S.volIn) / S.volIn < 1e-9, `balance ${storedVolume(S)} frente a ${S.volIn}`);
  assert.equal(S.volOut, 0);
});

test('flujo uniforme en una rampa: el calado tiende al calado normal de Manning', () => {
  // Canal ancho de pendiente S0 con caudal unitario q: h_n = (q·n / √S0)^(3/5)
  const w = 120, h = 3, dx = 10, S0 = 0.001, n = 0.04, q = 1.0, z = new Float32Array(w * h), sink = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { z[j * w + i] = (w - i) * dx * S0; if (i === w - 1) sink[j * w + i] = 1; }
  const S = createSim({ w, h, z, dx, n, sink });
  const cells = [0, w, 2 * w]; // entrada en la cabecera de las tres filas
  runUntil(S, 6 * 3600, { inflow: () => q * dx * h, cells, dtMax: 2 });
  const hn = ((q * n) / Math.sqrt(S0)) ** 0.6;
  const mid = S.d[1 * w + 60];
  assert.ok(Math.abs(mid - hn) / hn < 0.05, `calado ${mid.toFixed(4)} m frente a normal ${hn.toFixed(4)} m`);
  assert.ok(Math.abs(S.volIn - S.volOut - storedVolume(S)) / S.volIn < 1e-6, 'balance con salida');
});

test('hidrograma lineal a trozos y su volumen', () => {
  const p = [[0, 0], [100, 10], [300, 0]], f = piecewise(p);
  assert.equal(f(50), 5); assert.equal(f(200), 5); assert.equal(f(400), 0); assert.equal(hydrographVolume(p), 1500);
});
