import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODULES, SECTIONS, allowed, search } from '../src/app-catalog.mjs';
import { ROLES } from '../src/app-roles.mjs';

const web = fileURLToPath(new URL('../../../investor-next/public/senda/', import.meta.url));

test('cada módulo apunta a una página que existe y está en una sección conocida', () => {
  const ids = new Set(SECTIONS.map((s) => s.id));
  for (const m of MODULES) {
    assert.ok(existsSync(`${web}${m.page}.html`), `${m.page}.html`);
    assert.ok(ids.has(m.section), m.page);
  }
  assert.equal(new Set(MODULES.map((m) => m.page)).size, MODULES.length, 'sin duplicados');
});

test('toda página pública de la web aparece en el catálogo (salvo descargas y la propia app)', () => {
  const rw = JSON.parse(readFileSync(new URL('../../../investor-next/vercel.json', import.meta.url))).rewrites;
  const pages = rw.find((r) => r.source.includes(':page(')).source.match(/\(([^)]+)\)/)[1].split('|');
  const inCatalog = new Set(MODULES.map((m) => m.page));
  for (const p of pages) if (!['descargas', 'app'].includes(p)) assert.ok(inCatalog.has(p), `falta ${p} en el catálogo`);
});

test('roles: el ciudadano solo abre lo público; el observador todo salvo administración; el admin todo', () => {
  const pub = MODULES.filter((m) => allowed(m, ROLES.CIUDADANO));
  assert.ok(pub.length > 0 && pub.every((m) => m.minRole === ROLES.CIUDADANO));
  assert.ok(!allowed(MODULES.find((m) => m.page === 'sala'), ROLES.CIUDADANO));
  assert.ok(allowed(MODULES.find((m) => m.page === 'sala'), ROLES.OBSERVADOR_TOTAL));
  assert.ok(!allowed(MODULES.find((m) => m.page === 'organismo'), ROLES.OBSERVADOR_TOTAL));
  assert.ok(MODULES.every((m) => allowed(m, ROLES.ADMIN)));
  assert.ok(!allowed(MODULES[0], 'ROL_INVENTADO') || MODULES[0].minRole === ROLES.CIUDADANO);
});

test('búsqueda sin acentos ni mayúsculas', () => {
  assert.ok(search('camaras').some((m) => m.page === 'camaras'));
  assert.ok(search('INCENDIO').length >= 2);
  assert.equal(search('').length, MODULES.length);
});
