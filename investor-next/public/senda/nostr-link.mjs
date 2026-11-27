/**
 * SENDA · Enlace de la app con la RED SENDA (servidores propios) y, si se quiere, con canales adicionales.
 *
 * - Servidores SENDA propios (`packages/senda-relay`, hechos desde cero, sin dependencias): son la base. Hablan el
 *   protocolo abierto Nostr (NIP-01) en `wss://servidor/nostr`, se sincronizan entre ellos y solo guardan buzones
 *   cifrados SENDA. Los paga y controla el proyecto.
 * - Canal adicional opcional: relés Nostr públicos. Solo SUMAN redundancia y alcance; nada depende de ellos.
 *   Se pueden desactivar en «Transferir».
 * El teléfono no presta nada a cambio: publica lo suyo y, si lleva sobres ajenos que ya traen su evento exterior
 * (preparado por el remitente), los reenvía tal cual sin saber a quién van.
 * Núcleo probado: core/nostr-mailbox.mjs y core/nostr-client.mjs.
 */
import { createNostrPool, createNostrTransport, parseNostrRelays } from './core/nostr-client.mjs';

/** Servidores de la red SENDA. Vacío hasta que el fundador despliegue el primero (docs/red/DESPLIEGUE_RED_SENDA.md). */
export const SENDA_SERVERS = '';
/** Canal adicional: relés Nostr públicos, gratuitos e independientes (NIP-11 consultado el 27-11-2026). */
export const PUBLIC_EXTRA_RELAYS = 'wss://relay.damus.io, wss://relay.primal.net, wss://nos.lol, wss://nostr.mom';

export function initNostr({ S, kv, $, toast, receiveEnvelope, log, render }) {
  let pool = null, tr = null, timer = null;
  const status = { open: 0, total: 0, own: 0 };
  const lists = () => {
    const own = parseNostrRelays(S.net?.servers || SENDA_SERVERS);
    const extra = S.net?.publicExtra === false ? [] : parseNostrRelays(PUBLIC_EXTRA_RELAYS);
    return { own, all: [...new Set([...own, ...extra])].slice(0, 8) };
  };

  async function start() {
    stop();
    if (!S.me) return;
    const { own, all } = lists(); status.own = own.length;
    if (!all.length) return paint();
    const published = new Set((await kv.get('nostrPublished')) ?? []);
    const p = createNostrPool({
      relays: all,
      onEvent: (ev, relay) => { if (pool === p) tr?.handle(ev, relay).then(async (g) => { if (g) { await kv.set('store', S.store.snapshot()); render(); } }).catch(() => {}); },
      onStatus: () => { if (pool !== p) return; status.open = p.status().filter((r) => r.open).length; status.total = all.length; paint(); },
    });
    pool = p;
    tr = createNostrTransport({
      pool, identity: S.me, contacts: () => S.contacts, store: S.store, published, log,
      onEnvelope: (env, info) => receiveEnvelope(env, 'Internet (' + (own.includes(info.relay) ? 'red SENDA' : 'Nostr') + ' · ' + new URL(info.relay).host + ')'),
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
    const el = $('#net-state'); if (!el) return;
    el.textContent = !pool
      ? (status.own ? 'Sin conexión' : 'Sin servidores SENDA configurados y sin canal adicional')
      : `${status.open}/${status.total} conectados · ${status.own ? status.own + ' servidor(es) SENDA' : 'aún sin servidor SENDA propio'}${S.net?.publicExtra === false ? '' : ' + relés públicos'} · buzones vigilados: ${tr?.mailboxes().size ?? 0}`;
    el.className = status.open ? 'ok' : 'warn';
  }

  addEventListener('online', () => flush());
  return {
    start, stop, flush, sendReceipt, paint,
    active: () => !!pool,
    contactsChanged: () => tr?.refresh().then(paint),
    async configure({ servers, publicExtra }) {
      S.net = { servers: parseNostrRelays(servers).join(', '), publicExtra };
      await kv.set('net', S.net); await start();
      toast(`Red SENDA: ${parseNostrRelays(servers).length} servidor(es)${publicExtra ? ' + relés públicos' : ''}`);
    },
  };
}
