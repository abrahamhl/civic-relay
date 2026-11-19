import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDatexRecord, createDatexMobilityFeed, DATEX_HAZARDS } from '../server/domain/datex-mobility.mjs';

test('DATEX II Mobility: normalizes valid incident with cryptographic hash', () => {
  const raw = {
    id: 'NDW_A12_KM78',
    lat: 52.001,
    lon: 5.892,
    road: 'A12 Arnhem-Ede',
    type: 'RoadClosed',
    severity: 'HIGH',
    comment: 'A12 afgesloten wegens ongeval en rookontwikkeling',
    start: '2026-11-09T03:00:00Z',
    end: '2026-11-09T08:00:00Z'
  };

  const rec = normalizeDatexRecord(raw, 'NDW_NETHERLANDS');
  assert.equal(rec.id, 'datex_ndw_netherlands_NDW_A12_KM78');
  assert.equal(rec.hazardType, DATEX_HAZARDS.ROAD_CLOSED);
  assert.equal(rec.coordinates.lat, 52.001);
  assert.equal(rec.coordinates.lon, 5.892);
  assert.equal(rec.severity, 'HIGH');
  assert.equal(rec.sha256.length, 64);
  assert.ok(rec.license.includes('2022/670'));
});

test('DATEX II Mobility: rejects invalid coordinates, missing IDs and non-objects', () => {
  assert.equal(normalizeDatexRecord(null), null);
  assert.equal(normalizeDatexRecord({}), null);
  assert.equal(normalizeDatexRecord({ id: '1', lat: 'invalid', lon: 5.0 }), null);
  assert.equal(normalizeDatexRecord({ id: '1', lat: 95.0, lon: 5.0 }), null); // out of range
});

test('DATEX II Mobility Feed: bounded cache, deduplication and offline fallback', async () => {
  const fallback = [
    { id: 'DGT_A3_KM120', lat: 39.469, lon: -0.376, road: 'A-3', type: 'CarriagewayClosed', severity: 'SEVERE' }
  ];

  const feed = createDatexMobilityFeed({
    providerLabel: 'DGT_SPAIN',
    fallbackRecords: fallback
  });

  const res = await feed.getIncidents();
  assert.equal(res.source, 'DGT_SPAIN');
  assert.equal(res.status, 'LOCAL_FALLBACK_DEMO');
  assert.equal(res.totalIncidents, 1);
  assert.equal(res.incidents[0].hazardType, DATEX_HAZARDS.ROAD_CLOSED);
});
