import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidBbox,
  buildCdseStacQuery,
  normalizeCdseStacResponse,
  filterScenesByCloudCover,
  exportScenesAsGeoJson,
  searchCdseStac
} from '../src/copernicus-cdse.mjs';

const dir = dirname(fileURLToPath(import.meta.url));

test('CDSE STAC: validates geographic bounding boxes strictly', () => {
  assert.equal(isValidBbox([-0.62, 39.23, 0.12, 39.81]), true);
  assert.equal(isValidBbox([10, 20, 5, 25]), false); // minLon > maxLon
  assert.equal(isValidBbox([-200, 0, 10, 10]), false); // lon < -180
  assert.equal(isValidBbox([0, 0, 10]), false); // length !== 4
});

test('CDSE STAC: builds standard STAC 1.0.0 search payload', () => {
  const query = buildCdseStacQuery({
    bbox: [-0.62, 39.23, 0.12, 39.81],
    dateRange: { start: '2026-10-25T00:00:00Z', end: '2026-10-31T23:59:59Z' },
    maxCloudCoverPct: 20,
    collections: ['SENTINEL-2'],
    limit: 5
  });

  assert.deepEqual(query.bbox, [-0.62, 39.23, 0.12, 39.81]);
  assert.equal(query.collections[0], 'SENTINEL-2');
  assert.equal(query.datetime, '2026-10-25T00:00:00Z/2026-10-31T23:59:59Z');
  assert.equal(query.query['eo:cloud_cover'].lte, 20);
  assert.equal(query.limit, 5);
});

test('CDSE STAC: normalizes authentic Copernicus STAC sample fixture with thumbnails', () => {
  const rawJson = JSON.parse(
    readFileSync(resolve(dir, 'fixtures/cdse-stac-sample-2026.json'), 'utf8')
  );

  const res = normalizeCdseStacResponse(rawJson);
  assert.equal(res.ok, true);
  assert.equal(res.returnedCount, 3);
  assert.equal(res.epistemicStatus, 'METADATA_DISCOVERED');

  const s2LowCloud = res.scenes[0];
  assert.equal(s2LowCloud.platform, 'SENTINEL-2A');
  assert.equal(s2LowCloud.cloudCoverPct, 8.42);
  assert.equal(s2LowCloud.isUsableForOpticalAssessment, true);
  assert.ok(s2LowCloud.thumbnailUrl.includes('thumbnail.jpg'));

  const s2HighCloud = res.scenes[1];
  assert.equal(s2HighCloud.cloudCoverPct, 74.85);
  assert.equal(s2HighCloud.isUsableForOpticalAssessment, false);

  const s1Sar = res.scenes[2];
  assert.equal(s1Sar.platform, 'SENTINEL-1A');
  assert.equal(s1Sar.cloudCoverPct, null);
  assert.equal(s1Sar.isUsableForOpticalAssessment, true); // SAR penetrates clouds
});

test('CDSE STAC: filters scenes by cloud cover tolerance', () => {
  const rawJson = JSON.parse(
    readFileSync(resolve(dir, 'fixtures/cdse-stac-sample-2026.json'), 'utf8')
  );
  const res = normalizeCdseStacResponse(rawJson);

  const cleanScenes = filterScenesByCloudCover(res.scenes, 15);
  // S2 8.42% and S1 (null cloud cover) pass; S2 74.85% is filtered out
  assert.equal(cleanScenes.length, 2);
  assert.equal(cleanScenes[0].platform, 'SENTINEL-2A');
  assert.equal(cleanScenes[1].platform, 'SENTINEL-1A');
});

test('CDSE STAC: exports GeoJSON FeatureCollection for GIS timeline', () => {
  const rawJson = JSON.parse(
    readFileSync(resolve(dir, 'fixtures/cdse-stac-sample-2026.json'), 'utf8')
  );
  const res = normalizeCdseStacResponse(rawJson);
  const geojson = exportScenesAsGeoJson(res.scenes);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 3);
  assert.equal(geojson.features[0].geometry.type, 'Polygon');
  assert.ok(geojson.features[0].properties.thumbnailUrl);
});

test('CDSE STAC: handles network error or timeout safely without throw', async () => {
  const failingFetch = async () => {
    throw new Error('ECONNREFUSED: offline test sandbox');
  };

  const res = await searchCdseStac({
    bbox: [-0.62, 39.23, 0.12, 39.81],
    fetchImpl: failingFetch
  });

  assert.equal(res.ok, false);
  assert.equal(res.scenes.length, 0);
  assert.ok(res.error.includes('ECONNREFUSED'));
});
