import type { MessageEnvelope } from '@civic-relay/schemas';
import type { ITransport } from '@civic-relay/transports';
import { Router } from './router';
import { MessageStore } from './store';

/**
 * Dispatcher - Coordinates message routing and delivery
 *
 * Flow:
 * 1. User creates message
 * 2. Dispatcher stores locally
 * 3. Router selects transports
 * 4. Dispatcher attempts delivery through selected transports
 * 5. If no transports available, message stays queued
 * 6. Periodic retry for queued messages
 */
export class Dispatcher {
  private router: Router;
  private store: MessageStore;
  private transports: Map<string, ITransport> = new Map();
  private retryInterval: number | null = null;

  constructor() {
    this.router = new Router();
    this.store = new MessageStore();
  }

  registerTransport(transport: ITransport): void {
    this.transports.set(transport.id, transport);
    this.router.registerTransport(transport);
  }

  /**
   * Submit a message for delivery
   * Always returns immediately - delivery is asynchronous
   */
  async dispatch(message: MessageEnvelope): Promise<void> {
    // Always store locally first
    this.store.enqueue(message);

    // Attempt immediate delivery
    await this.attemptDelivery(message);
  }

  /**
   * Attempt to deliver a message through available transports
   */
  private async attemptDelivery(message: MessageEnvelope): Promise<void> {
    const decision = await this.router.route(message);

    console.log(`[Dispatcher] Routing decision for ${message.id}: ${decision.explanation}`);

    if (decision.selectedTransports.length === 0) {
      console.log(`[Dispatcher] No transports available - message ${message.id} queued`);
      return;
    }

    // Attempt delivery through all selected transports (multipath)
    const attempts = decision.selectedTransports.map(async (transportId) => {
      const transport = this.transports.get(transportId);
      if (!transport) return;

      try {
        const success = await transport.send(message);
        this.store.recordDeliveryAttempt(message.id, {
          transportId,
          attemptedAt: new Date().toISOString(),
          status: success ? 'DELIVERED' : 'FAILED',
        });

        if (success) {
          console.log(`[Dispatcher] Message ${message.id} delivered via ${transportId}`);
        }
      } catch (error) {
        this.store.recordDeliveryAttempt(message.id, {
          transportId,
          attemptedAt: new Date().toISOString(),
          status: 'FAILED',
          error: String(error),
        });
      }
    });

    await Promise.all(attempts);
  }

  /**
   * Retry delivery for all queued messages
   * Called periodically or when transports become available
   */
  async retryQueued(): Promise<void> {
    const queued = this.store.getQueued();

    if (queued.length === 0) {
      return;
    }

    console.log(`[Dispatcher] Retrying ${queued.length} queued messages`);

    for (const message of queued) {
      await this.attemptDelivery(message);
    }
  }

  /**
   * Start periodic retry of queued messages
   */
  startPeriodicRetry(intervalMs: number = 10000): void {
    if (this.retryInterval !== null) {
      return; // Already running
    }

    this.retryInterval = setInterval(() => {
      this.retryQueued();
      this.store.cleanupExpired();
    }, intervalMs) as any;

    console.log(`[Dispatcher] Periodic retry started (every ${intervalMs}ms)`);
  }

  /**
   * Stop periodic retry
   */
  stopPeriodicRetry(): void {
    if (this.retryInterval !== null) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      console.log('[Dispatcher] Periodic retry stopped');
    }
  }

  /**
   * Get the message store for inspection
   */
  getStore(): MessageStore {
    return this.store;
  }
}
