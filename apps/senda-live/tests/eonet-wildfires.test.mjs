import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createEonetWildfireFeed, normalizeEonetWildfires, EONET_WILDFIRE_URL
} from '../server/domain/eonet-wildfires.mjs';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const sourceEvent = (id, overrides = {}) => ({
  id, title: 'Wildfire in sample region', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/' + id,
  closed: null, categories: [{ id: 'wildfires', title: 'Wildfires' }],
  sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/' }],
  geometry: [{ type: 'Point', date: new Date(NOW - 30_000).toISOString(), coordinates: [-120.5, 39.1] }],
  ...overrides,
});
const payload = (events = [sourceEvent('EONET_1234')]) => ({ title: 'EONET Events', events });
const response = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

test('NASA event reports preserve provenance without claiming perimeters, forecasts or alerts', () => {
  const data = normalizeEonetWildfires(payload(), { now: NOW, rawSha256: 'a'.repeat(64) });
  assert.equal(data.dataset, 'NASA_EONET_V3_WILDFIRES');
  assert.equal(data.source.url, EONET_WILDFIRE_URL);
  assert.equal(data.source.rawSha256, 'a'.repeat(64));
  assert.equal(data.isOfficialAlert, false);
  assert.equal(data.isPerimeter, false);
  assert.equal(data.resultLimitReached, false);
  assert.equal(normalizeEonetWildfires(payload(Array.from({ length: 150 }, (_, i) => sourceEvent('EONET_' + i))), { now: NOW }).resultLimitReached, true);
  assert.equal(data.observations[0].pointMeaning, 'REPRESENTATIVE_CATALOG_LOCATION');
  assert.equal(data.observations[0].eventStatus, 'CATALOG_OPEN');
  assert.deepEqual(data.observations[0].location, { lat: 39.1, lon: -120.5 });
  assert.deepEqual(data.observations[0].reportedSources, ['InciWeb']);
});

test('rejects non-fire categories, duplicate IDs, malformed geography and polygons', () => {
  const events = [
    sourceEvent('EONET_1', { categories: [{ id: 'severeStorms' }] }),
    sourceEvent('EONET_2', { geometry: [{ type: 'Polygon', date: new Date(NOW).toISOString(), coordinates: [] }] }),
    sourceEvent('EONET_3', { geometry: [{ type: 'Point', date: new Date(NOW).toISOString(), coordinates: [-300, 130] }] }),
    sourceEvent('EONET_4'), sourceEvent('EONET_4'),
  ];
  const data = normalizeEonetWildfires(payload(events), { now: NOW });
  assert.equal(data.observations.length, 1);
  assert.equal(data.rejectedEvents, 4);
});

test('chooses latest valid point but not future/invalid measurements', () => {
  const e = sourceEvent('EONET_5', { geometry: [
    { type: 'Point', date: new Date(NOW - 120000).toISOString(), coordinates: [-70, 22] },
    { type: 'Point', date: new Date(NOW + 86_400_000).toISOString(), coordinates: [-10, 10] },
    { type: 'Point', date: new Date(NOW - 60000).toISOString(), coordinates: [3, 45] },
  ] });
  const data = normalizeEonetWildfires(payload([e]), { now: NOW });
  assert.deepEqual(data.observations[0].location, { lat: 45, lon: 3 });
  assert.match(data.observations[0].observedAt, /11:59:00/);
});

test('constrains source URLs and harmlessly displays curated, untrusted titles as text', () => {
  const e = sourceEvent('EONET_8', {
    title: '<img src=x onerror=alert(1)>', link: 'https://example.org/evil',
    sources: [{ id: '<b>fake</b>' }],
  });
  const data = normalizeEonetWildfires(payload([e]), { now: NOW });
  assert.equal(data.observations[0].url, 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_8');
  assert.equal(data.observations[0].title, '<img src=x onerror=alert(1)>');
  assert.equal(data.isOfficialAlert, false);
});

test('bounded upstream: SHA256, coalesced requests, cache and 503 equivalent when offline', async () => {
  let t = NOW, calls = 0, unavailable = false;
  const service = createEonetWildfireFeed({
    clock: () => t, ttlMs: 60_000, staleMaxMs: 90_000,
    fetcher: async (url, opts) => {
      calls++;
      assert.equal(url, EONET_WILDFIRE_URL);
      assert.equal(opts.redirect, 'error');
      if (unavailable) throw Error('OFFLINE');
      return response(payload());
    },
  });
  const [one, two] = await Promise.all([service.read(), service.read()]);
  assert.equal(one.status, 'SOURCE_SNAPSHOT');
  assert.equal(two.observations.length, 1);
  assert.equal(calls, 1);
  const digest = createHash('sha256').update(JSON.stringify(payload())).digest('hex');
  assert.equal(one.source.rawSha256, digest);
  assert.equal((await service.read()).status, 'CACHED_SNAPSHOT');
  t += 61000; unavailable = true;
  assert.equal((await service.read()).status, 'STALE_SNAPSHOT');
  t += 100_000;
  assert.equal((await service.read()).status, 'UNAVAILABLE');
});

test('malformed upstream and oversized body are fail-closed', async () => {
  const bad = createEonetWildfireFeed({ clock: () => NOW, fetcher: async () => response({ events: 'fake' }) });
  assert.equal((await bad.read()).status, 'UNAVAILABLE');
  const oversized = createEonetWildfireFeed({ clock: () => NOW, fetcher: async () =>
    new Response('bad', { status: 200, headers: { 'content-length': '20000000' } }) });
  assert.equal((await oversized.read()).status, 'UNAVAILABLE');
});
