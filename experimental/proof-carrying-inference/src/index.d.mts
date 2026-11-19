export type ProvenanceClass = "EXERCISE" | "SIMULATED" | "FIELD" | "VALIDATED" | "DERIVED";

export type DisplayRule =
  | `fixed:${number}`
  | `significant:${number}`
  | "upper-bound"
  | "exact-integer";

export interface PciDisplay {
  text: string;
  rule: DisplayRule;
  scale?: number;
  suffix?: string;
  bound?: number;
}

export interface PciModel {
  id: string;
  version: string;
  reference?: string;
}

export interface PciMethod {
  name: string;
  exact: boolean;
  tolerances?: Record<string, unknown>;
  seed?: string | number;
}

export interface PciResult {
  value: number;
  unit?: string;
  display: PciDisplay;
}

export interface PciProvenance {
  class: ProvenanceClass;
  note?: string;
  source?: string;
  sourceDigest?: string;
  parents?: string[];
}

export interface PciReproduce {
  command: string;
  entry?: string;
  artifactDigest?: string;
}

export interface PciIntegrity {
  algorithm: "SHA-256";
  canonical: "senda-pci-canonical/1";
  payloadDigest: string;
  inputsDigest: string;
  resultDigest: string;
}

export interface PciSignature {
  alg: "ECDSA-P256-SHA256";
  keyId: string;
  value: string;
}

export interface PciClaim {
  pci: "senda-pci/0.1";
  claimId: string;
  model: PciModel;
  inputs: Record<string, unknown>;
  method: PciMethod;
  result: PciResult;
  provenance: PciProvenance;
  limitations: string[];
  reproduce: PciReproduce;
  integrity?: PciIntegrity;
  signature?: PciSignature;
}

export interface PciIssue {
  code: string;
  path: string;
  message: string;
}

export interface PciVerification {
  ok: boolean;
  level: 0 | 1 | 2 | 3 | 4;
  errors: PciIssue[];
  warnings: PciIssue[];
  signature: "absent" | "unverified" | "valid" | "invalid" | "not-checked";
  digests: Partial<Record<"payloadDigest" | "inputsDigest" | "resultDigest", string>>;
}

export interface PciKeyPair {
  privateKeyJwk: Record<string, unknown>;
  publicKeyJwk: Record<string, unknown>;
}

export const PCI_VERSION: "senda-pci/0.1";
export const PCI_CANONICAL: "senda-pci-canonical/1";
export const PCI_ALGORITHM: "SHA-256";
export const PROVENANCE_CLASSES: readonly ProvenanceClass[];

export class PCIError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export function canonicalize(value: unknown): string;
export function sha256Hex(value: string | Uint8Array): Promise<string>;
export function validateClaimShape(claim: unknown): PciIssue[];
export function checkDisplay(result: PciResult): PciIssue[];
export function checkProvenance(claim: PciClaim): PciIssue[];
export function sealClaim(claim: PciClaim): Promise<PciClaim>;
export function createClaim(spec: Omit<PciClaim, "pci" | "integrity" | "signature">): Promise<PciClaim>;
export function verifyClaim(
  claim: unknown,
  options?: { publicKeyJwk?: Record<string, unknown> }
): Promise<PciVerification>;
export function generateKeyPair(): Promise<PciKeyPair>;
export function signClaim(
  claim: PciClaim,
  privateKeyJwk: Record<string, unknown>,
  options?: { keyId?: string }
): Promise<PciClaim>;
export function verifyClaimSignature(
  claim: PciClaim,
  publicKeyJwk: Record<string, unknown>
): Promise<boolean>;
export function claimSetDigest(claims: PciClaim[]): Promise<string>;
