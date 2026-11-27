/**
 * SENDA · Cliente Nostr multi-relé + transporte de buzones cifrados.
 *
 * - Pool: una conexión WebSocket por relé, reconexión con retroceso, suscripción en tiempo real que se reenvía al
 *   reconectar, y publicación en TODOS a la vez (basta con que uno confirme). Funciona en navegador, WebView de
 *   Android y Node ≥ 22 (WebSocket global).
 * - Transporte: publica cada sobre pendiente (con el evento exterior que preparó el remitente, o creándolo si el
 *   destinatario es mi contacto), publica lo pendiente, escucha mis buzones y entrega lo recibido al almacén y a la app. Mide la latencia
 *   (creación del sobre → llegada) con el reloj de cada móvil.
 */
import { myMailboxes, mailboxFilter, wrapEnvelope, wrapReceipt, unwrapEvent, pairSecret, pairMailbox, DAY_MS } from './nostr-mailbox.mjs';

/** Solo relés wss:// (o ws:// a localhost para pruebas), sin credenciales en la URL; máximo 8. */
export function parseNostrRelays(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/[\s,;]+/)) {
    const u = raw.trim(); if (!u) continue;
    let url; try { url = new URL(u); } catch { continue; }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && local)) continue;
    if (url.username || url.password) continue;
    const norm = url.href.replace(/\/$/, '');
    if (!out.includes(norm)) out.push(norm);
  }
  return out.slice(0, 8);
}

export function createNostrPool({ relays, WebSocketImpl = globalThis.WebSocket, onEvent = () => {}, onStatus = () => {}, setTimer = setTimeout, clock = () => Date.now() }) {
  const R = new Map(); let sub = null, closed = false, subSeq = 0; const waiting = new Map();
  for (const url of relays) R.set(url, { url, ws: null, open: false, backoff: 1000, queue: [] });

  function connect(r) {
    if (closed) return;
    let ws; try { ws = new WebSocketImpl(r.url); } catch { return retry(r); }
    r.ws = ws;
    ws.onopen = () => { r.open = true; r.backoff = 1000; onStatus({ url: r.url, state: 'open' }); if (sub) ws.send(JSON.stringify(['REQ', sub.id, sub.filter])); for (const m of r.queue.splice(0)) ws.send(m); };
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(typeof m.data === 'string' ? m.data : new TextDecoder().decode(m.data)); } catch { return; }
      if (d[0] === 'EVENT' && sub && d[1] === sub.id) onEvent(d[2], r.url);
      else if (d[0] === 'OK') { const w = waiting.get(d[1]); if (w) w.answer(r.url, d[2] === true, String(d[3] ?? '')); }
      else if (d[0] === 'EOSE') onStatus({ url: r.url, state: 'eose' });
      else if (d[0] === 'CLOSED' || d[0] === 'NOTICE') onStatus({ url: r.url, state: d[0].toLowerCase(), msg: String(d[2] ?? d[1] ?? '') });
    };
    ws.onclose = () => { r.open = false; onStatus({ url: r.url, state: 'closed' }); retry(r); };
    ws.onerror = () => { try { ws.close(); } catch { /* */ } };
  }
  function retry(r) { if (closed) return; const ms = r.backoff; r.backoff = Math.min(r.backoff * 2, 60_000); setTimer(() => connect(r), ms); }
  for (const r of R.values()) connect(r);

  const sendAll = (msg) => { for (const r of R.values()) { if (r.open) r.ws.send(msg); else if (r.queue.length < 200) r.queue.push(msg); } };

  return {
    /** Sustituye la suscripción (mis buzones). */
    subscribe(filter) {
      const old = sub; sub = { id: `senda-${++subSeq}`, filter };
      for (const r of R.values()) if (r.open) { if (old) r.ws.send(JSON.stringify(['CLOSE', old.id])); r.ws.send(JSON.stringify(['REQ', sub.id, filter])); }
    },
    /** Publica en todos; resuelve cuando todos responden o al agotar el tiempo. ok = al menos un relé lo aceptó. */
    publish(ev, { timeoutMs = 8000 } = {}) {
      return new Promise((resolve) => {
        const t0 = clock(), answers = [];
        // Se espera solo a los relés conectados ahora; a los que estén reconectando se les envía igual (cola) más tarde.
        const expected = Math.max(1, [...R.values()].filter((r) => r.open).length);
        const done = () => { waiting.delete(ev.id); resolve({ ok: answers.some((a) => a.ok), answers, ms: clock() - t0 }); };
        waiting.set(ev.id, { answer: (url, ok, msg) => { if (!answers.some((a) => a.url === url)) answers.push({ url, ok, msg, ms: clock() - t0 }); if (answers.length >= expected) done(); } });
        sendAll(JSON.stringify(['EVENT', ev]));
        setTimer(() => { if (waiting.has(ev.id)) done(); }, timeoutMs);
      });
    },
    status: () => [...R.values()].map((r) => ({ url: r.url, open: r.open })),
    close() { closed = true; for (const r of R.values()) { try { r.ws?.close(); } catch { /* */ } } },
  };
}

/**
 * Transporte de buzones: une el almacén SENDA (bundle) con la red Nostr.
 * @param {object} p
 * @param {ReturnType<typeof createNostrPool>} p.pool
 * @param {object} p.identity  identidad propia (con claves privadas)
 * @param {() => Array<{fingerprint:string, boxPub:object}>} p.contacts
 * @param {object} p.store     createBundleStore
 * @param {(env:object, info:{relay:string}) => Promise<void>} p.onEnvelope  sobre para mí
 * @param {(e:object) => void} [p.log]
 */
export function createNostrTransport({ pool, identity, contacts, store, onEnvelope, log = () => {}, now = () => Date.now(), carryForOthers = true, published = new Set() }) {
  let boxes = new Map(); const seen = new Set();
  const me = identity.publicIdentity.fingerprint;
  const pairCache = new Map();
  async function secretFor(c) { if (!pairCache.has(c.fingerprint)) pairCache.set(c.fingerprint, await pairSecret(identity, c)); return pairCache.get(c.fingerprint); }

  async function refresh() {
    boxes = await myMailboxes({ identity, contacts: contacts(), nowMs: now() });
    pool.subscribe(mailboxFilter(boxes.keys(), now() - 8 * DAY_MS));
    return boxes.size;
  }

  async function handle(ev, relay) {
    if (!ev?.id || seen.has(ev.id)) return null; seen.add(ev.id);
    const got = await unwrapEvent(ev, boxes); if (!got) return null;
    if (got.type === 'RECEIPT') { const r = await store.acceptReceiptDetailed?.(got.receipt, { now: now() }) ?? await store.acceptReceipt(got.receipt); log({ ev: 'RECIBO_NOSTR', id: got.receipt.id, relay: host(relay), ok: !!(r?.ok ?? r) }); return got; }
    const env = got.envelope;
    if (env.header.to === me) { await onEnvelope(env, { relay, mailbox: got.mailbox.kind }); return got; }
    // Buzón de pareja usado para un sobre que no es para mí: no debería pasar; se guarda como tránsito.
    await store.ingest({ envelopes: [{ env, copies: 1, hops: 1 }] }, { now: now() });
    return got;
  }

  /**
   * Publica cada sobre pendiente una vez. Si lleva evento exterior del remitente, se publica TAL CUAL (vale igual para
   * mis mensajes y para los que transporto de otros). Si no lo lleva y el destinatario es mi contacto, lo creo.
   * Un sobre ajeno sin evento exterior no se publica: viajará por Bluetooth o por el relé SENDA de sincronización.
   */
  async function flush() {
    const t = now(), day = Math.floor(t / DAY_MS), res = [];
    const byFp = new Map(contacts().map((c) => [c.fingerprint, c]));
    for (const it of store.list()) {
      if (published.has(it.id) || it.to === me || t > it.expiresAt) continue;
      const env = store.get(it.id); if (!env) continue;
      const c = byFp.get(it.to), pre = store.getWrap?.(it.id) ?? null;
      if (!pre && !c) continue;
      if (pre && !c && !carryForOthers) continue;
      const ev = pre ?? await wrapEnvelope({ mailbox: await pairMailbox(await secretFor(c), day), envelope: env, nowMs: t });
      const mailbox = { kind: pre ? (c ? 'PAIR' : 'PAIR_CARRIED') : 'PAIR' };
      const r = await pool.publish(ev);
      log({ ev: r.ok ? 'ENVIADO' : 'NOSTR_FALLO', via: 'NOSTR', ids: [it.id], mailbox: mailbox.kind, bytes: ev.content.length, relaysOk: r.answers.filter((a) => a.ok).length, relays: r.answers.length, firstOkMs: Math.min(...r.answers.filter((a) => a.ok).map((a) => a.ms), Infinity), msgs: r.answers.filter((a) => !a.ok).map((a) => `${host(a.url)}: ${a.msg}`) });
      if (r.ok) published.add(it.id);
      res.push({ id: it.id, ok: r.ok, mailbox: mailbox.kind });
    }
    return res;
  }

  /** Recibo de vuelta al remitente (si es contacto), por el buzón de la pareja. */
  async function sendReceipt(receipt, senderFingerprint) {
    const c = contacts().find((x) => x.fingerprint === senderFingerprint); if (!c) return null;
    const mailbox = await pairMailbox(await secretFor(c), Math.floor(now() / DAY_MS));
    return pool.publish(await wrapReceipt({ mailbox, receipt, nowMs: now() }));
  }

  return { refresh, handle, flush, sendReceipt, mailboxes: () => boxes, published };
}

const host = (u) => { try { return new URL(u).host; } catch { return String(u); } };
