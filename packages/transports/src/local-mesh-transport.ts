import type { TransportCapability } from '@civic-relay/schemas';
import { SimulatedTransport } from './base.js';

/** Simulated mesh path. Peer count is a routing input, not discovered devices. */
export class LocalMeshTransport extends SimulatedTransport {
  readonly id = 'local-mesh-sim-001';
  readonly type = 'LOCAL_MESH' as const;
  private simulatedPeerCount = 1;

  setSimulatedState(available: boolean, peerCount: number = 1): void {
    this.simulatedPeerCount = Math.max(0, Math.floor(peerCount));
    this.setAvailable(available && this.simulatedPeerCount > 0);
  }

  async getCapabilities(): Promise<TransportCapability> {
    return {
      transportId: this.id,
      transportType: this.type,
      available: this.available,
      estimatedReliability: this.available ? 0.7 : 0,
      latency: 500,
      energyCost: 'MEDIUM',
      monetaryCost: 'FREE',
      bandwidth: this.available ? this.simulatedPeerCount * 50_000 : 0,
      lastSeen: new Date().toISOString(),
    };
  }
}
