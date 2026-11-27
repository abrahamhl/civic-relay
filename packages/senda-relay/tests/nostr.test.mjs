/**
 * Buzón descentralizado de extremo a extremo con relés Nostr reales (WebSocket en localhost) y criptografía real.
 * Tres relés independientes, uno de ellos caído: basta con que funcione uno.
 * Los tiempos son de localhost: prueban el mecanismo, no la latencia real entre países.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelay } from '../server.mjs';
import { generateIdentity, sealMessage, openMessage } from '../../senda/src/envelope.mjs';
import { createBundleStore, syncPair } from '../../senda/src/bundle.mjs';
import { createNostrPool, createNostrTransport } from '../../senda/src/nostr-client.mjs';
import { pairMailbox, pairSecret, wrapEnvelope, prewrap, DAY_MS } from '../../senda/src/nostr-mailbox.mjs';

const listen = (r) => new Promise((ok) => r.server.listen(0, '127.0.0.1', () => ok(`ws://127.0.0.1:${r.server.address().port}/nostr`)));
const until = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 20)); } return false; };

async function phone(identity, relays, contacts) {
  const store = createBundleStore({ owner: identity.publicIdentity.fingerprint });
  const inbox = [], log = [];
  const t = { store, inbox, log };
  const pool = createNostrPool({ relays, onEvent: (ev, relay) => t.tr.handle(ev, relay) });
  t.pool = pool;
  t.tr = createNostrTransport({ pool, identity, contacts: () => contacts, store, log: (e) => log.push(e), onEnvelope: async (env) => { inbox.push({ env, at: Date.now() }); } });
  await t.tr.refresh();
  return t;
}

test('Nostr SE→ES: publicado en 3 relés (1 caído), entregado en tiempo real, recibo de vuelta; ningún relé ve nada legible', async () => {
  const r1 = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'n1-')) }), r2 = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'n2-')) });
  const relays = [await listen(r1), await listen(r2), 'ws://127.0.0.1:1/nostr'];
  const [ana, her] = await Promise.all([generateIdentity(), generateIdentity()]);
  const A = await phone(ana, relays, [her.publicIdentity]), H = await phone(her, relays, [ana.publicIdentity]);
  try {
    await until(() => A.pool.status().filter((s) => s.open).length === 2 && H.pool.status().filter((s) => s.open).length === 2);
    const now = Date.now();
    const env = await sealMessage({ sender: ana, recipient: her.publicIdentity, body: 'Hola desde Suecia por Nostr', priority: 3, ttlS: 7 * 86400, now });
    A.store.put(env, { now });
    const t0 = Date.now();
    const sent = await A.tr.flush();
    assert.equal(sent[0].ok, true); assert.equal(sent[0].mailbox, 'PAIR');
    assert.ok(await until(() => H.inbox.length === 1), 'llega en tiempo real por la suscripción');
    const ms = H.inbox[0].at - t0;
    const m = await openMessage({ recipient: her, envelope: H.inbox[0].env, now: Date.now() });
    assert.equal(m.body, 'Hola desde Suecia por Nostr');
    assert.equal(A.log[0].relaysOk, 2, 'aceptado por los 2 relés vivos');
    for (const r of [r1, r2]) { const s = JSON.stringify(r.nostr.snapshot()); for (const leak of ['Suecia', ana.publicIdentity.fingerprint, her.publicIdentity.fingerprint, env.header.id]) assert.ok(!s.includes(leak)); }
    // Recibo de vuelta: Ana ve «entregado».
    await H.store.acceptReceipt(m.receipt, { now: Date.now() });
    await H.tr.sendReceipt(m.receipt, ana.publicIdentity.fingerprint);
    assert.ok(await until(() => A.store.summary().receipts.includes(env.header.id)), 'Ana recibe el acuse');
    assert.equal(A.store.has(env.header.id), false, 'y borra su copia');
    // Segunda vez: ya publicado, no se repite.
    assert.equal((await A.tr.flush()).length, 0);
    console.log(`  latencia localhost publicar→recibir: ${ms} ms`);
  } finally { A.pool.close(); H.pool.close(); await r1.close(); await r2.close(); }
});

test('red SENDA: Ana sin red escribe; Bo (sin conocer a nadie) lo publica tal cual; servidores NL⇄ES federados; Hermano conectado a otro servidor lo recibe', async () => {
  const nl = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'n3-')) }), es = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'n5-')) });
  const uNL = await listen(nl), uES = await listen(es);
  nl.federation.peers.push(uES.replace('ws://', 'http://').replace('/nostr', ''));
  const [ana, bo, her] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
  const now = Date.now();
  const sAna = createBundleStore({ owner: ana.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: ana, recipient: her.publicIdentity, body: 'Ana sin red → Bo → servidor NL → servidor ES → Hermano', priority: 3, ttlS: 7 * 86400, now });
  sAna.put(env, { now, wrap: await prewrap({ identity: ana, contact: her.publicIdentity, envelope: env, nowMs: now }) });
  const B = await phone(bo, [uNL], []); // Bo no tiene contactos: no sabe a quién va
  try {
    await syncPair(sAna, B.store, { now });
    await until(() => B.pool.status()[0].open);
    const sent = await B.tr.flush();
    assert.equal(sent[0].ok, true); assert.equal(sent[0].mailbox, 'PAIR_CARRIED');
    assert.ok(await until(() => es.nostr.count() === 1), 'el servidor NL empuja el buzón al de ES al instante');
    const fed = await nl.federateOnce();
    assert.equal(fed[0].nostrError, null); assert.equal(fed[0].nostrOut, 0, 'la federación periódica no repite lo ya empujado');
    // Hermano se conecta más tarde y SOLO al servidor de España.
    const H = await phone(her, [uES], [ana.publicIdentity]);
    try {
      assert.ok(await until(() => H.inbox.length === 1));
      assert.equal((await openMessage({ recipient: her, envelope: H.inbox[0].env, now: Date.now() })).body, 'Ana sin red → Bo → servidor NL → servidor ES → Hermano');
    } finally { H.pool.close(); }
  } finally { B.pool.close(); await nl.close(); await es.close(); }
});

test('relé Nostr SENDA: rechaza otros kinds, firmas falsas, sin caducidad; persiste tras reinicio', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'n4-'));
  let r = createRelay({ dataDir: dir });
  const [a, b] = await Promise.all([generateIdentity(), generateIdentity()]);
  const now = Date.now();
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now });
  const ev = await wrapEnvelope({ mailbox: await pairMailbox(await pairSecret(a, b.publicIdentity), Math.floor(now / DAY_MS)), envelope: env, nowMs: now });
  assert.deepEqual(await r.nostr.accept({ ...ev, kind: 1 }), [false, 'invalid: solo buzones SENDA (kind 1059)']);
  assert.equal((await r.nostr.accept({ ...ev, sig: ev.sig.replace(/^./, (c) => (c === '0' ? '1' : '0')) }))[0], false);
  assert.equal((await r.nostr.accept({ ...ev, tags: ev.tags.filter((t) => t[0] !== 'expiration') }))[0], false);
  assert.deepEqual(await r.nostr.accept(ev), [true, '']);
  assert.deepEqual(await r.nostr.accept(ev), [true, 'duplicate:']);
  r.flush(); await r.close();
  r = createRelay({ dataDir: dir });
  assert.equal(r.nostr.count(), 1);
  await r.close();
});
