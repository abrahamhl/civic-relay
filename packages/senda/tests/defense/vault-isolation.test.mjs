import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as civil from '../../src/index.mjs';
import * as vault from '../../src/defense/index.mjs';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

test('bóveda: el índice civil no reexporta ninguna función de defensa', () => {
  const civilNames = new Set(Object.keys(civil));
  // Constantes físicas universales (p. ej. SPEED_OF_LIGHT) pueden coincidir; funciones no.
  const leaked = Object.keys(vault).filter((k) => typeof vault[k] === 'function' && civilNames.has(k));
  assert.deepEqual(leaked, []);
  assert.equal(vault.DEFENSE_VAULT.civilScope, false);
  assert.equal(typeof vault.generatePhantomUavDecoys, 'function');
});

test('bóveda: ningún módulo civil importa desde ./defense/', () => {
  for (const f of readdirSync(src).filter((x) => x.endsWith('.mjs'))) {
    const code = readFileSync(resolve(src, f), 'utf8');
    assert.ok(!/from\s+['"]\.\/defense\//.test(code), `${f} importa la bóveda de defensa`);
  }
});
