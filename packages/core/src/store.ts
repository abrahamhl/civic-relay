import { DeliveryAttemptSchema, type MessageEnvelope, type DeliveryAttempt } from '@civic-relay/schemas';
import { CryptoManager } from './crypto.js';
import { assertSameMessage, isExpired, parseUntrustedMessage } from './envelope.js';
import { get, set, createStore, UseStore } from 'idb-keyval';

export type DeliveryState = 'QUEUED' | 'ACKNOWLEDGED' | 'DELIVERED' | 'EXPIRED';

/**
 * Message store with IndexedDB persistence for offline-first capabilities.
 */
export class MessageStore {
  private readonly messages = new Map<string, MessageEnvelope>();
  private readonly states = new Map<string, DeliveryState>();
  private readonly acknowledgments = new Map<string, Set<string>>();
  private readonly idbStore?: UseStore;
  private writeChain: Promise<void> = Promise.resolve();
  private persistenceError: unknown = null;

  constructor(private readonly now: () => number = Date.now) {
    if (typeof indexedDB !== 'undefined') {
      this.idbStore = createStore('civic-relay-db', 'message-store');
    }
  }

  async loadFromStorage(): Promise<void> {
    if (!this.idbStore) return;
    try {
      // A single atomic snapshot avoids torn writes between the messages/states/acks keys.
      // Legacy keys are read only for migration from the first demo version.
      const snapshot = await get<{
        messages: MessageEnvelope[];
        states: [string, DeliveryState][];
        acks: [string, string[]][];
      }>('snapshot', this.idbStore);
      const storedMessages = snapshot?.messages ?? await get<MessageEnvelope[]>('messages', this.idbStore);
      const storedStates = snapshot?.states ?? await get<[string, DeliveryState][]>('states', this.idbStore);
      const storedAcks = snapshot?.acks ?? await get<[string, string[]][]>('acks', this.idbStore);
      
      if (storedMessages) {
        for (const m of storedMessages) {
          // Never trust browser storage to upgrade a message into an official notice.
          try {
            const validated = parseUntrustedMessage(m, this.now());
            this.messages.set(validated.id, validated);
          } catch {
            console.warn('Ignoring invalid or untrusted local message');
          }
        }
      }
      if (storedStates) {
        for (const [k, v] of storedStates) this.states.set(k, v);
      }
      if (storedAcks) {
        for (const [k, v] of storedAcks) this.acknowledgments.set(k, new Set(v));
      }
    } catch (e) {
      console.error('Failed to load MessageStore from IndexedDB', e);
      throw e;
    }
  }

  /**
   * Serialize immutable, coherent snapshots. A browser crash cannot leave an
   * acknowledged delivery state paired with stale message data across keys.
   * Real durability still requires browser power-loss tests.
   */
  private persist(): void {
    const db = this.idbStore;
    if (!db) return;
    const snapshot = {
      messages: Array.from(this.messages.values()),
      states: Array.from(this.states.entries()),
      acks: Array.from(this.acknowledgments.entries()).map(
        ([key, paths]) => [key, Array.from(paths)] as [string, string[]]
      ),
    };
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      await set('snapshot', snapshot, db);
      this.persistenceError = null;
    }).catch((error: unknown) => {
      this.persistenceError = error;
      console.error('Failed to persist MessageStore to IndexedDB', error);
    });
  }

  /** Caller must await this before reporting that a message is safely staged. */
  async flushPersistence(): Promise<void> {
    await this.writeChain;
    if (this.persistenceError) throw new Error('Local message persistence failed');
  }

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
    
    this.persist();
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

    let changed = false;

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
      changed = true;
    } else {
      message.deliveryHistory.push(validated);
      changed = true;
    }

    if (changed) this.persist();
  }

  /** Complete only after the receiver acknowledges at least the route count requested. */
  completeDelivery(messageId: string, requiredAcknowledgments: number): void {
    const id = this.messages.get(messageId)?.id;
    if (!id || this.states.get(id) === 'EXPIRED') return;
    if ((this.acknowledgments.get(id)?.size ?? 0) >= requiredAcknowledgments) {
      if (this.states.get(id) !== 'DELIVERED') {
        this.states.set(id, 'DELIVERED');
        this.persist();
      }
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
    if (expired > 0) this.persist();
    return expired;
  }
}
