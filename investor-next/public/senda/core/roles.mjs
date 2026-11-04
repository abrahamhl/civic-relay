/**
 * Coordinación en zona: coordinadores, familias, documentos seguros y canales internos
 * de policía, bomberos, protección civil y sanidad.
 *
 * Identidad institucional = credencial firmada (ECDSA P-256) por la clave de la
 * organización, que SENDA distribuye como ancla de confianza tras un convenio.
 * Sin credencial, cualquiera puede declararse «coordinador voluntario», pero con
 * permisos limitados y siempre etiquetado como NO VERIFICADO.
 */
import { b64, unb64 } from './b64.mjs';
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const ORG_KINDS = Object.freeze(['POLICE', 'FIRE', 'CIVIL_PROTECTION', 'HEALTH', 'MILITARY_EMERGENCY_UNIT', 'NGO']);

export async function createOrganization({ id, name, kind }) {
  if (!ORG_KINDS.includes(kind)) throw new Error(`Tipo de organización no válido: ${kind}`);
  const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { id, name, kind, keys, anchor: { id, name, kind, publicJwk: await subtle.exportKey('jwk', keys.publicKey) } };
}

const credBytes = (c) => enc.encode(JSON.stringify([c.orgId, c.subject, c.role, c.unit, c.validFrom, c.validUntil]));

export async function issueCredential(org, { subject, role, unit, validFrom, validUntil }) {
  const c = { orgId: org.id, orgKind: org.kind, subject, role, unit, validFrom, validUntil };
  c.sig = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, org.keys.privateKey, credBytes(c)));
  return c;
}

/** Verifica contra las anclas de confianza instaladas. Lista de revocación opcional. */
export async function verifyCredential(cred, anchors, now, revoked = new Set()) {
  if (!cred) return { valid: false, reason: 'NONE' };
  const a = anchors.find((x) => x.id === cred.orgId);
  if (!a) return { valid: false, reason: 'UNKNOWN_ORG' };
  if (a.kind !== cred.orgKind) return { valid: false, reason: 'KIND_MISMATCH' };
  if (revoked.has(cred.sig)) return { valid: false, reason: 'REVOKED' };
  if (now < cred.validFrom || now > cred.validUntil) return { valid: false, reason: 'NOT_VALID_NOW' };
  const key = await subtle.importKey('jwk', a.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(cred.sig), credBytes(cred));
  return ok ? { valid: true, orgKind: a.kind, role: cred.role, unit: cred.unit } : { valid: false, reason: 'BAD_SIGNATURE' };
}

/** Actor dentro de una zona, con su nivel de confianza ya evaluado. */
export async function resolveActor({ userId, credential, anchors, now, declaredCoordinator = false, revoked }) {
  const v = await verifyCredential(credential, anchors, now, revoked);
  if (v.valid) return { userId, trust: 'VERIFIED_INSTITUTIONAL', orgKind: v.orgKind, role: v.role, unit: v.unit, coordinator: /COORD|JEFE|MANDO|INCIDENT/i.test(v.role) };
  return { userId, trust: declaredCoordinator ? 'VOLUNTEER_UNVERIFIED' : 'CITIZEN', coordinator: declaredCoordinator, credentialIssue: credential ? v.reason : undefined };
}

/**
 * Matriz de permisos. Las acciones sensibles (datos de víctimas, documentos, canales
 * internos) exigen identidad institucional verificada.
 */
export function authorize(action, actor, { channelOrgKind } = {}) {
  const inst = actor.trust === 'VERIFIED_INSTITUTIONAL';
  switch (action) {
    case 'REGISTER_SOUGHT_PERSON': return { allowed: true };
    case 'POST_SAFE_STATUS': return { allowed: true };
    case 'VOLUNTEER_LOGISTICS': return { allowed: actor.coordinator || inst };
    case 'UPDATE_PERSON_STATUS': return { allowed: inst, reason: inst ? undefined : 'Solo personal institucional verificado' };
    case 'READ_FAMILY_REGISTRY': return { allowed: inst && actor.coordinator, reason: 'Coordinación institucional' };
    case 'SEND_SECURE_DOCUMENT': return { allowed: inst };
    case 'BROADCAST_ZONE_INSTRUCTION': return { allowed: inst && actor.coordinator, label: 'Instrucción de coordinación (no es alerta oficial EU-Alert)' };
    case 'JOIN_INTERNAL_CHANNEL': return { allowed: inst && actor.orgKind === channelOrgKind, reason: 'Canal interno de su propia organización' };
    case 'JOIN_INTERAGENCY_CHANNEL': return { allowed: inst && actor.coordinator };
    default: return { allowed: false, reason: 'UNKNOWN_ACTION' };
  }
}

export const PERSON_STATUS = Object.freeze(['SOUGHT', 'LOCATED_SAFE', 'LOCATED_NEEDS_CARE', 'TRANSFERRED', 'UNKNOWN']);

/**
 * Registro de familiares y personas buscadas, con minimización: cada familiar ve solo
 * a la persona que registró; la coordinación institucional ve el conjunto de la zona.
 */
export function createFamilyRegistry() {
  const people = new Map();
  let n = 0;
  return {
    registerSought(actor, { name, lastSeen, contactFingerprint }) {
      if (!authorize('REGISTER_SOUGHT_PERSON', actor).allowed) throw new Error('FORBIDDEN');
      const id = `P${++n}`;
      people.set(id, { id, name, lastSeen, status: 'SOUGHT', requestedBy: actor.userId, contactFingerprint, history: [] });
      return id;
    },
    updateStatus(actor, id, status, { note, at, location } = {}) {
      if (!authorize('UPDATE_PERSON_STATUS', actor).allowed) throw new Error('FORBIDDEN');
      if (!PERSON_STATUS.includes(status)) throw new Error('BAD_STATUS');
      const p = people.get(id);
      p.history.push({ status: p.status, at, by: actor.userId });
      Object.assign(p, { status, note, location, updatedBy: `${actor.orgKind}:${actor.unit}`, updatedAt: at });
      return { notify: p.contactFingerprint, status }; // aviso cifrado al familiar
    },
    viewFor(actor, id) {
      const p = people.get(id);
      if (!p) return null;
      if (p.requestedBy === actor.userId) return { id, name: p.name, status: p.status, updatedAt: p.updatedAt, updatedBy: p.updatedBy };
      if (authorize('READ_FAMILY_REGISTRY', actor).allowed) return structuredClone(p);
      return null;
    },
    list(actor) {
      if (!authorize('READ_FAMILY_REGISTRY', actor).allowed) throw new Error('FORBIDDEN');
      return [...people.values()].map((p) => ({ id: p.id, name: p.name, status: p.status }));
    },
  };
}

/** Canales: internos por organización e interagencia; la membresía se recalcula al entrar. */
export function canJoinChannel(actor, channel) {
  if (channel.type === 'INTERNAL') return authorize('JOIN_INTERNAL_CHANNEL', actor, { channelOrgKind: channel.orgKind }).allowed;
  if (channel.type === 'INTERAGENCY') return authorize('JOIN_INTERAGENCY_CHANNEL', actor).allowed;
  if (channel.type === 'ZONE_PUBLIC') return true;
  return false;
}

/** Persistencia del organismo (solo en el equipo del organismo; la clave privada nunca viaja). */
export async function exportOrganization(org) {
  return { id: org.id, name: org.name, kind: org.kind, privateJwk: await subtle.exportKey('jwk', org.keys.privateKey), publicJwk: org.anchor.publicJwk };
}
export async function importOrganization({ id, name, kind, privateJwk, publicJwk }) {
  const privateKey = await subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const publicKey = await subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  return { id, name, kind, keys: { privateKey, publicKey }, anchor: { id, name, kind, publicJwk } };
}

/** Códigos de texto portables (QR, SMS, correo, papel) para anclas, solicitudes y credenciales. */
export const CODE = Object.freeze({ ANCHOR: 'SENDA-ANCLA:', REQUEST: 'SENDA-SOLICITUD:', CREDENTIAL: 'SENDA-CREDENCIAL:' });
export const encodeCode = (prefix, obj) => prefix + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decodeCode(prefix, text) {
  const t = String(text).trim(); const i = t.indexOf(prefix); if (i < 0) throw new Error(`Se esperaba un código ${prefix}`);
  const s = t.slice(i + prefix.length).split(/\s/)[0].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(s + '==='.slice((s.length + 3) % 4)))));
}
