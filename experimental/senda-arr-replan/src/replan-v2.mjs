/**
 * SENDA A2 (H-ARR-R-v2) — Wait-vs-Transmit receding-horizon policy with causal opportunity cost.
 *
 * Pre-registered under Protocol V2 (following V1 negative diagnosis):
 *  1. Compares transmitting NOW on contact c against WAITING at custodian u for upcoming scheduled
 *     contacts out of u using only causal information up to t (no future oracle).
 *  2. Enforces budget reserve: rejects low survival-per-airtime hops if holding preserves airtime/energy
 *     for higher-survival paths within TTL.
 *  3. Fixes PRoPHET cold-start baseline via a causal pre-horizon encounter history matrix so PRoPHET is
 *     a fair strong competitor rather than pinned at 0% on turn 1.
 *  4. Reuses `arr-core.mjs`, `replan-core.mjs` (`causalPosteriorEnsemble`, `evaluateCustodianStep`, `hopAirtimeMs`).
 */
import { buildProblem, earliestArrival, hopAlive, hopTiming, normalizeEnsemble, planAdaptiveResilience } from '../../senda-arr/src/arr-core.mjs';
import { causalPosteriorEnsemble, evaluateCustodianStep, hopAirtimeMs } from './replan-core.mjs';

export const V2_STRATEGIES = Object.freeze([
  'WAIT',
  'CGR_EARLIEST',
  'PROPHET_WARM',
  'SPRAY_AND_FOCUS',
  'EPIDEMIC_CAPPED',
  'ARR_STATIC',
  'ARR_REPLAN_V2',
]);

/** Best survival probability obtainable by WAITING at `fromNode` for another future contact > nowMs. */
export function bestFutureWaitValue({
  problem,
  ensemble,
  fromNode,
  afterMs,
  excludeContactId,
  knownDeadNodes,
  knownDeadDomains,
  visitedNodes,
  useSrlg,
  useHazardUpdate,
}) {
  const candidates = (problem.adjacency.get(fromNode) ?? []).filter(
    (c) => c.id !== excludeContactId && c.endMs > afterMs && !visitedNodes.has(c.to),
  );
  let bestProb = 0;
  let bestScorePerSec = 0;
  for (const alt of candidates.slice(0, 6)) {
    const step = evaluateCustodianStep({
      problem,
      ensemble,
      fromNode,
      nowMs: Math.max(afterMs + 1, alt.startMs),
      knownDeadNodes,
      knownDeadDomains,
      visitedNodes,
      candidateContact: alt,
      useSrlg,
      useHazardUpdate,
    });
    if (step.feasible) {
      const airS = Math.max(0.1, hopAirtimeMs(alt, problem.payloadBytes) / 1000);
      if (step.robustProb > bestProb) bestProb = step.robustProb;
      if (step.robustProb / airS > bestScorePerSec) bestScorePerSec = step.robustProb / airS;
    }
  }
  return { bestProb, bestScorePerSec };
}

export function runDynamicV2(instance, world, strategy, {
  ablation = null,
  requireKShards = 1,
  maxCopies = 6,
  airtimeBudgetMs = 95_000,
  energyBudgetMj = 2_100,
  seed = 1,
} = {}) {
  const tStartCpu = performance.now();
  const isV2 = strategy === 'ARR_REPLAN_V2';
  const useReplan = isV2 && ablation !== 'noReplan';
  const useSrlg = isV2 && ablation !== 'noSrlg';
  const useHazardUpdate = isV2 && ablation !== 'noHazardUpdate' && ablation !== 'priorOnly';
  const useAckGossip = isV2 && ablation !== 'noAckGossip';
  const enforceGlobalBudget = !(isV2 && ablation === 'noGlobalBudget');

  const problem = buildProblem({ ...instance, maxHops: 8 });
  const ensemble = normalizeEnsemble(instance.ensemble);
  const { source, destination, startMs, deadlineMs, payloadBytes, contactById, byId } = problem;

  let plannedRoutes = [];
  if (strategy === 'CGR_EARLIEST') {
    const r = earliestArrival(problem);
    if (r) plannedRoutes = [r];
  } else if (strategy === 'ARR_STATIC' || (isV2 && !useReplan)) {
    const res = planAdaptiveResilience({
      problem,
      ensemble: instance.ensemble,
      maxReplicas: Math.min(3, maxCopies),
      maxEnergyMj: energyBudgetMj,
      objective: ablation === 'priorOnly' ? 'independent' : 'ensemble',
    });
    plannedRoutes = [...res.routes];
  }

  const staticEdges = new Set();
  for (const r of plannedRoutes) for (const h of r.hops) staticEdges.add(h.contactId);

  const holders = new Map([[source, { tickets: maxCopies, visited: new Set([source]), arrivedAt: startMs, forwardsUsed: 0 }]]);
  const destDelivered = new Set();
  const ackKnownAtNode = new Map();
  const knownDeadNodes = new Map();
  const knownLiveNodes = new Map();
  const knownDeadDomains = new Set();

  // Warm-start PRoPHET predictabilities strictly from pre-horizon topology frequency (causal)
  const prophetP = new Map();
  for (const c of contactById.values()) {
    const cur = prophetP.get(`${c.from}->${c.to}`) ?? 0;
    prophetP.set(`${c.from}->${c.to}`, cur + (1 - cur) * 0.45 * c.probabilityLowerBound);
  }
  // 2-step transitive warm-up over pre-horizon graph
  for (let pass = 0; pass < 2; pass++) {
    for (const u of byId.keys()) {
      for (const m of byId.keys()) {
        if (u === m) continue;
        const pUm = prophetP.get(`${u}->${m}`) ?? 0;
        const pMd = prophetP.get(`${m}->${destination}`) ?? 0;
        if (pUm > 0 && pMd > 0) {
          const old = prophetP.get(`${u}->${destination}`) ?? 0;
          prophetP.set(`${u}->${destination}`, old + (1 - old) * pUm * pMd * 0.25);
        }
      }
    }
  }
  const getP = (a, b) => prophetP.get(`${a}->${b}`) ?? 0;

  let transmissions = 0;
  let airtimeMs = 0;
  let energyMj = 0;
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

      if (!fromAliveAtStart) {
        knownDeadNodes.set(c.from, c.startMs);
        if (useSrlg) for (const d of byId.get(c.from)?.srlgDomains ?? []) knownDeadDomains.add(d);
      } else knownLiveNodes.set(c.from, c.startMs);
      if (!toAliveAtStart) {
        knownDeadNodes.set(c.to, c.startMs);
        if (useSrlg) for (const d of byId.get(c.to)?.srlgDomains ?? []) knownDeadDomains.add(d);
      } else knownLiveNodes.set(c.to, c.startMs);

      if (fromAliveAtStart && toAliveAtStart && useAckGossip) {
        if (ackKnownAtNode.has(c.to) && !ackKnownAtNode.has(c.from)) ackKnownAtNode.set(c.from, c.startMs);
        else if (ackKnownAtNode.has(c.from) && !ackKnownAtNode.has(c.to)) ackKnownAtNode.set(c.to, c.startMs);
      }

      const holder = holders.get(c.from);
      if (!holder || c.from === destination || holders.has(c.to)) continue;
      if (useAckGossip && ackKnownAtNode.has(c.from)) continue;

      const nFrom = byId.get(c.from), nTo = byId.get(c.to);
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
      } else if (strategy === 'CGR_EARLIEST' || strategy === 'ARR_STATIC' || (isV2 && !useReplan)) {
        shouldTx = staticEdges.has(c.id);
      } else if (strategy === 'EPIDEMIC_CAPPED' || strategy === 'EPIDEMIC_CEILING') {
        shouldTx = enforceGlobalBudget ? (copiesCreated < maxCopies || c.to === destination) : true;
      } else if (strategy === 'PROPHET_WARM') {
        shouldTx = c.to === destination || (getP(c.to, destination) >= getP(c.from, destination) * 0.9 && copiesCreated < maxCopies);
      } else if (strategy === 'SPRAY_AND_FOCUS') {
        if (c.to === destination) shouldTx = holder.tickets >= 1;
        else if (holder.tickets > 1) { shouldTx = true; transferTickets = Math.floor(holder.tickets / 2); }
        else if (holder.tickets === 1 && getP(c.to, destination) > getP(c.from, destination) + 0.1) {
          shouldTx = true; transferTickets = 1;
        }
      } else if (isV2) {
        if (c.to === destination) {
          shouldTx = true;
        } else if (!enforceGlobalBudget || (copiesCreated < maxCopies && holder.forwardsUsed < 3)) {
          const postEnsemble = useHazardUpdate ? causalPosteriorEnsemble(ensemble, Object.fromEntries(knownDeadNodes), Object.fromEntries(knownLiveNodes)) : ensemble;
          const step = evaluateCustodianStep({
            problem, ensemble: postEnsemble, fromNode: c.from, nowMs: timing.departMs,
            knownDeadNodes: new Set(knownDeadNodes.keys()), knownDeadDomains,
            visitedNodes: holder.visited, candidateContact: c, useSrlg, useHazardUpdate,
          });
          if (step.action === 'ABSTAIN') abstained = true;
          if (step.feasible && step.action === 'TRANSMIT') {
            const waitEval = bestFutureWaitValue({
              problem, ensemble: postEnsemble, fromNode: c.from, afterMs: timing.departMs,
              excludeContactId: c.id, knownDeadNodes: new Set(knownDeadNodes.keys()),
              knownDeadDomains, visitedNodes: holder.visited, useSrlg, useHazardUpdate,
            });
            const hopEff = step.robustProb / Math.max(0.1, hopAir / 1000);
            // Key V2 decision: do NOT waste scarce budget on weak congested relays when a stronger upcoming
            // window exists from `fromNode`; transmit if this hop is within 72% of best wait efficiency
            // or adds independent SRLG backup when budget allows >=2 remaining hops.
            const backupAllowed = holder.forwardsUsed < 2 && hopEff >= waitEval.bestScorePerSec * 0.55;
            shouldTx = (step.robustProb >= 0.35 && hopEff >= waitEval.bestScorePerSec * 0.72) ||
                       (step.robustProb >= 0.30 && backupAllowed && step.robustProb >= waitEval.bestProb * 0.75);
          }
        }
      }

      if (!shouldTx) continue;
      usedContacts.add(c.id);
      transmissions++;
      airtimeMs += hopAir;
      energyMj += c.energyMj;
      if (isV2 && c.to !== destination) holder.forwardsUsed++;
      if (strategy === 'SPRAY_AND_FOCUS' && c.to !== destination) holder.tickets -= transferTickets;

      const ok = world.hopWorks(c, timing.finishMs);
      if (!ok) {
        if (!hopAlive(world.truth, c, timing.finishMs)) {
          if (world.truth.nodeDeathMs[c.from] <= timing.finishMs) knownDeadNodes.set(c.from, timing.finishMs);
          if (world.truth.nodeDeathMs[c.to] <= timing.finishMs) knownDeadNodes.set(c.to, timing.finishMs);
          if (useSrlg) for (const d of byId.get(c.to)?.srlgDomains ?? []) if (knownDeadNodes.has(c.to)) knownDeadDomains.add(d);
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
        holders.set(c.to, { tickets: transferTickets, visited: nextVisited, arrivedAt: timing.finishMs, forwardsUsed: 0 });
        anyChange = true;
      }
    }
    if (!anyChange) break;
  }

  return {
    strategy, ablation, seed, evidenceLevel: 'SIMULATED_ONLY',
    delivered: deliveredAtMs !== null, deliveredAtMs, transmissions, airtimeMs, energyMj,
    securityViolations, abstained, cpuMs: +(performance.now() - tStartCpu).toFixed(3),
  };
}
