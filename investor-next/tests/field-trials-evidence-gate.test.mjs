import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFieldTrialsCsv, EXPECTED_HEADERS } from '../scripts/validate-field-trials.mjs';

const header = EXPECTED_HEADERS.join(',');
function row(id, override = {}) {
  const data = {
    trial_id: id, started_at_utc: '2026-10-22T10:00:00Z', ended_at_utc: '2026-10-22T10:00:02Z',
    sender_phone_model: 'Pixel 7a', receiver_phone_model: 'Galaxy A54',
    sender_android_version: '14', receiver_android_version: '14',
    google_play_services_versions: '19.5.1', manual_radio_states: 'BT_ON_WIFI_ON',
    permissions_granted_both: 'true', consent_confirmed_both: 'true',
    auth_digits_verified_both: 'true', airplane_mode_state: 'true',
    internet_connectivity_confirmed_absent: 'true', endpoint_discovery_success: 'true',
    nearby_connection_success: 'true', transfer_accepted: 'true',
    receiver_payload_received: 'true', application_ack_returned: 'true',
    ack_before_ttl: 'true', round_trip_ms: '1250', send_failure_reason: 'NONE',
    radio_environment_notes: 'Indoor corridor 5m', battery_percent_before_a: '80',
    battery_percent_after_a: '79', battery_percent_before_b: '85',
    battery_percent_after_b: '84', tester_signature_or_pseudonym: 'operator-a',
    observations: 'self-reported trial', ...override
  };
  return EXPECTED_HEADERS.map(k => data[k]).join(',');
}
const csv = rows => [header, ...rows].join('\n');

test('plausible CSV never certifies independent physical evidence', () => {
  const result = analyzeFieldTrialsCsv(csv(Array.from({length: 30}, (_, i) => row(`TRIAL-${i + 1}`))));
  assert.equal(result.totalTrials, 30);
  assert.equal(result.validAckSuccesses, 30);
  assert.equal(result.dataReadyForReview, true);
  assert.equal(result.status, 'FIELD_DATA_REVIEW_REQUIRED');
  assert.equal(result.gatePassed, false);
  assert.equal(result.physicalEvidenceVerified, false);
  assert.equal(result.independentReviewVerified, false);
});
test('rejects repeated trial identifiers', () => {
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1'), row('T1')])), /duplicates trial_id/);
});
test('rejects contradictory ACK and RTT', () => {
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {application_ack_returned: 'false', ack_before_ttl: 'true', round_trip_ms: '0'})])), /without an ACK/);
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {receiver_payload_received: 'false'})])), /without receiver delivery/);
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {round_trip_ms: '65000'})])), /RTT\/TTL/);
});
test('rejects missing provenance, invalid boolean, and reversed timestamps', () => {
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {sender_phone_model: ''})])), /missing sender_phone_model/);
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {permissions_granted_both: 'unknown'})])), /invalid boolean/);
  assert.throws(() => analyzeFieldTrialsCsv(csv([row('T1', {ended_at_utc: '2026-10-22T09:00:00Z'})])), /invalid UTC/);
});
test('empty data stays pending', () => {
  const result = analyzeFieldTrialsCsv(header);
  assert.equal(result.status, 'PHYSICAL_TEST_PENDING');
  assert.equal(result.gatePassed, false);
  assert.equal(result.dataReadyForReview, false);
});
