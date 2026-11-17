import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatex2, toHazards, corridorPack, msiAdvice, SAMPLE_DATEX2 } from '../src/datex2.mjs';
import { HAZARD, ROUTE_MAD_VLC } from '../src/road-guard.mjs';

test('DATEX II v3: lee tipo, validez, coordenadas (punto y línea), carretera y subtipos', () => {
  const r = parseDatex2(SAMPLE_DATEX2);
  assert.equal(r.length, 5);
  assert.deepEqual([r[0].type, r[0].status, r[0].lat, r[0].lon, r[0].road], ['Accident', 'active', 40.201, -3.3005, 'A-3']);
  assert.equal(r[2].line.length, 2); assert.equal(r[2].lat, 39.562);
  assert.deepEqual(r[1].subtypes.poorEnvironmentType, ['fog']);
});

test('DATEX II sin prefijos (versión 2) también se lee', () => {
  const v2 = '<situation id="x"><situationRecord id="r9" version="1" xsi:type="AnimalPresenceObstruction"><validity><validityStatus>active</validityStatus></validity><latitude>52.1</latitude><longitude>5.1</longitude></situationRecord></situation>';
  const h = toHazards(parseDatex2(v2)); assert.equal(h[0].type, HAZARD.ANIMAL); assert.equal(h[0].lat, 52.1);
});

test('a peligros SENDA: niebla, carril cerrado y accidente; lo suspendido no se avisa; solo lo de tu ruta va a la reserva', () => {
  const h = toHazards(parseDatex2(SAMPLE_DATEX2));
  assert.deepEqual(h.map((x) => x.type), [HAZARD.CRASH, HAZARD.FOG, HAZARD.LANE_CLOSED, HAZARD.STOPPED]);
  const p = corridorPack(h, ROUTE_MAD_VLC);
  assert.deepEqual(p.hazards.map((x) => x.id), ['EJ-1-1', 'EJ-2-1', 'EJ-3-1']); assert.equal(p.dropped, 1);
  assert.ok(p.hazards.every((x, i, a) => !i || a[i - 1].alongKm <= x.alongKm));
});

test('señales de carril neerlandesas: rood kruis a la izquierda → pásate a la derecha, con la velocidad obligatoria, en neerlandés y en español', () => {
  const nl = msiAdvice([{ s: 1600, lanes: ['X', '70', '70'] }, { s: 3000, lanes: ['END', 'END', 'END'] }], 1000);
  assert.deepEqual([nl.atM, nl.closedLanes, nl.mergeTo, nl.speedLimit], [600, [1], 'R', 70]);
  assert.equal(nl.say, 'Over 600 meter. Rood kruis op rijstrook 1: voeg in naar rechts. Maximaal 70.');
  assert.match(msiAdvice([{ s: 1600, lanes: ['90', '90', 'X'] }], 1000, { lang: 'es' }).say, /Carril 3 cerrado.*izquierda/);
  assert.equal(msiAdvice([{ s: 900, lanes: ['X'] }], 1000), null, 'un pórtico que ya has pasado no cuenta');
});
