import test from 'node:test';
import assert from 'node:assert/strict';
import { schnorr } from '../src/noble-secp256k1.mjs';
import { generateIdentity, sealMessage, openMessage } from '../src/envelope.mjs';
import { pairSecret, pairMailbox, dropMailbox, wrapEnvelope, wrapReceipt, unwrapEvent, verifyEvent, myMailboxes, daysAround, unhex, hex, DAY_MS, PAD_BLOCK } from '../src/nostr-mailbox.mjs';
import { parseNostrRelays } from '../src/nostr-client.mjs';

test('BIP-340: vector oficial 0 (clave 3, mensaje y aux a cero) con la librería vendorizada', async () => {
  const sk = unhex('0000000000000000000000000000000000000000000000000000000000000003');
  assert.equal(hex(schnorr.getPublicKey(sk)).toUpperCase(), 'F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9');
  const sig = await schnorr.signAsync(new Uint8Array(32), sk, new Uint8Array(32));
  assert.equal(hex(sig).toUpperCase(), 'E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0');
});

test('buzón de pareja: simétrico, cambia cada día y no contiene huellas', async () => {
  const [a, b, c] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
  const sab = await pairSecret(a, b.publicIdentity), sba = await pairSecret(b, a.publicIdentity), sac = await pairSecret(a, c.publicIdentity);
  assert.deepEqual(sab, sba); assert.notDeepEqual(sab, sac);
  const d = Math.floor(Date.now() / DAY_MS);
  const m1 = await pairMailbox(sab, d), m2 = await pairMailbox(sab, d + 1);
  assert.notEqual(m1.pub, m2.pub);
  assert.match(m1.pub, /^[0-9a-f]{64}$/);
  assert.equal(daysAround(d * DAY_MS).length, 9);
});

test('evento: autor de un solo uso, sin huella ni texto a la vista, tamaño en bloques; solo lo abre la pareja', async () => {
  const [ana, her, eve] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
  const now = Date.now(), day = Math.floor(now / DAY_MS);
  const env = await sealMessage({ sender: ana, recipient: her.publicIdentity, body: 'Secreto: estoy bien en Suecia', priority: 3, ttlS: 7 * 86400, now });
  const mb = await pairMailbox(await pairSecret(ana, her.publicIdentity), day);
  const e1 = await wrapEnvelope({ mailbox: mb, envelope: env, nowMs: now }), e2 = await wrapEnvelope({ mailbox: mb, envelope: env, nowMs: now });
  assert.equal(await verifyEvent(e1), true);
  assert.notEqual(e1.pubkey, e2.pubkey, 'clave de autor distinta en cada evento');
  const pub = JSON.stringify(e1);
  for (const leak of [her.publicIdentity.fingerprint, ana.publicIdentity.fingerprint, 'Suecia', env.header.id]) assert.ok(!pub.includes(leak), `no aparece ${leak}`);
  assert.equal((Buffer.from(e1.content, 'base64url').length - 12 - 16) % PAD_BLOCK, 0, 'relleno a bloques de 256 B');
  // Hermano abre; un tercero no.
  const herBoxes = await myMailboxes({ identity: her, contacts: [ana.publicIdentity], nowMs: now });
  const got = await unwrapEvent(e1, herBoxes);
  assert.equal(got.type, 'ENVELOPE');
  assert.equal((await openMessage({ recipient: her, envelope: got.envelope, now })).body, 'Secreto: estoy bien en Suecia');
  const eveBoxes = await myMailboxes({ identity: eve, contacts: [ana.publicIdentity], nowMs: now });
  assert.equal(await unwrapEvent(e1, eveBoxes), null);
  // Alterado → rechazado (firma Nostr) y con firma rehecha → rechazado (AES-GCM).
  assert.equal(await unwrapEvent({ ...e1, content: e1.content.slice(0, -4) + 'AAAA' }, herBoxes), null);
});

test('recibo por el buzón de pareja y buzón de mensajero para quien transporta', async () => {
  const [ana, her] = await Promise.all([generateIdentity(), generateIdentity()]);
  const now = Date.now(), day = Math.floor(now / DAY_MS);
  const mb = await pairMailbox(await pairSecret(her, ana.publicIdentity), day);
  const r = await wrapReceipt({ mailbox: mb, receipt: { id: 'AAAAAAAAAAAAAAAAAAAAAA', ackSecret: 'BBBBBBBBBBBBBBBBBBBBBB' }, nowMs: now });
  const anaBoxes = await myMailboxes({ identity: ana, contacts: [her.publicIdentity], nowMs: now });
  assert.deepEqual((await unwrapEvent(r, anaBoxes)).receipt, { id: 'AAAAAAAAAAAAAAAAAAAAAA', ackSecret: 'BBBBBBBBBBBBBBBBBBBBBB' });
  const env = await sealMessage({ sender: ana, recipient: her.publicIdentity, body: 'llevado por Bo', priority: 3, ttlS: 3600, now });
  const drop = await wrapEnvelope({ mailbox: await dropMailbox(her.publicIdentity.fingerprint, day), envelope: env, nowMs: now });
  const herBoxes = await myMailboxes({ identity: her, contacts: [], nowMs: now });
  assert.equal((await unwrapEvent(drop, herBoxes)).mailbox.kind, 'DROP');
  const noDrops = await myMailboxes({ identity: her, contacts: [], nowMs: now, acceptDrops: false });
  assert.equal(await unwrapEvent(drop, noDrops), null, 'se puede desactivar');
});

test('lista de relés Nostr: solo wss:// (o ws:// local), sin credenciales, sin duplicados', () => {
  assert.deepEqual(parseNostrRelays('wss://relay.damus.io, ws://evil.example wss://u:p@x.example wss://relay.damus.io/ ws://127.0.0.1:7000 https://a.example'), ['wss://relay.damus.io', 'ws://127.0.0.1:7000']);
});
