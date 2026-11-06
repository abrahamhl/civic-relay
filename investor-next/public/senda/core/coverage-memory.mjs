/**
 * SENDA · Memoria de cobertura y puntos de rebote: ¿adónde ir para que salga el mensaje?
 *
 * Mientras hay red, cada móvil con SENDA anota en segundo plano (con consentimiento) DÓNDE tuvo señal y
 * cuánta: «huellas de cobertura». Se comparten con los vecinos en la reserva. Al cortarse la red, la
 * app cruza esas huellas con el mapa de antenas (datos abiertos de OpenCellID) y con cuánto aguanta cada
 * antena sin luz (modelo de supervivencia de `blackout.mjs`), y calcula para cada punto cercano:
 *   P(cobertura ahora) = 1 − Π_antenas (1 − viva · alcance)
 * agrupando las huellas por antena (no son independientes) y con P_señal logística en dBm. Una huella tomada DESPUÉS del corte vale más (es evidencia directa).
 * Después estima cuánto se tarda en llegar andando con la función de senderismo de Tobler
 * (v = 6·e^(−3,5·|pendiente + 0,05|) km/h) y elige la opción con menor TIEMPO ESPERADO hasta enviar,
 * contando con la alternativa (el próximo satélite útil) si allí tampoco hay señal:
 *   E[T] = t_andar + (1 − P) · t_alternativa.
 * Los puntos de rebote pueden ser cimas, hospitales con grupo electrógeno, pasarelas LoRa o el vecino
 * con Wi-Fi que aún tiene salida. Todo PASIVO: no se interroga ninguna antena, solo se recuerda.
 */
import { survival, BACKUP, distM } from './blackout.mjs';

export const pSignal = (dbm) => 1 / (1 + Math.exp(-(dbm + 108) / 5));
/** Velocidad a pie (km/h) con la función de Tobler; pendiente = desnivel/distancia. */
export const toblerKmh = (slope) => 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
export function walkMin(from, to) { const d = distM(from, to), dh = (to.altM ?? 0) - (from.altM ?? 0); return d < 1 ? 0 : ((d / 1000) / toblerKmh(dh / d)) * 60; }

/**
 * Probabilidad de cobertura ahora en un punto, a partir de las huellas cercanas.
 * Las huellas de una misma antena NO son independientes (si la antena muere, fallan todas), así que
 * se agrupan por antena: alcance_t = 1 − Π(1 − P_señal·confianza) de sus huellas (máx. 0,98) y
 *   P(cobertura) = 1 − Π_t (1 − viva_t · alcance_t),  viva_t = S(ahora)/S(momento de la huella).
 * @param {{lat,lon}} at · @param {Array<{lat,lon,dbm,tH,towerId?}>} prints · tH: horas desde el corte (negativo = antes)
 */
export function coverageAt(at, prints, towers, nowH, { radiusM = 250 } = {}) {
  const byId = new Map(towers.map((t) => [t.id, t])), per = new Map(); let used = 0;
  for (const p of prints) {
    if (distM(at, p) > radiusM) continue; used++;
    const id = p.towerId ?? '?', back = BACKUP[byId.get(id)?.backup ?? 'BATTERY'];
    const alive = Math.min(1, survival(nowH, back) / Math.max(p.tH > 0 ? survival(p.tH, back) : 1, 1e-6));
    const conf = p.tH > 0 ? 0.95 : 0.8; // una huella posterior al corte es evidencia directa
    const g = per.get(id) ?? { miss: 1, alive: 0 }; g.miss *= 1 - pSignal(p.dbm) * conf; g.alive = Math.max(g.alive, alive); per.set(id, g);
  }
  let none = 1; for (const g of per.values()) none *= 1 - g.alive * Math.min(0.98, 1 - g.miss);
  return { p: 1 - none, prints: used, towers: per.size };
}

/**
 * Mejor opción para enviar: ir a un punto de rebote o esperar al satélite donde estás.
 * @param {{lat,lon,altM}} me · @param {Array<{id,name,lat,lon,altM}>} candidates
 * @param {{waitMin:number, p:number}} sat  próximo satélite útil (minutos y probabilidad con tu vista del cielo)
 */
export function bestEscape({ me, candidates, prints, towers, nowH, sat }) {
  const tAlt = sat.waitMin / Math.max(sat.p, 0.05);
  const opts = candidates.map((c) => { const cov = coverageAt(c, prints, towers, nowH), w = walkMin(me, c); return { id: c.id, name: c.name, p: +cov.p.toFixed(3), prints: cov.prints, walkMin: +w.toFixed(1), expectedMin: +(w + (1 - cov.p) * tAlt).toFixed(1) }; });
  opts.push({ id: 'sat', name: 'Esperar al satélite aquí', p: sat.p, prints: 0, walkMin: 0, expectedMin: +tAlt.toFixed(1) });
  opts.sort((a, b) => a.expectedMin - b.expectedMin);
  return { best: opts[0], options: opts };
}

/**
 * Escenario sintético: pueblo en un valle 5 h después de un apagón. Una antena en la sierra tiene grupo
 * electrógeno; las del pueblo, baterías estándar. Huellas de 60 vecinos antes del corte y algunas después.
 */
export function reboteScenario({ seed = 5, nowH = 5 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = { lat: 40.25, lon: -3.9 }, P = (dx, dy, altM) => ({ lat: o.lat + dy / 111320, lon: o.lon + dx / (111320 * Math.cos((o.lat * Math.PI) / 180)), altM });
  const towers = [{ id: 'T1', ...P(-300, 200, 640), backup: 'BATTERY' }, { id: 'T2', ...P(500, -250, 650), backup: 'BATTERY' }, { id: 'T3', ...P(1800, 1500, 1020), backup: 'GENERATOR' }, { id: 'T4', ...P(-1500, -900, 700), backup: 'EXTENDED' }];
  const candidates = [
    { id: 'plaza', name: 'Plaza del pueblo', ...P(0, 0, 630) },
    { id: 'ermita', name: 'Cerro de la ermita', ...P(1200, 1100, 910) },
    { id: 'centro-salud', name: 'Centro de salud (antena con baterías ampliadas)', ...P(-1300, -700, 690) },
    { id: 'puente', name: 'Puente del río', ...P(600, -600, 600) },
  ];
  const near = (c, n, spread) => Array.from({ length: n }, () => ({ lat: c.lat + ((R() - 0.5) * spread) / 111320, lon: c.lon + ((R() - 0.5) * spread) / 85000 }));
  const prints = [];
  // antes del corte (tH < 0): señal desde el pueblo con T1/T2, desde la ermita con T3, desde el centro de salud con T4
  for (const p of near(candidates[0], 25, 200)) prints.push({ ...p, dbm: -80 - R() * 10, tH: -(1 + R() * 48), towerId: R() < 0.5 ? 'T1' : 'T2' });
  for (const p of near(candidates[1], 8, 200)) prints.push({ ...p, dbm: -98 - R() * 6, tH: -(1 + R() * 48), towerId: 'T3' });
  for (const p of near(candidates[2], 10, 200)) prints.push({ ...p, dbm: -90 - R() * 8, tH: -(1 + R() * 48), towerId: 'T4' });
  for (const p of near(candidates[3], 6, 200)) prints.push({ ...p, dbm: -112 - R() * 6, tH: -(1 + R() * 48), towerId: 'T2' });
  // después del corte: dos vecinos que subieron a la ermita hace 1 h tuvieron señal
  for (const p of near(candidates[1], 2, 120)) prints.push({ ...p, dbm: -101, tH: nowH - 1, towerId: 'T3' });
  return { me: { ...P(-100, -50, 625), id: 'yo' }, towers, candidates, prints, nowH, sat: { waitMin: 38, p: 0.6 } };
}
