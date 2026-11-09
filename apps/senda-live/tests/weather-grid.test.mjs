import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WEATHER_REGIONS, buildWeatherGridUrl, normalizeWeatherGrid, createWeatherGridFeed } from '../server/domain/weather-grid.mjs';

const NOW = Date.parse('2026-11-09T12:34:00Z');
const first = Math.floor(NOW / 3_600_000) * 3600;
const steps = Array.from({ length: 24 }, (_, i) => first + i * 3600);
const weatherFixture = (region = 'valencia') => {
  const { points } = buildWeatherGridUrl(region, { researchOnly: true });
  return points.map((p, i) => ({
    latitude: p.lat, longitude: p.lon,
    hourly: {
      time: [...steps],
      temperature_2m: steps.map((_, n) => 12 + i + Math.sin(n)),
      relative_humidity_2m: steps.map(() => 60 + i),
      precipitation: steps.map((_, n) => n % 4 === 0 ? 2 : 0),
      wind_speed_10m: steps.map((_, n) => 10 + i + n / 10),
      wind_direction_10m: steps.map(() => 230),
    },
  }));
};
const response = (json) => new Response(JSON.stringify(json), {
  status: 200, headers: { 'content-type': 'application/json' },
});

test('region allowlist and fixed meteorology provider URL do not disclose user location', () => {
  assert.equal(Object.keys(WEATHER_REGIONS).length, 4);
  const { url, points, access } = buildWeatherGridUrl('valencia', { researchOnly: true });
  assert.equal(new URL(url).host, 'api.open-meteo.com');
  assert.equal(points.length, 9);
  assert.equal(new URL(url).searchParams.get('forecast_hours'), '24');
  assert.equal(access, 'LOCAL_NONCOMMERCIAL_RESEARCH');
  assert.throws(() => buildWeatherGridUrl('my-home-coordinates', { researchOnly: true }), /INVALID_WEATHER_REGION/);
  assert.throws(() => buildWeatherGridUrl('madrid'), /PROVIDER_NOT_CONFIGURED/);
  const paid = buildWeatherGridUrl('arnhem', { commercialKey: 'test-key' });
  assert.equal(new URL(paid.url).host, 'customer-api.open-meteo.com');
});

test('normalizes 9x24 weather grid as MODEL_FORECAST with fixed units and non-alert semantics', () => {
  const input = weatherFixture();
  const meta = buildWeatherGridUrl('valencia', { researchOnly: true });
  const out = normalizeWeatherGrid(input, {
    now: NOW, region: 'valencia', points: meta.points, access: meta.access, rawSha256: 'e'.repeat(64),
  });
  assert.equal(out.schema, 'senda.atmosphere.grid/1');
  assert.equal(out.dataKind, 'MODEL_FORECAST');
  assert.equal(out.calibratedBySenda, false);
  assert.equal(out.isOfficialAlert, false);
  assert.equal(out.points.length, 9);
  assert.equal(out.times.length, 24);
  assert.equal(out.points[4].values.wind_direction_10m[0], 230);
  assert.equal(out.source.units.precipitation, 'mm/h');
});

test('blocks incoherent timestamps, sensor substitutions, invalid measurements, and locations', () => {
  const meta = buildWeatherGridUrl('valencia', { researchOnly: true });
  const opts = { now: NOW, region: 'valencia', points: meta.points, access: meta.access };
  let payload = weatherFixture();
  payload[4].hourly.time[2] += 3600;
  assert.throws(() => normalizeWeatherGrid(payload, opts), /WEATHER_TIME_INVALID/);
  payload = weatherFixture();
  payload[4].hourly.time = payload[4].hourly.time.map((v) => v + 3600);
  assert.throws(() => normalizeWeatherGrid(payload, opts), /WEATHER_TIME_INCONSISTENT/);
  payload = weatherFixture(); payload[2].longitude = -90;
  assert.throws(() => normalizeWeatherGrid(payload, opts), /WEATHER_COORD_MISMATCH/);
  payload = weatherFixture(); payload[3].hourly.precipitation[2] = -2;
  assert.throws(() => normalizeWeatherGrid(payload, opts), /WEATHER_VARIABLE_INVALID/);
  payload = weatherFixture().slice(0, 8);
  assert.throws(() => normalizeWeatherGrid(payload, opts), /WEATHER_GRID_SHAPE/);
});

test('disabled by default: no external traffic or weather source is called', async () => {
  let requested = 0;
  const feed = createWeatherGridFeed({ commercialKey: '', researchOnly: false,
    fetcher: async () => { requested++; throw Error('Never call'); } });
  const result = await feed.read('arnhem');
  assert.equal(result.status, 'PROVIDER_NOT_CONFIGURED');
  assert.equal(requested, 0);
  assert.equal((await feed.read('invalid-region')).status, 'INVALID_REGION');
});

test('acquisition and offline server cache, deterministic SHA256 and one concurrent fetch per region', async () => {
  const payload = weatherFixture('madrid');
  let now = NOW, requested = 0, fail = false;
  const feed = createWeatherGridFeed({ clock: () => now, researchOnly: true, ttlMs: 30_000, staleMaxMs: 60_000,
    fetcher: async (url, opt) => {
      requested++;
      assert.equal(new URL(url).hostname, 'api.open-meteo.com');
      assert.equal(opt.redirect, 'error');
      if (fail) throw Error('offline');
      return response(payload);
    },
  });
  const [first, second] = await Promise.all([feed.read('madrid'), feed.read('madrid')]);
  assert.equal(requested, 1);
  assert.equal(first.status, 'SOURCE_SNAPSHOT');
  assert.equal(second.points.length, 9);
  assert.equal(first.source.rawSha256,
    createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.equal((await feed.read('madrid')).status, 'CACHED_SNAPSHOT');
  now += 31_000; fail = true;
  assert.equal((await feed.read('madrid')).status, 'STALE_SNAPSHOT');
  now += 61_000;
  assert.equal((await feed.read('madrid')).status, 'UNAVAILABLE');
});

test('rejects body oversized and malformed provider responses without fake data', async () => {
  let feed = createWeatherGridFeed({ clock: () => NOW, researchOnly: true, fetcher: async () =>
    response({ hourly: { temperature_2m: [] } }) });
  assert.equal((await feed.read('valencia')).status, 'UNAVAILABLE');
  feed = createWeatherGridFeed({ clock: () => NOW, researchOnly: true, fetcher: async () =>
    new Response('ignored', { headers: { 'content-length': '9999999' } }) });
  assert.equal((await feed.read('valencia')).status, 'UNAVAILABLE');
});
