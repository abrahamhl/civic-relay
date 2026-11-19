/**
 * SENDA / H-ROAD-RRE-1 — robust queue-tail reachability in road curvilinear coordinates.
 * Research-only numerical decision support. No driver manoeuvre, broadcast, control or 112.
 * This is NOT new physics: interval kinematics + LWR traffic-shock consistency check.
 * Original SENDA hypothesis: join tail-motion, position accuracy, communication delay
 * and reaction/braking uncertainties into an explicit falsifiable timing envelope.
 *
 * Metres and seconds throughout. `chainageM` increases by map convention, irrespective
 * of travel direction. A road/carrriageway match is essential; no raw-GPS inference.
 */
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const nonneg = (x) => num(x) && x >= 0;
const positive = (x) => num(x) && x > 0;
const token = (x) => typeof x === 'string' && x.trim().length > 0 && x.length < 200;
const abstain = (reason, extra = {}) => ({ status: 'ABSTAIN', reason, canWarnDrivers: false, modelValidatedInField: false, ...extra });
const two = (x, predicate = nonneg) => Array.isArray(x) && x.length === 2 && x.every(predicate) && x[0] <= x[1];
const round = (x, p = 4) => Math.round(x * 10 ** p) / 10 ** p;

/**
 * Rankine-Hugoniot speed of a discontinuity in the LWR conservation model:
 * w = (q_downstream-q_upstream)/(k_downstream-k_upstream) [km/h].
 * q in veh/h and k in veh/km; no calibration or extrapolation claimed.
 * If density differences are small, calculation is ill conditioned and abstains.
 */
export function lwrShockSpeed({ upstream, downstream, minDensityGapVehKm = 1 } = {}) {
  if (!upstream || !downstream || !positive(minDensityGapVehKm) ||
      ![upstream.flowVehH, downstream.flowVehH, upstream.densityVehKm, downstream.densityVehKm].every(nonneg))
    return abstain('MISSING_FLOW_OR_DENSITY');
  const deltaK = downstream.densityVehKm - upstream.densityVehKm;
  if (Math.abs(deltaK) < minDensityGapVehKm) return abstain('NEAR_SINGULAR_DENSITY_DIFFERENCE');
  const w = (downstream.flowVehH - upstream.flowVehH) / deltaK / 3.6;
  if (!num(w)) return abstain('NUMERICAL_FAILURE');
  return { status: 'THEORETICAL_SPEED_ONLY', shockSpeedMps: w, canWarnDrivers: false,
    assumption: 'LWR conservation on a locally homogeneous link and measured q,k; not an observed queue-tail trajectory' };
}

/**
 * Inputs require two independently timestamped positions of the SAME queue tail.
 * No implicit traffic speeds, friction, GNSS precision, latency or reaction time.
 * Both observations and the driver must be in the same map-matched carriageway;
 * temporal extrapolation capped by caller-supplied `maxExtrapolationS`.
 *
 * A queue tail may move upstream: its signed along-road velocity can be <0.
 * Bounds are outer/containment intervals, not p95 or calibrated probabilities.
 */
export function projectQueueTailEnvelope({ observations, driver, nowMs, constraints,
  flowCheck = null, maxFlowDisagreementMps = null } = {}) {
  if (!num(nowMs) || nowMs < 0 || !Array.isArray(observations) || observations.length !== 2 ||
      !driver || !constraints) return abstain('MISSING_CLOCK_OR_OBSERVATIONS');
  const [a, b] = [...observations].sort((x, y) => (x?.atMs ?? Infinity) - (y?.atMs ?? Infinity));
  if (![a, b].every((x) => x && token(x.roadId) && token(x.carriagewayId) && token(x.incidentKey) &&
      ['INCREASING','DECREASING'].includes(x.direction) && x.mapMatched === true &&
      nonneg(x.chainageM) && nonneg(x.uncertaintyM) && num(x.atMs) && x.atMs >= 0))
    return abstain('UNVERIFIED_TAIL_LOCATION');
  if (!token(driver.roadId) || !token(driver.carriagewayId) ||
      !['INCREASING', 'DECREASING'].includes(driver.direction) || driver.mapMatched !== true ||
      !nonneg(driver.chainageM) || !nonneg(driver.uncertaintyM))
    return abstain('DRIVER_NOT_MAP_MATCHED');
  if (![a, b].every((x) => x.incidentKey === a.incidentKey && x.roadId === driver.roadId &&
      x.carriagewayId === driver.carriagewayId && x.direction === driver.direction))
    return abstain('INCIDENT_ROAD_OR_DIRECTION_MISMATCH');
  const dt = (b.atMs - a.atMs) / 1000;
  const age = (nowMs - b.atMs) / 1000;
  if (!positive(dt) || !nonneg(age) || b.atMs > nowMs || !positive(constraints.maxExtrapolationS) ||
      !positive(constraints.maxObservationGapS) || dt > constraints.maxObservationGapS ||
      age > constraints.maxExtrapolationS) return abstain('INVALID_OR_STALE_OBSERVATION_TIMING');
  const c = constraints;
  if (!two(c.driverSpeedRangeMps) || !two(c.latencyRangeS) || !two(c.reactionRangeS) ||
      !two(c.decelerationRangeMs2, positive) || !nonneg(c.clearanceMarginM) ||
      !positive(c.maxExtrapolationS)) return abstain('UNCALIBRATED_SAFETY_PARAMETERS');
  const sign = driver.direction === 'INCREASING' ? 1 : -1;
  const xA = sign * a.chainageM, xB = sign * b.chainageM, xDriver = sign * driver.chainageM;
  const vLo = ((xB - b.uncertaintyM) - (xA + a.uncertaintyM)) / dt;
  const vHi = ((xB + b.uncertaintyM) - (xA - a.uncertaintyM)) / dt;
  if (![vLo, vHi].every(num)) return abstain('INVALID_VELOCITY_ENVELOPE');
  if (!positive(c.maxAbsWaveSpeedMps) || Math.abs(vLo) > c.maxAbsWaveSpeedMps ||
      Math.abs(vHi) > c.maxAbsWaveSpeedMps) return abstain('UNCALIBRATED_OR_IMPLAUSIBLE_WAVE_SPEED');
  if (flowCheck !== null) {
    const w = lwrShockSpeed(flowCheck);
    if (w.status !== 'THEORETICAL_SPEED_ONLY' || !nonneg(maxFlowDisagreementMps))
      return abstain('FLOW_MODEL_UNVERIFIED');
    // Flow is expressed in the vehicle-travel orientation in the LWR reference.
    if (w.shockSpeedMps < vLo - maxFlowDisagreementMps || w.shockSpeedMps > vHi + maxFlowDisagreementMps)
      return abstain('OBSERVATION_LWR_CONTRADICTION', { observedWaveRangeMps: [vLo, vHi], theoreticalWaveMps: w.shockSpeedMps });
  }
  const tailMin = xB - b.uncertaintyM + vLo * age;
  const tailMax = xB + b.uncertaintyM + vHi * age;
  const dMin = tailMin - (xDriver + driver.uncertaintyM);
  const dMax = tailMax - (xDriver - driver.uncertaintyM);
  if (dMax <= 0) return { ...abstain('QUEUE_TAIL_BEHIND_DRIVER'), distanceRangeM: [round(dMin), round(dMax)] };
  if (dMin <= 0) return { ...abstain('POSITION_OVERLAP_NO_DRIVER_WARNING'), distanceRangeM: [round(dMin), round(dMax)] };
  const closureMin = c.driverSpeedRangeMps[0] - vHi;
  const closureMax = c.driverSpeedRangeMps[1] - vLo;
  if (!positive(closureMax)) return { ...abstain('NO_PROVEN_APPROACH'), distanceRangeM: [round(dMin), round(dMax)] };
  const earliestEncounterS = dMin / closureMax;
  if (![tailMin,tailMax,dMin,dMax,closureMin,closureMax,earliestEncounterS].every(num))
    return abstain('NUMERICAL_OVERFLOW');
  const latestEncounterS = positive(closureMin) ? dMax / closureMin : null;
  const strictRequiredM = c.clearanceMarginM +
    closureMax * (c.latencyRangeS[1] + c.reactionRangeS[1]) +
    closureMax * closureMax / (2 * c.decelerationRangeMs2[0]);
  const relaxedRequiredM = c.clearanceMarginM + Math.max(0, closureMin) *
    (c.latencyRangeS[0] + c.reactionRangeS[0]) +
    Math.max(0, closureMin) ** 2 / (2 * c.decelerationRangeMs2[1]);
  if (![strictRequiredM,relaxedRequiredM,latestEncounterS ?? 0].every(num))
    return abstain('NUMERICAL_OVERFLOW');
  const verdict = dMin >= strictRequiredM ? 'TIMING_ROBUST_IN_MODEL' :
    positive(closureMin) && dMax < relaxedRequiredM ? 'TIMING_TOO_LATE_IN_MODEL' : 'TIMING_INDETERMINATE';
  return {
    status: 'SCIENTIFIC_MODEL_ONLY', canWarnDrivers: false, modelValidatedInField: false,
    incidentKey: a.incidentKey, roadId: driver.roadId, carriagewayId: driver.carriagewayId,
    waveVelocityRangeMps: [round(vLo), round(vHi)], observationSeparationS: dt,
    observationAgeS: age,
    projectedTailRangeAlongRoadM: [round(tailMin), round(tailMax)],
    distanceRangeM: [round(dMin), round(dMax)],
    closureSpeedRangeMps: [round(closureMin), round(closureMax)],
    encounterTimeRangeS: [round(earliestEncounterS), latestEncounterS === null ? null : round(latestEncounterS)],
    requiredClearanceRangeM: [round(relaxedRequiredM), round(strictRequiredM)],
    robustTimingMarginM: round(dMin - strictRequiredM), verdict,
    assumptions: ['constant tail wave velocity between observation and event',
      'bounded input speeds, observation errors, latency, reaction and deceleration',
      'no lane changes, junction conflict, evasive manoeuvres or sensor fraud represented'],
    disclaimer: 'Not an operational warning, manoeuvre instruction or injury reduction claim. Test calibration independently.'
  };
}