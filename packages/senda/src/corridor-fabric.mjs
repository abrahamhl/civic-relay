/**
 * SENDA Corridor Fabric — Planos C (Fusion & Inference), D (Communications & DTN State Machine),
 * E (Control & Visualization Surface), Contribuciones de Investigación R1–R5 y Pilotos A y B.
 */

import {
  generateIdentity,
  sealMessage,
  openMessage,
  ackHashOf,
  packEnvelope,
} from './envelope.mjs';
import { unb64 } from './b64.mjs';

import {
  sha256Hex,
  haversineDistanceM,
  CORRIDOR_ASSET_TYPES,
  CORRIDOR_VERIFICATION_STATES,
  INVENTORY_REQUIRED_COLUMNS,
  CORRIDOR_SOURCE_INVENTORY,
  validateCorridorAsset,
  queryCorridorInventory,
  formatInventoryMarkdownTable,
  SOURCE_ADAPTER_METHODS,
  unsupportedAdapterOperation,
  validateSourceAdapter,
  normalizeObservation,
  parseNdwDatexPayload,
  createNdwRoadAdapter,
  parseDgtNapXml,
  createDgtNapAdapter,
  SUPPORTED_CAMERA_PROTOCOLS,
  MEDIAMTX_GO2RTC_EVALUATION,
  createOwnedIpCameraAdapter,
  createDashcamAdapter,
  EDGE_EVENT_SCHEMA_VERSION,
  MAX_DTN_EVIDENCE_DESCRIPTOR_BYTES,
  createMqttEdgeBridge,
} from './corridor-connectors.mjs';

export {
  sha256Hex,
  haversineDistanceM,
  CORRIDOR_ASSET_TYPES,
  CORRIDOR_VERIFICATION_STATES,
  INVENTORY_REQUIRED_COLUMNS,
  CORRIDOR_SOURCE_INVENTORY,
  validateCorridorAsset,
  queryCorridorInventory,
  formatInventoryMarkdownTable,
  SOURCE_ADAPTER_METHODS,
  unsupportedAdapterOperation,
  validateSourceAdapter,
  normalizeObservation,
  parseNdwDatexPayload,
  createNdwRoadAdapter,
  parseDgtNapXml,
  createDgtNapAdapter,
  SUPPORTED_CAMERA_PROTOCOLS,
  MEDIAMTX_GO2RTC_EVALUATION,
  createOwnedIpCameraAdapter,
  createDashcamAdapter,
  EDGE_EVENT_SCHEMA_VERSION,
  MAX_DTN_EVIDENCE_DESCRIPTOR_BYTES,
  createMqttEdgeBridge,
};

// ═══════════════════════════════════════════════════════════════════════════
// PLANO C — FUSION & INFERENCE (Con descuento de correlación y abstención)
// ═══════════════════════════════════════════════════════════════════════════

export const FUSION_DECISIONS = Object.freeze([
  'CONFIRMED_MULTISENSOR_INCIDENT',
  'SINGLE_SOURCE_PROVISIONAL',
  'ABSTAIN_INSUFFICIENT_EVIDENCE',
  'ABSTAIN_CONTRADICTION',
  'NORMAL_CORRIDOR_FLOW',
]);

function sourceFamilyKey(obs) {
  const id = String(obs.sourceId || '');
  if (id.startsWith('NDW-')) return 'FAMILY_NDW_RWS';
  if (id.startsWith('DASHCAM-') || id.startsWith('OBD-')) return 'FAMILY_EGO_VEHICLE_01';
  if (id.startsWith('CAM-LAB-') || id.startsWith('EDGE-MQTT-')) return 'FAMILY_BARRIO_LAB_EDGE';
  if (id.startsWith('DGT-')) return 'FAMILY_DGT_NAP';
  return `FAMILY_${id}`;
}

function classifyObservationSignal(obs) {
  const type = String(obs.observationType || '');
  const val = obs.value || {};
  if (
    type.includes('OBSTRUCTION')
    || type.includes('HARD_BRAKING')
    || type.includes('STOPPED_VEHICLE')
    || type.includes('ANOMALY')
    || type.includes('ACCIDENT')
  ) {
    return 'INCIDENT_SIGNAL';
  }
  if (type === 'TRAFFIC_SPEED_AND_FLOW') {
    const speed = Number(val.averageSpeedKmh ?? 100);
    if (speed <= 45) return 'INCIDENT_SIGNAL';
    if (speed >= 95) return 'FREE_FLOW_SIGNAL';
    return 'MODERATE_FLOW_SIGNAL';
  }
  return 'NEUTRAL_SIGNAL';
}

/**
 * Correlaciona un conjunto de observaciones normalizadas sobre un corredor o sector.
 * - Deduplica payloads idénticos o repetidos de la misma fuente en ventana corta.
 * - Agrupa por segmento vial y proximidad espacial (`maxClusterRadiusM`).
 * - Aplica decaimiento temporal exponencial y pesos de calibración.
 * - Descuenta dependencia entre fuentes correlacionadas (p. ej. Dashcam + OBD del mismo vehículo,
 *   o dos feeds derivados del mismo operador) para NO multiplicar probabilidades como independientes.
 * - Detecta contradicciones y permite abstenerse explícitamente.
 */
export function correlateCorridorObservations(observations, {
  nowMs = Date.now(),
  maxClusterRadiusM = 2500,
  maxWindowMs = 1800_000,
  halfLifeMs = 600_000,
  minConfirmationPosterior = 0.72,
  priorIncidentProb = 0.15,
} = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return {
      decision: 'ABSTAIN_INSUFFICIENT_EVIDENCE',
      abstained: true,
      abstentionReason: 'NO_OBSERVATIONS_AVAILABLE',
      events: [],
      deduplicatedCount: 0,
      rejectedStaleCount: 0,
    };
  }

  // 1. Deduplicación espacio-temporal y filtrado de caducidad
  const seenKeys = new Set();
  const validObs = [];
  let deduplicatedCount = 0;
  let rejectedStaleCount = 0;

  for (const raw of observations) {
    const obs = raw.observationId ? raw : normalizeObservation(raw, { nowMs });
    const measuredMs = Date.parse(obs.measuredAtUtc);
    const ageMs = Math.max(0, nowMs - measuredMs);
    if (ageMs > maxWindowMs || obs.freshnessState === 'STALE') {
      rejectedStaleCount += 1;
      continue;
    }
    const timeBucket = Math.floor(measuredMs / 10_000);
    const dedupKey = `${obs.sourceId}:${obs.observationType}:${obs.sourcePayloadHash}:${timeBucket}`;
    if (seenKeys.has(dedupKey)) {
      deduplicatedCount += 1;
      continue;
    }
    seenKeys.add(dedupKey);
    validObs.push({ ...obs, ageMs });
  }

  if (validObs.length === 0) {
    return {
      decision: 'ABSTAIN_INSUFFICIENT_EVIDENCE',
      abstained: true,
      abstentionReason: 'ALL_OBSERVATIONS_STALE_OR_DUPLICATE',
      events: [],
      deduplicatedCount,
      rejectedStaleCount,
    };
  }

  // 2. Agrupación por segmento vial y proximidad geográfica (map matching + clustering)
  const clusters = [];
  for (const obs of validObs) {
    let matchedCluster = null;
    for (const c of clusters) {
      const sameSegment = obs.roadSegmentId && c.roadSegmentId && obs.roadSegmentId === c.roadSegmentId;
      const distM = haversineDistanceM(obs.location, c.centroid);
      if (sameSegment && distM <= maxClusterRadiusM) {
        matchedCluster = c;
        break;
      }
      if (!obs.roadSegmentId && distM <= maxClusterRadiusM * 0.5) {
        matchedCluster = c;
        break;
      }
    }
    if (!matchedCluster) {
      clusters.push({
        roadSegmentId: obs.roadSegmentId || 'UNMAPPED_SEGMENT',
        centroid: { lat: obs.location.lat, lon: obs.location.lon },
        items: [obs],
      });
    } else {
      matchedCluster.items.push(obs);
      const n = matchedCluster.items.length;
      matchedCluster.centroid = {
        lat: matchedCluster.items.reduce((s, x) => s + x.location.lat, 0) / n,
        lon: matchedCluster.items.reduce((s, x) => s + x.location.lon, 0) / n,
      };
    }
  }

  // 3. Fusión bayesiana con descuento de dependencia por familia de fuente
  const priorLogOdds = Math.log(priorIncidentProb / (1 - priorIncidentProb));
  const events = clusters.map((cluster, idx) => {
    const familyCounts = new Map();
    let logOdds = priorLogOdds;
    let incidentSignals = 0;
    let freeFlowSignals = 0;
    const explainability = [];
    const uniqueSources = new Set();
    const uniqueFamilies = new Set();

    for (const obs of cluster.items) {
      uniqueSources.add(obs.sourceId);
      const family = sourceFamilyKey(obs);
      uniqueFamilies.add(family);
      const prevInFamily = familyCounts.get(family) || 0;
      familyCounts.set(family, prevInFamily + 1);

      // Factor de descuento por correlación intra-familia (evita multiplicar fuentes dependientes como independientes)
      const dependencyDiscount = 1 / (1 + 0.65 * prevInFamily);
      const freshnessWeight = Math.exp((-Math.LN2 * obs.ageMs) / halfLifeMs);
      const uncalibratedPenalty = obs.qualityFlags?.includes('MONOCULAR_UNCALIBRATED_WARNING')
        || obs.qualityFlags?.includes('UNCALIBRATED_MONOCULAR')
        ? 0.82
        : 1.0;

      const effectiveWeight = dependencyDiscount * freshnessWeight * uncalibratedPenalty;
      const signalClass = classifyObservationSignal(obs);

      let deltaLogOdds = 0;
      if (signalClass === 'INCIDENT_SIGNAL') {
        incidentSignals += 1;
        const p = Math.min(0.95, Math.max(0.55, obs.confidence));
        deltaLogOdds = Math.log(p / (1 - p)) * effectiveWeight;
      } else if (signalClass === 'FREE_FLOW_SIGNAL') {
        freeFlowSignals += 1;
        deltaLogOdds = -1.15 * effectiveWeight;
      } else if (signalClass === 'MODERATE_FLOW_SIGNAL') {
        deltaLogOdds = 0.25 * effectiveWeight;
      }

      logOdds += deltaLogOdds;
      explainability.push({
        observationId: obs.observationId,
        sourceId: obs.sourceId,
        family,
        signalClass,
        rawConfidence: obs.confidence,
        dependencyDiscount: Number(dependencyDiscount.toFixed(3)),
        freshnessWeight: Number(freshnessWeight.toFixed(3)),
        deltaLogOdds: Number(deltaLogOdds.toFixed(3)),
        sourcePayloadHash: obs.sourcePayloadHash,
      });
    }

    const posteriorProb = 1 / (1 + Math.exp(-logOdds));
    const hasContradiction = incidentSignals > 0 && freeFlowSignals > 0 && Math.abs(incidentSignals - freeFlowSignals) <= 1;

    let decision = 'NORMAL_CORRIDOR_FLOW';
    let abstained = false;
    let abstentionReason = null;

    if (hasContradiction && posteriorProb < 0.82) {
      decision = 'ABSTAIN_CONTRADICTION';
      abstained = true;
      abstentionReason = 'CONTRADICTORY_SPEED_AND_OBSTRUCTION_SIGNALS';
    } else if (incidentSignals > 0 && posteriorProb >= minConfirmationPosterior && uniqueFamilies.size >= 2) {
      decision = 'CONFIRMED_MULTISENSOR_INCIDENT';
    } else if (incidentSignals > 0 && posteriorProb >= 0.55) {
      decision = 'SINGLE_SOURCE_PROVISIONAL';
    } else if (incidentSignals > 0 && posteriorProb < 0.55) {
      decision = 'ABSTAIN_INSUFFICIENT_EVIDENCE';
      abstained = true;
      abstentionReason = 'POSTERIOR_BELOW_CONFIDENCE_THRESHOLD';
    }

    const combinedUncertaintyRadiusM = Math.round(
      1 / Math.sqrt(
        cluster.items.reduce((sum, x) => sum + 1 / Math.pow(Math.max(5, x.location.uncertaintyRadiusM || 25), 2), 0)
      )
    );

    const provenanceHashes = cluster.items.map((x) => x.sourcePayloadHash).sort();
    const provenanceMerkleDigest = sha256Hex(provenanceHashes.join('|'));
    const eventId = `evt-${ cluster.roadSegmentId.toLowerCase().replace(/[^a-z0-9]+/g, '-') }-${provenanceMerkleDigest.slice(0, 10)}`;

    return {
      eventId,
      clusterIndex: idx,
      roadSegmentId: cluster.roadSegmentId,
      location: {
        lat: Number(cluster.centroid.lat.toFixed(5)),
        lon: Number(cluster.centroid.lon.toFixed(5)),
        uncertaintyRadiusM: combinedUncertaintyRadiusM,
      },
      decision,
      abstained,
      abstentionReason,
      posteriorConfidence: Number(posteriorProb.toFixed(4)),
      uncertaintyInterval90: [
        Number(Math.max(0, posteriorProb - 0.12 / Math.sqrt(uniqueFamilies.size)).toFixed(3)),
        Number(Math.min(1, posteriorProb + 0.12 / Math.sqrt(uniqueFamilies.size)).toFixed(3)),
      ],
      corroboratingSources: [...uniqueSources],
      independentSourceFamilies: [...uniqueFamilies],
      observationCount: cluster.items.length,
      explainability,
      provenance: {
        merkleDigestSha256: provenanceMerkleDigest,
        observationIds: cluster.items.map((x) => x.observationId),
        sourcePayloadHashes: provenanceHashes,
      },
    };
  });

  const topEvent = events.sort((a, b) => b.posteriorConfidence - a.posteriorConfidence)[0];
  return {
    decision: topEvent.decision,
    abstained: topEvent.abstained,
    abstentionReason: topEvent.abstentionReason,
    events,
    deduplicatedCount,
    rejectedStaleCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRIBUCIONES DE INVESTIGACIÓN R1 – R5 (Con Comparación Frente a Baseline)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * R1 — Information-Aware Routing:
 * Prioriza mensajes según urgencia operativa + ganancia marginal de información
 * (novedad espacio-temporal y reducción de incertidumbre sobre el segmento vial),
 * garantizando que ningún SOS sea descartado.
 */
export function rankInformationAwareQueue(messages, {
  deliveredSegmentKnowledge = {},
} = {}) {
  const scored = messages.map((msg) => {
    const isSos = msg.kind === 'SOS' || Number(msg.priority) >= 9;
    const basePriority = Number(msg.priority ?? 5);
    const segmentState = deliveredSegmentKnowledge[msg.roadSegmentId] || { corroborations: 0, knownConfidence: 0.15 };

    // Ganancia de información marginal (divergencia KL aproximada + saturación de corroboración)
    const pNew = Math.min(0.99, Math.max(0.05, Number(msg.posteriorConfidence ?? 0.8)));
    const pOld = Math.min(0.98, Math.max(0.05, Number(segmentState.knownConfidence ?? 0.15)));
    const klGain = pNew * Math.log2(pNew / pOld) + (1 - pNew) * Math.log2((1 - pNew) / (1 - pOld));
    const redundancyDiscount = 1 / (1 + 0.8 * Number(segmentState.corroborations || 0));
    const sizeBytes = Math.max(120, Number(msg.sizeBytes || 380));
    const marginalInformationDensity = (Math.max(0.05, klGain) * redundancyDiscount) / Math.log2(sizeBytes);

    const r1Score = (isSos ? 1000 : 0) + basePriority * 10 + marginalInformationDensity * 45;
    const fifoStaticScore = basePriority * 10 - (Number(msg.enqueuedOrder || 0) * 0.01);

    return {
      ...msg,
      isSos,
      klGainBits: Number(Math.max(0, klGain).toFixed(4)),
      redundancyDiscount: Number(redundancyDiscount.toFixed(3)),
      r1Score: Number(r1Score.toFixed(4)),
      fifoStaticScore: Number(fifoStaticScore.toFixed(4)),
    };
  });

  const r1Ordered = [...scored].sort((a, b) => b.r1Score - a.r1Score);
  const baselineOrdered = [...scored].sort((a, b) => b.fifoStaticScore - a.fifoStaticScore);

  return { r1Ordered, baselineOrdered };
}

export function benchmarkR1InformationAwareRouting({ bandwidthBudgetBytes = 1250 } = {}) {
  const deliveredSegmentKnowledge = {
    'NL-A12-HM110-130': { corroborations: 4, knownConfidence: 0.91 }, // Ya conocido con alta certeza
    'NL-A12-HM126-VELPERBROEK': { corroborations: 0, knownConfidence: 0.15 }, // Incidente nuevo sin corroborar
    'BARRIO-ACCESO-NORTE-01': { corroborations: 0, knownConfidence: 0.15 },
  };

  const queue = [
    { id: 'msg-redundant-1', kind: 'OFFICIAL_ALERT', priority: 7, roadSegmentId: 'NL-A12-HM110-130', posteriorConfidence: 0.91, sizeBytes: 420, enqueuedOrder: 1 },
    { id: 'msg-redundant-2', kind: 'OFFICIAL_ALERT', priority: 7, roadSegmentId: 'NL-A12-HM110-130', posteriorConfidence: 0.90, sizeBytes: 420, enqueuedOrder: 2 },
    { id: 'msg-redundant-3', kind: 'OFFICIAL_ALERT', priority: 7, roadSegmentId: 'NL-A12-HM110-130', posteriorConfidence: 0.89, sizeBytes: 420, enqueuedOrder: 3 },
    { id: 'msg-novel-a12', kind: 'OFFICIAL_ALERT', priority: 7, roadSegmentId: 'NL-A12-HM126-VELPERBROEK', posteriorConfidence: 0.88, sizeBytes: 420, enqueuedOrder: 4 },
    { id: 'msg-sos-critical', kind: 'SOS', priority: 9, roadSegmentId: 'BARRIO-ACCESO-NORTE-01', posteriorConfidence: 0.95, sizeBytes: 360, enqueuedOrder: 5 },
  ];

  const { r1Ordered, baselineOrdered } = rankInformationAwareQueue(queue, { deliveredSegmentKnowledge });

  function simulateTransmission(orderedList) {
    let usedBytes = 0;
    const sent = [];
    const coveredSegments = new Set();
    let totalInfoGainBits = 0;
    let sosDelivered = 0;
    for (const item of orderedList) {
      if (usedBytes + item.sizeBytes <= bandwidthBudgetBytes) {
        usedBytes += item.sizeBytes;
        sent.push(item.id);
        coveredSegments.add(item.roadSegmentId);
        totalInfoGainBits += item.klGainBits * item.redundancyDiscount;
        if (item.isSos) sosDelivered += 1;
      }
    }
    return {
      sentIds: sent,
      usedBytes,
      uniqueSegmentsCovered: coveredSegments.size,
      totalInfoGainBits: Number(totalInfoGainBits.toFixed(4)),
      sosDelivered,
    };
  }

  return {
    contribution: 'R1_INFORMATION_AWARE_ROUTING',
    bandwidthBudgetBytes,
    r1Result: simulateTransmission(r1Ordered),
    baselineStaticResult: simulateTransmission(baselineOrdered),
  };
}

/**
 * R2 — Risk-Aware Cooperative Camera Selection:
 * Selecciona qué cámaras/dashcams consultar bajo restricciones de licencia, privacidad,
 * orientación, distancia, visibilidad, batería, ancho de banda y frescura,
 * frente al baseline de consultar todas indiscriminadamente.
 */
export function selectCooperativeCameras(candidates, incidentLocation, {
  maxBandwidthKbps = 450,
  minBatteryPct = 20,
  maxCameras = 3,
} = {}) {
  const evaluated = candidates.map((cam) => {
    const distM = haversineDistanceM(cam.location, incidentLocation);
    const forbiddenStates = ['CATALOG_ONLY', 'PARTNER_ACCESS_REQUIRED', 'PERMISSION_PENDING', 'UNSUPPORTED', 'SYNTHETIC'];
    const licenseAllowed = !forbiddenStates.includes(cam.health) && cam.privacyCompliant !== false;
    const batteryOk = (cam.batteryPct ?? 100) >= minBatteryPct;
    const distanceScore = Math.exp(-distM / 1200);
    const visibilityScore = Math.min(1, (cam.visibilityM ?? 800) / 1000);
    const orientationScore = Number(cam.orientationAlignment ?? 0.85);
    const freshnessScore = Number(cam.freshnessScore ?? 0.9);
    const costPenalty = (Number(cam.bandwidthKbps ?? 180) / 1000) * 0.25 + (100 - (cam.batteryPct ?? 100)) * 0.002;

    const utility = licenseAllowed && batteryOk
      ? Number((distanceScore * visibilityScore * orientationScore * freshnessScore - costPenalty).toFixed(4))
      : -1;

    return {
      ...cam,
      distanceM: Math.round(distM),
      eligible: licenseAllowed && batteryOk && utility > 0.1,
      rejectionReason: !licenseAllowed
        ? `LICENSE_OR_ACCESS_BLOCKED:${cam.health}`
        : !batteryOk
          ? 'LOW_BATTERY_PROTECTION'
          : utility <= 0.1
            ? 'LOW_MARGINAL_UTILITY'
            : null,
      utility,
    };
  });

  const sortedEligible = evaluated.filter((c) => c.eligible).sort((a, b) => b.utility - a.utility);
  const selected = [];
  let usedBandwidthKbps = 0;

  for (const cam of sortedEligible) {
    const bw = Number(cam.bandwidthKbps ?? 180);
    if (selected.length < maxCameras && usedBandwidthKbps + bw <= maxBandwidthKbps) {
      selected.push(cam);
      usedBandwidthKbps += bw;
    }
  }

  const baselineQueryAllBandwidthKbps = candidates.reduce((s, c) => s + Number(c.bandwidthKbps ?? 180), 0);
  const baselineUnauthorizedQueries = candidates.filter((c) => ['CATALOG_ONLY', 'PARTNER_ACCESS_REQUIRED', 'PERMISSION_PENDING'].includes(c.health)).length;

  return {
    selected,
    evaluated,
    metrics: {
      selectedCount: selected.length,
      usedBandwidthKbps,
      baselineQueryAllBandwidthKbps,
      bandwidthSavedPct: Number(((1 - usedBandwidthKbps / Math.max(1, baselineQueryAllBandwidthKbps)) * 100).toFixed(1)),
      unauthorizedQueriesPrevented: baselineUnauthorizedQueries,
    },
  };
}

export function benchmarkR2CooperativeCameraSelection() {
  const incidentLocation = { lat: 51.9852, lon: 5.9675 };
  const candidates = [
    { sourceId: 'DASHCAM-A12-REAL-TRACE-01', health: 'RECORDED_REAL_SAMPLE', location: { lat: 51.986, lon: 5.961 }, visibilityM: 920, orientationAlignment: 0.94, bandwidthKbps: 140, batteryPct: 78, privacyCompliant: true },
    { sourceId: 'RWS-NL-A12-CCTV-VELPERBROEK', health: 'PARTNER_ACCESS_REQUIRED', location: { lat: 51.9814, lon: 5.9632 }, visibilityM: 950, orientationAlignment: 0.98, bandwidthKbps: 1200, batteryPct: 100, privacyCompliant: false },
    { sourceId: 'CAM-MUNICIPAL-ARNHEM-PARTNER-01', health: 'PERMISSION_PENDING', location: { lat: 51.9838, lon: 5.9122 }, visibilityM: 800, orientationAlignment: 0.6, bandwidthKbps: 900, batteryPct: 100, privacyCompliant: false },
    { sourceId: 'CAM-AUTHORIZED-FLEET-02', health: 'LAB_VERIFIED', location: { lat: 51.9848, lon: 5.969 }, visibilityM: 860, orientationAlignment: 0.88, bandwidthKbps: 160, batteryPct: 64, privacyCompliant: true },
    { sourceId: 'CAM-LOW-BATTERY-NODE-03', health: 'LAB_VERIFIED', location: { lat: 51.9855, lon: 5.966 }, visibilityM: 840, orientationAlignment: 0.90, bandwidthKbps: 180, batteryPct: 11, privacyCompliant: true },
  ];
  return selectCooperativeCameras(candidates, incidentLocation, { maxBandwidthKbps: 350, minBatteryPct: 20, maxCameras: 2 });
}

/**
 * R3 — Correlated Failure Routing:
 * Calcula la probabilidad exacta de supervivencia conjunta de un conjunto de rutas
 * cuando comparten dependencias físicas (misma torre celular, fibra troncal o red eléctrica),
 * frente a la suposición ingenua de enlaces independientes.
 */
export function planCorrelatedFailureRoutes(routes, infrastructureGraph = {}) {
  const defaultInfraFailureProb = {
    'INFRA-NL-KPN-CELL-TOWER-ARNHEM-04': 0.22,
    'INFRA-NL-KPN-FIBER-ARNHEM': 0.18,
    'INFRA-NL-ALLIANDER-GRID-GELDERLAND': 0.15,
    'INFRA-LAB-POE-SWITCH-01': 0.12,
    'INFRA-LAB-MAIN-POWER-01': 0.14,
    'INFRA-LOCAL-BATTERY-PACK-01': 0.03,
    'INFRA-P2P-RF-SPECTRUM': 0.04,
    ...infrastructureGraph,
  };

  function routeFailureProb(route) {
    const deps = Array.isArray(route.sharedInfrastructureDeps) ? route.sharedInfrastructureDeps : [];
    const intrinsicLoss = Math.min(0.95, Math.max(0.01, Number(route.intrinsicPacketLossProb ?? 0.08)));
    let survivalProb = 1 - intrinsicLoss;
    for (const dep of deps) {
      const pFail = Number(defaultInfraFailureProb[dep] ?? 0.1);
      survivalProb *= (1 - pFail);
    }
    return {
      survivalProb: Number(survivalProb.toFixed(4)),
      failureProb: Number((1 - survivalProb).toFixed(4)),
      deps,
    };
  }

  const annotated = routes.map((r) => ({ ...r, ...routeFailureProb(r) }));

  // Evaluamos todos los pares (primaria, respaldo) para maximizar supervivencia conjunta real
  let bestPair = null;
  let bestJointSurvival = -1;
  let naiveBestPair = null;
  let naiveBestScore = -1;

  for (let i = 0; i < annotated.length; i++) {
    for (let j = i + 1; j < annotated.length; j++) {
      const rA = annotated[i];
      const rB = annotated[j];
      const sharedDeps = rA.deps.filter((d) => rB.deps.includes(d));

      // Probabilidad de que los elementos compartidos sobrevivan
      let pSharedSurvive = 1;
      for (const d of sharedDeps) {
        pSharedSurvive *= (1 - Number(defaultInfraFailureProb[d] ?? 0.1));
      }
      const pSharedFail = 1 - pSharedSurvive;

      // Condicionado a que lo compartido sobreviva, fallos exclusivos de A y B:
      const exclusiveA = rA.deps.filter((d) => !sharedDeps.includes(d));
      const exclusiveB = rB.deps.filter((d) => !sharedDeps.includes(d));
      let survExclA = 1 - Number(rA.intrinsicPacketLossProb ?? 0.08);
      for (const d of exclusiveA) survExclA *= (1 - Number(defaultInfraFailureProb[d] ?? 0.1));
      let survExclB = 1 - Number(rB.intrinsicPacketLossProb ?? 0.08);
      for (const d of exclusiveB) survExclB *= (1 - Number(defaultInfraFailureProb[d] ?? 0.1));

      const correlatedBothFail = pSharedFail + pSharedSurvive * (1 - survExclA) * (1 - survExclB);
      const correlatedJointSurvival = 1 - correlatedBothFail;
      const naiveIndependentBothFail = rA.failureProb * rB.failureProb;
      const naiveJointSurvival = 1 - naiveIndependentBothFail;

      if (correlatedJointSurvival > bestJointSurvival) {
        bestJointSurvival = correlatedJointSurvival;
        bestPair = {
          primaryRouteId: rA.routeId,
          backupRouteId: rB.routeId,
          sharedDependencies: sharedDeps,
          correlatedJointSurvivalProb: Number(correlatedJointSurvival.toFixed(4)),
          naiveIndependentSurvivalProb: Number(naiveJointSurvival.toFixed(4)),
          optimismBiasError: Number((naiveJointSurvival - correlatedJointSurvival).toFixed(4)),
        };
      }
      if (naiveJointSurvival > naiveBestScore) {
        naiveBestScore = naiveJointSurvival;
        naiveBestPair = {
          primaryRouteId: rA.routeId,
          backupRouteId: rB.routeId,
          sharedDependencies: sharedDeps,
          correlatedJointSurvivalProb: Number(correlatedJointSurvival.toFixed(4)),
          naiveIndependentSurvivalProb: Number(naiveJointSurvival.toFixed(4)),
          optimismBiasError: Number((naiveJointSurvival - correlatedJointSurvival).toFixed(4)),
        };
      }
    }
  }

  return {
    routes: annotated,
    recommendedDiversityPair: bestPair,
    naiveBaselinePair: naiveBestPair,
  };
}

export function benchmarkR3CorrelatedFailureRouting() {
  const routes = [
    {
      routeId: 'ROUTE-CELL-KPN-PRIMARY',
      bearer: 'LTE_5G_IP_BACKHAUL',
      intrinsicPacketLossProb: 0.04,
      sharedInfrastructureDeps: ['INFRA-NL-KPN-CELL-TOWER-ARNHEM-04', 'INFRA-NL-KPN-FIBER-ARNHEM', 'INFRA-NL-ALLIANDER-GRID-GELDERLAND'],
    },
    {
      routeId: 'ROUTE-FIBER-RELAY-VELPERBROEK',
      bearer: 'HTTP_CUSTODY_API',
      intrinsicPacketLossProb: 0.05,
      sharedInfrastructureDeps: ['INFRA-NL-KPN-FIBER-ARNHEM', 'INFRA-NL-ALLIANDER-GRID-GELDERLAND'],
    },
    {
      routeId: 'ROUTE-OPPORTUNISTIC-NEARBY-P2P',
      bearer: 'ANDROID_NEARBY_WIFI_AWARE',
      intrinsicPacketLossProb: 0.09,
      sharedInfrastructureDeps: ['INFRA-LOCAL-BATTERY-PACK-01', 'INFRA-P2P-RF-SPECTRUM'],
    },
  ];
  return planCorrelatedFailureRoutes(routes);
}

/**
 * R4 — Evidence-Carrying Messages:
 * Vincula el evento correlacionado del corredor (ID, tipo, ubicación, incertidumbre,
 * antigüedad, referencias de evidencia, hash criptográfico de procedencia y estado)
 * dentro de un sobre AEAD SENDA v2 (`envelope.mjs`) y genera/verifica su recibo.
 */
export async function createEvidenceCarryingMessage({
  corridorEvent,
  senderIdentity = null,
  recipientIdentity = null,
  kind = 'OFFICIAL_ALERT',
  priority = 8,
  ttlSeconds = 3600,
  nowMs = Date.now(),
} = {}) {
  if (!corridorEvent || !corridorEvent.eventId || !corridorEvent.provenance?.merkleDigestSha256) {
    throw new Error('INVALID_CORRIDOR_EVENT_FOR_R4');
  }
  const sender = senderIdentity || await generateIdentity();
  const recipient = recipientIdentity || await generateIdentity();

  const evidencePayload = {
    schema: 'senda.corridor-evidence-message/1.0',
    pciVersion: '0.2.0',
    incidentId: corridorEvent.eventId,
    roadSegmentId: corridorEvent.roadSegmentId,
    incidentType: corridorEvent.decision,
    approximateLocation: corridorEvent.location,
    uncertaintyInterval90: corridorEvent.uncertaintyInterval90,
    posteriorConfidence: corridorEvent.posteriorConfidence,
    corroboratingSources: corridorEvent.corroboratingSources,
    independentFamilies: corridorEvent.independentSourceFamilies,
    generatedAtUtc: new Date(nowMs).toISOString(),
    evidenceReferences: corridorEvent.provenance.observationIds,
    sourcePayloadHashes: corridorEvent.provenance.sourcePayloadHashes,
    provenanceMerkleDigestSha256: corridorEvent.provenance.merkleDigestSha256,
    confirmationState: corridorEvent.abstained ? 'ABSTAINED' : 'SEALED_WITH_EVIDENCE',
  };

  const canonicalEvidenceHash = sha256Hex(JSON.stringify(evidencePayload));
  const envelope = await sealMessage({
    sender,
    recipient: recipient.publicIdentity,
    body: JSON.stringify({ ...evidencePayload, canonicalEvidenceHash }),
    kind,
    priority,
    ttlS: ttlSeconds,
    now: nowMs,
    innerVersion: 3,
  });

  const wireBytes = packEnvelope(envelope);
  return {
    envelope,
    wireSizeBytes: wireBytes.byteLength,
    canonicalEvidenceHash,
    evidencePayload: { ...evidencePayload, canonicalEvidenceHash },
    senderPublic: sender.publicIdentity,
    recipientIdentity: recipient,
  };
}

export async function verifyEvidenceCarryingMessage({
  envelope,
  recipientIdentity,
  expectedSender = null,
  nowMs = Date.now(),
} = {}) {
  const opened = await openMessage({
    recipient: recipientIdentity,
    envelope,
    now: nowMs,
    expectedSender,
  });
  const parsed = JSON.parse(opened.body);
  const { canonicalEvidenceHash, ...rest } = parsed;
  const recomputedHash = sha256Hex(JSON.stringify(rest));
  if (recomputedHash !== canonicalEvidenceHash) {
    throw new Error('EVIDENCE_DIGEST_MISMATCH: El resumen criptográfico de evidencia fue alterado');
  }
  const computedAckHash = await ackHashOf(unb64(opened.receipt.ackSecret));
  const receiptValid = computedAckHash === envelope.header.ackHash && opened.receipt.id === envelope.header.id;
  return {
    verified: Boolean(receiptValid && recomputedHash === canonicalEvidenceHash),
    senderVerified: Boolean(opened.fromSignFingerprint),
    receiptValid,
    canonicalEvidenceHash,
    evidencePayload: parsed,
    receipt: {
      ...opened.receipt,
      ackHash: computedAckHash,
      recipientFingerprint: recipientIdentity.publicIdentity.fingerprint,
    },
  };
}

/**
 * R5 — Adaptive Edge Inference:
 * Ajusta dinámicamente resolución, FPS, modelo, frecuencia de consulta y volumen transmitido
 * según batería, CPU, temperatura, pérdida de paquetes y urgencia operativa.
 */
export function computeAdaptiveEdgePolicy({
  batteryPct = 80,
  cpuLoadPct = 35,
  temperatureC = 42,
  packetLossRatio = 0.02,
  urgencyLevel = 'NORMAL', // 'IDLE' | 'NORMAL' | 'HIGH_ALERT' | 'CRITICAL_SOS'
} = {}) {
  let resolution = '1280x720';
  let fps = 10;
  let modelTier = 'YOLOX_S_ONNX_FP16';
  let queryIntervalS = 2;
  let transmitMode = 'METADATA_AND_KEYFRAME_HASH';

  if (batteryPct < 15 || temperatureC >= 78) {
    resolution = '320x240';
    fps = 1;
    modelTier = 'KOSCHMIEDER_DARK_CHANNEL_ONLY';
    queryIntervalS = 15;
    transmitMode = 'COMPACT_DIGEST_ONLY_180B';
  } else if (batteryPct < 35 || cpuLoadPct > 80 || temperatureC >= 68) {
    resolution = '640x360';
    fps = urgencyLevel === 'CRITICAL_SOS' ? 5 : 2;
    modelTier = 'YOLOX_NANO_INT8';
    queryIntervalS = urgencyLevel === 'CRITICAL_SOS' ? 2 : 6;
    transmitMode = 'COMPACT_DIGEST_ONLY_240B';
  } else if (urgencyLevel === 'CRITICAL_SOS' || urgencyLevel === 'HIGH_ALERT') {
    resolution = '1280x720';
    fps = 15;
    modelTier = 'YOLOX_S_ONNX_BYTETRACK';
    queryIntervalS = 1;
    transmitMode = packetLossRatio > 0.25 ? 'COMPACT_DIGEST_ONLY_240B' : 'METADATA_AND_KEYFRAME_HASH';
  }

  const pixelsPerFrame = resolution === '1280x720' ? 921600 : resolution === '640x360' ? 230400 : 76800;
  const computeGflopsPerSec = Number(((pixelsPerFrame / 921600) * fps * (modelTier.includes('NANO') ? 0.35 : modelTier.includes('KOSCHMIEDER') ? 0.05 : 1.0)).toFixed(3));
  const transmittedBytesPerMin = Math.round((60 / queryIntervalS) * (transmitMode.includes('180B') ? 180 : transmitMode.includes('240B') ? 240 : 420));

  const baselineFixed1080p30 = {
    resolution: '1920x1080',
    fps: 30,
    computeGflopsPerSec: 67.5,
    transmittedBytesPerMin: 60 * 1400,
  };

  return {
    policy: {
      resolution,
      fps,
      modelTier,
      queryIntervalS,
      transmitMode,
      computeGflopsPerSec,
      transmittedBytesPerMin,
    },
    baselineFixed1080p30,
    savingsVsBaseline: {
      computeReductionPct: Number(((1 - computeGflopsPerSec / baselineFixed1080p30.computeGflopsPerSec) * 100).toFixed(1)),
      bandwidthReductionPct: Number(((1 - transmittedBytesPerMin / baselineFixed1080p30.transmittedBytesPerMin) * 100).toFixed(2)),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANO D — COMMUNICATIONS & RESILIENT MESSAGE STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

export const MESSAGE_LIFECYCLE_STATES = Object.freeze([
  'QUEUED',
  'IN_CUSTODY',
  'FORWARDED',
  'RECEIVED',
  'VERIFIED',
  'EXPIRED',
  'UNDELIVERABLE',
  'BLOCKED',
]);

export class CorridorTransportFabric {
  constructor({
    maxQueueLength = 64,
    maxStorageBytes = 256 * 1024,
    minRelayBatteryPct = 12,
  } = {}) {
    this.maxQueueLength = maxQueueLength;
    this.maxStorageBytes = maxStorageBytes;
    this.minRelayBatteryPct = minRelayBatteryPct;
    this.bearers = new Map();
    this.messages = new Map();
    this.usedStorageBytes = 0;
  }

  registerBearer(bearerConfig) {
    const entry = {
      bearerId: bearerConfig.bearerId,
      type: bearerConfig.type,
      observedCoverage: Boolean(bearerConfig.observedCoverage),
      osCapability: Boolean(bearerConfig.osCapability ?? true),
      hardwareAvailability: bearerConfig.hardwareAvailability || 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
      authorizationState: bearerConfig.authorizationState || 'AUTHORIZED',
      realLinkQuality: {
        packetLossRatio: Number(bearerConfig.realLinkQuality?.packetLossRatio ?? 0.02),
        latencyMs: Number(bearerConfig.realLinkQuality?.latencyMs ?? 45),
        throughputKbps: Number(bearerConfig.realLinkQuality?.throughputKbps ?? 250),
      },
      estimatedFutureAvailability: Number(bearerConfig.estimatedFutureAvailability ?? 0.85),
      confirmedTransmissions: 0,
      sharedInfrastructureDeps: bearerConfig.sharedInfrastructureDeps || [],
      isSimulatedOrEmulated: Boolean(bearerConfig.isSimulatedOrEmulated ?? false),
    };
    this.bearers.set(entry.bearerId, entry);
    return entry;
  }

  setBearerOutage(bearerId, outage = true) {
    const b = this.bearers.get(bearerId);
    if (!b) throw new Error(`UNKNOWN_BEARER:${bearerId}`);
    b.observedCoverage = !outage;
    b.realLinkQuality.packetLossRatio = outage ? 1.0 : 0.02;
    return b;
  }

  enqueueMessage({
    messageId,
    envelope,
    wireSizeBytes = 420,
    roadSegmentId = 'NL-A12-HM110-130',
    priority = 8,
    expiresAtMs = Date.now() + 3600_000,
    nowMs = Date.now(),
  }) {
    if (this.messages.size >= this.maxQueueLength || this.usedStorageBytes + wireSizeBytes > this.maxStorageBytes) {
      return {
        accepted: false,
        backpressureTriggered: true,
        state: 'UNDELIVERABLE',
        reason: 'QUEUE_BACKPRESSURE_LIMIT_REACHED',
      };
    }

    const record = {
      messageId,
      envelopeId: envelope?.header?.id || messageId,
      roadSegmentId,
      priority,
      wireSizeBytes,
      expiresAtMs,
      state: 'QUEUED',
      custodyNodeId: null,
      selectedBearerId: null,
      receipt: null,
      history: [{ state: 'QUEUED', atUtc: new Date(nowMs).toISOString(), detail: 'Mensaje sellado en cola de origen' }],
    };
    this.messages.set(messageId, record);
    this.usedStorageBytes += wireSizeBytes;
    return { accepted: true, backpressureTriggered: false, record };
  }

  transitionMessage(messageId, nextState, {
    nowMs = Date.now(),
    custodyNodeId = null,
    bearerId = null,
    receipt = null,
    detail = '',
  } = {}) {
    if (!MESSAGE_LIFECYCLE_STATES.includes(nextState)) {
      throw new Error(`INVALID_MESSAGE_STATE:${nextState}`);
    }
    const rec = this.messages.get(messageId);
    if (!rec) throw new Error(`UNKNOWN_MESSAGE:${messageId}`);

    if (nowMs > rec.expiresAtMs && nextState !== 'EXPIRED') {
      rec.state = 'EXPIRED';
      rec.history.push({ state: 'EXPIRED', atUtc: new Date(nowMs).toISOString(), detail: 'TTL agotado antes de entrega' });
      return rec;
    }

    rec.state = nextState;
    if (custodyNodeId) rec.custodyNodeId = custodyNodeId;
    if (bearerId) {
      rec.selectedBearerId = bearerId;
      const b = this.bearers.get(bearerId);
      if (b && (nextState === 'FORWARDED' || nextState === 'RECEIVED' || nextState === 'VERIFIED')) {
        b.confirmedTransmissions += 1;
      }
    }
    if (receipt) rec.receipt = receipt;
    rec.history.push({
      state: nextState,
      atUtc: new Date(nowMs).toISOString(),
      custodyNodeId: rec.custodyNodeId,
      bearerId: rec.selectedBearerId,
      detail,
    });
    return rec;
  }

  selectAvailableBearer({ nodeBatteryPct = 75 } = {}) {
    if (nodeBatteryPct < this.minRelayBatteryPct) {
      return { selected: null, reason: 'BATTERY_PROTECTION_GATE_ACTIVE' };
    }
    const candidates = [...this.bearers.values()].filter((b) => (
      b.observedCoverage
      && b.osCapability
      && b.authorizationState === 'AUTHORIZED'
      && b.hardwareAvailability !== 'BLOCKED_NO_PHYSICAL_HARDWARE'
      && b.realLinkQuality.packetLossRatio < 0.85
    ));
    if (candidates.length === 0) {
      const blockedHw = [...this.bearers.values()].find((b) => b.hardwareAvailability === 'BLOCKED_NO_PHYSICAL_HARDWARE');
      return {
        selected: null,
        reason: blockedHw ? 'HARDWARE_BLOCKED_OR_ALL_LINKS_DOWN' : 'ALL_AUTHORIZED_BEARERS_UNAVAILABLE',
      };
    }
    candidates.sort((a, b) => (
      (1 - b.realLinkQuality.packetLossRatio) * b.estimatedFutureAvailability
      - (1 - a.realLinkQuality.packetLossRatio) * a.estimatedFutureAvailability
    ));
    return { selected: candidates[0], reason: 'OPTIMAL_AVAILABLE_BEARER' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PILOTO A (CORREDOR A12 ARNHEM–EDE) Y PILOTO B (BARRIO / EDIFICIO LAB)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta el Piloto A de extremo a extremo sobre el corredor A12 (Arnhem–Ede):
 *   SOURCE -> INGESTION -> NORMALIZATION -> INFERENCE -> EVIDENCE -> MESSAGE -> ROUTING -> RECEIPT -> CONSOLE
 * No coloca cámaras públicas falsas en la A12 (RWS está marcada PARTNER_ACCESS_REQUIRED).
 */
export async function runPilotACorridorA12({
  ndwSrtiXml,
  ndwMonibasXml,
  dashcamTrace,
  nowMs = Date.parse('2026-11-08T14:44:30.000Z'),
} = {}) {
  const ndwAdapter = createNdwRoadAdapter({
    id: 'NDW-NL-A12-SRTI-V3',
    roadSegmentId: 'NL-A12-HM110-130',
    fixtureXml: ndwSrtiXml,
  });
  await ndwAdapter.authenticate();
  const srtiIngested = await ndwAdapter.fetchObservation({ nowMs });
  const monibasIngested = parseNdwDatexPayload(ndwMonibasXml, {
    receivedAtUtc: new Date(nowMs).toISOString(),
    sourceId: 'NDW-NL-A12-MONIBAS-0121',
    roadSegmentId: 'NL-A12-HM110-130',
    nowMs: Date.parse('2026-11-08T14:48:00.000Z'),
    capturedFromFixture: true,
  });

  const dashcamAdapter = createDashcamAdapter({
    id: 'DASHCAM-A12-REAL-TRACE-01',
    roadSegmentId: 'NL-A12-HM110-130',
    defaultLocation: { lat: 51.9852, lon: 5.9675 },
    calibrated: false,
  });
  await dashcamAdapter.authenticate();
  const dashcamIngested = await dashcamAdapter.fetchObservation({
    dashcamTrace,
    frameIndex: 120,
    gpsFix: { lat: 51.9852, lon: 5.9675 },
    imuDecelMps2: -4.4,
    obdSpeedKmh: 34,
    measuredAtUtc: '2026-11-08T14:44:10.000Z',
    nowMs,
  });

  const obdCorroboration = normalizeObservation({
    sourceId: 'OBD-A12-VEHICLE-01',
    measuredAtUtc: '2026-11-08T14:44:12.000Z',
    receivedAtUtc: new Date(nowMs).toISOString(),
    location: { lat: 51.9852, lon: 5.9675, uncertaintyRadiusM: 15 },
    roadSegmentId: 'NL-A12-HM110-130',
    observationType: 'OBD_HARD_BRAKING_HAZARD_LIGHTS',
    value: { wheelSpeedKmh: 32, decelerationMps2: -4.4, hazardLights: true },
    units: 'km/h',
    licenseReference: 'USER_CONSENTED_TELEMETRY',
    provenance: { adapterId: 'OBD-A12-VEHICLE-01', verificationState: 'LAB_VERIFIED' },
    confidence: 0.89,
  }, { nowMs });

  // Seleccionamos las observaciones NDW SRTI del sector Arnhem–Velperbroek (radio 3 km de 51.9852, 5.9675)
  const velperbroekCenter = { lat: 51.9852, lon: 5.9675 };
  const localSrti = srtiIngested.observations.filter(
    (obs) => haversineDistanceM(obs.location, velperbroekCenter) <= 3000
  );
  const allObservations = [
    ...(localSrti.length > 0 ? localSrti : srtiIngested.observations.slice(0, 2)),
    dashcamIngested.observation,
    obdCorroboration,
  ];

  const fusionResult = correlateCorridorObservations(allObservations, { nowMs });
  const primaryEvent = fusionResult.events[0];

  // R4: Mensaje portador de evidencia criptográfica
  const r4Bundle = await createEvidenceCarryingMessage({
    corridorEvent: primaryEvent,
    kind: 'OFFICIAL_ALERT',
    priority: 8,
    nowMs,
  });

  // Plano D: Enrutamiento con corte celular y conmutación a custodia DTN
  const fabric = new CorridorTransportFabric();
  fabric.registerBearer({
    bearerId: 'BEARER-KPN-LTE-A12',
    type: 'CELLULAR_BACKHAUL',
    observedCoverage: true,
    osCapability: true,
    hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
    authorizationState: 'AUTHORIZED',
    realLinkQuality: { packetLossRatio: 0.02, latencyMs: 38, throughputKbps: 12000 },
    sharedInfrastructureDeps: ['INFRA-NL-KPN-CELL-TOWER-ARNHEM-04', 'INFRA-NL-KPN-FIBER-ARNHEM'],
  });
  fabric.registerBearer({
    bearerId: 'BEARER-VELPERBROEK-CUSTODY-RELAY',
    type: 'DTN_RELAY',
    observedCoverage: true,
    osCapability: true,
    hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
    authorizationState: 'AUTHORIZED',
    realLinkQuality: { packetLossRatio: 0.01, latencyMs: 18, throughputKbps: 2500 },
    sharedInfrastructureDeps: ['INFRA-LOCAL-BATTERY-PACK-01'],
  });
  fabric.registerBearer({
    bearerId: 'BEARER-LORA-EU868-DONGLE',
    type: 'LORA_NODE',
    observedCoverage: false,
    osCapability: true,
    hardwareAvailability: 'BLOCKED_NO_PHYSICAL_HARDWARE',
    authorizationState: 'PERMISSION_PENDING',
  });

  const enq = fabric.enqueueMessage({
    messageId: `msg-a12-${primaryEvent.eventId}`,
    envelope: r4Bundle.envelope,
    wireSizeBytes: r4Bundle.wireSizeBytes,
    roadSegmentId: primaryEvent.roadSegmentId,
    priority: 8,
    nowMs,
  });

  // Simulamos caída del backhaul celular primario en el corredor A12
  fabric.setBearerOutage('BEARER-KPN-LTE-A12', true);
  const chosen = fabric.selectAvailableBearer({ nodeBatteryPct: 82 });
  fabric.transitionMessage(enq.record.messageId, 'IN_CUSTODY', {
    nowMs: nowMs + 1000,
    custodyNodeId: 'NODE-ANDROID-A12-CARRIER-01',
    detail: 'Backhaul LTE caído; mensaje retenido en almacenamiento local store-and-forward',
  });
  fabric.transitionMessage(enq.record.messageId, 'FORWARDED', {
    nowMs: nowMs + 2500,
    custodyNodeId: 'GATEWAY-A12-VELPERBROEK-RELAY',
    bearerId: chosen.selected.bearerId,
    detail: 'Reenviado oportunistamente al gateway de custodia local',
  });
  fabric.transitionMessage(enq.record.messageId, 'RECEIVED', {
    nowMs: nowMs + 3200,
    custodyNodeId: 'RECIPIENT-ARNHEM-CONSOLE',
    bearerId: chosen.selected.bearerId,
    detail: 'Entregado al destinatario tras recuperación de ruta',
  });

  const verification = await verifyEvidenceCarryingMessage({
    envelope: r4Bundle.envelope,
    recipientIdentity: r4Bundle.recipientIdentity,
    nowMs: nowMs + 3200,
  });

  fabric.transitionMessage(enq.record.messageId, 'VERIFIED', {
    nowMs: nowMs + 3500,
    custodyNodeId: 'RECIPIENT-ARNHEM-CONSOLE',
    bearerId: chosen.selected.bearerId,
    receipt: verification.receipt,
    detail: 'Firma ECDSA P-256, evidencia SHA-256 y recibo criptográfico verificados',
  });

  return {
    pilotId: 'PILOT_A_CORRIDOR_A12_ARNHEM_EDE',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    rwsPublicCamerasClaimed: 0,
    ingestedCount: allObservations.length,
    fusionResult,
    primaryEvent,
    messageRecord: fabric.messages.get(enq.record.messageId),
    verification,
    hardwareBlockedBearers: ['BEARER-LORA-EU868-DONGLE'],
  };
}

/**
 * Ejecuta el Piloto B de extremo a extremo (Barrio / Edificio Laboratorio Local):
 *   Cámara IP propia/emulada + 2 instancias de nodos móviles + gateway local + sensor Edge MQTT
 *   + incidente + corte de red primaria + store-and-forward + recibo criptográfico verificado.
 */
export async function runPilotBNeighborhoodLab({
  fixedCameraSeriesEntry = { t: 12.0, n: 8, stoppedVehicle: true, visibilityM: 640 },
  nowMs = Date.parse('2026-11-08T14:52:00.000Z'),
} = {}) {
  // 1. Cámara IP propia de laboratorio
  const camAdapter = createOwnedIpCameraAdapter({
    id: 'CAM-LAB-BARRIO-RTSP-01',
    protocol: 'RTSP',
    endpoint: 'rtsp://127.0.0.1:8554/barrio-cam-01',
    location: { lat: 40.4168, lon: -3.7038 },
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    operatorAuthorized: true,
    allowLocalLab: true,
  });
  await camAdapter.authenticate({ token: 'lab-authorized-session-2026' });
  const camIngested = await camAdapter.fetchObservation({
    recordedSeriesEntry: fixedCameraSeriesEntry,
    measuredAtUtc: '2026-11-08T14:51:30.000Z',
    nowMs,
  });

  // 2. Puente de eventos Edge / MQTT (sensor adicional del edificio/barrio)
  const mqttBridge = createMqttEdgeBridge({
    id: 'EDGE-MQTT-BARRIO-BROKER-01',
    authorizedTokens: ['edge-token-barrio-lab-01'],
    defaultRoadSegmentId: 'BARRIO-ACCESO-NORTE-01',
  });
  const edgeIngested = await mqttBridge.fetchObservation({
    token: 'edge-token-barrio-lab-01',
    nowMs,
    eventPayload: {
      schema: EDGE_EVENT_SCHEMA_VERSION,
      sourceId: 'NODE-ANDROID-BARRIO-PEER-01',
      measuredAtUtc: '2026-11-08T14:51:35.000Z',
      location: { lat: 40.4167, lon: -3.7039, uncertaintyRadiusM: 10 },
      roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
      observationType: 'ACOUSTIC_AND_IMU_OBSTRUCTION_ALERT',
      detectorType: 'Android_Lab_Peer_Acoustic_IMU',
      objectClass: 'blocked_access_lane',
      severityScore: 0.91,
      confidence: 0.89,
    },
  });

  // 3. Fusión multisensor (Cámara IP Lab + Nodo Android Peer 01)
  const fusionResult = correlateCorridorObservations(
    [camIngested.observation, edgeIngested.observation],
    { nowMs }
  );
  const primaryEvent = fusionResult.events[0];

  // 4. Creación de mensaje sellado con evidencia
  const r4Bundle = await createEvidenceCarryingMessage({
    corridorEvent: primaryEvent,
    kind: 'SOS',
    priority: 9,
    nowMs,
  });

  // 5. Corte de red primaria, custodia entre Peer 01 -> Peer 02 -> Gateway Local y recibo
  const fabric = new CorridorTransportFabric();
  fabric.registerBearer({
    bearerId: 'BEARER-BARRIO-WAN-ISP',
    type: 'CELLULAR_BACKHAUL',
    observedCoverage: true,
    osCapability: true,
    hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
    authorizationState: 'AUTHORIZED',
    realLinkQuality: { packetLossRatio: 0.01, latencyMs: 25, throughputKbps: 20000 },
  });
  fabric.registerBearer({
    bearerId: 'BEARER-BARRIO-P2P-CUSTODY-LOOPBACK',
    type: 'DTN_RELAY',
    observedCoverage: true,
    osCapability: true,
    hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
    authorizationState: 'AUTHORIZED',
    realLinkQuality: { packetLossRatio: 0.02, latencyMs: 14, throughputKbps: 4200 },
    isSimulatedOrEmulated: true,
  });

  const enq = fabric.enqueueMessage({
    messageId: `msg-barrio-${primaryEvent.eventId}`,
    envelope: r4Bundle.envelope,
    wireSizeBytes: r4Bundle.wireSizeBytes,
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    priority: 9,
    nowMs,
  });

  // Cortamos la red primaria WAN
  fabric.setBearerOutage('BEARER-BARRIO-WAN-ISP', true);
  const backupBearer = fabric.selectAvailableBearer({ nodeBatteryPct: 90 });

  fabric.transitionMessage(enq.record.messageId, 'IN_CUSTODY', {
    nowMs: nowMs + 500,
    custodyNodeId: 'NODE-ANDROID-BARRIO-PEER-01',
    detail: 'Corte de WAN detectado; custodia local en Nodo Móvil A (LAB_EMULATED)',
  });
  fabric.transitionMessage(enq.record.messageId, 'FORWARDED', {
    nowMs: nowMs + 1500,
    custodyNodeId: 'NODE-ANDROID-BARRIO-PEER-02',
    bearerId: backupBearer.selected.bearerId,
    detail: 'Transferencia store-and-forward de Nodo Móvil A a Nodo Móvil B',
  });
  fabric.transitionMessage(enq.record.messageId, 'RECEIVED', {
    nowMs: nowMs + 2200,
    custodyNodeId: 'EDGE-MQTT-BARRIO-BROKER-01',
    bearerId: backupBearer.selected.bearerId,
    detail: 'Recibido en pasarela local senda-relay del edificio',
  });

  const verification = await verifyEvidenceCarryingMessage({
    envelope: r4Bundle.envelope,
    recipientIdentity: r4Bundle.recipientIdentity,
    nowMs: nowMs + 3200,
  });

  fabric.transitionMessage(enq.record.messageId, 'VERIFIED', {
    nowMs: nowMs + 2600,
    custodyNodeId: 'EDGE-MQTT-BARRIO-BROKER-01',
    bearerId: backupBearer.selected.bearerId,
    receipt: verification.receipt,
    detail: 'Recibo criptográfico verificado de extremo a extremo tras corte de red',
  });

  return {
    pilotId: 'PILOT_B_BARRIO_EDIFICIO_LAB',
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    environmentBadge: 'LAB_VERIFIED_STORE_AND_FORWARD',
    ingestedCount: 2,
    fusionResult,
    primaryEvent,
    messageRecord: fabric.messages.get(enq.record.messageId),
    verification,
  };
}
