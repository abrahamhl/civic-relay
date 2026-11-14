export declare const PRECISION_PROVENANCE: 'NUMERIC_MODEL_EXERCISE_ONLY';
export declare const PRIORS_SCHEMA: 'senda-inference-priors/1';
export declare const LEDGER_VERSION: 1;

export declare function logGamma(z: number): number;
export declare function logBeta(a: number, b: number): number;
export declare function regularizedIncompleteBeta(x: number, a: number, b: number): number;
export declare function betaPdf(x: number, a: number, b: number): number;
export declare function betaQuantile(p: number, a: number, b: number): number;

export interface BetaPosterior {
  alpha: number;
  beta: number;
  mean: number;
  variance: number;
  ci95: [number, number];
  median: number;
  predictive: number;
  observations: number;
  provenance: string;
}
export declare function betaBinomialUpdate(
  prior: { alpha: number; beta: number },
  successes: number,
  failures: number,
): BetaPosterior;

export declare function binomialPmf(k: number, n: number, p: number): number;
export declare function binomialCcdf(k: number, n: number, p: number): number;
export declare function poissonBinomialCcdf(probabilities: number[], k: number): number;

export interface ErasureResult {
  probability: number;
  overhead: number;
  redundancy: number;
  shardsNeeded: number;
  shardsSent: number;
  expectedReceived: number;
  provenance: string;
}
export declare function erasureDelivery(input: {
  k: number;
  n: number;
  perShard: number | number[];
}): ErasureResult;

export interface DtnResult {
  probability: number;
  expectedDelayHours: number;
  p50: number;
  p90: number;
  p99: number;
  copyCost: number;
  ratePerHour: number;
  provenance: string;
}
export declare function dtnDelivery(input: {
  contactRatePerHour: number;
  copies: number;
  horizonHours: number;
}): DtnResult;

export interface RangingResult {
  distanceM: number;
  sigmaM: number;
  relativeSigma: number;
  varianceM2: number;
  pathLossDb: number;
  provenance: string;
}
export declare function rssiRanging(input: {
  txPowerDbm: number;
  rssiDbm: number;
  pathLossExponent: number;
  sigmaDb: number;
  referenceDistanceM?: number;
  referenceLossDb?: number;
}): RangingResult;

export interface SeirPoint {
  day: number;
  susceptible: number;
  exposed: number;
  infectious: number;
  recovered: number;
  cumulative: number;
}
export interface SeirResult {
  series: SeirPoint[];
  r0: number;
  peakInfectious: number;
  peakDay: number;
  attackRate: number;
  steps: number;
  maxConservationError: number;
  tolerances: { rtol: number; atol: number };
  provenance: string;
}
export declare function seirRK45(input: {
  population: number;
  contactsPerDay: number;
  beta: number;
  latencyDays: number;
  infectiousDays: number;
  days: number;
  initialExposed?: number;
  initialInfectious?: number;
  rtol?: number;
  atol?: number;
  dtMax?: number;
}): SeirResult;

export interface Observation {
  bearer: string;
  successes: number;
  failures: number;
  at: string;
}
export interface Ledger {
  version: 1;
  observations: Observation[];
}
export interface LedgerTally {
  successes: number;
  failures: number;
  observations: number;
}
export declare function emptyLedger(): Ledger;
export declare function recordObservation(
  ledger: Ledger,
  observation: { bearer: string; successes: number; failures: number; at?: string },
): Ledger;
export declare function tallyLedger(ledger: Ledger): Record<string, LedgerTally>;
export interface BearerPosterior {
  id: string;
  label: string;
  prior: { alpha: number; beta: number };
  successes: number;
  failures: number;
  observations: number;
  posterior: BetaPosterior;
}
export declare function summarizePosteriors(
  priors: { bearers: Record<string, { label: string; successAlpha: number; successBeta: number }> },
  ledger: Ledger,
): BearerPosterior[];
export declare function recommendBearer(
  posteriors: Array<{ id: string; posterior: { alpha: number; beta: number } }>,
  rng?: () => number,
): { id: string; sample: number } | null;
export declare function exportLedger(ledger: Ledger): string;

export declare function canonicalize(value: unknown): string;
export declare function priorsPayload(priors: Record<string, unknown>): Record<string, unknown>;
export declare function canonicalPriors(priors: Record<string, unknown>): string;
export declare function verifyPriorsIntegrity(
  priors: Record<string, unknown>,
): Promise<{ ok: boolean; expected: string | null; actual: string }>;
