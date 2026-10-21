# Financial Scenarios & Resource Allocation — OEP / Civic Relay

**Scope:** Pragmatic, milestone-gated resource plans across three realistic funding envelopes (Micro-Grant / NGI, Seed / Pre-Seed R&D Pilot, and European Consortium Work Package).  
**Financial Discipline:** Illustrative planning envelopes only, NOT budgets validated by quotations, eligibility rulings, letters of intent or funded commitments. All cost lines require invoice/rate evidence, legal entity verification and review; zero speculative satellite capex.

---

## 1. Three Funding Envelopes (12–18 Month Horizon)

| Scenario | Target Funding Source | Total Budget | Primary TRL Progression | Core Deliverable |
|---|---|---|---|---|
| **Scenario A — Lean Open-Source Validation** | RVO MIT / partner-backed research grant (eligibility UNVERIFIED; NLnet v2 GenAI policy incompatible with AI-generated funded outputs) | **€50,000 ILLUSTRATIVE** (6–9 months) | **TRL 3.5 $\rightarrow$ TRL 4.5** | Two-phone physical validation (30+ trials), AOSP BLE/Wi-Fi Aware transport adapter, Ed25519 receipt signing, independent security audit. |
| **Scenario B — Institutional Pilot & Hardening** | Pre-Seed Impact / Deep-Tech Angel + RVO WBSO / MIT | **€180,000 ILLUSTRATIVE** (12 months) | **TRL 4 $\rightarrow$ TRL 6** | Multi-hop (3–5 node) persistent Android/iOS SDK, sandbox CAP 1.2 PKI verifier, municipal tabletop + 20-handset field exercise, DPIA & external pentest. |
| **Scenario C — European Consortium Work Package** | Horizon Europe Cluster 3 (`DRS`) Partner Allocation | **€350,000–€500,000 ILLUSTRATIVE** (18–24 months) | **TRL 4 $\rightarrow$ TRL 7** | Cross-border civil-protection interoperability, external edge gateway adapters (LoRa / municipal Wi-Fi / NTN testbed), standardized open-source reference suite. |

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

## Funding truth gate (22 October 2026)

- **NLnet application/funded work is high-risk or ineligible under the current AI-assisted development process.** [NLnet policy v2.0 (20 October 2026)](https://nlnet.nl/foundation/policies/generativeAI/2.0/) disallows GenAI use in drafting, editing, translating or restructuring proposals (except disclosed accessibility necessity) and in producing any funded artefacts. This document is AI-assisted reference material and **must NOT be pasted into an NLnet application**. Treat that route as blocked unless the applicant establishes and personally follows a compliant approach.
- The three budgets are not validated quotations or investment offers; TRL targets are **objectives**, not promised certification outcomes. Do not represent €50k/€180k/€400k as committed money.
- Before any financial application: attach a costed work-breakdown structure, VAT/overhead assumptions, personnel rates, legal entity/consortium eligibility, milestones with *observed* pass/fail criteria, and a signed safety/ethics plan.
- Evidence is tracked in [EVIDENCE_REGISTER](EVIDENCE_REGISTER.md) and [latest CTO engineering status](../audits/LATEST_ENGINEERING_STATUS.md). Physical field results remain missing.
