import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGovernmentResilience, COMPLIANCE_TIERS } from '../src/government-resilience-harness.mjs';

test('Government Harness: evaluates Tier-1 Sovereign Military / UME standard', () => {
  const result = evaluateGovernmentResilience({
    sectorId: 'CORRIDOR_A12_ARNHEM_EDE',
    activeNodes: 120,
    areaKm2: 25,
    effectiveRfRangeM: 1200,
    roadLanes: 6,
    activeClosures: 0,
    zeroCloudCapable: true,
    merkleChainValid: true,
    modelIoU: 0.84,
  });

  assert.equal(result.sectorId, 'CORRIDOR_A12_ARNHEM_EDE');
  assert.ok(result.overallScore >= 90, `Score must qualify for Tier-1 Sovereign (got ${result.overallScore})`);
  assert.equal(result.qualificationLabel, COMPLIANCE_TIERS.TIER_1_SOVEREIGN.label);
  assert.equal(result.pillars.blackSkyResilience.isPercolating, true);
  assert.ok(result.pillars.evacuationThroughput.effectiveCapacityVehiclesPerHour > 8000);
  assert.equal(result.pillars.cryptographicForensics.merkleValid, true);
  assert.ok(result.auditSealSha256.length === 64, 'Audit seal must be a valid 64-char SHA-256 hash');
});

test('Government Harness: detects bottleneck and degrades score upon road closures and network fragmentation', () => {
  const degraded = evaluateGovernmentResilience({
    sectorId: 'DISASTER_SECTOR_FLOOD_AP7',
    activeNodes: 10,
    areaKm2: 50, // low density -> no percolation
    effectiveRfRangeM: 800,
    roadLanes: 4,
    activeClosures: 3, // 3 out of 4 lanes/bridges cut
    zeroCloudCapable: false, // cloud dependent
    merkleChainValid: false,
    modelIoU: 0.55,
  });

  assert.ok(degraded.overallScore < 60, `Degraded sector must score below Tier 3 (got ${degraded.overallScore})`);
  assert.equal(degraded.qualificationLabel, COMPLIANCE_TIERS.TIER_INSUFFICIENT.label);
  assert.equal(degraded.pillars.blackSkyResilience.isPercolating, false);
  assert.ok(degraded.pillars.evacuationThroughput.bottleneckIndex >= 0.75);
});

test('Government Harness: rejects unobserved synthetic precision and asserts accreditation disclaimers', () => {
  const noEmpiricalData = evaluateGovernmentResilience({
    sectorId: 'SECTOR_NO_EMPIRICAL_EVAL',
    activeNodes: 120,
    areaKm2: 25,
    effectiveRfRangeM: 1200,
    roadLanes: 6,
    activeClosures: 0,
    zeroCloudCapable: true,
    merkleChainValid: true,
    // modelIoU intentionally omitted
  });

  // Pillar 5 must NOT receive artificial default points when empirical data is missing
  assert.equal(noEmpiricalData.pillars.empiricalCalibration.score, 0);
  assert.equal(noEmpiricalData.pillars.empiricalCalibration.status, 'MISSING_OBSERVED_EMPIRICAL_METRICS');
  assert.equal(noEmpiricalData.pillars.empiricalCalibration.modelIoU, null);

  // Must declare that this is NOT an accredited external certification
  assert.equal(noEmpiricalData.isExternalAccreditedCertification, false);
  assert.ok(noEmpiricalData.disclaimer.includes('NOT constitute official certification'));
});

