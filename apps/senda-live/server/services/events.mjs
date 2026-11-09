/**
 * DOMINIO B · ACONTECIMIENTOS Y EVIDENCIAS (EVENT HUB + SENDA EVENT INTELLIGENCE).
 *
 * Un acontecimiento es una entidad persistente independiente de las publicaciones.
 * Las reacciones jamás alteran su estado de verificación (`computeEventStatus`).
 */
import { bad, forbidden, notFound, newId, sha256hex, str, oneOf, num } from '../http.mjs';
import { coarsen, parseBbox, bboxAround, pointInPolygon, parsePolygon, polygonBbox } from '../domain/geo.mjs';
import { computeEventStatus, MANUAL_STATUSES } from '../domain/verification.mjs';
import { proposeClusters, findContradictions, corroborationQuestions } from '../domain/intelligence.mjs';
import { can, effectiveRoles } from '../rbac.mjs';

export function createEventService(db, { rt, notifier, audit }) {
  function slugFor(title) {
    const base = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'ev';
    return `EVENT-${base.toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function sourceKindForAuthor(userId, mediaProvider) {
    const roles = effectiveRoles(db, userId);
    if (roles.includes('NEWS_ORGANIZATION')) return 'NEWS_ORG';
    if (roles.includes('JOURNALIST') || roles.includes('VERIFIED_SOURCE')) return 'JOURNALIST';
    if (mediaProvider && mediaProvider !== 'web') return 'EXTERNAL_PLATFORM';
    return 'CITIZEN';
  }

  function independenceKeyFor(post, media) {
    const org = db.get(`SELECT o.id FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? AND m.status = 'ACTIVE' AND o.status = 'VERIFIED' LIMIT 1`, post.author_id);
    if (org) return `org:${org.id}`;
    if (media?.canonical_url) {
      try {
        const u = new URL(media.canonical_url);
        if (media.author_name) return `${media.provider}:${media.author_name.toLowerCase()}`;
        return `host:${u.hostname.replace(/^www\./, '')}`;
      } catch { /* ignore */ }
    }
    return `user:${post.author_id}`;
  }

  function recompute(eventId, { decidedBy = null } = {}) {
    const ev = db.get('SELECT * FROM events WHERE id = ?', eventId);
    if (!ev) return null;
    const sources = db.all(`SELECT es.source_kind AS kind, es.independence_key AS independenceKey, p.author_id AS authorId
      FROM event_sources es LEFT JOIN posts p ON p.id = es.post_id WHERE es.event_id = ?`, eventId);
    const contradictions = db.get("SELECT COUNT(*) AS c FROM event_posts WHERE event_id = ? AND relation = 'CONTRADICTS'", eventId).c;
    const officialActive = db.get("SELECT COUNT(*) AS c FROM alerts WHERE event_id = ? AND status = 'ACTIVE' AND expires_at > ?", eventId, Date.now()).c;
    const manual = db.get('SELECT to_status AS toStatus FROM verification_decisions WHERE event_id = ? AND decided_by IS NOT NULL ORDER BY created_at DESC LIMIT 1', eventId);
    const next = computeEventStatus({ sources, contradictions, officialActive, manual, expiresAt: ev.expires_at });
    if (next.status !== ev.status) {
      const now = Date.now();
      db.run('UPDATE events SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?', next.status, now, eventId);
      db.run('INSERT INTO verification_decisions(id, event_id, decided_by, from_status, to_status, reason, basis, created_at) VALUES (?,?,?,?,?,?,?,?)',
        newId(), eventId, decidedBy, ev.status, next.status, next.reasons.join(','), JSON.stringify(next.signals), now);
      if (next.status === 'CORROBORATED') rt.publish('EVENT_CORROBORATED', { audienceType: 'PUBLIC' }, { eventId, status: next.status });
      else if (next.status === 'RETRACTED') rt.publish('EVENT_RETRACTED', { audienceType: 'PUBLIC' }, { eventId });
      else rt.publish('EVENT_UPDATED', { audienceType: 'PUBLIC' }, { eventId, status: next.status });
    }
    return next;
  }

  function createEvent(userId, body, { ip } = {}) {
    const title = str(body.title, { field: 'title', min: 3, max: 160, required: true });
    const type = str(body.type || 'general', { field: 'type', min: 2, max: 40 });
    const geo = (body.lat !== undefined && body.lat !== null && body.lon !== undefined && body.lon !== null) ? coarsen(body.lat, body.lon) : { lat: null, lon: null };
    const bbox = body.bbox ? parseBbox(body.bbox) : (geo.lat !== null ? bboxAround(geo.lat, geo.lon, Number(body.radiusKm) || 3) : null);
    const placeLabel = body.placeLabel ? str(body.placeLabel, { field: 'placeLabel', max: 120 }) : null;
    const startedAt = num(body.startedAt, { field: 'startedAt', min: 0, optional: true }) ?? Date.now();
    const now = Date.now();
    const id = newId(), slug = slugFor(title);
    db.run(`INSERT INTO events(id, slug, title, type, status, lat, lon, bbox, place_label, started_at, created_by, created_at, updated_at)
      VALUES (?,?,?,?,'UNVERIFIED_REPORT',?,?,?,?,?,?,?,?)`,
      id, slug, title, type, geo.lat, geo.lon, bbox ? JSON.stringify(bbox) : null, placeLabel, startedAt, userId, now, now);
    if (Array.isArray(body.postIds)) for (const pid of body.postIds.slice(0, 20)) linkPost(userId, id, { postId: pid, relation: 'REPORTS' });
    rt.publish('EVENT_CREATED', { audienceType: 'PUBLIC' }, { eventId: id, slug, title, type });
    audit({ actorId: userId, action: 'event.create', targetType: 'EVENT', targetId: id, ip });
    return getEvent(id, userId);
  }

  function linkPost(userId, eventId, { postId, relation = 'REPORTS' }) {
    const ev = db.get('SELECT * FROM events WHERE id = ?', eventId);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const post = db.get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!post) throw notFound('POST_NOT_FOUND');
    if (post.moderation_state === 'REMOVED' && post.author_id !== userId) throw notFound('POST_NOT_FOUND');
    if (post.visibility === 'PRIVATE' && post.author_id !== userId) throw notFound('POST_NOT_FOUND');
    if (post.visibility === 'FOLLOWERS' && post.author_id !== userId) {
      const isFollowing = Boolean(db.get("SELECT 1 FROM follows WHERE follower_id = ? AND target_type = 'USER' AND target_id = ?", userId, post.author_id));
      if (!isFollowing) throw notFound('POST_NOT_FOUND');
    }
    if (post.author_id !== userId) {
      const isBlocked = Boolean(db.get("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", userId, post.author_id, post.author_id, userId));
      if (isBlocked) throw notFound('POST_NOT_FOUND');
    }
    const rel = oneOf(relation, ['REPORTS', 'UPDATES', 'CONTRADICTS'], 'relation', 'REPORTS');
    const now = Date.now();
    const media = post.media_ref_id ? db.get('SELECT * FROM external_media_refs WHERE id = ?', post.media_ref_id) : null;
    db.tx(() => {
      db.run('INSERT OR REPLACE INTO event_posts(event_id, post_id, relation, linked_by, linked_at) VALUES (?,?,?,?,?)', eventId, postId, rel, userId, now);
      if (rel !== 'CONTRADICTS') {
        const sk = sourceKindForAuthor(post.author_id, media?.provider);
        const ik = independenceKeyFor(post, media);
        const dup = db.get('SELECT 1 FROM event_sources WHERE event_id = ? AND post_id = ?', eventId, postId);
        if (!dup) db.run('INSERT INTO event_sources(id, event_id, source_kind, independence_key, post_id, created_at) VALUES (?,?,?,?,?,?)', newId(), eventId, sk, ik, postId, now);
      }
      // Cadena de procedencia (inspirada en PCI v0.2): hash de los datos propios + prev_hash.
      const prev = db.get('SELECT report_hash FROM event_evidence WHERE event_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', eventId)?.report_hash ?? null;
      const meta = media ? { provider: media.provider, siteName: media.site_name, title: media.title, adapterStatus: media.adapter_status } : {};
      const reportHash = sha256hex(JSON.stringify({ prev, eventId, postId, contentHash: post.content_hash, relation: rel, linkedAt: now }));
      db.run(`INSERT INTO event_evidence(id, event_id, post_id, original_url, external_id, acquired_at, author_ref, metadata, report_hash, prev_hash, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        newId(), eventId, postId, media?.canonical_url ?? post.url ?? null, media?.external_id ?? null, media?.acquired_at ?? post.created_at,
        media?.author_name ?? `user:${post.author_id}`, JSON.stringify(meta), reportHash, prev, now);
      if (ev.lat === null && post.lat_coarse !== null) {
        const box = bboxAround(post.lat_coarse, post.lon_coarse, 3);
        db.run('UPDATE events SET lat = ?, lon = ?, bbox = ?, place_label = COALESCE(place_label, ?), updated_at = ? WHERE id = ?',
          post.lat_coarse, post.lon_coarse, JSON.stringify(box), post.place_label, now, eventId);
      } else db.run('UPDATE events SET updated_at = ? WHERE id = ?', now, eventId);
      recompute(eventId);
    });
    return getEvent(eventId, userId);
  }

  function addObservation(userId, eventId, body) {
    const ev = db.get('SELECT id FROM events WHERE id = ?', eventId);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const text = str(body.text, { field: 'text', min: 3, max: 1000, required: true });
    const geo = (body.lat !== undefined && body.lat !== null && body.lon !== undefined && body.lon !== null) ? coarsen(body.lat, body.lon) : { lat: null, lon: null };
    const observedAt = num(body.observedAt, { field: 'observedAt', min: 0, optional: true }) ?? Date.now();
    const now = Date.now(), id = newId();
    const reportHash = sha256hex(JSON.stringify({ eventId, userId, text, lat: geo.lat, lon: geo.lon, observedAt }));
    db.tx(() => {
      db.run('INSERT INTO event_observations(id, event_id, author_id, text, lat_coarse, lon_coarse, observed_at, report_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        id, eventId, userId, text, geo.lat, geo.lon, observedAt, reportHash, now);
      const dup = db.get('SELECT 1 FROM event_sources WHERE event_id = ? AND independence_key = ?', eventId, `user:${userId}`);
      if (!dup) db.run('INSERT INTO event_sources(id, event_id, source_kind, independence_key, created_at) VALUES (?,?,?,?,?)', newId(), eventId, sourceKindForAuthor(userId), `user:${userId}`, now);
      recompute(eventId);
    });
    return getEvent(eventId, userId);
  }

  function postUpdate(userId, eventId, body, { ip } = {}) {
    const ev = db.get('SELECT * FROM events WHERE id = ?', eventId);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const kind = oneOf(body.kind, ['UPDATE', 'CORRECTION', 'RETRACTION'], 'kind', 'UPDATE');
    if (kind === 'CORRECTION' || kind === 'RETRACTION') {
      const ok = ev.created_by === userId || can(db, userId, 'event:post_correction', { eventType: ev.type }).allowed;
      if (!ok) throw forbidden('NOT_AUTHORIZED_FOR_CORRECTION');
    } else {
      const ok = ev.created_by === userId || can(db, userId, 'newsroom:use').allowed || can(db, userId, 'event:decide_status').allowed || can(db, userId, 'coordination:use').allowed;
      if (!ok) throw forbidden('NOT_AUTHORIZED_FOR_EVENT_UPDATE');
    }
    const text = str(body.body, { field: 'body', min: 3, max: 1500, required: true });
    const id = newId(), now = Date.now();
    db.tx(() => {
      db.run('INSERT INTO event_updates(id, event_id, author_id, kind, body, from_status, to_status, created_at) VALUES (?,?,?,?,?,?,?,?)',
        id, eventId, userId, kind, text, ev.status, kind === 'RETRACTION' ? 'RETRACTED' : ev.status, now);
      if (kind === 'RETRACTION') {
        db.run('INSERT INTO verification_decisions(id, event_id, decided_by, from_status, to_status, reason, basis, created_at) VALUES (?,?,?,?,?,?,?,?)',
          newId(), eventId, userId, ev.status, 'RETRACTED', text, '{}', now);
        recompute(eventId, { decidedBy: userId });
      } else db.run('UPDATE events SET updated_at = ? WHERE id = ?', now, eventId);
    });
    const notified = notifier.fanOutEventUpdate(eventId, { updateId: id, title: ev.title, body: text, kind, actorId: userId });
    rt.publish(kind === 'RETRACTION' ? 'EVENT_RETRACTED' : 'EVENT_UPDATED', { audienceType: 'PUBLIC' }, { eventId, updateId: id, kind });
    audit({ actorId: userId, action: `event.${kind.toLowerCase()}`, targetType: 'EVENT', targetId: eventId, ip, meta: { notified } });
    return { updateId: id, notified, event: getEvent(eventId, userId) };
  }

  /** Decisión manual de un analista de confianza. Prohibido fijar OFFICIAL_SOURCE_CONFIRMED sin alerta oficial. */
  function decideStatus(userId, eventId, body, { ip } = {}) {
    const ev = db.get('SELECT * FROM events WHERE id = ?', eventId);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const authz = can(db, userId, 'event:decide_status', { bbox: ev.bbox ? JSON.parse(ev.bbox) : null, eventType: ev.type });
    if (!authz.allowed) {
      audit({ actorId: userId, action: 'event.decide_status', targetType: 'EVENT', targetId: eventId, outcome: 'DENIED', severity: 'SECURITY', reason: authz.reason, ip });
      throw forbidden(authz.reason);
    }
    if (body.toStatus === 'OFFICIAL_SOURCE_CONFIRMED') {
      audit({ actorId: userId, action: 'event.decide_status', targetType: 'EVENT', targetId: eventId, outcome: 'DENIED', severity: 'SECURITY', reason: 'OFFICIAL_REQUIRES_AUTHENTICATED_ALERT', ip });
      throw bad('OFFICIAL_REQUIRES_AUTHENTICATED_ALERT', 'OFFICIAL_SOURCE_CONFIRMED exige una alerta oficial autenticada');
    }
    const toStatus = oneOf(body.toStatus, MANUAL_STATUSES, 'toStatus');
    const reason = str(body.reason, { field: 'reason', min: 3, max: 500, required: true });
    const now = Date.now();
    db.tx(() => {
      db.run('INSERT INTO verification_decisions(id, event_id, decided_by, from_status, to_status, reason, basis, created_at) VALUES (?,?,?,?,?,?,?,?)',
        newId(), eventId, userId, ev.status, toStatus, reason, JSON.stringify({ manual: true }), now);
      db.run('INSERT INTO event_updates(id, event_id, author_id, kind, body, from_status, to_status, created_at) VALUES (?,?,?,?,?,?,?,?)',
        newId(), eventId, userId, toStatus === 'RETRACTED' ? 'RETRACTION' : 'STATUS_CHANGE', reason, ev.status, toStatus, now);
      recompute(eventId, { decidedBy: userId });
    });
    audit({ actorId: userId, action: 'event.decide_status', targetType: 'EVENT', targetId: eventId, ip, meta: { from: ev.status, to: toStatus } });
    return getEvent(eventId, userId);
  }

  /** Seguir / dejar de seguir acontecimiento (consentimiento explícito). */
  function setSubscription(userId, eventId, { following = true, notify = true } = {}) {
    const ev = db.get('SELECT id, title FROM events WHERE id = ?', eventId);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const now = Date.now();
    if (!following) {
      db.run('DELETE FROM event_subscriptions WHERE event_id = ? AND user_id = ?', eventId, userId);
      db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, scope_ref, created_at) VALUES (?,?,?,?,?,?,?)',
        newId(), userId, 'FOLLOWED_EVENT_NOTIFICATIONS', 0, 'v1', `event:${eventId}`, now);
      return { following: false, notify: false };
    }
    db.run('INSERT OR REPLACE INTO event_subscriptions(event_id, user_id, notify, created_at, updated_at) VALUES (?,?,?,COALESCE((SELECT created_at FROM event_subscriptions WHERE event_id=? AND user_id=?),?),?)',
      eventId, userId, notify ? 1 : 0, eventId, userId, now, now);
    db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, scope_ref, created_at) VALUES (?,?,?,?,?,?,?)',
      newId(), userId, 'FOLLOWED_EVENT_NOTIFICATIONS', notify ? 1 : 0, 'v1', `event:${eventId}`, now);
    rt.publish('EVENT_FOLLOWED', { audienceType: 'USER', audienceId: userId }, { eventId, notify: Boolean(notify) });
    return { following: true, notify: Boolean(notify) };
  }

  function getEvent(idOrSlug, viewerId = null) {
    const ev = db.get('SELECT * FROM events WHERE id = ? OR slug = ?', idOrSlug, idOrSlug);
    if (!ev) throw notFound('EVENT_NOT_FOUND');
    const rawPosts = db.all(`SELECT p.id, p.author_id, p.visibility, p.moderation_state, p.title, p.body, p.url, p.kind, p.category, p.created_at, p.occurred_at, p.content_hash, ep.relation, pr.handle, pr.display_name
      FROM event_posts ep JOIN posts p ON p.id = ep.post_id JOIN profiles pr ON pr.user_id = p.author_id
      WHERE ep.event_id = ? AND p.deleted_at IS NULL ORDER BY ep.linked_at DESC`, ev.id);

    // Apply strict access authorization: NEVER leak private or followers-only posts or blocked content to unauthorized viewers
    const posts = rawPosts.filter((p) => {
      if (p.moderation_state === 'REMOVED' && p.author_id !== viewerId) return false;
      if (p.visibility === 'PRIVATE' && p.author_id !== viewerId) return false;
      if (p.visibility === 'FOLLOWERS' && p.author_id !== viewerId) {
        if (!viewerId) return false;
        const isFollowing = Boolean(db.get("SELECT 1 FROM follows WHERE follower_id = ? AND target_type = 'USER' AND target_id = ?", viewerId, p.author_id));
        if (!isFollowing) return false;
      }
      if (viewerId && p.author_id !== viewerId) {
        const isBlocked = Boolean(db.get("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", viewerId, p.author_id, p.author_id, viewerId));
        if (isBlocked) return false;
      }
      return true;
    }).map(({ author_id, visibility, moderation_state, ...safePost }) => safePost);

    const visiblePostIds = new Set(posts.map((p) => p.id));
    const sources = db.all('SELECT id, source_kind, independence_key, post_id, alert_id, created_at FROM event_sources WHERE event_id = ? ORDER BY created_at', ev.id)
      .filter((s) => !s.post_id || visiblePostIds.has(s.post_id));
    const evidence = db.all('SELECT id, post_id, original_url, external_id, acquired_at, author_ref, metadata, report_hash, prev_hash FROM event_evidence WHERE event_id = ? ORDER BY created_at', ev.id)
      .filter((e) => !e.post_id || visiblePostIds.has(e.post_id))
      .map((e) => ({ ...e, metadata: JSON.parse(e.metadata) }));
    const observations = db.all(`SELECT o.id, o.text, o.lat_coarse, o.lon_coarse, o.observed_at, o.report_hash, o.created_at, p.handle, p.display_name
      FROM event_observations o JOIN profiles p ON p.user_id = o.author_id WHERE o.event_id = ? ORDER BY o.created_at DESC`, ev.id);
    const updates = db.all(`SELECT u.id, u.kind, u.body, u.from_status, u.to_status, u.created_at, p.handle, p.display_name
      FROM event_updates u JOIN profiles p ON p.user_id = u.author_id WHERE u.event_id = ? ORDER BY u.created_at DESC`, ev.id);
    const decisions = db.all('SELECT id, decided_by, from_status, to_status, reason, basis, created_at FROM verification_decisions WHERE event_id = ? ORDER BY created_at DESC', ev.id);
    const alerts = db.all(`SELECT a.id, a.severity, a.urgency, a.title, a.body, a.status, a.issued_at, a.expires_at, a.retracted_at, a.retraction_reason, a.server_signature, o.name AS org_name, o.kind AS org_kind
      FROM alerts a JOIN organizations o ON o.id = a.org_id WHERE a.event_id = ? ORDER BY a.issued_at DESC`, ev.id);
    const sub = viewerId ? db.get('SELECT notify FROM event_subscriptions WHERE event_id = ? AND user_id = ?', ev.id, viewerId) : null;
    const independentKeys = new Set(sources.filter((s) => s.source_kind !== 'OFFICIAL').map((s) => s.independence_key));
    const contradictions = findContradictions(posts);
    return {
      id: ev.id, slug: ev.slug, title: ev.title, type: ev.type, status: ev.status,
      verification: {
        contentStatus: ev.status,
        officialConfirmed: ev.status === 'OFFICIAL_SOURCE_CONFIRMED',
        independentSourceCount: independentKeys.size,
        contradictionCount: posts.filter((p) => p.relation === 'CONTRADICTS').length,
        popularityIgnored: true,
      },
      location: ev.lat !== null ? { lat: ev.lat, lon: ev.lon, bbox: ev.bbox ? JSON.parse(ev.bbox) : null, label: ev.place_label, precision: '~1 km' } : (ev.place_label ? { label: ev.place_label } : null),
      startedAt: ev.started_at, createdAt: ev.created_at, updatedAt: ev.updated_at,
      subscriberCount: db.get('SELECT COUNT(*) AS c FROM event_subscriptions WHERE event_id = ?', ev.id).c,
      viewerSubscription: sub ? { following: true, notify: Boolean(sub.notify) } : { following: false, notify: false },
      posts, sources, evidence, observations, updates, decisions, alerts,
      intelligence: { kind: 'HYPOTHESIS', contradictions, questions: corroborationQuestions(posts) },
    };
  }

  function listEvents({ q = null, type = null, status = null, bbox = null, lat = null, lon = null, radiusKm = null, polygon = null, since = null, viewerId = null, limit = 50 } = {}) {
    const where = ['1=1']; const params = [];
    if (q) { where.push('(e.title LIKE ? OR e.place_label LIKE ? OR e.slug LIKE ?)'); const pat = `%${q}%`; params.push(pat, pat, pat); }
    if (type) { where.push('e.type = ?'); params.push(type); }
    if (status) { where.push('e.status = ?'); params.push(status); }
    if (since) { where.push('e.updated_at >= ?'); params.push(Number(since)); }
    const poly = polygon ? parsePolygon(polygon) : null;
    const box = bbox ? parseBbox(bbox) : (poly ? polygonBbox(poly) : (lat !== null && lon !== null ? bboxAround(Number(lat), Number(lon), Number(radiusKm) || 25) : null));
    if (box) { where.push('e.lon BETWEEN ? AND ? AND e.lat BETWEEN ? AND ?'); params.push(box[0], box[2], box[1], box[3]); }
    const rows = db.all(`SELECT e.* FROM events e WHERE ${where.join(' AND ')} ORDER BY e.updated_at DESC LIMIT ?`, ...params, Math.min(100, Number(limit) || 50));
    const filtered = poly ? rows.filter((r) => r.lat !== null && pointInPolygon(r.lat, r.lon, poly)) : rows;
    return filtered.map((e) => ({
      id: e.id, slug: e.slug, title: e.title, type: e.type, status: e.status,
      location: e.lat !== null ? { lat: e.lat, lon: e.lon, bbox: e.bbox ? JSON.parse(e.bbox) : null, label: e.place_label } : (e.place_label ? { label: e.place_label } : null),
      startedAt: e.started_at, updatedAt: e.updated_at,
      postCount: db.get(`SELECT COUNT(*) AS c FROM event_posts ep JOIN posts p ON p.id = ep.post_id
        WHERE ep.event_id = ? AND p.deleted_at IS NULL AND p.moderation_state != 'REMOVED'
        AND (p.visibility = 'PUBLIC' OR p.author_id = ? OR (p.visibility = 'FOLLOWERS' AND ? != '' AND p.author_id IN (SELECT target_id FROM follows WHERE follower_id = ? AND target_type = 'USER')))`,
        e.id, viewerId || '', viewerId || '', viewerId || '').c,
      independentSourceCount: db.get("SELECT COUNT(DISTINCT independence_key) AS c FROM event_sources WHERE event_id = ? AND source_kind != 'OFFICIAL'", e.id).c,
      viewerFollows: viewerId ? Boolean(db.get('SELECT 1 FROM event_subscriptions WHERE event_id = ? AND user_id = ?', e.id, viewerId)) : false,
    }));
  }

  /** Propuestas automáticas de agrupación de publicaciones recientes (siempre etiquetadas HYPOTHESIS). */
  function intelligenceCandidates() {
    const posts = db.all(`SELECT id, title, body, category, lat_coarse AS lat, lon_coarse AS lon, created_at AS createdAt, occurred_at AS occurredAt
      FROM posts WHERE deleted_at IS NULL AND moderation_state = 'VISIBLE' AND visibility = 'PUBLIC' ORDER BY created_at DESC LIMIT 100`);
    return { kind: 'HYPOTHESIS', generatedAt: Date.now(), clusters: proposeClusters(posts) };
  }

  return { createEvent, linkPost, addObservation, postUpdate, decideStatus, setSubscription, getEvent, listEvents, recompute, intelligenceCandidates };
}
