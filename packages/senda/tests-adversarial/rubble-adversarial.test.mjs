import test from 'node:test';
import assert from 'node:assert/strict';
import { locateBeacon } from '../src/rubble.mjs';

const model = { txPower1m: -59, n: 2.5 };
const rssiFor = (target, [x, y, z]) => ({
  x, y, z,
  rssi: model.txPower1m - 10 * model.n * Math.log10(Math.hypot(target.x - x, target.y - y, target.z - z)),
});

test('trilateración: anclas colineales no producen una posición con falsa confianza', () => {
  const reads = [
    { x: 0, y: 0, z: 0, rssi: -59 },
    { x: 1, y: 0, z: 0, rssi: -65 },
    { x: 2, y: 0, z: 0, rssi: -69 },
  ];
  assert.equal(locateBeacon(reads, model), null);
});

test('trilateración: anclas colineales en 3D tampoco son localizables', () => {
  const reads = [
    { x: 0, y: 0, z: 0, rssi: -61 },
    { x: 1, y: 0, z: 1, rssi: -66 },
    { x: 2, y: 0, z: 2, rssi: -70 },
  ];
  assert.equal(locateBeacon(reads, model), null);
});

test('trilateración: anclas casi colineales se rechazan', () => {
  const reads = [
    { x: 0, y: 0, z: 0, rssi: -59 },
    { x: 1, y: 0, z: 0, rssi: -65 },
    { x: 2, y: 1e-7, z: 0, rssi: -69 },
  ];
  assert.equal(locateBeacon(reads, model), null);
});

test('trilateración: anclas duplicadas no permiten resolver la geometría', () => {
  const reads = [
    { x: 1, y: 2, z: 0, rssi: -60 },
    { x: 1, y: 2, z: 0, rssi: -63 },
    { x: 4, y: 5, z: 0, rssi: -68 },
  ];
  assert.equal(locateBeacon(reads, model), null);
});

test('trilateración: lecturas no finitas o distancias inválidas se rechazan', () => {
  assert.equal(locateBeacon([{ x: 0, y: 0, rssi: -59 }, { x: 1, y: 0, rssi: -65 }, { x: NaN, y: 0, rssi: -69 }], model), null);
  assert.equal(locateBeacon([{ x: 0, y: 0, rssi: -59 }, { x: 1, y: 0, rssi: -65 }, { x: 2, y: 0, rssi: Infinity }], model), null);
});

test('trilateración: geometría no degenerada conserva precisión métrica', () => {
  const target = { x: 2.3, y: 1.7, z: -2.1 };
  const anchors = [[0, 0, 0], [6, 0, 0], [0, 5, 0], [0, 0, 4], [5, 4, 0]];
  const estimate = locateBeacon(anchors.map((a) => rssiFor(target, a)), model);
  assert.ok(estimate);
  assert.ok(Math.hypot(estimate.x - target.x, estimate.y - target.y, estimate.z - target.z) < 1e-5);
  assert.equal(estimate.reads, anchors.length);
});
