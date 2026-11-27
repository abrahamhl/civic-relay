/**
 * Relé Nostr mínimo (NIP-01 + NIP-40) para buzones SENDA, sin dependencias (WebSocket RFC 6455 a mano).
 *
 * Solo acepta eventos kind 1059 (buzón cifrado SENDA / gift wrap NIP-59) con firma BIP-340 válida, caducidad
 * futura y tamaño acotado. Reparte en tiempo real a quien esté suscrito a ese buzón (`#p`) y guarda hasta la
 * caducidad para quien se conecte después (almacenar y reenviar).
 * Se monta en el mismo servidor del relé SENDA (ruta /nostr) o solo. Con él, el servidor que pague el fundador es
 * UN relé más de la red Nostr: los móviles publican a la vez en él y en relés públicos; si cae, siguen los otros.
 */
import { createHash } from 'node:crypto';
import { verifyEvent, MAILBOX_KIND } from '../senda/src/nostr-mailbox.mjs';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 256 * 1024;

function frame(text) {
  const p = Buffer.from(text, 'utf8'); const n = p.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  return Buffer.concat([head, p]);
}

/** Envuelve un socket ya actualizado: decodifica tramas enmascaradas del cliente y entrega mensajes de texto. */
function wsConnection(socket, onText, onClose) {
  let buf = Buffer.alloc(0), parts = [], closed = false;
  const close = () => { if (closed) return; closed = true; try { socket.end(Buffer.from([0x88, 0])); } catch { /* */ } onClose(); };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > BigInt(MAX_FRAME)) return close(); len = Number(big); off = 10; }
      if (len > MAX_FRAME || !masked) return close(); // RFC 6455: el cliente SIEMPRE enmascara
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 0x8) return close();
      if (op === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data.subarray(0, 125)])); continue; }
      if (op === 0xa) continue;
      if (op === 0x1 || op === 0x0) {
        parts.push(data);
        if (parts.reduce((a, b) => a + b.length, 0) > MAX_FRAME) return close();
        if (fin) { const txt = Buffer.concat(parts).toString('utf8'); parts = []; onText(txt); }
        continue;
      }
      return close();
    }
  });
  socket.on('close', close); socket.on('error', close);
  return { send: (obj) => { if (!closed) socket.write(frame(JSON.stringify(obj))); }, close };
}

function matches(ev, f) {
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.ids && !f.ids.includes(ev.id)) return false;
  if (f['#p'] && !ev.tags.some((t) => t[0] === 'p' && f['#p'].includes(t[1]))) return false;
  if (Number.isFinite(f.since) && ev.created_at < f.since) return false;
  if (Number.isFinite(f.until) && ev.created_at > f.until) return false;
  return true;
}
const expOf = (ev) => +(ev.tags.find((t) => t[0] === 'expiration')?.[1] ?? NaN);

/**
 * @param {{now?:()=>number, maxEventBytes?:number, maxEvents?:number, maxTtlS?:number, ratePerMin?:number, snapshot?:object[]}} o
 */
export function createNostrRelay({ now = () => Date.now(), maxEventBytes = 128 * 1024, maxEvents = 50_000, maxTtlS = 90 * 86400, ratePerMin = 240, snapshot = [] } = {}) {
  const events = new Map(); const conns = new Set();
  for (const ev of snapshot) if (ev?.id) events.set(ev.id, ev);
  const purge = () => { const t = now() / 1000; for (const [id, ev] of events) if (!(expOf(ev) > t)) events.delete(id); };

  async function accept(ev) {
    if (!ev || ev.kind !== MAILBOX_KIND || !Array.isArray(ev.tags) || typeof ev.content !== 'string') return [false, 'invalid: solo buzones SENDA (kind 1059)'];
    if (JSON.stringify(ev).length > maxEventBytes) return [false, 'invalid: demasiado grande'];
    const t = now() / 1000, exp = expOf(ev);
    if (!(exp > t) || exp > t + maxTtlS) return [false, 'invalid: caducidad ausente o fuera de rango'];
    if (Math.abs(ev.created_at - t) > 2 * 86400) return [false, 'invalid: fecha fuera de rango'];
    if (!ev.tags.some((x) => x[0] === 'p' && /^[0-9a-f]{64}$/.test(x[1] ?? ''))) return [false, 'invalid: sin buzón'];
    if (!(await verifyEvent(ev))) return [false, 'invalid: firma'];
    if (events.has(ev.id)) return [true, 'duplicate:'];
    if (events.size >= maxEvents) { purge(); if (events.size >= maxEvents) return [false, 'error: relé lleno'] }
    events.set(ev.id, ev);
    for (const c of conns) for (const [sid, filters] of c.subs) if (filters.some((f) => matches(ev, f))) c.ws.send(['EVENT', sid, ev]);
    return [true, ''];
  }

  function handleUpgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
    const acceptKey = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);
    const c = { subs: new Map(), n: 0, t: now() };
    c.ws = wsConnection(socket, async (txt) => {
      const t = now(); if (t - c.t > 60_000) { c.n = 0; c.t = t; } if (++c.n > ratePerMin) return c.ws.send(['NOTICE', 'rate-limited']);
      let m; try { m = JSON.parse(txt); } catch { return c.ws.send(['NOTICE', 'invalid: JSON']); }
      if (!Array.isArray(m)) return;
      if (m[0] === 'EVENT') { const [ok, msg] = await accept(m[1]); return c.ws.send(['OK', m[1]?.id ?? '', ok, msg]); }
      if (m[0] === 'REQ' && typeof m[1] === 'string') {
        const filters = m.slice(2).filter((f) => f && typeof f === 'object').slice(0, 10);
        if (filters.some((f) => (f['#p']?.length ?? 0) > 1000)) return c.ws.send(['CLOSED', m[1], 'invalid: demasiados buzones']);
        if (!c.subs.has(m[1]) && c.subs.size >= 20) return c.ws.send(['CLOSED', m[1], 'invalid: demasiadas suscripciones']);
        c.subs.set(m[1], filters); purge();
        const limit = Math.min(500, ...filters.map((f) => (Number.isFinite(f.limit) ? f.limit : 500)));
        const hits = [...events.values()].filter((ev) => filters.some((f) => matches(ev, f))).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
        for (const ev of hits) c.ws.send(['EVENT', m[1], ev]);
        return c.ws.send(['EOSE', m[1]]);
      }
      if (m[0] === 'CLOSE') { c.subs.delete(m[1]); }
    }, () => conns.delete(c));
    conns.add(c);
  }

  return { handleUpgrade, accept, count: () => events.size, snapshot: () => [...events.values()], purge, connections: () => conns.size, closeAll: () => { for (const c of conns) c.ws.close(); } };
}
