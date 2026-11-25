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
  const steps = r.legs.flatMap((l) => l.steps).map((s) => ({ type: s.maneuver.type, modifier: s.maneuver.modifier ?? null, name: s.name ?? '', at: s.maneuver.location, distanceM: s.distance, durationS: s.duration, text: instructionEs(s) }));
  return { ok: true, coords: r.geometry.coordinates, distanceM: r.distance, durationS: r.duration, steps, alternatives: json.routes.length - 1, basis: 'ESTIMACION_OSRM_SIN_TRAFICO' };
}

/** Distancia (m) del punto a la línea de la ruta. */
export function distToRoute(route, p) {
  let d = Infinity;
  for (let i = 1; i < route.coords.length; i++) d = Math.min(d, pointSegmentM(p, route.coords[i - 1], route.coords[i]));
  return d;
}

/** Siguiente maniobra por delante: la primera cuyo punto está más adelante que la posición proyectada. */
export function nextManeuver(route, p) {
  // índice del vértice de la ruta más cercano
  let bi = 0, bd = Infinity;
  route.coords.forEach((c, i) => { const d = haversineM(c, p); if (d < bd) { bd = d; bi = i; } });
  const idxOf = (pt) => { let k = 0, kd = Infinity; route.coords.forEach((c, i) => { const d = haversineM(c, pt); if (d < kd) { kd = d; k = i; } }); return k; };
  for (const s of route.steps) {
    if (s.type === 'depart') continue;
    const k = idxOf(s.at);
    if (k > bi) {
      let dist = 0; for (let i = bi; i < k; i++) dist += haversineM(route.coords[i], route.coords[i + 1]);
      return { step: s, distM: dist };
    }
  }
  return { step: route.steps.at(-1), distM: haversineM(p, route.coords.at(-1)) };
}

/** ¿Hay que recalcular? Fuera de ruta más de offRouteM y sin haber pedido otra ruta en minRerouteS. */
export function shouldReroute(route, p, lastRequestS, nowS, rules = NAV_RULES) {
  return distToRoute(route, p) > rules.offRouteM && nowS - lastRequestS >= rules.minRerouteS;
}

/** Texto hablado según la distancia a la maniobra (avisos a 500, 150 y 30 m), o null si no toca. */
export function announcement(next, alreadySaid, rules = NAV_RULES) {
  const band = [...rules.announceM].sort((a, b) => a - b).find((m) => next.distM <= m); // la franja más ajustada
  if (band == null) return null;
  const key = `${next.step.text}@${band}`;
  if (alreadySaid.has(key)) return null;
  alreadySaid.add(key);
  return band <= 30 ? next.step.text : `En ${Math.round(next.distM / 10) * 10} metros, ${next.step.text.charAt(0).toLowerCase()}${next.step.text.slice(1)}`;
}
