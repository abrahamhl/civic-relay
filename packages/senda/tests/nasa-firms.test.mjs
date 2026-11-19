import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidFirmsMapKey,
  formatFirmsUtcTimestamp,
  normalizeFirmsHotspot,
  parseFirmsCsv,
  queryFirmsHotspots,
  exportHotspotsAsGeoJson
} from '../src/nasa-firms.mjs';

const dir = dirname(fileURLToPath(import.meta.url));

test('NASA FIRMS: verifies 32-character hexadecimal MAP_KEY correctly', () => {
  assert.equal(isValidFirmsMapKey('a1b2c3d4e5f6789012345678abcdef01'), true);
  assert.equal(isValidFirmsMapKey('short-key'), false);
  assert.equal(isValidFirmsMapKey(''), false);
  assert.equal(isValidFirmsMapKey(undefined), false);
  assert.equal(isValidFirmsMapKey(null), false);
});

test('NASA FIRMS: adapter remains strictly INACTIVE when FIRMS_MAP_KEY is absent', async () => {
  // Call without key
  const res = await queryFirmsHotspots({
    bbox: [-4.75, 40.50, -4.60, 40.60],
    mapKey: undefined
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 'INACTIVE');
  assert.equal(res.reason, 'FIRMS_MAP_KEY_REQUIRED');
  assert.equal(res.count, 0);
  assert.equal(res.points.length, 0);
  assert.equal(res.epistemicStatus, 'ADAPTER_INACTIVE_NO_KEY');
});

test('NASA FIRMS: parses and normalizes authentic thermal anomaly sample fixture', () => {
  const rawRows = JSON.parse(
    readFileSync(resolve(dir, 'fixtures/firms-sample-2026.json'), 'utf8')
  );

  assert.equal(rawRows.length, 3);
  const normalized = rawRows.map(normalizeFirmsHotspot);

  assert.equal(normalized.length, 3);
  const peak = normalized[1]; // High confidence, FRP 58.2 MW
  assert.equal(peak.latitude, 40.5489);
  assert.equal(peak.longitude, -4.6792);
  assert.equal(peak.frpMegawatts, 58.2);
  assert.equal(peak.confidence, 'high');
  assert.equal(peak.instrument, 'VIIRS');
  assert.equal(peak.observedAtUtc, '2026-08-14T13:42:00Z');
  assert.ok(peak.warning.includes('HOTSPOT_NOT_BURNT_PERIMETER'));
});

test('NASA FIRMS: parseFirmsCsv parses comma-separated data correctly', () => {
  const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n40.5421,-4.6853,348.6,0.42,0.38,2026-08-14,1342,N,VIIRS,nominal,2.0NRT,298.2,24.8,D`;
  const parsed = parseFirmsCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].latitude, '40.5421');
  assert.equal(parsed[0].frp, '24.8');
});

test('NASA FIRMS: exports GeoJSON FeatureCollection with Point geometries', () => {
  const rawRows = JSON.parse(
    readFileSync(resolve(dir, 'fixtures/firms-sample-2026.json'), 'utf8')
  );
  const normalized = rawRows.map(normalizeFirmsHotspot);
  const geojson = exportHotspotsAsGeoJson(normalized);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 3);
  assert.equal(geojson.features[0].geometry.type, 'Point');
  assert.deepEqual(geojson.features[0].geometry.coordinates, [-4.6853, 40.5421]);
});

test('NASA FIRMS: queries mock endpoint successfully when valid key is provided', async () => {
  const mockCsv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n40.55,-4.68,350.0,0.4,0.4,2026-08-14,1200,N,VIIRS,high,2.0NRT,300.0,30.0,D`;
  const mockFetch = async () => ({
    ok: true,
    text: async () => mockCsv
  });

  const res = await queryFirmsHotspots({
    bbox: [-4.75, 40.50, -4.60, 40.60],
    mapKey: '0123456789abcdef0123456789abcdef',
    fetchImpl: mockFetch
  });

  assert.equal(res.ok, true);
  assert.equal(res.status, 'ACTIVE');
  assert.equal(res.count, 1);
  assert.equal(res.points[0].frpMegawatts, 30.0);
  assert.ok(res.warning.includes('HOTSPOT_NOT_BURNT_PERIMETER'));
});
