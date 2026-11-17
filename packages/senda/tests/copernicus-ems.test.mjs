import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseCemsActivation,
  parseCemsProduct,
  buildCemsFeed,
  exportIncidentGeoJson,
  CEMS_SOURCE_METADATA
} from '../src/copernicus-ems.mjs';

const FIXTURE_PATH = resolve(import.meta.dirname, 'fixtures/cems-activations-sample-2026.json');
const rawFixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

test('parseCemsActivation: fixture SINTÉTICO con formato CEMS (EMSR765 es ficticio; la DANA real es EMSR773) con agregación y linaje', () => {
  const activ = parseCemsActivation(rawFixture.activations[0]);

  assert.equal(activ.activationCode, 'EMSR765');
  assert.equal(activ.eventType, 'FLOOD');
  assert.equal(activ.countryCode, 'ES');
  assert.equal(activ.status, 'CLOSED');
  assert.equal(activ.aois.length, 1);

  // Verificación de agregación de perímetros y área
  assert.equal(activ.summary.productsCount, 2);
  assert.equal(activ.summary.totalPerimetersCount, 2);
  // 4120.5 + 890.2 = 5010.7 ha
  assert.equal(activ.summary.totalAreaHa, 5010.7);

  // Linaje declarado
  assert.ok(activ.lineage.upstreamSensors.includes('Sentinel-1 CSAR'));
  assert.ok(activ.lineage.sameUpstreamCatalogs.includes('GLOFAS'));
});

test('Segregación epistémica: ACTIVATION vs CARTOGRAPHIC_PRODUCT vs OBSERVED_PERIMETER', () => {
  const activ = parseCemsActivation(rawFixture.activations[0]);
  const aoi = activ.aois[0];
  const prod = aoi.products[0];
  const perim = prod.observedPerimeters[0];

  assert.equal(activ.epistemicType, 'ACTIVATION');
  assert.equal(prod.epistemicType, 'CARTOGRAPHIC_PRODUCT');
  assert.equal(perim.epistemicType, 'OBSERVED_PERIMETER');

  // Timestamps independientes y orden cronológico lógico:
  // 1. Ocurre inundación y se observa por satélite: 2024-10-30T18:04:00Z
  // 2. Activación solicitada: 2024-10-30T10:15:00Z
  // 3. Producto cartográfico procesado y publicado: 2024-10-31T04:22:00Z
  assert.ok(prod.publicationTimeUtc.includes('2024-10-31'));
  assert.ok(perim.observationTimeUtc.includes('2024-10-30T18:04'));
});

test('buildCemsFeed: procesa fixture oficial y genera hash determinista', () => {
  const feed = buildCemsFeed(rawFixture);

  assert.equal(feed.schema, 'senda.cems-feed/v1');
  assert.equal(feed.totalActivations, 2);
  assert.ok(feed.canonicalHash && feed.canonicalHash.length === 64);
  assert.equal(feed.activations[1].activationCode, 'EMSR740');
  assert.equal(feed.activations[1].eventType, 'WILDFIRE');
});

test('exportIncidentGeoJson: genera GeoJSON canónico para GIS 4D con centroide y polígono', () => {
  const activ = parseCemsActivation(rawFixture.activations[0]);
  const geojson = exportIncidentGeoJson(activ, 'AOI01');

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.properties.activationCode, 'EMSR765');

  // 1 Point (centroide activación) + 2 Polygons (perímetros observados)
  assert.equal(geojson.features.length, 3);

  const centroid = geojson.features.find((f) => f.properties.epistemicType === 'ACTIVATION_CENTROID');
  assert.ok(centroid);
  assert.equal(centroid.geometry.type, 'Point');

  const perim1 = geojson.features.find((f) => f.id === 'EMSR765_AOI01_DEL_PRODUCT_r1_v1-PERIM_01');
  assert.ok(perim1);
  assert.equal(perim1.geometry.type, 'Polygon');
  assert.equal(perim1.properties.hazardClass, 'FLOODED_AREA');
  assert.equal(perim1.properties.areaHa, 4120.5);
});

test('Validación defensiva de errores: rechaza códigos no conformes o fechas inválidas', () => {
  assert.throws(() => {
    parseCemsActivation({ activation_code: 'INVALID_CODE', activation_time_utc: '2026-11-10T00:00:00Z' });
  }, /Código de activación inválido/);

  assert.throws(() => {
    parseCemsActivation({ activation_code: 'EMSR999', activation_time_utc: 'FECHA_CORRUPTA' });
  }, /Timestamp de activación inválido/);

  assert.throws(() => {
    buildCemsFeed(null);
  }, /TypeError/);
});
