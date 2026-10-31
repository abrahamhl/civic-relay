# Differentiation & Ecosystem Positioning — OEP / Civic Relay

**Core Thesis:** OEP does not compete with satellite constellations, cellular operators, or public warning authorities. Instead, it provides the **missing open-source, consent-first software coordination and verification layer** that sits between human status check-ins and heterogeneous transport adapters.

---

## 1. Comparative Landscape

| Dimension | Direct-to-Device Satellite SOS (e.g., Apple / Android Satellite SOS) | Consumer Offline Mesh Chat Apps (e.g., Bridgefy, Briar) | Public Warning Broadcasts (EU-Alert / NL-Alert / ES-Alert / Cell Broadcast) | **OEP — Offline Emergency Protocol (Civic Relay)** |
|---|---|---|---|---|
| **Primary Direction** | One-way/narrowband device-to-satellite uplink | General peer-to-peer messaging / chat | One-way authority-to-citizen broadcast | **Bi-directional coordination research:** Alert boundary $\rightarrow$ Opt-in Status $\rightarrow$ Store-and-Forward $\rightarrow$ Adaptive Route $\rightarrow$ Verified ACK |
| **Hardware / Network Requirement** | Requires modern NTN-capable handset + clear sky line-of-sight | Bluetooth / Wi-Fi LAN | Active cellular cell broadcast or GNSS | **Transport-agnostic software layer:** coordinates across cellular, local peer relays, or external gateways as permitted |
| **Indoor / Collapsed Structure Behavior** | Satellite link often blocked indoors or under debris | Unstructured chat without formal status/triage semantics | Broadcast only; no return status channel | **Explicit store-and-forward queue with TTL** and energy-aware local relay pathing to an edge gateway |
| **Human Status Semantics (`UNKNOWN !== INJURED`)** | Binary SOS initiation only | Free-text chat | None (broadcast only) | **Strict 4-state explicit check-in** (`SAFE`, `SOS_EXPLICIT`, `OTHERS_AFFECTED`, `CANNOT_DETERMINE`) separated from `UNKNOWN` / `NO_CONTACT` |
| **Receipt Integrity & Non-Fabrication** | Proprietary carrier/vendor endpoint | Often optimistic UI checkmarks | No delivery receipt | **Strict separation of `QUEUED`, `FORWARDED_UNCONFIRMED`, and `ACK`** with challenge/transport binding |
| **Openness & Auditability** | Closed proprietary stack | Mixed (often closed SDKs or chat-focused) | Telecom standard (3GPP CBS / CAP 1.2) | **100% MIT Open Source** with deterministic 810-scenario verification and public negative-claim register |

---

## 2. Why Public Grant Evaluators and Partners Care

1. **No Vendor Lock-In:** European civil-protection agencies and municipalities need auditable, open-source reference architectures rather than opaque proprietary SDKs.
2. **Safety-First Epistemology:** Most prototypes fail institutional review because they exaggerate capabilities or conflate "packet sent" with "person rescued." OEP builds negative-claim enforcement directly into its state machine and automated test suite.
3. **Measurable Validation Tooling:** Alongside the protocol models, OEP ships reproducible simulation sweeps (`oep-evidence-run.mjs`), an Android hardware test harness (`experimental/android-nearby/`), and automated synthetic stakeholder browser verification (`buyer-arena`).
