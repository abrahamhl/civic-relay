import test from 'node:test';
import assert from 'node:assert/strict';
import { packRich, unpackRich, isRich, MAX_TEXT_CHARS, MAX_IMAGE_BYTES, latency } from '../src/message-media.mjs';
import { generateIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope } from '../src/envelope.mjs';

test('texto + foto: ida y vuelta exactas, con la hora de creación', () => {
  const img = new Uint8Array(4000).map((_, i) => (i * 7) & 255);
  const b = packRich({ text: 'Estoy bien, foto del refugio 📷', createdAt: 1764240000123, image: { mime: 'image/webp', bytes: img } });
  assert.ok(isRich(b)); const r = unpackRich(b);
  assert.equal(r.text, 'Estoy bien, foto del refugio 📷'); assert.equal(r.createdAt, 1764240000123); assert.equal(r.image.mime, 'image/webp'); assert.deepEqual(r.image.bytes, img);
  assert.equal(unpackRich(packRich({ text: 'solo texto', createdAt: 5 })).image, null);
});

test('límites declarados: 200 caracteres y 12 KB', () => {
  assert.throws(() => packRich({ text: 'x'.repeat(MAX_TEXT_CHARS + 1), createdAt: 1 }), /200/);
  assert.throws(() => packRich({ text: 'a', createdAt: 1, image: { mime: 'image/webp', bytes: new Uint8Array(MAX_IMAGE_BYTES + 1) } }), /imagen/);
  assert.throws(() => packRich({ text: 'a', createdAt: 1, image: { mime: 'image/png', bytes: new Uint8Array(10) } }), /WebP o JPEG/);
  assert.equal(latency({ createdAt: 1000, receivedAt: 61000 }), 60000);
});

test('viaja dentro del sobre cifrado y solo lo abre el destinatario', async () => {
  const a = await generateIdentity(), b = await generateIdentity(), now = Date.now();
  const body = packRich({ text: 'Hola desde Holanda', createdAt: now, image: { mime: 'image/jpeg', bytes: new Uint8Array(3000).fill(9) } });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body, priority: 3, ttlS: 86400, now });
  const wire = packEnvelope(env); assert.ok(wire.length < 4000);
  const m = await openMessage({ recipient: b, envelope: unpackEnvelope(wire), now });
  const r = unpackRich(m.body); assert.equal(r.text, 'Hola desde Holanda'); assert.equal(r.image.bytes.length, 3000);
});
