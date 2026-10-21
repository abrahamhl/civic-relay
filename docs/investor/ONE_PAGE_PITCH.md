# One-Page Pitch — OEP (Offline Emergency Protocol) / Civic Relay

> **When an earthquake or blackout takes cellular towers offline, a citizen's message should not vanish—and silence must never be mistaken for a casualty.**

---

### The Problem
During severe infrastructure disruptions, mobile networks saturate or fail. Existing solutions leave a critical gap:
- **Satellite SOS** requires modern hardware and clear sky line-of-sight (often blocked indoors or in collapsed structures).
- **Cell Broadcast (EU-Alert / NL-Alert / ES-Alert)** is one-way (authority to citizen) with no return status channel.
- **Ad-hoc mesh chat apps** lack formal triage semantics, bounded store-and-forward safety, and explicit delivery receipts—creating dangerous confusion between *"packet sent"* and *"person rescued."*

### The Solution: OEP — Offline Emergency Protocol
**OEP** is an open-source (MIT) **Distributed Emergency Coordination & Adaptive Multi-Network Routing** research layer. Instead of building proprietary hardware or replacing telecom operators, OEP coordinates existing device capabilities where users and operating systems explicitly permit:
$$\text{EMERGENCY EVENT} \rightarrow \text{ZONE} \rightarrow \text{HUMAN STATUS} \rightarrow \text{CONSENT} \rightarrow \text{MESSAGE} \rightarrow \text{NETWORK PATH} \rightarrow \text{ACK} \rightarrow \text{EVIDENCE}$$

### What Is Verified Today (TRL 3–4 Research MVP)
- **Deterministic 20–100 Node Simulator (`AUTOMATED_TESTED`):** Models participation, OS permissions, battery conservation, cellular outage, and local gateway routing across **810 seeded scenarios with 0 safety-invariant violations**.
- **Executable Store-and-Forward Engine (`AUTOMATED_TESTED`):** Enforces explicit consent, TTL expiration, deduplication, anti-replay tombstones, and strict separation between `QUEUED`, `FORWARDED_UNCONFIRMED`, and `ACK_SYNTHETIC`.
- **Human Safety Epistemology (`AUTOMATED_TESTED`):** Explicitly separates volunteered `SAFE` and `SOS_EXPLICIT` from `UNKNOWN` / `NO_CONTACT` (silence never infers injury).
- **Compiled Experimental Android Nearby Lab (`BUILD_VERIFIED`):** 2-phone offline laboratory APK (`com.google.android.gms:play-services-nearby`) with consent gate, Nearby authentication digits verification, UUID + per-message random challenge ACK guard, dual-clock TTL, and CSV trial export.
- **Automated 8-Stakeholder Browser Validation (`BROWSER_TESTED`):** Verified via **Buyer Arena** across 8 synthetic personas (`P01`–`P08`, 78/78 Chromium checks passing across EN / ES / NL).

### What We Do NOT Claim (`PHYSICAL_TEST_PENDING`)
OEP is **not** a live emergency service, **not** connected to 112, **not** a satellite operator, and **has not yet completed physical two-phone RF field trials**. Our 30-trial physical validation protocol (`experimental/android-nearby/PILOT_ACCEPTANCE.md`) is ready for immediate execution.

### The Ask
We are seeking **€50k–€180k in non-dilutive R&D funding (NLnet (OIS), RVO MIT/WBSO)** and **civil-protection / academic pilot partners** (Horizon Europe Cluster 3 `HORIZON-CL3-2026-01-SSRI-04`) to execute Milestone M1 (30-trial physical handset benchmark) and Milestone M2 (multi-hop persistent store-and-forward with cryptographic receipts).

- **Live Multilingual Web Lab (EN / ES / NL):** `https://civic-relay-investor.vercel.app`
- **Primary Repository:** `https://github.com/abrahamhl/civic-relay`
- **Automated Validation Repository:** `https://github.com/abrahamhl/buyer-arena`
