/**
 * Navegación giro a giro con OSRM (servidor de FOSSGIS: pruebas, no comercial, bajo volumen).
 * Aquí solo se construye la petición y se interpreta la respuesta: instrucciones en español,
 * siguiente maniobra, salida de ruta y llegada. Duraciones = estimación del perfil de coche de OSRM
 * (no es tráfico en tiempo real).
 */
import { haversineM, pointSegmentM } from './route-planner.mjs';

export const OSRM_BASE = 'https://router.project-osrm.org';
/** Reglas de la app (declaradas, no calibradas): a partir de cuántos metros fuera se recalcula y cada cuánto como mínimo. */
export const NAV_RULES = Object.freeze({ offRouteM: 50, minRerouteS: 30, announceM: [500, 150, 30] });

/** Servidores públicos de OSRM por medio de transporte (FOSSGIS; uso de pruebas, poco volumen). */
export const OSRM_BY_MODE = Object.freeze({
  car: OSRM_BASE,
  bike: 'https://routing.openstreetmap.de/routed-bike',
  foot: 'https://routing.openstreetmap.de/routed-foot',
});
export function routeUrl({ from, to, via = [], profile = 'driving', mode = 'car' }) {
  const pts = [from, ...via, to].map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const base = OSRM_BY_MODE[mode] ?? OSRM_BASE; // routing.openstreetmap.de usa «driving» en la ruta aunque el perfil sea pie/bici
  return `${base}/route/v1/${profile}/${pts}?overview=full&geometries=geojson&steps=true&alternatives=true`;
}

const DIR = { left: 'a la izquierda', right: 'a la derecha', 'slight left': 'ligeramente a la izquierda', 'slight right': 'ligeramente a la derecha', 'sharp left': 'muy cerrado a la izquierda', 'sharp right': 'muy cerrado a la derecha', straight: 'recto', uturn: 'cambio de sentido' };
export function instructionEs(step) {
  const m = step.maneuver ?? {}, dir = DIR[m.modifier] ?? '', name = step.name ? ` por ${step.name}` : '';
  switch (m.type) {
    case 'depart': return `Sal${name}`;
    case 'arrive': return 'Has llegado a tu destino';
    case 'turn': case 'end of road': return m.modifier === 'uturn' ? `Cambia de sentido${name}` : `Gira ${dir}${name}`;
    case 'new name': case 'continue': return `Sigue ${dir || 'recto'}${name}`;
    case 'merge': return `Incorpórate ${dir}${name}`;
    case 'on ramp': return `Toma el acceso ${dir}${name}`;
    case 'off ramp': return `Toma la salida ${dir}${name}`;
    case 'fork': return `En la bifurcación, ve ${dir}${name}`;
    case 'roundabout': case 'rotary': return `En la rotonda, toma la ${m.exit ? m.exit + 'ª' : ''} salida${name}`;
    case 'exit roundabout': case 'exit rotary': return `Sal de la rotonda${name}`;
    default: return `Continúa${name}`;
  }
}

export function parseRoute(json, i = 0) {
  if (json?.code !== 'Ok' || !json.routes?.[i]) return { ok: false, reason: json?.code ?? 'SIN_RESPUESTA' };
  const r = json.routes[i];
  const rawSteps = r.legs.flatMap((l) => l.steps);
  const pickLanes = (s, prev) => {
    const direct = s.intersections?.[0]?.lanes;
    if (Array.isArray(direct) && direct.length) return direct;
    const prevApproach = prev?.intersections ? [...prev.intersections].reverse().find((x) => Array.isArray(x.lanes) && x.lanes.length)?.lanes : null;
    if (prevApproach) return prevApproach;
    return s.intersections?.find((x) => Array.isArray(x.lanes) && x.lanes.length)?.lanes ?? null;
  };
  const steps = rawSteps.map((s, idx) => {
    const rawLanes = pickLanes(s, idx > 0 ? rawSteps[idx - 1] : null);
    return {
      type: s.maneuver.type,
      modifier: s.maneuver.modifier ?? null,
      name: s.name ?? '',
      at: s.maneuver.location,
      distanceM: s.distance,
      durationS: s.duration,
      text: instructionEs(s),
      lanes: rawLanes ? rawLanes.map((l) => ({ indications: l.indications ?? [], valid: !!l.valid })) : null,
    };
  });
  return { ok: true, coords: r.geometry.coordinates, distanceM: r.distance, durationS: r.duration, steps, alternatives: json.routes.length - 1, basis: 'ESTIMACION_OSRM_SIN_TRAFICO' };
}

/** Distancia (m) del punto a la línea de la ruta. */
export function distToRoute(route, p) {
  let d = Infinity;
  for (let i = 1; i < route.coords.length; i++) d = Math.min(d, pointSegmentM(p, route.coords[i - 1], route.coords[i]));
  return d;
}

/** Distancia acumulada por vértice a lo largo de `coords` (m). */
function cumulativeLengthsM(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
  return cum;
}

/** Proyecta `pt` sobre `coords` desde el segmento `minSeg` en adelante: devuelve `{ sM, segIdx, at, offM }`. */
function projectAlongCoords(coords, cum, pt, minSeg = 0) {
  const R = 6371008.8, D = Math.PI / 180, kx = Math.cos(pt[1] * D) * R * D, ky = R * D;
  let best = null;
  const start = Math.max(0, Math.min(coords.length - 2, minSeg));
  for (let i = start + 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - pt[0]) * kx, ay = (coords[i - 1][1] - pt[1]) * ky;
    const bx = (coords[i][0] - pt[0]) * kx, by = (coords[i][1] - pt[1]) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 > 1e-9 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
    const segLen = cum[i] - cum[i - 1];
    if (!best || d < best.offM) {
      best = { offM: d, segIdx: i - 1, sM: cum[i - 1] + t * segLen, at: [pt[0] + px / kx, pt[1] + py / ky] };
    }
  }
  return best ?? { offM: 0, segIdx: 0, sM: 0, at: coords[0] };
}

/** Siguiente maniobra por delante: proyección continua sobre los tramos de la polilínea (no salta antes del giro en rectas largas). */
export function nextManeuver(route, p) {
  const coords = route?.coords ?? [];
  const steps = route?.steps ?? [];
  if (coords.length < 2 || !steps.length) {
    const last = steps.at(-1) ?? { type: 'arrive', text: 'Has llegado a tu destino', lanes: null };
    return { step: last, stepIndex: Math.max(0, steps.length - 1), distM: coords.length ? haversineM(p, coords.at(-1)) : 0 };
  }
  const cum = cumulativeLengthsM(coords);
  const ego = projectAlongCoords(coords, cum, p, 0);
  let searchSeg = 0;
  for (let idx = 0; idx < steps.length; idx++) {
    const s = steps[idx];
    const proj = s.at ? projectAlongCoords(coords, cum, s.at, searchSeg) : { segIdx: searchSeg, sM: cum[cum.length - 1] };
    searchSeg = proj.segIdx;
    if (s.type === 'depart') continue;
    if (s.type === 'arrive') {
      const remM = Math.max(0, cum[cum.length - 1] - ego.sM);
      const directM = haversineM(p, coords.at(-1));
      return { step: s, stepIndex: idx, distM: ego.offM <= 60 ? remM : directM };
    }
    // Mantiene la maniobra activa hasta 5 m después del vértice del giro para no perder el aviso de ≤30 m
    if (proj.sM >= ego.sM - 5) {
      return { step: s, stepIndex: idx, distM: Math.max(0, proj.sM - ego.sM) };
    }
  }
  return { step: steps.at(-1), stepIndex: steps.length - 1, distM: haversineM(p, coords.at(-1)) };
}

/** ¿Hay que recalcular? Fuera de ruta más de offRouteM y sin haber pedido otra ruta en minRerouteS. */
export function shouldReroute(route, p, lastRequestS, nowS, rules = NAV_RULES) {
  return distToRoute(route, p) > rules.offRouteM && nowS - lastRequestS >= rules.minRerouteS;
}

/** Texto hablado según la distancia a la maniobra (avisos a 500, 150 y 30 m), o null si no toca. */
export function announcement(next, alreadySaid, rules = NAV_RULES) {
  const band = [...rules.announceM].sort((a, b) => a - b).find((m) => next.distM <= m); // la franja más ajustada
  if (band == null) return null;
  const locKey = Array.isArray(next.step?.at) ? `${next.step.at[0].toFixed(5)},${next.step.at[1].toFixed(5)}` : (next.stepIndex ?? '');
  const key = `${locKey}|${next.step.text}@${band}`;
  if (alreadySaid.has(key)) return null;
  alreadySaid.add(key);
  return band <= 30 ? next.step.text : `En ${Math.round(next.distM / 10) * 10} metros, ${next.step.text.charAt(0).toLowerCase()}${next.step.text.slice(1)}`;
}

/**
 * Ajusta la posición a la línea de la ruta (como hacen los navegadores): el punto más cercano de la polilínea si está a
 * menos de maxM metros (maxM lo decide quien llama, p. ej. la precisión del GPS). Devuelve { at:[lon,lat], offM, segIdx, bearingDeg } o null.
 */
export function snapToRoute(coords, pos, maxM) {
  if (!Array.isArray(coords) || coords.length < 2 || !pos || !(maxM > 0)) return null;
  const R = 6371008.8, D = Math.PI / 180, kx = Math.cos(pos[1] * D) * R * D, ky = R * D;
  let best = null;
  for (let i = 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - pos[0]) * kx, ay = (coords[i - 1][1] - pos[1]) * ky, bx = (coords[i][0] - pos[0]) * kx, by = (coords[i][1] - pos[1]) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
    if (!best || d < best.offM) {
      const segBearing = L2 > 1e-6 ? (((Math.atan2(dx, dy) * 180) / Math.PI) % 360 + 360) % 360 : null;
      best = { offM: d, at: [pos[0] + px / kx, pos[1] + py / ky], segIdx: i - 1, bearingDeg: segBearing };
    }
  }
  return best && best.offM <= maxM ? { ...best, offM: +best.offM.toFixed(1) } : null;
}

/**
 * Extrae los puntos reales `<trkpt>` (o `<rtept>`) de una traza GPX 1.0/1.1 sin dependencias externas.
 * Calcula velocidad y rumbo derivados entre muestras reales cuando el GPX no incluye `<speed>`/`<course>`.
 * @param {string} xmlText
 */
export function parseGpxTrack(xmlText) {
  const pts = [];
  const tagRe = /<(?:trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/(?:trkpt|rtept)>|<(?:trkpt|rtept)\b([^>]*)\/>/gi;
  let m;
  while ((m = tagRe.exec(String(xmlText))) !== null) {
    const attrs = m[1] ?? m[3] ?? '';
    const inner = m[2] ?? '';
    const latM = /\blat=["']([^"']+)["']/i.exec(attrs);
    const lonM = /\blon=["']([^"']+)["']/i.exec(attrs);
    if (!latM || !lonM) continue;
    const lat = Number(latM[1]), lon = Number(lonM[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleM = /<ele>([^<]+)<\/ele>/i.exec(inner);
    const timeM = /<time>([^<]+)<\/time>/i.exec(inner);
    const tMs = timeM ? Date.parse(timeM[1].trim()) : null;
    pts.push({
      lon,
      lat,
      altM: eleM && Number.isFinite(Number(eleM[1])) ? Number(eleM[1]) : null,
      iso: timeM ? timeM[1].trim() : null,
      tMs: Number.isFinite(tMs) ? tMs : null,
    });
  }
  const D = Math.PI / 180;
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], prev = i > 0 ? pts[i - 1] : null, next = i + 1 < pts.length ? pts[i + 1] : null;
    const refA = prev ?? cur, refB = prev ? cur : (next ?? cur);
    const dx = (refB.lon - refA.lon) * Math.cos(cur.lat * D) * 111_320;
    const dy = (refB.lat - refA.lat) * 111_132.95;
    const stepM = prev ? haversineM([prev.lon, prev.lat], [cur.lon, cur.lat]) : 0;
    const dtS = prev && cur.tMs != null && prev.tMs != null && cur.tMs > prev.tMs ? (cur.tMs - prev.tMs) / 1000 : null;
    cur.stepM = +stepM.toFixed(2);
    cur.speedMs = dtS != null && dtS > 0 ? +(stepM / dtS).toFixed(2) : null;
    cur.headingDeg = Math.hypot(dx, dy) > 0.5 ? +((((Math.atan2(dx, dy) * 180) / Math.PI) % 360 + 360) % 360).toFixed(1) : (prev?.headingDeg ?? 0);
  }
  return pts;
}
