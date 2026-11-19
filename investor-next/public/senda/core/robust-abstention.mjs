/**
 * SENDA P4 (H-ABST-1) — Structured Decision Abstention & Truthfulness Envelope.
 *
 * Every routing, fire-spread, evidence-fusion, or hypothetical evacuation output MUST pass through
 * `evaluateAbstentionContract` so users and auditors always see:
 *   1. What is known
 *   2. What was computed
 *   3. What was assumed
 *   4. What remains unverified
 *   5. When validity expires
 *   6. Backing sources & licenses
 *   7. Strict operational boundary (`SIMULATION_OR_EXERCISE_ONLY`, `canIssuePublicAlert: false`,
 *      `canIssueEvacuationOrder: false`).
 *
 * Refuses to produce actionable confidence under missing critical inputs, clock incoherence,
 * temporal leakage, high inter-source contradiction, wide uncertainty intervals, or unverified authority.
 */

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export const ABSTAIN_STATES = Object.freeze(['ABSTAIN', 'UNKNOWN', 'RECOMMENDED_HYPOTHETICAL']);

export function evaluateAbstentionContract({
  domain = 'ROUTING',
  known = [],
  computed = [],
  assumed = [],
  unverified = [],
  sources = [],
  validUntilUtc = null,
  nowUtc = new Date().toISOString(),
  uncertaintyWidth = 0,
  maxAllowedUncertaintyWidth = 0.45,
  contradictionScore = 0,
  maxAllowedContradiction = 0.40,
  missingCriticalInputs = [],
  temporalLeakageDetected = false,
  clockIncoherent = false,
  datasetBlocked = false,
  modelRejected = false,
  overlapWithNullBaseline = false,
  insufficientIndependentEvidence = false,
  unconsentedTransport = false,
  operationallyAuthorized = false,
} = {}) {
  const abstainReasons = [];
  if (Array.isArray(missingCriticalInputs) && missingCriticalInputs.length) {
    abstainReasons.push(`MISSING_CRITICAL_INPUTS:${missingCriticalInputs.join(',')}`);
  }
  if (temporalLeakageDetected === true) abstainReasons.push('TEMPORAL_LEAKAGE_DETECTED');
  if (clockIncoherent === true) abstainReasons.push('CLOCK_INCOHERENT_QUARANTINE');
  if (datasetBlocked === true) abstainReasons.push('EXTERNAL_DATASET_BLOCKED');
  if (modelRejected === true) abstainReasons.push('MODEL_FAILED_PREREGISTERED_BASELINE');
  if (overlapWithNullBaseline === true) abstainReasons.push('INTERVAL_OVERLAPS_NULL_BASELINE');
  if (insufficientIndependentEvidence === true) abstainReasons.push('INSUFFICIENT_INDEPENDENT_EVIDENCE');
  if (unconsentedTransport === true) abstainReasons.push('UNCONSENTED_OR_UNAUTHORIZED_TRANSPORT');
  if (!finite(uncertaintyWidth) || uncertaintyWidth > maxAllowedUncertaintyWidth) {
    abstainReasons.push('UNCERTAINTY_EXCEEDS_THRESHOLD');
  }
  if (!finite(contradictionScore) || contradictionScore > maxAllowedContradiction) {
    abstainReasons.push('SOURCE_CONTRADICTION_EXCEEDS_THRESHOLD');
  }

  const nowMs = Date.parse(nowUtc ?? '');
  const validMs = validUntilUtc ? Date.parse(validUntilUtc) : NaN;
  if (!Number.isFinite(validMs) || !Number.isFinite(nowMs) || validMs <= nowMs) {
    abstainReasons.push('MISSING_OR_EXPIRED_VALIDITY_HORIZON');
  }

  const hasMissing = (Array.isArray(missingCriticalInputs) && missingCriticalInputs.length > 0) ||
    datasetBlocked === true ||
    insufficientIndependentEvidence === true;

  let status;
  if (abstainReasons.length > 0) {
    status = hasMissing && abstainReasons.length === 1 ? 'UNKNOWN' : 'ABSTAIN';
  } else {
    status = 'RECOMMENDED_HYPOTHETICAL';
  }

  const usageConstraint = operationallyAuthorized === true
    ? 'INSTITUTIONAL_ANCHOR_REQUIRED_OUTSIDE_RESEARCH'
    : 'SIMULATION_OR_EXERCISE_ONLY';

  return Object.freeze({
    schema: 'senda-abstention-contract/1',
    domain,
    status,
    abstained: status !== 'RECOMMENDED_HYPOTHETICAL',
    abstainReasons,
    // P4 mandatory accountability fields:
    whatIsKnown: [...known],
    whatWasComputed: [...computed],
    whatWasAssumed: [...assumed],
    whatNeedsVerification: [...new Set([...unverified, 'independent_field_measurements', 'external_institutional_authorization'])],
    validUntilUtc: Number.isFinite(validMs) ? new Date(validMs).toISOString() : null,
    sources: [...sources],
    usageConstraint,
    hypotheticalNonPrescriptiveOnly: true,
    // Hard operational lock in research/consolidation software:
    canIssuePublicAlert: false,
    canIssueEvacuationOrder: false,
    operationalCertaintyClaimed: false,
  });
}
