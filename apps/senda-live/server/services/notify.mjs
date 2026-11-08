/**
 * Notificaciones basadas EXCLUSIVAMENTE en suscripciones explícitas.
 * Fuentes válidas de audiencia: event_subscriptions(notify=1), zone_subscriptions(notify=1),
 * follows(target ORG/USER, notify=1), miembros de conversación/canal.
 * Las reacciones nunca son audiencia. Cada aviso guarda el «por qué» lo recibe el usuario.
 */
import { newId } from '../http.mjs';
import { bboxAround, bboxIntersects } from '../domain/geo.mjs';

const CATEGORY_SETTING = { FOLLOWED_EVENT: 'notify_followed_events', OFFICIAL: 'notify_official_alerts', ZONE: 'notify_official_alerts', SOCIAL: 'notify_social' };

export function createNotifier(db, rt) {
  function notify(userId, { kind, category, refType = null, refId = null, reason, payload = {}, dedupeKey }) {
    const setting = CATEGORY_SETTING[category];
    if (setting) {
      const s = db.get(`SELECT ${setting} AS on_ FROM user_settings WHERE user_id = ?`, userId);
      if (s && !s.on_) return false;
    }
    const u = db.get("SELECT status FROM users WHERE id = ?", userId);
    if (!u || u.status !== 'ACTIVE') return false;
    const id = newId();
    const r = db.run(`INSERT OR IGNORE INTO notifications(id, user_id, kind, category, ref_type, ref_id, reason, payload, dedupe_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, userId, kind, category, refType, refId, reason, JSON.stringify(payload), dedupeKey, Date.now());
    if (r.changes === 0) return false; // duplicado evitado
    rt.publish('NOTIFICATION', { audienceType: 'USER', audienceId: userId }, { id, kind, category, refType, refId, reason, payload });
    return true;
  }

  /** Actualización de un acontecimiento → solo suscriptores con notify=1. */
  function fanOutEventUpdate(eventId, { updateId, title, body, kind, actorId }) {
    const subs = db.all('SELECT user_id FROM event_subscriptions WHERE event_id = ? AND notify = 1', eventId);
    let n = 0;
    for (const { user_id } of subs) {
      if (user_id === actorId) continue;
      if (notify(user_id, { kind: kind === 'RETRACTION' ? 'EVENT_RETRACTED' : 'EVENT_UPDATE', category: 'FOLLOWED_EVENT', refType: 'EVENT', refId: eventId,
        reason: 'Sigues este acontecimiento y activaste sus avisos', payload: { title, body: body.slice(0, 280), updateId }, dedupeKey: `event-update:${updateId}` })) n++;
    }
    return n;
  }

  /** Alerta oficial verificada → evento seguido ∪ zona elegida ∪ seguidores de la organización con avisos. */
  function fanOutAlert(alert, org) {
    const recipients = new Map();
    if (alert.event_id) for (const r of db.all('SELECT user_id FROM event_subscriptions WHERE event_id = ? AND notify = 1', alert.event_id)) recipients.set(r.user_id, 'Sigues el acontecimiento al que se refiere esta alerta');
    if (alert.bbox) {
      const box = JSON.parse(alert.bbox);
      for (const z of db.all('SELECT user_id, label, lat, lon, radius_km FROM zone_subscriptions WHERE notify = 1')) {
        if (bboxIntersects(bboxAround(z.lat, z.lon, z.radius_km), box) && !recipients.has(z.user_id)) recipients.set(z.user_id, `Elegiste recibir avisos en tu zona «${z.label}»`);
      }
    }
    for (const r of db.all("SELECT follower_id FROM follows WHERE target_type = 'ORG' AND target_id = ? AND notify = 1", org.id)) if (!recipients.has(r.follower_id)) recipients.set(r.follower_id, `Activaste los avisos de ${org.name}`);
    let n = 0;
    for (const [userId, reason] of recipients) {
      if (notify(userId, { kind: alert.status === 'RETRACTED' ? 'ALERT_RETRACTED' : 'OFFICIAL_ALERT', category: 'OFFICIAL', refType: 'ALERT', refId: alert.id, reason,
        payload: { title: alert.title, severity: alert.severity, urgency: alert.urgency, org: org.name, status: alert.status },
        dedupeKey: `alert:${alert.id}:${alert.status}` })) n++;
    }
    return n;
  }

  return { notify, fanOutEventUpdate, fanOutAlert };
}
