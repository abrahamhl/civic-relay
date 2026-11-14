export interface SatelliteBurstFrame {
  byteLength: number;
  crc16Hex: string;
  hexFrame: string;
  compressionRatioVsJson: number;
}

export interface SatelliteLinkBudgetResult {
  orbitProfile: string;
  orbitLabel: string;
  altitudeKm: number;
  elevationDeg: number;
  frequencyMhz: number;
  slantRangeKm: number;
  fsplDb: number;
  totalPathLossDb: number;
  dopplerShiftHz: number;
  cn0DbHz: number;
  snrDb: number;
  linkMarginDb: number;
  linkViable: boolean;
  achievableBitrateBps: number;
  transmissionTimeMs: number | null;
  burstFrame: SatelliteBurstFrame;
  engineeringStatus: string;
  authorizationBoundary: string;
}

export interface ZoneSectorTelemetry {
  id: string;
  row: number;
  col: number;
  nodes: number;
  localDamagePct: number;
  cellularAlive: boolean;
  wifiMeshAlive: boolean;
  bleMeshAlive: boolean;
  safe: number;
  sos: number;
  unknown: number;
  avgRssiDbm: number;
  activeBackhaul: string;
  deliveryPdrPct: number;
  compactFrameHex: string;
  crc16Hex: string;
}

export interface ZoneTelemetryGridResult {
  totalSectors: number;
  totals: {
    nodes: number;
    safe: number;
    sos: number;
    unknown: number;
    sectorsWithCellular: number;
    sectorsConnectedWithOep: number;
  };
  sectors: ZoneSectorTelemetry[];
  withoutOepConnectedSectors: number;
  withOepConnectedSectors: number;
  authorizationBoundary: string;
}

export interface ThroughWallTarget {
  id: string;
  label: string;
  bearingDeg: number;
  totalDistanceMeters: number;
  depthBehindWallMeters: number;
  lateralX: number;
  verticalY: number;
  bestBand: string | null;
  bestRssiDbm: number | null;
  snrDb: number | null;
  detectable: boolean;
  confidencePct: number;
  hasHumanMicroDoppler: boolean;
  respirationBpm: number;
  bandRssi: Record<string, number | null>;
  deviceSensorsActive: string[];
}

export interface ThroughWallRadarResult {
  wallMaterial: string;
  wallThicknessCm: number;
  wallAttenuationDb: Record<string, number>;
  scannerDistanceMeters: number;
  detectedCount: number;
  targets: ThroughWallTarget[];
  csiSubcarriers: Array<{ subcarrier: number; amplitude: number; phaseRad: number }>;
  heatmapGrid: number[][];
  engineeringStatus: string;
  authorizationBoundary: string;
}

export declare const WALL_MATERIALS: Record<string, {
  id: string;
  thicknessCm: number;
  attenuationDb: Record<string, number>;
  multipathScatter: number;
}>;

export declare const SATELLITE_PROFILES: Record<string, {
  id: string;
  orbitType: string;
  altitudeKm: number;
  orbitalVelocityMps: number;
  satelliteEirpDbw: number;
  satelliteGtoTDbK: number;
}>;

export declare function crc16Ccitt(bytes: Uint8Array): number;
export declare function encodeCompactSatelliteBurst(params?: {
  zoneId?: string;
  sectorIndex?: number;
  safeCount?: number;
  sosCount?: number;
  unknownCount?: number;
  relayNodes?: number;
  timestampSec?: number;
}): SatelliteBurstFrame;

export declare function computeSatelliteLinkBudget(params?: {
  orbitProfile?: string;
  elevationDeg?: number;
  frequencyMhz?: number;
  weatherAttenuationDb?: number;
  handsetTxPowerDbm?: number;
  zoneId?: string;
  safeCount?: number;
  sosCount?: number;
  unknownCount?: number;
}): SatelliteLinkBudgetResult;

export declare function computeZoneTelemetryGrid(params?: {
  totalDevices?: number;
  infrastructureDamagePct?: number;
  satelliteBridgeEnabled?: boolean;
  seed?: number;
}): ZoneTelemetryGridResult;

export declare function runThroughWallRfRadar(params?: {
  wallMaterial?: string;
  scannerDistanceMeters?: number;
  activeBands?: { SUB_GHZ?: boolean; WIFI_24?: boolean; BLE_24?: boolean; WIFI_50?: boolean; IMU_MAG?: boolean };
  timeStep?: number;
}): ThroughWallRadarResult;
