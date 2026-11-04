import test from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage, earliestArrival, normalizeContacts } from '../src/router.mjs';
import { buildLadder, runLadder } from '../src/ladder.mjs';
import { scenarioArnhemSanMartin } from '../src/scenarios.mjs';

const far = 1e6;

test('elige la cadena más rápida combinando canales distintos', () => {
  const r = routeMessage({ t0: 0, source: 'a', dest: 'b', contacts: [
    { from: 'a', to: 'INTERNET', channel: 'CELL_DATA', start: 0, end: far },
    { from: 'INTERNET', to: 'b', channel: 'CELL_DATA', start: 3600, end: far },
    { from: 'INTERNET', to: 'relay', channel: 'SAT_BROADBAND', start: 0, end: far },
    { from: 'relay', to: 'b', channel: 'BLE', start: 60, end: 600 },
  ] });
  assert.equal(r.status, 'DELIVERABLE');
  assert.deepEqual(r.routes[0].path, ['a', 'INTERNET', 'relay', 'b']);
  assert.ok(r.etaSeconds < 61 && r.etaSeconds >= 60);
  assert.ok(r.advantageS > 3500, 'debe ganar a la línea base WhatsApp');
});

test('respeta ventanas: un contacto que ya terminó no sirve', () => {
  const r = earliestArrival({ t0: 1000, source: 'a', dest: 'b', contacts: normalizeContacts([{ from: 'a', to: 'b', channel: 'BLE', start: 0, end: 900 }]) });
  assert.equal(r, null);
});

test('un mensaje grande no cabe en un paso de satélite corto', () => {
  const contacts = [{ from: 'a', to: 'b', channel: 'SAT_D2D_SMS', start: 0, end: 60 }];
  assert.ok(routeMessage({ t0: 0, source: 'a', dest: 'b', contacts, sizeBytes: 140 }).status === 'DELIVERABLE');
  assert.equal(routeMessage({ t0: 0, source: 'a', dest: 'b', contacts, sizeBytes: 20_000 }).status, 'NO_ROUTE');
});

test('sin ninguna cadena de contactos responde NO_ROUTE con explicación, no promete entrega', () => {
  const r = routeMessage({ t0: 0, source: 'a', dest: 'b', contacts: [{ from: 'a', to: 'INTERNET', channel: 'CELL_DATA', start: 0, end: far }] });
  assert.equal(r.status, 'NO_ROUTE');
  assert.match(r.explanation, /No existe/);
});

test('S01: con vecinos llega en minutos, WhatsApp en 8 h; lanza rutas alternativas', () => {
  const s = scenarioArnhemSanMartin();
  assert.equal(s.plan.status, 'DELIVERABLE');
  assert.ok(s.plan.etaMinutes < 10);
  assert.equal(s.plan.whatsappBaselineMinutes, 480);
  assert.ok(s.plan.routes.length >= 2);
  assert.ok(s.plan.routes.some((r) => r.channels.includes('SAT_D2D_SMS')));
});

test('S01 sin alternativas: SENDA nunca es peor que WhatsApp (ventaja 0, no inventa)', () => {
  const s = scenarioArnhemSanMartin({ neighbours: false, d2d: false });
  assert.equal(s.plan.advantageMinutes, 0);
});

test('escalera: envía ya por lo disponible, pide un toque para encender radios y espera ventanas', () => {
  const now = 0;
  const ladder = buildLadder({ now, sizeBytes: 140, activation: { relayActive: true }, battery: 60,
    radios: { BLE: { enabled: true, permission: true, peersOrLink: true }, WIFI_DIRECT: { enabled: false, permission: true, peersOrLink: false }, CELL_DATA: { enabled: true, permission: true, peersOrLink: false } },
    windows: [{ channel: 'SAT_D2D_SMS', start: 240, end: 600 }] });
  assert.equal(ladder[0].action, 'SEND_NOW');
  assert.equal(ladder[0].channel, 'BLE');
  assert.ok(ladder.some((s) => s.channel === 'WIFI_DIRECT' && s.action === 'PROMPT_USER_ENABLE'));
  assert.ok(ladder.some((s) => s.action === 'WAIT_WINDOW'));
});

test('escalera: si el primer canal falla, baja al siguiente', async () => {
  const ladder = [{ channel: 'BLE', action: 'SEND_NOW', etaS: 1 }, { channel: 'WIFI_DIRECT', action: 'SEND_NOW', etaS: 2 }, { channel: 'SMS', action: 'SEND_NOW', etaS: 9 }];
  const r = await runLadder(ladder, async (s) => s.channel === 'SMS', { parallel: 1 });
  assert.equal(r.delivered, true);
  assert.equal(r.via, 'SMS');
  assert.equal(r.log.length, 3);
});
