/**
 * SENDA LIVE · USGS GeoJSON observation adapter.
 * Read-only source records; NEVER an emergency alert, SENDA detection, or model forecast.
 * Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */
import { createHash } from 'node:crypto';

export const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
export const USGS_FEED_DOCS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php';
const MAX_BYTES = 1_500_000;
const MAX_INPUT_FEATURES = 1200;
const MAX_OUTPUT_FEATURES = 200;
const DAY = 86_400_000;

function finiteBetween(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function eventPageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'earthquake.usgs.gov' && /^\/earthquakes\/eventpage\/[a-z0-9_-]+\/?$/i.test(url.pathname)) {
      return url.origin + url.pathname;
    }
  } catch { /* malformed upstream URL */ }
  return null;
}

/** Normalizes official source reports without promoting them to alerts. */
export function normalizeUsgsFeed(raw, { now = Date.now() } = {}) {
  if (!raw || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features) || raw.features.length > MAX_INPUT_FEATURES) {
    throw new Error('INVALID_USGS_FEED');
  }
  const generated = raw.metadata?.generated;
  if (!finiteBetween(generated, now - 32 * DAY, now + 10 * 60_000)) throw new Error('INVALID_SOURCE_TIMESTAMP');
  const seen = new Set();
  const observations = [];
  let rejected = 0;
  for (const feature of raw.features) {
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties;
    const id = feature?.id;
    const valid = feature?.type === 'Feature' && feature?.geometry?.type === 'Point' &&
      Array.isArray(coords) && coords.length >= 2 &&
      finiteBetween(coords[0], -180, 180) && finiteBetween(coords[1], -90, 90) &&
      finiteBetween(props?.mag, 4.5, 10) &&
      finiteBetween(props?.time, now - 8 * DAY, now + 10 * 60_000) &&
      typeof id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(id) && !seen.has(id);
    if (!valid) { rejected++; continue; }
    seen.add(id);
    if (observations.length >= MAX_OUTPUT_FEATURES) continue;
    const updated = finiteBetween(props.updated, props.time, now + 10 * 60_000) ? props.updated : null;
    observations.push({
      id: 'usgs:' + id,
      magnitude: Math.round(props.mag * 100) / 100,
      location: { lat: coords[1], lon: coords[0] },
      depthKm: finiteBetween(coords[2], -15, 800) ? coords[2] : null,
      place: typeof props.place === 'string' ? props.place.slice(0, 180) : 'Localización sin especificar',
      observedAt: new Date(props.time).toISOString(),
      updatedAt: updated === null ? null : new Date(updated).toISOString(),
      url: eventPageUrl(props.url),
      dataKind: 'HISTORICAL_OBSERVATION',
      isOfficialAlert: false,
    });
  }
  observations.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  return {
    dataset: 'USGS_M45_WEEK_GEOJSON',
    dataKind: 'HISTORICAL_OBSERVATION',
    isOfficialAlert: false,
    source: { provider: 'USGS Earthquake Hazards Program', url: USGS_FEED_URL, docsUrl: USGS_FEED_DOCS,
      generatedAt: new Date(generated).toISOString(), window: 'past_7_days', minMagnitude: 4.5 },
    observations,
    rejectedFeatures: rejected,
  };
}

async function readLimitedJson(response) {
  if (!response?.ok) throw new Error('SOURCE_HTTP_ERROR');
  const contentLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) throw new Error('SOURCE_TOO_LARGE');
  if (!response.body?.getReader) throw new Error('SOURCE_STREAM_UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('SOURCE_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    if (size > MAX_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { data: JSON.parse(new TextDecoder().decode(bytes)),
    rawSha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Injectable clock/fetcher enable offline unit tests. */
export function createUsgsEarthquakeFeed({ fetcher = globalThis.fetch, clock = Date.now,
  ttlMs = 60_000, staleMaxMs = 6 * 60 * 60_000, timeoutMs = 6_000 } = {}) {
  let cached = null;
  let inFlight = null;
  let retryAt = 0;
  const output = (entry, status) => ({ ...entry.value, status, fetchedAt: new Date(entry.at).toISOString() });

  async function acquire() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetcher(USGS_FEED_URL, { headers: { Accept: 'application/geo+json, application/json' }, signal: controller.signal });
      const { data, rawSha256 } = await readLimitedJson(res);
      const at = clock();
      const value = normalizeUsgsFeed(data, { now: at });
      value.source.rawSha256 = rawSha256;
      cached = { at, value };
      retryAt = 0;
      return output(cached, 'SOURCE_SNAPSHOT');
    } catch {
      retryAt = clock() + ttlMs;
      if (cached && clock() - cached.at <= staleMaxMs) return output(cached, 'STALE_SNAPSHOT');
      return {
        dataset: 'USGS_M45_WEEK_GEOJSON', status: 'UNAVAILABLE', dataKind: 'HISTORICAL_OBSERVATION',
        isOfficialAlert: false, fetchedAt: null,
        source: { provider: 'USGS Earthquake Hazards Program', url: USGS_FEED_URL, docsUrl: USGS_FEED_DOCS },
        observations: [], rejectedFeatures: 0,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async read() {
      const now = clock();
      if (cached && now - cached.at < ttlMs) return output(cached, 'CACHED_SNAPSHOT');
      if (now < retryAt) {
        if (cached && now - cached.at <= staleMaxMs) return output(cached, 'STALE_SNAPSHOT');
        return { dataset: 'USGS_M45_WEEK_GEOJSON', status: 'UNAVAILABLE', dataKind: 'HISTORICAL_OBSERVATION',
          isOfficialAlert: false, fetchedAt: null,
          source: { provider: 'USGS Earthquake Hazards Program', url: USGS_FEED_URL, docsUrl: USGS_FEED_DOCS },
          observations: [], rejectedFeatures: 0 };
      }
      if (!inFlight) inFlight = acquire().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
