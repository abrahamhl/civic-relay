import test from 'node:test';
import assert from 'node:assert/strict';
import { createCitizenKeyPair, createCitizenReport } from '../src/citizen-report.mjs';
import {
  PUBLISHED_RISK_THRESHOLDS,
  createRiskThreshold,
  createAuthorityKeyPair,
  issueAuthorityGrant,
  verifyAuthorityGrant,
  evaluateReportProtocol,
  authorizePublicWarningN5,
  cancelPublicWarningN5,
} from '../src/report-protocol.mjs';
import { createAuditLog, verifyAuditLog } from '../src/interop.mjs';

const CONSENT = {
  accepted: true,
  purpose: 'peritaje_civil_emergencia',
  shareWithAuthorities: true,
  allowVerificationByPassersby: true,
  redactBeforeShare: true,
  consentVersion: 'v1',
  acceptedAtIso: '2026-11-25T17:40:00Z',
};

const T0 = Date.parse('2026-11-25T18:00:00Z');

async function makeActualFlood(kp, overrides = {}) {
  return createCitizenReport(
    {
      kind: 'nivel_agua',
      operationalStatus: 'ACTUAL',
      modalities: ['foto', 'ubicacion', 'texto'],
      capturedAtIso: new Date(overrides.atMs ?? T0).toISOString(),
      location: { lat: 39.4269, lon: -0.4174, accuracyM: 10 },
      text: 'Nivel del barranco subiendo con rapidez',
      consent: CONSENT,
      ...overrides,
    },
    kp
  );
}

test('transiciones automáticas N0 → N1 → N2 → N3 → N4 (con CAP borrador y canPublicWarn=false)', async () => {
  const [k1, k2] = await Promise.all([createCitizenKeyPair(), createCitizenKeyPair()]);
  const r1 = await makeActualFlood(k1);
  const r2 = await makeActualFlood(k2, { atMs: T0 + 180_000, location: { lat: 39.4282, lon: -0.4161, accuracyM: 12 } });

  // N0 bloqueado por reloj manipulado
  const rBadClock = await makeActualFlood(k1, { atMs: T0 + 2 * 3600_000 });
  const resN0 = await evaluateReportProtocol(rBadClock, { receivedAtMs: T0, priorProbability: 0.15 });
  assert.equal(resN0.level, 'N0');
  assert.equal(resN0.canPublicWarn, false);

  // N1 coherente (un solo ciudadano sin corroboración)
  const resN1 = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 10_000,
    priorProbability: 0.15,
    physicalContext: { rainfallMm: 60, rainfallDurationH: 1, handM: 3 },
  });
  assert.equal(resN1.level, 'N1');
  assert.equal(resN1.canPublicWarn, false);

  // N2 corroborado (2 ciudadanos independientes)
  const resN2 = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    physicalContext: { rainfallMm: 60, rainfallDurationH: 1, handM: 3 },
    crowdContext: { peerEnvelopes: [r2] },
  });
  assert.equal(resN2.level, 'N2');
  assert.equal(resN2.canPublicWarn, false);

  // N3 verificado por instrumento (aforo autenticado / satélite) sin umbral N4
  const resN3 = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    physicalContext: {
      rainfallMm: 120,
      rainfallDurationH: 1,
      gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true },
    },
    crowdContext: { peerEnvelopes: [r2] },
  });
  assert.equal(resN3.level, 'N3');
  assert.equal(resN3.canPublicWarn, false);
  assert.equal(resN3.capDraftXml, null);

  // N4 pre-alerta al comité: N3 + lectura por encima del umbral citado de la CHJ (150 m³/s)
  const resN4 = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    physicalContext: {
      rainfallMm: 120,
      rainfallDurationH: 1,
      gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true },
    },
    crowdContext: { peerEnvelopes: [r2] },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'MEASURED' },
  });
  assert.equal(resN4.level, 'N4');
  assert.equal(resN4.canPublicWarn, false);
  assert.match(resN4.capDraftXml, /<status>Exercise<\/status>/);
  assert.match(resN4.capDraftXml, /<scope>Restricted<\/scope>/);
  assert.ok(resN4.transitions.some((t) => t.to === 'N4' && t.passed));

  // Un umbral sin fuente citada se rechaza (regla CLAUDE.md)
  assert.throws(() => createRiskThreshold({ metric: 'flowM3s', thresholdValue: 100, unit: 'm³/s', source: '' }), /fuente citada/);
});

test('descenso automático de nivel por contradicción de aforo o decaimiento temporal', async () => {
  const [k1, k2] = await Promise.all([createCitizenKeyPair(), createCitizenKeyPair()]);
  const r1 = await makeActualFlood(k1);
  const r2 = await makeActualFlood(k2, { atMs: T0 + 180_000, location: { lat: 39.4282, lon: -0.4161, accuracyM: 12 } });

  // Contradicción de aforo autenticado ABSENT degrada un N4 previo a N0
  const downContra = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    previousLevel: 'N4',
    physicalContext: { gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'ABSENT', authenticated: true, flowM3s: 0.2 } },
    crowdContext: { peerEnvelopes: [r2] },
  });
  assert.equal(downContra.level, 'N0');
  assert.ok(downContra.transitions.some((t) => t.downgrade === true && t.from === 'N4' && t.to === 'N0'));

  // Decaimiento bayesiano tras 6 semividas degrada N2 previo a N0
  const downDecay = await evaluateReportProtocol(r1, {
    receivedAtMs: T0 + 10_000,
    nowMs: T0 + 6 * 60 * 60_000,
    halfLifeMin: 45,
    priorProbability: 0.2,
    previousLevel: 'N2',
    crowdContext: { peerEnvelopes: [r2] },
  });
  assert.equal(downDecay.posterior.decayed, true);
  assert.equal(downDecay.level, 'N0');
  assert.ok(downDecay.transitions.some((t) => t.downgrade === true));
});

test('puerta N5 estrictamente humana: bloquea simulaciones, grants caducadas/NaN/fuera de geocerca y permite firma válida + cancelación', async () => {
  const [k1, k2, anchor, authority, imposter] = await Promise.all([
    createCitizenKeyPair(),
    createCitizenKeyPair(),
    createAuthorityKeyPair(),
    createAuthorityKeyPair(),
    createAuthorityKeyPair(),
  ]);
  const rActual = await makeActualFlood(k1);
  const rPeer = await makeActualFlood(k2, { atMs: T0 + 180_000, location: { lat: 39.4282, lon: -0.4161, accuracyM: 12 } });
  const rSim = await makeActualFlood(k1, { operationalStatus: 'SIMULATION' });

  const n4Actual = await evaluateReportProtocol(rActual, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    physicalContext: { gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true } },
    crowdContext: { peerEnvelopes: [rPeer] },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'MEASURED' },
  });
  assert.equal(n4Actual.level, 'N4');

  const n4Sim = await evaluateReportProtocol(rSim, {
    receivedAtMs: T0 + 200_000,
    priorProbability: 0.15,
    crowdContext: { peerEnvelopes: [rPeer] },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'SCENARIO' },
  });

  const grant = await issueAuthorityGrant(
    {
      grantId: 'GRANT-CECOPI-2026-01',
      authorityId: 'dir.emergencias@gva.example',
      authorityName: 'Dirección de Emergencias (Prueba)',
      role: 'Dirección del Plan Especial de Inundaciones',
      organization: 'Protección Civil Autonómica',
      authorityPublicKeyB64u: authority.publicKeyB64u,
      allowedHazardKinds: ['inundacion', 'nivel_agua'],
      scopeCircle: { lat: 39.45, lon: -0.40, radiusKm: 30 },
      grantedAtIso: '2026-11-25T00:00:00Z',
      expiresAtIso: '2026-11-26T00:00:00Z',
      documentHash: 'c'.repeat(64),
    },
    anchor
  );

  // 1. Bloqueo de SIMULATION
  await assert.rejects(
    authorizePublicWarningN5(n4Sim, rSim, {
      grant,
      trustAnchorPublicRaw: anchor.publicRaw,
      authorityKeyPair: authority,
      rationale: 'Prueba de bloqueo de simulación',
      instruction: 'Suba a plantas altas inmediatamente',
      expiresAtMs: T0 + 3600_000,
      nowMs: T0 + 240_000,
    }),
    /N5_BLOCKED_NON_ACTUAL/
  );

  // 2. Bloqueo por grant caducada, futura, NaN o fuera de geocerca
  assert.equal((await verifyAuthorityGrant(grant, { trustAnchorPublicRaw: anchor.publicRaw, nowMs: Date.parse('2026-11-27T00:00:00Z'), hazardKind: 'nivel_agua', location: rActual.payload.location })).reason, 'GRANT_EXPIRED');
  assert.equal((await verifyAuthorityGrant(grant, { trustAnchorPublicRaw: anchor.publicRaw, nowMs: Date.parse('2026-11-24T00:00:00Z'), hazardKind: 'nivel_agua', location: rActual.payload.location })).reason, 'GRANT_NOT_YET_VALID');
  assert.equal((await verifyAuthorityGrant({ ...grant, expiresAtIso: 'fecha-rota' }, { trustAnchorPublicRaw: anchor.publicRaw, nowMs: T0 + 240_000 })).reason, 'INVALID_GRANT_TIMESTAMPS');
  assert.match((await verifyAuthorityGrant(grant, { trustAnchorPublicRaw: anchor.publicRaw, nowMs: T0 + 240_000, hazardKind: 'nivel_agua', location: { lat: 40.42, lon: -3.70 } })).reason, /LOCATION_OUT_OF_GRANT_GEOFENCE/);

  // 3. Bloqueo por clave impostora o ancla equivocada
  await assert.rejects(
    authorizePublicWarningN5(n4Actual, rActual, {
      grant,
      trustAnchorPublicRaw: anchor.publicRaw,
      authorityKeyPair: imposter,
      rationale: 'Intento de suplantación de autoridad',
      instruction: 'Evacuar zona de inmediato',
      expiresAtMs: T0 + 3600_000,
      nowMs: T0 + 240_000,
    }),
    /N5_BLOCKED_AUTHORITY_KEY_MISMATCH/
  );

  // 4. Autorización humana legítima N4 → N5 con auditoría SHA-256 verificada
  const auditLog = createAuditLog();
  const n5 = await authorizePublicWarningN5(n4Actual, rActual, {
    grant,
    trustAnchorPublicRaw: anchor.publicRaw,
    authorityKeyPair: authority,
    rationale: 'Aforo del Poyo en 2282 m³/s confirmado y corroboración ciudadana independiente en Paiporta.',
    instruction: 'Evite garajes, bajos y desplazamientos; suba a plantas superiores y siga canales oficiales 112.',
    expiresAtMs: T0 + 4 * 3600_000,
    nowMs: T0 + 240_000,
    auditLog,
  });
  assert.equal(n5.level, 'N5');
  assert.equal(n5.canPublicWarn, true);
  assert.match(n5.capPublicXml, /<status>Actual<\/status>/);
  assert.match(n5.capPublicXml, /<scope>Public<\/scope>/);
  assert.match(n5.capPublicXml, /SENDA_DECISION_SHA256/);

  // 5. Cancelación humana N5 → N1 con CAP Cancel y cadena de auditoría intacta
  const cancelled = await cancelPublicWarningN5(n5, rActual, {
    grant,
    trustAnchorPublicRaw: anchor.publicRaw,
    authorityKeyPair: authority,
    reason: 'Caudal por debajo de umbral de riesgo confirmado por CHJ',
    nowMs: T0 + 3 * 3600_000,
    auditLog,
  });
  assert.equal(cancelled.level, 'N1');
  assert.equal(cancelled.canPublicWarn, false);
  assert.match(cancelled.capCancelXml, /<msgType>Cancel<\/msgType>/);
  assert.equal((await verifyAuditLog(auditLog.entries())).ok, true);
  assert.equal(auditLog.entries().length, 2);
});

test('abuso: inundación de 25 reportes del mismo grupo / foto repetida no logra alcanzar N2 ni N4', async () => {
  const keys = await Promise.all(Array.from({ length: 25 }, () => createCitizenKeyPair()));
  const sharedHash = 'deadbeefcafebabe';
  const main = await makeActualFlood(keys[0], {
    groupHint: 'botnet-grupo-1',
    media: [{ modality: 'foto', mimeType: 'image/jpeg', sha256: '3'.repeat(64), byteLength: 4000, perceptualHashHex: sharedHash, redacted: true, exifStripped: true }],
  });
  const floodPeers = await Promise.all(
    keys.slice(1).map((k, i) =>
      makeActualFlood(k, {
        atMs: T0 + (i + 1) * 1000,
        groupHint: i % 2 === 0 ? 'botnet-grupo-1' : null,
        location: { lat: 39.4269 + i * 0.0002, lon: -0.4174, accuracyM: 10 },
        media: [{ modality: 'foto', mimeType: 'image/jpeg', sha256: String(i + 10).padStart(64, '4'), byteLength: 4000, perceptualHashHex: sharedHash, redacted: true, exifStripped: true }],
      })
    )
  );
  const res = await evaluateReportProtocol(main, {
    receivedAtMs: T0 + 30_000,
    priorProbability: 0.15,
    crowdContext: { peerEnvelopes: floodPeers },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 500, unit: 'm³/s', basis: 'CITIZEN' },
  });
  assert.equal(res.dossier.pillars.crowd.independentCitizens, 1);
  assert.equal(res.level, 'N1'); // Nunca alcanza N2 ni N4
  assert.equal(res.canPublicWarn, false);
});
