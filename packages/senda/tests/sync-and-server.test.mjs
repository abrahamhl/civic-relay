import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson,
  createCitizenKeyPair,
  createCitizenReport,
} from '../src/citizen-report.mjs';
import {
  PUBLISHED_RISK_THRESHOLDS,
  createAuthorityKeyPair,
  issueAuthorityGrant,
} from '../src/report-protocol.mjs';
import {
  createSyncLedger,
  createTransportClient,
  createHttpTransportAdapter,
  createMemoryTransportAdapter,
} from '../src/sync-protocol.mjs';
import { createReferenceServer } from '../server/reference-server.mjs';
import { verifyAuditLog } from '../src/interop.mjs';
import { b64 } from '../src/b64.mjs';

const T0 = Date.parse('2026-11-25T18:00:00Z');
const CONSENT = {
  accepted: true,
  purpose: 'peritaje_civil_emergencia',
  shareWithAuthorities: true,
  allowVerificationByPassersby: true,
  redactBeforeShare: true,
  consentVersion: 'v1',
  acceptedAtIso: '2026-11-25T17:50:00Z',
};

async function mkReport(kp, overrides = {}) {
  return createCitizenReport(
    {
      kind: 'nivel_agua',
      operationalStatus: 'ACTUAL',
      modalities: ['foto', 'ubicacion', 'texto'],
      capturedAtIso: new Date(overrides.atMs ?? T0).toISOString(),
      location: { lat: 39.4269, lon: -0.4174, accuracyM: 10 },
      text: 'Crecida rápida en el cauce',
      consent: CONSENT,
      ...overrides,
    },
    kp
  );
}

test('sincronización multicanal CRDT (web, app, escritorio, malla): conmutativa, idempotente y resolución de conflictos', async () => {
  const [k1, k2] = await Promise.all([createCitizenKeyPair(), createCitizenKeyPair()]);
  const r1 = await mkReport(k1);
  const r2 = await mkReport(k2, { atMs: T0 + 60_000, location: { lat: 39.428, lon: -0.416, accuracyM: 12 } });

  const web = createSyncLedger({ channelId: 'web' });
  const mesh = createSyncLedger({ channelId: 'mesh' });
  const desktop = createSyncLedger({ channelId: 'desktop' });

  await web.putReport(r1, { receivedAtMs: T0 + 1000, channel: 'web' });
  web.putAuthorityDecision({ reportId: r1.reportId, kind: 'N5_AUTHORIZED', decisionHash: 'a'.repeat(64), atMs: T0 + 5000, actor: 'dir@pc.example' });

  await mesh.putReport(r2, { receivedAtMs: T0 + 2000, channel: 'mesh' });
  await mesh.putReport(r1, { receivedAtMs: T0 + 3000, channel: 'mesh' });
  // En desktop llega una cancelación humana N5 del mismo reporte
  await desktop.putReport(r1, { receivedAtMs: T0 + 1500, channel: 'desktop' });
  desktop.putAuthorityDecision({ reportId: r1.reportId, kind: 'N5_CANCELLED', decisionHash: 'b'.repeat(64), atMs: T0 + 6000, actor: 'dir@pc.example' });

  const dWeb = await web.exportDelta(0);
  const dMesh = await mesh.exportDelta(0);
  const dDesk = await desktop.exportDelta(0);

  // Dos réplicas frescas fusionando en órdenes opuestos + duplicados deben converger exactamente
  const replicaA = createSyncLedger({ channelId: 'app' });
  await replicaA.mergeDelta(dWeb);
  await replicaA.mergeDelta(dMesh);
  await replicaA.mergeDelta(dDesk);
  await replicaA.mergeDelta(dWeb); // duplicado idempotente

  const replicaB = createSyncLedger({ channelId: 'app' });
  await replicaB.mergeDelta(dDesk);
  await replicaB.mergeDelta(dWeb); // llega tarde N5_AUTHORIZED tras N5_CANCELLED → ignorado
  await replicaB.mergeDelta(dMesh);

  assert.equal(await replicaA.stateDigest(), await replicaB.stateDigest());
  assert.equal(replicaA.getDecision(r1.reportId).kind, 'N5_CANCELLED');
  assert.equal(replicaB.getDecision(r1.reportId).kind, 'N5_CANCELLED');
  assert.ok(replicaB.conflicts().some((c) => c.type === 'STALE_LOWER_PRECEDENCE_IGNORED'));

  // Delta alterado se rechaza por SHA-256
  const tampered = structuredClone(dWeb);
  tampered.fromChannel = 'evil';
  assert.equal((await replicaA.mergeDelta(tampered)).reason, 'DELTA_CHECKSUM_MISMATCH');

  // Adaptador offline en memoria
  const memClient = createTransportClient(createMemoryTransportAdapter());
  const events = [];
  const unsub = memClient.subscribe((e) => events.push(e));
  await memClient.submitReport(r1);
  unsub();
  assert.equal(events.length, 1);
  assert.equal((await memClient.listDossiers()).dossiers.length, 1);
});

test('servidor de referencia local: HTTP, OpenAPI, SSE, verificación, puerta N5, sync y rate-limit', async () => {
  const [k1, k2, anchor, authority] = await Promise.all([
    createCitizenKeyPair(),
    createCitizenKeyPair(),
    createAuthorityKeyPair(),
    createAuthorityKeyPair(),
  ]);
  const r1 = await mkReport(k1);
  const r2 = await mkReport(k2, { atMs: T0 + 120_000, location: { lat: 39.4282, lon: -0.4161, accuracyM: 12 } });

  const ref = createReferenceServer({
    trustAnchorPublicRaw: anchor.publicRaw,
    rateLimitMax: 15,
    rateLimitWindowMs: 60_000,
    nowFn: () => T0 + 180_000,
  });

  await new Promise((resolve) => ref.server.listen(0, '127.0.0.1', resolve));
  const { port } = ref.server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health + cabeceras de seguridad + OpenAPI
    const hResp = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(hResp.status, 200);
    assert.equal(hResp.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(hResp.headers.get('x-frame-options'), 'DENY');
    const health = await hResp.json();
    assert.equal(health.canPublicWarnAutomatic, false);

    const specResp = await fetch(`${baseUrl}/api/v1/openapi.yaml`);
    assert.equal(specResp.status, 200);
    assert.match(await specResp.text(), /openapi: 3\.1\.0/);

    // 2. Suscripción SSE en tiempo real
    const sseAbort = new AbortController();
    const sseResp = await fetch(`${baseUrl}/api/v1/events`, { signal: sseAbort.signal });
    assert.equal(sseResp.status, 200);
    const reader = sseResp.body.getReader();
    const firstChunk = new TextDecoder().decode((await reader.read()).value);
    assert.match(firstChunk, /event: connected/);

    // 3. Cliente independiente del transporte envía 2 reportes independientes → N4 borrador
    const client = createTransportClient(createHttpTransportAdapter({ baseUrl }));
    const res1 = await client.submitReport(r1, {
      physicalContext: { gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true } },
      riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
      riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'MEASURED' },
    });
    assert.equal(res1.protocol.level, 'N4');
    assert.equal(res1.protocol.canPublicWarn, false);

    const secondChunk = new TextDecoder().decode((await reader.read()).value);
    assert.match(secondChunk, /event: report_assessed/);
    sseAbort.abort();

    await client.submitReport(r2);
    const list = await client.listDossiers({ level: 'N4' });
    assert.equal(list.count, 1);

    // 4. Petición y respuesta de verificación a quien pasa
    const vr = await fetch(`${baseUrl}/api/v1/dossiers/${r1.reportId}/verify-request`, { method: 'POST' });
    assert.equal(vr.status, 201);
    const vresp = await fetch(`${baseUrl}/api/v1/dossiers/${r1.reportId}/verify-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verifierId: 'paso-1',
        consent: true,
        roadKind: 'accidente',
        frames: [[{ label: 'car', score: 0.9 }]],
        minScore: 0.5,
        minFrames: 1,
      }),
    });
    assert.equal(vresp.status, 200);

    // 5. Puerta N5: intento sin firma válida bloqueado (403); con AuthorityGrant + firma Ed25519 humana permitido (200)
    const grant = await issueAuthorityGrant(
      {
        grantId: 'GRANT-SRV-1',
        authorityId: 'dir@pc.example',
        authorityName: 'Dirección Emergencias',
        role: 'Dirección del Plan',
        organization: 'Protección Civil',
        authorityPublicKeyB64u: authority.publicKeyB64u,
        allowedHazardKinds: ['nivel_agua'],
        scopeCircle: { lat: 39.43, lon: -0.42, radiusKm: 25 },
        grantedAtIso: '2026-11-25T00:00:00Z',
        expiresAtIso: '2026-11-26T00:00:00Z',
        documentHash: 'e'.repeat(64),
      },
      anchor
    );
    const badN5 = await fetch(`${baseUrl}/api/v1/dossiers/${r1.reportId}/authorize-n5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant, decision: { reportId: r1.reportId, grantId: grant.grantId }, decisionSigB64u: b64(new Uint8Array(64)) }),
    });
    assert.equal(badN5.status, 403);

    const decision = {
      reportId: r1.reportId,
      grantId: grant.grantId,
      rationale: 'Aforo SAIH y corroboración ciudadana verificados por dirección de guardia',
      instruction: 'Suba a plantas altas y evite garajes o desplazamientos',
    };
    const decSig = b64(new Uint8Array(await globalThis.crypto.subtle.sign({ name: 'Ed25519' }, authority.privateKey, new TextEncoder().encode(canonicalJson(decision)))));
    const okN5 = await fetch(`${baseUrl}/api/v1/dossiers/${r1.reportId}/authorize-n5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant, decision, decisionSigB64u: decSig }),
    });
    assert.equal(okN5.status, 200);
    const n5Data = await okN5.json();
    assert.equal(n5Data.protocol.level, 'N5');
    assert.equal(n5Data.protocol.canPublicWarn, true);
    assert.match(n5Data.protocol.capPublicXml, /<scope>Public<\/scope>/);
    assert.equal((await verifyAuditLog(ref.auditLog.entries())).ok, true);

    // 6. Sincronización bidireccional `/api/v1/sync` con un nodo de malla desconectado
    const meshLedger = createSyncLedger({ channelId: 'mesh' });
    const k3 = await createCitizenKeyPair();
    const rMesh = await mkReport(k3, { atMs: T0 + 150_000, location: { lat: 39.431, lon: -0.415, accuracyM: 14 } });
    await meshLedger.putReport(rMesh, { receivedAtMs: T0 + 155_000, channel: 'mesh' });
    const syncRes = await client.syncDelta(await meshLedger.exportDelta(0));
    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.addedReports, 1);
    await meshLedger.mergeDelta(syncRes.serverDelta);
    assert.equal(meshLedger.stats().reports, 3);
    assert.equal(meshLedger.getDecision(r1.reportId).kind, 'N5_AUTHORIZED');

    // 7. Protección anti-inundación (rate limit → 429)
    let got429 = false;
    for (let i = 0; i < 20; i++) {
      const resp = await fetch(`${baseUrl}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envelope: r1 }),
      });
      if (resp.status === 429) {
        got429 = true;
        break;
      }
    }
    assert.equal(got429, true, 'el servidor debe frenar inundaciones de avisos con HTTP 429');
  } finally {
    await ref.closeAll();
  }
});
