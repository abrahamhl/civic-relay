# TRL Assessment and Validation Roadmap — OEP / Civic Relay

**Assessment Framework:** European Commission Horizon Europe Technology Readiness Level (TRL) Scale (TRL 1–9).  
**Current Overall Assessment:** **TRL 3 (Completed) / TRL 4 (In Progress — Laboratory Software Built, Physical 2-Phone Trial Pending)**

---

## 1. Current TRL Breakdown by Component

| Component | Current TRL | Justification & Evidence | Target Next TRL |
|---|---|---|---|
| **Emergency Routing & Topology Model (`emergency-routing.mjs`)** | **TRL 3** (Analytical & experimental proof of concept) | 20–100 node deterministic simulation validated across 810 seeded scenarios (`AUTOMATED_TESTED`, `SIMULATED_ONLY`). | **TRL 4:** Calibrate link weights with physical 2-phone latency/loss distributions. |
| **Store-and-Forward & Receipt Engine (`store-forward.mjs`)** | **TRL 4** (Component validation in laboratory environment) | Bounded queue, dedup, TTL, anti-replay tombstones, and receipt verification tested across 26 unit/adversarial test cases (`AUTOMATED_TESTED`). | **TRL 5:** Persistent SQLite/Room queue on Android surviving process restarts. |
| **Consent, Energy & CAP Trust Policy (`emergency-policy.mjs`)** | **TRL 3–4** | Fail-closed CAP gate and capability/energy state machine verified in CI (`AUTOMATED_TESTED`). | **TRL 5:** Connect X.509 / institutional CAP test feed in a controlled pilot. |
| **Android Nearby 2-Phone Hardware Lab (`experimental/android-nearby/`)** | **TRL 3.5 → 4** (`BUILD_VERIFIED`, `PHYSICAL_TEST_PENDING`) | APK compiles in CI (`assembleDebug`) and JVM protocol tests pass (`NearbyLabProtocolTest`), but physical 2-phone RF execution of the 30-trial matrix is pending. | **TRL 4 Complete:** Publish 30-trial CSV dataset + independent observer sign-off. |

---

## 2. Milestone-Driven Validation Roadmap (M0 → M4)

| Milestone | Target TRL | Timeline | Key Deliverables | Acceptance Criteria (Exit Gate) |
|---|---|---|---|---|
| **M0 — Reproducible Simulation & Evidence Baseline** | **TRL 3** | **Completed (Oct 2026)** | Deterministic 20–100 node simulator, store-and-forward engine, 810-sweep CI, multilingual web lab, Buyer Arena 8-persona audit. | 55/55 unit tests pass; 810 scenarios with 0 invariant violations; 78/78 Buyer Arena checks green. |
| **M1 — Two-Phone Physical Offline Lab Validation** | **TRL 4** | **Months 1–2** | Execute `experimental/android-nearby/PILOT_ACCEPTANCE.md` across two physical Android handsets in Airplane Mode. | $\ge 30$ documented trials across Scenarios A–E; 0 false ACKs; published raw CSV (`field_trials.csv`). |
| **M2 — Multi-Hop Store-and-Forward & Cryptographic Receipts** | **TRL 5** | **Months 3–6** | 3-to-5 device store-and-forward chain (Node A $\rightarrow$ Relay B $\rightarrow$ Gateway C) with Ed25519 signed receipts, SQLite persistence, and CAP X.509 sandbox verifier. | Measured multi-hop delivery rate, battery mAh profile, and zero replay/forgery acceptance under red-team test. |
| **M3 — Controlled Civil-Protection Tabletop & Field Pilot** | **TRL 6** | **Months 7–12** | Co-designed exercise with a municipal safety region (*Veiligheidsregio* / *Protección Civil*) and academic lab (15–30 volunteer handsets, non-emergency drill). | Independent observer report, DPIA sign-off, usability evaluation with first-responder coordinators. |
| **M4 — Pre-Operational Standards & Gateway Interoperability** | **TRL 7** | **Months 13–18** | Interoperability adapters for external edge gateways (municipal Wi-Fi / LoRa / authorized NTN testbed) and public warning test feeds. | End-to-end demonstration in an operational training environment without touching live 112 production traffic. |
