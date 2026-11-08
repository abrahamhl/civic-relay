/**
 * DOMINIO C · COORDINACIÓN DE EMERGENCIAS Y PUENTE DTN.
 *
 * Contratos:
 *  - Emitir una alerta oficial exige: (1) rol INSTITUTIONAL_OPERATOR en servidor y
 *    (2) credencial firmada por el ancla criptográfica de una organización VERIFIED (`verifyAuthority`).
 *    Cualquier intento sin ambos se rechaza con 403 y genera un registro de auditoría de severidad
 *    SECURITY sin exponer secretos (TEST E).
 *  - Una alerta retractada NUNCA se oculta ni se borra: pasa a `status = 'RETRACTED'` conservando
 *    motivo y hora de retractación, y emite una notificación de corrección.
 *  - El almacén DTN del gateway reutiliza `@senda/core` (`envelope.mjs`, `bundle.mjs`). Un sobre
 *    aceptado en el gateway queda en estado `IN_CUSTODY` (un solo check), jamás `DELIVERED` hasta
 *    que llega el recibo criptográfico verificable contra `ackHash`.
 *  - SENDA es un canal complementario: en la respuesta siempre recuerda que ante una emergencia
 *    inmediata se debe llamar al 112.
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import { validateEnvelopeShape, ackHashOf } from '@senda/core/src/envelope.mjs';
import { createBundleStore, exportBundleFile, importBundleFile } from '@senda/core/src/bundle.mjs';
import { unb64 } from '@senda/core/src/b64.mjs';
import { bad, forbidden, notFound, newId, str, oneOf } from '../http.mjs';
import { coarsen, parseBbox } from '../domain/geo.mjs';
import { can, verifyAuthority } from '../rbac.mjs';

export const SEVERITIES = Object.freeze(['MINOR', 'MODERATE', 'SEVERE', 'EXTREME']);
export const URGENCIES = Object.freeze(['PAST', 'FUTURE', 'EXPECTED', 'IMMEDIATE']);
export const NETWORK_STATES = Object.freeze(['ONLINE', 'DEGRADED', 'LOCAL_ONLY', 'OFFLINE_QUEUE', 'DTN_AVAILABLE', 'NO_PHYSICAL_ROUTE']);

export function createEmergencyService(db, { rt, notifier, events, audit }) {
  // Par de claves del servidor para firmar alertas verificadas (además de la credencial de la org).
  const serverKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const serverPublicJwk = serverKey.publicKey.export({ format: 'jwk' });
  const dtnStore = createBundleStore({ owner: 'senda-live-gateway', quotaBytes: 8 * 1024 * 1024 });

  async function issueAlert(userId, body, { ip } = {}) {
    const orgId = str(body.orgId, { field: 'orgId', min: 1, max: 80, required: true });
    const bbox = body.bbox ? parseBbox(body.bbox) : null;
    const rbac = can(db, userId, 'alert:issue', { orgId, bbox });
    if (!rbac.allowed) {
      audit({ actorId: userId, action: 'alert.issue', targetType: 'ORG', targetId: orgId, outcome: 'DENIED', severity: 'SECURITY', reason: rbac.reason, ip, meta: { attemptedRole: body.role } });
      throw forbidden('NOT_AUTHORIZED_FOR_OFFICIAL_ALERT', 'Se requiere operador institucional autorizado');
    }
    const auth = await verifyAuthority(db, userId, orgId);
    if (!auth.valid) {
      audit({ actorId: userId, action: 'alert.issue', targetType: 'ORG', targetId: orgId, outcome: 'DENIED', severity: 'SECURITY', reason: `CREDENTIAL_${auth.reason}`, ip });
      throw forbidden('INVALID_INSTITUTIONAL_CREDENTIAL', `Credencial institucional no válida: ${auth.reason}`);
    }
    const severity = oneOf(body.severity, SEVERITIES, 'severity', 'SEVERE');
    const urgency = oneOf(body.urgency, URGENCIES, 'urgency', 'IMMEDIATE');
    const title = str(body.title, { field: 'title', min: 5, max: 160, required: true });
    const text = str(body.body, { field: 'body', min: 5, max: 2000, required: true });
    const eventId = body.eventId ? str(body.eventId, { field: 'eventId', max: 80 }) : null;
    if (eventId && !db.get('SELECT 1 FROM events WHERE id = ?', eventId)) throw notFound('EVENT_NOT_FOUND');
    const now = Date.now();
    const ttlMs = Math.min(7 * 86_400_000, Math.max(300_000, Number(body.ttlSeconds || 21_600) * 1000));
    const expiresAt = now + ttlMs;
    const id = newId();
    const canonical = JSON.stringify([id, orgId, auth.credential.id, severity, urgency, title, text, bbox, eventId, now, expiresAt]);
    const serverSignature = sign('sha256', Buffer.from(canonical), serverKey.privateKey).toString('base64url');
    const org = db.get('SELECT * FROM organizations WHERE id = ?', orgId);

    db.tx(() => {
      db.run(`INSERT INTO alerts(id, org_id, issuer_user_id, credential_id, severity, urgency, title, body, bbox, event_id, status, issued_at, expires_at, server_signature)
        VALUES (?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?)`,
        id, orgId, userId, auth.credential.id, severity, urgency, title, text, bbox ? JSON.stringify(bbox) : null, eventId, now, expiresAt, serverSignature);
      if (eventId) {
        db.run('INSERT INTO event_sources(id, event_id, source_kind, independence_key, alert_id, created_at) VALUES (?,?,?,?,?,?)',
          newId(), eventId, 'OFFICIAL', `org:${orgId}`, id, now);
        db.run('INSERT INTO event_updates(id, event_id, author_id, kind, body, from_status, to_status, created_at) VALUES (?,?,?,?,?,?,?,?)',
          newId(), eventId, userId, 'OFFICIAL_ALERT', `${org.name}: ${title} — ${text}`, null, 'OFFICIAL_SOURCE_CONFIRMED', now);
        events.recompute(eventId, { decidedBy: userId });
      }
      // Difusión firmada también en el almacén DTN (para sincronización offline de alertas).
      dtnStore.putBroadcast({ id: `alert:${id}`, kind: 'OFFICIAL_ALERT', orgId, orgName: org.name, severity, urgency, title, body: text, bbox, issuedAt: now, expiresAt, serverSignature }, { now });
    });

    const alertRow = db.get('SELECT * FROM alerts WHERE id = ?', id);
    const notified = notifier.fanOutAlert(alertRow, org);
    rt.publish('ALERT_PUBLISHED', { audienceType: 'PUBLIC' }, { alertId: id, orgId, orgName: org.name, severity, urgency, title, eventId });
    audit({ actorId: userId, action: 'alert.issue', targetType: 'ALERT', targetId: id, ip, meta: { orgId, credentialId: auth.credential.id, severity, notified } });
    return getAlert(id);
  }

  /** Retractar una alerta: NUNCA se borra; queda visible con estado RETRACTED y motivo trazable. */
  async function retractAlert(userId, alertId, body, { ip } = {}) {
    const a = db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    if (!a) throw notFound('ALERT_NOT_FOUND');
    const auth = await verifyAuthority(db, userId, a.org_id);
    if (!auth.valid && !can(db, userId, 'admin:write').allowed) {
      audit({ actorId: userId, action: 'alert.retract', targetType: 'ALERT', targetId: alertId, outcome: 'DENIED', severity: 'SECURITY', reason: auth.reason, ip });
      throw forbidden('NOT_AUTHORIZED');
    }
    const reason = str(body.reason, { field: 'reason', min: 5, max: 500, required: true });
    const now = Date.now();
    db.tx(() => {
      db.run("UPDATE alerts SET status = 'RETRACTED', retracted_at = ?, retraction_reason = ? WHERE id = ?", now, reason, alertId);
      if (a.event_id) {
        db.run('INSERT INTO event_updates(id, event_id, author_id, kind, body, from_status, to_status, created_at) VALUES (?,?,?,?,?,?,?,?)',
          newId(), a.event_id, userId, 'RETRACTION', `Alerta retractada: ${reason}`, 'OFFICIAL_SOURCE_CONFIRMED', null, now);
        events.recompute(a.event_id, { decidedBy: userId });
      }
    });
    const org = db.get('SELECT * FROM organizations WHERE id = ?', a.org_id);
    const updated = db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    notifier.fanOutAlert(updated, org);
    rt.publish('ALERT_RETRACTED', { audienceType: 'PUBLIC' }, { alertId, reason });
    audit({ actorId: userId, action: 'alert.retract', targetType: 'ALERT', targetId: alertId, ip, meta: { reason } });
    return getAlert(alertId);
  }

  function getAlert(id) {
    const r = db.get(`SELECT a.*, o.name AS org_name, o.kind AS org_kind, ac.role AS cred_role, ac.unit AS cred_unit, p.display_name AS issuer_name
      FROM alerts a JOIN organizations o ON o.id = a.org_id JOIN authority_credentials ac ON ac.id = a.credential_id JOIN profiles p ON p.user_id = a.issuer_user_id WHERE a.id = ?`, id);
    if (!r) throw notFound('ALERT_NOT_FOUND');
    return formatAlert(r);
  }

  function formatAlert(r) {
    return {
      id: r.id, severity: r.severity, urgency: r.urgency, title: r.title, body: r.body,
      bbox: r.bbox ? JSON.parse(r.bbox) : null, eventId: r.event_id, status: r.status,
      issuedAt: r.issued_at, expiresAt: r.expires_at, retractedAt: r.retracted_at, retractionReason: r.retraction_reason,
      provenance: {
        organization: { id: r.org_id, name: r.org_name, kind: r.org_kind },
        issuerDisplayName: r.issuer_name,
        credential: { id: r.credential_id, role: r.cred_role, unit: r.cred_unit },
        serverSignature: r.server_signature,
        complementaryNotice: 'SENDA es un canal complementario. En una emergencia inmediata llama al 112.',
      },
    };
  }

  /** Lista alertas (incluye SIEMPRE las retractadas con su marca visible). */
  function listAlerts({ severity = null, includeExpired = false } = {}) {
    const where = ['1=1']; const params = [];
    if (severity) { where.push('a.severity = ?'); params.push(severity); }
    if (!includeExpired) { where.push("(a.expires_at > ? OR a.status = 'RETRACTED')"); params.push(Date.now()); }
    const rows = db.all(`SELECT a.*, o.name AS org_name, o.kind AS org_kind, ac.role AS cred_role, ac.unit AS cred_unit, p.display_name AS issuer_name
      FROM alerts a JOIN organizations o ON o.id = a.org_id JOIN authority_credentials ac ON ac.id = a.credential_id JOIN profiles p ON p.user_id = a.issuer_user_id
      WHERE ${where.join(' AND ')} ORDER BY a.issued_at DESC LIMIT 100`, ...params);
    return rows.map(formatAlert);
  }

  function addZoneSubscription(userId, body) {
    const label = str(body.label, { field: 'label', min: 2, max: 60, required: true });
    const geo = coarsen(body.lat, body.lon);
    if (geo.lat === null) throw bad('LOCATION_REQUIRED');
    const radiusKm = Math.min(100, Math.max(1, Number(body.radiusKm) || 10));
    const id = newId(), now = Date.now();
    db.run('INSERT INTO zone_subscriptions(id, user_id, label, lat, lon, radius_km, notify, created_at) VALUES (?,?,?,?,?,?,1,?)', id, userId, label, geo.lat, geo.lon, radiusKm, now);
    db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, scope_ref, created_at) VALUES (?,?,?,?,?,?,?)', newId(), userId, 'OFFICIAL_ALERT_NOTIFICATIONS', 1, 'v1', `zone:${id}`, now);
    return { id, label, lat: geo.lat, lon: geo.lon, radiusKm, notify: true };
  }

  function listZoneSubscriptions(userId) {
    return db.all('SELECT id, label, lat, lon, radius_km AS radiusKm, notify FROM zone_subscriptions WHERE user_id = ?', userId);
  }

  function deleteZoneSubscription(userId, id) {
    db.run('DELETE FROM zone_subscriptions WHERE id = ? AND user_id = ?', id, userId);
    return { deleted: true };
  }

  /**
   * Custodia de un sobre cifrado SENDA v2 (`@senda/core` envelope.mjs) en el almacén DTN.
   * Devuelve estado explícito `IN_CUSTODY` (nunca `DELIVERED` solo por estar en el gateway).
   */
  function storeEnvelope(userId, { envelope, conversationId = null, clientId = null }) {
    const shape = validateEnvelopeShape(envelope);
    if (!shape.ok) throw bad(shape.reason, `Sobre SENDA rechazado: ${shape.reason}`);
    const put = dtnStore.put(envelope);
    if (!put.stored && put.reason !== 'DUPLICATE') throw bad(put.reason);
    const now = Date.now();
    const convId = conversationId || ensureSosConversation(userId);
    const cid = clientId || envelope.header.id;
    const existing = db.get('SELECT * FROM messages WHERE envelope_id = ?', envelope.header.id);
    if (existing) return formatMessageState(existing);
    const id = newId();
    db.run(`INSERT INTO messages(id, conversation_id, sender_id, body, envelope, envelope_id, ack_hash, priority, state, client_id, created_at, expires_at)
      VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?)`,
      id, convId, userId, JSON.stringify(envelope), envelope.header.id, envelope.header.ackHash, envelope.header.priority, 'IN_CUSTODY', cid, now, envelope.header.expiresAt);
    return formatMessageState(db.get('SELECT * FROM messages WHERE id = ?', id));
  }

  /** Recibo criptográfico del destinatario (`ackSecret`): pasa el sobre a `VERIFIED`. */
  async function submitReceipt(userId, { id: envelopeId, ackSecret }) {
    const res = await dtnStore.acceptReceiptDetailed({ id: envelopeId, ackSecret });
    const msg = db.get('SELECT * FROM messages WHERE envelope_id = ?', envelopeId);
    if (msg && (res.state === 'VERIFIED_NOW' || res.state === 'ALREADY_VERIFIED' || (await ackHashOf(unb64(ackSecret))) === msg.ack_hash)) {
      const now = Date.now();
      db.run("UPDATE messages SET state = 'VERIFIED', delivered_at = COALESCE(delivered_at, ?), verified_at = ? WHERE id = ?", now, now, msg.id);
      rt.publish('MESSAGE_ACKNOWLEDGED', { audienceType: 'USER', audienceId: msg.sender_id }, { messageId: msg.id, envelopeId, state: 'VERIFIED' });
      return { ok: true, state: 'VERIFIED', messageId: msg.id };
    }
    if (!res.ok) throw bad(res.state, `Recibo rechazado: ${res.state}`);
    return { ok: true, state: res.state };
  }

  function ensureSosConversation(userId) {
    const key = `sos:${userId}`;
    const cur = db.get('SELECT id FROM conversations WHERE direct_key = ?', key);
    if (cur) return cur.id;
    const id = newId(), now = Date.now();
    db.run("INSERT INTO conversations(id, kind, title, direct_key, created_by, created_at, updated_at) VALUES (?,'GROUP','Canal SOS / Custodia DTN',?,?,?,?)", id, key, userId, now, now);
    db.run('INSERT INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', id, userId, now);
    return id;
  }

  function formatMessageState(m) {
    return {
      id: m.id, conversationId: m.conversation_id, envelopeId: m.envelope_id, priority: m.priority,
      state: m.state, createdAt: m.created_at, expiresAt: m.expires_at, deliveredAt: m.delivered_at, verifiedAt: m.verified_at,
      // Honestidad: solo hay doble check cuando el destinatario abrió o firmó el recibo.
      checks: m.state === 'VERIFIED' || m.state === 'DELIVERED' ? 2 : (m.state === 'IN_CUSTODY' || m.state === 'FORWARDED' ? 1 : 0),
    };
  }

  function exportDtnBundle(peerSummary) { return exportBundleFile(dtnStore, { peerSummary }); }
  async function importDtnBundle(text) { return importBundleFile(dtnStore, text); }
  function dtnStats() { return { ...dtnStore.stats(), physicalBearersAvailable: [], mode: 'GATEWAY_STORE_AND_FORWARD', laboratoryNote: 'Sin radio física conectada al servidor; transporte DTN por fichero .senda o HTTPS' }; }

  return { issueAlert, retractAlert, getAlert, listAlerts, addZoneSubscription, listZoneSubscriptions, deleteZoneSubscription, storeEnvelope, submitReceipt, exportDtnBundle, importDtnBundle, dtnStats, serverPublicJwk };
}
