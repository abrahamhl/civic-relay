#!/usr/bin/env node
/**
 * Relé SENDA. Un nodo más de la red de almacenar-transportar-reenviar, con Internet.
 *  - POST /sync  {summary, envelopes, receipts, broadcasts} → ingiere y devuelve lo que al cliente le falta.
 *  - GET  /health
 * No puede leer mensajes (cifrado extremo a extremo); valida forma, tamaño y caducidad,
 * limita peticiones por IP y persiste en disco para sobrevivir a reinicios.
 * Variables: PORT (8787), DATA_DIR (./data), ALLOWED_ORIGINS (coma; por defecto *), MAX_BODY (2 MB).
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBundleStore } from '../senda/src/bundle.mjs';
import { validateEnvelopeShape } from '../senda/src/envelope.mjs';

export function createRelay({ dataDir = process.env.DATA_DIR ?? './data', maxBody = +(process.env.MAX_BODY ?? 2 * 1024 * 1024), allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*').split(','), ratePerMin = 120, now = () => Date.now() } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const file = resolve(dataDir, 'store.json');
  const store = createBundleStore({ owner: 'senda-relay', quotaBytes: 256 * 1024 * 1024, initialCopies: 64 });
  if (existsSync(file)) store.restore(JSON.parse(readFileSync(file, 'utf8')), { now: now() });
  let dirty = false;
  const flush = () => { if (!dirty) return; const tmp = file + '.tmp'; writeFileSync(tmp, JSON.stringify(store.snapshot())); renameSync(tmp, file); dirty = false; };
  const timer = setInterval(() => { store.purgeExpired(now()); flush(); }, 5000); timer.unref();
  const buckets = new Map();
  const allow = (ip) => { const t = now(), b = buckets.get(ip) ?? { n: 0, t }; if (t - b.t > 60_000) { b.n = 0; b.t = t; } b.n++; buckets.set(ip, b); return b.n <= ratePerMin; };
  const validEnv = (e, t) => validateEnvelopeShape(e, { now: t }).ok;
  const validB = (b) => b && typeof b.id === 'string' && Number.isFinite(b.expiresAt) && b.type === 'SENDA_SIGNED_COMMAND' && typeof b.sig === 'string';

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = allowedOrigins.includes('*') ? '*' : allowedOrigins.includes(origin) ? origin : null;
    if (cors) { res.setHeader('access-control-allow-origin', cors); res.setHeader('access-control-allow-headers', 'content-type'); res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS'); }
    res.setHeader('cache-control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, items: store.count(), broadcasts: store.listBroadcasts().length, bytes: store.bytesUsed() })); }
    if (req.method !== 'POST' || req.url !== '/sync') { res.writeHead(404); return res.end(); }
    if (!allow(req.socket.remoteAddress)) { res.writeHead(429); return res.end(); }
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > maxBody) { res.writeHead(413); return res.end(); } chunks.push(c); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400); return res.end(); }
    const t = now();
    const envelopes = (Array.isArray(body.envelopes) ? body.envelopes : []).filter((x) => validEnv(x?.env, t)).slice(0, 500);
    const broadcasts = (Array.isArray(body.broadcasts) ? body.broadcasts : []).filter(validB).slice(0, 50);
    const receipts = (Array.isArray(body.receipts) ? body.receipts : []).filter((r) => typeof r?.id === 'string' && typeof r?.ackSecret === 'string').slice(0, 1000);
    const summary = {
      owner: String(body.summary?.owner ?? ''),
      ids: (Array.isArray(body.summary?.ids) ? body.summary.ids : []).slice(0, 5000),
      receipts: (Array.isArray(body.summary?.receipts) ? body.summary.receipts : []).slice(0, 5000),
      pendingReceipts: (Array.isArray(body.summary?.pendingReceipts) ? body.summary.pendingReceipts : []).slice(0, 5000),
      broadcasts: (Array.isArray(body.summary?.broadcasts) ? body.summary.broadcasts : []).slice(0, 500),
    };
    await store.ingest({ envelopes, receipts, broadcasts }, { now: t });
    dirty = true;
    const out = store.prepareFor(summary, { now: t, maxBytes: 1024 * 1024 });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
  });
  return { server, store, flush, close: () => new Promise((r) => { clearInterval(timer); flush(); server.close(r); }) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = createRelay();
  server.listen(+(process.env.PORT ?? 8787), () => console.log(`Relé SENDA escuchando en :${server.address().port}`));
}
