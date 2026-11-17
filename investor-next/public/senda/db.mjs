/** Almacén clave-valor y cola offline durable en IndexedDB: todo lo de SENDA vive SOLO en este dispositivo. */
const DB = 'senda-campo', VERSION = 1, QUEUE_KEY = 'offline-queue-v1';
let dbp = null;
const memFallback = new Map();

function hasIdb() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function db() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function tx(mode, fn) {
  if (!hasIdb()) {
    const store = {
      get: (k) => memFallback.get(k),
      put: (v, k) => memFallback.set(k, structuredClone(v)),
      delete: (k) => memFallback.delete(k),
    };
    return Promise.resolve(fn(store));
  }
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction('kv', mode), s = t.objectStore('kv'), req = fn(s);
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  }));
}

export const get = (k) => tx('readonly', (s) => s.get(k));
export const set = (k, v) => tx('readwrite', (s) => s.put(v, k));
export const del = (k) => tx('readwrite', (s) => s.delete(k));

async function readQueue() {
  const cur = await get(QUEUE_KEY);
  return Array.isArray(cur) ? cur : [];
}

async function writeQueue(items) {
  await set(QUEUE_KEY, items);
  return items;
}

/** Encola un elemento sintético/offline con deduplicación, TTL y consentimiento explícito. */
export async function enqueueOfflineItem({
  id,
  kind = 'MESSAGE',
  payload = '',
  ttlMs = 3600_000,
  consented = true,
  now = Date.now(),
  basis = 'SIMULADO',
} = {}) {
  if (!id || typeof id !== 'string') throw new TypeError('id obligatorio');
  if (consented !== true) throw new Error('CONSENT_REQUIRED');
  const q = await readQueue();
  const existing = q.find((x) => x.id === id);
  if (existing) {
    return { status: 'DUPLICATE_IGNORED', item: existing, queue: q };
  }
  const item = {
    id,
    kind,
    basis,
    status: 'PENDING',
    consented: true,
    createdAt: now,
    expiresAt: now + Math.max(1000, Number(ttlMs) || 3600_000),
    attempts: 0,
    payload,
    updatedAt: now,
  };
  q.push(item);
  await writeQueue(q);
  return { status: 'QUEUED', item, queue: q };
}

/** Purga elementos caducados conservando tumba EXPIRED sin payload. */
export async function sweepExpiredQueue(now = Date.now()) {
  const q = await readQueue();
  let expiredCount = 0;
  const next = q.map((item) => {
    if (item.status === 'PENDING' && item.expiresAt <= now) {
      expiredCount++;
      return { ...item, status: 'EXPIRED', payload: null, updatedAt: now };
    }
    return item;
  });
  if (expiredCount > 0) await writeQueue(next);
  return { expiredCount, queue: next };
}

/** Revoca consentimiento: borra el payload inmediatamente y deja tumba REVOKED no resucitable. */
export async function revokeConsentTombstone(id, now = Date.now()) {
  const q = await readQueue();
  let changed = false;
  const next = q.map((item) => {
    if (item.id === id) {
      changed = true;
      return { ...item, status: 'REVOKED', consented: false, payload: null, updatedAt: now };
    }
    return item;
  });
  if (changed) await writeQueue(next);
  return { changed, queue: next };
}

/** Marca un elemento como reconocido (ACK) eliminando el payload pendiente. */
export async function ackOfflineItem(id, ackKind = 'ACK_SYNTHETIC', now = Date.now()) {
  const q = await readQueue();
  let changed = false;
  const next = q.map((item) => {
    if (item.id === id && item.status === 'PENDING') {
      changed = true;
      return { ...item, status: ackKind, payload: null, updatedAt: now };
    }
    return item;
  });
  if (changed) await writeQueue(next);
  return { changed, queue: next };
}

export async function listOfflineQueue(now = Date.now()) {
  const { queue } = await sweepExpiredQueue(now);
  return queue;
}

export async function clearOfflineQueue() {
  await del(QUEUE_KEY);
  return [];
}
