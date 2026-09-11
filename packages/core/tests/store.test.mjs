import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageStore } from '../dist/store.js';

function getValidMessage(id) {
  return {
    id: id,
    incidentId: '550e8400-e29b-41d4-a716-446655440000',
    createdAt: new Date().toISOString(),
    priority: 'HIGH',
    origin: 'device_xyz',
    payloadType: 'GENERAL_REPORT',
    payload: { text: 'Testing' },
    approximateLocation: {
      lat: 0.0,
      lon: 0.0,
      confidence: 'HIGH',
      source: 'GPS'
    },
    ttl: 3600,
    verificationState: 'UNVERIFIED',
    deliveryHistory: []
  };
}

test('Store and Forward: Enqueue and Read', (t) => {
  const store = new MessageStore();
  const msg = getValidMessage('123e4567-e89b-12d3-a456-426614174000');
  
  const queued = store.enqueue(msg);
  assert.equal(queued.id, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(store.getState('123e4567-e89b-12d3-a456-426614174000'), 'QUEUED');

  const forwardQueue = store.getQueued();
  assert.equal(forwardQueue.length, 1);
  assert.equal(forwardQueue[0].id, '123e4567-e89b-12d3-a456-426614174000');
});

test('Store and Forward: Acknowledgment and Completion', (t) => {
  const store = new MessageStore();
  const msg = getValidMessage('123e4567-e89b-12d3-a456-426614174001');

  store.enqueue(msg);

  store.recordDeliveryAttempt('123e4567-e89b-12d3-a456-426614174001', {
    transportId: 'mesh_network_1',
    attemptedAt: new Date().toISOString(),
    status: 'DELIVERED',
    latencyMs: 150
  });

  assert.equal(store.getState('123e4567-e89b-12d3-a456-426614174001'), 'ACKNOWLEDGED');
  assert.ok(store.hasAcknowledgment('123e4567-e89b-12d3-a456-426614174001', 'mesh_network_1'));
  
  assert.equal(store.getQueued().length, 1);

  store.completeDelivery('123e4567-e89b-12d3-a456-426614174001', 1);
  assert.equal(store.getState('123e4567-e89b-12d3-a456-426614174001'), 'DELIVERED');
  
  assert.equal(store.getQueued().length, 0);
});

test('Store and Forward: Expiry Eviction', (t) => {
  let currentTime = new Date('2026-09-01T12:00:00Z').getTime();
  const store = new MessageStore(() => currentTime);
  
  const msg = getValidMessage('123e4567-e89b-12d3-a456-426614174002');
  msg.createdAt = '2026-09-01T12:00:00.000Z';
  msg.ttl = 3600;

  store.enqueue(msg);
  assert.equal(store.getQueued().length, 1);

  // Fast forward time past expiry (ttl is in seconds)
  currentTime += 3601 * 1000;
  
  const queued = store.getQueued();
  assert.equal(queued.length, 0);
  assert.equal(store.getState('123e4567-e89b-12d3-a456-426614174002'), 'EXPIRED');
});

test('Store and Forward: Idempotent Enqueue (Conflict Protection)', (t) => {
  const store = new MessageStore();
  const msg = getValidMessage('123e4567-e89b-12d3-a456-426614174003');

  store.enqueue(msg);
  
  const reEnqueued = store.enqueue(msg);
  assert.equal(reEnqueued.id, '123e4567-e89b-12d3-a456-426614174003');
  assert.equal(store.getAll().length, 1);
});
