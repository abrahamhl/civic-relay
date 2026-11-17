import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope, validateEnvelopeShape } from '../src/envelope.mjs';
import { b64, unb64 } from '../src/b64.mjs';
import { encodeShards, packShard, createReassembler } from '../src/erasure.mjs';
import { createBundleStore, syncPair } from '../src/bundle.mjs';

const T0 = Date.UTC(2026, 10, 4, 10);
const people = (n) => Promise.all(Array.from({ length: n }, () => generateIdentity()));
const fakeSecret = (n = 1) => b64(new Uint8Array(16).fill(n));
const fakeId = (n = 1) => b64(new Uint8Array(16).fill(n + 40));

test('un recibo falsificado SIN sobre no suprime la entrega (cuarentena, no verificación)', async () => {
  const [a, b] = await people(2);
  const sb = createBundleStore({ owner: b.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'SOS real', priority: 0, ttlS: 3600, now: T0 });

  const r = await sb.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(9) }, { now: T0 });
  assert.equal(r.state, 'PENDING');
  assert.equal(sb.summary().receipts.length, 0, 'un recibo sin sobre no es verificado');
  assert.equal(sb.summary().pendingReceipts.includes(env.header.id), true);

  const got = await sb.ingest({ envelopes: [{ env, copies: 1, hops: 1 }] }, { now: T0 + 1 });
  assert.equal(got.forMe.length, 1, 'el sobre debe entregarse pese al recibo falso');
  assert.equal(sb.summary().receipts.length, 0);
  assert.equal(sb.summary().pendingReceipts.length, 0, 'el sobre invalida el recibo pendiente');
  assert.equal((await openMessage({ recipient: b, envelope: got.forMe[0], now: T0 + 1 })).body, 'SOS real');
});

test('un recibo auténtico sin sobre queda en cuarentena y se verifica cuando llega el sobre', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'hola', priority: 3, ttlS: 3600, now: T0 });
  const opened = await openMessage({ recipient: b, envelope: env, now: T0 });
  const sm = createBundleStore({ owner: m.publicIdentity.fingerprint });

  assert.equal((await sm.acceptReceiptDetailed(opened.receipt, { now: T0 })).state, 'PENDING');
  const got = await sm.ingest({ envelopes: [{ env, copies: 4, hops: 1 }] }, { now: T0 + 1 });
  assert.equal(got.forMe.length, 0);
  assert.equal(got.stored.length, 0, 'el recibo verificado evita almacenar una copia ya entregada');
  assert.equal(sm.has(env.header.id), false);
  assert.deepEqual(sm.summary().receipts, [env.header.id]);
  assert.equal((await sm.acceptReceiptDetailed(opened.receipt, { now: T0 + 2 })).state, 'ALREADY_VERIFIED');
});

test('un recibo falso pendiente se descarta al llegar el sobre y el mensaje se almacena', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  const sm = createBundleStore({ owner: m.publicIdentity.fingerprint });
  await sm.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(7) }, { now: T0 });
  const got = await sm.ingest({ envelopes: [{ env, copies: 2, hops: 1 }] }, { now: T0 + 1 });
  assert.deepEqual(got.stored, [env.header.id]);
  assert.equal(sm.summary().receipts.length, 0);
  assert.equal(sm.summary().pendingReceipts.length, 0);
});

test('sobres malformados, gigantes, con TTL absurdo o caducados no entran ni consumen cuota', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'válido', priority: 3, ttlS: 3600, now: T0 });
  const st = createBundleStore({ owner: m.publicIdentity.fingerprint });
  const clone = () => structuredClone(env);

  const badKind = clone(); badKind.header.kind = 'EVIL';
  const badPriority = clone(); badPriority.header.priority = 99;
  const badId = clone(); badId.header.id = 'x';
  const badCt = clone(); badCt.ct = 'no-es-base64!';
  const longTtl = clone(); longTtl.header.expiresAt = T0 + 365 * 86400_000;
  const expired = clone(); expired.header.expiresAt = T0 - 1;
  const huge = clone(); huge.ct = 'A'.repeat(800_000);

  assert.equal(st.put(badKind, { now: T0 }).reason, 'BAD_KIND');
  assert.equal(st.put(badPriority, { now: T0 }).reason, 'BAD_PRIORITY');
  assert.equal(st.put(badId, { now: T0 }).reason, 'BAD_ID');
  assert.equal(st.put(badCt, { now: T0 }).reason, 'BAD_CIPHERTEXT');
  assert.equal(st.put(longTtl, { now: T0 }).reason, 'TTL_TOO_LONG');
  assert.equal(st.put(expired, { now: T0 }).reason, 'EXPIRED');
  assert.equal(st.put(huge, { now: T0 }).reason, 'ENVELOPE_TOO_LARGE');
  assert.equal(st.put(env, { hops: 25, now: T0 }).reason, 'HOP_LIMIT');
  assert.equal(st.put(env, { copies: 5000, now: T0 }).reason, 'BAD_COPIES');
  assert.equal(st.put(env, { copies: -1, now: T0 }).reason, 'BAD_COPIES');
  assert.equal(st.count(), 0);
  assert.equal(st.bytesUsed(), 0);

  const got = await st.ingest({ envelopes: [{ env: badKind, copies: 1, hops: 1 }, { env, copies: 1, hops: 1 }] }, { now: T0 });
  assert.equal(got.rejected, 1);
  assert.deepEqual(got.stored, [env.header.id]);
  assert.equal(st.count(), 1);
});

test('la cuarentena de recibos está acotada y no puede inundar la memoria', async () => {
  const st = createBundleStore({ owner: 'x', maxPendingReceipts: 8 });
  for (let i = 0; i < 40; i++) {
    const r = await st.acceptReceiptDetailed({ id: fakeId(i), ackSecret: fakeSecret(i) }, { now: T0 });
    assert.ok(r.state === 'PENDING' || r.state === 'QUOTA');
  }
  assert.ok(st.summary().pendingReceipts.length <= 8, JSON.stringify(st.summary().pendingReceipts.length));
});

test('reserve/commit: una caída del transporte no consume copias; el commit sí', async () => {
  const [a, b, m] = await people(3);
  const sa = createBundleStore({ owner: a.publicIdentity.fingerprint, initialCopies: 8 });
  const sm = createBundleStore({ owner: m.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  sa.put(env, { now: T0 });
  const peer = { owner: m.publicIdentity.fingerprint, ids: [], receipts: [], pendingReceipts: [] };

  const reserved = sa.reserveFor(peer, { now: T0 });
  assert.equal(sa.copiesOf(env.header.id), 8, 'reservar no descuenta todavía');
  reserved.rollback();
  assert.equal(sa.copiesOf(env.header.id), 8);

  const second = sa.reserveFor(peer, { now: T0 });
  second.commit();
  assert.equal(sa.copiesOf(env.header.id), 4);
  assert.equal(second.commit(), false, 'commit es idempotente');

  const original = sm.ingest;
  sm.ingest = async () => { throw new Error('radio drop'); };
  await assert.rejects(syncPair(sa, sm, { now: T0 + 1 }), /radio drop/);
  assert.equal(sa.copiesOf(env.header.id), 4, 'si el transporte falla, no se pierden copias');
  sm.ingest = original;
  await syncPair(sa, sm, { now: T0 + 2 });
  assert.equal(sa.copiesOf(env.header.id), 2, 'el commit reparte la mitad');
  assert.equal(sm.copiesOf(env.header.id), 2);
});

test('reinicio: el recibo pendiente falsificado sigue sin suprimir; el verificado sigue purgado', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  const opened = await openMessage({ recipient: b, envelope: env, now: T0 });

  const pendingStore = createBundleStore({ owner: b.publicIdentity.fingerprint });
  await pendingStore.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(5) }, { now: T0 });
  const restarted = createBundleStore({ owner: b.publicIdentity.fingerprint }).restore(JSON.parse(JSON.stringify(pendingStore.snapshot())), { now: T0 + 1 });
  const got = await restarted.ingest({ envelopes: [{ env, copies: 1, hops: 1 }] }, { now: T0 + 1 });
  assert.equal(got.forMe.length, 1);

  const relay = createBundleStore({ owner: m.publicIdentity.fingerprint });
  relay.put(env, { now: T0 });
  assert.equal(await relay.acceptReceipt(opened.receipt, { now: T0 }), true);
  assert.equal(relay.has(env.header.id), false);
  const relayBack = createBundleStore({ owner: m.publicIdentity.fingerprint }).restore(JSON.parse(JSON.stringify(relay.snapshot())), { now: T0 + 1 });
  assert.equal(relayBack.has(env.header.id), false);
  assert.deepEqual(relayBack.summary().receipts, [env.header.id]);
});

test('fragmentos k-de-n por portadores distintos: se pierden 2 de 5 y el relé reensambla y reenvía', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'mensaje fragmentado', priority: 0, ttlS: 3600, now: T0 });
  const packed = packEnvelope(env);
  const enc = encodeShards(packed, 3, 5);
  const shardId = unb64(env.header.id).subarray(0, 8);
  const frames = enc.shards.map((data, index) => packShard({ id: shardId, k: 3, n: 5, len: packed.length, index, data }));
  const reassembler = createReassembler();
  let rebuilt = null;
  for (const i of [1, 2, 3]) rebuilt = reassembler.add(frames[i], ['BLE', 'LoRa', 'SMS'][i - 1]) ?? rebuilt;
  assert.ok(rebuilt, '3 de 5 bastan');
  assert.deepEqual(rebuilt.data, packed);
  assert.throws(() => unpackEnvelope(new Uint8Array([...rebuilt.data, 0])), /bytes sobrantes/);
  assert.equal(reassembler.add(frames[4], 'SAT')?.id, undefined, 'el grupo ya está completo');
  const relay = createBundleStore({ owner: m.publicIdentity.fingerprint });
  assert.equal(relay.put(unpackEnvelope(rebuilt.data), { now: T0 + 1 }).stored, true);
  const sb = createBundleStore({ owner: b.publicIdentity.fingerprint });
  const got = await sb.ingest(relay.prepareFor(sb.summary(), { now: T0 + 2 }), { now: T0 + 2 });
  assert.equal((await openMessage({ recipient: b, envelope: got.forMe[0], now: T0 + 2 })).body, 'mensaje fragmentado');
});

test('límite conocido: el relé no puede verificar la firma del emisor; el destinatario sí detecta la manipulación', async () => {
  const [a, b, m] = await people(3);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  const forged = structuredClone(env);
  forged.sig = b64(new Uint8Array(64).fill(1));
  assert.equal(validateEnvelopeShape(forged, { now: T0 }).ok, true, 'la forma es válida; un relé ciego no puede saber más');
  const relay = createBundleStore({ owner: m.publicIdentity.fingerprint });
  assert.equal(relay.put(forged, { now: T0 }).stored, true);
  await assert.rejects(openMessage({ recipient: b, envelope: forged, now: T0 }), /BAD_SIGNATURE/);
});

test('el formato binario rechaza ciphertext >65535 B en vez de truncar la longitud', async () => {
  const [a, b] = await people(2);
  const big = await sealMessage({ sender: a, recipient: b.publicIdentity, body: new Uint8Array(70_000), priority: 3, ttlS: 3600, now: T0 });
  assert.throws(() => packEnvelope(big), /formato binario/);
  const small = await sealMessage({ sender: a, recipient: b.publicIdentity, body: new Uint8Array(1000), priority: 3, ttlS: 3600, now: T0 });
  assert.equal(unpackEnvelope(packEnvelope(small)).header.id, small.header.id);
});

test('difusiones: tamaño, caducidad y duplicados acotados', () => {
  const st = createBundleStore({ owner: 'x' });
  const base = { id: 'b1', expiresAt: T0 + 1000, type: 'SENDA_SIGNED_COMMAND', sig: 'x' };
  assert.equal(st.putBroadcast(base, { now: T0 }).stored, true);
  assert.equal(st.putBroadcast(base, { now: T0 }).reason, 'DUPLICATE');
  assert.equal(st.putBroadcast({ ...base, id: 'b2', expiresAt: T0 - 1 }, { now: T0 }).reason, 'EXPIRED_OR_INVALID');
  assert.equal(st.putBroadcast({ ...base, id: 'b3', padding: 'x'.repeat(20_000) }, { now: T0 }).reason, 'BROADCAST_TOO_LARGE');
});
