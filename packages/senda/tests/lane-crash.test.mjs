import test from 'node:test';
import assert from 'node:assert/strict';
import { laneGuide, laneSvg } from '../src/lane-guide.mjs';
import { clusterCrashes, clusterIconSvg } from '../src/crash-cluster.mjs';

test('guía de carriles: texto llano y pictograma, sin inventar carriles', () => {
  assert.equal(laneGuide(null), null); assert.equal(laneSvg([]), '');
  assert.equal(laneGuide([{ indications: ['straight'], valid: false }, { indications: ['straight'], valid: true }, { indications: ['straight', 'right'], valid: true }]).text, '3 carriles · usa los 2 de la derecha');
  assert.equal(laneGuide([{ indications: ['left'], valid: true }, { indications: ['straight'], valid: false }]).text, '2 carriles · usa el de la izquierda');
  assert.equal(laneGuide([{ indications: ['straight'], valid: true }, { indications: ['straight'], valid: true }]).text, '2 carriles · cualquiera vale');
  const svg = laneSvg([{ indications: ['straight'], valid: false }, { indications: ['right'], valid: true }]); assert.match(svg, /^<svg/); assert.match(svg, /usa el de la derecha/);
});

test('un accidente, tres móviles: un solo incidente corroborado, posición fusionada y carril más peligroso', () => {
  assert.throws(() => clusterCrashes([], {}), /sin valores por defecto/);
  const base = { lat: 50.85, lon: 4.35 }, m = 1 / 111320; // 1 m en grados de latitud
  const ds = [
    { id: 'furgoneta', tS: 100, lat: base.lat, lon: base.lon, accM: 5, state: 'LIKELY_CRASH', lane: 'SHOULDER', vehicle: 'A' },
    { id: 'taxi', tS: 101, lat: base.lat + 8 * m, lon: base.lon, accM: 10, state: 'LIKELY_CRASH', lane: 'SHOULDER', vehicle: 'B', wellbeing: 'OK' },
    { id: 'coche', tS: 101.5, lat: base.lat + 14 * m, lon: base.lon, accM: 10, state: 'CHECK_USER', lane: 'RIGHT_LANE', vehicle: 'C', wellbeing: 'NEEDS_HELP' },
    { id: 'otro', tS: 900, lat: base.lat + 0.01, lon: base.lon, accM: 5, state: 'CHECK_USER' },
  ];
  const cs = clusterCrashes(ds, { windowS: 60, radiusM: 50 });
  assert.equal(cs.length, 2); const c = cs[0];
  assert.equal(c.devices, 3); assert.equal(c.vehiclesDeclared, 3); assert.equal(c.state, 'CORROBORATED'); assert.equal(c.lane, 'RIGHT_LANE'); assert.equal(c.liveLaneBlocked, true);
  // media ponderada 1/σ²: pesos 1/25, 1/100, 1/100 → (0·4 + 8 + 14)/6 = 3,67 m al norte; σ = 1/√(0,04+0,01+0,01) = 4,08 m
  assert.ok(Math.abs((c.lat - base.lat) / m - 22 / 6) < 0.05, `${(c.lat - base.lat) / m}`); assert.equal(c.sigmaM, 4.1);
  assert.equal(c.needHelp, 1); assert.equal(c.ok, 1); assert.equal(cs[1].state, 'UNVERIFIED');
  assert.match(clusterIconSvg(c), /×3/);
  // sin precisión en algún fijo: media simple y σ sin inventar
  const nb = clusterCrashes([{ id: 'a', tS: 0, lat: 0, lon: 0, accM: 5 }, { id: 'b', tS: 1, lat: 2 * m, lon: 0, accM: null }], { windowS: 60, radiusM: 50 })[0];
  assert.equal(nb.sigmaM, null); assert.equal(nb.devices, 2); assert.ok(Math.abs(nb.lat / m - 1) < 0.01);
});
