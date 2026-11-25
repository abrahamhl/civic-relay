#!/usr/bin/env node
/**
 * SENDA · Servidor de referencia local (0 €, Node.js puro sin dependencias externas).
 *
 * Funciones:
 *  - Recibir sobres ciudadanos firmados Ed25519 (`POST /api/v1/reports`) con protección anti-inundación.
 *  - Peritar y clasificar automáticamente en N0–N4 (`report-forensics.mjs` + `report-protocol.mjs`).
 *  - Consultar cola y expediente completo (`GET /api/v1/dossiers`, `GET /api/v1/dossiers/:id`).
 *  - Gestionar verificación por cámara de quien pasa (`verify-request`, `verify-response`).
 *  - Puerta criptográfica humana para N5 (`POST /api/v1/dossiers/:id/authorize-n5`), verificando
 *    `AuthorityGrant` + firma Ed25519 de la decisión humana contra el ancla institucional configurada.
 *  - Suscripción en tiempo real mediante Server-Sent Events (`GET /api/v1/events`).
 *  - Sincronización bidireccional de deltas CRDT con otros canales (`POST /api/v1/sync`).
 *  - Especificación OpenAPI 3.1 servida en `GET /api/v1/openapi.yaml`.
 *
 * Seguridad: escucha únicamente en `127.0.0.1` por defecto (no despliega nada en nube),
 * cabeceras estrictas (CSP, nosniff, DENY), límite de cuerpo (1 MiB) y rate-limit por ventana.
 */

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CITIZEN_HAZARD_TYPES,
  canonicalJson,
  sha256HexCanonical,
  verifyCitizenReport,
} from '../src/citizen-report.mjs';
import {
  PROTOCOL_LEVELS,
  evaluateReportProtocol,
  verifyAuthorityGrant,
} from '../src/report-protocol.mjs';
import { createSyncLedger } from '../src/sync-protocol.mjs';
import { toCap, createAuditLog } from '../src/interop.mjs';
import { unb64 } from '../src/b64.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const OPENAPI_PATH = new URL('./openapi.yaml', import.meta.url);
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

// CORS solo para orígenes locales (o el que se declare en SENDA_ALLOWED_ORIGIN): con «*», cualquier web abierta en el
// navegador podría enviar o leer datos de este servidor local.
const EXTRA_ORIGIN = process.env.SENDA_ALLOWED_ORIGIN || null;
export function allowedOrigin(origin) {
  if (!origin) return null;
  if (EXTRA_ORIGIN && origin === EXTRA_ORIGIN) return origin;
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ? origin : null;
}
function securityHeaders(extra = {}, origin = null) {
  const allow = allowedOrigin(origin);
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'",
    ...(allow ? { 'Access-Control-Allow-Origin': allow, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {}),
    ...extra,
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }, res.req?.headers?.origin));
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { statusCode: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { statusCode: 400 });
  }
}

/**
 * Crea una instancia del servidor de referencia local (sin arrancar aún `listen`).
 * @param {{
 *   defaultPriorProbability?:number,
 *   trustAnchorPublicRaw?:Uint8Array|null,
 *   tleText?:string|null,
 *   rateLimitMax?:number,
 *   rateLimitWindowMs?:number,
 *   nowFn?:()=>number,
 * }} opts
 */
export function createReferenceServer({
  defaultPriorProbability = 0.15,
  trustAnchorPublicRaw = null,
  tleText = null,
  rateLimitMax = 30,
  rateLimitWindowMs = 60_000,
  nowFn = () => Date.now(),
} = {}) {
  const ledger = createSyncLedger({ channelId: 'server' });
  const auditLog = createAuditLog();
  const dossiers = new Map(); // reportId -> { envelope, protocol, evalOpts, passerbyChecks, verificationRequests }
  const sseClients = new Set();
  const rateBuckets = new Map(); // key -> number[] timestamps
  const openapiText = readFileSync(OPENAPI_PATH, 'utf8');

  function emitSse(eventType, data) {
    const line = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(line);
      } catch {
        sseClients.delete(res);
      }
    }
  }

  function checkRateLimit(key) {
    const now = nowFn();
    const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < rateLimitWindowMs);
    if (arr.length >= rateLimitMax) {
      rateBuckets.set(key, arr);
      return false;
    }
    arr.push(now);
    rateBuckets.set(key, arr);
    return true;
  }

  async function reevaluateDossier(reportId) {
    const entry = dossiers.get(reportId);
    if (!entry) return null;
    const peers = [...dossiers.values()]
      .filter((x) => x.envelope.reportId !== reportId)
      .map((x) => x.envelope);
    const prevLevel = entry.protocol?.level;
    const protocol = await evaluateReportProtocol(entry.envelope, {
      ...entry.evalOpts,
      receivedAtMs: entry.receivedAtMs,
      nowMs: nowFn(),
      previousLevel: prevLevel,
      priorProbability: defaultPriorProbability,
      crowdContext: {
        peerEnvelopes: peers,
        passerbyCameraChecks: entry.passerbyChecks,
      },
      satelliteContext: {
        ...(entry.evalOpts.satelliteContext || {}),
        tleText,
      },
    });
    // Si ya tenía autorización N5 válida, no se sobrescribe por reevaluación automática
    if (entry.protocol?.level === 'N5' && entry.protocol?.canPublicWarn) {
      return entry;
    }
    entry.protocol = protocol;
    return entry;
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, securityHeaders({}, res.req?.headers?.origin));
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname;

      if (req.method === 'GET' && path === '/api/v1/health') {
        return sendJson(res, 200, {
          ok: true,
          service: 'senda-local-reference-server',
          dossiersCount: dossiers.size,
          ledgerStats: ledger.stats(),
          auditChainLength: auditLog.entries().length,
          canPublicWarnAutomatic: false,
        });
      }

      if (req.method === 'GET' && path === '/api/v1/openapi.yaml') {
        res.writeHead(200, securityHeaders({ 'Content-Type': 'application/yaml; charset=utf-8' }, res.req?.headers?.origin));
        res.end(openapiText);
        return;
      }

      if (req.method === 'GET' && path === '/api/v1/events') {
        res.writeHead(200, securityHeaders({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        }, res.req?.headers?.origin));
        res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, dossiersCount: dossiers.size })}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      if (req.method === 'POST' && path === '/api/v1/reports') {
        const ip = req.socket.remoteAddress || 'local';
        if (!checkRateLimit(`ip:${ip}`)) {
          return sendJson(res, 429, { ok: false, error: 'RATE_LIMIT_EXCEEDED' });
        }
        const body = await readJsonBody(req);
        const envelope = body.envelope;
        const ver = await verifyCitizenReport(envelope);
        if (!ver.ok) {
          return sendJson(res, 400, { ok: false, error: ver.reason, canPublicWarn: false });
        }
        if (!checkRateLimit(`pse:${ver.pseudonymId}`)) {
          return sendJson(res, 429, { ok: false, error: 'PSEUDONYM_RATE_LIMIT_EXCEEDED' });
        }

        const receivedAtMs = nowFn();
        await ledger.putReport(envelope, { receivedAtMs, channel: envelope.payload.channelOrigin || 'http' });
        const evalOpts = {
          physicalContext: body.physicalContext || {},
          satelliteContext: body.satelliteContext || {},
          riskThreshold: body.riskThreshold || null,
          riskMeasurement: body.riskMeasurement || null,
        };
        if (!dossiers.has(envelope.reportId)) {
          dossiers.set(envelope.reportId, {
            envelope,
            receivedAtMs,
            evalOpts,
            passerbyChecks: [],
            verificationRequests: [],
            protocol: null,
          });
        }
        const updated = await reevaluateDossier(envelope.reportId);
        // Reevaluar pares cercanos que pudieran haber sido corroborados por este nuevo reporte
        for (const otherId of dossiers.keys()) {
          if (otherId !== envelope.reportId) await reevaluateDossier(otherId);
        }
        emitSse('report_assessed', {
          reportId: envelope.reportId,
          level: updated.protocol.level,
          p: updated.protocol.posterior.p,
          operationalStatus: envelope.operationalStatus,
        });
        return sendJson(res, 201, {
          ok: true,
          reportId: envelope.reportId,
          envelope: updated.envelope,
          protocol: updated.protocol,
          verificationRequests: updated.verificationRequests,
        });
      }

      if (req.method === 'GET' && path === '/api/v1/dossiers') {
        const lvl = url.searchParams.get('level');
        const status = url.searchParams.get('status');
        const list = [...dossiers.values()]
          .filter((d) => (!lvl || d.protocol?.level === lvl) && (!status || d.envelope.operationalStatus === status))
          .sort((a, b) => (PROTOCOL_LEVELS[b.protocol.level]?.rank ?? -1) - (PROTOCOL_LEVELS[a.protocol.level]?.rank ?? -1))
          .map((d) => ({
            reportId: d.envelope.reportId,
            envelope: d.envelope,
            protocol: d.protocol,
            verificationRequests: d.verificationRequests,
          }));
        return sendJson(res, 200, { count: list.length, dossiers: list });
      }

      const mDetail = path.match(/^\/api\/v1\/dossiers\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && mDetail) {
        const d = dossiers.get(mDetail[1]);
        if (!d) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
        return sendJson(res, 200, {
          reportId: d.envelope.reportId,
          envelope: d.envelope,
          protocol: d.protocol,
          verificationRequests: d.verificationRequests,
        });
      }

      const mVerReq = path.match(/^\/api\/v1\/dossiers\/([A-Za-z0-9_-]+)\/verify-request$/);
      if (req.method === 'POST' && mVerReq) {
        const d = dossiers.get(mVerReq[1]);
        if (!d) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
        if (!d.envelope.payload.consent?.allowVerificationByPassersby) {
          return sendJson(res, 403, { ok: false, error: 'CITIZEN_DISALLOWED_PASSERBY_VERIFICATION' });
        }
        const vreq = {
          requestId: `vreq_${d.envelope.reportId}_${d.verificationRequests.length + 1}`,
          reportId: d.envelope.reportId,
          createdAtIso: new Date(nowFn()).toISOString(),
          location: d.envelope.payload.location,
          sharesImage: false,
          prompt: 'Verificación voluntaria con cámara local (sin enviar imagen; solo etiqueta compatible/no visto).',
        };
        d.verificationRequests.push(vreq);
        emitSse('verification_requested', vreq);
        return sendJson(res, 201, { ok: true, request: vreq });
      }

      const mVerResp = path.match(/^\/api\/v1\/dossiers\/([A-Za-z0-9_-]+)\/verify-response$/);
      if (req.method === 'POST' && mVerResp) {
        const d = dossiers.get(mVerResp[1]);
        if (!d) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
        const body = await readJsonBody(req);
        if (body.consent !== true) return sendJson(res, 400, { ok: false, error: 'CONSENT_REQUIRED' });
        d.passerbyChecks.push(body);
        ledger.putVerification({
          verificationId: `ver_${d.envelope.reportId}_${d.passerbyChecks.length}`,
          reportId: d.envelope.reportId,
          payload: { verifierId: body.verifierId, roadKind: body.roadKind },
          atMs: nowFn(),
          channel: 'server',
        });
        await reevaluateDossier(d.envelope.reportId);
        emitSse('verification_received', { reportId: d.envelope.reportId, level: d.protocol.level });
        return sendJson(res, 200, { ok: true, reportId: d.envelope.reportId, protocol: d.protocol });
      }

      const mAuthN5 = path.match(/^\/api\/v1\/dossiers\/([A-Za-z0-9_-]+)\/authorize-n5$/);
      if (req.method === 'POST' && mAuthN5) {
        const d = dossiers.get(mAuthN5[1]);
        if (!d) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
        if (!trustAnchorPublicRaw) {
          return sendJson(res, 403, { ok: false, error: 'NO_TRUST_ANCHOR_CONFIGURED', canPublicWarn: false });
        }
        if (d.envelope.operationalStatus !== 'ACTUAL') {
          return sendJson(res, 403, { ok: false, error: 'N5_BLOCKED_NON_ACTUAL', canPublicWarn: false });
        }
        if (!['N2', 'N3', 'N4'].includes(d.protocol?.level)) {
          return sendJson(res, 403, { ok: false, error: `N5_BLOCKED_LEVEL_${d.protocol?.level}`, canPublicWarn: false });
        }
        const body = await readJsonBody(req);
        const nowMs = nowFn();
        const grantVer = await verifyAuthorityGrant(body.grant, {
          trustAnchorPublicRaw,
          nowMs,
          hazardKind: d.envelope.payload.kind,
          location: d.envelope.payload.location,
        });
        if (!grantVer.ok) {
          return sendJson(res, 403, { ok: false, error: `N5_BLOCKED_GRANT:${grantVer.reason}`, canPublicWarn: false });
        }
        // Verificar firma Ed25519 de la decisión humana con la clave de la autoridad habilitada
        const decObj = body.decision;
        if (!decObj || decObj.reportId !== d.envelope.reportId || decObj.grantId !== body.grant.grantId || !body.decisionSigB64u) {
          return sendJson(res, 403, { ok: false, error: 'N5_BLOCKED_DECISION_SHAPE', canPublicWarn: false });
        }
        let sigValid = false;
        try {
          const authPub = await subtle.importKey('raw', unb64(body.grant.authorityPublicKeyB64u), { name: 'Ed25519' }, false, ['verify']);
          sigValid = await subtle.verify({ name: 'Ed25519' }, authPub, unb64(body.decisionSigB64u), enc.encode(canonicalJson(decObj)));
        } catch {
          sigValid = false;
        }
        if (!sigValid) {
          return sendJson(res, 403, { ok: false, error: 'N5_BLOCKED_BAD_HUMAN_SIGNATURE', canPublicWarn: false });
        }

        const decisionHash = await sha256HexCanonical(decObj);
        const auditEntry = await auditLog.append({
          at: nowMs,
          actor: `${body.grant.authorityId} (${body.grant.organization})`,
          action: 'SERVER_AUTHORIZE_N5',
          data: { reportId: d.envelope.reportId, grantId: body.grant.grantId, decisionHash },
        });
        const meta = CITIZEN_HAZARD_TYPES[d.envelope.payload.kind];
        const capPublicXml = toCap({
          identifier: `SENDA-N5-${d.envelope.reportId}-${nowMs}`,
          sender: body.grant.authorityId,
          sent: nowMs,
          status: 'Actual',
          msgType: 'Alert',
          scope: 'Public',
          info: {
            category: meta.capCategory,
            event: meta.label,
            urgency: meta.lifeRisk ? 'Immediate' : 'Expected',
            severity: meta.lifeRisk ? 'Extreme' : 'Severe',
            certainty: 'Observed',
            senderName: `${body.grant.organization} — ${body.grant.authorityName}`,
            headline: `Aviso oficial (${body.grant.organization}): ${meta.label}`,
            description: String(decObj.rationale || ''),
            instruction: String(decObj.instruction || ''),
            parameters: [['SENDA_LEVEL', 'N5'], ['SENDA_DECISION_SHA256', decisionHash]],
            area: { areaDesc: body.grant.organization, circle: { center: { lat: d.envelope.payload.location.lat, lon: d.envelope.payload.location.lon }, radiusKm: 3 } },
          },
        });
        d.protocol = Object.freeze({
          ...d.protocol,
          level: 'N5',
          levelInfo: PROTOCOL_LEVELS.N5,
          canPublicWarn: true,
          capPublicXml,
          humanAuthorization: { decision: decObj, decisionHash, auditEntry },
        });
        ledger.putAuthorityDecision({
          reportId: d.envelope.reportId,
          kind: 'N5_AUTHORIZED',
          decisionHash,
          atMs: nowMs,
          actor: body.grant.authorityId,
          channel: 'server',
        });
        emitSse('n5_authorized', { reportId: d.envelope.reportId, authorityId: body.grant.authorityId, decisionHash });
        return sendJson(res, 200, { ok: true, reportId: d.envelope.reportId, protocol: d.protocol, auditEntry });
      }

      if (req.method === 'POST' && path === '/api/v1/sync') {
        const delta = await readJsonBody(req);
        const merged = await ledger.mergeDelta(delta);
        if (!merged.ok) return sendJson(res, 400, merged);
        for (const item of ledger.listReports()) {
          if (!dossiers.has(item.envelope.reportId)) {
            dossiers.set(item.envelope.reportId, {
              envelope: item.envelope,
              receivedAtMs: item.receivedAtMs,
              evalOpts: {},
              passerbyChecks: [],
              verificationRequests: [],
              protocol: null,
            });
            await reevaluateDossier(item.envelope.reportId);
          }
        }
        const serverDelta = await ledger.exportDelta(0);
        return sendJson(res, 200, { ...merged, serverDelta, stateDigest: await ledger.stateDigest() });
      }

      return sendJson(res, 404, { ok: false, error: 'ROUTE_NOT_FOUND' });
    } catch (err) {
      const code = err.statusCode || 500;
      return sendJson(res, code, { ok: false, error: err.message || 'INTERNAL_ERROR' });
    }
  });

  return {
    server,
    ledger,
    auditLog,
    dossiers,
    closeAll() {
      for (const r of sseClients) {
        try { r.end(); } catch { /* noop */ }
      }
      sseClients.clear();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

// Ejecución directa CLI: `node packages/senda/server/reference-server.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.SENDA_PORT || 8787);
  const host = '127.0.0.1'; // Nunca exponer a red pública por defecto
  const ref = createReferenceServer();
  ref.server.listen(port, host, () => {
    console.log(`SENDA servidor de referencia local escuchando en http://${host}:${port} (OpenAPI: /api/v1/openapi.yaml)`);
  });
}
