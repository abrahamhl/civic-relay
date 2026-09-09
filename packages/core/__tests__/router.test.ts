import { describe, it, expect, beforeEach } from '@jest/globals';
import { Router } from '../router';
import type { MessageEnvelope, TransportCapability } from '@civic-relay/schemas';
import type { ITransport } from '@civic-relay/transports';

class MockTransport implements ITransport {
  constructor(
    public id: string,
    public type: TransportCapability['transportType'],
    private capability: TransportCapability
  ) {}

  async getCapabilities() {
    return this.capability;
  }

  async send() {
    return true;
  }

  async isAvailable() {
    return this.capability.available;
  }
}

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it('should return empty selection when no transports available', async () => {
    const message: MessageEnvelope = {
      id: 'msg-001',
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority: 'MEDIUM',
      origin: 'user-001',
      payloadType: 'GENERAL_REPORT',
      payload: {},
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };

    const decision = await router.route(message);

    expect(decision.selectedTransports.length).toBe(0);
    expect(decision.explanation).toContain('No transports available');
  });

  it('should select transport with highest reliability', async () => {
    const lowReliability = new MockTransport('low', 'LOCAL_MESH', {
      transportId: 'low',
      transportType: 'LOCAL_MESH',
      available: true,
      estimatedReliability: 0.5,
      latency: 500,
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: 50000,
      lastSeen: new Date().toISOString(),
    });

    const highReliability = new MockTransport('high', 'IP', {
      transportId: 'high',
      transportType: 'IP',
      available: true,
      estimatedReliability: 0.95,
      latency: 100,
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: 1000000,
      lastSeen: new Date().toISOString(),
    });

    router.registerTransport(lowReliability);
    router.registerTransport(highReliability);

    const message: MessageEnvelope = {
      id: 'msg-001',
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority: 'MEDIUM',
      origin: 'user-001',
      payloadType: 'GENERAL_REPORT',
      payload: {},
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };

    const decision = await router.route(message);

    expect(decision.selectedTransports[0]).toBe('high');
  });

  it('should use multipath for critical messages', async () => {
    const transport1 = new MockTransport('t1', 'IP', {
      transportId: 't1',
      transportType: 'IP',
      available: true,
      estimatedReliability: 0.95,
      latency: 100,
      energyCost: 'LOW',
      monetaryCost: 'FREE',
      bandwidth: 1000000,
      lastSeen: new Date().toISOString(),
    });

    const transport2 = new MockTransport('t2', 'CELLULAR', {
      transportId: 't2',
      transportType: 'CELLULAR',
      available: true,
      estimatedReliability: 0.85,
      latency: 200,
      energyCost: 'HIGH',
      monetaryCost: 'LOW',
      bandwidth: 500000,
      lastSeen: new Date().toISOString(),
    });

    const transport3 = new MockTransport('t3', 'LOCAL_MESH', {
      transportId: 't3',
      transportType: 'LOCAL_MESH',
      available: true,
      estimatedReliability: 0.7,
      latency: 500,
      energyCost: 'MEDIUM',
      monetaryCost: 'FREE',
      bandwidth: 50000,
      lastSeen: new Date().toISOString(),
    });

    router.registerTransport(transport1);
    router.registerTransport(transport2);
    router.registerTransport(transport3);

    const criticalMessage: MessageEnvelope = {
      id: 'msg-critical',
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

    const decision = await router.route(criticalMessage);

    // Critical messages should use up to 3 transports
    expect(decision.selectedTransports.length).toBe(3);
    expect(decision.explanation).toContain('Multipath');
  });
});
