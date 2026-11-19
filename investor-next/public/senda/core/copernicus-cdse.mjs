/**
 * Copernicus Data Space Ecosystem (CDSE) STAC Adapter (L4.2)
 *
 * Discovers Sentinel-1 and Sentinel-2 scenes via the public OGC STAC 1.0.0 API:
 * https://catalogue.dataspace.copernicus.eu/stac/search
 *
 * Epistemic Rules:
 * 1. METADATA ONLY: Browse thumbnails and footprint geometries are public.
 * 2. NO HEAVY RASTER DOWNLOADS: Multi-gigabyte Sentinel SAFE/JP2 files require
 *    account authentication and are strictly forbidden on constrained edge devices.
 * 3. NO SIMULATED REAL-TIME: If cloud cover obscures the target, report actual cloud %;
 *    never synthesize a "cloud-free current view".
 */

export const CDSE_STAC_SEARCH_URL = 'https://catalogue.dataspace.copernicus.eu/stac/search';

/**
 * Validates bounding box coordinates [minLon, minLat, maxLon, maxLat].
 */
export function isValidBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (
    Number.isFinite(minLon) &&
    Number.isFinite(minLat) &&
    Number.isFinite(maxLon) &&
    Number.isFinite(maxLat) &&
    minLon >= -180 &&
    maxLon <= 180 &&
    minLat >= -90 &&
    maxLat <= 90 &&
    minLon <= maxLon &&
    minLat <= maxLat
  );
}

/**
 * Builds standard STAC search POST body.
 */
export function buildCdseStacQuery({
  bbox,
  dateRange,
  maxCloudCoverPct = 30,
  collections = ['SENTINEL-2'],
  limit = 10
} = {}) {
  if (!isValidBbox(bbox)) {
    throw new Error('INVALID_BBOX: Expected [minLon, minLat, maxLon, maxLat] with valid geographic coordinates');
  }

  const queryBody = {
    bbox,
    collections,
    limit: Math.max(1, Math.min(50, limit))
  };

  if (dateRange && typeof dateRange === 'object') {
    const start = dateRange.start || '..';
    const end = dateRange.end || '..';
    queryBody.datetime = `${start}/${end}`;
  }

  if (collections.includes('SENTINEL-2') && typeof maxCloudCoverPct === 'number') {
    queryBody.query = {
      'eo:cloud_cover': {
        lte: Math.max(0, Math.min(100, maxCloudCoverPct))
      }
    };
  }

  return queryBody;
}

/**
 * Normalizes a single STAC GeoJSON feature into a SENDA Scene record.
 */
export function normalizeCdseStacFeature(feature) {
  if (!feature || typeof feature !== 'object') return null;

  const props = feature.properties || {};
  const assets = feature.assets || {};

  const cloudCover = typeof props['eo:cloud_cover'] === 'number' ? props['eo:cloud_cover'] : null;
  const orbitState = props['sat:orbit_state'] || props['orbitState'] || 'UNKNOWN';
  const platform = props.platform || 'UNKNOWN';
  const collection = feature.collection || 'UNKNOWN';

  // Thumbnail / preview image URL
  const thumbnailUrl = assets.thumbnail?.href || assets.quicklook?.href || assets.visual?.href || null;

  return {
    id: feature.id,
    collection,
    platform: platform.toUpperCase(),
    datetime: props.datetime || null,
    cloudCoverPct: cloudCover,
    orbitDirection: orbitState.toUpperCase(),
    bbox: feature.bbox || null,
    geometry: feature.geometry || null,
    thumbnailUrl,
    processingLevel: props['processing:level'] || null,
    isUsableForOpticalAssessment: cloudCover !== null ? cloudCover <= 25 : true,
    epistemicStatus: 'METADATA_ONLY_NO_HEAVY_RASTER',
    retrievedAtUtc: new Date().toISOString()
  };
}

/**
 * Normalizes an entire STAC search response.
 */
export function normalizeCdseStacResponse(stacJson) {
  if (!stacJson || typeof stacJson !== 'object') {
    return { ok: false, error: 'INVALID_STAC_RESPONSE', scenes: [] };
  }

  const features = Array.isArray(stacJson.features) ? stacJson.features : [];
  const scenes = [];

  for (const f of features) {
    const norm = normalizeCdseStacFeature(f);
    if (norm) scenes.push(norm);
  }

  return {
    ok: true,
    matchedCount: stacJson.context?.matched ?? scenes.length,
    returnedCount: scenes.length,
    scenes,
    epistemicStatus: 'METADATA_DISCOVERED',
    warning:
      'Solo metadatos de catálogo y previsualizaciones ópticas/SAR ligeras. Los productos brutos de varios gigabytes requieren cuenta CDSE y están excluidos del terminal de emergencia.'
  };
}

/**
 * Performs STAC scene query with strict timeout and fallback safety.
 */
export async function searchCdseStac({
  bbox,
  dateRange,
  maxCloudCoverPct = 30,
  collections = ['SENTINEL-2'],
  limit = 10,
  fetchImpl = globalThis.fetch,
  timeoutMs = 6000
} = {}) {
  const body = buildCdseStacQuery({ bbox, dateRange, maxCloudCoverPct, collections, limit });

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      error: 'NO_FETCH_IMPLEMENTATION',
      scenes: []
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetchImpl(CDSE_STAC_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      return {
        ok: false,
        error: `HTTP_${resp.status}`,
        scenes: []
      };
    }

    const json = await resp.json();
    return normalizeCdseStacResponse(json);
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'TIMEOUT' : err.message || 'FETCH_FAILED',
      scenes: []
    };
  }
}

/**
 * Filters a list of scenes by cloud cover tolerance.
 */
export function filterScenesByCloudCover(scenes, maxCloudPct = 20) {
  if (!Array.isArray(scenes)) return [];
  return scenes.filter((s) => s.cloudCoverPct === null || s.cloudCoverPct <= maxCloudPct);
}

/**
 * Converts scenes into a GeoJSON FeatureCollection for MapLibre or GIS 4D timelines.
 */
export function exportScenesAsGeoJson(scenes) {
  const features = (scenes || [])
    .filter((s) => s && s.geometry)
    .map((s) => ({
      type: 'Feature',
      id: s.id,
      bbox: s.bbox,
      geometry: s.geometry,
      properties: {
        id: s.id,
        platform: s.platform,
        collection: s.collection,
        datetime: s.datetime,
        cloudCoverPct: s.cloudCoverPct,
        thumbnailUrl: s.thumbnailUrl,
        epistemicStatus: s.epistemicStatus
      }
    }));

  return {
    type: 'FeatureCollection',
    features
  };
}
