/**
 * SENDA · Gemelo digital de edificios afectados.
 *
 * - Edificios: huellas reales de OpenStreetMap (Overpass) o del Catastro (INSPIRE
 *   BuildingPart, con número de plantas), o un conjunto de demostración sin red.
 * - Daños: escala europea EMS-98 (grados 1–5) asignada por inspección visual (con foto
 *   adjunta) — el recuento de afectados de la zona sale de aquí.
 * - Comunicaciones: los puntos de acceso Wi-Fi (routers de cada vivienda) se localizan
 *   en 3D a partir de su señal medida desde varios puntos (a pie o con un dron que sube
 *   por la fachada). Un router visto antes y ausente ahora = sin corriente o zona dañada.
 *   Un router es PASARELA solo si un teléfono SENDA conectado a él informa de salida a
 *   Internet; nunca se accede a redes ajenas.
 * - Personas: registro voluntario (edificio/planta/vivienda). Quien no responde a las
 *   alertas pasa a DESAPARECIDO (sin confirmar) — jamás a «víctima».
 */
import { locateBeacon } from './rubble.mjs';

export const EMS98 = Object.freeze([
  { grade: 0, key: 'NOT_ASSESSED', label: 'Sin evaluar' },
  { grade: 1, key: 'NEGLIGIBLE', label: 'Daño despreciable o leve' },
  { grade: 2, key: 'MODERATE', label: 'Daño moderado' },
  { grade: 3, key: 'SUBSTANTIAL', label: 'Daño sustancial a grave' },
  { grade: 4, key: 'VERY_HEAVY', label: 'Daño muy grave (colapso parcial)' },
  { grade: 5, key: 'DESTRUCTION', label: 'Destrucción (colapso total)' },
]);
export const FLOOR_HEIGHT_M = 3;

/* ---------- geometría local (metros este/norte respecto a un origen) ---------- */
export function toLocal(origin, { lat, lon }) {
  return { x: (lon - origin.lon) * 111320 * Math.cos((origin.lat * Math.PI) / 180), y: (lat - origin.lat) * 111320 };
}
export function polygonArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y); return Math.abs(a / 2); }
export function pointInPoly(p, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i].y > p.y) !== (pts[j].y > p.y) && p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) c = !c; return c; }
const bbox = (pts) => ({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)) });

/** Overpass JSON (`out geom;`) → edificios. Plantas: building:levels, o altura/3, o 1. */
export function buildingsFromOverpass(json) {
  return (json.elements ?? []).filter((e) => e.type === 'way' && e.tags?.building && e.geometry?.length >= 4).map((e) => {
    const levels = +e.tags['building:levels'] || (+e.tags.height ? Math.max(1, Math.round(+e.tags.height / FLOOR_HEIGHT_M)) : 1);
    return { id: `osm:${e.id}`, source: 'OpenStreetMap (ODbL)', name: e.tags.name ?? (e.tags['addr:street'] ? `${e.tags['addr:street']} ${e.tags['addr:housenumber'] ?? ''}`.trim() : null),
      levels, levelsSource: e.tags['building:levels'] ? 'OSM building:levels' : e.tags.height ? 'OSM height' : 'DEFAULT', footprint: e.geometry.map((g) => ({ lat: g.lat, lon: g.lon })) };
  });
}
/** Consulta Overpass para huellas en un radio (para cachear con red). */
export const overpassQuery = ({ lat, lon }, radiusM = 300) => `[out:json][timeout:25];way["building"](around:${radiusM},${lat},${lon});out geom;`;

/** Prepara un edificio para el gemelo: huella local, plantas y viviendas por planta (cuadrantes). */
export function prepareBuilding(b, origin) {
  const fp = b.footprint.map((p) => toLocal(origin, p));
  return { ...b, local: fp, areaM2: Math.round(polygonArea(fp)), bbox: bbox(fp), heightM: b.levels * FLOOR_HEIGHT_M, unitsPerFloor: b.unitsPerFloor ?? Math.max(1, Math.min(8, Math.round(polygonArea(fp) / 90))) };
}

/** Vivienda (cuadrante) de un punto dentro de la planta: A=NO, B=NE, C=SO, D=SE para 4 viviendas. */
export function unitOf(building, p) {
  const { minX, maxX, minY, maxY } = building.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  if (building.unitsPerFloor <= 1) return 'A';
  return (p.y >= cy ? (p.x < cx ? 'A' : 'B') : (p.x < cx ? 'C' : 'D'));
}

/** Recuento de la zona por grado de daño (vista dron / panorámica). */
export function damageSummary(buildings, assessments) {
  const byB = new Map(); for (const a of assessments) { const prev = byB.get(a.buildingId); if (!prev || a.at > prev.at) byB.set(a.buildingId, a); }
  const counts = Object.fromEntries(EMS98.map((g) => [g.key, 0]));
  const rows = buildings.map((b) => { const a = byB.get(b.id); const g = EMS98[a?.grade ?? 0]; counts[g.key]++; return { id: b.id, name: b.name, levels: b.levels, grade: g.grade, label: g.label, floorsAffected: a?.floors ?? [], photo: a?.photo ?? null, by: a?.by ?? null }; });
  const affected = rows.filter((r) => r.grade >= 2).length;
  return { total: buildings.length, affected, severe: rows.filter((r) => r.grade >= 4).length, notAssessed: counts.NOT_ASSESSED, counts, rows: rows.sort((a, b) => b.grade - a.grade) };
}

/**
 * Localiza routers a partir de barridos Wi-Fi (Android WifiManager, accesorio ESP32 o dron).
 * scans: [{x,y,z (m locales), bssid, ssid?, rssi, t}] · connected: informes de teléfonos SENDA
 * conectados a un AP: [{bssid, internet:boolean, t}]
 */
export function locateAccessPoints(scans, building, { now, staleS = 180, model = { txPower1m: -38, n: 3.0 }, connected = [] } = {}) {
  const by = new Map(); for (const s of scans) { if (!by.has(s.bssid)) by.set(s.bssid, []); by.get(s.bssid).push(s); }
  const aps = [];
  for (const [bssid, ss] of by) {
    const last = Math.max(...ss.map((s) => s.t));
    // Una lectura por punto de medida (media) para no sobreponderar.
    const pts = [...ss.reduce((m, s) => { const k = `${Math.round(s.x)}:${Math.round(s.y)}:${Math.round(s.z)}`; const v = m.get(k) ?? { x: s.x, y: s.y, z: s.z, rssi: 0, n: 0 }; v.rssi += s.rssi; v.n++; m.set(k, v); return m; }, new Map()).values()].map((v) => ({ x: v.x, y: v.y, z: v.z, rssi: v.rssi / v.n }));
    const est = pts.length >= 4 ? locateBeaconUp(pts, model, building) : null;
    const link = connected.filter((c) => c.bssid === bssid).sort((a, b) => b.t - a.t)[0];
    const floor = est ? Math.max(0, Math.min(building.levels - 1, Math.floor(est.z / FLOOR_HEIGHT_M))) : null;
    aps.push({
      bssid, ssid: ss.find((s) => s.ssid)?.ssid ?? null, samples: ss.length, bestRssi: Math.max(...ss.map((s) => s.rssi)),
      position: est && { x: +est.x.toFixed(1), y: +est.y.toFixed(1), z: +est.z.toFixed(1), errorM: +est.errorM.toFixed(1) }, floor, unit: est ? unitOf(building, est) : null,
      state: now - last <= staleS ? 'ACTIVE' : 'LOST', lastSeen: last,
      uplink: link ? (link.internet ? 'ONLINE' : 'NO_INTERNET') : 'UNKNOWN',
      gateway: !!(link?.internet && now - last <= staleS),
    });
  }
  return aps.sort((a, b) => (a.floor ?? 99) - (b.floor ?? 99) || String(a.unit).localeCompare(String(b.unit)));
}

/** Trilateración 3D con z ≥ 0 y dentro de la caja del edificio (no bajo tierra como en escombros). */
function locateBeaconUp(pts, model, building) {
  const shifted = pts.map((p) => ({ ...p, z: -p.z })); // rubble.locateBeacon fuerza z ≤ 0: se invierte el eje
  const e = locateBeacon(shifted, model); if (!e) return null;
  const { minX, maxX, minY, maxY } = building.bbox;
  return { x: Math.min(maxX, Math.max(minX, e.x)), y: Math.min(maxY, Math.max(minY, e.y)), z: Math.min(building.heightM - 0.5, Math.max(0.5, -e.z)), errorM: e.errorM };
}

/* ---------- personas: registro voluntario y estado sin presunciones ---------- */
export const PERSON_STATES = Object.freeze(['CONFIRMED_SAFE', 'CONFIRMED_NEEDS_HELP', 'TRAPPED_CONFIRMED', 'PENDING', 'SIGNAL_NO_RESPONSE', 'MISSING_UNCONFIRMED', 'NOT_IN_BUILDING']);

/**
 * Estado de una persona registrada. Nunca «víctima»: sin respuesta tras ≥2 alertas y
 * `missingAfterS` → MISSING_UNCONFIRMED; si su teléfono emite señal localizada → SIGNAL_NO_RESPONSE.
 */
export function personState({ responses = [], alertsSent = [], phoneSignal = null }, { now, missingAfterS = 600 } = {}) {
  const last = [...responses].sort((a, b) => b.at - a.at)[0];
  if (last) return { state: { SAFE: 'CONFIRMED_SAFE', NEED_HELP: 'CONFIRMED_NEEDS_HELP', TRAPPED: 'TRAPPED_CONFIRMED', AWAY: 'NOT_IN_BUILDING' }[last.status] ?? 'PENDING', since: last.at };
  if (!alertsSent.length) return { state: 'PENDING', since: null };
  const first = Math.min(...alertsSent.map((a) => a.at));
  if (phoneSignal && now - phoneSignal.t < 300) return { state: 'SIGNAL_NO_RESPONSE', since: phoneSignal.t, floor: phoneSignal.floor };
  if (alertsSent.length >= 2 && now - first >= missingAfterS) return { state: 'MISSING_UNCONFIRMED', since: first + missingAfterS };
  return { state: 'PENDING', since: first };
}

/** Audiencia de una alerta dirigida (edificio / plantas / viviendas) desde el registro voluntario. */
export function targetAudience(registry, { buildingId, floors = null, units = null }) {
  return registry.filter((r) => r.buildingId === buildingId && (!floors || floors.includes(r.floor)) && (!units || units.includes(r.unit)));
}

/** Cuadro por planta: routers activos/perdidos, pasarelas y personas por estado. */
export function floorBoard(building, aps, people) {
  return Array.from({ length: building.levels }, (_, f) => {
    const fa = aps.filter((a) => a.floor === f), fp = people.filter((p) => p.floor === f);
    const states = Object.fromEntries(PERSON_STATES.map((s) => [s, fp.filter((p) => p.state === s).length]));
    return { floor: f, label: f === 0 ? 'Bajo' : `Planta ${f}`, routersActive: fa.filter((a) => a.state === 'ACTIVE').length, routersLost: fa.filter((a) => a.state === 'LOST').length, gateways: fa.filter((a) => a.gateway).length, people: fp.length, ...states };
  }).reverse();
}

/** Color de mapa de calor para la cámara / 3D: fuerte → rojo, débil → azul. */
export function signalColor(rssi) {
  const t = Math.max(0, Math.min(1, (rssi + 95) / 55)); // -95 dBm → 0, -40 dBm → 1
  const r = Math.round(255 * Math.min(1, t * 2)), g = Math.round(255 * (t < 0.5 ? t * 2 : 2 - t * 2)), b = Math.round(255 * Math.max(0, 1 - t * 2));
  return { css: `rgb(${r},${g},${b})`, strength: t < 0.33 ? 'DÉBIL' : t < 0.66 ? 'MEDIA' : 'FUERTE', t };
}
