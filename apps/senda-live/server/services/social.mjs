/**
 * DOMINIO A · SOCIAL (publicaciones, enlaces, historias, feed, reacciones, comentarios,
 * guardados, seguimientos y bloqueos).
 *
 * Contratos:
 *  - Una reacción (like) NO crea ni modifica event_subscriptions ni zone_subscriptions ni
 *    dispara avisos de seguimiento de acontecimientos (TEST C).
 *  - Un enlace compartido guarda solo metadatos autorizados y su URL canónica; jamás descarga
 *    ni aloja el vídeo/imagen original (TEST B).
 *  - El ranking del feed («Para ti») se basa en preferencias explícitas, proximidad elegida,
 *    frescura, categoría e integridad de fuente — nunca en contadores de reacciones/likes.
 */
import { bad, forbidden, notFound, newId, sha256hex, str, oneOf, num, encodeCursor, decodeCursor } from '../http.mjs';
import { coarsen, bboxAround } from '../domain/geo.mjs';
import { resolveSharedUrl } from '../domain/source-adapters.mjs';
import { suggestCategory } from '../domain/intelligence.mjs';
import { UrlRejected } from '../domain/safe-fetch.mjs';

export const POST_KINDS = Object.freeze(['LINK', 'EXTERNAL_VIDEO', 'PHOTO', 'NEWS', 'STORY', 'OBSERVATION', 'INCIDENT_REPORT', 'HELP_REQUEST', 'EVENT_UPDATE']);
export const STORY_MODES = Object.freeze(['SOCIAL_STORY', 'NEWS_STORY', 'EVENT_UPDATE', 'OFFICIAL_COMMUNICATION', 'RESEARCH_SIMULATION']);
export const CATEGORIES = Object.freeze(['general', 'news', 'traffic', 'accident', 'weather', 'fire', 'flood', 'outage', 'quake', 'community']);

export function createSocialService(db, { rt, notifier, events, audit, fetcher }) {
  function upsertMediaRef(resolved, now = Date.now()) {
    const existing = db.get('SELECT * FROM external_media_refs WHERE canonical_url = ?', resolved.canonicalUrl);
    if (existing) return existing;
    const id = newId();
    const m = resolved.meta || {};
    const embed = resolved.embed || { kind: 'LINK_CARD' };
    db.run(`INSERT INTO external_media_refs(id, provider, canonical_url, external_id, title, author_name, author_url, site_name, thumbnail_url, embed_kind, embed_src, adapter_status, acquired_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, resolved.provider, resolved.canonicalUrl, resolved.externalId ?? null, m.title ?? null, m.authorName ?? null, m.authorUrl ?? null,
      m.siteName ?? resolved.provider, m.thumbnailUrl ?? null, embed.kind, embed.src ?? null, m.status ?? 'OK', now);
    return db.get('SELECT * FROM external_media_refs WHERE id = ?', id);
  }

  async function previewLink(url) {
    const remoteOn = Boolean(db.get("SELECT enabled FROM feature_flags WHERE key = 'remote_metadata_fetch'")?.enabled);
    let resolved;
    try { resolved = await resolveSharedUrl(url, { fetcher, fetchMetadata: remoteOn }); }
    catch (err) {
      if (err instanceof UrlRejected) throw bad(err.code, `URL rechazada: ${err.code}`);
      throw err;
    }
    const ref = upsertMediaRef(resolved);
    const cat = suggestCategory(`${ref.title || ''} ${resolved.meta?.description || ''}`);
    return {
      mediaRefId: ref.id, provider: ref.provider, canonicalUrl: ref.canonical_url, externalId: ref.external_id,
      title: ref.title, description: resolved.meta?.description ?? null, authorName: ref.author_name, authorUrl: ref.author_url,
      siteName: ref.site_name, thumbnailUrl: ref.thumbnail_url,
      embed: { kind: ref.embed_kind, src: ref.embed_src },
      adapterStatus: ref.adapter_status,
      hypothesis: { suggestedCategory: cat.category, label: 'Hipótesis automática editable por el usuario' },
    };
  }

  async function createPost(authorId, body, { ip } = {}) {
    const kind = oneOf(body.kind, POST_KINDS, 'kind', body.url ? 'LINK' : 'OBSERVATION');
    const idempotencyKey = body.idempotencyKey ? str(body.idempotencyKey, { field: 'idempotencyKey', min: 1, max: 80 }) : null;
    if (idempotencyKey) {
      const prev = db.get('SELECT id FROM posts WHERE author_id = ? AND idempotency_key = ?', authorId, idempotencyKey);
      if (prev) return getPost(prev.id, authorId);
    }
    let mediaRef = null, canonicalUrl = null;
    if (body.url) {
      try {
        const remoteOn = Boolean(db.get("SELECT enabled FROM feature_flags WHERE key = 'remote_metadata_fetch'")?.enabled);
        const resolved = await resolveSharedUrl(body.url, { fetcher, fetchMetadata: remoteOn });
        mediaRef = upsertMediaRef(resolved);
        canonicalUrl = mediaRef.canonical_url;
      } catch (err) {
        if (err instanceof UrlRejected) throw bad(err.code, `URL rechazada: ${err.code}`);
        throw err;
      }
    }
    const title = str(body.title ?? mediaRef?.title ?? '', { field: 'title', max: 200 });
    const text = str(body.body ?? '', { field: 'body', max: 2000 });
    if (!title && !text && !canonicalUrl) throw bad('EMPTY_POST', 'Escribe contenido o comparte un enlace');
    const category = oneOf(body.category, CATEGORIES, 'category', 'general');
    const visibility = oneOf(body.visibility, ['PUBLIC', 'FOLLOWERS', 'PRIVATE'], 'visibility', 'PUBLIC');
    const geo = (body.lat !== undefined && body.lat !== null && body.lon !== undefined && body.lon !== null) ? coarsen(body.lat, body.lon) : { lat: null, lon: null };
    const placeLabel = body.placeLabel ? str(body.placeLabel, { field: 'placeLabel', max: 120 }) : null;
    const occurredAt = num(body.occurredAt, { field: 'occurredAt', min: 0, max: Date.now() + 86_400_000, optional: true });
    const sensitive = body.sensitive ? 1 : 0;
    const now = Date.now();
    const id = newId();
    // Hash SOLO de los datos propios del reporte (PCI-like), nunca del vídeo/artículo externo.
    const contentHash = sha256hex(JSON.stringify({ authorId, kind, title, body: text, canonicalUrl, category, lat: geo.lat, lon: geo.lon, occurredAt }));

    db.tx(() => {
      db.run(`INSERT INTO posts(id, author_id, kind, title, body, url, media_ref_id, category, visibility, lat_coarse, lon_coarse, place_label, occurred_at, sensitive, content_hash, idempotency_key, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, authorId, kind, title, text, canonicalUrl, mediaRef?.id ?? null, category, visibility, geo.lat, geo.lon, placeLabel, occurredAt, sensitive, contentHash, idempotencyKey, now, now);
      if (kind === 'STORY' || body.alsoAsStory) {
        const mode = oneOf(body.storyMode, STORY_MODES, 'storyMode', kind === 'NEWS' ? 'NEWS_STORY' : 'SOCIAL_STORY');
        db.run('INSERT INTO stories(id, author_id, mode, post_id, event_id, text, url, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?)',
          newId(), authorId, mode, id, body.eventId ?? null, title || text.slice(0, 140), canonicalUrl, now, now + 24 * 3_600_000);
      }
      if (body.createEvent && body.createEvent.title) {
        const ev = events.createEvent(authorId, { title: body.createEvent.title, type: body.createEvent.type || category, lat: geo.lat, lon: geo.lon, placeLabel, startedAt: occurredAt ?? now });
        events.linkPost(authorId, ev.id, { postId: id, relation: 'REPORTS' });
      } else if (body.eventId) {
        events.linkPost(authorId, body.eventId, { postId: id, relation: oneOf(body.eventRelation, ['REPORTS', 'UPDATES', 'CONTRADICTS'], 'eventRelation', 'REPORTS') });
      }
    });
    const post = getPost(id, authorId);
    if (visibility === 'PUBLIC') rt.publish('POST_CREATED', { audienceType: 'PUBLIC' }, { postId: id, category });
    audit({ actorId: authorId, action: 'post.create', targetType: 'POST', targetId: id, ip, meta: { kind, hasUrl: Boolean(canonicalUrl) } });
    return post;
  }

  function hydratePosts(rows, viewerId) {
    if (rows.length === 0) return [];
    const embedsOn = Boolean(db.get("SELECT enabled FROM feature_flags WHERE key = 'third_party_embeds'")?.enabled);
    return rows.map((r) => {
      const evRows = db.all(`SELECT e.id, e.slug, e.title, e.type, e.status, ep.relation FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = ?`, r.id);
      const authorOrg = db.get(`SELECT o.id, o.name, o.kind, o.status FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? AND m.status = 'ACTIVE' AND o.status = 'VERIFIED' LIMIT 1`, r.author_id);
      const authorRoles = db.all('SELECT role FROM role_assignments WHERE user_id = ? AND revoked_at IS NULL', r.author_id).map((x) => x.role);
      return {
        id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, category: r.category, visibility: r.visibility,
        createdAt: r.created_at, occurredAt: r.occurred_at,
        location: r.lat_coarse !== null ? { latCoarse: r.lat_coarse, lonCoarse: r.lon_coarse, label: r.place_label, precision: '~1 km' } : (r.place_label ? { label: r.place_label } : null),
        sensitive: Boolean(r.sensitive), moderationState: r.moderation_state, contentHash: r.content_hash,
        author: {
          id: r.author_id, handle: r.handle, displayName: r.display_name, avatarUrl: r.avatar_url,
          verification: {
            accountVerified: Boolean(authorOrg) || authorRoles.some((x) => ['VERIFIED_SOURCE', 'JOURNALIST', 'NEWS_ORGANIZATION', 'INSTITUTIONAL_OPERATOR'].includes(x)),
            organization: authorOrg ? { id: authorOrg.id, name: authorOrg.name, kind: authorOrg.kind } : null,
            roles: authorRoles,
          },
        },
        media: r.media_ref_id ? {
          provider: r.provider, canonicalUrl: r.canonical_url, externalId: r.external_id,
          title: r.media_title, authorName: r.author_name, authorUrl: r.author_url, siteName: r.site_name, thumbnailUrl: r.thumbnail_url,
          embed: { kind: embedsOn ? r.embed_kind : 'LINK_CARD', src: embedsOn ? r.embed_src : null },
          adapterStatus: r.adapter_status,
        } : null,
        events: evRows.map((e) => ({
          id: e.id, slug: e.slug, title: e.title, type: e.type, relation: e.relation,
          // Tres verificaciones separadas: el estado del acontecimiento NUNCA depende de likes.
          verification: { contentStatus: e.status, officialConfirmed: e.status === 'OFFICIAL_SOURCE_CONFIRMED' },
          viewerFollows: viewerId ? Boolean(db.get('SELECT 1 FROM event_subscriptions WHERE event_id = ? AND user_id = ?', e.id, viewerId)) : false,
        })),
        counts: {
          reactions: db.get('SELECT COUNT(*) AS c FROM reactions WHERE post_id = ?', r.id).c,
          comments: db.get('SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND deleted_at IS NULL', r.id).c,
        },
        viewer: viewerId ? {
          reacted: Boolean(db.get('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ?', r.id, viewerId)),
          saved: Boolean(db.get('SELECT 1 FROM saves WHERE post_id = ? AND user_id = ?', r.id, viewerId)),
        } : { reacted: false, saved: false },
      };
    });
  }

  const BASE_SELECT = `SELECT p.*, pr.handle, pr.display_name, pr.avatar_url,
    m.provider, m.canonical_url, m.external_id, m.title AS media_title, m.author_name, m.author_url, m.site_name, m.thumbnail_url, m.embed_kind, m.embed_src, m.adapter_status
    FROM posts p JOIN profiles pr ON pr.user_id = p.author_id LEFT JOIN external_media_refs m ON m.id = p.media_ref_id`;

  function assertPostAccess(post, viewerId) {
    if (!post || post.deleted_at !== null) throw notFound('POST_NOT_FOUND');
    if (post.moderation_state === 'REMOVED' && post.author_id !== viewerId) throw notFound('POST_NOT_FOUND');
    if (post.visibility === 'PRIVATE' && post.author_id !== viewerId) throw notFound('POST_NOT_FOUND');
    if (post.visibility === 'FOLLOWERS' && post.author_id !== viewerId) {
      if (!viewerId) throw notFound('POST_NOT_FOUND');
      const isFollowing = Boolean(db.get("SELECT 1 FROM follows WHERE follower_id = ? AND target_type = 'USER' AND target_id = ?", viewerId, post.author_id));
      if (!isFollowing) throw notFound('POST_NOT_FOUND');
    }
    if (viewerId && post.author_id !== viewerId) {
      const isBlocked = Boolean(db.get("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", viewerId, post.author_id, post.author_id, viewerId));
      if (isBlocked) throw notFound('POST_NOT_FOUND');
    }
  }

  function getPost(id, viewerId = null) {
    const r = db.get(`${BASE_SELECT} WHERE p.id = ? AND p.deleted_at IS NULL`, id);
    if (!r) throw notFound('POST_NOT_FOUND');
    assertPostAccess(r, viewerId);
    return hydratePosts([r], viewerId)[0];
  }

  function listFeed({ viewerId = null, tab = 'for_you', category = null, lat = null, lon = null, radiusKm = 25, cursor = null, limit = 20 } = {}) {
    const cleanTab = oneOf(tab, ['for_you', 'following', 'nearby', 'news', 'live', 'saved'], 'tab', 'for_you');
    const lim = Math.min(50, Math.max(1, Number(limit) || 20));
    const cur = decodeCursor(cursor);
    const params = [];
    const where = ["p.deleted_at IS NULL", "p.moderation_state != 'REMOVED'"];
    if (viewerId) {
      where.push(`(p.visibility = 'PUBLIC' OR p.author_id = ? OR (p.visibility = 'FOLLOWERS' AND p.author_id IN (SELECT target_id FROM follows WHERE follower_id = ? AND target_type = 'USER')))`);
      params.push(viewerId, viewerId);
      where.push('p.author_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)');
      params.push(viewerId);
      where.push('p.author_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)');
      params.push(viewerId);
    } else {
      where.push("p.visibility = 'PUBLIC'");
    }
    if (category) { where.push('p.category = ?'); params.push(category); }
    if (cleanTab === 'following') {
      if (!viewerId) return { items: [], nextCursor: null };
      where.push(`(p.author_id IN (SELECT target_id FROM follows WHERE follower_id = ? AND target_type = 'USER')
        OR p.id IN (SELECT ep.post_id FROM event_posts ep JOIN event_subscriptions es ON es.event_id = ep.event_id WHERE es.user_id = ?))`);
      params.push(viewerId, viewerId);
    } else if (cleanTab === 'nearby') {
      if (lat !== null && lon !== null) {
        const box = bboxAround(Number(lat), Number(lon), Math.min(200, Math.max(1, Number(radiusKm) || 25)));
        where.push('p.lon_coarse BETWEEN ? AND ? AND p.lat_coarse BETWEEN ? AND ?');
        params.push(box[0], box[2], box[1], box[3]);
      } else where.push('p.lat_coarse IS NOT NULL');
    } else if (cleanTab === 'news') {
      where.push("(p.kind IN ('NEWS','LINK') OR p.category = 'news')");
    } else if (cleanTab === 'live') {
      where.push("(p.kind IN ('INCIDENT_REPORT','EVENT_UPDATE','HELP_REQUEST') OR EXISTS (SELECT 1 FROM event_posts ep WHERE ep.post_id = p.id))");
    } else if (cleanTab === 'saved') {
      if (!viewerId) return { items: [], nextCursor: null };
      where.push('p.id IN (SELECT post_id FROM saves WHERE user_id = ?)');
      params.push(viewerId);
    }
    if (cur) { where.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))'); params.push(cur.t, cur.t, cur.id); }
    const rows = db.all(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`, ...params, lim + 1);
    const hasMore = rows.length > lim;
    const slice = rows.slice(0, lim);
    const items = hydratePosts(slice, viewerId);
    // Ranking no adictivo en «Para ti»: preferencias explícitas + integridad de fuente + frescura; CERO peso a likes.
    if (cleanTab === 'for_you' && viewerId && !cur) {
      const prefs = new Set(JSON.parse(db.get('SELECT preferred_categories FROM user_settings WHERE user_id = ?', viewerId)?.preferred_categories || '[]'));
      if (prefs.size > 0) items.sort((a, b) => (prefs.has(b.category) - prefs.has(a.category)) || (b.author.verification.accountVerified - a.author.verification.accountVerified) || (b.createdAt - a.createdAt));
    }
    const last = slice[slice.length - 1];
    return { items, nextCursor: hasMore && last ? encodeCursor({ t: last.created_at, id: last.id }) : null };
  }

  /** Reacción a una publicación. Invariante TEST C: NO suscribe al evento ni envía avisos de evento. */
  function toggleReaction(userId, postId) {
    const p = db.get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!p) throw notFound('POST_NOT_FOUND');
    assertPostAccess(p, userId);
    const existing = db.get('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ?', postId, userId);
    if (existing) db.run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', postId, userId);
    else db.run('INSERT INTO reactions(post_id, user_id, kind, created_at) VALUES (?,?,?,?)', postId, userId, 'LIKE', Date.now());
    const count = db.get('SELECT COUNT(*) AS c FROM reactions WHERE post_id = ?', postId).c;
    return { reacted: !existing, count };
  }

  function toggleSave(userId, postId) {
    const p = db.get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!p) throw notFound('POST_NOT_FOUND');
    assertPostAccess(p, userId);
    const existing = db.get('SELECT 1 FROM saves WHERE post_id = ? AND user_id = ?', postId, userId);
    if (existing) db.run('DELETE FROM saves WHERE post_id = ? AND user_id = ?', postId, userId);
    else db.run('INSERT INTO saves(post_id, user_id, created_at) VALUES (?,?,?)', postId, userId, Date.now());
    return { saved: !existing };
  }

  function addComment(userId, postId, body) {
    const p = db.get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!p) throw notFound('POST_NOT_FOUND');
    assertPostAccess(p, userId);
    const text = str(body.body, { field: 'body', min: 1, max: 1000, required: true });
    const id = newId(), now = Date.now();
    db.run('INSERT INTO comments(id, post_id, author_id, body, created_at) VALUES (?,?,?,?,?)', id, postId, userId, text, now);
    if (p.author_id !== userId) {
      notifier.notify(p.author_id, { kind: 'COMMENT_ON_POST', category: 'SOCIAL', refType: 'POST', refId: postId,
        reason: 'Alguien comentó tu publicación', payload: { commentId: id, preview: text.slice(0, 140) }, dedupeKey: `comment:${id}` });
    }
    return listComments(postId, userId).find((c) => c.id === id);
  }

  function listComments(postId, viewerId = null) {
    const p = db.get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!p) throw notFound('POST_NOT_FOUND');
    assertPostAccess(p, viewerId);
    return db.all(`SELECT c.id, c.post_id, c.author_id, c.body, c.created_at, p.handle, p.display_name
      FROM comments c JOIN profiles p ON p.user_id = c.author_id WHERE c.post_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 200`, postId)
      .map((r) => ({ id: r.id, postId: r.post_id, body: r.body, createdAt: r.created_at, author: { id: r.author_id, handle: r.handle, displayName: r.display_name } }));
  }

  function listStories(now = Date.now(), viewerId = null) {
    const rows = db.all(`SELECT s.*, p.handle, p.display_name, e.title AS event_title, e.status AS event_status
      FROM stories s JOIN profiles p ON p.user_id = s.author_id LEFT JOIN events e ON e.id = s.event_id
      WHERE s.expires_at > ? ORDER BY s.created_at DESC LIMIT 60`, now);

    return rows.filter((s) => {
      // Check user mutual blocks
      if (viewerId && s.author_id !== viewerId) {
        const isBlocked = Boolean(db.get("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", viewerId, s.author_id, s.author_id, viewerId));
        if (isBlocked) return false;
      }
      // If story is linked to a post, ensure viewer is authorized to see that post
      if (s.post_id) {
        const p = db.get("SELECT author_id, visibility, moderation_state, deleted_at FROM posts WHERE id = ?", s.post_id);
        if (!p || p.deleted_at !== null) return false;
        if (p.moderation_state === 'REMOVED' && p.author_id !== viewerId) return false;
        if (p.visibility === 'PRIVATE' && p.author_id !== viewerId) return false;
        if (p.visibility === 'FOLLOWERS' && p.author_id !== viewerId) {
          if (!viewerId) return false;
          const isFollowing = Boolean(db.get("SELECT 1 FROM follows WHERE follower_id = ? AND target_type = 'USER' AND target_id = ?", viewerId, p.author_id));
          if (!isFollowing) return false;
        }
      }
      return true;
    }).map((s) => ({
      id: s.id, mode: s.mode, postId: s.post_id, eventId: s.event_id, eventTitle: s.event_title, eventStatus: s.event_status,
      text: s.text, url: s.url, createdAt: s.created_at, expiresAt: s.expires_at,
      isSimulation: s.mode === 'RESEARCH_SIMULATION',
      author: { id: s.author_id, handle: s.handle, displayName: s.display_name },
    }));
  }

  function toggleFollow(followerId, { targetType, targetId, notify = false }) {
    const tt = oneOf(targetType, ['USER', 'ORG'], 'targetType');
    const tid = str(targetId, { field: 'targetId', min: 1, max: 80, required: true });
    if (tt === 'USER' && tid === followerId) throw bad('CANNOT_FOLLOW_SELF');
    const cur = db.get('SELECT * FROM follows WHERE follower_id = ? AND target_type = ? AND target_id = ?', followerId, tt, tid);
    if (cur && notify === undefined) {
      db.run('DELETE FROM follows WHERE follower_id = ? AND target_type = ? AND target_id = ?', followerId, tt, tid);
      return { following: false, notify: false };
    }
    db.run('INSERT OR REPLACE INTO follows(follower_id, target_type, target_id, notify, created_at) VALUES (?,?,?,?,?)', followerId, tt, tid, notify ? 1 : 0, Date.now());
    return { following: true, notify: Boolean(notify) };
  }

  function toggleBlock(blockerId, blockedId) {
    if (blockerId === blockedId) throw bad('CANNOT_BLOCK_SELF');
    const cur = db.get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', blockerId, blockedId);
    if (cur) db.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', blockerId, blockedId);
    else db.run('INSERT INTO blocks(blocker_id, blocked_id, created_at) VALUES (?,?,?)', blockerId, blockedId, Date.now());
    return { blocked: !cur };
  }

  function deletePost(userId, postId) {
    const p = db.get('SELECT author_id FROM posts WHERE id = ? AND deleted_at IS NULL', postId);
    if (!p) throw notFound('POST_NOT_FOUND');
    if (p.author_id !== userId) throw forbidden('NOT_AUTHORIZED', 'Solo el autor puede eliminar la publicación');
    db.run('UPDATE posts SET deleted_at = ?, body = ?, title = ? WHERE id = ?', Date.now(), '', '[eliminado]', postId);
    return { deleted: true };
  }

  return { previewLink, createPost, getPost, listFeed, toggleReaction, toggleSave, addComment, listComments, listStories, toggleFollow, toggleBlock, deletePost };
}
