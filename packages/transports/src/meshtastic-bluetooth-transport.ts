import type {
  MessageEnvelope, TransportCapability
} from '@civic-relay/schemas';
import { ITransport, SendResult } from './base.js';

// Meshtastic GATT Service UUIDs
const MESHTASTIC_SERVICE_UUID = 'cb0b9a0b-a84c-4c0d-bdbb-442e3144ee30';
const TONUM_CHAR_UUID = 'cb0b9a0b-a84c-4c0d-bdbb-442e3144ee32';

/**
 * WebBluetooth transport for connecting to a Meshtastic LoRa node via GATT Proxy.
 * 
 * Note: Web Bluetooth requires a user gesture to initiate device scanning/connection.
 * This transport currently acts as a stub that simulates connection via the browser API.
 */
export class MeshtasticWebBluetoothTransport implements ITransport {
  readonly id = 'meshtastic-web-bt-1';
  readonly type = 'LOCAL_MESH';

  private device: any | null = null;
  private server: any | null = null;
  private service: any | null = null;

  async getCapabilities(): Promise<TransportCapability> {
    return {
      transportId: this.id,
      transportType: 'LOCAL_MESH',
      available: await this.isAvailable(),
      estimatedReliability: 0.85, 
      latency: 3000, 
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: 237, // LoRa physical limit per packet approx
      lastSeen: new Date().toISOString()
    };
  }

  async isAvailable(): Promise<boolean> {
    // Check if browser supports Web Bluetooth
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      return false;
    }
    return true; 
  }

  /**
   * Must be called from a user-initiated event handler (e.g., button click)
   */
  async connect(): Promise<boolean> {
    if (!await this.isAvailable()) {
      throw new Error('Web Bluetooth not supported in this browser.');
    }

    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [MESHTASTIC_SERVICE_UUID] }]
      });

      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(MESHTASTIC_SERVICE_UUID);
      console.log('Connected to Meshtastic node:', this.device.name);
      return true;
    } catch (e) {
      console.error('Failed to connect to Meshtastic node via Bluetooth:', e);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.service = null;
  }

  async send(message: MessageEnvelope): Promise<SendResult> {
    if (!this.server || !this.service) {
      // Stub behavior: if not connected, simulate accepted but without delivery confirmation
      console.warn('MeshtasticWebBluetoothTransport: Not connected. Simulating message accepted by local buffer.');
      return { accepted: true };
    }

    try {
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify(message));

      if (payload.length > 237) {
        return { accepted: false, error: 'Payload too large for single Meshtastic packet' };
      }

      const toNumChar = await this.service.getCharacteristic(TONUM_CHAR_UUID);
      await toNumChar.writeValue(payload);

      return { accepted: true };
    } catch (e: any) {
      console.error('Error sending via Meshtastic WebBluetooth:', e);
      return { accepted: false, error: e.message };
    }
  }
}
