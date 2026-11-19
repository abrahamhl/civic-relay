import test from 'node:test';
import assert from 'node:assert/strict';
import { planAdaptiveResilience, buildProblem, contactRejection } from '../src/arr-core.mjs';

const n = (id, role = 'RELAY', o = {}) => ({ id, role, consent: true, powered: true, radioEnabled: true, ...o });
let seq = 0;
const c = (from, to, o = {}) => ({
  id: `a${seq++}`, from, to, startMs: 0, endMs: 60000, probabilityLowerBound: 0.9, rateBytesPerSec: 1000, handshakeMs: 100, energyMj: 30,
  kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true, ...o,
});
const run = (nodes, contacts, o = {}) => planAdaptiveResilience({ nodes, contacts, source: 'S', destination: 'T', startMs: 0, deadlineMs: 60000, payloadBytes: 100, ...o });
const ends = [n('S', 'SENDER'), n('T', 'RECEIVER')];

test('nothing that is not an authorised active radio between consenting live nodes can become a hop', () => {
  const cases = {
    NOT_ACTIVE_RADIO: { kind: 'PASSIVE_REFLECTION' }, NOT_AUTHORIZED: { authorized: 'true' }, DISABLED: { enabled: false },
    DUTY_CYCLE: { dutyCycleAllowed: undefined }, INVALID_WINDOW: { endMs: 0 }, INVALID_RATE: { rateBytesPerSec: 0 },
    INVALID_ENERGY: { energyMj: -1 }, INVALID_PROBABILITY: { probabilityLowerBound: 1.2 },
  };
  for (const [reason, override] of Object.entries(cases)) {
    const r = run(ends, [c('S', 'T', override)]);
    assert.equal(r.modelFeasible, false, reason);
    assert.equal(r.rejectedContacts[reason], 1, reason);
    assert.equal(r.predicted.ensembleProbability, 0);
  }
  for (const bad of [{ consent: false }, { powered: false }, { radioEnabled: false }, { role: 'OBSERVED_DEVICE' }, { role: 'relay' }]) {
    const r = run([...ends, n('X', 'RELAY', bad)], [c('S', 'X'), c('X', 'T')]);
    assert.equal(r.modelFeasible, false);
    assert.equal(r.rejectedContacts.NODE_NOT_ELIGIBLE, 2);
  }
  // a third-party device that is merely seen on the air is not in `nodes`: it can never appear in a path
  assert.equal(run(ends, [c('S', 'GHOST'), c('GHOST', 'T')]).rejectedContacts.UNKNOWN_ENDPOINT, 2);
  assert.equal(run([n('S', 'SENDER', { consent: false }), ends[1]], [c('S', 'T')]).reason, 'ENDPOINTS_NOT_ELIGIBLE_OR_SAME');
});

test('malformed or hostile configuration throws instead of producing a plan', () => {
  const ok = [c('S', 'T')];
  assert.throws(() => run([...ends, n('S')], ok), /node/i);
  assert.throws(() => run(ends, [ok[0], { ...ok[0] }]), /Duplicate contact/);
  for (const o of [{ deadlineMs: 0 }, { payloadBytes: 0 }, { payloadBytes: 1e9 }, { maxHops: 99 }, { startMs: -1 }, { source: 5 }]) assert.throws(() => run(ends, ok, o), TypeError);
  for (const o of [{ maxReplicas: 7 }, { maxReplicas: 0 }, { minProbability: 2 }, { objective: 'trust-me' }, { cvarAlpha: 0 }, { maxEnergyMj: -5 }, { confidenceDelta: 1 }])
    assert.throws(() => run(ends, ok, o), TypeError);
  for (const ensemble of [[{ weight: -1 }], [{ weight: NaN }], [{ contactFactor: { [ok[0].id]: 1.5 } }], Array.from({ length: 5000 }, () => ({}))])
    assert.throws(() => run(ends, ok, { ensemble }), TypeError);
  assert.equal(contactRejection(null, new Map()), 'INVALID_ID');
  assert.throws(() => buildProblem({}), TypeError);
});

test('fail closed: required probability, energy budget, deadline, dead scenarios', () => {
  const nodes = [...ends, n('A')], contacts = [c('S', 'A'), c('A', 'T')];
  assert.equal(run(nodes, contacts, { minProbability: 0.9 }).reason, 'BELOW_REQUIRED_PROBABILITY_FAIL_CLOSED');
  assert.equal(run(nodes, contacts, { minProbability: 0.8 }).modelFeasible, true);
  assert.equal(run(nodes, contacts, { maxEnergyMj: 59 }).reason, 'NO_ROUTE_WITHIN_ENERGY_OR_ZERO_PROBABILITY');
  assert.equal(run(nodes, contacts, { deadlineMs: 300 }).reason, 'NO_AUTHORIZED_TEMPORAL_ROUTE_BEFORE_DEADLINE');
  const allDead = run(nodes, contacts, { ensemble: [{ nodeDeathMs: { A: 0 } }, { nodeDeathMs: { A: 50 } }] });
  assert.equal(allDead.modelFeasible, false);
  // a forecast that is certain cannot manufacture certainty about the world: bounds stay below the estimate
  const sure = run(ends, [c('S', 'T', { probabilityLowerBound: 1 })], { ensemble: [{}] });
  assert.equal(sure.predicted.ensembleProbability, 1);
  assert.ok(sure.predicted.contaminationLowerBound < 0.9 && sure.physicalDeliveryVerified === false);
});

test('results are immutable and the planner does not mutate its inputs', () => {
  const nodes = [...ends, n('A')], contacts = [c('S', 'A'), c('A', 'T')];
  const snapshot = JSON.stringify({ nodes, contacts });
  const r = run(nodes, contacts);
  assert.equal(JSON.stringify({ nodes, contacts }), snapshot);
  assert.throws(() => { 'use strict'; r.physicalDeliveryVerified = true; }, TypeError);
  assert.throws(() => { 'use strict'; r.routes[0].path.push('X'); }, TypeError);
  assert.throws(() => { 'use strict'; r.predicted.ensembleProbability = 1; }, TypeError);
});

test('bounded work: a dense adversarial graph cannot make the planner run away', () => {
  const nodes = [...ends, ...Array.from({ length: 60 }, (_, i) => n(`R${i}`))], contacts = [];
  for (const a of nodes) for (const b of nodes) if (a !== b && a.id !== 'T' && b.id !== 'S') contacts.push(c(a.id, b.id));
  const t = Date.now();
  const r = run(nodes, contacts, { maxReplicas: 4, ensemble: Array.from({ length: 64 }, (_, i) => ({ nodeDeathMs: { [`R${i % 60}`]: 0 } })) });
  assert.ok(r.modelFeasible && r.candidatesExamined <= 48);
  assert.ok(Date.now() - t < 20000);
});
