export interface LonLat {
  lon: number;
  lat: number;
}

export interface Viewport {
  width: number;
  height: number;
  padding: number;
}

export interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export function boundsOf(points: LonLat[]): Bounds | null {
  const valid = points.filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  if (valid.length === 0) return null;
  return valid.reduce<Bounds>(
    (acc, p) => ({
      minLon: Math.min(acc.minLon, p.lon),
      maxLon: Math.max(acc.maxLon, p.lon),
      minLat: Math.min(acc.minLat, p.lat),
      maxLat: Math.max(acc.maxLat, p.lat),
    }),
    {
      minLon: valid[0].lon,
      maxLon: valid[0].lon,
      minLat: valid[0].lat,
      maxLat: valid[0].lat,
    },
  );
}

/** Equirectangular projection fitted to the viewport. Offline, no tiles. */
export function makeProjector(bounds: Bounds, viewport: Viewport) {
  const spanLon = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const usableW = Math.max(viewport.width - viewport.padding * 2, 1);
  const usableH = Math.max(viewport.height - viewport.padding * 2, 1);
  const scale = Math.min(usableW / spanLon, usableH / spanLat);
  const offsetX = (viewport.width - spanLon * scale) / 2;
  const offsetY = (viewport.height - spanLat * scale) / 2;
  return (point: LonLat): { x: number; y: number } => ({
    x: offsetX + (point.lon - bounds.minLon) * scale,
    y: viewport.height - offsetY - (point.lat - bounds.minLat) * scale,
  });
}

/** Meters offset from a local origin for the WebGL scene. */
export function toLocalMeters(point: LonLat, origin: LonLat): { x: number; z: number } {
  const earthRadius = 6378137;
  const toRad = Math.PI / 180;
  const x = ((point.lon - origin.lon) * toRad) * earthRadius * Math.cos(origin.lat * toRad);
  const z = -((point.lat - origin.lat) * toRad) * earthRadius;
  return { x, z };
}
