/**
 * SENDA Atmosphere 4D: read-only 3x3 model forecast grid (research integration).
 * A weather MODEL FORECAST is not a station reading, measurement or SENDA alert.
 * Enabled only with commercial provider credentials or explicit local research opt-in.
 * https://open-meteo.com/en/docs | https://open-meteo.com/en/terms
 */
import { createHash } from 'node:crypto';

export const WEATHER_REGIONS = Object.freeze({
  valencia: { name: 'Valencia', lat: 39.4699, lon: -0.3763 },
  arnhem: { name: 'Arnhem', lat: 51.9851, lon: 5.8987 },
  veenendaal: { name: 'Veenendaal', lat: 52.0286, lon: 5.5589 },
  madrid: { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
});
export const WEATHER_DOCS = 'https://open-meteo.com/en/docs';
const VARIABLES = ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m'];
const NUM_HOURS = 24;
const MAX_BYTES = 450_000;
const ttlDefault = 30 * 60_000;
const finite = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

export function buildWeatherGridUrl(region, { commercialKey = '', researchOnly = false } = {}) {
  const center = WEATHER_REGIONS[region];
  if (!center) throw new Error('INVALID_WEATHER_REGION');
  if (!commercialKey && !researchOnly) throw new Error('PROVIDER_NOT_CONFIGURED');
  const host = commercialKey ? 'customer-api.open-meteo.com' : 'api.open-meteo.com';
  const endpoint = new URL('https://' + host + '/v1/forecast');
  const points = [];
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      points.push({
        lat: Number((center.lat + row * 0.12).toFixed(4)),
        lon: Number((center.lon + col * 0.18).toFixed(4)),
      });
    }
  }
  endpoint.searchParams.set('latitude', points.map((p) => p.lat).join(','));
  endpoint.searchParams.set('longitude', points.map((p) => p.lon).join(','));
  endpoint.searchParams.set('hourly', VARIABLES.join(','));
  endpoint.searchParams.set('forecast_hours', String(NUM_HOURS));
  endpoint.searchParams.set('timeformat', 'unixtime');
  endpoint.searchParams.set('timezone', 'GMT');
  endpoint.searchParams.set('wind_speed_unit', 'kmh');
  endpoint.searchParams.set('precipitation_unit', 'mm');
  if (commercialKey) endpoint.searchParams.set('apikey', commercialKey);
  return { url: endpoint.toString(), points, center, access: commercialKey ? 'COMMERCIAL_SUBSCRIPTION' : 'LOCAL_NONCOMMERCIAL_RESEARCH' };
}

export function normalizeWeatherGrid(payload, { now = Date.now(), region, points, access, rawSha256 } = {}) {
  if (!WEATHER_REGIONS[region] || !Array.isArray(points) || points.length !== 9 ||
      !Array.isArray(payload) || payload.length !== 9) throw new Error('WEATHER_GRID_SHAPE');
  const timeSeries = [];
  const normalized = payload.map((source, index) => {
    const hourly = source?.hourly;
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length !== NUM_HOURS) throw new Error('WEATHER_TIME_SHAPE');
    if (!finite(source.latitude, -90, 90) || !finite(source.longitude, -180, 180) ||
        Math.abs(source.latitude - points[index].lat) > 0.25 ||
        Math.abs(source.longitude - points[index].lon) > 0.25) throw new Error('WEATHER_COORD_MISMATCH');
    const time = hourly.time;
    for (let i = 0; i < NUM_HOURS; i++) {
      if (!Number.isInteger(time[i]) || !finite(time[i] * 1000, now - 3_600_000, now + 50 * 3_600_000) ||
          (i && time[i] - time[i - 1] !== 3600)) throw new Error('WEATHER_TIME_INVALID');
    }
    if (!timeSeries.length) timeSeries.push(...time);
    else if (time.some((t, i) => t !== timeSeries[i])) throw new Error('WEATHER_TIME_INCONSISTENT');
    const values = {};
    for (const key of VARIABLES) {
      const column = hourly[key];
      if (!Array.isArray(column) || column.length !== NUM_HOURS) throw new Error('WEATHER_VARIABLE_MISSING');
      const [min, max] = ({
        temperature_2m: [-100, 70], relative_humidity_2m: [0, 100],
        precipitation: [0, 500], wind_speed_10m: [0, 400], wind_direction_10m: [0, 360]
      })[key];
      if (!column.every((v) => finite(v, min, max))) throw new Error('WEATHER_VARIABLE_INVALID');
      values[key] = column;
    }
    return { index, lat: source.latitude, lon: source.longitude, values };
  });
  return {
    schema: 'senda.atmosphere.grid/1',
    region, regionName: WEATHER_REGIONS[region].name,
    requestedCenter: { lat: WEATHER_REGIONS[region].lat, lon: WEATHER_REGIONS[region].lon },
    dataKind: 'MODEL_FORECAST',
    isOfficialAlert: false, isObservedStationData: false, calibratedBySenda: false,
    representation: 'NINE_MODEL_SAMPLE_POINTS_WITH_VISUAL_INTERPOLATION',
    modelRunAt: null,
    times: timeSeries.map((t) => new Date(t * 1000).toISOString()),
    points: normalized,
    source: { provider: 'Open-Meteo', documentationUrl: WEATHER_DOCS,
      access, model: 'best_match', modelRunAt: null, rawSha256,
      units: { temperature_2m: '°C', relative_humidity_2m: '%', precipitation: 'mm/h',
        wind_speed_10m: 'km/h', wind_direction_10m: 'degrees_from_north' } },
  };
}

async function boundedJson(res) {
  if (!res?.ok) throw new Error('WEATHER_UPSTREAM_HTTP');
  const size = res.headers?.get('content-length');
  if (size != null && (!Number.isFinite(+size) || +size > MAX_BYTES)) throw new Error('WEATHER_UPSTREAM_SIZE');
  if (!res.body?.getReader) throw new Error('WEATHER_UPSTREAM_STREAM');
  const reader = res.body.getReader();
  const buffers = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('WEATHER_UPSTREAM_SIZE');
      buffers.push(Buffer.from(value));
    }
  } finally {
    if (total > MAX_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = Buffer.concat(buffers, total);
  return { payload: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function createWeatherGridFeed({
  fetcher = globalThis.fetch, clock = Date.now,
  commercialKey = process.env.SENDA_OPEN_METEO_COMMERCIAL_KEY || '',
  researchOnly = process.env.SENDA_WEATHER_RESEARCH_ONLY === '1' && process.env.NODE_ENV !== 'production',
  ttlMs = ttlDefault, staleMaxMs = 24 * 60 * 60_000, timeoutMs = 7_000,
} = {}) {
  const cached = new Map(), pending = new Map(), backoff = new Map();
  const disabled = !commercialKey && !researchOnly;
  const unavailable = (region, status) => ({
    schema: 'senda.atmosphere.grid/1', region, status, dataKind: 'MODEL_FORECAST',
    isOfficialAlert: false, calibratedBySenda: false, fetchedAt: null, times: [], points: [],
    source: { provider: 'Open-Meteo', documentationUrl: WEATHER_DOCS, access: 'NOT_CONFIGURED' },
  });
  const output = (entry, status) => ({ ...entry.data, status, fetchedAt: new Date(entry.at).toISOString() });
  async function acquire(region) {
    const request = buildWeatherGridUrl(region, { commercialKey, researchOnly });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(request.url, {
        signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' },
      });
      const { payload, sha256 } = await boundedJson(response);
      const at = clock();
      const data = normalizeWeatherGrid(payload, { now: at, region, points: request.points,
        access: request.access, rawSha256: sha256 });
      cached.set(region, { at, data });
      backoff.delete(region);
      return output(cached.get(region), 'SOURCE_SNAPSHOT');
    } catch {
      backoff.set(region, clock() + ttlMs);
      const prior = cached.get(region);
      return prior && clock() - prior.at <= staleMaxMs ? output(prior, 'STALE_SNAPSHOT') : unavailable(region, 'UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }
  return {
    async read(region) {
      if (!Object.hasOwn(WEATHER_REGIONS, region)) return unavailable(region, 'INVALID_REGION');
      if (disabled) return unavailable(region, 'PROVIDER_NOT_CONFIGURED');
      const now = clock(), prior = cached.get(region);
      if (prior && now - prior.at < ttlMs) return output(prior, 'CACHED_SNAPSHOT');
      if (now < (backoff.get(region) || 0)) {
        return prior && now - prior.at <= staleMaxMs ? output(prior, 'STALE_SNAPSHOT') : unavailable(region, 'UNAVAILABLE');
      }
      if (!pending.has(region)) pending.set(region, acquire(region).finally(() => pending.delete(region)));
      return pending.get(region);
    },
  };
}
