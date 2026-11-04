/**
 * Almacenar-transportar-reenviar (DTN) entre teléfonos.
 *
 * Cada teléfono con SENDA guarda sobres CIFRADOS de otros y los entrega al cruzarse con
 * otro teléfono por cualquier medio: sonido, archivo por Quick Share/AirDrop/Bluetooth,
 * Wi-Fi local, USB. Funciona con cero infraestructura.
 *
 * Protocolo de sincronización (anti-entropía, 2 pasos):
 *   1. Cada par envía su RESUMEN: ids que tiene + recibos de entrega que conoce.
 *   2. Cada par envía lo que al otro le falta, por orden: dirigido a ese par → prioridad
 *      (SOS primero) → caducidad más cercana; dentro de un presupuesto de bytes.
 * Control de inundación: «spray-and-wait» binario (cada sobre nace con L copias; al
 * pasarlo se reparte la mitad; con 1 copia solo se entrega al destinatario).
 * Recibos: el destinatario publica el secreto de acuse; cualquiera verifica su hash
 * contra la cabecera y BORRA sus copias. No se pueden falsificar sin leer el mensaje.
 */
import { ackHashOf } from './envelope.mjs';
import { unb64 } from './b64.mjs';

export const BUNDLE_FORMAT = 'senda-bundle/1';

export function createBundleStore({ owner, quotaBytes = 8 * 1024 * 1024, initialCopies = 8, maxHops = 24 } = {}) {
  const items = new Map();      // id → {env, copies, hops, size, storedAt}
  const receipts = new Map();   // id → ackSecret (verificado)
  const broadcasts = new Map(); // id → {payload, expiresAt}: alertas/órdenes FIRMADAS (públicas) para toda una zona
  let used = 0;

  const size = (env) => JSON.stringify(env).length;
  function evictFor(bytes) {
    if (bytes > quotaBytes) return false;
    const victims = [...items.values()].filter((i) => i.env.header.to !== owner)
      .sort((a, b) => b.env.header.priority - a.env.header.priority || a.env.header.expiresAt - b.env.header.expiresAt);
    while (used + bytes > quotaBytes && victims.length) { const v = victims.shift(); items.delete(v.env.header.id); used -= v.size; }
    return used + bytes <= quotaBytes;
  }

  return {
    owner,
    has: (id) => items.has(id),
    get: (id) => items.get(id)?.env,
    count: () => items.size,
    bytesUsed: () => used,
    copiesOf: (id) => items.get(id)?.copies,

    /** Añade un sobre propio o recibido. */
    put(env, { copies = initialCopies, hops = 0, now }) {
      const id = env.header.id;
      if (receipts.has(id)) return { stored: false, reason: 'ALREADY_DELIVERED' };
      if (now > env.header.expiresAt) return { stored: false, reason: 'EXPIRED' };
      if (hops > maxHops) return { stored: false, reason: 'HOP_LIMIT' };
      if (items.has(id)) { items.get(id).copies = Math.max(items.get(id).copies, copies); return { stored: false, reason: 'DUPLICATE' }; }
      const s = size(env);
      if (!evictFor(s)) return { stored: false, reason: 'QUOTA' };
      items.set(id, { env, copies, hops, size: s, storedAt: now }); used += s;
      return { stored: true };
    },

    /** Elimina caducados. */
    purgeExpired(now) { let n = 0; for (const [id, i] of items) if (now > i.env.header.expiresAt) { items.delete(id); used -= i.size; n++; } for (const [id, b] of broadcasts) if (now > b.expiresAt) { broadcasts.delete(id); n++; } return n; },

    /** Difusión firmada (alerta u orden de coordinador). Se transporta a todos; cada teléfono verifica la firma. */
    putBroadcast(payload, { now }) {
      if (!payload?.id || !(payload.expiresAt > now)) return { stored: false, reason: 'EXPIRED_OR_INVALID' };
      if (broadcasts.has(payload.id)) return { stored: false, reason: 'DUPLICATE' };
      if (broadcasts.size >= 200) return { stored: false, reason: 'QUOTA' };
      broadcasts.set(payload.id, { payload, expiresAt: payload.expiresAt }); return { stored: true };
    },
    listBroadcasts: () => [...broadcasts.values()].map((b) => b.payload),

    /** Registra un recibo si es auténtico (hash coincide) y borra la copia. */
    async acceptReceipt({ id, ackSecret }) {
      if (receipts.has(id)) return false;
      const it = items.get(id);
      if (it && (await ackHashOf(unb64(ackSecret))) !== it.env.header.ackHash) return false; // falso: se ignora
      receipts.set(id, ackSecret);
      if (it) { items.delete(id); used -= it.size; }
      return true;
    },

    summary() { return { owner, ids: [...items.keys()], receipts: [...receipts.keys()], broadcasts: [...broadcasts.keys()] }; },

    /** Lista de lo que transporta este teléfono (solo cabeceras: nunca contenido). */
    list() { return [...items.values()].map((i) => ({ id: i.env.header.id, to: i.env.header.to, priority: i.env.header.priority, kind: i.env.header.kind, expiresAt: i.env.header.expiresAt, copies: i.copies, hops: i.hops })); },

    /** Instantánea serializable para persistir en el dispositivo (IndexedDB / disco). */
    snapshot() { return { owner, items: [...items.values()].map(({ env, copies, hops, storedAt }) => ({ env, copies, hops, storedAt })), receipts: [...receipts], broadcasts: [...broadcasts.values()].map((b) => b.payload) }; },
    restore(snap, { now }) {
      for (const [id, s] of snap.receipts ?? []) receipts.set(id, s);
      for (const it of snap.items ?? []) this.put(it.env, { copies: it.copies, hops: it.hops, now });
      for (const b of snap.broadcasts ?? []) this.putBroadcast(b, { now });
      return this;
    },

    /**
     * Qué enviar a un par a partir de su resumen. Respeta spray-and-wait y presupuesto.
     * @returns {{envelopes:Array<{env,copies,hops}>, receipts:Array<{id,ackSecret}>}}
     */
    prepareFor(peerSummary, { maxBytes = 512 * 1024, now }) {
      const peerHas = new Set(peerSummary.ids), peerReceipts = new Set(peerSummary.receipts);
      const outReceipts = [...receipts].filter(([id]) => !peerReceipts.has(id)).map(([id, ackSecret]) => ({ id, ackSecret }));
      const cands = [...items.values()].filter((i) => !peerHas.has(i.env.header.id) && !peerReceipts.has(i.env.header.id) && now <= i.env.header.expiresAt)
        .filter((i) => i.env.header.to === peerSummary.owner || i.copies > 1)
        .sort((a, b) => (b.env.header.to === peerSummary.owner) - (a.env.header.to === peerSummary.owner)
          || a.env.header.priority - b.env.header.priority || a.env.header.expiresAt - b.env.header.expiresAt);
      const out = []; let bytes = 0;
      for (const i of cands) {
        if (bytes + i.size > maxBytes) continue;
        const direct = i.env.header.to === peerSummary.owner;
        const give = direct ? 1 : Math.floor(i.copies / 2);
        out.push({ env: i.env, copies: give, hops: i.hops + 1 });
        if (!direct) i.copies -= give;
        bytes += i.size;
      }
      const peerB = new Set(peerSummary.broadcasts ?? []);
      const outB = [...broadcasts.values()].filter((b) => !peerB.has(b.payload.id) && now <= b.expiresAt).map((b) => b.payload);
      return { envelopes: out, receipts: outReceipts, broadcasts: outB };
    },

    /** Ingiere lo recibido de un par. Devuelve los sobres dirigidos a mí. */
    async ingest({ envelopes = [], receipts: rs = [], broadcasts: bs = [] }, { now }) {
      for (const r of rs) await this.acceptReceipt(r);
      const newBroadcasts = bs.filter((b) => this.putBroadcast(b, { now }).stored);
      const forMe = [], stored = [];
      for (const { env, copies, hops } of envelopes) {
        if (env.header.to === owner) { if (!receipts.has(env.header.id) && !forMe.some((e) => e.header.id === env.header.id)) forMe.push(env); continue; }
        if (this.put(env, { copies, hops, now }).stored) stored.push(env.header.id);
      }
      return { forMe, stored, newBroadcasts };
    },
  };
}

/** Sesión completa entre dos teléfonos (simétrica). Sirve para cualquier transporte. */
export async function syncPair(a, b, { now, maxBytes } = {}) {
  const sa = a.summary(), sb = b.summary();
  const toB = a.prepareFor(sb, { now, maxBytes }), toA = b.prepareFor(sa, { now, maxBytes });
  const rb = await b.ingest(toB, { now }), ra = await a.ingest(toA, { now });
  return { aReceived: ra.forMe, bReceived: rb.forMe, transferred: toB.envelopes.length + toA.envelopes.length };
}

/** Archivo portátil `.senda` (para Quick Share / AirDrop / Bluetooth / USB / correo). */
export function exportBundleFile(store, { now, peerSummary = { owner: null, ids: [], receipts: [] }, maxBytes = 4 * 1024 * 1024 }) {
  const p = store.prepareFor(peerSummary, { now, maxBytes });
  return JSON.stringify({ format: BUNDLE_FORMAT, createdAt: now, from: store.owner, ...p });
}

export async function importBundleFile(store, text, { now }) {
  const data = JSON.parse(text);
  if (data.format !== BUNDLE_FORMAT) throw new Error('Formato de paquete desconocido');
  return store.ingest(data, { now });
}
