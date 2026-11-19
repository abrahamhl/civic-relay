/**
 * SENDA Adaptive Resilience Routing (ARR) — research planner, MODEL ONLY.
 *
 * Problem: choose up to K replica routes over a temporal contact graph so that the probability
 * that at least one replica reaches the destination before the deadline is maximal, when contact
 * failures share common causes (a fire front, a regional blackout) and are therefore NOT independent.
 *
 * Method (every piece is prior art; see docs/research/SENDA_ARR_HYPOTHESIS_REGISTER_20261117.md):
 *  - hazard uncertainty is an ENSEMBLE of scenarios (sample-average approximation, stochastic programming);
 *    conditional on one member, contacts fail independently (same structure as delivery-assurance.mjs);
 *  - P(at least one route works | member) is exact by inclusion–exclusion over the chosen routes;
 *  - the set function is monotone submodular, so greedy selection carries the (1 − 1/e) guarantee
 *    (Nemhauser, Wolsey & Fisher 1978) under a cardinality limit;
 *  - an optional CVaR term is the worst case over bounded re-weightings of ensemble members.
 *
 * Nothing here transmits, measures a radio, or proves delivery. A plan is a hypothesis about a model.
 * Eligibility is fail-closed and mirrors experimental/senda-route-truth (consent, power, radio, role,
 * ACTIVE_RADIO, authorised, enabled, duty cycle). Passive reflections can never be hops.
 */

export const EVIDENCE_LEVEL = 'HYPOTHETICAL_ENSEMBLE_MODEL_ONLY';
export const LIVE_ROLES = Object.freeze(['SENDER', 'RECEIVER', 'RELAY', 'GATEWAY']);
export const MAX_REPLICAS = 6;
const ROLE_SET = new Set(LIVE_ROLES);
const safeInt = Number.isSafeInteger;
const prob = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

export const nodeUsable = (n) => !!n && n.consent === true && n.powered === true && n.radioEnabled === true && ROLE_SET.has(n.role);

/** Why a contact cannot be a transport hop, or null when it can. Order = first failing gate. */
export function contactRejection(c, byId) {
  if (!c || typeof c.id !== 'string' || !c.id) return 'INVALID_ID';
  if (!byId.has(c.from) || !byId.has(c.to) || c.from === c.to) return 'UNKNOWN_ENDPOINT';
  if (c.kind !== 'ACTIVE_RADIO') return 'NOT_ACTIVE_RADIO';
  if (c.authorized !== true) return 'NOT_AUTHORIZED';
  if (c.enabled !== true) return 'DISABLED';
  if (c.dutyCycleAllowed !== true) return 'DUTY_CYCLE';
  if (!nodeUsable(byId.get(c.from)) || !nodeUsable(byId.get(c.to))) return 'NODE_NOT_ELIGIBLE';
  if (!safeInt(c.startMs) || !safeInt(c.endMs) || c.endMs <= c.startMs) return 'INVALID_WINDOW';
  if (!safeInt(c.rateBytesPerSec) || c.rateBytesPerSec <= 0 || !safeInt(c.handshakeMs) || c.handshakeMs < 0) return 'INVALID_RATE';
  if (!safeInt(c.energyMj) || c.energyMj < 0) return 'INVALID_ENERGY';
  if (!prob(c.probabilityLowerBound)) return 'INVALID_PROBABILITY';
  return null;
}

/** Validate the problem and build the eligible temporal graph. Throws on malformed configuration. */
export function buildProblem({ nodes, contacts, source, destination, startMs, deadlineMs, payloadBytes, maxHops = 6 } = {}) {
  if (!Array.isArray(nodes) || !Array.isArray(contacts) || nodes.length > 512 || contacts.length > 20000 ||
    typeof source !== 'string' || typeof destination !== 'string' ||
    !safeInt(startMs) || startMs < 0 || !safeInt(deadlineMs) || deadlineMs <= startMs ||
    !safeInt(payloadBytes) || payloadBytes < 1 || payloadBytes > 65536 ||
    !safeInt(maxHops) || maxHops < 1 || maxHops > 12) throw new TypeError('Invalid ARR problem configuration');
  const byId = new Map();
  for (const n of nodes) {
    if (!n || typeof n.id !== 'string' || !n.id || byId.has(n.id)) throw new TypeError('Invalid or duplicate node id');
    byId.set(n.id, n);
  }
  const contactById = new Map(), adjacency = new Map([...byId.keys()].map((id) => [id, []])), rejected = {};
  for (const c of contacts) {
    const why = contactRejection(c, byId);
    if (why) { rejected[why] = (rejected[why] ?? 0) + 1; continue; }
    if (contactById.has(c.id)) throw new TypeError(`Duplicate contact id ${c.id}`);
    contactById.set(c.id, c);
    adjacency.get(c.from).push(c);
  }
  for (const list of adjacency.values()) list.sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1));
  const endpointsOk = source !== destination && nodeUsable(byId.get(source)) && nodeUsable(byId.get(destination));
  return { byId, contactById, adjacency, rejected, endpointsOk, source, destination, startMs, deadlineMs, payloadBytes, maxHops };
}

/** Same timing semantics as research-contact-planner.mjs: wait for the window, handshake, then transfer. */
export function hopTiming(c, arrivalMs, payloadBytes) {
  const departMs = Math.max(arrivalMs, c.startMs);
  const finishMs = departMs + Math.ceil((1000 * payloadBytes) / c.rateBytesPerSec) + c.handshakeMs;
  return finishMs > c.endMs ? null : { departMs, finishMs };
}

/* ------------------------------------------------------------------ hazard ensemble */

/**
 * Ensemble member = one hazard scenario: { nodeDeathMs?: {nodeId: ms}, contactFactor?: {contactId: [0,1]}, weight? }.
 * A hop is usable in a member iff both endpoints are alive when the transfer finishes.
 */
export function normalizeEnsemble(ensemble) {
  const members = Array.isArray(ensemble) && ensemble.length ? ensemble : [{}];
  if (members.length > 4096) throw new TypeError('Ensemble too large');
  let total = 0;
  const out = members.map((m) => {
    const weight = m.weight ?? 1;
    if (!(typeof weight === 'number' && Number.isFinite(weight) && weight > 0)) throw new TypeError('Invalid ensemble weight');
    const contactFactor = m.contactFactor ?? {};
    for (const f of Object.values(contactFactor)) if (!prob(f)) throw new TypeError('Invalid contact factor');
    total += weight;
    return { nodeDeathMs: m.nodeDeathMs ?? {}, contactFactor, weight };
  });
  for (const m of out) m.weight /= total;
  return out;
}

export const hopAlive = (member, c, finishMs) =>
  finishMs < (member.nodeDeathMs[c.from] ?? Infinity) && finishMs < (member.nodeDeathMs[c.to] ?? Infinity);

/* ------------------------------------------------------------------ earliest arrival (hop-bounded) */

/**
 * Hop-bounded earliest arrival on the temporal graph (layered Bellman–Ford; exact because an earlier
 * arrival never loses options when windows are FIFO and hazards only remove contacts over time).
 * `excluded` removes contacts; `member` restricts to hops that survive that hazard scenario.
 * Complexity O(maxHops · |contacts|).
 */
export function earliestArrival(problem, { excluded = null, excludedNodes = null, member = null } = {}) {
  const { adjacency, source, destination, startMs, deadlineMs, payloadBytes, maxHops } = problem;
  if (!problem.endpointsOk) return null;
  let best = new Map([[source, { t: startMs, via: null, prev: null }]]);
  let frontier = new Set([source]);
  for (let h = 0; h < maxHops && frontier.size; h++) {
    const next = new Map(best), nextFrontier = new Set();
    for (const u of [...frontier].sort()) {
      if (u === destination) continue;
      const label = best.get(u);
      for (const c of adjacency.get(u)) {
        if (c.endMs <= label.t || (excluded && excluded.has(c.id)) || (excludedNodes && excludedNodes.has(c.to))) continue;
        const timing = hopTiming(c, label.t, payloadBytes);
        if (!timing || timing.finishMs > deadlineMs) continue;
        if (member && (!hopAlive(member, c, timing.finishMs) || (member.contactFactor[c.id] ?? 1) === 0)) continue;
        const known = next.get(c.to);
        if (!known || timing.finishMs < known.t) {
          next.set(c.to, { t: timing.finishMs, via: c, prev: label, departMs: timing.departMs });
          nextFrontier.add(c.to);
        }
      }
    }
    best = next; frontier = nextFrontier;
  }
  const end = best.get(destination);
  if (!end) return null;
  const hops = [];
  for (let l = end; l.via; l = l.prev) hops.unshift({ contactId: l.via.id, from: l.via.from, to: l.via.to, departMs: l.departMs, finishMs: l.t });
  return makeRoute(problem, hops);
}

function makeRoute(problem, hops) {
  const nodesOnPath = [problem.source, ...hops.map((h) => h.to)];
  if (new Set(nodesOnPath).size !== nodesOnPath.length) return null; // never plan a loop
  return {
    key: hops.map((h) => h.contactId).join('>'),
    path: nodesOnPath, hops,
    arrivalMs: hops[hops.length - 1].finishMs,
    energyMj: hops.reduce((s, h) => s + problem.contactById.get(h.contactId).energyMj, 0),
  };
}

/**
 * Candidate routes: (1) earliest arrival; (2) earliest arrival inside each hazard scenario (routes that
 * survive that scenario); (3) breadth-first deviations (Lawler/Yen style) that cumulatively forbid one more
 * relay NODE or one more CONTACT of a route already found. Node deviations matter because hazards remove nodes.
 * Bounded by `maxCandidates` routes and `maxSearches` shortest-path calls.
 */
export function generateCandidates(problem, ensemble, { maxCandidates = 48, scenarioCandidates = true, deviations = true, maxSearches = 400 } = {}) {
  const found = new Map(), queue = [];
  let searches = 0;
  const search = (opts) => { searches++; return earliestArrival(problem, opts); };
  const add = (r, nodes = new Set(), contacts = new Set()) => {
    if (!r || found.has(r.key) || found.size >= maxCandidates) return;
    found.set(r.key, r); queue.push({ r, nodes, contacts });
  };
  add(search({}));
  if (scenarioCandidates) for (const member of ensemble) add(search({ member }));
  if (deviations) for (let i = 0; i < queue.length && found.size < maxCandidates && searches < maxSearches; i++) {
    const { r, nodes, contacts } = queue[i];
    for (const v of r.path.slice(1, -1)) {
      if (searches >= maxSearches) break;
      const ex = new Set(nodes).add(v);
      add(search({ excludedNodes: ex, excluded: contacts }), ex, contacts);
    }
    for (const hop of r.hops) {
      if (searches >= maxSearches) break;
      const ex = new Set(contacts).add(hop.contactId);
      add(search({ excludedNodes: nodes, excluded: ex }), nodes, ex);
    }
  }
  return [...found.values()];
}

/* ------------------------------------------------------------------ reliability of a replica set */

/** P(at least one route fully succeeds) in ONE member; exact inclusion–exclusion (≤ 2^K − 1 terms). */
export function unionProbabilityInMember(routes, member, contactById) {
  const k = routes.length;
  if (k === 0) return 0;
  if (k > MAX_REPLICAS) throw new RangeError(`At most ${MAX_REPLICAS} replica routes`);
  const alive = routes.map((r) => r.hops.every((h) => hopAlive(member, contactById.get(h.contactId), h.finishMs)));
  let total = 0;
  for (let mask = 1; mask < 1 << k; mask++) {
    let ok = true, bits = 0;
    const used = new Set();
    for (let i = 0; i < k && ok; i++) if (mask & (1 << i)) {
      bits++;
      if (!alive[i]) ok = false; else for (const h of routes[i].hops) used.add(h.contactId);
    }
    if (!ok) continue;
    let p = 1;
    for (const id of used) p *= contactById.get(id).probabilityLowerBound * (member.contactFactor[id] ?? 1);
    total += bits % 2 ? p : -p;
  }
  return Math.min(1, Math.max(0, total));
}

/** Per-member probabilities and their weighted mean (the SAA estimate). */
export function ensembleReliability(routes, ensemble, contactById) {
  const perMember = ensemble.map((m) => unionProbabilityInMember(routes, m, contactById));
  return { perMember, mean: perMember.reduce((s, p, i) => s + p * ensemble[i].weight, 0) };
}

/** What an independence assumption would claim: every hop keeps only its marginal success probability. */
export function independentReliability(routes, ensemble, contactById) {
  const k = routes.length;
  if (k === 0) return 0;
  if (k > MAX_REPLICAS) throw new RangeError(`At most ${MAX_REPLICAS} replica routes`);
  const marginal = new Map(); // contact id → worst marginal over the times it is used
  for (const r of routes) for (const h of r.hops) {
    const c = contactById.get(h.contactId);
    let p = 0;
    for (const m of ensemble) if (hopAlive(m, c, h.finishMs)) p += m.weight * c.probabilityLowerBound * (m.contactFactor[c.id] ?? 1);
    marginal.set(c.id, Math.min(marginal.get(c.id) ?? 1, p));
  }
  let total = 0;
  for (let mask = 1; mask < 1 << k; mask++) {
    const used = new Set(); let bits = 0;
    for (let i = 0; i < k; i++) if (mask & (1 << i)) { bits++; for (const h of routes[i].hops) used.add(h.contactId); }
    let p = 1; for (const id of used) p *= marginal.get(id);
    total += bits % 2 ? p : -p;
  }
  return Math.min(1, Math.max(0, total));
}

/** Mean of the worst `alpha` probability mass of members (CVaR of the success probability). */
export function lowerTailMean(perMember, ensemble, alpha) {
  const order = perMember.map((p, i) => [p, ensemble[i].weight]).sort((a, b) => a[0] - b[0]);
  let mass = 0, sum = 0;
  for (const [p, w] of order) { const take = Math.min(w, alpha - mass); if (take <= 0) break; sum += take * p; mass += take; }
  return mass > 0 ? sum / mass : 0;
}

export function objectiveValue(routes, ensemble, contactById, { objective = 'ensemble', cvarAlpha = 0.25, cvarLambda = 0 } = {}) {
  if (objective === 'independent') return independentReliability(routes, ensemble, contactById);
  const { perMember, mean } = ensembleReliability(routes, ensemble, contactById);
  return cvarLambda > 0 ? (1 - cvarLambda) * mean + cvarLambda * lowerTailMean(perMember, ensemble, cvarAlpha) : mean;
}

/* ------------------------------------------------------------------ selection */

const better = (a, b) => // deterministic tie-break: value, then less energy, earlier arrival, key
  a.value > b.value + 1e-12 || (Math.abs(a.value - b.value) <= 1e-12 &&
    (a.energy < b.energy || (a.energy === b.energy && (a.arrival < b.arrival || (a.arrival === b.arrival && a.key < b.key)))));

function greedy(candidates, ensemble, contactById, { maxReplicas, maxEnergyMj, opts, byRatio }) {
  const chosen = [], trace = [];
  let value = 0, energy = 0;
  const pool = [...candidates];
  while (chosen.length < maxReplicas && pool.length) {
    let pick = null;
    for (const r of pool) {
      if (energy + r.energyMj > maxEnergyMj) continue;
      const v = objectiveValue([...chosen, r], ensemble, contactById, opts);
      const gain = v - value;
      const cand = { r, total: v, gain, value: byRatio ? gain / Math.max(1, r.energyMj) : gain, energy: r.energyMj, arrival: r.arrivalMs, key: r.key };
      if (!pick || better(cand, pick)) pick = cand;
    }
    if (!pick || pick.gain <= 1e-9) break;
    chosen.push(pick.r); pool.splice(pool.indexOf(pick.r), 1);
    value = pick.total; energy += pick.r.energyMj;
    trace.push({ step: chosen.length, added: pick.r.key, path: pick.r.path, marginalGain: pick.gain, objectiveAfter: value, energyMjAfter: energy });
  }
  return { chosen, value, energy, trace };
}

/** Exhaustive optimum over candidate subsets (small instances only) — used to MEASURE the greedy gap. */
export function exhaustiveBest(candidates, ensemble, contactById, { maxReplicas, maxEnergyMj = Infinity, opts = {} }) {
  if (candidates.length > 20) throw new RangeError('exhaustiveBest: at most 20 candidates');
  let best = { value: 0, chosen: [] };
  const walk = (start, chosen, energy) => {
    if (chosen.length) {
      const value = objectiveValue(chosen, ensemble, contactById, opts);
      if (value > best.value + 1e-12) best = { value, chosen: [...chosen] };
    }
    if (chosen.length === maxReplicas) return;
    for (let i = start; i < candidates.length; i++) {
      if (energy + candidates[i].energyMj > maxEnergyMj) continue;
      chosen.push(candidates[i]); walk(i + 1, chosen, energy + candidates[i].energyMj); chosen.pop();
    }
  };
  walk(0, [], 0);
  return best;
}

/**
 * Plan replica routes. `objective`: 'ensemble' (ARR) or 'independent' (ablation: same search, marginals only).
 * Returns a frozen, self-describing result; `modelFeasible` never implies delivery.
 */
export function planAdaptiveResilience(input = {}) {
  const { ensemble: rawEnsemble, maxReplicas = 3, maxEnergyMj = Number.MAX_SAFE_INTEGER, minProbability = 0,
    objective = 'ensemble', cvarAlpha = 0.25, cvarLambda = 0, contaminationEpsilon = 0.1, confidenceDelta = 0.05,
    maxCandidates = 48, scenarioCandidates = true, deviations = true, candidates: given = null } = input;
  if (!safeInt(maxReplicas) || maxReplicas < 1 || maxReplicas > MAX_REPLICAS || !safeInt(maxEnergyMj) || maxEnergyMj < 0 ||
    !prob(minProbability) || !['ensemble', 'independent'].includes(objective) || !(cvarAlpha > 0 && cvarAlpha <= 1) ||
    !prob(cvarLambda) || !prob(contaminationEpsilon) || !(confidenceDelta > 0 && confidenceDelta < 1) ||
    !safeInt(maxCandidates) || maxCandidates < 1 || maxCandidates > 256) throw new TypeError('Invalid ARR planner options');
  const problem = input.problem ?? buildProblem(input);
  const ensemble = normalizeEnsemble(rawEnsemble);
  const finish = (reason, sel, candidateCount) => {
    const routes = sel?.chosen ?? [];
    const rel = ensembleReliability(routes, ensemble, problem.contactById);
    const hoeffding = Math.sqrt(Math.log(1 / confidenceDelta) / (2 * ensemble.length));
    return Object.freeze({
      reason, modelFeasible: routes.length > 0, evidenceLevel: EVIDENCE_LEVEL, objective,
      physicalDeliveryVerified: false, recipientAcknowledged: false, satelliteAccessVerified: false, operationallySafe: false,
      routes: Object.freeze(routes.map((r) => Object.freeze({ ...r, path: Object.freeze([...r.path]), hops: Object.freeze(r.hops.map((h) => Object.freeze({ ...h }))) }))),
      replicaCount: routes.length, energyMj: routes.reduce((s, r) => s + r.energyMj, 0),
      earliestArrivalMs: routes.length ? Math.min(...routes.map((r) => r.arrivalMs)) : null,
      predicted: Object.freeze({
        ensembleProbability: rel.mean,
        // valid only if members are i.i.d. draws of the true hazard law (they rarely are):
        samplingLowerBound: Math.max(0, rel.mean - hoeffding),
        // holds if the truth is (1−ε)·forecast + ε·anything:
        contaminationLowerBound: (1 - contaminationEpsilon) * Math.max(0, rel.mean - hoeffding),
        lowerTailMean: lowerTailMean(rel.perMember, ensemble, cvarAlpha),
        independenceClaim: independentReliability(routes, ensemble, problem.contactById),
        ensembleMembers: ensemble.length,
      }),
      candidatesExamined: candidateCount, rejectedContacts: Object.freeze({ ...problem.rejected }),
      trace: Object.freeze(sel?.trace ?? []),
    });
  };
  if (!problem.endpointsOk) return finish('ENDPOINTS_NOT_ELIGIBLE_OR_SAME', null, 0);
  const candidates = given ?? generateCandidates(problem, ensemble, { maxCandidates, scenarioCandidates, deviations });
  if (!candidates.length) return finish('NO_AUTHORIZED_TEMPORAL_ROUTE_BEFORE_DEADLINE', null, 0);
  const opts = { objective, cvarAlpha, cvarLambda };
  const args = { maxReplicas, maxEnergyMj, opts };
  let sel = greedy(candidates, ensemble, problem.contactById, { ...args, byRatio: false });
  if (maxEnergyMj < Number.MAX_SAFE_INTEGER) { // knapsack case: also try gain-per-energy, keep the better plan
    const alt = greedy(candidates, ensemble, problem.contactById, { ...args, byRatio: true });
    if (alt.value > sel.value + 1e-12) sel = alt;
  }
  if (!sel.chosen.length) return finish('NO_ROUTE_WITHIN_ENERGY_OR_ZERO_PROBABILITY', null, candidates.length);
  const predicted = ensembleReliability(sel.chosen, ensemble, problem.contactById).mean;
  if (predicted < minProbability) return finish('BELOW_REQUIRED_PROBABILITY_FAIL_CLOSED', null, candidates.length);
  return finish('HYPOTHETICAL_REPLICA_PLAN_NOT_DELIVERED', sel, candidates.length);
}
