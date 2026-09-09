import type { MessageEnvelope, TransportCapability } from '@civic-relay/schemas';
import type { ITransport } from './base';

/**
 * LocalMeshTransport - SIMULATED transport
 * V0.1 does NOT implement real Bluetooth mesh
 * This is a deterministic simulator for demo purposes
 *
 * NEVER claim this performs real mesh transmission
 */
export class LocalMeshTransport implements ITransport {
  readonly id = 'local-mesh-sim-001';
  readonly type = 'LOCAL_MESH' as const;

  private simulatedAvailable: boolean = false;
  private simulatedPeerCount: number = 0;

  /**
   * Control simulation state (for demo scenario)
   */
  setSimulatedState(available: boolean, peerCount: number = 0): void {
    this.simulatedAvailable = available;
    this.simulatedPeerCount = peerCount;
    console.log(`[LocalMeshTransport] Simulation state: available=${available}, peers=${peerCount}`);
  }

  async getCapabilities(): Promise<TransportCapability> {
    return {
      transportId: this.id,
      transportType: 'LOCAL_MESH',
      available: this.simulatedAvailable,
      estimatedReliability: this.simulatedPeerCount > 0 ? 0.7 : 0.0,
      latency: this.simulatedAvailable ? 500 : 999999,
      energyCost: 'MEDIUM',
      monetaryCost: 'FREE',
      bandwidth: this.simulatedPeerCount * 50_000, // 50 KB/s per peer
      lastSeen: new Date().toISOString(),
    };
  }

  async send(message: MessageEnvelope): Promise<boolean> {
    if (!this.simulatedAvailable) {
      return false;
    }

    // SIMULATED: Log instead of real transmission
    console.log(`[LocalMeshTransport] SIMULATED mesh forward (${this.simulatedPeerCount} peers):`, message.id);
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return this.simulatedAvailable;
  }
}
