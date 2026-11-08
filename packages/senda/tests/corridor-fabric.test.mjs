import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORRIDOR_ASSET_TYPES,
  CORRIDOR_VERIFICATION_STATES,
  CORRIDOR_SOURCE_INVENTORY,
  validateCorridorAsset,
  queryCorridorInventory,
  formatInventoryMarkdownTable,
  validateSourceAdapter,
  normalizeObservation,
  createNdwRoadAdapter,
  parseNdwDatexPayload,
  createDgtNapAdapter,
  createOwnedIpCameraAdapter,
  createDashcamAdapter,
  EDGE_EVENT_SCHEMA_VERSION,
  createMqttEdgeBridge,
  correlateCorridorObservations,
  benchmarkR1InformationAwareRouting,
  benchmarkR2CooperativeCameraSelection,
  benchmarkR3CorrelatedFailureRouting,
  createEvidenceCarryingMessage,
  verifyEvidenceCarryingMessage,
  computeAdaptiveEdgePolicy,
  CorridorTransportFabric,
  runPilotACorridorA12,
  runPilotBNeighborhoodLab,
} from '../src/corridor-fabric.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../../evidence/senda/corridor-fabric/fixtures');
const VISION_DIR = resolve(__dirname, '../../../investor-next/public/media/vision');

const ndwSrtiXml = readFileSync(resolve(FIXTURES_DIR, 'ndw-a12-srti-v3.xml'), 'utf8');
const ndwMonibasXml = readFileSync(resolve(FIXTURES_DIR, 'ndw-a12-monibas-v2.xml'), 'utf8');
const dgtNapXml = readFileSync(resolve(FIXTURES_DIR, 'dgt-nap-v36-slice.xml'), 'utf8');
const dashcamTrace = JSON.parse(readFileSync(resolve(VISION_DIR, 'dashcam.json'), 'utf8'));
const fixedTrace = JSON.parse(readFileSync(resolve(VISION_DIR, 'fixed.json'), 'utf8'));

describe('SENDA Corridor Fabric — Plano A (Discovery & Capabilities)', () => {
  it('incluye los 16 tipos de activos y los 9 estados de verificación obligatorios', () => {
    assert.equal(CORRIDOR_ASSET_TYPES.length, 16);
    assert.equal(CORRIDOR_VERIFICATION_STATES.length, 9);
    for (const item of CORRIDOR_SOURCE_INVENTORY) {
      const check = validateCorridorAsset(item);
      assert.equal(check.valid, true, `Fallo en activo ${item.sourceId}: ${check.errors.join(', ')}`);
    }
  });

  it('separa capacidades de observación y transporte y bloquea relés sin transporte', () => {
    const invalidRelay = {
      sourceId: 'CAM-FAKE-RELAY',
      type: 'ROAD_CAMERA',
      health: 'CATALOG_ONLY',
      geolocation: { lat: 51.98, lon: 5.96 },
      observationCapabilities: ['OCCUPANCY'],
      transportCapabilities: [],
      canActAsRelay: true,
    };
    const res = validateCorridorAsset(invalidRelay);
    assert.equal(res.valid, false);
    assert.ok(res.errors.includes('RELAY_WITHOUT_TRANSPORT_CAPABILITIES'));
  });

  it('prohíbe representar CATALOG_ONLY, PARTNER_ACCESS_REQUIRED o SYNTHETIC como vídeo en directo', () => {
    for (const forbiddenState of ['CATALOG_ONLY', 'PARTNER_ACCESS_REQUIRED', 'PERMISSION_PENDING', 'SYNTHETIC']) {
      const fakeLive = {
        sourceId: `BAD-${forbiddenState}`,
        type: 'ROAD_CAMERA',
        health: forbiddenState,
        geolocation: { lat: 51.98, lon: 5.96 },
        observationCapabilities: ['CCTV'],
        transportCapabilities: [],
        canActAsRelay: false,
        isLiveStream: true,
      };
      const check = validateCorridorAsset(fakeLive);
      assert.equal(check.valid, false);
      assert.ok(check.errors.some((e) => e.startsWith('FORBIDDEN_LIVE_REPRESENTATION_FOR_')));
    }
  });

  it('clasifica la cámara RWS en la A12 como PARTNER_ACCESS_REQUIRED (sin cámaras públicas falsas)', () => {
    const rwsA12 = CORRIDOR_SOURCE_INVENTORY.find((x) => x.sourceId === 'RWS-NL-A12-CCTV-VELPERBROEK');
    assert.ok(rwsA12);
    assert.equal(rwsA12.health, 'PARTNER_ACCESS_REQUIRED');
    assert.equal(rwsA12.sampleObtained, false);
  });

  it('permite consultar inventario por tramo, radio y polígono y genera tabla Markdown de 13 columnas', () => {
    const bySegment = queryCorridorInventory({ roadSegmentId: 'NL-A12-HM110-130' });
    assert.ok(bySegment.length >= 6);

    const byRadius = queryCorridorInventory({
      center: { lat: 51.9852, lon: 5.9675 },
      radiusM: 3500,
    });
    assert.ok(byRadius.some((x) => x.sourceId === 'NDW-NL-A12-SRTI-V3'));

    const poly = [
      { lat: 51.97, lon: 5.94 },
      { lat: 51.97, lon: 5.99 },
      { lat: 52.00, lon: 5.99 },
      { lat: 52.00, lon: 5.94 },
    ];
    const byPoly = queryCorridorInventory({ polygon: poly });
    assert.ok(byPoly.some((x) => x.sourceId === 'NDW-NL-A12-SRTI-V3'));

    const md = formatInventoryMarkdownTable();
    assert.ok(md.includes('SOURCE_ID | TYPE | OPERATOR | GEOLOCATION'));
    assert.ok(md.includes('NDW-NL-A12-SRTI-V3'));
  });
});

describe('SENDA Corridor Fabric — Plano B (SourceAdapter & 5 Conectores Reales)', () => {
  it('rechaza observaciones sin unidades, con valores NaN o con desfase de reloj incoherente', () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    assert.throws(() => normalizeObservation({
      sourceId: 'TEST-1',
      measuredAtUtc: '2026-11-08T14:49:00.000Z',
      location: { lat: 51.98, lon: 5.96 },
      observationType: 'SPEED',
      value: 80,
      units: '',
    }, { nowMs }), /MISSING_UNITS/);

    assert.throws(() => normalizeObservation({
      sourceId: 'TEST-1',
      measuredAtUtc: '2026-11-08T15:10:00.000Z', // 20 minutos en el futuro
      location: { lat: 51.98, lon: 5.96 },
      observationType: 'SPEED',
      value: 80,
      units: 'km/h',
    }, { nowMs }), /CLOCK_SKEW_REJECTED/);
  });

  it('Conector 1 (NDW Road Data): ingiere fixtures reales DATEX II v3 (SRTI) y v2.3 (MONIBAS) en A12 Arnhem–Ede y gestiona errores/reconexión', async () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const adapter = createNdwRoadAdapter({
      fixtureXml: ndwSrtiXml,
      roadSegmentId: 'NL-A12-HM110-130',
    });
    assert.equal(validateSourceAdapter(adapter).valid, true);
    await adapter.authenticate();

    const srtiRes = await adapter.fetchObservation({ nowMs });
    assert.equal(srtiRes.schemaVersion, 'DATEX_II_V3');
    assert.equal(srtiRes.v3MigrationCompliant, true);
    assert.ok(srtiRes.observations.length >= 5);
    assert.equal(srtiRes.observations[0].roadSegmentId, 'NL-A12-HM110-130');
    assert.ok(srtiRes.observations[0].sourcePayloadHash.length === 64);

    // Verifica también parseo de velocidades/flujos MONIBAS v2.3
    const monibasRes = parseNdwDatexPayload(ndwMonibasXml, { nowMs, capturedFromFixture: true });
    assert.equal(monibasRes.schemaVersion, 'DATEX_II_V2');
    assert.ok(monibasRes.observations.length >= 10);
    assert.equal(monibasRes.observations[0].units, 'km/h');

    // Prueba de respuesta corrupta / schema drift y reconexión HTTP
    await assert.rejects(() => adapter.fetchObservation({ xmlOverride: '<invalid>xml</invalid>', nowMs }), /SCHEMA_DRIFT_NDW/);
    assert.throws(() => adapter.subscribe(), /UNSUPPORTED_OPERATION/);

    let callCount = 0;
    const flakyAdapter = createNdwRoadAdapter({
      fetchImpl: async () => {
        callCount += 1;
        if (callCount === 1) return { ok: false, status: 503 };
        return { ok: true, status: 200, text: async () => ndwSrtiXml };
      },
    });
    await assert.rejects(() => flakyAdapter.fetchObservation({ nowMs }), /NDW_HTTP_ERROR:503/);
    const recovered = await flakyAdapter.fetchObservation({ nowMs });
    assert.ok(recovered.observations.length >= 5);
    const ev = flakyAdapter.evidence();
    assert.equal(ev.httpFailures, 1);
    assert.equal(ev.reconnections, 1);
  });

  it('Conector 2 (DGT NAP): ingiere XML DATEX II v3.6 real y bloquea DGT 3.0 sin credenciales de partner', async () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const napAdapter = createDgtNapAdapter({
      mode: 'OPEN_NAP',
      fixtureXml: dgtNapXml,
    });
    assert.equal(validateSourceAdapter(napAdapter).valid, true);
    await napAdapter.authenticate();
    const res = await napAdapter.fetchObservation({ nowMs });
    assert.equal(res.accessTier, 'OPEN_NAP_DATEX2_V36');
    assert.equal(res.dgt30PartnerClaimed, false);
    assert.ok(res.observations.length >= 4);

    // DGT 3.0 sin convenio ni mTLS debe rechazar con PARTNER_ACCESS_REQUIRED
    const dgt30Adapter = createDgtNapAdapter({ mode: 'DGT_3_0_PARTNER', partnerCredentials: null });
    assert.equal(dgt30Adapter.permissionState, 'PARTNER_ACCESS_REQUIRED');
    await assert.rejects(() => dgt30Adapter.authenticate(), /PARTNER_ACCESS_REQUIRED/);
    await assert.rejects(() => dgt30Adapter.fetchObservation({ nowMs }), /PARTNER_ACCESS_REQUIRED/);
  });

  it('Conector 3 (Owned IP Camera): valida anti-SSRF, prohíbe credenciales en URL, infiere visibilidad/ocupación y gestiona pérdida de señal', async () => {
    // Prohibido embeber usuario:password en URL
    assert.throws(() => createOwnedIpCameraAdapter({
      endpoint: 'rtsp://admin:secret123@127.0.0.1:8554/cam',
    }), /CREDENTIALS_IN_ENDPOINT_FORBIDDEN/);

    // Prohibido escanear red privada sin autorización explícita de laboratorio
    assert.throws(() => createOwnedIpCameraAdapter({
      endpoint: 'rtsp://192.168.1.55:554/stream',
      allowLocalLab: false,
    }), /SSRF_OR_UNAUTHORIZED_SCAN_BLOCKED/);

    const cam = createOwnedIpCameraAdapter({
      endpoint: 'rtsp://127.0.0.1:8554/barrio-cam-01',
      operatorAuthorized: true,
      allowLocalLab: true,
    });
    assert.equal(validateSourceAdapter(cam).valid, true);
    await cam.authenticate({ token: 'lab-token-valid-2026' });

    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const obsRes = await cam.fetchObservation({
      recordedSeriesEntry: { n: fixedTrace.maxInFrame, stoppedVehicle: true, visibilityM: 760 },
      measuredAtUtc: '2026-11-08T14:49:30.000Z',
      nowMs,
    });
    assert.equal(obsRes.observation.units, 'occupancy_ratio');
    assert.ok(obsRes.observation.qualityFlags.includes('UNCALIBRATED_MONOCULAR'));

    // Pérdida de señal y reconexión
    cam.simulateSignalLoss();
    await assert.rejects(() => cam.fetchObservation({ nowMs }), /CAMERA_SIGNAL_LOST/);
    const rec = await cam.reconnect();
    assert.equal(rec.reconnected, true);
    assert.equal(rec.reconnections, 1);
  });

  it('Conector 4 (Dashcam Adapter): procesa traza real YOLOX-s + ByteTrack y declara incertidumbre monocular ±30%', async () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const dashcam = createDashcamAdapter({ calibrated: false });
    assert.equal(validateSourceAdapter(dashcam).valid, true);
    await dashcam.authenticate();

    const { observation, assumptions } = await dashcam.fetchObservation({
      dashcamTrace,
      frameIndex: 120,
      imuDecelMps2: -4.5,
      obdSpeedKmh: 38,
      measuredAtUtc: '2026-11-08T14:49:00.000Z',
      nowMs,
    });

    assert.equal(observation.observationType, 'DASHCAM_HARD_BRAKING_AND_OBSTRUCTION');
    assert.equal(observation.measurementUncertainty.value, 30);
    assert.equal(assumptions.carHeightM, 1.45);
    assert.equal(assumptions.hfovDeg, 65);
    assert.ok(assumptions.warning.includes('±30%'));
  });

  it('Conector 5 (MQTT / Edge Bridge): exige token autorizado, valida esquema y bloquea vídeo bruto sobre DTN', async () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const bridge = createMqttEdgeBridge({
      authorizedTokens: ['edge-secret-token-01'],
    });
    assert.equal(validateSourceAdapter(bridge).valid, true);

    await assert.rejects(() => bridge.fetchObservation({
      token: 'wrong-token',
      eventPayload: { schema: EDGE_EVENT_SCHEMA_VERSION },
    }), /MQTT_EDGE_UNAUTHORIZED/);

    // Bloquea envío de vídeo bruto por DTN
    await assert.rejects(() => bridge.fetchObservation({
      token: 'edge-secret-token-01',
      eventPayload: {
        schema: EDGE_EVENT_SCHEMA_VERSION,
        measuredAtUtc: '2026-11-08T14:49:40.000Z',
        location: { lat: 40.4168, lon: -3.7038 },
        rawVideoBytes: new Uint8Array(4096),
      },
    }), /DTN_RAW_VIDEO_FORBIDDEN/);

    let notified = null;
    const unsub = bridge.subscribe((ev) => { notified = ev; });
    const okRes = await bridge.fetchObservation({
      token: 'edge-secret-token-01',
      nowMs,
      eventPayload: {
        schema: EDGE_EVENT_SCHEMA_VERSION,
        measuredAtUtc: '2026-11-08T14:49:40.000Z',
        location: { lat: 40.4168, lon: -3.7038 },
        observationType: 'EDGE_STOPPED_VEHICLE',
        confidence: 0.87,
      },
    });
    unsub();
    assert.ok(notified);
    assert.equal(okRes.compactDtnDescriptor.schema, 'senda.dtn-evidence-descriptor/1.0');
    assert.equal(okRes.compactDtnDescriptor.evidenceSha256.length, 64);
  });
});

describe('SENDA Corridor Fabric — Plano C (Fusión Multisensor, Descuento de Dependencia y Abstención)', () => {
  it('deduplica observaciones repetidas, descuenta fuentes dependientes y confirma incidentes multisensor', () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const obsNdw = normalizeObservation({
      sourceId: 'NDW-NL-A12-SRTI-V3',
      measuredAtUtc: '2026-11-08T14:48:00.000Z',
      location: { lat: 51.9852, lon: 5.9675, uncertaintyRadiusM: 35 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'STATIONARY_VEHICLE_OBSTRUCTION',
      value: { recordType: 'VehicleObstruction' },
      units: 'categorical',
      confidence: 0.82,
    }, { nowMs });

    const obsDashcam = normalizeObservation({
      sourceId: 'DASHCAM-A12-REAL-TRACE-01',
      measuredAtUtc: '2026-11-08T14:48:30.000Z',
      location: { lat: 51.9855, lon: 5.9670, uncertaintyRadiusM: 20 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'DASHCAM_HARD_BRAKING_AND_OBSTRUCTION',
      value: { imuDecelMps2: -4.4 },
      units: 'm/s2',
      confidence: 0.85,
    }, { nowMs });

    const obsObdSameVehicle = normalizeObservation({
      sourceId: 'OBD-A12-VEHICLE-01',
      measuredAtUtc: '2026-11-08T14:48:31.000Z',
      location: { lat: 51.9855, lon: 5.9670, uncertaintyRadiusM: 20 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'HARD_BRAKING_OBD',
      value: { wheelSpeedKmh: 22 },
      units: 'km/h',
      confidence: 0.84,
    }, { nowMs });

    // Pasamos obsNdw duplicada dos veces
    const res = correlateCorridorObservations([obsNdw, obsNdw, obsDashcam, obsObdSameVehicle], { nowMs });
    assert.equal(res.deduplicatedCount, 1);
    assert.equal(res.decision, 'CONFIRMED_MULTISENSOR_INCIDENT');
    assert.equal(res.abstained, false);

    // Verifica que OBD-A12-VEHICLE-01 (misma familia FAMILY_EGO_VEHICLE_01 que DASHCAM) recibió descuento < 1
    const obdExplain = res.events[0].explainability.find((x) => x.sourceId === 'OBD-A12-VEHICLE-01');
    assert.ok(obdExplain.dependencyDiscount < 1.0);
  });

  it('se abstiene explícitamente ante contradicción entre fuentes o datos obsoletos', () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const obsIncidentWeak = normalizeObservation({
      sourceId: 'DASHCAM-A12-REAL-TRACE-01',
      measuredAtUtc: '2026-11-08T14:48:00.000Z',
      location: { lat: 51.9852, lon: 5.9675 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'STOPPED_VEHICLE_OBSTRUCTION',
      value: 1,
      units: 'boolean',
      confidence: 0.62,
    }, { nowMs });

    const obsFreeFlow = normalizeObservation({
      sourceId: 'NDW-NL-A12-MONIBAS-0121',
      measuredAtUtc: '2026-11-08T14:48:10.000Z',
      location: { lat: 51.9852, lon: 5.9675 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'TRAFFIC_SPEED_AND_FLOW',
      value: { averageSpeedKmh: 112, vehicleFlowVehH: 1400 },
      units: 'km/h',
      confidence: 0.92,
    }, { nowMs });

    const contradiction = correlateCorridorObservations([obsIncidentWeak, obsFreeFlow], { nowMs });
    assert.equal(contradiction.abstained, true);
    assert.equal(contradiction.decision, 'ABSTAIN_CONTRADICTION');
  });
});

describe('SENDA Corridor Fabric — Contribuciones de Investigación R1 a R5 vs Baselines', () => {
  it('R1 (Information-Aware Routing): cubre más tramos únicos y logra mayor ganancia de información que baseline FIFO/estático sin perder SOS', () => {
    const bench = benchmarkR1InformationAwareRouting({ bandwidthBudgetBytes: 1250 });
    assert.equal(bench.r1Result.sosDelivered, 1);
    assert.ok(bench.r1Result.uniqueSegmentsCovered > bench.baselineStaticResult.uniqueSegmentsCovered);
    assert.ok(bench.r1Result.totalInfoGainBits > bench.baselineStaticResult.totalInfoGainBits);
  });

  it('R2 (Risk-Aware Cooperative Camera Selection): ahorra ancho de banda y bloquea cámaras sin permiso/licencia frente a consultar todas', () => {
    const bench = benchmarkR2CooperativeCameraSelection();
    assert.ok(bench.metrics.bandwidthSavedPct > 65);
    assert.equal(bench.metrics.unauthorizedQueriesPrevented, 2);
    assert.ok(bench.selected.every((c) => ['RECORDED_REAL_SAMPLE', 'LAB_VERIFIED', 'LIVE_VERIFIED'].includes(c.health)));
  });

  it('R3 (Correlated Failure Routing): identifica fallo correlacionado en fibra/red eléctrica y elige ruta de respaldo físicamente disjunta', () => {
    const bench = benchmarkR3CorrelatedFailureRouting();
    assert.equal(bench.recommendedDiversityPair.primaryRouteId, 'ROUTE-FIBER-RELAY-VELPERBROEK');
    assert.equal(bench.recommendedDiversityPair.backupRouteId, 'ROUTE-OPPORTUNISTIC-NEARBY-P2P');
    assert.equal(bench.recommendedDiversityPair.sharedDependencies.length, 0);
    assert.ok(bench.recommendedDiversityPair.correlatedJointSurvivalProb > 0.94);
  });

  it('R4 (Evidence-Carrying Messages): sella evidencia criptográfica en sobre v2, verifica recibo y detecta manipulación', async () => {
    const nowMs = Date.parse('2026-11-08T14:50:00.000Z');
    const obs = normalizeObservation({
      sourceId: 'NDW-NL-A12-SRTI-V3',
      measuredAtUtc: '2026-11-08T14:48:00.000Z',
      location: { lat: 51.9852, lon: 5.9675 },
      roadSegmentId: 'NL-A12-HM110-130',
      observationType: 'STATIONARY_VEHICLE_OBSTRUCTION',
      value: { recordType: 'VehicleObstruction' },
      units: 'categorical',
      confidence: 0.9,
    }, { nowMs });
    const fused = correlateCorridorObservations([obs], { nowMs });
    const msg = await createEvidenceCarryingMessage({ corridorEvent: fused.events[0], nowMs });
    assert.ok(msg.wireSizeBytes < 2048);

    const verified = await verifyEvidenceCarryingMessage({
      envelope: msg.envelope,
      recipientIdentity: msg.recipientIdentity,
      nowMs: nowMs + 1000,
    });
    assert.equal(verified.verified, true);
    assert.equal(verified.receiptValid, true);
  });

  it('R5 (Adaptive Edge Inference): adapta resolución, FPS y bytes transmitidos según batería, temperatura y urgencia', () => {
    const lowBatt = computeAdaptiveEdgePolicy({ batteryPct: 12, temperatureC: 45, urgencyLevel: 'NORMAL' });
    assert.equal(lowBatt.policy.resolution, '320x240');
    assert.equal(lowBatt.policy.fps, 1);
    assert.ok(lowBatt.savingsVsBaseline.computeReductionPct > 99);
    assert.ok(lowBatt.savingsVsBaseline.bandwidthReductionPct > 98);

    const critical = computeAdaptiveEdgePolicy({ batteryPct: 85, temperatureC: 40, urgencyLevel: 'CRITICAL_SOS' });
    assert.equal(critical.policy.resolution, '1280x720');
    assert.equal(critical.policy.fps, 15);
  });
});

describe('SENDA Corridor Fabric — Plano D y Demostradores de Extremo a Extremo (Pilotos A y B)', () => {
  it('aplica backpressure cuando la cola se llena y protege la batería del nodo relé', () => {
    const fabric = new CorridorTransportFabric({ maxQueueLength: 2, maxStorageBytes: 1000, minRelayBatteryPct: 20 });
    const m1 = fabric.enqueueMessage({ messageId: 'm1', wireSizeBytes: 400 });
    const m2 = fabric.enqueueMessage({ messageId: 'm2', wireSizeBytes: 400 });
    const m3 = fabric.enqueueMessage({ messageId: 'm3', wireSizeBytes: 400 });
    assert.equal(m1.accepted, true);
    assert.equal(m2.accepted, true);
    assert.equal(m3.accepted, false);
    assert.equal(m3.state, 'UNDELIVERABLE');
    assert.equal(m3.backpressureTriggered, true);

    const lowBatteryRoute = fabric.selectAvailableBearer({ nodeBatteryPct: 10 });
    assert.equal(lowBatteryRoute.selected, null);
    assert.equal(lowBatteryRoute.reason, 'BATTERY_PROTECTION_GATE_ACTIVE');
  });

  it('Piloto A (Corredor Vial A12 Arnhem–Ede): ejecuta flujo completo desde NDW + Dashcam real hasta recibo VERIFIED sin cámaras públicas falsas', async () => {
    const result = await runPilotACorridorA12({
      ndwSrtiXml,
      ndwMonibasXml,
      dashcamTrace,
    });
    assert.equal(result.rwsPublicCamerasClaimed, 0);
    assert.equal(result.primaryEvent.decision, 'CONFIRMED_MULTISENSOR_INCIDENT');
    assert.equal(result.messageRecord.state, 'VERIFIED');
    assert.equal(result.verification.verified, true);
    assert.deepEqual(
      result.messageRecord.history.map((h) => h.state),
      ['QUEUED', 'IN_CUSTODY', 'FORWARDED', 'RECEIVED', 'VERIFIED']
    );
  });

  it('Piloto B (Barrio / Edificio Lab): ejecuta cámara IP propia + 2 nodos móviles + gateway local + corte de red + store-and-forward + recibo VERIFIED', async () => {
    const result = await runPilotBNeighborhoodLab({
      fixedCameraSeriesEntry: { t: 14.0, n: 9, stoppedVehicle: true, visibilityM: 580 },
    });
    assert.equal(result.primaryEvent.decision, 'CONFIRMED_MULTISENSOR_INCIDENT');
    assert.equal(result.messageRecord.state, 'VERIFIED');
    assert.equal(result.verification.verified, true);
    assert.deepEqual(
      result.messageRecord.history.map((h) => h.state),
      ['QUEUED', 'IN_CUSTODY', 'FORWARDED', 'RECEIVED', 'VERIFIED']
    );
  });
});
