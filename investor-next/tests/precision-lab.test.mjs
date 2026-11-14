import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  LEDGER_VERSION,
  PRECISION_PROVENANCE,
  betaBinomialUpdate,
  betaPdf,
  betaQuantile,
  binomialCcdf,
  binomialPmf,
  canonicalPriors,
  canonicalize,
  dtnDelivery,
  emptyLedger,
  erasureDelivery,
  exportLedger,
  logBeta,
  poissonBinomialCcdf,
  recommendBearer,
  recordObservation,
  regularizedIncompleteBeta,
  rssiRanging,
  seirRK45,
  summarizePosteriors,
  tallyLedger,
  verifyPriorsIntegrity,
} from '../lib/precision-lab.mjs';

const priorsUrl = new URL('../public/data/inference-priors.v1.json', import.meta.url);
const priors = JSON.parse(await readFile(priorsUrl, 'utf8'));

test('gamma/beta primitives match closed-form values', () => {
  assert.ok(Math.abs(logBeta(2, 2) - Math.log(1 / 6)) < 1e-12);
  assert.ok(Math.abs(regularizedIncompleteBeta(0.5, 2, 2) - 0.5) < 1e-12);
  assert.ok(Math.abs(betaPdf(0.5, 2, 2) - 1.5) < 1e-12);
  assert.ok(Math.abs(betaQuantile(0.5, 2, 2) - 0.5) < 1e-9);
  const lo = betaQuantile(0.025, 2, 2);
  const hi = betaQuantile(0.975, 2, 2);
  assert.ok(Math.abs(lo - (1 - hi)) < 1e-9, 'Beta(2,2) is symmetric');
  assert.ok(lo > 0.09 && lo < 0.1);
});

test('Beta-Binomial posterior is conjugate and calibrated', () => {
  const posterior = betaBinomialUpdate({ alpha: 1, beta: 1 }, 7, 3);
  assert.equal(posterior.alpha, 8);
  assert.equal(posterior.beta, 4);
  assert.ok(Math.abs(posterior.mean - 2 / 3) < 1e-12);
  assert.ok(Math.abs(posterior.predictive - posterior.mean) < 1e-15);
  assert.equal(posterior.observations, 10);
  assert.equal(posterior.provenance, PRECISION_PROVENANCE);
  assert.ok(posterior.ci95[0] < posterior.median && posterior.median < posterior.ci95[1]);
  assert.throws(() => betaBinomialUpdate({ alpha: 0, beta: 1 }, 1, 0), /prior/);
  assert.throws(() => betaBinomialUpdate({ alpha: 1, beta: 1 }, 1.5, 0), /entero/);
});

test('binomial pmf/ccdf are exact on known cases', () => {
  assert.ok(Math.abs(binomialPmf(2, 3, 0.5) - 0.375) < 1e-12);
  assert.ok(Math.abs(binomialCcdf(2, 3, 0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(binomialCcdf(9, 10, 0.9) - 0.7360989291) < 1e-8);
  assert.equal(binomialCcdf(0, 10, 0.3), 1);
  assert.equal(binomialCcdf(11, 10, 0.3), 0);
  let total = 0;
  for (let k = 0; k <= 20; k += 1) total += binomialPmf(k, 20, 0.37);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test('Poisson-binomial DP collapses to binomial for equal probabilities', () => {
  for (const [n, k, p] of [[9, 5, 0.35], [12, 8, 0.6], [24, 18, 0.75]]) {
    const dp = poissonBinomialCcdf(new Array(n).fill(p), k);
    const closed = binomialCcdf(k, n, p);
    assert.ok(Math.abs(dp - closed) < 1e-10, `n=${n} k=${k} p=${p}: ${dp} vs ${closed}`);
  }
});

test('erasure k-of-n delivery is exact, bounded and improves with parity', () => {
  const base = erasureDelivery({ k: 8, n: 12, perShard: 0.6 });
  assert.ok(Math.abs(base.probability - binomialCcdf(8, 12, 0.6)) < 1e-12);
  assert.ok(base.probability > 0 && base.probability < 1);
  assert.ok(Math.abs(base.overhead - 1.5) < 1e-12);
  const more = erasureDelivery({ k: 8, n: 16, perShard: 0.6 });
  assert.ok(more.probability > base.probability);
  const varied = erasureDelivery({ k: 4, n: 6, perShard: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] });
  assert.ok(Math.abs(varied.probability - poissonBinomialCcdf([0.9, 0.8, 0.7, 0.6, 0.5, 0.4], 4)) < 1e-12);
  assert.throws(() => erasureDelivery({ k: 13, n: 12, perShard: 0.5 }), /k ≤ n/);
  assert.throws(() => erasureDelivery({ k: 8, n: 12, perShard: 1.2 }), /\[0,1\]/);
});

test('DTN exponential first-contact model matches its quantiles', () => {
  const run = dtnDelivery({ contactRatePerHour: 0.2, copies: 3, horizonHours: 10 });
  assert.ok(Math.abs(run.ratePerHour - 0.6) < 1e-12);
  assert.ok(Math.abs(run.expectedDelayHours - 1 / 0.6) < 1e-12);
  assert.ok(Math.abs(run.p50 - Math.log(2) / 0.6) < 1e-12);
  assert.ok(Math.abs(run.probability - (1 - Math.exp(-6))) < 1e-12);
  assert.equal(dtnDelivery({ contactRatePerHour: 0.2, copies: 3, horizonHours: 0 }).probability, 0);
  assert.ok(dtnDelivery({ contactRatePerHour: 0.2, copies: 3, horizonHours: 1000 }).probability > 1 - 1e-12);
  assert.throws(() => dtnDelivery({ contactRatePerHour: 0, copies: 3, horizonHours: 1 }), /contactRate/);
});

test('RSSI ranging inverts log-distance loss and exposes the Cramer-Rao bound', () => {
  const run = rssiRanging({ txPowerDbm: 0, rssiDbm: -70, pathLossExponent: 3, sigmaDb: 6 });
  assert.ok(Math.abs(run.distanceM - 10) < 1e-9);
  assert.ok(Math.abs(run.pathLossDb - 70) < 1e-12);
  const expectedSigma = (Math.LN10 * 6 * 10) / (10 * 3);
  assert.ok(Math.abs(run.sigmaM - expectedSigma) < 1e-9);
  assert.ok(Math.abs(run.relativeSigma - expectedSigma / 10) < 1e-12);
  assert.equal(rssiRanging({ txPowerDbm: 0, rssiDbm: -70, pathLossExponent: 3, sigmaDb: 0 }).sigmaM, 0);
  const closer = rssiRanging({ txPowerDbm: 0, rssiDbm: -60, pathLossExponent: 3, sigmaDb: 6 });
  assert.ok(closer.distanceM < run.distanceM);
});

test('SEIR RK45 preserves mass, respects R0 and handles the no-transmission edge', () => {
  const run = seirRK45({
    population: 1000, contactsPerDay: 8, beta: 0.15, latencyDays: 3, infectiousDays: 5, days: 90,
  });
  assert.equal(run.series.length, 91);
  assert.equal(run.series[0].day, 0);
  assert.equal(run.series[90].day, 90);
  assert.ok(Math.abs(run.r0 - 6) < 1e-12);
  assert.ok(run.maxConservationError < 1e-6);
  assert.ok(run.peakInfectious > 0);
  assert.ok(run.attackRate > 0 && run.attackRate <= 1);
  assert.ok(run.steps > 10);
  let previous = -1;
  for (const point of run.series) {
    const sum = point.susceptible + point.exposed + point.infectious + point.recovered;
    assert.ok(Math.abs(sum - 1000) < 1e-6);
    assert.ok(point.cumulative >= previous - 1e-9);
    previous = point.cumulative;
  }
  const silent = seirRK45({
    population: 500, contactsPerDay: 8, beta: 0, latencyDays: 3, infectiousDays: 5, days: 20,
  });
  assert.equal(silent.r0, 0);
  assert.ok(silent.series.every((p) => Math.abs(p.susceptible - (500 - 1)) < 1e-9));
  assert.ok(Math.abs(silent.series[0].infectious - 1) < 1e-9);
  assert.ok(silent.series[20].infectious < 0.02, 'infectious decays without transmission');
  assert.throws(() => seirRK45({ population: 10, contactsPerDay: 8, beta: 2, latencyDays: 3, infectiousDays: 5, days: 10 }), /beta/);
});

test('ledger records observations immutably and summarizes posteriors', () => {
  const empty = emptyLedger();
  assert.deepEqual(empty, { version: LEDGER_VERSION, observations: [] });
  const once = recordObservation(empty, { bearer: 'PHONE_MESH', successes: 4, failures: 1, at: '2026-11-07T10:00:00.000Z' });
  assert.equal(empty.observations.length, 0);
  assert.equal(once.observations.length, 1);
  const twice = recordObservation(once, { bearer: 'PHONE_MESH', successes: 2, failures: 0, at: '2026-11-07T11:00:00.000Z' });
  const tally = tallyLedger(twice);
  assert.deepEqual(tally.PHONE_MESH, { successes: 6, failures: 1, observations: 2 });
  const summaries = summarizePosteriors(priors, twice);
  const phone = summaries.find((row) => row.id === 'PHONE_MESH');
  assert.ok(phone);
  assert.equal(phone.posterior.alpha, priors.bearers.PHONE_MESH.successAlpha + 6);
  assert.equal(phone.posterior.beta, priors.bearers.PHONE_MESH.successBeta + 1);
  const exact = summaries.find((row) => row.id === 'IRIDIUM_SBD');
  assert.equal(exact.successes, 0);
  assert.ok(Math.abs(exact.posterior.mean - 0.9) < 1e-12);
  const exported = JSON.parse(exportLedger(twice));
  assert.equal(exported.version, LEDGER_VERSION);
  assert.equal(exported.observations.length, 2);
  assert.throws(() => recordObservation(empty, { bearer: 'X', successes: 0, failures: 0 }), /vacía/);
});

test('Thompson recommendation is deterministic under a supplied generator', () => {
  const rows = [
    { id: 'LOW', posterior: { alpha: 2, beta: 3 } },
    { id: 'HIGH', posterior: { alpha: 90, beta: 10 } },
  ];
  assert.equal(recommendBearer(rows, () => 0.5).id, 'HIGH', 'median of the stronger posterior wins');
  const tie = [
    { id: 'A', posterior: { alpha: 5, beta: 5 } },
    { id: 'B', posterior: { alpha: 5, beta: 5 } },
  ];
  const first = recommendBearer(tie, () => 0.42);
  const second = recommendBearer(tie, () => 0.42);
  assert.deepEqual(first, second);
  assert.ok(first.id === 'A' || first.id === 'B');
});

test('canonicalization is key-order independent and priors seal verifies', async () => {
  assert.equal(canonicalize({ b: 1, a: [ { z: true, y: null } ] }), '{"a":[{"y":null,"z":true}],"b":1}');
  const expected = createHash('sha256').update(canonicalPriors(priors), 'utf8').digest('hex');
  assert.equal(priors.integrity.digest, expected);
  const check = await verifyPriorsIntegrity(priors);
  assert.equal(check.ok, true);
  assert.equal(check.expected, expected);
  const tampered = { ...priors, dtn: { ...priors.dtn, copies: priors.dtn.copies + 1 } };
  const failed = await verifyPriorsIntegrity(tampered);
  assert.equal(failed.ok, false);
});

test('shipped priors declare every bearer and stay in physical range', () => {
  assert.equal(priors.schema, 'senda-inference-priors/1');
  assert.equal(priors.provenance, 'EXERCISE_RANGE_PRIORS');
  const ids = Object.keys(priors.bearers);
  assert.ok(ids.length >= 8);
  for (const id of ids) {
    const bearer = priors.bearers[id];
    assert.ok(bearer.successAlpha > 0, id);
    assert.ok(bearer.successBeta > 0, id);
    assert.ok(bearer.latencyS > 0, id);
    assert.ok(bearer.successAlpha / (bearer.successAlpha + bearer.successBeta) > 0.4, id);
  }
  assert.ok(priors.erasure.k <= priors.erasure.n);
  assert.ok(priors.ranging.pathLossExponent > 2 && priors.ranging.pathLossExponent < 4);
  assert.ok(priors.epidemic.beta > 0 && priors.epidemic.beta < 1);
});
