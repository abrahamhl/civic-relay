// Fija cada cifra que dice la película de inversores (media/senda-film/investor-film.json):
// si un cambio del núcleo la rompe, esta prueba falla y obliga a corregir el código o el guion.
// Las comprobaciones viven en scripts/film-claims.mjs (las mismas que usa scripts/prove.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS } from '../../../scripts/film-claims.mjs';

for (const c of CLAIMS) {
  test(`película ${c.scene} · ${c.id}: ${c.claim}`, async () => {
    const m = await c.measure();
    assert.ok(m.ok, `${c.id}: ${m.value}`);
  });
}
