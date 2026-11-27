import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeUrl, parseRoute, instructionEs, nextManeuver, shouldReroute, announcement, distToRoute, snapToRoute, parseGpxTrack } from '../src/nav-osrm.mjs';

// Respuesta REAL de OSRM (FOSSGIS) guardada el 2026-11-23: Valencia, 7,4 km.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/osrm_valencia_2026-11-23.json', import.meta.url)));
const gpxXml = readFileSync(new URL('./fixtures/osm_valencia_pista_silla_2023-06-24.gpx', import.meta.url), 'utf8');

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

test('recta larga sin vértices intermedios: no salta la maniobra 100 m antes del cruce y anuncia dos giros con igual texto', () => {
  // Segmento recto de ~555 m hacia el norte y giro a la derecha al final
  const route = {
    coords: [[-0.37, 39.4200], [-0.37, 39.4250], [-0.365, 39.4250]],
    steps: [
      { type: 'depart', text: 'Sal', at: [-0.37, 39.4200], lanes: null },
      { type: 'turn', modifier: 'right', text: 'Gira a la derecha', at: [-0.37, 39.4250], lanes: null },
      { type: 'turn', modifier: 'right', text: 'Gira a la derecha', at: [-0.365, 39.4250], lanes: null },
      { type: 'arrive', text: 'Has llegado a tu destino', at: [-0.365, 39.4250], lanes: null },
    ],
  };
  // A ~25 m antes del primer giro (más cerca del vértice B que de A): sigue apuntando al primer giro
  const nearTurn = [-0.37, 39.42478];
  const n1 = nextManeuver(route, nearTurn);
  assert.equal(n1.stepIndex, 1);
  assert.ok(n1.distM > 15 && n1.distM < 35, `distM esperado ~24 m, obtenido ${n1.distM}`);
  const said = new Set();
  assert.equal(announcement(n1, said), 'Gira a la derecha');
  assert.equal(announcement(n1, said), null);
  // Segundo giro distinto con idéntico texto: sí se anuncia
  const n2 = nextManeuver(route, [-0.3653, 39.4250]);
  assert.equal(n2.stepIndex, 2);
  assert.equal(announcement(n2, said), 'Gira a la derecha');
  const snap = snapToRoute(route.coords, nearTurn, 20);
  assert.ok(snap && Math.abs(snap.bearingDeg - 0) < 2);
});

test('parseGpxTrack lee la traza GPX pública real de OpenStreetMap (Valencia, 198 puntos)', () => {
  const pts = parseGpxTrack(gpxXml);
  assert.equal(pts.length, 198);
  assert.ok(pts[0].tMs > 1_600_000_000_000);
  assert.ok(pts.some((p) => p.speedMs != null && p.speedMs > 5));
  assert.ok(pts.every((p) => Number.isFinite(p.headingDeg) && p.headingDeg >= 0 && p.headingDeg < 360));
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

test('ruta por medio de transporte: coche, bici y a pie van a su servidor', async () => {
  const { routeUrl } = await import('../src/nav-osrm.mjs');
  const a = { from: [5.86, 50.97], to: [5.87, 50.98] };
  assert.match(routeUrl(a), /^https:\/\/router\.project-osrm\.org\/route\/v1\/driving\//);
  assert.match(routeUrl({ ...a, mode: 'bike' }), /^https:\/\/routing\.openstreetmap\.de\/routed-bike\/route\/v1\/driving\//);
  assert.match(routeUrl({ ...a, mode: 'foot' }), /^https:\/\/routing\.openstreetmap\.de\/routed-foot\/route\/v1\/driving\//);
});
