#!/usr/bin/env node
/**
 * SENDA ARR — experiment H-ARR-1. Reproducible: `node experiments/run-experiment.mjs [--quick]`.
 *
 * PRE-REGISTERED PROTOCOL (written before the held-out run; do not edit after looking at results):
 *  - Development seeds 1..40 were used while designing the planner and are EXCLUDED from every number below.
 *  - Held-out synthetic seeds start at 1001. Real-fire cases use OBSERVED perimeters never used for design.
 *  - No planner parameter is tuned on held-out data. K = 3 replicas, 64 forecast members, 48 candidates, 8 hops.
 *  - Statistical unit = instance; paired differences; percentile bootstrap 95 % CI (2000 resamples, fixed seed).
 * ACCEPTANCE CRITERIA for "ARR improves on the independence ablation" (all must hold):
 *  C1 superiority under correlation: delivery(ARR) − delivery(independent-greedy) has CI lower bound > 0 at ρ = 0.9 and ρ = 0.6.
 *  C2 no harm without correlation: at ρ = 0 the same difference has CI lower bound ≥ −0.01.
 *  C3 calibration: at ρ = 0.9, Brier(ARR ensemble prediction) < Brier(independence claim of the independence plan)
 *     and |bias| of the ARR prediction ≤ 0.05.
 *  C4 real hazard: on observed fires the difference ARR − independent-greedy has CI lower bound ≥ −0.01 (non-inferior);
 *     superiority is claimed only if the lower bound is > 0.
 *  C5 safety: every plan of every method passes the invariant audit (eligible hops, deadline, hop limit, no loops).
 * If C1 or C3 fails the hypothesis is REJECTED as stated and the report says so.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ensembleReliability, independentReliability, exhaustiveBest, planAdaptiveResilience, contactRejection } from '../src/arr-core.mjs';
import { mulberry32, makeRegionalInstance, makeFireInstance, planAll, realise, executePlan, executeDynamic, bootstrapCi, calibration, mean } from '../src/arr-sim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const quick = process.argv.includes('--quick');
const N_SYN = quick ? 30 : 200, N_ABL = quick ? 20 : 150, N_FIRE_SEEDS = quick ? 2 : 12, TRIALS = quick ? 10 : 30, SEED0 = 1001;
const HOUR = 3600000;
const STATIC = ['cgr-earliest', 'cgr-k-exclusion', 'top-k-marginal', 'independent-greedy', 'arr'];

/** C5 audit: independent re-check of a plan against the raw instance. */
function auditPlan(routes, inst, maxHops) {
  const byId = new Map(inst.nodes.map((n) => [n.id, n])), cById = new Map(inst.contacts.map((c) => [c.id, c]));
  for (const r of routes) {
    if (r.hops.length > maxHops || r.arrivalMs > inst.deadlineMs || new Set(r.path).size !== r.path.length) return false;
    if (r.path[0] !== inst.source || r.path[r.path.length - 1] !== inst.destination) return false;
    let t = inst.startMs, at = inst.source;
    for (const h of r.hops) {
      const c = cById.get(h.contactId);
      if (!c || contactRejection(c, byId) || c.from !== at || h.departMs < Math.max(t, c.startMs) || h.finishMs > c.endMs) return false;
      t = h.finishMs; at = c.to;
    }
  }
  return true;
}

/** Evaluate one configuration. `truths(inst)` may return several named truth variants sharing one plan. */
function evaluate(label, makeInstances, { extra = {}, planOptions = {}, variants = null, dynamic = true } = {}) {
  const methods = [...STATIC, ...Object.keys(extra)];
  const variantNames = variants ?? ['main'];
  const out = Object.fromEntries(variantNames.map((v) => [v, { perInstance: Object.fromEntries([...methods, 'epidemic', 'spray-8'].map((m) => [m, []])), pairs: { arr: [], independent: [], independentOnArr: [] }, cost: {} }]));
  let total = 0, infeasible = 0, auditFailures = 0;
  const planMs = { all: [], arrOnly: [] }, replicas = [];
  for (const { inst, alt } of makeInstances()) {
    total++;
    if (!inst) { infeasible++; continue; }
    const t0 = performance.now();
    const { problem, ensemble, candidates, plans } = planAll(inst, { extra, ...planOptions });
    planMs.all.push(performance.now() - t0);
    if (!candidates.length) { infeasible++; continue; }
    const t1 = performance.now();
    planAdaptiveResilience({ problem, ensemble: inst.ensemble, candidates, maxReplicas: planOptions.maxReplicas ?? 3 });
    planMs.arrOnly.push(performance.now() - t1);
    replicas.push(plans.arr.length);
    for (const m of methods) if (!auditPlan(plans[m], inst, planOptions.maxHops ?? 8)) auditFailures++;
    const predicted = {
      arr: ensembleReliability(plans.arr, ensemble, problem.contactById).mean,
      independent: independentReliability(plans['independent-greedy'], ensemble, problem.contactById),
      independentOnArr: independentReliability(plans.arr, ensemble, problem.contactById),
    };
    for (const v of variantNames) {
      const world = v === 'main' ? inst : { ...inst, sampleTruth: alt[v] };
      const rng = mulberry32((inst.meta.seed * 2654435761 + (inst.meta.k0 ?? 0) * 97) >>> 0);
      const acc = Object.fromEntries(Object.keys(out[v].perInstance).map((m) => [m, { d: 0, tx: 0, mj: 0, lat: 0 }]));
      for (let i = 0; i < TRIALS; i++) {
        const w = realise(world, problem, rng);
        const results = Object.fromEntries(methods.map((m) => [m, executePlan(plans[m], problem, w)]));
        if (dynamic) { results.epidemic = executeDynamic(problem, w); results['spray-8'] = executeDynamic(problem, w, { copies: 8 }); }
        for (const [m, r] of Object.entries(results)) { const a = acc[m]; a.d += r.delivered; a.tx += r.transmissions; a.mj += r.energyMj; if (r.delivered) a.lat += r.deliveredAtMs - inst.startMs; }
        out[v].pairs.arr.push([predicted.arr, results.arr.delivered ? 1 : 0]);
        out[v].pairs.independent.push([predicted.independent, results['independent-greedy'].delivered ? 1 : 0]);
        out[v].pairs.independentOnArr.push([predicted.independentOnArr, results.arr.delivered ? 1 : 0]);
      }
      for (const [m, a] of Object.entries(acc)) if (dynamic || methods.includes(m))
        out[v].perInstance[m].push({ delivery: a.d / TRIALS, tx: a.tx / TRIALS, mj: a.mj / TRIALS, latMin: a.d ? a.lat / a.d / 60000 : null });
    }
  }
  const summarise = (o) => {
    const res = { methods: {}, diffVsArr: {}, calibration: {} };
    const arr = o.perInstance.arr.map((x) => x.delivery);
    for (const [m, rows] of Object.entries(o.perInstance)) {
      if (!rows.length) continue;
      const lat = rows.map((x) => x.latMin).filter((x) => x !== null);
      res.methods[m] = { delivery: bootstrapCi(rows.map((x) => x.delivery), { seed: 11 }), transmissions: mean(rows.map((x) => x.tx)), energyMj: mean(rows.map((x) => x.mj)), latencyMinWhenDelivered: mean(lat) };
      if (m !== 'arr') res.diffVsArr[m] = bootstrapCi(rows.map((x, i) => arr[i] - x.delivery), { seed: 13 });
    }
    for (const [k, pairs] of Object.entries(o.pairs)) { const c = calibration(pairs); res.calibration[k] = { brier: c.brier, ece: c.ece, bias: c.bias, bins: c.bins }; }
    return res;
  };
  const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  const result = {
    label, instances: total, evaluated: total - infeasible, excludedNoRoute: infeasible, trialsPerInstance: TRIALS, auditFailures,
    meanReplicasArr: mean(replicas), planningMs: { allMethodsP50: q(planMs.all, 0.5), allMethodsP95: q(planMs.all, 0.95), arrSelectionP50: q(planMs.arrOnly, 0.5), arrSelectionP95: q(planMs.arrOnly, 0.95) },
    ...(variants ? { variants: Object.fromEntries(variantNames.map((v) => [v, summarise(out[v])])) } : summarise(out.main)),
  };
  const head = variants ? result.variants[variantNames[0]] : result;
  console.error(`${label}: n=${result.evaluated}/${total} arr=${head.methods.arr.delivery.mean.toFixed(3)} ind=${head.methods['independent-greedy'].delivery.mean.toFixed(3)} Δ=${head.diffVsArr['independent-greedy'].mean.toFixed(4)} [${head.diffVsArr['independent-greedy'].lo.toFixed(4)}, ${head.diffVsArr['independent-greedy'].hi.toFixed(4)}]`);
  return result;
}

const regional = (n, o) => function* () { for (let i = 0; i < n; i++) yield { inst: makeRegionalInstance({ seed: SEED0 + i, ...o }) }; };
const results = { protocol: { quick, heldOutSeedStart: SEED0, developmentSeedsExcluded: '1..40', trials: TRIALS, generatedAt: new Date().toISOString(), node: process.version }, synthetic: {}, fire: {}, ablations: {} };

/* 1 — held-out synthetic, correlation sweep */
for (const rho of [0, 0.3, 0.6, 0.9]) results.synthetic[`rho=${rho}`] = evaluate(`synthetic rho=${rho}`, regional(N_SYN, { rho }));

/* 2 — observed fire progressions (hazard truth OBSERVED, topology SIMULATED) */
for (const key of ['camp', 'carr', 'woolsey']) {
  const dataset = JSON.parse(readFileSync(path.join(here, '..', 'data', `geomac-2018-${key}.json`)));
  const gen = function* () {
    for (let k0 = 0; k0 < Math.min(10, dataset.perimeters.length - 1); k0++) for (let s = 0; s < N_FIRE_SEEDS; s++) {
      const mk = (censoring) => makeFireInstance({ seed: SEED0 + s, dataset, k0, horizonMs: 24 * HOUR, censoring });
      const inst = mk('mid');
      yield { inst, alt: inst && { early: mk('early').sampleTruth, late: mk('late').sampleTruth } };
    }
  };
  results.fire[key] = { provenance: dataset.provenance, perimetersSha256: dataset.perimetersSha256, ...evaluate(`fire ${key}`, gen, { variants: ['main', 'early', 'late'] }) };
}
{ // pooled fires: the pre-registered C4 test
  const pool = [];
  for (const key of ['camp', 'carr', 'woolsey']) {
    const dataset = JSON.parse(readFileSync(path.join(here, '..', 'data', `geomac-2018-${key}.json`)));
    for (let k0 = 0; k0 < Math.min(10, dataset.perimeters.length - 1); k0++) for (let s = 0; s < N_FIRE_SEEDS; s++) pool.push({ inst: makeFireInstance({ seed: SEED0 + s, dataset, k0, horizonMs: 24 * HOUR }) });
  }
  results.fire.pooled = evaluate('fire pooled', () => pool);
}

/* 3 — ablations and sensitivity at rho = 0.9 (held-out seeds) */
const A = (label, o, opts) => { results.ablations[label] = evaluate(label, regional(N_ABL, { rho: 0.9, ...o }), opts); };
A('replicas K=1', {}, { planOptions: { maxReplicas: 1 } });
A('replicas K=2', {}, { planOptions: { maxReplicas: 2 } });
A('replicas K=4', {}, { planOptions: { maxReplicas: 4 } });
A('candidate generation', {}, { extra: { 'arr-no-scenario-candidates': { candidates: 'fresh', scenarioCandidates: false }, 'arr-no-deviations': { candidates: 'fresh', deviations: false } }, dynamic: false });
A('ensemble size M=8', { members: 8 }, { dynamic: false });
A('risk-averse (CVaR λ=0.5), well specified', {}, { extra: { 'arr-cvar': { cvarLambda: 0.5 } }, dynamic: false });
A('forecast wrong: planner assumes rho=0', { forecast: { rho: 0 } }, { extra: { 'arr-cvar': { cvarLambda: 0.5 } }, dynamic: false });
A('forecast wrong: planner assumes q=0.15 (truth 0.35)', { forecast: { q: 0.15 } }, { extra: { 'arr-cvar': { cvarLambda: 0.5 } }, dynamic: false });
A('link success 0.80', { linkP: 0.8 }, { dynamic: false });
A('node loss q=0.20', { q: 0.2 }, { dynamic: false });
A('node loss q=0.50', { q: 0.5 }, { dynamic: false });
A('sparser mesh (mean degree 5)', { meanDegree: 5 }, { dynamic: false });

/* 4 — greedy vs exhaustive optimum on small candidate pools */
{
  const ratios = [];
  for (let i = 0; i < (quick ? 15 : 100); i++) {
    const inst = makeRegionalInstance({ seed: SEED0 + i, rho: 0.9 });
    const { problem, ensemble, candidates } = planAll(inst, { maxCandidates: 14 });
    if (candidates.length < 4) continue;
    const g = planAdaptiveResilience({ problem, ensemble: inst.ensemble, candidates, maxReplicas: 3 }).predicted.ensembleProbability;
    ratios.push(g / exhaustiveBest(candidates, ensemble, problem.contactById, { maxReplicas: 3 }).value);
  }
  results.greedyVsExhaustive = { instances: ratios.length, meanRatio: mean(ratios), minRatio: Math.min(...ratios), shareOptimal: ratios.filter((r) => r > 1 - 1e-9).length / ratios.length, guarantee: 1 - 1 / Math.E };
}

/* 5 — verdict against the pre-registered criteria */
const d = (r) => r.diffVsArr['independent-greedy'];
const s9 = results.synthetic['rho=0.9'], s6 = results.synthetic['rho=0.6'], s0 = results.synthetic['rho=0'];
const everything = [...Object.values(results.synthetic), ...Object.values(results.fire), ...Object.values(results.ablations)];
results.verdict = {
  C1_superiority_under_correlation: d(s9).lo > 0 && d(s6).lo > 0,
  C2_no_harm_without_correlation: d(s0).lo >= -0.01,
  C3_calibration: s9.calibration.arr.brier < s9.calibration.independent.brier && Math.abs(s9.calibration.arr.bias) <= 0.05,
  C4_real_hazard_non_inferior: d(results.fire.pooled).lo >= -0.01,
  C4_real_hazard_superior: d(results.fire.pooled).lo > 0,
  C5_safety_invariants: everything.every((r) => r.auditFailures === 0),
};
results.verdict.hypothesisAccepted = results.verdict.C1_superiority_under_correlation && results.verdict.C2_no_harm_without_correlation &&
  results.verdict.C3_calibration && results.verdict.C4_real_hazard_non_inferior && results.verdict.C5_safety_invariants;

const outDir = path.join(here, '..', 'results');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, quick ? 'results.quick.json' : 'results.json'), JSON.stringify(results, null, 1));
console.error(JSON.stringify(results.verdict, null, 1));
