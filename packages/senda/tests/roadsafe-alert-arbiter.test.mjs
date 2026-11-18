import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriverAlertArbiter } from '../src/roadsafe-alert-arbiter.mjs';
const hazard = (extra = {}) => ({ incidentKey: 'incident-1', hazardType: 'QUEUE_TAIL', severity: 'HIGH',
  etaS: 25, observedAt: 100, expiresAt: 500, carriagewayMatch: true,
  evidence: 'CORROBORATED', warningApproved: true, ...extra });
const opts = (now) => ({ now, voiceOptIn: true, deploymentApproved: true });
test('duplicate DGT/DATEX/BLE observations of same hazard produce one alert', () => {
  const a = createDriverAlertArbiter();
  const r = a.consider([hazard(), hazard({ observedAt: 101 }), hazard({ observedAt: 102 })], opts(110));
  assert.equal(r.deduplicatedHazards, 1);
  assert.equal(r.uniqueScenes, 1);
  assert.equal(r.screen.length, 1);
  assert.equal(r.voice.hazardType, 'QUEUE_TAIL');
});
test('no unattended audio without consent AND explicit deployment gate', () => {
  const a = createDriverAlertArbiter();
  assert.equal(a.consider([hazard()], { now: 110 }).voice, null);
  assert.equal(a.consider([hazard()], { now: 111, voiceOptIn: true }).voice, null);
  assert.ok(a.consider([hazard()], opts(112)).voice);
});
test('wrong carriageway, simulation, contradiction and expired or future evidence are suppressed', () => {
  const a = createDriverAlertArbiter();
  const r = a.consider([hazard({ carriagewayMatch: false }), hazard({ evidence: 'SIMULATED' }),
    hazard({ evidence: 'DISPUTED' }), hazard({ expiresAt: 90 }), hazard({ observedAt: 200 })], opts(110));
  assert.equal(r.screen.length, 0); assert.equal(r.voice, null);
  assert.equal(r.suppressed.length, 5);
});
test('unverified and unknown carriageway can appear as cautious text but cannot talk', () => {
  const a = createDriverAlertArbiter();
  const r = a.consider([hazard({ evidence: 'UNVERIFIED', carriagewayMatch: null })], opts(110));
  assert.equal(r.screen[0].label, 'CHECK_LOCATION_UNCONFIRMED');
  assert.equal(r.voice, null);
});
test('queue tail arriving first beats a farther crash; avoid overwhelming with repetitions', () => {
  const a = createDriverAlertArbiter();
  const c = [hazard({ incidentKey: 'crash', hazardType: 'ACCIDENT', severity: 'CRITICAL', etaS: 75 }), hazard()];
  assert.equal(a.consider(c, opts(110)).voice.hazardType, 'QUEUE_TAIL');
  assert.equal(a.consider(c, opts(120)).voice.hazardType, 'ACCIDENT');
  assert.equal(a.consider(c, opts(126)).voice, null);
  assert.equal(a.consider(c, opts(127)).voice, null);
});
test('time-to-hazard too short or too long cannot force audio, but stays visible', () => {
  const a = createDriverAlertArbiter();
  const r = a.consider([hazard({ etaS: 2 }), hazard({ incidentKey: 'far', etaS: 200 })], opts(110));
  assert.equal(r.voice, null); assert.equal(r.screen.length, 2);
});
test('clock rewind abstains rather than reopening stale cooldown', () => {
  const a = createDriverAlertArbiter(); a.consider([hazard()], opts(130));
  assert.equal(a.consider([hazard()], opts(120)).status, 'ABSTAIN');
});
test('malicious prototype-like severity and oversized batches fail closed', () => {
  const a = createDriverAlertArbiter();
  const r = a.consider([hazard({ severity: '__proto__' }), hazard({ hazardType: '' })], opts(110));
  assert.equal(r.screen.length, 0);
  assert.equal(r.suppressed.length, 2);
  assert.equal(a.consider(Array.from({ length: 2001 }, () => hazard()), opts(111)).status, 'ABSTAIN');
});
