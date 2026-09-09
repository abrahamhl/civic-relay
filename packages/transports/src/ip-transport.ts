import type { TransportCapability } from '@civic-relay/schemas';
import { SimulatedTransport } from './base.js';

/** Simulated IP path to one same-page receiver. Does not perform HTTP. */
export class IPTransport extends SimulatedTransport {
  readonly id = 'ip-transport-001';
  readonly type = 'IP' as const;

  setSimulatedState(available: boolean): void {
    this.setAvailable(available);
  }

  async getCapabilities(): Promise<TransportCapability> {
    return {
      transportId: this.id,
      transportType: this.type,
      available: this.available,
      estimatedReliability: this.available ? 0.95 : 0,
      latency: 100,
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: this.available ? 1_000_000 : 0,
      lastSeen: new Date().toISOString(),
    };
  }
}
