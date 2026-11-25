import test from 'node:test';
import assert from 'node:assert/strict';
import { fillDepressions, d8, orderDesc, accumulate, hand, analyze, floodMask, agreement, calibrateLevel, rasterize, DI, DJ } from '../src/flood-science.mjs';

/** Valle en V que baja hacia el sur: z = 10·|i − c| + 2·(h − 1 − j). Cauce en la columna central. */
function valley(w = 21, h = 30) {
  const c = (w - 1) / 2, dem = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dem[j * w + i] = 10 * Math.abs(i - c) + 2 * (h - 1 - j) + 1;
  return { w, h, c, dem };
}

test('Priority-Flood: un hoyo se rellena hasta su desagüe y ninguna celda interior queda sin bajada', () => {
  const w = 7, h = 7, dem = new Float32Array(w * h).fill(10); dem[3 * w + 3] = 2; dem[3 * w + 0] = 5; // hoyo central, desagüe a la izquierda
  const f = fillDepressions(dem, w, h, { eps: 1e-3, seaLevel: -1 });
  assert.ok(f[3 * w + 3] >= 5 && f[3 * w + 3] < 10.1, `relleno ${f[3 * w + 3]}`);
  const dir = d8(f, w, h);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) assert.notEqual(dir[j * w + i], 255, `celda ${i},${j} sin salida`);
});

test('D8 + acumulación: en el valle en V todo drena al cauce central y la salida recoge la malla entera', () => {
  const { w, h, c, dem } = valley();
  const f = fillDepressions(dem, w, h, { seaLevel: -1 }), dir = d8(f, w, h), ord = orderDesc(f), acc = accumulate(dir, w, h, ord);
  const k = 5 * w + 3, d = dir[k]; assert.ok(DI[d] > 0, 'la ladera oeste baja hacia el este'); // hacia el cauce
  const mid = 15 * w + c; assert.equal(DI[dir[mid]], 0); assert.equal(DJ[dir[mid]], 1); // el cauce baja al sur
  let max = 0; for (const v of acc) max = Math.max(max, v);
  assert.ok(max >= 0.5 * w * h, `la mayor cuenca (${max}) recoge buena parte de la malla`);
});

test('HAND: en el valle en V es 10 m por celda de distancia al cauce (sin depender de la cota del cauce)', () => {
  const { w, h, c, dem } = valley();
  const r = analyze(dem, w, h, { cellM: 1, streamKm2: 40e-6, seaLevel: -1 }); // cauce con ≥ 40 celdas
  for (const j of [12, 18]) for (const di of [0, 2, 4]) {
    const v = r.hand[j * w + c + di]; assert.ok(Math.abs(v - 10 * di) < 1e-3, `HAND(${c + di},${j}) = ${v}`);
  }
  const m = floodMask(r.hand, 15); assert.equal(m[15 * w + c + 1], 1); assert.equal(m[15 * w + c + 2], 0);
});

test('acuerdo y calibración: el nivel que mejor reproduce una mancha conocida se recupera', () => {
  const { w, h, c, dem } = valley();
  const r = analyze(dem, w, h, { cellM: 1, streamKm2: 40e-6, seaLevel: -1 });
  const obs = floodMask(r.hand, 20); // «observado» = HAND ≤ 20 m
  const a = agreement(obs, obs); assert.equal(a.csi, 1); assert.equal(a.falseAlarms, 0);
  const cal = calibrateLevel(r.hand, obs, { levels: [0, 5, 10, 15, 20, 25, 30, 40] });
  assert.equal(cal.best.level, 20);
  assert.ok(cal.rows.find((x) => x.level === 40).falseAlarmRatio > 0);
});

test('rasterizado par-impar: un cuadrado con hueco cuenta solo el anillo', () => {
  const sq = (x0, y0, s) => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]];
  const m = rasterize([{ geometry: { type: 'Polygon', coordinates: [sq(0, 0, 10), sq(3, 3, 4)] } }], 12, 12, (p) => p);
  let n = 0; for (const v of m) n += v; assert.equal(n, 100 - 16);
  assert.equal(m[5 * 12 + 5], 0); assert.equal(m[1 * 12 + 1], 1);
});
