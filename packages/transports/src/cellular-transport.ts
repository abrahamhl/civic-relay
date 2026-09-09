import type { TransportCapability } from '@civic-relay/schemas';
import { SimulatedTransport } from './base.js';

/** Simulated cellular path. No modem, SMS, or carrier integration. */
export class CellularTransport extends SimulatedTransport {
  readonly id = 'cellular-sim-001';
  readonly type = 'CELLULAR' as const;
  private simulatedSignalStrength = 4;

  setSimulatedState(available: boolean, signalStrength: number = 4): void {
    this.simulatedSignalStrength = Math.max(0, Math.min(5, signalStrength));
    this.setAvailable(available && this.simulatedSignalStrength > 0);
  }

  async getCapabilities(): Promise<TransportCapability> {
    return {
      transportId: this.id,
      transportType: this.type,
      available: this.available,
      estimatedReliability: this.available ? this.simulatedSignalStrength / 5 : 0,
      latency: 200,
      energyCost: 'HIGH',
      monetaryCost: 'LOW',
      bandwidth: this.available ? this.simulatedSignalStrength * 100_000 : 0,
      lastSeen: new Date().toISOString(),
    };
  }
}
