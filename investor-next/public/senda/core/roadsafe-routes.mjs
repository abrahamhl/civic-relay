/**
 * SENDA RoadSafe · Rutas favoritas, paquetes de ruta sin conexión y comparación de rutas por riesgo.
 *
 * Lo que el usuario pidió y Waze no ofrece a día de hoy según el propio usuario: guardar SUS rutas habituales,
 * elegir entre alternativas con criterio de seguridad, y tener la RUTA (no el mapa entero) disponible sin datos.
 *  - Ruta guardada: polilínea + nombre + preferencia; se puede marcar como favorita.
 *  - Paquete offline de ruta: geometría simplificada, hitos/PK, peligros del corredor (DATEX II con
 *    corridorPack y separación de calzada), teléfonos de emergencia, puntos de asistencia y la ventana de
 *    validez; se mide su tamaño en bytes (objetivo: decenas de KB, no cientos de MB de mapa).
 *  - Comparación por riesgo: suma de puntos negros (Bayes empírico del dataset armonizado) a lo largo de cada
 *    alternativa, normalizada por km; se informa junto a distancia y tiempo, sin imponer la elección.
 * Las rutas se calculan con el motor de rutas que elija el usuario (OSRM propio, navegador, etc.): este módulo
 * no inventa geometrías; trabaja con las polilíneas que recibe.
 */
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
/** Distancia de un punto a una polilínea (segmentos, aproximación local plana). */
export function distToPolylineM(p, line) {
  const lat0 = p.lat * Math.PI / 180, X = (q) => ({ x: q.lon * 111320 * Math.cos(lat0), y: q.lat * 110540 }), P = X(p);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) { const A = X(line[i - 1]), B = X(line[i]), dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / l2)); best = Math.min(best, Math.hypot(P.x - A.x - u * dx, P.y - A.y - u * dy)); }
  return line.length === 1 ? distM(p, line[0]) : best;
}
export const lengthM = (pts) => pts.slice(1).reduce((s, p, i) => s + distM(pts[i], p), 0);

/** Simplificación Douglas–Peucker (tolerancia en metros, aproximación local plana). */
export function simplify(pts, tolM = 15) {
  if (pts.length < 3) return pts.slice();
  const lat0 = pts[0].lat * Math.PI / 180, X = (p) => ({ x: p.lon * 111320 * Math.cos(lat0), y: p.lat * 110540 });
  const P = pts.map(X), keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1; const A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * P[i].x - dx * P[i].y + B.x * A.y - B.y * A.x) / L; if (d > md) { md = d; mi = i; } }
    if (md > tolM) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function createRouteStore() {
  const routes = new Map();
  return {
    save({ id, name, points, favorite = false, prefs = {} }, { now }) {
      if (!id || !Array.isArray(points) || points.length < 2) return { ok: false, error: 'ruta inválida' };
      if (points.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) return { ok: false, error: 'coordenadas inválidas' };
      routes.set(id, { id, name: name ?? id, points, favorite, prefs, savedAt: now, lengthKm: +(lengthM(points) / 1000).toFixed(1) }); return { ok: true };
    },
    favorite(id, on = true) { const r = routes.get(id); if (!r) return { ok: false }; r.favorite = on; return { ok: true }; },
    list() { return [...routes.values()].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.savedAt - a.savedAt).map(({ points, ...r }) => r); },
    get: (id) => routes.get(id) ?? null,
    remove: (id) => routes.delete(id),
    exportJson() { return JSON.stringify({ schema: 'senda-saved-routes/1', routes: [...routes.values()] }); },
    importJson(text) { const d = JSON.parse(text); if (d.schema !== 'senda-saved-routes/1') throw new Error('formato no reconocido'); for (const r of d.routes) routes.set(r.id, r); return d.routes.length; },
  };
}

/**
 * Paquete de ruta sin conexión. hazards: salida de corridorPack (datex2.mjs) — se respeta la separación de
 * calzada; services: [{name, kind, lat, lon, phone?}] (talleres, áreas de servicio, hospitales).
 */
export function offlineRoutePack(route, { hazards = null, services = [], milestones = [], now, validS = 6 * 3600, tolM = 15 } = {}) {
  const geom = simplify(route.points, tolM);
  const nearRoute = (p, maxM) => distToPolylineM(p, geom) <= maxM;
  const pack = {
    schema: 'senda-offline-route/1', routeId: route.id, name: route.name, createdAt: now, validUntil: now + validS,
    geometry: geom.map((p) => [+p.lat.toFixed(5), +p.lon.toFixed(5)]), lengthKm: +(lengthM(route.points) / 1000).toFixed(1),
    milestones: milestones.filter((m) => nearRoute(m, 300)).map((m) => ({ km: m.km, lat: +m.lat.toFixed(5), lon: +m.lon.toFixed(5) })),
    hazards: hazards ? hazards.hazards.map((h) => ({ id: h.id, label: h.label, lat: h.lat, lon: h.lon, alongKm: h.alongKm, carriageway: h.carriageway, confirmed: h.confirmed ?? null })) : [],
    otherCarriagewayInfo: hazards?.otherCarriageway?.length ?? 0,
    services: services.filter((s) => nearRoute(s, 3000)).map((s) => ({ name: s.name, kind: s.kind, lat: +s.lat.toFixed(5), lon: +s.lon.toFixed(5), phone: s.phone ?? null })),
    emergency: { call: 'tel:112', note: 'El 112 funciona con la red de cualquier operador.' },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(pack)).length;
  return { pack, bytes, points: { original: route.points.length, simplified: geom.length }, stale: (t) => t > pack.validUntil };
}

/**
 * Comparación de alternativas por riesgo histórico: celdas de puntos negros (lat/lon + esperado EB) a menos
 * de `bufferM` de la ruta. hotspots: [{ centroid:{lat,lon}, ebExpected, fatal }]
 */
export function compareRoutesByRisk(alternatives, hotspots, { bufferM = 250 } = {}) {
  const rows = alternatives.map((alt) => {
    const geom = simplify(alt.points, 20), km = lengthM(alt.points) / 1000;
    const near = hotspots.filter((h) => h.centroid && distToPolylineM(h.centroid, geom) <= bufferM);
    const exposure = near.reduce((s, h) => s + h.ebExpected, 0);
    return { id: alt.id, name: alt.name, km: +km.toFixed(1), durationMin: alt.durationMin ?? null, hotspots: near.length, fatalHistoric: near.reduce((s, h) => s + (h.fatal ?? 0), 0), riskPerKm: +(exposure / Math.max(0.1, km)).toFixed(2) };
  });
  const best = [...rows].sort((a, b) => a.riskPerKm - b.riskPerKm)[0];
  return { rows, lowestRiskPerKm: best?.id ?? null, note: 'Riesgo histórico de accidentes con víctimas (puntos negros EB); no incluye exposición ni tráfico actual. La elección es del conductor.' };
}
