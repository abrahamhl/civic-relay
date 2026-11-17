import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEMETRY_SCHEMA,
  CUSTODY_STATES,
  canPromoteToDelivered,
  validateTelemetryEvent,
  ingestTelemetryNdjson,
  auditSessionSurvivability,
  exportTelemetryBundle,
} from '../src/transport-telemetry.mjs';

const mkEvent = (over = {}) => ({
  schema: TELEMETRY_SCHEMA,
  trialId: '11111111-1111-4111-8111-111111111111',
  observedAtUtc: '2026-11-17T10:00:00Z',
  availableAtUtc: '2026-11-17T10:00:01Z',
  bootId: 'boot-a',
  bootCounter: 1,
  bearerId: 'BLE_NEARBY',
  authorized: true,
  consentActive: true,
  custodyState: 'QUEUED',
  destinationAckVerified: false,
  nonce: 'aaaa1111-1111-4111-8111-111111111111',
  attemptCount: 1,
  bytes: 160,
  airtimeMs: 120,
  energyMj: 4.2,
  energySource: 'HYPOTHETICAL_CATALOG',
  srlgFaultId: null,
  clockStatus: 'MONOTONIC_OK',
  lossReason: null,
  synthetic: true,
  physicalRfVerified: false,
  ...over,
});

test('transport-telemetry: CUSTODY_ACK never promotes to delivered and rejects false destination flag', () => {
  assert.ok(CUSTODY_STATES.includes('CUSTODY_ACK') && CUSTODY_STATES.includes('DESTINATION_ACK'));
  const bad = mkEvent({ custodyState: 'CUSTODY_ACK', destinationAckVerified: true });
  const v = validateTelemetryEvent(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes('CUSTODY_CANNOT_CLAIM_DESTINATION_ACK'));

  const validCustody = mkEvent({ custodyState: 'CUSTODY_ACK', destinationAckVerified: false });
  assert.equal(validateTelemetryEvent(validCustody).ok, true);
  assert.equal(canPromoteToDelivered(validCustody), false);
});

test('transport-telemetry: rejects temporal leakage (availableAtUtc < observedAtUtc) and revoked+consent contradictions', () => {
  const leak = mkEvent({ observedAtUtc: '2026-11-17T10:05:00Z', availableAtUtc: '2026-11-17T10:04:59Z' });
  assert.equal(validateTelemetryEvent(leak).ok, false);
  const rev = mkEvent({ custodyState: 'REVOKED', consentActive: true });
  assert.equal(validateTelemetryEvent(rev).ok, false);
});

test('transport-telemetry: synthetic session never passes physicalGate and correctly audits custody vs revocation', async () => {
  const rows = [
    mkEvent({ trialId: 't1', custodyState: 'CUSTODY_ACK', destinationAckVerified: false }),
    mkEvent({ trialId: 't2', custodyState: 'DESTINATION_ACK', destinationAckVerified: true, physicalRfVerified: true, synthetic: false }),
    mkEvent({ trialId: 't3', custodyState: 'REVOKED', consentActive: false }),
    mkEvent({ trialId: 't4', custodyState: 'EXPIRED', clockStatus: 'CLOCK_INCOHERENT_QUARANTINE', lossReason: 'BACKWARD_CLOCK_JUMP', srlgFaultId: 'POWER_GRID_ZONE_A' }),
  ];
  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
  const ingested = ingestTelemetryNdjson(ndjson);
  assert.equal(ingested.ok, true);

  const audit = auditSessionSurvivability(ingested.records, { hardwarePresent: false });
  assert.equal(audit.physicalGate, 'NOT_TESTED');
  assert.equal(audit.physicalRfVerified, false);
  assert.equal(audit.securityGate, 'PASS');
  assert.equal(audit.totals.custodyOnlyNotDelivered, 1);
  assert.equal(audit.totals.revoked, 1);
  assert.equal(audit.totals.expired, 1);
  assert.equal(audit.totals.clockQuarantines, 1);
  assert.deepEqual(audit.totals.distinctSrlgFaults, ['POWER_GRID_ZONE_A']);

  const bundle = await exportTelemetryBundle(ndjson, audit);
  assert.match(bundle.rawSha256, /^sha256:[0-9a-f]{64}$/);
});

test('transport-telemetry: detects unauthorized attempt violation fail-closed', () => {
  const bad = mkEvent({ authorized: false, attemptCount: 1 });
  const audit = auditSessionSurvivability([bad], { hardwarePresent: true });
  assert.equal(audit.securityGate, 'FAIL');
  assert.equal(audit.physicalGate, 'FAIL');
  assert.equal(audit.totals.unauthorizedViolations, 1);
});
