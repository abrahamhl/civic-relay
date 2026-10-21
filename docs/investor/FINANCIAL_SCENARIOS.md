# Financial Scenarios & Resource Allocation — OEP / Civic Relay

**Scope:** Pragmatic, milestone-gated resource plans across three realistic funding envelopes (Micro-Grant / NGI, Seed / Pre-Seed R&D Pilot, and European Consortium Work Package).  
**Financial Discipline:** 100% milestone-linked engineering and validation budgets; zero speculative satellite capex or premature sales headcount.

---

## 1. Three Funding Envelopes (12–18 Month Horizon)

| Scenario | Target Funding Source | Total Budget | Primary TRL Progression | Core Deliverable |
|---|---|---|---|---|
| **Scenario A — Lean Open-Source Validation** | NLnet / NGI Zero Commons Fund or RVO MIT Feasibility | **€50,000** (6–9 months) | **TRL 3.5 $\rightarrow$ TRL 4.5** | Two-phone physical validation (30+ trials), AOSP BLE/Wi-Fi Aware transport adapter, Ed25519 receipt signing, independent security audit. |
| **Scenario B — Institutional Pilot & Hardening** | Pre-Seed Impact / Deep-Tech Angel + RVO WBSO / MIT | **€180,000** (12 months) | **TRL 4 $\rightarrow$ TRL 6** | Multi-hop (3–5 node) persistent Android/iOS SDK, sandbox CAP 1.2 PKI verifier, municipal tabletop + 20-handset field exercise, DPIA & external pentest. |
| **Scenario C — European Consortium Work Package** | Horizon Europe Cluster 3 (`DRS`) Partner Allocation | **€350,000 – €500,000** (18–24 months) | **TRL 4 $\rightarrow$ TRL 7** | Cross-border civil-protection interoperability, external edge gateway adapters (LoRa / municipal Wi-Fi / NTN testbed), standardized open-source reference suite. |

---

## 2. Detailed Allocation Breakdown

| Cost Category | Scenario A (€50k) | Scenario B (€180k) | Scenario C (€400k) | Justification |
|---|---|---|---|---|
| **Core Protocol & Mobile Engineering** | €32,000 (64%) | €105,000 (58%) | €220,000 (55%) | Store-and-forward persistence, AOSP BLE/Wi-Fi Direct adapters, cryptographic receipt guards, deterministic simulation calibration. |
| **Physical Hardware & RF Testbed** | €4,500 (9%) | €15,000 (8%) | €35,000 (9%) | Heterogeneous Android/iOS test handsets, USB power meters, Faraday pouches, portable edge gateway hardware. |
| **Field Trials & Civil-Protection Exercises** | €5,500 (11%) | €25,000 (14%) | €65,000 (16%) | Multi-site building attenuation trials, volunteer exercise logistics, observer instrumentation. |
| **Independent Security, Cryptography & GDPR Audit** | €5,000 (10%) | €20,000 (11%) | €45,000 (11%) | Third-party protocol red-teaming, CAP signature verification review, formal DPIA. |
| **Compliance, Documentation & Dissemination** | €3,000 (6%) | €15,000 (8%) | €35,000 (9%) | Open-access datasets, reproducible CI infrastructure, consortium reporting. |

---

## 3. Long-Term Sustainability & Revenue Model (Post-TRL 6)

While the core OEP protocol specification and reference simulator remain **MIT Open Source** to maximize public trust and adoption:
1. **Simulation & Resilience Auditing Suite (B2G / B2B SaaS):** Licensing deterministic scenario modeling + Buyer Arena multi-stakeholder resilience auditing to municipalities, critical infrastructure operators, and telecom providers.
2. **OEM / Carrier Integration & Certification Engineering:** Paid integration contracts adapting OEP's store-and-forward and CAP boundary modules into municipal apps, campus safety systems, and ruggedized first-responder hardware.
