import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_STYLES, satelliteStyle, orthoCovers, circlePolygon } from '../src/map-style.mjs';
import { haversineM } from '../src/route-planner.mjs';

test('tipos de mapa: cuatro, con satélite propio', () => {
  assert.deepEqual(Object.keys(MAP_STYLES), ['mapa', 'claro', 'noche', 'satelite']);
  const s = satelliteStyle();
  assert.equal(s.version, 8);
  assert.equal(s.sources.pnoa.scheme, 'tms', 'PNOA es TMS (y invertida): comprobado con una tesela real de San Martín de Valdeiglesias');
  assert.match(s.sources.pnoa.attribution, /CC BY 4\.0/); assert.match(s.sources.pdok.attribution, /CC BY 4\.0/);
});

test('cobertura de ortofoto: España y Países Bajos sí, Francia central no', () => {
  assert.ok(orthoCovers([-4.3986, 40.3595])); // San Martín de Valdeiglesias
  assert.ok(orthoCovers([5.8616, 50.9718]));  // Geleen
  assert.ok(!orthoCovers([2.35, 46.5]));
});

test('círculo de precisión: todos los vértices a la distancia pedida (±0,5 %)', () => {
  const c = [5.8616, 50.9718], f = circlePolygon(c, 25);
  const ring = f.geometry.coordinates[0];
  assert.equal(ring.length, 65); assert.deepEqual(ring[0], ring.at(-1));
  for (const p of ring) assert.ok(Math.abs(haversineM(c, p) - 25) < 0.125);
});
