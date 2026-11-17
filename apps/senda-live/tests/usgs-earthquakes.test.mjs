import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsgsEarthquakeFeed, normalizeUsgsFeed, USGS_FEED_URL } from '../server/domain/usgs-earthquakes.mjs';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const DAY = 86_400_000;
const valid = (id = 'abc1', overrides = {}) => ({
  type: 'Feature', id, geometry: { type: 'Point', coordinates: [1.5, 40.2, 12] },
  properties: { mag: 5.2, time: NOW - 120000, updated: NOW - 60000,
    place: '10 km SE of Test City', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/' + id },
  ...overrides,
});
const feed = (features = [valid()]) => ({ type: 'FeatureCollection', metadata: { generated: NOW - 30000 }, features });
const response = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('USGS normalization: units, provenance, no official alerts', () => {
  const result = normalizeUsgsFeed(feed(), { now: NOW });
  assert.equal(result.observations.length, 1);
  assert.equal(result.source.url, USGS_FEED_URL);
  assert.equal(result.observations[0].magnitude, 5.2);
  assert.deepEqual(result.observations[0].location, { lat: 40.2, lon: 1.5 });
  assert.equal(result.observations[0].isOfficialAlert, false);
  assert.equal(result.observations[0].dataKind, 'HISTORICAL_OBSERVATION');
});

test('rejects injected URL, malformed geometries, future events, duplicate IDs', () => {
  const badUrl = valid('x1'); badUrl.properties.url = 'https://evil.example/eventpage/steal';
  const badCoords = valid('x2'); badCoords.geometry.coordinates = [200, 95, 4];
  const future = valid('x3'); future.properties.time = NOW + DAY;
  const result = normalizeUsgsFeed(feed([badUrl, badCoords, future, valid('x1')]), { now: NOW });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].url, null);
  assert.equal(result.rejectedFeatures, 3);
});

test('rejects impossible source timestamps and excessive input', () => {
  assert.throws(() => normalizeUsgsFeed({ ...feed(), metadata: { generated: NOW + DAY } }, { now: NOW }), /INVALID_SOURCE_TIMESTAMP/);
  assert.throws(() => normalizeUsgsFeed(feed(Array(1201).fill(valid())), { now: NOW }), /INVALID_USGS_FEED/);
});

test('bounded cache, stampede prevention and stale snapshot on upstream failure', async () => {
  let now = NOW, calls = 0, fail = false;
  const service = createUsgsEarthquakeFeed({ clock: () => now, ttlMs: 60_000, staleMaxMs: 90_000,
    fetcher: async () => { calls++; if (fail) throw new Error('offline'); return response(feed()); } });
  const [one, two] = await Promise.all([service.read(), service.read()]);
  assert.equal(calls, 1);
  assert.equal(one.status, 'SOURCE_SNAPSHOT');
  assert.equal(two.observations.length, 1);
  assert.equal((await service.read()).status, 'CACHED_SNAPSHOT');
  now += 61_000; fail = true;
  assert.equal((await service.read()).status, 'STALE_SNAPSHOT');
  assert.equal(calls, 2);
  now += 91_000;
  assert.equal((await service.read()).status, 'UNAVAILABLE');
});

test('fails closed when upstream is invalid or response is oversized', async () => {
  let service = createUsgsEarthquakeFeed({ clock: () => NOW, fetcher: async () => response({ type: 'NotGeoJSON' }) });
  assert.equal((await service.read()).status, 'UNAVAILABLE');
  service = createUsgsEarthquakeFeed({ clock: () => NOW, fetcher: async () => new Response('x', { headers: { 'content-length': '2000000' } }) });
  assert.equal((await service.read()).status, 'UNAVAILABLE');
});
