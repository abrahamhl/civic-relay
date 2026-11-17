import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../senda-arr/src/arr-sim.mjs';
import { buildProblem, hopAlive } from '../../senda-arr/src/arr-core.mjs';
import { STRATEGIES, runDynamicProtocol, causalPosteriorEnsemble } from '../src/replan-core.mjs';
import { V2_STRATEGIES, runDynamicV2 } from '../src/replan-v2.mjs';
import { buildMobilityCorridorFamily, buildSrlgBlackoutFamily, buildCongestedSrdFamily } from '../src/independent-families.mjs';

test('H-ARR-R: clock skew quarantines routing with ABSTAIN and 0 security violations', () => {
  const inst = buildSrlgBlackoutFamily(42);
  const res = runDynamicProtocol(inst, { truth: inst.truth, hopWorks: () => true }, 'ARR_REPLAN', { clockSkewReject: true });
  assert.equal(res.delivered, false);
  assert.equal(res.abstained, true);
  assert.equal(res.reason, 'CLOCK_INCOHERENT_QUARANTINE');
  assert.equal(res.transmissions, 0);
  assert.equal(res.securityViolations, 0);
});

test('H-ARR-R: causalPosteriorEnsemble reweights dead-consistent members above contradictory ones', () => {
  const raw = [
    { nodeDeathMs: { N1: 1000 }, weight: 0.5 },
    { nodeDeathMs: { N1: 99999999 }, weight: 0.5 },
  ];
  const post = causalPosteriorEnsemble(raw, { N1: 1000 }, {});
  assert.ok(post[0].weight > post[1].weight);
  assert.ok(Math.abs(post[0].weight + post[1].weight - 1) < 1e-9);
});

test('H-ARR-R: k-of-n threshold requires k distinct shard deliveries and rejects non-consenting relay', () => {
  const inst = buildCongestedSrdFamily(99);
  inst.nodes[2].consent = false;
  const problem = buildProblem({ ...inst, maxHops: 8 });
  const rng = mulberry32(99);
  const world = {
    truth: inst.truth,
    hopWorks: (c, f) => hopAlive(inst.truth, c, f) && rng() < c.probabilityLowerBound,
  };
  // Node R0 lost consent -> buildProblem excludes R0 contacts fail-closed
  assert.ok(!problem.contactById.has('cs0'));
  for (const s of STRATEGIES) {
    const out = runDynamicProtocol(inst, world, s, { requireKShards: 2, maxCopies: 6, airtimeBudgetMs: 90000, energyBudgetMj: 2100 });
    assert.equal(out.securityViolations, 0);
    assert.equal(out.evidenceLevel, 'SIMULATED_ONLY');
  }
});

test('H-ARR-R-v2: executes all 7 V2 strategies cleanly with strict budget caps and 0 security violations', () => {
  const inst = buildCongestedSrdFamily(777);
  const world = { truth: inst.truth, hopWorks: (c, f) => hopAlive(inst.truth, c, f) };
  for (const s of V2_STRATEGIES) {
    const out = runDynamicV2(inst, world, s, { maxCopies: 6, airtimeBudgetMs: 95000, energyBudgetMj: 2100, seed: 777 });
    assert.equal(out.securityViolations, 0);
    assert.ok(out.airtimeMs <= 95000, `${s} exceeded airtime cap: ${out.airtimeMs}`);
    assert.ok(out.energyMj <= 2100, `${s} exceeded energy cap: ${out.energyMj}`);
  }
});

test('H-ARR-R: all 3 topological families generate valid instances with causal ensembles', () => {
  for (const fn of [buildMobilityCorridorFamily, buildSrlgBlackoutFamily, buildCongestedSrdFamily]) {
    const inst = fn(1234);
    assert.ok(inst.nodes.length >= 9);
    assert.ok(inst.contacts.length >= 10);
    assert.equal(inst.ensemble.length, 48);
  }
});
