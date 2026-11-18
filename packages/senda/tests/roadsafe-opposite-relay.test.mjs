import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOppositeRelay, simulateOppositeRelay } from '../src/roadsafe-opposite-relay.mjs';
const example = () => ({
  distanceToHazardM: 3000, approachingSpeedMps: 25, oppositeSpeedMps: 25,
  oppositeFlowVehPerHour: 900, relayParticipation: 0.1,
  sourceReceiveP: 0.5, targetReceiveP: 0.4,
  roadSeparationM: 8, effectiveRadioRangeM: 40, minLeadTimeS: 20,
  eventTtlS: 180, analysisHorizonS: 180,
  sourceHasRelay: true, targetHasRelay: true, crossCarriagewayReachable: true,
});
test('unknown and invalid radio assumptions do not produce a probability', () => {
  assert.equal(evaluateOppositeRelay({}).status, 'INSUFFICIENT_INPUT');
  assert.equal(evaluateOppositeRelay({}).probability, null);
  assert.equal(evaluateOppositeRelay({ ...example(), sourceReceiveP: 1.2 }).status, 'INVALID_INPUT');
  assert.equal(evaluateOppositeRelay({ ...example(), approachingSpeedMps: 0 }).status, 'INVALID_INPUT');
  assert.equal(evaluateOppositeRelay({ ...example(), roadSeparationM: NaN }).status, 'INVALID_INPUT');
});
test('meeting uses closing speeds and actionable warning lead', () => {
  const a = evaluateOppositeRelay(example());
  assert.equal(a.status, 'HYPOTHETICAL');
  assert.equal(a.hazardArrivalS, 120);
  assert.equal(a.earliestMeetS, 60);
  assert.equal(a.deadlineS, 100);
  assert.equal(a.latestPickupS, 80);
  assert.ok(a.probability > 0 && a.probability < 1);
  assert.equal(a.canWarnDrivers, false);
  assert.equal(a.fieldValidated, false);
});
test('minimum useful lead cuts probability; no magical straight-line BLE across median', () => {
  const p = example();
  assert.equal(evaluateOppositeRelay({ ...p, minLeadTimeS: 61 }).probability, 0);
  assert.equal(evaluateOppositeRelay({ ...p, crossCarriagewayReachable: false }).probability, 0);
  assert.equal(evaluateOppositeRelay({ ...p, roadSeparationM: 45 }).probability, 0);
  assert.equal(evaluateOppositeRelay({ ...p, targetHasRelay: false }).probability, 0);
});
test('increasing adoption/flow improves hypothetical probability; less time reduces it', () => {
  const p = example();
  const baseline = evaluateOppositeRelay(p).probability;
  assert.ok(evaluateOppositeRelay({ ...p, relayParticipation: 0.4 }).probability > baseline);
  assert.ok(evaluateOppositeRelay({ ...p, oppositeFlowVehPerHour: 1800 }).probability > baseline);
  assert.ok(evaluateOppositeRelay({ ...p, analysisHorizonS: 65 }).probability < baseline);
});
test('Monte Carlo seeded, reproducible and consistent with Poisson analytical estimate', () => {
  const p = example();
  const a = simulateOppositeRelay(p, { trials: 12000, seed: 12345 });
  const b = simulateOppositeRelay(p, { trials: 12000, seed: 12345 });
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.simulatedRate - a.probability) < 0.03);
  assert.ok(a.monteCarlo95[0] <= a.simulatedRate && a.simulatedRate <= a.monteCarlo95[1]);
  assert.match(a.intervalMeaning, /Monte Carlo/);
});
test('no participation -> zero delivery; no receiver acknowledgement is invented', () => {
  const a = simulateOppositeRelay({ ...example(), relayParticipation: 0 });
  assert.equal(a.probability, 0);
  assert.equal(a.simulatedRate, 0);
  assert.equal(a.canDispatch, false);
  assert.ok(a.note.includes('not destination receipt'));
});
