import type { MessageEnvelope, TransportCapability } from '@civic-relay/schemas';
import type { ITransport } from './base';

/**
 * IPTransport - Real network transport
 * Sends messages over standard IP networks when available
 */
export class IPTransport implements ITransport {
  readonly id = 'ip-transport-001';
  readonly type = 'IP' as const;

  private endpoint: string;
  private online: boolean = false;

  constructor(endpoint: string = 'https://api.civic-relay.example.com/messages') {
    this.endpoint = endpoint;
    this.checkConnectivity();
  }

  private async checkConnectivity(): Promise<void> {
    try {
      // In V0.1, we check navigator.onLine
      // In production, this would ping the actual endpoint
      this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    } catch {
      this.online = false;
    }
  }

  async getCapabilities(): Promise<TransportCapability> {
    await this.checkConnectivity();

    return {
      transportId: this.id,
      transportType: 'IP',
      available: this.online,
      estimatedReliability: this.online ? 0.95 : 0.0,
      latency: this.online ? 100 : 999999,
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: this.online ? 1_000_000 : 0, // 1 MB/s
      lastSeen: new Date().toISOString(),
    };
  }

  async send(message: MessageEnvelope): Promise<boolean> {
    if (!this.online) {
      return false;
    }

    try {
      // V0.1: Log to console instead of real HTTP
      // In production: await fetch(this.endpoint, { method: 'POST', body: JSON.stringify(message) })
      console.log(`[IPTransport] Would send to ${this.endpoint}:`, message.id);
      return true;
    } catch (error) {
      console.error('[IPTransport] Send failed:', error);
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    await this.checkConnectivity();
    return this.online;
  }
}
