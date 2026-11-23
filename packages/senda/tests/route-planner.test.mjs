import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGraph, planRoute, alternatives, nearRoute, googleMapsUrl, wazeUrl, pointInPolygon, haversineM, LIMITS } from '../src/route-planner.mjs';

// Rejilla de prueba (no es un lugar real): 3x3 nodos separados ~0,001° y una autopista en la fila de abajo.
const coords = []; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) coords.push([x * 0.001, y * 0.001]);
const net = { coords, ways: [
  { hw: 'residential', name: 'Fila 1', n: [3, 4, 5] }, { hw: 'residential', name: 'Fila 2', n: [6, 7, 8] },
  { hw: 'motorway', name: 'Autopista', n: [0, 1, 2] },
  { hw: 'residential', name: 'Col 0', n: [0, 3, 6] }, { hw: 'residential', name: 'Col 1', n: [1, 4, 7] }, { hw: 'residential', name: 'Col 2', n: [2, 5, 8] },
  { hw: 'pedestrian', name: 'Paseo', n: [3, 7] },
] };

test('ruta más corta y nombres de calles', () => {
  const r = planRoute(buildGraph(net, 'car'), { from: coords[0], to: coords[2] });
  assert.ok(r.ok);
  assert.deepEqual(r.nodes, [0, 1, 2]);
  assert.equal(r.streets[0].name, 'Autopista');
  assert.ok(Math.abs(r.lengthM - haversineM(coords[0], coords[2])) < 1);
});

test('a pie y en bici no se usa la autopista; a pie sí el paseo peatonal', () => {
  const bike = planRoute(buildGraph(net, 'bike'), { from: coords[0], to: coords[2] });
  assert.ok(bike.ok && !bike.nodes.includes(1));
  const foot = planRoute(buildGraph(net, 'foot'), { from: coords[3], to: coords[7] });
  assert.deepEqual(foot.nodes, [3, 7]);
  const car = planRoute(buildGraph(net, 'car'), { from: coords[3], to: coords[7] });
  assert.ok(car.nodes.length > 2, 'el coche no entra en la calle peatonal');
});

test('«pasar por aquí» obliga a ir por el punto elegido', () => {
  const r = planRoute(buildGraph(net, 'car'), { from: coords[0], to: coords[2], via: [coords[7]] });
  assert.ok(r.ok && r.nodes.includes(7) && r.legs.length === 2);
});

test('zona dibujada y aviso con radio se evitan; si no hay salida, lo dice', () => {
  const g = buildGraph(net, 'car');
  const r = planRoute(g, { from: coords[0], to: coords[2], avoid: { polygons: [[[0.0009, -0.0005], [0.0011, -0.0005], [0.0011, 0.0005], [0.0009, 0.0005]]] } });
  assert.ok(r.ok && !r.nodes.includes(1));
  const h = planRoute(g, { from: coords[0], to: coords[2], avoid: { points: [{ lon: 0.001, lat: 0, rM: 30 }] } });
  assert.ok(h.ok && !h.nodes.includes(1));
  const none = planRoute(g, { from: coords[0], to: coords[2], avoid: { points: [{ lon: 0.001, lat: 0.001, rM: 200 }] } });
  assert.equal(none.ok, false);
  const inside = planRoute(g, { from: coords[4], to: coords[2], avoid: { points: [{ lon: 0.001, lat: 0.001, rM: 10 }] } });
  assert.equal(inside.reason, 'PUNTO_EN_ZONA_EVITADA');
});

test('alternativas distintas entre sí', () => {
  const alts = alternatives(buildGraph(net, 'car'), { from: coords[0], to: coords[8] }, 3);
  assert.ok(alts.length >= 2);
  assert.equal(new Set(alts.map((a) => a.nodes.join())).size, alts.length);
});

test('sin tiempo de viaje ni sentido único inventados', () => {
  const r = planRoute(buildGraph(net, 'car'), { from: coords[0], to: coords[2] });
  assert.equal(r.etaS, undefined);
  assert.match(LIMITS.travelTime, /no disponible/);
  assert.match(LIMITS.oneway, /no disponible/);
});

test('enlaces: Google con paradas (máx. 9) y Waze solo destino', () => {
  const g = googleMapsUrl({ from: [-0.4, 39.4], to: [-0.38, 39.42], via: [[-0.39, 39.41]], mode: 'bike' });
  const u = new URL(g.url);
  assert.equal(u.searchParams.get('api'), '1');
  assert.equal(u.searchParams.get('waypoints'), '39.410000,-0.390000');
  assert.equal(u.searchParams.get('travelmode'), 'bicycling');
  assert.equal(googleMapsUrl({ from: [0, 0], to: [1, 1], via: Array(12).fill([0.5, 0.5]) }).droppedVia, 3);
  const w = wazeUrl({ to: [-0.38, 39.42] });
  assert.match(w.url, /^https:\/\/waze\.com\/ul\?ll=39\.420000,-0\.380000&navigate=yes/);
  assert.equal(w.viaSupported, false);
});

test('punto en polígono y elementos cerca de la ruta', () => {
  assert.ok(pointInPolygon([0.5, 0.5], [[0, 0], [1, 0], [1, 1], [0, 1]]));
  assert.ok(!pointInPolygon([1.5, 0.5], [[0, 0], [1, 0], [1, 1], [0, 1]]));
  const near = nearRoute([[0, 0], [0.002, 0]], [{ id: 'a', lon: 0.001, lat: 0.0001 }, { id: 'b', lon: 0.05, lat: 0 }], 50);
  assert.deepEqual(near.map((x) => x.id), ['a']);
});

test('red real de l\'Horta Sud (OSM): ruta entre dos servicios y desvío al evitar el agua observada (Copernicus)', () => {
  const d = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/aislamiento/dana_horta_sud.json', import.meta.url)));
  const g = buildGraph(d.red, 'car');
  const s = d.servicios;
  const a = [s[0].lon, s[0].lat], b = [s[s.length - 1].lon, s[s.length - 1].lat];
  const dry = planRoute(g, { from: a, to: b });
  assert.ok(dry.ok, 'hay camino sin restricciones');
  assert.ok(dry.lengthM > haversineM(a, b), 'la ruta es más larga que la línea recta');
  const wet = planRoute(g, { from: a, to: b, avoid: { polygons: d.agua.anillos } });
  assert.ok(!wet.ok || wet.lengthM >= dry.lengthM, 'evitar el agua nunca acorta la ruta');
});
