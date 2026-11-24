import test from 'node:test';
import assert from 'node:assert/strict';
import { packReports, unpackReports, mergeReports, isReportPack, MAGIC } from '../src/hazard-share.mjs';
import { HAZARD_BYTES } from '../src/road-guard.mjs';

const NOW = Date.UTC(2026, 10, 24, 18);
const mine = [
  { kind: 'accidente', lat: 39.4251, lon: -0.4171, t: NOW - 60_000, own: true },
  { kind: 'animal', lat: 39.43, lon: -0.41, t: NOW - 3_600_000, own: true },
  { kind: 'obras', lat: 39.44, lon: -0.40, t: NOW - 8 * 3_600_000, own: true }, // viejo: no se comparte
];

test('empaqueta solo lo reciente: 3 bytes de cabecera + 24 por aviso', () => {
  const p = packReports(mine, { now: NOW, rnd: () => 7 });
  assert.equal(p[0], MAGIC); assert.equal(p[2], 2);
  assert.equal(p.length, 3 + 2 * HAZARD_BYTES);
  assert.ok(isReportPack(p));
});

test('ida y vuelta: tipo, posición (±1 cm) y hora (s) se conservan; lo recibido queda sin verificar', () => {
  const { reports, rejected } = unpackReports(packReports(mine, { now: NOW }));
  assert.equal(rejected, 0);
  assert.deepEqual(reports.map((r) => r.kind), ['accidente', 'animal']);
  assert.ok(Math.abs(reports[0].lat - 39.4251) < 1e-6 && Math.abs(reports[0].lon + 0.4171) < 1e-6);
  assert.equal(reports[0].t, Math.floor((NOW - 60_000) / 1000) * 1000);
  assert.ok(reports.every((r) => r.own === false && r.verified === null && r.hops === 1));
});

test('una trama manipulada (coordenadas imposibles) se descarta y no tumba el resto', () => {
  const p = packReports(mine, { now: NOW });
  const dv = new DataView(p.buffer); dv.setInt32(3 + 6, 2_000_000_000); // latitud 200° en la primera trama
  const { reports, rejected } = unpackReports(p);
  assert.equal(rejected, 1); assert.equal(reports.length, 1);
});

test('paquetes con tamaño o versión incorrectos se rechazan', () => {
  assert.throws(() => unpackReports(new Uint8Array([MAGIC, 1, 3, 0])), /tamaño/);
  assert.throws(() => unpackReports(new Uint8Array([MAGIC, 9, 0])), /versión/);
  assert.throws(() => unpackReports(new Uint8Array([0x7b, 1, 0])), /no es un paquete/);
});

test('fusión sin duplicados: el mismo aviso recibido dos veces no se repite', () => {
  const got = unpackReports(packReports(mine, { now: NOW })).reports;
  const a = mergeReports(mine, got);
  assert.equal(a.added, 0, 'son mis propios avisos devueltos');
  const otro = [{ kind: 'accidente', lat: 39.50, lon: -0.30, t: NOW, own: false }];
  const b = mergeReports(mine, otro);
  assert.equal(b.added, 1);
  assert.equal(mergeReports(b.reports, otro).added, 0);
});

test('merge: otro móvil que vio lo mismo cuenta como confirmación; el eco del mismo aviso no', async () => {
  const { mergeReports } = await import('../src/hazard-share.mjs');
  const mine = { kind: 'accidente', lat: 39.47, lon: -0.38, t: 1_000_000, id: 7 };
  const echo = { ...mine };
  const other = { kind: 'accidente', lat: 39.4701, lon: -0.3801, t: 1_060_000, id: 9 };
  const a = mergeReports([mine], [echo]);
  assert.equal(a.confirmed, 0); assert.equal(a.added, 0);
  const b = mergeReports([mine], [other]);
  assert.equal(b.confirmed, 1); assert.deepEqual(b.reports[0].seen, [1_060_000]);
  assert.equal(mergeReports(b.reports, [other]).confirmed, 0, 'la misma confirmación no se cuenta dos veces');
});
