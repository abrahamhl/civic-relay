/**
 * SENDA · Aislamiento por inundación (núcleo puro, sin E/S).
 *
 * Cruza una red viaria (p. ej. OpenStreetMap) con polígonos de agua OBSERVADA (p. ej. Copernicus EMS
 * «observedEventA») y calcula:
 *  1. qué tramos de calle tocan agua observada (y qué fracción de su longitud queda dentro);
 *  2. qué nodos secos quedan AISLADOS: tenían camino a algún servicio antes y no lo tienen por calles secas después;
 *  3. distancia por la red al servicio más cercano antes y después (Dijkstra multi-origen);
 *  4. métricas agregadas (% de nodos aislados, km de calle bajo agua, y un proxy declarado opcional).
 *
 * HIPÓTESIS (se devuelven también en `result.assumptions`, no se esconden):
 *  H1. El agua es la extensión OBSERVADA en una imagen concreta, no el máximo de la inundación ni su profundidad.
 *      No hay calado: «tocar agua» no implica que el tramo fuese intransitable; es la regla de escenario declarada
 *      con `wetThreshold` (obligatorio, sin valor por defecto).
 *  H2. Todas las calles se recorren en los dos sentidos (evacuación a pie / vehículos de emergencia); se ignora `oneway`.
 *  H3. Los puentes se tratan como cualquier tramo (no hay cota del tablero): se cuentan aparte para que se puedan juzgar.
 *  H4. Un servicio se engancha al nodo de la red más cercano; se devuelve la distancia de enganche.
 *  H5. Si `excludeServicesInWater` es true, un servicio cuyo punto cae dentro del agua observada no cuenta después.
 *  H6. Efecto borde: solo existen las calles y servicios entregados; lo que hay fuera del recorte no se ve.
 *  H7. El tiempo solo se calcula si quien llama aporta `speedMps` como escenario declarado; si no, es null.
 * Geometría: test segmento-polígono en grados lon/lat (válido a escala urbana); longitudes con haversine.
 * Regla de relleno par-impar: tolera anillos interiores y pequeñas autointersecciones de geometrías simplificadas.
 */

const R_EARTH = 6371008.8;

/** Distancia haversine en metros entre [lon,lat] y [lon,lat]. */
export function haversineM(a, b) {
  const toR = Math.PI / 180, dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Extrae anillos de una geometría GeoJSON Polygon/MultiPolygon (o lista de ellas).
 * @param {object|object[]} geoms
 * @returns {number[][][]} anillos [[lon,lat],...]
 */
export function ringsOf(geoms) {
  const out = [];
  for (const g of [].concat(geoms)) {
    if (!g) continue;
    if (g.type === 'Polygon') out.push(...g.coordinates);
    else if (g.type === 'MultiPolygon') for (const p of g.coordinates) out.push(...p);
    else if (g.type === 'Feature') out.push(...ringsOf(g.geometry));
    else if (g.type === 'FeatureCollection') out.push(...ringsOf(g.features));
  }
  return out;
}

/**
 * Índice en rejilla de las aristas de los anillos, para test de punto y de segmento rápidos.
 * @param {number[][][]} rings
 * @param {{cellDeg?: number, bbox?: number[]}} [opt] cellDeg: tamaño de celda (rendimiento, no afecta al resultado);
 *        bbox [w,s,e,n]: si se da, se descartan anillos que no lo tocan (rendimiento).
 */
export function buildWaterIndex(rings, { cellDeg = 0.002, bbox = null } = {}) {
  const ex = [], ey = [], fx = [], fy = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, kept = 0;
  for (const r of rings) {
    let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    for (const [x, y] of r) { if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y; }
    if (bbox && (rx1 < bbox[0] || rx0 > bbox[2] || ry1 < bbox[1] || ry0 > bbox[3])) continue;
    kept++;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      ex.push(a[0]); ey.push(a[1]); fx.push(b[0]); fy.push(b[1]);
    }
    minX = Math.min(minX, rx0); minY = Math.min(minY, ry0); maxX = Math.max(maxX, rx1); maxY = Math.max(maxY, ry1);
  }
  const nx = Number.isFinite(minX) ? Math.max(1, Math.ceil((maxX - minX) / cellDeg)) : 1;
  const ny = Number.isFinite(minY) ? Math.max(1, Math.ceil((maxY - minY) / cellDeg)) : 1;
  const cells = new Map();
  const cx = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cellDeg)));
  const cy = (y) => Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cellDeg)));
  for (let e = 0; e < ex.length; e++) {
    const i0 = cx(Math.min(ex[e], fx[e])), i1 = cx(Math.max(ex[e], fx[e])), j0 = cy(Math.min(ey[e], fy[e])), j1 = cy(Math.max(ey[e], fy[e]));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(e); }
  }
  return { ex, ey, fx, fy, cells, nx, ny, minX, minY, maxX, maxY, cellDeg, rings: kept, edges: ex.length, cx, cy, stamp: new Uint32Array(ex.length), tick: 0 };
}

/** ¿Está el punto [lon,lat] dentro del agua? (par-impar, rayo hacia el este). */
export function pointInWater(idx, p) {
  const [x, y] = p;
  if (!idx.edges || x < idx.minX || x > idx.maxX || y < idx.minY || y > idx.maxY) return false;
  const j = idx.cy(y), t = ++idx.tick; let inside = false;
  for (let i = idx.cx(x); i < idx.nx; i++) {
    const c = idx.cells.get(j * idx.nx + i); if (!c) continue;
    for (const e of c) {
      if (idx.stamp[e] === t) continue; idx.stamp[e] = t;
      const ay = idx.ey[e], by = idx.fy[e];
      if ((ay > y) !== (by > y)) {
        const xi = idx.ex[e] + ((y - ay) / (by - ay)) * (idx.fx[e] - idx.ex[e]);
        if (xi > x) inside = !inside;
      }
    }
  }
  return inside;
}

/** Parámetros t∈(0,1) donde el segmento a→b cruza aristas del agua. */
function crossings(idx, a, b) {
  const ts = [];
  if (!idx.edges) return ts;
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  if (x1 < idx.minX || x0 > idx.maxX || y1 < idx.minY || y0 > idx.maxY) return ts;
  const t = ++idx.tick, dx = b[0] - a[0], dy = b[1] - a[1];
  for (let j = idx.cy(y0); j <= idx.cy(y1); j++) for (let i = idx.cx(x0); i <= idx.cx(x1); i++) {
    const c = idx.cells.get(j * idx.nx + i); if (!c) continue;
    for (const e of c) {
      if (idx.stamp[e] === t) continue; idx.stamp[e] = t;
      const ux = idx.fx[e] - idx.ex[e], uy = idx.fy[e] - idx.ey[e], den = dx * uy - dy * ux;
      if (den === 0) continue;
      const wx = idx.ex[e] - a[0], wy = idx.ey[e] - a[1];
      const s = (wx * uy - wy * ux) / den, u = (wx * dy - wy * dx) / den;
      if (s > 0 && s < 1 && u >= 0 && u <= 1) ts.push(s);
    }
  }
  return ts.sort((p, q) => p - q);
}

/**
 * Fracción de la longitud del segmento a→b que queda dentro del agua (0..1).
 * Se parte el segmento por los cruces con los bordes y se prueba el punto medio de cada trozo.
 */
export function segmentWetFraction(idx, a, b) {
  const ts = [0, ...crossings(idx, a, b), 1];
  let wet = 0;
  for (let k = 0; k + 1 < ts.length; k++) {
    const t0 = ts[k], t1 = ts[k + 1]; if (t1 - t0 <= 0) continue;
    const tm = (t0 + t1) / 2, m = [a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm];
    if (pointInWater(idx, m)) wet += t1 - t0;
  }
  return Math.min(1, wet);
}

/**
 * Construye el grafo no dirigido desde vías (H2: ambos sentidos).
 * @param {{coords: number[][], ways: {nodes: number[], highway?: string, bridge?: boolean, id?: any}[]}} net
 *        coords[i] = [lon,lat]; ways[].nodes = índices en coords.
 */
export function buildGraph({ coords, ways }) {
  const segA = [], segB = [], segLen = [], segWay = [];
  ways.forEach((w, wi) => {
    for (let k = 0; k + 1 < w.nodes.length; k++) {
      const a = w.nodes[k], b = w.nodes[k + 1]; if (a === b) continue;
      segA.push(a); segB.push(b); segLen.push(haversineM(coords[a], coords[b])); segWay.push(wi);
    }
  });
  const n = coords.length, deg = new Uint32Array(n + 1);
  for (let s = 0; s < segA.length; s++) { deg[segA[s] + 1]++; deg[segB[s] + 1]++; }
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const off = deg, fill = off.slice(0, n), adjN = new Uint32Array(off[n]), adjS = new Uint32Array(off[n]);
  for (let s = 0; s < segA.length; s++) { adjN[fill[segA[s]]] = segB[s]; adjS[fill[segA[s]]++] = s; adjN[fill[segB[s]]] = segA[s]; adjS[fill[segB[s]]++] = s; }
  const used = new Uint8Array(n); for (let s = 0; s < segA.length; s++) { used[segA[s]] = 1; used[segB[s]] = 1; }
  return { n, coords, ways, segA, segB, segLen, segWay, off, adjN, adjS, used };
}

/** Montículo binario mínimo (clave numérica, valor entero). */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], key = k.pop(), val = v.pop(), n = k.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = key; v[i] = val; } return top; }
}

/**
 * Dijkstra multi-origen: distancia (m) de cada nodo al origen más cercano, y qué origen es.
 * @param {object} g grafo de buildGraph
 * @param {number[]} sources índices de nodo
 * @param {Uint8Array|null} blocked blocked[s]=1 → el segmento s no se puede usar
 * @returns {{dist: Float64Array, src: Int32Array}}
 */
export function multiSourceDijkstra(g, sources, blocked = null) {
  const dist = new Float64Array(g.n).fill(Infinity), src = new Int32Array(g.n).fill(-1), h = new Heap();
  sources.forEach((s, i) => { if (s >= 0 && dist[s] > 0) { dist[s] = 0; src[s] = i; h.push(0, s); } });
  while (h.size) {
    const u = h.pop(), du = dist[u];
    for (let e = g.off[u]; e < g.off[u + 1]; e++) {
      const s = g.adjS[e]; if (blocked && blocked[s]) continue;
      const v = g.adjN[e], dv = du + g.segLen[s];
      if (dv < dist[v]) { dist[v] = dv; src[v] = src[u]; h.push(dv, v); }
    }
  }
  return { dist, src };
}

/**
 * Componentes conexas (BFS) ignorando segmentos bloqueados. comp[i] = -1 para nodos sin segmentos.
 * @returns {{comp: Int32Array, count: number, sizes: number[]}}
 */
export function connectedComponents(g, blocked = null) {
  const comp = new Int32Array(g.n).fill(-1), sizes = []; let count = 0; const q = new Int32Array(g.n);
  for (let r = 0; r < g.n; r++) {
    if (comp[r] !== -1 || !g.used[r]) continue;
    let head = 0, tail = 0; q[tail++] = r; comp[r] = count; let sz = 0;
    while (head < tail) { const u = q[head++]; sz++; for (let e = g.off[u]; e < g.off[u + 1]; e++) { if (blocked && blocked[g.adjS[e]]) continue; const v = g.adjN[e]; if (comp[v] === -1) { comp[v] = count; q[tail++] = v; } } }
    sizes.push(sz); count++;
  }
  return { comp, count, sizes };
}

/** Rejilla de nodos usados para búsqueda del más cercano. */
export function nodeLocator(g, cellDeg = 0.002) {
  const cells = new Map();
  for (let i = 0; i < g.n; i++) { if (!g.used[i]) continue; const k = `${Math.floor(g.coords[i][0] / cellDeg)},${Math.floor(g.coords[i][1] / cellDeg)}`; let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(i); }
  return function nearest(p, filter = null) {
    const ci = Math.floor(p[0] / cellDeg), cj = Math.floor(p[1] / cellDeg);
    let best = -1, bd = Infinity;
    for (let r = 0; r < 60; r++) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        const c = cells.get(`${i},${j}`); if (!c) continue;
        for (const n of c) { if (filter && !filter(n)) continue; const d = haversineM(p, g.coords[n]); if (d < bd) { bd = d; best = n; } }
      }
      if (best >= 0 && r >= 1) break; // con un anillo extra de margen
    }
    return best < 0 ? null : { node: best, distM: bd };
  };
}

function required(opts, name, check, why) {
  if (!(name in opts) || opts[name] === undefined || opts[name] === null || !check(opts[name])) {
    throw new Error(`flood-isolation: falta el parámetro «${name}» (${why}). No lleva valor por defecto: aporta un escenario declarado.`);
  }
  return opts[name];
}

/**
 * Análisis completo de aislamiento.
 * @param {object} p
 * @param {{coords:number[][], ways:object[]}} p.network red viaria
 * @param {number[][][]} p.waterRings anillos de agua observada
 * @param {{lon:number, lat:number, kind?:string, name?:string, id?:any}[]} p.services puntos de servicio
 * @param {object} p.options
 * @param {number} p.options.wetThreshold OBLIGATORIO. Un tramo queda cortado si su fracción mojada > este valor
 *        (0 = basta con tocar agua observada). Regla de escenario, no medida.
 * @param {boolean} p.options.excludeServicesInWater OBLIGATORIO (H5).
 * @param {number|null} [p.options.speedMps] velocidad de escenario para pasar distancias a tiempos (H7); sin ella, tiempos null.
 * @param {number[][]} [p.proxyPoints] puntos [lon,lat] de un proxy declarado (p. ej. edificios OSM) que se asignan al nodo más cercano.
 * @param {number[]} [p.bbox] [w,s,e,n] para filtrar anillos (rendimiento).
 */
export function analyzeIsolation({ network, waterRings, services, options = {}, proxyPoints = null, bbox = null }) {
  const wetThreshold = required(options, 'wetThreshold', (v) => typeof v === 'number' && v >= 0 && v < 1, 'fracción de tramo mojado a partir de la cual se considera cortado');
  const excludeServicesInWater = required(options, 'excludeServicesInWater', (v) => typeof v === 'boolean', '¿cuenta un servicio que está dentro del agua?');
  const speedMps = options.speedMps ?? null;
  if (speedMps !== null && !(speedMps > 0)) throw new Error('flood-isolation: speedMps debe ser > 0 o null');

  const g = buildGraph(network), idx = buildWaterIndex(waterRings, { bbox });
  const S = g.segA.length, wetFrac = new Float32Array(S), blocked = new Uint8Array(S);
  let totalM = 0, wetM = 0, wetSegs = 0, bridgeWet = 0;
  for (let s = 0; s < S; s++) {
    const f = segmentWetFraction(idx, g.coords[g.segA[s]], g.coords[g.segB[s]]);
    wetFrac[s] = f; totalM += g.segLen[s]; wetM += f * g.segLen[s];
    if (f > wetThreshold) { blocked[s] = 1; wetSegs++; if (g.ways[g.segWay[s]].bridge) bridgeWet++; }
  }
  const nodeWet = new Uint8Array(g.n);
  for (let i = 0; i < g.n; i++) if (g.used[i] && pointInWater(idx, g.coords[i])) nodeWet[i] = 1;

  const near = nodeLocator(g);
  const svc = services.map((s, i) => {
    const p = [s.lon, s.lat], hit = near(p), inWater = pointInWater(idx, p);
    return { i, id: s.id ?? i, kind: s.kind ?? null, name: s.name ?? null, lon: s.lon, lat: s.lat, node: hit?.node ?? -1, snapM: hit ? Math.round(hit.distM) : null, inWater };
  });
  const before = multiSourceDijkstra(g, svc.map((s) => s.node), null);
  const afterSources = svc.map((s) => (excludeServicesInWater && s.inWater) || nodeWet[s.node] ? -1 : s.node);
  const after = multiSourceDijkstra(g, afterSources, blocked);

  // Estado por nodo: 0 sin uso · 1 conectado · 2 aislado · 3 en agua · 4 sin servicio ya antes
  const state = new Uint8Array(g.n); const c = { used: 0, wet: 0, isolated: 0, connected: 0, unreachableBefore: 0, dryReachableBefore: 0 };
  let sumBefore = 0, sumAfter = 0, nBoth = 0, maxIncrease = 0;
  for (let i = 0; i < g.n; i++) {
    if (!g.used[i]) continue; c.used++;
    if (!Number.isFinite(before.dist[i])) { state[i] = 4; c.unreachableBefore++; continue; }
    if (nodeWet[i]) { state[i] = 3; c.wet++; continue; }
    c.dryReachableBefore++;
    if (!Number.isFinite(after.dist[i])) { state[i] = 2; c.isolated++; continue; }
    state[i] = 1; c.connected++; sumBefore += before.dist[i]; sumAfter += after.dist[i]; nBoth++;
    maxIncrease = Math.max(maxIncrease, after.dist[i] - before.dist[i]);
  }
  const comps = connectedComponents(g, blocked);
  // Bolsas aisladas: componentes secas sin servicio
  const isoComp = new Map();
  for (let i = 0; i < g.n; i++) if (state[i] === 2) { const k = comps.comp[i]; isoComp.set(k, (isoComp.get(k) ?? 0) + 1); }
  let proxy = null;
  if (proxyPoints) {
    const p = { total: proxyPoints.length, isolated: 0, wet: 0, connected: 0, unreachableBefore: 0 };
    for (const q of proxyPoints) {
      const h = near(q); if (!h) continue; const st = state[h.node];
      if (st === 2) p.isolated++; else if (st === 3) p.wet++; else if (st === 1) p.connected++; else if (st === 4) p.unreachableBefore++;
    }
    proxy = p;
  }
  const round1 = (x) => Math.round(x * 10) / 10, pct = (a, b) => (b ? round1((100 * a) / b) : null);
  const metrics = {
    nodes: c.used, segments: S, streetKm: round1(totalM / 1000), wetStreetKm: round1(wetM / 1000), cutSegments: wetSegs, cutBridgeSegments: bridgeWet,
    nodesInWater: c.wet, nodesIsolated: c.isolated, nodesConnected: c.connected, nodesWithoutServiceBefore: c.unreachableBefore,
    pctIsolatedOfDryReachable: pct(c.isolated, c.dryReachableBefore), pctInWaterOfReachable: pct(c.wet, c.used - c.unreachableBefore),
    isolatedPockets: isoComp.size, largestPocketNodes: isoComp.size ? Math.max(...isoComp.values()) : 0,
    meanDistBeforeM: nBoth ? Math.round(sumBefore / nBoth) : null, meanDistAfterM: nBoth ? Math.round(sumAfter / nBoth) : null, maxIncreaseM: Math.round(maxIncrease),
    meanTimeBeforeMin: speedMps && nBoth ? round1(sumBefore / nBoth / speedMps / 60) : null, meanTimeAfterMin: speedMps && nBoth ? round1(sumAfter / nBoth / speedMps / 60) : null,
    services: svc.length, servicesInWater: svc.filter((s) => s.inWater).length, servicesUsedAfter: afterSources.filter((s) => s >= 0).length,
    proxy,
  };
  return {
    basis: 'CALCULATED_FROM_OBSERVED_DATA', graph: g, wetFrac, blocked, nodeWet, state, before, after, services: svc, components: comps, metrics,
    options: { wetThreshold, excludeServicesInWater, speedMps },
    assumptions: [
      'H1 agua = extensión observada en una imagen, no máximo ni calado; tramo cortado si fracción mojada > wetThreshold (escenario declarado)',
      'H2 calles en ambos sentidos (se ignora oneway)', 'H3 puentes tratados como cualquier tramo (sin cota del tablero)',
      'H4 servicio enganchado al nodo más cercano (se informa la distancia)', `H5 servicios dentro del agua ${excludeServicesInWater ? 'excluidos' : 'mantenidos'} después`,
      'H6 efecto borde: solo calles y servicios del recorte', speedMps ? `H7 tiempos con velocidad de escenario ${speedMps} m/s (no medida)` : 'H7 sin velocidad declarada: no se calculan tiempos',
    ],
  };
}

/** Estados de nodo, para leer `result.state`. */
export const NODE_STATE = Object.freeze({ UNUSED: 0, CONNECTED: 1, ISOLATED: 2, IN_WATER: 3, NO_SERVICE_BEFORE: 4 });
