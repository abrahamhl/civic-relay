/**
 * SENDA · Cliente de relé por Internet (teléfono → relé y relé → relé).
 *
 * Es la pieza que convierte «hay Internet en algún punto del camino» en entrega real entre países:
 *  - Un teléfono que gana Internet (datos propios, itinerancia, Wi-Fi de una gasolinera, de un bar, de una
 *    biblioteca o de un Punto SENDA) sube TODO lo cifrado que transporta, propio y ajeno, y baja lo suyo.
 *  - Los relés se sincronizan entre sí (federación): un sobre que entra por el relé de Suecia aparece en el de
 *    España sin que nadie haga nada.
 *
 * Sincronización en 2 rondas (anti-entropía, igual que entre teléfonos):
 *   1. Envío mi RESUMEN (ids + recibos) y pido el del relé (`wantSummary`). El relé me devuelve lo que me falta.
 *   2. Con el resumen del relé, le envío solo lo que a él le falta (`reserveFor` → commit al confirmar).
 * Si el relé es antiguo y no devuelve resumen, la ronda 2 envía todo lo pendiente (comportamiento anterior).
 *
 * El relé es ciego: solo ve cabeceras de enrutamiento (huella de destino, caducidad, prioridad).
 * La telemetría que devuelve este módulo es MEDIDA en el propio dispositivo (reloj local).
 */

const enc = new TextEncoder();
const bytesOf = (o) => enc.encode(JSON.stringify(o)).length;
const EMPTY = { owner: 'senda-relay', ids: [], receipts: [], pendingReceipts: [], broadcasts: [] };

/** Normaliza una lista de relés: «https://a, https://b/» → ['https://a','https://b']. Solo https (o http a localhost). */
export function parseRelayList(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/[\s,;]+/)) {
    const u = raw.trim().replace(/\/+$/, '');
    if (!u) continue;
    let url; try { url = new URL(u); } catch { continue; }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) continue;
    if (url.username || url.password) continue;
    if (!out.includes(url.origin + url.pathname.replace(/\/+$/, ''))) out.push(url.origin + url.pathname.replace(/\/+$/, ''));
  }
  return out.slice(0, 8);
}

async function postJson(fetchImpl, url, body, timeoutMs) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const r = await fetchImpl(url + '/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl?.signal });
    if (!r.ok) throw new Error(`relé respondió ${r.status}`);
    return await r.json();
  } finally { if (timer) clearTimeout(timer); }
}

/**
 * Sincroniza un almacén (createBundleStore) con UN relé.
 * @param {object} p
 * @param {ReturnType<import('./bundle.mjs').createBundleStore>} p.store
 * @param {string} p.url  base del relé (sin /sync)
 * @param {'phone'|'relay'} [p.role] quién llama; un relé que federa usa 'relay'
 * @returns {Promise<{url:string, ok:boolean, error?:string, forMe:object[], newBroadcasts:object[], uploaded:number, downloaded:number, bytesUp:number, bytesDown:number, rttMs:number, rounds:number}>}
 */
export async function syncWithRelay({ store, url, fetchImpl = globalThis.fetch, now = () => Date.now(), clock = () => Date.now(), timeoutMs = 20_000, maxBytes = 1024 * 1024, role = 'phone' }) {
  const t0 = clock();
  const out = { url, ok: false, forMe: [], newBroadcasts: [], uploaded: 0, downloaded: 0, bytesUp: 0, bytesDown: 0, rttMs: 0, rounds: 0 };
  try {
    // Ronda 1: resumen → lo que me falta + resumen del relé.
    const b1 = { summary: store.summary(), wantSummary: true, role, envelopes: [], receipts: [], broadcasts: [] };
    out.bytesUp += bytesOf(b1);
    const r1 = await postJson(fetchImpl, url, b1, timeoutMs); out.rounds = 1;
    out.bytesDown += bytesOf(r1);
    const g1 = await store.ingest(r1, { now: now() });
    out.forMe.push(...g1.forMe); out.newBroadcasts.push(...g1.newBroadcasts);
    out.downloaded += (r1.envelopes?.length ?? 0);
    // Ronda 2: lo que al relé le falta (se cede como a infraestructura: también con 1 copia).
    const relaySummary = r1.summary && Array.isArray(r1.summary.ids) ? r1.summary : EMPTY;
    const res = store.reserveFor(relaySummary, { now: now(), maxBytes, infrastructure: true });
    if (res.envelopes.length || res.receipts.length || res.broadcasts.length) {
      const b2 = { summary: store.summary(), role, envelopes: res.envelopes, receipts: res.receipts, broadcasts: res.broadcasts };
      out.bytesUp += bytesOf(b2);
      let r2;
      try { r2 = await postJson(fetchImpl, url, b2, timeoutMs); } catch (e) { res.rollback(); throw e; }
      res.commit(); out.rounds = 2;
      out.uploaded = res.envelopes.length;
      out.bytesDown += bytesOf(r2);
      const g2 = await store.ingest(r2, { now: now() });
      for (const e of g2.forMe) if (!out.forMe.some((x) => x.header.id === e.header.id)) out.forMe.push(e);
      out.newBroadcasts.push(...g2.newBroadcasts);
      out.downloaded += (r2.envelopes?.length ?? 0);
    } else res.rollback();
    out.ok = true;
  } catch (e) {
    out.error = e?.name === 'AbortError' ? 'tiempo agotado' : String(e?.message ?? e);
  }
  out.rttMs = clock() - t0;
  return out;
}

/** Sincroniza con todos los relés de la lista; un relé caído no impide los demás (basta con que funcione uno). */
export async function syncAllRelays({ store, urls, ...rest }) {
  const results = [];
  for (const url of urls) results.push(await syncWithRelay({ store, url, ...rest }));
  const forMe = [];
  for (const r of results) for (const e of r.forMe) if (!forMe.some((x) => x.header.id === e.header.id)) forMe.push(e);
  return { results, forMe, okCount: results.filter((r) => r.ok).length };
}

/**
 * Programador de sincronización automática: corre al ganar red, al pedirlo y cada `intervalMs` mientras haya red.
 * Si falla, espera con retroceso exponencial (hasta `maxBackoffMs`). No hace nada sin red.
 * Inyectable (setTimeout, isOnline) para poder probarlo sin navegador.
 */
export function createAutoSync({ run, isOnline = () => true, intervalMs = 60_000, maxBackoffMs = 15 * 60_000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null, failures = 0, running = false, stopped = false, last = null;
  const schedule = (ms) => { if (stopped) return; if (timer) clearTimer(timer); timer = setTimer(tick, ms); };
  async function tick() {
    timer = null;
    if (stopped || running) return;
    if (!isOnline()) { schedule(intervalMs); return; }
    running = true;
    try {
      last = await run();
      failures = last && last.okCount === 0 && last.results?.length ? failures + 1 : 0;
    } catch { failures++; }
    running = false;
    schedule(failures ? Math.min(maxBackoffMs, intervalMs * 2 ** failures) : intervalMs);
  }
  return {
    now: () => { schedule(0); },
    start: () => { stopped = false; schedule(0); },
    stop: () => { stopped = true; if (timer) clearTimer(timer); timer = null; },
    state: () => ({ failures, running, last, scheduled: !!timer }),
  };
}
