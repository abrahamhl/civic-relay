/**
 * Mensajería (chats directos, grupos y canales públicos/privados/institucionales) conectada
 * con los estados explícitos del núcleo SENDA:
 *   LOCAL_DRAFT · QUEUED_OFFLINE · IN_CUSTODY · FORWARDED · DELIVERED · VERIFIED · EXPIRED · FAILED
 *
 * Un mensaje recibido en el gateway empieza en `IN_CUSTODY` (un solo check). Solo pasa a
 * `DELIVERED` cuando el destinatario lo descarga o acusa recibo, y a `VERIFIED` cuando hay
 * recibo criptográfico del sobre SENDA v2.
 */
import { bad, forbidden, notFound, newId, str, oneOf } from '../http.mjs';
import { can, verifyAuthority } from '../rbac.mjs';

export const MESSAGE_STATES = Object.freeze(['LOCAL_DRAFT', 'QUEUED_OFFLINE', 'IN_CUSTODY', 'FORWARDED', 'DELIVERED', 'VERIFIED', 'EXPIRED', 'FAILED']);

export function createMessagingService(db, { rt, notifier, emergency, audit }) {
  function ensureDefaultChannels(creatorId) {
    const count = db.get('SELECT COUNT(*) AS c FROM channels').c;
    if (count > 0) return;
    const now = Date.now();
    for (const [name, topic] of [
      ['Noticias de mi zona', 'Cobertura verificada y enlaces de medios locales'],
      ['Meteorología', 'Avisos meteorológicos y observaciones'],
      ['Tráfico y corredores', 'Incidencias viales y estado de carreteras'],
      ['Comunidad', 'Ayuda vecinal e información práctica'],
      ['Emergencias públicas', 'Canal público de avisos y coordinación abierta'],
    ]) {
      const chId = newId(), convId = newId();
      db.run("INSERT INTO channels(id, kind, name, topic, created_by, created_at) VALUES (?,'PUBLIC',?,?,?,?)", chId, name, topic, creatorId, now);
      db.run("INSERT INTO conversations(id, kind, title, channel_id, created_by, created_at, updated_at) VALUES (?,'CHANNEL',?,?,?,?,?)", convId, name, chId, creatorId, now, now);
    }
  }

  async function createChannel(userId, body, { ip } = {}) {
    const kind = oneOf(body.kind, ['PUBLIC', 'PRIVATE', 'INSTITUTIONAL'], 'kind', 'PUBLIC');
    const name = str(body.name, { field: 'name', min: 2, max: 80, required: true });
    const topic = str(body.topic ?? '', { field: 'topic', max: 240 });
    let orgId = null;
    if (kind === 'INSTITUTIONAL') {
      orgId = str(body.orgId, { field: 'orgId', min: 1, max: 80, required: true });
      const auth = await verifyAuthority(db, userId, orgId);
      if (!auth.valid) {
        audit({ actorId: userId, action: 'channel.create_institutional', targetType: 'ORG', targetId: orgId, outcome: 'DENIED', severity: 'SECURITY', reason: auth.reason, ip });
        throw forbidden('INSTITUTIONAL_CREDENTIAL_REQUIRED', `Se requiere credencial institucional válida (${auth.reason})`);
      }
    }
    const chId = newId(), convId = newId(), now = Date.now();
    db.tx(() => {
      db.run('INSERT INTO channels(id, kind, name, topic, org_id, created_by, created_at) VALUES (?,?,?,?,?,?,?)', chId, kind, name, topic, orgId, userId, now);
      db.run('INSERT INTO channel_members(channel_id, user_id, role, joined_at) VALUES (?,?,?,?)', chId, userId, 'OWNER', now);
      db.run("INSERT INTO conversations(id, kind, title, channel_id, created_by, created_at, updated_at) VALUES (?,'CHANNEL',?,?,?,?,?)", convId, name, chId, userId, now, now);
      db.run('INSERT INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', convId, userId, now);
    });
    audit({ actorId: userId, action: 'channel.create', targetType: 'CHANNEL', targetId: chId, ip, meta: { kind, orgId } });
    return { id: chId, conversationId: convId, kind, name, topic, orgId };
  }

  async function joinChannel(userId, channelId, { ip } = {}) {
    const ch = db.get('SELECT * FROM channels WHERE id = ?', channelId);
    if (!ch) throw notFound('CHANNEL_NOT_FOUND');
    if (ch.kind === 'INSTITUTIONAL') {
      const auth = await verifyAuthority(db, userId, ch.org_id);
      if (!auth.valid && !can(db, userId, 'admin:read').allowed) {
        audit({ actorId: userId, action: 'channel.join', targetType: 'CHANNEL', targetId: channelId, outcome: 'DENIED', severity: 'SECURITY', reason: auth.reason, ip });
        throw forbidden('INSTITUTIONAL_CREDENTIAL_REQUIRED');
      }
    }
    const conv = db.get('SELECT id FROM conversations WHERE channel_id = ?', channelId);
    const now = Date.now();
    db.tx(() => {
      db.run('INSERT OR IGNORE INTO channel_members(channel_id, user_id, role, joined_at) VALUES (?,?,?,?)', channelId, userId, 'MEMBER', now);
      if (conv) db.run('INSERT OR IGNORE INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', conv.id, userId, now);
    });
    return { joined: true, channelId, conversationId: conv?.id };
  }

  function listChannels(userId) {
    return db.all(`SELECT c.*, o.name AS org_name, o.kind AS org_kind, conv.id AS conversation_id,
      EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS joined
      FROM channels c LEFT JOIN organizations o ON o.id = c.org_id LEFT JOIN conversations conv ON conv.channel_id = c.id ORDER BY c.kind, c.name`, userId ?? '')
      .map((c) => ({ id: c.id, kind: c.kind, name: c.name, topic: c.topic, orgId: c.org_id, orgName: c.org_name, orgKind: c.org_kind, conversationId: c.conversation_id, joined: Boolean(c.joined) }));
  }

  function createOrGetConversation(userId, body) {
    const kind = oneOf(body.kind, ['DIRECT', 'GROUP'], 'kind', 'DIRECT');
    const members = Array.isArray(body.memberIds) ? [...new Set([userId, ...body.memberIds.map(String)])] : [userId];
    if (kind === 'DIRECT') {
      const peerId = body.peerId ? String(body.peerId) : members.find((m) => m !== userId);
      if (!peerId) throw bad('PEER_REQUIRED');
      if (!db.get("SELECT 1 FROM users WHERE id = ? AND status = 'ACTIVE'", peerId)) throw notFound('USER_NOT_FOUND');
      const directKey = [userId, peerId].sort().join(':');
      const existing = db.get('SELECT id FROM conversations WHERE direct_key = ?', directKey);
      if (existing) return getConversation(userId, existing.id);
      const id = newId(), now = Date.now();
      const peer = db.get('SELECT display_name FROM profiles WHERE user_id = ?', peerId);
      db.tx(() => {
        db.run("INSERT INTO conversations(id, kind, title, direct_key, created_by, created_at, updated_at) VALUES (?,'DIRECT',?,?,?,?,?)", id, peer?.display_name || 'Chat', directKey, userId, now, now);
        db.run('INSERT INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', id, userId, now);
        db.run('INSERT INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', id, peerId, now);
      });
      return getConversation(userId, id);
    }
    const title = str(body.title, { field: 'title', min: 2, max: 80, required: true });
    const id = newId(), now = Date.now();
    db.tx(() => {
      db.run("INSERT INTO conversations(id, kind, title, created_by, created_at, updated_at) VALUES (?,'GROUP',?,?,?,?)", id, title, userId, now, now);
      for (const m of members.slice(0, 50)) db.run('INSERT OR IGNORE INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', id, m, now);
    });
    return getConversation(userId, id);
  }

  async function requireMember(userId, conversationId) {
    const conv = db.get('SELECT * FROM conversations WHERE id = ?', conversationId);
    if (!conv) throw notFound('CONVERSATION_NOT_FOUND');
    if (conv.channel_id) {
      const ch = db.get('SELECT * FROM channels WHERE id = ?', conv.channel_id);
      if (ch.kind === 'PUBLIC') {
        db.run('INSERT OR IGNORE INTO conversation_members(conversation_id, user_id, joined_at) VALUES (?,?,?)', conversationId, userId, Date.now());
        return conv;
      }
      if (ch.kind === 'INSTITUTIONAL') {
        const auth = await verifyAuthority(db, userId, ch.org_id);
        if (!auth.valid) throw forbidden('INSTITUTIONAL_CREDENTIAL_REQUIRED');
      }
    }
    const mem = db.get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', conversationId, userId);
    if (!mem) throw forbidden('NOT_CONVERSATION_MEMBER');
    return conv;
  }

  async function sendMessage(userId, conversationId, body) {
    await requireMember(userId, conversationId);
    const clientId = str(body.clientId || newId(), { field: 'clientId', min: 1, max: 80, required: true });
    const dup = db.get('SELECT * FROM messages WHERE sender_id = ? AND client_id = ?', userId, clientId);
    if (dup) return hydrateMessage(dup);
    if (body.envelope) return emergency.storeEnvelope(userId, { envelope: body.envelope, conversationId, clientId });
    const text = str(body.body, { field: 'body', min: 1, max: 2000, required: true });
    const priority = Math.min(9, Math.max(0, Number(body.priority ?? 5) | 0));
    const id = newId(), now = Date.now();
    // Estado honesto: guardado en el gateway = IN_CUSTODY (1 check), NO DELIVERED.
    db.tx(() => {
      db.run(`INSERT INTO messages(id, conversation_id, sender_id, body, priority, state, client_id, created_at) VALUES (?,?,?,?,?,'IN_CUSTODY',?,?)`,
        id, conversationId, userId, text, priority, clientId, now);
      db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', now, conversationId);
    });
    const msg = hydrateMessage(db.get('SELECT * FROM messages WHERE id = ?', id));
    const peers = db.all('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', conversationId, userId);
    for (const { user_id } of peers) rt.publish('MESSAGE_RECEIVED', { audienceType: 'USER', audienceId: user_id }, { conversationId, message: msg });
    return msg;
  }

  async function listMessages(userId, conversationId) {
    await requireMember(userId, conversationId);
    const now = Date.now();
    // Cuando un destinatario distinto del emisor lee la conversación, los mensajes en IN_CUSTODY pasan a DELIVERED.
    const toDeliver = db.all("SELECT id, sender_id FROM messages WHERE conversation_id = ? AND sender_id != ? AND state = 'IN_CUSTODY'", conversationId, userId);
    if (toDeliver.length > 0) {
      db.run("UPDATE messages SET state = 'DELIVERED', delivered_at = ? WHERE conversation_id = ? AND sender_id != ? AND state = 'IN_CUSTODY'", now, conversationId, userId);
      for (const m of toDeliver) rt.publish('MESSAGE_ACKNOWLEDGED', { audienceType: 'USER', audienceId: m.sender_id }, { messageId: m.id, conversationId, state: 'DELIVERED' });
    }
    const rows = db.all(`SELECT m.*, p.handle, p.display_name FROM messages m JOIN profiles p ON p.user_id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at ASC LIMIT 200`, conversationId);
    return rows.map(hydrateMessage);
  }

  function hydrateMessage(m) {
    const sender = db.get('SELECT handle, display_name FROM profiles WHERE user_id = ?', m.sender_id);
    return {
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      sender: sender ? { id: m.sender_id, handle: sender.handle, displayName: sender.display_name } : { id: m.sender_id },
      body: m.body, envelope: m.envelope ? JSON.parse(m.envelope) : null, envelopeId: m.envelope_id,
      priority: m.priority, state: m.state, clientId: m.client_id, createdAt: m.created_at, deliveredAt: m.delivered_at, verifiedAt: m.verified_at,
      checks: m.state === 'VERIFIED' || m.state === 'DELIVERED' ? 2 : (m.state === 'IN_CUSTODY' || m.state === 'FORWARDED' ? 1 : 0),
    };
  }

  function listConversations(userId) {
    return db.all(`SELECT c.* FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id WHERE cm.user_id = ? ORDER BY c.updated_at DESC`, userId).map((c) => getConversation(userId, c.id));
  }

  function getConversation(userId, id) {
    const c = db.get('SELECT * FROM conversations WHERE id = ?', id);
    if (!c) throw notFound('CONVERSATION_NOT_FOUND');
    const members = db.all('SELECT p.user_id AS id, p.handle, p.display_name AS displayName FROM conversation_members cm JOIN profiles p ON p.user_id = cm.user_id WHERE cm.conversation_id = ?', id);
    const last = db.get('SELECT body, state, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', id);
    return { id: c.id, kind: c.kind, title: c.title, channelId: c.channel_id, updatedAt: c.updated_at, members, lastMessage: last ? { preview: (last.body || '[sobre SENDA cifrado]').slice(0, 80), state: last.state, createdAt: last.created_at } : null };
  }

  return { ensureDefaultChannels, createChannel, joinChannel, listChannels, createOrGetConversation, sendMessage, listMessages, listConversations, getConversation };
}
