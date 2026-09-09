import type { MessageEnvelope, DeliveryAttempt } from '@civic-relay/schemas';
import { CryptoManager } from './crypto';

/**
 * MessageStore - Local queue with store-and-forward capability
 *
 * Messages remain queued until:
 * 1. Successfully delivered through at least one transport
 * 2. TTL expires
 * 3. Manually removed
 */
export class MessageStore {
  private messages: Map<string, MessageEnvelope> = new Map();
  private deliveryState: Map<string, 'QUEUED' | 'DELIVERED' | 'FAILED'> = new Map();

  /**
   * Add message to local queue
   */
  enqueue(message: MessageEnvelope): void {
    this.messages.set(message.id, message);
    this.deliveryState.set(message.id, 'QUEUED');
    console.log(`[MessageStore] Enqueued message ${message.id}`);
  }

  /**
   * Encrypt message and store it securely
   * Mejora #1: E2E Encryption
   */
  async encryptAndStore(message: MessageEnvelope, recipientPublicKey: string): Promise<void> {
    const encrypted = await CryptoManager.encryptMessage(message, recipientPublicKey);
    this.enqueue(encrypted);
  }

  /**
   * Get all queued messages (not yet delivered)
   */
  getQueued(): MessageEnvelope[] {
    return Array.from(this.messages.values()).filter(
      (msg) => this.deliveryState.get(msg.id) === 'QUEUED'
    );
  }

  /**
   * Get all messages (for history view)
   */
  getAll(): MessageEnvelope[] {
    return Array.from(this.messages.values());
  }

  /**
   * Get one message by ID
   */
  get(id: string): MessageEnvelope | undefined {
    return this.messages.get(id);
  }

  /**
   * Record a delivery attempt
   */
  recordDeliveryAttempt(messageId: string, attempt: DeliveryAttempt): void {
    const message = this.messages.get(messageId);
    if (!message) return;

    message.deliveryHistory.push(attempt);

    // Update overall delivery state
    const hasSuccessful = message.deliveryHistory.some((a) => a.status === 'DELIVERED');
    if (hasSuccessful) {
      this.deliveryState.set(messageId, 'DELIVERED');
    }
  }

  /**
   * Check if message has been delivered through at least one transport
   */
  isDelivered(messageId: string): boolean {
    return this.deliveryState.get(messageId) === 'DELIVERED';
  }

  /**
   * Clean up expired messages (TTL exceeded)
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, message] of this.messages.entries()) {
      const createdAt = new Date(message.createdAt).getTime();
      const expiresAt = createdAt + message.ttl * 1000;

      if (now > expiresAt) {
        this.messages.delete(id);
        this.deliveryState.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[MessageStore] Cleaned up ${cleaned} expired messages`);
    }

    return cleaned;
  }
}
