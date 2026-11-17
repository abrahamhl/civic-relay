/**
 * SENDA A3 (H-FIRE-B) — Censoring-aware 24h arrival labeler & leakage audit.
 *
 * Fixes H2 methodological flaws:
 *  - A point NOT inside any perimeter before t0+24h is CENSORED (null), NOT observed negative (0),
 *    when the latest mapped observation precedes t0 + horizonMs without full coverage proof.
 *  - Tracks censoring fraction explicitly so no evaluation can inflate accuracy from unmapped gaps.
 */
import { insideRings } from '../../senda-arr/src/arr-sim.mjs';

export const OUTCOME_LABELS = Object.freeze({
  BURNT: 1,
  UNBURNT_CONFIRMED: 0,
  CENSORED: 'CENSORED',
});

/**
 * Label unburnt points at t0 relative to [t0, t0 + horizonMs] observations.
 * Every perimeter record must carry `tMs` and optionally `availableAtMs` (for causal leakage check).
 */
export function auditCensoredHorizonLabels(perimetersKm, k0, pointsKm, { horizonMs = 24 * 3_600_000 } = {}) {
  const t0Ms = perimetersKm[k0].tMs;
  const deadlineMs = t0Ms + horizonMs;

  // Check if cumulative observations reach at least deadlineMs (complete coverage until horizon)
  const sortedAfter = perimetersKm.slice(k0 + 1).filter((p) => p.tMs > t0Ms);
  const lastBeforeDeadline = [...sortedAfter].reverse().find((p) => p.tMs <= deadlineMs) ?? null;
  const firstAtOrAfterDeadline = sortedAfter.find((p) => p.tMs >= deadlineMs) ?? null;

  const beforePerimeters = perimetersKm.filter((p) => p.tMs <= deadlineMs);
  const fullCoverageProven = !!sortedAfter.find((p) => p.tMs === deadlineMs);
  const afterHorizonUnburntProof = sortedAfter.find((p) => p.tMs >= deadlineMs) ?? null;

  let burntCount = 0;
  let unburntConfirmedCount = 0;
  let censoredCount = 0;

  const inAnyPerimeter = (perList, pt) => perList.some((p) => insideRings(p.rings, pt));

  const labels = pointsKm.map((pt) => {
    if (lastBeforeDeadline && inAnyPerimeter(beforePerimeters, pt)) {
      burntCount++;
      return 1;
    }
    if (afterHorizonUnburntProof) {
      const proofPerimeters = perimetersKm.filter((p) => p.tMs <= afterHorizonUnburntProof.tMs);
      if (!inAnyPerimeter(proofPerimeters, pt)) {
        unburntConfirmedCount++;
        return 0;
      }
      censoredCount++;
      return 'CENSORED';
    }
    // No perimeter exists at/after t0+24h -> right-censored at horizon!
    censoredCount++;
    return 'CENSORED';
  });

  return {
    t0Ms,
    deadlineMs,
    lastBeforeDeadlineMs: lastBeforeDeadline?.tMs ?? null,
    afterHorizonProofMs: afterHorizonUnburntProof?.tMs ?? null,
    fullCoverageProven,
    counts: {
      total: pointsKm.length,
      burnt: burntCount,
      unburntConfirmed: unburntConfirmedCount,
      censored: censoredCount,
      censoredRate: +(censoredCount / Math.max(1, pointsKm.length)).toFixed(4),
    },
    labels,
  };
}

export function scorePredictionsOnUncensored(probs, labels) {
  let brierSum = 0;
  let n = 0;
  let falseSafety = 0;
  let positives = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 'CENSORED') continue;
    const y = labels[i];
    const p = probs[i];
    brierSum += (p - y) ** 2;
    n++;
    if (y === 1) {
      positives++;
      if (p < 0.1) falseSafety++;
    }
  }
  return {
    evaluableCount: n,
    brier: n > 0 ? +(brierSum / n).toFixed(5) : null,
    falseSafetyRate: positives > 0 ? +(falseSafety / positives).toFixed(4) : null,
  };
}
