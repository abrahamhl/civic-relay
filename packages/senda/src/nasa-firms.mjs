/**
 * NASA FIRMS (Fire Information for Resource Management System) Adapter (L4.3)
 *
 * Ingests thermal anomaly hotspot points from VIIRS (S-NPP, NOAA-20, NOAA-21) and MODIS (Terra, Aqua).
 *
 * Inactive Adapter Protocol:
 * 1. REQUIRES MAP_KEY: FIRMS API strictly requires a valid NASA Earthdata / FIRMS MAP_KEY.
 *    If the environment variable FIRMS_MAP_KEY is unset or empty, the adapter remains INACTIVE,
 *    returns safe structured empty state, and does not perform unauthenticated network calls.
 * 2. EPISTEMIC DISTINCTION (HOTSPOT_NOT_BURNT_PERIMETER):
 *    A satellite thermal anomaly pixel represents radiative energy (FRP, MW) detected at acquisition time.
 *    It is NOT an isochrone, a front propagation line, or a burnt area perimeter.
 *    Burnt perimeters require Copernicus EMS or ground-truth delineations.
 */

export const FIRMS_API_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area';

/**
 * Validates whether a MAP_KEY looks well-formed (32-character hexadecimal string).
 */
export function isValidFirmsMapKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  return /^[0-9a-fA-F]{32}$/.test(trimmed);
}

/**
 * Combines YYYY-MM-DD and HHMM string into ISO UTC string.
 */
export function formatFirmsUtcTimestamp(acqDate, acqTime) {
  if (!acqDate || !acqTime) return null;
  const timePadded = String(acqTime).padStart(4, '0');
  const hh = timePadded.slice(0, 2);
  const mm = timePadded.slice(2, 4);
  return `${acqDate}T${hh}:${mm}:00Z`;
}

/**
 * Normalizes a raw FIRMS record (JSON or parsed CSV row).
 */
export function normalizeFirmsHotspot(row) {
  if (!row || typeof row !== 'object') return null;

  const lat = parseFloat(row.latitude);
  const lon = parseFloat(row.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const frp = Number.isFinite(parseFloat(row.frp)) ? parseFloat(row.frp) : 0;
  const brightness = Number.isFinite(parseFloat(row.bright_ti4))
    ? parseFloat(row.bright_ti4)
    : Number.isFinite(parseFloat(row.brightness))
    ? parseFloat(row.brightness)
    : 300;

  const confidence = String(row.confidence || 'nominal').toLowerCase();
  const instrument = String(row.instrument || (row.bright_ti4 ? 'VIIRS' : 'MODIS')).toUpperCase();
  const satellite = String(row.satellite || 'UNKNOWN').toUpperCase();

  const timestampIso = formatFirmsUtcTimestamp(row.acq_date, row.acq_time);

  return {
    pointId: `firms-${lat.toFixed(4)}-${lon.toFixed(4)}-${row.acq_date || ''}-${row.acq_time || ''}`,
    coordinates: [lon, lat], // GeoJSON order [longitude, latitude]
    latitude: lat,
    longitude: lon,
    frpMegawatts: frp,
    brightnessKelvin: brightness,
    confidence, // 'low' | 'nominal' | 'high'
    instrument,
    satellite,
    daynight: row.daynight === 'D' ? 'DAY' : 'NIGHT',
    observedAtUtc: timestampIso,
    epistemicStatus: 'OBSERVED_THERMAL_ANOMALY_POINT',
    warning:
      'HOTSPOT_NOT_BURNT_PERIMETER: Este punto representa una anomalía térmica radiativa en el píxel; no constituye un perímetro de fuego ni confirma presencia de llamas en superficie.'
  };
}

/**
 * Queries FIRMS API with safety gates.
 * Inactive when mapKey is absent or empty.
 */
export async function queryFirmsHotspots({
  bbox,
  mapKey = process.env.FIRMS_MAP_KEY,
  source = 'VIIRS_SNPP_NRT',
  dayRange = 1,
  fetchImpl = globalThis.fetch,
  timeoutMs = 6000
} = {}) {
  // Gate 1: Check key presence
  if (!mapKey || !isValidFirmsMapKey(mapKey)) {
    return {
      ok: false,
      status: 'INACTIVE',
      reason: 'FIRMS_MAP_KEY_REQUIRED',
      count: 0,
      points: [],
      epistemicStatus: 'ADAPTER_INACTIVE_NO_KEY',
      warning:
        'Adaptador NASA FIRMS inactivo: Requiere clave de mapa (FIRMS_MAP_KEY) configurada en variables de entorno seguras.'
    };
  }

  // Gate 2: Bounding box validation
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return {
      ok: false,
      status: 'ERROR',
      reason: 'INVALID_BBOX',
      count: 0,
      points: []
    };
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bboxStr = `${minLon},${minLat},${maxLon},${maxLat}`;
  const clampedDays = Math.max(1, Math.min(10, dayRange || 1));
  const url = `${FIRMS_API_BASE}/csv/${mapKey}/${source}/${bboxStr}/${clampedDays}`;

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      status: 'ERROR',
      reason: 'NO_FETCH_IMPLEMENTATION',
      count: 0,
      points: []
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetchImpl(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return {
        ok: false,
        status: 'HTTP_ERROR',
        reason: `HTTP_${resp.status}`,
        count: 0,
        points: []
      };
    }

    const csvText = await resp.text();
    const rows = parseFirmsCsv(csvText);
    const points = rows.map(normalizeFirmsHotspot).filter(Boolean);

    return {
      ok: true,
      status: 'ACTIVE',
      count: points.length,
      points,
      source,
      epistemicStatus: 'OBSERVED_THERMAL_ANOMALIES',
      warning: 'HOTSPOT_NOT_BURNT_PERIMETER: Los puntos representan anomalías térmicas, no perímetros quemados.'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 'ERROR',
      reason: err.name === 'AbortError' ? 'TIMEOUT' : err.message || 'FETCH_FAILED',
      count: 0,
      points: []
    };
  }
}

/**
 * Basic CSV parser for FIRMS comma-separated tables.
 */
export function parseFirmsCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < headers.length) continue;
    const rec = {};
    for (let h = 0; h < headers.length; h++) {
      rec[headers[h]] = cols[h];
    }
    records.push(rec);
  }

  return records;
}

/**
 * Exports normalized hotspots as GeoJSON FeatureCollection.
 */
export function exportHotspotsAsGeoJson(hotspots) {
  const features = (hotspots || [])
    .filter((h) => h && Array.isArray(h.coordinates))
    .map((h) => ({
      type: 'Feature',
      id: h.pointId,
      geometry: {
        type: 'Point',
        coordinates: h.coordinates
      },
      properties: {
        pointId: h.pointId,
        frpMegawatts: h.frpMegawatts,
        brightnessKelvin: h.brightnessKelvin,
        confidence: h.confidence,
        instrument: h.instrument,
        satellite: h.satellite,
        daynight: h.daynight,
        observedAtUtc: h.observedAtUtc,
        epistemicStatus: h.epistemicStatus
      }
    }));

  return {
    type: 'FeatureCollection',
    features
  };
}
