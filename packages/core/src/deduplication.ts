import type { MessageEnvelope } from '@civic-relay/schemas';

/**
 * Deduplicator - Ensures each logical message is stored once
 *
 * When the same message arrives through multiple paths:
 * - Keep only one copy
 * - Merge delivery history from all paths
 * - Preserve provenance information
 */
export class Deduplicator {
  private seen: Map<string, MessageEnvelope> = new Map();

  /**
   * Process an incoming message
   * Returns the canonical message (either existing or new)
   */
  deduplicate(incoming: MessageEnvelope): {
    message: MessageEnvelope;
    isDuplicate: boolean;
    paths: number;
  } {
    const existing = this.seen.get(incoming.id);

    if (!existing) {
      // First time seeing this message
      this.seen.set(incoming.id, incoming);
      return {
        message: incoming,
        isDuplicate: false,
        paths: 1,
      };
    }

    // Duplicate detected - merge delivery history
    const newDeliveries = incoming.deliveryHistory.filter(
      (newAttempt) =>
        !existing.deliveryHistory.some(
          (existingAttempt) =>
            existingAttempt.transportId === newAttempt.transportId &&
            existingAttempt.attemptedAt === newAttempt.attemptedAt
        )
    );

    existing.deliveryHistory.push(...newDeliveries);

    const totalPaths = new Set(existing.deliveryHistory.map((a) => a.transportId)).size;

    console.log(
      `[Deduplicator] Duplicate message ${incoming.id} received via ${totalPaths} paths total`
    );

    return {
      message: existing,
      isDuplicate: true,
      paths: totalPaths,
    };
  }

  /**
   * Check if we've seen this message before
   */
  hasSeen(messageId: string): boolean {
    return this.seen.has(messageId);
  }

  /**
   * Get all unique messages
   */
  getAll(): MessageEnvelope[] {
    return Array.from(this.seen.values());
  }
}
