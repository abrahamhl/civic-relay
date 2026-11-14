import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Con `export *`, un nombre exportado por dos módulos desaparece del índice sin error. Esta prueba lo detecta.
const RESOLVED = new Set(['TEXT_PREFIX', 'ACCESS', 'parseFirmsCsv', 'satVapHpa']); // con alias explícitos en index.mjs

test('índice: ningún nombre queda oculto por un choque entre módulos sin resolver', () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const idx = src('index.mjs'), seen = {};
  for (const [, f] of idx.matchAll(/export \* from '\.\/(.+?)'/g))
    for (const [, name] of src(f).matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)) (seen[name] ??= []).push(f);
  const clashes = Object.entries(seen).filter(([n, fs]) => fs.length > 1 && !RESOLVED.has(n));
  assert.deepEqual(clashes, [], `choques sin resolver: ${clashes.map(([n, fs]) => `${n} (${fs.join(', ')})`).join('; ')}`);
});

test('índice: las versiones de los nombres repetidos son accesibles con nombre propio', async () => {
  const m = await import('../src/index.mjs');
  for (const n of ['BEARER_TEXT_PREFIX', 'SDP_TEXT_PREFIX', 'SATELLITE_ACCESS', 'SENSOR_ACCESS', 'PLATFORM_ACCESS', 'parseFirmsCsvWildfire', 'parseFirmsCsvNasa', 'satVapHpaFireWatch', 'satVapHpaAtmos']) assert.ok(n in m, n);
});
