/**
 * Larga distancia SE → NL → ES con relés FEDERADOS reales (HTTP en localhost) y criptografía real.
 *
 * Camino que se comprueba:
 *   Ana (Suecia, SIN Internet) ──Bluetooth/DTN──▶ Bo (Suecia, gana Internet en una gasolinera)
 *   Bo ──HTTPS──▶ relé SE ⇄ relé NL ⇄ relé ES (federación) ◀──HTTPS── Hermano (España, con datos)
 * y el recibo de vuelta hasta Ana por el mismo camino, que borra las copias en tránsito.
 *
 * Los tiempos de esta prueba son de localhost: demuestran el MECANISMO, no la latencia real entre países.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelay } from '../server.mjs';
import { generateIdentity, sealMessage, openMessage } from '../../senda/src/envelope.mjs';
import { createBundleStore, syncPair } from '../../senda/src/bundle.mjs';
import { syncWithRelay, syncAllRelays, parseRelayList, createAutoSync } from '../../senda/src/relay-client.mjs';
import { packRich, unpackRich } from '../../senda/src/message-media.mjs';

const listen = (relay) => new Promise((r) => relay.server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${relay.server.address().port}`)));

async function threeRelays() {
  const se = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'rse-')) });
  const nl = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'rnl-')) });
  const es = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'res-')) });
  const [uSE, uNL, uES] = [await listen(se), await listen(nl), await listen(es)];
  // Cadena SE ⇄ NL ⇄ ES (el relé de Suecia no conoce al de España: el sobre cruza dos federaciones).
  se.federation.peers.push(uNL); nl.federation.peers.push(uSE, uES); es.federation.peers.push(uNL);
  return { se, nl, es, uSE, uNL, uES, close: () => Promise.all([se.close(), nl.close(), es.close()]) };
}

test('SE→ES: Ana sin red, Bo la lleva por Bluetooth, relés federados SE⇄NL⇄ES, Hermano lo abre; recibo de vuelta', async () => {
  const R = await threeRelays();
  try {
    const now = Date.now();
    const [ana, bo, hermano] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
    const sAna = createBundleStore({ owner: ana.publicIdentity.fingerprint });
    const sBo = createBundleStore({ owner: bo.publicIdentity.fingerprint });
    const sHer = createBundleStore({ owner: hermano.publicIdentity.fingerprint });

    // Mensaje rico: 200 caracteres + foto WebP simulada de 10 KB (bytes de prueba, no una foto real).
    const text = 'Hola desde Suecia. '.repeat(11).slice(0, 200);
    const image = { mime: 'image/webp', bytes: new Uint8Array(10 * 1024).map((_, i) => (i * 31) & 255) };
    const body = packRich({ text, createdAt: now, image });
    const env = await sealMessage({ sender: ana, recipient: hermano.publicIdentity, body, priority: 3, ttlS: 7 * 86400, now });
    sAna.put(env, { now });

    // 1) Bluetooth (DTN) Ana ⇄ Bo: Bo transporta sin poder leer.
    await syncPair(sAna, sBo, { now });
    assert.equal(sBo.has(env.header.id), true, 'Bo transporta el sobre');

    // 2) Bo gana Internet: sube al relé de Suecia.
    const up = await syncWithRelay({ store: sBo, url: R.uSE });
    assert.equal(up.ok, true, up.error); assert.equal(up.uploaded, 1);
    assert.equal(R.se.store.has(env.header.id), true);

    // 3) Federación: SE→NL, NL→ES (dos rondas de relé).
    await R.se.federateOnce(); await R.nl.federateOnce(); await R.es.federateOnce();
    assert.equal(R.nl.store.has(env.header.id), true, 'el relé NL lo tiene');
    assert.equal(R.es.store.has(env.header.id), true, 'el relé ES lo tiene');
    for (const r of [R.se, R.nl, R.es]) assert.ok(!JSON.stringify(r.store.snapshot()).includes('Suecia'), 'ningún relé ve el texto');

    // 4) Hermano (España) sincroniza con SU relé y lo abre.
    const down = await syncWithRelay({ store: sHer, url: R.uES });
    assert.equal(down.ok, true); assert.equal(down.forMe.length, 1);
    const m = await openMessage({ recipient: hermano, envelope: down.forMe[0], now: now + 1000 });
    const rich = unpackRich(m.body);
    assert.equal(rich.text, text); assert.equal(rich.image.bytes.length, image.bytes.length); assert.equal(rich.createdAt, now);

    // 5) Recibo de vuelta: Hermano → relé ES → NL → SE → Bo (Internet) → Ana (Bluetooth). Borra copias en tránsito.
    await sHer.acceptReceipt(m.receipt, { now });
    await syncWithRelay({ store: sHer, url: R.uES });
    await R.es.federateOnce(); await R.nl.federateOnce(); await R.se.federateOnce();
    assert.equal(R.se.store.has(env.header.id), false, 'el relé SE borra su copia al ver el recibo');
    await syncWithRelay({ store: sBo, url: R.uSE });
    assert.equal(sBo.has(env.header.id), false, 'Bo borra su copia');
    await syncPair(sBo, sAna, { now });
    assert.equal(sAna.summary().receipts.includes(env.header.id), true, 'Ana recibe el acuse: «entregado»');
  } finally { await R.close(); }
});

test('una copia sola también sube al relé (infraestructura) y no se pierde para la entrega en mano', async () => {
  const R = await threeRelays();
  try {
    const now = Date.now();
    const [a, b] = await Promise.all([generateIdentity(), generateIdentity()]);
    const s = createBundleStore({ owner: 'carrier-x', initialCopies: 1 });
    const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now });
    s.put(env, { now, copies: 1 });
    const r = await syncWithRelay({ store: s, url: R.uSE });
    assert.equal(r.uploaded, 1);
    // El transportista conserva el sobre y puede entregarlo en mano al destinatario.
    const sb = createBundleStore({ owner: b.publicIdentity.fingerprint });
    const got = await sb.ingest(s.prepareFor(sb.summary(), { now }), { now });
    assert.equal(got.forMe.length, 1);
    // Segunda sincronización: el relé ya lo tiene, no se vuelve a subir.
    assert.equal((await syncWithRelay({ store: s, url: R.uSE })).uploaded, 0);
  } finally { await R.close(); }
});

test('varios relés: si uno está caído, basta con otro; lista de relés solo https (o localhost)', async () => {
  const R = await threeRelays();
  try {
    const now = Date.now();
    const [a, b] = await Promise.all([generateIdentity(), generateIdentity()]);
    const sa = createBundleStore({ owner: a.publicIdentity.fingerprint });
    sa.put(await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'hola', priority: 3, ttlS: 3600, now }), { now });
    const res = await syncAllRelays({ store: sa, urls: ['http://127.0.0.1:1', R.uNL], timeoutMs: 3000 });
    assert.equal(res.okCount, 1); assert.equal(res.results[0].ok, false); assert.ok(res.results[0].error);
    assert.equal(R.nl.store.count(), 1);
    assert.deepEqual(parseRelayList('https://a.example/, http://evil.example, http://127.0.0.1:8787 https://u:p@x.example https://a.example'), ['https://a.example', 'http://127.0.0.1:8787']);
    const h = await (await fetch(R.uNL + '/health')).json();
    assert.equal(h.peers, 2);
  } finally { await R.close(); }
});

test('sincronización automática: corre al tener red, reintenta con retroceso exponencial y para sin red', async () => {
  const timers = []; let online = false, calls = 0, fail = true;
  const auto = createAutoSync({
    run: async () => { calls++; return fail ? { okCount: 0, results: [{ ok: false }] } : { okCount: 1, results: [{ ok: true }] }; },
    isOnline: () => online, intervalMs: 1000, maxBackoffMs: 8000,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {},
  });
  const step = async () => { const t = timers.shift(); await t.fn(); return t.ms; };
  auto.start(); assert.equal(await step(), 0); assert.equal(calls, 0, 'sin red no llama');
  online = true; await step(); assert.equal(calls, 1);
  assert.equal(timers[0].ms, 2000, 'primer fallo → 2 s'); await step(); assert.equal(timers[0].ms, 4000);
  await step(); assert.equal(timers[0].ms, 8000); await step(); assert.equal(timers[0].ms, 8000, 'tope');
  fail = false; await step(); assert.equal(timers[0].ms, 1000, 'tras éxito vuelve al intervalo');
  auto.stop();
});
