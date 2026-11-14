export interface RealEcdsaKeyBundle {
  keyPair: CryptoKeyPair;
  publicKeySpkiHex: string;
  fingerprint: string;
  algorithm: 'ECDSA-P256-SHA256';
  generatedInMs: number;
}

export interface SignedOepRealPacket {
  protocol: 'OEP_REAL_EXECUTION_V1';
  messageId: string;
  status: string;
  zoneId: string;
  sectorIndex: number;
  batteryPct: number;
  timestampMs: number;
  binaryFrameHex: string;
  crc16Hex: string;
  byteLength: number;
  canonicalString: string;
  signatureHex: string;
  publicKeySpkiHex: string;
  signerFingerprint: string;
  signTimeMs: number;
}

export interface VerifiedOepPacketResult {
  valid: boolean;
  crc16Verified?: boolean;
  ecdsaVerified?: boolean;
  reason: string;
  verifyTimeMs: number;
}

export interface LiveOrbitalPass {
  id: string;
  name: string;
  altitudeKm: number;
  freqMhz: number;
  subLatDeg: number;
  subLonDeg: number;
  elevationDeg: number;
  azimuthDeg: number;
  slantRangeKm: number;
  dopplerShiftHz: number;
  fsplDb: number;
  utcIso: string;
}

export declare const REAL_ORBITAL_SHELLS: ReadonlyArray<{
  id: string;
  name: string;
  altitudeKm: number;
  inclinationDeg: number;
  periodSec: number;
  freqMhz: number;
  raanOffsetDeg: number;
}>;

export declare function generateRealEcdsaKeyPair(): Promise<RealEcdsaKeyBundle>;
export declare function signAndPackRealOepPacket(params: {
  privateKey: CryptoKey;
  publicKeySpkiHex: string;
  fingerprint: string;
  messageId?: string;
  status?: string;
  zoneId?: string;
  sectorIndex?: number;
  safeCount?: number;
  sosCount?: number;
  unknownCount?: number;
  batteryPct?: number;
  timestampMs?: number;
}): Promise<SignedOepRealPacket>;
export declare function verifyRealOepPacket(packet: SignedOepRealPacket): Promise<VerifiedOepPacketResult>;
export declare function computeLiveOrbitalEphemeris(
  utcTimestampMs?: number,
  observerLatDeg?: number,
  observerLonDeg?: number
): LiveOrbitalPass[];
