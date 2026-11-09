/**
 * Identidad institucional y RBAC + ABAC, siempre evaluado en servidor.
 *
 * - Todo usuario autenticado y activo tiene el rol implícito CITIZEN.
 * - Los roles adicionales viven en role_assignments (con alcance, tipos de evento, caducidad
 *   y revocación) y en memberships (por organización).
 * - Emitir alertas oficiales exige ADEMÁS una AuthorityCredential firmada por la clave de la
 *   organización (ECDSA P-256, `@senda/core` roles.mjs) y verificada contra el ancla de
 *   confianza registrada por PLATFORM_ADMIN. Un selector de formulario jamás concede esto.
 * - EMERGENCY_COORDINATOR / VOLUNTEER no equivalen a verificación institucional.
 */
import { verifyCredential } from '@senda/core/src/roles.mjs';
import { bboxContains, inBbox } from './domain/geo.mjs';

export const ROLES = Object.freeze(['VISITOR', 'CITIZEN', 'CONTRIBUTOR', 'JOURNALIST', 'NEWS_ORGANIZATION', 'VERIFIED_SOURCE', 'VOLUNTEER',
  'COMMUNITY_MODERATOR', 'TRUST_ANALYST', 'EMERGENCY_COORDINATOR', 'INSTITUTIONAL_OPERATOR', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_AUDITOR']);

/** Matriz permiso → roles que lo conceden. */
export const PERMISSIONS = Object.freeze({
  'post:create': ['CITIZEN'],
  'event:create': ['CITIZEN'],
  'event:update': ['CITIZEN'],                     // + condición: creador, periodista, analista (ver events.mjs)
  'event:decide_status': ['TRUST_ANALYST', 'PLATFORM_ADMIN'],
  'event:post_correction': ['JOURNALIST', 'NEWS_ORGANIZATION', 'TRUST_ANALYST', 'PLATFORM_ADMIN'],
  'moderation:resolve': ['COMMUNITY_MODERATOR', 'TRUST_ANALYST', 'PLATFORM_ADMIN'],
  'moderation:decide_appeal': ['TRUST_ANALYST', 'PLATFORM_ADMIN'],
  'newsroom:use': ['JOURNALIST', 'NEWS_ORGANIZATION'],
  'coordination:use': ['EMERGENCY_COORDINATOR', 'INSTITUTIONAL_OPERATOR', 'VOLUNTEER'],
  'alert:issue': ['INSTITUTIONAL_OPERATOR'],       // + credencial verificada (verifyAuthority)
  'channel:institutional': ['INSTITUTIONAL_OPERATOR', 'ORG_ADMIN'],
  'source:manage': ['TRUST_ANALYST', 'PLATFORM_ADMIN'],
  'admin:read': ['PLATFORM_ADMIN', 'SYSTEM_AUDITOR'],
  'admin:write': ['PLATFORM_ADMIN'],
  'audit:read': ['PLATFORM_ADMIN', 'SYSTEM_AUDITOR'],
  'org:verify': ['PLATFORM_ADMIN'],
  'role:grant': ['PLATFORM_ADMIN'],
  'org:manage_members': ['ORG_ADMIN', 'PLATFORM_ADMIN'],
});

export function activeAssignments(db, userId, now = Date.now()) {
  const rows = db.all(`SELECT role, org_id, scope_bbox, event_types, expires_at FROM role_assignments
    WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`, userId, now);
  const mem = db.all(`SELECT m.role, m.org_id FROM memberships m JOIN organizations o ON o.id = m.org_id
    WHERE m.user_id = ? AND m.status = 'ACTIVE' AND o.status = 'VERIFIED'`, userId);
  return [
    { role: 'CITIZEN', org_id: null, scope_bbox: null, event_types: null, implicit: true },
    ...rows,
    ...mem.map((m) => ({ role: m.role, org_id: m.org_id, scope_bbox: null, event_types: null, viaMembership: true })),
  ];
}

export function effectiveRoles(db, userId, now) {
  return [...new Set(activeAssignments(db, userId, now).map((a) => a.role))];
}

/**
 * ¿Puede `userId` ejercer `perm` en este contexto?
 * ctx: { orgId?, lat?, lon?, bbox?, eventType? }
 */
export function can(db, userId, perm, ctx = {}, now = Date.now()) {
  if (!userId) return { allowed: false, reason: 'UNAUTHENTICATED' };
  const user = db.get('SELECT status FROM users WHERE id = ?', userId);
  if (!user || user.status !== 'ACTIVE') return { allowed: false, reason: 'ACCOUNT_NOT_ACTIVE' };
  const grants = PERMISSIONS[perm];
  if (!grants) return { allowed: false, reason: 'UNKNOWN_PERMISSION' };
  for (const a of activeAssignments(db, userId, now)) {
    if (!grants.includes(a.role)) continue;
    if (ctx.orgId && a.org_id && a.org_id !== ctx.orgId) continue;
    if (ctx.orgId && perm === 'alert:issue' && a.org_id !== ctx.orgId) continue;
    if (a.scope_bbox) {
      const scope = JSON.parse(a.scope_bbox);
      if (ctx.bbox && !bboxContains(scope, ctx.bbox)) continue;
      if (ctx.lat != null && !inBbox(ctx.lat, ctx.lon, scope)) continue;
    }
    if (a.event_types && ctx.eventType && !JSON.parse(a.event_types).includes(ctx.eventType)) continue;
    return { allowed: true, via: a.role, orgId: a.org_id };
  }
  return { allowed: false, reason: 'MISSING_ROLE_OR_SCOPE' };
}

/**
 * Verificación criptográfica de autoridad institucional para una organización.
 * @returns {Promise<{valid:boolean, reason?:string, credential?:object}>}
 */
export async function verifyAuthority(db, userId, orgId, now = Date.now()) {
  const org = db.get('SELECT id, kind, name, status, anchor_public_jwk FROM organizations WHERE id = ?', orgId);
  if (!org) return { valid: false, reason: 'UNKNOWN_ORG' };
  if (org.status !== 'VERIFIED' || !org.anchor_public_jwk) return { valid: false, reason: 'ORG_NOT_VERIFIED' };
  const rows = db.all(`SELECT * FROM authority_credentials WHERE user_id = ? AND org_id = ? AND revoked_at IS NULL ORDER BY valid_until DESC`, userId, orgId);
  if (rows.length === 0) return { valid: false, reason: 'NO_CREDENTIAL' };
  const revoked = new Set(db.all('SELECT sig FROM authority_credentials WHERE org_id = ? AND revoked_at IS NOT NULL', orgId).map((r) => r.sig));
  const anchor = { id: org.id, kind: org.kind, publicJwk: JSON.parse(org.anchor_public_jwk) };
  let last = 'NO_CREDENTIAL';
  for (const row of rows) {
    const cred = JSON.parse(row.credential_json);
    if (cred.subject !== userId) { last = 'SUBJECT_MISMATCH'; continue; }
    const v = await verifyCredential(cred, [anchor], now, revoked);
    if (v.valid) return { valid: true, credential: { id: row.id, role: v.role, unit: v.unit, orgKind: v.orgKind, validUntil: row.valid_until } };
    last = v.reason;
  }
  return { valid: false, reason: last };
}
