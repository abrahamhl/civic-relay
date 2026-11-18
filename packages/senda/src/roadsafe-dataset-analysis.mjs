/**
 * SENDA RoadSafe · Análisis del dataset armonizado: tasas condicionadas, odds ratios, puntos negros con
 * Bayes empírico, factores empíricos para calibrar el modelo de riesgo y casos similares (apoyo forense).
 *
 * Reglas estadísticas:
 *  - Toda proporción lleva intervalo de Wilson 95 %; todo OR lleva IC de Woolf (corrección de Haldane 0,5 si hay ceros).
 *  - Los datos son de accidentes OCURRIDOS: P(mortal | condición, accidente) no es riesgo de accidente por km
 *    (falta la exposición). Se etiqueta como «gravedad condicionada», no como probabilidad de accidentarse.
 *  - Puntos negros: estimador de Bayes empírico Poisson–Gamma (método de momentos) para corregir la regresión
 *    a la media; el ranking usa el valor esperado a posteriori, no el conteo bruto.
 */
import { wilson } from './roadsafe-secondary-risk.mjs';

const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

/** Filtro común: con víctimas (excluye PDO y UNKNOWN) para comparar países. */
export const injuryOnly = (r) => ['FATAL', 'SERIOUS', 'SLIGHT', 'INJURY'].includes(r.severity);

/** Tabla de conteos por una o dos dimensiones. */
export function crosstab(records, keyA, keyB = null) {
  const T = new Map();
  for (const r of records) { const a = typeof keyA === 'function' ? keyA(r) : r[keyA]; const b = keyB ? (typeof keyB === 'function' ? keyB(r) : r[keyB]) : '_'; const k = `${a}|${b}`; T.set(k, (T.get(k) ?? 0) + 1); }
  return [...T].map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, n }; }).sort((x, y) => y.n - x.n);
}

/** Proporción condicionada P(outcome | group) con IC de Wilson. */
export function conditionalShare(records, groupKey, outcome, { minN = 30 } = {}) {
  const G = new Map();
  for (const r of records) { const g = typeof groupKey === 'function' ? groupKey(r) : r[groupKey]; const s = G.get(g) ?? { n: 0, k: 0 }; s.n++; if (outcome(r)) s.k++; G.set(g, s); }
  return [...G].filter(([, s]) => s.n >= minN).map(([g, s]) => ({ group: g, n: s.n, k: s.k, p: +(s.k / s.n).toFixed(4), ci: wilson(s.k, s.n) })).sort((a, b) => b.p - a.p);
}

/** Odds ratio de `outcome` entre expuestos y no expuestos, con IC 95 % de Woolf. */
export function oddsRatio(records, exposed, outcome, { filter = () => true } = {}) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const r of records) { if (!filter(r)) continue; const e = exposed(r); if (e === null) continue; const o = outcome(r); if (e && o) a++; else if (e) b++; else if (o) c++; else d++; }
  const z = [a, b, c, d].some((x) => x === 0) ? 0.5 : 0;
  const A = a + z, B = b + z, C = c + z, D = d + z, or = (A * D) / (B * C), se = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);
  return { table: { a, b, c, d }, or: +or.toFixed(3), ci: [+Math.exp(Math.log(or) - 1.96 * se).toFixed(3), +Math.exp(Math.log(or) + 1.96 * se).toFixed(3)], n: a + b + c + d, significant: Math.exp(Math.log(or) - 1.96 * se) > 1 || Math.exp(Math.log(or) + 1.96 * se) < 1 };
}

/**
 * Puntos negros con Bayes empírico. `cellOf(r)` devuelve la clave de celda (rejilla o tramo carretera+PK).
 * Peso por gravedad configurable (EPDO simplificado; pesos HIPOTÉTICOS declarados).
 */
export function hotspotsEB(records, cellOf, { weights = { FATAL: 10, SERIOUS: 5, INJURY: 2, SLIGHT: 1, PDO: 0.2, UNKNOWN: 1 }, top = 20, minCount = 3 } = {}) {
  const C = new Map();
  for (const r of records) { const k = cellOf(r); if (k == null) continue; const c = C.get(k) ?? { n: 0, w: 0, fatal: 0, lat: 0, lon: 0, coords: 0 }; c.n++; c.w += weights[r.severity] ?? 1; if (r.severity === 'FATAL') c.fatal++; if (r.lat != null) { c.lat += r.lat; c.lon += r.lon; c.coords++; } C.set(k, c); }
  const cells = [...C.values()], m = cells.reduce((s, c) => s + c.n, 0) / (cells.length || 1), v = cells.reduce((s, c) => s + (c.n - m) ** 2, 0) / Math.max(1, cells.length - 1);
  // Poisson–Gamma por momentos: si v ≤ m no hay sobredispersión ⇒ sin contracción efectiva
  const alpha = v > m ? (m * m) / (v - m) : Infinity, beta = v > m ? m / (v - m) : Infinity;
  const rows = [...C].filter(([, c]) => c.n >= minCount).map(([k, c]) => {
    const post = Number.isFinite(alpha) ? (alpha + c.n) / (beta + 1) : c.n;
    return { cell: k, count: c.n, fatal: c.fatal, severityWeighted: +c.w.toFixed(1), ebExpected: +post.toFixed(2), shrinkage: +(1 - post / c.n).toFixed(3), centroid: c.coords ? { lat: +(c.lat / c.coords).toFixed(5), lon: +(c.lon / c.coords).toFixed(5) } : null };
  }).sort((a, b) => b.ebExpected - a.ebExpected || b.severityWeighted - a.severityWeighted);
  return { cells: cells.length, meanPerCell: +m.toFixed(3), variance: +v.toFixed(3), prior: Number.isFinite(alpha) ? { alpha: +alpha.toFixed(3), beta: +beta.toFixed(3) } : null, top: rows.slice(0, top) };
}
export const gridCell = (deg = 0.01) => (r) => (r.lat == null ? null : `${(Math.floor(r.lat / deg) * deg).toFixed(2)},${(Math.floor(r.lon / deg) * deg).toFixed(2)}`);
export const roadKmCell = (kmBin = 1) => (r) => (r.road && r.km != null ? `${r.road}@${Math.floor(r.km / kmBin) * kmBin}` : null);

/**
 * Factores empíricos para contrastar el modelo de riesgo (roadsafe-risk-factors.mjs):
 * OR de accidente MORTAL entre accidentes con víctimas, por condición. Gravedad condicionada, no frecuencia.
 */
export function empiricalSeverityFactors(records) {
  const inj = records.filter(injuryOnly), fatal = (r) => r.severity === 'FATAL';
  const known = (k, bad) => (r) => (r[k] === 'UNKNOWN' ? null : bad(r));
  return {
    n: inj.length, fatal: inj.filter(fatal).length,
    darkVsDay: oddsRatio(inj, known('light', (r) => r.light.startsWith('DARK')), fatal, { filter: (r) => r.light !== 'TWILIGHT' }),
    darkUnlitVsLit: oddsRatio(inj, (r) => (r.light === 'DARK_UNLIT' ? true : r.light === 'DARK_LIT' ? false : null), fatal),
    wetVsDry: oddsRatio(inj, (r) => (r.surface === 'WET' ? true : r.surface === 'DRY' ? false : null), fatal),
    fogVsClear: oddsRatio(inj, (r) => (r.weather === 'FOG' ? true : r.weather === 'CLEAR' ? false : null), fatal),
    rearEndOrStationaryVsOther: oddsRatio(inj, (r) => (r.collision === 'UNKNOWN' ? null : ['REAR_END', 'STATIONARY_VEHICLE', 'MULTI_VEHICLE_CHAIN'].includes(r.collision)), fatal),
    ruralVsUrban: oddsRatio(inj, (r) => (r.area === 'RURAL' ? true : r.area === 'URBAN' ? false : null), fatal),
    pedestrianInvolved: oddsRatio(inj, (r) => (r.collision === 'UNKNOWN' ? null : r.collision === 'PEDESTRIAN' || r.involves?.pedestrian === true), fatal),
    curveVsStraight: oddsRatio(inj, (r) => r.curve, fatal),
    visibilityByVehicle: oddsRatio(inj, (r) => r.visibilityRestrictedByVehicle, fatal),
    interpretation: 'OR > 1: entre accidentes con víctimas, la condición se asocia a mayor proporción de mortales. No mide frecuencia (sin exposición) ni causalidad.',
  };
}

/** Perfil de accidentes relevantes para RoadSafe (alcances, vehículo detenido, cadenas, secundarios declarados). */
export function roadsafeProfile(records) {
  const inj = records.filter(injuryOnly), n = inj.length || 1;
  const share = (f) => { const k = inj.filter(f).length; return { k, p: +(k / n).toFixed(4), ci: wilson(k, n) }; };
  const all = records.length || 1;
  return {
    nInjury: inj.length, nAll: records.length,
    rearEnd: share((r) => r.collision === 'REAR_END'), stationaryVehicle: share((r) => r.collision === 'STATIONARY_VEHICLE'), chain: share((r) => r.collision === 'MULTI_VEHICLE_CHAIN'),
    visibilityRestrictedByVehicle: share((r) => r.visibilityRestrictedByVehicle === true),
    secondaryOtherAccident: { k: records.filter((r) => r.secondaryIndicator === 'OTHER_ACCIDENT').length, p: +(records.filter((r) => r.secondaryIndicator === 'OTHER_ACCIDENT').length / all).toFixed(5), basis: 'todos los registros (incluye PDO si la fuente los tiene); registro policial, probable infraregistro' },
    queueIndicator: records.filter((r) => r.secondaryIndicator === 'QUEUE').length,
    byLightRearStationary: conditionalShare(inj.filter((r) => ['REAR_END', 'STATIONARY_VEHICLE', 'MULTI_VEHICLE_CHAIN'].includes(r.collision)), 'light', (r) => r.severity === 'FATAL', { minN: 50 }),
    byHourRearStationary: crosstab(inj.filter((r) => ['REAR_END', 'STATIONARY_VEHICLE', 'MULTI_VEHICLE_CHAIN'].includes(r.collision) && r.hour != null), 'hour').map((x) => ({ hour: +x.a, n: x.n })).sort((a, b) => a.hour - b.hour),
  };
}

/**
 * Casos similares (apoyo forense/estudio): k vecinos por similitud de circunstancias y cercanía.
 * Devuelve SIEMPRE casos agregados del registro público (sin datos personales; las fuentes no los contienen).
 */
export function similarCases(records, query, { k = 10, radiusM = 5000 } = {}) {
  const feats = ['collision', 'light', 'surface', 'roadClass', 'area', 'weather'];
  const scored = [];
  for (const r of records) {
    let s = 0, w = 0;
    for (const f of feats) if (query[f] && query[f] !== 'UNKNOWN') { w++; if (r[f] === query[f]) s++; }
    let geo = null;
    if (query.lat != null && r.lat != null) { geo = distM(query, r); if (geo > radiusM) continue; s += 1 - geo / radiusM; w++; }
    else if (query.road && r.road === query.road && query.km != null && r.km != null) { const d = Math.abs(r.km - query.km); if (d > radiusM / 1000) continue; s += 1 - d / (radiusM / 1000); w++; }
    if (w) scored.push({ score: +(s / w).toFixed(3), distanceM: geo == null ? null : Math.round(geo), record: r });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
