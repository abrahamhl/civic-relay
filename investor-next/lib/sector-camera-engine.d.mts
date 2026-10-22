import type { ScenarioParameters, SimulationResult } from './emergency-routing.mjs';

export type EvidenceLabel =
  | 'LIVE THIRD-PARTY DATA — SOURCE/TIMESTAMP'
  | 'REAL CODE / LOCAL LAB'
  | 'SYNTHETIC SIMULATION'
  | 'PHYSICAL FIELD TEST PENDING'
  | 'RESEARCH CONCEPT'
  | 'UNAVAILABLE / NO PERMISSION';

export type CelestialBodyId = 'EARTH' | 'MOON' | 'MARS';

export interface CelestialBodySpec {
  id: CelestialBodyId;
  name: { es: string; en: string; nl: string };
  radiusKm: number;
  oepActive: boolean;
  evidenceLabel: EvidenceLabel;
  palette: { primary: string; secondary: string; atmosphere: string; wire: string };
  notice: { es: string; en: string; nl: string };
}

export interface SubSectorSpec {
  id: string;
  name: string;
  polygon: number[][];
  towerStatus: 'DAMAGED_SYNTHETIC' | 'DEGRADED_GATEWAY_AVAILABLE' | 'OFFLINE_SYNTHETIC';
  coveragePct: number;
}

export interface SectorSpec {
  id: string;
  code: string;
  name: string;
  region: string;
  country: string;
  continent: string;
  center: [number, number];
  zoomScore: number;
  source: string;
  authenticity: string;
  evidenceLabel: EvidenceLabel;
  incidentType: 'WILDFIRE' | 'FLOOD' | 'GRID_OUTAGE' | 'EARTHQUAKE';
  updatedAt: string;
  permittedScope: string;
  defaultScenarioParams: ScenarioParameters;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  subSectors: SubSectorSpec[];
  description: { es: string; en: string; nl: string };
}

export interface FovEstimate {
  azimuthDeg: number;
  coneAngleDeg: number;
  rangeMeters: number;
  calibrated: false;
  note: string;
}

export type CameraState = 'PUBLIC_CATALOG_VERIFIED' | 'SYNTHETIC' | 'STALE' | 'NO_SIGNAL';
export type CameraFreshness = 'FRESH_METADATA' | 'SYNTHETIC' | 'STALE' | 'NO_SIGNAL';

export interface CameraSource {
  id: string;
  sectorId: string;
  subSectorId: string;
  provider: string;
  title: string;
  roadOrLandmark: string;
  coordinates: [number, number];
  geoAccuracy: 'VERIFIED_PUBLIC_METRIC' | 'SECTOR_APPROXIMATE';
  fovEstimate: FovEstimate;
  streamType: 'PUBLIC_OPEN_DATA_SNAPSHOT' | 'SYNTHETIC_TELEMETRY_PREVIEW' | 'HLS_CONTRACT_READY';
  upstreamUrl: string;
  officialSourceUrl: string;
  termsUrl: string;
  license: string;
  accessPolicy: 'PUBLIC_OPEN_DATA_ATTRIBUTION' | 'SYNTHETIC_DEMO_ONLY' | 'INSTITUTIONAL_RBAC_REQUIRED';
  lastSeen: string | null;
  lastFrameAt: string | null;
  freshness: CameraFreshness;
  state: CameraState;
  attribution: string;
  privacyNotice: string;
}

export interface EnrichedCameraSource extends CameraSource {
  access: {
    permitted: boolean;
    status: string;
    freshness?: CameraFreshness;
    evidenceLabel: EvidenceLabel;
    privacyGuard: {
      facialRecognitionAllowed: false;
      licensePlateOcrAllowed: false;
      individualTrackingAllowed: false;
      autoDispatchFromVideoAllowed: false;
    };
  };
  fovFeature: {
    type: 'Feature';
    properties: {
      calibrated: false;
      estimationType: 'METADATA_AZIMUTH_CONE_ESTIMATE';
      azimuthDeg: number;
      coneAngleDeg: number;
      rangeMeters: number;
    };
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  };
  ageMinutes: number | null;
}

export interface SectorCausalTrace {
  kind: 'OEP_SECTOR_CAUSAL_TRACE_V1';
  sectorId: string;
  sectorName: string;
  incidentType: string;
  parameters: ScenarioParameters;
  simulationSummary: SimulationResult['summary'];
  simulationResult: SimulationResult;
  observationalLayer: {
    totalCameras: number;
    verifiedCatalogCount: number;
    syntheticDemoCount: number;
    staleOrNoSignalCount: number;
    inferHumanPositionFromVideo: false;
    autoDispatchFromVideo: false;
    separationRule: 'OBSERVATIONAL_ONLY_NEVER_TRIGGERS_SOS_OR_112';
  };
  causalChain: Array<{
    step: string;
    label: string;
    detail: string;
    evidence: EvidenceLabel;
  }>;
}

export declare const EVIDENCE_LABELS: Record<string, EvidenceLabel>;
export declare const ALLOWED_CAMERA_DOMAINS: readonly string[];
export declare const CELESTIAL_BODIES: Record<CelestialBodyId, CelestialBodySpec>;
export declare const PILOT_SECTORS: readonly SectorSpec[];
export declare const CAMERA_SOURCES: readonly CameraSource[];

export declare function validateCameraUpstreamUrl(
  rawUrl: string,
  options?: { allowlist?: readonly string[] }
): { allowed: boolean; reason: string; hostname?: string; normalizedUrl?: string };

export declare function checkSectorAccessPolicy(options?: {
  camera?: CameraSource;
  role?: 'PUBLIC_VISITOR' | 'INSTITUTIONAL_OPERATOR';
  institutionAuthorized?: boolean;
}): EnrichedCameraSource['access'];

export declare function computeFovPolygon(
  coordinates: [number, number],
  fovEstimate: FovEstimate,
  steps?: number
): EnrichedCameraSource['fovFeature'];

export declare function createSectorCameraAdapter(options?: {
  role?: 'PUBLIC_VISITOR' | 'INSTITUTIONAL_OPERATOR';
  institutionAuthorized?: boolean;
  now?: () => number;
}): {
  listSectors(): SectorSpec[];
  getSector(sectorId: string): { sector: SectorSpec; cameras: EnrichedCameraSource[] };
  explainSectorDecision(sectorId: string, scenarioOverrides?: ScenarioParameters): SectorCausalTrace;
};
