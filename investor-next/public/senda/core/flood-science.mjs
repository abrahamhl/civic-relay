/**
 * SENDA · hidrología sobre el relieve (DANA 4D): por dónde baja el agua, cuánta cuenca drena a cada punto
 * y a qué altura sobre el cauce está cada celda. Todo es MODELO salvo la mancha observada (Copernicus EMS).
 *
 * Métodos publicados:
 *  - Relleno de depresiones: Priority-Flood+ε, Barnes, Lehman y Mulla (2014), Computers & Geosciences 62:117-127.
 *  - Dirección de flujo D8: O'Callaghan y Mark (1984), Computer Vision, Graphics and Image Processing 28:323-344.
 *  - Acumulación de flujo: suma de celdas aguas arriba siguiendo D8 (mismo trabajo).
 *  - HAND («Height Above Nearest Drainage»): Rennó et al. (2008), Remote Sensing of Environment 112:3469-3481;
 *    Nobre et al. (2011), Journal of Hydrology 404:13-29. Uso para cartografía de inundación: Nobre et al. (2016),
 *    Hydrological Processes 30:3307-3320.
 *  - Acuerdo con la mancha observada: índice de éxito crítico CSI = A / (A + B + C) (Bates y De Roo, 2000,
 *    Journal of Hydrology 236:54-77).
 *
 * Límites (se muestran en la interfaz): el relieve es de teselas abiertas (≈ 30 m), sin diques, puentes ni
 * colectores; HAND es una aproximación estática (no hay caudal ni tiempo): sirve para ordenar qué se inunda
 * antes, no para dar calados reales.
 */

// Vecinos D8: E, SE, S, SO, O, NO, N, NE (fila j crece hacia el sur)
export const DI = Object.freeze([1, 1, 0, -1, -1, -1, 0, 1]);
export const DJ = Object.freeze([0, 1, 1, 1, 0, -1, -1, -1]);
const DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

/** Montículo binario mínimo de índices ordenados por clave (Float64Array). */
class MinHeap {
  constructor(key) { this.k = key; this.a = []; }
  get size() { return this.a.length; }
  push(i) { const a = this.a, k = this.k; a.push(i); let c = a.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (k[a[p]] <= k[a[c]]) break; [a[p], a[c]] = [a[c], a[p]]; c = p; } }
  pop() {
    const a = this.a, k = this.k, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let p = 0; for (;;) { const l = 2 * p + 1, r = l + 1; let m = p; if (l < a.length && k[a[l]] < k[a[m]]) m = l; if (r < a.length && k[a[r]] < k[a[m]]) m = r; if (m === p) break; [a[p], a[m]] = [a[m], a[p]]; p = m; } }
    return top;
  }
}

/**
 * Rellena depresiones con Priority-Flood+ε. Salidas: el borde de la malla y toda celda con z ≤ seaLevel (mar).
 * Las celdas sin dato (NaN) se tratan como salidas. Devuelve una copia (Float64Array) en la que siempre hay bajada.
 */
export function fillDepressions(dem, w, h, { eps = 1e-3, seaLevel = 0 } = {}) {
  const z = Float64Array.from(dem, (v) => (Number.isFinite(v) ? v : -Infinity)), closed = new Uint8Array(w * h), pq = new MinHeap(z);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1 || !(z[k] > seaLevel)) { closed[k] = 1; pq.push(k); }
  }
  while (pq.size) {
    const c = pq.pop(), ci = c % w, cj = (c - ci) / w;
    for (let d = 0; d < 8; d++) {
      const i = ci + DI[d], j = cj + DJ[d]; if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const n = j * w + i; if (closed[n]) continue; closed[n] = 1;
      if (z[n] <= z[c] + eps) z[n] = z[c] + eps; // ε: los llanos rellenos también drenan
      pq.push(n);
    }
  }
  return z;
}

/** Dirección D8 (0–7, 255 = salida) por máxima pendiente sobre el relieve rellenado. */
export function d8(filled, w, h) {
  const dir = new Uint8Array(w * h).fill(255);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, zk = filled[k]; if (!Number.isFinite(zk)) continue;
    let best = 0, bd = 255;
    for (let d = 0; d < 8; d++) {
      const ii = i + DI[d], jj = j + DJ[d]; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const s = (zk - filled[jj * w + ii]) / DIST[d]; if (s > best) { best = s; bd = d; }
    }
    dir[k] = bd;
  }
  return dir;
}

/** Orden de celdas de mayor a menor altura (rellenada): aguas arriba antes que aguas abajo. */
export function orderDesc(filled) {
  const idx = new Uint32Array(filled.length); for (let k = 0; k < idx.length; k++) idx[k] = k;
  return idx.sort((a, b) => filled[b] - filled[a]);
}

/** Acumulación de flujo: número de celdas (incluida ella) que drenan a cada celda. */
export function accumulate(dir, w, h, order) {
  const acc = new Float64Array(w * h).fill(1);
  for (const k of order) { const d = dir[k]; if (d === 255) continue; const i = (k % w) + DI[d], j = ((k / w) | 0) + DJ[d]; acc[j * w + i] += acc[k]; }
  return acc;
}

/**
 * HAND: altura de cada celda sobre la celda de cauce a la que drena (cauce = acumulación ≥ streamCells).
 * Usa el relieve ORIGINAL para las alturas y el rellenado solo para la ruta. Recorre de abajo arriba.
 */
export function hand(dem, filled, dir, acc, w, h, order, streamCells) {
  const drainZ = new Float64Array(w * h).fill(NaN), out = new Float32Array(w * h).fill(NaN);
  for (let q = order.length - 1; q >= 0; q--) {
    const k = order[q], z = dem[k]; if (!Number.isFinite(z)) continue;
    const d = dir[k];
    if (acc[k] >= streamCells || d === 255) drainZ[k] = z;
    else { const n = (((k / w) | 0) + DJ[d]) * w + (k % w) + DI[d]; drainZ[k] = Number.isFinite(drainZ[n]) ? drainZ[n] : z; }
    out[k] = Math.max(0, z - drainZ[k]);
  }
  return out;
}

/** Todo el análisis de una vez. cellM = metros por celda (para pasar a km²). */
export function analyze(dem, w, h, { cellM, streamKm2 = 5, eps, seaLevel } = {}) {
  const filled = fillDepressions(dem, w, h, { eps, seaLevel }), dir = d8(filled, w, h), order = orderDesc(filled), acc = accumulate(dir, w, h, order);
  const streamCells = Math.max(2, Math.round((streamKm2 * 1e6) / (cellM * cellM)));
  return { filled, dir, order, acc, streamCells, hand: hand(dem, filled, dir, acc, w, h, order, streamCells) };
}

/** Celdas con HAND ≤ nivel (el agua «sube» desde el cauce). Excluye el mar si se da seaLevel. */
export function floodMask(handGrid, level, dem = null, seaLevel = 0) {
  const m = new Uint8Array(handGrid.length);
  for (let k = 0; k < m.length; k++) if (handGrid[k] <= level && !(dem && !(dem[k] > seaLevel))) m[k] = 1;
  return m;
}

/** Tabla de contingencia modelo/observado y CSI, tasa de acierto y de falsa alarma (solo dentro de `roi`). */
export function agreement(model, obs, roi = null) {
  let a = 0, b = 0, c = 0, n = 0;
  for (let k = 0; k < model.length; k++) {
    if (roi && !roi[k]) continue; n++;
    if (model[k] && obs[k]) a++; else if (model[k]) b++; else if (obs[k]) c++;
  }
  return { hits: a, falseAlarms: b, misses: c, cells: n, csi: a + b + c ? a / (a + b + c) : NaN, hitRate: a + c ? a / (a + c) : NaN, falseAlarmRatio: a + b ? b / (a + b) : NaN };
}

/** Barre niveles de HAND y devuelve el de mayor CSI frente a lo observado (CALIBRADO, no predicho). */
export function calibrateLevel(handGrid, obs, { levels, roi = null, dem = null, seaLevel = 0 } = {}) {
  const rows = levels.map((L) => ({ level: L, ...agreement(floodMask(handGrid, L, dem, seaLevel), obs, roi) }));
  return { rows, best: rows.reduce((p, r) => (r.csi > p.csi ? r : p), rows[0]) };
}

/**
 * Rasteriza polígonos GeoJSON (Polygon/MultiPolygon, lon/lat) sobre una malla: toPx([lon,lat]) → [px, py].
 * Relleno por barrido de filas con la regla par-impar (los huecos quedan fuera).
 */
export function rasterize(features, w, h, toPx) {
  const m = new Uint8Array(w * h);
  for (const f of features) {
    const g = f.geometry || f; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      const rings = poly.map((r) => r.map(toPx)); let ymin = Infinity, ymax = -Infinity;
      for (const r of rings) for (const [, y] of r) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      for (let j = Math.max(0, Math.floor(ymin)); j <= Math.min(h - 1, Math.ceil(ymax)); j++) {
        const y = j + 0.5, xs = [];
        for (const r of rings) for (let q = 0; q < r.length - 1; q++) {
          const [x1, y1] = r[q], [x2, y2] = r[q + 1];
          if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
        xs.sort((p, q) => p - q);
        for (let q = 0; q + 1 < xs.length; q += 2) {
          const i0 = Math.max(0, Math.ceil(xs[q] - 0.5)), i1 = Math.min(w - 1, Math.floor(xs[q + 1] - 0.5));
          for (let i = i0; i <= i1; i++) m[j * w + i] = 1;
        }
      }
    }
  }
  return m;
}

/** Cauces como segmentos [lon,lat]→[lon,lat] con su cuenca (km²), para dibujar líneas proporcionales. */
export function streamSegments(dir, acc, w, h, streamCells, toLonLat, cellKm2) {
  const out = [];
  for (let k = 0; k < acc.length; k++) {
    if (acc[k] < streamCells || dir[k] === 255) continue;
    const i = k % w, j = (k / w) | 0, d = dir[k];
    out.push({ a: toLonLat(i + 0.5, j + 0.5), b: toLonLat(i + DI[d] + 0.5, j + DJ[d] + 0.5), km2: acc[k] * cellKm2 });
  }
  return out;
}

/** Agua (azul) por HAND ≤ nivel: más oscuro cuanto más bajo respecto al nivel (orden de llenado, no calado). */
export function handRGBA(handGrid, level, dem = null, seaLevel = 0) {
  const out = new Uint8ClampedArray(handGrid.length * 4);
  for (let k = 0; k < handGrid.length; k++) {
    const v = handGrid[k]; if (!(v <= level) || (dem && !(dem[k] > seaLevel))) continue;
    const t = level > 0 ? 1 - v / level : 1; out.set([Math.round(90 - 60 * t), Math.round(170 - 70 * t), 255, Math.round(110 + 110 * t)], k * 4);
  }
  return out;
}
/** Mancha observada (Copernicus) en verde; modelo en azul; ambos en blanco: para ver aciertos y errores. */
export function compareRGBA(model, obs) {
  const out = new Uint8ClampedArray(model.length * 4);
  for (let k = 0; k < model.length; k++) {
    if (model[k] && obs[k]) out.set([255, 255, 255, 210], k * 4); else if (model[k]) out.set([10, 132, 255, 170], k * 4); else if (obs[k]) out.set([52, 199, 89, 190], k * 4);
  }
  return out;
}
