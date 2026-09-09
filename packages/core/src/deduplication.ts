import type { MessageEnvelope, ReceiverAcknowledgment } from '@civic-relay/schemas';
import { assertSameMessage, isExpired, parseUntrustedMessage } from './envelope.js';

/** Independent, session-memory receiver. History records only locally observed paths. */
export class Deduplicator {
  private seen = new Map<string, MessageEnvelope>();
  readonly id = 'same-page-demo-receiver';

  constructor(private readonly now: () => number = Date.now) {}

  deduplicate(input: unknown, transportId: string): {
    message: MessageEnvelope;
    isDuplicate: boolean;
    paths: number;
    acknowledgment: ReceiverAcknowledgment;
  } {
    const now = this.now();
    const incoming = parseUntrustedMessage(input, now);
    if (isExpired(incoming, now)) throw new Error('Expired message rejected by receiver');
    if (typeof transportId !== 'string' || !transportId.trim()) {
      throw new Error('An observed transport ID is required');
    }
    const existing = this.seen.get(incoming.id);
    if (existing) assertSameMessage(existing, incoming);
    const message = existing ?? { ...incoming, deliveryHistory: [] };
    const receivedAt = new Date(now).toISOString();
    if (!message.deliveryHistory.some((attempt) => attempt.transportId === transportId)) {
      message.deliveryHistory.push({ transportId, attemptedAt: receivedAt, status: 'DELIVERED' });
    }
    this.seen.set(message.id, message);
    return {
      message: structuredClone(message),
      isDuplicate: Boolean(existing),
      paths: message.deliveryHistory.length,
      acknowledgment: { messageId: message.id, transportId, receiverId: this.id, receivedAt },
    };
  }

  hasSeen(messageId: string): boolean {
    return this.seen.has(messageId);
  }

  getAll(): MessageEnvelope[] {
    return structuredClone(Array.from(this.seen.values()));
  }
}
