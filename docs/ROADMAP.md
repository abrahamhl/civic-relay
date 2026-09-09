# Roadmap – Civic Relay

## Vision

Build a **production-ready** crisis communication platform that:
- Works in degraded connectivity
- Preserves information provenance
- Scales to millions of users
- Complies with regulations

**Timeframe:** 18-24 months from V0.1 to V1.0 public beta

---

## Version History

### V0.1 (Current) – Prototype ✅

**Status:** COMPLETED

**Goals:**
- Demonstrate core architecture
- Validate multipath routing concept
- Show honest engineering practices

**Deliverables:**
- ✅ TypeScript monorepo (pnpm)
- ✅ Message envelope + transport abstraction
- ✅ Router with explainable decisions
- ✅ Store-and-forward queue
- ✅ Deduplication logic
- ✅ Mobile-first React UI
- ✅ Simulated transports (mesh, cellular)
- ✅ Wildfire demo scenario
- ✅ Basic tests (deduplication, routing)
- ✅ Complete documentation

**NOT in V0.1:**
- No real RF transmission
- No backend server
- No data persistence (in-memory only)
- No external data sources

---

## V0.2 – Data Integration 🔄

**Target:** +2 months

**Focus:** Real-world data sources

**Goals:**
- Integrate NASA FIRMS (wildfire detection)
- Add IndexedDB persistence
- Implement corroboration logic

**Features:**

1. **NASA FIRMS Integration**
   - Fetch fire hotspots every 3 hours
   - Display as OFFICIAL incidents on map
   - Filter by confidence level

2. **IndexedDB Storage**
   - Messages survive page reload
   - 7-day retention policy
   - Export to JSON

3. **Corroboration Logic**
   - Cluster messages by location (500m radius)
   - Upgrade to CORROBORATED if ≥3 independent reports
   - UI shows corroboration count

4. **PWA Manifest**
   - Install on home screen
   - Offline-first service worker
   - App icons

**Tests:**
- NASA FIRMS mock data
- Corroboration algorithm
- IndexedDB persistence

**Docs:**
- Update DATA_SOURCES.md with FIRMS details
- Add PWA install instructions

---

## V0.5 – Backend Foundation 🔄

**Target:** +4 months

**Focus:** Production infrastructure

**Goals:**
- Deploy backend API
- Real message delivery (HTTP POST)
- WebSocket for live updates

**Architecture:**

```
Client (PWA)
  ↓
API Gateway (AWS API Gateway / Cloudflare Workers)
  ↓
Message Broker (RabbitMQ / Redis Pub/Sub)
  ↓
Worker Pool (Node.js, same core packages)
  ↓
PostgreSQL + PostGIS (messages, incidents, locations)
  ↓
WebSocket (Socket.io / SSE for real-time)
```

**Features:**

1. **Message API**
   - `POST /api/messages` – Submit message
   - `GET /api/messages/:id` – Fetch one message
   - `GET /api/incidents` – List incidents (GeoJSON)

2. **Real-time Updates**
   - WebSocket connection
   - Push new incidents to coordinators
   - Battery-efficient (long polling fallback)

3. **Authentication (Optional)**
   - Anonymous mode (device ID only)
   - OR optional account (email + password)
   - JWT tokens

4. **Rate Limiting**
   - 10 messages/minute per device
   - Prevent spam

**Deployment:**
- AWS/GCP (t3.small + RDS)
- Docker containers
- CI/CD (GitHub Actions)

**Tests:**
- API integration tests
- Load testing (1000 concurrent users)
- WebSocket connection stability

---

## V0.8 – Real Transports 🔄

**Target:** +8 months

**Focus:** Bluetooth Mesh implementation

**Goals:**
- Replace simulated mesh with real Bluetooth
- Test in field conditions
- Battery optimization

**Features:**

1. **Web Bluetooth Integration**
   - Use Web Bluetooth API (Chrome/Edge)
   - Peer discovery (scan for nearby devices)
   - Message forwarding (up to 7 direct peers)

2. **Android/iOS Apps**
   - React Native OR native (Swift/Kotlin)
   - Background BLE scanning
   - Battery optimization (adaptive scanning intervals)

3. **Mesh Routing Algorithm**
   - Flooding (broadcast to all peers)
   - OR gossip protocol (probabilistic forwarding)
   - Duplicate detection (message IDs)

4. **Field Testing**
   - Test in connectivity-degraded areas
   - Measure:
     - Message delivery rate
     - Time to delivery
     - Battery drain per hour

**Tests:**
- Bluetooth pairing/discovery
- Multi-hop forwarding (3+ hops)
- Battery benchmarks (24h test)

**Docs:**
- Update TRANSPORT_BOUNDARIES.md with FCC compliance
- Add field test results

---

## V1.0 – Public Beta 🎯

**Target:** +12 months

**Focus:** Production-ready launch

**Goals:**
- Security audit passed
- Regulatory compliance
- Public beta in fire-prone regions

**Features:**

1. **Security Hardening**
   - E2E encryption (libsodium.js)
   - Message signatures (Ed25519)
   - TLS 1.3 for all HTTP
   - Penetration testing

2. **Multi-Source Incidents**
   - NASA FIRMS (wildfire)
   - USGS (earthquakes)
   - NWS weather alerts
   - Copernicus EMS (floods)

3. **User Roles**
   - Citizen (default)
   - Coordinator (verified account)
   - Responder (government-issued credentials)
   - Incident Commander (admin)

4. **Mobile Apps**
   - iOS App Store
   - Google Play Store
   - Cross-platform sync (same incident history)

5. **Accessibility**
   - WCAG 2.1 AA compliance
   - Screen reader support
   - High contrast mode
   - Large text mode

**Launch Plan:**

1. **Private Beta** – 100 users, fire-prone areas (California, Australia)
2. **Bug fixes** – 2 weeks
3. **Public Beta** – Announce on ProductHunt, HackerNews
4. **Monitor** – Crash reports, user feedback
5. **Iterate** – Weekly releases

**Tests:**
- Security audit (third-party firm)
- Accessibility audit
- Load testing (100k concurrent users)
- Multi-region deployment

**Docs:**
- Privacy policy (GDPR/CCPA)
- Terms of service
- User guide (multiple languages)

---

## V1.5 – LoRa Integration 🚀

**Target:** +16 months

**Focus:** Long-range mesh (2-10 km)

**Goals:**
- Support LoRa HAT (Raspberry Pi)
- Rural/wilderness deployments
- Gateway nodes

**Features:**

1. **LoRa Gateway**
   - Raspberry Pi + LoRa HAT
   - Solar-powered (battery backup)
   - Community-run (volunteer hosts)

2. **LoRa Client**
   - Mobile phone + USB LoRa adapter
   - OR dedicated LoRa device (Meshtastic-compatible)

3. **Hybrid Routing**
   - Bluetooth (short range, high bandwidth)
   - LoRa (long range, low bandwidth)
   - IP (when available)

**Deployment:**
- Partner with NGOs (Red Cross)
- Deploy gateways in fire lookout towers
- Community adoption (ham radio clubs)

**Tests:**
- Range testing (line of sight)
- Multi-hop LoRa (3+ hops)
- Duty cycle compliance (EU 1%)

---

## V2.0 – Satellite Gateway 🚀

**Target:** +20 months

**Focus:** Global coverage via satellite

**Goals:**
- Integrate with Starlink/Iridium
- Emergency bundles (disaster relief)
- Subscription model

**Features:**

1. **Satellite Gateway**
   - User has Starlink terminal OR Iridium modem
   - App detects gateway (serial/Bluetooth)
   - Automatic failover (IP → LoRa → Satellite)

2. **Message Compression**
   - Satellite bandwidth expensive
   - Compress payloads (gzip, protobuf)
   - Prioritize CRITICAL messages

3. **Subscription Tiers**
   - **Free:** IP + Bluetooth (always free)
   - **Pro ($5/month):** LoRa gateway access
   - **Emergency ($50/month):** Satellite uplink credits

**Partnerships:**
- Starlink (SpaceX)
- Iridium
- NGOs (subsidized emergency plans)

---

## V3.0 – Government Integration 🏛️

**Target:** +24 months

**Focus:** Interoperability with official systems

**Goals:**
- Feed citizen reports into FEMA/AEMET systems
- Official responders use Civic Relay
- CAP (Common Alerting Protocol) support

**Features:**

1. **CAP Integration**
   - Receive official alerts (FEMA IPAWS)
   - Display on map
   - Push notifications

2. **Responder Dashboard**
   - GIS tools (draw perimeters, routes)
   - Resource tracking (ambulances, shelters)
   - Dispatch coordination

3. **API for Agencies**
   - Government can query citizen reports
   - Export to ESRI ArcGIS, QGIS
   - Compliance with public records laws

**Partnerships:**
- FEMA (US)
- AEMET (Spain)
- Red Cross (global)

---

## Research Tracks (Ongoing)

### 1. Battery Optimization

**Goal:** 48+ hour operation on single charge

**Approaches:**
- Adaptive scanning intervals (BLE)
- Message batching (reduce transmissions)
- Low-power mode (grayscale UI, reduced polling)

**Tests:** 48h field test (real disaster scenario)

---

### 2. Privacy-Preserving Location

**Goal:** Share incidents without exact location

**Approaches:**
- Differential privacy (add random noise)
- Geohashing (share grid cell, not point)
- Homomorphic encryption (compute on encrypted data)

**Challenge:** Coordinator needs location to dispatch help

---

### 3. AI-Powered Corroboration

**Goal:** Detect false reports automatically

**Approaches:**
- Image recognition (fire photos)
- NLP (analyze message text)
- Anomaly detection (spam patterns)

**Risk:** False negatives (miss real emergencies)

---

### 4. Decentralized Identity

**Goal:** No central authentication server

**Approaches:**
- DID (Decentralized Identifiers)
- Self-sovereign identity (user controls keys)
- Web of trust (peers vouch for each other)

**Challenge:** Onboarding complexity

---

## Open Questions

1. **Revenue model:** Freemium? Government contracts? Donations?
2. **Liability:** If wrong info leads to harm, who is responsible?
3. **Moderation:** How to prevent abuse at scale?
4. **Localization:** Which languages to support first?
5. **Hardware:** Should we build dedicated LoRa devices?

---

## Success Metrics

### V1.0 Launch Targets

| Metric | Target |
|--------|--------|
| Beta sign-ups | 10,000 |
| Active users (30-day) | 1,000 |
| Messages sent | 50,000 |
| Delivery rate | > 95% |
| App rating | > 4.5/5 |
| Crash rate | < 0.5% |

### V2.0 Maturity Targets

| Metric | Target |
|--------|--------|
| Total users | 100,000 |
| Government partnerships | 3 |
| NGO deployments | 10 |
| Incidents coordinated | 500 |
| Lives saved | 10+ (anecdotal) |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low adoption | HIGH | Partner with NGOs, free tier |
| Regulatory block | HIGH | Legal review before launch |
| Spam/abuse | MEDIUM | Rate limiting, reputation |
| Battery drain | MEDIUM | Optimization, low-power mode |
| False reports | MEDIUM | Corroboration, moderation tools |
| Satellite cost | LOW | Freemium model, subsidies |

---

## How to Contribute (Future)

When open-sourced:

1. **Code:** Submit PRs (see CONTRIBUTING.md)
2. **Testing:** Field test in your area
3. **Docs:** Translate to other languages
4. **Hardware:** Build LoRa gateways
5. **Funding:** Sponsor development (GitHub Sponsors)

---

**This is a living document.** Updated quarterly based on progress.

**Last updated:** 2026-09-09
