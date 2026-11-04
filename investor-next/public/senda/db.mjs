/** Almacén clave-valor en IndexedDB: todo lo de SENDA vive SOLO en este teléfono. */
const DB = 'senda-campo', VERSION = 1;
let dbp = null;
function db() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction('kv', mode), s = t.objectStore('kv'), req = fn(s);
    t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error);
  }));
}
export const get = (k) => tx('readonly', (s) => s.get(k));
export const set = (k, v) => tx('readwrite', (s) => s.put(v, k));
export const del = (k) => tx('readwrite', (s) => s.delete(k));
