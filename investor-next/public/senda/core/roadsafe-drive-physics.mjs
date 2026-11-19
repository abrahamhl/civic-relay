/**
 * SENDA RoadSafe · Física de la conducción aplicada a los avisos por delante.
 *
 * Une piezas que ya existían por separado (horizonte, presupuesto de atención, distancia de parada) y añade
 * dos capacidades nuevas:
 *
 * 1) VISIBILIDAD DESDE LA GEOMETRÍA. Distancia de visibilidad a lo largo de la vía calculada con la propia
 *    polilínea: el objetivo a distancia d es visible si ningún punto intermedio de la vía se separa de la
 *    visual (ojo → objetivo) más que el despeje lateral declarado. Es el principio de la «ordenada media» de
 *    las curvas horizontales, resuelto numéricamente para cualquier trazado (curvas en S incluidas).
 *    No contempla el perfil vertical (cambios de rasante) ni obstáculos laterales concretos: el despeje
 *    lateral es un parámetro DECLARADO por quien llama.
 *
 * 2) URGENCIA FÍSICA POR AVISO (DRAC, deceleración necesaria para evitar el choque, medida de seguridad
 *    sustitutiva). Para cada aviso: tras el tiempo de reacción, ¿qué deceleración hace falta para quedarse
 *    antes del peligro? Si supera la deceleración disponible (μ·g, declarada), no se puede parar: INMINENTE.
 *    Un peligro más allá de la visibilidad pero dentro de la distancia de parada es OCULTO: solo un aviso
 *    puede salvarlo, porque los ojos llegan tarde.
 *
 * Todos los parámetros (reacción, deceleraciones, despeje, márgenes) son DECLARADOS: el módulo no trae
 * valores por defecto (regla de veracidad del proyecto).
 */
import { pointAt, roadLocate } from './road-guard.mjs';

const G = 9.80665; // aceleración normal de la gravedad (valor convencional, CGPM 1901)
const need = (name, o, keys) => { for (const k of keys) if (!Number.isFinite(o?.[k])) throw new Error(`${name}: «${k}» debe declararse`); };

/** Plano local equirectangular alrededor de un punto (error despreciable en pocos km). */
function localPlane(lat0, lon0) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180), ky = 110_574;
  return (p) => ({ x: (p.lon - lon0) * kx, y: (p.lat - lat0) * ky });
}
const distPointSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0; return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy); };

/**
 * Distancia de visibilidad hacia delante por la vía desde la posición de `fix`.
 * opts (DECLARADOS): { clearanceM: despeje lateral libre desde el eje de la visual, maxM, stepM }.
 */
export function sightDistanceAlong(road, fix, opts) {
  need('sightDistanceAlong', opts, ['clearanceM', 'maxM', 'stepM']);
  const { clearanceM, maxM, stepM } = opts;
  if (!(stepM > 0) || !(clearanceM >= 0)) throw new Error('sightDistanceAlong: paso y despeje deben ser positivos');
  const me = roadLocate(fix, road), P = localPlane(fix.lat, fix.lon);
  const roadLen = roadLocate(road.points[road.points.length - 1], road).s;
  const pts = [P(pointAt(road, me.s))];
  let visible = 0;
  for (let d = stepM; d <= maxM + 1e-9; d += stepM) {
    const s = me.s + me.dir * d;
    if (s < 0 || s > roadLen) break; // fin de la geometría conocida
    const target = P(pointAt(road, s));
    pts.push(target);
    const eye = pts[0];
    // la visual se bloquea si algún punto intermedio de la vía queda fuera del despeje
    let ok = true;
    for (let i = 1; i < pts.length - 1; i++) if (distPointSeg(pts[i], eye, target) > clearanceM) { ok = false; break; }
    if (!ok) break;
    visible = d;
  }
  return { sightM: visible, limitedBy: visible >= maxM ? 'HORIZONTE_DE_CALCULO' : 'TRAZADO', basis: 'GEOMETRÍA EN PLANTA (sin perfil vertical); despeje lateral declarado' };
}

/** Deceleración necesaria para parar antes de `distM` tras `reactS` (m/s²); Infinity si ya no hay espacio. */
export function requiredDecel({ vMs, distM, reactS, marginM, hazardSpeedMs }) {
  need('requiredDecel', { vMs, distM, reactS, marginM, hazardSpeedMs }, ['vMs', 'distM', 'reactS', 'marginM', 'hazardSpeedMs']);
  const rel = Math.max(0, vMs - hazardSpeedMs); // contra un peligro que se mueve en mi sentido (cola que avanza)
  if (rel === 0) return 0;
  const free = distM - marginM - rel * reactS;
  return free <= 0 ? Infinity : (rel * rel) / (2 * free);
}

/** Velocidad máxima para parar dentro de `distM` con deceleración `decelMs2` tras `reactS`. */
export function maxSpeedToStopWithin({ distM, reactS, decelMs2, marginM }) {
  need('maxSpeedToStopWithin', { distM, reactS, decelMs2, marginM }, ['distM', 'reactS', 'decelMs2', 'marginM']);
  const d = Math.max(0, distM - marginM), a = decelMs2;
  return a > 0 ? a * (-reactS + Math.sqrt(reactS * reactS + (2 * d) / a)) : 0;
}

export const URGENCY = Object.freeze(['INFO', 'PREPARE', 'BRAKE', 'IMMINENT']);

/**
 * Urgencia física de cada aviso del horizonte.
 * items: roadAhead().items. state: { vMs }. policy (DECLARADA): { reactS, marginM, mu, comfortDecelMs2, prepareDecelMs2 }
 * sightM: visibilidad (p. ej. sightDistanceAlong) o null si no se conoce (entonces no se marca «oculto»).
 */
export function physicalUrgency(items, { vMs, sightM = null }, policy) {
  need('physicalUrgency', { vMs }, ['vMs']);
  need('physicalUrgency', policy, ['reactS', 'marginM', 'mu', 'comfortDecelMs2', 'prepareDecelMs2']);
  const avail = policy.mu * G;
  const stopM = vMs * policy.reactS + (avail > 0 ? (vMs * vMs) / (2 * avail) : Infinity) + policy.marginM;
  return items.map((i) => {
    const hazardSpeedMs = i.kind === 'QUEUE_TAIL' && Number.isFinite(i.hazardSpeedMs) ? i.hazardSpeedMs : 0;
    const drac = requiredDecel({ vMs, distM: i.aheadM, reactS: policy.reactS, marginM: policy.marginM, hazardSpeedMs });
    const urgency = drac >= avail ? 'IMMINENT' : drac >= policy.comfortDecelMs2 ? 'BRAKE' : drac >= policy.prepareDecelMs2 ? 'PREPARE' : 'INFO';
    const hidden = Number.isFinite(sightM) && i.aheadM > sightM && i.aheadM <= stopM * 1.5;
    const vSafe = Number.isFinite(sightM) ? maxSpeedToStopWithin({ distM: sightM, reactS: policy.reactS, decelMs2: avail, marginM: policy.marginM }) : null;
    return { ...i, dracMs2: Number.isFinite(drac) ? +drac.toFixed(2) : null, cannotStop: !Number.isFinite(drac) || drac >= avail, urgency, hidden, adviseMaxKmh: hidden && vSafe != null ? Math.floor(vSafe * 3.6) : null };
  });
}

/** Frase de conducción según urgencia (complementa la megafonía; nunca ordena maniobras peligrosas). */
export function urgencyPhrase(u, lang) {
  const T = {
    es: { IMMINENT: 'Frena ya', BRAKE: 'Frena', PREPARE: 'Prepárate para frenar', HIDDEN: 'Peligro oculto tras la curva: reduce' },
    en: { IMMINENT: 'Brake now', BRAKE: 'Brake', PREPARE: 'Prepare to brake', HIDDEN: 'Hidden hazard beyond the bend: slow down' },
    nl: { IMMINENT: 'Rem nu', BRAKE: 'Remmen', PREPARE: 'Bereid je voor om te remmen', HIDDEN: 'Verborgen gevaar na de bocht: rem af' },
  }[lang] ?? null;
  if (!T) throw new Error('urgencyPhrase: idioma no soportado');
  if (u.urgency === 'IMMINENT' || u.urgency === 'BRAKE') return T[u.urgency];
  if (u.hidden) return `${T.HIDDEN}${u.adviseMaxKmh != null ? ` (≤ ${u.adviseMaxKmh} km/h)` : ''}`;
  return u.urgency === 'PREPARE' ? T.PREPARE : null;
}
