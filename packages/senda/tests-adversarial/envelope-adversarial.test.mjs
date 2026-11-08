import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, openMessage, sealMessage, validateEnvelopeShape } from '../src/envelope.mjs';

const now = Date.UTC(2026, 10, 8, 12);
const flip = (value) => `${value.slice(0, -1)}${value.endsWith('A') ? 'B' : 'A'}`;

async function setup() {
  const sender = await generateIdentity();
  const recipient = await generateIdentity();
  const other = await generateIdentity();
  const envelope = await sealMessage({ sender, recipient: recipient.publicIdentity, body: 'SOS: sótano', priority: 0, ttlS: 3600, now, kind: 'SOS' });
  return { sender, recipient, other, envelope };
}

test('sobre: alterar el cifrado, la cabecera o la firma falla de forma cerrada', async () => {
  const { recipient, envelope } = await setup();
  const ciphertext = structuredClone(envelope);
  ciphertext.ct = flip(ciphertext.ct);
  await assert.rejects(openMessage({ recipient, envelope: ciphertext, now }));

  const header = structuredClone(envelope);
  header.header.priority = 9;
  await assert.rejects(openMessage({ recipient, envelope: header, now }));

  const signature = structuredClone(envelope);
  signature.sig = flip(signature.sig);
  await assert.rejects(openMessage({ recipient, envelope: signature, now }), /BAD_SIGNATURE/);
});

test('sobre: solo el destinatario puede abrirlo y la caducidad no se puede saltar', async () => {
  const { recipient, other, envelope } = await setup();
  await assert.rejects(openMessage({ recipient: other, envelope, now }), /NOT_FOR_ME/);
  const expired = structuredClone(envelope);
  expired.header.expiresAt = now - 1;
  await assert.rejects(openMessage({ recipient, envelope: expired, now }), /EXPIRED/);
});

test('sobre: la forma rechaza base64 ambiguo, tipos y tamaños fuera de rango', async () => {
  const { envelope } = await setup();
  assert.equal(validateEnvelopeShape(envelope, { now }).ok, true);
  const malformed = [
    { ...envelope, header: { ...envelope.header, kind: 'DESCONOCIDO' } },
    { ...envelope, header: { ...envelope.header, id: 'abc' } },
    { ...envelope, iv: 'abc=' },
    { ...envelope, sig: 'A'.repeat(87) },
    { ...envelope, ct: 'A' },
    { ...envelope, header: { ...envelope.header, expiresAt: 2 ** 49 } },
  ];
  for (const item of malformed) assert.equal(validateEnvelopeShape(item, { now }).ok, false);
});

test('sobre: una firma de otro emisor no se acepta como propia', async () => {
  const { other, envelope } = await setup();
  const forged = await sealMessage({ sender: other, recipient: (await generateIdentity()).publicIdentity, body: 'x', priority: 9, ttlS: 60, now });
  const swapped = { ...envelope, sig: forged.sig };
  await assert.rejects(openMessage({ recipient: await generateIdentity(), envelope: swapped, now }));
});

test('sobre: el recibo comprometido no se puede reutilizar con otro secreto', async () => {
  const { recipient, envelope } = await setup();
  const opened = await openMessage({ recipient, envelope, now });
  assert.equal(typeof opened.receipt.ackSecret, 'string');
  const tampered = structuredClone(envelope);
  tampered.header.ackHash = flip(tampered.header.ackHash);
  await assert.rejects(openMessage({ recipient, envelope: tampered, now }));
});
