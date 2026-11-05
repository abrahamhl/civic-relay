import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORMS, INTEGRATIONS, PLAYBOOKS, EVENTS, ACCESS, planDeployment } from '../src/platforms.mjs';

test('cada integración declara un modo de acceso válido y lo prohibido queda en NUNCA', () => {
  for (const i of INTEGRATIONS) assert.ok(Object.keys(ACCESS).includes(i.access), i.id);
  for (const id of ['scada-ajeno', 'interceptar', 'emitir-sin-licencia']) assert.equal(INTEGRATIONS.find((i) => i.id === id).access, 'NUNCA');
  assert.equal(INTEGRATIONS.find((i) => i.id === 'eolicos').access, 'PASIVO');
});

test('plan de terremoto: solo con móviles falta «detectar»; con dron y ESP32 queda cubierto', () => {
  assert.deepEqual(planDeployment('terremoto', ['movil-web', 'pc']).gaps, ['detectar']);
  assert.deepEqual(planDeployment('terremoto', ['movil-web', 'android', 'dron', 'esp32', 'pc']).gaps, []);
});

test('zona de conflicto lleva salvaguarda y los hechos citados tienen lección y módulo', () => {
  assert.match(planDeployment('conflicto', ['movil-web']).guard, /no se activan/);
  for (const e of EVENTS) assert.ok(e.lesson && e.modules.length, e.id);
  assert.ok(Object.keys(PLAYBOOKS).length >= 8 && PLATFORMS.length >= 10);
});
