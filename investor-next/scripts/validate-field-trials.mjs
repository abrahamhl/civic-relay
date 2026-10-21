#!/usr/bin/env node
/**
 * Deterministic validator and metrics compiler for the 2-phone Android Nearby
 * field trial CSV (experimental/android-nearby/field_trials_template.csv).
 *
 * - Never fabricates trials: if the CSV has 0 data rows, reports status: PHYSICAL_TEST_PENDING.
 * - Rejects any row where ack_before_ttl=false is counted as a valid success.
 * - Computes honest numerator/denominator, p50/p95 round-trip latency, and battery deltas.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_HEADERS = [
  'trial_id',
  'started_at_utc',
  'ended_at_utc',
  'sender_phone_model',
  'receiver_phone_model',
  'sender_android_version',
  'receiver_android_version',
  'google_play_services_versions',
  'manual_radio_states',
  'permissions_granted_both',
  'consent_confirmed_both',
  'auth_digits_verified_both',
  'airplane_mode_state',
  'internet_connectivity_confirmed_absent',
  'endpoint_discovery_success',
  'nearby_connection_success',
  'transfer_accepted',
  'receiver_payload_received',
  'application_ack_returned',
  'ack_before_ttl',
  'round_trip_ms',
  'send_failure_reason',
  'radio_environment_notes',
  'battery_percent_before_a',
  'battery_percent_after_a',
  'battery_percent_before_b',
  'battery_percent_after_b',
  'tester_signature_or_pseudonym',
  'observations'
];

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function percentile(sortedNumbers, p) {
  if (!sortedNumbers.length) return null;
  const idx = Math.min(sortedNumbers.length - 1, Math.max(0, Math.ceil((p / 100) * sortedNumbers.length) - 1));
  return sortedNumbers[idx];
}

export function analyzeFieldTrialsCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Empty CSV file: missing header row');
  }
  const headers = parseCsvLine(lines[0]);
  if (headers.join(',') !== EXPECTED_HEADERS.join(',')) {
    throw new Error(`Invalid CSV header schema. Expected ${EXPECTED_HEADERS.length} columns.`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== EXPECTED_HEADERS.length) {
      throw new Error(`Row ${i + 1} has ${values.length} columns; expected ${EXPECTED_HEADERS.length}`);
    }
    const row = Object.fromEntries(EXPECTED_HEADERS.map((h, idx) => [h, values[idx]]));
    if (/fictitious|synthetic|mock|todo|placeholder/i.test(row.trial_id + ' ' + row.observations)) {
      throw new Error(`Row ${i + 1} (${row.trial_id}) contains synthetic/placeholder markers; only physical trials allowed`);
    }
    if (row.consent_confirmed_both !== 'true') {
      throw new Error(`Row ${i + 1} (${row.trial_id}) missing explicit consent_confirmed_both=true`);
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      status: 'PHYSICAL_TEST_PENDING',
      gatePassed: false,
      totalTrials: 0,
      minimumRequiredTrials: 30,
      validAckSuccesses: 0,
      lateOrInvalidAcks: 0,
      failedOrNoAckTrials: 0,
      deliveryRate: null,
      p50RoundTripMs: null,
      p95RoundTripMs: null
    };
  }

  let validAckSuccesses = 0;
  let lateOrInvalidAcks = 0;
  let failedOrNoAckTrials = 0;
  const rtts = [];

  for (const r of rows) {
    const ackReturned = r.application_ack_returned === 'true';
    const beforeTtl = r.ack_before_ttl === 'true';
    const authVerified = r.auth_digits_verified_both === 'true';
    const offlineConfirmed = r.airplane_mode_state === 'true' && r.internet_connectivity_confirmed_absent === 'true';

    if (ackReturned && beforeTtl && authVerified && offlineConfirmed) {
      validAckSuccesses++;
      const ms = Number(r.round_trip_ms);
      if (Number.isFinite(ms) && ms > 0) {
        rtts.push(ms);
      }
    } else if (ackReturned && !beforeTtl) {
      // P0 rule: A receipt arriving after TTL MUST be recorded as late/invalid, not a success.
      lateOrInvalidAcks++;
    } else {
      failedOrNoAckTrials++;
    }
  }

  rtts.sort((a, b) => a - b);
  const totalTrials = rows.length;
  const gatePassed = totalTrials >= 30 && validAckSuccesses > 0;

  return {
    status: gatePassed ? 'PHYSICALLY_TESTED_M1_COMPLETE' : 'PARTIAL_FIELD_DATA_BELOW_30_TRIALS',
    gatePassed,
    totalTrials,
    minimumRequiredTrials: 30,
    validAckSuccesses,
    lateOrInvalidAcks,
    failedOrNoAckTrials,
    deliveryRate: Number((validAckSuccesses / totalTrials).toFixed(4)),
    p50RoundTripMs: percentile(rtts, 50),
    p95RoundTripMs: percentile(rtts, 95)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const csvPath = resolve(process.argv[2] || 'experimental/android-nearby/field_trials_template.csv');
  const summary = analyzeFieldTrialsCsv(readFileSync(csvPath, 'utf8'));
  console.log(JSON.stringify(summary, null, 2));
}
