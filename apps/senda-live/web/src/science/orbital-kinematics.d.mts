export interface SatelliteTleRecord {
  name: string;
  sensorPayload: string;
  norad: number;
  line1: string;
  line2: string;
  colorHex: string;
  /** 'ILLUSTRATIVE' = no son efemérides reales (ver ILLUSTRATIVE_TLES). */
  basis: 'ILLUSTRATIVE';
}

export interface ParsedTle {
  name: string;
  norad: number;
  epoch: number;
  inc: number;
  raan: number;
  ecc: number;
  argp: number;
  M: number;
  nRevDay: number;
}

export interface ObserverLocation {
  lat: number;
  lon: number;
  altKm?: number;
}

export interface LookAnglesResult {
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
  altitudeKm: number;
  orbitalSpeedKmS: number;
  rangeRateKmS: number;
  computeDopplerShiftHz: (carrierHz: number) => number;
  ecef: { x: number; y: number; z: number };
  disclaimer: string;
}

/** Suma de control TLE estándar (columnas 1–68, '-' = 1, módulo 10 = columna 69). */
export declare function TLE_CHECKSUM_VALID(line: string): boolean;

/** TLE ILUSTRATIVOS, NO auténticos (7/8 sumas de control inválidas; auditoría 20-11-2026). */
export declare const ILLUSTRATIVE_TLES: Readonly<Record<string, SatelliteTleRecord>>;

export declare function parseTle(name: string, line1: string, line2: string): ParsedTle;

export declare function propagateKeplerJ2(el: ParsedTle, timeMs: number): {
  x: number;
  y: number;
  z: number;
  altitudeKm: number;
  orbitalSpeedKmS: number;
};

export declare function gmst(timeMs: number): number;

export declare function lookAngles(
  el: ParsedTle,
  observer: ObserverLocation,
  timeMs: number,
  propagator?: typeof propagateKeplerJ2
): LookAnglesResult;
