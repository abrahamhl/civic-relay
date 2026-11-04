import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src'), web = resolve(here, '../../../investor-next/public/senda');

test('la app web usa EXACTAMENTE el núcleo probado (sin copias divergentes)', () => {
  for (const f of readdirSync(src).filter((x) => x.endsWith('.mjs'))) {
    assert.ok(existsSync(resolve(web, 'core', f)), `falta core/${f} en la app; ejecuta pnpm --filter @senda/core sync-web`);
    assert.equal(readFileSync(resolve(web, 'core', f), 'utf8'), readFileSync(resolve(src, f), 'utf8'), `core/${f} difiere del núcleo probado`);
  }
});

test('el service worker precarga todos los módulos que la app importa', () => {
  const sw = readFileSync(resolve(web, '../senda-sw.js'), 'utf8');
  const imports = new Set();
  const scan = (file, base) => { for (const m of readFileSync(file, 'utf8').matchAll(/from '\.\/([\w./-]+)'/g)) { const rel = (base ? base + '/' : '') + m[1]; if (!imports.has(rel)) { imports.add(rel); scan(resolve(web, rel), rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : ''); } } };
  scan(resolve(web, 'app.mjs'), '');
  for (const rel of imports) assert.ok(sw.includes(`'/senda/${rel}'`), `senda-sw.js no precarga /senda/${rel}`);
});
