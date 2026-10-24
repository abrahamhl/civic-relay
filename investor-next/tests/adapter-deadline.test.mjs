import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createStoreForwardEngine, createInMemoryAdapter } from '../lib/store-forward.mjs';

const message = (id) => ({ id, category: 'SAFE', consented: true, ttlSeconds: 60 });
const bounded = (pending) => Promise.race([pending, delay(150).then(() => 'HUNG')]);

test('a hung adapter description cannot block dispatch indefinitely', async () => {
  const engine = createStoreForwardEngine({ operationTimeoutMs: 15 });
  const adapter = createInMemoryAdapter();
  adapter.describe = () => new Promise(() => {});
  engine.registerAdapter(adapter); engine.enqueue(message('HUNG_DESCRIPTION'));
  const result = await bounded(engine.dispatch('HUNG_DESCRIPTION'));
  assert.notEqual(result, 'HUNG');
  assert.equal(result.status, 'QUEUED');
});

test('a hung send times out without fabricating ACK and releases its lock for retry', async () => {
  const engine = createStoreForwardEngine({ operationTimeoutMs: 15, retryMs: 1 });
  const adapter = createInMemoryAdapter(); let signal;
  adapter.send = (_packet, options) => { signal = options?.signal; return new Promise(() => {}); };
  engine.registerAdapter(adapter); engine.enqueue(message('HUNG_SEND'));
  const result = await bounded(engine.dispatch('HUNG_SEND'));
  assert.notEqual(result, 'HUNG');
  assert.equal(result.status, 'QUEUED');
  assert.equal(result.receiptKind, null);
  assert.equal(signal.aborted, true);
  await delay(5);
  adapter.send = async () => ({ accepted: false });
  assert.equal((await engine.dispatch('HUNG_SEND')).attempts, 2);
});

test('purge cancels a hung send without letting the old operation unlock a reused ID', async () => {
  const engine = createStoreForwardEngine({ operationTimeoutMs: 50 });
  const adapter = createInMemoryAdapter(); let signal;
  adapter.send = (_packet, options) => { signal = options?.signal; return new Promise(() => {}); };
  engine.registerAdapter(adapter); engine.enqueue(message('PURGED'));
  const old = engine.dispatch('PURGED');
  for (let i = 0; i < 20 && !signal; i++) await Promise.resolve();
  assert.ok(signal);
  engine.purge('PURGED');
  assert.equal(signal.aborted, true);
  engine.enqueue(message('PURGED'));
  adapter.send = async () => ({ accepted: false });
  const current = engine.dispatch('PURGED');
  assert.equal((await bounded(old)).status, 'REVOKED');
  assert.equal((await current).attempts, 1);
  assert.ok(!engine.audit().some(e => e.event === 'ADAPTER_SEND_FAILED'));
});

test('revocation during a hung description settles promptly and never invokes send', async () => {
  const engine = createStoreForwardEngine({ operationTimeoutMs: 1000 });
  const adapter = createInMemoryAdapter(); let started = false; let sends = 0;
  adapter.describe = () => { started = true; return new Promise(() => {}); };
  adapter.send = async () => { sends++; return { accepted: true }; };
  engine.registerAdapter(adapter); engine.enqueue(message('REVOKED'));
  const pending = engine.dispatch('REVOKED');
  for (let i = 0; i < 20 && !started; i++) await Promise.resolve();
  engine.revoke('REVOKED');
  const result = await bounded(pending);
  assert.notEqual(result, 'HUNG');
  assert.equal(result.status, 'REVOKED');
  assert.equal(sends, 0);
});
