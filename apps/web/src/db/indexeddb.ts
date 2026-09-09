/**
 * IndexedDB Persistence
 * Toque Personal: Persistencia real (no solo memoria)
 */

import type { MessageEnvelope, Incident } from '@civic-relay/schemas';

const DB_NAME = 'civic-relay';
const DB_VERSION = 1;

export class CivicRelayDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('createdAt', 'createdAt');
          messagesStore.createIndex('priority', 'priority');
          messagesStore.createIndex('payloadType', 'payloadType');
        }

        // Incidents store
        if (!db.objectStoreNames.contains('incidents')) {
          const incidentsStore = db.createObjectStore('incidents', { keyPath: 'id' });
          incidentsStore.createIndex('createdAt', 'createdAt');
          incidentsStore.createIndex('status', 'status');
        }

        // Queue store (for offline messages)
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async saveMessage(message: MessageEnvelope): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessage(id: string): Promise<MessageEnvelope | undefined> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMessages(): Promise<MessageEnvelope[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMessagesByType(type: string): Promise<MessageEnvelope[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('payloadType');
      const request = index.getAll(type);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async queueMessage(message: MessageEnvelope): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const request = store.add({ message, queuedAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedMessages(): Promise<Array<{id: number; message: MessageEnvelope}>> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readonly');
      const store = transaction.objectStore('queue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromQueue(id: number): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldMessages(olderThan: Date): Promise<number> {
    if (!this.db) throw new Error('DB not initialized');

    const messages = await this.getAllMessages();
    let deleted = 0;

    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt);
      if (msgDate < olderThan) {
        await this.deleteMessage(msg.id);
        deleted++;
      }
    }

    return deleted;
  }

  async deleteMessage(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const db = new CivicRelayDB();
