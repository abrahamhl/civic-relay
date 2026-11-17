import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  evaluateSourceIndependence,
  computeEventConfidence,
  detectCandidateAnomalies,
  generateReconciliationReceipt,
  reconcileMultiHazardFeeds,
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

test('Spatial Reconciliation: detects shared dependencies and denies false independence', () => {
  // NASA EONET and Copernicus EFFIS both rely on NASA FIRMS MODIS/VIIRS thermal data
  const effisEonet = evaluateSourceIndependence('NASA_EONET_WF', 'COPERNICUS_EFFIS');
  assert.equal(effisEonet.isIndependent, false);
  assert.equal(effisEonet.sharedDependency, 'NASA_FIRMS_MODIS_VIIRS');
  assert.ok(effisEonet.note.includes('NOT independent'));

  // USGS Earthquakes vs AEMET Meteorology operate completely separate physical networks
  const usgsAemet = evaluateSourceIndependence('USGS_EARTHQUAKES', 'AEMET_METEOALARM');
  assert.equal(usgsAemet.isIndependent, true);
  assert.equal(usgsAemet.sharedDependency, null);
});

test('Spatial Reconciliation: confidence score incorporates authority, age and corroboration', () => {
  // Fresh, official, calibrated observation with independent corroboration
  const highConf = computeEventConfidence({
    isOfficialAuthority: true,
    isGroundCalibrated: true,
    hasIndependentCorroboration: true,
    ageHours: 2,
    hasInstrumentMeasurements: true,
  });
  assert.ok(highConf >= 0.95 && highConf <= 1.0, `Expected high confidence, got ${highConf}`);

  // Stale observation (72 hours old) without ground calibration
  const staleConf = computeEventConfidence({
    isOfficialAuthority: false,
    isGroundCalibrated: false,
    hasIndependentCorroboration: false,
    hasSharedDependency: true,
    ageHours: 72,
    hasInstrumentMeasurements: true,
  });
  assert.ok(staleConf < highConf, 'Stale observation must have lower confidence');
  assert.ok(staleConf >= 0.1, 'Confidence never drops below minimum baseline');
});

test('Spatial Reconciliation: anomaly detection flags magnitude and spatial divergences', () => {
  const eventA = { location: { lat: 39.45, lon: -0.35 }, observedAt: '2026-11-09T00:00:00Z', magnitude: 6.2 };
  const eventB = { location: { lat: 41.50, lon: 1.20 }, observedAt: '2026-11-09T00:30:00Z', magnitude: 4.8 }; // ~260km away, ΔM=1.4

  const anomalies = detectCandidateAnomalies(eventA, eventB, 'EQ');
  assert.ok(anomalies.some((a) => a.type === 'SPATIAL_DIVERGENCE'));
  assert.ok(anomalies.some((a) => a.type === 'MAGNITUDE_DIVERGENCE'));
});

test('Spatial Reconciliation: generates tamper-evident cryptographic receipt', () => {
  const receipt = generateReconciliationReceipt({
    sourceDigests: ['effis:abc123', 'usgs:def456'],
    clusters: [{ clusterId: 'c1', items: ['a', 'b'], confidenceScore: 0.85 }],
    timestampMs: NOW,
  });

  assert.ok(receipt.receiptId.startsWith('rcp:'));
  assert.equal(receipt.rootSha256.length, 64);
  assert.equal(receipt.contributingDigestsCount, 2);
  assert.equal(receipt.clustersReconciled, 1);
  assert.equal(receipt.verifier, 'senda.crypto.provenance/v1');
});

test('Spatial Reconciliation: full multi-hazard pipeline links feeds safely', () => {
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

  const result = reconcileMultiHazardFeeds({
    eonetFeed,
    effisFeed,
    now: NOW,
  });

  assert.equal(result.status, 'RECONCILED_SUCCESS');
  assert.equal(result.totalCorrelations, 1);

  const match = result.candidateCorrelations[0];
  assert.equal(match.pairType, 'WILDFIRE_THERMAL_PROXIMITY');
  assert.ok(match.distanceKm < 5);
  // Must recognize shared upstream FIRMS dependency
  assert.equal(match.independence.isIndependent, false);
  assert.equal(match.independence.sharedDependency, 'NASA_FIRMS_MODIS_VIIRS');
  assert.ok(result.receipt.rootSha256);
});
