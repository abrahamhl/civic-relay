import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(resolve(root, 'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java'), 'utf8');

test('STOP clears on-screen log and local journal', () => {
  const stop = source.slice(source.indexOf('private void stopAndClear()'), source.indexOf('@Override protected void onStop()'));
  assert.match(stop, /sessionEpoch\+\+/);
  assert.match(stop, /journal\.clear\(\)/);
  assert.match(stop, /output\.setText\(""\)/);
});

test('stale session UI callbacks cannot restore cleared logs', () => {
  const log = source.slice(source.indexOf('private void log(String note)'), source.indexOf('private void armExpiry('));
  assert.match(log, /final long logEpoch = sessionEpoch/);
  assert.match(log, /if \(logEpoch != sessionEpoch\) return/);
});
