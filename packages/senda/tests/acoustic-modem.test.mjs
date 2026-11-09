import test from 'node:test';
import assert from 'node:assert/strict';
import { modulate, demodulate, crc32, airtimeSeconds, bytesToSymbols } from '../src/acoustic-modem.mjs';

/* Canal acústico de prueba: retardo, atenuación, eco de sala, ruido gaussiano y remuestreo. */
function channel(x, { srIn = 48000, srOut = 48000, delayS = 0.7, gain = 0.25, echo = [[0.012, 0.35], [0.031, 0.18]], snrDb = 10, seed = 1, tailS = 0.5, hum = 0 } = {}) {
  let s = seed >>> 0; const u = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 1) / 4294967297;
  const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const rev = new Float32Array(x.length + Math.round(0.05 * srIn));
  for (let i = 0; i < x.length; i++) { rev[i] += x[i]; for (const [d, a] of echo) rev[i + Math.round(d * srIn)] += a * x[i]; }
  const n = Math.round((rev.length / srIn + delayS + tailS) * srOut), out = new Float32Array(n);
  let p = 0; for (let i = 0; i < rev.length; i++) p += rev[i] * rev[i]; p = (p / rev.length) * gain * gain;
  const sigma = Math.sqrt(p / 10 ** (snrDb / 10));
  for (let i = 0; i < n; i++) {
    const t = i / srOut - delayS, j = t * srIn, j0 = Math.floor(j);
    const v = j0 >= 0 && j0 + 1 < rev.length ? rev[j0] + (rev[j0 + 1] - rev[j0]) * (j - j0) : 0;
    out[i] = gain * v + sigma * g() + hum * Math.sin(2 * Math.PI * 50 * i / srOut);
  }
  return out;
}
const bytes = (n, seed) => { let s = seed; return Uint8Array.from({ length: n }, () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 16) & 0xff); };

test('CRC-32 estándar (vector de referencia)', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926');
});

test('ida y vuelta limpia', () => {
  const msg = new TextEncoder().encode('SOS · Calle Real 4 · 2 personas · necesitamos agua');
  const r = demodulate(modulate(msg));
  assert.deepEqual(r.payload, msg);
});

test('sala real simulada: eco, atenuación, ruido 10 dB y 50 Hz de red', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const msg = bytes(180, seed);
    const r = demodulate(channel(modulate(msg), { seed, hum: 0.05 }));
    assert.ok(r, `semilla ${seed}: sin trama`);
    assert.deepEqual(r.payload, msg, `semilla ${seed}`);
  }
});

test('emisor a 48 kHz y receptor a 44,1 kHz', () => {
  const msg = bytes(120, 9);
  const r = demodulate(channel(modulate(msg, { sampleRate: 48000 }), { srIn: 48000, srOut: 44100, seed: 9 }), { sampleRate: 44100 });
  assert.deepEqual(r.payload, msg);
});

test('ruido extremo (−3 dB): o entrega exacto o nada; nunca basura', () => {
  let ok = 0, none = 0;
  for (let seed = 20; seed < 26; seed++) {
    const msg = bytes(80, seed);
    const r = demodulate(channel(modulate(msg), { seed, snrDb: -3 }));
    if (r === null) none++; else { assert.deepEqual(r.payload, msg); ok++; }
  }
  assert.equal(ok + none, 6);
});

test('silencio o ruido puro no producen mensajes falsos', () => {
  let s = 3; const noise = Float32Array.from({ length: 48000 * 3 }, () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.3);
  assert.equal(demodulate(noise), null);
  assert.equal(demodulate(new Float32Array(48000)), null);
});

test('caudal: un SOS de 200 bytes cabe en menos de 25 s de audio', () => {
  assert.ok(airtimeSeconds(200) < 25, `${airtimeSeconds(200)}`);
  assert.ok(bytesToSymbols(new Uint8Array(10)).every((s) => s >= 0 && s < 16));
});
