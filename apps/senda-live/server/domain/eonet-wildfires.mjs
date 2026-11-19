/**
 * NASA EONET v3: curated wildfire event metadata, not fire-front measurements.
 * API contract: https://eonet.gsfc.nasa.gov/docs/v3
 * One representative POINT per curated event. Polygon geometries are not turned
 * into fake centroids. No official emergency alerts or SENDA fire predictions.
 */
import { createHash } from 'node:crypto';

export const EONET_WILDFIRE_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=all&days=30&limit=150';
export const EONET_DOCS_URL = 'https://eonet.gsfc.nasa.gov/docs/v3';
const MAX_BYTES = 1_500_000;
const MAX_EVENTS = 150;
const MAX_AGE_MS = 40 * 86_400_000;
const MAX_OLD_MS = 6 * 60 * 60_000;

const isFiniteIn = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const cleanText = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';

function safeEventUrl(url, id) {
  try {
    const candidate = new URL(url);
    if (candidate.protocol === 'https:' && candidate.hostname === 'eonet.gsfc.nasa.gov' &&
        /^\/api\/v3\/events\/[A-Za-z0-9_-]+\/?$/.test(candidate.pathname)) {
      return candidate.origin + candidate.pathname;
    }
  } catch { /* untrusted upstream URL */ }
  return 'https://eonet.gsfc.nasa.gov/api/v3/events/' + encodeURIComponent(id);
}

function classifyGeometry(event, now) {
  if (!Array.isArray(event.geometry)) return null;
  const candidates = [];
  for (const geometry of event.geometry) {
    const time = Date.parse(geometry?.date);
    const coords = geometry?.coordinates;
    if (geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2) continue;
    if (!isFiniteIn(time, now - MAX_AGE_MS, now + 10 * 60_000)) continue;
    if (!isFiniteIn(coords[0], -180, 180) || !isFiniteIn(coords[1], -90, 90)) continue;
    candidates.push({ time, lat: coords[1], lon: coords[0] });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.time - a.time);
  return candidates[0];
}

export function normalizeEonetWildfires(payload, { now = Date.now(), rawSha256 = null } = {}) {
  if (!payload || !Array.isArray(payload.events) || payload.events.length > MAX_EVENTS) throw new Error('INVALID_EONET_EVENTS');
  const observations = [];
  const seen = new Set();
  let rejectedEvents = 0;
  for (const e of payload.events) {
    const id = e?.id;
    const category = e?.categories?.some((c) => c?.id === 'wildfires');
    const validId = typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);
    if (!validId || !category || seen.has(id)) { rejectedEvents++; continue; }
    seen.add(id);
    const point = classifyGeometry(e, now);
    if (!point) { rejectedEvents++; continue; }
    const closedAt = e.closed == null ? null : Date.parse(e.closed);
    observations.push({
      id: 'eonet:' + id,
      title: cleanText(e.title, 180) || 'Incendio registrado por EONET',
      location: { lat: point.lat, lon: point.lon },
      observedAt: new Date(point.time).toISOString(),
      eventStatus: closedAt === null ? 'CATALOG_OPEN' : 'CATALOG_CLOSED',
      closedAt: Number.isFinite(closedAt) ? new Date(closedAt).toISOString() : null,
      url: safeEventUrl(e.link, id),
      reportedSources: Array.isArray(e.sources) ? [...new Set(e.sources.map((s) => cleanText(s?.id, 80)).filter(Boolean))].slice(0, 12) : [],
      dataKind: 'CURATED_EVENT_METADATA',
      pointMeaning: 'REPRESENTATIVE_CATALOG_LOCATION',
      isPerimeter: false,
      isOfficialAlert: false,
    });
  }
  observations.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  return {
    dataset: 'NASA_EONET_V3_WILDFIRES',
    status: 'SOURCE_SNAPSHOT',
    dataKind: 'CURATED_EVENT_METADATA',
    isPerimeter: false,
    isOfficialAlert: false,
    source: {
      provider: 'NASA EONET',
      url: EONET_WILDFIRE_URL,
      docsUrl: EONET_DOCS_URL,
      category: 'wildfires',
      requestedPeriodDays: 30,
      rawSha256,
      note: 'EONET collects event references. Coordinates are not an observed fire front or a predictive model.',
    },
    observations,
    rejectedEvents,
    requestedLimit: MAX_EVENTS,
    resultLimitReached: payload.events.length === MAX_EVENTS,
  };
}

async function fetchBoundedJson(response) {
  if (!response?.ok) throw new Error('UPSTREAM_UNAVAILABLE');
  const lengthHeader = response.headers?.get('content-length');
  if (lengthHeader != null && (+lengthHeader > MAX_BYTES || !Number.isFinite(+lengthHeader))) throw new Error('TOO_LARGE');
  if (!response.body?.getReader) throw new Error('STREAM_REQUIRED');
  const reader = response.body.getReader();
  const chunks = [];
  let n = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > MAX_BYTES) throw new Error('TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    if (n > MAX_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks.map((v) => Buffer.from(v)), n);
  return { json: JSON.parse(bytes.toString('utf8')), rawSha256: createHash('sha256').update(bytes).digest('hex') };
}

export function createEonetWildfireFeed({
  fetcher = globalThis.fetch, clock = Date.now, ttlMs = 120_000,
  staleMaxMs = MAX_OLD_MS, timeoutMs = 6000,
} = {}) {
  let snapshot = null, inFlight = null, retryAt = 0;
  const fromCache = (status) => ({ ...snapshot.data, status, fetchedAt: new Date(snapshot.at).toISOString() });
  const unavailable = () => ({
    dataset: 'NASA_EONET_V3_WILDFIRES', status: 'UNAVAILABLE',
    dataKind: 'CURATED_EVENT_METADATA', isPerimeter: false,
    isOfficialAlert: false, fetchedAt: null,
    source: { provider: 'NASA EONET', url: EONET_WILDFIRE_URL, docsUrl: EONET_DOCS_URL },
    observations: [], rejectedEvents: 0,
    requestedLimit: MAX_EVENTS, resultLimitReached: false,
  });

  async function refresh() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(EONET_WILDFIRE_URL, {
        signal: controller.signal, headers: { Accept: 'application/json' }, redirect: 'error',
      });
      const { json, rawSha256 } = await fetchBoundedJson(response);
      const at = clock();
      snapshot = { at, data: normalizeEonetWildfires(json, { now: at, rawSha256 }) };
      retryAt = 0;
      return fromCache('SOURCE_SNAPSHOT');
    } catch {
      retryAt = clock() + ttlMs;
      return snapshot && clock() - snapshot.at <= staleMaxMs ? fromCache('STALE_SNAPSHOT') : unavailable();
    } finally { clearTimeout(timer); }
  }

  return {
    async read() {
      const now = clock();
      if (snapshot && now - snapshot.at < ttlMs) return fromCache('CACHED_SNAPSHOT');
      if (now < retryAt) return snapshot && now - snapshot.at <= staleMaxMs ? fromCache('STALE_SNAPSHOT') : unavailable();
      if (!inFlight) inFlight = refresh().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
