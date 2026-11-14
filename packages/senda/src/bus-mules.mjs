/**
 * SENDA · Autobuses como «mulas de datos» sobre horarios REALES (GTFS).
 *
 * Si cae la red móvil, un mensaje corto (≤ 160 caracteres) puede viajar de parada en parada a bordo de los autobuses:
 * el teléfono o buzón SENDA de la parada se lo pasa al nodo del autobús cuando este se detiene, y el autobús lo deja en
 * las paradas siguientes, donde otro autobús puede recogerlo (store-carry-forward, DTN).
 *
 * Ciencia en la que se apoya:
 *  - DakNet (Pentland, Fletcher y Hasson, IEEE Computer 2004) y UMass DieselNet / MaxProp (Burgess et al., INFOCOM 2006):
 *    autobuses como portadores de datos.
 *  - Connection Scan Algorithm (Dibbelt, Pajor, Strasser y Wagner, SEA 2013): llegada más temprana en una red con horario,
 *    exacta y en un solo barrido de las conexiones ordenadas por salida.
 *  - Encaminado epidémico (Vahdat y Becker, 2000) frente a copia única: con copias ilimitadas, la llegada epidémica es la
 *    llegada más temprana sobre los autobuses que funcionan, que es exactamente lo que calcula el CSA.
 *
 * Veracidad: los horarios son reales (GTFS de la EMT de València, CC BY 4.0). Que los autobuses lleven un nodo SENDA, que
 * haya buzón en cada parada y que se cumpla el horario en una emergencia son HIPÓTESIS: todo resultado es SIMULACIÓN.
 */

/** CSV mínimo con comillas (RFC 4180) → array de objetos. */
export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift()?.map((h) => h.replace(/^﻿/, '').trim()) ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** Segundos desde medianoche de «HH:MM:SS» (GTFS admite horas ≥ 24). */
export const hms = (s) => { const [h, m, x] = String(s).split(':').map(Number); return h * 3600 + m * 60 + (x || 0); };

/** Servicios activos en una fecha AAAAMMDD según calendar y calendar_dates. */
export function activeServices(calendar, calendarDates, date) {
  const d = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T12:00:00Z`);
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()];
  const on = new Set(calendar.filter((c) => c.start_date <= date && date <= c.end_date && c[day] === '1').map((c) => c.service_id));
  for (const x of calendarDates) if (x.date === date) { if (x.exception_type === '1') on.add(x.service_id); else on.delete(x.service_id); }
  return on;
}

/**
 * Conexiones elementales (parada i → parada i+1 de un mismo viaje) de una fecha y ventana horaria, ordenadas por salida.
 * Devuelve índices compactos para que el barrido sea rápido y el resultado se pueda publicar.
 */
export function buildConnections({ stops, trips, stopTimes, calendar, calendarDates }, { date, from = '00:00:00', to = '30:00:00' }) {
  const on = activeServices(calendar, calendarDates, date), t0 = hms(from), t1 = hms(to);
  const tripOk = new Set(trips.filter((t) => on.has(t.service_id)).map((t) => t.trip_id));
  const stopIdx = new Map(stops.map((s, i) => [s.stop_id, i])), tripIdx = new Map(); const tripIds = [];
  const byTrip = new Map();
  for (const st of stopTimes) { if (!tripOk.has(st.trip_id)) continue; (byTrip.get(st.trip_id) ?? byTrip.set(st.trip_id, []).get(st.trip_id)).push(st); }
  const C = [];
  for (const [tid, sts] of byTrip) {
    sts.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    for (let k = 0; k + 1 < sts.length; k++) {
      const dep = hms(sts[k].departure_time || sts[k].arrival_time), arr = hms(sts[k + 1].arrival_time || sts[k + 1].departure_time);
      if (dep < t0 || dep > t1) continue;
      if (!tripIdx.has(tid)) { tripIdx.set(tid, tripIds.length); tripIds.push(tid); }
      C.push([dep, arr, stopIdx.get(sts[k].stop_id), stopIdx.get(sts[k + 1].stop_id), tripIdx.get(tid)]);
    }
  }
  C.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = C.length, dep = new Int32Array(n), arr = new Int32Array(n), from_ = new Int32Array(n), to_ = new Int32Array(n), trip = new Int32Array(n);
  C.forEach((c, i) => { dep[i] = c[0]; arr[i] = c[1]; from_[i] = c[2]; to_[i] = c[3]; trip[i] = c[4]; });
  return { dep, arr, from: from_, to: to_, trip, nStops: stops.length, nTrips: tripIds.length, tripIds, window: { date, from, to } };
}

const INF = 0x7fffffff;

/**
 * Connection Scan Algorithm: llegada más temprana desde `source` saliendo en `t0`.
 * up(tripIndex) → false si ese autobús NO lleva nodo SENDA (no transporta datos).
 * hub(stop) → true si la parada tiene buzón SENDA (si se omite, se supone buzón en todas).
 * Devuelve arrival[stop] (INF si no se llega) y lastConn[stop] para reconstruir la ruta.
 */
export function csa(conns, source, t0, { up = () => true, hub = null } = {}) {
  const { dep, arr, from, to, trip, nStops, nTrips } = conns;
  const T = new Int32Array(nStops).fill(INF), onTrip = new Uint8Array(nTrips), last = new Int32Array(nStops).fill(-1), enter = new Int32Array(nTrips).fill(-1);
  T[source] = t0;
  for (let i = 0; i < dep.length; i++) {
    if (dep[i] < t0) continue;
    const tr = trip[i];
    if (onTrip[tr] || T[from[i]] <= dep[i]) {
      if (!up(tr)) continue;
      if (!onTrip[tr]) { onTrip[tr] = 1; enter[tr] = i; }
      // Con buzones (hub): el mensaje solo puede bajar o cambiar de autobús en paradas con buzón
      if ((!hub || hub(to[i])) && arr[i] < T[to[i]]) { T[to[i]] = arr[i]; last[to[i]] = i; }
    }
  }
  return { arrival: T, last, enter };
}

/** Viajes (autobuses) usados por la ruta óptima hasta `target` (reconstrucción hacia atrás). */
export function pathTrips(conns, res, source, target) {
  const trips = []; let s = target, guard = 0;
  while (s !== source && res.last[s] >= 0 && guard++ < 10000) { const c = res.last[s], tr = conns.trip[c]; if (trips[0] !== tr) trips.unshift(tr); s = conns.from[res.enter[tr]]; }
  return s === source ? trips : null;
}

/** Perfil de entrega desde una parada: fracción alcanzada y percentiles de retardo (minutos). */
export function deliveryProfile(conns, source, t0, opts) {
  const { arrival } = csa(conns, source, t0, opts), d = [];
  for (let s = 0; s < arrival.length; s++) if (s !== source && arrival[s] !== INF) d.push((arrival[s] - t0) / 60);
  d.sort((a, b) => a - b); const q = (p) => (d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))] : null);
  return { reached: d.length, of: arrival.length - 1, share: d.length / (arrival.length - 1), p50: q(0.5), p90: q(0.9) };
}

/** Generador pseudoaleatorio con semilla (mulberry32) para que la simulación sea reproducible. */
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Monte Carlo: cada autobús lleva nodo SENDA con probabilidad q (independiente). Para cada pareja origen-destino se
 * compara EPIDÉMICO (copias en todo autobús con nodo = CSA sobre los que funcionan) con COPIA ÚNICA (la ruta óptima con
 * flota completa; solo llega si TODOS sus autobuses llevan nodo). Éxito = llegar antes de `deadlineMin`.
 */
export function adoptionStudy(conns, pairs, t0, { qs = [0.1, 0.25, 0.5, 0.75, 1], deadlineMin = 60, runs = 40, seed = 20261114 } = {}) {
  const base = pairs.map(([s, t]) => { const r = csa(conns, s, t0); return { s, t, full: r.arrival[t], path: pathTrips(conns, r, s, t) }; });
  const out = [];
  for (const q of qs) {
    const rand = rng(seed + Math.round(q * 1000)); let epi = 0, single = 0, n = 0; const delays = [];
    for (let k = 0; k < runs; k++) {
      const up = new Uint8Array(conns.nTrips); for (let i = 0; i < up.length; i++) up[i] = rand() < q ? 1 : 0;
      for (const b of base) {
        if (b.full === INF || (b.full - t0) / 60 > deadlineMin) continue; n++;
        const a = csa(conns, b.s, t0, { up: (tr) => up[tr] === 1 }).arrival[b.t];
        if (a !== INF && (a - t0) / 60 <= deadlineMin) { epi++; delays.push((a - t0) / 60); }
        if (b.path && b.path.every((tr) => up[tr] === 1)) single++;
      }
    }
    delays.sort((x, y) => x - y);
    out.push({ q, trials: n, epidemic: n ? epi / n : null, singleCopy: n ? single / n : null, epidemicP50Min: delays.length ? delays[delays.length >> 1] : null });
  }
  return { deadlineMin, runs, pairs: base.length, feasibleWithFullFleet: base.filter((b) => b.full !== INF && (b.full - t0) / 60 <= deadlineMin).length, results: out, basis: 'SIMULATION' };
}

/** Distancia de círculo máximo en metros. */
export const distM = (a, b) => { const r = Math.PI / 180, dφ = (b.lat - a.lat) * r, dλ = (b.lon - a.lon) * r, x = Math.sin(dφ / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dλ / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };

/**
 * Dónde poner K buzones SENDA: cobertura máxima (MCLP, Church y ReVelle 1974) con el algoritmo voraz, que garantiza al
 * menos (1 − 1/e) ≈ 63 % del óptimo por ser la cobertura submodular (Nemhauser, Wolsey y Fisher 1978).
 * Una parada queda «servida» si hay un buzón a ≤ radiusM a pie. pts: [{lat, lon}]. Devuelve el orden de elección y la
 * cobertura acumulada (fracción de paradas servidas). Es una cobertura geométrica: no usa población (no medida aquí).
 */
export function placeBoxes(pts, K, { radiusM = 400, preselected = [] } = {}) {
  const n = pts.length, near = pts.map((p) => { const out = []; for (let j = 0; j < n; j++) if (distM(p, pts[j]) <= radiusM) out.push(j); return out; });
  const covered = new Uint8Array(n), chosen = [], curve = []; let total = 0;
  // Plan mixto: parte de buzones ya fijados (p. ej. transbordos) y completa la cobertura con el voraz
  for (const i of preselected) { chosen.push(i); for (const j of near[i]) if (!covered[j]) { covered[j] = 1; total++; } curve.push(total / n); }
  K += preselected.length;
  for (let k = chosen.length; k < K; k++) {
    let best = -1, gain = 0; for (let i = 0; i < n; i++) { let g = 0; for (const j of near[i]) if (!covered[j]) g++; if (g > gain) { gain = g; best = i; } }
    if (best < 0) break; chosen.push(best); for (const j of near[best]) if (!covered[j]) { covered[j] = 1; total++; } curve.push(total / n);
  }
  return { chosen, coverage: curve, radiusM, guarantee: '≥ (1 − 1/e) del óptimo (voraz sobre función submodular)' };
}

/** Entrega buzón→buzón con flota completa: fracción de parejas de buzones conectadas en ≤ deadlineMin. */
export function boxNetworkDelivery(conns, boxes, t0, { deadlineMin = 120, maxPairs = 400, seed = 7 } = {}) {
  const set = new Uint8Array(conns.nStops); for (const b of boxes) set[b] = 1;
  const R = rng(seed), pairs = []; for (let k = 0; k < maxPairs && boxes.length > 1; k++) { const a = boxes[Math.floor(R() * boxes.length)], b = boxes[Math.floor(R() * boxes.length)]; if (a !== b) pairs.push([a, b]); }
  let ok = 0; const d = [];
  const bySrc = new Map(); for (const [a, b] of pairs) (bySrc.get(a) ?? bySrc.set(a, []).get(a)).push(b);
  for (const [a, bs] of bySrc) { const T = csa(conns, a, t0, { hub: (s) => set[s] === 1 }).arrival; for (const b of bs) if (T[b] !== INF && (T[b] - t0) / 60 <= deadlineMin) { ok++; d.push((T[b] - t0) / 60); } }
  d.sort((x, y) => x - y);
  return { pairs: pairs.length, delivered: pairs.length ? ok / pairs.length : null, p50Min: d.length ? d[d.length >> 1] : null, basis: 'SIMULATION' };
}

/**
 * Colocación CONSCIENTE DE TRANSBORDOS: ordena las paradas por número de líneas distintas que pasan (puntos de
 * intercambio), desempatando por número de pasos. Idea análoga al reenvío por centralidad en DTN (BUBBLE Rap, Hui,
 * Crowcroft y Yoneki 2008). tripRoute[tripIndex] → id de línea.
 */
export function hubRanking(conns, tripRoute) {
  const routes = Array.from({ length: conns.nStops }, () => new Set()), passes = new Int32Array(conns.nStops);
  for (let i = 0; i < conns.dep.length; i++) { for (const s of [conns.from[i], conns.to[i]]) { routes[s].add(tripRoute[conns.trip[i]]); passes[s]++; } }
  return [...routes.keys()].sort((a, b) => routes[b].size - routes[a].size || passes[b] - passes[a]).map((s) => ({ stop: s, lines: routes[s].size, passes: passes[s] }));
}
