/**
 * SENDA · Enlace de la app con la red Nostr descentralizada (buzones cifrados y cegados).
 * Activado por defecto, con interruptor y lista de relés editable en «Transferir». Sin cuenta ni servidor propio.
 * Núcleo probado: core/nostr-mailbox.mjs y core/nostr-client.mjs.
 */
import { createNostrPool, createNostrTransport, parseNostrRelays } from './core/nostr-client.mjs';

/** Relés públicos por defecto: independientes entre sí, sin pago ni registro (NIP-11 consultado el 27-11-2026). */
export const DEFAULT_NOSTR_RELAYS = 'wss://relay.damus.io, wss://relay.primal.net, wss://nos.lol, wss://nostr.mom';

export function initNostr({ S, kv, $, toast, receiveEnvelope, log, render }) {
  let pool = null, tr = null, timer = null;
  const status = { open: 0, total: 0 };

  async function start() {
    stop();
    if (!S.me || S.nostr?.on === false) return;
    const relays = parseNostrRelays(S.nostr?.relays ?? DEFAULT_NOSTR_RELAYS);
    if (!relays.length) return;
    const published = new Set((await kv.get('nostrPublished')) ?? []);
    pool = createNostrPool({
      relays,
      onEvent: (ev, relay) => tr?.handle(ev, relay).then(async (g) => { if (g) { await kv.set('store', S.store.snapshot()); render(); } }).catch(() => {}),
      onStatus: () => { status.open = pool.status().filter((r) => r.open).length; status.total = relays.length; paint(); },
    });
    tr = createNostrTransport({
      pool, identity: S.me, contacts: () => S.contacts, store: S.store, published, log,
      acceptDrops: S.nostr?.drops !== false,
      onEnvelope: (env, info) => receiveEnvelope(env, 'Internet (Nostr · ' + new URL(info.relay).host + ')'),
    });
    await tr.refresh();
    timer = setInterval(() => { flush(); }, 30_000);
    setTimeout(flush, 1500);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; pool?.close(); pool = null; tr = null; status.open = 0; paint(); }

  let flushing = false;
  async function flush() {
    if (!tr || flushing || navigator.onLine === false) return;
    flushing = true;
    try {
      const r = await tr.flush();
      if (r.length) { await kv.set('nostrPublished', [...tr.published].slice(-2000)); await kv.set('msglog', S.log); render(); }
    } finally { flushing = false; }
  }
  async function sendReceipt(receipt, senderFp) { if (tr && senderFp) { try { await tr.sendReceipt(receipt, senderFp); } catch { /* el recibo también viaja por las demás vías */ } } }
  function paint() {
    const el = $('#nostr-state'); if (!el) return;
    el.textContent = !pool ? 'Desactivada' : `${status.open}/${status.total || '…'} relés conectados · buzones vigilados: ${tr?.mailboxes().size ?? 0}`;
    el.className = status.open ? 'ok' : 'warn';
  }

  addEventListener('online', () => flush());
  return {
    start, stop, flush, sendReceipt, paint,
    contactsChanged: () => tr?.refresh().then(paint),
    async configure({ on, relays, drops }) {
      S.nostr = { on, relays: relays || DEFAULT_NOSTR_RELAYS, drops };
      await kv.set('nostr', S.nostr); await start();
      toast(on ? 'Red descentralizada activada' : 'Red descentralizada desactivada');
    },
  };
}
