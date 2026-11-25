/**
 * SENDA · ciencia del incendio sobre mallas (combustible, terreno, cicatriz real, probabilidad).
 * Cada capa declara si es REAL (medida o derivada directamente de un dato medido) o MODELO.
 *
 *  - Pendiente y orientación: método de Horn (1981), «Hill shading and the reflectance map», Proc. IEEE 69(1):14-47.
 *  - Combustible: clasificación de SENDA por NDVI de Sentinel-2 del 16-07-2026 (regla guardada en real.json).
 *  - Carga de combustible: FUEL_LOAD de fire-watch (valores ORIENTATIVOS, no medidos en campo).
 *  - Cicatriz: dNBR de Sentinel-2 por fecha (bits de burn_100m.bin), umbral «moderada-baja o más».
 *  - UTM ↔ geográficas: Snyder (USGS PP 1395, 1987).
 */
import { FUEL_LOAD } from './fire-watch.mjs';

const D = Math.PI / 180;
export const FUEL_CLASSES = Object.freeze([
  { id: 0, key: 'agua', label: 'Agua', rgb: [64, 140, 220], loadKgM2: 0 },
  { id: 1, key: 'pasto', label: 'Pasto seco', rgb: [232, 205, 90], loadKgM2: FUEL_LOAD.pasto },
  { id: 2, key: 'matorral', label: 'Matorral', rgb: [150, 160, 60], loadKgM2: FUEL_LOAD.matorral },
  { id: 3, key: 'arbolado', label: 'Arbolado', rgb: [34, 110, 50], loadKgM2: FUEL_LOAD.arbolado },
  { id: 4, key: 'sinveg', label: 'Sin vegetación / urbano', rgb: [150, 150, 150], loadKgM2: 0 },
]);
export const BURN_DATES = Object.freeze([{ bit: 0, date: '2026-07-24' }, { bit: 1, date: '2026-07-29' }, { bit: 2, date: '2026-08-08' }]);

/** Geográficas → UTM (zona, norte). Inversa de utmToLonLat (fire4d). */
export function lonLatToUtm(lon, lat, zone = 30) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const φ = lat * D, λ0 = ((zone - 1) * 6 - 180 + 3) * D, N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2), T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (lon * D - λ0);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * φ - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ) + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ));
  const x = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const y = k0 * (M + N * Math.tan(φ) * (A * A / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  return [x, y];
}

/** Índice de celda (columna i, fila j) de un punto en una malla UTM {x0, y1, dx, w, h}; null fuera. */
export function cellOf(grid, lon, lat) {
  const [x, y] = lonLatToUtm(lon, lat), i = Math.floor((x - grid.x0) / grid.dx), j = Math.floor((grid.y1 - y) / grid.dx);
  return i >= 0 && j >= 0 && i < grid.w && j < grid.h ? { i, j, k: j * grid.w + i } : null;
}

/** Pendiente (°) y orientación (° desde el norte, hacia donde cae la ladera) por Horn (1981). */
export function slopeAspect(dem, w, h, res) {
  const slope = new Float32Array(w * h).fill(NaN), aspect = new Float32Array(w * h).fill(NaN);
  const z = (i, j) => dem[j * w + i];
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const a = z(i - 1, j - 1), b = z(i, j - 1), c = z(i + 1, j - 1), d = z(i - 1, j), f = z(i + 1, j), g = z(i - 1, j + 1), hh = z(i, j + 1), ii = z(i + 1, j + 1);
    const dzdx = ((c + 2 * f + ii) - (a + 2 * d + g)) / (8 * res), dzdy = ((g + 2 * hh + ii) - (a + 2 * b + c)) / (8 * res); // fila j crece hacia el sur
    slope[j * w + i] = Math.atan(Math.hypot(dzdx, dzdy)) / D;
    aspect[j * w + i] = (Math.atan2(-dzdx, dzdy) / D + 360) % 360; // 0 = cae hacia el norte, 90 = hacia el este
  }
  return { slope, aspect };
}

export function fuelRGBA(fuel) {
  const out = new Uint8ClampedArray(fuel.length * 4);
  for (let k = 0; k < fuel.length; k++) { const c = FUEL_CLASSES[fuel[k]]; if (!c) continue; out.set([...c.rgb, c.id === 4 ? 110 : 185], k * 4); }
  return out;
}
/** Pendiente en verde→amarillo→rojo (0°, 15°, ≥ 35°). */
export function slopeRGBA(slope) {
  const out = new Uint8ClampedArray(slope.length * 4);
  for (let k = 0; k < slope.length; k++) { const s = slope[k]; if (!Number.isFinite(s)) continue; const t = Math.min(1, s / 35); out.set(t < 0.43 ? [Math.round(80 + 400 * t), 200, 60, 170] : [255, Math.round(200 - 280 * (t - 0.43)), 40, 190], k * 4); }
  return out;
}
/** Cicatriz REAL acumulada hasta una fecha (índice de bit): rojo intenso lo nuevo de esa fecha, granate lo anterior. */
export function burnRGBA(burn, upToBit) {
  const out = new Uint8ClampedArray(burn.length * 4);
  for (let k = 0; k < burn.length; k++) {
    const b = burn[k]; if (!b) continue; let first = -1; for (let q = 0; q <= 2; q++) if (b & (1 << q)) { first = q; break; }
    if (first < 0 || first > upToBit) continue; out.set(first === upToBit ? [255, 70, 30, 200] : [120, 20, 30, 170], k * 4);
  }
  return out;
}
/** Probabilidad 0–255 del conjunto → magenta translúcido (solo ≥ 10 %). */
export function probRGBA(prob) {
  const out = new Uint8ClampedArray(prob.length * 4);
  for (let k = 0; k < prob.length; k++) { const p = prob[k] / 255; if (p < 0.1) continue; out.set([200, 60, 255, Math.round(60 + 170 * p)], k * 4); }
  return out;
}

/** ¿Qué se quemó? ha por tipo de combustible (hasta una fecha) y biomasa ORIENTATIVA (t) con FUEL_LOAD. */
export function burnedByFuel(burn, fuel, upToBit = 2, res = 100) {
  const cellHa = (res * res) / 10_000, rows = FUEL_CLASSES.map((c) => ({ ...c, ha: 0, biomassT: 0 }));
  for (let k = 0; k < burn.length; k++) {
    if (!(burn[k] & ((1 << (upToBit + 1)) - 1))) continue; const r = rows[fuel[k]]; if (!r) continue;
    r.ha += cellHa; r.biomassT += (cellHa * 10_000 * r.loadKgM2) / 1000;
  }
  const totalHa = rows.reduce((s, r) => s + r.ha, 0);
  return { rows: rows.map((r) => ({ ...r, pct: totalHa ? (100 * r.ha) / totalHa : 0 })), totalHa, biomassT: rows.reduce((s, r) => s + r.biomassT, 0), basis: 'Cicatriz REAL (Sentinel-2) × combustible (NDVI 16-07); biomasa = carga ORIENTATIVA de fire-watch' };
}

/** Superficie quemada por clase de pendiente (0–10°, 10–20°, 20–30°, ≥ 30°) hasta una fecha. */
export function burnedBySlope(burn, slope, upToBit = 2, res = 100) {
  const bins = [[0, 10], [10, 20], [20, 30], [30, 90]].map(([lo, hi]) => ({ lo, hi, ha: 0 })), cellHa = (res * res) / 10_000;
  for (let k = 0; k < burn.length; k++) { if (!(burn[k] & ((1 << (upToBit + 1)) - 1)) || !Number.isFinite(slope[k])) continue; const b = bins.find((x) => slope[k] >= x.lo && slope[k] < x.hi); if (b) b.ha += cellHa; }
  return bins;
}

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const cardinal = (deg) => CARD[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
