/**
 * Copernicus EMS / EFFIS (European Forest Fire Information System) Active Thermal Anomaly Feed.
 * Source: European Commission / Copernicus Emergency Management Service
 * License: Creative Commons Attribution 4.0 International (CC BY 4.0) / EU Copernicus Open Access
 * Terms: https://effis.jrc.ec.europa.eu/about-effis/data-and-services
 *
 * Grounding: Thermal anomalies represent sensor-detected infrared radiator signatures.
 * They are NOT verified fire perimeters, ground damage evaluations or evacuation dispatches.
 * Strictly anonymous: no private personal data, citizen tracking, or social media ingestion.
 */
import { createHash } from 'node:crypto';

export const EFFIS_DOCS_URL = 'https://effis.jrc.ec.europa.eu/about-effis/data-and-services';
export const EFFIS_API_BASE = 'https://effis.jrc.ec.europa.eu/rest/2/modis/activefire';
export const EFFIS_LICENSE = 'Creative Commons Attribution 4.0 International (CC BY 4.0)';
const SATELLITES = new Set(['Terra', 'Aqua', 'Suomi-NPP', 'NOAA-20', 'NOAA-21', 'SENTINEL-3']);
const INSTRUMENTS = new Set(['MODIS', 'VIIRS', 'SLSTR']);
const DAY_MS = 86_400_000;
const LIMIT_BYTES = 2_500_000;
const MAX_FEATURES = 250;
const MAX_OUTPUT = 150;
const finite = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
const clean = (s, n = 120) => typeof s === 'string' ? s.trim().slice(0, n) : '';

export function buildEffisUrl({ dateStr = null, now = Date.now() } = {}) {
  const d = dateStr || new Date(now).toISOString().slice(0, 10);
  return `${EFFIS_API_BASE}?date=${d}&format=geojson`;
}

/**
 * Normalizes an EFFIS GeoJSON collection of active fire detections.
 * Enforces cryptographic SHA-256 fingerprinting, strict UTC timestamps,
 * instrument metadata, and unambiguous non-alert semantics.
 */
export function normalizeEffisDetections(input, { now = Date.now(), rawSha256 = null, requestedUrl = null } = {}) {
  if (input?.type !== 'FeatureCollection' || !Array.isArray(input.features) ||
      input.features.length > MAX_FEATURES) {
    throw new Error('EFFIS_BAD_GEOJSON');
  }

  const seen = new Set();
  const observations = [];
  let rejectedCount = 0;

  for (const feature of input.features) {
    const p = feature?.properties;
    const geometry = feature?.geometry;
    const coords = geometry?.coordinates;
    const rawId = p?.id || p?.fire_id || p?.FID || p?.track;
    const sat = clean(p?.satellite || p?.satellite_name || 'VIIRS');
    const inst = clean(p?.instrument || (sat.includes('MODIS') ? 'MODIS' : 'VIIRS'));
    const frp = finite(p?.frp, 0, 100_000) ? p.frp : null;
    const confidence = finite(p?.confidence, 0, 100) ? p.confidence : null;

    // Parse date & time (EFFIS formats: "YYYY-MM-DD" and "HH:MM" or unified ISO)
    let acqUtcMs = null;
    if (typeof p?.acq_datetime === 'string') {
      acqUtcMs = Date.parse(p.acq_datetime.endsWith('Z') ? p.acq_datetime : p.acq_datetime + 'Z');
    } else if (typeof p?.acq_date === 'string') {
      const timePart = typeof p?.acq_time === 'string' ? p.acq_time.padStart(4, '0') : '0000';
      const formattedTime = timePart.includes(':') ? timePart : `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:00`;
      acqUtcMs = Date.parse(`${p.acq_date}T${formattedTime}Z`);
    }

    const fid = String(rawId || (coords ? `${coords[0].toFixed(4)}_${coords[1].toFixed(4)}_${acqUtcMs}` : ''));

    if (feature?.type !== 'Feature' || geometry?.type !== 'Point' || !Array.isArray(coords) ||
        !finite(coords[0], -180, 180) || !finite(coords[1], -90, 90) ||
        acqUtcMs === null || !Number.isFinite(acqUtcMs) ||
        acqUtcMs > now + 30 * 60_000 || acqUtcMs < now - 365 * DAY_MS ||
        seen.has(fid) || !fid) {
      rejectedCount++;
      continue;
    }

    seen.add(fid);
    if (observations.length >= MAX_OUTPUT) continue;

    observations.push({
      id: `copernicus-effis:${fid}`,
      rawFeatureId: fid,
      location: { lat: coords[1], lon: coords[0] },
      observedAt: new Date(acqUtcMs).toISOString(),
      satellite: sat,
      instrument: inst,
      fireRadiativePowerMW: frp,
      confidenceScore: confidence,
      dataKind: 'THERMAL_INFRARED_RADIATIVE_ANOMALY',
      geometryMeaning: 'INSTRUMENT_PIXEL_CENTROID_NOT_GROUND_PERIMETER',
      isGroundConfirmedWildfire: false,
      isSendaAlert: false,
      sourceUrl: EFFIS_DOCS_URL,
    });
  }

  // Sort by latest observed timestamp
  observations.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

  return {
    schema: 'senda.osint.copernicus-effis/1',
    dataset: 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES',
    dataKind: 'PUBLIC_EARTH_OBSERVATION_THERMAL_ANOMALIES',
    source: {
      provider: 'European Commission / Copernicus Emergency Management Service (EFFIS)',
      url: requestedUrl || buildEffisUrl({ now }),
      docsUrl: EFFIS_DOCS_URL,
      license: EFFIS_LICENSE,
      licenseKind: 'CC-BY-4.0',
      commercialUsePermitted: true,
      rawSha256: rawSha256 || null,
      fetchedAt: new Date(now).toISOString(),
    },
    observations,
    totalDetections: observations.length,
    rejectedMalformedOrStale: rejectedCount,
    status: 'ACTIVE_SNAPSHOT',
    attribution: 'European Union, Copernicus Emergency Management Service (EFFIS)',
  };
}

export function createCopernicusEffisFeed({ fetchFn = globalThis.fetch, clock = () => Date.now(), ttlMs = 15 * 60_000 } = {}) {
  let cached = null;
  let inFlight = null;

  async function fetchEffis(requestedUrl) {
    if (typeof fetchFn !== 'function') {
      return {
        schema: 'senda.osint.copernicus-effis/1',
        dataset: 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES',
        status: 'UNAVAILABLE',
        error: 'FETCH_UNAVAILABLE',
        observations: [],
        source: { provider: 'Copernicus EFFIS', docsUrl: EFFIS_DOCS_URL, license: EFFIS_LICENSE },
      };
    }

    try {
      const res = await fetchFn(requestedUrl, {
        headers: { 'Accept': 'application/json, application/geo+json', 'User-Agent': 'SENDA-OSINT-Emergency-Relay/1.0' },
      });
      if (!res.ok) {
        return {
          schema: 'senda.osint.copernicus-effis/1',
          dataset: 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES',
          status: 'UNAVAILABLE',
          httpStatus: res.status,
          observations: [],
          source: { provider: 'Copernicus EFFIS', docsUrl: EFFIS_DOCS_URL, license: EFFIS_LICENSE },
        };
      }

      const text = await res.text();
      if (text.length > LIMIT_BYTES) {
        throw new Error('EFFIS_RESPONSE_TOO_LARGE');
      }
      const rawSha256 = createHash('sha256').update(text).digest('hex');
      const data = JSON.parse(text);
      return normalizeEffisDetections(data, { now: clock(), rawSha256, requestedUrl });
    } catch (err) {
      return {
        schema: 'senda.osint.copernicus-effis/1',
        dataset: 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES',
        status: 'UNAVAILABLE',
        error: err.message,
        observations: [],
        source: { provider: 'Copernicus EFFIS', docsUrl: EFFIS_DOCS_URL, license: EFFIS_LICENSE },
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

      const url = buildEffisUrl({ now });
      inFlight = (async () => {
        try {
          const fresh = await fetchEffis(url);
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
    clearCache() {
      cached = null;
    },
  };
}
