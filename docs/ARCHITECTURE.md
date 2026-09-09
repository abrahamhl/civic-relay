# Architecture – Civic Relay V0.1

## Overview

Civic Relay is built as a **monorepo** with clear separation of concerns:

```
packages/
  schemas/       # Pure data definitions (Zod)
  transports/    # Transport layer abstractions
  core/          # Business logic (routing, store, dispatch)

apps/
  web/           # React UI
```

**Dependency flow:** `core` → `transports` → `schemas` (no cycles)

---

## Core Abstractions

### 1. Message Envelope

**File:** `packages/schemas/src/message.ts`

The **universal container** for all communications.

```typescript
interface MessageEnvelope {
  id: string;              // UUID (stable across all paths)
  incidentId: string | null;
  createdAt: string;       // ISO 8601
  priority: Priority;      // CRITICAL | HIGH | MEDIUM | LOW
  origin: string;          // userId or deviceId
  payloadType: MessageType;
  payload: Record<unknown>;
  approximateLocation: Location | null;
  ttl: number;             // seconds
  verificationState: VerificationState;
  deliveryHistory: DeliveryAttempt[];
}
```

**Key properties:**

- `id` is **stable** – same message via 3 paths = same ID
- `deliveryHistory` grows as message traverses paths
- `verificationState` starts UNVERIFIED, can be upgraded by coordinator

---

### 2. Transport Interface

**File:** `packages/transports/src/base.ts`

All transports implement `ITransport`:

```typescript
interface ITransport {
  readonly id: string;
  readonly type: TransportType;

  getCapabilities(): Promise<TransportCapability>;
  send(message: MessageEnvelope): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}
```

**Capability report:**

```typescript
interface TransportCapability {
  transportId: string;
  transportType: 'IP' | 'LOCAL_MESH' | 'CELLULAR' | ...;
  available: boolean;
  estimatedReliability: number;  // 0.0–1.0
  latency: number;               // ms
  energyCost: 'VERY_LOW' | ... | 'VERY_HIGH';
  monetaryCost: 'FREE' | ... | 'VERY_HIGH';
  bandwidth: number;             // bytes/sec
  lastSeen: string;              // ISO 8601
}
```

**Design rationale:**

- Router makes **data-driven decisions** based on capabilities
- Easy to add new transports (satellite, LoRa, etc.)
- Each transport reports its own state

---

### 3. Router

**File:** `packages/core/src/router.ts`

Ranks transports and returns **explainable decisions**.

**Algorithm:**

1. **Filter** to available transports only
2. **Score** each transport:
   - Reliability × 1000 (primary factor)
   - Subtract latency penalty (if high priority)
   - Subtract energy cost penalty
   - Subtract monetary cost penalty
3. **Sort** by score (descending)
4. **Select** top N (based on message priority)

**Multipath selection:**

| Priority   | Transports |
|------------|------------|
| CRITICAL   | 3          |
| HIGH       | 2          |
| MEDIUM     | 1          |
| LOW        | 1          |

**Output:**

```typescript
interface RoutingDecision {
  messageId: string;
  selectedTransports: string[];  // transportIds
  explanation: string;           // Human-readable reasoning
  decidedAt: string;
}
```

---

### 4. Message Store

**File:** `packages/core/src/store.ts`

Local queue with store-and-forward logic.

**Methods:**

- `enqueue(message)` – Add to local store
- `getQueued()` – Messages not yet delivered
- `getAll()` – Full history
- `recordDeliveryAttempt()` – Update delivery history
- `isDelivered()` – Check if at least one path succeeded
- `cleanupExpired()` – Remove messages past TTL

**Storage:**

V0.1: In-memory Map  
Future: IndexedDB (persistent across page reloads)

---

### 5. Dispatcher

**File:** `packages/core/src/dispatcher.ts`

Orchestrates routing and delivery.

**Flow:**

```
User creates message
  ↓
Dispatcher.dispatch()
  ↓
Store.enqueue() — Always store locally first
  ↓
Router.route() — Select transports
  ↓
Parallel send through selected transports
  ↓
Store.recordDeliveryAttempt() — Log each attempt
```

**Periodic retry:**

Every 10 seconds, dispatcher calls `retryQueued()`:
- Get all queued messages
- Attempt delivery through currently available transports
- Stop retrying once delivered OR TTL expired

---

### 6. Deduplicator

**File:** `packages/core/src/deduplication.ts`

Ensures same message via multiple paths = one logical message.

**Algorithm:**

1. Check if message ID already seen
2. If new: store and return `{ isDuplicate: false }`
3. If duplicate:
   - **Merge** delivery history
   - Return canonical message
   - Count unique transport paths

**Example:**

Message `msg-001` arrives via:
1. Mesh → Store
2. IP → Merge delivery history (same msg-001)
3. Cellular → Merge again

Result: **One message** with 3 delivery attempts in history.

---

## Data Flow

### Happy Path (Online)

```
Citizen taps "SOS"
  ↓
App creates MessageEnvelope
  ↓
Dispatcher.dispatch()
  ↓
Router selects [IP, Cellular] (multipath)
  ↓
Both transports send successfully
  ↓
Delivery history: 2 attempts, both DELIVERED
  ↓
Dashboard receives message
  ↓
Coordinator sees incident on map
```

### Degraded Path (Offline)

```
Citizen taps "SOS"
  ↓
Dispatcher.dispatch()
  ↓
Router finds no available transports
  ↓
Message queued locally (status: QUEUED)
  ↓
User sees "⏳ Queued" in message list
  ↓
[Time passes, mesh network appears]
  ↓
Periodic retry triggers
  ↓
Router selects [LocalMesh]
  ↓
Message forwarded to peers
  ↓
[One peer reaches gateway with IP]
  ↓
Message reaches dashboard
  ↓
User sees "✓ Delivered via 1 path"
```

### Multipath Convergence

```
Message created with priority: CRITICAL
  ↓
Router selects [IP, LocalMesh, Cellular]
  ↓
All 3 transports send in parallel
  ↓
Dashboard receives 3 copies
  ↓
Deduplicator detects same ID
  ↓
Stores 1 message with 3 delivery attempts
  ↓
UI shows: "Delivered via 3 paths"
```

---

## UI Architecture

**Framework:** React 18 + TypeScript + Vite

**Components:**

```
App
├── Header (role toggle: Citizen | Coordinator)
├── TransportStatus (online/offline indicator)
├── EmergencyButtons (if role = Citizen)
│   ├── I'm Safe
│   ├── I Need Help (SOS)
│   ├── Medical
│   ├── Fire
│   ├── Infrastructure
│   └── General Report
├── MessageQueue (if role = Citizen)
│   └── MessageCard[] (type, priority, status, delivery history)
└── IncidentMap (if role = Coordinator)
    └── Leaflet map with markers
```

**State management:**

- Global dispatcher instance (singleton)
- Polling every 1 second for message updates
- Direct access to `dispatcher.getStore().getAll()`

No Redux/Zustand in V0.1 (keep it simple).

---

## Build System

**Tool:** pnpm + workspaces

**Commands:**

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (schemas → transports → core)
pnpm dev              # Start Vite dev server (apps/web)
pnpm test             # Run tests (when configured)
```

**TypeScript project references:**

Each package has `tsconfig.json` with `references` to dependencies.

Enables **incremental builds**.

---

## Testing Strategy

### Unit Tests

**Tool:** Jest (to be configured)

**Coverage:**

- `Deduplicator` – Merge logic, path counting
- `Router` – Scoring, multipath selection
- `MessageStore` – Queuing, TTL cleanup

### Integration Tests

**Tool:** Playwright (future)

**Scenarios:**

- Submit message while online
- Submit message while offline, go online later
- Multipath delivery with 3 transports

### Demo Scenario

**File:** `fixtures/demo-runner.html`

Interactive 12-step walkthrough of acceptance test.

Validates end-to-end flow with simulated transports.

---

## Security Considerations

**See:** [THREAT_MODEL.md](./THREAT_MODEL.md)

**V0.1 security posture:**

- ✅ No custom crypto (use platform APIs when needed)
- ✅ Input validation (Zod schemas)
- ✅ TTL prevents infinite storage
- ✅ Provenance tracking (origin + verification state)
- ⚠️ No authentication (future: device identity)
- ⚠️ No encryption (future: E2E for sensitive messages)
- ⚠️ No spam prevention (future: rate limits)

---

## Deployment Architecture (Future)

### V0.1 (Current)

- Static hosting (Netlify / Vercel)
- All processing client-side
- No backend required

### V1.0 (Planned)

```
Client (PWA)
  ↓
API Gateway (AWS / GCP)
  ↓
Message Broker (RabbitMQ / Kafka)
  ↓
Worker Pool (Node.js)
  ↓
Database (PostgreSQL + PostGIS)
  ↓
Real-time (WebSocket / SSE)
```

**Scaling strategy:**

- Horizontal scaling of workers
- Geo-distributed read replicas
- CDN for static assets
- Rate limiting per device ID

---

## Performance Targets (Future)

| Metric | Target |
|--------|--------|
| Message submit → queued | < 100ms |
| Message queued → sent (when online) | < 2s |
| Battery drain (24h active) | < 30% |
| App bundle size | < 500KB |
| Time to interactive | < 3s |

---

## Monitoring (Future)

**Metrics to track:**

- Messages queued vs. delivered (delivery rate)
- Time in queue (store-and-forward latency)
- Transport availability over time
- Message type distribution
- Battery consumption per hour
- Crash rate

**Alerting:**

- Delivery rate < 80%
- Queue size > 1000 messages
- Crash rate > 1%

---

## Design Trade-offs

### Why Polling Instead of WebSocket?

V0.1 uses 1-second polling to update UI.

**Pros:**
- Simple to implement
- No server required
- Works offline (no connection errors)

**Cons:**
- Battery drain
- Not real-time

**Future:** WebSocket for live updates when online.

---

### Why Simulate Transports?

LocalMesh and Cellular are **simulated** in V0.1.

**Rationale:**

1. **Honest boundaries** – Don't claim real RF transmission
2. **Deterministic demo** – Acceptance test is reproducible
3. **Platform APIs not ready** – Bluetooth Mesh APIs vary by OS
4. **Recruiter can verify** – No specialized hardware needed

**Future:** Real Bluetooth Mesh (Android/iOS APIs) in V1.0.

---

### Why No Backend?

V0.1 is **fully client-side**.

**Pros:**
- Fast iteration
- No server costs
- True offline-first (nothing to sync)

**Cons:**
- No cross-device message history
- No incident aggregation
- Simulated delivery (logs instead of HTTP)

**Future:** Backend for real delivery + incident coordination.

---

## Next Technical Milestones

1. **IndexedDB persistence** – Survive page reload
2. **Service Worker** – Offline PWA install
3. **Real data ingestion** – NASA FIRMS API
4. **WebSocket server** – Live incident updates
5. **Bluetooth Mesh** – Real peer-to-peer
6. **Battery profiling** – Measure actual drain

---

**See also:**

- [THREAT_MODEL.md](./THREAT_MODEL.md) – Security analysis
- [DATA_SOURCES.md](./DATA_SOURCES.md) – External data integration
- [TRANSPORT_BOUNDARIES.md](./TRANSPORT_BOUNDARIES.md) – Legal/authorization limits
