import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEffisDetections,
  createCopernicusEffisFeed,
  buildEffisUrl,
  EFFIS_DOCS_URL,
  EFFIS_LICENSE,
} from '../server/domain/copernicus-effis.mjs';

const NOW = Date.parse('2026-11-09T01:00:00Z');

function validFeature({ id = 'effis-001', lon = -0.3763, lat = 39.4699, frp = 45.2, conf = 85, sat = 'VIIRS' } = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id,
      acq_date: '2026-11-08',
      acq_time: '23:30',
      frp,
      confidence: conf,
      satellite: sat,
      instrument: 'VIIRS',
    },
  };
}

test('Copernicus EFFIS: normalizes valid thermal anomaly detections', () => {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      validFeature({ id: 'det-1', lon: -0.35, lat: 39.45, frp: 120.5, conf: 90 }),
      validFeature({ id: 'det-2', lon: -0.40, lat: 39.50, frp: 15.0, conf: 60 }),
    ],
  };

  const result = normalizeEffisDetections(geojson, { now: NOW, rawSha256: 'fedcba9876543210' });
  assert.equal(result.schema, 'senda.osint.copernicus-effis/1');
  assert.equal(result.dataset, 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES');
  assert.equal(result.totalDetections, 2);
  assert.equal(result.rejectedMalformedOrStale, 0);

  const obs = result.observations[0];
  assert.ok(obs.id.startsWith('copernicus-effis:'));
  assert.equal(obs.location.lat, 39.45);
  assert.equal(obs.location.lon, -0.35);
  assert.equal(obs.fireRadiativePowerMW, 120.5);
  assert.equal(obs.confidenceScore, 90);
  assert.equal(obs.isSendaAlert, false);
  assert.equal(obs.isGroundConfirmedWildfire, false);
  assert.equal(result.source.license, EFFIS_LICENSE);
  assert.equal(result.source.rawSha256, 'fedcba9876543210');
});

test('Copernicus EFFIS: rejects malformed, out-of-bounds, duplicate and non-point entries', () => {
  const badCollection = {
    type: 'FeatureCollection',
    features: [
      validFeature({ id: 'valid-1' }),
      validFeature({ id: 'valid-1' }), // Duplicate ID
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: 'poly' } }, // Not a Point
      { type: 'Feature', geometry: { type: 'Point', coordinates: [999, 39.4] }, properties: { id: 'oob-lon' } }, // Out of bounds
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-0.3, 999] }, properties: { id: 'oob-lat' } }, // Out of bounds
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-0.3, 39.4] },
        properties: { id: 'future', acq_date: '2028-01-01', acq_time: '12:00' }, // Future date
      },
    ],
  };

  const res = normalizeEffisDetections(badCollection, { now: NOW });
  assert.equal(res.totalDetections, 1);
  assert.equal(res.rejectedMalformedOrStale, 5);
});

test('Copernicus EFFIS Feed: bounded cache, deduplication and stale state fallback', async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          type: 'FeatureCollection',
          features: [validFeature({ id: 'effis-cached-1' })],
        }),
      };
    }
    // Subsequent call simulates upstream outage
    return { ok: false, status: 503, text: async () => 'Service Unavailable' };
  };

  const feed = createCopernicusEffisFeed({ fetchFn: mockFetch, clock: () => NOW, ttlMs: 10_000 });

  // 1. First fetch succeeds
  const first = await feed.read();
  assert.equal(first.status, 'ACTIVE_SNAPSHOT');
  assert.equal(first.totalDetections, 1);
  assert.equal(callCount, 1);

  // 2. Immediate read returns cached data without extra network call
  const second = await feed.read();
  assert.equal(second.totalDetections, 1);
  assert.equal(callCount, 1);

  // 3. Forced read with upstream outage returns STALE_SNAPSHOT
  const third = await feed.read(true);
  assert.equal(third.status, 'STALE_SNAPSHOT');
  assert.equal(third.totalDetections, 1);
  assert.ok(third.note.includes('preserving verified cached state'));
});
