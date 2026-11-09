/**
 * SENDA · Proyección UTM sobre WGS84 (Snyder, «Map Projections — A Working Manual», USGS PP 1395, 1987).
 * Precisión submétrica dentro de la zona. Sin dependencias: funciona en el navegador y sin red.
 */
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = 0.9996, rad = (d) => (d * Math.PI) / 180;
const M0 = 1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256;
const meridian = (p) => A * (M0 * p - ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * p) + ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * p) - ((35 * E2 ** 3) / 3072) * Math.sin(6 * p));
export const utmZone = (lon) => Math.floor((lon + 180) / 6) + 1;
/** (lat, lon) en grados → { x (este), y (norte) } en metros, zona `zone` (hemisferio norte). */
export function toUtm(lat, lon, zone = utmZone(lon)) {
  const p = rad(lat), l0 = rad(zone * 6 - 183), N = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = EP2 * Math.cos(p) ** 2, Aa = Math.cos(p) * (rad(lon) - l0);
  const x = K0 * N * (Aa + ((1 - T + C) * Aa ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5) / 120) + 500000;
  const y = K0 * (meridian(p) + N * Math.tan(p) * ((Aa * Aa) / 2 + ((5 - T + 9 * C + 4 * C * C) * Aa ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6) / 720));
  return { x, y, zone };
}
/** { x, y } UTM (hemisferio norte) → { lat, lon } en grados. */
export function fromUtm(x, y, zone) {
  const mu = y / K0 / (A * M0), e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = EP2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2, N1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2), R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5, D = (x - 500000) / (N1 * K0);
  const lat = p1 - ((N1 * Math.tan(p1)) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = rad(zone * 6 - 183) + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) / Math.cos(p1);
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}
