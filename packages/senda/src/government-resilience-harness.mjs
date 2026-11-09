/**
 * SENDA Government & Civil Protection Resilience Assessment Harness.
 *
 * Implements standard evaluation metrics and stress-testing protocols for
 * military, government civil protection (UME, DGT, Dutch Veiligheidsregio,
 * EU Civil Protection Mechanism ERCC) procurement and operational qualification.
 *
 * Evaluates 5 core pillars:
 * 1. Black-Sky Autonomous Grid Failure Resilience (P1)
 * 2. Corridor Evacuation Capacity & Bottleneck Index (P2)
 * 3. Multi-Carrier RF Spectrum Agility (P3)
 * 4. Cryptographic Anti-Tamper & Forensics (P4)
 * 5. Empirical Calibration & Out-of-Sample Soundness (P5)
 */
import { createHash } from 'node:crypto';
import { computePercolationThreshold, computeDtnEpidemicSpreading, computeDeygoutDiffractionLoss } from './telecom-mathematical-physics.mjs';
import { evaluateSpatialIoU, evaluateClassificationPerformance } from './scientific-evaluation.mjs';

function finite(n, min = -Infinity, max = Infinity) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export const RESILIENCE_INDEX_LEVELS = Object.freeze({
  LEVEL_1_HIGH: {
    minScore: 90,
    label: 'SENDA Internal Index Level 1 — Alta Resiliencia Técnica de Malla',
    description: 'Diagnóstico interno: cumple parámetros de redundancia multi-portador y densidad de percolación simulada'
  },
  LEVEL_2_MEDIUM: {
    minScore: 75,
    label: 'SENDA Internal Index Level 2 — Resiliencia Intermedia de Corredor',
    description: 'Diagnóstico interno: conectividad oportunista con cobertura parcial de corredor'
  },
  LEVEL_3_BASIC: {
    minScore: 60,
    label: 'SENDA Internal Index Level 3 — Contingencia Local Básica',
    description: 'Diagnóstico interno: funcionalidad mínima de alerta local sin garantía de evacuación'
  },
  LEVEL_INSUFFICIENT: {
    minScore: 0,
    label: 'SENDA Internal Index — No Apto / Fragmentado',
    description: 'No alcanza los umbrales mínimos de densidad o resiliencia de transporte'
  }
});

// Backward-compatibility aliases with explicit internal index labeling
export const COMPLIANCE_TIERS = Object.freeze({
  TIER_1_SOVEREIGN: RESILIENCE_INDEX_LEVELS.LEVEL_1_HIGH,
  TIER_2_CIVIL_PROTECTION: RESILIENCE_INDEX_LEVELS.LEVEL_2_MEDIUM,
  TIER_3_MUNICIPAL: RESILIENCE_INDEX_LEVELS.LEVEL_3_BASIC,
  TIER_INSUFFICIENT: RESILIENCE_INDEX_LEVELS.LEVEL_INSUFFICIENT,
});

/**
 * Runs an internal multi-criteria diagnostic of an emergency operational sector.
 *
 * NOTE: This is an internal technical assessment tool, NOT an official accreditation,
 * certification of military/defense readiness, or regulatory qualification.
 *
 * @param {object} sectorParameters
 * @param {string} sectorParameters.sectorId Identifier of the tested territory.
 * @param {number} sectorParameters.activeNodes Number of peer nodes (vehicles, responders, base stations).
 * @param {number} sectorParameters.areaKm2 Geographic area in square kilometers.
 * @param {number} sectorParameters.effectiveRfRangeM Effective transmission radius over terrain.
 * @param {number} sectorParameters.roadLanes Total road lane capacity available for evacuation.
 * @param {number} sectorParameters.activeClosures Count of road or bridge closures from DATEX II.
 * @param {boolean} sectorParameters.zeroCloudCapable Whether local mesh functions with 100% cloud severance.
 * @param {boolean} sectorParameters.merkleChainValid Whether cryptographic receipts verify back to Genesis.
 * @param {number} [sectorParameters.modelIoU=null] Out-of-sample model IoU score (no default artificial score).
 * @returns {object} Full audit report with cryptographic seal and accreditation disclaimers.
 */
export function evaluateGovernmentResilience(sectorParameters) {
  const {
    sectorId,
    activeNodes,
    areaKm2,
    effectiveRfRangeM,
    roadLanes,
    activeClosures,
    zeroCloudCapable,
    merkleChainValid,
    modelIoU = null
  } = sectorParameters;

  if (!sectorId || !finite(activeNodes, 1) || !finite(areaKm2, 0.1) || !finite(effectiveRfRangeM, 1)) {
    throw new TypeError('Invalid parameters for government resilience evaluation');
  }

  // Pillar 1: Black-Sky Infrastructure Score (P1)
  const observedDensityKm2 = activeNodes / areaKm2;
  const percolation = computePercolationThreshold(effectiveRfRangeM);
  const percState = percolation.percolationState(observedDensityKm2);

  let p1Score = 0;
  if (zeroCloudCapable) p1Score += 40;
  p1Score += Math.min(60, percState.densityRatio * 40 + (percState.isPercolating ? 20 : 0));
  p1Score = Math.min(100, Math.round(p1Score));

  // Pillar 2: Corridor Evacuation Capacity (P2)
  const nominalCapacityVehiclesPerHour = Math.max(1, roadLanes) * 1800;
  const closurePenaltyFactor = Math.max(0.1, 1.0 - (activeClosures * 0.25));
  const effectiveCapacityVehiclesPerHour = Math.round(nominalCapacityVehiclesPerHour * closurePenaltyFactor);
  const bottleneckIndex = Math.min(1.0, activeClosures / Math.max(1, roadLanes));
  let p2Score = Math.round((1.0 - bottleneckIndex * 0.8) * 100);
  p2Score = Math.min(100, Math.max(0, p2Score));

  // Pillar 3: Multi-Carrier Spectrum Agility (P3)
  const dtn = computeDtnEpidemicSpreading(Math.max(2, activeNodes), 3.5, 24);
  let p3Score = 0;
  if (dtn.r0 > 1.0) p3Score += 50;
  if (dtn.t90Hours < 2.0) p3Score += 30;
  if (dtn.extinctionProb < 0.2) p3Score += 20;
  p3Score = Math.min(100, Math.round(p3Score));

  // Pillar 4: Cryptographic Anti-Tamper & Forensics (P4)
  let p4Score = 0;
  if (merkleChainValid) p4Score += 80;
  p4Score += 20; // SHA-256 provenance baseline
  p4Score = Math.min(100, Math.round(p4Score));

  // Pillar 5: Scientific Calibration Out-of-Sample Soundness (P5)
  // No synthetic default precision: must be observed empirically
  let p5Score = 0;
  let p5Status = 'MISSING_OBSERVED_EMPIRICAL_METRICS';
  if (modelIoU !== null && finite(modelIoU, 0, 1.0)) {
    p5Score = Math.round(Math.min(1.0, modelIoU / 0.85) * 100);
    p5Score = Math.min(100, Math.max(0, p5Score));
    p5Status = 'OBSERVED_OUT_OF_SAMPLE_VALIDATION';
  }

  // Overall Internal Resilience Score (SIRI)
  // Weighted: P1 (25%), P2 (20%), P3 (20%), P4 (20%), P5 (15%)
  const overallGrs = Math.round(
    p1Score * 0.25 +
    p2Score * 0.20 +
    p3Score * 0.20 +
    p4Score * 0.20 +
    p5Score * 0.15
  );

  let qualification = RESILIENCE_INDEX_LEVELS.LEVEL_INSUFFICIENT;
  if (overallGrs >= RESILIENCE_INDEX_LEVELS.LEVEL_1_HIGH.minScore) {
    qualification = RESILIENCE_INDEX_LEVELS.LEVEL_1_HIGH;
  } else if (overallGrs >= RESILIENCE_INDEX_LEVELS.LEVEL_2_MEDIUM.minScore) {
    qualification = RESILIENCE_INDEX_LEVELS.LEVEL_2_MEDIUM;
  } else if (overallGrs >= RESILIENCE_INDEX_LEVELS.LEVEL_3_BASIC.minScore) {
    qualification = RESILIENCE_INDEX_LEVELS.LEVEL_3_BASIC;
  }

  // Generate deterministic audit seal
  const evaluationPayload = JSON.stringify({
    sectorId,
    timestampUtc: new Date().toISOString().slice(0, 19) + 'Z',
    scores: { p1: p1Score, p2: p2Score, p3: p3Score, p4: p4Score, p5: p5Score, overallGrs },
    metrics: {
      observedDensityKm2: Math.round(observedDensityKm2 * 100) / 100,
      criticalDensityKm2: Math.round(percolation.criticalDensityKm2 * 100) / 100,
      isPercolating: percState.isPercolating,
      effectiveCapacityVehiclesPerHour,
      bottleneckIndex: Math.round(bottleneckIndex * 100) / 100,
      dtnT90Hours: dtn.t90Hours,
      modelIoU,
    }
  });

  const auditSha256 = createHash('sha256').update(evaluationPayload).digest('hex');

  return {
    sectorId,
    evaluatedAt: new Date().toISOString(),
    overallScore: overallGrs,
    indexLevelLabel: qualification.label,
    qualificationLabel: qualification.label, // alias
    qualificationDescription: qualification.description,
    isExternalAccreditedCertification: false,
    certificationAuthority: 'SENDA_INTERNAL_SIMULATION_HARNESS_NO_EXTERNAL_HOMOLOGATION',
    disclaimer: 'This evaluation is an internal algorithmic benchmark of simulated network conditions. It does NOT constitute official certification, homologation or procurement qualification by UME, DGT, ERCC, NATO, or national civil protection authorities without independent third-party laboratory verification.',
    pillars: {
      blackSkyResilience: { score: p1Score, isPercolating: percState.isPercolating, densityRatio: Math.round(percState.densityRatio * 100) / 100 },
      evacuationThroughput: { score: p2Score, effectiveCapacityVehiclesPerHour, bottleneckIndex: Math.round(bottleneckIndex * 100) / 100 },
      multiCarrierAgility: { score: p3Score, epidemicR0: dtn.r0, t90DeliveryHours: dtn.t90Hours },
      cryptographicForensics: { score: p4Score, merkleValid: merkleChainValid },
      empiricalCalibration: { score: p5Score, modelIoU, status: p5Status },
    },
    auditSealSha256: auditSha256,
  };
}
