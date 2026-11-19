import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  mulberry32, normalCdf, insideRings, distanceToRings, observedArrival, sampleRegionalHazard, makeRegionalInstance, makeFireInstance, fireForecastEnsemble,
  planAll, realise, executePlan, executeDynamic, bootstrapCi, calibration,
} from '../src/arr-sim.mjs';
import { ensembleReliability, normalizeEnsemble } from '../src/arr-core.mjs';

const dataset = (k) => JSON.parse(readFileSync(new URL(`../data/geomac-2018-${k}.json`, import.meta.url)));

test('observed datasets: provenance present, checksum matches, class is OBSERVED', () => {
  for (const k of ['camp', 'carr', 'woolsey']) {
    const d = dataset(k);
    assert.equal(d.dataClass, 'OBSERVED');
    assert.match(d.provenance.layer, /^https:\/\/services3\.arcgis\.com\/.+Historic_Geomac_Perimeters_2018/);
    for (const f of ['publisher', 'licenceNote', 'retrievedAt', 'resolution', 'temporalResolution']) assert.ok(d.provenance[f]);
    assert.equal(createHash('sha256').update(JSON.stringify(d.perimeters)).digest('hex'), d.perimetersSha256);
    assert.ok(d.perimeters.length >= 10 && d.perimeters.every((p, i) => i === 0 || Date.parse(p.t) >= Date.parse(d.perimeters[i - 1].t)));
  }
});

test('geometry: even–odd containment with a hole, segment distance, first-arrival interval', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
  assert.equal(insideRings([square, hole], [1, 1]), true);
  assert.equal(insideRings([square, hole], [5, 5]), false);
  assert.equal(insideRings([square], [11, 5]), false);
  assert.ok(Math.abs(distanceToRings([square], [13, 5]) - 3) < 1e-12);
  const per = [{ tMs: 100, rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, { tMs: 200, rings: [square] }];
  assert.deepEqual(observedArrival(per, [5, 5]), { index: 1, lowerMs: 100, upperMs: 200 });
  assert.equal(observedArrival(per, [50, 50]), null);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-4 && Math.abs(normalCdf(-1.96) - 0.025) < 1e-4);
});

test('copula hazard: marginal failure rate does not depend on rho; joint regional loss does', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, pos: [i < 6 ? 1 : 9, 0] }));
  const stats = (rho) => {
    const rng = mulberry32(99); let fails = 0, both = 0; const N = 6000;
    for (let i = 0; i < N; i++) {
      const { nodeDeathMs } = sampleRegionalHazard(rng, { nodes, regionOf: (x) => (x.pos[0] < 5 ? 'W' : 'E'), rho, q: 0.3, startMs: 0, horizonMs: 1000, exempt: new Set() });
      fails += Object.keys(nodeDeathMs).length; both += ('n0' in nodeDeathMs && 'n1' in nodeDeathMs) ? 1 : 0;
    }
    return { marginal: fails / (N * 12), joint: both / N };
  };
  const a = stats(0), b = stats(0.9);
  assert.ok(Math.abs(a.marginal - 0.3) < 0.01 && Math.abs(b.marginal - 0.3) < 0.015);
  assert.ok(Math.abs(a.joint - 0.09) < 0.015 && b.joint > 0.22);
});

test('model ↔ simulator: ensemble probability matches Monte Carlo when truth is drawn from the ensemble', () => {
  const inst = makeRegionalInstance({ seed: 3, rho: 0.8, members: 32 });
  const { problem, ensemble, plans } = planAll(inst);
  const rng = mulberry32(8), fromEnsemble = { ...inst, sampleTruth: (r) => inst.ensemble[Math.floor(r() * inst.ensemble.length)] };
  let hits = 0; const N = 20000;
  for (let i = 0; i < N; i++) hits += executePlan(plans.arr, problem, realise(fromEnsemble, problem, rng)).delivered;
  assert.ok(Math.abs(hits / N - ensembleReliability(plans.arr, ensemble, problem.contactById).mean) < 0.015);
});

test('epidemic flooding is a delivery ceiling for every static plan in the same realised world', () => {
  for (let seed = 40; seed < 52; seed++) {
    const inst = makeRegionalInstance({ seed, rho: 0.5, members: 16 });
    const { problem, plans } = planAll(inst);
    const rng = mulberry32(seed);
    for (let i = 0; i < 25; i++) {
      const world = realise(inst, problem, rng), top = executeDynamic(problem, world);
      for (const routes of Object.values(plans)) {
        const r = executePlan(routes, problem, world);
        if (r.delivered) assert.ok(top.delivered && top.deliveredAtMs <= r.deliveredAtMs);
      }
      const spray = executeDynamic(problem, world, { copies: 4 });
      if (spray.delivered) assert.ok(top.delivered && top.transmissions >= 1);
    }
  }
});

test('fire instance: forecast is causal (later perimeters cannot change it) and truth comes from observations', () => {
  const d = dataset('camp');
  const a = makeFireInstance({ seed: 4, dataset: d, k0: 2, members: 8 });
  const opts = { k0: 2, nodes: a.nodes, members: 8, exempt: new Set([a.source, a.destination]) };
  const future = a.view.perimetersKm.map((p, i) => (i > 2 ? { ...p, rings: [[[0, 0], [500, 0], [500, 500], [0, 500], [0, 0]]] } : p));
  assert.deepEqual(fireForecastEnsemble(mulberry32(9), { ...opts, perimetersKm: a.view.perimetersKm }),
    fireForecastEnsemble(mulberry32(9), { ...opts, perimetersKm: future }));
  assert.equal(a.dataClass.hazardTruth, 'OBSERVED');
  assert.equal(a.dataClass.topology, 'SIMULATED');
  assert.equal(a.dataClass.forecast, 'PREDICTED');
  const truth = a.sampleTruth().nodeDeathMs;
  for (const [id, t] of Object.entries(truth)) {
    const node = a.nodes.find((x) => x.id === id);
    assert.ok(!node.mobile && t >= 0 && observedArrival(a.view.perimetersKm, node.pos).index > 2);
  }
  assert.ok(!(a.source in truth) && !(a.destination in truth));
  assert.throws(() => makeFireInstance({ seed: 1, dataset: d, k0: d.perimeters.length - 1 }), RangeError);
});

test('statistics helpers: seeded bootstrap is reproducible; calibration of a perfect forecaster is ~0', () => {
  const xs = [0.1, 0.4, 0.35, 0.8, 0.2, 0.6];
  assert.deepEqual(bootstrapCi(xs, { seed: 7 }), bootstrapCi(xs, { seed: 7 }));
  const ci = bootstrapCi(xs, { seed: 7 }); assert.ok(ci.lo < ci.mean && ci.mean < ci.hi);
  const rng = mulberry32(1), pairs = Array.from({ length: 20000 }, () => { const p = rng(); return [p, rng() < p ? 1 : 0]; });
  assert.ok(calibration(pairs).ece < 0.02 && Math.abs(calibration(pairs).bias) < 0.01);
  assert.ok(normalizeEnsemble([{ weight: 3 }, { weight: 1 }])[0].weight === 0.75);
});
