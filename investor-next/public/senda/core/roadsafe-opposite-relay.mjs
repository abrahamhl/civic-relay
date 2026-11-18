/**
 * SENDA RoadSafe / H-ROAD-BLE-1 — opposite-carriageway store/carry/forward FEASIBILITY.
 * A planning model, NOT a radio simulator, field trial or driver-warning authorization.
 *
 * Coordinates: an approaching vehicle starts d metres upstream at t=0 and drives
 * towards the incident (+x) at va. An opposite-direction carrier picks up the
 * incident report at x=0 at time t0 and travels upstream (-x) at vo. They meet
 * at tMeet=(d+vo*t0)/(va+vo). The useful lead is d/va-tMeet.
 *
 * Successful carrier arrivals at the incident are a thinned homogeneous Poisson
 * process. Its probability parameters require EXPLICIT estimates from experiments;
 * the model cannot infer iOS/Android background radio performance or participation.
 * No V16-to-BLE link is assumed: the source must be a SENDA-capable peer.
 */
const REQUIRED = Object.freeze([
  'distanceToHazardM', 'approachingSpeedMps', 'oppositeSpeedMps',
  'oppositeFlowVehPerHour', 'relayParticipation', 'sourceReceiveP',
  'targetReceiveP', 'roadSeparationM', 'effectiveRadioRangeM',
  'minLeadTimeS', 'eventTtlS', 'analysisHorizonS',
  'sourceHasRelay', 'targetHasRelay', 'crossCarriagewayReachable',
]);
const probability = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
const nonnegative = (n) => Number.isFinite(n) && n >= 0;

function validate(p) {
  if (!p || typeof p !== 'object') return { status: 'INSUFFICIENT_INPUT', missing: [...REQUIRED] };
  const missing = REQUIRED.filter((k) => p[k] === undefined || p[k] === null);
  if (missing.length) return { status: 'INSUFFICIENT_INPUT', missing };
  const rates = ['relayParticipation', 'sourceReceiveP', 'targetReceiveP'];
  const amounts = ['distanceToHazardM', 'approachingSpeedMps', 'oppositeSpeedMps', 'oppositeFlowVehPerHour', 'roadSeparationM', 'effectiveRadioRangeM', 'minLeadTimeS', 'eventTtlS', 'analysisHorizonS'];
  const invalid = [...rates.filter((k) => !probability(p[k])), ...amounts.filter((k) => !nonnegative(p[k])),
    ...['sourceHasRelay', 'targetHasRelay', 'crossCarriagewayReachable'].filter((k) => typeof p[k] !== 'boolean')];
  if (!p.approachingSpeedMps || !p.oppositeSpeedMps || !p.distanceToHazardM || !p.effectiveRadioRangeM) invalid.push('positive_speeds_distance_and_range_required');
  return invalid.length ? { status: 'INVALID_INPUT', invalid: [...new Set(invalid)] } : null;
}

export function evaluateOppositeRelay(p) {
  const bad = validate(p);
  if (bad) return { ...bad, probability: null, canWarnDrivers: false };
  const base = { model: 'H-ROAD-BLE-1', status: 'HYPOTHETICAL', fieldValidated: false,
    canWarnDrivers: false, canDispatch: false, probability: null,
    assumptions: ['Poisson stationary traffic', 'Independent conditional uptake/reception',
      'Constant speeds', 'Cross-carriageway BLE link prequalified by measurement',
      'No background-OS or barrier attenuation inferred', 'No authenticated destination ACK'] };
  if (!p.sourceHasRelay || !p.targetHasRelay) return { ...base, status: 'NO_ELIGIBLE_ENDPOINT', probability: 0, reason: 'Source and receiver need active authorized relay-capable devices' };
  if (!p.crossCarriagewayReachable || p.roadSeparationM >= p.effectiveRadioRangeM)
    return { ...base, status: 'NO_CROSS_CARRIAGEWAY_LINK', probability: 0, reason: 'Radio encounter not demonstrated across the carriageways' };
  const hazardArrivalS = p.distanceToHazardM / p.approachingSpeedMps;
  const earliestMeetS = p.distanceToHazardM / (p.approachingSpeedMps + p.oppositeSpeedMps);
  // The warning must precede the hazard by a user-provided safety margin.
  const deadlineS = Math.min(p.analysisHorizonS, p.eventTtlS, hazardArrivalS - p.minLeadTimeS);
  const latestPickupS = (deadlineS * (p.approachingSpeedMps + p.oppositeSpeedMps) - p.distanceToHazardM) / p.oppositeSpeedMps;
  const pickupWindowS = Math.max(0, latestPickupS);
  const successRatePerS = p.oppositeFlowVehPerHour / 3600 * p.relayParticipation * p.sourceReceiveP * p.targetReceiveP;
  const meanSuccesses = successRatePerS * pickupWindowS;
  const probability = pickupWindowS > 0 ? -Math.expm1(-meanSuccesses) : 0;
  return { ...base, probability, hazardArrivalS, earliestMeetS, deadlineS, latestPickupS: pickupWindowS,
    meanSuccessfulCarriers: meanSuccesses, effectiveRatePerS: successRatePerS,
    maxLeadS: Math.max(0, hazardArrivalS - earliestMeetS),
    note: 'Probability under stated assumptions, not empirical delivery rate. Custody is not destination receipt.' };
}

function rng32(seed) {
  let s = seed >>> 0;
  if (!s) s = 0x6D2B79F5;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
function wilson95(successes, n) {
  const z = 1.95996398454, phat = successes / n, den = 1 + z * z / n;
  const centre = (phat + z * z / (2 * n)) / den;
  const half = z * Math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n)) / den;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Monte Carlo consistency check; its Wilson interval quantifies ONLY simulation sampling error. */
export function simulateOppositeRelay(p, { trials = 10_000, seed = 20261118 } = {}) {
  const analytic = evaluateOppositeRelay(p);
  if (analytic.probability === null) return { ...analytic, trials: 0 };
  if (!Number.isInteger(trials) || trials < 100 || trials > 1_000_000 || !Number.isInteger(seed))
    return { status: 'INVALID_SIMULATION_INPUT', probability: null, canWarnDrivers: false };
  const r = rng32(seed); let successes = 0;
  for (let i = 0; i < trials; i++) {
    const tPickup = analytic.effectiveRatePerS > 0 ? -Math.log(1 - r()) / analytic.effectiveRatePerS : Infinity;
    if (tPickup < analytic.latestPickupS) successes++;
  }
  return { ...analytic, simulatedRate: successes / trials, successes, trials, seed,
    monteCarlo95: wilson95(successes, trials),
    intervalMeaning: 'Wilson 95% for Monte Carlo sampling only; not uncertainty over real radio performance' };
}
