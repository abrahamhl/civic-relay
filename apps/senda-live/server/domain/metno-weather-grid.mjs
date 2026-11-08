/**
 * SENDA Atmosphere 4D · MET Norway Locationforecast 2.0/compact adapter.
 * Global forecasts under CC BY 4.0, including commercial use, with attribution.
 * Cache each region >=3 hours, an appropriate conservative global cadence.
 * https://api.met.no/weatherapi/locationforecast/2.0/documentation
 * https://api.met.no/doc/FAQ
 */
import { createHash } from 'node:crypto';
import { WEATHER_REGIONS, buildWeatherGridUrl, normalizeWeatherGrid } from './weather-grid.mjs';

export const METNO_DOCS = 'https://api.met.no/weatherapi/locationforecast/2.0/documentation';
export const METNO_TERMS = 'https://api.met.no/doc/TermsOfService';
const ONE_HOUR_MS = 3_600_000;
const LIMIT_BYTES = 650_000;
const VALID_TIMESTEPS = 24;
const DEFAULT_TTL_MS = 3 * ONE_HOUR_MS;

function metnoLocations(region) {
  // Reuse the same nine fixed project regions as the Open-Meteo-backed model.
  return buildWeatherGridUrl(region, { researchOnly: true }).points;
}

export function metnoUrl(point) {
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
  url.searchParams.set('lat', String(point.lat));
  url.searchParams.set('lon', String(point.lon));
  return url.toString();
}

function finiteRange(value, lo, hi) {
  return typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi;
}

function pointsFromMetnoPayload(raw, { now = Date.now() } = {}) {
  const series = raw?.properties?.timeseries;
  if (!Array.isArray(series) || series.length < VALID_TIMESTEPS) throw new Error('METNO_TIME_SHAPE');
  const candidates = new Map();
  for (const row of series) {
    const ts = Date.parse(row?.time);
    const values = row?.data?.instant?.details;
    const rain = row?.data?.next_1_hours?.details?.precipitation_amount;
    if (!Number.isFinite(ts) || ts < now - ONE_HOUR_MS || ts > now + 48 * ONE_HOUR_MS) continue;
    if (ts % ONE_HOUR_MS !== 0) continue;
    if (!values ||
        !finiteRange(values.air_temperature, -100, 70) ||
        !finiteRange(values.relative_humidity, 0, 100) ||
        !finiteRange(values.wind_speed, 0, 111) ||
        !finiteRange(values.wind_from_direction, 0, 360) ||
        !finiteRange(rain, 0, 500)) continue;
    candidates.set(ts, {
      tempC: values.air_temperature,
      humidityPct: values.relative_humidity,
      rainMm: rain,
      windKmh: Math.round(values.wind_speed * 360) / 100,
      directionDeg: values.wind_from_direction,
    });
  }
  return candidates;
}

/**
 * Align nine independently fetched locations to the same 24 UTC hours.
 * No temporal interpolation, reanalysis, or implied higher physical resolution.
 */
export function normalizeMetnoGrid(responses, {
  now = Date.now(), region, requestedPoints, originalHashes = [],
} = {}) {
  if (!WEATHER_REGIONS[region] || !Array.isArray(responses) || responses.length !== 9 ||
      !Array.isArray(requestedPoints) || requestedPoints.length !== 9) throw new Error('METNO_GRID_SHAPE');
  const maps = responses.map((v) => pointsFromMetnoPayload(v, { now }));
  const common = [...maps[0].keys()].filter((t) => maps.every((m) => m.has(t))).sort((a, b) => a - b);
  // Only one-hour, contiguous source intervals are valid for the 24-step player.
  let selected = null;
  for (let i = 0; i <= common.length - VALID_TIMESTEPS; i++) {
    const sequence = common.slice(i, i + VALID_TIMESTEPS);
    if (sequence.every((t, j) => !j || t - sequence[j - 1] === ONE_HOUR_MS)) {
      selected = sequence; break;
    }
  }
  if (!selected) throw new Error('METNO_HOURLY_INTERSECTION');
  const artificialProviderShape = maps.map((m, index) => ({
    latitude: requestedPoints[index].lat, longitude: requestedPoints[index].lon,
    hourly: {
      time: selected.map((t) => t / 1000),
      temperature_2m: selected.map((t) => m.get(t).tempC),
      relative_humidity_2m: selected.map((t) => m.get(t).humidityPct),
      precipitation: selected.map((t) => m.get(t).rainMm),
      wind_speed_10m: selected.map((t) => m.get(t).windKmh),
      wind_direction_10m: selected.map((t) => m.get(t).directionDeg),
    }
  }));
  const rawSha256 = createHash('sha256').update(originalHashes.join('\n')).digest('hex');
  const data = normalizeWeatherGrid(artificialProviderShape, {
    now, region, points: requestedPoints, access: 'CC_BY_4_COMMERCIAL_ALLOWED', rawSha256
  });
  const published = responses.map((v) => Date.parse(v?.properties?.meta?.updated_at)).filter(Number.isFinite);
  data.source.provider = 'MET Norway';
  data.source.documentationUrl = METNO_DOCS;
  data.source.license = 'CC BY 4.0';
  data.source.termsUrl = METNO_TERMS;
  data.source.model = 'MET Norway Locationforecast 2.0 compact';
  data.source.productUpdatedAt = published.length === 9 ?
    new Date(Math.min(...published)).toISOString() : null;
  data.source.originalResponseSha256 = originalHashes;
  data.source.note = 'Model forecast, not physical station readings. Precipitation is next_1_hours; wind m/s converted to km/h.';
  return data;
}

async function limitedJson(response) {
  if (!response?.ok) throw new Error('METNO_UPSTREAM_HTTP');
  const header = response.headers?.get('content-length');
  if (header != null && (!Number.isFinite(+header) || +header > LIMIT_BYTES)) throw new Error('METNO_UPSTREAM_SIZE');
  if (!response.body?.getReader) throw new Error('METNO_UPSTREAM_STREAM');
  const reader = response.body.getReader();
  const chunks = []; let n = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > LIMIT_BYTES) throw new Error('METNO_UPSTREAM_SIZE');
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (n > LIMIT_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, n);
  return { data: JSON.parse(bytes.toString('utf8')), sha: createHash('sha256').update(bytes).digest('hex') };
}

export function createMetNorwayGridFeed({
  fetcher = globalThis.fetch, clock = Date.now,
  userAgent = process.env.SENDA_METNO_USER_AGENT ||
    'SENDA-Weather-Research/0.1 (+https://github.com/abrahamhl/civic-relay)',
  ttlMs = DEFAULT_TTL_MS,
  staleMaxMs = 24 * ONE_HOUR_MS,
  timeoutMs = 8_000,
} = {}) {
  const cache = new Map(), pending = new Map(), blockedUntil = new Map();
  const output = (entry, status) => ({ ...entry.data, status, fetchedAt: new Date(entry.at).toISOString() });
  const unavailable = (region) => ({
    schema: 'senda.atmosphere.grid/1', region, status: 'UNAVAILABLE',
    dataKind: 'MODEL_FORECAST', isOfficialAlert: false, calibratedBySenda: false,
    times: [], points: [], fetchedAt: null,
    source: { provider: 'MET Norway', documentationUrl: METNO_DOCS, access: 'CC_BY_4_COMMERCIAL_ALLOWED' }
  });
  async function collect(region) {
    const pts = metnoLocations(region), responses = [], originalHashes = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs * 4);
    try {
      // Three small sequential batches reduce bursts against the external host.
      for (let i = 0; i < pts.length; i += 3) {
        const group = await Promise.all(pts.slice(i, i + 3).map(async (point) => {
          const res = await fetcher(metnoUrl(point), {
            headers: { 'User-Agent': userAgent, Accept: 'application/json' },
            redirect: 'error', signal: controller.signal,
          });
          return limitedJson(res);
        }));
        for (const item of group) { responses.push(item.data); originalHashes.push(item.sha); }
      }
      const at = clock();
      const data = normalizeMetnoGrid(responses, { now: at, region, requestedPoints: pts, originalHashes });
      cache.set(region, { at, data });
      blockedUntil.delete(region);
      return output(cache.get(region), 'SOURCE_SNAPSHOT');
    } catch {
      blockedUntil.set(region, clock() + ttlMs);
      const previous = cache.get(region);
      return previous && clock() - previous.at <= staleMaxMs ? output(previous, 'STALE_SNAPSHOT') : unavailable(region);
    } finally { clearTimeout(timer); }
  }
  return {
    async read(region) {
      if (!Object.hasOwn(WEATHER_REGIONS, region)) return { ...unavailable(region), status: 'INVALID_REGION' };
      const now = clock(), previous = cache.get(region);
      if (previous && now - previous.at < ttlMs) return output(previous, 'CACHED_SNAPSHOT');
      if (now < (blockedUntil.get(region) || 0)) {
        return previous && now - previous.at <= staleMaxMs ? output(previous, 'STALE_SNAPSHOT') : unavailable(region);
      }
      if (!pending.has(region)) pending.set(region, collect(region).finally(() => pending.delete(region)));
      return pending.get(region);
    },
  };
}
