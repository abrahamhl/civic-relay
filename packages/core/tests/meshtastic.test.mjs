import { test } from 'node:test';
import assert from 'node:assert';
import { MeshtasticWebBluetoothTransport } from '@civic-relay/transports';
import { Dispatcher, Router, MessageStore } from '@civic-relay/core';

test('Meshtastic Integration: Stub test for GATT Proxy', async (t) => {
  const transport = new MeshtasticWebBluetoothTransport();
  
  // Since we are running in Node.js, Web Bluetooth (navigator.bluetooth) is unavailable.
  // The isAvailable() should return false gracefully.
  const isAvailable = await transport.isAvailable();
  assert.strictEqual(isAvailable, false, 'WebBluetooth should gracefully report unavailable in Node.js');

  // Attempting to send while unavailable should result in accepted: false (or stub mode accepted: true)
  const message = {
    id: '123',
    senderId: 'alice',
    recipientId: 'bob',
    payloadType: 'SAFE',
    payload: { latitude: 0, longitude: 0 },
    priority: 'LOW',
    timestamp: Date.now(),
    ttl: 3600,
    deliveryHistory: []
  };

  const result = await transport.send(message as any);
  
  // The current stub behavior in MeshtasticWebBluetoothTransport when not connected
  // simulates acceptance into the local buffer (since it's a stub).
  assert.strictEqual(result.accepted, true, 'Stub should accept message into local buffer even if disconnected');
});
