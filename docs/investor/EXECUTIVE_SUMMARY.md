# Executive Summary — OEP (Offline Emergency Protocol) / Civic Relay

**Technical Positioning:** Distributed Emergency Coordination & Adaptive Multi-Network Routing  
**Project Status:** Open-Source Research MVP (TRL 3–4; `IMPLEMENTED`, `AUTOMATED_TESTED`, `BROWSER_TESTED`, `PHYSICAL_TEST_PENDING`)  
**Repository:** `https://github.com/abrahamhl/civic-relay`  
**Live Investor & Research Platform:** `https://civic-relay-investor.vercel.app` (EN / ES / NL)

---

## 1. The Crisis Coordination Gap

When earthquakes, severe floods, or cascading power blackouts disrupt cellular base stations and backhaul links, conventional emergency apps fail silently. Meanwhile:
1. **Citizens have no structured way to record explicit status (`SAFE` vs `SOS_EXPLICIT`)** that survives temporary network loss without draining their battery in futile reconnect loops.
2. **Silence is dangerous when misinterpreted:** Unanswered pings (`UNKNOWN` / `NO_CONTACT`) must never be conflated with confirmed casualties or false rescue confirmations.
3. **Devices around the incident still possess local capabilities** (Bluetooth/BLE, Wi-Fi/Nearby, intermittent edge gateways), yet no open, consent-first software coordination layer exists to queue, prioritize, route, and explicitly acknowledge messages across whatever permitted transport becomes available.

---

## 2. What OEP / Civic Relay Is (and What It Is Not)

**OEP is an opt-in, transport-agnostic software coordination and research layer** that models and tests the end-to-end decision chain:
$$\text{EMERGENCY EVENT} \rightarrow \text{ZONE} \rightarrow \text{HUMAN STATUS} \rightarrow \text{CONSENT} \rightarrow \text{MESSAGE} \rightarrow \text{NETWORK PATH} \rightarrow \text{ACK} \rightarrow \text{EVIDENCE}$$

- **What OEP IS today:**
  - **Deterministic 20–100 Node Emergency Routing Simulator (`investor-next/lib/emergency-routing.mjs`):** Seeded, reproducible topology engine modeling participation rates, OS permissions, battery conservation policies, cellular outage percentages, and adaptive local gateway fallback vs. cellular-only baselines (`AUTOMATED_TESTED`, 810-scenario sweep with 0 invariant violations).
  - **Bounded Store-and-Forward Coordinator (`investor-next/lib/store-forward.mjs`):** Executable queue engine enforcing explicit user consent, TTL expiration, deduplication, tombstone replay prevention, exponential retry backoff, energy-aware holds, and strict separation between `FORWARDED_UNCONFIRMED` and `ACK_SYNTHETIC` (`AUTOMATED_TESTED`).
  - **Capability, Consent & CAP Trust Boundary Policy (`investor-next/lib/emergency-policy.mjs`):** Fail-closed Common Alerting Protocol (CAP) evaluation gate, explicit human status semantics (`UNKNOWN !== INJURED`), and battery scan-window throttling (`AUTOMATED_TESTED`).
  - **Experimental Two-Phone Android Nearby Lab (`experimental/android-nearby/`):** Compiled Android APK (`BUILD_VERIFIED`) using Google Play Services Nearby Connections (`P2P_POINT_TO_POINT`) with explicit consent, manual verification of Nearby authentication digits, UUID + per-message random challenge ACK guard (`LabDeliveryGuard.java`), dual-clock TTL watchdog, and local CSV trial export (`PHYSICAL_TEST_PENDING`).
  - **Automated Multi-Stakeholder Validation (`abrahamhl/buyer-arena`):** 8 synthetic stakeholder personas (`P01`–`P08`) executing 78 real headless Chromium checks across `/`, `/es/`, and `/nl/` (`BROWSER_TESTED`).

- **What OEP is NOT:**
  - Not a proprietary satellite constellation or telecom operator replacement.
  - Not a live 112 / PSAP emergency dispatch service.
  - Not a zero-click background radio override or indoor triangulation tool.

---

## 3. Investment & Grant Readiness

OEP is structured for European public research grants (**Horizon Europe Cluster 3**, **NLnet (OIS)**, **Dutch RVO WBSO / MIT**) and institutional pilot partnerships with civil-protection agencies, universities, and telecom resilience labs. The immediate next milestone (**M1**) is executing the documented 30-trial physical two-handset Android validation protocol (`experimental/android-nearby/PILOT_ACCEPTANCE.md`).
