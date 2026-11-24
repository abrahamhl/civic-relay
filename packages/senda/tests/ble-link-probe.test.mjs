import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBE_BYTES, PROBE_KIND, encodeProbe, decodeProbe, isProbePack, createLinkProber } from '../src/ble-link-probe.mjs';

test('sonda BLE cooperativa: codifica/decodifica trama binaria de 16 bytes y rechaza CRC-8 corrupto', () => {
  const pkt = encodeProbe({ kind: PROBE_KIND.PING, nonce: 0x12345678, tMs: 1_700_000_000, senderId: 0xdeadbeef, flags: 3 });
  assert.equal(pkt.length, PROBE_BYTES);
  assert.equal(isProbePack(pkt), true);

  const dec = decodeProbe(pkt);
  assert.equal(dec.kindName, 'PING');
  assert.equal(dec.nonce, 0x12345678);
  assert.equal(dec.senderId, 0xdeadbeef);
  assert.equal(dec.flags, 3);

  // Corromper 1 bit del payload -> rechazo determinista por CRC-8
  const bad = new Uint8Array(pkt);
  bad[5] ^= 0x01;
  assert.throws(() => decodeProbe(bad), /CRC-8/);
});

test('createLinkProber: PING ↔ PONG entre dos móviles SENDA mide RTT exacto y adjunta física de dos rayos', () => {
  const a = createLinkProber({ senderId: 101 });
  const b = createLinkProber({ senderId: 202 });

  const ping1 = a.makePing(10_000, 777);
  const bRx = b.onReceive(ping1.bytes, 10_018);
  assert.equal(bRx.ok, true);
  assert.equal(bRx.type, 'PING');
  assert.equal(isProbePack(bRx.reply), true);

  // A recibe el PONG 42 ms después con distancia conocida 85 m y velocidad relativa 20 m/s
  const aRx = a.onReceive(bRx.reply, 10_042, { distM: 85, vRelMs: 20 });
  assert.equal(aRx.ok, true);
  assert.equal(aRx.type, 'PONG');
  assert.equal(aRx.rttMs, 42);
  assert.ok(aRx.channel && aRx.channel.fsplDb > 60 && aRx.channel.dopplerHz > 100);

  // Segundo PING sin respuesta (pérdida de paquete)
  a.makePing(11_000, 778);
  const stA = a.stats();
  assert.equal(stA.pingsSent, 2);
  assert.equal(stA.pongsReceived, 1);
  assert.equal(stA.responseRate, 0.5);
  assert.equal(stA.medianRttMs, 42);
  assert.equal(b.stats().pingsAnswered, 1);
});
