// Formato compartido web ↔ Android ↔ ESP32: los mismos vectores están en
// apps/senda-android/.../SendaFormatsTest.java y hardware/esp32-survey/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beaconIdOf, encodeBeaconFrame, decodeBeaconFrame, frameToHex, frameFromHex, crc8, nativeActionLink, parseSurvey } from '../src/beacon.mjs';
import { prepareBuilding, locateAccessPoints } from '../src/building-twin.mjs';

test('vectores compartidos: id de baliza, trama y CRC-8', async () => {
  assert.equal(crc8(new TextEncoder().encode('123456789')), 0xf4); // valor de comprobación estándar CRC-8/SMBUS
  const id = await beaconIdOf('SENDA-TEST');
  assert.equal(id, '76f202336769f0e2');
  const f = encodeBeaconFrame({ status: 'TRAPPED', battery: 37, floor: 3, unit: 'B', beaconId: id, seq: 258 });
  assert.equal(frameToHex(f), '534e010325034276f202336769f0e20102e1');
  assert.deepEqual(decodeBeaconFrame(frameFromHex('534e0100fffe0076f202336769f0e2000022')), { status: 'UNKNOWN', battery: null, floor: -2, unit: null, beaconId: id, seq: 0 });
});

test('una trama alterada o ajena se descarta', () => {
  const f = frameFromHex('534e010325034276f202336769f0e20102e1');
  f[4] = 99; assert.equal(decodeBeaconFrame(f), null);
  assert.equal(decodeBeaconFrame(new Uint8Array(18)), null);
});

test('enlace a la app nativa lleva acciones, id y perfil', () => {
  const u = new URL(nativeActionLink({ actions: ['BLE_BEACON', 'WIFI_SCAN'], beaconId: '76f202336769f0e2', profile: { buildingId: 'B14', floor: 3, unit: 'B' }, battery: 37, cmdId: 'abc' }));
  assert.equal(u.protocol, 'senda:'); assert.equal(u.searchParams.get('a'), 'BLE_BEACON,WIFI_SCAN'); assert.equal(u.searchParams.get('f'), '3');
});

test('línea JSONL de SENDA Android (literal idéntico al test Java) se importa', () => {
  const line = '{"x":4.5,"y":12,"z":7.5,"bssid":"aa:bb:cc:dd:ee:01","ssid":"Casa \\"3B\\"","rssi":-61,"t":1793000000,"connected":true,"internet":true,"source":"android"}';
  const [r] = parseSurvey(line);
  assert.deepEqual([r.x, r.y, r.z, r.bssid, r.ssid, r.rssi, r.connected, r.internet], [4.5, 12, 7.5, 'aa:bb:cc:dd:ee:01', 'Casa "3B"', -61, true, true]);
  assert.throws(() => parseSurvey('{"x":1,"y":1,"z":1,"bssid":"a","rssi":12,"t":1}'), /rssi/);
});

test('balizas de teléfonos atrapados → se localizan con la misma trilateración que los routers', () => {
  const m = (x, y) => ({ lat: y / 111320, lon: x / 111320 });
  const b = prepareBuilding({ id: 'B14', levels: 6, unitsPerFloor: 4, footprint: [m(0, 0), m(20, 0), m(20, 16), m(0, 16), m(0, 0)] }, { lat: 0, lon: 0 });
  const phone = { x: 15, y: 4, z: 3 * 3 + 1.2 }; // planta 3
  const rows = [];
  for (let fl = 0; fl < 6; fl++) for (const [x, y] of [[2, 2], [18, 2], [2, 14], [18, 14], [10, 8]]) {
    const z = fl * 3 + 1.2, d = Math.hypot(x - phone.x, y - phone.y, z - phone.z);
    rows.push(JSON.stringify({ x, y, z, bssid: 'ble:76f202336769f0e2', rssi: Math.round(-38 - 30 * Math.log10(Math.max(d, 1))), t: 1793000000 + fl, source: 'esp32' }));
  }
  const [ap] = locateAccessPoints(parseSurvey(rows.join('\n')), b, { now: 1793000010 });
  assert.equal(ap.bssid, 'ble:76f202336769f0e2');
  assert.ok(Math.abs(ap.floor - 3) <= 1, `planta estimada ${ap.floor}`);
});
