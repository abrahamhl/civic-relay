import type { MessageEnvelope, TransportCapability } from '@civic-relay/schemas';
import type { ITransport } from './base';

/**
 * CellularTransport - SIMULATED transport
 * V0.1 does NOT implement real cellular modem integration
 * This is a deterministic simulator for demo purposes
 */
export class CellularTransport implements ITransport {
  readonly id = 'cellular-sim-001';
  readonly type = 'CELLULAR' as const;

  private simulatedAvailable: boolean = false;
  private simulatedSignalStrength: number = 0; // 0-5

  /**
   * Control simulation state (for demo scenario)
   */
  setSimulatedState(available: boolean, signalStrength: number = 0): void {
    this.simulatedAvailable = available;
    this.simulatedSignalStrength = Math.max(0, Math.min(5, signalStrength));
    console.log(`[CellularTransport] Simulation state: available=${available}, signal=${signalStrength}/5`);
  }

  async getCapabilities(): Promise<TransportCapability> {
    const reliability = this.simulatedSignalStrength / 5;

    return {
      transportId: this.id,
      transportType: 'CELLULAR',
      available: this.simulatedAvailable,
      estimatedReliability: reliability,
      latency: this.simulatedAvailable ? 200 : 999999,
      energyCost: 'HIGH',
      monetaryCost: 'LOW',
      bandwidth: this.simulatedSignalStrength * 100_000, // 100 KB/s per signal bar
      lastSeen: new Date().toISOString(),
    };
  }

  async send(message: MessageEnvelope): Promise<boolean> {
    if (!this.simulatedAvailable) {
      return false;
    }

    // SIMULATED: Log instead of real transmission
    console.log(`[CellularTransport] SIMULATED cellular send (signal ${this.simulatedSignalStrength}/5):`, message.id);
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return this.simulatedAvailable;
  }
}
