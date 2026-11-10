/**
 * GDACS public disaster situation feed: source-issued risk assessments, NOT SENDA alerts.
 * Source: UN/EC GDACS API https://www.gdacs.org/gdacsapi/swagger/index.html
 * Terms: https://www.gdacs.org/documents/2025/GDACS_Terms_of_use_Mar_25.pdf
 * Geometry is a source-designated Point centroid; NOT a hazard polygon or exact impact zone.
 * Contract checked against live API responses on 2026-11-09 (alertlevel, HTTP 204, paging, `source` lineage).
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
const MAX_FEATURES = 110;          // por página (la API limita pageSize a 100)
const MAX_OUTPUT = 100;            // observaciones expuestas a la UI / correlación
const PAGE_SIZE = 100;
const MAX_PAGES = 8;               // tope duro de peticiones por adquisición

/**
 * Linaje declarado por GDACS en `properties.source` (verificado contra respuestas reales del
 * 2026-11-09: NEIC, NCAL SS, GWIS, GLOFAS, GDO, JTWC, NOAA, RSMC). Un evento GDACS hereda la
 * observación de ese proveedor: compararlo con el MISMO proveedor no es corroboración.
 */
export const GDACS_SOURCE_LINEAGE = Object.freeze({
  NEIC: { upstream: 'USGS National Earthquake Information Center', sameUpstreamCatalogs: ['USGS_M45_WEEK_GEOJSON'] },
  'NCAL SS': { upstream: 'USGS / Northern California Seismic System', sameUpstreamCatalogs: ['USGS_M45_WEEK_GEOJSON'] },
  GWIS: { upstream: 'Copernicus Global Wildfire Information System (satellite active-fire detections)', sameUpstreamCatalogs: ['EFFIS', 'NASA_FIRMS'] },
  GLOFAS: { upstream: 'Copernicus Global Flood Awareness System (hydrological MODEL)', sameUpstreamCatalogs: ['GLOFAS'] },
  GDO: { upstream: 'Copernicus Global Drought Observatory', sameUpstreamCatalogs: ['GDO'] },
  JTWC: { upstream: 'Joint Typhoon Warning Center (forecast)', sameUpstreamCatalogs: [] },
  NOAA: { upstream: 'NOAA tropical cyclone advisories (forecast)', sameUpstreamCatalogs: [] },
  RSMC: { upstream: 'WMO Regional Specialized Meteorological Centre (forecast)', sameUpstreamCatalogs: [] },
});
const ALERT_RANK = { Red: 3, Orange: 2, Green: 1 };
const NUMERIC_ID = /^[1-9][0-9]{0,11}$/;
const finite = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
const clean = (s, n = 180) => typeof s === 'string' ? s.trim().slice(0, n) : '';

function parseGdacsDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/.test(x)) return null;
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/.test(x) ? x : x + 'Z';
  const ms = Date.parse(utc);
  return Number.isFinite(ms) ? ms : null;
}
export function buildGdacsUrl(now = Date.now(), pageNumber = 1) {
  if (!Number.isFinite(now)) throw new Error('GDACS_BAD_CLOCK');
  if (!(Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= MAX_PAGES)) throw new Error('GDACS_BAD_PAGE');
  const url = new URL(GDACS_API);
  const date = (t) => new Date(t).toISOString().slice(0, 10);
  url.searchParams.set('fromDate', date(now - 14 * DAY));
  url.searchParams.set('toDate', date(now));
  url.searchParams.set('eventlist', 'EQ,WF,FL,TC,VO,DR');
  // Sin `alertlevel` la API OMITE los eventos verdes (verificado 2026-11-09: 5 frente a >400 registros).
  url.searchParams.set('alertlevel', 'green;orange;red');
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  url.searchParams.set('pageNumber', String(pageNumber));
  return url.toString();
}
function officialPage(type, id) {
  const u = new URL('https://www.gdacs.org/report.aspx');
  u.searchParams.set('eventid', String(id));
  u.searchParams.set('eventtype', type);
  return u.toString();
}

/** Preserve GDACS's own alert level; do not imply an official national evacuation order. */
export function normalizeGdacsEvents(input, { now = Date.now(), rawSha256 = null, requestedUrl = buildGdacsUrl(now), pages = null } = {}) {
  if (input?.type !== 'FeatureCollection' || !Array.isArray(input.features) ||
      input.features.length > MAX_FEATURES * MAX_PAGES) throw new Error('GDACS_BAD_GEOJSON');
  const seen = new Set(), observations = [];
  let rejectedFeatures = 0, duplicateRecords = 0;
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
      // Verificado 2026-11-10: los sismos usan episodeid de 7 cifras (p. ej. 1745684).
      !/^(0|[1-9][0-9]{0,11})$/.test(episode) ||
      start === null || start > now + 15 * 60_000 || start < now - 370 * DAY ||
      modified === null || modified > now + 30 * 60_000 ||
      modified < now - 90 * DAY) { rejectedFeatures++; continue; }
    if (seen.has(key)) {
      // La paginación de GDACS repite registros entre páginas: se conserva la versión más reciente.
      duplicateRecords++;
      const prev = observations.find((o) => o.id === 'gdacs:' + key);
      if (prev && Date.parse(prev.updatedAt) >= modified) continue;
      if (prev) observations.splice(observations.indexOf(prev), 1);
    }
    seen.add(key);
    const providerSource = clean(p?.source, 40) || null;
    const lineage = providerSource ? GDACS_SOURCE_LINEAGE[providerSource] : null;
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
      isCorroboratedByIndependentSource: false,
      providerSource,
      providerSourceId: clean(p?.sourceid, 60) || null,
      upstreamProvider: lineage?.upstream ?? null,
      sameUpstreamCatalogs: lineage ? [...lineage.sameUpstreamCatalogs] : [],
      sourceDependency: lineage ? 'DECLARED_UPSTREAM' : 'SOURCE_DEPENDENCY_UNKNOWN',
    });
  }
  // Prioridad para la vista acotada: nivel de alerta del proveedor y después actualidad.
  observations.sort((a, b) => (ALERT_RANK[b.alertLevel] - ALERT_RANK[a.alertLevel]) || (Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  const sourceRecordsAccepted = observations.length;
  const truncatedForDisplay = observations.length > MAX_OUTPUT;
  observations.length = Math.min(observations.length, MAX_OUTPUT);
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
    observations, rejectedFeatures, duplicateRecords, sourceRecordsAccepted,
    pages,
    requestedLimit: MAX_OUTPUT, resultLimitReached: truncatedForDisplay || (pages?.exhausted === false),
    isSendaEmergencyWarning: false
  };
}

async function readBoundedGeojson(response) {
  if (!response?.ok) throw new Error('GDACS_HTTP_ERROR');
  // Verificado 2026-11-09: sin resultados la API responde 204 con cuerpo vacío. Es «cero eventos»,
  // no una caída del proveedor.
  if (response.status === 204) {
    return { body: { type: 'FeatureCollection', features: [] }, sha256: createHash('sha256').update('').digest('hex'), empty: true };
  }
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
export function createGdacsFeed({ fetcher = globalThis.fetch, clock = Date.now,
  ttlMs = 30 * 60_000, staleMaxMs = 6 * 60 * 60_000, timeoutMs = 20000, maxPages = 5 } = {}) {
  if (!(Number.isInteger(maxPages) && maxPages >= 1 && maxPages <= MAX_PAGES)) throw new Error('GDACS_BAD_PAGE_LIMIT');
  let cached = null, pending = null, nextRetry = 0;
  const view = (status) => ({ ...cached.value, status, fetchedAt: new Date(cached.at).toISOString() });
  const unavailable = () => ({
    schema: 'senda.osint.gdacs/1', dataset: 'GDACS_PUBLIC_DISASTER_EVENTS',
    dataKind: 'PUBLIC_SOURCE_RISK_ASSESSMENT', status: 'UNAVAILABLE',
    source: { provider: 'GDACS', docsUrl: GDACS_DOCS_URL, termsUrl: GDACS_TERMS_URL },
    observations: [], rejectedFeatures: 0, duplicateRecords: 0, sourceRecordsAccepted: 0, pages: null, isSendaEmergencyWarning: false,
    fetchedAt: null, requestedLimit: MAX_OUTPUT, resultLimitReached: false,
  });
  async function acquire() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const t0 = clock();
      const features = [], pageHashes = [];
      let exhausted = false, url = buildGdacsUrl(t0, 1);
      for (let page = 1; page <= maxPages; page++) {
        url = buildGdacsUrl(t0, page);
        const res = await fetcher(url, { signal: controller.signal, redirect: 'error',
          headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'SENDA-OSINT/0.1 (+https://github.com/abrahamhl/civic-relay)' } });
        const { body, sha256 } = await readBoundedGeojson(res);
        if (body?.type !== 'FeatureCollection' || !Array.isArray(body.features) || body.features.length > MAX_FEATURES) throw new Error('GDACS_BAD_GEOJSON');
        pageHashes.push(sha256);
        features.push(...body.features);
        if (body.features.length < PAGE_SIZE) { exhausted = true; break; }
      }
      const now = clock();
      // Hash del conjunto: SHA-256 de los hashes de página en orden (reproducible y verificable).
      const rawSha256 = createHash('sha256').update(pageHashes.join('\n')).digest('hex');
      const value = normalizeGdacsEvents({ type: 'FeatureCollection', features }, { now, rawSha256, requestedUrl: buildGdacsUrl(t0, 1),
        pages: { fetched: pageHashes.length, pageSize: PAGE_SIZE, maxPages, exhausted, pageSha256: pageHashes } });
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
