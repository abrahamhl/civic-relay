import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeatherGridUrl } from '../server/domain/weather-grid.mjs';
import { createMetNorwayGridFeed, normalizeMetnoGrid, metnoUrl } from '../server/domain/metno-weather-grid.mjs';

const NOW = Date.parse('2026-11-09T12:34:00Z');
const START = Math.floor(NOW / 3_600_000) * 3_600_000;
const hourly = Array.from({ length: 28 }, (_, i) => new Date(START + i * 3_600_000).toISOString());
const points = buildWeatherGridUrl('valencia', { researchOnly: true }).points;
const source = (point, seed = 0) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
  properties: {
    meta: { updated_at: new Date(NOW - 120_000).toISOString() },
    timeseries: hourly.map((time, i) => ({
      time,
      data: {
        instant: { details: {
          air_temperature: 14 + seed / 5 + i / 10,
          relative_humidity: 65,
          wind_speed: 5.5 + seed / 10,
          wind_from_direction: 240
        } },
        next_1_hours: { details: { precipitation_amount: i % 3 === 0 ? 1.5 : 0 } }
      }
    }))
  }
});
const data = () => points.map((p, i) => source(p, i));
const asResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
});

test('MET Norway normalizer builds precisely 24 common hourly steps and correct wind units', () => {
  const got = normalizeMetnoGrid(data(), { now: NOW, region: 'valencia', requestedPoints: points,
    originalHashes: Array(9).fill('a'.repeat(64)) });
  assert.equal(got.schema, 'senda.atmosphere.grid/1');
  assert.equal(got.dataKind, 'MODEL_FORECAST');
  assert.equal(got.points.length, 9);
  assert.equal(got.times.length, 24);
  assert.equal(got.points[0].values.wind_speed_10m[0], 19.8);
  assert.equal(got.points[0].values.precipitation[0], 1.5);
  assert.equal(got.source.provider, 'MET Norway');
  assert.equal(got.source.license, 'CC BY 4.0');
  assert.equal(got.source.access, 'CC_BY_4_COMMERCIAL_ALLOWED');
  assert.equal(got.source.originalResponseSha256.length, 9);
  assert.equal(got.calibratedBySenda, false);
});

test('rejects faulty timestamps, missing rain intervals and physically impossible wind values', () => {
  let raw = data();
  raw[1].properties.timeseries[4].data.next_1_hours = undefined;
  assert.throws(() => normalizeMetnoGrid(raw, { now: NOW, region: 'valencia', requestedPoints: points }), /METNO_HOURLY_INTERSECTION/);
  raw = data();
  raw[0].properties.timeseries.forEach((e) => { e.data.instant.details.wind_speed = 999; });
  assert.throws(() => normalizeMetnoGrid(raw, { now: NOW, region: 'valencia', requestedPoints: points }), /METNO_HOURLY_INTERSECTION/);
  raw = data();
  raw[2].properties.timeseries.forEach((e) => { e.time = 'invalid'; });
  assert.throws(() => normalizeMetnoGrid(raw, { now: NOW, region: 'valencia', requestedPoints: points }), /METNO_HOURLY_INTERSECTION/);
});

test('fixed MET API host, accurate requested coordinates and non-aggregating raw station flags', () => {
  const url = metnoUrl(points[0]);
  assert.equal(new URL(url).hostname, 'api.met.no');
  assert.equal(new URL(url).pathname, '/weatherapi/locationforecast/2.0/compact');
  assert.equal(new URL(url).searchParams.get('lat'), String(points[0].lat));
  const got = normalizeMetnoGrid(data(), { now: NOW, region: 'valencia', requestedPoints: points });
  assert.equal(got.isObservedStationData, false);
  assert.equal(got.isOfficialAlert, false);
  assert.equal(got.source.modelRunAt, null);
  assert.ok(got.source.productUpdatedAt);
});

test('batches 9 public data requests, caches result and avoids refetch until TTL', async () => {
  let clockNow = NOW, hits = 0, offline = false;
  const feed = createMetNorwayGridFeed({ clock: () => clockNow, ttlMs: 90_000, staleMaxMs: 200_000,
    fetcher: async (url, options) => {
      hits++;
      assert.equal(new URL(url).hostname, 'api.met.no');
      assert.equal(options.redirect, 'error');
      assert.match(options.headers['User-Agent'], /github.com\/abrahamhl\/civic-relay/);
      if (offline) throw Error('network outage');
      const p = { lat: Number(new URL(url).searchParams.get('lat')),
        lon: Number(new URL(url).searchParams.get('lon')) };
      const index = points.findIndex((x) => x.lat === p.lat && x.lon === p.lon);
      assert.ok(index >= 0);
      return asResponse(source(p, index));
    } });
  const [a, b] = await Promise.all([feed.read('valencia'), feed.read('valencia')]);
  assert.equal(a.status, 'SOURCE_SNAPSHOT');
  assert.equal(b.status, 'SOURCE_SNAPSHOT');
  assert.equal(hits, 9);
  assert.equal((await feed.read('valencia')).status, 'CACHED_SNAPSHOT');
  assert.equal(hits, 9);
  clockNow += 91_000; offline = true;
  assert.equal((await feed.read('valencia')).status, 'STALE_SNAPSHOT');
  clockNow += 210_000;
  assert.equal((await feed.read('valencia')).status, 'UNAVAILABLE');
});

test('provider failure never inserts fabricated forecasts', async () => {
  const feed = createMetNorwayGridFeed({ clock: () => NOW, fetcher: async () => asResponse({ error: true }, 403) });
  const result = await feed.read('valencia');
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.points.length, 0);
});
