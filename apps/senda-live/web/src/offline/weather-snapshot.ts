/**
 * SENDA Atmosphere 4D: local cache of PUBLIC weather-model snapshots.
 * No geolocation APIs, user positions, identities, movement histories or tracking.
 * Offline access includes previously downloaded model snapshots, NOT offline map tiles.
 */
export type WeatherMetric = 'temperature_2m' | 'relative_humidity_2m' | 'precipitation' | 'wind_speed_10m';
export interface WeatherPoint {
  index: number;
  lat: number;
  lon: number;
  values: {
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
}
export interface WeatherSnapshot {
  schema: 'senda.atmosphere.grid/1';
  region: string;
  regionName: string;
  requestedCenter: { lat: number; lon: number };
  dataKind: 'MODEL_FORECAST';
  status: string;
  fetchedAt: string;
  times: string[];
  points: WeatherPoint[];
  source: {
    provider: string;
    documentationUrl: string;
    access: string;
    model: string;
    modelRunAt: string | null;
    rawSha256: string;
    units: Record<string, string>;
  };
}

const DATABASE = 'senda_atmosphere4d_public_cache';
const STORE = 'weather_snapshots';
const FORMAT_VERSION = 1;

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('INDEXED_DB_UNAVAILABLE'));
    const request = indexedDB.open(DATABASE, FORMAT_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'region' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function validPublicWeatherSnapshot(data: any): data is WeatherSnapshot {
  if (!data || data.schema !== 'senda.atmosphere.grid/1' ||
      data.dataKind !== 'MODEL_FORECAST' || !Array.isArray(data.times) ||
      data.times.length !== 24 || !Array.isArray(data.points) || data.points.length !== 9 ||
      typeof data.region !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt))) return false;
  if (data.points.some((p: any) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) return false;
  for (const p of data.points) {
    for (const key of ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m']) {
      if (!Array.isArray(p.values?.[key]) || p.values[key].length !== 24 ||
          !p.values[key].every((n: number) => typeof n === 'number' && Number.isFinite(n))) return false;
    }
  }
  return data.times.every((t: string) => Number.isFinite(Date.parse(t)));
}

export async function persistPublicWeatherSnapshot(data: WeatherSnapshot): Promise<boolean> {
  if (!validPublicWeatherSnapshot(data)) return false;
  try {
    const db = await openCache();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ region: data.region, snapshot: data, savedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    });
  } catch { return false; }
}

export async function loadPublicWeatherSnapshot(region: string): Promise<WeatherSnapshot | null> {
  try {
    const db = await openCache();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(region);
      request.onsuccess = () => {
        db.close();
        const data = request.result?.snapshot;
        resolve(validPublicWeatherSnapshot(data) && data.region === region ? data : null);
      };
      request.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

export function weatherSnapshotExpired(data: WeatherSnapshot, now = Date.now()): boolean {
  const last = Date.parse(data.times[data.times.length - 1]);
  return !Number.isFinite(last) || last < now;
}
