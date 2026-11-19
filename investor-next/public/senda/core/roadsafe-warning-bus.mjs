/**
 * SENDA RoadSafe · Bus de avisos viales — la carretera como senda principal multidispositivo y multisoftware.
 *
 * Un AVISO CANÓNICO (RoadWarning) entra desde cualquier fuente, se fusiona sin doble conteo y sale por
 * todos los canales disponibles con REFUERZO: el mismo aviso viaja por familias de fallo independientes
 * (red móvil, infraestructura en la vía, radio de corto alcance, vehículo a vehículo) para que la caída
 * de una no lo silencie.
 *
 *   ENTRADA (normalizadores)              FUSIÓN                         SALIDA (adaptadores)
 *   gemelo del incidente ──┐                                        ┌── voz (megafonía SENDA)
 *   DATEX II oficial ──────┤   clave espacial-tipo-calzada          ├── cápsula BLE firmada
 *   trama/cápsula BLE ─────┤   + linaje causal (raíces)   ───────►  ├── DATEX II (operador/autoridad)
 *   parada de servicio ────┤   + confianza = máx. por raíz          ├── CIFS (socio Waze)
 *   plan de zona (cola) ───┤   + caducidad / cierre oficial         ├── DENM (semántico)
 *   detector de accidente ─┤                                        ├── PMV propuesto (centro de tráfico)
 *   punto negro + contexto ┘                                        ├── CAP restringido (autoridades)
 *                                                                   ├── SMS (grupo del viaje / asistencia)
 *                                                                   └── vehículo a vehículo (portadores)
 *
 * Reglas: la confianza nunca sube por acumular pistas de la misma raíz; un canal solo se usa si su
 * autorización existe; el refuerzo se mide en FAMILIAS DE FALLO distintas, no en número de canales.
 */
import { phrase } from './roadsafe-announcer.mjs';
import { encodeHazard, HAZARD } from './road-guard.mjs';

/** Identificador determinista (FNV-1a de 2×32 bits): no criptográfico, solo para deduplicar; funciona en navegador. */
const sha = (s) => { let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x01000193 + 2) >>> 0; } return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'); };

export const WARNING_KINDS = Object.freeze(['STOPPED_VEHICLE_SHOULDER', 'STOPPED_VEHICLE_LANE', 'ACCIDENT', 'SECONDARY_COLLISION', 'QUEUE_TAIL', 'SERVICE_STOPPING', 'PEOPLE_ON_ROAD', 'ROADWORKS', 'FOG', 'ICE', 'OBSTACLE', 'ANIMAL', 'WRONG_WAY', 'CLOSURE', 'HOTSPOT_CONTEXT', 'UNKNOWN_OFFICIAL']);
/** Familias para fusionar: un «vehículo detenido» y un «accidente» en el mismo punto son la misma escena. */
const FAMILY = { STOPPED_VEHICLE_SHOULDER: 'SCENE', STOPPED_VEHICLE_LANE: 'SCENE', ACCIDENT: 'SCENE', SECONDARY_COLLISION: 'SCENE', SERVICE_STOPPING: 'SCENE', PEOPLE_ON_ROAD: 'SCENE', QUEUE_TAIL: 'QUEUE', ROADWORKS: 'WORKS', FOG: 'WEATHER', ICE: 'WEATHER', OBSTACLE: 'OBSTACLE', ANIMAL: 'OBSTACLE', WRONG_WAY: 'WRONG_WAY', CLOSURE: 'CLOSURE', HOTSPOT_CONTEXT: 'CONTEXT', UNKNOWN_OFFICIAL: 'OTHER' };
/** Gravedad de presentación entre tipos de la misma escena (el más grave da el texto). */
const KIND_RANK = { SECONDARY_COLLISION: 6, PEOPLE_ON_ROAD: 5, ACCIDENT: 4, STOPPED_VEHICLE_LANE: 3, SERVICE_STOPPING: 2, STOPPED_VEHICLE_SHOULDER: 1 };
export const TRUST_LEVELS = Object.freeze(['UNVERIFIED_HINT', 'CORROBORATED_CROWD', 'SIGNED_PEER', 'OFFICIAL_FEED', 'AUTHORITY_VERIFIED']);
const TRUST_RANK = Object.fromEntries(TRUST_LEVELS.map((t, i) => [t, i]));
const CEILING = { UNVERIFIED_HINT: 'ADVISORY', CORROBORATED_CROWD: 'ADVISORY', SIGNED_PEER: 'ADVISORY', OFFICIAL_FEED: 'WARNING', AUTHORITY_VERIFIED: 'WARNING' };

const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

/** Construye un aviso canónico validado. */
export function makeWarning({ kind, lat, lon, roadId = null, dir = null, carriageway = 'UNKNOWN', s = null, validFrom, validUntil, trust, lineage, extentM = 0, severityIfCrash = null, privacy = 'PUBLIC', text = null }) {
  if (!WARNING_KINDS.includes(kind)) throw new Error(`tipo de aviso desconocido: ${kind}`);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('aviso sin posición válida');
  if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validUntil <= validFrom) throw new Error('aviso sin validez temporal coherente');
  if (!TRUST_LEVELS.includes(trust)) throw new Error(`nivel de confianza desconocido: ${trust}`);
  if (!Array.isArray(lineage) || !lineage.length || lineage.some((l) => !l.root || !l.source)) throw new Error('aviso sin linaje (fuente + raíz causal)');
  return { schema: 'senda-road-warning/1', kind, family: FAMILY[kind], point: { lat, lon }, road: { roadId, dir, carriageway, s }, extentM, validFrom, validUntil, trust, ceiling: CEILING[trust], lineage, severityIfCrash, privacy, text };
}

// ------------------------------------------------------------------ Normalizadores de entrada
/** Gemelo del incidente (vista pública) → aviso. */
export function fromIncidentTwin(pv, { now, ttlS = 3600, road = {} } = {}) {
  const st = pv.state, lane = pv.location.lane;
  const kind = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(st) ? 'SECONDARY_COLLISION' : lane === 'SHOULDER' ? 'STOPPED_VEHICLE_SHOULDER' : 'STOPPED_VEHICLE_LANE';
  const trust = pv.confidence?.status === 'CORROBORATED' ? 'CORROBORATED_CROWD' : 'UNVERIFIED_HINT';
  return makeWarning({ kind, lat: pv.location.lat, lon: pv.location.lon, roadId: pv.location.roadId, dir: pv.location.dir, carriageway: road.carriageway ?? (pv.location.dir != null ? 'KNOWN_DIRECTION' : 'UNKNOWN'), validFrom: now, validUntil: now + ttlS, trust, lineage: (pv.sources ?? ['SENDA']).map((src) => ({ source: `TWIN:${src}`, root: `INCIDENT:${pv.id}`, at: now })) });
}
/** Peligro DATEX II (salida de toHazards) → aviso oficial. Sin tipo conocido ⇒ UNKNOWN_OFFICIAL (informativo). */
const DATEX_KIND = { [HAZARD.CRASH]: 'ACCIDENT', [HAZARD.STOPPED]: 'STOPPED_VEHICLE_LANE', [HAZARD.QUEUE]: 'QUEUE_TAIL', [HAZARD.WORKS]: 'ROADWORKS', [HAZARD.FOG]: 'FOG', [HAZARD.ICE]: 'ICE', [HAZARD.OBSTACLE]: 'OBSTACLE', [HAZARD.ANIMAL]: 'ANIMAL', [HAZARD.LANE_CLOSED]: 'CLOSURE' };
export function fromDatexHazard(h, { now, ttlS = 1800, publisher = 'NAP' } = {}) {
  const kind = h.type == null ? 'UNKNOWN_OFFICIAL' : DATEX_KIND[h.type] ?? 'UNKNOWN_OFFICIAL';
  const end = h.end ? Date.parse(h.end) / 1000 : null;
  return makeWarning({ kind, lat: h.lat, lon: h.lon, roadId: h.road ?? null, carriageway: h.carriageway ?? 'UNKNOWN', validFrom: now, validUntil: Number.isFinite(end) && end > now ? end : now + ttlS, trust: h.confirmed ? 'OFFICIAL_FEED' : 'UNVERIFIED_HINT', lineage: [{ source: `DATEX2:${publisher}`, root: `DATEX2:${h.id}`, at: now }] });
}
/** Evaluación de trama/cápsula BLE (assessHazardFrame) → aviso de par. Rechazos y duplicados no entran. */
const FRAME_KIND = { BRAKE: 'QUEUE_TAIL', CRASH: 'ACCIDENT', STOPPED: 'STOPPED_VEHICLE_LANE', OBSTACLE: 'OBSTACLE', ANIMAL: 'ANIMAL', FOG: 'FOG', ICE: 'ICE', QUEUE: 'QUEUE_TAIL', WORKS: 'ROADWORKS', SOS: 'ACCIDENT', LANE_CLOSED: 'CLOSURE', WRONG_WAY: 'WRONG_WAY' };
export function fromFrameAssessment(a, { now, ttlS = 120 } = {}) {
  if (!a || !['UNVERIFIED_PEER_HINT', 'SIGNED_PEER', 'AUTHORITY_VERIFIED'].includes(a.trust)) return null;
  const h = a.hazard, serviceStop = (h.flags & 0x01) !== 0;
  const kind = serviceStop ? 'SERVICE_STOPPING' : FRAME_KIND[h.kind] ?? null; if (!kind) return null;
  const trust = a.trust === 'AUTHORITY_VERIFIED' ? 'AUTHORITY_VERIFIED' : a.trust === 'SIGNED_PEER' ? 'SIGNED_PEER' : 'UNVERIFIED_HINT';
  return makeWarning({ kind, lat: h.lat, lon: h.lon, validFrom: now, validUntil: now + ttlS, trust, lineage: [{ source: `BLE:${a.keyId ?? 'unsigned'}`, root: h.id ? `EVENT:${h.id}` : `BLE:${a.eventKey}`, at: now }] });
}
/** Plan de zona → aviso de final de cola (si se calculó la cola) con su extensión. */
export function fromZonePlan(plan, { now, ttlS = 600, tail } = {}) {
  if (!plan.queue?.forms || !plan.queue.nowM || !tail) return null;
  return makeWarning({ kind: 'QUEUE_TAIL', lat: tail.lat, lon: tail.lon, roadId: plan.roadId, dir: plan.dir, carriageway: 'SAME', validFrom: now, validUntil: now + ttlS, trust: 'UNVERIFIED_HINT', extentM: plan.queue.nowM, lineage: [{ source: 'ZONE_MODEL', root: `ZONE:${plan.roadId}:${plan.incidentS}`, at: now }], text: 'modelo de cola (parámetros declarados)' });
}
/** Detector de accidente → aviso SOLO si el usuario confirmó o no respondió tras la cuenta atrás. */
export function fromCrashDetection(det, { now, fix, userConfirmed = false, countdownExpired = false, ttlS = 1800, deviceRoot }) {
  if (!(det.state === 'LIKELY_CRASH' || det.state === 'CHECK_USER') || !(userConfirmed || countdownExpired) || !fix) return null;
  return makeWarning({ kind: 'ACCIDENT', lat: fix.lat, lon: fix.lon, validFrom: now, validUntil: now + ttlS, trust: 'UNVERIFIED_HINT', lineage: [{ source: userConfirmed ? 'DETECTOR+USER' : 'DETECTOR+NO_RESPONSE', root: `DEVICE:${deviceRoot}`, at: now }] });
}
/**
 * Punto negro + condiciones actuales → aviso contextual informativo. Solo si la probabilidad de desenlace
 * mortal en estas condiciones (modelo publicado) supera `minSeverityP` declarado: evita saturar.
 */
export function fromHotspotContext(h, { now, severityP, minSeverityP, ttlS = 900 }) {
  if (!Number.isFinite(minSeverityP)) throw new Error('fromHotspotContext exige minSeverityP declarado');
  if (!h.centroid || !Number.isFinite(severityP) || severityP < minSeverityP) return null;
  return makeWarning({ kind: 'HOTSPOT_CONTEXT', lat: h.centroid.lat, lon: h.centroid.lon, validFrom: now, validUntil: now + ttlS, trust: 'OFFICIAL_FEED', severityIfCrash: severityP, lineage: [{ source: 'DATASET_EB_HOTSPOT', root: `HOTSPOT:${h.cell}`, at: now }], text: `tramo con historial de accidentes (Bayes empírico ${h.ebExpected})` });
}

// ------------------------------------------------------------------ Fusión
/**
 * Bus: ingesta con fusión espacial (misma familia, misma vía/sentido si se conocen, a < `mergeM`) y unión de
 * linaje; la confianza resultante es la MÁXIMA de las raíces, y dos raíces independientes de multitud elevan a
 * CORROBORATED_CROWD (nunca a oficial).
 */
export function createWarningBus({ mergeM = 300 } = {}) {
  const items = new Map(), log = [];
  const keyOf = (w) => `W-${sha(`${w.family}|${w.road.roadId ?? ''}|${w.road.dir ?? ''}|${w.point.lat.toFixed(4)}|${w.point.lon.toFixed(4)}`).slice(0, 16)}`;
  function match(w) {
    for (const [id, x] of items) {
      if (x.family !== w.family) continue;
      if (x.road.roadId && w.road.roadId && x.road.roadId !== w.road.roadId) continue;
      if (x.road.dir != null && w.road.dir != null && x.road.dir !== w.road.dir) continue;
      if (distM(x.point, w.point) <= mergeM + (x.extentM ?? 0)) return id;
    }
    return null;
  }
  return {
    ingest(w, { now }) {
      if (!w) return { ok: false, error: 'aviso vacío' };
      const id = match(w);
      if (!id) { const nid = keyOf(w); items.set(nid, { ...w, warningId: nid, createdAt: now, updatedAt: now }); log.push({ at: now, op: 'NEW', id: nid, source: w.lineage[0].source }); return { ok: true, id: nid, merged: false }; }
      const x = items.get(id), roots = new Map(x.lineage.map((l) => [`${l.root}|${l.source}`, l]));
      for (const l of w.lineage) roots.set(`${l.root}|${l.source}`, l);
      x.lineage = [...roots.values()];
      const independentRoots = new Set(x.lineage.map((l) => l.root)).size;
      let trust = TRUST_RANK[w.trust] > TRUST_RANK[x.trust] ? w.trust : x.trust;
      if (trust === 'UNVERIFIED_HINT' && independentRoots >= 2) trust = 'CORROBORATED_CROWD';
      x.trust = trust; x.ceiling = CEILING[trust];
      if ((KIND_RANK[w.kind] ?? 0) > (KIND_RANK[x.kind] ?? 0)) x.kind = w.kind;
      x.validUntil = Math.max(x.validUntil, w.validUntil); x.updatedAt = now; x.extentM = Math.max(x.extentM ?? 0, w.extentM ?? 0);
      x.road = { ...x.road, roadId: x.road.roadId ?? w.road.roadId, dir: x.road.dir ?? w.road.dir, carriageway: x.road.carriageway === 'UNKNOWN' ? w.road.carriageway : x.road.carriageway };
      if (w.severityIfCrash != null) x.severityIfCrash = w.severityIfCrash;
      log.push({ at: now, op: 'MERGE', id, source: w.lineage[0].source, independentRoots });
      return { ok: true, id, merged: true, independentRoots };
    },
    /** Cierre oficial (fin de validez de la fuente oficial o autoridad): retira el aviso, no lo borra del registro. */
    close(id, { now, by }) { const x = items.get(id); if (!x) return { ok: false }; if (!['OFFICIAL_FEED', 'AUTHORITY_VERIFIED', 'OPERATOR'].includes(by)) return { ok: false, error: 'solo una fuente oficial u operador cierra' }; x.validUntil = now; x.closedBy = by; log.push({ at: now, op: 'CLOSE', id, by }); return { ok: true }; },
    active(now) { return [...items.values()].filter((x) => x.validUntil > now); },
    get: (id) => items.get(id) ?? null, log,
  };
}

// ------------------------------------------------------------------ Salida: adaptadores y refuerzo
/**
 * Canales y su familia de fallo (shared-risk group): si la red móvil cae, caen a la vez la app online, el feed
 * a navegadores y el SMS; los paneles en la vía, el BLE y el vehículo a vehículo no dependen de ella.
 */
export const CHANNELS = Object.freeze({
  VOICE_APP: { failureFamily: 'DEVICE_LOCAL', authorization: 'NONE', reaches: 'conductores con SENDA' },
  BLE_CAPSULE: { failureFamily: 'SHORT_RANGE_RADIO', authorization: 'SIGNING_KEY', reaches: 'vehículos con SENDA a ~cientos de m (alcance no medido)' },
  V2V_CARRY: { failureFamily: 'VEHICLE_TO_VEHICLE', authorization: 'NONE', reaches: 'conductores con SENDA aguas arriba, vía portadores del sentido contrario' },
  DATEX2_PUBLISH: { failureFamily: 'CELLULAR_INTERNET', authorization: 'NAP_PUBLISHER', reaches: 'consumidores del NAP' },
  DGT30: { failureFamily: 'CELLULAR_INTERNET', authorization: 'DGT30_REGISTRATION_X509', reaches: 'navegadores/servicios conectados a DGT 3.0 (cuáles: por verificar)' },
  CIFS_WAZE: { failureFamily: 'CELLULAR_INTERNET', authorization: 'WAZE_PARTNER', reaches: 'usuarios de Waze' },
  DENM: { failureFamily: 'C_ITS', authorization: 'C_ITS_STATION_PKI', reaches: 'vehículos C-ITS (minoría)' },
  VMS_PROPOSAL: { failureFamily: 'ROADSIDE_INFRA', authorization: 'TRAFFIC_CENTRE_APPROVAL', reaches: 'todos los que pasan por el panel' },
  CAP_RESTRICTED: { failureFamily: 'CELLULAR_INTERNET', authorization: 'AUTHORITY_AGREEMENT', reaches: 'sala 112 / autoridades' },
  SMS_GROUP: { failureFamily: 'CELLULAR_SMS', authorization: 'CONSENT', reaches: 'grupo del viaje / asistencia' },
});
const HZ = { STOPPED_VEHICLE_SHOULDER: HAZARD.STOPPED, STOPPED_VEHICLE_LANE: HAZARD.STOPPED, ACCIDENT: HAZARD.CRASH, SECONDARY_COLLISION: HAZARD.CRASH, QUEUE_TAIL: HAZARD.QUEUE, SERVICE_STOPPING: HAZARD.STOPPED, PEOPLE_ON_ROAD: HAZARD.SOS, ROADWORKS: HAZARD.WORKS, FOG: HAZARD.FOG, ICE: HAZARD.ICE, OBSTACLE: HAZARD.OBSTACLE, ANIMAL: HAZARD.ANIMAL, WRONG_WAY: HAZARD.WRONG_WAY, CLOSURE: HAZARD.LANE_CLOSED };
const VOICE_KIND = { STOPPED_VEHICLE_SHOULDER: 'STOPPED_SHOULDER', STOPPED_VEHICLE_LANE: 'STOPPED_LANE', ACCIDENT: 'ACCIDENT', SECONDARY_COLLISION: 'ACCIDENT', QUEUE_TAIL: 'QUEUE_TAIL', SERVICE_STOPPING: 'SERVICE_STOPPING', PEOPLE_ON_ROAD: 'PEOPLE_ON_ROAD' };

/**
 * Plan de difusión: para cada canal, ¿es elegible?, ¿por qué no?, carga útil; y el refuerzo resultante en
 * familias de fallo distintas. authorizations: lista de autorizaciones que REALMENTE existen hoy.
 */
export function planFanOut(w, { now, authorizations = [], consents = [], available = Object.keys(CHANNELS), lang = 'es', distanceForVoiceM = 1000 } = {}) {
  const rows = [];
  for (const ch of available) {
    const c = CHANNELS[ch]; if (!c) continue;
    let eligible = true, why = null, payload = null;
    if (c.authorization === 'CONSENT' && !consents.includes(ch)) { eligible = false; why = 'sin consentimiento del grupo/destinatario'; }
    else if (c.authorization !== 'NONE' && c.authorization !== 'CONSENT' && !authorizations.includes(c.authorization)) { eligible = false; why = `sin autorización (${c.authorization})`; }
    if (w.validUntil <= now) { eligible = false; why = 'aviso caducado'; }
    if (eligible && w.kind === 'HOTSPOT_CONTEXT' && !['VOICE_APP'].includes(ch)) { eligible = false; why = 'aviso contextual: solo en la app, nunca en paneles ni feeds'; }
    if (eligible && w.privacy !== 'PUBLIC' && !['CAP_RESTRICTED', 'SMS_GROUP'].includes(ch)) { eligible = false; why = 'aviso restringido'; }
    if (eligible && ['VMS_PROPOSAL', 'DATEX2_PUBLISH', 'DGT30', 'CIFS_WAZE'].includes(ch) && w.ceiling !== 'WARNING' && w.trust !== 'CORROBORATED_CROWD') { eligible = false; why = 'confianza insuficiente para canales públicos de terceros'; }
    if (eligible) {
      switch (ch) {
        case 'VOICE_APP': payload = VOICE_KIND[w.kind] ? phrase({ kind: VOICE_KIND[w.kind], distanceM: distanceForVoiceM, lang }) : w.text; break;
        case 'BLE_CAPSULE': payload = HZ[w.kind] != null ? { frame: Array.from(encodeHazard({ type: HZ[w.kind], t: Math.floor(now), lat: w.point.lat, lon: w.point.lon, id: parseInt(w.warningId?.slice(2, 10) ?? '0', 16) >>> 0, flags: w.kind === 'SERVICE_STOPPING' ? 0x01 : 0 })), note: 'firmar con signHazardCapsule antes de emitir' } : null; if (!payload) { eligible = false; why = 'tipo sin trama BLE'; } break;
        case 'VMS_PROPOSAL': payload = { status: 'PROPOSED_FOR_OPERATOR_APPROVAL', lines: [({ QUEUE_TAIL: 'RETENCION', ACCIDENT: 'ACCIDENTE', SECONDARY_COLLISION: 'ACCIDENTE' })[w.kind] ?? 'VEH. DETENIDO', 'PRECAUCION'] }; break;
        case 'SMS_GROUP': payload = `SENDA: ${w.kind} ${w.road.roadId ?? ''} ${w.point.lat.toFixed(5)},${w.point.lon.toFixed(5)}`.slice(0, 160); break;
        default: payload = { contract: ch, warningId: w.warningId };
      }
    }
    rows.push({ channel: ch, failureFamily: c.failureFamily, eligible, why, reaches: c.reaches, payload });
  }
  const families = [...new Set(rows.filter((r) => r.eligible).map((r) => r.failureFamily))];
  return { warningId: w.warningId, rows, reinforcement: { families, count: families.length, survivesCellularOutage: families.some((f) => !['CELLULAR_INTERNET', 'CELLULAR_SMS'].includes(f)) }, note: 'El refuerzo cuenta familias de fallo independientes, no canales.' };
}

/**
 * Propagación vehículo a vehículo aguas arriba mediante portadores del sentido contrario (sin red).
 * Portadores con SENDA pasan por la escena a tasa λ = q_opp·p (Poisson); cada uno entrega al vehículo que se
 * acerca con probabilidad de contacto c. Tiempo hasta la primera entrega exitosa ≈ Exp(λ·c) + tiempo de cruce
 * D/(v + v_opp). TODOS los parámetros deben declararse (no hay valores por defecto).
 */
export function v2vUpstreamDelivery({ distanceM, oppositeFlowVehH, penetration, contactProb, vApproachMs, vOppositeMs, horizonS }) {
  const P = { distanceM, oppositeFlowVehH, penetration, contactProb, vApproachMs, vOppositeMs, horizonS };
  for (const [k, v] of Object.entries(P)) if (!Number.isFinite(v) || v < 0) throw new Error(`v2vUpstreamDelivery: «${k}» debe declararse`);
  const lambda = (oppositeFlowVehH / 3600) * penetration * contactProb, tMeet = distanceM / Math.max(0.1, vApproachMs + vOppositeMs);
  const pWithin = lambda > 0 && horizonS > tMeet ? 1 - Math.exp(-lambda * (horizonS - tMeet)) : 0;
  return { basis: 'MODEL (Poisson, parámetros declarados)', expectedDelayS: lambda > 0 ? +(1 / lambda + tMeet).toFixed(1) : null, pDeliveredWithinHorizon: +pWithin.toFixed(4), targetMustHaveSenda: true, effectiveCoverageOfApproaching: penetration };
}
