/**
 * SENDA · Validación de incendios contra perímetros oficiales (p. ej. EFFIS de Copernicus).
 *
 * Funciones puras: rasterizar polígonos GeoJSON (lon/lat) a la malla UTM del modelo, comparar máscaras
 * (Jaccard, acierto, falsa alarma) y construir la referencia ingenua «círculo de la misma área centrado en la
 * ignición», que es el listón mínimo que un modelo de propagación debe superar para aportar algo.
 * Nada aquí inventa datos: todo se calcula sobre lo que se le pasa.
 */
import { fromUtm } from './utm.mjs';

/** Punto [lon, lat] dentro de un anillo [[lon, lat], …] (trazado de rayo). */
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Punto dentro de un Polygon/MultiPolygon GeoJSON (respeta los huecos). */
export function inGeometry(lon, lat, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return polys.some((rings) => inRing(lon, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lon, lat, h)));
}

function bboxOf(geom) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const walk = (c) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates); return { x0, y0, x1, y1 };
}

/**
 * Rasteriza polígonos sobre la malla (centro de cada celda). grid = { w, h, dx, x0, y1, zone } con y1 = norte del borde superior.
 * Devuelve Uint8Array w×h (fila j desde el norte).
 */
export function rasterizePolygons(features, grid) {
  const { w, h, dx, x0, y1, zone } = grid, out = new Uint8Array(w * h);
  const geoms = features.map((f) => ({ g: f.geometry, b: bboxOf(f.geometry) }));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const { lat, lon } = fromUtm(x0 + (i + 0.5) * dx, y1 - (j + 0.5) * dx, zone);
    for (const { g, b } of geoms) if (lon >= b.x0 && lon <= b.x1 && lat >= b.y0 && lat <= b.y1 && inGeometry(lon, lat, g)) { out[j * w + i] = 1; break; }
  }
  return out;
}

/** Compara una predicción con lo observado: verdaderos/falsos positivos, Jaccard, acierto y falsa alarma. */
export function compareMasks(pred, obs, { cellHa = 1 } = {}) {
  if (pred.length !== obs.length) throw new Error('máscaras de distinto tamaño');
  let tp = 0, fp = 0, fn = 0;
  for (let k = 0; k < pred.length; k++) { const p = !!pred[k], o = !!obs[k]; if (p && o) tp++; else if (p) fp++; else if (o) fn++; }
  const union = tp + fp + fn;
  return { tp, fp, fn, jaccard: union ? tp / union : 1, acierto: tp + fn ? tp / (tp + fn) : null, falsaAlarma: tp + fp ? fp / (tp + fp) : null,
    haPredichas: (tp + fp) * cellHa, haObservadas: (tp + fn) * cellHa };
}

/** Círculo de n celdas (aprox.) centrado en (ci, cj): la referencia ingenua de la misma área. */
export function circleMask(w, h, ci, cj, nCells) {
  const r = Math.sqrt(nCells / Math.PI), out = new Uint8Array(w * h);
  for (let j = Math.max(0, Math.floor(cj - r - 1)); j <= Math.min(h - 1, Math.ceil(cj + r + 1)); j++)
    for (let i = Math.max(0, Math.floor(ci - r - 1)); i <= Math.min(w - 1, Math.ceil(ci + r + 1)); i++)
      if ((i - ci) ** 2 + (j - cj) ** 2 <= r * r) out[j * w + i] = 1;
  return out;
}

/** Habilidad frente a la referencia: (J_modelo − J_ref) / (1 − J_ref). > 0 mejora al círculo; ≤ 0 no aporta. */
export const skillVsReference = (jModel, jRef) => (jRef >= 1 ? 0 : (jModel - jRef) / (1 - jRef));
