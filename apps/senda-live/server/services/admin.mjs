/**
 * Servicios de Administración y Gobierno de Plataforma.
 *
 * Exige roles explícitos comprobados en servidor:
 *  - PLATFORM_ADMIN: gestión de roles, anclas criptográficas, feature flags y organizaciones.
 *  - SYSTEM_AUDITOR / PLATFORM_ADMIN: inspección de registros de auditoría y métricas.
 *
 * Regla: Toda acción sensible genera un registro inmutable en audit_records.
 */
import { bad, forbidden, notFound, newId, str, oneOf } from '../http.mjs';
import { can } from '../rbac.mjs';
import { adapterHealth } from '../domain/source-adapters.mjs';

export function createAdminService(db, { rt, emergency, audit }) {
  function requireAdmin(userId, perm = 'admin:write') {
    const auth = can(db, userId, perm);
    if (!auth.allowed) throw forbidden('ADMIN_PRIVILEGES_REQUIRED');
  }

  function createOrganization(adminId, body, { ip } = {}) {
    requireAdmin(adminId, 'admin:write');
    const id = body.id ? str(body.id, { field: 'id', min: 1, max: 80 }) : newId();
    const name = str(body.name, { field: 'name', min: 2, max: 100, required: true });
    const kind = oneOf(body.kind, ['POLICE', 'FIRE', 'CIVIL_PROTECTION', 'HEALTH', 'MILITARY_EMERGENCY_UNIT', 'NGO', 'NEWS_ORGANIZATION'], 'kind');
    const anchorJwk = body.anchorPublicJwk ? (typeof body.anchorPublicJwk === 'string' ? body.anchorPublicJwk : JSON.stringify(body.anchorPublicJwk)) : null;

    const now = Date.now();

    db.run(
      `INSERT INTO organizations(id, name, kind, status, anchor_public_jwk, verified_by, verified_at, created_at)
       VALUES (?, ?, ?, 'VERIFIED', ?, ?, ?, ?)`,
      id, name, kind, anchorJwk, adminId, now, now
    );

    audit({
      actorId: adminId,
      action: 'admin.create_organization',
      targetType: 'ORG',
      targetId: id,
      ip,
      meta: { name, kind, hasAnchor: Boolean(anchorJwk) }
    });

    return db.get('SELECT * FROM organizations WHERE id = ?', id);
  }

  function registerAuthorityCredential(adminId, body, { ip } = {}) {
    requireAdmin(adminId, 'admin:write');
    const userId = str(body.userId, { field: 'userId', min: 1, max: 80, required: true });
    const orgId = str(body.orgId, { field: 'orgId', min: 1, max: 80, required: true });
    const role = str(body.role, { field: 'role', min: 2, max: 60, required: true });
    const unit = str(body.unit ?? '', { field: 'unit', max: 60 });
    const credentialJson = typeof body.credential === 'object' ? JSON.stringify(body.credential) : str(body.credential, { field: 'credential', required: true });
    const sig = str(body.sig, { field: 'sig', min: 10, max: 200, required: true });
    const validFrom = Number(body.validFrom) || Date.now();
    const validUntil = Number(body.validUntil) || (Date.now() + 365 * 86_400_000);

    const org = db.get('SELECT * FROM organizations WHERE id = ?', orgId);
    if (!org) throw notFound('ORG_NOT_FOUND');

    const id = newId();
    const now = Date.now();

    db.run(
      `INSERT INTO authority_credentials(id, user_id, org_id, credential_json, sig, role, unit, valid_from, valid_until, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId, orgId, credentialJson, sig, role, unit, validFrom, validUntil, now
    );

    // Otorgar membresía activa si no existía
    db.run(
      `INSERT OR REPLACE INTO memberships(id, org_id, user_id, role, status, granted_by, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      newId(), orgId, userId, role, adminId, now
    );

    audit({
      actorId: adminId,
      action: 'admin.register_credential',
      targetType: 'USER',
      targetId: userId,
      ip,
      meta: { orgId, role, credentialId: id }
    });

    return db.get('SELECT * FROM authority_credentials WHERE id = ?', id);
  }

  function assignRole(adminId, body, { ip } = {}) {
    requireAdmin(adminId, 'role:grant');
    const userId = str(body.userId, { field: 'userId', min: 1, max: 80, required: true });
    const role = oneOf(body.role, [
      'VISITOR', 'CITIZEN', 'CONTRIBUTOR', 'JOURNALIST', 'NEWS_ORGANIZATION', 'VERIFIED_SOURCE', 'VOLUNTEER',
      'COMMUNITY_MODERATOR', 'TRUST_ANALYST', 'EMERGENCY_COORDINATOR', 'INSTITUTIONAL_OPERATOR', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_AUDITOR'
    ], 'role');
    const orgId = body.orgId ? str(body.orgId, { field: 'orgId', max: 80 }) : null;
    const scopeBbox = body.scopeBbox ? (typeof body.scopeBbox === 'string' ? body.scopeBbox : JSON.stringify(body.scopeBbox)) : null;
    const eventTypes = body.eventTypes ? (typeof body.eventTypes === 'string' ? body.eventTypes : JSON.stringify(body.eventTypes)) : null;
    const expiresAt = body.expiresAt ? Number(body.expiresAt) : null;

    const id = newId();
    const now = Date.now();

    db.run(
      `INSERT INTO role_assignments(id, user_id, role, org_id, scope_bbox, event_types, granted_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId, role, orgId, scopeBbox, eventTypes, adminId, expiresAt, now
    );

    audit({
      actorId: adminId,
      action: 'admin.assign_role',
      targetType: 'USER',
      targetId: userId,
      ip,
      meta: { role, orgId, assignmentId: id }
    });

    return db.get('SELECT * FROM role_assignments WHERE id = ?', id);
  }

  function revokeRole(adminId, assignmentId, { ip } = {}) {
    requireAdmin(adminId, 'role:grant');
    const row = db.get('SELECT * FROM role_assignments WHERE id = ?', assignmentId);
    if (!row) throw notFound('ASSIGNMENT_NOT_FOUND');

    const now = Date.now();
    db.run('UPDATE role_assignments SET revoked_at = ? WHERE id = ?', now, assignmentId);

    audit({
      actorId: adminId,
      action: 'admin.revoke_role',
      targetType: 'USER',
      targetId: row.user_id,
      ip,
      meta: { assignmentId, role: row.role }
    });

    return { revoked: true, assignmentId };
  }

  function queryAuditLogs(viewerId, { action = null, actorId = null, severity = null, limit = 100 } = {}) {
    requireAdmin(viewerId, 'audit:read');
    const params = [];
    const where = ['1=1'];
    if (action) { where.push('action = ?'); params.push(action); }
    if (actorId) { where.push('actor_id = ?'); params.push(actorId); }
    if (severity) { where.push('severity = ?'); params.push(severity); }

    const rows = db.all(
      `SELECT * FROM audit_records WHERE ${where.join(' AND ')} ORDER BY at DESC LIMIT ?`,
      ...params, Math.min(200, Number(limit) || 100)
    );

    return rows.map((r) => ({
      ...r,
      meta: JSON.parse(r.meta || '{}')
    }));
  }

  function setFeatureFlag(adminId, key, enabled, { ip } = {}) {
    requireAdmin(adminId, 'admin:write');
    const k = str(key, { field: 'key', min: 2, max: 60, required: true });
    const isEn = enabled ? 1 : 0;
    const now = Date.now();

    db.run(
      `INSERT INTO feature_flags(key, enabled, updated_by, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      k, isEn, adminId, now
    );

    audit({
      actorId: adminId,
      action: 'admin.set_feature_flag',
      targetType: 'FEATURE_FLAG',
      targetId: k,
      ip,
      meta: { enabled: Boolean(isEn) }
    });

    return { key: k, enabled: Boolean(isEn), updatedAt: now };
  }

  function getSystemHealth(viewerId) {
    requireAdmin(viewerId, 'admin:read');

    const userCount = db.get("SELECT COUNT(*) AS c FROM users WHERE status = 'ACTIVE'").c;
    const postCount = db.get("SELECT COUNT(*) AS c FROM posts WHERE deleted_at IS NULL").c;
    const eventCount = db.get("SELECT COUNT(*) AS c FROM events").c;
    const alertCount = db.get("SELECT COUNT(*) AS c FROM alerts").c;
    const openModCases = db.get("SELECT COUNT(*) AS c FROM moderation_cases WHERE status = 'OPEN'").c;
    const flags = db.all("SELECT key, enabled FROM feature_flags");
    const dtn = emergency.dtnStats();
    const realtime = rt.stats();
    const adapters = adapterHealth();

    return {
      status: 'HEALTHY',
      timestamp: Date.now(),
      metrics: {
        activeUsers: userCount,
        posts: postCount,
        events: eventCount,
        alerts: alertCount,
        openModerationCases: openModCases,
        realtimeConnections: realtime.connections
      },
      dtn,
      featureFlags: flags.reduce((acc, f) => { acc[f.key] = Boolean(f.enabled); return acc; }, {}),
      adapters
    };
  }

  function listUsers(viewerId, { limit = 50 } = {}) {
    requireAdmin(viewerId, 'admin:read');
    return db.all(
      `SELECT u.id, u.email, u.status, u.created_at, p.handle, p.display_name
       FROM users u JOIN profiles p ON p.user_id = u.id ORDER BY u.created_at DESC LIMIT ?`,
      Math.min(100, Number(limit) || 50)
    );
  }

  function listOrganizations(viewerId) {
    return db.all('SELECT * FROM organizations ORDER BY name ASC');
  }

  return {
    createOrganization,
    registerAuthorityCredential,
    assignRole,
    revokeRole,
    queryAuditLogs,
    setFeatureFlag,
    getSystemHealth,
    listUsers,
    listOrganizations
  };
}
