export declare const LAB_PROVENANCE: 'MODEL_DERIVED_EXERCISE_ONLY';

export declare function mulberry32(seed: number): () => number;

export interface AlertPropagationParams {
  population: number;
  contacts: number;
  beta: number;
  gamma: number;
  steps: number;
  seed?: number;
  initial?: number;
}
export interface AlertSeriesPoint {
  step: number;
  susceptible: number;
  informed: number;
  recovered: number;
  cumulativeInformed: number;
}
export interface AlertPropagationResult {
  r0: number;
  peakInformed: number;
  finalCumulative: number;
  attackRate: number;
  series: AlertSeriesPoint[];
  provenance: string;
  assumptions: string[];
}
export declare function alertPropagation(params: AlertPropagationParams): AlertPropagationResult;

export interface RouteCost {
  energy: number;
  latencyMs: number;
  secure?: boolean;
}
export interface GraphNode {
  edges: Record<string, RouteCost>;
}
export interface RouteGraph {
  open: boolean;
  nodes: Record<string, GraphNode>;
}
export interface ParetoRoute {
  path: string[];
  energy: number;
  latencyMs: number;
}
export declare function paretoRoutes(graph: RouteGraph, start: string, goal: string): ParetoRoute[];
export declare function makeDemoGraph(): RouteGraph;

export declare function deliveryProbabilityClosedForm(p: { perAttempt: number; attempts: number }): number;
export interface DeliveryMonteCarloResult {
  probability: number;
  closedForm: number;
  stdErr: number;
  ci95: [number, number];
  meanAttempts: number;
  expectedAttemptsClosedForm: number;
  provenance: string;
}
export declare function deliveryMonteCarlo(p: {
  perAttempt: number;
  attempts: number;
  trials?: number;
  seed?: number;
}): DeliveryMonteCarloResult;

export interface CoverageResult {
  coveredFraction: number;
  perSensorFraction: number;
  blindFraction: number;
  searchSpaceReductionBits: number;
  provenance: string;
  assumptions: string[];
}
export declare function coverageEntropy(p: {
  sensorCount: number;
  halfAngleDeg: number;
  rangeKm: number;
  fieldRadiusKm: number;
}): CoverageResult;

export interface EnergyBudgetResult {
  dutyCycle: number;
  avgPowerW: number;
  runtimeHours: number;
  messages: number;
  targetMet: boolean;
  marginHours: number;
  provenance: string;
  assumptions: string[];
}
export declare function energyBudget(p: {
  batteryWh: number;
  txSeconds: number;
  txPowerW: number;
  sleepPowerW: number;
  intervalS: number;
  targetHours: number;
}): EnergyBudgetResult;

export interface KalmanPoint {
  z: number;
  estimate: number;
  velocity: number;
  gain: number;
  variance: number;
}
export interface KalmanResult {
  trace: KalmanPoint[];
  finalEstimate: number;
  finalVelocity: number;
  provenance: string;
}
export declare function kalmanFilter1D(p: {
  points: number[];
  q: number;
  r: number;
  start?: number;
  startVelocity?: number;
}): KalmanResult;

export interface ScorecardRow {
  id: string;
  label: string;
  model: string;
  status: 'MODELO' | 'REAL_EN_NAVEGADOR' | 'NO_IMPLEMENTADO';
  tested: boolean;
}
export declare function functionScorecard(): ScorecardRow[];
