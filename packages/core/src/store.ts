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

  constructor(private readonly now: () => number = Date.now) {
    if (typeof indexedDB !== 'undefined') {
      this.idbStore = createStore('civic-relay-db', 'message-store');
    }
  }

  async loadFromStorage(): Promise<void> {
    if (!this.idbStore) return;
    try {
      const storedMessages = await get<MessageEnvelope[]>('messages', this.idbStore);
      const storedStates = await get<[string, DeliveryState][]>('states', this.idbStore);
      const storedAcks = await get<[string, string[]][]>('acks', this.idbStore);
      
      if (storedMessages) {
        for (const m of storedMessages) this.messages.set(m.id, m);
      }
      if (storedStates) {
        for (const [k, v] of storedStates) this.states.set(k, v);
      }
      if (storedAcks) {
        for (const [k, v] of storedAcks) this.acknowledgments.set(k, new Set(v));
      }
    } catch (e) {
      console.warn('Failed to load MessageStore from IndexedDB', e);
    }
  }

  private persist(): void {
    if (!this.idbStore) return;
    try {
      set('messages', Array.from(this.messages.values()), this.idbStore).catch(() => {});
      set('states', Array.from(this.states.entries()), this.idbStore).catch(() => {});
      set('acks', Array.from(this.acknowledgments.entries()).map(([k, v]) => [k, Array.from(v)]), this.idbStore).catch(() => {});
    } catch (e) {
      console.warn('Failed to persist MessageStore to IndexedDB', e);
    }
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
