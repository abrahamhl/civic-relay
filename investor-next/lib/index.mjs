/**
 * Unified OEP Protocol Core SDK entrypoint (zero external dependencies).
 * Exports the deterministic 20-100 node scenario topology engine,
 * the bounded store-and-forward queue & receipt verification engine,
 * and the consent, capability, energy & CAP 1.2 trust-boundary policies.
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
