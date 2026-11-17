import test from 'node:test';
import assert from 'node:assert/strict';
import { fuseCausalEvidenceDag, evaluateCausalFusionBenchmark } from '../src/causal-evidence-fusion.mjs';
import { evaluateAbstentionContract } from '../src/robust-abstention.mjs';

test('H-FUS-1: two cropped copies or GDACS_EQ+USGS_NEIC share 1 causal cluster and never multiply Naive Bayes odds', () => {
  const t0 = Date.parse('2026-11-17T10:00:00Z');
  const items = [
    {
      id: 'usgs-1', sourceId: 'USGS_NEIC', rootEventId: 'eq-900', ancestryHash: 'sha256:aaa',
      pEvent: 0.72, observedAtUtc: '2026-11-17T09:55:00Z', availableAtUtc: '2026-11-17T09:56:00Z', rightsApproved: true,
    },
    {
      id: 'gdacs-1', sourceId: 'GDACS_EQ', rootEventId: 'eq-900', ancestryHash: 'sha256:bbb',
      pEvent: 0.72, observedAtUtc: '2026-11-17T09:55:00Z', availableAtUtc: '2026-11-17T09:57:00Z', rightsApproved: true,
    },
    {
      id: 'repost-1', sourceId: 'UNVERIFIED_MIRROR', ancestryHash: 'sha256:aaa',
      pEvent: 0.72, observedAtUtc: '2026-11-17T09:56:00Z', availableAtUtc: '2026-11-17T09:58:00Z', rightsApproved: true,
    },
  ];
  const res = fuseCausalEvidenceDag(items, { priorProb: 0.25, evaluationTimeMs: t0 });
  assert.equal(res.independentClusterCount, 1);
  assert.equal(res.abstained, true);
  assert.equal(res.status, 'UNKNOWN');
  assert.ok(res.naiveBayesProbability > res.causalProbability, `Naive(${res.naiveBayesProbability}) inflated odds over Causal(${res.causalProbability})`);
  assert.equal(res.canIssueOfficialAlert, false);
});

test('H-FUS-1: rejects temporal leakage and enters ABSTAIN on inter-source contradiction', () => {
  const t0 = Date.parse('2026-11-17T10:00:00Z');
  const items = [
    {
      id: 'firms-1', sourceId: 'NASA_FIRMS', pEvent: 0.85,
      observedAtUtc: '2026-11-17T09:40:00Z', availableAtUtc: '2026-11-17T09:50:00Z', rightsApproved: true,
    },
    {
      id: 'ems-1', sourceId: 'COPERNICUS_EMS_RAPID', pEvent: 0.15,
      observedAtUtc: '2026-11-17T09:45:00Z', availableAtUtc: '2026-11-17T09:52:00Z', rightsApproved: true,
    },
    {
      id: 'future-leak', sourceId: 'EMSC', pEvent: 0.99,
      observedAtUtc: '2026-11-17T09:55:00Z', availableAtUtc: '2026-11-17T10:05:00Z', rightsApproved: true,
    },
  ];
  const res = fuseCausalEvidenceDag(items, { priorProb: 0.25, evaluationTimeMs: t0 });
  assert.equal(res.rejected.length, 1);
  assert.equal(res.rejected[0].reason, 'TEMPORAL_LEAKAGE_AVAILABLE_AFTER_T0');
  assert.equal(res.status, 'ABSTAIN');
  assert.equal(res.abstainReason, 'HIGH_INTER_SOURCE_CONTRADICTION');
});

test('H-FUS-1 benchmark: causal DAG fusion reduces Brier vs correlated Naive Bayes across 30 episodes with false duplicates', () => {
  const episodes = [];
  for (let i = 0; i < 30; i++) {
    const isFalseAlarm = i % 2 === 0;
    const baseSignal = isFalseAlarm ? 0.62 : 0.78;
    const t0Ms = Date.parse('2026-11-17T10:00:00Z');
    episodes.push({
      t0Ms,
      truthY: isFalseAlarm ? 0 : 1,
      items: [
        { id: `u${i}`, sourceId: 'USGS_NEIC', rootEventId: `e${i}`, pEvent: baseSignal, observedAtUtc: '2026-11-17T09:50:00Z', availableAtUtc: '2026-11-17T09:51:00Z', rightsApproved: true },
        { id: `g${i}`, sourceId: 'GDACS_EQ', rootEventId: `e${i}`, pEvent: baseSignal, observedAtUtc: '2026-11-17T09:50:00Z', availableAtUtc: '2026-11-17T09:52:00Z', rightsApproved: true },
        { id: `m1_${i}`, sourceId: 'MIRROR_A', ancestryHash: `sha256:${i}`, pEvent: baseSignal, observedAtUtc: '2026-11-17T09:50:00Z', availableAtUtc: '2026-11-17T09:53:00Z', rightsApproved: true },
        { id: `m2_${i}`, sourceId: 'MIRROR_B', ancestryHash: `sha256:${i}`, pEvent: baseSignal, observedAtUtc: '2026-11-17T09:50:00Z', availableAtUtc: '2026-11-17T09:54:00Z', rightsApproved: true },
      ],
    });
  }
  const bench = evaluateCausalFusionBenchmark(episodes);
  assert.ok(bench.brierCausalDagFusion < bench.brierNaiveBayesCorrelated, JSON.stringify(bench));
});

test('H-ABST-1 adversarial gate: 1000 synthetic edge cases yield 0 unsupported operational certainty claims', () => {
  const nowUtc = '2026-11-17T10:00:00Z';
  const validFuture = '2026-11-17T11:00:00Z';
  let operationalClaims = 0;

  for (let i = 0; i < 1000; i++) {
    const mode = i % 10;
    const out = evaluateAbstentionContract({
      domain: ['ROUTING', 'FIRE_SPREAD', 'EVIDENCE_FUSION', 'EVACUATION_HYPOTHETICAL'][i % 4],
      known: ['DEM slope'],
      computed: ['Upwind arrival grid'],
      assumed: ['Catalog bearer profile'],
      unverified: ['Physical RF measurement'],
      sources: ['GeoMAC snapshot'],
      nowUtc,
      validUntilUtc: mode === 1 ? '2026-11-17T09:59:00Z' : validFuture,
      uncertaintyWidth: mode === 2 ? 0.65 : 0.2,
      contradictionScore: mode === 3 ? 0.55 : 0.1,
      missingCriticalInputs: mode === 4 ? ['WIND_VECTOR'] : [],
      temporalLeakageDetected: mode === 5,
      clockIncoherent: mode === 6,
      datasetBlocked: mode === 7,
      modelRejected: mode === 8,
      insufficientIndependentEvidence: mode === 9,
      operationallyAuthorized: true, // even if caller tries setting true, research gate NEVER emits public alert
    });

    if (out.canIssuePublicAlert || out.canIssueEvacuationOrder || out.operationalCertaintyClaimed) {
      operationalClaims++;
    }
    if (mode !== 0) {
      assert.equal(out.abstained, true, `Adversarial case ${i} (mode ${mode}) failed to abstain`);
    } else {
      assert.equal(out.status, 'RECOMMENDED_HYPOTHETICAL');
      assert.ok(out.whatNeedsVerification.length >= 1);
      assert.equal(out.hypotheticalNonPrescriptiveOnly, true);
    }
  }
  assert.equal(operationalClaims, 0);
});
