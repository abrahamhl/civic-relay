import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const V1 = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/api/v1'), PUB = resolve(V1, '../../..');
const cat = JSON.parse(readFileSync(resolve(V1, 'catalog.json'), 'utf8'));

test('API v1: cada capa tiene fuente, licencia, recuento y huella que coincide con el fichero publicado', () => {
  assert.ok(cat.capas.length >= 4);
  for (const c of cat.capas) {
    assert.ok(c.fuente && c.licencia && c.elementos > 0, c.id);
    const body = readFileSync(resolve(PUB, '.' + c.url), 'utf8').trimEnd();
    assert.equal(createHash('sha256').update(body).digest('hex'), c.sha256, `${c.id}: SHA-256`);
    const gj = JSON.parse(body); assert.equal(gj.features.length, c.elementos);
    assert.ok(gj.features.every((f) => f.properties.source && f.properties.basis), `${c.id}: fuente y base en cada elemento`);
    assert.equal(createHash('sha256').update(readFileSync(resolve(PUB, '.' + c.ficheroOrigen))).digest('hex'), c.sha256Origen, `${c.id}: fichero de origen`);
  }
});

test('API v1: contrato OpenAPI 3.1 y parte del día', () => {
  const oa = JSON.parse(readFileSync(resolve(V1, 'openapi.json'), 'utf8')), br = JSON.parse(readFileSync(resolve(V1, 'briefing.json'), 'utf8'));
  assert.equal(oa.openapi, '3.1.0'); assert.deepEqual(oa.paths['/senda/api/v1/layers/{id}.geojson'].get.parameters[0].schema.enum.sort(), cat.capas.map((c) => c.id).sort());
  assert.ok(br.capas.length >= 4 && br.capas.every((b) => b.total > 0 && b.nuevos <= b.total));
});
