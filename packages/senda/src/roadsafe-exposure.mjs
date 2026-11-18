/**
 * SENDA RoadSafe · Exposición: de «gravedad condicionada» a TASAS por vehículo-km (frecuencia real).
 *
 * Hueco cerrado: sin tráfico circulante no se puede decir dónde o cuándo es más probable accidentarse.
 * Gran Bretaña publica la intensidad media diaria anual (AADF) por punto de conteo y tramo, con su longitud
 * (DfT road traffic statistics, OGL v3). Cruzando cada accidente STATS19 con el tramo aforado de la misma
 * vía se obtiene la exposición E = AADF · 365 · longitud (veh-km/año) y la tasa por 100 M veh-km.
 *
 * Ranking de tramos con Bayes empírico CON EXPOSICIÓN (Poisson–Gamma con desplazamiento): un tramo con
 * mucho tráfico y pocos accidentes no se confunde con uno peligroso, y los tramos con poca exposición se
 * contraen hacia la media (corrige la regresión a la media).
 *
 * Códigos de clase de vía verificados en STATS20 (2024): 1 Motorway, 2 A(M), 3 A, 4 B.
 */
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

/** Nombre de vía STATS19 → nombre AADF (M1, A1(M), A3111, B1234). */
export function stats19RoadName(roadClass, roadNumber) {
  const n = Number(roadNumber); if (!Number.isInteger(n) || n <= 0) return null;
  return { 1: `M${n}`, 2: `A${n}(M)`, 3: `A${n}`, 4: `B${n}` }[Number(roadClass)] ?? null;
}

/** Divide una línea CSV con comillas (sin saltos de línea dentro de campos). */
export function splitCsvLine(line, sep = ',') {
  const out = []; let f = '', q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === sep) { out.push(f); f = ''; } else f += c; }
  out.push(f); return out;
}

/** Tramo aforado desde una fila AADF (solo vías «Major» con longitud de tramo). */
export function aadfLink(row) {
  const len = Number(row.link_length_km), aadf = Number(row.all_motor_vehicles), lat = Number(row.latitude), lon = Number(row.longitude);
  if (row.road_type !== 'Major' || !(len > 0) || !(aadf > 0) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { id: row.count_point_id, road: row.road_name, category: row.road_category, lat, lon, lengthKm: len, aadf, vehKmYear: aadf * 365 * len, hgvShare: Number(row.all_HGVs) > 0 ? +(Number(row.all_HGVs) / aadf).toFixed(3) : null, estimation: row.estimation_method };
}

/**
 * Asigna accidentes a tramos: misma vía y punto de conteo más cercano a menos de longitud/2 + `slackKm`
 * (declarado). Los no asignables se cuentan aparte, nunca se fuerzan.
 */
export function assignToLinks(records, links, { slackKm }) {
  if (!Number.isFinite(slackKm)) throw new Error('assignToLinks exige slackKm declarado');
  const byRoad = new Map(); for (const l of links) { const a = byRoad.get(l.road) ?? []; a.push(l); byRoad.set(l.road, a); }
  const agg = new Map(); let unassigned = 0, noRoad = 0;
  for (const r of records) {
    if (!r.road || r.lat == null) { noRoad++; continue; }
    const cand = byRoad.get(r.road); if (!cand) { unassigned++; continue; }
    let best = null, bd = Infinity; for (const l of cand) { const d = distM(r, l); if (d < bd) { bd = d; best = l; } }
    if (!best || bd > (best.lengthKm / 2 + slackKm) * 1000) { unassigned++; continue; }
    const a = agg.get(best.id) ?? { link: best, n: 0, fatal: 0, ksi: 0, hardShoulder: 0, stopped: 0, dark: 0 };
    a.n++; if (r.severity === 'FATAL') a.fatal++; if (['FATAL', 'SERIOUS'].includes(r.severity)) a.ksi++; if (r.onHardShoulder) a.hardShoulder++; if (r.stoppedVehicleInvolved) a.stopped++; if (r.light?.startsWith('DARK')) a.dark++;
    agg.set(best.id, a);
  }
  return { perLink: [...agg.values()], unassigned, noRoad, assigned: [...agg.values()].reduce((s, a) => s + a.n, 0) };
}

/**
 * Bayes empírico con exposición: k_i ~ Poisson(r_i·E_i), r_i ~ Gamma(α, β). Momentos: m = Σk/ΣE;
 * varianza extra de las tasas = var_w(k/E) − m·media_w(1/E). Posterior r̂_i = (α + k_i)/(β + E_i).
 * E en unidades de 100 M veh-km para leer tasas directamente.
 */
export function rateEB(perLink, { countKey = 'n', minExposure100M = 0 } = {}) {
  const rows = perLink.map((a) => ({ ...a, E: a.link.vehKmYear / 1e8, k: a[countKey] })).filter((a) => a.E > 0);
  const K = rows.reduce((s, a) => s + a.k, 0), Et = rows.reduce((s, a) => s + a.E, 0), m = K / Et;
  const wSum = Et, meanR = rows.reduce((s, a) => s + a.E * (a.k / a.E), 0) / wSum;
  const varR = rows.reduce((s, a) => s + a.E * (a.k / a.E - meanR) ** 2, 0) / wSum, poisson = m * rows.reduce((s, a) => s + a.E * (1 / a.E), 0) / wSum;
  const extra = varR - poisson, alpha = extra > 0 ? (m * m) / extra : Infinity, beta = extra > 0 ? m / extra : Infinity;
  const out = rows.map((a) => ({ id: a.link.id, road: a.link.road, category: a.link.category, lat: a.link.lat, lon: a.link.lon, lengthKm: a.link.lengthKm, aadf: a.link.aadf, exposure100MvehKm: +a.E.toFixed(4), count: a.k, rawRate: +(a.k / a.E).toFixed(2), ebRate: +(Number.isFinite(alpha) ? (alpha + a.k) / (beta + a.E) : a.k / a.E).toFixed(2) }));
  return { meanRatePer100MvehKm: +m.toFixed(2), prior: Number.isFinite(alpha) ? { alpha: +alpha.toFixed(3), beta: +beta.toFixed(4) } : null, links: out.length, top: out.filter((x) => x.exposure100MvehKm >= minExposure100M).sort((a, b) => b.ebRate - a.ebRate).slice(0, 20) };
}

/** Tasas por categoría de vía (veh-km totales de los tramos con accidentes asignados y sin ellos). */
export function ratesByCategory(links, assignment) {
  const E = new Map(), K = new Map(), F = new Map(), HS = new Map();
  for (const l of links) E.set(l.category, (E.get(l.category) ?? 0) + l.vehKmYear / 1e8);
  for (const a of assignment.perLink) { const c = a.link.category; K.set(c, (K.get(c) ?? 0) + a.n); F.set(c, (F.get(c) ?? 0) + a.fatal); HS.set(c, (HS.get(c) ?? 0) + a.hardShoulder); }
  return [...E].map(([c, e]) => ({ category: c, exposure100MvehKm: +e.toFixed(1), injuryRate: +((K.get(c) ?? 0) / e).toFixed(2), fatalRate: +((F.get(c) ?? 0) / e).toFixed(3), hardShoulderRate: +((HS.get(c) ?? 0) / e).toFixed(3) })).sort((a, b) => b.exposure100MvehKm - a.exposure100MvehKm);
}
