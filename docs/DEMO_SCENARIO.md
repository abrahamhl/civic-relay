# Demo Scenario – Wildfire Acceptance Test

## Overview

This demonstrates the **V0.1 acceptance test**: a wildfire scenario showing multipath routing, store-and-forward, and deduplication.

**Duration:** ~5 minutes  
**Prerequisites:** None (uses simulated transports)

---

## Scenario Setup

**Location:** Fictional area near Madrid, Spain  
**Event:** Wildfire spreading south from Sierra de Guadarrama  
**Time:** 2026-09-09, 14:30 UTC

**Characters:**

- **Citizen A** – Trapped by fire, needs evacuation
- **Incident Coordinator** – Views dashboard, coordinates response

**Infrastructure:**

- **Internet:** Initially available, then fails
- **Mesh Network:** Becomes available after internet fails
- **Cellular:** Becomes available later (multipath)

---

## 12-Step Acceptance Test

### Step 1: Official Wildfire Incident Exists

**Action:** System displays official fire data

**Source:** Simulated official incident (in real V1.0, would be NASA FIRMS)

**Data:**

```typescript
{
  id: 'incident-wildfire-001',
  type: 'FIRE',
  status: 'ACTIVE',
  location: { lat: 40.45, lon: -3.75, confidence: 'HIGH' },
  verificationState: 'OFFICIAL',
  description: 'Wildfire in Sierra de Guadarrama, expanding south',
  officialSource: 'Emergency Management Service Madrid'
}
```

**UI:** Red circle on map, labeled "OFFICIAL"

**✅ Pass condition:** Incident visible on coordinator dashboard

---

### Step 2: Citizen A Creates SOS

**Action:** User taps **"I Need Help"** button

**Message created:**

```typescript
{
  id: 'msg-sos-citizen-a-001',
  incidentId: 'incident-wildfire-001',
  priority: 'CRITICAL',
  payloadType: 'SOS',
  payload: { text: 'Trapped by fire on M-601 highway, smoke everywhere' },
  approximateLocation: { lat: 40.4522, lon: -3.7510, confidence: 'HIGH', source: 'GPS' },
  verificationState: 'UNVERIFIED',
  deliveryHistory: []
}
```

**UI:** Message appears in queue with status "⏳ Pending"

**✅ Pass condition:** Message stored locally

---

### Step 3: Internet Transport Unavailable

**Action:** Simulate network outage

**Code:**

```javascript
window.civicRelay.transports.ipTransport.online = false;
```

**Router decision:**

```
No transports available - message will be queued
```

**✅ Pass condition:** Transport status indicator shows "Offline - Messages Queued"

---

### Step 4: Message Becomes QUEUED

**Action:** Dispatcher attempts delivery, finds no transports

**Store state:**

```typescript
{
  messages: [msg-sos-citizen-a-001],
  deliveryState: { 'msg-sos-citizen-a-001': 'QUEUED' }
}
```

**UI:** Message card shows "⏳ Queued"

**✅ Pass condition:** Message visible in queue, not marked delivered

---

### Step 5: Local Mesh Simulator Becomes Available

**Action:** Simulate mesh network detection

**Code:**

```javascript
window.civicRelay.transports.meshTransport.setSimulatedState(true, 3);
await window.civicRelay.dispatcher.retryQueued();
```

**Router decision:**

```
Selected LOCAL_MESH (70% reliability, MEDIUM energy)
```

**✅ Pass condition:** Periodic retry triggers, router selects mesh

---

### Step 6: Message Forwarded Through Mesh

**Action:** Mesh transport sends message

**Delivery history updated:**

```typescript
deliveryHistory: [
  {
    transportId: 'local-mesh-sim-001',
    attemptedAt: '2026-09-09T14:36:00Z',
    status: 'DELIVERED'
  }
]
```

**Console log:**

```
[LocalMeshTransport] SIMULATED mesh forward (3 peers): msg-sos-citizen-a-001
[Dispatcher] Message msg-sos-citizen-a-001 delivered via local-mesh-sim-001
```

**UI:** Message card shows "✓ Delivered via 1 path"

**✅ Pass condition:** Delivery history contains mesh attempt with status DELIVERED

---

### Step 7: Node with IP Gateway Appears

**Action:** Simulate one mesh peer restoring internet connection

**Code:**

```javascript
window.civicRelay.transports.ipTransport.online = true;
await window.civicRelay.dispatcher.retryQueued();
```

**Router decision:**

```
Selected IP (95% reliability, LOW energy)
```

**✅ Pass condition:** IP transport becomes available

---

### Step 8: Message Reaches Dashboard via IP

**Action:** IP transport sends message

**Delivery history updated:**

```typescript
deliveryHistory: [
  { transportId: 'local-mesh-sim-001', status: 'DELIVERED' },
  { transportId: 'ip-transport-001', status: 'DELIVERED' }
]
```

**Console log:**

```
[IPTransport] Would send to https://api.civic-relay.example.com/messages: msg-sos-citizen-a-001
[Dispatcher] Message msg-sos-citizen-a-001 delivered via ip-transport-001
```

**UI:** Message card shows "✓ Delivered via 2 paths"

**✅ Pass condition:** Delivery history contains both mesh AND IP

---

### Step 9: Duplicate Transmission via Cellular (Multipath)

**Action:** Simulate cellular signal restoration

**Code:**

```javascript
window.civicRelay.transports.cellularTransport.setSimulatedState(true, 4);
await window.civicRelay.dispatcher.retryQueued();
```

**Router decision:**

```
Multipath routing (priority: CRITICAL): IP + CELLULAR + LOCAL_MESH for redundancy
```

**Delivery history updated:**

```typescript
deliveryHistory: [
  { transportId: 'local-mesh-sim-001', status: 'DELIVERED' },
  { transportId: 'ip-transport-001', status: 'DELIVERED' },
  { transportId: 'cellular-sim-001', status: 'DELIVERED' }
]
```

**✅ Pass condition:** Third transport path recorded

---

### Step 10: Dashboard Stores Only ONE Message (Deduplication)

**Action:** Deduplicator processes incoming message

**Code:**

```javascript
const allMessages = window.civicRelay.dispatcher.getStore().getAll();
const thisMessage = allMessages.filter(m => m.id === 'msg-sos-citizen-a-001');
console.log('Instances of this message:', thisMessage.length);
// Output: 1
```

**✅ Pass condition:** `thisMessage.length === 1` (not 3)

---

### Step 11: Delivery History Shows All Paths

**Action:** Inspect delivery history

**Code:**

```javascript
const msg = window.civicRelay.dispatcher.getStore().get('msg-sos-citizen-a-001');
const paths = new Set(msg.deliveryHistory.map(a => a.transportId));
console.log('Unique transport paths:', Array.from(paths));
// Output: ['local-mesh-sim-001', 'ip-transport-001', 'cellular-sim-001']
```

**UI:** Click "Delivery History" expander in message card:

```
Delivery History (3 attempts)
- local-mesh-sim-001: DELIVERED
- ip-transport-001: DELIVERED
- cellular-sim-001: DELIVERED
```

**✅ Pass condition:** All 3 transport IDs visible

---

### Step 12: Information Provenance Remains Visible

**Action:** Inspect message verification state

**Code:**

```javascript
const msg = window.civicRelay.dispatcher.getStore().get('msg-sos-citizen-a-001');
console.log('Verification state:', msg.verificationState); // UNVERIFIED
console.log('Origin:', msg.origin); // citizen-a-device-001
console.log('Location source:', msg.approximateLocation?.source); // GPS
```

**UI:**

- Message card shows badge: **"Unverified"** (yellow)
- Map marker color: Yellow (not green like official incident)
- Popup shows: "Verification: UNVERIFIED"

**✅ Pass condition:** Message clearly labeled as unverified citizen report

---

## Result

**Test passed:** ✅

- ✅ Same envelope (`msg-sos-citizen-a-001`)
- ✅ Multiple paths (mesh → IP → cellular)
- ✅ One logical message (deduplication)
- ✅ All paths recorded (delivery history)
- ✅ Provenance preserved (UNVERIFIED, citizen origin, GPS source)

---

## How to Run

### Option 1: Interactive Demo Runner

1. Build project:
   ```bash
   cd civic-relay
   pnpm install
   pnpm build
   ```

2. Open demo runner:
   ```bash
   # In browser:
   open fixtures/demo-runner.html
   ```

3. Click **"Start Demo"**

4. Click **"Next Step"** to advance through 12 steps

5. Observe console logs for each action

---

### Option 2: Manual Testing (Main App)

1. Start dev server:
   ```bash
   pnpm dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Open browser console (F12)

4. Execute steps manually:

   ```javascript
   // Step 2: Create SOS
   document.querySelector('.emergency-btn.sos').click();

   // Step 3: Go offline
   window.civicRelay.transports.ipTransport.online = false;

   // Step 4: Check queue
   window.civicRelay.dispatcher.getStore().getQueued();

   // Step 5: Enable mesh
   window.civicRelay.transports.meshTransport.setSimulatedState(true, 3);
   await window.civicRelay.dispatcher.retryQueued();

   // ... continue through all 12 steps
   ```

5. Verify UI updates after each step

---

## Expected Outputs

### Console Logs

```
[MessageStore] Enqueued message msg-sos-citizen-a-001
[Dispatcher] Routing decision for msg-sos-citizen-a-001: No transports available - message will be queued
[LocalMeshTransport] Simulation state: available=true, peers=3
[Dispatcher] Retrying 1 queued messages
[LocalMeshTransport] SIMULATED mesh forward (3 peers): msg-sos-citizen-a-001
[Dispatcher] Message msg-sos-citizen-a-001 delivered via local-mesh-sim-001
[IPTransport] Would send to https://api.civic-relay.example.com/messages: msg-sos-citizen-a-001
[Dispatcher] Message msg-sos-citizen-a-001 delivered via ip-transport-001
[CellularTransport] SIMULATED cellular send (signal 4/5): msg-sos-citizen-a-001
[Dispatcher] Message msg-sos-citizen-a-001 delivered via cellular-sim-001
```

### UI States

| Step | Transport Status | Message Queue | Map |
|------|------------------|---------------|-----|
| 1 | Online | Empty | Official fire visible |
| 2 | Online | 1 pending | Official fire |
| 3 | **Offline** | 1 queued | Official fire |
| 5 | Offline | 1 in transit | Official fire |
| 6 | Offline | 1 delivered (1 path) | Official fire |
| 8 | **Online** | 1 delivered (2 paths) | Official fire + SOS |
| 9 | Online | 1 delivered (3 paths) | Official fire + SOS |

---

## Troubleshooting

### Message not queued

**Check:**
- Console errors
- `dispatcher.getStore().getAll()` returns array
- Message ID is UUID

**Fix:** Refresh page, try again

---

### Transport state not changing

**Check:**
- `window.civicRelay.transports` exists
- Calling `.setSimulatedState()` returns undefined (no errors)

**Fix:** Ensure `pnpm build` completed, dev server restarted

---

### Delivery history empty

**Check:**
- Called `await dispatcher.retryQueued()` (with `await`)
- Transport was available before retry

**Fix:** Set transport state first, then retry

---

## Validation Criteria

### For Recruiters / Reviewers

To verify this prototype works as claimed:

1. ✅ **Multipath routing:** Single message delivered via 3 different transports
2. ✅ **Store-and-forward:** Message queued when offline, sent when transport available
3. ✅ **Deduplication:** Multiple deliveries result in one stored message
4. ✅ **Explainable decisions:** Router logs reasoning for transport selection
5. ✅ **Provenance:** Citizen report clearly labeled UNVERIFIED (not conflated with official)
6. ✅ **Honest boundaries:** Simulated transports logged as "SIMULATED", not claimed as real

---

**Next:** See [ROADMAP.md](./ROADMAP.md) for future development plans.
