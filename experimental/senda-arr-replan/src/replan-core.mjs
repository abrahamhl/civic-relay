/**
 * SENDA A2 (H-ARR-R + H-INN-ACK) — Receding-horizon custodian replanner & fair budget comparators.
 *
 * Reuses `experimental/senda-arr/src/arr-core.mjs` without duplicating graph validation or baselines.
 * Evaluates local causal decisions s_t = {custodyShards, knownDelivered, knownDeadNodes, observedSrlg,
 * budgets, clockCoherent} with ZERO access to future hazard realizations.
 */
import { buildProblem, earliestArrival, hopAlive, hopTiming, normalizeEnsemble, planAdaptiveResilience } from '../../senda-arr/src/arr-core.mjs';

export const STRATEGIES = Object.freeze([
  'WAIT',
  'CGR_EARLIEST',
  'PROPHET',
  'SPRAY_AND_FOCUS',
  'EPIDEMIC_CAPPED',
  'ARR_STATIC',
  'ARR_REPLAN',
]);

export const ABLATIONS = Object.freeze([
  'noReplan',
  'noSrlg',
  'noHazardUpdate',
  'noAckGossip',
  'noGlobalBudget',
  'priorOnly',
]);

export function hopAirtimeMs(c, payloadBytes) {
  const txMs = Math.ceil((1000 * payloadBytes) / Math.max(1, c.rateBytesPerSec));
  return txMs + c.handshakeMs;
}

/**
 * Filter / reweight scenario ensemble using ONLY causal observations up to decision time t:
 * scenarios where already-observed dead nodes are actually dead before `t` receive full consistency
 * weight; contradictory scenarios that force live-observed nodes to have died earlier are downweighted.
 */
export function causalPosteriorEnsemble(ensemble, deadObservedAtMs, liveObservedAtMs, { minFloorWeight = 0.05 } = {}) {
  const raw = ensemble.map((m) => {
    let score = 1;
    for (const [nodeId, deathT] of Object.entries(deadObservedAtMs)) {
      const mDeath = m.nodeDeathMs[nodeId] ?? Infinity;
      score *= mDeath <= deathT + 60_000 ? 1.0 : 0.25;
    }
    for (const [nodeId, liveT] of Object.entries(liveObservedAtMs)) {
      const mDeath = m.nodeDeathMs[nodeId] ?? Infinity;
      if (mDeath < liveT) score *= 0.25;
    }
    return { ...m, weight: Math.max(minFloorWeight, m.weight * score) };
  });
  const total = raw.reduce((s, m) => s + m.weight, 0) || 1;
  return raw.map((m) => ({ ...m, weight: m.weight / total }));
}

/**
 * Custodian local best survival path from current carrier `u` at time `nowMs` toward `destination`,
 * accounting for known dead nodes/SRLG domains and causal residual ensemble `q \in Q_t`.
 * Worst-case robust score over ensemble members + lower-confidence penalty when SRLG domains overlap.
 */
export function evaluateCustodianStep({
  problem,
  ensemble,
  fromNode,
  nowMs,
  knownDeadNodes,
  knownDeadDomains,
  visitedNodes,
  candidateContact,
  srlgPenalty = 0.15,
  useSrlg = true,
  useHazardUpdate = true,
  robustTailAlpha = 0.35,
}) {
  const { destination, payloadBytes, deadlineMs, adjacency, byId } = problem;
  if (!candidateContact || candidateContact.from !== fromNode) return { feasible: false, action: 'WAIT', robustProb: 0 };
  if (knownDeadNodes.has(candidateContact.to)) return { feasible: false, action: 'WAIT', robustProb: 0 };
  if (visitedNodes.has(candidateContact.to)) return { feasible: false, action: 'WAIT', robustProb: 0 };
  const toNode = byId.get(candidateContact.to);
  if (!toNode || toNode.consent !== true || toNode.powered !== true || toNode.radioEnabled !== true) {
    return { feasible: false, action: 'ABSTAIN', reason: 'NODE_NOT_ELIGIBLE', robustProb: 0 };
  }
  const domains = toNode.srlgDomains ?? [];
  if (useSrlg && domains.some((d) => knownDeadDomains.has(d))) {
    return { feasible: false, action: 'ABSTAIN', reason: 'KNOWN_SRLG_DOMAIN_DOWN', robustProb: 0 };
  }
  const timing = hopTiming(candidateContact, nowMs, payloadBytes);
  if (!timing || timing.finishMs > deadlineMs) return { feasible: false, action: 'WAIT', robustProb: 0 };

  if (candidateContact.to === destination) {
    let minP = 1;
    let meanP = 0;
    for (const m of ensemble) {
      const alive = hopAlive(m, candidateContact, timing.finishMs) ? 1 : 0;
      const p = alive * candidateContact.probabilityLowerBound * (m.contactFactor[candidateContact.id] ?? 1);
      meanP += m.weight * p;
      if (p < minP) minP = p;
    }
    return {
      feasible: true,
      action: 'TRANSMIT',
      direct: true,
      timing,
      robustProb: useHazardUpdate ? 0.65 * meanP + 0.35 * minP : candidateContact.probabilityLowerBound,
      expectedArrivalMs: timing.finishMs,
    };
  }

  // Forward search on surviving residual subproblem from candidateContact.to
  const subExcludedNodes = new Set(knownDeadNodes);
  for (const v of visitedNodes) subExcludedNodes.add(v);
  subExcludedNodes.add(fromNode);
  if (useSrlg) {
    for (const [nid, node] of byId) {
      if ((node.srlgDomains ?? []).some((d) => knownDeadDomains.has(d))) subExcludedNodes.add(nid);
    }
  }

  const subProblem = { ...problem, source: candidateContact.to, startMs: timing.finishMs };
  let totalSurviveWeight = 0;
  const memberProbs = [];
  let minEta = Infinity;

  if (!useHazardUpdate) {
    const route = earliestArrival(subProblem, { excludedNodes: subExcludedNodes });
    if (!route) return { feasible: false, action: 'WAIT', robustProb: 0 };
    const pRoute = route.hops.reduce(
      (acc, h) => acc * problem.contactById.get(h.contactId).probabilityLowerBound,
      candidateContact.probabilityLowerBound,
    );
    return {
      feasible: true,
      action: 'TRANSMIT',
      direct: false,
      timing,
      robustProb: pRoute,
      expectedArrivalMs: route.arrivalMs,
    };
  }

  for (const m of ensemble) {
    if (!hopAlive(m, candidateContact, timing.finishMs)) {
      memberProbs.push({ p: 0, w: m.weight });
      continue;
    }
    const route = earliestArrival(subProblem, { excludedNodes: subExcludedNodes, member: m });
    if (!route) {
      memberProbs.push({ p: 0, w: m.weight });
      continue;
    }
    if (route.arrivalMs < minEta) minEta = route.arrivalMs;
    let p = candidateContact.probabilityLowerBound * (m.contactFactor[candidateContact.id] ?? 1);
    for (const h of route.hops) {
      const hc = problem.contactById.get(h.contactId);
      p *= hc.probabilityLowerBound * (m.contactFactor[h.contactId] ?? 1);
    }
    totalSurviveWeight += m.weight * p;
    memberProbs.push({ p, w: m.weight });
  }

  // Worst-tail CVaR blend over ambiguity set Q_t (reusing H11 conservative tail logic)
  memberProbs.sort((a, b) => a.p - b.p);
  let tailMass = 0;
  let tailSum = 0;
  for (const item of memberProbs) {
    const take = Math.min(item.w, robustTailAlpha - tailMass);
    if (take <= 0) break;
    tailSum += take * item.p;
    tailMass += take;
  }
  const tailMean = tailMass > 0 ? tailSum / tailMass : 0;
  const srlgOverlapPenalty = useSrlg && (byId.get(fromNode)?.srlgDomains ?? []).some((d) => domains.includes(d)) ? srlgPenalty : 0;
  const robustProb = Math.max(0, 0.55 * totalSurviveWeight + 0.45 * tailMean - srlgOverlapPenalty);

  if (robustProb <= 0.02 || !Number.isFinite(minEta)) {
    return { feasible: false, action: 'WAIT', robustProb: 0 };
  }
  return {
    feasible: true,
    action: 'TRANSMIT',
    direct: false,
    timing,
    robustProb,
    expectedArrivalMs: minEta,
  };
}

/**
 * Dynamic event-driven network execution under STRICT equal budgets:
 *   - global `maxCopies`, `airtimeBudgetMs`, `energyBudgetMj`
 *   - `requireKShards` (default 1, supports k-of-n threshold!)
 *   - causal `DESTINATION_ACK` gossip (`ackPropagation=true` stops orphaned copies)
 */
export function runDynamicProtocol(instance, world, strategy, {
  ablation = null,
  requireKShards = 1,
  maxCopies = 6,
  airtimeBudgetMs = 250_000,
  energyBudgetMj = 5_000,
  clockSkewReject = false,
} = {}) {
  const tStartCpu = performance.now();
  const useReplan = strategy === 'ARR_REPLAN' && ablation !== 'noReplan';
  const useSrlg = strategy === 'ARR_REPLAN' && ablation !== 'noSrlg';
  const useHazardUpdate = strategy === 'ARR_REPLAN' && ablation !== 'noHazardUpdate' && ablation !== 'priorOnly';
  const useAckGossip = strategy === 'ARR_REPLAN' && ablation !== 'noAckGossip';
  const enforceGlobalBudget = !(strategy === 'ARR_REPLAN' && ablation === 'noGlobalBudget');

  const problem = buildProblem({ ...instance, maxHops: 8 });
  const ensemble = normalizeEnsemble(instance.ensemble);
  const { source, destination, startMs, deadlineMs, payloadBytes, contactById, byId } = problem;

  if (clockSkewReject) {
    return {
      strategy, ablation, delivered: false, deliveredAtMs: null, transmissions: 0,
      airtimeMs: 0, energyMj: 0, budgetViolations: 0, securityViolations: 0,
      abstained: true, reason: 'CLOCK_INCOHERENT_QUARANTINE', cpuMs: +(performance.now() - tStartCpu).toFixed(3),
    };
  }

  let plannedRoutes = [];
  if (strategy === 'CGR_EARLIEST') {
    const r = earliestArrival(problem);
    if (r) plannedRoutes = [r];
  } else if (strategy === 'ARR_STATIC' || (strategy === 'ARR_REPLAN' && !useReplan)) {
    const res = planAdaptiveResilience({
      problem,
      ensemble: instance.ensemble,
      maxReplicas: Math.min(6, maxCopies),
      maxEnergyMj: energyBudgetMj,
      objective: ablation === 'priorOnly' ? 'independent' : 'ensemble',
    });
    plannedRoutes = [...res.routes];
  }

  // Track static next-hops per node for non-replanning strategies
  const staticEdges = new Set();
  for (const r of plannedRoutes) for (const h of r.hops) staticEdges.add(h.contactId);

  // Dynamic causal custodian state
  const holders = new Map([[source, { tickets: strategy === 'SPRAY_AND_FOCUS' ? maxCopies : maxCopies, visited: new Set([source]), arrivedAt: startMs }]]);
  const destDelivered = new Set(); // tracks how many shards or copies reached destination
  const ackKnownAtNode = new Map(); // H-INN-ACK: causal ACK state per custodian
  const knownDeadNodes = new Map(); // nodeId -> deathObservedMs
  const knownLiveNodes = new Map(); // nodeId -> lastSeenLiveMs
  const knownDeadDomains = new Set();
  const prophetP = new Map([[`${source}->${destination}`, 0.0]]); // PRoPHET delivery predictability (RFC 6693)

  const getP = (a, b) => prophetP.get(`${a}->${b}`) ?? 0;
  const updateProphet = (u, v) => {
    const pInit = 0.75;
    const pOld = getP(u, v);
    prophetP.set(`${u}->${v}`, pOld + (1 - pOld) * pInit);
    prophetP.set(`${v}->${u}`, getP(v, u) + (1 - getP(v, u)) * pInit);
    // Transitive update across known nodes
    for (const [mid] of byId) {
      if (mid === u || mid === v) continue;
      const pUm = getP(u, mid);
      const pMv = getP(mid, v);
      if (pUm > 0 && pMv > 0) {
        const cur = getP(u, v);
        prophetP.set(`${u}->${v}`, cur + (1 - cur) * pUm * pMv * 0.25);
      }
    }
  };

  let transmissions = 0;
  let airtimeMs = 0;
  let energyMj = 0;
  let budgetViolations = 0;
  let securityViolations = 0;
  let deliveredAtMs = null;
  let copiesCreated = 1;
  let abstained = false;

  const events = [...contactById.values()].sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1));
  const usedContacts = new Set();

  for (let pass = 0; pass < 3; pass++) {
    let anyChange = false;
    for (const c of events) {
      if (c.startMs > deadlineMs) break;
      if (usedContacts.has(c.id)) continue;

      const fromAliveAtStart = !world.truth?.nodeDeathMs?.[c.from] || c.startMs < world.truth.nodeDeathMs[c.from];
      const toAliveAtStart = !world.truth?.nodeDeathMs?.[c.to] || c.startMs < world.truth.nodeDeathMs[c.to];

      // Causal sensing: endpoints update liveness & deaths discovered on attempted contact
      if (!fromAliveAtStart) {
        knownDeadNodes.set(c.from, c.startMs);
        if (useSrlg) for (const d of byId.get(c.from)?.srlgDomains ?? []) knownDeadDomains.add(d);
      } else {
        knownLiveNodes.set(c.from, c.startMs);
      }
      if (!toAliveAtStart) {
        knownDeadNodes.set(c.to, c.startMs);
        if (useSrlg) for (const d of byId.get(c.to)?.srlgDomains ?? []) knownDeadDomains.add(d);
      } else {
        knownLiveNodes.set(c.to, c.startMs);
      }

      if (fromAliveAtStart && toAliveAtStart) {
        updateProphet(c.from, c.to);
        if (useAckGossip) {
          if (ackKnownAtNode.has(c.to) && !ackKnownAtNode.has(c.from)) {
            ackKnownAtNode.set(c.from, Math.max(c.startMs, ackKnownAtNode.get(c.to)));
          } else if (ackKnownAtNode.has(c.from) && !ackKnownAtNode.has(c.to)) {
            ackKnownAtNode.set(c.to, Math.max(c.startMs, ackKnownAtNode.get(c.from)));
          }
        }
      }

      const holder = holders.get(c.from);
      if (!holder) continue;
      if (c.from === destination || holders.has(c.to)) continue;
      if (useAckGossip && ackKnownAtNode.has(c.from)) continue; // H-INN-ACK: suppress redundant tx cleanly!

      // Check consent / authority invariant dynamically
      const nFrom = byId.get(c.from);
      const nTo = byId.get(c.to);
      if (!nFrom || !nTo || nFrom.consent !== true || nTo.consent !== true || c.authorized !== true || c.dutyCycleAllowed !== true) {
        securityViolations++;
        continue;
      }

      const timing = hopTiming(c, Math.max(holder.arrivedAt, c.startMs), payloadBytes);
      if (!timing || timing.finishMs > deadlineMs) continue;

      const hopAir = hopAirtimeMs(c, payloadBytes);
      if (enforceGlobalBudget && strategy !== 'EPIDEMIC_CEILING') {
        if (airtimeMs + hopAir > airtimeBudgetMs || energyMj + c.energyMj > energyBudgetMj) {
          abstained = true;
          continue;
        }
      }

      let shouldTx = false;
      let transferTickets = 1;

      if (strategy === 'WAIT') {
        shouldTx = c.to === destination;
      } else if (strategy === 'CGR_EARLIEST' || strategy === 'ARR_STATIC' || (strategy === 'ARR_REPLAN' && !useReplan)) {
        shouldTx = staticEdges.has(c.id);
      } else if (strategy === 'EPIDEMIC_CAPPED' || strategy === 'EPIDEMIC_CEILING') {
        shouldTx = enforceGlobalBudget ? copiesCreated < maxCopies || c.to === destination : true;
      } else if (strategy === 'PROPHET') {
        shouldTx = c.to === destination || (getP(c.to, destination) > getP(c.from, destination) + 0.05 && copiesCreated < maxCopies);
      } else if (strategy === 'SPRAY_AND_FOCUS') {
        if (c.to === destination) {
          shouldTx = holder.tickets >= 1;
        } else if (holder.tickets > 1) {
          shouldTx = true;
          transferTickets = Math.floor(holder.tickets / 2);
        } else if (holder.tickets === 1 && getP(c.to, destination) > getP(c.from, destination) + 0.15) {
          // Focus phase: forward single copy token to higher utility custodian
          shouldTx = true;
          transferTickets = 1;
        }
      } else if (strategy === 'ARR_REPLAN') {
        if (enforceGlobalBudget && c.to !== destination && copiesCreated >= maxCopies) continue;
        const postEnsemble = useHazardUpdate ? causalPosteriorEnsemble(ensemble, Object.fromEntries(knownDeadNodes), Object.fromEntries(knownLiveNodes)) : ensemble;
        const step = evaluateCustodianStep({
          problem,
          ensemble: postEnsemble,
          fromNode: c.from,
          nowMs: timing.departMs,
          knownDeadNodes: new Set(knownDeadNodes.keys()),
          knownDeadDomains,
          visitedNodes: holder.visited,
          candidateContact: c,
          useSrlg,
          useHazardUpdate,
        });
        if (step.action === 'ABSTAIN') abstained = true;
        shouldTx = step.feasible && step.action === 'TRANSMIT' && step.robustProb >= 0.12;
      }

      if (!shouldTx) continue;
      usedContacts.add(c.id);
      transmissions++;
      airtimeMs += hopAir;
      energyMj += c.energyMj;

      if (strategy === 'SPRAY_AND_FOCUS' && c.to !== destination) holder.tickets -= transferTickets;
      const ok = world.hopWorks(c, timing.finishMs);
      if (!ok) {
        if (!hopAlive(world.truth, c, timing.finishMs)) {
          if (world.truth.nodeDeathMs[c.from] <= timing.finishMs) knownDeadNodes.set(c.from, timing.finishMs);
          if (world.truth.nodeDeathMs[c.to] <= timing.finishMs) knownDeadNodes.set(c.to, timing.finishMs);
          if (useSrlg) {
            for (const d of byId.get(c.to)?.srlgDomains ?? []) if (knownDeadNodes.has(c.to)) knownDeadDomains.add(d);
          }
        }
        continue;
      }

      if (c.to === destination) {
        destDelivered.add(c.id);
        ackKnownAtNode.set(c.from, timing.finishMs);
        ackKnownAtNode.set(destination, timing.finishMs);
        if (destDelivered.size >= requireKShards && (deliveredAtMs === null || timing.finishMs < deliveredAtMs)) {
          deliveredAtMs = timing.finishMs;
        }
      } else {
        copiesCreated++;
        const nextVisited = new Set(holder.visited);
        nextVisited.add(c.to);
        holders.set(c.to, { tickets: transferTickets, visited: nextVisited, arrivedAt: timing.finishMs });
        anyChange = true;
      }
    }
    if (!anyChange) break;
  }

  return {
    strategy,
    ablation,
    evidenceLevel: 'SIMULATED_ONLY',
    delivered: deliveredAtMs !== null,
    deliveredAtMs,
    transmissions,
    airtimeMs,
    energyMj,
    budgetViolations,
    securityViolations,
    abstained,
    cpuMs: +(performance.now() - tStartCpu).toFixed(3),
  };
}
