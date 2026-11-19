import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  evaluateSourceIndependence,
  computeHeuristicReliabilityIndex,
  computeCalibratedEventProbability,
  computeBrierScore,
  computeExpectedCalibrationError,
  computeEventConfidence,
  detectCandidateAnomalies,
  BinaryMerkleTree,
  generateReconciliationReceipt,
  verifyReceiptInclusionProof,
  reconcileMultiHazardFeeds,
  HOLDOUT_CALIBRATION_BENCHMARK,
} from '../server/domain/spatial-reconciliation-engine.mjs';

const NOW = Date.parse('2026-11-09T01:00:00Z');

test('Spatial Reconciliation: haversine distance calculation is physically accurate', () => {
  // Madrid (40.4168, -3.7038) to Valencia (39.4699, -0.3763) is approx 302 km
  const madrid = { lat: 40.4168, lon: -3.7038 };
  const valencia = { lat: 39.4699, lon: -0.3763 };
  const d = haversineDistanceKm(madrid, valencia);
  assert.ok(d > 295 && d < 310, `Expected ~302km, got ${d}`);

  // Same point is 0
  assert.equal(haversineDistanceKm(madrid, madrid), 0);
  // Invalid inputs return null
  assert.equal(haversineDistanceKm(null, valencia), null);
  assert.equal(haversineDistanceKm({ lat: 999, lon: 0 }, valencia), null);
});

test('Spatial Reconciliation P0-04: detects shared upstream dependencies and denies false independence (GDACS vs USGS)', () => {
  // Ticket P0-04: GDACS_EQ and USGS_EARTHQUAKES share the underlying USGS NEIC / ANSS global seismic network
  const gdacsUsgs = evaluateSourceIndependence('GDACS_EQ', 'USGS_EARTHQUAKES');
  assert.equal(gdacsUsgs.isIndependent, false, 'GDACS and USGS must NOT be treated as two independent confirmations');
  assert.equal(gdacsUsgs.sharedDependency, 'USGS_NEIC');
  assert.ok(gdacsUsgs.sharedLineage.includes('USGS_NEIC'));
  assert.equal(gdacsUsgs.sharedNetwork, 'GLOBAL_SEISMIC');
  assert.ok(gdacsUsgs.note.includes('NOT independent') || gdacsUsgs.note.includes('ancestry'));

  // NASA EONET and Copernicus EFFIS both rely on NASA FIRMS MODIS/VIIRS thermal data
  const effisEonet = evaluateSourceIndependence('NASA_EONET_WF', 'COPERNICUS_EFFIS');
  assert.equal(effisEonet.isIndependent, false);
  assert.equal(effisEonet.sharedDependency, 'NASA_FIRMS');
  assert.equal(effisEonet.sharedNetwork, 'SATELLITE_THERMAL');

  // USGS Earthquakes vs AEMET Meteorology operate completely separate physical networks
  const usgsAemet = evaluateSourceIndependence('USGS_EARTHQUAKES', 'AEMET_METEOALARM');
  assert.equal(usgsAemet.isIndependent, true);
  assert.equal(usgsAemet.sharedDependency, null);
});

test('Spatial Reconciliation P0-03: probabilistic calibration, Platt scaling, Brier score and ECE', () => {
  // 1. Raw uncalibrated heuristic index
  const rawHigh = computeHeuristicReliabilityIndex({
    isOfficialAuthority: true,
    isGroundCalibrated: true,
    hasIndependentCorroboration: true,
    ageHours: 2,
    hasInstrumentMeasurements: true,
  });
  assert.ok(rawHigh >= 0.90 && rawHigh <= 1.0);

  // 2. Platt calibrated probability
  const calibrated = computeCalibratedEventProbability(rawHigh);
  assert.equal(calibrated.calibrationModel, 'PLATT_LOGISTIC_SIGMOID_HOLDOUT_CALIBRATED');
  assert.ok(calibrated.calibratedProbability >= 0.85 && calibrated.calibratedProbability <= 1.0);

  // 3. Evaluate Brier Score on holdout ground-truth benchmark
  const brierScore = computeBrierScore(HOLDOUT_CALIBRATION_BENCHMARK);
  assert.ok(brierScore < 0.15, `Brier score must be < 0.15 for well-calibrated probabilities, got ${brierScore}`);

  // 4. Evaluate Expected Calibration Error (ECE)
  const ece = computeExpectedCalibrationError(HOLDOUT_CALIBRATION_BENCHMARK, 5);
  assert.ok(ece < 0.10, `ECE must be < 0.10, got ${ece}`);

  // 5. computeEventConfidence produces calibrated score
  const conf = computeEventConfidence({
    isOfficialAuthority: true,
    isGroundCalibrated: true,
    hasIndependentCorroboration: true,
    ageHours: 2,
    hasInstrumentMeasurements: true,
  });
  assert.ok(conf >= 0.85 && conf <= 1.0);

  // Stale uncalibrated observation drops probability significantly
  const staleConf = computeEventConfidence({
    isOfficialAuthority: false,
    isGroundCalibrated: false,
    hasIndependentCorroboration: false,
    hasSharedDependency: true,
    ageHours: 72,
    hasInstrumentMeasurements: false,
  });
  assert.ok(staleConf < 0.40, `Stale observation must drop significantly, got ${staleConf}`);
});

test('Spatial Reconciliation P0-05: RFC 6962 Binary Merkle Tree and verifiable inclusion proofs', () => {
  const leaves = ['leaf:alpha', 'leaf:beta', 'leaf:gamma', 'leaf:delta', 'leaf:epsilon'];
  const tree = new BinaryMerkleTree(leaves);
  const root = tree.getRoot();

  assert.equal(root.length, 64, 'Merkle root must be a 64-char hex SHA-256');
  assert.equal(tree.leaves.length, 5);

  // Audit path inclusion proof for leaf 2 ("leaf:gamma")
  const proof2 = tree.getProof(2);
  assert.ok(Array.isArray(proof2));
  assert.ok(proof2.length > 0);

  // Verification succeeds with valid leaf and root
  const isValid = BinaryMerkleTree.verifyProof(tree.leaves[2], proof2, root);
  assert.equal(isValid, true, 'Valid Merkle inclusion proof must verify');

  // Tampered proof must fail
  const tamperedProof = [{ position: 'right', digest: '0000000000000000000000000000000000000000000000000000000000000000' }];
  assert.equal(BinaryMerkleTree.verifyProof(tree.leaves[2], tamperedProof, root), false);

  // Tampered leaf hash must fail
  assert.equal(BinaryMerkleTree.verifyProof('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', proof2, root), false);
});

test('Spatial Reconciliation P0-05: generateReconciliationReceipt builds Merkle proofs verifiable by clients', () => {
  const receipt = generateReconciliationReceipt({
    sourceDigests: ['effis:abc123', 'usgs:def456'],
    clusters: [{ clusterId: 'c1', items: ['a', 'b'], confidenceScore: 0.85 }],
    timestampMs: NOW,
  });

  assert.ok(receipt.receiptId.startsWith('rcp:'));
  assert.equal(receipt.rootSha256.length, 64);
  assert.equal(receipt.merkleRootSha256, receipt.rootSha256);
  assert.equal(receipt.cryptographicStructure, 'RFC_6962_BINARY_MERKLE_TREE');
  assert.ok(receipt.proofs.length > 0);
  assert.equal(receipt.verifier, 'senda.crypto.merkle-provenance/v2');

  // Verify first inclusion proof using standalone verifier
  const firstProof = receipt.proofs[0];
  const verified = verifyReceiptInclusionProof(firstProof.leafHash, firstProof.auditPath, receipt.merkleRootSha256);
  assert.equal(verified, true, 'Receipt inclusion proof must verify against merkleRootSha256');
});

test('Spatial Reconciliation: anomaly detection flags magnitude and spatial divergences', () => {
  const eventA = { location: { lat: 39.45, lon: -0.35 }, observedAt: '2026-11-09T00:00:00Z', magnitude: 6.2 };
  const eventB = { location: { lat: 41.50, lon: 1.20 }, observedAt: '2026-11-09T00:30:00Z', magnitude: 4.8 }; // ~260km away, ΔM=1.4

  const anomalies = detectCandidateAnomalies(eventA, eventB, 'EQ');
  assert.ok(anomalies.some((a) => a.type === 'SPATIAL_DIVERGENCE'));
  assert.ok(anomalies.some((a) => a.type === 'MAGNITUDE_DIVERGENCE'));
});

test('Spatial Reconciliation: full multi-hazard pipeline links feeds safely and prevents false corroboration', () => {
  const eonetFeed = {
    status: 'ACTIVE_SNAPSHOT',
    source: { rawSha256: 'eonet_hash_123' },
    observations: [{
      id: 'eonet:wf-1',
      location: { lat: 39.50, lon: -0.40 },
      observedAt: '2026-11-08T22:00:00Z',
    }],
  };

  const effisFeed = {
    status: 'ACTIVE_SNAPSHOT',
    source: { rawSha256: 'effis_hash_456' },
    observations: [{
      id: 'copernicus-effis:eff-1',
      location: { lat: 39.52, lon: -0.41 }, // ~3 km away
      observedAt: '2026-11-08T22:15:00Z',
      fireRadiativePowerMW: 85.0,
    }],
  };

  const gdacsFeed = {
    status: 'ACTIVE_SNAPSHOT',
    source: { rawSha256: 'gdacs_hash_789' },
    observations: [{
      id: 'gdacs:eq-1',
      eventType: 'EQ',
      location: { lat: 38.00, lon: -1.00 },
      observedAt: '2026-11-08T20:00:00Z',
      severity: 5.4,
      alertLevel: 'Green',
    }],
  };

  const usgsFeed = {
    status: 'ACTIVE_SNAPSHOT',
    source: { rawSha256: 'usgs_hash_101' },
    observations: [{
      id: 'usgs:eq-1',
      location: { lat: 38.05, lon: -1.02 }, // ~6 km away
      observedAt: '2026-11-08T20:05:00Z',
      magnitude: 5.3,
    }],
  };

  const result = reconcileMultiHazardFeeds({
    eonetFeed,
    effisFeed,
    gdacsFeed,
    usgsFeed,
    now: NOW,
  });

  assert.equal(result.status, 'RECONCILED_SUCCESS');
  assert.equal(result.totalCorrelations, 2);

  // 1. Wildfire correlation
  const wfMatch = result.candidateCorrelations.find((c) => c.pairType === 'WILDFIRE_THERMAL_PROXIMITY');
  assert.ok(wfMatch);
  assert.equal(wfMatch.independence.isIndependent, false);
  assert.equal(wfMatch.independence.sharedDependency, 'NASA_FIRMS');

  // 2. Earthquake correlation (Ticket P0-04: GDACS vs USGS)
  const eqMatch = result.candidateCorrelations.find((c) => c.pairType === 'EARTHQUAKE_SEISMIC_PROXIMITY');
  assert.ok(eqMatch);
  assert.equal(eqMatch.independence.isIndependent, false, 'GDACS and USGS must share dependency');
  assert.equal(eqMatch.independence.sharedDependency, 'USGS_NEIC');

  // 3. Provenance receipt (Ticket P0-05)
  assert.equal(result.receipt.cryptographicStructure, 'RFC_6962_BINARY_MERKLE_TREE');
  assert.ok(result.receipt.proofs.length > 0);
  const proof0 = result.receipt.proofs[0];
  assert.equal(verifyReceiptInclusionProof(proof0.leafHash, proof0.auditPath, result.receipt.merkleRootSha256), true);
});
