import { DeliveryAttemptSchema, type MessageEnvelope, type DeliveryAttempt } from '@civic-relay/schemas';
import { CryptoManager } from './crypto.js';
import { assertSameMessage, isExpired, parseUntrustedMessage } from './envelope.js';

export type DeliveryState = 'QUEUED' | 'ACKNOWLEDGED' | 'DELIVERED' | 'EXPIRED';

/**
 * Session-memory sender store only. A page reload loses messages, acknowledgments,
 * history and ID-conflict protection; no persistence is claimed.
 */
export class MessageStore {
  private readonly messages = new Map<string, MessageEnvelope>();
  private readonly states = new Map<string, DeliveryState>();
  private readonly acknowledgments = new Map<string, Set<string>>();

  constructor(private readonly now: () => number = Date.now) {}

  enqueue(input: unknown): MessageEnvelope {
    const message = parseUntrustedMessage(input, this.now());
    const existing = this.messages.get(message.id);
    if (existing) {
      assertSameMessage(existing, message);
      return structuredClone(existing);
    }

    if (isExpired(message, this.now())) throw new Error('Expired message rejected');

    // Delivery history is local bookkeeping, never trusted from the sender.
    message.deliveryHistory = [];
    this.messages.set(message.id, message);
    this.states.set(message.id, 'QUEUED');
    this.acknowledgments.set(message.id, new Set());
    return structuredClone(message);
  }

  /** Experimental primitive wrapper; the demo does not claim live E2E encryption. */
  async encryptAndStore(message: MessageEnvelope, recipientPublicKey: string): Promise<void> {
    const encrypted = await CryptoManager.encryptMessage(message, recipientPublicKey);
    this.enqueue(encrypted);
  }

  /** Sender still owes delivery along at least one route for these states. */
  getQueued(): MessageEnvelope[] {
    this.cleanupExpired();
    return this.getAll().filter((message) => {
      const state = this.states.get(message.id);
      return state === 'QUEUED' || state === 'ACKNOWLEDGED';
    });
  }

  getAll(): MessageEnvelope[] {
    return structuredClone(Array.from(this.messages.values()));
  }

  get(id: string): MessageEnvelope | undefined {
    const message = this.messages.get(id);
    return message ? structuredClone(message) : undefined;
  }

  getState(id: string): DeliveryState | undefined {
    this.cleanupExpired();
    return this.states.get(id);
  }

  hasAcknowledgment(messageId: string, transportId: string): boolean {
    return this.acknowledgments.get(messageId)?.has(transportId) ?? false;
  }

  getAcknowledgedPaths(messageId: string): string[] {
    return Array.from(this.acknowledgments.get(messageId) ?? []);
  }

  /** Internal receiver-Ack movement. A transport returning accepted is not enough. */
  recordDeliveryAttempt(messageId: string, attempt: DeliveryAttempt): void {
    const message = this.messages.get(messageId);
    if (!message) return;
    const validated = DeliveryAttemptSchema.parse(attempt);

    if (validated.status === 'DELIVERED') {
      this.acknowledgments.get(messageId)?.add(validated.transportId);
      const previous = message.deliveryHistory.findIndex(
        (item) => item.transportId === validated.transportId && item.status === 'DELIVERED'
      );
      if (previous >= 0) message.deliveryHistory[previous] = validated;
      else message.deliveryHistory.push(validated);
      const current = this.states.get(messageId);
      if (current !== 'DELIVERED' && current !== 'EXPIRED') {
        this.states.set(messageId, 'ACKNOWLEDGED');
      }
      return;
    }

    message.deliveryHistory.push(validated);
  }

  /** Complete only after the receiver acknowledges at least the route count requested. */
  completeDelivery(messageId: string, requiredAcknowledgments: number): void {
    const id = this.messages.get(messageId)?.id;
    if (!id || this.states.get(id) === 'EXPIRED') return;
    if ((this.acknowledgments.get(id)?.size ?? 0) >= requiredAcknowledgments) {
      this.states.set(id, 'DELIVERED');
    }
  }

  cleanupExpired(): number {
    let expired = 0;
    for (const [id, message] of this.messages) {
      const state = this.states.get(id);
      if (isExpired(message, this.now()) && state !== 'DELIVERED' && state !== 'EXPIRED') {
        this.states.set(id, 'EXPIRED');
        expired++;
      }
    }
    return expired;
  }
}
