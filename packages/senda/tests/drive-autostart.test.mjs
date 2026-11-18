import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAutostart, buildAutostartVectors, EXAMPLE_AUTOSTART, AUTOSTART_STATES } from '../src/drive-autostart.mjs';

const P = EXAMPLE_AUTOSTART; // escenario DECLARADO de ejemplo (sin fuente verificada)

test('veracidad: sin umbrales declarados no se crea; eventos sin hora o desconocidos se rechazan', () => {
  assert.throws(() => createAutostart({}), /«confirmSpeedMs» debe declararse/);
  assert.throws(() => createAutostart({ ...P, endGraceS: undefined }), /«endGraceS» debe declararse/);
  const m = createAutostart(P);
  assert.throws(() => m.handle({ type: 'TICK' }), /«t» debe declararse/);
  assert.throws(() => m.handle({ type: 'TELEPORT', t: 0 }), /evento desconocido/);
  assert.throws(() => m.handle({ type: 'SPEED', t: 0 }), /«ms» debe declararse/);
});

test('consentimiento: nada automático sin él; retirarlo cierra la sesión; el conductor siempre puede arrancar a mano', () => {
  const m = createAutostart(P);
  assert.equal(m.handle({ type: 'CAR_LINK_APPEARED', t: 0 }).state, 'OFF');
  assert.deepEqual(m.handle({ type: 'USER_START', t: 1 }).actions, [{ type: 'START_SESSION', reason: 'USER_START' }]);
  m.handle({ type: 'USER_STOP', t: 2 });
  assert.equal(m.handle({ type: 'CONSENT', t: 3, autoStart: true }).state, 'IDLE');
  m.handle({ type: 'CAR_LINK_APPEARED', t: 4 });
  assert.deepEqual(m.handle({ type: 'CONSENT', t: 5, autoStart: false }), { state: 'OFF', actions: [{ type: 'STOP_SESSION', reason: 'CONSENT_REVOKED' }] });
});

test('pista débil (autobús, pasajero): no arranca sin confirmar velocidad en la ventana', () => {
  const m = createAutostart(P);
  m.handle({ type: 'CONSENT', t: 0, autoStart: true }); m.handle({ type: 'VEHICLE_HINT_ENTER', t: 0 });
  assert.equal(m.handle({ type: 'SPEED', t: 10, ms: P.confirmSpeedMs - 0.1 }).actions.length, 0);
  assert.equal(m.handle({ type: 'TICK', t: P.confirmWindowS + 1 }).state, 'IDLE');
});

test('cada transición cae en un estado conocido y cada sesión que arranca termina con un STOP', () => {
  const txt = buildAutostartVectors(P), starts = (txt.match(/START_SESSION/g) ?? []).length, stops = (txt.match(/STOP_SESSION/g) ?? []).length;
  for (const line of txt.split('\n').filter((l) => l.startsWith('E '))) assert.ok(AUTOSTART_STATES.includes(line.split(' => ')[1].split(' ')[0]), line);
  assert.ok(starts > 0 && stops > 0);
});

test('conformidad: el fichero de vectores que leen Android e iOS está al día con esta referencia', () => {
  const onDisk = readFileSync(new URL('../conformance/drive-autostart.vectors.txt', import.meta.url), 'utf8');
  assert.equal(onDisk, buildAutostartVectors(P), 'regenera con: node packages/senda/scripts/build-autostart-vectors.mjs');
});
