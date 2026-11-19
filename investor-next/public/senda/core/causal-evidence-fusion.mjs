/**
 * SENDA P3 (H-FUS-1) — Causal Provenance DAG & Non-Duplicating Bayesian Evidence Fusion.
 *
 * Reuses `SOURCE_DEPENDENCY_GRAPH` and `checkCorroborationIndependence` from `source-evidence.mjs`
 * and `dependencyOf` from `cross-source.mjs`.
 *
 * Core guarantees:
 *  - Deduplicates redistributed/cropped copies sharing `ancestryHash` or `rootEventId`.
 *  - Groups observations sharing upstream causal lineage (e.g. GDACS_EQ <-> USGS_NEIC, GDACS_WF <-> NASA_FIRMS)
 *    into a single causal root cluster so correlated products are NEVER multiplied like Naive Bayes.
 *  - Explicitly enforces `availableAtMs <= evaluationTimeMs` (blocks future leakage).
 *  - Computes conflict/contradiction index across independent causal roots and outputs `ABSTAIN` or `UNKNOWN`
 *    when evidence is contradictory or lacks >=2 independent roots.
 */
import { checkCorroborationIndependence } from './source-evidence.mjs';
import { dependencyOf } from './cross-source.mjs';
import { EPISTEMIC_STATUS } from './evidence-contract.mjs';

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const clampProb = (p) => Math.min(0.995, Math.max(0.005, p));
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function sameCausalAncestry(a, b) {
  if (a.ancestryHash && b.ancestryHash && a.ancestryHash === b.ancestryHash) {
    return { shared: true, reason: 'IDENTICAL_ANCESTRY_HASH' };
  }
  if (a.rootEventId && b.rootEventId && a.rootEventId === b.rootEventId) {
    return { shared: true, reason: 'SHARED_ROOT_EVENT_ID' };
  }
  const ev = checkCorroborationIndependence(a.sourceId, b.sourceId);
  if (ev.independent) return { shared: false, reason: null };
  // Also cross-check explicit cross-source registry
  const cross = dependencyOf(a.sourceId, b.sourceId);
  if (cross?.independent === true) return { shared: false, reason: null };
  return { shared: true, reason: ev.reason ?? 'NON_INDEPENDENT_OR_UNKNOWN_LINEAGE' };
}

/**
 * Group incoming observations into independent causal ancestry clusters using connected components.
 */
export function buildCausalProvenanceDag(items, { evaluationTimeMs } = {}) {
  const valid = [];
  const rejected = [];

  for (const item of items ?? []) {
    if (!item || typeof item !== 'object') {
      rejected.push({ id: null, reason: 'INVALID_ITEM' });
      continue;
    }
    const obsMs = Date.parse(item.observedAtUtc ?? '');
    const availMs = Date.parse(item.availableAtUtc ?? '');
    if (!Number.isFinite(obsMs) || !Number.isFinite(availMs) || availMs < obsMs) {
      rejected.push({ id: item.id ?? null, reason: 'INVALID_OR_INVERTED_TIMESTAMPS' });
      continue;
    }
    if (finite(evaluationTimeMs) && availMs > evaluationTimeMs) {
      rejected.push({ id: item.id ?? null, reason: 'TEMPORAL_LEAKAGE_AVAILABLE_AFTER_T0' });
      continue;
    }
    if (!finite(item.pEvent) || item.pEvent < 0 || item.pEvent > 1) {
      rejected.push({ id: item.id ?? null, reason: 'INVALID_PROBABILITY' });
      continue;
    }
    if (item.rightsApproved !== true) {
      rejected.push({ id: item.id ?? null, reason: 'RIGHTS_OR_CONSENT_UNAPPROVED' });
      continue;
    }
    valid.push({ ...item, observedAtMs: obsMs, availableAtMs: availMs });
  }

  // Union-find over valid observations whenever `sameCausalAncestry(i, j)` holds
  const parent = valid.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const links = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      // Two genuinely unknown/unofficial sources without verifiable anchors must NOT corroborate each other
      const anc = sameCausalAncestry(valid[i], valid[j]);
      if (anc.shared && anc.reason !== 'UNKNOWN_SOURCE_LINEAGE') {
        union(i, j);
        links.push({ from: valid[i].id, to: valid[j].id, reason: anc.reason });
      } else if (anc.reason === 'UNKNOWN_SOURCE_LINEAGE' && valid[i].sourceId === valid[j].sourceId) {
        union(i, j);
        links.push({ from: valid[i].id, to: valid[j].id, reason: 'IDENTICAL_UNVERIFIED_SOURCE' });
      }
    }
  }

  const byRoot = new Map();
  for (let i = 0; i < valid.length; i++) {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(valid[i]);
  }

  return {
    acceptedCount: valid.length,
    rejected,
    dependencyEdges: links,
    clusters: [...byRoot.values()],
  };
}

/**
 * Fuse items via causal DAG vs Naive Bayes baseline (retained for diagnostic comparison only).
 * Within each causal cluster, pick a weighted conservative representative (never multiply siblings).
 * Between independent verified clusters, update prior log-odds without artificial certainty.
 */
export function fuseCausalEvidenceDag(items, {
  priorProb = 0.25,
  evaluationTimeMs,
  contradictionThreshold = 0.45,
  minIndependentClusters = 2,
} = {}) {
  const dag = buildCausalProvenanceDag(items, { evaluationTimeMs });
  if (!dag.clusters.length) {
    return Object.freeze({
      schema: 'senda-causal-fusion/1',
      status: 'UNKNOWN',
      epistemicStatus: EPISTEMIC_STATUS.NO_VERIFICADO,
      abstained: true,
      abstainReason: dag.rejected.length ? 'ALL_EVIDENCE_REJECTED_OR_LEAKED' : 'NO_EVIDENCE',
      causalProbability: null,
      naiveBayesProbability: null,
      overconfidenceGap: 0,
      independentClusterCount: 0,
      verifiedInstitutionalClusterCount: 0,
      contradictionScore: 0,
      clusters: [],
      rejected: dag.rejected,
      canIssueOfficialAlert: false,
    });
  }

  // Cluster representation: only verified/catalogued roots can shift institutional odds; unverified citizen/unknown capped at <= 0.65
  const clusterSummaries = dag.clusters.map((members, idx) => {
    const hasInstitutionalAnchor = members.some((m) => m.institutionalAnchorVerified === true);
    const hasPrimaryLineage = members.some((m) => m.sourceId && !String(m.sourceId).startsWith('CITIZEN'));
    // Representative probability within cluster = median (resists extreme duplicated copy amplification)
    const sortedP = members.map((m) => clampProb(m.pEvent)).sort((a, b) => a - b);
    const repProb = sortedP[Math.floor(sortedP.length / 2)];
    const cappedProb = hasInstitutionalAnchor ? repProb : hasPrimaryLineage ? Math.min(0.85, repProb) : Math.min(0.65, repProb);
    return {
      clusterId: `C${idx + 1}`,
      memberIds: members.map((m) => m.id),
      sources: [...new Set(members.map((m) => m.sourceId))],
      memberCount: members.length,
      representativeProb: +cappedProb.toFixed(4),
      hasInstitutionalAnchor,
      hasPrimaryLineage,
    };
  });

  // 1) Causal DAG log-odds update (ONE factor per independent cluster, not per duplicate copy!)
  const priorLogOdds = logit(clampProb(priorProb));
  let causalLogOdds = priorLogOdds;
  let verifiedIndependentCount = 0;
  for (const c of clusterSummaries) {
    // Only clusters with primary lineage or institutional anchor contribute full Bayesian LR relative to prior
    const lrLog = logit(c.representativeProb) - priorLogOdds;
    const attenuation = c.hasInstitutionalAnchor ? 1.0 : c.hasPrimaryLineage ? 0.75 : 0.30;
    causalLogOdds += attenuation * lrLog;
    if (c.hasPrimaryLineage || c.hasInstitutionalAnchor) verifiedIndependentCount++;
  }
  const causalProbability = +sigmoid(causalLogOdds).toFixed(4);

  // 2) Flawed Naive Bayes comparator (treats EVERY item as independent)
  let naiveLogOdds = priorLogOdds;
  for (const c of dag.clusters) {
    for (const m of c) naiveLogOdds += logit(clampProb(m.pEvent)) - priorLogOdds;
  }
  const naiveBayesProbability = +sigmoid(naiveLogOdds).toFixed(4);

  const probs = clusterSummaries.map((c) => c.representativeProb);
  const contradictionScore = +(Math.max(...probs) - Math.min(...probs)).toFixed(4);
  const highContradiction = contradictionScore >= contradictionThreshold;
  const insufficientIndependence = verifiedIndependentCount < minIndependentClusters;
  const abstained = highContradiction || insufficientIndependence;

  const status = highContradiction
    ? 'ABSTAIN'
    : insufficientIndependence
      ? 'UNKNOWN'
      : 'CORROBORATED_RESEARCH_ONLY';

  return Object.freeze({
    schema: 'senda-causal-fusion/1',
    status,
    epistemicStatus: abstained ? EPISTEMIC_STATUS.NO_VERIFICADO : EPISTEMIC_STATUS.OBSERVADO,
    abstained,
    abstainReason: highContradiction
      ? 'HIGH_INTER_SOURCE_CONTRADICTION'
      : insufficientIndependence
        ? 'INSUFFICIENT_INDEPENDENT_PRIMARY_SOURCES'
        : null,
    causalProbability,
    naiveBayesProbability,
    overconfidenceGap: +(naiveBayesProbability - causalProbability).toFixed(4),
    independentClusterCount: clusterSummaries.length,
    verifiedInstitutionalClusterCount: clusterSummaries.filter((c) => c.hasInstitutionalAnchor).length,
    contradictionScore,
    clusters: clusterSummaries,
    dependencyEdges: dag.dependencyEdges,
    rejected: dag.rejected,
    canIssueOfficialAlert: false, // Even corroborated fusion NEVER triggers public alerts autonomously
  });
}

/** Controlled synthetic H-FUS-1 experiment: compare Naive Bayes (multiplies correlated copies) vs Causal DAG Fusion. */
export function evaluateCausalFusionBenchmark(episodes) {
  let brierSingle = 0;
  let brierNaive = 0;
  let brierCausal = 0;
  let brierInst = 0;
  let n = 0;
  for (const ep of episodes) {
    const out = fuseCausalEvidenceDag(ep.items, { priorProb: 0.25, evaluationTimeMs: ep.t0Ms });
    const pCausal = out.causalProbability ?? 0.25;
    const pNaive = out.naiveBayesProbability ?? 0.25;
    const pSingle = ep.items[0]?.pEvent ?? 0.25;
    const pInst = ep.items.some((x) => x.institutionalAnchorVerified) ? Math.max(...ep.items.filter((x) => x.institutionalAnchorVerified).map((x) => x.pEvent)) : 0.25;
    brierSingle += (pSingle - ep.truthY) ** 2;
    brierNaive += (pNaive - ep.truthY) ** 2;
    brierCausal += (pCausal - ep.truthY) ** 2;
    brierInst += (pInst - ep.truthY) ** 2;
    n++;
  }
  const m = Math.max(1, n);
  return {
    episodes: n,
    brierSinglePrimary: +(brierSingle / m).toFixed(5),
    brierNaiveBayesCorrelated: +(brierNaive / m).toFixed(5),
    brierCausalDagFusion: +(brierCausal / m).toFixed(5),
    brierInstitutionalBaseline: +(brierInst / m).toFixed(5),
    naiveMinusCausalBrier: +((brierNaive - brierCausal) / m).toFixed(5),
  };
}
