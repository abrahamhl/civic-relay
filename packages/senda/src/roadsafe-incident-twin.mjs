/**
 * SENDA RoadSafe · Road Incident Digital Twin — un incidente lógico único, auditable e idempotente.
 *
 * - Identificador canónico estable (SHA-256 de la primera observación) y correlación entre fuentes.
 * - Ubicación: coordenadas, carretera, sentido, PK, calzada y carril PROBABLE (con probabilidad).
 * - Observaciones con procedencia, hora del evento y hora de recepción; deduplicación por `obsId`.
 * - Confianza explícita (roadsafe-correlation.mjs, sin doble conteo de fuentes derivadas).
 * - Máquina de estados con AUTORIDADES: cada transición declara qué tipo de actor puede provocarla
 *   y qué prueba exige. Un proveedor HTTP 200 no es «en camino»; un ciudadano no resuelve una escalada.
 * - Caducidad (STALE) por falta de actualizaciones; reactivación con nueva observación.
 * - Registro de auditoría encadenado por huellas SHA-256 y claves de idempotencia.
 * - Separación estricta: `publicView` (tráfico) nunca incluye datos personales; `protectedView`
 *   exige propósito declarado y se registra en la auditoría.
 */
import { fuseRoadEvidence, correlateObservations } from './roadsafe-correlation.mjs';

const enc = new TextEncoder();
const sha256 = async (s) => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', enc.encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
const canon = (v) => (v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`);

export const INCIDENT_STATES = Object.freeze(['DETECTED', 'UNVERIFIED', 'CORROBORATED', 'ASSISTANCE_REQUESTED', 'PARTNER_ACKNOWLEDGED', 'ASSISTANCE_ON_SCENE', 'SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED', 'RESOLVED', 'STALE', 'DISPUTED']);
export const ACTOR_KINDS = Object.freeze(['SYSTEM', 'DEVICE', 'OWNER', 'CITIZEN', 'PEER', 'OFFICIAL_SOURCE', 'PROVIDER', 'OPERATOR', 'EMERGENCY_SERVICE']);
const VERIFIED_KINDS = new Set(['OFFICIAL_SOURCE', 'PROVIDER', 'OPERATOR', 'EMERGENCY_SERVICE']);
const ACTIVE = ['DETECTED', 'UNVERIFIED', 'CORROBORATED', 'ASSISTANCE_REQUESTED', 'PARTNER_ACKNOWLEDGED', 'ASSISTANCE_ON_SCENE', 'DISPUTED'];
const ESCALATED = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'];

/**
 * Tabla de transiciones: from → to, quién (tipos de actor) y prueba requerida.
 * requires: 'INDEPENDENT_CORROBORATION' | 'PARTNER_REFERENCE' | 'VERIFIED_ACTOR' | null.
 */
export const TRANSITIONS = Object.freeze([
  { from: ['DETECTED'], to: 'UNVERIFIED', by: ['SYSTEM', 'DEVICE', 'OWNER', 'CITIZEN', 'PEER'] },
  { from: ['DETECTED', 'UNVERIFIED', 'STALE'], to: 'CORROBORATED', by: ['SYSTEM', 'OFFICIAL_SOURCE', 'OPERATOR', 'EMERGENCY_SERVICE'], requires: 'INDEPENDENT_CORROBORATION' },
  { from: ['DETECTED', 'UNVERIFIED', 'CORROBORATED'], to: 'ASSISTANCE_REQUESTED', by: ['OWNER', 'OPERATOR'] },
  { from: ['ASSISTANCE_REQUESTED'], to: 'PARTNER_ACKNOWLEDGED', by: ['PROVIDER'], requires: 'PARTNER_REFERENCE' },
  { from: ['PARTNER_ACKNOWLEDGED'], to: 'ASSISTANCE_ON_SCENE', by: ['PROVIDER', 'EMERGENCY_SERVICE', 'OWNER'] },
  { from: [...ACTIVE], to: 'SECONDARY_COLLISION_SUSPECTED', by: ['DEVICE', 'OWNER', 'CITIZEN', 'PEER', 'OFFICIAL_SOURCE', 'OPERATOR', 'EMERGENCY_SERVICE', 'PROVIDER'] },
  { from: [...ACTIVE, 'SECONDARY_COLLISION_SUSPECTED'], to: 'EMERGENCY_ESCALATION_REQUIRED', by: ['SYSTEM', 'OWNER', 'CITIZEN', 'OPERATOR', 'EMERGENCY_SERVICE', 'PROVIDER', 'DEVICE'] },
  { from: ['DETECTED', 'UNVERIFIED', 'CORROBORATED', 'ASSISTANCE_REQUESTED', 'PARTNER_ACKNOWLEDGED', 'ASSISTANCE_ON_SCENE'], to: 'DISPUTED', by: ['SYSTEM', 'OPERATOR', 'OFFICIAL_SOURCE'] },
  { from: ['DISPUTED'], to: 'UNVERIFIED', by: ['OPERATOR', 'OFFICIAL_SOURCE', 'EMERGENCY_SERVICE'] },
  { from: ['DISPUTED'], to: 'CORROBORATED', by: ['OPERATOR', 'OFFICIAL_SOURCE', 'EMERGENCY_SERVICE'], requires: 'VERIFIED_ACTOR' },
  // Resolver sin escalada: el propio afectado, el proveedor que terminó, fuente oficial u operador.
  { from: ['DETECTED', 'UNVERIFIED', 'CORROBORATED', 'ASSISTANCE_REQUESTED', 'PARTNER_ACKNOWLEDGED', 'ASSISTANCE_ON_SCENE', 'DISPUTED', 'STALE'], to: 'RESOLVED', by: ['OWNER', 'PROVIDER', 'OFFICIAL_SOURCE', 'OPERATOR', 'EMERGENCY_SERVICE'] },
  // Tras accidente secundario o escalada, SOLO un servicio verificado u operador cierra.
  { from: [...ESCALATED], to: 'RESOLVED', by: ['EMERGENCY_SERVICE', 'OPERATOR'], requires: 'VERIFIED_ACTOR' },
  { from: ['DETECTED', 'UNVERIFIED', 'CORROBORATED', 'ASSISTANCE_REQUESTED', 'PARTNER_ACKNOWLEDGED', 'DISPUTED'], to: 'STALE', by: ['SYSTEM'] },
  { from: ['STALE'], to: 'UNVERIFIED', by: ['SYSTEM', 'DEVICE', 'OWNER', 'CITIZEN', 'PEER', 'OFFICIAL_SOURCE'] },
]);

export function allowedTransition(from, to, actorKind) {
  return TRANSITIONS.find((t) => t.to === to && t.from.includes(from) && t.by.includes(actorKind)) ?? null;
}

async function appendAudit(inc, entry) {
  const prev = inc.audit.length ? inc.audit[inc.audit.length - 1].hash : '0'.repeat(64);
  const body = { seq: inc.audit.length, prev, ...entry };
  inc.audit.push({ ...body, hash: await sha256(canon(body)) });
}
export async function verifyAudit(inc) {
  let prev = '0'.repeat(64);
  for (let i = 0; i < inc.audit.length; i++) {
    const { hash, ...body } = inc.audit[i];
    if (body.seq !== i || body.prev !== prev || (await sha256(canon(body))) !== hash) return { ok: false, brokenAt: i };
    prev = hash;
  }
  return { ok: true, length: inc.audit.length, head: prev };
}

const PERSONAL_KEYS = ['name', 'phone', 'plate', 'insurancePolicy', 'medical', 'email', 'passengers', 'reporterId', 'ownerId'];
const stripPersonal = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !PERSONAL_KEYS.includes(k)));

/**
 * Crea un incidente a partir de la primera observación.
 * obs: { obsId, source, at, receivedAt?, lat, lon, accuracyM?, roadId?, dir?, pk?, laneHint?, present?, rootHint?, reporterId? }
 */
export async function createIncident(firstObs, { now, ttlS = 3600, kind = 'BREAKDOWN', owner = null } = {}) {
  if (!Number.isFinite(now)) throw new Error('createIncident: se requiere reloj');
  if (!firstObs?.obsId || !Number.isFinite(firstObs.lat) || !Number.isFinite(firstObs.lon)) throw new Error('createIncident: observación inválida');
  const id = 'RS-' + (await sha256(canon({ s: firstObs.source, o: firstObs.obsId, t: firstObs.at, la: firstObs.lat.toFixed(5), lo: firstObs.lon.toFixed(5) }))).slice(0, 16);
  const inc = {
    schema: 'senda-roadsafe-incident/1', id, kind, state: 'DETECTED', createdAt: now, updatedAt: now, ttlS,
    location: { lat: firstObs.lat, lon: firstObs.lon, accuracyM: firstObs.accuracyM ?? null, roadId: firstObs.roadId ?? null, dir: firstObs.dir ?? null, pk: firstObs.pk ?? null, carriageway: firstObs.dir != null ? 'KNOWN' : 'UNKNOWN', lane: laneBelief(firstObs.laneHint) },
    observations: [], confidence: null, assistance: [], affected: { status: 'UNKNOWN', confirmedBy: null },
    protected: { owner: owner ? { ...owner } : null }, idempotency: new Set(), audit: [], stateBeforeStale: null,
  };
  await appendAudit(inc, { at: now, op: 'CREATE', actor: { kind: 'SYSTEM' }, state: 'DETECTED', data: { kind, firstObs: stripPersonal(firstObs) } });
  await observe(inc, firstObs, { now });
  return inc;
}

/** Carril probable: sin pista, distribución vaga; 'SHOULDER' con V16 en arcén es solo una pista, no una medida. */
export function laneBelief(hint) {
  if (hint === 'SHOULDER') return { mostLikely: 'SHOULDER', p: 0.6, basis: 'PISTA_DECLARADA_NO_MEDIDA' };
  if (hint === 'RIGHT_LANE') return { mostLikely: 'RIGHT_LANE', p: 0.6, basis: 'PISTA_DECLARADA_NO_MEDIDA' };
  return { mostLikely: 'UNKNOWN', p: null, basis: 'SIN_DATOS' };
}

/** Añade una observación (idempotente por obsId) y recalcula confianza; puede promover o disputar. */
export async function observe(inc, obs, { now } = {}) {
  if (inc.observations.some((o) => o.obsId === obs.obsId)) return { ok: true, duplicate: true };
  if (!Number.isFinite(obs.at) || obs.at > now + 5) return { ok: false, error: 'observación con hora futura o ausente' };
  inc.observations.push({ ...obs, receivedAt: obs.receivedAt ?? now });
  inc.updatedAt = now;
  await appendAudit(inc, { at: now, op: 'OBSERVE', actor: { kind: 'SYSTEM' }, data: stripPersonal(obs) });
  inc.confidence = fuseRoadEvidence(inc.observations, { now });
  if (inc.state === 'STALE') await transition(inc, 'UNVERIFIED', { actor: { kind: 'SYSTEM' }, now, reason: 'nueva observación tras caducidad' });
  if (inc.state === 'DETECTED') await transition(inc, 'UNVERIFIED', { actor: { kind: 'SYSTEM' }, now, reason: 'clasificación inicial' });
  if (inc.state === 'UNVERIFIED' && inc.confidence.status === 'CORROBORATED') await transition(inc, 'CORROBORATED', { actor: { kind: 'SYSTEM' }, now, reason: `corroboración: ${inc.confidence.independentRoots} raíces independientes, p=${inc.confidence.p}` });
  if (inc.confidence.status === 'DISPUTED' && allowedTransition(inc.state, 'DISPUTED', 'SYSTEM')) await transition(inc, 'DISPUTED', { actor: { kind: 'SYSTEM' }, now, reason: `contradicción ${inc.confidence.contradiction}` });
  return { ok: true, duplicate: false, confidence: inc.confidence };
}

/**
 * Transición autorizada e idempotente.
 * actor: { kind, id?, verified?:boolean } — los tipos verificados (PROVIDER, OPERATOR, …) DEBEN traer verified:true
 * (autenticación hecha por la capa de transporte/credenciales; aquí solo se exige la marca).
 */
export async function transition(inc, to, { actor, now, reason = '', reference = null, idempotencyKey = null, evidence = null } = {}) {
  if (!INCIDENT_STATES.includes(to)) return { ok: false, error: `estado desconocido ${to}` };
  if (!actor || !ACTOR_KINDS.includes(actor.kind)) return { ok: false, error: 'actor desconocido' };
  if (idempotencyKey && inc.idempotency.has(idempotencyKey)) return { ok: true, idempotent: true, state: inc.state };
  if (VERIFIED_KINDS.has(actor.kind) && actor.verified !== true) return { ok: false, error: `${actor.kind} sin credencial verificada` };
  if (inc.state === 'RESOLVED') return { ok: false, error: 'incidente cerrado' };
  const rule = allowedTransition(inc.state, to, actor.kind);
  if (!rule) return { ok: false, error: `${actor.kind} no puede pasar de ${inc.state} a ${to}` };
  if (rule.requires === 'PARTNER_REFERENCE' && !(typeof reference === 'string' && reference.trim())) return { ok: false, error: 'se exige referencia de expediente del proveedor' };
  if (rule.requires === 'VERIFIED_ACTOR' && actor.verified !== true) return { ok: false, error: 'se exige actor verificado' };
  if (rule.requires === 'INDEPENDENT_CORROBORATION' && actor.kind === 'SYSTEM' && inc.confidence?.status !== 'CORROBORATED') return { ok: false, error: 'sin corroboración independiente suficiente' };
  const from = inc.state;
  if (to === 'STALE') inc.stateBeforeStale = from;
  inc.state = to; inc.updatedAt = now;
  if (idempotencyKey) inc.idempotency.add(idempotencyKey);
  await appendAudit(inc, { at: now, op: 'TRANSITION', actor: { kind: actor.kind, id: actor.id ?? null }, from, to, reason, reference, evidence });
  return { ok: true, from, to };
}

/** Reloj: sin actualizaciones en `ttlS`, el incidente pasa a STALE (nunca se borra; se puede reactivar). */
export async function tick(inc, now) {
  if (now - inc.updatedAt > inc.ttlS && allowedTransition(inc.state, 'STALE', 'SYSTEM')) return transition(inc, 'STALE', { actor: { kind: 'SYSTEM' }, now, reason: `sin actualizaciones en ${inc.ttlS} s` });
  return { ok: true, unchanged: true };
}

/** Estado de afectados: solo se registra si lo confirma un actor verificado o el propio afectado. */
export async function setAffected(inc, status, { actor, now }) {
  if (!['NO_INJURIES_REPORTED', 'INJURIES_REPORTED', 'UNKNOWN'].includes(status)) return { ok: false, error: 'estado de afectados no válido' };
  if (!(actor?.kind === 'OWNER' || (VERIFIED_KINDS.has(actor?.kind) && actor.verified))) return { ok: false, error: 'solo el afectado o un actor verificado informa de afectados' };
  inc.affected = { status, confirmedBy: actor.kind, at: now };
  await appendAudit(inc, { at: now, op: 'AFFECTED', actor: { kind: actor.kind, id: actor.id ?? null }, data: { status } });
  return { ok: true };
}

/** Vista pública de tráfico: sin datos personales ni detalles de salud; apta para DATEX II/CIFS tras convenio. */
export function publicView(inc) {
  return {
    id: inc.id, kind: inc.kind, state: inc.state, updatedAt: inc.updatedAt,
    location: { lat: +inc.location.lat.toFixed(5), lon: +inc.location.lon.toFixed(5), roadId: inc.location.roadId, dir: inc.location.dir, pk: inc.location.pk, lane: inc.location.lane.mostLikely },
    confidence: inc.confidence ? { status: inc.confidence.status, p: inc.confidence.p, independentRoots: inc.confidence.independentRoots } : null,
    sources: [...new Set(inc.observations.map((o) => o.source))],
  };
}
/** Vista protegida: exige propósito y actor verificado u owner; el acceso queda auditado. */
export async function protectedView(inc, { actor, purpose, now }) {
  if (!purpose) return { ok: false, error: 'propósito de acceso obligatorio' };
  if (!(actor?.kind === 'OWNER' || (VERIFIED_KINDS.has(actor?.kind) && actor.verified))) return { ok: false, error: 'acceso no autorizado a datos protegidos' };
  await appendAudit(inc, { at: now, op: 'PROTECTED_ACCESS', actor: { kind: actor.kind, id: actor.id ?? null }, data: { purpose } });
  return { ok: true, view: { ...publicView(inc), owner: inc.protected.owner, affected: inc.affected, assistance: inc.assistance } };
}

/** Construye gemelos a partir de un lote de observaciones sueltas (correlación + creación). */
export async function twinsFromObservations(observations, { now, radiusM, windowS } = {}) {
  const groups = correlateObservations(observations, { radiusM, windowS });
  const out = [];
  for (const g of groups) {
    const inc = await createIncident(g.obs[0], { now });
    for (const o of g.obs.slice(1)) await observe(inc, o, { now });
    inc.location = { ...inc.location, lat: g.centroid.lat, lon: g.centroid.lon, accuracyM: g.accuracyM };
    out.push(inc);
  }
  return out;
}
