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
 * pasarlo se reparte la mitad; con 1 copia solo se entrega al destinatario). Las copias
 * solo se descuentan cuando el transporte confirma la entrega (reserve/commit), no al
 * preparar el paquete.
 * Recibos: el destinatario publica el secreto de acuse; cualquiera verifica su hash
 * contra la cabecera y BORRA sus copias. Un recibo sin sobre se guarda en CUARENTENA:
 * no se considera verificado ni suprime la entrega hasta que llegue el sobre.
 */
import { ackHashOf, validateEnvelopeShape, MAX_ENVELOPE_BYTES, MAX_TTL_S } from './envelope.mjs';
import { unb64 } from './b64.mjs';

export const BUNDLE_FORMAT = 'senda-bundle/1';
export const MAX_PENDING_RECEIPTS = 1024;
export const MAX_VERIFIED_RECEIPTS = 8192;
const MAX_PENDING_SECRETS_PER_ID = 2;
const MAX_BROADCAST_BYTES = 16 * 1024;
const MAX_BROADCASTS = 200;
const MAX_COPIES = 4096;

export function createBundleStore({
  owner,
  quotaBytes = 8 * 1024 * 1024,
  initialCopies = 8,
  maxHops = 24,
  maxEnvelopeBytes = MAX_ENVELOPE_BYTES,
  maxTtlS = MAX_TTL_S,
  maxVerifiedReceipts = MAX_VERIFIED_RECEIPTS,
  maxPendingReceipts = MAX_PENDING_RECEIPTS,
  pendingReceiptTtlS = 7 * 86400,
  maxIngestEnvelopes = 1000,
  maxIngestReceipts = 5000,
} = {}) {
  const items = new Map();      // id → {env, copies, hops, size, storedAt}
  const receipts = new Map();   // id → ackSecret (verificado con el sobre)
  const pending = new Map();    // id → Map<ackSecret, expiresAt> (recibido sin sobre: cuarentena)
  const broadcasts = new Map(); // id → {payload, expiresAt}: alertas/órdenes FIRMADAS (públicas) para toda una zona
  const encoder = new TextEncoder();
  let used = 0;

  const size = (env) => encoder.encode(JSON.stringify(env)).length;
  const isId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(id) && unb64(id).length === 16;
  const isSecret = (s) => typeof s === 'string' && s.length === 22 && /^[A-Za-z0-9_-]+$/.test(s) && unb64(s).length === 16;

  function rememberVerified(id, secret) {
    if (receipts.has(id)) return false;
    if (receipts.size >= maxVerifiedReceipts) receipts.delete(receipts.keys().next().value);
    receipts.set(id, secret);
    pending.delete(id);
    return true;
  }

  function addPending(id, secret, now) {
    if (!isId(id) || !isSecret(secret)) return false;
    let group = pending.get(id);
    if (!group) {
      if (pending.size >= maxPendingReceipts) return false;
      group = new Map();
      pending.set(id, group);
    }
    if (group.has(secret)) return false;
    if (group.size >= MAX_PENDING_SECRETS_PER_ID) return false;
    group.set(secret, now + pendingReceiptTtlS * 1000);
    return true;
  }

  async function matchingPending(id, env, now) {
    const group = pending.get(id);
    if (!group) return null;
    for (const [secret, expiresAt] of group) {
      if (now > expiresAt) { group.delete(secret); continue; }
      if ((await ackHashOf(unb64(secret))) === env.header.ackHash) return secret;
    }
    if (group.size === 0) pending.delete(id);
    return null;
  }

  function evictFor(bytes) {
    if (bytes > quotaBytes) return false;
    const victims = [...items.values()].filter((i) => i.env.header.to !== owner)
      .sort((a, b) => b.env.header.priority - a.env.header.priority || a.env.header.expiresAt - b.env.header.expiresAt);
    while (used + bytes > quotaBytes && victims.length) { const v = victims.shift(); items.delete(v.env.header.id); used -= v.size; }
    return used + bytes <= quotaBytes;
  }

  function planTransfers(peerSummary = {}, { maxBytes = 512 * 1024, now = Date.now() } = {}) {
    const peerHas = new Set(Array.isArray(peerSummary.ids) ? peerSummary.ids : []);
    const peerReceipts = new Set(Array.isArray(peerSummary.receipts) ? peerSummary.receipts : []);
    const peerPending = new Set(Array.isArray(peerSummary.pendingReceipts) ? peerSummary.pendingReceipts : []);

    const outReceipts = [...receipts].filter(([id]) => !peerReceipts.has(id)).map(([id, ackSecret]) => ({ id, ackSecret }));
    for (const [id, group] of pending) {
      if (peerReceipts.has(id) || peerPending.has(id)) continue;
      for (const [ackSecret, expiresAt] of group) {
        if (now <= expiresAt) outReceipts.push({ id, ackSecret });
      }
    }
    outReceipts.length = Math.min(outReceipts.length, maxIngestReceipts);

    const cands = [...items.values()].filter((i) => !peerHas.has(i.env.header.id) && !peerReceipts.has(i.env.header.id) && now <= i.env.header.expiresAt)
      .filter((i) => i.env.header.to === peerSummary.owner || i.copies > 1)
      .sort((a, b) => (b.env.header.to === peerSummary.owner) - (a.env.header.to === peerSummary.owner)
        || a.env.header.priority - b.env.header.priority || a.env.header.expiresAt - b.env.header.expiresAt);
    const envelopes = []; const commits = []; let bytes = 0;
    for (const i of cands) {
      if (bytes + i.size > maxBytes) continue;
      const direct = i.env.header.to === peerSummary.owner;
      const give = direct ? 1 : Math.floor(i.copies / 2);
      if (!direct && give < 1) continue;
      envelopes.push({ env: i.env, copies: give, hops: i.hops + 1 });
      if (!direct) commits.push({ id: i.env.header.id, give });
      bytes += i.size;
    }

    const peerB = new Set(Array.isArray(peerSummary.broadcasts) ? peerSummary.broadcasts : []);
    const outB = [...broadcasts.values()].filter((b) => !peerB.has(b.payload.id) && now <= b.expiresAt).map((b) => b.payload);
    return { envelopes, receipts: outReceipts, broadcasts: outB, commits };
  }

  function applyCommits(commits) {
    for (const { id, give } of commits) {
      const it = items.get(id);
      if (it) it.copies = Math.max(0, it.copies - give);
    }
  }

  return {
    owner,
    has: (id) => items.has(id),
    get: (id) => items.get(id)?.env,
    count: () => items.size,
    bytesUsed: () => used,
    copiesOf: (id) => items.get(id)?.copies,

    /** Añade un sobre propio o recibido. Valida forma, caducidad, saltos y cuota. */
    put(env, { copies = initialCopies, hops = 0, now = Date.now() } = {}) {
      if (!env || typeof env !== 'object' || !env.header) return { stored: false, reason: 'MALFORMED_ENVELOPE' };
      const shape = validateEnvelopeShape(env, { now, maxBytes: maxEnvelopeBytes, maxTtlS });
      if (!shape.ok) return { stored: false, reason: shape.reason };
      const id = env.header.id;
      if (receipts.has(id)) return { stored: false, reason: 'ALREADY_DELIVERED' };
      // La cuarentena de recibos se verifica en ingest() (necesita hash as��ncrono).
      // put() directo nunca deja que un recibo pendiente suprima el sobre.
      if (now > env.header.expiresAt) return { stored: false, reason: 'EXPIRED' };
      if (!Number.isSafeInteger(hops) || hops < 0 || hops > maxHops) return { stored: false, reason: 'HOP_LIMIT' };
      if (!Number.isSafeInteger(copies) || copies < 0 || copies > MAX_COPIES) return { stored: false, reason: 'BAD_COPIES' };
      if (items.has(id)) { items.get(id).copies = Math.max(items.get(id).copies, copies); return { stored: false, reason: 'DUPLICATE' }; }
      const s = size(env);
      if (s > maxEnvelopeBytes + 64 * 1024) return { stored: false, reason: 'ENVELOPE_TOO_LARGE' };
      if (!evictFor(s)) return { stored: false, reason: 'QUOTA' };
      items.set(id, { env, copies, hops, size: s, storedAt: now }); used += s;
      return { stored: true };
    },

    /** Elimina caducados (sobres, difusiones y recibos en cuarentena). */
    purgeExpired(now) {
      let n = 0;
      for (const [id, i] of items) if (now > i.env.header.expiresAt) { items.delete(id); used -= i.size; n++; }
      for (const [id, b] of broadcasts) if (now > b.expiresAt) { broadcasts.delete(id); n++; }
      for (const [id, group] of pending) {
        for (const [secret, expiresAt] of group) if (now > expiresAt) group.delete(secret);
        if (group.size === 0) pending.delete(id);
      }
      return n;
    },

    /** Difusión firmada (alerta u orden de coordinador). Se transporta a todos; cada teléfono verifica la firma. */
    putBroadcast(payload, { now = Date.now() } = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { stored: false, reason: 'EXPIRED_OR_INVALID' };
      if (typeof payload.id !== 'string' || payload.id.length === 0 || payload.id.length > 128) return { stored: false, reason: 'EXPIRED_OR_INVALID' };
      if (!Number.isSafeInteger(payload.expiresAt) || !(payload.expiresAt > now)) return { stored: false, reason: 'EXPIRED_OR_INVALID' };
      if (payload.expiresAt - now > maxTtlS * 1000 + 300_000) return { stored: false, reason: 'TTL_TOO_LONG' };
      if (broadcasts.has(payload.id)) return { stored: false, reason: 'DUPLICATE' };
      if (broadcasts.size >= MAX_BROADCASTS) return { stored: false, reason: 'QUOTA' };
      if (encoder.encode(JSON.stringify(payload)).length > MAX_BROADCAST_BYTES) return { stored: false, reason: 'BROADCAST_TOO_LARGE' };
      broadcasts.set(payload.id, { payload, expiresAt: payload.expiresAt }); return { stored: true };
    },
    listBroadcasts: () => [...broadcasts.values()].map((b) => b.payload),

    /** Registra un recibo. Solo devuelve true si se verificó contra un sobre local. */
    async acceptReceipt({ id, ackSecret } = {}, { now = Date.now() } = {}) {
      const res = await this.acceptReceiptDetailed({ id, ackSecret }, { now });
      return res.ok && res.state === 'VERIFIED_NOW';
    },

    /** Variante observable: VERIFIED_NOW | ALREADY_VERIFIED | PENDING | ALREADY_PENDING | MALFORMED | HASH_MISMATCH | QUOTA. */
    async acceptReceiptDetailed({ id, ackSecret } = {}, { now = Date.now() } = {}) {
      if (!isId(id) || !isSecret(ackSecret)) return { ok: false, state: 'MALFORMED' };
      if (receipts.has(id)) return { ok: true, state: 'ALREADY_VERIFIED' };
      const it = items.get(id);
      if (it) {
        if ((await ackHashOf(unb64(ackSecret))) !== it.env.header.ackHash) return { ok: false, state: 'HASH_MISMATCH' };
        rememberVerified(id, ackSecret);
        items.delete(id); used -= it.size;
        return { ok: true, state: 'VERIFIED_NOW' };
      }
      if (!addPending(id, ackSecret, now)) return { ok: false, state: pending.has(id) ? 'ALREADY_PENDING' : 'QUOTA' };
      return { ok: true, state: 'PENDING' };
    },

    summary() {
      return {
        owner,
        ids: [...items.keys()],
        receipts: [...receipts.keys()],
        pendingReceipts: [...pending.keys()],
        broadcasts: [...broadcasts.keys()],
      };
    },

    /** Lista de lo que transporta este teléfono (solo cabeceras: nunca contenido). */
    list() { return [...items.values()].map((i) => ({ id: i.env.header.id, to: i.env.header.to, priority: i.env.header.priority, kind: i.env.header.kind, expiresAt: i.env.header.expiresAt, copies: i.copies, hops: i.hops })); },

    /** Instantánea serializable para persistir en el dispositivo (IndexedDB / disco). */
    snapshot() {
      return {
        owner,
        items: [...items.values()].map(({ env, copies, hops, storedAt }) => ({ env, copies, hops, storedAt })),
        receipts: [...receipts],
        pendingReceipts: [...pending].map(([id, group]) => [id, [...group.keys()]]),
        broadcasts: [...broadcasts.values()].map((b) => b.payload),
      };
    },
    restore(snap, { now = Date.now() } = {}) {
      if (!snap || typeof snap !== 'object') return this;
      const snapItems = new Map();
      for (const it of Array.isArray(snap.items) ? snap.items : []) {
        if (it?.env?.header?.id) snapItems.set(it.env.header.id, it);
      }
      // La instantánea es estado local de confianza: conserva los recibos ya verificados
      // y evita resucitar los sobres que purgaron. Los recibos nunca verificados viven
      // en cuarentena y no suprimen nada.
      for (const [id, secret] of Array.isArray(snap.receipts) ? snap.receipts : []) {
        if (!isId(id) || !isSecret(secret)) continue;
        rememberVerified(id, secret);
        snapItems.delete(id);
      }
      for (const [id, secrets] of Array.isArray(snap.pendingReceipts) ? snap.pendingReceipts : []) {
        for (const secret of Array.isArray(secrets) ? secrets : []) addPending(id, secret, now);
      }
      for (const it of snapItems.values()) this.put(it.env, { copies: it.copies, hops: it.hops, now });
      for (const b of Array.isArray(snap.broadcasts) ? snap.broadcasts : []) this.putBroadcast(b, { now });
      return this;
    },

    /**
     * Qué enviar a un par a partir de su resumen. Respeta spray-and-wait y presupuesto.
     * `reserveFor` NO descuenta copias hasta que el transporte confirma (commit).
     * @returns {{envelopes:Array<{env,copies,hops}>, receipts:Array<{id,ackSecret}>}}
     */
    prepareFor(peerSummary, options = {}) {
      const plan = planTransfers(peerSummary, options);
      applyCommits(plan.commits);
      return { envelopes: plan.envelopes, receipts: plan.receipts, broadcasts: plan.broadcasts };
    },

    /** Reserva un envío; el descuento de copias ocurre en commit() (ACK del transporte). */
    reserveFor(peerSummary, options = {}) {
      const plan = planTransfers(peerSummary, options);
      let open = true;
      return {
        envelopes: plan.envelopes,
        receipts: plan.receipts,
        broadcasts: plan.broadcasts,
        commit() { if (!open) return false; open = false; applyCommits(plan.commits); return true; },
        rollback() { open = false; },
        committed: () => !open,
      };
    },

    /** Ingiere lo recibido de un par. Devuelve los sobres dirigidos a mí. */
    async ingest({ envelopes = [], receipts: rs = [], broadcasts: bs = [] } = {}, { now = Date.now() } = {}) {
      const inEnvelopes = Array.isArray(envelopes) ? envelopes.slice(0, maxIngestEnvelopes) : [];
      const inReceipts = Array.isArray(rs) ? rs.slice(0, maxIngestReceipts) : [];
      const inBroadcasts = Array.isArray(bs) ? bs.slice(0, MAX_BROADCASTS) : [];
      let acceptedReceipts = 0;
      for (const r of inReceipts) {
        const res = await this.acceptReceiptDetailed(r, { now });
        if (res.ok) acceptedReceipts++;
      }
      const newBroadcasts = inBroadcasts.filter((b) => this.putBroadcast(b, { now }).stored);
      const forMe = [], stored = []; let rejected = 0;
      for (const entry of inEnvelopes) {
        const env = entry?.env;
        const shape = validateEnvelopeShape(env, { now, maxBytes: maxEnvelopeBytes, maxTtlS });
        if (!shape.ok) { rejected++; continue; }
        const id = env.header.id;
        if (env.header.to === owner) {
          if (receipts.has(id)) continue;
          if (pending.has(id)) {
            const secret = await matchingPending(id, env, now);
            if (secret) { rememberVerified(id, secret); continue; }
            pending.delete(id); // el sobre demuestra que el recibo pendiente era falso
          }
          if (!forMe.some((e) => e.header.id === id)) forMe.push(env);
          continue;
        }
        if (pending.has(id)) {
          const secret = await matchingPending(id, env, now);
          if (secret) { rememberVerified(id, secret); continue; }
          pending.delete(id);
        }
        const res = this.put(env, { copies: entry.copies, hops: entry.hops, now });
        if (res.stored) stored.push(id);
      }
      return { forMe, stored, newBroadcasts, rejected, receipts: acceptedReceipts };
    },
  };
}

/** Sesión completa entre dos teléfonos (simétrica). Sirve para cualquier transporte. */
export async function syncPair(a, b, { now = Date.now(), maxBytes } = {}) {
  const sa = a.summary(), sb = b.summary();
  const toB = a.reserveFor(sb, { now, maxBytes }), toA = b.reserveFor(sa, { now, maxBytes });
  try {
    const rb = await b.ingest(toB, { now }), ra = await a.ingest(toA, { now });
    // El transporte solo confirma aquí; si ingest lanza, las copias no se consumen.
    toB.commit(); toA.commit();
    return { aReceived: ra.forMe, bReceived: rb.forMe, transferred: toB.envelopes.length + toA.envelopes.length };
  } catch (err) {
    toB.rollback(); toA.rollback();
    throw err;
  }
}

/** Archivo portátil `.senda` (para Quick Share / AirDrop / Bluetooth / USB / correo). */
export function exportBundleFile(store, { now = Date.now(), peerSummary = { owner: null, ids: [], receipts: [] }, maxBytes = 4 * 1024 * 1024 } = {}) {
  const p = store.prepareFor(peerSummary, { now, maxBytes });
  return JSON.stringify({ format: BUNDLE_FORMAT, createdAt: now, from: store.owner, ...p });
}

export async function importBundleFile(store, text, { now = Date.now() } = {}) {
  const data = JSON.parse(text);
  if (data.format !== BUNDLE_FORMAT) throw new Error('Formato de paquete desconocido');
  return store.ingest(data, { now });
}
