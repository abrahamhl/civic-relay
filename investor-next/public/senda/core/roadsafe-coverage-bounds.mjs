/**
 * SENDA / H-ROAD-COVER-1: deadline-aware receipt evidence and dependence-robust
 * reachability bounds. Distribution optimization cannot assume independent routes:
 * even 3 channels can fail on one power/network/OS/common-mode fault.
 *
 * Operational probability is NOT claimed: Wilson intervals assume independent
 * Bernoulli encounters and empirical representativeness remains unvalidated.
 * Receiver ACK = true receipt, not hop custody, HTTP 202 or device screen view.
 */
const num = x => typeof x === 'number' && Number.isFinite(x);
const nonneg = x => num(x) && x >= 0;
const token = x => typeof x === 'string' && x.length > 0 && x.trim() && x.length <= 128;
const round = x => Math.round(x * 100000) / 100000;

export function wilsonInterval95(successes, trials) {
  if (!Number.isInteger(trials) || trials < 1 || !Number.isInteger(successes) || successes < 0 || successes > trials)
    return { status: 'INSUFFICIENT_COUNTS', interval: null };
  const z = 1.959963984540054, p = successes / trials, den = 1 + z * z / trials;
  const ctr = (p + z * z / (2 * trials)) / den;
  const rad = z / den * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials));
  return { status: 'ASSUMPTION_BOUND', interval: [round(Math.max(0, ctr - rad)), round(Math.min(1, ctr + rad))],
    meaning: 'Sampling interval assuming independent representative Bernoulli trials, not a road safety guarantee.' };
}

/**
 * Each channel must present a homogeneous measurement stratum (road, OS, app
 * lifecycle, weather, traffic) with *destination* acknowledgements and a measured
 * p95 latency. No confidence is inherited from other platforms or old runs.
 * Limits: p95 does not bound every delivery; deadline-qualified empirical successes
 * must have been counted under the SAME or tighter deadline.
 */
export function evaluateCoverageBounds({ channelEvidence, deadlineS, nowMs, minSamples = 30,
  requiredStratum = null } = {}) {
  if (!Array.isArray(channelEvidence) || channelEvidence.length > 128 || !nonneg(deadlineS) ||
      !nonneg(nowMs) || !Number.isInteger(minSamples) || minSamples < 1)
    return { status: 'ABSTAIN_INVALID_INPUT', channels: [], canWarnDrivers: false };
  const blocked = [], qualified = [], seen = new Set();
  for (const e of channelEvidence) {
    const id = e?.channelId;
    if (!token(id) || seen.has(id)) { blocked.push({ channelId: id ?? null, reason:'INVALID_OR_DUPLICATE_CHANNEL' }); continue; }
    seen.add(id);
    const reason = !token(e.failureDomain) ? 'UNKNOWN_FAILURE_DOMAIN' :
      !token(e.measurementStratum) ? 'MISSING_MEASUREMENT_STRATUM' :
      requiredStratum && e.measurementStratum !== requiredStratum ? 'STRATUM_MISMATCH' :
      e.receiverAckType !== 'DESTINATION_ACK' ? 'CUSTODY_IS_NOT_RECEIPT' :
      e.authorizationGranted !== true || e.consentGranted !== true ? 'NO_AUTHORIZATION_OR_CONSENT' :
      e.measurementOrigin !== 'FIELD_OBSERVED' ? 'NO_EMPIRICAL_FIELD_MEASUREMENTS' :
      !Number.isInteger(e.trials) || !Number.isInteger(e.deadlineSuccesses) ||
      e.trials < 1 || e.deadlineSuccesses < 0 || e.deadlineSuccesses > e.trials ? 'INVALID_COUNTS' :
      e.trials < minSamples ? 'TOO_FEW_SAMPLES' :
      !nonneg(e.testedDeadlineS) || e.testedDeadlineS > deadlineS ? 'TESTED_DEADLINE_TOO_LAX' :
      !nonneg(e.measuredLatencyP95S) ? 'NO_MEASURED_LATENCY' :
      e.measuredLatencyP95S > deadlineS ? 'LATENCY_P95_EXCEEDS_DEADLINE' :
      !nonneg(e.observedAtMs) || e.observedAtMs > nowMs ? 'INVALID_OBSERVATION_CLOCK' :
      e.validUntilMs <= nowMs || !nonneg(e.validUntilMs) ? 'STALE_RECEIPT_EVIDENCE' : null;
    if (reason) { blocked.push({ channelId: id, reason }); continue; }
    const interval = wilsonInterval95(e.deadlineSuccesses, e.trials).interval;
    qualified.push({ channelId:id, failureDomain:e.failureDomain, measurementStratum:e.measurementStratum,
      trials:e.trials, deadlineSuccesses:e.deadlineSuccesses, measuredLatencyP95S:e.measuredLatencyP95S,
      samplingInterval95:interval, observedSuccessRate:round(e.deadlineSuccesses/e.trials) });
  }
  // Pooling dissimilar iOS/Android states, roads or weather is not valid even
  // if the caller omitted a required stratum. Fail closed on heterogeneity.
  if (new Set(qualified.map(x => x.measurementStratum)).size > 1) {
    return { status:'ABSTAIN_MIXED_MEASUREMENT_STRATA',channels:[],canWarnDrivers:false,
      blocked:[...blocked,...qualified.map(x=>({channelId:x.channelId,reason:'MIXED_STRATA_UNCOMBINABLE'}))],
      noDeliveryGuarantee:true };
  }
  const bestLower = qualified.length ? Math.max(...qualified.map(x=>x.samplingInterval95[0])) : null;
  const unionUpper = qualified.length ? Math.min(1, qualified.reduce((sum,x)=>sum+x.samplingInterval95[1],0)) : null;
  // Frechet-Hoeffding: without known dependence max(P_i) <= P(union) <= min(1, sum P_i).
  // Use Wilson endpoints as exploratory intervals, *not* rigorous simultaneous bounds.
  const groups = new Map();
  for(const c of qualified) {
    if(!groups.has(c.failureDomain)) groups.set(c.failureDomain, []);
    groups.get(c.failureDomain).push(c.channelId);
  }
  return { status: qualified.length ? 'RESEARCH_BOUNDS_ONLY' : 'ABSTAIN_NO_CALIBRATED_CHANNEL',
    channels: qualified, blocked, failureDomains: [...groups].map(([domain, ids])=>({domain,channels:ids})),
    dependenceAgnosticExploratoryRange: qualified.length ? [round(bestLower),round(unionUpper)] : null,
    canWarnDrivers: false, noDeliveryGuarantee: true, appliedDeadlineS: deadlineS,
    warning: 'Marginal Wilson endpoints are not simultaneous coverage guarantees. Correlated failure and selection bias unmeasured. No production authorization.' };
}

/** The coupling is a model intersection, not an automatic approval to warn. */
export function assessCoverageAtQueueDeadline({ queueEnvelope, coverage, reserveS = 0 } = {}) {
  if (!nonneg(reserveS) || queueEnvelope?.status !== 'SCIENTIFIC_MODEL_ONLY' ||
      coverage?.status !== 'RESEARCH_BOUNDS_ONLY')
    return { status:'ABSTAIN', reason:'UNVERIFIED_QUEUE_OR_COVERAGE_INPUT', canWarnDrivers:false };
  const encounterEarliestS = queueEnvelope.encounterTimeRangeS?.[0];
  if (!nonneg(encounterEarliestS))
    return { status:'ABSTAIN',reason:'UNKNOWN_EARLIEST_ARRIVAL',canWarnDrivers:false };
  const budgetS = Math.max(0, encounterEarliestS - reserveS);
  const routesInTime = coverage.channels.filter(c => c.measuredLatencyP95S <= budgetS);
  const lower = routesInTime.length ? Math.max(...routesInTime.map(c=>c.samplingInterval95[0])) : null;
  return { status:'RESEARCH_TIMING_COVERAGE_ONLY', canWarnDrivers:false,
    earliestEncounterS: encounterEarliestS, availableRelayBudgetS: round(budgetS),
    qualifiedChannelsWithinBudget: routesInTime.map(c=>c.channelId),
    exploratoryLowerOnAtLeastOneReceipt: lower === null ? null : round(lower),
    safetyClearanceVerdict: queueEnvelope.verdict,
    caveat:'Receiver ACK does not prove driver attention; p95 latency does not guarantee this individual alert.' };
}