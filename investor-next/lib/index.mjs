/**
 * Unified OEP Protocol Core SDK entrypoint (zero external dependencies).
 * Exports the deterministic 20-100 node scenario topology engine,
 * the bounded store-and-forward queue & receipt verification engine,
 * the consent, capability, energy & CAP 1.2 trust-boundary policies,
 * the satellite NTN link-budget, polygonal zone telemetry & through-wall Wi-Fi CSI / RF radar engines,
 * and the real WebCrypto ECDSA P-256 packet signer/verifier + live Keplerian orbital ephemeris engine.
 */
export { runScenario } from './emergency-routing.mjs';
export { createStoreForwardEngine, createInMemoryAdapter } from './store-forward.mjs';
export {
  CAPABILITY_STATES,
  SAFETY_RESPONSES,
  capabilityState,
  recordSafetyResponse,
  revokeSafetyRecord,
  expireSafetyRecord,
  energyPolicy,
  acceptAuthorizedCapAlert
} from './emergency-policy.mjs';
export {
  WALL_MATERIALS,
  SATELLITE_PROFILES,
  crc16Ccitt,
  encodeCompactSatelliteBurst,
  computeSatelliteLinkBudget,
  computeZoneTelemetryGrid,
  runThroughWallRfRadar
} from './telecom-suite.mjs';
export {
  REAL_ORBITAL_SHELLS,
  generateRealEcdsaKeyPair,
  signAndPackRealOepPacket,
  verifyRealOepPacket,
  computeLiveOrbitalEphemeris
} from './live-protocol-node.mjs';
