/**
 * Ruta SENDA: rutas sobre la red de calles real (OpenStreetMap) que el usuario puede moldear.
 *  · «Pasar por aquí»: puntos de paso tocados en el mapa (la ruta se recalcula por esas calles).
 *  · «Evitar esto»: zonas dibujadas, agua observada (Copernicus) y avisos con radio.
 *  · Modo: coche, bici o a pie (vías permitidas según la clave `highway` de OpenStreetMap).
 *  · Alternativas, y entrega a Google Maps (con paradas) o a Waze (solo destino).
 *
 * Veracidad: el coste es la DISTANCIA medida sobre la geometría. No se calcula tiempo de viaje porque
 * los datos no traen velocidades ni sentido único; ambos quedan declarados como «no disponible».
 */

const R = 6371008.8; // radio medio terrestre (m), IUGG
const rad = (d) => (d * Math.PI) / 180;
export function haversineM([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Vías por modo, según la semántica de `highway` en OpenStreetMap (wiki «Key:highway»). */
const MOTOR_ONLY = ['motorway', 'motorway_link', 'trunk', 'trunk_link'];
const ROADS = ['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service'];
export const MODES = Object.freeze({
  car: { label: 'Coche', allowed: new Set([...MOTOR_ONLY, ...ROADS]), google: 'driving' },
  bike: { label: 'Bici', allowed: new Set([...ROADS, 'cycleway']), google: 'bicycling' },
  foot: { label: 'A pie', allowed: new Set([...ROADS, 'pedestrian', 'footway', 'path', 'steps']), google: 'walking' },
});
export const LIMITS = Object.freeze({
  travelTime: 'no disponible: los datos no traen velocidades',
  oneway: 'no disponible: los datos no traen sentido único; la ruta puede ir contra dirección en calles de un solo sentido',
});
/** Parámetro del algoritmo de alternativas (no es un dato del mundo): cuánto se encarecen los tramos ya usados. */
export const ALT_PENALTY = 1.6;

/** Grafo no dirigido a partir de {coords:[[lon,lat]], ways:[{n:[idx], hw, name}]}. */
export function buildGraph(net, mode = 'car') {
  const m = MODES[mode];
  if (!m) throw new Error(`modo desconocido: ${mode}`);
  const adj = new Map();
  const add = (a, b, w, way) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, w, way }); };
  net.ways.forEach((way, wi) => {
    if (!m.allowed.has(way.hw)) return;
    for (let i = 1; i < way.n.length; i++) {
      const a = way.n[i - 1], b = way.n[i];
      if (a === b) continue;
      const w = haversineM(net.coords[a], net.coords[b]);
      add(a, b, w, wi); add(b, a, w, wi);
    }
  });
  return { coords: net.coords, ways: net.ways, adj, mode };
}

export function nearestNode(g, p) {
  let best = -1, bd = Infinity;
  for (const id of g.adj.keys()) { const d = haversineM(g.coords[id], p); if (d < bd) { bd = d; best = id; } }
  return { id: best, distM: bd };
}

export function pointInPolygon([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Nodos bloqueados por zonas a evitar: polígonos (dibujados o agua) y puntos con radio (avisos). */
export function blockedNodes(g, { polygons = [], points = [] } = {}) {
  const out = new Set();
  if (!polygons.length && !points.length) return out;
  const boxes = polygons.map((r) => r.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]));
  for (const id of g.adj.keys()) {
    const p = g.coords[id];
    if (polygons.some((r, k) => p[0] >= boxes[k][0] && p[0] <= boxes[k][2] && p[1] >= boxes[k][1] && p[1] <= boxes[k][3] && pointInPolygon(p, r))) { out.add(id); continue; }
    if (points.some((h) => haversineM(p, [h.lon, h.lat]) <= h.rM)) out.add(id);
  }
  return out;
}

/** Montículo binario mínimo para Dijkstra. */
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

function dijkstra(g, s, t, blocked, cost) {
  const dist = new Map([[s, 0]]), prev = new Map(), h = new Heap();
  h.push(0, s);
  while (h.size) {
    const [d, u] = h.pop();
    if (u === t) break;
    if (d > dist.get(u)) continue;
    for (const e of g.adj.get(u) || []) {
      if (blocked.has(e.to)) continue;
      const nd = d + cost(u, e);
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, [u, e]); h.push(nd, e.to); }
    }
  }
  if (!dist.has(t)) return null;
  const nodes = [t], edges = [];
  for (let v = t; v !== s;) { const [u, e] = prev.get(v); edges.push([u, e]); nodes.push(u); v = u; }
  return { nodes: nodes.reverse(), edges: edges.reverse() };
}

const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Ruta de `from` a `to` pasando por `via` (en orden), evitando `avoid`.
 * Devuelve { ok, reason?, coords, lengthM, streets, snapM, legs }.
 */
export function planRoute(g, { from, to, via = [], avoid = {}, penalized = null }) {
  const blocked = blockedNodes(g, avoid);
  const stops = [from, ...via, to].map((p) => nearestNode(g, p));
  if (stops.some((s) => s.id < 0)) return { ok: false, reason: 'SIN_RED' };
  if (stops.some((s) => blocked.has(s.id))) return { ok: false, reason: 'PUNTO_EN_ZONA_EVITADA' };
  const cost = (u, e) => e.w * (penalized?.has(edgeKey(u, e.to)) ? ALT_PENALTY : 1);
  const nodes = [], legs = [];
  let lengthM = 0;
  for (let i = 1; i < stops.length; i++) {
    const r = dijkstra(g, stops[i - 1].id, stops[i].id, blocked, cost);
    if (!r) return { ok: false, reason: 'SIN_CAMINO', leg: i };
    const legM = r.edges.reduce((s, [, e]) => s + e.w, 0);
    legs.push({ lengthM: legM });
    lengthM += legM;
    nodes.push(...(i === 1 ? r.nodes : r.nodes.slice(1)));
  }
  const streets = [];
  for (let i = 1; i < nodes.length; i++) {
    const e = g.adj.get(nodes[i - 1]).find((x) => x.to === nodes[i]);
    const name = g.ways[e.way].name || g.ways[e.way].hw;
    if (streets.at(-1)?.name === name) streets.at(-1).lengthM += e.w; else streets.push({ name, lengthM: e.w });
  }
  return { ok: true, nodes, coords: nodes.map((n) => g.coords[n]), lengthM, legs, streets, snapM: stops.map((s) => s.distM), limits: LIMITS };
}

/** Hasta `k` rutas distintas: cada nueva encarece los tramos ya usados (ALT_PENALTY). */
export function alternatives(g, q, k = 3) {
  const out = [], penalized = new Set();
  for (let i = 0; i < k; i++) {
    const r = planRoute(g, { ...q, penalized });
    if (!r.ok) { if (i === 0) return [r]; break; }
    const sig = r.nodes.join(',');
    if (!out.some((o) => o.nodes.join(',') === sig)) out.push(r);
    for (let j = 1; j < r.nodes.length; j++) penalized.add(edgeKey(r.nodes[j - 1], r.nodes[j]));
  }
  return out;
}

/** Distancia (m) de un punto a un segmento, en proyección local equirectangular (válida a escala de ciudad). */
export function pointSegmentM(p, a, b) {
  const k = Math.cos(rad(p[1])) * rad(1) * R, m = rad(1) * R;
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * m, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * m;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Elementos (cámaras, avisos) a menos de `bufferM` de la ruta, con su distancia al tramo más cercano. */
export function nearRoute(coords, items, bufferM = 300) {
  return items.map((it) => {
    const p = [it.lon, it.lat];
    let d = coords.length === 1 ? haversineM(coords[0], p) : Infinity;
    for (let i = 1; i < coords.length && d > 0; i++) d = Math.min(d, pointSegmentM(p, coords[i - 1], coords[i]));
    return { ...it, distM: d };
  }).filter((it) => it.distM <= bufferM).sort((a, b) => a.distM - b.distM);
}

/** Google Maps (documentado: api=1, waypoints separados por «|», máx. 3 en navegador móvil y 9 en el resto). */
export function googleMapsUrl({ from, to, via = [], mode = 'car' }) {
  const ll = ([lon, lat]) => `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', ll(from));
  u.searchParams.set('destination', ll(to));
  if (via.length) u.searchParams.set('waypoints', via.slice(0, 9).map(ll).join('|'));
  u.searchParams.set('travelmode', MODES[mode].google);
  return { url: u.toString(), droppedVia: Math.max(0, via.length - 9), mobileBrowserMaxVia: 3 };
}

/** Waze (documentado: ll + navigate=yes). Sin paradas intermedias: no aparecen en su documentación. */
export function wazeUrl({ to }) {
  return { url: `https://waze.com/ul?ll=${to[1].toFixed(6)},${to[0].toFixed(6)}&navigate=yes&utm_source=senda`, viaSupported: false };
}
