/**
 * Almacenamiento local IndexedDB para SENDA LIVE.
 * Permite leer feed en caché, redactar reportes offline y sincronizarlos al recuperar red.
 */

const DB_NAME = 'senda_live_offline_db';
const DB_VERSION = 2;

export interface QueuedItem {
  id: string;
  type: 'POST' | 'OBSERVATION' | 'MESSAGE';
  payload: any;
  createdAt: number;
  status: 'QUEUED_OFFLINE' | 'SYNCED' | 'FAILED';
  error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_feed')) {
        db.createObjectStore('cached_feed', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_events')) {
        db.createObjectStore('cached_events', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_sources')) {
        db.createObjectStore('cached_sources', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineItem(type: 'POST' | 'OBSERVATION' | 'MESSAGE', payload: any): Promise<QueuedItem> {
  const db = await openDb();
  const id = 'offline_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const item: QueuedItem = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    status: 'QUEUED_OFFLINE'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite');
    tx.objectStore('offline_queue').put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineQueue(): Promise<QueuedItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readonly');
    const req = tx.objectStore('offline_queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite');
    tx.objectStore('offline_queue').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheFeedPosts(posts: any[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_feed', 'readwrite');
    const store = tx.objectStore('cached_feed');
    posts.forEach((p) => store.put(p));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedFeed(): Promise<any[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_feed', 'readonly');
    const req = tx.objectStore('cached_feed').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSourceData(key: string, data: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_sources', 'readwrite');
    tx.objectStore('cached_sources').put({ key, data, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedSourceData(key: string): Promise<any | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_sources', 'readonly');
    const req = tx.objectStore('cached_sources').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = () => reject(req.error);
  });
}
