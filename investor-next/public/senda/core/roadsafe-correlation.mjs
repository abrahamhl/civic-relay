/**
 * SENDA RoadSafe · H-ROAD-2 — Correlación de observaciones viales heterogéneas con linaje causal.
 *
 * Problema: una misma avería puede aparecer como (a) baliza V16 conectada, (b) su reflejo en la
 * plataforma DGT 3.0, (c) el aviso que un navegador conectado a DGT 3.0 muestra, (d) un registro
 * DATEX II del Punto de Acceso Nacional, (e) un toque de un conductor en SENDA y (f) una trama BLE de
 * un coche cercano. Contar (a)+(b)+(c) como tres confirmaciones es el error clásico de «Bayes ingenuo»
 * con fuentes dependientes: todas proceden del MISMO dispositivo físico.
 *
 * Principio reutilizado de H-FUS-1 (causal-evidence-fusion.mjs): agrupar por raíz causal, tomar un
 * representante conservador por raíz y sumar log-odds SOLO entre raíces independientes; abstenerse
 * ante contradicción. Aquí se aplica con un registro de linaje propio del dominio vial (ROAD_SOURCES),
 * porque el grafo de fuentes de H-FUS-1 cubre sismos/incendios y no fuentes de tráfico.
 *
 * Fiabilidades (`lr`) = HIPÓTESIS DE PARTIDA declaradas; deben calibrarse con datos etiquetados
 * (protocolo en docs/roadsafe/04_HYPOTHESES.md). No son medidas.
 */

const R = 6_371_000;
export const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/**
 * Registro de fuentes viales: `lineage` indica de qué raíz física deriva cada producto.
 * `derivedFrom` ≠ null ⇒ NUNCA cuenta como corroboración independiente de su origen.
 * lrPresent: razón de verosimilitud P(informe | peligro real) / P(informe | no hay peligro) — HIPÓTESIS.
 */
export const ROAD_SOURCES = Object.freeze({
  V16_BEACON: { label: 'Baliza V16 conectada (dispositivo físico)', derivedFrom: null, lrPresent: 8, kind: 'DEVICE', note: 'Activación manual del usuario; no informa de carril ni de personas.' },
  DGT30_V16: { label: 'Posición V16 publicada por DGT 3.0', derivedFrom: 'V16_BEACON', lrPresent: 8, kind: 'OFFICIAL_RELAY' },
  NAVIGATOR_FROM_DGT30: { label: 'Aviso en navegador alimentado por DGT 3.0', derivedFrom: 'DGT30_V16', lrPresent: 8, kind: 'THIRD_PARTY_RELAY' },
  DATEX2_NAP: { label: 'Registro DATEX II del Punto de Acceso Nacional', derivedFrom: null, lrPresent: 20, kind: 'OFFICIAL', note: 'Puede derivar de V16 o de patrulla: si trae referencia a V16, usar rootHint.' },
  TRAFFIC_CENTRE_OPERATOR: { label: 'Operador de centro de gestión de tráfico', derivedFrom: null, lrPresent: 40, kind: 'OFFICIAL' },
  SENDA_CITIZEN_REPORT: { label: 'Aviso de un toque de conductor (SENDA)', derivedFrom: null, lrPresent: 3, kind: 'CROWD' },
  SENDA_OWNER_DECLARATION: { label: 'Declaración del propio afectado (SENDA)', derivedFrom: null, lrPresent: 12, kind: 'OWNER' },
  BLE_PEER_FRAME: { label: 'Trama BLE de vehículo cercano (sin firma)', derivedFrom: null, lrPresent: 1.5, kind: 'PEER_UNVERIFIED' },
  BLE_PEER_SIGNED: { label: 'Cápsula BLE firmada por dispositivo inscrito', derivedFrom: null, lrPresent: 4, kind: 'PEER_SIGNED' },
  PROVIDER_STATUS: { label: 'Estado comunicado por proveedor de asistencia', derivedFrom: null, lrPresent: 15, kind: 'PROVIDER' },
  ECALL_PSAP: { label: 'eCall recibido por el 112 (solo si el 112 lo comparte)', derivedFrom: null, lrPresent: 50, kind: 'OFFICIAL' },
});

/** Raíz causal de una observación: sigue `derivedFrom` hasta el origen; `rootHint` (p. ej. id de la baliza) separa dispositivos. */
export function causalRoot(obs) {
  let s = obs.source, guard = 0;
  while (ROAD_SOURCES[s]?.derivedFrom && guard++ < 8) s = ROAD_SOURCES[s].derivedFrom;
  const device = obs.rootHint ?? null; // p. ej. id de la baliza: V16, DGT 3.0 y navegador comparten raíz
  // La declaración del propio afectado y la V16 que él mismo activó son la MISMA fuente humana.
  if (s === 'SENDA_OWNER_DECLARATION' && device) return `V16_BEACON:${device}`;
  // Para fuentes de multitud/pares, cada informante es una raíz distinta (si no hay identidad, cada obs).
  if (['SENDA_CITIZEN_REPORT', 'BLE_PEER_FRAME', 'BLE_PEER_SIGNED'].includes(s)) return `${s}:${obs.reporterId ?? obs.obsId}`;
  return device ? `${s}:${device}` : s;
}

/**
 * Agrupa observaciones en incidentes lógicos: misma carretera (si se conoce), sentido compatible,
 * distancia ≤ `radiusM` (ampliada por la incertidumbre de posición) y ventana temporal.
 * Puerta de calzada: si ambas traen `dir` (±1) distinta, NO se fusionan (evita mezclar calzadas).
 */
export function correlateObservations(observations, { radiusM = 250, windowS = 1800 } = {}) {
  const obs = [...observations].filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon) && Number.isFinite(o.at)).sort((a, b) => a.at - b.at);
  const groups = [];
  for (const o of obs) {
    let best = null, bestD = Infinity;
    for (const g of groups) {
      const last = g.obs[g.obs.length - 1];
      if (o.at - last.at > windowS) continue;
      if (o.roadId && g.roadId && o.roadId !== g.roadId) continue;
      if (o.dir != null && g.dir != null && o.dir !== g.dir) continue;
      const d = distM(o, g.centroid), tol = radiusM + (o.accuracyM ?? 0) + (g.accuracyM ?? 0);
      if (d <= tol && d < bestD) { best = g; bestD = d; }
    }
    if (!best) groups.push({ obs: [o], roadId: o.roadId ?? null, dir: o.dir ?? null, centroid: { lat: o.lat, lon: o.lon }, accuracyM: o.accuracyM ?? 0 });
    else {
      best.obs.push(o); best.roadId ??= o.roadId ?? null; best.dir ??= o.dir ?? null;
      // centroide ponderado por precisión (1/σ²): una V16 con GNSS bueno pesa más que un toque aproximado
      const w = (x) => 1 / Math.max(25, (x.accuracyM ?? 30) ** 2);
      const W = best.obs.reduce((s, x) => s + w(x), 0);
      best.centroid = { lat: best.obs.reduce((s, x) => s + w(x) * x.lat, 0) / W, lon: best.obs.reduce((s, x) => s + w(x) * x.lon, 0) / W };
      best.accuracyM = Math.sqrt(1 / W);
    }
  }
  return groups.map((g, i) => ({ groupId: `G${i + 1}`, ...g, centroid: { lat: +g.centroid.lat.toFixed(6), lon: +g.centroid.lon.toFixed(6) }, accuracyM: +g.accuracyM.toFixed(1) }));
}

/**
 * Fusión sin doble conteo. Cada observación: { source, present:boolean, at, rootHint?, reporterId?, obsId }.
 * Dentro de una raíz se toma la observación MÁS RECIENTE (estado actual de ese emisor), no la suma.
 * Entre raíces independientes, log-odds aditivos con decaimiento por antigüedad (semivida `hlS`).
 * Salida: p, raíces independientes, índice de contradicción y estado epistémico con abstención.
 */
export function fuseRoadEvidence(observations, { now, prior = 0.2, hlS = 900, minIndependentRoots = 2, contradictionAbstain = 0.35, naive = false } = {}) {
  if (!Number.isFinite(now)) return { status: 'ABSTAIN', reason: 'SIN_RELOJ', p: null };
  const usable = observations.filter((o) => ROAD_SOURCES[o.source] && Number.isFinite(o.at) && o.at <= now);
  const leaked = observations.length - usable.length;
  if (!usable.length) return { status: 'UNKNOWN', reason: 'SIN_EVIDENCIA', p: prior, independentRoots: 0, leakedOrUnknown: leaked };
  const byRoot = new Map();
  for (const o of usable) { const r = naive ? `${o.source}:${o.obsId}` : causalRoot(o); const prev = byRoot.get(r); if (!prev || o.at > prev.at) byRoot.set(r, o); }
  let L = logit(prior), pos = 0, neg = 0;
  const contributions = [];
  for (const [root, o] of byRoot) {
    const lr = ROAD_SOURCES[o.source].lrPresent, w = 2 ** (-(now - o.at) / hlS), dl = (o.present === false ? -1 : 1) * w * Math.log(lr);
    L += dl; if (dl > 0) pos += dl; else neg += -dl;
    contributions.push({ root, source: o.source, present: o.present !== false, weight: +w.toFixed(3), dLogOdds: +dl.toFixed(3) });
  }
  const p = sigmoid(L), contradiction = pos + neg > 0 ? Math.min(pos, neg) / Math.max(pos, neg) : 0;
  const officialRoots = [...byRoot.values()].filter((o) => ['OFFICIAL', 'OFFICIAL_RELAY'].includes(ROAD_SOURCES[o.source].kind) && o.present !== false).length;
  const independentRoots = byRoot.size;
  let status;
  if (contradiction >= contradictionAbstain) status = 'DISPUTED';
  else if (p >= 0.9 && (independentRoots >= minIndependentRoots || officialRoots >= 1)) status = 'CORROBORATED';
  else if (p <= 0.1) status = 'LIKELY_CLEARED';
  else status = 'UNVERIFIED';
  return { status, p: +p.toFixed(4), independentRoots, officialRoots, contradiction: +contradiction.toFixed(3), contributions, leakedOrUnknown: leaked, method: naive ? 'NAIVE_BAYES_BASELINE' : 'CAUSAL_ROOT_DEDUP' };
}
