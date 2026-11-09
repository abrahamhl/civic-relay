/**
 * SENDA Terrain Lab — research-grade sampled elevation mesh from Mapzen Terrarium.
 * Fixed regions only; no user geolocation, arbitrary URL, or location-history storage.
 * Dataset: https://registry.opendata.aws/terrain-tiles/
 * Source-dependent attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
 *
 * The product is a static, sparsely sampled DEM, NOT live topography, BIM, lidar,
 * verified flooding height, emergency routing proof, or an operational clearance.
 */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { WEATHER_REGIONS } from './weather-grid.mjs';

export const TERRAIN_DATASET = 'MAPZEN_AWS_TERRARIUM';
export const TERRAIN_DOCS = 'https://registry.opendata.aws/terrain-tiles/';
export const TERRAIN_ATTRIBUTION = 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md';
const S3_HOST = 's3.amazonaws.com';
const S3_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const TILE_ZOOM = 10;
const GRID_N = 33;
const TILE_SIZE = 256;
const MAX_TILES = 16;
const MAX_PNG_BYTES = 1_000_000;
const HALF_LAT = 0.12;
const HALF_LON = 0.18;
const HOURS = 3_600_000;
const MAX_STALE = 30 * 24 * HOURS;

const finite = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

function mercatorPoint(lat, lon, zoom = TILE_ZOOM) {
  if (!finite(lat, -85, 85) || !finite(lon, -180, 180)) throw new Error('INVALID_GEO_COORDINATES');
  const n = (2 ** zoom) * TILE_SIZE;
  const latRad = lat * Math.PI / 180;
  return {
    px: (lon + 180) / 360 * n,
    py: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
  };
}

export function terrainRegionBounds(region) {
  const center = WEATHER_REGIONS[region];
  if (!center) throw new Error('TERRAIN_UNKNOWN_REGION');
  return { north: center.lat + HALF_LAT, south: center.lat - HALF_LAT,
    west: center.lon - HALF_LON, east: center.lon + HALF_LON,
    center: { lat: center.lat, lon: center.lon } };
}

export function terrainTileCoverage(region, zoom = TILE_ZOOM) {
  if (!Number.isInteger(zoom) || zoom < 7 || zoom > 11) throw new Error('INVALID_TERRAIN_ZOOM');
  const bounds = terrainRegionBounds(region);
  const northWest = mercatorPoint(bounds.north, bounds.west, zoom);
  const southEast = mercatorPoint(bounds.south, bounds.east, zoom);
  const ids = [];
  for (let y = Math.floor(northWest.py / TILE_SIZE); y <= Math.floor(southEast.py / TILE_SIZE); y++) {
    for (let x = Math.floor(northWest.px / TILE_SIZE); x <= Math.floor(southEast.px / TILE_SIZE); x++) {
      ids.push({ z: zoom, x, y, key: zoom + '/' + x + '/' + y,
        url: S3_BASE + '/' + zoom + '/' + x + '/' + y + '.png' });
    }
  }
  if (ids.length > MAX_TILES) throw new Error('TERRAIN_TILE_BUDGET_EXCEEDED');
  return { bounds, ids };
}

/** Standard PNG CRC-32 (IEEE). Detects corrupted chunks, not source authenticity. */
function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readPng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 65 || buffer.length > MAX_PNG_BYTES ||
      !buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('INVALID_TERRARIUM_PNG');
  let offset = 8, width = 0, height = 0, channels = 0, sawEnd = false;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    if (length > MAX_PNG_BYTES || offset + 8 + length > buffer.length) throw new Error('INVALID_PNG_CHUNKS');
    const kindBytes = buffer.subarray(offset, offset + 4);
    const kind = kindBytes.toString('ascii'); offset += 4;
    const chunk = buffer.subarray(offset, offset + length);
    if (pngCrc32(Buffer.concat([kindBytes, chunk])) !== buffer.readUInt32BE(offset + length)) {
      throw new Error('TERRAIN_PNG_CRC_FAILURE');
    }
    offset += length + 4;
    if (kind === 'IHDR') {
      if (channels || length !== 13) throw new Error('INVALID_PNG_HEADER');
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      if (width !== TILE_SIZE || height !== TILE_SIZE || chunk[8] !== 8 ||
          ![2, 6].includes(chunk[9]) || chunk[10] !== 0 || chunk[11] !== 0 || chunk[12] !== 0) {
        throw new Error('UNSUPPORTED_TERRARIUM_PNG');
      }
      channels = chunk[9] === 2 ? 3 : 4;
    } else if (kind === 'IDAT') {
      idat.push(chunk);
    } else if (kind === 'IEND') {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || !channels || !idat.length) throw new Error('INVALID_PNG_CONTENT');
  const stride = width * channels;
  const image = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  if (image.length !== (stride + 1) * height) throw new Error('TERRARIUM_DECODE_SHAPE');
  const pixels = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = image[pos++];
    if (filter > 4) throw new Error('TERRARIUM_UNSUPPORTED_FILTER');
    for (let i = 0; i < stride; i++) {
      const raw = image[pos++];
      const a = i >= channels ? pixels[y * stride + i - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c;
        const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
        predictor = da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      pixels[y * stride + i] = (raw + predictor) & 255;
    }
  }
  return { channels, pixels, width, height };
}

export function decodeTerrariumPng(buffer) {
  return readPng(buffer);
}

export function terrariumMeters(png, px, py) {
  const x = Math.floor(px), y = Math.floor(py);
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || x >= png.width || y < 0 || y >= png.height) throw new Error('BAD_ELEVATION_PIXEL');
  const offset = (y * png.width + x) * png.channels;
  if (png.channels === 4 && png.pixels[offset + 3] < 128) throw new Error('TERRAIN_NODATA_PIXEL');
  const meters = png.pixels[offset] * 256 + png.pixels[offset + 1] + png.pixels[offset + 2] / 256 - 32768;
  if (!finite(meters, -11000, 9000)) throw new Error('INVALID_ELEVATION_METERS');
  return Math.round(meters * 100) / 100;
}

export function sampleTerrainGrid({ region, pngTiles, zoom = TILE_ZOOM, tileHashes = [], acquiredAt }) {
  const { bounds, ids } = terrainTileCoverage(region, zoom);
  const tileMap = new Map(ids.map((t) => [t.key, t]));
  const samples = [];
  for (let row = 0; row < GRID_N; row++) {
    for (let col = 0; col < GRID_N; col++) {
      const lat = bounds.north - row / (GRID_N - 1) * (bounds.north - bounds.south);
      const lon = bounds.west + col / (GRID_N - 1) * (bounds.east - bounds.west);
      const pos = mercatorPoint(lat, lon, zoom);
      const tx = Math.floor(pos.px / TILE_SIZE), ty = Math.floor(pos.py / TILE_SIZE);
      const key = zoom + '/' + tx + '/' + ty;
      if (!tileMap.has(key)) throw new Error('TERRAIN_COVERAGE_GAP');
      const png = pngTiles.get(key);
      if (!png) throw new Error('TERRAIN_TILE_MISSING');
      const localX = Math.floor(pos.px - tx * TILE_SIZE);
      const localY = Math.floor(pos.py - ty * TILE_SIZE);
      samples.push(terrariumMeters(png, localX, localY));
    }
  }
  const minElevationM = Math.min(...samples), maxElevationM = Math.max(...samples);
  if (!Number.isFinite(minElevationM) || !Number.isFinite(maxElevationM)) throw new Error('INVALID_TERRAIN_GRID');
  const meanLatRad = bounds.center.lat * Math.PI / 180;
  const lengthNSm = (bounds.north - bounds.south) * 111_195;
  const lengthEWm = (bounds.east - bounds.west) * 111_195 * Math.cos(meanLatRad);
  return {
    schema: 'senda.terrain.grid/1',
    region,
    status: 'SOURCE_SNAPSHOT',
    dataKind: 'RASTER_DEM_SAMPLES',
    isObservedLiveSensor: false,
    hasPreciseBuildings: false,
    isVerifiedNavigationClearance: false,
    acquiredAt: acquiredAt || new Date().toISOString(),
    zoom, rows: GRID_N, columns: GRID_N,
    bounds: { north: bounds.north, south: bounds.south, west: bounds.west, east: bounds.east },
    georeference: { crs: 'EPSG:4326', tileMatrix: 'EPSG:3857 / XYZ', horizontalUnit: 'm',
      verticalUnit: 'm', verticalDatum: 'MIXED_SOURCE_NOT_VALIDATED', approximateWidthM: lengthEWm,
      approximateHeightM: lengthNSm },
    elevationsM: samples,
    summary: { minElevationM, maxElevationM, rangeM: Math.round((maxElevationM - minElevationM) * 100) / 100 },
    source: {
      provider: 'Mapzen Terrain Tiles / AWS Open Data', dataset: TERRAIN_DATASET,
      registryUrl: TERRAIN_DOCS, attributionUrl: TERRAIN_ATTRIBUTION,
      license: 'SOURCE_DEPENDENT_ATTRIBUTION',
      attribution: 'Terrain Tiles by Mapzen and underlying terrain providers (see attribution link)',
      offlineRedistributionReviewRequired: true,
      rawTileSha256: tileHashes,
      tileCount: ids.length,
      tileZoom: zoom,
      derivedRasterSamplesOnly: true,
    }
  };
}

async function limitedPng(res) {
  if (!res?.ok) throw new Error('TERRAIN_UPSTREAM_STATUS');
  const length = res.headers?.get('content-length');
  if (length != null && (!Number.isFinite(Number(length)) || Number(length) > MAX_PNG_BYTES)) {
    throw new Error('TERRAIN_TOO_LARGE');
  }
  if (!res.body?.getReader) throw new Error('TERRAIN_STREAM_REQUIRED');
  const reader = res.body.getReader(), chunks = []; let n = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > MAX_PNG_BYTES) throw new Error('TERRAIN_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (n > MAX_PNG_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, n);
  return { png: readPng(bytes), sha256: digest(bytes) };
}

/** Fixed-region, singleflight, bounded requests; caches only decoded samples in server RAM. */
export function createTerrainGridFeed({
  fetcher = globalThis.fetch, clock = Date.now, ttlMs = 24 * HOURS,
  maxStaleMs = MAX_STALE, timeoutMs = 13_000, zoom = TILE_ZOOM,
} = {}) {
  const cached = new Map(), running = new Map(), backoff = new Map();
  const unavailable = (region, status = 'UNAVAILABLE') => ({
    schema: 'senda.terrain.grid/1', region, status, dataKind: 'RASTER_DEM_SAMPLES',
    acquiredAt: null, rows: 0, columns: 0, elevationsM: [],
    source: { provider: 'Mapzen Terrain Tiles / AWS Open Data', registryUrl: TERRAIN_DOCS,
      attributionUrl: TERRAIN_ATTRIBUTION, license: 'SOURCE_DEPENDENT_ATTRIBUTION',
      offlineRedistributionReviewRequired: true }
  });
  const view = (entry, status) => ({ ...entry.data, status, cachedAt: new Date(entry.time).toISOString() });

  async function acquire(region) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { ids } = terrainTileCoverage(region, zoom);
      const tiles = new Map(), hashes = [];
      // Short bounded batches avoid an uncontrolled flood of downloads.
      for (let i = 0; i < ids.length; i += 3) {
        const group = await Promise.all(ids.slice(i, i + 3).map(async ({ url, key }) => {
          const source = new URL(url);
          if (source.protocol !== 'https:' || source.hostname !== S3_HOST) throw new Error('TERRAIN_BAD_ORIGIN');
          const response = await fetcher(url, {
            method: 'GET', signal: controller.signal, redirect: 'error',
            headers: { Accept: 'image/png' },
          });
          const decoded = await limitedPng(response);
          return { key, ...decoded };
        }));
        for (const item of group) {
          tiles.set(item.key, item.png);
          hashes.push({ tile: item.key, sha256: item.sha256 });
        }
      }
      const time = clock();
      const data = sampleTerrainGrid({
        region, pngTiles: tiles, zoom, tileHashes: hashes,
        acquiredAt: new Date(time).toISOString(),
      });
      cached.set(region, { data, time });
      backoff.delete(region);
      return view(cached.get(region), 'SOURCE_SNAPSHOT');
    } catch {
      backoff.set(region, clock() + 2 * HOURS);
      const old = cached.get(region);
      return old && clock() - old.time <= maxStaleMs ? view(old, 'STALE_SNAPSHOT') : unavailable(region);
    } finally { clearTimeout(timer); }
  }

  return {
    async read(region) {
      if (!Object.hasOwn(WEATHER_REGIONS, region)) return unavailable(region, 'INVALID_REGION');
      const now = clock(), old = cached.get(region);
      if (old && now - old.time < ttlMs) return view(old, 'CACHED_SNAPSHOT');
      if (now < (backoff.get(region) || 0)) {
        return old && now - old.time <= maxStaleMs ? view(old, 'STALE_SNAPSHOT') : unavailable(region);
      }
      if (!running.has(region)) running.set(region, acquire(region).finally(() => running.delete(region)));
      return running.get(region);
    },
  };
}
