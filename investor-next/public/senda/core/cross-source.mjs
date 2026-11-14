/**
 * SENDA · Concordancia entre fuentes.
 *
 * Empareja los eventos de dos catálogos que describen el mismo suceso (mismo sitio, mismo momento) y mide en qué
 * se parecen: distancia, diferencia de hora y de magnitud. Sirve para dos cosas:
 *  1. Detectar eventos que solo aparecen en una fuente (huecos de cobertura o errores).
 *  2. Medir la coherencia y el retraso entre catálogos.
 *
 * Veracidad: que dos catálogos coincidan NO prueba nada si uno copia del otro. Por eso cada par de fuentes lleva
 * su relación de dependencia declarada (`SOURCE_DEPENDENCIES`) y el informe dice «concordancia», no «confirmación»,
 * cuando las fuentes no son independientes.
 */
import { haversineM } from './atlas.mjs';

/**
 * Dependencias conocidas entre fuentes, con su referencia. `independent: false` significa que una fuente toma
 * datos de la otra (total o parcialmente).
 */
export const SOURCE_DEPENDENCIES = Object.freeze({
  'GDACS_EQ|USGS': Object.freeze({ independent: false,
    note: 'GDACS toma parámetros sísmicos de USGS NEIC, EMSC, GEOFON y redes asociadas, y usa ShakeMaps de USGS',
    refs: Object.freeze(['https://gdacs.org/Knowledge/models_EQ.aspx', 'https://www.idl.iscram.org/files/degroeve/2006/429_DeGroeve_etal2006.pdf']) }),
});

/** Relación declarada entre dos fuentes (en cualquier orden); `null` si no está declarada (= no verificada). */
export function dependencyOf(a, b) { return SOURCE_DEPENDENCIES[`${a}|${b}`] ?? SOURCE_DEPENDENCIES[`${b}|${a}`] ?? null; }

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Empareja uno a uno los eventos de A y B. Un par es candidato si están a ≤ radiusKm y ≤ windowS segundos.
 * Se elige primero el par de menor coste (distancia/radio + tiempo/ventana), sin reutilizar eventos.
 * Cada evento necesita {t (ms), lat, lon} y, opcionalmente, mag.
 */
export function matchEvents(A, B, { radiusKm = 100, windowS = 120 } = {}) {
  if (!(radiusKm > 0) || !(windowS > 0)) throw new Error('radiusKm y windowS deben ser > 0');
  const cand = [];
  const bs = B.map((b, j) => ({ b, j })).sort((x, y) => x.b.t - y.b.t);
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    let lo = 0, hi = bs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bs[m].b.t < a.t - windowS * 1000) lo = m + 1; else hi = m; }
    for (let k = lo; k < bs.length && bs[k].b.t <= a.t + windowS * 1000; k++) {
      const { b, j } = bs[k], dKm = haversineM(a, b) / 1000; if (dKm > radiusKm) continue;
      const dtS = (b.t - a.t) / 1000; cand.push({ i, j, dKm, dtS, cost: dKm / radiusKm + Math.abs(dtS) / windowS });
    }
  }
  cand.sort((x, y) => x.cost - y.cost);
  const usedA = new Set(), usedB = new Set(), pairs = [];
  for (const c of cand) { if (usedA.has(c.i) || usedB.has(c.j)) continue; usedA.add(c.i); usedB.add(c.j);
    const a = A[c.i], b = B[c.j]; pairs.push({ a, b, dKm: c.dKm, dtS: c.dtS, dMag: Number.isFinite(a.mag) && Number.isFinite(b.mag) ? b.mag - a.mag : null }); }
  return { pairs, onlyA: A.filter((_, i) => !usedA.has(i)), onlyB: B.filter((_, j) => !usedB.has(j)) };
}

/**
 * Informe de concordancia. nameA/nameB identifican las fuentes para buscar su dependencia declarada.
 * Solo cuenta los eventos de B dentro de la ventana temporal común (para no penalizar a una fuente por cubrir más días).
 */
export function concordance(A, B, { nameA, nameB, radiusKm = 100, windowS = 120 } = {}) {
  const t0 = Math.max(Math.min(...A.map((e) => e.t)), Math.min(...B.map((e) => e.t))), t1 = Math.min(Math.max(...A.map((e) => e.t)), Math.max(...B.map((e) => e.t)));
  const inWin = (e) => e.t >= t0 && e.t <= t1, a = A.filter(inWin), b = B.filter(inWin);
  const { pairs, onlyA, onlyB } = matchEvents(a, b, { radiusKm, windowS });
  const dep = dependencyOf(nameA, nameB);
  const r = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
  return {
    sources: [nameA, nameB], window: { from: new Date(t0).toISOString(), to: new Date(t1).toISOString() }, params: { radiusKm, windowS },
    countA: a.length, countB: b.length, matched: pairs.length,
    shareA: a.length ? r(pairs.length / a.length, 3) : null, shareB: b.length ? r(pairs.length / b.length, 3) : null,
    medianKm: r(median(pairs.map((p) => p.dKm))), medianAbsS: r(median(pairs.map((p) => Math.abs(p.dtS)))),
    medianAbsMag: r(median(pairs.filter((p) => p.dMag != null).map((p) => Math.abs(p.dMag))), 2),
    onlyA, onlyB, pairs,
    independence: dep ? (dep.independent ? 'INDEPENDENT' : 'DEPENDENT') : 'NOT_VERIFIED', dependency: dep,
    verdictWord: dep?.independent ? 'confirmación independiente' : 'concordancia (no es confirmación independiente)',
  };
}
