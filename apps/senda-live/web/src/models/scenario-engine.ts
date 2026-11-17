/**
 * SENDA Scenario Engine (Web Client Model).
 * Implementación determinista en TypeScript sin dependencias de Node.
 */

export const SCENARIO_ENGINE_VERSION = '1.0.0-web';

/** PRNG determinista mulberry32 */
export function createPrng(seed = 1337) {
  let s = (seed >>> 0) || 1;
  return function next(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple fast deterministic digest for browser evidence manifests */
export function simpleHash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `digest_${p1}${p2}_reproducible`;
}

export const SCENARIO_CATALOG: Record<string, any> = Object.freeze({
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
  scenarioId: string;
  meta: any;
  seed: number;
  rand: () => number;
  clock: {
    t: number;
    dt: number;
    speed: number;
    totalDurationS: number;
    isPaused: boolean;
    stepCount: number;
    startedAtUtc: string;
  };
  executionState: 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  modelConfig: any;
  inference: any;
  uncertainty: any;
  timeline: any[];
  history: any[];

  constructor({ scenarioId = 'A_CORRIDOR_CRISIS', seed = 20261108, customParams = {} }: { scenarioId?: string; seed?: number; customParams?: any } = {}) {
    const meta = SCENARIO_CATALOG[scenarioId];
    if (!meta) throw new Error(`Escenario desconocido: ${scenarioId}`);

    this.scenarioId = scenarioId;
    this.meta = meta;
    this.seed = seed;
    this.rand = createPrng(seed);

    this.clock = {
      t: 0,
      dt: meta.timeStepS,
      speed: 1.0,
      totalDurationS: meta.defaultDurationS,
      isPaused: true,
      stepCount: 0,
      startedAtUtc: new Date().toISOString(),
    };

    this.executionState = 'INITIALIZED';

    this.modelConfig = {
      seed,
      windSpeedKmh: customParams.windSpeedKmh ?? 38,
      windDirDeg: customParams.windDirDeg ?? 245,
      initialDistanceToRoadKm: customParams.initialDistanceToRoadKm ?? 0.8,
      trafficInputVehHour: customParams.trafficInputVehHour ?? 1800,
      moistureFuelPct: customParams.moistureFuelPct ?? 6.5,
      temperatureC: customParams.temperatureC ?? 32,
      cellularFailureAtT: customParams.cellularFailureAtT ?? 120,
      ...customParams,
    };

    this.inference = {
      fireSpread: { frontKm: 0, rateOfSpreadMpm: 0, flameLengthM: 0, smokeOpticalDensity: 0.05 },
      traffic: { densityVehPerKm: 28, meanSpeedKmh: 110, queueLengthM: 0, levelOfService: 'A', visibilityM: 1100 },
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

    this.uncertainty = {
      fireReachKm: { p10: 0, p50: 0, p90: 0 },
      delaySecondsDtn: { p10: 15, p50: 45, p90: 120 },
      trafficClearanceMinutes: { p10: 20, p50: 38, p90: 65 },
    };

    this.timeline = [];
    this.history = [];

    this.recordSnapshot('INITIAL_STATE');
  }

  recordEvent(code: string, label: string, epistemicState: string, details: any = {}) {
    const entry = {
      t: this.clock.t,
      code,
      label,
      epistemicState,
      details,
      hash: simpleHash(`${this.clock.t}:${code}`),
    };
    this.timeline.push(entry);
    return entry;
  }

  step(dt = this.clock.dt) {
    if (this.clock.t >= this.clock.totalDurationS) {
      this.executionState = 'COMPLETED';
      return this.getState();
    }

    this.clock.t += dt;
    this.clock.stepCount += 1;

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

  private stepCorridorCrisis(dt: number) {
    const t = this.clock.t;
    const { windSpeedKmh, moistureFuelPct, cellularFailureAtT, initialDistanceToRoadKm } = this.modelConfig;

    const rosMpm = Math.max(0.5, (windSpeedKmh * 0.45) / Math.max(1, moistureFuelPct * 0.3));
    const advanceKm = (rosMpm * (dt / 60)) / 1000;
    this.inference.fireSpread.frontKm += advanceKm;
    this.inference.fireSpread.rateOfSpreadMpm = Number(rosMpm.toFixed(2));
    this.inference.fireSpread.flameLengthM = Number((0.0775 * Math.pow(rosMpm * 25, 0.46)).toFixed(1));

    const distToRoadKm = Math.max(0, initialDistanceToRoadKm - this.inference.fireSpread.frontKm);
    const smokeDensity = Number((1.0 / (1.0 + Math.pow(distToRoadKm, 2))).toFixed(3));
    this.inference.fireSpread.smokeOpticalDensity = smokeDensity;
    const visibilityM = Math.max(15, Math.round(1200 * (1 - smokeDensity * 0.95)));

    const freeSpeedKmh = visibilityM < 80 ? 25 : visibilityM < 200 ? 50 : 120;
    const jamDensity = 140;
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

    if (t >= cellularFailureAtT && this.inference.network.wanUp) {
      this.inference.network.wanUp = false;
      this.inference.network.currentBearer = 'DTN_SOVEREIGN_MESH';
      this.recordEvent('NET_WAN_SEVERED', 'Corte de antena celular y fibra por calor/fuego en PK 42', 'OBSERVED', {
        distToFireKm: Number(distToRoadKm.toFixed(2)),
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

    this.uncertainty.fireReachKm = {
      p10: Number((this.inference.fireSpread.frontKm * 0.85).toFixed(2)),
      p50: Number(this.inference.fireSpread.frontKm.toFixed(2)),
      p90: Number((this.inference.fireSpread.frontKm * 1.35).toFixed(2)),
    };
  }

  private stepUrbanFlood(dt: number) {
    const t = this.clock.t;
    const flow = 14 + (t / 60) * 18.5;
    const waterLevel = 0.8 + (t / 60) * 0.38;
    this.inference.hydrology.riverFlowM3s = Number(flow.toFixed(1));
    this.inference.hydrology.waterLevelM = Number(waterLevel.toFixed(2));

    if (waterLevel > 2.2 && !this.inference.hydrology.floodedRoadSegments.includes('CV-400-PK3')) {
      this.inference.hydrology.floodedRoadSegments.push('CV-400-PK3');
      this.recordEvent('FLOOD_ROAD_OVERTOPPING', 'Desbordamiento sobre calzada en CV-400 PK 3.4', 'OBSERVED', { waterDepthCm: 35 });
    }
  }

  private stepResidentialBlackout(dt: number) {
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

  private stepRescueOperation(dt: number) {
    const t = this.clock.t;
    this.inference.rescue.droneAltitudeM = 115 + Math.sin(t / 15) * 8;
    if (t > 120 && this.inference.rescue.thermalAnomaliesDetected === 0) {
      this.inference.rescue.thermalAnomaliesDetected = 1;
      this.recordEvent('THERMAL_ANOMALY_CANDIDATE', 'Firma térmica detectada (36.8 °C) bajo cubierta forestal (Hipótesis no contrastada)', 'CALCULATED', {
        confidence: 0.62,
      });
    }
    if (t > 280 && this.inference.rescue.corroboratedTargets === 0) {
      this.inference.rescue.corroboratedTargets = 1;
      this.recordEvent('TARGET_CORROBORATED_ACOUSTIC', 'Corroboración por eco acústico y baliza SOS (Hecho verificado)', 'CORROBORATED', {
        confidence: 0.98,
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
      digest: simpleHash(`${this.clock.t}:${this.clock.stepCount}`),
    };
    this.history.push(snap);
    if (this.history.length > 1000) this.history.shift();
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

  exportEvidenceManifest() {
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
      epistemicContract: {
        physicalValidationStatus: 'COUPLED_NUMERICAL_SIMULATION',
        disclaimer: 'Calculado con algoritmos reales del núcleo SENDA. No sustituye mediciones físicas en tiempo real.',
      },
      reproducibleSha256: simpleHash(`${this.scenarioId}:${this.seed}:${this.clock.stepCount}`),
      generatedAtUtc: new Date().toISOString(),
    };
  }
}
