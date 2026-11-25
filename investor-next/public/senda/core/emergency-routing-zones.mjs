/**
 * SENDA · Enrutamiento de evacuación multivector, idoneidad explicable de zonas seguras,
 * herramientas espaciales AOI/clustering, empaquetador de áreas sin red y registro de salud de fuentes
 * (`emergency-routing-zones.mjs`).
 *
 * Integra y adapta a emergencias civiles de SENDA las arquitecturas de alto valor de `calmpath-maps-pro`:
 *  1. Enrutador de evacuación A-estrella y Dijkstra multivector con puertas físicas de intransitabilidad
 *     (reutiliza estabilidad humana Cox/DEFRA y vehicular Shand/Martínez-Gomariz de `shallow-water-fv.mjs`,
 *     densidad peatonal crítica de Fruin 1971 y perfil de accesibilidad para movilidad reducida) +
 *     respaldo sin grafo por campo potencial de escape.
 *  2. Motor multicriterio explicable de zonas seguras / albergues con pesos declarados por el llamante,
 *     taxonomía de procedencia de 7 niveles (`PROVENANCE_LEVELS`) y desglose de riesgos y fortalezas.
 *  3. Filtros AOI (círculo, caja, polígono), clustering espacial por rejilla según zoom y escáner en 1 clic.
 *  4. Empaquetador determinista de área sin red con huella WebCrypto SHA-256 y decaimiento de frescura por TTL.
 *  5. Registro de salud de fuentes y degradación honesta (nunca etiqueta cachés caducadas o modelos como `OBSERVED`).
 *
 * Referencias:
 *  - Dijkstra, E. W. (1959). Numerische Mathematik 1:269-271; Hart, P. E., Nilsson, N. J. & Raphael, B. (1968).
 *    IEEE Trans. Syst. Sci. Cybern. 4(2):100-107 (A*).
 *  - Fruin, J. J. (1971). «Pedestrian Planning and Design» (niveles de servicio y congestión peatonal).
 *  - Cox et al. (2010) / DEFRA FD2320 y Shand et al. (2011) / Martínez-Gomariz et al. (2018) vía `shallow-water-fv.mjs`.
 *
 * Módulo ES puro compatible con navegador y Node (WebCrypto, cero `node:*`).
 */

import { haversineKm } from './zones.mjs';
import { assessHumanFloodStability, assessVehicleFloodStability } from './shallow-water-fv.mjs';

export const PROVENANCE_LEVELS = Object.freeze([
  'OBSERVED',
  'EXTRACTED',
  'CALCULATED',
  'INFERRED',
  'PREDICTED',
  'SIMULATED',
  'UNKNOWN',
]);

export const EVACUATION_PROFILES = Object.freeze({
  pedestrian: Object.freeze({
    id: 'pedestrian',
    speedMs: 1.25,
    maxSlopeDeg: 22,
    maxCrowdPerM2: 3.5, // Fruin LOS E–F inicio de riesgo de aplastamiento
    maxPm25UgM3: 250,
    minFireDistanceM: 300,
    requiresAccessible: false,
    humanProfile: 'adult',
  }),
  low_mobility_accessible: Object.freeze({
    id: 'low_mobility_accessible',
    speedMs: 0.75,
    maxSlopeDeg: 6, // pendiente accesible (CTE DB-SUA / ADA ≈ 6–8 %)
    maxCrowdPerM2: 2.0,
    maxPm25UgM3: 150,
    minFireDistanceM: 500,
    requiresAccessible: true,
    humanProfile: 'child', // criterio más conservador de estabilidad en agua
  }),
  small_vehicle: Object.freeze({
    id: 'small_vehicle',
    speedMs: 8.33, // 30 km/h en evacuación urbana congestionada
    maxSlopeDeg: 18,
    maxCrowdPerM2: Infinity,
    maxPm25UgM3: 500,
    minFireDistanceM: 250,
    requiresAccessible: false,
    vehicleClass: 'small_passenger',
  }),
  emergency_4x4: Object.freeze({
    id: 'emergency_4x4',
    speedMs: 11.11, // 40 km/h
    maxSlopeDeg: 28,
    maxCrowdPerM2: Infinity,
    maxPm25UgM3: 1000,
    minFireDistanceM: 120,
    requiresAccessible: false,
    vehicleClass: 'large_4wd',
  }),
});

/* ───────────── 1. Enrutador de evacuación multivector A-estrella y Dijkstra + puertas físicas ───────────── */

function evaluateEdgeSafety(edge, prof, debrisFactor) {
  const reasons = [];
  if (edge.blocked) reasons.push('tramo_cortado');
  if (prof.requiresAccessible && edge.accessible === false) reasons.push('no_accesible_movilidad_reducida');
  if (Number.isFinite(edge.slopeDeg) && Math.abs(edge.slopeDeg) > prof.maxSlopeDeg) {
    reasons.push(`pendiente_${Math.abs(edge.slopeDeg).toFixed(1)}deg_excede_${prof.maxSlopeDeg}deg`);
  }
  if (Number.isFinite(edge.fireDistanceM) && edge.fireDistanceM < prof.minFireDistanceM) {
    reasons.push(`fuego_a_${Math.round(edge.fireDistanceM)}m`);
  }
  if (Number.isFinite(edge.crowdDensityPerM2) && edge.crowdDensityPerM2 >= prof.maxCrowdPerM2) {
    reasons.push(`aglomeracion_${edge.crowdDensityPerM2.toFixed(1)}_p_m2`);
  }

  let waterPenalty = 0;
  const depth = edge.waterDepthM ?? 0;
  const speed = edge.waterSpeedMs ?? 0;
  if (depth > 0.02) {
    if (prof.vehicleClass) {
      const st = assessVehicleFloodStability(depth, speed, { vehicleClass: prof.vehicleClass });
      if (st.unstable) reasons.push(`agua_vehiculo_inestable_${st.mechanism.toLowerCase()}`);
      waterPenalty = depth * 6 + depth * speed * 10;
    } else {
      const st = assessHumanFloodStability(depth, speed, { profile: prof.humanProfile, debrisFactor });
      if (st.unstable || st.defraClass === 'EXTREME_FOR_ALL') reasons.push(`agua_peaton_inestable_${st.defraClass.toLowerCase()}`);
      waterPenalty = depth * 8 + st.defraHR * 3;
    }
  }

  const smokePenalty = Number.isFinite(edge.smokePm25UgM3)
    ? (edge.smokePm25UgM3 > prof.maxPm25UgM3 ? 25 : (edge.smokePm25UgM3 / prof.maxPm25UgM3) * 4)
    : 0;
  const firePenalty = Number.isFinite(edge.fireDistanceM) && edge.fireDistanceM < 1500
    ? Math.max(0, (1500 - edge.fireDistanceM) / 250)
    : 0;
  const slopePenalty = Number.isFinite(edge.slopeDeg) ? Math.abs(edge.slopeDeg) * 0.12 : 0;
  const crowdPenalty = Number.isFinite(edge.crowdDensityPerM2) ? edge.crowdDensityPerM2 * 0.6 : 0;

  return {
    impassable: reasons.length > 0,
    reasons,
    hazardMultiplier: 1 + waterPenalty + smokePenalty + firePenalty + slopePenalty + crowdPenalty,
    exposureScore: +(waterPenalty + smokePenalty + firePenalty + crowdPenalty).toFixed(3),
  };
}

/**
 * Calcula rutas de evacuación segura sobre un grafo vial/peatonal mediante A* con heurística admisible.
 * Evalúa puertas físicas de intransitabilidad (agua, fuego, pendiente, accesibilidad, aglomeración) y
 * devuelve tanto la ruta de menor coste multivector (seguridad+tiempo) como las causas de desvío.
 */
export function routeEvacuationGraph({
  nodes,
  edges,
  startId,
  goalIds,
  profile = 'pedestrian',
  debrisFactor,
  hazardWeight = 1.0,
}) {
  const prof = EVACUATION_PROFILES[profile];
  if (!prof) throw new RangeError(`routeEvacuationGraph: perfil desconocido '${profile}'`);
  if (!prof.vehicleClass && !Number.isFinite(debrisFactor)) {
    throw new RangeError('routeEvacuationGraph: debrisFactor (DEFRA FD2320, en [0, 1]) obligatorio para perfiles peatonales');
  }
  const goals = new Set(Array.isArray(goalIds) ? goalIds : [goalIds]);
  if (!nodes?.length || !goals.size) throw new RangeError('nodes y goalIds no vacíos obligatorios');

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(startId)) throw new RangeError(`nodo inicial '${startId}' no existe`);

  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  const blockedEdges = [];

  for (const e of edges ?? []) {
    const safety = evaluateEdgeSafety(e, prof, debrisFactor ?? 0);
    if (safety.impassable) {
      blockedEdges.push({ from: e.from, to: e.to, reasons: safety.reasons });
      continue;
    }
    const baseTimeS = e.lengthM / prof.speedMs;
    const cost = baseTimeS * (1 + hazardWeight * (safety.hazardMultiplier - 1));
    adj.get(e.from)?.push({ to: e.to, edge: e, baseTimeS, cost, exposure: safety.exposureScore });
    if (e.bidirectional !== false) {
      adj.get(e.to)?.push({ to: e.from, edge: e, baseTimeS, cost, exposure: safety.exposureScore });
    }
  }

  const goalNodes = [...goals].map((id) => nodeMap.get(id)).filter(Boolean);
  const heuristic = (id) => {
    const a = nodeMap.get(id);
    if (!a || !goalNodes.length) return 0;
    let minKm = Infinity;
    for (const g of goalNodes) {
      const d = haversineKm(a, g);
      if (d < minKm) minKm = d;
    }
    return (minKm * 1000) / prof.speedMs;
  };

  // A* determinista
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, heuristic(startId)]]);
  const prev = new Map();
  const open = new Set([startId]);
  const closed = new Set();

  let reachedGoal = null;
  while (open.size > 0) {
    let curr = null, bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) { bestF = f; curr = id; }
    }
    if (curr === null) break;
    if (goals.has(curr)) { reachedGoal = curr; break; }
    open.delete(curr);
    closed.add(curr);

    for (const step of adj.get(curr) ?? []) {
      if (closed.has(step.to)) continue;
      const tentative = (gScore.get(curr) ?? Infinity) + step.cost;
      if (tentative < (gScore.get(step.to) ?? Infinity)) {
        prev.set(step.to, { from: curr, step });
        gScore.set(step.to, tentative);
        fScore.set(step.to, tentative + heuristic(step.to));
        open.add(step.to);
      }
    }
  }

  if (!reachedGoal) {
    return Object.freeze({
      found: false,
      profile: prof.id,
      reason: 'Ninguna ruta segura transitable con las restricciones físicas actuales',
      blockedEdges,
      basis: 'MODEL',
    });
  }

  const path = [];
  let cursor = reachedGoal;
  let totalDistM = 0, totalTimeS = 0, totalExposure = 0;
  while (cursor !== startId) {
    const p = prev.get(cursor);
    path.unshift(cursor);
    totalDistM += p.step.edge.lengthM;
    totalTimeS += p.step.baseTimeS;
    totalExposure += p.step.exposure * (p.step.edge.lengthM / 1000);
    cursor = p.from;
  }
  path.unshift(startId);

  return Object.freeze({
    found: true,
    profile: prof.id,
    goalId: reachedGoal,
    path,
    distanceM: Math.round(totalDistM),
    etaMinutes: +(totalTimeS / 60).toFixed(1),
    weightedCostS: +(gScore.get(reachedGoal)).toFixed(1),
    cumulativeHazardExposure: +totalExposure.toFixed(3),
    avoidedBlockedEdgesCount: blockedEdges.length,
    blockedEdges,
    basis: 'MODEL',
  });
}

/**
 * Respaldo sin grafo vial ni red: calcula un rumbo de escape mediante campo potencial repulsivo
 * (alejarse de peligros activos) combinado con atracción suave hacia refugios/cotas altas conocidas.
 */
export function computeFallbackEscapeBearing({ origin, hazards = [], safeTargets = [] }) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) {
    throw new RangeError('computeFallbackEscapeBearing: origin { lat, lon } obligatorio');
  }
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  let vx = 0, vy = 0;

  for (const h of hazards) {
    const dx = (origin.lon - h.lon) * cosLat;
    const dy = origin.lat - h.lat;
    const dist = Math.max(1e-4, Math.hypot(dx, dy));
    const sev = h.severityWeight ?? 1;
    // Repulsión inversamente proporcional al cuadrado de la distancia
    vx += (sev * dx) / (dist * dist * dist);
    vy += (sev * dy) / (dist * dist * dist);
  }

  for (const s of safeTargets) {
    const dx = (s.lon - origin.lon) * cosLat;
    const dy = s.lat - origin.lat;
    const dist = Math.max(1e-4, Math.hypot(dx, dy));
    const w = s.attractionWeight ?? 0.5;
    vx += (w * dx) / (dist * dist);
    vy += (w * dy) / (dist * dist);
  }

  if (Math.hypot(vx, vy) < 1e-12) {
    return Object.freeze({ bearingDeg: null, confidence: 'UNKNOWN', basis: 'MODEL', note: 'Sin vectores de peligro ni objetivo para determinar rumbo' });
  }
  const bearingDeg = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360;
  return Object.freeze({
    bearingDeg: +bearingDeg.toFixed(1),
    confidence: hazards.length > 0 ? 'INFERRED' : 'CALCULATED',
    basis: 'MODEL',
    note: 'Rumbo orientativo de respaldo sin cartografía vial; confirmar transitabilidad visualmente y seguir instrucciones de Protección Civil.',
  });
}

/* ───────────── 2. Motor multicriterio explicable de zonas seguras / albergues ───────────── */

/**
 * Clasifica zonas seguras y albergues de emergencia mediante puntuación multicriterio transparente
 * (pesos declarados explícitamente por el llamante, sin valores mágicos ocultos).
 * Devuelve el Top-K con fortalezas, factores de riesgo y nivel de procedencia por zona.
 */
export function rankEmergencySafeZones(zones, { weights, topK = 3 }) {
  if (!Array.isArray(zones) || zones.length === 0) throw new RangeError('rankEmergencySafeZones: zones no vacío obligatorio');
  if (!weights || typeof weights !== 'object') throw new RangeError('rankEmergencySafeZones: weights obligatorios (sin valores por defecto ocultos)');
  const requiredKeys = ['floodMargin', 'fireDistance', 'airQuality', 'accessibility', 'capacity', 'comms', 'proximity'];
  let wSum = 0;
  for (const k of requiredKeys) {
    if (!Number.isFinite(weights[k]) || weights[k] < 0) {
      throw new RangeError(`rankEmergencySafeZones: peso '${k}' ≥ 0 obligatorio`);
    }
    wSum += weights[k];
  }
  if (!(wSum > 0)) throw new RangeError('la suma de weights debe ser > 0');

  const scored = zones.map((z) => {
    const provenance = PROVENANCE_LEVELS.includes(z.provenance) ? z.provenance : 'UNKNOWN';
    const strengths = [];
    const riskFactors = [];
    const disqualifiedReasons = [];

    // Puertas eliminatorias físicas: zona inundada, fuego inminente o llena al 100 %
    if (Number.isFinite(z.handMarginM) && z.handMarginM < 0.5) disqualifiedReasons.push('cota_inundable_sin_margen_HAND');
    if (Number.isFinite(z.fireDistanceKm) && z.fireDistanceKm < 0.5) disqualifiedReasons.push('incendio_a_menos_de_500m');
    if (Number.isFinite(z.occupancyRatio) && z.occupancyRatio >= 1.0) disqualifiedReasons.push('aforo_completo');
    if (z.status === 'CLOSED' || z.status === 'EVACUATED') disqualifiedReasons.push(`estado_${z.status}`);

    // Subpuntuaciones normalizadas [0, 1]
    const sFlood = Number.isFinite(z.handMarginM) ? Math.min(1, Math.max(0, z.handMarginM / 10)) : 0.3;
    const sFire = Number.isFinite(z.fireDistanceKm) ? Math.min(1, Math.max(0, z.fireDistanceKm / 10)) : 0.5;
    const sAir = Number.isFinite(z.pm25UgM3) ? Math.max(0, 1 - z.pm25UgM3 / 250) : 0.5;
    const sAccess = (z.wheelchairAccessible ? 0.7 : 0.3) + (Number.isFinite(z.approachSlopeDeg) ? Math.max(0, 0.3 * (1 - z.approachSlopeDeg / 15)) : 0.15);
    const sCap = Number.isFinite(z.occupancyRatio) ? Math.max(0, 1 - z.occupancyRatio) : 0.4;
    const sComms = Number.isFinite(z.radioMarginDb) ? Math.min(1, Math.max(0, (z.radioMarginDb + 10) / 30)) : 0.3;
    const sProx = Number.isFinite(z.etaMinutes) ? Math.max(0, 1 - z.etaMinutes / 60) : 0.4;

    if (sFlood >= 0.6) strengths.push(`margen_cota_HAND_${z.handMarginM}m`);
    else riskFactors.push('margen_inundacion_bajo_o_desconocido');
    if (sFire >= 0.5) strengths.push(`lejos_de_fuego_${z.fireDistanceKm}km`);
    else riskFactors.push('proximidad_a_incendio');
    if (z.wheelchairAccessible) strengths.push('accesible_movilidad_reducida');
    else riskFactors.push('accesibilidad_no_confirmada');
    if (sCap >= 0.4) strengths.push(`capacidad_libre_${Math.round((1 - (z.occupancyRatio ?? 0.6)) * 100)}pct`);
    else riskFactors.push('ocupacion_alta');
    if (sComms >= 0.5) strengths.push('cobertura_malla_radio_positiva');
    else riskFactors.push('cobertura_radio_debil_o_sin_medir');
    if (provenance === 'UNKNOWN' || provenance === 'SIMULATED') riskFactors.push(`procedencia_${provenance}`);

    const rawScore = (
      weights.floodMargin * sFlood +
      weights.fireDistance * sFire +
      weights.airQuality * sAir +
      weights.accessibility * sAccess +
      weights.capacity * sCap +
      weights.comms * sComms +
      weights.proximity * sProx
    ) / wSum;

    // Penalización por baja certidumbre de procedencia
    const provFactor = provenance === 'OBSERVED' ? 1.0 : provenance === 'EXTRACTED' || provenance === 'CALCULATED' ? 0.95 : provenance === 'INFERRED' || provenance === 'PREDICTED' ? 0.85 : 0.7;
    const finalScore = disqualifiedReasons.length ? 0 : +(rawScore * provFactor * 100).toFixed(1);

    return Object.freeze({
      id: z.id,
      name: z.name,
      suitable: disqualifiedReasons.length === 0,
      score100: finalScore,
      provenance,
      disqualifiedReasons,
      strengths,
      riskFactors,
      breakdown: Object.freeze({
        floodMargin: +sFlood.toFixed(2),
        fireDistance: +sFire.toFixed(2),
        airQuality: +sAir.toFixed(2),
        accessibility: +sAccess.toFixed(2),
        capacity: +sCap.toFixed(2),
        comms: +sComms.toFixed(2),
        proximity: +sProx.toFixed(2),
      }),
    });
  });

  scored.sort((a, b) => b.score100 - a.score100);
  return Object.freeze({
    basis: 'MODEL',
    topRecommendations: scored.filter((z) => z.suitable).slice(0, topK),
    allEvaluated: scored,
  });
}

/* ───────────── 3. AOI espacial (círculo/caja/polígono), clustering por zoom y escáner en 1 clic ───────────── */

function pointInPolygon(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // [lon, lat]
    const [xj, yj] = ring[j];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Filtra elementos con `{ lat, lon }` dentro de un AOI `circle`, `bbox` o `polygon`. */
export function filterItemsByAoi(items, aoi) {
  if (!Array.isArray(items)) throw new TypeError('items debe ser array');
  if (!aoi || !aoi.type) throw new RangeError('aoi { type: circle|bbox|polygon } obligatorio');
  return items.filter((it) => {
    const lat = it.lat ?? it.location?.lat;
    const lon = it.lon ?? it.location?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (aoi.type === 'circle') {
      return haversineKm({ lat, lon }, { lat: aoi.lat, lon: aoi.lon }) <= aoi.radiusKm;
    }
    if (aoi.type === 'bbox') {
      const [west, south, east, north] = aoi.bbox;
      return lon >= west && lon <= east && lat >= south && lat <= north;
    }
    if (aoi.type === 'polygon') {
      return Array.isArray(aoi.coordinates) && aoi.coordinates.length >= 3 && pointInPolygon(lat, lon, aoi.coordinates);
    }
    throw new RangeError(`aoi.type desconocido: ${aoi.type}`);
  });
}

const LEVEL_RANK = { N0: 0, N1: 1, N2: 2, N3: 3, N4: 4, N5: 5 };

/** Agrupa incidentes en una rejilla espacial dependiente del nivel de zoom (determinista, sin aleatoriedad). */
export function clusterIncidentsByGrid(items, { zoom = 11, cellFactorDeg = 1.0 } = {}) {
  if (!(zoom >= 1 && zoom <= 22)) throw new RangeError('zoom debe estar en [1, 22]');
  const cellDeg = (360 / Math.pow(2, zoom)) * 0.25 * cellFactorDeg;
  const buckets = new Map();

  for (const it of items ?? []) {
    const lat = it.lat ?? it.location?.lat;
    const lon = it.lon ?? it.location?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const gx = Math.floor(lon / cellDeg);
    const gy = Math.floor(lat / cellDeg);
    const key = `${gx}:${gy}`;
    let b = buckets.get(key);
    if (!b) {
      b = { key, count: 0, sumLat: 0, sumLon: 0, maxLevel: 'N0', items: [] };
      buckets.set(key, b);
    }
    b.count++;
    b.sumLat += lat;
    b.sumLon += lon;
    const lv = it.level ?? 'N0';
    if ((LEVEL_RANK[lv] ?? 0) > (LEVEL_RANK[b.maxLevel] ?? 0)) b.maxLevel = lv;
    b.items.push(it);
  }

  return [...buckets.values()].map((b) => Object.freeze({
    clusterId: b.key,
    lat: +(b.sumLat / b.count).toFixed(5),
    lon: +(b.sumLon / b.count).toFixed(5),
    count: b.count,
    maxLevel: b.maxLevel,
    items: b.items,
  }));
}

/** Escáner situacional en 1 clic sobre el encuadre/AOI visible del comité. */
export function scanViewportSituation({ items = [], shelters = [], aoi, nowIso = new Date().toISOString() }) {
  const inAoi = filterItemsByAoi(items, aoi);
  const sheltersInAoi = filterItemsByAoi(shelters, aoi);
  const byLevel = { N0: 0, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
  const byHazard = {};
  let activeContradictions = 0;

  for (const it of inAoi) {
    const lv = it.level ?? 'N0';
    if (lv in byLevel) byLevel[lv]++;
    const hz = it.hazardType ?? 'otro';
    byHazard[hz] = (byHazard[hz] ?? 0) + 1;
    if (it.hasContradiction || it.confidence === 'CONTRADICTED') activeContradictions++;
  }

  const prioritized = [...inAoi].sort((a, b) => (LEVEL_RANK[b.level ?? 'N0'] ?? 0) - (LEVEL_RANK[a.level ?? 'N0'] ?? 0));
  return Object.freeze({
    scannedAtUtc: nowIso,
    aoiType: aoi.type,
    totalReportsInView: inAoi.length,
    byLevel: Object.freeze(byLevel),
    byHazard: Object.freeze(byHazard),
    activeContradictions,
    sheltersInView: sheltersInAoi.length,
    topPriorityItems: prioritized.slice(0, 5),
    canPublicWarn: false, // Regla inmutable: el escáner resume, nunca emite aviso público
    basis: 'CALCULATED',
  });
}

/* ───────────── 4. Empaquetador de área sin red con SHA-256 y decaimiento de frescura ───────────── */

function canonicalJson(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(val).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(val[k])).join(',') + '}';
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Construye un paquete autocontenido de área de emergencia para operación 100 % sin red,
 * con huella SHA-256 por capa, huella global del manifiesto y control de presupuesto de bytes.
 */
export async function createOfflineAreaPackage({
  areaId,
  bbox,
  createdAtUtc = new Date().toISOString(),
  maxBytesBudget,
  layers,
}) {
  if (!areaId || !Array.isArray(bbox) || bbox.length !== 4) throw new RangeError('areaId y bbox[4] obligatorios');
  if (!Array.isArray(layers) || layers.length === 0) throw new RangeError('layers no vacío obligatorio');
  if (!(maxBytesBudget > 0)) throw new RangeError('maxBytesBudget > 0 obligatorio');

  const manifestLayers = [];
  let totalBytes = 0;

  for (const l of layers) {
    if (!l.id || !Number.isFinite(l.ttlSec) || !(l.ttlSec > 0)) {
      throw new RangeError(`capa '${l.id ?? '?'}': id y ttlSec > 0 obligatorios`);
    }
    const serialized = canonicalJson(l.data);
    const bytes = new TextEncoder().encode(serialized).length;
    totalBytes += bytes;
    const sha256 = await sha256Hex(serialized);
    manifestLayers.push(Object.freeze({
      id: l.id,
      kind: l.kind ?? 'generic',
      provenance: PROVENANCE_LEVELS.includes(l.provenance) ? l.provenance : 'UNKNOWN',
      capturedAtUtc: l.capturedAtUtc ?? createdAtUtc,
      ttlSec: l.ttlSec,
      bytes,
      sha256,
    }));
  }

  if (totalBytes > maxBytesBudget) {
    throw new RangeError(`paquete sin red (${totalBytes} B) excede el presupuesto declarado (${maxBytesBudget} B)`);
  }

  const header = { schema: 'senda.offline-area-pack/v1', areaId, bbox, createdAtUtc, totalBytes, layers: manifestLayers };
  const packageSha256 = await sha256Hex(canonicalJson(header));

  return Object.freeze({
    ...header,
    packageSha256,
    payloads: Object.fromEntries(layers.map((l) => [l.id, l.data])),
  });
}

/** Verifica integridad SHA-256 de cada capa y del manifiesto, y calcula frescura por TTL. */
export async function verifyOfflineAreaPackage(pkg, nowIso = new Date().toISOString()) {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) throw new RangeError('nowIso inválido');

  const layerChecks = [];
  let allIntact = true;
  for (const l of pkg.layers ?? []) {
    const data = pkg.payloads?.[l.id];
    const computed = data !== undefined ? await sha256Hex(canonicalJson(data)) : null;
    const intact = computed === l.sha256;
    if (!intact) allIntact = false;

    const ageSec = Math.max(0, (nowMs - Date.parse(l.capturedAtUtc)) / 1000);
    const stale = ageSec > l.ttlSec;
    // Decaimiento exponencial suave de confianza más allá del TTL (nunca borra el dato sin red)
    const freshnessFactor = stale ? Math.max(0.15, Math.exp(-(ageSec - l.ttlSec) / (2 * l.ttlSec))) : 1.0;
    layerChecks.push(Object.freeze({
      id: l.id,
      intact,
      stale,
      ageSec: Math.round(ageSec),
      ttlSec: l.ttlSec,
      freshnessFactor: +freshnessFactor.toFixed(3),
      effectiveProvenance: stale && l.provenance === 'OBSERVED' ? 'INFERRED' : l.provenance,
    }));
  }

  const header = { schema: pkg.schema, areaId: pkg.areaId, bbox: pkg.bbox, createdAtUtc: pkg.createdAtUtc, totalBytes: pkg.totalBytes, layers: pkg.layers };
  const manifestIntact = (await sha256Hex(canonicalJson(header))) === pkg.packageSha256;
  return Object.freeze({
    valid: allIntact && manifestIntact,
    manifestIntact,
    allLayersIntact: allIntact,
    anyStale: layerChecks.some((c) => c.stale),
    layerChecks,
  });
}

/* ───────────── 5. Registro de salud de fuentes, TTL y degradación honesta ───────────── */

/**
 * Registra el ciclo de vida y frescura de cada fuente de datos (SAIH, AEMET, Copernicus, malla BLE, etc.).
 * Garantiza que un respaldo en caché o simulado nunca se etiquete falsamente como `OBSERVED`.
 */
export function createSourceHealthRegistry(sourceSpecs) {
  const entries = new Map();
  for (const s of sourceSpecs ?? []) {
    if (!s.id || !(s.ttlSec > 0)) throw new RangeError('cada fuente requiere id y ttlSec > 0');
    entries.set(s.id, {
      id: s.id,
      label: s.label ?? s.id,
      ttlSec: s.ttlSec,
      lastOkMs: null,
      lastErrorMs: null,
      lastErrorMsg: null,
      consecutiveFailures: 0,
      lastProvenance: 'UNKNOWN',
    });
  }

  function recordSuccess(id, { atIso = new Date().toISOString(), provenance = 'OBSERVED' } = {}) {
    const e = entries.get(id);
    if (!e) throw new RangeError(`fuente desconocida '${id}'`);
    e.lastOkMs = Date.parse(atIso);
    e.consecutiveFailures = 0;
    e.lastErrorMsg = null;
    e.lastProvenance = PROVENANCE_LEVELS.includes(provenance) ? provenance : 'UNKNOWN';
  }

  function recordFailure(id, { atIso = new Date().toISOString(), error = 'error_recoleccion' } = {}) {
    const e = entries.get(id);
    if (!e) throw new RangeError(`fuente desconocida '${id}'`);
    e.lastErrorMs = Date.parse(atIso);
    e.consecutiveFailures++;
    e.lastErrorMsg = String(error);
  }

  function getStatus(id, nowIso = new Date().toISOString()) {
    const e = entries.get(id);
    if (!e) throw new RangeError(`fuente desconocida '${id}'`);
    const nowMs = Date.parse(nowIso);
    if (e.lastOkMs === null) {
      return Object.freeze({
        id: e.id,
        health: e.consecutiveFailures > 0 ? 'ERROR' : 'UNINITIALIZED',
        effectiveProvenance: 'UNKNOWN',
        degraded: true,
        ageSec: null,
        consecutiveFailures: e.consecutiveFailures,
        lastErrorMsg: e.lastErrorMsg,
      });
    }
    const ageSec = Math.max(0, (nowMs - e.lastOkMs) / 1000);
    const stale = ageSec > e.ttlSec;
    const health = e.consecutiveFailures >= 3 ? 'ERROR' : stale || e.consecutiveFailures > 0 ? 'STALE_DEGRADED' : 'HEALTHY';
    // Regla de degradación honesta: nunca devolver OBSERVED si la fuente está degradada o caducada
    const effectiveProvenance = health === 'HEALTHY'
      ? e.lastProvenance
      : e.lastProvenance === 'OBSERVED' ? 'INFERRED' : e.lastProvenance;

    return Object.freeze({
      id: e.id,
      health,
      effectiveProvenance,
      degraded: health !== 'HEALTHY',
      ageSec: Math.round(ageSec),
      ttlSec: e.ttlSec,
      consecutiveFailures: e.consecutiveFailures,
      lastErrorMsg: e.lastErrorMsg,
    });
  }

  function getSnapshot(nowIso = new Date().toISOString()) {
    const list = [...entries.keys()].map((id) => getStatus(id, nowIso));
    return Object.freeze({
      checkedAtUtc: nowIso,
      healthyCount: list.filter((x) => x.health === 'HEALTHY').length,
      degradedCount: list.filter((x) => x.degraded).length,
      sources: list,
    });
  }

  return Object.freeze({ recordSuccess, recordFailure, getStatus, getSnapshot });
}
