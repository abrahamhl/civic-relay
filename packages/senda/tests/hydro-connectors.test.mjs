import test from 'node:test';
import assert from 'node:assert/strict';
import { meanSlope, temezHours, kirpichMinutes, velocityEnsemble, arrivalBand, pickBest } from '../src/hydro-estimates.mjs';
import { parseSeries, sha256Hex, valueAt, CONNECTORS, SERIES_KINDS } from '../src/data-connectors.mjs';

test('Témez (Norma 5.2-IC) y Kirpich (SI) con valores calculados a mano', () => {
  // Témez: L = 10 km, J = 0,01 → 0,3·10^0,76·0,01^−0,19 = 0,3·5,7544·2,3988 = 4,141 h
  assert.ok(Math.abs(temezHours(10, 0.01) - 0.3 * 10 ** 0.76 * 0.01 ** -0.19) < 1e-12);
  assert.ok(Math.abs(temezHours(10, 0.01) - 4.141) < 0.001);
  // Kirpich: L = 1000 m, S = 0,01 → 0,0195·1000^0,77·0,01^−0,385 = 0,0195·204,17·5,8884 = 23,44 min
  assert.ok(Math.abs(kirpichMinutes(1000, 0.01) - 23.44) < 0.01);
  assert.ok(Number.isNaN(temezHours(10, 0))); assert.ok(Number.isNaN(kirpichMinutes(-1, 0.01)));
  assert.equal(meanSlope(500, 0, 25000), 0.02); assert.equal(meanSlope(0, 10, 100), 0);
});

test('conjunto de velocidades: cada método con su fuente y su ámbito; abanico de llegada', () => {
  const rows = velocityEnsemble({ lengthM: 41000, slope: 0.02, observed: [{ id: 'cedex', label: 'CEDEX en Chiva', velocityMs: 14, source: 'Roldán (2025)' }] });
  assert.deepEqual(rows.map((r) => r.id), ['temez', 'kirpich', 'cedex']);
  for (const r of rows) { assert.ok(r.source && r.validity && r.velocityMs > 0); }
  assert.match(rows.find((r) => r.id === 'kirpich').validity, /fuera/);
  const band = arrivalBand(41000, rows); assert.ok(band.minMin < band.maxMin); assert.ok(Math.abs(band.minMin - 41000 / 14 / 60) < 1e-9);
});

test('pickBest: lo medido manda sobre lo observado y lo estimado', () => {
  assert.equal(pickBest([{ basis: 'ESTIMACION', value: 2 }, { basis: 'OBSERVADO_EXTERNO', value: 14 }]).value, 14);
  assert.equal(pickBest([{ basis: 'ESTIMACION', value: 2 }, { basis: 'MEDIDO', value: 5 }]).why, 'hay dato medido conectado');
  assert.equal(pickBest([{ basis: 'MEDIDO', value: NaN }]), null);
});

test('conector CSV: exige zona horaria, fuente, orden y valores válidos; acepta ; y coma decimal', () => {
  const src = { name: 'Aforo de prueba', license: 'propia' };
  const ok = parseSeries('hora;valor\n2024-10-29T12:20+01:00;264\n2024-10-29T18:55+01:00;2282,5\n', { kind: 'caudal', source: src });
  assert.equal(ok.ok, true); assert.equal(ok.points[1].value, 2282.5); assert.equal(ok.points[0].iso, '2024-10-29T11:20:00.000Z'); assert.equal(ok.unit, 'm³/s');
  const bad = parseSeries('hora,valor\n2024-10-29 18:55,100\n2024-10-29T19:30Z,10\n2024-10-29T19:00Z,-3\n2024-10-29T18:00Z,5\n', { kind: 'caudal', source: src });
  assert.equal(bad.ok, false); assert.equal(bad.errors.length, 3);
  assert.match(bad.errors[0].msg, /zona horaria/); assert.match(bad.errors[1].msg, /valor no válido/); assert.match(bad.errors[2].msg, /orden creciente/); assert.equal(bad.points.length, 1);
  assert.match(parseSeries('hora,valor\n2024-10-29T18:00Z,5', { kind: 'caudal' }).errors[0].msg, /fuente/);
  const j = parseSeries(JSON.stringify([{ hora: '2024-10-29T17:00Z', valor: 1 }, { hora: '2024-10-29T18:00Z', valor: 3 }]), { kind: 'lluvia', source: src });
  assert.equal(j.ok, true); assert.equal(valueAt(j, Date.parse('2024-10-29T17:30Z')).value, 1); assert.equal(valueAt(j, Date.parse('2024-10-29T16:00Z')), null);
  assert.equal(parseSeries('x', { kind: 'otra', source: src }).ok, false);
});

test('huella SHA-256 conocida y catálogo de conectores sin estados inventados', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const c of CONNECTORS) assert.ok(['conectado', 'importable', 'requiere_clave', 'requiere_convenio'].includes(c.status));
  assert.ok(Object.values(SERIES_KINDS).every((k) => k.unit));
});
