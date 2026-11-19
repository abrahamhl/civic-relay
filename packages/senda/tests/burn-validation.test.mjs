import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inGeometry, rasterizePolygons, compareMasks, circleMask, skillVsReference } from '../src/burn-validation.mjs';
import { toUtm } from '../src/utm.mjs';

const D = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/smv2026');

test('punto en polígono respeta los huecos', () => {
  const g = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] };
  assert.equal(inGeometry(0.5, 0.5, g), true); assert.equal(inGeometry(2, 2, g), false); assert.equal(inGeometry(5, 5, g), false);
});

test('comparar máscaras: Jaccard, acierto y falsa alarma', () => {
  const r = compareMasks(Uint8Array.from([1, 1, 0, 0]), Uint8Array.from([1, 0, 1, 0]), { cellHa: 1 });
  assert.deepEqual([r.tp, r.fp, r.fn], [1, 1, 1]); assert.equal(r.jaccard, 1 / 3); assert.equal(r.acierto, 0.5); assert.equal(r.falsaAlarma, 0.5);
  assert.throws(() => compareMasks(new Uint8Array(2), new Uint8Array(3)));
});

test('círculo de n celdas y habilidad frente a la referencia', () => {
  const c = circleMask(101, 101, 50, 50, 500), n = c.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(n - 500) / 500 < 0.05, n);
  assert.equal(skillVsReference(0.5, 0.5), 0); assert.ok(skillVsReference(0.6, 0.5) > 0); assert.ok(skillVsReference(0.4, 0.5) < 0);
});

test('rasterizar un cuadrado de 1 km en UTM da ≈ 100 celdas de 1 ha', () => {
  const zone = 30, o = toUtm(40.3, -4.4, zone), grid = { w: 40, h: 40, dx: 100, x0: Math.floor(o.x) - 2000, y1: Math.floor(o.y) + 2000, zone };
  const sq = { type: 'Polygon', coordinates: [[[-4.4, 40.3], [-4.388235, 40.3], [-4.388235, 40.309], [-4.4, 40.309], [-4.4, 40.3]]] }; // ≈ 1 km × 1 km
  const n = rasterizePolygons([{ geometry: sq }], grid).reduce((s, v) => s + v, 0);
  assert.ok(n >= 90 && n <= 110, n);
});

test('validación EFFIS real: el perímetro oficial existe, se rasteriza con su área y el resultado guardado es reproducible', () => {
  const v = JSON.parse(readFileSync(resolve(D, 'validacion_effis.json'), 'utf8')), effis = JSON.parse(readFileSync(resolve(D, 'effis_perimetros.json'), 'utf8'));
  const f = Object.values(effis.capas).flatMap((c) => c.features).find((x) => x.properties.id === v.perimetroEFFIS.id);
  assert.ok(f, 'el perímetro usado está en la descarga de EFFIS');
  assert.ok(Math.abs(v.perimetroEFFIS.areaHaRasterizada - v.perimetroEFFIS.areaHaEFFIS) / v.perimetroEFFIS.areaHaEFFIS < 0.1, 'área rasterizada ≈ área oficial (malla de 100 m, recorte)');
  for (const k of ['modelo', 'circuloMismaArea', 'coherenciaDatos', 'coherenciaDatosTodosLosIncendios']) assert.ok(v[k].jaccard >= 0 && v[k].jaccard <= 1);
  assert.equal(v.habilidadModeloVsCirculo, skillVsReference(v.modelo.jaccard, v.circuloMismaArea.jaccard));
  assert.ok(v.limites.some((l) => /Mismo incendio/.test(l)), 'declara que no es validación en incendios distintos');
});
