/**
 * SENDA · Atlas: capa de eventos geolocalizados con línea de tiempo y filtro perimetral.
 *
 * Funciones habituales de los mapas de inteligencia abierta (World Monitor, GlobalThreatMap, Pharos…):
 * eventos con fecha y fuente sobre un mapa, línea de tiempo con histograma y reproducción, acotar una zona
 * (círculo o polígono) y obtener recuentos, crecimiento y exportación. Aquí se aplican a emergencias civiles.
 *
 * Reglas de veracidad (CLAUDE.md §1): cada evento lleva `source` y `basis`. Los valores de `basis` son:
 *  - MEASURED_SATELLITE: detección de satélite descargada de una fuente pública (p. ej. NOAA GOES-R FDC).
 *  - MEASURED_CAMERA: recuento hecho en el repo sobre vídeo público de cámaras de tráfico.
 *  - OFFICIAL_ALERT: alerta publicada por un sistema oficial (p. ej. GDACS de la ONU y la Comisión Europea), sin modificar.
 *  - CITIZEN_SIGNED_UNVERIFIED: reporte ciudadano con firma válida; la firma prueba quién, no que sea cierto.
 *  - SIMULATION: generado para demostrar; siempre se muestra como simulación.
 * La envolvente de detecciones NO es el perímetro quemado: es el polígono convexo de píxeles de satélite
 * (2 km en el nadir según la especificación de NOAA ABI; 3,9 × 6,3 km en el Camp Fire según referencias.json), útil para ver dirección y ritmo, no para cartografía.
 */

const R = 6_371_008.8; // radio medio terrestre (m), IUGG
const rad = (d) => (d * Math.PI) / 180;

export const ATLAS_BASIS = Object.freeze(['MEASURED_SATELLITE', 'MEASURED_CAMERA', 'OFFICIAL_ALERT', 'CITIZEN_SIGNED_UNVERIFIED', 'SIMULATION']);

/** Distancia de círculo máximo (haversine) en metros entre {lat,lon}. */
export function haversineM(a, b) {
  const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Punto en polígono (trazado de rayo) con anillo [[lat,lon],…] (cerrado o no). Válido para zonas locales sin cruzar el antimeridiano. */
export function pointInPolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ¿Está el punto dentro del área? area = {type:'circle', center:{lat,lon}, radiusM} | {type:'polygon', ring:[[lat,lon],…]} | null (todo). */
export function inArea(p, area) {
  if (!area) return true;
  if (area.type === 'circle') return haversineM(area.center, p) <= area.radiusM;
  if (area.type === 'polygon') { if (!Array.isArray(area.ring) || area.ring.length < 3) throw new Error('polígono con menos de 3 vértices'); return pointInPolygon(p, area.ring); }
  throw new Error(`tipo de área desconocido: ${area.type}`);
}

/** Proyección local equirectangular (m) alrededor de un origen: suficiente para zonas de decenas de km. */
export function localXY(origin) {
  const k = Math.cos(rad(origin.lat));
  return (p) => ({ x: rad(p.lon - origin.lon) * R * k, y: rad(p.lat - origin.lat) * R });
}

/** Área de un anillo [[lat,lon],…] en km² (fórmula del lazo sobre la proyección local). */
export function ringAreaKm2(ring) {
  if (ring.length < 3) return 0;
  const o = { lat: ring.reduce((s, r) => s + r[0], 0) / ring.length, lon: ring.reduce((s, r) => s + r[1], 0) / ring.length };
  const P = localXY(o), q = ring.map(([lat, lon]) => P({ lat, lon }));
  let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2 / 1e6;
}

/** Envolvente convexa (cadena monótona de Andrew) de puntos {lat,lon}; devuelve anillo [[lat,lon],…] antihorario. */
export function convexHull(points) {
  const u = [...new Map(points.map((p) => [`${p.lat},${p.lon}`, p])).values()].sort((a, b) => a.lon - b.lon || a.lat - b.lat);
  if (u.length < 3) return u.map((p) => [p.lat, p.lon]);
  const cross = (o, a, b) => (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
  const lo = [], hi = [];
  for (const p of u) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...u].reverse()) { while (hi.length >= 2 && cross(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)].map((p) => [p.lat, p.lon]);
}

/** Valida y normaliza un evento. Exige fecha, coordenadas, tipo, fuente y base declarada. */
export function makeEvent(e) {
  const t = typeof e.t === 'number' ? e.t : Date.parse(e.t);
  if (!Number.isFinite(t)) throw new Error('evento sin fecha válida');
  if (!(Math.abs(e.lat) <= 90 && Math.abs(e.lon) <= 180)) throw new Error('evento sin coordenadas válidas');
  if (!e.kind) throw new Error('evento sin tipo');
  if (!e.source) throw new Error('evento sin fuente: no se admite un dato sin origen');
  if (!ATLAS_BASIS.includes(e.basis)) throw new Error(`base no declarada o desconocida: ${e.basis}`);
  return Object.freeze({ id: e.id ?? `${e.kind}:${t}:${e.lat},${e.lon}`, t, lat: e.lat, lon: e.lon, kind: e.kind, value: e.value ?? null, unit: e.unit ?? null, label: e.label ?? null, group: e.group ?? null, source: e.source, basis: e.basis });
}

/** Filtra por ventana de tiempo [from, to], tipos, bases, grupos y área. */
export function filterEvents(events, { from = -Infinity, to = Infinity, kinds = null, basis = null, groups = null, area = null } = {}) {
  return events.filter((e) => e.t >= from && e.t <= to && (!kinds || kinds.includes(e.kind)) && (!basis || basis.includes(e.basis)) && (!groups || groups.includes(e.group)) && inArea(e, area));
}

/** Histograma de la línea de tiempo: cubos de binMs con recuento total y por tipo. */
export function timeline(events, { binMs, from, to } = {}) {
  if (!(binMs > 0)) throw new Error('binMs debe ser > 0');
  if (!events.length && (from == null || to == null)) return [];
  const a = from ?? Math.min(...events.map((e) => e.t)), b = to ?? Math.max(...events.map((e) => e.t));
  const n = Math.max(1, Math.floor((b - a) / binMs) + 1), bins = Array.from({ length: n }, (_, i) => ({ t0: a + i * binMs, t1: a + (i + 1) * binMs, n: 0, byKind: {} }));
  for (const e of events) { const i = Math.floor((e.t - a) / binMs); if (i < 0 || i >= n) continue; bins[i].n++; bins[i].byKind[e.kind] = (bins[i].byKind[e.kind] ?? 0) + 1; }
  return bins;
}

/** Resumen de un conjunto (normalmente lo que cae dentro del perímetro). */
export function areaStats(events) {
  if (!events.length) return { n: 0, byKind: {}, byBasis: {}, sources: [], first: null, last: null, valueSum: {} };
  const byKind = {}, byBasis = {}, valueSum = {}, sources = new Set();
  let first = Infinity, last = -Infinity;
  for (const e of events) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1; byBasis[e.basis] = (byBasis[e.basis] ?? 0) + 1; sources.add(e.source);
    if (e.value != null && e.unit) valueSum[`${e.kind}:${e.unit}`] = (valueSum[`${e.kind}:${e.unit}`] ?? 0) + e.value;
    first = Math.min(first, e.t); last = Math.max(last, e.t);
  }
  return { n: events.length, byKind, byBasis, sources: [...sources], first, last, valueSum };
}

/**
 * Crecimiento de un fenómeno a partir de detecciones acumuladas: en cada cubo, envolvente convexa de todo lo
 * detectado hasta entonces (km²) y alcance máximo desde la primera detección (km). El ritmo (km/h) es la
 * variación del alcance entre cubos. Todo calculado; la precisión está limitada por el tamaño del píxel.
 */
export function growth(events, { binMs }) {
  if (!(binMs > 0)) throw new Error('binMs debe ser > 0');
  const ev = [...events].sort((a, b) => a.t - b.t);
  if (!ev.length) return [];
  const origin = ev[0], out = []; let i = 0, reach = 0, prevReach = 0;
  for (let t = ev[0].t; t <= ev.at(-1).t + binMs - 1; t += binMs) {
    while (i < ev.length && ev[i].t < t + binMs) { reach = Math.max(reach, haversineM(origin, ev[i]) / 1000); i++; }
    const hull = convexHull(ev.slice(0, i));
    out.push({ t: t + binMs, n: i, hullKm2: ringAreaKm2(hull), reachKm: reach, rateKmh: ((reach - prevReach) / binMs) * 3_600_000 });
    prevReach = reach;
  }
  return out;
}

/** Exporta a GeoJSON (RFC 7946: coordenadas [lon, lat]); el área de filtro se añade como Feature aparte. */
export function toGeoJSON(events, { area = null, title = 'SENDA Atlas' } = {}) {
  const features = events.map((e) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] }, properties: { id: e.id, time: new Date(e.t).toISOString(), kind: e.kind, value: e.value, unit: e.unit, label: e.label, group: e.group, source: e.source, basis: e.basis } }));
  if (area?.type === 'polygon') { const ring = area.ring.map(([lat, lon]) => [lon, lat]); if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push(ring[0]); features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { role: 'filter-area' } }); }
  if (area?.type === 'circle') features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [area.center.lon, area.center.lat] }, properties: { role: 'filter-area', radiusM: area.radiusM } });
  return { type: 'FeatureCollection', name: title, features };
}

/* ───────────── Adaptadores de los datos reales que ya hay en el repositorio ───────────── */

/** NOAA GOES-R ABI FDC (goes_casos.json): det = [lat, lon, FRP MW | null, máscara, calidad]. */
export function eventsFromGoes(goes, { cases = null } = {}) {
  const src = 'NOAA GOES-R ABI L2 Fire Detection (AWS Open Data, dominio público)';
  const out = [];
  for (const [name, c] of Object.entries(goes.casos ?? {})) {
    if (cases && !cases.includes(name)) continue;
    for (const f of c.frames) for (const d of f.det) out.push(makeEvent({ id: `goes:${name}:${f.t}:${d[0]},${d[1]}`, t: f.t, lat: d[0], lon: d[1], kind: 'FIRE_HOTSPOT', value: d[2], unit: d[2] == null ? null : 'MW', group: name, label: `${c.satelite} · FRP ${d[2] ?? 's/d'} MW`, source: src, basis: 'MEASURED_SATELLITE' }));
  }
  return out;
}

/** Cámaras de tráfico con recuento hecho en el repo (tfl_camaras.json y referencias.caltrans). */
export function eventsFromCameras(tfl, caltrans) {
  const out = [];
  for (const c of tfl?.camaras ?? []) out.push(makeEvent({ id: `tfl:${c.camara}`, t: tfl.capturaUTC, lat: c.lat, lon: c.lon, kind: 'CAMERA_COUNT', value: c.cruces, unit: 'vehículos/clip', group: 'london', label: c.nombre, source: 'TfL JamCams (Powered by TfL Open Data) · recuento YOLOX-s en el repo', basis: 'MEASURED_CAMERA' }));
  const capt = caltrans?.captura ?? caltrans?.capturaPST;
  for (const c of caltrans?.camaras ?? []) {
    if (!Number.isFinite(c.lat) || !capt) continue;
    const cr = c.video?.cruces, n = cr ? Object.values(cr).reduce((a, b) => a + b, 0) : null;
    out.push(makeEvent({ id: `caltrans:${c.id}`, t: /Z$|[+-]\d\d:?\d\d$/.test(capt) ? capt : `${capt}-08:00`, lat: c.lat, lon: c.lon, kind: 'CAMERA_COUNT', value: n, unit: n == null ? null : 'vehículos/clip', group: c.zona ?? 'caltrans', label: c.id, source: 'Caltrans CCTV · recuento YOLOX-s en el repo', basis: 'MEASURED_CAMERA' }));
  }
  return out;
}

/** Reportes ciudadanos ya verificados (salida de decodeReports de hazard-reports.mjs). */
export function eventsFromReports(reports) {
  return reports.map((r) => makeEvent({ id: `rep:${r.deviceId ?? ''}:${r.kind}:${r.at}`, t: r.at, lat: r.lat, lon: r.lon, kind: r.kind, value: r.people?.trapped || null, unit: r.people?.trapped ? 'atrapados' : null, group: 'ciudadanos', label: r.kind, source: r.simulated ? 'Reporte de demostración generado en la app' : 'Reporte ciudadano firmado (Ed25519)', basis: r.simulated ? 'SIMULATION' : 'CITIZEN_SIGNED_UNVERIFIED' }));
}

/** Tipos de evento de GDACS (glosario de GDACS). */
export const GDACS_TYPES = Object.freeze({ EQ: 'Terremoto', TC: 'Ciclón tropical', FL: 'Inundación', VO: 'Volcán', DR: 'Sequía', WF: 'Incendio forestal' });

/** Alertas GDACS descargadas con scripts/datos-reales/gdacs_snapshot.mjs (gdacs_eventos.json). */
export function eventsFromGdacs(snap) {
  const src = `GDACS (ONU + Comisión Europea/JRC) · descarga real del ${String(snap.descargadoUTC).slice(0, 10)}`;
  return (snap.eventos ?? []).map((e) => makeEvent({ id: `gdacs:${e.type}:${e.id}`, t: e.from, lat: e.lat, lon: e.lon, kind: `GDACS_${e.type}`, value: e.severity, unit: e.severityUnit,
    group: 'world', label: `${e.name} · alerta ${e.alert}${e.severityText ? ` · ${e.severityText}` : ''}`, source: src, basis: 'OFFICIAL_ALERT' }));
}

/** Causas DATEX II que publica la DGT, en castellano llano. */
export const DGT_CAUSES = Object.freeze({ roadMaintenance: 'Obras', accident: 'Accidente', vehicleObstruction: 'Vehículo detenido u obstáculo', environmentalObstruction: 'Obstáculo natural (agua, desprendimiento…)',
  obstruction: 'Obstrucción', infrastructureDamageObstruction: 'Daño en la infraestructura', roadOrCarriagewayOrLaneManagement: 'Cierre o gestión de carril', poorEnvironment: 'Meteorología o mala visibilidad', other: 'Otras' });

/** Incidencias reales de la DGT descargadas con scripts/datos-reales/dgt_incidencias_snapshot.mjs (dgt_incidencias.json). */
export function eventsFromDgt(snap) {
  const src = `DGT · Punto de Acceso Nacional (DATEX II), publicación del ${String(snap.publicacionDGT ?? snap.descargadoUTC).slice(0, 16).replace('T', ' ')}`;
  return (snap.incidencias ?? []).filter((r) => r.start || r.created).map((r) => {
    const cause = DGT_CAUSES[r.cause] ? r.cause : 'other';
    return makeEvent({ id: `dgt:${r.id}`, t: r.start ?? r.created, lat: r.lat, lon: r.lon, kind: `DGT_${cause}`, group: 'spain',
      label: `${r.road ?? 'vía sin nombre'} · ${DGT_CAUSES[cause]}${r.detail ? ` (${r.detail})` : ''}`, source: src, basis: 'OFFICIAL_ALERT' });
  });
}

/** Tipos de situación DATEX II que publica NDW (Países Bajos), en castellano llano. */
export const NDW_TYPES = Object.freeze({ RoadOrCarriagewayOrLaneManagement: 'Cierre o gestión de carril', SpeedManagement: 'Limitación de velocidad', ReroutingManagement: 'Desvío',
  VehicleObstruction: 'Vehículo detenido u obstáculo', Accident: 'Accidente', GeneralObstruction: 'Obstrucción', GeneralNetworkManagement: 'Gestión de la red', other: 'Otras' });

/** Situaciones reales de NDW descargadas con scripts/datos-reales/ndw_situaciones_snapshot.mjs (ndw_situaciones.json). */
export function eventsFromNdw(snap) {
  const src = `NDW (Países Bajos) · DATEX II actueel_beeld, publicación del ${String(snap.publicacionNDW ?? snap.descargadoUTC).slice(0, 16).replace('T', ' ')} UTC`;
  return (snap.situaciones ?? []).filter((r) => r.start || r.created).map((r) => {
    const type = NDW_TYPES[r.type] ? r.type : 'other';
    return makeEvent({ id: `ndw:${r.id}`, t: r.start ?? r.created, lat: r.lat, lon: r.lon, kind: `NDW_${type}`, group: 'nl', label: `${r.road ? r.road + ' · ' : ''}${NDW_TYPES[type]}`, source: src, basis: 'OFFICIAL_ALERT' });
  });
}

/**
 * Parte del día CALCULADO (no redactado por IA): lo que dicen los datos en una ventana de tiempo.
 * Para cada capa: total, nuevos en las últimas `horas`, tipos más frecuentes y elementos destacados.
 */
export function dailyBriefing(layers, { now, horas = 24, top = 3 } = {}) {
  if (!Number.isFinite(now)) throw new Error('now obligatorio');
  return layers.map(({ nombre, events, names = {}, prefix = '', destacar = () => false }) => {
    const recientes = events.filter((e) => e.t > now - horas * 3_600_000 && e.t <= now);
    const porTipo = {}; for (const e of events) { const k = names[e.kind.slice(prefix.length)] ?? e.kind; porTipo[k] = (porTipo[k] ?? 0) + 1; }
    return { nombre, total: events.length, nuevos: recientes.length, tiposPrincipales: Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, top), destacados: events.filter(destacar).slice(0, 5).map((e) => e.label), fuente: [...new Set(events.map((e) => e.source))][0] ?? null };
  });
}

/** Carreteras con incidencias dentro de un área (p. ej. cortes de la DGT): agrupa por vía y cuenta por tipo. */
export function roadsInArea(events, area) {
  const out = {}; for (const e of filterEvents(events, { area })) { const road = (e.label ?? '').split(' · ')[0] || 'vía sin nombre'; (out[road] ??= { road, n: 0, tipos: {} }); out[road].n++; const tipo = (e.label ?? '').split(' · ')[1] ?? e.kind; out[road].tipos[tipo] = (out[road].tipos[tipo] ?? 0) + 1; }
  return Object.values(out).sort((a, b) => b.n - a.n);
}

/** Longitud de un recorrido [{lat,lon},…] en metros (suma de tramos de círculo máximo). */
export function pathLengthM(points) {
  let d = 0; for (let k = 1; k < points.length; k++) d += haversineM(points[k - 1], points[k]); return d;
}

/**
 * Novedades en una zona vigilada: eventos dentro del área que empezaron después de `since`.
 * watch = { name, case, area, since }. Devuelve { n, porTipo, ultimos } sin tocar los datos.
 */
export function zoneDelta(events, watch, { names = {}, prefix = '' } = {}) {
  if (!watch?.area || !Number.isFinite(watch.since)) throw new Error('zona vigilada sin área o sin fecha');
  const nuevos = filterEvents(events, { from: watch.since + 1, area: watch.area }).sort((a, b) => b.t - a.t);
  const porTipo = {}; for (const e of nuevos) { const k = names[e.kind.slice(prefix.length)] ?? e.kind; porTipo[k] = (porTipo[k] ?? 0) + 1; }
  return { n: nuevos.length, porTipo, ultimos: nuevos.slice(0, 5).map((e) => ({ t: e.t, label: e.label, source: e.source })) };
}
