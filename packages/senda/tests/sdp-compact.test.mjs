import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSdp, packCall, unpackCall, sdpFromCall, compactFromSdp, sdpFromCompact, callToText, callFromText } from '../src/sdp-compact.mjs';

const FP = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 255).map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
const SDP = ['v=0', 'o=- 123 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0 1',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63', 'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2122260223 192.168.43.12 51234 typ host generation 0 network-id 1',
  'a=candidate:2 1 udp 2122194687 3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f.local 51236 typ host generation 0',
  'a=candidate:3 1 tcp 1518280447 192.168.43.12 9 typ host tcptype active',
  'a=candidate:1 1 udp 2122260223 192.168.43.12 51234 typ host generation 0 network-id 1',
  'a=ice-ufrag:aB3d', 'a=ice-pwd:Zx9yWv8uTs7rQp6oNm5lKj4i', `a=fingerprint:sha-256 ${FP}`, 'a=setup:actpass', 'a=mid:0', ''].join('\r\n');

test('extrae credenciales, huella y solo candidatos UDP host sin duplicados', () => {
  const p = parseSdp(SDP);
  assert.equal(p.ufrag, 'aB3d'); assert.equal(p.pwd, 'Zx9yWv8uTs7rQp6oNm5lKj4i'); assert.equal(p.fingerprint.length, 32);
  assert.deepEqual(p.candidates, [{ address: '192.168.43.12', port: 51234 }, { address: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f.local', port: 51236 }]);
});

test('ida y vuelta binaria exacta y por debajo de 100 bytes (cabe por sonido en < 9 s)', () => {
  const bytes = compactFromSdp(SDP, 'offer');
  assert.ok(bytes.length < 100, String(bytes.length));
  const c = unpackCall(bytes);
  assert.equal(c.type, 'offer'); assert.equal(c.setup, 'actpass'); assert.deepEqual(c.candidates, parseSdp(SDP).candidates);
  assert.deepEqual(c.fingerprint, parseSdp(SDP).fingerprint);
});

test('el SDP reconstruido conserva credenciales, huella, candidatos y la plantilla audio + datos', () => {
  const { type, sdp } = sdpFromCompact(compactFromSdp(SDP, 'answer'));
  assert.equal(type, 'answer');
  for (const s of ['a=ice-ufrag:aB3d', `a=fingerprint:sha-256 ${FP}`, '192.168.43.12 51234 typ host', '.local 51236 typ host', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'a=group:BUNDLE 0 1', 'a=rtpmap:111 opus/48000/2']) assert.ok(sdp.includes(s), s);
  assert.deepEqual(parseSdp(sdp).candidates, parseSdp(SDP).candidates);
});

test('código de texto: prefijo, ida y vuelta y rechazo de basura', () => {
  const t = callToText(compactFromSdp(SDP, 'offer'));
  assert.ok(t.startsWith('SENDA-LLAMADA-1.') && t.length < 160);
  assert.deepEqual([...callFromText(t)], [...compactFromSdp(SDP, 'offer')]);
  assert.throws(() => callFromText('hola'));
  assert.throws(() => unpackCall(new Uint8Array([2, 0, 1])));
  assert.throws(() => packCall({ type: 'offer', ufrag: 'a', pwd: 'b', fingerprint: [1, 2], setup: 'actpass', candidates: [] }));
  assert.ok(sdpFromCall(unpackCall(compactFromSdp(SDP, 'offer'))).endsWith('\r\n'));
});
