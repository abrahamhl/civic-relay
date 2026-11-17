/**
 * Official Severe Weather & Civil Protection Warnings (AEMET / Meteoalarm / CAP).
 * Standard: OASIS Common Alerting Protocol (CAP-v1.2) / Meteoalarm GeoJSON.
 *
 * Source: State Meteorological Agency (AEMET, Spain) / EUMETNET Meteoalarm.
 * Terms: Re-use of public sector information (Directive (EU) 2019/1024 / Ley 37/2007).
 *
 * Grounding: These are OFFICIAL warnings issued by accredited state meteorological agencies.
 * SENDA DOES NOT originate, modify, elevate or suppress official government warning levels.
 * Non-tracking: no private telemetry or user location stored.
 */
import { createHash } from 'node:crypto';

export const AEMET_DOCS_URL = 'https://opendata.aemet.es/dist/index.html';
export const METEOALARM_DOCS_URL = 'https://www.meteoalarm.org';
export const AEMET_AVISOS_API = 'https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/esp';

const SEVERITIES = Object.freeze({
  Yellow: { level: 'MODERATE', color: '#eab308', priority: 2 },
  Orange: { level: 'SEVERE', color: '#f97316', priority: 3 },
  Red: { level: 'EXTREME', color: '#dc2626', priority: 4 },
  Green: { level: 'NO_WARNING', color: '#22c55e', priority: 1 },
});

const CAP_SEVERITIES = new Set(['Minor', 'Moderate', 'Severe', 'Extreme', 'Unknown']);
const URGENCY = new Set(['Immediate', 'Expected', 'Future', 'Past', 'Unknown']);
const CERTAINTY = new Set(['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown']);
const LIMIT_BYTES = 2_000_000;
const MAX_ALERTS = 120;
const finite = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
const clean = (s, n = 200) => typeof s === 'string' ? s.trim().slice(0, n) : '';

export function normalizeCapAlert(featureOrAlert, { now = Date.now() } = {}) {
  const p = featureOrAlert?.properties || featureOrAlert;
  const geometry = featureOrAlert?.geometry;
  const rawId = p?.identifier || p?.id || p?.alert_id;
  if (!rawId) return null;

  const sender = clean(p?.sender || p?.senderName || 'AEMET / Meteoalarm', 80);
  const headline = clean(p?.headline || p?.event || 'Aviso meteorológico oficial', 180);
  const description = clean(p?.description, 500);
  const instruction = clean(p?.instruction, 500);
  const severityRaw = p?.severity || p?.level || 'Moderate';
  const certainty = clean(p?.certainty || 'Likely', 20);
  const urgency = clean(p?.urgency || 'Expected', 20);

  // Temporal validation
  const onsetStr = p?.onset || p?.effective || p?.fromdate;
  const expiresStr = p?.expires || p?.todate;
  const onsetMs = Date.parse(onsetStr);
  const expiresMs = Date.parse(expiresStr);

  if (!Number.isFinite(onsetMs) || !Number.isFinite(expiresMs)) return null;
  if (expiresMs < now - 24 * 3600_000 || onsetMs > now + 14 * 86_400_000) return null;

  // Coordinate / Location parsing
  let location = null;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates) &&
      finite(geometry.coordinates[0], -180, 180) && finite(geometry.coordinates[1], -90, 90)) {
    location = { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
  } else if (p?.centroid && finite(p.centroid.lat, -90, 90) && finite(p.centroid.lon, -180, 180)) {
    location = { lat: p.centroid.lat, lon: p.centroid.lon };
  } else if (finite(p?.lat, -90, 90) && finite(p?.lon, -180, 180)) {
    location = { lat: p.lat, lon: p.lon };
  }

  const areaDesc = clean(p?.areaDesc || p?.area || 'Zona meteorológica oficial', 120);
  const levelInfo = SEVERITIES[severityRaw] || { level: severityRaw.toUpperCase(), color: '#eab308', priority: 2 };

  return {
    id: `official-warning:${rawId}`,
    capIdentifier: String(rawId),
    sender,
    areaDesc,
    location,
    headline,
    description: description || null,
    instruction: instruction || null,
    severity: levelInfo.level,
    severityColor: levelInfo.color,
    urgency,
    certainty,
    onset: new Date(onsetMs).toISOString(),
    expires: new Date(expiresMs).toISOString(),
    isOfficialGovernmentWarning: true,
    isSendaGeneratedAlert: false,
    sourceAttribution: 'Agencia Estatal de Meteorología (AEMET) / EUMETNET Meteoalarm',
    sourceUrl: AEMET_DOCS_URL,
  };
}

export function normalizeCapAlertCollection(input, { now = Date.now(), rawSha256 = null, requestedUrl = null } = {}) {
  const items = Array.isArray(input?.features) ? input.features : (Array.isArray(input?.alerts) ? input.alerts : (Array.isArray(input) ? input : []));
  if (items.length > MAX_ALERTS) throw new Error('CAP_TOO_MANY_ALERTS');

  const seen = new Set();
  const warnings = [];

  for (const item of items) {
    const parsed = normalizeCapAlert(item, { now });
    if (!parsed || seen.has(parsed.capIdentifier)) continue;
    seen.add(parsed.capIdentifier);
    warnings.push(parsed);
  }

  // Sort by priority (Extreme > Severe > Moderate) then expiration
  warnings.sort((a, b) => {
    const prioA = a.severity === 'EXTREME' ? 4 : (a.severity === 'SEVERE' ? 3 : 2);
    const prioB = b.severity === 'EXTREME' ? 4 : (b.severity === 'SEVERE' ? 3 : 2);
    return prioB - prioA || Date.parse(a.expires) - Date.parse(b.expires);
  });

  return {
    schema: 'senda.osint.official-warnings-cap/1',
    dataset: 'AEMET_METEOALARM_OFFICIAL_WARNINGS',
    dataKind: 'OFFICIAL_CIVIL_PROTECTION_WEATHER_WARNINGS',
    source: {
      provider: 'AEMET / Meteoalarm Official Severe Weather Alerts',
      url: requestedUrl || AEMET_DOCS_URL,
      docsUrl: AEMET_DOCS_URL,
      rawSha256: rawSha256 || null,
      fetchedAt: new Date(now).toISOString(),
      license: 'Reutilización de Información del Sector Público (Ley 37/2007, AEMET)',
      isOfficialAuthority: true,
    },
    warnings,
    totalActiveWarnings: warnings.length,
    status: 'ACTIVE_SNAPSHOT',
    caveat: 'Avisos oficiales emitidos por organismos estatales acreditados. SENDA actúa como retransmisor fiel y neutral sin alterar umbrales.',
  };
}

export function createAemetCapFeed({ fetchFn = globalThis.fetch, clock = () => Date.now(), ttlMs = 10 * 60_000 } = {}) {
  let cached = null;
  let inFlight = null;

  async function fetchFeed(url) {
    if (typeof fetchFn !== 'function') {
      return {
        schema: 'senda.osint.official-warnings-cap/1',
        dataset: 'AEMET_METEOALARM_OFFICIAL_WARNINGS',
        status: 'UNAVAILABLE',
        error: 'FETCH_UNAVAILABLE',
        warnings: [],
        source: { provider: 'AEMET / Meteoalarm' },
      };
    }

    try {
      const res = await fetchFn(url, {
        headers: { 'Accept': 'application/json, application/geo+json', 'User-Agent': 'SENDA-OSINT-Emergency-Relay/1.0' },
      });
      if (!res.ok) {
        return {
          schema: 'senda.osint.official-warnings-cap/1',
          dataset: 'AEMET_METEOALARM_OFFICIAL_WARNINGS',
          status: 'UNAVAILABLE',
          httpStatus: res.status,
          warnings: [],
          source: { provider: 'AEMET / Meteoalarm' },
        };
      }

      const text = await res.text();
      if (text.length > LIMIT_BYTES) throw new Error('CAP_RESPONSE_OVERSIZED');
      const rawSha256 = createHash('sha256').update(text).digest('hex');
      const json = JSON.parse(text);
      return normalizeCapAlertCollection(json, { now: clock(), rawSha256, requestedUrl: url });
    } catch (err) {
      return {
        schema: 'senda.osint.official-warnings-cap/1',
        dataset: 'AEMET_METEOALARM_OFFICIAL_WARNINGS',
        status: 'UNAVAILABLE',
        error: err.message,
        warnings: [],
        source: { provider: 'AEMET / Meteoalarm' },
      };
    }
  }

  return {
    async read(force = false) {
      const now = clock();
      if (!force && cached && now - cached.timestamp < ttlMs && cached.data.status !== 'UNAVAILABLE') {
        return cached.data;
      }
      if (inFlight) return inFlight;

      inFlight = (async () => {
        try {
          const fresh = await fetchFeed(AEMET_AVISOS_API);
          if (fresh.status !== 'UNAVAILABLE') {
            cached = { timestamp: now, data: fresh };
          } else if (cached?.data) {
            return { ...cached.data, status: 'STALE_SNAPSHOT', note: 'Upstream unavailable; preserving verified cached state' };
          }
          return fresh;
        } finally {
          inFlight = null;
        }
      })();

      return inFlight;
    },
    clearCache() { cached = null; },
  };
}
