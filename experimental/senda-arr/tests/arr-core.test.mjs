import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProblem, earliestArrival, generateCandidates, normalizeEnsemble, unionProbabilityInMember, ensembleReliability,
  independentReliability, lowerTailMean, exhaustiveBest, planAdaptiveResilience, objectiveValue, EVIDENCE_LEVEL,
} from '../src/arr-core.mjs';
import { mulberry32, makeRegionalInstance, planAll } from '../src/arr-sim.mjs';
import { planHypotheticalContacts } from '../../senda-route-truth/research-contact-planner.mjs';
import { assessModelRoute } from '../../senda-route-truth/route-truth.mjs';

const n = (id, role = 'RELAY', o = {}) => ({ id, role, consent: true, powered: true, radioEnabled: true, ...o });
let seq = 0;
const c = (from, to, startMs = 0, endMs = 100000, p = 0.9, o = {}) => ({
  id: `k${seq++}`, from, to, startMs, endMs, probabilityLowerBound: p, rateBytesPerSec: 1000, handshakeMs: 100, energyMj: 30,
  kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true, ...o,
});
const base = (nodes, contacts, o = {}) => ({ nodes, contacts, source: 'S', destination: 'T', startMs: 0, deadlineMs: 100000, payloadBytes: 100, ...o });

/** Two relays in region WEST (A, B) and one in EAST (E). Every route is S → relay → T. */
function twoRegionCase() {
  const nodes = [n('S', 'SENDER'), n('A'), n('B'), n('E'), n('T', 'RECEIVER')];
  const contacts = [c('S', 'A', 0, 1e5, 0.99), c('A', 'T', 0, 1e5, 0.99), c('S', 'B', 0, 1e5, 0.99), c('B', 'T', 0, 1e5, 0.99),
    c('S', 'E', 0, 1e5, 0.6), c('E', 'T', 0, 1e5, 0.6)];
  // Common cause: in 30 % of the scenarios the whole WEST region is lost at once; EAST is lost in 10 %.
  // Marginally each WEST route (≈0.69) looks far better than the EAST route (≈0.32).
  const ensemble = Array.from({ length: 20 }, (_, i) => ({ nodeDeathMs: { ...(i < 6 ? { A: 0, B: 0 } : {}), ...(i % 10 === 0 ? { E: 0 } : {}) } }));
  return { nodes, contacts, ensemble };
}

test('correlated regional loss: ARR diversifies, the independence ablation doubles down on one region', () => {
  const { nodes, contacts, ensemble } = twoRegionCase();
  const arr = planAdaptiveResilience({ ...base(nodes, contacts), ensemble, maxReplicas: 2 });
  const ind = planAdaptiveResilience({ ...base(nodes, contacts), ensemble, maxReplicas: 2, objective: 'independent' });
  const relays = (r) => r.routes.map((x) => x.path[1]).sort().join('');
  assert.equal(relays(arr), 'AE');
  assert.equal(relays(ind), 'AB');
  // independence is miscalibrated in BOTH directions: it over-claims for the same-region pair
  // and under-claims for the diverse pair (it counts a relay's loss once per contact).
  assert.ok(ind.predicted.independenceClaim - ind.predicted.ensembleProbability > 0.02);
  assert.ok(arr.predicted.ensembleProbability - arr.predicted.independenceClaim > 0.1);
  assert.ok(arr.predicted.ensembleProbability > ind.predicted.ensembleProbability + 0.05);
  assert.equal(arr.evidenceLevel, EVIDENCE_LEVEL);
  for (const r of [arr, ind]) for (const f of ['physicalDeliveryVerified', 'recipientAcknowledged', 'satelliteAccessVerified', 'operationallySafe']) assert.equal(r[f], false);
});

test('inclusion–exclusion equals brute-force enumeration of contact outcomes, shared contacts included', () => {
  const rng = mulberry32(11);
  for (let trial = 0; trial < 40; trial++) {
    const ids = Array.from({ length: 6 }, (_, i) => `x${i}`);
    const contactById = new Map(ids.map((id) => [id, { id, from: 'a', to: 'b', probabilityLowerBound: 0.2 + 0.7 * rng() }]));
    const routes = Array.from({ length: 1 + Math.floor(rng() * 4) }, () => ({ hops: ids.filter(() => rng() < 0.45).map((contactId) => ({ contactId, finishMs: 1 })) }))
      .filter((r) => r.hops.length);
    if (!routes.length) continue;
    const member = normalizeEnsemble([{ contactFactor: { x0: 0.5 } }])[0];
    let brute = 0;
    for (let mask = 0; mask < 64; mask++) {
      let p = 1;
      ids.forEach((id, i) => { const q = contactById.get(id).probabilityLowerBound * (id === 'x0' ? 0.5 : 1); p *= mask & (1 << i) ? q : 1 - q; });
      if (routes.some((r) => r.hops.every((h) => mask & (1 << ids.indexOf(h.contactId))))) brute += p;
    }
    assert.ok(Math.abs(unionProbabilityInMember(routes, member, contactById) - brute) < 1e-12);
  }
});

test('objective is monotone and submodular; greedy stays within (1 − 1/e) of the exhaustive optimum', () => {
  let worst = 1, checked = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const inst = makeRegionalInstance({ seed, rho: 0.8, members: 24 });
    const { problem, ensemble, candidates } = planAll(inst, { maxCandidates: 12 });
    if (candidates.length < 4) continue;
    const f = (set) => objectiveValue(set, ensemble, problem.contactById);
    const rng = mulberry32(seed);
    for (let t = 0; t < 30; t++) {
      const shuffled = [...candidates].sort(() => rng() - 0.5);
      const A = shuffled.slice(0, 1), B = shuffled.slice(0, 3), x = shuffled[3];
      assert.ok(f(B) >= f(A) - 1e-12, 'monotone');
      assert.ok(f([...A, x]) - f(A) >= f([...B, x]) - f(B) - 1e-12, 'diminishing returns');
    }
    const greedy = planAdaptiveResilience({ problem, ensemble: inst.ensemble, candidates, maxReplicas: 3 });
    const exact = exhaustiveBest(candidates, ensemble, problem.contactById, { maxReplicas: 3 });
    assert.ok(greedy.predicted.ensembleProbability >= (1 - 1 / Math.E) * exact.value - 1e-12);
    assert.ok(greedy.predicted.ensembleProbability <= exact.value + 1e-12);
    worst = Math.min(worst, greedy.predicted.ensembleProbability / exact.value); checked++;
  }
  assert.ok(checked >= 6 && worst > 0.9, `measured greedy/optimal ratio ${worst}`);
});

test('plan invariants on random instances: eligibility, deadline, hop limit, no loops, energy, determinism', () => {
  for (let seed = 21; seed <= 32; seed++) {
    const inst = makeRegionalInstance({ seed, rho: 0.6, members: 16 });
    inst.contacts[3].kind = 'PASSIVE_REFLECTION'; inst.contacts[5].authorized = false; inst.contacts[7].dutyCycleAllowed = false;
    const relay = inst.nodes.find((x) => x.role === 'RELAY'); relay.consent = false;
    const args = { ...inst, maxHops: 6, maxReplicas: 3, maxEnergyMj: 2600 };
    const plan = planAdaptiveResilience(args);
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), JSON.parse(JSON.stringify(planAdaptiveResilience({ ...args, contacts: [...inst.contacts].reverse() }))));
    const byId = new Map(inst.contacts.map((x) => [x.id, x]));
    assert.ok(plan.energyMj <= 2600);
    for (const r of plan.routes) {
      assert.ok(r.hops.length <= 6 && r.arrivalMs <= inst.deadlineMs);
      assert.equal(new Set(r.path).size, r.path.length);
      assert.ok(!r.path.includes(relay.id));
      let t = inst.startMs;
      for (const h of r.hops) {
        const k = byId.get(h.contactId);
        assert.ok(k.kind === 'ACTIVE_RADIO' && k.authorized && k.enabled && k.dutyCycleAllowed);
        assert.ok(h.departMs >= t && h.departMs >= k.startMs && h.finishMs <= k.endMs);
        t = h.finishMs;
      }
    }
    const p = plan.predicted;
    assert.ok(p.contaminationLowerBound <= p.samplingLowerBound && p.samplingLowerBound <= p.ensembleProbability && p.ensembleProbability <= 1);
    assert.ok(p.lowerTailMean <= p.ensembleProbability + 1e-12);
  }
});

test('differential: single-route feasibility and timing agree with the PR #38 contact planner and route-truth gate', () => {
  const rng = mulberry32(5);
  let feasible = 0;
  for (let t = 0; t < 120; t++) {
    const nodes = [n('S', 'SENDER'), n('A'), n('B'), n('C', rng() < 0.2 ? 'UNKNOWN' : 'RELAY'), n('T', 'RECEIVER')];
    const ids = nodes.map((x) => x.id), contacts = [];
    for (let i = 0; i < 9; i++) {
      const from = ids[Math.floor(rng() * 5)], to = ids[Math.floor(rng() * 5)], start = Math.floor(rng() * 4000);
      if (from === to) continue;
      contacts.push(c(from, to, start, start + 300 + Math.floor(rng() * 3000), 0.5 + 0.5 * rng(),
        { kind: rng() < 0.15 ? 'PASSIVE_REFLECTION' : 'ACTIVE_RADIO', authorized: rng() > 0.1 }));
    }
    const input = { ...base(nodes, contacts), deadlineMs: 6000, maxHops: 4 };
    const arr = planAdaptiveResilience({ ...input, maxReplicas: 1 });
    const ref = planHypotheticalContacts(input);
    assert.equal(arr.modelFeasible, ref.modelFeasible);
    if (arr.modelFeasible) {
      feasible++;
      assert.ok(earliestArrival(buildProblem(input)).arrivalMs <= ref.arrivalMs); // earliest arrival can only be earlier
      const gate = assessModelRoute({ nodes, links: contacts.map((k) => ({ ...k })), source: 'S', destination: 'T', maxHops: 4 });
      assert.equal(gate.modelReachable, true); // a temporal route implies static authorised reachability
    }
  }
  assert.ok(feasible > 15);
});

test('risk measures: lower-tail mean is the worst-case re-weighting and never exceeds the mean', () => {
  const ens = normalizeEnsemble([{}, {}, {}, {}]);
  assert.ok(Math.abs(lowerTailMean([0.1, 0.9, 0.5, 0.7], ens, 0.5) - 0.3) < 1e-12);
  assert.ok(Math.abs(lowerTailMean([0.1, 0.9, 0.5, 0.7], ens, 1) - 0.55) < 1e-12);
  const { nodes, contacts, ensemble } = twoRegionCase();
  const averse = planAdaptiveResilience({ ...base(nodes, contacts), ensemble, maxReplicas: 2, cvarLambda: 0.5 });
  assert.ok(averse.routes.some((r) => r.path[1] === 'E'));
});

test('independence claim equals the ensemble value when there is a single scenario and no shared timing', () => {
  const nodes = [n('S', 'SENDER'), n('A'), n('B'), n('T', 'RECEIVER')];
  const contacts = [c('S', 'A'), c('A', 'T'), c('S', 'B'), c('B', 'T', 0, 1e5, 0.7)];
  const problem = buildProblem(base(nodes, contacts)), ens = normalizeEnsemble(null);
  const routes = generateCandidates(problem, ens).slice(0, 2);
  assert.ok(Math.abs(ensembleReliability(routes, ens, problem.contactById).mean - independentReliability(routes, ens, problem.contactById)) < 1e-12);
});
