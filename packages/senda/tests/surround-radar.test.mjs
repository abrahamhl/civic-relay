import test from 'node:test';
import assert from 'node:assert/strict';
import { snapToRoute } from '../src/nav-osrm.mjs';
import { fromCamera, fromMmwave, coverage, summarize, sectorOf } from '../src/surround-radar.mjs';

test('sectores y radar trasero: un coche detrás a la izquierda a 5 m', () => {
  assert.equal(sectorOf(0), 'DELANTE'); assert.equal(sectorOf(180), 'DETRAS'); assert.equal(sectorOf(-135), 'DETRAS_IZDA'); assert.equal(sectorOf(90), 'DCHA');
  assert.throws(() => fromMmwave([], {}), /montaje/);
  // Radar en la luneta mirando atrás (yaw 180, 2 m detrás del centro). Objetivo 1,5 m a SU derecha y 3 m delante de él:
  const [o] = fromMmwave([{ xMm: 1500, yMm: 3000 }], { mount: { yawDeg: 180, yM: -2 } });
  assert.deepEqual([o.x, o.y], [-1.5, -5]); assert.equal(sectorOf(o.bearingDeg), 'DETRAS');
  const [o2] = fromMmwave([{ xMm: 3500, yMm: 2500 }], { mount: { yawDeg: 180, yM: -2 } });
  assert.equal(sectorOf(o2.bearingDeg), 'DETRAS_IZDA');
});

test('cámara: con metros si hay geometría; sin ella, solo dirección', () => {
  assert.throws(() => fromCamera([], {}), /hfovDeg/);
  const objs = fromCamera([{ label: 'car', p3: { zM: 20, xM: -2 } }, { label: 'truck', box: { x: 0.7, w: 0.2 } }, { label: 'traffic light', box: { x: 0.5, w: 0.1 } }], { hfovDeg: 66 });
  assert.equal(objs.length, 2); assert.equal(objs[0].distM, 20.1); assert.equal(objs[1].distM, null); assert.equal(objs[1].bearingDeg, 19.8);
});

test('cobertura y resumen honestos', () => {
  const c = coverage({ cameraHfovDeg: 66, mmwaveMounts: [{ yawDeg: 180 }] });
  assert.ok(c.covered.includes('DELANTE') && c.covered.includes('DETRAS')); assert.ok(c.uncovered.includes('DCHA') && c.uncovered.includes('IZDA'));
  assert.deepEqual(coverage({}).covered, []);
  const s = summarize([{ bearingDeg: 0, distM: 12 }, { bearingDeg: -140, distM: 4 }, { bearingDeg: -130, distM: 6 }]);
  assert.equal(s.total, 3); assert.equal(s.text, '3 alrededor: 2 detrás a la izquierda (4 m), 1 delante (12 m)');
  assert.equal(summarize([]).text, 'Nada detectado alrededor');
});

test('la flecha se ajusta a la ruta solo si está dentro del margen', () => {
  const line = [[-3.7, 40.4], [-3.69, 40.4]], m = 1 / 111195; // tramo este-oeste
  const s = snapToRoute(line, [-3.695, 40.4 + 6 * m], 10); assert.ok(s && Math.abs(s.offM - 6) < 0.1 && Math.abs(s.at[1] - 40.4) < 1e-9);
  assert.equal(snapToRoute(line, [-3.695, 40.4 + 30 * m], 10), null); assert.equal(snapToRoute(line, [-3.695, 40.4], 0), null);
});
