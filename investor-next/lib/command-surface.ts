export type ScenarioId = 'blackout' | 'degraded' | 'recovery';
export type ChannelId = 'ACOUSTIC' | 'BLE' | 'WIFI' | 'LORA' | 'SMS' | 'SAT' | 'CELL' | 'GATEWAY';
export type ActivationKind =
  | 'PERSON_SOS'
  | 'CHECKIN'
  | 'SENSOR_THERMAL'
  | 'SENSOR_SEISMIC'
  | 'CAMERA'
  | 'RADAR'
  | 'DRONE'
  | 'INFRA_POWER';
export type ActivationStatus = 'NEW' | 'TRIAGED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'UNCONFIRMED';
export type Severity = 'ROJO' | 'AMARILLO' | 'VERDE';
export type AssetKind = 'GATEWAY' | 'STATION' | 'RADAR' | 'CAMERA' | 'TURBINE' | 'DRONE';
export type AssetStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type TrackKind = 'TEAM' | 'PERSON' | 'DRONE';
export type WallMaterialId = 'DRYWALL' | 'BRICK_25CM' | 'CONCRETE_30CM' | 'COLLAPSED_RUBBLE';
export type EnvironmentId = 'OPEN' | 'RURAL' | 'SUBURBAN' | 'URBAN' | 'RUBBLE';

export interface EnvironmentSpec {
  pathLossExponent: number;
  shadowingSigmaDb: number;
  clutterLossDb: number;
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentSpec> = {
  OPEN: { pathLossExponent: 2, shadowingSigmaDb: 3, clutterLossDb: 0 },
  RURAL: { pathLossExponent: 2.2, shadowingSigmaDb: 4, clutterLossDb: 2 },
  SUBURBAN: { pathLossExponent: 2.7, shadowingSigmaDb: 6, clutterLossDb: 6 },
  URBAN: { pathLossExponent: 3.2, shadowingSigmaDb: 8, clutterLossDb: 12 },
  RUBBLE: { pathLossExponent: 3.8, shadowingSigmaDb: 9, clutterLossDb: 18 }
};

export const DEFAULT_ENVIRONMENT: EnvironmentId = 'SUBURBAN';
export const MODEL_VERSION = 'mando-2.2.0';

export interface CalibrationSource {
  id: string;
  scope: string;
  status: 'STANDARD' | 'ADAPTED' | 'IMPLEMENTED' | 'PENDING';
}

export const CALIBRATION_SOURCES: CalibrationSource[] = [
  { id: 'ITU-R P.525', scope: 'free-space path loss', status: 'STANDARD' },
  { id: '3GPP TR 38.901', scope: 'log-distance and shadow fading', status: 'ADAPTED' },
  { id: 'Semtech AN1200.13', scope: 'LoRa airtime', status: 'IMPLEMENTED' },
  { id: 'ETSI EN 300 220', scope: 'sub-GHz planning limits', status: 'ADAPTED' },
  { id: 'Campana de campo 2026', scope: 'site-specific calibration', status: 'PENDING' }
];

export interface ChannelSpec {
  id: ChannelId;
  rangeM: number;
  rubbleRangeM: number;
  rateBps: number;
  maxBytes: number;
  latencyS: number;
  energy: number;
  global: boolean;
  color: string;
}

export const CHANNEL_ORDER: ChannelId[] = ['ACOUSTIC', 'BLE', 'WIFI', 'LORA', 'SMS', 'SAT', 'CELL', 'GATEWAY'];

export const CHANNELS: Record<ChannelId, ChannelSpec> = {
  ACOUSTIC: { id: 'ACOUSTIC', rangeM: 30, rubbleRangeM: 6, rateBps: 160, maxBytes: 4096, latencyS: 9.2, energy: 1, global: false, color: '#f0abfc' },
  BLE: { id: 'BLE', rangeM: 40, rubbleRangeM: 8, rateBps: 100000, maxBytes: 65536, latencyS: 0.4, energy: 1, global: false, color: '#5eead4' },
  WIFI: { id: 'WIFI', rangeM: 120, rubbleRangeM: 15, rateBps: 20000000, maxBytes: 52428800, latencyS: 1.5, energy: 3, global: false, color: '#60a5fa' },
  LORA: { id: 'LORA', rangeM: 3000, rubbleRangeM: 300, rateBps: 1000, maxBytes: 200, latencyS: 3, energy: 1, global: false, color: '#fbbf24' },
  SMS: { id: 'SMS', rangeM: 10000, rubbleRangeM: 10000, rateBps: 1120, maxBytes: 840, latencyS: 3, energy: 1, global: true, color: '#f472b6' },
  SAT: { id: 'SAT', rangeM: 10000, rubbleRangeM: 10000, rateBps: 300, maxBytes: 160, latencyS: 8, energy: 2, global: true, color: '#a78bfa' },
  CELL: { id: 'CELL', rangeM: 10000, rubbleRangeM: 10000, rateBps: 2000000, maxBytes: Number.MAX_SAFE_INTEGER, latencyS: 1, energy: 0, global: true, color: '#34d399' },
  GATEWAY: { id: 'GATEWAY', rangeM: 10000, rubbleRangeM: 10000, rateBps: 1000000000, maxBytes: Number.MAX_SAFE_INTEGER, latencyS: 0.2, energy: 0, global: true, color: '#e2e8f0' }
};

export interface ScenarioSpec {
  id: ScenarioId;
  activeChannels: ChannelId[];
  gatewayOnline: boolean;
  damagePct: number;
  meshNodes: number;
  seed: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioSpec> = {
  blackout: {
    id: 'blackout',
    activeChannels: ['ACOUSTIC', 'BLE', 'LORA', 'SAT'],
    gatewayOnline: false,
    damagePct: 100,
    meshNodes: 17,
    seed: 11
  },
  degraded: {
    id: 'degraded',
    activeChannels: ['ACOUSTIC', 'BLE', 'WIFI', 'LORA', 'SMS', 'SAT'],
    gatewayOnline: true,
    damagePct: 65,
    meshNodes: 31,
    seed: 29
  },
  recovery: {
    id: 'recovery',
    activeChannels: ['ACOUSTIC', 'BLE', 'WIFI', 'LORA', 'SMS', 'SAT', 'CELL'],
    gatewayOnline: true,
    damagePct: 15,
    meshNodes: 46,
    seed: 47
  }
};

export interface AssetSpec {
  id: string;
  kind: AssetKind;
  x: number;
  y: number;
  coverageM: number;
  channels: ChannelId[];
  status: Record<ScenarioId, AssetStatus>;
}

export const ASSETS: AssetSpec[] = [
  {
    id: 'GW-01',
    kind: 'GATEWAY',
    x: 150,
    y: 500,
    coverageM: 4000,
    channels: ['LORA', 'SMS', 'SAT', 'CELL'],
    status: { blackout: 'OFFLINE', degraded: 'DEGRADED', recovery: 'ONLINE' }
  },
  {
    id: 'ST-02',
    kind: 'STATION',
    x: 390,
    y: 520,
    coverageM: 3000,
    channels: ['ACOUSTIC', 'LORA', 'SMS', 'SAT', 'CELL'],
    status: { blackout: 'DEGRADED', degraded: 'ONLINE', recovery: 'ONLINE' }
  },
  {
    id: 'RD-03',
    kind: 'RADAR',
    x: 540,
    y: 210,
    coverageM: 1800,
    channels: ['LORA', 'ACOUSTIC'],
    status: { blackout: 'DEGRADED', degraded: 'ONLINE', recovery: 'ONLINE' }
  },
  {
    id: 'CAM-04',
    kind: 'CAMERA',
    x: 760,
    y: 250,
    coverageM: 900,
    channels: ['WIFI', 'LORA'],
    status: { blackout: 'OFFLINE', degraded: 'DEGRADED', recovery: 'ONLINE' }
  },
  {
    id: 'WT-05',
    kind: 'TURBINE',
    x: 860,
    y: 120,
    coverageM: 600,
    channels: ['LORA'],
    status: { blackout: 'ONLINE', degraded: 'ONLINE', recovery: 'ONLINE' }
  },
  {
    id: 'DR-06',
    kind: 'DRONE',
    x: 620,
    y: 330,
    coverageM: 1200,
    channels: ['WIFI', 'BLE', 'LORA'],
    status: { blackout: 'DEGRADED', degraded: 'ONLINE', recovery: 'ONLINE' }
  },
  {
    id: 'CAM-07',
    kind: 'CAMERA',
    x: 250,
    y: 160,
    coverageM: 800,
    channels: ['WIFI', 'LORA'],
    status: { blackout: 'OFFLINE', degraded: 'DEGRADED', recovery: 'ONLINE' }
  },
  {
    id: 'ST-08',
    kind: 'STATION',
    x: 820,
    y: 520,
    coverageM: 2800,
    channels: ['LORA', 'SMS', 'SAT', 'CELL'],
    status: { blackout: 'OFFLINE', degraded: 'DEGRADED', recovery: 'ONLINE' }
  }
];

export function assetStatus(id: string, scenario: ScenarioId): AssetStatus {
  return ASSETS.find(asset => asset.id === id)?.status[scenario] ?? 'OFFLINE';
}

export function activeAssets(scenario: ScenarioId): AssetSpec[] {
  return ASSETS.filter(asset => assetStatus(asset.id, scenario) !== 'OFFLINE');
}

export interface TrackPoint {
  t: number;
  x: number;
  y: number;
}

export interface TrackSpec {
  id: string;
  kind: TrackKind;
  status: ActivationStatus;
  channel: ChannelId;
  confidence: number;
  points: TrackPoint[];
}

export const TRACKS: TrackSpec[] = [
  {
    id: 'R3',
    kind: 'TEAM',
    status: 'IN_PROGRESS',
    channel: 'LORA',
    confidence: 0.93,
    points: [
      { t: 0, x: 160, y: 500 },
      { t: 180, x: 260, y: 470 },
      { t: 360, x: 360, y: 450 },
      { t: 540, x: 470, y: 420 },
      { t: 720, x: 560, y: 390 },
      { t: 900, x: 650, y: 370 }
    ]
  },
  {
    id: 'A1',
    kind: 'TEAM',
    status: 'ASSIGNED',
    channel: 'WIFI',
    confidence: 0.9,
    points: [
      { t: 0, x: 840, y: 500 },
      { t: 225, x: 790, y: 470 },
      { t: 450, x: 730, y: 430 },
      { t: 675, x: 680, y: 400 },
      { t: 900, x: 640, y: 370 }
    ]
  },
  {
    id: 'DR-06',
    kind: 'DRONE',
    status: 'IN_PROGRESS',
    channel: 'SAT',
    confidence: 0.86,
    points: Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 9) * Math.PI * 2;
      return { t: index * 100, x: 620 + Math.cos(angle) * 70, y: 330 + Math.sin(angle) * 45 };
    })
  },
  {
    id: 'P-01',
    kind: 'PERSON',
    status: 'IN_PROGRESS',
    channel: 'SAT',
    confidence: 0.74,
    points: [
      { t: 0, x: 400, y: 290 },
      { t: 300, x: 412, y: 296 },
      { t: 600, x: 422, y: 299 },
      { t: 900, x: 430, y: 300 }
    ]
  },
  {
    id: 'P-02',
    kind: 'PERSON',
    status: 'TRIAGED',
    channel: 'ACOUSTIC',
    confidence: 0.81,
    points: [
      { t: 0, x: 500, y: 395 },
      { t: 300, x: 505, y: 398 },
      { t: 600, x: 509, y: 400 },
      { t: 900, x: 512, y: 402 }
    ]
  },
  {
    id: 'P-03',
    kind: 'PERSON',
    status: 'TRIAGED',
    channel: 'SMS',
    confidence: 0.68,
    points: [
      { t: 0, x: 735, y: 420 },
      { t: 300, x: 738, y: 424 },
      { t: 600, x: 740, y: 427 },
      { t: 900, x: 742, y: 430 }
    ]
  },
  {
    id: 'P-04',
    kind: 'PERSON',
    status: 'ASSIGNED',
    channel: 'ACOUSTIC',
    confidence: 0.77,
    points: [
      { t: 0, x: 690, y: 350 },
      { t: 300, x: 694, y: 354 },
      { t: 600, x: 697, y: 357 },
      { t: 900, x: 700, y: 360 }
    ]
  },
  {
    id: 'P-05',
    kind: 'PERSON',
    status: 'UNCONFIRMED',
    channel: 'SMS',
    confidence: 0.52,
    points: [
      { t: 0, x: 550, y: 460 },
      { t: 300, x: 554, y: 464 },
      { t: 600, x: 557, y: 467 },
      { t: 900, x: 560, y: 470 }
    ]
  }
];

export interface ActivationSpec {
  id: string;
  t: number;
  kind: ActivationKind;
  channel: ChannelId;
  severity: Severity;
  baseStatus: ActivationStatus;
  x: number;
  y: number;
  bytes: number;
  confidence: number;
  consent: boolean;
  source: string;
  trackId?: string;
  triageS: number | null;
}

export const ACTIVATIONS: ActivationSpec[] = [
  { id: 'ACT-2401', t: 12, kind: 'PERSON_SOS', channel: 'ACOUSTIC', severity: 'ROJO', baseStatus: 'TRIAGED', x: 512, y: 402, bytes: 96, confidence: 0.94, consent: true, source: 'ACOUSTIC-P02', trackId: 'P-02', triageS: 38 },
  { id: 'ACT-2402', t: 28, kind: 'SENSOR_THERMAL', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'NEW', x: 335, y: 305, bytes: 42, confidence: 0.81, consent: false, source: 'THERMAL-07', triageS: null },
  { id: 'ACT-2403', t: 46, kind: 'CAMERA', channel: 'CELL', severity: 'AMARILLO', baseStatus: 'TRIAGED', x: 760, y: 252, bytes: 180, confidence: 0.88, consent: true, source: 'DGT-CAM-04', triageS: 62 },
  { id: 'ACT-2404', t: 61, kind: 'RADAR', channel: 'LORA', severity: 'ROJO', baseStatus: 'TRIAGED', x: 545, y: 215, bytes: 64, confidence: 0.9, consent: false, source: 'RF-RADAR-03', triageS: 44 },
  { id: 'ACT-2405', t: 78, kind: 'CHECKIN', channel: 'BLE', severity: 'VERDE', baseStatus: 'RESOLVED', x: 300, y: 470, bytes: 38, confidence: 0.99, consent: true, source: 'BLE-MESH-12', triageS: 21 },
  { id: 'ACT-2406', t: 95, kind: 'INFRA_POWER', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'ASSIGNED', x: 858, y: 124, bytes: 52, confidence: 0.84, consent: false, source: 'WT-05-TELEM', triageS: 57 },
  { id: 'ACT-2407', t: 112, kind: 'DRONE', channel: 'SAT', severity: 'ROJO', baseStatus: 'IN_PROGRESS', x: 620, y: 330, bytes: 128, confidence: 0.92, consent: false, source: 'DRONE-06', trackId: 'DR-06', triageS: 49 },
  { id: 'ACT-2408', t: 134, kind: 'PERSON_SOS', channel: 'SMS', severity: 'ROJO', baseStatus: 'TRIAGED', x: 742, y: 430, bytes: 96, confidence: 0.89, consent: true, source: 'SMS-P03', trackId: 'P-03', triageS: 41 },
  { id: 'ACT-2409', t: 158, kind: 'SENSOR_SEISMIC', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'NEW', x: 245, y: 185, bytes: 36, confidence: 0.76, consent: false, source: 'SEIS-02', triageS: null },
  { id: 'ACT-2410', t: 177, kind: 'CHECKIN', channel: 'CELL', severity: 'VERDE', baseStatus: 'RESOLVED', x: 390, y: 520, bytes: 210, confidence: 0.97, consent: true, source: 'ST-02-GW', triageS: 33 },
  { id: 'ACT-2411', t: 201, kind: 'CAMERA', channel: 'WIFI', severity: 'AMARILLO', baseStatus: 'TRIAGED', x: 250, y: 162, bytes: 140, confidence: 0.86, consent: true, source: 'CAM-07', triageS: 51 },
  { id: 'ACT-2412', t: 226, kind: 'PERSON_SOS', channel: 'ACOUSTIC', severity: 'ROJO', baseStatus: 'ASSIGNED', x: 700, y: 360, bytes: 96, confidence: 0.91, consent: true, source: 'ACOUSTIC-P04', trackId: 'P-04', triageS: 46 },
  { id: 'ACT-2413', t: 251, kind: 'CHECKIN', channel: 'BLE', severity: 'VERDE', baseStatus: 'RESOLVED', x: 610, y: 390, bytes: 38, confidence: 0.98, consent: true, source: 'BLE-MESH-21', triageS: 19 },
  { id: 'ACT-2414', t: 279, kind: 'RADAR', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'UNCONFIRMED', x: 820, y: 520, bytes: 64, confidence: 0.62, consent: false, source: 'ST-08-RF', triageS: null },
  { id: 'ACT-2415', t: 306, kind: 'PERSON_SOS', channel: 'SAT', severity: 'ROJO', baseStatus: 'IN_PROGRESS', x: 430, y: 300, bytes: 96, confidence: 0.93, consent: true, source: 'SAT-P01', trackId: 'P-01', triageS: 39 },
  { id: 'ACT-2416', t: 334, kind: 'SENSOR_THERMAL', channel: 'CELL', severity: 'AMARILLO', baseStatus: 'TRIAGED', x: 880, y: 300, bytes: 76, confidence: 0.83, consent: true, source: 'DGT-CAM-11', triageS: 58 },
  { id: 'ACT-2417', t: 362, kind: 'INFRA_POWER', channel: 'LORA', severity: 'VERDE', baseStatus: 'RESOLVED', x: 860, y: 126, bytes: 52, confidence: 0.87, consent: false, source: 'WT-05-TELEM', triageS: 29 },
  { id: 'ACT-2418', t: 401, kind: 'PERSON_SOS', channel: 'SMS', severity: 'ROJO', baseStatus: 'ASSIGNED', x: 560, y: 470, bytes: 96, confidence: 0.9, consent: true, source: 'SMS-P05', trackId: 'P-05', triageS: 43 },
  { id: 'ACT-2419', t: 452, kind: 'DRONE', channel: 'WIFI', severity: 'AMARILLO', baseStatus: 'IN_PROGRESS', x: 600, y: 315, bytes: 120, confidence: 0.85, consent: false, source: 'DRONE-06', trackId: 'DR-06', triageS: 54 },
  { id: 'ACT-2420', t: 510, kind: 'SENSOR_SEISMIC', channel: 'CELL', severity: 'AMARILLO', baseStatus: 'UNCONFIRMED', x: 180, y: 380, bytes: 36, confidence: 0.58, consent: false, source: 'SEIS-01', triageS: null },
  { id: 'ACT-2421', t: 548, kind: 'PERSON_SOS', channel: 'SMS', severity: 'ROJO', baseStatus: 'TRIAGED', x: 735, y: 425, bytes: 96, confidence: 0.9, consent: true, source: 'SMS-P03', trackId: 'P-03', triageS: 40 },
  { id: 'ACT-2422', t: 579, kind: 'CAMERA', channel: 'WIFI', severity: 'AMARILLO', baseStatus: 'NEW', x: 760, y: 250, bytes: 140, confidence: 0.82, consent: true, source: 'CAM-04', triageS: null },
  { id: 'ACT-2423', t: 611, kind: 'CHECKIN', channel: 'BLE', severity: 'VERDE', baseStatus: 'RESOLVED', x: 560, y: 470, bytes: 38, confidence: 0.98, consent: true, source: 'BLE-MESH-33', trackId: 'P-05', triageS: 22 },
  { id: 'ACT-2424', t: 642, kind: 'SENSOR_THERMAL', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'TRIAGED', x: 335, y: 305, bytes: 42, confidence: 0.79, consent: false, source: 'THERMAL-07', triageS: 61 },
  { id: 'ACT-2425', t: 673, kind: 'PERSON_SOS', channel: 'ACOUSTIC', severity: 'ROJO', baseStatus: 'IN_PROGRESS', x: 512, y: 402, bytes: 96, confidence: 0.92, consent: true, source: 'ACOUSTIC-P02', trackId: 'P-02', triageS: 37 },
  { id: 'ACT-2426', t: 704, kind: 'DRONE', channel: 'SAT', severity: 'AMARILLO', baseStatus: 'ASSIGNED', x: 620, y: 330, bytes: 128, confidence: 0.87, consent: false, source: 'DRONE-06', trackId: 'DR-06', triageS: 55 },
  { id: 'ACT-2427', t: 736, kind: 'INFRA_POWER', channel: 'LORA', severity: 'VERDE', baseStatus: 'RESOLVED', x: 858, y: 124, bytes: 52, confidence: 0.88, consent: false, source: 'WT-05-TELEM', triageS: 31 },
  { id: 'ACT-2428', t: 768, kind: 'RADAR', channel: 'CELL', severity: 'AMARILLO', baseStatus: 'TRIAGED', x: 820, y: 520, bytes: 64, confidence: 0.81, consent: false, source: 'ST-08-RF', triageS: 59 },
  { id: 'ACT-2429', t: 799, kind: 'PERSON_SOS', channel: 'SMS', severity: 'ROJO', baseStatus: 'ASSIGNED', x: 742, y: 430, bytes: 96, confidence: 0.9, consent: true, source: 'SMS-P03', trackId: 'P-03', triageS: 42 },
  { id: 'ACT-2430', t: 827, kind: 'CHECKIN', channel: 'BLE', severity: 'VERDE', baseStatus: 'RESOLVED', x: 390, y: 520, bytes: 38, confidence: 0.99, consent: true, source: 'BLE-MESH-41', triageS: 20 },
  { id: 'ACT-2431', t: 851, kind: 'SENSOR_SEISMIC', channel: 'LORA', severity: 'AMARILLO', baseStatus: 'UNCONFIRMED', x: 245, y: 185, bytes: 36, confidence: 0.6, consent: false, source: 'SEIS-02', triageS: null },
  { id: 'ACT-2432', t: 873, kind: 'CAMERA', channel: 'WIFI', severity: 'AMARILLO', baseStatus: 'NEW', x: 250, y: 162, bytes: 140, confidence: 0.84, consent: true, source: 'CAM-07', triageS: null },
  { id: 'ACT-2433', t: 891, kind: 'PERSON_SOS', channel: 'SAT', severity: 'ROJO', baseStatus: 'TRIAGED', x: 430, y: 300, bytes: 96, confidence: 0.93, consent: true, source: 'SAT-P01', trackId: 'P-01', triageS: 40 },
  { id: 'ACT-2434', t: 899, kind: 'CHECKIN', channel: 'CELL', severity: 'VERDE', baseStatus: 'RESOLVED', x: 700, y: 360, bytes: 38, confidence: 0.98, consent: true, source: 'CELL-MESH-08', triageS: 18 }
];

export function statusFor(base: ActivationStatus, scenario: ScenarioId): ActivationStatus {
  const blackout: Record<ActivationStatus, ActivationStatus> = {
    NEW: 'NEW',
    TRIAGED: 'TRIAGED',
    ASSIGNED: 'TRIAGED',
    IN_PROGRESS: 'ASSIGNED',
    RESOLVED: 'IN_PROGRESS',
    UNCONFIRMED: 'UNCONFIRMED'
  };
  const recovery: Record<ActivationStatus, ActivationStatus> = {
    NEW: 'TRIAGED',
    TRIAGED: 'ASSIGNED',
    ASSIGNED: 'IN_PROGRESS',
    IN_PROGRESS: 'RESOLVED',
    RESOLVED: 'RESOLVED',
    UNCONFIRMED: 'TRIAGED'
  };
  if (scenario === 'blackout') return blackout[base];
  if (scenario === 'recovery') return recovery[base];
  return base;
}

export function channelActive(channel: ChannelId, scenario: ScenarioId): boolean {
  return channel === 'GATEWAY' ? SCENARIOS[scenario].gatewayOnline : SCENARIOS[scenario].activeChannels.includes(channel);
}

export function mapDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceM(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return mapDistance(a, b) * 10;
}

export function trackAt(track: TrackSpec, time: number): TrackPoint {
  const first = track.points[0];
  const last = track.points[track.points.length - 1];
  if (time <= first.t) return first;
  if (time >= last.t) return last;
  for (let index = 1; index < track.points.length; index += 1) {
    const from = track.points[index - 1];
    const to = track.points[index];
    if (time <= to.t) {
      const ratio = (time - from.t) / Math.max(1, to.t - from.t);
      return { t: time, x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
  }
  return last;
}

export interface AnchorFix {
  id: string;
  x: number;
  y: number;
  distance: number;
  sigma?: number;
}

export type TrilaterationStatus = 'DETERMINED' | 'UNDERDETERMINED';

export interface TrilaterationResult {
  status: TrilaterationStatus;
  x: number | null;
  y: number | null;
  errorM: number | null;
  gdop: number | null;
  ellipseMajorM: number | null;
  ellipseMinorM: number | null;
  angleDeg: number | null;
  anchorCount: number;
}

const EMPTY_FIX: TrilaterationResult = {
  status: 'UNDERDETERMINED',
  x: null,
  y: null,
  errorM: null,
  gdop: null,
  ellipseMajorM: null,
  ellipseMinorM: null,
  angleDeg: null,
  anchorCount: 0
};

function sigmaFor(anchor: AnchorFix): number {
  return Math.max(0.25, anchor.sigma ?? 1);
}

export function trilaterate2D(anchors: AnchorFix[]): TrilaterationResult {
  if (anchors.length === 0) return EMPTY_FIX;
  if (anchors.length < 3) {
    return {
      status: 'UNDERDETERMINED',
      x: null,
      y: null,
      errorM: null,
      gdop: null,
      ellipseMajorM: null,
      ellipseMinorM: null,
      angleDeg: null,
      anchorCount: anchors.length
    };
  }
  const [origin, ...rest] = [...anchors].sort((a, b) => sigmaFor(a) - sigmaFor(b));
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  for (const anchor of rest) {
    const weight = 1 / Math.pow(sigmaFor(anchor), 2);
    const dx = 2 * (anchor.x - origin.x);
    const dy = 2 * (anchor.y - origin.y);
    const rhs =
      origin.distance * origin.distance -
      anchor.distance * anchor.distance +
      anchor.x * anchor.x +
      anchor.y * anchor.y -
      origin.x * origin.x -
      origin.y * origin.y;
    a11 += weight * dx * dx;
    a12 += weight * dx * dy;
    a22 += weight * dy * dy;
    b1 += weight * dx * rhs;
    b2 += weight * dy * rhs;
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-6) {
    return {
      status: 'UNDERDETERMINED',
      x: null,
      y: null,
      errorM: null,
      gdop: null,
      ellipseMajorM: null,
      ellipseMinorM: null,
      angleDeg: null,
      anchorCount: anchors.length
    };
  }
  const x = (b1 * a22 - b2 * a12) / det;
  const y = (a11 * b2 - a12 * b1) / det;
  const weightSum = anchors.reduce((sum, anchor) => sum + 1 / Math.pow(sigmaFor(anchor), 2), 0);
  const residual =
    anchors.reduce(
      (sum, anchor) =>
        sum +
        (Math.abs(Math.hypot(x - anchor.x, y - anchor.y) - anchor.distance) / Math.pow(sigmaFor(anchor), 2)),
      0
    ) / Math.max(1e-9, weightSum);

  let h11 = 0;
  let h12 = 0;
  let h22 = 0;
  for (const anchor of anchors) {
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const range = Math.max(1e-9, Math.hypot(dx, dy));
    const rowX = -dx / range;
    const rowY = -dy / range;
    h11 += rowX * rowX;
    h12 += rowX * rowY;
    h22 += rowY * rowY;
  }
  const hDet = h11 * h22 - h12 * h12;
  if (Math.abs(hDet) < 1e-6) {
    return {
      status: 'UNDERDETERMINED',
      x,
      y,
      errorM: residual * 10,
      gdop: null,
      ellipseMajorM: null,
      ellipseMinorM: null,
      angleDeg: null,
      anchorCount: anchors.length
    };
  }
  const sigmaRef = Math.sqrt(anchors.reduce((sum, anchor) => sum + Math.pow(sigmaFor(anchor), 2), 0) / anchors.length);
  const covariance = {
    xx: (h22 / hDet) * sigmaRef * sigmaRef,
    xy: (-h12 / hDet) * sigmaRef * sigmaRef,
    yy: (h11 / hDet) * sigmaRef * sigmaRef
  };
  const gdop = Math.sqrt(Math.max(0, (h11 + h22) / hDet));
  const trace = covariance.xx + covariance.yy;
  const radial = Math.sqrt(Math.max(0, Math.pow((covariance.xx - covariance.yy) / 2, 2) + covariance.xy * covariance.xy));
  const lambdaMajor = Math.max(0, trace / 2 + radial);
  const lambdaMinor = Math.max(0, trace / 2 - radial);
  const angleDeg = (Math.atan2(2 * covariance.xy, covariance.xx - covariance.yy) * 90) / Math.PI;
  return {
    status: 'DETERMINED',
    x,
    y,
    errorM: residual * 10,
    gdop,
    ellipseMajorM: 2.4477 * Math.sqrt(lambdaMajor) * 10,
    ellipseMinorM: 2.4477 * Math.sqrt(lambdaMinor) * 10,
    angleDeg,
    anchorCount: anchors.length
  };
}

export const WALL_MATERIALS: Record<WallMaterialId, { attenuationDb: { subGhz: number; wifi24: number; wifi50: number } }> = {
  DRYWALL: { attenuationDb: { subGhz: 1.5, wifi24: 3.2, wifi50: 4.8 } },
  BRICK_25CM: { attenuationDb: { subGhz: 4.5, wifi24: 8.4, wifi50: 14.2 } },
  CONCRETE_30CM: { attenuationDb: { subGhz: 9.8, wifi24: 17.5, wifi50: 28.6 } },
  COLLAPSED_RUBBLE: { attenuationDb: { subGhz: 12.4, wifi24: 23.8, wifi50: 36.5 } }
};

function wallBand(frequencyMhz: number): 'subGhz' | 'wifi24' | 'wifi50' {
  if (frequencyMhz < 1000) return 'subGhz';
  if (frequencyMhz < 3000) return 'wifi24';
  return 'wifi50';
}

export interface LinkBudgetInput {
  frequencyMhz: number;
  distanceM: number;
  txPowerDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  sensitivityDbm: number;
  wallMaterial: WallMaterialId;
  walls: number;
  bandwidthHz: number;
  noiseFigureDb: number;
  environment?: EnvironmentId;
  pathLossExponent?: number;
  shadowingSigmaDb?: number;
  clutterLossDb?: number;
  maxRangeCapM?: number;
}

export interface LinkBudgetResult {
  fsplDb: number;
  pathLossDb: number;
  wallLossDb: number;
  shadowingSigmaDb: number;
  receivedDbm: number;
  noiseDbm: number;
  snrDb: number;
  marginDb: number;
  marginP90Db: number;
  linkProbability: number;
  capacityBps: number;
  maxRangeM: number;
  viable: boolean;
  viable90: boolean;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial =
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t);
  return sign * (1 - polynomial * Math.exp(-x * x));
}

function normalCdf(z: number): number {
  return Math.max(0, Math.min(1, 0.5 * (1 + erf(z / Math.SQRT2))));
}

export function computeLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  const distance = Math.max(1, input.distanceM);
  const frequency = Math.max(1, input.frequencyMhz);
  const environment = ENVIRONMENTS[input.environment ?? DEFAULT_ENVIRONMENT];
  const pathLossExponent = Math.max(1.5, input.pathLossExponent ?? environment.pathLossExponent);
  const shadowingSigmaDb = Math.max(0.1, input.shadowingSigmaDb ?? environment.shadowingSigmaDb);
  const clutterLossDb = Math.max(0, input.clutterLossDb ?? environment.clutterLossDb);
  const fsplDb = 32.44 + 20 * Math.log10(distance / 1000) + 20 * Math.log10(frequency);
  const referenceLossDb = 32.44 - 60 + 20 * Math.log10(frequency);
  const pathLossDb = referenceLossDb + 10 * pathLossExponent * Math.log10(distance) + clutterLossDb;
  const wallLossDb = WALL_MATERIALS[input.wallMaterial].attenuationDb[wallBand(frequency)] * Math.max(0, input.walls);
  const receivedDbm = input.txPowerDbm + input.txGainDbi + input.rxGainDbi - pathLossDb - wallLossDb;
  const noiseDbm = -174 + 10 * Math.log10(Math.max(1, input.bandwidthHz)) + input.noiseFigureDb;
  const snrDb = receivedDbm - noiseDbm;
  const marginDb = receivedDbm - input.sensitivityDbm;
  const marginP90Db = marginDb - 1.2815515655 * shadowingSigmaDb;
  const linkProbability = normalCdf(marginDb / shadowingSigmaDb);
  const capacityBps = marginDb > 0 ? input.bandwidthHz * Math.log2(1 + Math.pow(10, snrDb / 10)) : 0;
  const rangeExponent =
    (input.txPowerDbm + input.txGainDbi + input.rxGainDbi - wallLossDb - input.sensitivityDbm - referenceLossDb - clutterLossDb) /
    (10 * pathLossExponent);
  const physicalRangeM = Math.pow(10, rangeExponent);
  const maxRangeM = Math.min(physicalRangeM, Math.max(1, input.maxRangeCapM ?? physicalRangeM));
  return {
    fsplDb,
    pathLossDb,
    wallLossDb,
    shadowingSigmaDb,
    receivedDbm,
    noiseDbm,
    snrDb,
    marginDb,
    marginP90Db,
    linkProbability,
    capacityBps,
    maxRangeM,
    viable: marginDb >= 0,
    viable90: marginP90Db >= 0
  };
}

export function acousticAirtimeSeconds(bytes: number): number {
  return (8 + Math.ceil(((2 + bytes + 4) * 14) / 4)) * 0.025 + 0.1;
}

export function loraAirtimeSeconds(bytes: number, spreadingFactor = 12, bandwidthHz = 125000, codingRate = 1, preamble = 8): number {
  const symbolS = Math.pow(2, spreadingFactor) / bandwidthHz;
  const lowDataRateOptimize = spreadingFactor >= 11 ? 1 : 0;
  const numerator = 8 * bytes - 4 * spreadingFactor + 28 + 16 - 20 * 0;
  const payloadSymbols = 8 + Math.max(Math.ceil(numerator / (4 * (spreadingFactor - 2 * lowDataRateOptimize))) * (codingRate + 4), 0);
  return (preamble + 4.25 + payloadSymbols) * symbolS;
}

export function airtimeSecondsFor(channel: ChannelId, bytes: number): number {
  if (channel === 'ACOUSTIC') return acousticAirtimeSeconds(bytes);
  if (channel === 'LORA') return loraAirtimeSeconds(bytes);
  if (channel === 'SMS') return Math.ceil(bytes / 116) * 3;
  if (channel === 'SAT') return 8 + Math.ceil(bytes / 160) * 8;
  return CHANNELS[channel].latencyS + (bytes * 8) / Math.max(1, CHANNELS[channel].rateBps);
}

const RF_PROFILES: Record<'BLE' | 'WIFI' | 'LORA' | 'SMS' | 'SAT' | 'CELL', { frequencyMhz: number; txPowerDbm: number; sensitivityDbm: number; bandwidthHz: number }> = {
  BLE: { frequencyMhz: 2400, txPowerDbm: 10, sensitivityDbm: -95, bandwidthHz: 2000000 },
  WIFI: { frequencyMhz: 2400, txPowerDbm: 20, sensitivityDbm: -85, bandwidthHz: 20000000 },
  LORA: { frequencyMhz: 868, txPowerDbm: 14, sensitivityDbm: -137, bandwidthHz: 125000 },
  SMS: { frequencyMhz: 900, txPowerDbm: 23, sensitivityDbm: -109, bandwidthHz: 200000 },
  SAT: { frequencyMhz: 1990, txPowerDbm: 23, sensitivityDbm: -120, bandwidthHz: 3600 },
  CELL: { frequencyMhz: 900, txPowerDbm: 23, sensitivityDbm: -110, bandwidthHz: 10000000 }
};

export function nominalMargin(channel: ChannelId, environment: EnvironmentId = DEFAULT_ENVIRONMENT): number | null {
  if (channel === 'ACOUSTIC' || channel === 'GATEWAY') return null;
  const profile = RF_PROFILES[channel];
  const spec = CHANNELS[channel];
  return computeLinkBudget({
    ...profile,
    distanceM: Math.max(30, Math.min(spec.rangeM, spec.rangeM * 0.5)),
    txGainDbi: 2,
    rxGainDbi: 2,
    wallMaterial: 'BRICK_25CM',
    walls: 0,
    noiseFigureDb: 6,
    environment
  }).marginDb;
}

export function linkProbabilityForChannel(
  channel: ChannelId,
  meters: number,
  environment: EnvironmentId = DEFAULT_ENVIRONMENT,
  shadowingSigmaDb?: number
): number {
  if (channel === 'GATEWAY') return 0.985;
  if (channel === 'CELL') return 0.94;
  if (channel === 'SMS') return 0.9;
  if (channel === 'SAT') return 0.88;
  const spec = CHANNELS[channel];
  const rangeM = environment === 'RUBBLE' ? spec.rubbleRangeM : spec.rangeM;
  const ratio = Math.max(0, meters) / Math.max(1, rangeM);
  const planningFactor = 1 / (1 + Math.exp((ratio - 0.9) * 6));
  if (channel === 'ACOUSTIC') {
    return Math.max(0.02, Math.min(0.98, (1 - 0.32 * ratio) * planningFactor));
  }
  const profile = RF_PROFILES[channel];
  const physical = computeLinkBudget({
    ...profile,
    distanceM: Math.max(1, meters),
    txGainDbi: 2,
    rxGainDbi: 2,
    wallMaterial: 'BRICK_25CM',
    walls: 0,
    noiseFigureDb: 6,
    environment,
    shadowingSigmaDb
  }).linkProbability;
  return Math.max(0.02, Math.min(0.995, physical * planningFactor));
}

export interface CoverageCell {
  x: number;
  y: number;
  size: number;
  probability: number;
  channel: ChannelId | null;
  assetId: string | null;
}

export function coverageField(
  scenario: ScenarioId,
  environment: EnvironmentId = DEFAULT_ENVIRONMENT,
  cellSize = 40,
  shadowingSigmaDb?: number
): CoverageCell[] {
  const assets = activeAssets(scenario).filter(asset => asset.kind !== 'GATEWAY');
  const cells: CoverageCell[] = [];
  const size = Math.max(20, cellSize);
  for (let y = 0; y < 640; y += size) {
    for (let x = 0; x < 1000; x += size) {
      let best: CoverageCell = { x, y, size, probability: 0, channel: null, assetId: null };
      const center = { x: x + size / 2, y: y + size / 2 };
      for (const asset of assets) {
        for (const channel of asset.channels) {
          if (CHANNELS[channel].global || !channelActive(channel, scenario)) continue;
          const probability = linkProbabilityForChannel(channel, distanceM(center, asset), environment, shadowingSigmaDb);
          if (probability > best.probability) {
            best = { x, y, size, probability, channel, assetId: asset.id };
          }
        }
      }
      cells.push(best);
    }
  }
  return cells;
}

export function deliveryProbability(attempts: number, perAttempt: number): number {
  const count = Math.max(0, Math.floor(attempts));
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, perAttempt)), count);
}

export interface Analysis {
  total: number;
  open: number;
  unconfirmed: number;
  red: number;
  medianTriageS: number | null;
  verified: number;
  routed: number;
  meanDeliveryPct: number;
  coveragePct: number;
  activeChannelCount: number;
  channelCounts: Record<ChannelId, number>;
  statusCounts: Record<ActivationStatus, number>;
  kindCounts: Record<ActivationKind, number>;
  severityCounts: Record<Severity, number>;
}

function emptyCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return keys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {} as Record<T, number>);
}

export function analyze(
  scenario: ScenarioId,
  time: number,
  environment: EnvironmentId = DEFAULT_ENVIRONMENT,
  shadowingSigmaDb?: number
): Analysis {
  const visible = ACTIVATIONS.filter(activation => activation.t <= time);
  const statuses = visible.map(activation => statusFor(activation.baseStatus, scenario));
  const channelCounts = emptyCounts(CHANNEL_ORDER);
  const statusCounts = emptyCounts(['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'UNCONFIRMED'] as const);
  const kindCounts = emptyCounts([
    'PERSON_SOS',
    'CHECKIN',
    'SENSOR_THERMAL',
    'SENSOR_SEISMIC',
    'CAMERA',
    'RADAR',
    'DRONE',
    'INFRA_POWER'
  ] as const);
  const severityCounts = emptyCounts(['ROJO', 'AMARILLO', 'VERDE'] as const);
  const triageTimes: number[] = [];
  let open = 0;
  let unconfirmed = 0;
  let red = 0;
  let verified = 0;
  let covered = 0;
  let routed = 0;
  let deliverySum = 0;
  visible.forEach((activation, index) => {
    const status = statuses[index];
    channelCounts[activation.channel] += 1;
    statusCounts[status] += 1;
    kindCounts[activation.kind] += 1;
    severityCounts[activation.severity] += 1;
    if (status !== 'RESOLVED') open += 1;
    if (status === 'UNCONFIRMED') unconfirmed += 1;
    if (activation.severity === 'ROJO') red += 1;
    if (activation.triageS !== null && status !== 'NEW' && status !== 'UNCONFIRMED') triageTimes.push(activation.triageS);
    if (channelActive(activation.channel, scenario) && (status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'RESOLVED')) {
      verified += 1;
    }
    if (isActivationCovered(activation, scenario)) covered += 1;
    const route = computeMeshRoute(activation, scenario, { environment, shadowingSigmaDb });
    if (route.ok) {
      routed += 1;
      deliverySum += deliveryProbability(3, route.successProbability);
    }
  });
  triageTimes.sort((a, b) => a - b);
  const medianTriageS =
    triageTimes.length === 0
      ? null
      : triageTimes.length % 2 === 1
        ? triageTimes[Math.floor(triageTimes.length / 2)]
        : Math.round((triageTimes[triageTimes.length / 2 - 1] + triageTimes[triageTimes.length / 2]) / 2);
  return {
    total: visible.length,
    open,
    unconfirmed,
    red,
    medianTriageS,
    verified,
    routed,
    meanDeliveryPct: visible.length === 0 ? 0 : (deliverySum / visible.length) * 100,
    coveragePct: visible.length === 0 ? 0 : (covered / visible.length) * 100,
    activeChannelCount: SCENARIOS[scenario].activeChannels.length + (SCENARIOS[scenario].gatewayOnline ? 1 : 0),
    channelCounts,
    statusCounts,
    kindCounts,
    severityCounts
  };
}

export function isActivationCovered(activation: ActivationSpec, scenario: ScenarioId): boolean {
  if (!channelActive(activation.channel, scenario)) return false;
  const spec = CHANNELS[activation.channel];
  return activeAssets(scenario).some(asset => {
    if (!asset.channels.includes(activation.channel)) return false;
    if (asset.kind === 'GATEWAY' && !SCENARIOS[scenario].gatewayOnline) return false;
    if (spec.global) return true;
    return distanceM(activation, asset) <= asset.coverageM;
  });
}

export interface RouteHop {
  from: string;
  to: string;
  channel: ChannelId;
  distanceM: number;
  latencyS: number;
  probability: number;
  pathLossDb: number;
  marginDb: number;
}

export interface MeshRoute {
  ok: boolean;
  hops: RouteHop[];
  etaS: number;
  confidence: number;
  successProbability: number;
  energy: number;
  weakestHop: string | null;
  targetId: string | null;
  reason: 'OK' | 'NO_TARGET' | 'NO_PATH';
}

export interface RoutePlan {
  primary: MeshRoute;
  backup: MeshRoute | null;
}

export interface RouteOptions {
  environment?: EnvironmentId;
  shadowingSigmaDb?: number;
  avoidAssetId?: string;
}

const CHANNEL_CONFIDENCE: Record<ChannelId, number> = {
  ACOUSTIC: 0.7,
  BLE: 0.82,
  WIFI: 0.9,
  LORA: 0.93,
  SMS: 0.88,
  SAT: 0.76,
  CELL: 0.96,
  GATEWAY: 0.99
};

const ROUTE_PREFERENCE: ChannelId[] = ['LORA', 'WIFI', 'BLE', 'ACOUSTIC', 'SMS', 'SAT', 'CELL', 'GATEWAY'];

function sharedChannels(from: { channels: ChannelId[] }, to: { channels: ChannelId[] }, scenario: ScenarioId): ChannelId[] {
  const active = SCENARIOS[scenario].activeChannels;
  const shared: ChannelId[] = [];
  for (const channel of ROUTE_PREFERENCE) {
    if (channel === 'GATEWAY') continue;
    if (from.channels.includes(channel) && to.channels.includes(channel) && active.includes(channel)) shared.push(channel);
  }
  return shared;
}

function routeLinkMetrics(
  channel: ChannelId,
  meters: number,
  environment: EnvironmentId,
  shadowingSigmaDb?: number
): { probability: number; pathLossDb: number; marginDb: number } {
  const probability = linkProbabilityForChannel(channel, meters, environment, shadowingSigmaDb);
  if (channel === 'ACOUSTIC' || CHANNELS[channel].global) {
    return { probability, pathLossDb: 0, marginDb: 0 };
  }
  const profile = RF_PROFILES[channel as keyof typeof RF_PROFILES];
  const budget = computeLinkBudget({
    ...profile,
    distanceM: Math.max(1, meters),
    txGainDbi: 2,
    rxGainDbi: 2,
    wallMaterial: 'BRICK_25CM',
    walls: 0,
    noiseFigureDb: 6,
    environment,
    shadowingSigmaDb
  });
  return { probability, pathLossDb: budget.pathLossDb, marginDb: budget.marginDb };
}

export function computeMeshRoute(
  activation: ActivationSpec,
  scenario: ScenarioId,
  options: RouteOptions = {}
): MeshRoute {
  const environment = options.environment ?? DEFAULT_ENVIRONMENT;
  const target = SCENARIOS[scenario].gatewayOnline ? 'GW-01' : 'ST-02';
  const targetAsset = ASSETS.find(asset => asset.id === target && assetStatus(asset.id, scenario) !== 'OFFLINE');
  if (!targetAsset) {
    return {
      ok: false,
      hops: [],
      etaS: 0,
      confidence: 0,
      successProbability: 0,
      energy: 0,
      weakestHop: null,
      targetId: null,
      reason: 'NO_TARGET'
    };
  }
  const nodes: Array<{ id: string; x: number; y: number; channels: ChannelId[] }> = [
    { id: 'ACT', x: activation.x, y: activation.y, channels: [activation.channel] },
    ...activeAssets(scenario)
      .filter(asset => asset.id !== options.avoidAssetId)
      .map(asset => ({ id: asset.id, x: asset.x, y: asset.y, channels: asset.channels }))
  ];
  const source = nodes[0];
  const destination = nodes.find(node => node.id === targetAsset.id);
  if (!destination) {
    return {
      ok: false,
      hops: [],
      etaS: 0,
      confidence: 0,
      successProbability: 0,
      energy: 0,
      weakestHop: null,
      targetId: null,
      reason: 'NO_TARGET'
    };
  }
  const distances = new Map<string, number>();
  const previous = new Map<
    string,
    { id: string; channel: ChannelId; distanceM: number; latencyS: number; probability: number; pathLossDb: number; marginDb: number }
  >();
  const visited = new Set<string>();
  for (const node of nodes) distances.set(node.id, Number.POSITIVE_INFINITY);
  distances.set(source.id, 0);
  while (visited.size < nodes.length) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      const value = distances.get(node.id) ?? Number.POSITIVE_INFINITY;
      if (value < currentDistance) {
        currentDistance = value;
        currentId = node.id;
      }
    }
    if (currentId === null || currentDistance === Number.POSITIVE_INFINITY) break;
    visited.add(currentId);
    if (currentId === destination.id) break;
    const current = nodes.find(node => node.id === currentId);
    if (!current) continue;
    for (const candidate of nodes) {
      if (visited.has(candidate.id) || candidate.id === current.id) continue;
      const channels = sharedChannels(current, candidate, scenario);
      if (channels.length === 0) continue;
      const meters = distanceM(current, candidate);
      let bestEdge: {
        channel: ChannelId;
        cost: number;
        latencyS: number;
        probability: number;
        pathLossDb: number;
        marginDb: number;
      } | null = null;
      for (const channel of channels) {
        const channelSpec = CHANNELS[channel];
        const rangeM = environment === 'RUBBLE' ? channelSpec.rubbleRangeM : channelSpec.rangeM;
        if (!channelSpec.global && meters > rangeM) continue;
        const transfer = airtimeSecondsFor(channel, activation.bytes);
        const link = routeLinkMetrics(channel, meters, environment, options.shadowingSigmaDb);
        const cost =
          channelSpec.latencyS +
          transfer +
          meters / 1000 +
          (1 - link.probability) * 24 +
          channelSpec.energy * 1.2;
        if (!bestEdge || cost < bestEdge.cost) {
          bestEdge = {
            channel,
            cost,
            latencyS: channelSpec.latencyS + transfer,
            probability: link.probability,
            pathLossDb: link.pathLossDb,
            marginDb: link.marginDb
          };
        }
      }
      if (!bestEdge) continue;
      const nextDistance = currentDistance + bestEdge.cost;
      if (nextDistance < (distances.get(candidate.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(candidate.id, nextDistance);
        previous.set(candidate.id, {
          id: current.id,
          channel: bestEdge.channel,
          distanceM: meters,
          latencyS: bestEdge.latencyS,
          probability: bestEdge.probability,
          pathLossDb: bestEdge.pathLossDb,
          marginDb: bestEdge.marginDb
        });
      }
    }
  }
  if (!previous.has(destination.id)) {
    return {
      ok: false,
      hops: [],
      etaS: 0,
      confidence: 0,
      successProbability: 0,
      energy: 0,
      weakestHop: null,
      targetId: destination.id,
      reason: 'NO_PATH'
    };
  }
  const hops: RouteHop[] = [];
  let cursor = destination.id;
  while (cursor !== source.id) {
    const step = previous.get(cursor);
    if (!step) break;
    hops.unshift({
      from: step.id,
      to: cursor,
      channel: step.channel,
      distanceM: step.distanceM,
      latencyS: step.latencyS,
      probability: step.probability,
      pathLossDb: step.pathLossDb,
      marginDb: step.marginDb
    });
    cursor = step.id;
  }
  const weakest = hops.reduce<RouteHop | null>(
    (worst, hop) => (worst === null || hop.probability < worst.probability ? hop : worst),
    null
  );
  return {
    ok: true,
    hops,
    etaS: hops.reduce((sum, hop) => sum + hop.latencyS, 0) + 8,
    confidence: hops.reduce((product, hop) => product * CHANNEL_CONFIDENCE[hop.channel], 1),
    successProbability: hops.reduce((product, hop) => product * hop.probability, 1),
    energy: hops.reduce((sum, hop) => sum + CHANNELS[hop.channel].energy, 0),
    weakestHop: weakest ? `${weakest.from}→${weakest.to}` : null,
    targetId: destination.id,
    reason: 'OK'
  };
}

export function computeRoutePlan(
  activation: ActivationSpec,
  scenario: ScenarioId,
  options: RouteOptions = {}
): RoutePlan {
  const primary = computeMeshRoute(activation, scenario, options);
  if (!primary.ok || primary.hops.length === 0) return { primary, backup: null };
  const firstHop = primary.hops[0].to;
  if (firstHop === primary.targetId) return { primary, backup: null };
  const backup = computeMeshRoute(activation, scenario, { ...options, avoidAssetId: firstHop });
  return { primary, backup: backup.ok ? backup : null };
}

export function toGeo(x: number, y: number): { lat: number; lon: number } {
  return { lat: 40.4 + (320 - y) * 0.0001, lon: -4.5 + (x - 500) * 0.0001 };
}

export function collectAll(
  scenario: ScenarioId,
  time: number,
  environment: EnvironmentId = DEFAULT_ENVIRONMENT,
  shadowingSigmaDb?: number
): Record<string, unknown> {
  const resolvedShadowing = Math.max(0.1, shadowingSigmaDb ?? ENVIRONMENTS[environment].shadowingSigmaDb);
  const analysis = analyze(scenario, time, environment, shadowingSigmaDb);
  return {
    schema: 'senda-mando-surface/v2',
    generatedAt: new Date().toISOString(),
    scenario,
    environment,
    shadowingSigmaDb: resolvedShadowing,
    timeS: time,
    synthetic: true,
    model: {
      version: MODEL_VERSION,
      propagation: 'log-distance + shadowing + clutter',
      routing: 'multi-criteria Dijkstra + backup path',
      positioning: 'weighted trilateration + 95% ellipse',
      calibration: CALIBRATION_SOURCES
    },
    assumptions: [
      'Planning ranges are not field measurements.',
      'Global channels use scenario-level availability priors.',
      'Shadowing sigma is a planning override, not a field calibration.',
      'The 95% ellipse assumes independent log-normal shadowing.',
      'Routes use a meshed graph of active assets and shared channels.'
    ],
    activations: ACTIVATIONS.filter(activation => activation.t <= time).map(activation => ({
      ...activation,
      status: statusFor(activation.baseStatus, scenario),
      geo: toGeo(activation.x, activation.y)
    })),
    assets: ASSETS.map(asset => ({
      ...asset,
      currentStatus: assetStatus(asset.id, scenario),
      geo: toGeo(asset.x, asset.y)
    })),
    tracks: TRACKS.map(track => ({ ...track, current: trackAt(track, time) })),
    routes: ACTIVATIONS.filter(activation => activation.t <= time).map(activation => ({
      id: activation.id,
      ...computeRoutePlan(activation, scenario, { environment, shadowingSigmaDb })
    })),
    analysis,
    channels: CHANNEL_ORDER.map(channel => ({
      ...CHANNELS[channel],
      active: channelActive(channel, scenario),
      nominalMarginDb: nominalMargin(channel, environment),
      airtime96B: airtimeSecondsFor(channel, 96)
    })),
    corridorIntelligence: getCorridorIntelligenceSnapshot('NL-A12-ARNHEM-EDE', 'SEGMENT')
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDA CORRIDOR FABRIC — PLANO E: CORRIDOR INTELLIGENCE MODE
// ═══════════════════════════════════════════════════════════════════════════

export type CorridorLayerId =
  | 'CAMERAS'
  | 'DASHCAMS'
  | 'ROAD DATA'
  | 'ENVIRONMENT'
  | 'CONNECTED DEVICES'
  | 'GATEWAYS'
  | 'DTN ROUTES'
  | 'DETECTED INCIDENTS'
  | 'EVIDENCE';

export const CORRIDOR_INTELLIGENCE_LAYERS: readonly CorridorLayerId[] = [
  'CAMERAS',
  'DASHCAMS',
  'ROAD DATA',
  'ENVIRONMENT',
  'CONNECTED DEVICES',
  'GATEWAYS',
  'DTN ROUTES',
  'DETECTED INCIDENTS',
  'EVIDENCE'
] as const;

export type CorridorSelectionMode = 'SEGMENT' | 'RADIUS' | 'POLYGON';

export type CorridorVerificationHealth =
  | 'LIVE_VERIFIED'
  | 'RECORDED_REAL_SAMPLE'
  | 'LAB_VERIFIED'
  | 'CATALOG_ONLY'
  | 'PARTNER_ACCESS_REQUIRED'
  | 'PERMISSION_PENDING'
  | 'STALE'
  | 'UNSUPPORTED'
  | 'SYNTHETIC';

export type CorridorMessageLifecycleState =
  | 'QUEUED'
  | 'IN_CUSTODY'
  | 'FORWARDED'
  | 'RECEIVED'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'UNDELIVERABLE'
  | 'BLOCKED';

export interface CorridorSourceNode {
  sourceId: string;
  sectorId: string;
  roadSegmentId: string;
  layer: CorridorLayerId;
  assetType: string;
  operator: string;
  lat: number;
  lon: number;
  accessRights: string;
  auth: string;
  health: CorridorVerificationHealth;
  lastObservedAt: string | null;
  observationCapabilities: string[];
  transportCapabilities: string[];
  canActAsRelay: boolean;
  latestObservationSummary: string;
  videoPreviewUrl: string | null;
  sharedInfrastructureDeps: string[];
  proofRef: string;
}

export type CorridorLocale = 'es' | 'en' | 'nl';

export interface CorridorSectorSpec {
  sectorId: string;
  roadSegmentId: string;
  pilotCode: 'PILOT_A_A12' | 'PILOT_B_BARRIO_LAB' | 'CORRIDOR_ES_N403';
  title: Record<CorridorLocale, string>;
  subtitle: Record<CorridorLocale, string>;
  center: { lat: number; lon: number };
  defaultRadiusM: number;
  polygonCoords: Array<{ lat: number; lon: number }>;
  fusedIncident: {
    eventId: string;
    decision: string;
    posteriorConfidence: number;
    uncertaintyInterval90: [number, number];
    location: { lat: number; lon: number; uncertaintyRadiusM: number };
    corroboratingSources: string[];
    independentFamilies: string[];
    merkleDigestSha256: string;
    summary: Record<CorridorLocale, string>;
  };
  dtnRoutes: Array<{
    routeId: string;
    bearer: string;
    role: 'PRIMARY' | 'DIVERSE_BACKUP' | 'HARDWARE_BLOCKED';
    status: 'OUTAGE_SIMULATED' | 'ACTIVE_CUSTODY' | 'BLOCKED';
    packetLossPct: number;
    latencyMs: number;
    sharedDeps: string[];
    jointSurvivalProbPct: number;
  }>;
  messages: Array<{
    messageId: string;
    kind: 'SOS' | 'OFFICIAL_ALERT';
    state: CorridorMessageLifecycleState;
    wireSizeBytes: number;
    custodyPath: string[];
    transitions: CorridorMessageLifecycleState[];
    canonicalEvidenceHash: string;
    receiptAckHash: string | null;
    note: string;
  }>;
}

export const CORRIDOR_SECTORS: readonly CorridorSectorSpec[] = [
  {
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    pilotCode: 'PILOT_A_A12',
    title: {
      es: 'Piloto A · Corredor Vial A12 (Arnhem–Ede, PK 110–130)',
      en: 'Pilot A · A12 Road Corridor (Arnhem–Ede, HM 110–130)',
      nl: 'Pilot A · A12 Wegcorridor (Arnhem–Ede, HM 110–130)'
    },
    subtitle: {
      es: 'NDW DATEX II v3 SRTI + MONIBAS v2.3 + Dashcam real YOLOX-s/ByteTrack + Custodia DTN (0 cámaras públicas RWS falsas)',
      en: 'NDW DATEX II v3 SRTI + MONIBAS v2.3 + Real YOLOX-s/ByteTrack Dashcam + DTN Custody (0 fake public RWS cameras)',
      nl: 'NDW DATEX II v3 SRTI + MONIBAS v2.3 + Echte YOLOX-s/ByteTrack Dashcam + DTN Custody (0 valse publieke RWS-camera’s)'
    },
    center: { lat: 51.9852, lon: 5.9675 },
    defaultRadiusM: 4500,
    polygonCoords: [
      { lat: 51.96, lon: 5.82 },
      { lat: 51.96, lon: 6.02 },
      { lat: 52.04, lon: 6.02 },
      { lat: 52.04, lon: 5.82 }
    ],
    fusedIncident: {
      eventId: 'evt-nl-a12-hm110-130-c838644c5d',
      decision: 'CONFIRMED_MULTISENSOR_INCIDENT',
      posteriorConfidence: 0.874,
      uncertaintyInterval90: [0.789, 0.959],
      location: { lat: 51.9852, lon: 5.9675, uncertaintyRadiusM: 12 },
      corroboratingSources: ['NDW-NL-A12-SRTI-V3', 'DASHCAM-A12-REAL-TRACE-01', 'OBD-A12-VEHICLE-01'],
      independentFamilies: ['FAMILY_NDW_RWS', 'FAMILY_EGO_VEHICLE_01'],
      merkleDigestSha256: '9e40d658c13852a5e4ebe822edd45f25791800ecec2076e23547bdc6bfd6cea7',
      summary: {
        es: 'Vehículo detenido en A12 Velperbroek (NDW SRTI v3 id=NDW06_e1de14cb) corroborado por frenada brusca (-4.4 m/s²) y seguimiento visual YOLOX-s + ByteTrack (incertidumbre monocular ±30%).',
        en: 'Stationary vehicle on A12 Velperbroek (NDW SRTI v3 id=NDW06_e1de14cb) corroborated by hard braking (-4.4 m/s²) and YOLOX-s + ByteTrack visual tracking (monocular uncertainty ±30%).',
        nl: 'Stilstaand voertuig op A12 Velperbroek (NDW SRTI v3 id=NDW06_e1de14cb) bevestigd door hard remmen (-4.4 m/s²) en YOLOX-s + ByteTrack visuele tracking (monoculaire onzekerheid ±30%).'
      }
    },
    dtnRoutes: [
      {
        routeId: 'ROUTE-CELL-KPN-PRIMARY',
        bearer: 'LTE_5G_IP_BACKHAUL',
        role: 'PRIMARY',
        status: 'OUTAGE_SIMULATED',
        packetLossPct: 100,
        latencyMs: 9999,
        sharedDeps: ['INFRA-NL-KPN-CELL-TOWER-ARNHEM-04', 'INFRA-NL-KPN-FIBER-ARNHEM', 'INFRA-NL-ALLIANDER-GRID-GELDERLAND'],
        jointSurvivalProbPct: 52.2
      },
      {
        routeId: 'ROUTE-OPPORTUNISTIC-NEARBY-P2P',
        bearer: 'ANDROID_NEARBY_TO_LOCAL_RELAY',
        role: 'DIVERSE_BACKUP',
        status: 'ACTIVE_CUSTODY',
        packetLossPct: 1.8,
        latencyMs: 24,
        sharedDeps: ['INFRA-LOCAL-BATTERY-PACK-01', 'INFRA-P2P-RF-SPECTRUM'],
        jointSurvivalProbPct: 94.8
      },
      {
        routeId: 'ROUTE-LORA-EU868-DONGLE',
        bearer: 'LORA_ISM_EU868_SUB_GHZ',
        role: 'HARDWARE_BLOCKED',
        status: 'BLOCKED',
        packetLossPct: 0,
        latencyMs: 0,
        sharedDeps: ['INFRA-LOCAL-BATTERY-PACK-01'],
        jointSurvivalProbPct: 0
      }
    ],
    messages: [
      {
        messageId: 'msg-a12-evt-nl-a12-hm110-130',
        kind: 'OFFICIAL_ALERT',
        state: 'VERIFIED',
        wireSizeBytes: 642,
        custodyPath: ['DASHCAM-A12-REAL-TRACE-01', 'NODE-ANDROID-A12-CARRIER-01', 'GATEWAY-A12-VELPERBROEK-RELAY', 'RECIPIENT-ARNHEM-CONSOLE'],
        transitions: ['QUEUED', 'IN_CUSTODY', 'FORWARDED', 'RECEIVED', 'VERIFIED'],
        canonicalEvidenceHash: '71185f8a0f683d6cdfa05f1bce4b4021c754eb902dad125c4581261f4cddd7c6',
        receiptAckHash: 'ack-sha256-a12-velperbroek-verified',
        note: 'Entregado y verificado criptográficamente tras caída del enlace celular primario.'
      },
      {
        messageId: 'msg-a12-lora-hw-test',
        kind: 'SOS',
        state: 'BLOCKED',
        wireSizeBytes: 248,
        custodyPath: ['LORA-NODE-VELPERBROEK-868'],
        transitions: ['QUEUED', 'BLOCKED'],
        canonicalEvidenceHash: '9e40d658c13852a5e4ebe822edd45f25791800ecec2076e23547bdc6bfd6cea7',
        receiptAckHash: null,
        note: 'BLOCKED: Requiere dongle físico LoRa EU868 conectado por USB/BLE (no simulado como exitoso).'
      }
    ]
  },
  {
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    pilotCode: 'PILOT_B_BARRIO_LAB',
    title: {
      es: 'Piloto B · Barrio / Edificio Laboratorio Local',
      en: 'Pilot B · Neighborhood / Building Local Lab',
      nl: 'Pilot B · Wijk / Gebouw Lokaal Laboratorium'
    },
    subtitle: {
      es: 'Cámara IP propia RTSP/ONVIF + Puente Edge MQTT + 2 Nodos Móviles + Pasarela senda-relay con corte WAN y recibo PCI v0.2',
      en: 'Owned RTSP/ONVIF IP Camera + Edge MQTT Bridge + 2 Mobile Nodes + senda-relay Gateway with WAN cut & PCI v0.2 receipt',
      nl: 'Eigen RTSP/ONVIF IP-camera + Edge MQTT-bridge + 2 mobiele nodes + senda-relay gateway met WAN-uitval & PCI v0.2 ontvangstbewijs'
    },
    center: { lat: 40.4168, lon: -3.7038 },
    defaultRadiusM: 1200,
    polygonCoords: [
      { lat: 40.412, lon: -3.710 },
      { lat: 40.412, lon: -3.698 },
      { lat: 40.421, lon: -3.698 },
      { lat: 40.421, lon: -3.710 }
    ],
    fusedIncident: {
      eventId: 'evt-barrio-acceso-norte-01-lab',
      decision: 'CONFIRMED_MULTISENSOR_INCIDENT',
      posteriorConfidence: 0.912,
      uncertaintyInterval90: [0.827, 0.995],
      location: { lat: 40.4168, lon: -3.7038, uncertaintyRadiusM: 8 },
      corroboratingSources: ['CAM-LAB-BARRIO-RTSP-01', 'EDGE-MQTT-BARRIO-BROKER-01', 'NODE-ANDROID-BARRIO-PEER-01'],
      independentFamilies: ['FAMILY_BARRIO_LAB_EDGE', 'FAMILY_NODE-ANDROID-BARRIO-PEER-01'],
      merkleDigestSha256: 'aff7eb13790f01b695d78761ea7d61c211e93e2ab041f777baf31c0b4c6ac509',
      summary: {
        es: 'Ocupación vial anómala (9 vehículos, visibilidad Koschmieder 580 m) en cámara IP de laboratorio corroborada por alerta acústica/IMU en Nodo Móvil A vía MQTT Edge Bridge.',
        en: 'Anomalous lane occupancy (9 vehicles, Koschmieder visibility 580 m) on lab IP camera corroborated by acoustic/IMU alert on Mobile Node A via MQTT Edge Bridge.',
        nl: 'Afwijkende rijstrookbezetting (9 voertuigen, Koschmieder-zicht 580 m) op lab IP-camera bevestigd door akoestisch/IMU-alarm op Mobiele Node A via MQTT Edge Bridge.'
      }
    },
    dtnRoutes: [
      {
        routeId: 'BEARER-BARRIO-WAN-ISP',
        bearer: 'WAN_FIBER_ISP',
        role: 'PRIMARY',
        status: 'OUTAGE_SIMULATED',
        packetLossPct: 100,
        latencyMs: 9999,
        sharedDeps: ['INFRA-LAB-CELL-ISP-01'],
        jointSurvivalProbPct: 48.0
      },
      {
        routeId: 'BEARER-BARRIO-P2P-CUSTODY-LOOPBACK',
        bearer: 'WIFI_DIRECT_P2P_TO_LOCAL_GATEWAY',
        role: 'DIVERSE_BACKUP',
        status: 'ACTIVE_CUSTODY',
        packetLossPct: 1.2,
        latencyMs: 14,
        sharedDeps: ['INFRA-LAB-UPS-BATTERY-01'],
        jointSurvivalProbPct: 96.4
      }
    ],
    messages: [
      {
        messageId: 'msg-barrio-sos-custody-01',
        kind: 'SOS',
        state: 'VERIFIED',
        wireSizeBytes: 596,
        custodyPath: ['NODE-ANDROID-BARRIO-PEER-01', 'NODE-ANDROID-BARRIO-PEER-02', 'EDGE-MQTT-BARRIO-BROKER-01'],
        transitions: ['QUEUED', 'IN_CUSTODY', 'FORWARDED', 'RECEIVED', 'VERIFIED'],
        canonicalEvidenceHash: 'b322fa2dcada4b1a97e84e97fc098c8b7038ce4e2018e68c3bd76bd4e748c643',
        receiptAckHash: 'ack-sha256-barrio-lab-verified',
        note: 'Transferido por store-and-forward entre Peer 01 y Peer 02 hacia senda-relay local tras corte WAN.'
      }
    ]
  },
  {
    sectorId: 'ES-AV-N403-EL-TIEMBLO',
    roadSegmentId: 'ES-N403-PK80-95',
    pilotCode: 'CORRIDOR_ES_N403',
    title: {
      es: 'Corredor N-403 El Tiemblo (Ávila) · DGT NAP v3.6 vs DGT 3.0',
      en: 'N-403 Corridor El Tiemblo (Ávila) · DGT NAP v3.6 vs DGT 3.0',
      nl: 'N-403 Corridor El Tiemblo (Ávila) · DGT NAP v3.6 vs DGT 3.0'
    },
    subtitle: {
      es: 'Ingesta real DATEX II v3.6 desde nap.dgt.es diferenciada explícitamente de DGT 3.0 (PARTNER_ACCESS_REQUIRED)',
      en: 'Real DATEX II v3.6 ingestion from nap.dgt.es explicitly differentiated from DGT 3.0 (PARTNER_ACCESS_REQUIRED)',
      nl: 'Echte DATEX II v3.6-ingestie van nap.dgt.es expliciet onderscheiden van DGT 3.0 (PARTNER_ACCESS_REQUIRED)'
    },
    center: { lat: 40.412, lon: -4.501 },
    defaultRadiusM: 6000,
    polygonCoords: [
      { lat: 40.38, lon: -4.54 },
      { lat: 40.38, lon: -4.46 },
      { lat: 40.44, lon: -4.46 },
      { lat: 40.44, lon: -4.54 }
    ],
    fusedIncident: {
      eventId: 'evt-es-n403-dgt-nap-v36',
      decision: 'SINGLE_SOURCE_PROVISIONAL',
      posteriorConfidence: 0.742,
      uncertaintyInterval90: [0.622, 0.862],
      location: { lat: 40.412, lon: -4.501, uncertaintyRadiusM: 50 },
      corroboratingSources: ['DGT-ES-NAP-DATEX2-V36'],
      independentFamilies: ['FAMILY_DGT_NAP'],
      merkleDigestSha256: '542bcd0c93518b2b5a90572c1bd2269b5523886e4884427cae9170fb6a5a0829',
      summary: {
        es: 'Situación vial verificada en DGT NAP (DATEX II v3.6); la telemetría V-16 de DGT 3.0 permanece en PARTNER_ACCESS_REQUIRED hasta disponer de certificado mTLS de operador.',
        en: 'Road situation verified in DGT NAP (DATEX II v3.6); DGT 3.0 V-16 telemetry remains in PARTNER_ACCESS_REQUIRED until operator mTLS certificate is provisioned.',
        nl: 'Wegsituatie geverifieerd in DGT NAP (DATEX II v3.6); DGT 3.0 V-16-telemetrie blijft op PARTNER_ACCESS_REQUIRED totdat een operator mTLS-certificaat beschikbaar is.'
      }
    },
    dtnRoutes: [
      {
        routeId: 'ROUTE-N403-RELAY-CUSTODY',
        bearer: 'HTTP_CUSTODY_API',
        role: 'PRIMARY',
        status: 'ACTIVE_CUSTODY',
        packetLossPct: 2.1,
        latencyMs: 36,
        sharedDeps: ['INFRA-ES-DGT-CGT-MADRID'],
        jointSurvivalProbPct: 88.5
      }
    ],
    messages: [
      {
        messageId: 'msg-n403-dgt-nap-01',
        kind: 'OFFICIAL_ALERT',
        state: 'IN_CUSTODY',
        wireSizeBytes: 512,
        custodyPath: ['DGT-ES-NAP-DATEX2-V36', 'GW-01'],
        transitions: ['QUEUED', 'IN_CUSTODY'],
        canonicalEvidenceHash: '542bcd0c93518b2b5a90572c1bd2269b5523886e4884427cae9170fb6a5a0829',
        receiptAckHash: null,
        note: 'En custodia local a la espera de confirmación de segundo sensor independiente.'
      }
    ]
  }
] as const;

export const CORRIDOR_SOURCES_TABLE: readonly CorridorSourceNode[] = [
  {
    sourceId: 'NDW-NL-A12-SRTI-V3',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'ROAD DATA',
    assetType: 'ROAD_TRAFFIC_SENSOR',
    operator: 'Nationaal Dataportaal Wegverkeer (NDW)',
    lat: 51.9852,
    lon: 5.9675,
    accessRights: 'OPEN_DATA_CC0',
    auth: 'NONE_PUBLIC_HTTPS',
    health: 'LIVE_VERIFIED',
    lastObservedAt: '2026-11-08T14:48:00Z',
    observationCapabilities: ['STATIONARY_VEHICLE_OBSTRUCTION', 'SRTI_SAFETY_MESSAGE'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'sit:VehicleObstruction (stationary, evidence=80%) en A12 hm 126.4',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-KPN-FIBER-ARNHEM', 'INFRA-NL-ALLIANDER-GRID-GELDERLAND'],
    proofRef: 'ndw-a12-srti-v3.xml (sha256:9e40d658...)'
  },
  {
    sourceId: 'NDW-NL-A12-MONIBAS-0121',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'ROAD DATA',
    assetType: 'ROAD_TRAFFIC_SENSOR',
    operator: 'NDW / Rijkswaterstaat MONIBAS',
    lat: 52.0185,
    lon: 5.864,
    accessRights: 'OPEN_DATA_CC0',
    auth: 'NONE_PUBLIC_HTTPS',
    health: 'LIVE_VERIFIED',
    lastObservedAt: '2026-11-08T14:47:42Z',
    observationCapabilities: ['TRAFFIC_SPEED_KMH', 'TRAFFIC_FLOW_VEH_H'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'RWS01_MONIBAS_0121: 89 estaciones A12 (migración DATEX II v3 antes de 02/2027)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-RWS-VIC-OOST'],
    proofRef: 'ndw-a12-monibas-v2.xml (sha256:7d9b826d...)'
  },
  {
    sourceId: 'RWS-NL-A12-CCTV-VELPERBROEK',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'CAMERAS',
    assetType: 'ROAD_CAMERA',
    operator: 'Rijkswaterstaat Verkeerscentrum Oost-Nederland',
    lat: 51.9814,
    lon: 5.9632,
    accessRights: 'RESTRICTED_GDPR_PARTNER_ONLY',
    auth: 'PARTNER_VPN_MTLS_REQUIRED',
    health: 'PARTNER_ACCESS_REQUIRED',
    lastObservedAt: null,
    observationCapabilities: ['CCTV_TRAFFIC_STREAM_RESTRICTED'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'BLOQUEADO: RWS no publica cámaras viales en abierto por privacidad (RGPD/AVG).',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-RWS-VIC-OOST'],
    proofRef: 'Política RGPD/AVG RWS — Sin vídeo público en A12'
  },
  {
    sourceId: 'DASHCAM-A12-REAL-TRACE-01',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'DASHCAMS',
    assetType: 'DASHCAM',
    operator: 'SENDA Vision Probe (YOLOX-s ONNX + ByteTrack)',
    lat: 51.986,
    lon: 5.961,
    accessRights: 'MIT_RECORDED_REAL_SAMPLE',
    auth: 'DEVICE_ED25519_SESSION',
    health: 'RECORDED_REAL_SAMPLE',
    lastObservedAt: '2026-11-08T14:44:10Z',
    observationCapabilities: ['VEHICLE_DETECTION', 'MONOCULAR_TTC_UNCERTAIN', 'BRAKING_EVENT'],
    transportCapabilities: ['BLE_GATT_6LOWPAN', 'WIFI_AWARE_NAN'],
    canActAsRelay: true,
    latestObservationSummary: '451 frames reales, 12 vehículos, decel -4.4 m/s² (TTC monocular no calibrado ±30%)',
    videoPreviewUrl: '/media/vision/dashcam.mp4',
    sharedInfrastructureDeps: ['INFRA-VEHICLE-12V-BUS-01'],
    proofRef: 'investor-next/public/media/vision/dashcam.json'
  },
  {
    sourceId: 'OBD-A12-VEHICLE-01',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'CONNECTED DEVICES',
    assetType: 'VEHICLE_OBD',
    operator: 'SENDA Vehicle Link (OBD-II Consentido)',
    lat: 51.986,
    lon: 5.961,
    accessRights: 'USER_CONSENTED_TELEMETRY',
    auth: 'BLE_PIN_AND_CONSENT_TOKEN',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:44:12Z',
    observationCapabilities: ['WHEEL_SPEED_KMH', 'DECELERATION_MPS2', 'HAZARD_LIGHTS_STATE'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'Velocidad 32 km/h, frenada -4.4 m/s², warning luces de emergencia activas',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-VEHICLE-12V-BUS-01'],
    proofRef: 'packages/senda/src/vehicle-link.mjs'
  },
  {
    sourceId: 'KNMI-NL-DEELEN-06275',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'ENVIRONMENT',
    assetType: 'WEATHER_STATION',
    operator: 'KNMI Station 06275 Deelen',
    lat: 52.056,
    lon: 5.873,
    accessRights: 'OPEN_DATA_API_KEY_REQUIRED',
    auth: 'API_KEY_PENDING',
    health: 'CATALOG_ONLY',
    lastObservedAt: null,
    observationCapabilities: ['METEOROLOGY_VISIBILITY_M', 'PRECIPITATION_MM_H'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'CATALOG_ONLY: Estación catalogada; nunca se muestra como telemetría en vivo.',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-KPN-FIBER-ARNHEM'],
    proofRef: 'Catálogo KNMI 06275'
  },
  {
    sourceId: 'NODE-ANDROID-A12-CARRIER-01',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'CONNECTED DEVICES',
    assetType: 'ANDROID_PHONE',
    operator: 'SENDA Android Lab Instance #1',
    lat: 51.9858,
    lon: 5.9625,
    accessRights: 'OPERATOR_OWNED_LAB_DEVICE',
    auth: 'ECDSA_P256_AND_ED25519_PCI',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:45:00Z',
    observationCapabilities: ['GNSS_LOCATION', 'BAROMETER_HPA', 'ACCELEROMETER_IMU'],
    transportCapabilities: ['ANDROID_NEARBY_CONNECTIONS', 'WIFI_AWARE_NAN', 'BLE_GATT_6LOWPAN'],
    canActAsRelay: true,
    latestObservationSummary: 'Custodio DTN activo en laboratorio (radio física de campo marcada BLOCKED)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-KPN-CELL-TOWER-ARNHEM-04'],
    proofRef: 'apps/senda-android/ + envelope.mjs'
  },
  {
    sourceId: 'GATEWAY-A12-VELPERBROEK-RELAY',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'GATEWAYS',
    assetType: 'DTN_RELAY',
    operator: 'SENDA Relay Server (Custody Node)',
    lat: 51.9825,
    lon: 5.9702,
    accessRights: 'OPERATOR_OWNED_GATEWAY',
    auth: 'ENVELOPE_V2_SHAPE_AND_RATE_LIMIT',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:48:00Z',
    observationCapabilities: ['RELAY_QUEUE_TELEMETRY'],
    transportCapabilities: ['HTTP_CUSTODY_API', 'STORE_CARRY_FORWARD'],
    canActAsRelay: true,
    latestObservationSummary: 'Custodia verificada de sobres AEAD v2 y recibos criptográficos',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-KPN-FIBER-ARNHEM'],
    proofRef: 'packages/senda-relay/server.mjs'
  },
  {
    sourceId: 'NDW-NL-BRIDGES-V3',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'ROAD DATA',
    assetType: 'ROAD_TRAFFIC_SENSOR',
    operator: 'NDW Open Data (Planningsfeed Brugopeningen v3)',
    lat: 51.9735,
    lon: 5.9112,
    accessRights: 'OPEN_DATA_CC0',
    auth: 'NONE_PUBLIC_HTTPS',
    health: 'LIVE_VERIFIED',
    lastObservedAt: '2026-11-08T15:43:00Z',
    observationCapabilities: ['BRIDGE_OPENING_SCHEDULE', 'WATERWAY_CORRIDOR_RESTRICTION'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: '1.140 eventos reales de apertura de puentes en Países Bajos (8 en fixture verificada)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-NL-RWS-VIC-OOST'],
    proofRef: 'ndw-bridge-openings-v3.xml (sha256:7a9d56f2...)'
  },
  {
    sourceId: 'DRONE-A12-POD-COTS02',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'CONNECTED DEVICES',
    assetType: 'DRONE_AUTHORIZED',
    operator: 'SENDA Aerial Mule + Thermal Pod (KIT-COTS-02 · 82g · €44)',
    lat: 51.9855,
    lon: 5.9590,
    accessRights: 'EASA_USPACE_AND_EN4709_002_DIRECT_REMOTE_ID',
    auth: 'MAVLINK_V2_HMAC_SHA256_LINK_SIGNED',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T15:43:10Z',
    observationCapabilities: ['MLX90640_32X24_THERMAL_HOTSPOT', 'COLLINEARITY_GROUND_PROJECTION_NON_RTK'],
    transportCapabilities: ['MAVLINK_V2_DTN_TUNNEL', 'LORA_EU868_G1_G3', 'BLE_WIFI_NAN_MULE'],
    canActAsRelay: true,
    latestObservationSummary: 'MAVLink v2 firmado + MLX90640 (168.4 °C foco) + Mula DTN (reserva RTH ≥25%, sin RTK ±4.6 m)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-LOCAL-DRONE-LIPO-98WH'],
    proofRef: 'packages/senda/src/sovereign-mesh-kit.mjs'
  },
  {
    sourceId: 'SAT-NTN-IRIDIUM-GALILEO',
    sectorId: 'NL-A12-ARNHEM-EDE',
    roadSegmentId: 'NL-A12-HM110-130',
    layer: 'GATEWAYS',
    assetType: 'SATELLITE_TERMINAL_AUTHORIZED',
    operator: 'SENDA Satellite Store-and-Forward + Galileo OSNMA Verifier',
    lat: 51.9851,
    lon: 5.9110,
    accessRights: 'ITU_AND_GALILEO_OSNMA_PUBLIC',
    auth: 'GALILEO_TESLA_OSNMA_AND_AEAD_V2',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T15:43:27Z',
    observationCapabilities: ['GALILEO_OSNMA_ANTI_SPOOFING', 'CELESTRAK_SGP4_PASS_PREDICTION'],
    transportCapabilities: ['IRIDIUM_SBD_340B_RS_SHARDS', 'SKYLO_NTN_256B'],
    canActAsRelay: true,
    latestObservationSummary: 'TLE real CelesTrak Galileo/Iridium + Reed-Solomon RS(3,5) SBD (RF físico BLOCKED sin módem)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-SPACE-LEO-MEO-CONSTELLATION'],
    proofRef: 'celestrak-galileo-iridium.tle (sha256:9db8021a...)'
  },
  {
    sourceId: 'CAM-LAB-BARRIO-RTSP-01',
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    layer: 'CAMERAS',
    assetType: 'PRIVATE_CAMERA_AUTHORIZED',
    operator: 'Laboratorio SENDA (Cámara IP Propia Autorizada)',
    lat: 40.4168,
    lon: -3.7038,
    accessRights: 'OWNER_EXPLICIT_AUTHORIZATION_GDPR_MINIMIZED',
    auth: 'DIGEST_RTSP_ENV_SECRET',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:51:30Z',
    observationCapabilities: ['OCCUPANCY_RATIO', 'KOSCHMIEDER_VISIBILITY_M', 'STOPPED_VEHICLE_DETECTION'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: '377 frames CC BY 4.0 + inferencia Koschmieder (580 m) y ocupación (9 veh)',
    videoPreviewUrl: '/media/vision/fixed.mp4',
    sharedInfrastructureDeps: ['INFRA-LAB-POE-SWITCH-01'],
    proofRef: 'investor-next/public/media/vision/fixed.json'
  },
  {
    sourceId: 'EDGE-MQTT-BARRIO-BROKER-01',
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    layer: 'GATEWAYS',
    assetType: 'LOCAL_GATEWAY',
    operator: 'Laboratorio SENDA (Edge MQTT / ONVIF Profile M Bridge)',
    lat: 40.4169,
    lon: -3.7037,
    accessRights: 'OWNER_AUTHORIZED_EDGE_GATEWAY',
    auth: 'BEARER_HMAC_TOKEN_ACL',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:51:35Z',
    observationCapabilities: ['EDGE_DETECTION_EVENT', 'GATEWAY_HEALTH'],
    transportCapabilities: ['MQTT_LOCAL_BROKER', 'DTN_BUNDLE_FORWARDER'],
    canActAsRelay: true,
    latestObservationSummary: 'Esquema senda.edge-event/1.0 validado; vídeo bruto bloqueado hacia DTN',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-LAB-UPS-BATTERY-01'],
    proofRef: 'packages/senda/src/corridor-connectors.mjs#createMqttEdgeBridge'
  },
  {
    sourceId: 'NODE-ANDROID-BARRIO-PEER-01',
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    layer: 'CONNECTED DEVICES',
    assetType: 'ANDROID_PHONE',
    operator: 'Laboratorio SENDA (Nodo Móvil A)',
    lat: 40.4167,
    lon: -3.7039,
    accessRights: 'OPERATOR_OWNED_LAB_DEVICE',
    auth: 'ECDSA_P256_AND_ED25519_PCI',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:51:35Z',
    observationCapabilities: ['ACOUSTIC_HORN_DETECTOR', 'IMU_SHOCK_DETECTOR'],
    transportCapabilities: ['ANDROID_NEARBY_CONNECTIONS', 'WIFI_DIRECT_P2P'],
    canActAsRelay: true,
    latestObservationSummary: 'Origen de alerta acústica/IMU; retiene mensaje en custodia tras corte WAN',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-LAB-CELL-ISP-01'],
    proofRef: 'Piloto B Store-and-Forward Peer 01'
  },
  {
    sourceId: 'NODE-ANDROID-BARRIO-PEER-02',
    sectorId: 'LAB-BARRIO-EDIFICIO-01',
    roadSegmentId: 'BARRIO-ACCESO-NORTE-01',
    layer: 'CONNECTED DEVICES',
    assetType: 'ANDROID_PHONE',
    operator: 'Laboratorio SENDA (Nodo Móvil B · Mule DTN)',
    lat: 40.4172,
    lon: -3.7032,
    accessRights: 'OPERATOR_OWNED_LAB_DEVICE',
    auth: 'ECDSA_P256_AND_ED25519_PCI',
    health: 'LAB_VERIFIED',
    lastObservedAt: '2026-11-08T14:51:40Z',
    observationCapabilities: ['GNSS_LOCATION'],
    transportCapabilities: ['ANDROID_NEARBY_CONNECTIONS', 'HTTP_CUSTODY_API'],
    canActAsRelay: true,
    latestObservationSummary: 'Transporta sobre AEAD desde Peer 01 hasta pasarela local y retorna recibo',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-LAB-BACKUP-UPLINK-02'],
    proofRef: 'Piloto B Store-and-Forward Peer 02'
  },
  {
    sourceId: 'DGT-ES-NAP-DATEX2-V36',
    sectorId: 'ES-AV-N403-EL-TIEMBLO',
    roadSegmentId: 'ES-N403-PK80-95',
    layer: 'ROAD DATA',
    assetType: 'ROAD_TRAFFIC_SENSOR',
    operator: 'Dirección General de Tráfico (DGT NAP España)',
    lat: 40.412,
    lon: -4.501,
    accessRights: 'OPEN_DATA_LEY_37_2007',
    auth: 'NONE_PUBLIC_HTTPS',
    health: 'LIVE_VERIFIED',
    lastObservedAt: '2026-11-08T14:47:20Z',
    observationCapabilities: ['INCIDENT_STATUS', 'ROADWORKS_OR_RESTRICTION'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: '548 situaciones activas en España vía DATEX II v3.6 (nap.dgt.es)',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-ES-DGT-CGT-MADRID'],
    proofRef: 'dgt-nap-v36-slice.xml (sha256:542bcd0c...)'
  },
  {
    sourceId: 'DGT-ES-30-CONNECTED-VEHICLE-CLOUD',
    sectorId: 'ES-AV-N403-EL-TIEMBLO',
    roadSegmentId: 'ES-N403-PK80-95',
    layer: 'ROAD DATA',
    assetType: 'ROAD_TRAFFIC_SENSOR',
    operator: 'DGT 3.0 Plataforma Vehículo Conectado',
    lat: 40.412,
    lon: -4.501,
    accessRights: 'PARTNER_AGREEMENT_REQUIRED',
    auth: 'MTLS_PARTNER_CERTIFICATE',
    health: 'PARTNER_ACCESS_REQUIRED',
    lastObservedAt: null,
    observationCapabilities: ['V16_BEACON_TELEMETRY_RESTRICTED'],
    transportCapabilities: [],
    canActAsRelay: false,
    latestObservationSummary: 'PARTNER_ACCESS_REQUIRED: Diferenciado de DGT NAP abierto; sin convenio activo.',
    videoPreviewUrl: null,
    sharedInfrastructureDeps: ['INFRA-ES-DGT-CGT-MADRID'],
    proofRef: 'Guardia de honestidad DGT 3.0'
  }
] as const;

export const SOVEREIGN_COTS_KITS_SUMMARY = [
  {
    kitId: 'KIT-COTS-01',
    name: 'Pocket LoRa/BLE Civic Relay Node',
    costEur: 19.50,
    massG: 46,
    bom: 'ESP32-S3 + SX1262 EU868 + Antena 3dBi + LiPo 1100mAh',
    protocol: 'USB-C WebSerial KISS (CRC-16-CCITT) + ETSI EN 300 220 (1% g1 / 10% g3 SOS)'
  },
  {
    kitId: 'KIT-COTS-02',
    name: 'Aerial Drone Thermal + LoRa/RemoteID Pod',
    costEur: 44.00,
    massG: 82,
    bom: 'XIAO ESP32-S3 + SX1262 + Melexis MLX90640 (32×24 IR) + u-blox SAM-M10Q (Galileo OSNMA)',
    protocol: 'MAVLink v2 firmado (HMAC-SHA256) + Descriptor térmico <180B + EN 4709-002 Direct Remote ID'
  },
  {
    kitId: 'KIT-COTS-03',
    name: 'Autonomous Solar Corridor & Bridge Gateway',
    costEur: 68.50,
    massG: 640,
    bom: 'Orange Pi Zero 3 / RPi Zero 2W + SX1262 LNA + RTL-SDR TCXO + Solar 10W LiFePO4 32700',
    protocol: 'Custodia DTN Store-and-Forward + Escucha pasiva SDR + Puente MQTT/ONVIF local'
  }
] as const;

export const SOVEREIGN_MESH_INTEROP_FORMATS = [
  { formatId: 'OASIS_CAP_1_2', standard: 'OASIS CAP v1.2 XML (112 / EU-Alert / NL-Alert)', status: 'VERIFIED_LOSSLESS' },
  { formatId: 'ETSI_C_ITS_DENM', standard: 'ETSI EN 302 637-3 C-ITS DENM (CauseCode 94/18)', status: 'VERIFIED_LOSSLESS' },
  { formatId: 'ATAK_COT_XML', standard: 'Cursor on Target (CoT 2.0 XML — ATAK / CivTAK)', status: 'VERIFIED_LOSSLESS' },
  { formatId: 'MESHTASTIC_RETICULUM', standard: 'Compact LoRa Mesh Frame (<180B JSON/CBOR)', status: 'VERIFIED_LOSSLESS' }
] as const;

export const SOVEREIGN_BYZANTINE_QUORUM_SUMMARY = {
  ringId: 'RING-NL-A12-SOVEREIGN',
  scheme: 'M-of-N Threshold Cosigning (3-de-4) + Forward-Secure SHA-256 Ratchet Chain',
  distinctOperatorsVerified: 3,
  operators: ['RIJKSWATERSTAAT_NDW', 'VEILIGHEIDSREGIO_GELDERLAND', 'FLEET_PARTNER_X'],
  sybilSubnetDiscountActive: true,
  galileoOsnmaState: 'GALILEO_OSNMA_AUTHENTICATED',
  satelliteErasureScheme: 'RS-Cauchy-GF256(k=3, n=5) sobre Iridium SBD (340B) / Skylo NTN (256B)'
} as const;

export function getCorridorIntelligenceSnapshot(
  sectorId = 'NL-A12-ARNHEM-EDE',
  selectionMode: CorridorSelectionMode = 'SEGMENT',
  activeLayers: readonly CorridorLayerId[] = CORRIDOR_INTELLIGENCE_LAYERS
) {
  const sector = CORRIDOR_SECTORS.find(s => s.sectorId === sectorId) ?? CORRIDOR_SECTORS[0];
  const sources = CORRIDOR_SOURCES_TABLE.filter(
    src => src.sectorId === sector.sectorId && activeLayers.includes(src.layer)
  );
  return {
    sector,
    selectionMode,
    activeLayers,
    sources,
    authorizedLiveOrLabCount: sources.filter(s => ['LIVE_VERIFIED', 'RECORDED_REAL_SAMPLE', 'LAB_VERIFIED'].includes(s.health)).length,
    catalogOrRestrictedCount: sources.filter(s => ['CATALOG_ONLY', 'PARTNER_ACCESS_REQUIRED', 'PERMISSION_PENDING'].includes(s.health)).length,
    relayCapableCount: sources.filter(s => s.canActAsRelay).length,
    cotsHardwareKits: SOVEREIGN_COTS_KITS_SUMMARY,
    meshInteropFormats: SOVEREIGN_MESH_INTEROP_FORMATS,
    byzantineQuorum: SOVEREIGN_BYZANTINE_QUORUM_SUMMARY
  };
}

