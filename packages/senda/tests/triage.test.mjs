import test from 'node:test';
import assert from 'node:assert/strict';
import { startTriage, firstAid, routeFor, tally, compactReport } from '../src/triage.mjs';

test('START: tabla de decisión', () => {
  assert.equal(startTriage({ walks: true }).cat, 'VERDE');
  assert.equal(startTriage({ breathes: false, breathesAfterAirway: true }).cat, 'ROJO');
  assert.equal(startTriage({ breathes: false, breathesAfterAirway: false }).cat, 'SIN_RESPIRACION');
  assert.equal(startTriage({ breathes: true, rr: 34 }).cat, 'ROJO');
  assert.equal(startTriage({ breathes: true, rr: 20, radialPulse: false }).cat, 'ROJO');
  assert.equal(startTriage({ breathes: true, rr: 20, radialPulse: true, capRefillS: 3 }).cat, 'ROJO');
  assert.equal(startTriage({ breathes: true, rr: 20, radialPulse: true, capRefillS: 1, obeys: false }).cat, 'ROJO');
  assert.equal(startTriage({ breathes: true, rr: 20, radialPulse: true, capRefillS: 1, obeys: true }).cat, 'AMARILLO');
});

test('una sola víctima que no respira: RCP (100–120/min, 5–6 cm), nunca «fallecido»', () => {
  const r = startTriage({ breathes: false, breathesAfterAirway: false }, { mci: false });
  assert.equal(r.cat, 'PARADA'); assert.match(firstAid(r).join(' '), /100–120 por minuto, 5–6 cm/);
  for (const c of ['ROJO', 'AMARILLO', 'VERDE', 'SIN_RESPIRACION', 'PARADA']) assert.doesNotMatch(JSON.stringify(startTriage({ walks: c === 'VERDE' })), /fallecid|muert/i);
});

test('el 112 siempre primero y el parte cabe en un SMS', () => {
  assert.deepEqual(routeFor({ medical: true, trapped: true }), ['112', 'Sanitario', 'Bomberos']);
  assert.equal(routeFor({ mountain: true })[0], '112');
  const counts = tally([startTriage({ walks: true }), startTriage({ breathes: true, rr: 40 }), startTriage({ breathes: true, rr: 20, radialPulse: true, obeys: true })]);
  const m = compactReport({ counts, lat: 39.4521, lon: -0.4302, accM: 8, floor: 3, needs: ['atrapados 1', 'hemorragia 1'], services: routeFor({ medical: true, trapped: true }), hhmm: '18:42' });
  assert.ok(m.length <= 160, String(m.length)); assert.match(m, /R1 A1 V1/);
});
