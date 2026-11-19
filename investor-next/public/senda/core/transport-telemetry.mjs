/**
 * SENDA A1 (H-PHY-1) — Transport telemetry contract, NDJSON ingestor & physical survivability auditor.
 *
 * Enforces:
 *  - Explicit state separation: CREATED -> QUEUED -> CUSTODY_ACK -> DESTINATION_ACK (plus terminal REVOKED/EXPIRED/FAILED_EXHAUSTED).
 *  - Never promotes CUSTODY_ACK or JVM/IPC synthetic test runs to delivered or PHYSICAL_RF verified.
 *  - Tracks dual clock / boot transitions, energy provenance (MEASURED_INSTRUMENT vs HYPOTHETICAL_CATALOG vs UNAVAILABLE),
 *    shared SRLG fault IDs, deduplication & causal availableAt <= outcome invariant.
 */

export const TELEMETRY_SCHEMA = 'senda-physical-telemetry/1';

export const CUSTODY_STATES = Object.freeze([
  'CREATED',
  'QUEUED',
  'CUSTODY_ACK',
  'DESTINATION_ACK',
  'REVOKED',
  'EXPIRED',
  'FAILED_EXHAUSTED',
]);

export const TERMINAL_STATES = Object.freeze(['DESTINATION_ACK', 'REVOKED', 'EXPIRED', 'FAILED_EXHAUSTED']);
export const ENERGY_SOURCES = Object.freeze(['MEASURED_INSTRUMENT', 'HYPOTHETICAL_CATALOG', 'UNAVAILABLE']);
export const CLOCK_STATUSES = Object.freeze(['MONOTONIC_OK', 'WALL_ADJUSTED', 'CLOCK_INCOHERENT_QUARANTINE']);

const ISO = /(?:Z|[+-]\d{2}:\d{2})$/;
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function isCustodyTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

/** Strict guard: intermediate CUSTODY_ACK never implies destination delivery. */
export function canPromoteToDelivered(event) {
  return !!(
    event &&
    event.custodyState === 'DESTINATION_ACK' &&
    event.destinationAckVerified === true &&
    event.authorized === true &&
    event.consentActive === true &&
    event.clockStatus !== 'CLOCK_INCOHERENT_QUARANTINE' &&
    event.synthetic !== true
  );
}

/** Validate a single telemetry record (synthetic or hardware). Fails closed with error list. */
export function validateTelemetryEvent(row) {
  const errors = [];
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, errors: ['INVALID_RECORD_OBJECT'] };
  }
  if (row.schema !== TELEMETRY_SCHEMA) errors.push('INVALID_OR_MISSING_SCHEMA');
  if (typeof row.trialId !== 'string' || !row.trialId) errors.push('MISSING_TRIAL_ID');
  if (typeof row.nonce !== 'string' || !row.nonce) errors.push('MISSING_NONCE');
  if (typeof row.bootId !== 'string' || !row.bootId) errors.push('MISSING_BOOT_ID');
  if (!Number.isSafeInteger(row.bootCounter) || row.bootCounter < 0) errors.push('INVALID_BOOT_COUNTER');
  if (typeof row.bearerId !== 'string' || !row.bearerId) errors.push('MISSING_BEARER_ID');
  if (!CUSTODY_STATES.includes(row.custodyState)) errors.push('INVALID_CUSTODY_STATE');
  if (typeof row.destinationAckVerified !== 'boolean') errors.push('MISSING_DESTINATION_ACK_FLAG');
  if (row.custodyState === 'CUSTODY_ACK' && row.destinationAckVerified === true) {
    errors.push('CUSTODY_CANNOT_CLAIM_DESTINATION_ACK');
  }
  if (row.custodyState === 'REVOKED' && row.consentActive === true) {
    errors.push('REVOKED_RECORD_STILL_CLAIMS_CONSENT');
  }
  if (typeof row.authorized !== 'boolean' || typeof row.consentActive !== 'boolean') {
    errors.push('MISSING_AUTH_OR_CONSENT_FLAG');
  }
  if (!ENERGY_SOURCES.includes(row.energySource)) errors.push('INVALID_ENERGY_SOURCE');
  if (!CLOCK_STATUSES.includes(row.clockStatus)) errors.push('INVALID_CLOCK_STATUS');
  if (!Number.isSafeInteger(row.attemptCount) || row.attemptCount < 0) errors.push('INVALID_ATTEMPT_COUNT');
  if (!Number.isSafeInteger(row.bytes) || row.bytes < 1) errors.push('INVALID_BYTES');
  if (!finite(row.airtimeMs) || row.airtimeMs < 0) errors.push('INVALID_AIRTIME_MS');
  if (!finite(row.energyMj) || row.energyMj < 0) errors.push('INVALID_ENERGY_MJ');

  const obsMs = typeof row.observedAtUtc === 'string' && ISO.test(row.observedAtUtc) ? Date.parse(row.observedAtUtc) : NaN;
  const availMs = typeof row.availableAtUtc === 'string' && ISO.test(row.availableAtUtc) ? Date.parse(row.availableAtUtc) : NaN;
  if (!Number.isFinite(obsMs) || !Number.isFinite(availMs)) errors.push('INVALID_UTC_TIMESTAMPS');
  if (Number.isFinite(obsMs) && Number.isFinite(availMs) && availMs < obsMs) {
    errors.push('AVAILABLE_BEFORE_OBSERVED_LEAKAGE');
  }

  return { ok: errors.length === 0, errors };
}

/** Parse and validate NDJSON transport logs strictly. */
export function ingestTelemetryNdjson(ndjsonText) {
  if (typeof ndjsonText !== 'string' || !ndjsonText.trim()) {
    return { ok: false, records: [], errors: [{ line: 0, errors: ['EMPTY_TELEMETRY_LOG'] }] };
  }
  const lines = ndjsonText.trim().split(/\r?\n/);
  const records = [];
  const errors = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx].trim();
    if (!raw || raw.startsWith('#')) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      errors.push({ line: idx + 1, errors: ['MALFORMED_JSON'] });
      continue;
    }
    const v = validateTelemetryEvent(parsed);
    if (!v.ok) {
      errors.push({ line: idx + 1, trialId: parsed?.trialId ?? null, errors: v.errors });
      continue;
    }
    records.push(parsed);
  }
  return { ok: errors.length === 0, records, errors };
}

/**
 * Audit a session of validated telemetry records.
 * Distinguishes synthetic runs from physical RF runs and NEVER emits physicalGate='PASS' without real physical evidence.
 */
export function auditSessionSurvivability(records, { minPhysicalTrials = 30, hardwarePresent = false } = {}) {
  if (!Array.isArray(records) || !records.length) {
    return {
      schema: TELEMETRY_SCHEMA,
      physicalGate: 'NOT_TESTED',
      securityGate: 'PASS',
      evidenceKind: 'NOT_TESTED',
      reason: 'NO_TELEMETRY_RECORDS',
      totals: { events: 0, eligibleTrials: 0 },
    };
  }
  const byTrial = new Map();
  const seenNonces = new Set();
  let replayAttemptsDetected = 0;
  let custodyOnlyTrials = 0;
  let unauthorizedViolations = 0;
  let falseAckViolations = 0;
  let clockQuarantines = 0;
  let anySynthetic = false;
  let totalAirtimeMs = 0;
  const energyBySource = { MEASURED_INSTRUMENT: 0, HYPOTHETICAL_CATALOG: 0, UNAVAILABLE: 0 };
  const srlgFaults = new Set();

  for (const r of records) {
    const v = validateTelemetryEvent(r);
    if (!v.ok) {
      falseAckViolations++;
      continue;
    }
    if (r.synthetic === true || r.physicalRfVerified !== true) anySynthetic = true;
    const nonceKey = `${r.trialId}::${r.nonce}::${r.custodyState}`;
    if (seenNonces.has(nonceKey)) replayAttemptsDetected++;
    seenNonces.add(nonceKey);

    if (r.custodyState === 'QUEUED' && (!r.authorized || !r.consentActive)) {
      if (r.attemptCount > 0) unauthorizedViolations++;
    }
    if (r.clockStatus === 'CLOCK_INCOHERENT_QUARANTINE') clockQuarantines++;
    if (r.srlgFaultId) srlgFaults.add(r.srlgFaultId);
    totalAirtimeMs += r.airtimeMs;
    energyBySource[r.energySource] += r.energyMj;

    const prev = byTrial.get(r.trialId);
    if (!prev) {
      byTrial.set(r.trialId, r);
    } else {
      // Precedence: terminal states override queued/custody; revoked/expired stay terminal
      if (isCustodyTerminal(prev.custodyState)) {
        if (!isCustodyTerminal(r.custodyState) || r.custodyState !== prev.custodyState) {
          falseAckViolations++;
        }
      } else {
        byTrial.set(r.trialId, r);
      }
    }
  }

  let delivered = 0;
  let revoked = 0;
  let expired = 0;
  let exhausted = 0;
  for (const finalEvent of byTrial.values()) {
    if (finalEvent.custodyState === 'CUSTODY_ACK') custodyOnlyTrials++;
    else if (finalEvent.custodyState === 'DESTINATION_ACK' && canPromoteToDelivered(finalEvent)) delivered++;
    else if (finalEvent.custodyState === 'REVOKED') revoked++;
    else if (finalEvent.custodyState === 'EXPIRED') expired++;
    else if (finalEvent.custodyState === 'FAILED_EXHAUSTED') exhausted++;
  }

  const eligibleTrials = Math.max(0, byTrial.size - revoked);
  const exploratoryPdr = eligibleTrials > 0 ? delivered / eligibleTrials : null;
  const securityOk = unauthorizedViolations === 0 && falseAckViolations === 0;
  const isPhysicalHardware = hardwarePresent === true && !anySynthetic && eligibleTrials >= minPhysicalTrials;
  const physicalGate = !securityOk ? 'FAIL' : isPhysicalHardware ? (exploratoryPdr >= 0.8 ? 'PASS' : 'FAIL') : 'NOT_TESTED';

  return Object.freeze({
    schema: TELEMETRY_SCHEMA,
    physicalGate,
    securityGate: securityOk ? 'PASS' : 'FAIL',
    evidenceKind: anySynthetic || !hardwarePresent ? 'SYNTHETIC_NOT_PHYSICAL_RF' : 'PHYSICAL_CONTROLLED_TRIAL',
    physicalRfVerified: isPhysicalHardware && securityOk,
    totals: {
      events: records.length,
      uniqueTrials: byTrial.size,
      eligibleTrials,
      delivered,
      custodyOnlyNotDelivered: custodyOnlyTrials,
      revoked,
      expired,
      failedExhausted: exhausted,
      replayAttemptsDetected,
      clockQuarantines,
      unauthorizedViolations,
      falseAckViolations,
      totalAirtimeMs: +totalAirtimeMs.toFixed(2),
      energyBySource,
      distinctSrlgFaults: [...srlgFaults],
    },
    exploratoryPdr,
    limitations: [
      'CUSTODY_ACK never counts toward exploratoryPdr.',
      anySynthetic || !hardwarePresent
        ? 'Hardware RF not tested in this session; physicalGate remains NOT_TESTED.'
        : 'Exploratory lab PDR applies only to tested handset/radio pair and environment.',
    ],
  });
}

export async function exportTelemetryBundle(ndjsonText, auditResult) {
  const bytes = new TextEncoder().encode(String(ndjsonText ?? ''));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const rawSha256 = 'sha256:' + [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  return Object.freeze({
    schema: 'senda-telemetry-bundle/1',
    rawSha256,
    audit: auditResult,
  });
}
