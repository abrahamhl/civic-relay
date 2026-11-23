import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL_LINKS, survivesCellBlackout } from '../src/external-links.mjs';

test('ningún enlace externo trae caudal ni alcance sin medir', () => {
  for (const [id, l] of Object.entries(EXTERNAL_LINKS)) {
    assert.equal(l.rateBps, null, `${id}: caudal sin fuente debe ser null`);
    assert.equal(l.rangeM, null, `${id}: alcance sin fuente debe ser null`);
  }
});

test('toda entrada declara fuente, grado, fecha y lo que no se sabe', () => {
  for (const [id, l] of Object.entries(EXTERNAL_LINKS)) {
    assert.match(l.source, /^https:\/\//, id);
    assert.ok(['PRIMARY', 'SECONDARY', 'UNVERIFIED'].includes(l.sourceGrade), id);
    assert.match(l.checked, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(l.claims.length > 0 && l.unknown.length > 0, id);
  }
});

test('apagón celular: el walkie 4G cae; la V16 solo guarda y reenvía; Xiaomi depende de SIM, no de torres', () => {
  assert.equal(survivesCellBlackout('CELL_POC_RADIO'), 'NO');
  assert.equal(survivesCellBlackout('HYBRID_POC_ANALOG_RADIO'), 'NO');
  assert.equal(survivesCellBlackout('V16_CONNECTED'), 'STORE_AND_FORWARD');
  assert.equal(survivesCellBlackout('XIAOMI_OFFLINE_CALL'), 'SI_SEGUN_FABRICANTE');
  assert.throws(() => survivesCellBlackout('NO_EXISTE'));
});

test('Xiaomi: el fabricante advierte que no es para emergencias y exige SIM', () => {
  const x = EXTERNAL_LINKS.XIAOMI_OFFLINE_CALL;
  assert.ok(x.needs.includes('SIM_INSTALLED'));
  assert.ok(x.claims.some((c) => /no está pensada para comunicaciones de emergencia/.test(c)));
});
