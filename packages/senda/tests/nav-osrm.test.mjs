import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeUrl, parseRoute, instructionEs, nextManeuver, shouldReroute, announcement, distToRoute } from '../src/nav-osrm.mjs';

// Respuesta REAL de OSRM (FOSSGIS) guardada el 2026-11-23: Valencia, 7,4 km.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/osrm_valencia_2026-11-23.json', import.meta.url)));

test('URL de OSRM con pasos, geometría y alternativas', () => {
  const u = routeUrl({ from: [-0.417, 39.425], to: [-0.3763, 39.4699], via: [[-0.4, 39.44]] });
  assert.match(u, /^https:\/\/router\.project-osrm\.org\/route\/v1\/driving\/-0\.417000,39\.425000;-0\.400000,39\.440000;-0\.376300,39\.469900\?/);
  assert.match(u, /steps=true/); assert.match(u, /geometries=geojson/);
});

test('ruta real: distancia, duración e instrucciones en español', () => {
  const r = parseRoute(fixture);
  assert.ok(r.ok);
  assert.equal(Math.round(r.distanceM), 7382);
  assert.equal(r.basis, 'ESTIMACION_OSRM_SIN_TRAFICO');
  assert.equal(r.steps[1].text, 'Gira a la izquierda por Carrer Catarroja');
  assert.equal(r.steps.at(-1).text, 'Has llegado a tu destino');
  assert.ok(r.steps.every((s) => typeof s.text === 'string' && s.text.length > 3));
});

test('instrucciones: rotonda con salida, incorporación y bifurcación', () => {
  assert.equal(instructionEs({ name: 'CV-400', maneuver: { type: 'roundabout', exit: 2 } }), 'En la rotonda, toma la 2ª salida por CV-400');
  assert.equal(instructionEs({ name: '', maneuver: { type: 'merge', modifier: 'slight left' } }), 'Incorpórate ligeramente a la izquierda');
  assert.equal(instructionEs({ name: 'A-7', maneuver: { type: 'fork', modifier: 'right' } }), 'En la bifurcación, ve a la derecha por A-7');
});

test('siguiente maniobra y avisos hablados a 500/150/30 m sin repetirse', () => {
  const r = parseRoute(fixture);
  const start = r.coords[0];
  const n = nextManeuver(r, start);
  assert.equal(n.step.text, r.steps[1].text);
  assert.ok(n.distM >= 0);
  const said = new Set();
  const a1 = announcement({ step: n.step, distM: 140 }, said);
  assert.match(a1, /^En 140 metros, gira a la izquierda/);
  assert.equal(announcement({ step: n.step, distM: 120 }, said), null, 'no se repite en la misma franja');
  assert.equal(announcement({ step: n.step, distM: 20 }, said), n.step.text);
});

test('salirse de la ruta: recalcula solo si está lejos y ha pasado el tiempo mínimo', () => {
  const r = parseRoute(fixture);
  const lejos = [r.coords[0][0] + 0.01, r.coords[0][1] + 0.01];
  assert.ok(distToRoute(r, r.coords[5]) < 1);
  assert.equal(shouldReroute(r, lejos, 0, 40), true);
  assert.equal(shouldReroute(r, lejos, 20, 40), false);
  assert.equal(shouldReroute(r, r.coords[5], 0, 40), false);
});

test('respuesta de error de OSRM: no inventa ruta', () => {
  assert.deepEqual(parseRoute({ code: 'NoRoute' }), { ok: false, reason: 'NoRoute' });
});
