#!/usr/bin/env node
/**
 * Genera el paquete reproducible de evidencia de SENDA Corridor Fabric:
 *   - Estado del inventario georreferenciado (Plano A)
 *   - Evidencia de ingesta de los 5 conectores reales (Plano B)
 *   - Correlación multisensor y procedencia criptográfica (Plano C)
 *   - Benchmarks R1–R5 frente a baselines
 *   - Ejecución de extremo a extremo de los Pilotos A (A12 Arnhem–Ede) y B (Barrio/Edificio Lab)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sha256Hex,
  CORRIDOR_SOURCE_INVENTORY,
  validateCorridorAsset,
  benchmarkR1InformationAwareRouting,
  benchmarkR2CooperativeCameraSelection,
  benchmarkR3CorrelatedFailureRouting,
  computeAdaptiveEdgePolicy,
  runPilotACorridorA12,
  runPilotBNeighborhoodLab,
} from '../src/corridor-fabric.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../../../evidence/senda/corridor-fabric');
const FIXTURES_DIR = resolve(OUT_DIR, 'fixtures');
const VISION_DIR = resolve(__dirname, '../../../investor-next/public/media/vision');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const ndwSrtiXml = readFileSync(resolve(FIXTURES_DIR, 'ndw-a12-srti-v3.xml'), 'utf8');
  const ndwMonibasXml = readFileSync(resolve(FIXTURES_DIR, 'ndw-a12-monibas-v2.xml'), 'utf8');
  const dashcamTrace = JSON.parse(readFileSync(resolve(VISION_DIR, 'dashcam.json'), 'utf8'));

  const inventoryValidation = CORRIDOR_SOURCE_INVENTORY.map((item) => ({
    sourceId: item.sourceId,
    type: item.type,
    health: item.health,
    ...validateCorridorAsset(item),
  }));

  const r1 = benchmarkR1InformationAwareRouting({ bandwidthBudgetBytes: 1250 });
  const r2 = benchmarkR2CooperativeCameraSelection();
  const r3 = benchmarkR3CorrelatedFailureRouting();
  const r5LowBattery = computeAdaptiveEdgePolicy({ batteryPct: 12, temperatureC: 45, urgencyLevel: 'NORMAL' });
  const r5CriticalSos = computeAdaptiveEdgePolicy({ batteryPct: 85, temperatureC: 40, urgencyLevel: 'CRITICAL_SOS' });

  const pilotA = await runPilotACorridorA12({ ndwSrtiXml, ndwMonibasXml, dashcamTrace });
  const pilotB = await runPilotBNeighborhoodLab();

  const report = {
    schema: 'senda.corridor-fabric-verification/1.0',
    generatedAtUtc: new Date().toISOString(),
    inventorySummary: {
      totalAssets: CORRIDOR_SOURCE_INVENTORY.length,
      allValid: inventoryValidation.every((x) => x.valid),
      byHealth: CORRIDOR_SOURCE_INVENTORY.reduce((acc, x) => {
        acc[x.health] = (acc[x.health] || 0) + 1;
        return acc;
      }, {}),
    },
    researchBenchmarks: {
      R1_InformationAwareRouting: r1,
      R2_CooperativeCameraSelection: r2.metrics,
      R3_CorrelatedFailureRouting: {
        recommendedDiversityPair: r3.recommendedDiversityPair,
        naiveBaselinePair: r3.naiveBaselinePair,
      },
      R4_EvidenceCarryingMessages: {
        pilotAWireBytes: pilotA.messageRecord.wireSizeBytes,
        pilotAVerified: pilotA.verification.verified,
        pilotACanonicalEvidenceHash: pilotA.verification.canonicalEvidenceHash,
      },
      R5_AdaptiveEdgeInference: {
        lowBatteryMode: r5LowBattery,
        criticalSosMode: r5CriticalSos,
      },
    },
    pilots: {
      pilotA: {
        pilotId: pilotA.pilotId,
        sectorId: pilotA.sectorId,
        roadSegmentId: pilotA.roadSegmentId,
        rwsPublicCamerasClaimed: pilotA.rwsPublicCamerasClaimed,
        decision: pilotA.primaryEvent.decision,
        posteriorConfidence: pilotA.primaryEvent.posteriorConfidence,
        corroboratingSources: pilotA.primaryEvent.corroboratingSources,
        provenanceMerkleDigestSha256: pilotA.primaryEvent.provenance.merkleDigestSha256,
        messageState: pilotA.messageRecord.state,
        messageHistory: pilotA.messageRecord.history,
        receiptVerified: pilotA.verification.verified,
        hardwareBlockedBearers: pilotA.hardwareBlockedBearers,
      },
      pilotB: {
        pilotId: pilotB.pilotId,
        sectorId: pilotB.sectorId,
        roadSegmentId: pilotB.roadSegmentId,
        decision: pilotB.primaryEvent.decision,
        posteriorConfidence: pilotB.primaryEvent.posteriorConfidence,
        corroboratingSources: pilotB.primaryEvent.corroboratingSources,
        provenanceMerkleDigestSha256: pilotB.primaryEvent.provenance.merkleDigestSha256,
        messageState: pilotB.messageRecord.state,
        messageHistory: pilotB.messageRecord.history,
        receiptVerified: pilotB.verification.verified,
      },
    },
  };

  const reportDigestSha256 = sha256Hex(JSON.stringify(report));
  const outPayload = { ...report, reportDigestSha256 };
  const outPath = resolve(OUT_DIR, 'corridor-fabric-verification.json');
  writeFileSync(outPath, JSON.stringify(outPayload, null, 2) + '\n', 'utf8');
  console.log(`Evidencia generada en ${outPath} (sha256:${reportDigestSha256})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
