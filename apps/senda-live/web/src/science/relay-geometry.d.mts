import type { TerrainGridSnapshot } from '../offline/terrain-snapshot';
export interface RelayEndpoint { lat: number; lon: number; antennaHeightM: number }
export interface RelayProfilePoint {
  fraction: number; distanceM: number; lat: number; lon: number;
  groundElevationM: number; rayElevationM: number; firstFresnelM: number;
  clearanceToFresnelM: number;
}
export interface RelayGeometryResult {
  schema: 'senda.rf.terrain-screening/1';
  dataKind: 'GEOMETRIC_RF_SCREENING';
  status: 'MODEL_INDICATES_OBSTRUCTION' | 'MODEL_INDICATES_CLEARANCE' | 'MARGINAL_OR_UNRESOLVED';
  isMeasuredRadioLink: false;
  isAuthorizedGateway: false;
  isOperationalConnectivityGuarantee: false;
  isCalibrated: false;
  sourceRegion: string; sourceDataset: string; terrainAcquiredAt: string | null;
  from: RelayEndpoint & { groundElevationM: number; tipElevationM: number };
  to: RelayEndpoint & { groundElevationM: number; tipElevationM: number };
  assumptions: Record<string, string | number>;
  frequencyMHz: number; distanceM: number; wavelengthM: number;
  idealFreeSpaceLossDb: number; minFresnelClearanceM: number;
  maxFresnelIntrusionM: number; maxFirstFresnelRadiusM: number;
  maximumEarthBulgeM: number; bottleneckAt: RelayProfilePoint;
  profile: RelayProfilePoint[];
}
export interface RelayCorridorResult {
  schema: 'senda.rf.relay-corridor/1';
  dataKind: 'HYPOTHETICAL_RELAY_SITE_GRAPH';
  startSite: string; endSite: string; frequencyMHz: number;
  mastHeightM: number; maxHopKm: number;
  status: 'GEOMETRIC_RELAY_CANDIDATE' | 'NO_GEOMETRIC_ROUTE_FOUND';
  candidateSiteIds: string[];
  hopCount: number | null;
  allScreenedEdges: Array<{
    fromSite: string; toSite: string;
    status: RelayGeometryResult['status']; distanceM: number;
    minClearanceM: number; idealFreeSpaceLossDb: number;
  }>;
  assumedDeploymentSites: Array<{
    id: string; label: string; u: number; v: number;
    lat: number; lon: number; siteId: string;
  }>;
  fieldMeasurementRequired: true;
  ownerAuthorizationRequired: true;
  actualStationsKnown: false;
}
export const RELAY_PRESETS: Readonly<Record<string,{frequencyMHz:number;label:string}>>;
export const RELAY_SITES: ReadonlyArray<{id:string;label:string;u:number;v:number}>;
export function validateGeometryTerrain(terrain: TerrainGridSnapshot): true;
export function terrainAt(terrain: TerrainGridSnapshot, lat: number, lon: number): number;
export function relaySiteCoordinates(terrain: TerrainGridSnapshot, siteId: string): {
  siteId: string; label: string; lat: number; lon: number;
};
export function greatCircleDistanceM(a:{lat:number;lon:number},b:{lat:number;lon:number}):number;
export function fresnelRadiusM(frequencyMHz:number,d1:number,d2:number):number;
export function analyzeTerrainLink(terrain:TerrainGridSnapshot, options:{
  from:RelayEndpoint; to:RelayEndpoint; frequencyMHz?:number;
  kFactor?:number; fresnelFraction?:number; decisionBufferM?:number; samples?:number;
}):RelayGeometryResult;
export function estimateEqualMastHeight(terrain:TerrainGridSnapshot, options:{
  from:Omit<RelayEndpoint,'antennaHeightM'>; to:Omit<RelayEndpoint,'antennaHeightM'>;
  frequencyMHz?:number; kFactor?:number; minMastM?:number;
  maxMastM?:number; decisionBufferM?:number;
}):{requiredHeightM:number|null;status:string;maxMastM:number;limitingClearanceM:number;fieldVerified:false};
export function planRelayCorridor(terrain:TerrainGridSnapshot, options?:{
  startSite?:string;endSite?:string;frequencyMHz?:number;
  mastHeightM?:number;maxHopKm?:number;decisionBufferM?:number;
}):RelayCorridorResult;

export interface RadioShadowField {
  schema: 'senda.rf.terrain-shadow-field/1';
  dataKind: 'HYPOTHETICAL_GEOMETRIC_VISIBILITY';
  sourceRegion: string; sourceDataset: string;
  originSite: string; origin: { lat: number; lon: number };
  frequencyMHz: number; transmitterHeightM: number; receiverHeightM: number;
  gridSize: number; maxRangeKm: number; kFactor: number;
  cellSize: { approxWidthM: number|null; approxHeightM: number|null };
  summary: {
    modelClear: number; modelObstructed: number;
    modelUncertain: number; excludedDistance: number; coincident: number;
  };
  cells: Array<{
    row:number;col:number;lat:number;lon:number;distanceM:number;
    status:RelayGeometryResult['status']|'COINCIDENT_SAMPLE'|'EXCLUDED_BY_USER_DISTANCE_LIMIT';
    minFresnelClearanceM:number|null;
  }>;
  measuredCoverage: false; diffractionModeled: false;
  hypotheticalEquipment: true; fieldValidated: false;
}
export function computeRadioShadowField(terrain: TerrainGridSnapshot, options?: {
  originSite?:string;frequencyMHz?:number;transmitterHeightM?:number;
  receiverHeightM?:number;gridSize?:number;maxRangeKm?:number;kFactor?:number;
}): RadioShadowField;
