/**
 * Servicios de Moderación y Confianza (DSA / RGPD compliant).
 * 
 * Gestiona:
 *  - Reportes de contenido y usuarios con categorías de infracción.
 *  - Casos de moderación y expedientes auditables.
 *  - Decisiones humanas (NO_ACTION, LABEL_SENSITIVE, LIMIT, REMOVE).
 *  - Procedimiento formal de apelación y resolución.
 *  - Registro estricto de auditoría sin alteración retrospectiva.
 */
import { bad, forbidden, notFound, newId, str, oneOf } from '../http.mjs';
import { can } from '../rbac.mjs';

export const REPORT_REASONS = Object.freeze([
  'MISINFORMATION',
  'IMPERSONATION',
  'VICTIM_PRIVACY_EXPOSURE',
  'SENSITIVE_LOCATION_EXPOSURE',
  'HATE_SPEECH_HARASSMENT',
  'SPAM_SCAM',
  'OLD_FOOTAGE_MISREPRESENTED',
  'MANIPULATED_CONTENT',
  'CHILD_SAFETY',
  'OTHER'
]);

export const MODERATION_DECISIONS = Object.freeze([
  'NO_ACTION',
  'LABEL_SENSITIVE',
  'LIMIT',
  'REMOVE'
]);

export function createModerationService(db, { rt, notifier, audit }) {
  function reportContent(reporterId, body, { ip } = {}) {
    const targetType = oneOf(body.targetType, ['POST', 'COMMENT', 'USER', 'EVENT'], 'targetType');
    const targetId = str(body.targetId, { field: 'targetId', min: 1, max: 80, required: true });
    const reason = oneOf(body.reason, REPORT_REASONS, 'reason');
    const details = str(body.details ?? '', { field: 'details', max: 1000 });

    if (targetType === 'POST') {
      const p = db.get('SELECT id, author_id FROM posts WHERE id = ?', targetId);
      if (!p) throw notFound('POST_NOT_FOUND');
      if (p.author_id === reporterId) throw bad('CANNOT_REPORT_OWN_CONTENT');
    }

    const existing = db.get(
      'SELECT id FROM moderation_cases WHERE target_type = ? AND target_id = ? AND reporter_id = ?',
      targetType, targetId, reporterId
    );
    if (existing) {
      return { id: existing.id, alreadyReported: true, status: 'OPEN' };
    }

    const id = newId();
    const now = Date.now();

    db.run(
      `INSERT INTO moderation_cases(id, target_type, target_id, reporter_id, reason, details, status, created_at)
       VALUES (?,?,?,?,?,?,'OPEN',?)`,
      id, targetType, targetId, reporterId, reason, details, now
    );

    audit({
      actorId: reporterId,
      action: 'moderation.report',
      targetType,
      targetId,
      ip,
      meta: { reason, caseId: id }
    });

    return { id, targetType, targetId, reason, status: 'OPEN', createdAt: now };
  }

  function resolveCase(moderatorId, caseId, body, { ip } = {}) {
    const c = db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
    if (!c) throw notFound('CASE_NOT_FOUND');

    const auth = can(db, moderatorId, 'moderation:resolve');
    if (!auth.allowed) throw forbidden('MODERATOR_ROLE_REQUIRED');

    const decision = oneOf(body.decision, MODERATION_DECISIONS, 'decision');
    const decisionReason = str(body.reason, { field: 'reason', min: 3, max: 500, required: true });
    const now = Date.now();

    db.tx(() => {
      db.run(
        `UPDATE moderation_cases 
         SET status = 'RESOLVED', decision = ?, decision_reason = ?, decided_by = ?, decided_at = ?
         WHERE id = ?`,
        decision, decisionReason, moderatorId, now, caseId
      );

      // Aplicar efecto sobre el contenido
      if (c.target_type === 'POST') {
        if (decision === 'REMOVE') {
          db.run("UPDATE posts SET moderation_state = 'REMOVED', updated_at = ? WHERE id = ?", now, c.target_id);
        } else if (decision === 'LIMIT') {
          db.run("UPDATE posts SET moderation_state = 'LIMITED', updated_at = ? WHERE id = ?", now, c.target_id);
        } else if (decision === 'LABEL_SENSITIVE') {
          db.run("UPDATE posts SET sensitive = 1, updated_at = ? WHERE id = ?", now, c.target_id);
        }
      }
    });

    // Notificar al autor del contenido sobre la medida y el derecho a apelación (DSA)
    let authorId = null;
    if (c.target_type === 'POST') {
      const p = db.get('SELECT author_id FROM posts WHERE id = ?', c.target_id);
      authorId = p?.author_id;
    } else if (c.target_type === 'COMMENT') {
      const cm = db.get('SELECT author_id FROM comments WHERE id = ?', c.target_id);
      authorId = cm?.author_id;
    }

    if (authorId) {
      notifier.notify(authorId, {
        kind: 'MODERATION_ACTION',
        category: 'MODERATION',
        refType: c.target_type,
        refId: c.target_id,
        reason: 'Se ha tomado una decisión de moderación sobre tu contenido conforme a nuestros términos y políticas DSA.',
        payload: {
          caseId,
          decision,
          decisionReason,
          appealEligible: decision !== 'NO_ACTION'
        },
        dedupeKey: `mod-decision:${caseId}`
      });
    }

    rt.publish('MODERATION_APPLIED', { audienceType: 'PUBLIC' }, {
      caseId,
      targetType: c.target_type,
      targetId: c.target_id,
      decision
    });

    audit({
      actorId: moderatorId,
      action: 'moderation.resolve',
      targetType: c.target_type,
      targetId: c.target_id,
      ip,
      meta: { caseId, decision, decisionReason }
    });

    return db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
  }

  function appealDecision(userId, caseId, body, { ip } = {}) {
    const c = db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
    if (!c) throw notFound('CASE_NOT_FOUND');
    if (c.status !== 'RESOLVED' || !c.decision || c.decision === 'NO_ACTION') {
      throw bad('APPEAL_NOT_ELIGIBLE', 'El caso no tiene una resolución apelable');
    }

    // Verificar que quien apela sea el autor del contenido
    let authorId = null;
    if (c.target_type === 'POST') {
      authorId = db.get('SELECT author_id FROM posts WHERE id = ?', c.target_id)?.author_id;
    } else if (c.target_type === 'COMMENT') {
      authorId = db.get('SELECT author_id FROM comments WHERE id = ?', c.target_id)?.author_id;
    }

    if (authorId !== userId) {
      throw forbidden('ONLY_CONTENT_AUTHOR_CAN_APPEAL');
    }

    const appealText = str(body.appealText, { field: 'appealText', min: 10, max: 1000, required: true });
    const now = Date.now();

    db.run(
      `UPDATE moderation_cases 
       SET status = 'APPEALED', appeal_text = ?, appeal_at = ?
       WHERE id = ?`,
      appealText, now, caseId
    );

    audit({
      actorId: userId,
      action: 'moderation.appeal',
      targetType: c.target_type,
      targetId: c.target_id,
      ip,
      meta: { caseId, appealText }
    });

    return db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
  }

  function resolveAppeal(reviewerId, caseId, body, { ip } = {}) {
    const c = db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
    if (!c) throw notFound('CASE_NOT_FOUND');
    if (c.status !== 'APPEALED') throw bad('CASE_NOT_APPEALED');

    const auth = can(db, reviewerId, 'moderation:decide_appeal');
    if (!auth.allowed) throw forbidden('TRUST_ANALYST_OR_ADMIN_REQUIRED');

    const outcome = oneOf(body.outcome, ['UPHELD', 'OVERTURNED'], 'outcome');
    const notes = str(body.notes ?? '', { field: 'notes', max: 500 });
    const now = Date.now();

    db.tx(() => {
      db.run(
        `UPDATE moderation_cases 
         SET status = 'CLOSED', appeal_decided_by = ?, appeal_outcome = ?
         WHERE id = ?`,
        reviewerId, outcome, caseId
      );

      // Si se revoca la sanción, restaurar visibilidad
      if (outcome === 'OVERTURNED' && c.target_type === 'POST') {
        db.run("UPDATE posts SET moderation_state = 'VISIBLE', sensitive = 0, updated_at = ? WHERE id = ?", now, c.target_id);
      }
    });

    audit({
      actorId: reviewerId,
      action: 'moderation.resolve_appeal',
      targetType: c.target_type,
      targetId: c.target_id,
      ip,
      meta: { caseId, outcome, notes }
    });

    return db.get('SELECT * FROM moderation_cases WHERE id = ?', caseId);
  }

  function listCases(viewerId, { status = null, limit = 50 } = {}) {
    const auth = can(db, viewerId, 'moderation:resolve');
    if (!auth.allowed) throw forbidden('MODERATOR_ROLE_REQUIRED');

    const params = [];
    let sql = 'SELECT * FROM moderation_cases';
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(100, Number(limit) || 50));

    return db.all(sql, ...params);
  }

  return { reportContent, resolveCase, appealDecision, resolveAppeal, listCases };
}
