// @ts-check
/**
 * SENDA · motor de prevención de avenidas (base): camino del agua aguas abajo, tiempo de llegada,
 * nivel de aviso por caudal y antelación entre sucesos de una cronología con fuente.
 *
 * Regla de la casa (CLAUDE.md): ningún umbral ni velocidad lleva valor por defecto. Quien llama los pasa
 * con su fuente (p. ej. umbral de aviso de la CHJ, capacidad del encauzamiento, velocidad del CEDEX) o como
 * ESCENARIO declarado. Sin ellos, la función devuelve «no medido» en vez de inventar.
 *
 * Camino: direcciones D8 (O'Callaghan y Mark, 1984) sobre una malla; longitud de paso 1 o √2 celdas.
 * Tiempo de llegada: t = L / v con v constante a lo largo del camino (aproximación cinemática declarada;
 * la celeridad real de una avenida cambia con la sección y la pendiente).
 */
import { DI, DJ } from './flood-science.mjs';

/**
 * Sigue el agua desde la celda k0 hasta una salida. dirAt(k) → 0–7, o 15/255 = salida.
 * Devuelve { cells, distM } con la distancia acumulada (m) al llegar a cada celda.
 */
export function downstreamPath(dirAt, w, h, k0, cellM, maxSteps = 1e6) {
  const cells = [k0], distM = [0], seen = new Set([k0]); let k = k0, d0 = 0;
  for (let s = 0; s < maxSteps; s++) {
    const d = dirAt(k); if (d > 7) break;
    const i = (k % w) + DI[d], j = ((k / w) | 0) + DJ[d]; if (i < 0 || j < 0 || i >= w || j >= h) break;
    const n = j * w + i; if (seen.has(n)) break; // protección frente a ciclos (no debería haberlos tras el relleno)
    d0 += (d % 2 ? Math.SQRT2 : 1) * cellM; cells.push(n); distM.push(d0); seen.add(n); k = n;
  }
  return { cells, distM };
}

/** Punto del camino más cercano a la celda objetivo (para medir de A a B cuando B no cae justo en el cauce). */
export function closestOnPath(path, w, target) {
  const ti = target % w, tj = (target / w) | 0; let best = { idx: -1, offCells: Infinity };
  path.cells.forEach((k, idx) => { const d = Math.hypot((k % w) - ti, ((k / w) | 0) - tj); if (d < best.offCells) best = { idx, offCells: d }; });
  return { ...best, distM: best.idx >= 0 ? path.distM[best.idx] : NaN };
}

/** Minutos para recorrer distM a velocityMs. Sin velocidad → null («no medido»). */
export function travelMinutes(distM, velocityMs) {
  if (!(velocityMs > 0) || !Number.isFinite(distM)) return null;
  return distM / velocityMs / 60;
}

/** Posición del frente a los tMin minutos de salir: índice del camino alcanzado (−1 si aún no sale). */
export function frontIndex(path, velocityMs, tMin) {
  if (!(velocityMs > 0) || tMin < 0) return -1;
  const L = velocityMs * tMin * 60; let lo = 0, hi = path.distM.length - 1;
  if (L >= path.distM[hi]) return hi;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (path.distM[mid] <= L) lo = mid; else hi = mid - 1; }
  return lo;
}

/**
 * Nivel de aviso por caudal. Los umbrales se pasan con su fuente; si falta alguno, ese tramo es «no medido».
 *   q < aviso → 'normal' · aviso ≤ q < capacidad → 'aviso' · q ≥ capacidad → 'desbordamiento'
 * @param {number} q
 * @param {{ avisoM3s?: number, capacidadM3s?: number }} [thresholds]
 */
export function flowLevel(q, { avisoM3s, capacidadM3s } = {}) {
  if (!Number.isFinite(q)) return { level: 'sin_dato', label: 'sin dato' };
  if (Number.isFinite(capacidadM3s) && q >= capacidadM3s) return { level: 'desbordamiento', label: `por encima de la capacidad del cauce (${capacidadM3s} m³/s)`, ratio: q / capacidadM3s };
  if (Number.isFinite(avisoM3s) && q >= avisoM3s) return { level: 'aviso', label: `por encima del umbral de aviso (${avisoM3s} m³/s)`, ratio: q / avisoM3s };
  if (!Number.isFinite(avisoM3s)) return { level: 'no_medido', label: 'umbral de aviso no aportado' };
  return { level: 'normal', label: 'por debajo del umbral de aviso' };
}

/** Hora local «AAAA-MM-DDTHH:MM» + desfase horario (h) → milisegundos UTC. */
export const localToUtcMs = (local, offsetH) => Date.parse(`${local}:00Z`) - offsetH * 3_600_000;

/**
 * Antelación entre dos sucesos de la cronología (minutos, b − a). Solo con horas publicadas: si alguno no la
 * tiene, devuelve null. Los sucesos aproximados («sobre las 14 h») marcan approx = true.
 */
export function leadMinutes(events, aId, bId, offsetH) {
  const a = events.find((e) => e.id === aId), b = events.find((e) => e.id === bId);
  if (!a?.local || !b?.local) return null;
  const ta = a.utc ? Date.parse(a.utc) : localToUtcMs(a.local, offsetH), tb = b.utc ? Date.parse(b.utc) : localToUtcMs(b.local, offsetH);
  return { minutes: (tb - ta) / 60_000, approx: Boolean(a.aprox || b.aprox) };
}

/** Sucesos ya ocurridos en el instante tMs (con hora), en orden. */
export function eventsUntil(events, tMs, offsetH) {
  return events.filter((e) => e.local).map((e) => ({ ...e, tMs: e.utc ? Date.parse(e.utc) : localToUtcMs(e.local, offsetH) })).filter((e) => e.tMs <= tMs).sort((x, y) => x.tMs - y.tMs);
}
