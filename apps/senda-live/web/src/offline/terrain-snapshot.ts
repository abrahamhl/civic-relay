/**
 * Local terrain cache: stores only fixed-region public DEM sample grids.
 * This is an on-device cache, not redistribution of raw Mapzen raster tiles.
 * Public release of bundled DEM requires source-by-source rights review.
 * No personal geolocation, movement or account IDs.
 */
export interface TerrainGridSnapshot {
  schema: 'senda.terrain.grid/1';
  region: string;
  status: 'SOURCE_SNAPSHOT' | 'CACHED_SNAPSHOT' | 'STALE_SNAPSHOT';
  dataKind: 'RASTER_DEM_SAMPLES';
  acquiredAt: string;
  rows: number;
  columns: number;
  bounds: { north: number; south: number; west: number; east: number };
  elevationsM: number[];
  georeference: {
    crs: string;
    tileMatrix: string;
    horizontalUnit: string;
    verticalUnit: string;
    verticalDatum: string;
    approximateWidthM: number;
    approximateHeightM: number;
  };
  summary: { minElevationM: number; maxElevationM: number; rangeM: number };
  source: {
    provider: string; dataset: string; registryUrl: string; attributionUrl: string;
    license: string; attribution: string;
    offlineRedistributionReviewRequired: boolean;
    rawTileSha256: Array<{ tile: string; sha256: string }>;
    tileCount: number; tileZoom: number;
  };
}

const DATABASE = 'senda_atmosphere4d_terrain_cache';
const STORE = 'sampled_dem_grids';
const REGIONS = new Set(['valencia', 'madrid', 'arnhem', 'veenendaal']);
const DIGEST = /^[a-f0-9]{64}$/;

export function validateTerrainSnapshot(data: any): data is TerrainGridSnapshot {
  if (!data || data.schema !== 'senda.terrain.grid/1' ||
      data.dataKind !== 'RASTER_DEM_SAMPLES' || !REGIONS.has(data.region) ||
      data.rows !== 33 || data.columns !== 33 ||
      !Array.isArray(data.elevationsM) || data.elevationsM.length !== 1089 ||
      !data.elevationsM.every((h: unknown) => typeof h === 'number' && Number.isFinite(h) && h >= -11000 && h <= 9000)) return false;
  const b = data.bounds;
  if (!b || ![b.north, b.south, b.west, b.east].every(Number.isFinite) ||
      b.north <= b.south || b.east <= b.west) return false;
  if (data.source?.dataset !== 'MAPZEN_AWS_TERRARIUM' ||
      data.source?.license !== 'SOURCE_DEPENDENT_ATTRIBUTION' ||
      !data.source?.offlineRedistributionReviewRequired ||
      !Array.isArray(data.source.rawTileSha256) ||
      !data.source.rawTileSha256.length || data.source.rawTileSha256.length > 16 ||
      !data.source.rawTileSha256.every((t: any) =>
        typeof t.tile === 'string' && DIGEST.test(t.sha256))) return false;
  if (!Number.isFinite(Date.parse(data.acquiredAt))) return false;
  const width = data.georeference?.approximateWidthM;
  const height = data.georeference?.approximateHeightM;
  return typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0 &&
    data.georeference?.crs === 'EPSG:4326' && data.georeference?.verticalUnit === 'm';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('NO_INDEXED_DB'));
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'region' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveTerrainGrid(data: TerrainGridSnapshot): Promise<boolean> {
  if (!validateTerrainSnapshot(data)) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ region: data.region, snapshot: data, cachedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    });
  } catch { return false; }
}
export async function loadTerrainGrid(region: string): Promise<TerrainGridSnapshot | null> {
  if (!REGIONS.has(region)) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(region);
      req.onsuccess = () => {
        db.close();
        const snapshot = req.result?.snapshot;
        resolve(validateTerrainSnapshot(snapshot) && snapshot.region === region ? snapshot : null);
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}
