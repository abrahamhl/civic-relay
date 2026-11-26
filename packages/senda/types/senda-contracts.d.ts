/**
 * SENDA · F3 Declaraciones de contratos públicos de `@senda/core`.
 * Cubre las entidades epistémicas (basis, fuente obligatoria, marcas ISO-8601 con TZ explícita),
 * las puertas N0–N5 (canPublicWarn nunca automático) y las interfaces de los módulos de cálculo.
 */

export type EpistemicBasis =
  | 'MEASURED'
  | 'OFFICIAL'
  | 'ESTIMATED'
  | 'MODEL'
  | 'SCENARIO'
  | 'CITIZEN'
  | 'SIMULATION'
  | 'PUBLISHED_SOURCES_COMPILED';

/** Marca temporal ISO-8601 con zona horaria explícita obligatoria (`Z` o `±HH:MM`). */
export type IsoTimestampWithTz = `${string}T${string}${'Z' | `+${string}` | `-${string}`}`;

export interface ProvenanceSource {
  name?: string;
  cita?: string;
  url?: string;
  license?: string;
}

export interface ContractValidationResult {
  ok: boolean;
  schema: string;
  errors: Array<{ path: string; message: string }>;
}

export interface CitizenReportEnvelopeContract {
  schema: string;
  basis: 'CITIZEN';
  operationalStatus: 'ACTUAL' | 'EXERCISE' | 'SIMULATION';
  reportId: string;
  canPublicWarn: false;
  contentSha256: string;
  signature: {
    alg: 'Ed25519';
    publicKeyB64u: string;
    pseudonymId: string;
    sigB64u: string;
  };
  payload: {
    schema: string;
    basis: 'CITIZEN';
    operationalStatus: 'ACTUAL' | 'EXERCISE' | 'SIMULATION';
    kind: string;
    capturedAtIso: IsoTimestampWithTz;
    capturedAtMs: number;
    channelOrigin: string;
    location: { lat: number; lon: number; accuracyM: number };
    consent: { accepted: true; consentVersion: string; acceptedAtIso: IsoTimestampWithTz };
  };
}

declare global {
  interface Navigator {
    readonly gpu?: {
      requestAdapter(): Promise<any>;
    };
  }
}
