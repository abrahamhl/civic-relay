import type { MessageEnvelope } from '@civic-relay/schemas';
import type { ITransport } from '@civic-relay/transports';
import { Router } from './router.js';
import { MessageStore } from './store.js';
import { isExpired } from './envelope.js';

/**
 * Dispatcher - route through available transports and reconcile only receiver
 * acknowledgments. Accepted-but-unescorted transmissions are recorded IN_TRANSIT
 * and never promoted to DELIVERED without a receiver receipt.
 */
export class Dispatcher {
  private readonly router: Router;
  private readonly store: MessageStore;
  private readonly transports = new Map<string, ITransport>();
  private retryInterval: number | null = null;
  private retrying = false;

  constructor() {
    this.router = new Router();
    this.store = new MessageStore();
  }

  registerTransport(transport: ITransport): void {
    this.transports.set(transport.id, transport);
    this.router.registerTransport(transport);
  }

  async dispatch(message: MessageEnvelope): Promise<void> {
    this.store.enqueue(message);
    await this.attemptDelivery(message);
  }

  private async attemptDelivery(message: MessageEnvelope): Promise<void> {
    if (isExpired(message, Date.now())) {
      this.store.cleanupExpired();
      return;
    }

    const decision = await this.router.route(message);
    const pending = decision.selectedTransports.filter(
      (id) => !this.store.hasAcknowledgment(message.id, id)
    );

    if (pending.length === 0) {
      this.store.completeDelivery(message.id, this.requiredAcknowledgments(message));
      return;
    }

    await Promise.all(
      pending.map(async (transportId) => {
        const transport = this.transports.get(transportId);
        if (!transport) return;
        try {
          const result = await transport.send(message);
          const attemptedAt = new Date().toISOString();
          if (!result.accepted) {
            this.store.recordDeliveryAttempt(message.id, {
              transportId,
              attemptedAt,
              status: 'FAILED',
              error: result.error ?? 'Simulator unavailable',
            });
            return;
          }

          if (!result.acknowledgment) {
            this.store.recordDeliveryAttempt(message.id, {
              transportId,
              attemptedAt,
              status: 'IN_TRANSIT',
            });
            return;
          }

          const ack = result.acknowledgment;
          if (ack.messageId !== message.id || ack.transportId !== transportId) {
            this.store.recordDeliveryAttempt(message.id, {
              transportId,
              attemptedAt,
              status: 'FAILED',
              error: 'Receiver acknowledgment mismatch',
            });
            return;
          }

          this.store.recordDeliveryAttempt(message.id, {
            transportId,
            attemptedAt,
            status: 'DELIVERED',
          });
        } catch (error) {
          this.store.recordDeliveryAttempt(message.id, {
            transportId,
            attemptedAt: new Date().toISOString(),
            status: 'FAILED',
            error: String(error),
          });
        }
      })
    );

    // The receiver only acknowledged the paths it saw; keep sender pending any
    // required path that has not yet returned a receipt.
    this.store.completeDelivery(message.id, this.requiredAcknowledgments(message));
  }

  private requiredAcknowledgments(message: MessageEnvelope): number {
    switch (message.priority) {
      case 'CRITICAL':
        return 3;
      case 'HIGH':
        return 2;
      case 'MEDIUM':
      case 'LOW':
        return 1;
    }
  }

  async retryQueued(): Promise<void> {
    if (this.retrying) return;
    const queued = this.store.getQueued();
    if (queued.length === 0) return;
    this.retrying = true;
    try {
      for (const message of queued) {
        await this.attemptDelivery(message);
      }
    } finally {
      this.retrying = false;
    }
  }

  startPeriodicRetry(intervalMs = 10000): void {
    if (this.retryInterval !== null) return;
    this.retryInterval = setInterval(() => {
      void this.retryQueued();
    }, intervalMs) as unknown as number;
  }

  stopPeriodicRetry(): void {
    if (this.retryInterval !== null) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  getStore(): MessageStore {
    return this.store;
  }
}
