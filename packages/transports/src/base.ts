import type { MessageEnvelope, TransportCapability } from '@civic-relay/schemas';

/**
 * Base transport interface
 * All transports must implement this contract
 */
export interface ITransport {
  readonly id: string;
  readonly type: TransportCapability['transportType'];

  /**
   * Report current capabilities
   * Called by router to make decisions
   */
  getCapabilities(): Promise<TransportCapability>;

  /**
   * Send a message through this transport
   * Returns true if accepted for delivery (not necessarily delivered yet)
   */
  send(message: MessageEnvelope): Promise<boolean>;

  /**
   * Check if this transport is currently available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Result of a send attempt
 */
export interface SendResult {
  success: boolean;
  transportId: string;
  error?: string;
  estimatedDeliveryTime?: number; // milliseconds
}
