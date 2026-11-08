/**
 * Tiempo real: Server-Sent Events con reanudación por Last-Event-ID (= seq persistido).
 * Elegimos SSE frente a WebSocket porque el flujo dominante es servidor → cliente
 * (avisos, nuevas publicaciones, estados de mensaje), funciona sobre HTTP/1.1 y HTTP/2 sin
 * infraestructura adicional, atraviesa proxies y se reconecta solo. Los envíos del cliente
 * van por POST idempotente.
 */
export const RT_TYPES = Object.freeze(['POST_CREATED', 'POST_UPDATED', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_CORROBORATED', 'EVENT_RETRACTED', 'EVENT_FOLLOWED',
  'ALERT_PUBLISHED', 'ALERT_RETRACTED', 'MESSAGE_RECEIVED', 'MESSAGE_ACKNOWLEDGED', 'MODERATION_APPLIED', 'SOURCE_STALE', 'NOTIFICATION']);

export function createRealtimeHub(db, { maxPerUser = 5, heartbeatMs = 20_000 } = {}) {
  const byUser = new Map();     // userId → Set<res>
  const anon = new Set();
  let total = 0;

  function write(res, row) {
    res.write(`id: ${row.seq}\nevent: ${row.type}\ndata: ${row.payload}\n\n`);
  }

  function publish(type, { audienceType = 'PUBLIC', audienceId = null } = {}, payload = {}) {
    const data = JSON.stringify({ type, ...payload });
    const r = db.run('INSERT INTO realtime_events(type, audience_type, audience_id, payload, created_at) VALUES (?,?,?,?,?)', type, audienceType, audienceId, data, Date.now());
    const row = { seq: Number(r.lastInsertRowid), type, payload: data };
    if (audienceType === 'PUBLIC') {
      for (const set of byUser.values()) for (const res of set) write(res, row);
      for (const res of anon) write(res, row);
    } else if (audienceType === 'USER') {
      for (const res of byUser.get(audienceId) ?? []) write(res, row);
    }
    return row.seq;
  }

  function attach(req, res, userId, lastEventId) {
    if (userId && (byUser.get(userId)?.size ?? 0) >= maxPerUser) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'TOO_MANY_STREAMS' }));
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const since = Number.isSafeInteger(Number(lastEventId)) ? Number(lastEventId) : null;
    if (since !== null && since >= 0) {
      const rows = db.all(`SELECT seq, type, payload FROM realtime_events WHERE seq > ? AND (audience_type = 'PUBLIC' OR (audience_type = 'USER' AND audience_id = ?)) ORDER BY seq LIMIT 1000`, since, userId ?? '');
      for (const row of rows) write(res, row);
    } else {
      const head = db.get('SELECT MAX(seq) AS s FROM realtime_events')?.s ?? 0;
      res.write(`id: ${head}\nevent: HELLO\ndata: ${JSON.stringify({ type: 'HELLO', seq: head })}\n\n`);
    }
    const set = userId ? (byUser.get(userId) ?? byUser.set(userId, new Set()).get(userId)) : anon;
    set.add(res); total++;
    const hb = setInterval(() => res.write(': hb\n\n'), heartbeatMs);
    const close = () => { clearInterval(hb); if (set.delete(res)) total--; if (userId && set.size === 0) byUser.delete(userId); };
    req.on('close', close);
    res.on('error', close);
  }

  function closeAll() {
    for (const set of byUser.values()) for (const res of set) res.end();
    for (const res of anon) res.end();
    byUser.clear(); anon.clear(); total = 0;
  }

  return { publish, attach, closeAll, stats: () => ({ connections: total, users: byUser.size }) };
}
