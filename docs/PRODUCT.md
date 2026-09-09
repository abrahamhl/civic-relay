# Product Vision – Civic Relay

## Problem Statement

During disasters (wildfires, earthquakes, floods), communication infrastructure fails:

- Cell towers overloaded or offline
- Power outages
- Internet backbones severed
- Emergency services overwhelmed

**Current gap:** Citizens have no resilient way to report status or coordinate when infrastructure degrades.

---

## Solution

**Civic Relay** is an offline-first crisis communication platform that:

1. **Works offline** – Messages queue locally until any authorized transport becomes available
2. **Adapts to available networks** – Automatically routes through IP, mesh, cellular, or (future) satellite
3. **Preserves provenance** – Clear labeling of unverified citizen reports vs. official data
4. **Coordinates response** – Incident dashboard aggregates reports for coordinators/responders

---

## Target Users

### Primary

- **Citizen** – Reports status, requests help, shares observations
- **Community Coordinator** – Aggregates local reports, identifies patterns
- **Responder** – Views incident map, prioritizes actions
- **Incident Commander** – Oversees multi-incident operations

### Secondary

- Emergency Management Agencies
- NGOs (Red Cross, etc.)
- Neighborhood associations
- Wildfire-prone communities

---

## Core User Flows

### Citizen: "I Need Help"

1. Open app (works offline)
2. Tap **"I Need Help"** button
3. Message queued locally
4. When any transport available, message sent
5. Delivery status visible in queue
6. Help coordinated through incident dashboard

**Key requirement:** Must work with **zero cognitive load** during emergency.

### Coordinator: Monitor Incidents

1. Open dashboard
2. View map with all reported incidents
3. See verification state (official / corroborated / unverified)
4. Filter by type (fire, medical, missing person)
5. Coordinate response efforts

**Key requirement:** **Never conflate** unverified citizen reports with official data.

---

## Message Types

- **SAFE** – "I'm okay" check-ins
- **SOS** – Critical help needed
- **MEDICAL** – Injury or medical emergency
- **FIRE** – Fire sighting
- **MISSING_PERSON** – Someone unaccounted for
- **INFRASTRUCTURE** – Damage to roads, utilities, etc.
- **ROAD_BLOCKED** – Impassable route
- **RESOURCE_REQUEST** – Need water, food, shelter
- **GENERAL_REPORT** – Situational observation

---

## Product Principles

### 1. Offline-First

App must be **fully functional offline**. No "check back when online" screens.

### 2. Honest Provenance

**Never upgrade unverified → confirmed automatically.**

Clear visual distinction:
- 🟢 Official (government source)
- 🔵 Corroborated (multiple independent reports)
- 🟡 Unverified (single citizen report)
- 🔴 Disputed (conflicting information)

### 3. Low Energy

Designed for **24+ hour operation** on phone battery:
- Store-and-forward (not constant polling)
- Minimal network activity
- Reduced animations in low-power mode

### 4. Multipath Resilience

Critical messages sent through **multiple transports** simultaneously.

If one path fails, others succeed.

### 5. Zero Setup

No account creation during emergency.

Device ID + location = minimum viable identity.

---

## Transport Strategy

### V0.1 (Current)

- **IP Transport** – Standard internet (when available)
- **Simulated Mesh** – Deterministic fixture (not real Bluetooth)
- **Simulated Cellular** – State control for demo

### V1.0 (Planned)

- **Bluetooth Mesh** – Local peer-to-peer (Android/iOS APIs)
- **LoRa** – Long-range low-power radio (external hardware)
- **Satellite Gateway** – Authorized provider integration (Starlink, Iridium)

### Authorization Boundary

**Never transmit on unauthorized frequencies.**

Satellite/radio requires:
1. Approved hardware
2. Authorized provider account
3. Legal frequency allocation

---

## Non-Goals (V0.1)

- ❌ Real RF transmission
- ❌ Custom encryption (use platform crypto)
- ❌ Claims of 100% availability
- ❌ Replacement for 911/emergency services
- ❌ Social media features
- ❌ Revenue model (focus on product-market fit first)

---

## Success Metrics (Future)

### Adoption

- Downloads in fire-prone regions
- Active users during disaster events

### Reliability

- Message delivery rate (queued → delivered)
- Time to delivery
- Battery consumption per hour

### Impact

- Successful rescues coordinated
- False reports corrected
- Response time improvement vs. baseline

---

## Competitive Landscape

### Existing Solutions

- **Zello** – Push-to-talk (requires internet)
- **FireChat** – Mesh network (discontinued, iOS only)
- **Google Crisis Map** – Read-only, no citizen input
- **Citizen** – Crowdsourced alerts (requires constant connectivity)

### Our Differentiation

1. **True offline-first** – Queue persists, not "retry later"
2. **Multipath routing** – Automatic failover
3. **Provenance transparency** – Unverified clearly labeled
4. **Energy optimized** – Multi-day battery design

---

## Roadmap

### V0.1 (Current)

- Core architecture
- Simulated transports
- Basic UI
- Demo scenario

### V0.2

- Real data integration (NASA FIRMS)
- PWA installability
- E2E tests

### V1.0

- Production backend
- Real Bluetooth mesh
- Battery benchmarks
- Public beta

### V2.0

- Satellite gateway integration
- Multi-language support
- Accessibility audit
- NGO partnerships

---

## Open Questions

1. **Identity model** – How to prevent spam without requiring sign-up?
2. **Data retention** – How long to keep citizen reports?
3. **Moderation** – Who can mark reports as disputed?
4. **Revenue** – Freemium? Government contracts? NGO partnerships?
5. **Regulations** – FCC compliance for any future RF transmission?

---

## Principles for Future Development

- **Test in real conditions** – Field test in connectivity-degraded environments
- **Partner with emergency services** – Validate workflows with actual responders
- **Open protocols** – Interoperate with existing emergency systems
- **Accessibility** – Usable by elderly, disabled, non-technical users
- **Privacy** – Minimize data collection, maximize user control

---

**Next:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical implementation.
