import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAB_PROVENANCE,
  alertPropagation,
  coverageEntropy,
  deliveryMonteCarlo,
  deliveryProbabilityClosedForm,
  energyBudget,
  functionScorecard,
  kalmanFilter1D,
  makeDemoGraph,
  mulberry32,
  paretoRoutes,
} from '../lib/function-lab.mjs';

test('mulberry32 is deterministic for a given seed and bounded in [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i += 1) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('alert propagation is bounded, monotone in cumulative and reproducible', () => {
  const run = alertPropagation({ population: 200, contacts: 6, beta: 0.25, gamma: 0.3, steps: 40, seed: 5 });
  assert.equal(run.provenance, LAB_PROVENANCE);
  assert.ok(run.r0 > 1, 'R0 should exceed 1 for a spreading scenario');
  assert.ok(run.peakInformed > 0 && run.peakInformed <= 200);

  let previousCumulative = -1;
  for (const point of run.series) {
    assert.ok(point.susceptible >= 0 && point.informed >= 0 && point.recovered >= 0);
    assert.ok(point.susceptible + point.informed + point.recovered <= 200 + 1e-6);
    assert.ok(point.cumulativeInformed >= previousCumulative - 1e-6, 'cumulative must not decrease');
    previousCumulative = point.cumulativeInformed;
  }

  const again = alertPropagation({ population: 200, contacts: 6, beta: 0.25, gamma: 0.3, steps: 40, seed: 5 });
  assert.deepEqual(again.series, run.series);
});

test('alert propagation validates input', () => {
  assert.throws(() => alertPropagation({ population: 0, contacts: 1, beta: 0.1, gamma: 0.2, steps: 5 }), /population/);
  assert.throws(() => alertPropagation({ population: 10, contacts: 1, beta: 2, gamma: 0.2, steps: 5 }), /beta/);
  assert.throws(() => alertPropagation({ population: 10, contacts: 1, beta: 0.1, gamma: 0, steps: 5 }), /gamma/);
});

test('Pareto routing returns only non-dominated paths', () => {
  const frontier = paretoRoutes(makeDemoGraph(), 'ORIGIN', 'RELAY');
  assert.ok(frontier.length >= 1);
  for (const route of frontier) {
    assert.equal(route.path[0], 'ORIGIN');
    assert.equal(route.path[route.path.length - 1], 'RELAY');
    for (const other of frontier) {
      if (other === route) continue;
      const dominates =
        other.energy <= route.energy && other.latencyMs <= route.latencyMs &&
        (other.energy < route.energy || other.latencyMs < route.latencyMs);
      assert.ok(!dominates, 'frontier must not contain dominated paths');
    }
  }
  // The fastest route should be the Wi-Fi chain, the cheapest the BLE chain.
  const cheapest = frontier[0];
  const fastest = [...frontier].sort((a, b) => a.latencyMs - b.latencyMs)[0];
  assert.ok(cheapest.energy <= fastest.energy);
  assert.ok(fastest.latencyMs <= cheapest.latencyMs);
});

test('Pareto routing handling of bad graph input', () => {
  assert.throws(() => paretoRoutes(null, 'A', 'B'), /graph/);
  assert.throws(() => paretoRoutes(makeDemoGraph(), 'GHOST', 'RELAY'), /unknown node/);
});

test('delivery probability matches closed form within Monte Carlo tolerance', () => {
  const p = deliveryMonteCarlo({ perAttempt: 0.3, attempts: 6, trials: 40000, seed: 11 });
  const closed = deliveryProbabilityClosedForm({ perAttempt: 0.3, attempts: 6 });
  assert.ok(Math.abs(p.closedForm - closed) < 1e-12);
  assert.ok(Math.abs(p.probability - closed) < 4 * p.stdErr + 0.01, `MC ${p.probability} vs ${closed}`);
  assert.ok(p.ci95[0] <= closed && closed <= p.ci95[1]);
  assert.ok(Math.abs(p.meanAttempts - p.expectedAttemptsClosedForm) < 0.5);
});

test('delivery probability is monotone in attempts and validates input', () => {
  const one = deliveryProbabilityClosedForm({ perAttempt: 0.2, attempts: 1 });
  const five = deliveryProbabilityClosedForm({ perAttempt: 0.2, attempts: 5 });
  assert.ok(five > one);
  assert.ok(five < 1);
  assert.throws(() => deliveryProbabilityClosedForm({ perAttempt: 0, attempts: 3 }), /perAttempt/);
  assert.throws(() => deliveryProbabilityClosedForm({ perAttempt: 0.5, attempts: 0 }), /attempts/);
});

test('coverage rises with sensors and reduces blind search space monotonically', () => {
  const few = coverageEntropy({ sensorCount: 2, halfAngleDeg: 30, rangeKm: 3, fieldRadiusKm: 10 });
  const many = coverageEntropy({ sensorCount: 20, halfAngleDeg: 30, rangeKm: 3, fieldRadiusKm: 10 });
  assert.ok(many.coveredFraction > few.coveredFraction);
  assert.ok(many.blindFraction < few.blindFraction);
  assert.ok(many.searchSpaceReductionBits > few.searchSpaceReductionBits);
  assert.ok(few.searchSpaceReductionBits >= 0);
  assert.ok(Math.abs(many.coveredFraction + many.blindFraction - 1) < 1e-12);
  assert.throws(() => coverageEntropy({ sensorCount: 0, halfAngleDeg: 30, rangeKm: 3, fieldRadiusKm: 10 }), /sensorCount/);
});

test('energy budget reports duty cycle and runtime consistently', () => {
  const result = energyBudget({
    batteryWh: 20, txSeconds: 3, txPowerW: 2, sleepPowerW: 0.02, intervalS: 60, targetHours: 24,
  });
  assert.ok(Math.abs(result.dutyCycle - 0.05) < 1e-12);
  assert.ok(result.avgPowerW > 0.02 && result.avgPowerW < 2);
  assert.ok(result.runtimeHours > 24, 'should outlast the target at this duty cycle');
  assert.ok(result.targetMet);
  assert.ok(result.messages > 0);
});

test('energy budget fails closed on invalid duty cycle', () => {
  assert.throws(() => energyBudget({ batteryWh: 20, txSeconds: 90, txPowerW: 2, sleepPowerW: 0.02, intervalS: 60, targetHours: 24 }), /txSeconds/);
  assert.throws(() => energyBudget({ batteryWh: 0, txSeconds: 3, txPowerW: 2, sleepPowerW: 0.02, intervalS: 60, targetHours: 24 }), /batteryWh/);
});

test('Kalman filter smooths noise and tracks a constant-velocity target', () => {
  // True trajectory: position starts at 0, moves +2 per step. Measurements noisy.
  const truth = Array.from({ length: 30 }, (_, i) => i * 2);
  const noise = [[0.4], [-0.7], [0.2], [0.9], [-0.3], [0.1], [-0.5], [0.6], [-0.1], [0.3],
    [0.2], [-0.4], [0.5], [-0.2], [0.1], [0.7], [-0.6], [0.3], [-0.1], [0.4],
    [0.2], [-0.3], [0.5], [-0.4], [0.1], [0.6], [-0.2], [0.3], [-0.5], [0.2]];
  const measurements = truth.map((value, i) => value + noise[i][0]);
  const result = kalmanFilter1D({ points: measurements, q: 1, r: 4, start: 0, startVelocity: 0 });

  const meanAbs = (arr) => arr.reduce((sum, v) => sum + Math.abs(v), 0) / arr.length;
  const rawError = meanAbs(measurements.map((z, i) => z - truth[i]));
  const filteredError = meanAbs(result.trace.map((t, i) => t.estimate - truth[i]));
  assert.ok(filteredError < rawError, `filter ${filteredError} should beat raw ${rawError}`);
  assert.ok(Math.abs(result.finalVelocity - 2) < 0.6, `velocity ${result.finalVelocity} should approach 2`);
});

test('Kalman filter validates input', () => {
  assert.throws(() => kalmanFilter1D({ points: [], q: 0.1, r: 1 }), /points/);
  assert.throws(() => kalmanFilter1D({ points: [1, 2], q: -1, r: 1 }), /q/);
  assert.throws(() => kalmanFilter1D({ points: [1, 2], q: 0.1, r: 0 }), /r/);
});

test('scorecard marks unimplemented pillars honestly', () => {
  const scorecard = functionScorecard();
  assert.ok(scorecard.length >= 7);
  const radio = scorecard.find((row) => row.id === 'radio');
  assert.equal(radio.status, 'NO_IMPLEMENTADO');
  assert.equal(radio.tested, false);
  assert.ok(scorecard.some((row) => row.status === 'REAL_EN_NAVEGADOR'));
});
