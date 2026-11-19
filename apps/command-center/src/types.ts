export type TabId =
  | 'overview'
  | 'sources'
  | 'cameras'
  | 'twin'
  | 'rf'
  | 'meteorology'
  | 'access'
  | 'secure'
  | 'simulation'
  | 'evidence';

export type DatasetFilter = 'all' | 'tfl' | 'caltrans';

export interface CameraMetric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  uncertainty: string | null;
  provenance: string;
}

export interface CameraRecord {
  id: string;
  dataset: 'tfl' | 'caltrans';
  provider: string;
  operator: string;
  name: string;
  zone?: string | null;
  route?: string | null;
  heading?: string | null;
  lat: number | null;
  lon: number | null;
  observedAtUTC: string | null;
  timezoneNote: string;
  provenance: string;
  evidenceBasis: string;
  status: 'IN_SERVICE' | 'OUT_OF_SERVICE';
  statusNote?: string | null;
  license: string;
  liveImageUrl: string | null;
  calibration: {
    pose: string;
    homography: string;
    note: string;
  };
  videoPermission: string;
  metrics: CameraMetric[];
  counts: {
    crosses?: unknown;
    meanInFrame: number | null;
    maxInFrame: number | null;
    durationS: number | null;
    perDirection?: unknown;
  };
  series: Array<number | null> | null;
  fireHistory: Array<{
    id: string;
    radiusKm: number;
    eventAtUTC: string;
    provenance: string;
    note: string;
    cameraObservedAtUTC: string | null;
    timeSeparation: string;
  }>;
}

export interface SourceRecord {
  id: string;
  region: string;
  owner: string;
  kind: string;
  modality: string;
  homepage: string;
  rights: string;
  access: string;
  auth: string;
  status: string;
  productionVideoPermission: boolean | null;
  spatialAccuracy: string;
  timing: string;
  use: string;
  gap: string;
  availability: string;
  documented: boolean;
  isMeasurement: boolean;
  videoPermission: boolean | null;
}

export interface TimelineEvent {
  id: string;
  kind: 'observation' | 'history';
  atUTC: string | null;
  title: string;
  detail: string | null;
  provenance: string;
  count?: number;
}
