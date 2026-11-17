import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineM, ringsOf, buildWaterIndex, pointInWater, segmentWetFraction, buildGraph, multiSourceDijkstra, connectedComponents, analyzeIsolation, NODE_STATE } from '../src/flood-isolation.mjs';

// Calle recta oeste→este con 5 nodos; servicio en el extremo oeste; el agua tapa el tramo central.
const coords = [[0, 0], [0.001, 0], [0.002, 0], [0.003, 0], [0.004, 0], [0.002, 0.001]];
const line = { coords, ways: [{ nodes: [0, 1, 2, 3, 4] }] };
const waterMid = [[[0.0021, -0.0005], [0.0029, -0.0005], [0.0029, 0.0005], [0.0021, 0.0005]]];
const opts = { wetThreshold: 0, excludeServicesInWater: true };

test('aislamiento: haversine y extracción de anillos GeoJSON', () => {
  assert.ok(Math.abs(haversineM([0, 0], [0, 1]) - 111195) < 5);
  assert.equal(ringsOf({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[waterMid[0]], [waterMid[0], waterMid[0]]] } }] }).length, 3);
});

test('aislamiento: punto en agua y fracción mojada de un segmento', () => {
  const idx = buildWaterIndex(waterMid);
  assert.equal(pointInWater(idx, [0.0025, 0]), true);
  assert.equal(pointInWater(idx, [0.001, 0]), false);
  assert.ok(Math.abs(segmentWetFraction(idx, [0.002, 0], [0.003, 0]) - 0.8) < 1e-6);
  assert.equal(segmentWetFraction(idx, [0, 0], [0.001, 0]), 0);
});

test('aislamiento: un anillo interior (isla) queda seco por la regla par-impar', () => {
  const idx = buildWaterIndex([[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]], { cellDeg: 1 });
  assert.equal(pointInWater(idx, [2, 2]), true);
  assert.equal(pointInWater(idx, [5, 5]), false);
});

test('aislamiento: el agua corta la calle y aísla a los nodos secos del otro lado', () => {
  const r = analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0, kind: 'hospital' }], options: opts });
  assert.equal(r.basis, 'CALCULATED_FROM_OBSERVED_DATA');
  assert.deepEqual([...r.state].slice(0, 5), [1, 1, 1, 2, 2].map(Number));
  assert.equal(r.metrics.nodesIsolated, 2); assert.equal(r.metrics.cutSegments, 1); assert.equal(r.metrics.isolatedPockets, 1);
  assert.equal(r.state[5], NODE_STATE.UNUSED);
  assert.equal(r.metrics.meanTimeBeforeMin, null, 'sin velocidad declarada no hay tiempos');
});

test('aislamiento: con un desvío seco nadie queda aislado, pero la distancia sube', () => {
  const net = { coords: [...coords.slice(0, 5), [0.002, 0.002], [0.003, 0.002]], ways: [{ nodes: [0, 1, 2, 3, 4] }, { nodes: [2, 5, 6, 3] }] };
  const r = analyzeIsolation({ network: net, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: opts });
  assert.equal(r.metrics.nodesIsolated, 0);
  assert.ok(r.after.dist[3] > r.before.dist[3]); assert.ok(r.metrics.maxIncreaseM > 0);
});

test('aislamiento: el umbral es un escenario declarado y cambia el resultado', () => {
  const a = analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: { ...opts, wetThreshold: 0.9 } });
  assert.equal(a.metrics.cutSegments, 0); assert.equal(a.metrics.nodesIsolated, 0);
  assert.equal(a.metrics.wetStreetKm, analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: opts }).metrics.wetStreetKm);
});

test('aislamiento: sin parámetros de escenario no calcula (no hay valores por defecto)', () => {
  assert.throws(() => analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: {} }), /wetThreshold/);
  assert.throws(() => analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: { wetThreshold: 0 } }), /excludeServicesInWater/);
  assert.throws(() => analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: { ...opts, speedMps: -1 } }), /speedMps/);
});

test('aislamiento: un servicio dentro del agua deja de contar si así se declara', () => {
  const svc = [{ lon: 0.0025, lat: 0.0001, kind: 'clinic' }];
  const net = { coords: [[0, 0], [0.001, 0], [0.002, 0], [0.0025, 0], [0.003, 0], [0.004, 0]], ways: [{ nodes: [0, 1, 2, 3, 4, 5] }] };
  const r = analyzeIsolation({ network: net, waterRings: waterMid, services: svc, options: opts });
  assert.equal(r.metrics.servicesInWater, 1); assert.equal(r.metrics.servicesUsedAfter, 0);
  assert.equal(r.metrics.nodesIsolated, 5, 'todos los nodos secos pierden su único servicio');
});

test('aislamiento: proxy de edificios y tiempos solo con velocidad declarada', () => {
  const r = analyzeIsolation({ network: line, waterRings: waterMid, services: [{ lon: 0, lat: 0 }], options: { ...opts, speedMps: 1.4 }, proxyPoints: [[0.0001, 0.0001], [0.004, 0.0001], [0.003, 0.0001]] });
  assert.deepEqual({ total: r.metrics.proxy.total, isolated: r.metrics.proxy.isolated, connected: r.metrics.proxy.connected }, { total: 3, isolated: 2, connected: 1 });
  assert.ok(r.metrics.meanTimeBeforeMin > 0); assert.match(r.assumptions.join(' '), /velocidad de escenario 1.4/);
});

test('aislamiento: Dijkstra multi-origen y componentes', () => {
  const g = buildGraph({ coords: [[0, 0], [0.001, 0], [0.002, 0], [1, 1], [1.001, 1]], ways: [{ nodes: [0, 1, 2] }, { nodes: [3, 4] }] });
  const d = multiSourceDijkstra(g, [0, 4]);
  assert.equal(d.src[2], 0); assert.equal(d.src[3], 1); assert.ok(d.dist[2] > d.dist[1]);
  assert.equal(connectedComponents(g).count, 2);
  const blocked = new Uint8Array(g.segA.length); blocked[0] = 1;
  assert.equal(connectedComponents(g, blocked).count, 3);
});
