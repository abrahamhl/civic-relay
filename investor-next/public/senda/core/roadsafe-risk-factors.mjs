/**
 * SENDA RoadSafe · Factores de riesgo de colisión secundaria y riesgo vital (explicable, con evidencia).
 *
 * Salida: un ÍNDICE RELATIVO 0–100 (no una probabilidad) y un nivel CRITICAL/HIGH/ELEVATED/MONITOR,
 * con la lista de factores que lo explican, cada uno con su grado de evidencia (roadsafe-evidence.mjs).
 *
 * Diseño:
 *  - La parte FÍSICA se calcula, no se pondera: margen de visibilidad = distancia visible / distancia de
 *    parada a v85 (con adherencia mojada/seca y tiempo de reacción diurno/nocturno). Así noche, niebla,
 *    curva y lluvia entran por la física y no se cuentan dos veces.
 *  - El resto son multiplicadores cuya DIRECCIÓN tiene evidencia (grados B/C/E) y cuya MAGNITUD es una
 *    hipótesis declarada (H) hasta calibrar con datos españoles.
 *  - Datos desconocidos: se calcula el rango (optimista/pesimista) y la prioridad usa el pesimista
 *    (precaución), marcándolo como incierto. Nunca se oculta que falta información.
 *  - El riesgo VITAL (atrapados, fuego, heridos graves, personas en calzada) va aparte y siempre es CRITICAL.
 */
import { stoppingDistance, G } from './roadsafe-secondary-risk.mjs';

export const RISK_MODEL_VERSION = 'roadsafe-risk/1';
const MU = { dry: 0.75, wet: 0.45 };             // rango de manual (requiere medida local)
const PRT = 1.25; // Green (2000), evento inesperado. La noche NO se modela como reacción más lenta (sin fuente):
                  // actúa mediante el factor empírico DARK_SEVERITY (5 países).

/** Margen de visibilidad físico: >1,5 holgado; <1 no se puede parar a tiempo viendo el peligro. */
export function sightMargin({ v85Kmh, sightM, wet = false, night = false }) {
  if (!Number.isFinite(v85Kmh) || !Number.isFinite(sightM)) return null;
  const v = v85Kmh / 3.6, d = stoppingDistance({ vMs: v, reactS: PRT, aEffMs2: 0.9 * (wet ? MU.wet : MU.dry) * G });
  return { ratio: +(sightM / d).toFixed(2), dStopM: Math.round(d), sightM };
}

const known = (x) => x !== null && x !== undefined && !(typeof x === 'number' && !Number.isFinite(x));

/**
 * Multiplicadores (relativos). Cada entrada: valor si se conoce, peor y mejor caso si no.
 * grade: grado de la DIRECCIÓN; la magnitud es H salvo indicación.
 */
function factors(c) {
  const F = [];
  const add = (id, label, value, worst, best, evidence, grade, isKnown) => F.push({ id, label, mult: isKnown ? value : null, worst, best, evidence, grade, known: isKnown });
  const lane = { NONE: 0.7, SHOULDER: 1, PARTIAL: 2, FULL: 3 };
  add('LANE', 'Ocupación de carril', lane[c.laneBlocked] ?? 1, 3, 0.7, 'LANE_BLOCKAGE', 'C', known(c.laneBlocked) && c.laneBlocked in lane);
  add('PEOPLE_OUTSIDE', 'Personas fuera del vehículo', c.peopleOutside ? 2.5 : 1, 2.5, 1, 'ES_PEDESTRIANS_AFTER_EXIT', 'E', known(c.peopleOutside));
  const dur = Math.max(0, Math.min(240, c.durationMin ?? 0));
  add('DURATION', 'Tiempo en escena sin retirar', 1 + Math.min(4, dur / 30), 5, 1, 'DURATION_PER_MIN', 'B', known(c.durationMin));
  const flow = known(c.flowVehH) ? Math.max(0.5, Math.min(2, Math.sqrt(c.flowVehH / 1000))) : null;
  add('FLOW', 'Volumen de tráfico', flow, 2, 0.5, 'TRAFFIC_VOLUME', 'C', flow != null);
  const sm = sightMargin({ v85Kmh: c.v85Kmh ?? c.speedLimitKmh, sightM: Math.min(c.sightM ?? Infinity, c.visibilityM ?? Infinity), wet: !!c.wet, night: !!c.night });
  const smMult = sm == null || !Number.isFinite(sm.ratio) ? null : sm.ratio < 1 ? 3 : sm.ratio < 1.5 ? 1.8 : 1;
  add('SIGHT_MARGIN', `Margen de visibilidad (visible / parada${sm && Number.isFinite(sm.ratio) ? ` = ${sm.ratio}` : ''})`, smMult, 3, 1, 'PRT_GREEN_2000', 'A', smMult != null);
  add('WAITING_TOW', 'Vehículo inmovilizado esperando grúa', c.waitingTow ? 1.5 : 1, 1.5, 1, 'TOWING_REQUIRED', 'B', known(c.waitingTow));
  add('QUEUE', 'Cola formándose', c.queueForming ? 1.5 : 1, 1.5, 1, 'TRAFFIC_VOLUME', 'C', known(c.queueForming));
  add('RESPONDERS', 'Intervinientes expuestos sin vehículo de bloqueo', c.respondersExposed ? 1.3 : 1, 1.3, 1, 'RESPONDER_STRUCK_BY_GAP', 'B', known(c.respondersExposed));
  // OR AJUSTADOS del modelo multivariante (roadsafe-severity-model, 5 países, 2024): oscuridad 1,17; sin alumbrado
  // ×1,54 adicional; madrugada 0–6 h 1,49; arcén 1,55. Sustituyen a los OR univariantes (confundidos).
  add('DARK_SEVERITY', 'Oscuridad (gravedad; OR ajustado 5 países)', c.night ? (c.unlit ? 1.17 * 1.54 : 1.17) : 1, 1.17 * 1.54, 1, 'EMPIRICAL_ADJUSTED_SEVERITY_MODEL', 'A', known(c.night));
  add('NIGHT_HOURS', 'Madrugada 0–6 h (gravedad; OR ajustado)', Number.isFinite(c.hour) ? (c.hour < 6 ? 1.49 : 1) : null, 1.49, 1, 'EMPIRICAL_ADJUSTED_SEVERITY_MODEL', 'A', Number.isFinite(c.hour));
  add('SHOULDER_SEVERITY', 'Accidente en el arcén (gravedad; OR ajustado 1,55)', c.laneBlocked === 'SHOULDER' ? 1.55 : 1, 1.55, 1, 'EMPIRICAL_ADJUSTED_SEVERITY_MODEL', 'A', known(c.laneBlocked));
  add('HEAVY', 'Proporción de pesados (gravedad)', 1 + Math.min(0.5, c.heavyShare ?? 0), 1.5, 1, 'HEAVY_VEHICLE_SEVERITY', 'B', known(c.heavyShare));
  return { F, sm };
}

const index = (P) => Math.round(100 * (1 - Math.exp(-0.02 * P)));
const TIER = (idx, life, secondary) => (life || idx >= 70 ? 'CRITICAL' : secondary || idx >= 40 ? 'HIGH' : idx >= 15 ? 'ELEVATED' : 'MONITOR');

/** Evalúa un incidente. `c`: circunstancias (cualquier campo puede faltar). */
export function assessIncidentRisk(c = {}, { severityModel = null, severityProbability = null } = {}) {
  const life = [];
  if (c.trapped) life.push('personas atrapadas'); if (c.fire) life.push('fuego o humo');
  if (c.injuries === 'SERIOUS') life.push('heridos graves'); if (c.peopleInLane) life.push('personas en la calzada');
  const { F, sm } = factors(c);
  const P = (pick) => F.reduce((s, f) => s * pick(f), 1);
  const pPess = P((f) => (f.known ? f.mult : f.worst)), pOpt = P((f) => (f.known ? f.mult : f.best));
  const idxP = index(pPess), idxO = index(pOpt);
  const secondary = !!c.secondaryCollision;
  const missing = F.filter((f) => !f.known).map((f) => f.id);
  const drivers = F.filter((f) => f.known && f.mult > 1).sort((a, b) => b.mult - a.mult).map((f) => ({ factor: f.id, label: f.label, mult: +f.mult.toFixed(2), evidence: f.evidence, grade: f.grade }));
  return {
    model: RISK_MODEL_VERSION, basis: 'MODEL_UNCALIBRATED_WEIGHTS (dirección con evidencia; magnitudes no calibradas salvo factores empíricos)', index: idxP, indexRange: [idxO, idxP], uncertain: missing.length > 0, missing,
    tier: TIER(idxP, life.length > 0, secondary), tierIfBestCase: TIER(idxO, life.length > 0, secondary),
    lifeRisk: life, secondaryCollision: secondary, drivers, sightMargin: sm,
    severityIfCrash: severityModel && severityProbability ? severityProbability({ light: c.night ? (c.unlit ? 'DARK_UNLIT' : 'DARK_LIT') : c.night === false ? 'DAY' : 'UNKNOWN', surface: c.wet ? 'WET' : c.wet === false ? 'DRY' : 'UNKNOWN', area: c.rural ? 'RURAL' : c.rural === false ? 'URBAN' : 'UNKNOWN', roadClass: c.roadClass ?? 'UNKNOWN', onHardShoulder: c.laneBlocked === 'SHOULDER', stoppedVehicleInvolved: true, collision: c.collision ?? 'UNKNOWN', involves: { hgv: c.hgvInvolved === true, pedestrian: c.peopleInLane === true }, hour: c.hour ?? null, country: c.country ?? 'ES' }, severityModel) : null,
    note: 'Índice relativo para ordenar y explicar, NO probabilidad de accidente. Magnitudes de los multiplicadores: hipótesis a calibrar.',
  };
}

/**
 * Curva de referencia de duración (Khattak et al.): p(t) = p0 + 0,012·t, acotada. Solo para ilustrar el
 * VALOR DE ACORTAR el tiempo en escena; magnitud de un corredor de EE. UU. (grado B, no transferible).
 */
export function durationReferenceCurve({ p0 = 0.02, slopePerMin = 0.012, cap = 0.6, minutes = [0, 10, 20, 30, 45, 60, 90] } = {}) {
  return { evidence: 'DURATION_PER_MIN', grade: 'B', transfer: 'ilustrativa', points: minutes.map((t) => ({ t, p: +Math.min(cap, p0 + slopePerMin * t).toFixed(3) })) };
}

/** Acciones recomendadas por factor (para el operador y el ciudadano; nunca órdenes al conductor que se acerca). */
export function recommendedActions(risk) {
  const A = [];
  if (risk.lifeRisk.length) A.push({ who: 'CIUDADANO', what: 'Llamar al 112 ahora (tel:112).', why: risk.lifeRisk.join(', ') });
  const has = (id) => risk.drivers.some((d) => d.factor === id);
  if (has('PEOPLE_OUTSIDE') || risk.lifeRisk.includes('personas en la calzada')) A.push({ who: 'CIUDADANO', what: 'Salir de la calzada y esperar tras la barrera o lejos del vehículo, fuera de la línea de empuje.', why: 'exposición de peatones (C3, C5)' });
  if (has('LANE') || has('SIGHT_MARGIN')) A.push({ who: 'CENTRO_DE_TRAFICO', what: 'Valorar cierre de carril / aviso en paneles aguas arriba (propuesta, requiere aprobación).', why: 'carril ocupado o visibilidad insuficiente' });
  if (has('QUEUE') || has('FLOW')) A.push({ who: 'CENTRO_DE_TRAFICO', what: 'Aviso de final de cola móvil (la cola crece aguas arriba).', why: 'C6' });
  if (has('WAITING_TOW') || has('DURATION')) A.push({ who: 'ASISTENCIA', what: 'Priorizar la retirada: cada minuto en escena cuenta.', why: 'duración y espera de grúa' });
  if (has('RESPONDERS')) A.push({ who: 'ASISTENCIA', what: 'Vehículo de bloqueo aguas arriba y trabajo desde el lado sin tráfico.', why: 'C7' });
  A.push({ who: 'ASISTENCIA', what: 'Aproximación con antelación y luces de emergencia, deceleración progresiva y detención fuera del carril.', why: 'C4 (caso de investigación) — práctica recomendada a validar' });
  return A;
}
