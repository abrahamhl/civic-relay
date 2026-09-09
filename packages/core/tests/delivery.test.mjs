import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSession, runGoldenScenario } from '../dist/demo.js';
import { Dispatcher } from '../dist/dispatcher.js';
import { MessageEnvelopeSchema } from '@civic-relay/schemas';
import { SimulatedTransport } from '@civic-relay/transports';

function message(overrides = {}) {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    incidentId: null,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    priority: 'HIGH',
    origin: 'demo-citizen',
    payloadType: 'SOS',
    payload: { text: 'Fictional test only' },
    approximateLocation: { lat: 40.4168, lon: -3.7038, confidence: 'MEDIUM', source: 'MANUAL' },
    ttl: 3600,
    verificationState: 'UNVERIFIED',
    deliveryHistory: [],
  };
  return MessageEnvelopeSchema.parse({ ...base, ...overrides });
}

test('golden scenario queues offline then deduplicates two simulated paths to one logical message', async () => {
  const result = await runGoldenScenario(message({ priority: 'CRITICAL' }), ['mesh', 'ip', 'cellular']);
  assert.equal(result.receiverCount, 1);
  assert.equal(result.receiverPaths, 3);
  const statuses = result.senderHistory.map((h) => h.status);
  assert.ok(statuses.includes('DELIVERED'));
});

test('transport accepted without receiver acknowledgment never becomes delivered', async () => {
  const dispatcher = new Dispatcher();
  const ip = (await import('@civic-relay/transports')).IPTransport;
  const transport = new ip();
  transport.setSimulatedState(true);
  dispatcher.registerTransport(transport);
  await dispatcher.dispatch(message());
  assert.ok(dispatcher.getStore().getQueued().some((m) => m.id === '11111111-1111-4111-8111-111111111111'));
  const stored = dispatcher.getStore().get('11111111-1111-4111-8111-111111111111');
  assert.equal(stored.deliveryHistory.some((a) => a.status === 'DELIVERED'), false);
});

test('all transports unavailable leaves message queued', async () => {
  const s = createDemoSession();
  s.transports.ip.setSimulatedState(false);
  s.transports.mesh.setSimulatedState(false);
  s.transports.cellular.setSimulatedState(false);
  await s.dispatcher.dispatch(message());
  assert.ok(s.dispatcher.getStore().getQueued().length >= 1);
  assert.equal(s.receiver.getAll().length, 0);
});

test('expired messages are rejected before routing', async () => {
  const s = createDemoSession();
  await assert.rejects(s.dispatcher.dispatch(message({
    createdAt: '2020-01-01T00:00:00.000Z', ttl: 1,
  })), /Expired/);
  assert.equal(s.receiver.getAll().length, 0);
});

test('untrusted messages may not forge OFFICIAL or fail validation', async () => {
  const s = createDemoSession();
  await assert.rejects(s.dispatcher.dispatch(message({ verificationState: 'OFFICIAL' })));
  await assert.rejects(s.dispatcher.dispatch({ ...message(), id: 'not-a-uuid' }));
  await assert.rejects(s.dispatcher.dispatch({ ...message(), payloadType: 'UNKNOWN' }));
});

test('same message delivered twice via two transports is one logical message with both paths', async () => {
  const s = createDemoSession();
  const incoming = message();
  const first = s.receiver.deduplicate(incoming, 'mesh');
  const second = s.receiver.deduplicate(incoming, 'ip');
  assert.equal(first.isDuplicate, false);
  assert.equal(second.isDuplicate, true);
  assert.equal(s.receiver.getAll().length, 1);
  assert.equal(s.receiver.getAll()[0].deliveryHistory.length, 2);
});

test('ID collision with diverging content is rejected without overwriting', async () => {
  const s = createDemoSession();
  s.receiver.deduplicate(message(), 'mesh');
  assert.throws(() => s.receiver.deduplicate(message({ payload: { text: 'different' } }), 'ip'), /ID conflict/);
  assert.equal(s.receiver.getAll().length, 1);
});

test('one failing transport does not block a healthy path from acknowledging', async () => {
  const session = createDemoSession();
  session.transports.ip.setSimulatedState(true);
  session.transports.mesh.setSimulatedState(false);
  session.transports.cellular.setSimulatedState(false);

  class FailingTransport extends SimulatedTransport {
    id = 'fail-001';
    type = 'CELLULAR';
    async isAvailable() {
      return true;
    }
    async getCapabilities() {
      return {
        transportId: this.id, transportType: this.type, available: await this.isAvailable(),
        estimatedReliability: 0.1, latency: 50, energyCost: 'LOW', monetaryCost: 'FREE',
        bandwidth: 10, lastSeen: new Date().toISOString(),
      };
    }
    async send() {
      return { accepted: false, error: 'Synthetic failure' };
    }
  }
  const failing = new FailingTransport();
  failing.setAvailable(true);
  session.dispatcher.registerTransport(failing);

  await session.dispatcher.dispatch(message({ priority: 'HIGH' }));
  const stored = session.dispatcher.getStore().get('11111111-1111-4111-8111-111111111111');
  assert.ok(stored.deliveryHistory.some((a) => a.status === 'DELIVERED'));
  assert.ok(stored.deliveryHistory.some((a) => a.status === 'FAILED'));
});
