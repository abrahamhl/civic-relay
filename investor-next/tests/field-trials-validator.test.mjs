import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFieldTrialsCsv, EXPECTED_HEADERS } from '../scripts/validate-field-trials.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('blank field_trials_template.csv reports PHYSICAL_TEST_PENDING without fabricating trials', () => {
  const raw = readFileSync(resolve(root, 'experimental/android-nearby/field_trials_template.csv'), 'utf8');
  const res = analyzeFieldTrialsCsv(raw);
  assert.equal(res.status, 'PHYSICAL_TEST_PENDING');
  assert.equal(res.gatePassed, false);
  assert.equal(res.totalTrials, 0);
  assert.equal(res.validAckSuccesses, 0);
  assert.equal(res.p50RoundTripMs, null);
});

test('validator counts late ACKs after TTL as lateOrInvalidAcks, never as valid successes, and computes p50/p95', () => {
  const header = EXPECTED_HEADERS.join(',');
  const makeRow = (id, ackReturned, beforeTtl, rttMs) => [
    id,
    '2026-10-22T10:00:00Z',
    '2026-10-22T10:00:02Z',
    'Pixel 7a',
    'Galaxy A54',
    '14',
    '14',
    '19.5.1',
    'BT_ON_WIFI_ON',
    'true',
    'true',
    'true',
    'true',
    'true',
    'true',
    'true',
    'true',
    String(ackReturned),
    String(ackReturned),
    String(beforeTtl),
    String(rttMs),
    ackReturned && beforeTtl ? 'NONE' : 'TTL_EXPIRED_OR_DROP',
    'Indoor corridor 5m',
    '80',
    '79',
    '85',
    '84',
    'operator-a',
    'measured run'
  ].join(',');

  const rows = [];
  for (let i = 1; i <= 25; i++) {
    rows.push(makeRow(`TRIAL-${String(i).padStart(2, '0')}`, true, true, i * 100));
  }
  for (let i = 26; i <= 28; i++) {
    // Late receipt arriving after TTL must NOT count as valid success
    rows.push(makeRow(`TRIAL-${String(i).padStart(2, '0')}`, true, false, 65000));
  }
  for (let i = 29; i <= 30; i++) {
    rows.push(makeRow(`TRIAL-${String(i).padStart(2, '0')}`, false, false, 0));
  }

  const summary = analyzeFieldTrialsCsv([header, ...rows].join('\n'));
  assert.equal(summary.status, 'FIELD_CSV_REVIEW_REQUIRED');
  assert.equal(summary.gatePassed, false);
  assert.equal(summary.csvGatePassed, true);
  assert.equal(summary.totalTrials, 30);
  assert.equal(summary.validAckSuccesses, 25);
  assert.equal(summary.lateOrInvalidAcks, 3);
  assert.equal(summary.failedOrNoAckTrials, 2);
  assert.equal(summary.p50RoundTripMs, 1300);
  assert.equal(summary.p95RoundTripMs, 2400);
});

test('validator rejects placeholder/synthetic rows or unconsented rows', () => {
  const header = EXPECTED_HEADERS.join(',');
  const fakeRow = EXPECTED_HEADERS.map((h) => (h === 'trial_id' ? 'SYNTHETIC_1' : 'true')).join(',');
  assert.throws(() => analyzeFieldTrialsCsv(`${header}\n${fakeRow}`), /synthetic\/placeholder/);
});
