import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelay } from '../server.mjs';
import { generateIdentity, sealMessage, openMessage } from '../../senda/src/envelope.mjs';
import { createBundleStore } from '../../senda/src/bundle.mjs';

const post = (port, body) => fetch(`http://127.0.0.1:${port}/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function syncWith(port, store, now) {
  const p = store.prepareFor({ owner: 'senda-relay', ids: [], receipts: [], broadcasts: [] }, { now });
  const r = await post(port, { summary: store.summary(), ...p });
  return store.ingest(await r.json(), { now });
}

test('relé: Abraham (Arnhem) sube; la vecina con Starlink baja y transporta; ciego al contenido; persiste', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'senda-relay-'));
  let relay = createRelay({ dataDir: dir }); await new Promise((r) => relay.server.listen(0, r));
  const port = relay.server.address().port, now = Date.now();
  const abraham = await generateIdentity(), ismael = await generateIdentity(), maria = await generateIdentity();
  const sa = createBundleStore({ owner: abraham.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: abraham, recipient: ismael.publicIdentity, body: 'Ismael, ¿qué tal estás?', priority: 3, ttlS: 86400, now });
  sa.put(env, { now });
  await syncWith(port, sa, now);
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).items, 1);
  assert.ok(!JSON.stringify(relay.store.snapshot()).includes('Ismael'), 'el relé no ve el contenido');
  await relay.close();
  relay = createRelay({ dataDir: dir }); await new Promise((r) => relay.server.listen(0, r));   // reinicio
  const sm = createBundleStore({ owner: maria.publicIdentity.fingerprint });
  await syncWith(relay.server.address().port, sm, now + 1000);
  assert.equal(sm.has(env.header.id), true, 'María transporta el sobre tras el reinicio del relé');
  const si = createBundleStore({ owner: ismael.publicIdentity.fingerprint });
  const got = await si.ingest(sm.prepareFor(si.summary(), { now }), { now });
  assert.equal((await openMessage({ recipient: ismael, envelope: got.forMe[0], now })).body, 'Ismael, ¿qué tal estás?');
  await relay.close();
});

test('relé: rechaza basura, cuerpos enormes y ruta desconocida', async () => {
  const relay = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'senda-relay-')), maxBody: 1000 }); await new Promise((r) => relay.server.listen(0, r));
  const port = relay.server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${port}/sync`, { method: 'POST', body: '{no json' })).status, 400);
  assert.equal((await post(port, { summary: {}, envelopes: [{ env: { x: 'a'.repeat(2000) } }] })).status, 413);
  assert.equal((await fetch(`http://127.0.0.1:${port}/admin`)).status, 404);
  const ok = await post(port, { summary: { owner: 'z' }, envelopes: [{ env: { header: { id: 1 } } }] });
  assert.equal(ok.status, 200); assert.equal(relay.store.count(), 0);
  await relay.close();
});
