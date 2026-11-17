/**
 * SENDA · Dron casa por casa: planificar el barrido de un barrio y convertirlo en un tablero de prioridad.
 *
 * Tras un terremoto o una riada hay decenas de edificios y pocos drones. El planificador:
 *  1. Ordena las casas para volar lo mínimo (vecino más cercano + mejora 2-opt).
 *  2. Parte la ruta en salidas que respetan la autonomía con reserva (cambio de batería en la base).
 *  3. En cada casa: anillo de fachada por plantas, escucha Bluetooth (censo por planta) y pasada térmica.
 *  4. Tablero: personas probables (intervalo bayesiano de `rf-census.mjs`) × daño (escala EMS-98)
 *     → orden de prioridad para los equipos de tierra.
 * Todo determinista. El escenario es SINTÉTICO; el daño EMS-98 lo asigna una persona experta (o un
 * modelo validado en el futuro), no se inventa desde el aire.
 */
import { peopleFromPhones } from './rf-census.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Orden de visita desde la base (abierto, vuelve a base al final): vecino más cercano + 2-opt. */
export function orderHouses(houses, base) {
  const left = [...houses], order = []; let cur = base;
  while (left.length) { let k = 0; for (let i = 1; i < left.length; i++) if (dist(cur, left[i]) < dist(cur, left[k])) k = i; cur = left.splice(k, 1)[0]; order.push(cur); }
  const len = (o) => o.reduce((s, h, i) => s + dist(i ? o[i - 1] : base, h), 0) + (o.length ? dist(o[o.length - 1], base) : 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) for (let j = i + 1; j < order.length; j++) {
      const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
      if (len(cand) < len(order) - 1e-9) { order.splice(0, order.length, ...cand); improved = true; }
    }
  }
  return { order, lengthM: len(order) };
}

/** Tiempo de trabajo en una casa: anillos por planta + escucha + pasada térmica. */
export const taskS = (h, { perFloorS = 40, overheadS = 30 } = {}) => overheadS + perFloorS * h.floors;

/**
 * Plan completo con salidas por batería.
 * @returns {{sorties:Array<{houses:string[], timeS:number, distM:number}>, totalS:number, order:string[], etaS:Object}}
 */
export function planSweep(houses, { base = { x: 0, y: 0 }, speedMs = 10, enduranceMin = 25, reserve = 0.2, swapS = 180, perFloorS = 40, overheadS = 30 } = {}) {
  const { order } = orderHouses(houses, base), usable = enduranceMin * 60 * (1 - reserve), sorties = [], etaS = {};
  let cur = { houses: [], timeS: 0, distM: 0, at: base }, clock = 0;
  for (const h of order) {
    const go = dist(cur.at, h) / speedMs, work = taskS(h, { perFloorS, overheadS }), back = dist(h, base) / speedMs;
    if (cur.houses.length && cur.timeS + go + work + back > usable) {
      const ret = dist(cur.at, base) / speedMs; cur.timeS += ret; cur.distM += dist(cur.at, base); clock += ret + swapS; sorties.push(cur);
      cur = { houses: [], timeS: 0, distM: 0, at: base };
    }
    const g = dist(cur.at, h) / speedMs; cur.timeS += g + work; cur.distM += dist(cur.at, h); clock += g; etaS[h.id] = Math.round(clock); clock += work; cur.houses.push(h.id); cur.at = h;
  }
  if (cur.houses.length) { const ret = dist(cur.at, base) / speedMs; cur.timeS += ret; cur.distM += dist(cur.at, base); clock += ret; sorties.push(cur); }
  return { sorties: sorties.map(({ at, ...s }) => ({ ...s, timeS: Math.round(s.timeS), distM: Math.round(s.distM) })), totalS: Math.round(clock), order: order.map((h) => h.id), etaS, usableS: usable };
}

const DAMAGE_W = [0, 0.1, 0.25, 0.6, 0.9, 1]; // grado EMS-98 0–5 → peso de urgencia
/** Tablero de prioridad: personas probables × daño; la térmica sube la confianza. */
export function sweepBoard(houses) {
  return houses.map((h) => {
    const pp = peopleFromPhones(h.phones), thermalBoost = h.thermal ? 1.25 : 1;
    const score = (pp.mid + (h.phones === 0 && h.thermal ? 1 : 0)) * DAMAGE_W[h.damage] * thermalBoost;
    return { id: h.id, floors: h.floors, damage: h.damage, phones: h.phones, people: { lo: pp.lo, mid: pp.mid, hi: pp.hi }, thermal: h.thermal, score: +score.toFixed(2) };
  }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

/** Barrio sintético: 24 edificios en cuadrícula, daño y ocupación pseudoaleatorios deterministas. */
export function sweepScenario({ seed = 4, cols = 6, rows = 4, spacingM = 45 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const houses = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const floors = 1 + Math.floor(R() * 5), damage = Math.min(5, Math.floor(R() * 6)), people = Math.floor(R() * (3 * floors + 1));
    let phones = 0; for (let k = 0; k < people; k++) { const u = R(); phones += u < 0.12 ? 0 : u < 0.2 ? 2 : 1; }
    houses.push({ id: `${String.fromCharCode(65 + r)}${c + 1}`, x: 60 + c * spacingM + (R() - 0.5) * 8, y: 40 + r * spacingM + (R() - 0.5) * 8, floors, damage, people, phones, thermal: people > 0 && R() < 0.55 + 0.08 * damage });
  }
  return { base: { x: 10, y: 10 }, houses };
}
