/**
 * GDACS public disaster situation feed: source-issued risk assessments, NOT SENDA alerts.
 * Source: UN/EC GDACS API https://www.gdacs.org/gdacsapi/swagger/index.html
 * Terms: https://www.gdacs.org/documents/2025/GDACS_Terms_of_use_Mar_25.pdf
 * Geometry is a source-designated Point centroid; NOT a hazard polygon or exact impact zone.
 * Never profiles people, tracks devices, or ingests social-network posts.
 */
import { createHash } from 'node:crypto';

export const GDACS_DOCS_URL = 'https://www.gdacs.org/gdacsapi/swagger/index.html';
export const GDACS_TERMS_URL = 'https://www.gdacs.org/documents/2025/GDACS_Terms_of_use_Mar_25.pdf';
export const GDACS_API = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';
const TYPES = new Set(['EQ', 'WF', 'FL', 'TC', 'VO', 'DR']);
const ALERTS = new Set(['Green', 'Orange', 'Red']);
const DAY = 86_400_000;
const LIMIT_BYTES = 1_800_000;
const MAX_FEATURES = 110;
const MAX_OUTPUT = 100;
const NUMERIC_ID = /^[1-9][0-9]{0,11}$/;
const finite = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
const clean = (s, n = 180) => typeof s === 'string' ? s.trim().slice(0, n) : '';

function parseGdacsDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/.test(x)) return null;
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/.test(x) ? x : x + 'Z';
  const ms = Date.parse(utc);
  return Number.isFinite(ms) ? ms : null;
}
export function buildGdacsUrl(now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('GDACS_BAD_CLOCK');
  const url = new URL(GDACS_API);
  const date = (t) => new Date(t).toISOString().slice(0, 10);
  url.searchParams.set('fromDate', date(now - 14 * DAY));
  url.searchParams.set('toDate', date(now));
  url.searchParams.set('eventlist', 'EQ,WF,FL,TC,VO,DR');
  // Source caps response to 100; no fake pagination or unsupported "limit".
  return url.toString();
}
function officialPage(type, id) {
  const u = new URL('https://www.gdacs.org/report.aspx');
  u.searchParams.set('eventid', String(id));
  u.searchParams.set('eventtype', type);
  return u.toString();
}

/** Preserve GDACS's own alert level; do not imply an official national evacuation order. */
export function normalizeGdacsEvents(input, { now = Date.now(), rawSha256 = null, requestedUrl = buildGdacsUrl(now) } = {}) {
  if (input?.type !== 'FeatureCollection' || !Array.isArray(input.features) ||
      input.features.length > MAX_FEATURES) throw new Error('GDACS_BAD_GEOJSON');
  const seen = new Set(), observations = [];
  let rejectedFeatures = 0;
  for (const feature of input.features) {
    const p = feature?.properties;
    const rawId = p?.eventid;
    const id = typeof rawId === 'number' && Number.isSafeInteger(rawId) ? String(rawId) : rawId;
    const episode = typeof p?.episodeid === 'number' && Number.isSafeInteger(p.episodeid) ? String(p.episodeid) : String(p?.episodeid ?? '');
    const type = p?.eventtype;
    const alert = clean(p?.alertlevel, 20);
    const geometry = feature?.geometry;
    const coords = geometry?.coordinates;
    const start = parseGdacsDate(p?.fromdate);
    const modified = parseGdacsDate(p?.datemodified) ?? parseGdacsDate(p?.todate) ?? start;
    const key = type + ':' + id + ':' + episode;
    if (feature?.type !== 'Feature' || geometry?.type !== 'Point' || !Array.isArray(coords) ||
      !finite(coords[0], -180, 180) || !finite(coords[1], -90, 90) ||
      !TYPES.has(type) || !ALERTS.has(alert) || !NUMERIC_ID.test(id) ||
      !/^(0|[1-9][0-9]{0,5})$/.test(episode) ||
      start === null || start > now + 15 * 60_000 || start < now - 370 * DAY ||
      modified === null || modified > now + 30 * 60_000 ||
      modified < now - 90 * DAY || seen.has(key)) { rejectedFeatures++; continue; }
    seen.add(key);
    if (observations.length === MAX_OUTPUT) continue;
    const score = finite(p?.alertscore, 0, 10) ? p.alertscore : null;
    const severity = p?.severitydata;
    observations.push({
      id: 'gdacs:' + key, eventId: String(id), episodeId: episode,
      eventType: type, alertLevel: alert, alertScore: score,
      title: clean(p?.name, 180) || clean(p?.eventname, 180) || type + ' disaster event',
      country: clean(p?.country, 100),
      location: { lat: coords[1], lon: coords[0] },
      observedAt: new Date(start).toISOString(),
      updatedAt: new Date(modified).toISOString(),
      severity: finite(severity?.severity, 0, 1e10) ? severity.severity : null,
      severityUnit: clean(severity?.severityunit, 32) || null,
      sourceUrl: officialPage(type, id),
      eventOrigin: 'GDACS_RISK_ASSESSMENT',
      geometryMeaning: 'SOURCE_EVENT_REPRESENTATIVE_POINT_NOT_AFFECTED_AREA',
      isNationalPublicWarning: false,
      isSendaAlert: false,
      isCorroboratedByIndependentSource: false
    });
  }
  observations.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    schema: 'senda.osint.gdacs/1',
    dataset: 'GDACS_PUBLIC_DISASTER_EVENTS',
    dataKind: 'PUBLIC_SOURCE_RISK_ASSESSMENT',
    source: {
      provider: 'Global Disaster Awareness and Coordination System (GDACS)',
      url: requestedUrl, docsUrl: GDACS_DOCS_URL,
      termsUrl: GDACS_TERMS_URL, attribution: 'Global Disaster Awareness and Coordination System, GDACS',
      rawSha256, requestedWindowDays: 14,
      note: 'Alert levels are GDACS risk assessments, not government-issued local evacuation instructions.'
    },
    observations, rejectedFeatures,
    requestedLimit: MAX_OUTPUT, resultLimitReached: input.features.length >= MAX_OUTPUT,
    isSendaEmergencyWarning: false
  };
}

async function readBoundedGeojson(response) {
  if (!response?.ok) throw new Error('GDACS_HTTP_ERROR');
  const sizeHeader = response.headers?.get('content-length');
  if (sizeHeader != null && (!/^\d+$/.test(sizeHeader) || +sizeHeader > LIMIT_BYTES)) throw new Error('GDACS_OVERSIZE');
  if (!response.body?.getReader) throw new Error('GDACS_STREAM_REQUIRED');
  const reader = response.body.getReader(), chunks = [];
  let n = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > LIMIT_BYTES) throw new Error('GDACS_OVERSIZE');
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (n > LIMIT_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, n);
  return { body: JSON.parse(bytes.toString('utf8')),
    sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** 30min cache, single-flight, bounded data, fixed official host, safe failure. */
export function createGdacsFeed({ fetcher = globalThis.fetch, clock = Date.now(),
  ttlMs = 30 * 60_000, staleMaxMs = 6 * 60 * 60_000, timeoutMs = 8000 } = {}) {
  let cached = null, pending = null, nextRetry = 0;
  const view = (status) => ({ ...cached.value, status, fetchedAt: new Date(cached.at).toISOString() });
  const unavailable = () => ({
    schema: 'senda.osint.gdacs/1', dataset: 'GDACS_PUBLIC_DISASTER_EVENTS',
    dataKind: 'PUBLIC_SOURCE_RISK_ASSESSMENT', status: 'UNAVAILABLE',
    source: { provider: 'GDACS', docsUrl: GDACS_DOCS_URL, termsUrl: GDACS_TERMS_URL },
    observations: [], rejectedFeatures: 0, isSendaEmergencyWarning: false,
    fetchedAt: null, requestedLimit: MAX_OUTPUT, resultLimitReached: false,
  });
  async function acquire() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = buildGdacsUrl(clock());
      const res = await fetcher(url, { signal: controller.signal, redirect: 'error',
        headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'SENDA-OSINT/0.1 (+https://github.com/abrahamhl/civic-relay)' } });
      const { body, sha256 } = await readBoundedGeojson(res);
      const now = clock();
      const value = normalizeGdacsEvents(body, { now, rawSha256: sha256, requestedUrl: url });
      cached = { at: now, value };
      nextRetry = 0;
      return view('SOURCE_SNAPSHOT');
    } catch {
      nextRetry = clock() + ttlMs;
      return cached && clock() - cached.at <= staleMaxMs ? view('STALE_SNAPSHOT') : unavailable();
    } finally { clearTimeout(timer); }
  }
  return {
    async read() {
      const now = clock();
      if (cached && now - cached.at < ttlMs) return view('CACHED_SNAPSHOT');
      if (now < nextRetry) return cached && now - cached.at <= staleMaxMs ? view('STALE_SNAPSHOT') : unavailable();
      if (!pending) pending = acquire().finally(() => { pending = null; });
      return pending;
    }
  };
}
