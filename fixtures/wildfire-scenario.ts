/**
 * Wildfire Demo Scenario
 *
 * Acceptance Test Steps:
 * 1. Official wildfire data exists (simulated)
 * 2. Citizen A creates an SOS
 * 3. Internet transport is unavailable
 * 4. Message becomes QUEUED
 * 5. Local mesh simulator becomes available
 * 6. Message is forwarded
 * 7. A node with an IP gateway appears
 * 8. Message reaches incident dashboard
 * 9. Duplicate transmission arrives through a second route
 * 10. Dashboard stores only one incident/message
 * 11. Delivery history shows both paths
 * 12. Information provenance remains visible
 */

import type { MessageEnvelope, Incident } from '@civic-relay/schemas';

export const wildfireScenario = {
  /**
   * Step 1: Official wildfire incident (simulated data source)
   */
  officialIncident: {
    id: 'incident-wildfire-001',
    type: 'FIRE' as const,
    status: 'ACTIVE' as const,
    createdAt: '2026-09-09T14:30:00Z',
    updatedAt: '2026-09-09T14:30:00Z',
    location: {
      lat: 40.45,
      lon: -3.75,
      confidence: 'HIGH' as const,
      source: 'OFFICIAL' as const,
    },
    verificationState: 'OFFICIAL' as const,
    messageCount: 0,
    affectedCount: 0,
    description: 'Wildfire reported in Sierra de Guadarrama, expanding south',
    officialSource: 'Emergency Management Service Madrid',
  } as Incident,

  /**
   * Step 2: Citizen A creates SOS
   */
  citizenSOS: {
    id: 'msg-sos-citizen-a-001',
    incidentId: 'incident-wildfire-001',
    createdAt: '2026-09-09T14:35:00Z',
    priority: 'CRITICAL' as const,
    origin: 'citizen-a-device-001',
    payloadType: 'SOS' as const,
    payload: {
      text: 'Trapped by fire on M-601 highway, smoke everywhere, need evacuation',
      timestamp: '2026-09-09T14:35:00Z',
    },
    approximateLocation: {
      lat: 40.4522,
      lon: -3.7510,
      confidence: 'HIGH' as const,
      source: 'GPS' as const,
    },
    ttl: 7200, // 2 hours
    verificationState: 'UNVERIFIED' as const,
    deliveryHistory: [],
  } as MessageEnvelope,

  /**
   * Demo script steps
   */
  steps: [
    {
      step: 1,
      action: 'Display official wildfire incident on dashboard',
      code: `
// Incident already exists in system
console.log('Official incident:', officialIncident);
      `,
    },
    {
      step: 2,
      action: 'Citizen A creates SOS',
      code: `
// User presses "I Need Help" button
await dispatcher.dispatch(citizenSOS);
      `,
    },
    {
      step: 3,
      action: 'Simulate internet outage',
      code: `
// Simulate going offline
window.civicRelay.transports.ipTransport.online = false;
      `,
    },
    {
      step: 4,
      action: 'Verify message is QUEUED',
      code: `
const queued = dispatcher.getStore().getQueued();
console.log('Queued messages:', queued.length);
// Should show: 1 message queued
      `,
    },
    {
      step: 5,
      action: 'Local mesh becomes available',
      code: `
window.civicRelay.transports.meshTransport.setSimulatedState(true, 3);
await dispatcher.retryQueued();
      `,
    },
    {
      step: 6,
      action: 'Message forwarded through mesh',
      code: `
// Check delivery history
const msg = dispatcher.getStore().get(citizenSOS.id);
console.log('Delivery attempts:', msg.deliveryHistory);
// Should show: mesh transport attempt
      `,
    },
    {
      step: 7,
      action: 'Gateway node with IP appears',
      code: `
window.civicRelay.transports.ipTransport.online = true;
await dispatcher.retryQueued();
      `,
    },
    {
      step: 8,
      action: 'Message reaches dashboard via IP',
      code: `
const msg = dispatcher.getStore().get(citizenSOS.id);
const delivered = msg.deliveryHistory.filter(a => a.status === 'DELIVERED');
console.log('Delivered via:', delivered.map(d => d.transportId));
// Should show: ['local-mesh-sim-001', 'ip-transport-001']
      `,
    },
    {
      step: 9,
      action: 'Duplicate arrives via cellular (multipath)',
      code: `
window.civicRelay.transports.cellularTransport.setSimulatedState(true, 4);
await dispatcher.retryQueued();
      `,
    },
    {
      step: 10,
      action: 'Verify deduplication (single message stored)',
      code: `
const allMessages = dispatcher.getStore().getAll();
const thisMessage = allMessages.filter(m => m.id === citizenSOS.id);
console.log('Instances of this message:', thisMessage.length);
// Should be: 1 (deduplicated)
      `,
    },
    {
      step: 11,
      action: 'Verify delivery history shows all paths',
      code: `
const msg = dispatcher.getStore().get(citizenSOS.id);
const paths = new Set(msg.deliveryHistory.map(a => a.transportId));
console.log('Unique transport paths:', Array.from(paths));
// Should show: ['local-mesh-sim-001', 'ip-transport-001', 'cellular-sim-001']
      `,
    },
    {
      step: 12,
      action: 'Verify provenance visible in UI',
      code: `
const msg = dispatcher.getStore().get(citizenSOS.id);
console.log('Verification state:', msg.verificationState); // UNVERIFIED
console.log('Origin:', msg.origin); // citizen-a-device-001
console.log('Location source:', msg.approximateLocation?.source); // GPS
// Provenance preserved: citizen report, GPS location, UNVERIFIED
      `,
    },
  ],
};
