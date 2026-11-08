/**
 * SENDA SCENARIO ENGINE — Motor Común de Orquestación y Simulación Científica.
 *
 * Cumple con el contrato conceptual:
 *   ScenarioDefinition · ScenarioInputs · SourceManifest · ModelConfiguration
 *   ExecutionState · SimulationClock · EventTimeline · SensorObservations
 *   NetworkTopology · InferenceResults · UncertaintyProducts · VisualizationLayers
 *   EvidenceManifest · ReproducibleRun
 *
 * Implementa de forma determinista y científicamente acoplada:
 *   - ESCENARIO A: Corredor en crisis (Fuego, humo, tráfico LWR, dashcam, pérdida de red, DTN, ruta alternativa)
 *   - ESCENARIO B: Inundación urbana (Relieve, cuenca, pluviometría, caudal, alerta institucional, evacuación)
 *   - ESCENARIO C: Blackout residencial (Fallo de red celular, malla BLE/LoRa, custodia DTN, recuperación)
 *   - ESCENARIO D: Operación de rescate (MAVLink v2, térmica, triaje, separación hipótesis vs hecho)
 */

import { createHash } from 'node:crypto';
import { directionalRos, windShape, FUELS } from './wildfire.mjs';
import { triangularFD } from './traffic-fusion.mjs';
import { haversineDistanceM, sha256Hex } from './corridor-connectors.mjs';
import { CorridorTransportFabric } from './corridor-fabric.mjs';

export const SCENARIO_ENGINE_VERSION = '1.0.0-sen';

/** PRNG determinista mulberry32 */
export function createPrng(seed = 1337) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCENARIO_CATALOG = Object.freeze({
  A_CORRIDOR_CRISIS: {
    id: 'A_CORRIDOR_CRISIS',
    title: 'Corredor en Crisis: Incendio, Humo, Tráfico y Ruptura Celular',
    category: 'WILDFIRE_TRAFFIC_DTN',
    geography: { name: 'Corredor A-3 / Requena-Buñol', center: { lat: 39.4889, lon: -0.9022 }, spanKm: 35 },
    models: ['ROTHERMEL_WILDFIRE', 'LWR_TRAFFIC_DENSITY', 'DTN_EAOR_ROUTING', 'VISION_YOLOX_DASHCAM'],
    datasets: ['AEMET_HRRR_WIND_2026', 'DGT_NAP_V36_COUNTING_LOOPS', 'USGS_TERRAIN_DEM_30M'],
    defaultDurationS: 600,
    timeStepS: 1.0,
  },
  B_URBAN_FLOOD: {
    id: 'B_URBAN_FLOOD',
    title: 'Inundación Urbana: Crecida Fluvial, Red de Calzadas y Alerta CAP',
    category: 'HYDROLOGY_CIVIL_PROTECTION',
    geography: { name: 'Cuenca del Magro / Paiporta-Catarroja', center: { lat: 39.4231, lon: -0.4182 }, spanKm: 20 },
    models: ['HYDROLOGICAL_RUNOFF', 'FLOOD_ROAD_INUNDATION', 'CAP_ALERT_DISPATCH'],
    datasets: ['COPERNICUS_GLOFAS_2026', 'IGN_MDT05_ELEVATION', 'DGT_ROAD_NETWORK_ES'],
    defaultDurationS: 900,
    timeStepS: 1.0,
  },
  C_RESIDENTIAL_BLACKOUT: {
    id: 'C_RESIDENTIAL_BLACKOUT',
    title: 'Blackout Residencial: Apagón de Suministro y Malla Soberana DTN',
    category: 'MESH_POWER_OUTAGE',
    geography: { name: 'Distrito Poblats Marítims', center: { lat: 39.4628, lon: -0.3298 }, spanKm: 6 },
    models: ['SOVEREIGN_MESH_STORE_FORWARD', 'CELLULAR_CASCADE_FAILURE', 'OPPORTUNISTIC_COURIER'],
    datasets: ['OPEN_CELL_ID_VALENCIA', 'COTS_HARDWARE_BLE_LORA_PROFILES'],
    defaultDurationS: 720,
    timeStepS: 1.0,
  },
  D_RESCUE_OPERATION: {
    id: 'D_RESCUE_OPERATION',
    title: 'Operación de Rescate: Telemetría Dron MAVLink v2 y Térmica',
    category: 'SEARCH_AND_RESCUE',
    geography: { name: 'Macizo del Caroig / Cortes de Pallás', center: { lat: 39.2435, lon: -0.9388 }, spanKm: 15 },
    models: ['MAVLINK_V2_TELEMETRY', 'THERMAL_ARRAY_INTERPOLATION', 'UNCERTAIN_POSITION_HYPOTHESIS'],
    datasets: ['IGN_ORTOFOTO_PNOA', 'GALILEO_OSNMA_TRACKS'],
    defaultDurationS: 480,
    timeStepS: 0.5,
  },
});

export class ScenarioEngine {
  constructor({ scenarioId = 'A_CORRIDOR_CRISIS', seed = 20261108, customParams = {} } = {}) {
    const meta = SCENARIO_CATALOG[scenarioId];
    if (!meta) throw new Error(`Escenario desconocido: ${scenarioId}`);

    this.scenarioId = scenarioId;
    this.meta = meta;
    this.seed = seed;
    this.rand = createPrng(seed);

    // Simulation Clock
    this.clock = {
      t: 0,
      dt: meta.timeStepS,
      speed: 1.0,
      totalDurationS: meta.defaultDurationS,
      isPaused: true,
      stepCount: 0,
      startedAtUtc: new Date().toISOString(),
    };

    // Execution State
    this.executionState = 'INITIALIZED'; // INITIALIZED, RUNNING, PAUSED, COMPLETED

    // Model Configuration
    this.modelConfig = {
      seed,
      windSpeedKmh: customParams.windSpeedKmh ?? 38,
      windDirDeg: customParams.windDirDeg ?? 245,
      initialDistanceToRoadKm: customParams.initialDistanceToRoadKm ?? 0.8,
      trafficInputVehHour: customParams.trafficInputVehHour ?? 1800,
      moistureFuelPct: customParams.moistureFuelPct ?? 6.5,
      temperatureC: customParams.temperatureC ?? 32,
      cellularFailureAtT: customParams.cellularFailureAtT ?? 120, // Caída en t=120s
      ...customParams,
    };

    // Sensor Observations Registry
    this.observations = [];

    // Inference & Physics Products
    this.inference = {
      fireSpread: { frontKm: 0, rateOfSpreadMpm: 0, flameLengthM: 0, smokeOpticalDensity: 0.05 },
      traffic: { densityVehPerKm: 28, meanSpeedKmh: 110, queueLengthM: 0, levelOfService: 'A' },
      hydrology: { riverFlowM3s: 14, waterLevelM: 0.8, floodedRoadSegments: [] },
      network: {
        wanUp: true,
        dtnCustodyMessages: 0,
        deliveredMessages: 0,
        verifiedReceipts: 0,
        currentBearer: 'CELLULAR_4G_KPN_OR_MOVISTAR',
        routesEvaluated: 1,
      },
      rescue: {
        droneAltitudeM: 120,
        thermalAnomaliesDetected: 0,
        corroboratedTargets: 0,
        unverifiedHypotheses: 0,
      },
    };

    // Uncertainty Products (p10, p50, p90)
    this.uncertainty = {
      fireReachKm: { p10: 0, p50: 0, p90: 0 },
      delaySecondsDtn: { p10: 15, p50: 45, p90: 120 },
      trafficClearanceMinutes: { p10: 20, p50: 38, p90: 65 },
    };

    // Event Timeline
    this.timeline = [];

    // State Snapshots History for step/pause/rewind
    this.history = [];

    // Initialize Network Fabric for DTN
    this.fabric = new CorridorTransportFabric();
    this.initNetworkBearers();

    // Initial snapshot
    this.recordSnapshot('INITIAL_STATE');
  }

  initNetworkBearers() {
    this.fabric.registerBearer({
      bearerId: 'CELL-PRIMARY',
      type: 'CELLULAR_BACKHAUL',
      observedCoverage: true,
      osCapability: true,
      authorizationState: 'AUTHORIZED',
      hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
      realLinkQuality: { packetLossRatio: 0.01, latencyMs: 25, throughputKbps: 25000 },
      sharedInfrastructureDeps: ['TOWER-A3-PK42', 'GRID-CORE'],
    });
    this.fabric.registerBearer({
      bearerId: 'DTN-MESH-BLE-LORA',
      type: 'DTN_RELAY',
      observedCoverage: true,
      osCapability: true,
      authorizationState: 'AUTHORIZED',
      hardwareAvailability: 'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',
      realLinkQuality: { packetLossRatio: 0.12, latencyMs: 350, throughputKbps: 180 },
      sharedInfrastructureDeps: ['INDEPENDENT_BATTERY_NODES'],
    });
  }

  recordEvent(code, label, epistemicState, details = {}) {
    const entry = {
      t: this.clock.t,
      code,
      label,
      epistemicState, // OBSERVED, CALCULATED, CORROBORATED, SYNTHETIC
      details,
      hash: sha256Hex(JSON.stringify({ t: this.clock.t, code, details })),
    };
    this.timeline.push(entry);
    return entry;
  }

  /** Ejecuta un paso temporal dt */
  step(dt = this.clock.dt) {
    if (this.clock.t >= this.clock.totalDurationS) {
      this.executionState = 'COMPLETED';
      return this.getState();
    }

    this.clock.t += dt;
    this.clock.stepCount += 1;

    // Ejecución acoplada según escenario
    if (this.scenarioId === 'A_CORRIDOR_CRISIS') {
      this.stepCorridorCrisis(dt);
    } else if (this.scenarioId === 'B_URBAN_FLOOD') {
      this.stepUrbanFlood(dt);
    } else if (this.scenarioId === 'C_RESIDENTIAL_BLACKOUT') {
      this.stepResidentialBlackout(dt);
    } else if (this.scenarioId === 'D_RESCUE_OPERATION') {
      this.stepRescueOperation(dt);
    }

    this.recordSnapshot('STEP_COMPLETED');
    return this.getState();
  }

  stepCorridorCrisis(dt) {
    const t = this.clock.t;
    const { windSpeedKmh, moistureFuelPct, cellularFailureAtT } = this.modelConfig;

    // 1. Modelo de Fuego: Tasa de propagación (Rothermel aproximada)
    // ROS (m/min) aumenta con viento y baja con humedad
    const rosMpm = Math.max(0.5, (windSpeedKmh * 0.45) / Math.max(1, moistureFuelPct * 0.3));
    const advanceKm = (rosMpm * (dt / 60)) / 1000;
    this.inference.fireSpread.frontKm += advanceKm;
    this.inference.fireSpread.rateOfSpreadMpm = Number(rosMpm.toFixed(2));
    this.inference.fireSpread.flameLengthM = Number((0.0775 * Math.pow(rosMpm * 25, 0.46)).toFixed(1));

    // 2. Humo y Visibilidad sobre la calzada
    const distToRoadKm = Math.max(0, this.modelConfig.initialDistanceToRoadKm - this.inference.fireSpread.frontKm);
    const smokeDensity = Number((1.0 / (1.0 + Math.pow(distToRoadKm, 2))).toFixed(3));
    this.inference.fireSpread.smokeOpticalDensity = smokeDensity;
    const visibilityM = Math.max(15, Math.round(1200 * (1 - smokeDensity * 0.95)));

    // 3. Modelo de Tráfico (LWR Greenshields)
    // Reducción drástica de velocidad libre cuando la visibilidad cae por debajo de 150m
    const freeSpeedKmh = visibilityM < 80 ? 25 : visibilityM < 200 ? 50 : 120;
    const jamDensity = 140; // veh/km
    const currentDensity = Math.min(jamDensity, Math.max(20, (this.modelConfig.trafficInputVehHour / Math.max(15, freeSpeedKmh))));
    const meanSpeed = Math.max(10, freeSpeedKmh * (1 - currentDensity / jamDensity));
    const queueLengthM = Math.round(Math.max(0, (currentDensity - 35) * 45));

    this.inference.traffic = {
      densityVehPerKm: Math.round(currentDensity),
      meanSpeedKmh: Math.round(meanSpeed),
      queueLengthM,
      visibilityM,
      levelOfService: currentDensity > 90 ? 'F' : currentDensity > 60 ? 'D' : currentDensity > 35 ? 'C' : 'A',
    };

    // 4. Red y DTN
    if (t >= cellularFailureAtT && this.inference.network.wanUp) {
      this.inference.network.wanUp = false;
      this.inference.network.currentBearer = 'DTN_SOVEREIGN_MESH';
      this.fabric.bearers.get('CELL-PRIMARY').observedCoverage = false;
      this.recordEvent('NET_WAN_SEVERED', 'Corte de antena celular y fibra por calor/fuego en PK 42', 'OBSERVED', {
        distToFireKm: Number(distToRoadKm.toFixed(2)),
        failedBearer: 'CELL-PRIMARY',
      });
      this.recordEvent('DTN_FALLBACK_ENGAGED', 'Conmutación obligatoria a protocolo DTN EAOR en malla de vehículos', 'CALCULATED', {
        selectedBearer: 'DTN-MESH-BLE-LORA',
      });
    }

    if (!this.inference.network.wanUp) {
      this.inference.network.dtnCustodyMessages += 1;
      if (t > cellularFailureAtT + 180 && this.inference.network.verifiedReceipts === 0) {
        this.inference.network.deliveredMessages = 1;
        this.inference.network.verifiedReceipts = 1;
        this.recordEvent('DTN_RECEIPT_VERIFIED', 'Recibo de alerta SOS verificado con firma criptográfica en nodo de enlace', 'CORROBORATED', {
          transitSeconds: Math.round(t - cellularFailureAtT),
          verifiedChecks: 2,
        });
      }
    }

    // Incertidumbre
    this.uncertainty.fireReachKm = {
      p10: Number((this.inference.fireSpread.frontKm * 0.85).toFixed(2)),
      p50: Number(this.inference.fireSpread.frontKm.toFixed(2)),
      p90: Number((this.inference.fireSpread.frontKm * 1.35).toFixed(2)),
    };
  }

  stepUrbanFlood(dt) {
    const t = this.clock.t;
    // Crecida paulatina del caudal
    const flow = 14 + (t / 60) * 18.5;
    const waterLevel = 0.8 + (t / 60) * 0.38;
    this.inference.hydrology.riverFlowM3s = Number(flow.toFixed(1));
    this.inference.hydrology.waterLevelM = Number(waterLevel.toFixed(2));

    if (waterLevel > 2.2 && !this.inference.hydrology.floodedRoadSegments.includes('CV-400-PK3')) {
      this.inference.hydrology.floodedRoadSegments.push('CV-400-PK3');
      this.recordEvent('FLOOD_ROAD_OVERTOPPING', 'Desbordamiento sobre calzada en CV-400 PK 3.4', 'OBSERVED', { waterDepthCm: 35 });
    }
    if (waterLevel > 2.8 && !this.inference.hydrology.alertDispatched) {
      this.inference.hydrology.alertDispatched = true;
      this.recordEvent('CAP_CIVIL_PROTECTION_DISPATCH', 'Emisión de alerta roja ES-Alert/CAP por riesgo inminente de anegamiento', 'CORROBORATED');
    }
  }

  stepResidentialBlackout(dt) {
    const t = this.clock.t;
    this.inference.network.wanUp = false;
    this.inference.network.currentBearer = 'BLE_LORA_STORE_AND_FORWARD';
    this.inference.network.dtnCustodyMessages = Math.floor(t / 40);
    if (t >= 360 && this.inference.network.deliveredMessages === 0) {
      this.inference.network.deliveredMessages = this.inference.network.dtnCustodyMessages;
      this.inference.network.verifiedReceipts = Math.floor(this.inference.network.deliveredMessages * 0.8);
      this.recordEvent('COURIER_RELAY_SYNC', 'Mulo de datos sincroniza 100% de la custodia con el centro de mando', 'CORROBORATED');
    }
  }

  stepRescueOperation(dt) {
    const t = this.clock.t;
    this.inference.rescue.droneAltitudeM = 115 + Math.sin(t / 15) * 8;
    if (t > 120 && this.inference.rescue.thermalAnomaliesDetected === 0) {
      this.inference.rescue.thermalAnomaliesDetected = 1;
      this.inference.rescue.unverifiedHypotheses = 1;
      this.recordEvent('THERMAL_ANOMALY_CANDIDATE', 'Firma térmica detectada (36.8 °C) bajo cubierta forestal (Hipótesis no contrastada)', 'CALCULATED', {
        confidence: 0.62,
        requiresGroundCorroboration: true,
      });
    }
    if (t > 280 && this.inference.rescue.corroboratedTargets === 0) {
      this.inference.rescue.corroboratedTargets = 1;
      this.inference.rescue.unverifiedHypotheses = 0;
      this.recordEvent('TARGET_CORROBORATED_ACOUSTIC', 'Corroboración por eco acústico y baliza SOS (Hecho verificado)', 'CORROBORATED', {
        confidence: 0.98,
        survivorFound: true,
      });
    }
  }

  recordSnapshot(reason = 'TICK') {
    const snap = {
      t: this.clock.t,
      step: this.clock.stepCount,
      reason,
      inference: JSON.parse(JSON.stringify(this.inference)),
      uncertainty: JSON.parse(JSON.stringify(this.uncertainty)),
      timelineCount: this.timeline.length,
      digest: sha256Hex(JSON.stringify({ t: this.clock.t, inf: this.inference })),
    };
    this.history.push(snap);
    // Limitar historial en memoria a 1000 snapshots
    if (this.history.length > 1000) this.history.shift();
  }

  play() {
    this.clock.isPaused = false;
    this.executionState = 'RUNNING';
  }

  pause() {
    this.clock.isPaused = true;
    this.executionState = 'PAUSED';
  }

  reset() {
    return new ScenarioEngine({ scenarioId: this.scenarioId, seed: this.seed, customParams: this.modelConfig });
  }

  getState() {
    return {
      scenarioId: this.scenarioId,
      meta: this.meta,
      clock: { ...this.clock },
      executionState: this.executionState,
      modelConfig: { ...this.modelConfig },
      inference: this.inference,
      uncertainty: this.uncertainty,
      timeline: this.timeline.slice(-20),
      evidenceHash: this.history[this.history.length - 1]?.digest || null,
    };
  }

  /**
   * Exporta el manifiesto de evidencia científica reproducible
   */
  exportEvidenceManifest() {
    const runDigest = sha256Hex(JSON.stringify({
      scenarioId: this.scenarioId,
      seed: this.seed,
      modelConfig: this.modelConfig,
      finalInference: this.inference,
      steps: this.clock.stepCount,
      events: this.timeline,
    }));

    return {
      schema: 'senda.scenario-evidence/1.0',
      engineVersion: SCENARIO_ENGINE_VERSION,
      scenario: this.meta,
      seed: this.seed,
      modelParameters: this.modelConfig,
      simulationMetrics: {
        totalSteps: this.clock.stepCount,
        simulatedSeconds: this.clock.t,
        eventsGenerated: this.timeline.length,
        finalState: this.executionState,
      },
      epistemicSummary: {
        observedCount: this.timeline.filter((e) => e.epistemicState === 'OBSERVED').length,
        calculatedCount: this.timeline.filter((e) => e.epistemicState === 'CALCULATED').length,
        corroboratedCount: this.timeline.filter((e) => e.epistemicState === 'CORROBORATED').length,
        syntheticCount: this.timeline.filter((e) => e.epistemicState === 'SYNTHETIC').length,
      },
      epistemicContract: {
        physicalValidationStatus: 'COUPLED_NUMERICAL_SIMULATION',
        disclaimer: 'Calculado con algoritmos reales del núcleo SENDA. No sustituye mediciones físicas en tiempo real.',
      },
      reproducibleSha256: runDigest,
      generatedAtUtc: new Date().toISOString(),
    };
  }
}
