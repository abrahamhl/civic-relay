/**
 * SENDA H14 — Anytime-valid multinomial incident risk envelope (shadow research).
 *
 * Why: fixed-n Hoeffding intervals in H12 are NOT valid if teams inspect
 * an incident dashboard repeatedly and stop gathering data at a favorable
 * time ("optional stopping"). Applying fixed-n intervals at each look
 * inflates the probability of ever making a false claim.
 *
 * For m exhaustive categories and n CAUSALLY INDEPENDENT IID incidents,
 * let p_hat_s(n) be the empirical category frequency. Hoeffding gives
 *   P(|p_hat_s(n) - p_s| > eps_n) <= 2exp(-2n eps_n^2).
 * Allocate per-time-category error alpha/[m*n*(n+1)], since
 *   sum_{n=1}^infty 1/[n(n+1)] = 1.
 * Therefore
 *   eps_n = sqrt(log(2*m*n*(n+1)/alpha)/(2*n))
 * yields simultaneous coverage >=1-alpha for ALL n and ALL categories:
 *   P(for all n>=1, for all s: |p_hat_s(n)-p_s|<=eps_n)>=1-alpha.
 *
 * This is a conservative established concentration method (union bound +
 * alpha spending), not an original theorem or a measured emergency model.
 * The code does not verify incident IID-ness, label truth or source licenses.
 * Regular temporal drift or selection invalidates the guarantee.
 *
 * Ref: Howard et al. (2021), Annals of Statistics 49(2), 1055–1080,
 * DOI 10.1214/20-AOS1991 (more refined confidence sequences).
 */
import {buildIncidentFrequencyEnvelope} from './scenario-frequency-evidence.mjs';
import {validateScenarioEnvelope} from './robust-scenario-risk.mjs';

export function anytimeHalfWidth({sampleSize,categoryCount,alpha=0.05}={}) {
  if(!Number.isSafeInteger(sampleSize)||sampleSize<1||sampleSize>1000000||
     !Number.isSafeInteger(categoryCount)||categoryCount<2||categoryCount>24||
     typeof alpha!=='number'||!Number.isFinite(alpha)||alpha<=0||alpha>.2)
    throw new RangeError('invalid anytime confidence sequence parameters');
  // All inputs are bounded, so this is numerically finite in IEEE754.
  return Math.sqrt(Math.log(2*categoryCount*sampleSize*(sampleSize+1)/alpha)/(2*sampleSize));
}

export function buildAnytimeIncidentFrequencyEnvelope({incidents,scenarioIds,alpha=0.05}={}) {
  // Reuse H12's strict controls: unique causal block IDs, provenance SHA
  // format, category taxonomy with UNKNOWN, and 30+ observed incidents.
  const base=buildIncidentFrequencyEnvelope({incidents,scenarioIds,alpha});
  const n=base.sampleSize,m=scenarioIds.length;
  const eps=anytimeHalfWidth({sampleSize:n,categoryCount:m,alpha});
  const states=base.states.map(s=>({
    ...s,
    lowerMass:Math.max(0,s.nominalMass-eps),
    upperMass:Math.min(1,s.nominalMass+eps),
  }));
  validateScenarioEnvelope(states);
  return {...base,states,simultaneousHalfWidth:eps,
    unknownUpperMass:states.find(s=>s.id==='UNKNOWN').upperMass,
    method:'ANYTIME_HOEFFDING_UNION_BOUND_ALPHA_SPENDING',
    coverageTarget:1-alpha,
    sequentialMonitoringAllowedUnderIIDAssumptions:true,
    confidenceStatement:'SIMULTANEOUS_ALL_TIMES_AND_CATEGORIES_ONLY_UNDER_IID_CAUSALLY_INDEPENDENT_COMPLETE_EPISODES',
    calibratedUnderDistributionShift:false,
    incidentDataAuthenticatorConfigured:false,
    sourceAuthenticityVerified:false,
    operationalAuthorizationGranted:false,
    researchOnly:true};
}

/** Descriptive caution: no causal evidence or real-time authorization is inferred. */
export function compareFixedVersusAnytime(snapshot) {
  if(!snapshot||!Array.isArray(snapshot.states)||
     snapshot.method!=='ANYTIME_HOEFFDING_UNION_BOUND_ALPHA_SPENDING'||
     typeof snapshot.simultaneousHalfWidth!=='number')
    throw new TypeError('H14 anytime envelope required');
  const fixedWidth=Math.sqrt(Math.log(2*snapshot.states.length/snapshot.alpha)/
    (2*snapshot.sampleSize));
  return {fixedSampleHalfWidth:fixedWidth,
    anytimeHalfWidth:snapshot.simultaneousHalfWidth,
    monitoringPenalty:snapshot.simultaneousHalfWidth-fixedWidth,
    explanation:'Fixed-n interval must NOT be reused for an adaptively chosen stopping time',
    noFieldAccuracyClaim:true,authorizedForOperationalAlerts:false};
}
