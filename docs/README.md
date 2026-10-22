# OEP / Civic Relay — Canonical Documentation Index

To prevent documentation sprawl and allow grant evaluators, security auditors, and technical partners to review the project in under 10 minutes, **these 8 documents are the canonical source of truth**:

## 1. Core Five-Document Technical & Funding Dossier
1. **[`docs/investor/ONE_PAGE_PITCH.md`](investor/ONE_PAGE_PITCH.md)** — 60-second overview of problem, architecture, verified evidence, and non-claims.
2. **[`docs/investor/ARCHITECTURE.md`](investor/ARCHITECTURE.md)** — End-to-end 8-stage decision pipeline (`EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`).
3. **[`docs/investor/EVIDENCE_REGISTER.md`](investor/EVIDENCE_REGISTER.md)** — Master claim-to-evidence ledger mapping every claim to source files, test commands, and status (`IMPLEMENTED`, `AUTOMATED_TESTED`, `BROWSER_TESTED`, `SIMULATED_ONLY`, `PHYSICAL_TEST_PENDING`).
4. **[`docs/security/THREAT_MODEL.md`](security/THREAT_MODEL.md)** — Threat matrix, fail-closed controls, ECDSA receipt signing (`LabReceiptSigner.java`), persistent queue (`LabPersistentQueue.java`), and residual risks.
5. **[`docs/investor/TRL_AND_VALIDATION_ROADMAP.md`](investor/TRL_AND_VALIDATION_ROADMAP.md)** — TRL 3–4 assessment and milestone roadmap (`M0` $\rightarrow$ `M4`).

## 2. Actionable Grant, Investor & Field Execution Kits
6. **[`docs/investor/CHATGPT_FUNDING_CAMPAIGN_PACK_2026.md`](investor/CHATGPT_FUNDING_CAMPAIGN_PACK_2026.md)** — Complete 2026 matrix of 8 verified funding & VC opportunities (NLnet, Horizon CL3, NATO DIANA, EIC Accelerator, GSMA, CDTI Neotec, RVO, Deep-Tech VCs) with copy-paste Master Prompts for ChatGPT.
7. **[`docs/investor/NLNET_PROPOSAL_WORKSHEET_2026.md`](investor/NLNET_PROPOSAL_WORKSHEET_2026.md)** — Field-by-field worksheet for the **3 November 2026 NLnet (Open Internet Stack)** submission (€42,000 across 5 milestones) + academic/civil-protection outreach templates.
8. **[`docs/audits/HUMAN_ACTION_REQUIRED.md`](audits/HUMAN_ACTION_REQUIRED.md)** & **[`experimental/android-nearby/PILOT_ACCEPTANCE.md`](../experimental/android-nearby/PILOT_ACCEPTANCE.md)** — Step-by-step operator protocol for the 30-trial physical two-phone Android validation (`Issue #5`).

## 3. Product Architecture, 3D Mission Control & Sector CCTV Specifications (2026-10-22)
- [`docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md`](product/VOICE_VISION_REQUIREMENTS_2026-10-22.md) — Timestamped founder voice transcript (`00:00`–`06:33.59`), requirements matrix (`V01..V13`, `W01..W03`), and repository implementation diff.
- [`docs/product/WEBSITE_INFORMATION_ARCHITECTURE.md`](product/WEBSITE_INFORMATION_ARCHITECTURE.md) — 30-second comprehension thesis, 3-surface progressive disclosure (`Descubrir`, `Explorar`, `Investigar`), 8-scene causal journey, and localized static routes (`/`, `/es`, `/nl`, `/mission-control`, `/science`).
- [`docs/product/INTERACTION_SPEC_AND_STATE_MODEL.md`](product/INTERACTION_SPEC_AND_STATE_MODEL.md) — Observable state model coupling the 3D WebGL Globe, Sector CCTV Console, and 8-link unified pipeline to `runScenario()` and `createStoreForwardEngine()`.
- [`docs/product/CAMERA_SECTOR_ARCHITECTURE.md`](product/CAMERA_SECTOR_ARCHITECTURE.md) — Sector Intelligence schemas (`SECTOR-AVILA-TIEMBLO`, `SECTOR-VLC-TURIA`, `SECTOR-NL-ARNHEM`), DGT/Rijkswaterstaat open-data attribution, anti-SSRF allowlist, fail-closed RBAC, and privacy mosaic guardrails.
- [`docs/product/SCIENTIFIC_TRUTH_MATRIX.md`](product/SCIENTIFIC_TRUTH_MATRIX.md) — Five-tier capability classification (`IMPLEMENTADO`, `SIMULADO`, `EN INVESTIGACIÓN`, `SIN PERMISOS`, `NO FACTIBLE CON WEB ACTUAL`).
- [`docs/product/BEFORE_AFTER_UX_AUDIT.md`](product/BEFORE_AFTER_UX_AUDIT.md) — Six-perspective UX/engineering audit, 10 remediated deficiencies, and Chromium `P01..P10` verification evidence.

## 4. Audits & Supporting References
- [`docs/audits/KARPATHY_6_AGENT_AUDIT_2026.md`](audits/KARPATHY_6_AGENT_AUDIT_2026.md) — First-principles adversarial audit & 10-day upgrade plan.
- [`docs/audits/SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md`](audits/SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md) — AI-assisted internal 6-perspective engineering review.
- [`docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md`](security/DEPENDENCY_AND_LICENSE_AUDIT.md) & [`docs/security/DATA_AND_CONSENT_BOUNDARIES.md`](security/DATA_AND_CONSENT_BOUNDARIES.md).
- [`docs/investor/FUNDING_OPPORTUNITIES.md`](investor/FUNDING_OPPORTUNITIES.md), [`FINANCIAL_SCENARIOS.md`](investor/FINANCIAL_SCENARIOS.md), [`PILOT_PROPOSAL.md`](investor/PILOT_PROPOSAL.md), [`DIFFERENTIATION.md`](investor/DIFFERENTIATION.md), [`RISKS_AND_MITIGATIONS.md`](investor/RISKS_AND_MITIGATIONS.md), [`TECHNICAL_DUE_DILIGENCE.md`](investor/TECHNICAL_DUE_DILIGENCE.md), [`EXECUTIVE_SUMMARY.md`](investor/EXECUTIVE_SUMMARY.md).
