import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreForwardEngine, createInMemoryAdapter } from '../lib/store-forward.mjs';

function fixture(id) {
  let tick = 100000;
  const engine = createStoreForwardEngine({ now: () => tick, retryMs: 1000 });
  engine.enqueue({ id, category: 'SAFE', consented: true, destination: 'LAB_CENTRE', payload: {}, ttlSeconds: 60 });
  return { engine, advance(ms) { tick += ms; } };
}

test('missing compatible route waits the configured full delay', async () => {
  const f = fixture('RETRY_EMPTY');
  assert.equal((await f.engine.dispatch('RETRY_EMPTY')).attempts, 0);
  f.advance(500);
  assert.deepEqual(await f.engine.retryDue(), []);
  f.advance(500);
  assert.equal((await f.engine.retryDue()).length, 1);
});

test('route disappears after send failure and does not retry early', async () => {
  const f = fixture('RETRY_LOST');
  const adapter = createInMemoryAdapter({ failures: 1 });
  f.engine.registerAdapter(adapter);
  assert.equal((await f.engine.dispatch('RETRY_LOST')).attempts, 1);
  adapter.setAvailable(false);
  f.advance(1000);
  assert.equal((await f.engine.retryDue()).length, 1);
  f.advance(500);
  assert.deepEqual(await f.engine.retryDue(), []);
  f.advance(500);
  assert.equal((await f.engine.retryDue()).length, 1);
});
