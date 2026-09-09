import { describe, it, expect } from '@jest/globals';
import { Deduplicator } from '../deduplication';
import type { MessageEnvelope } from '@civic-relay/schemas';

describe('Deduplicator', () => {
  it('should identify first message as non-duplicate', () => {
    const dedup = new Deduplicator();
    const message: MessageEnvelope = {
      id: 'msg-001',
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority: 'HIGH',
      origin: 'user-001',
      payloadType: 'SOS',
      payload: {},
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [{
        transportId: 'ip-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    };

    const result = dedup.deduplicate(message);

    expect(result.isDuplicate).toBe(false);
    expect(result.paths).toBe(1);
  });

  it('should detect duplicate and merge delivery history', () => {
    const dedup = new Deduplicator();

    const message1: MessageEnvelope = {
      id: 'msg-001',
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority: 'HIGH',
      origin: 'user-001',
      payloadType: 'SOS',
      payload: {},
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [{
        transportId: 'mesh-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    };

    const message2: MessageEnvelope = {
      ...message1,
      deliveryHistory: [{
        transportId: 'ip-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    };

    dedup.deduplicate(message1);
    const result = dedup.deduplicate(message2);

    expect(result.isDuplicate).toBe(true);
    expect(result.paths).toBe(2); // mesh-001 + ip-001
    expect(result.message.deliveryHistory.length).toBe(2);
  });

  it('should count unique transport paths correctly', () => {
    const dedup = new Deduplicator();

    const baseMessage: MessageEnvelope = {
      id: 'msg-001',
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority: 'CRITICAL',
      origin: 'user-001',
      payloadType: 'SOS',
      payload: {},
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };

    // First path: mesh
    dedup.deduplicate({
      ...baseMessage,
      deliveryHistory: [{
        transportId: 'mesh-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    });

    // Second path: IP
    dedup.deduplicate({
      ...baseMessage,
      deliveryHistory: [{
        transportId: 'ip-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    });

    // Third path: cellular
    const result = dedup.deduplicate({
      ...baseMessage,
      deliveryHistory: [{
        transportId: 'cellular-001',
        attemptedAt: new Date().toISOString(),
        status: 'DELIVERED',
      }],
    });

    expect(result.paths).toBe(3);
  });
});
