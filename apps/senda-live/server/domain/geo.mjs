/**
 * Geografía con privacidad por defecto. Reutiliza la distancia de `@senda/core` (zones.mjs).
 * Regla: lo público se guarda redondeado a 0,01° (≈1,1 km). Nunca se publica una posición
 * precisa de una persona.
 */
import { haversineKm } from '@senda/core/src/zones.mjs';

export { haversineKm };
export const COARSE_DECIMALS = 2;

export function validLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function coarsen(lat, lon, decimals = COARSE_DECIMALS) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) return { lat: null, lon: null };
  const la = Number(lat), lo = Number(lon);
  if (!validLatLon(la, lo)) throw Object.assign(new Error('BAD_COORDINATES'), { code: 'BAD_COORDINATES' });
  const f = 10 ** decimals;
  return { lat: Math.round(la * f) / f, lon: Math.round(lo * f) / f };
}

/** bbox = [minLon, minLat, maxLon, maxLat] */
export function parseBbox(v) {
  if (v === undefined || v === null || v === '') return null;
  const arr = Array.isArray(v) ? v.map(Number) : String(v).split(',').map(Number);
  if (arr.length !== 4 || arr.some((n) => !Number.isFinite(n))) throw Object.assign(new Error('BAD_BBOX'), { code: 'BAD_BBOX' });
  const [a, b, c, d] = arr;
  if (!validLatLon(b, a) || !validLatLon(d, c) || a > c || b > d) throw Object.assign(new Error('BAD_BBOX'), { code: 'BAD_BBOX' });
  return [a, b, c, d];
}

export function bboxAround(lat, lon, radiusKm) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

export function inBbox(lat, lon, bbox) {
  if (!bbox || lat === null || lon === null) return false;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

export function bboxContains(outer, inner) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

export function bboxIntersects(a, b) {
  return !(b[0] > a[2] || b[2] < a[0] || b[1] > a[3] || b[3] < a[1]);
}

/** Punto en polígono (ray casting). polygon = [[lon,lat], ...] */
export function pointInPolygon(lat, lon, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function parsePolygon(v) {
  if (!v) return null;
  let arr = v;
  if (typeof v === 'string') { try { arr = JSON.parse(v); } catch { throw Object.assign(new Error('BAD_POLYGON'), { code: 'BAD_POLYGON' }); } }
  if (!Array.isArray(arr) || arr.length < 3 || arr.length > 200) throw Object.assign(new Error('BAD_POLYGON'), { code: 'BAD_POLYGON' });
  const poly = arr.map((p) => [Number(p[0]), Number(p[1])]);
  if (poly.some(([lo, la]) => !validLatLon(la, lo))) throw Object.assign(new Error('BAD_POLYGON'), { code: 'BAD_POLYGON' });
  return poly;
}

export function polygonBbox(poly) {
  const lons = poly.map((p) => p[0]), lats = poly.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}
