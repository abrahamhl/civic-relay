/**
 * SENDA · estimaciones hidrológicas cuando NO hay dato medido.
 *
 * Regla: nunca se presenta una estimación como medida. Se calculan varios métodos publicados a la vez, cada
 * uno con su fuente, su rango de validez y su resultado, y se muestra el abanico (mínimo–máximo). Si llega un
 * dato medido (conector), sustituye a la estimación (`pickBest`).
 *
 * Métodos:
 *  - Témez, en la Norma 5.2-IC «Drenaje superficial» (Orden FOM/298/2016, BOE-A-2016-2405, apdo. 2.2.2.5):
 *    tc = 0,3 · Lc^0,76 · Jc^−0,19   [h; Lc en km; Jc pendiente media del cauce, adimensional]. Cuencas principales;
 *    no aplica si tc ≤ 0,25 h.
 *  - Kirpich (1940), «Time of concentration of small agricultural watersheds», Civil Engineering 10(6):362;
 *    forma SI según el manual de hidrología de TxDOT (cap. 4, secc. 11): tc = 0,0195 · L^0,77 · S^−0,385 [min; L en m].
 *    Desarrollada para cuencas agrícolas pequeñas: fuera de su rango en cuencas de cientos de km².
 *  - Velocidad media de recorrido v = L / tc (definición de tiempo de concentración).
 *  - Dato observado externo (p. ej. 14 m/s del CEDEX en Chiva) cuando el operador lo elige.
 */

/** Pendiente media de un tramo (adimensional) a partir de cotas de inicio y fin y su longitud. */
export function meanSlope(zStartM, zEndM, lengthM) {
  if (![zStartM, zEndM, lengthM].every(Number.isFinite) || lengthM <= 0) return NaN;
  return Math.max(0, zStartM - zEndM) / lengthM;
}

/** Témez (Norma 5.2-IC): horas. NaN si faltan datos o pendiente nula. */
export function temezHours(lengthKm, slope) {
  if (!(lengthKm > 0) || !(slope > 0)) return NaN;
  return 0.3 * lengthKm ** 0.76 * slope ** -0.19;
}

/** Kirpich (SI): minutos. */
export function kirpichMinutes(lengthM, slope) {
  if (!(lengthM > 0) || !(slope > 0)) return NaN;
  return 0.0195 * lengthM ** 0.77 * slope ** -0.385;
}

/**
 * Conjunto de métodos para la velocidad media de recorrido de un tramo. Devuelve filas con su fuente y validez.
 * observed: [{ id, label, velocityMs, source }] velocidades observadas por terceros (opcionales).
 */
export function velocityEnsemble({ lengthM, slope, observed = [] }) {
  const rows = [];
  const tT = temezHours(lengthM / 1000, slope);
  rows.push({ id: 'temez', label: 'Témez (Norma 5.2-IC)', basis: 'ESTIMACION', tcMin: tT * 60, velocityMs: lengthM / (tT * 3600),
    source: 'Orden FOM/298/2016, Norma 5.2-IC, apdo. 2.2.2.5 (BOE-A-2016-2405)', validity: tT > 0.25 ? 'dentro de su ámbito (cuenca principal, tc > 0,25 h)' : 'fuera de su ámbito (tc ≤ 0,25 h)' });
  const tK = kirpichMinutes(lengthM, slope);
  rows.push({ id: 'kirpich', label: 'Kirpich (1940)', basis: 'ESTIMACION', tcMin: tK, velocityMs: lengthM / (tK * 60),
    source: 'Kirpich (1940), Civil Engineering 10(6); forma SI del manual de hidrología de TxDOT', validity: lengthM > 5000 ? 'fuera de su ámbito (cuencas agrícolas pequeñas)' : 'dentro de su ámbito' });
  for (const o of observed) rows.push({ id: o.id, label: o.label, basis: 'OBSERVADO_EXTERNO', tcMin: lengthM / o.velocityMs / 60, velocityMs: o.velocityMs, source: o.source, validity: 'dato de un episodio concreto; aplicarlo a todo el tramo es una suposición' });
  return rows.filter((r) => Number.isFinite(r.velocityMs) && r.velocityMs > 0);
}

/** Abanico de llegada (min) a una distancia dada para un conjunto de velocidades. */
export function arrivalBand(distM, rows) {
  const t = rows.map((r) => distM / r.velocityMs / 60).filter(Number.isFinite);
  if (!t.length) return null;
  return { minMin: Math.min(...t), maxMin: Math.max(...t), n: t.length };
}

/**
 * Elige el mejor dato disponible: medido (conector) > observado externo > estimación. Devuelve el elegido y por qué.
 * candidates: [{ basis: 'MEDIDO'|'OBSERVADO_EXTERNO'|'ESTIMACION', value, ... }]
 */
export function pickBest(candidates) {
  const rank = { MEDIDO: 0, OBSERVADO_EXTERNO: 1, ESTIMACION: 2 };
  const ok = candidates.filter((c) => Number.isFinite(c.value) && c.basis in rank).sort((a, b) => rank[a.basis] - rank[b.basis]);
  return ok.length ? { ...ok[0], why: { MEDIDO: 'hay dato medido conectado', OBSERVADO_EXTERNO: 'no hay medida propia; se usa el dato observado publicado', ESTIMACION: 'no hay dato medido: estimación por métodos publicados' }[ok[0].basis] } : null;
}
