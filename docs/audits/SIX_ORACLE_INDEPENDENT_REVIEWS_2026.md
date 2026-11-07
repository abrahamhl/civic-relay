# Six Independent Specialist Reviews — OEP / Civic Relay (21 October 2026)

> **Execution Contract:** Five independent domain specialist evaluations followed by the Principal Engineering Integrator synthesis (`Oracle 6`). Every finding is tied to inspectable repository code, automated test runs, or real Playwright Chromium browser evidence.

---

## ORACLE 1 — Software Architecture (Senior Distributed-Systems Architect)

### 1.1 Scope Inspected
- `investor-next/lib/emergency-routing.mjs` (deterministic 20–100 virtual node topology and Dijkstra pathfinder)
- `investor-next/lib/emergency-policy.mjs` (capability state machine, consented safety check-in retention/revocation, energy profiles, fail-closed CAP 1.2 verifier boundary)
- `investor-next/lib/store-forward.mjs` (bounded store-and-forward queue, tombstone deduplication, exponential backoff, adapter scoring, synthetic receipt validation)
- `packages/core/` (`MessageStore`, `Dispatcher`, `envelope.ts`, `crypto.ts`)
- `experimental/android-nearby/` (`MainActivity.java`, `LabDeliveryGuard.java`, `LabDeadlinePolicy.java`, `LabTrialJournal.java`)

### 1.2 Architectural Findings
1. **Deterministic Reproducibility (`PASS`):**
   - `runScenario()` uses a pure 32-bit LCG (`Math.imul(s, 1664525) + 1013904223`) seeded by `p.seed`, producing identical node coordinates, participation flags, damage states, and Dijkstra routes across runs.
   - Verified across 810 seeded parameter combinations (`12,150` invariant assertions in `investor-next/scripts/oep-evidence-run.mjs`).
2. **Store-and-Forward & Persistence Boundaries (`PASS WITH DOCUMENTED LIMITATION`):**
   - `createStoreForwardEngine` enforces a hard capacity limit (`maxEntries`), explicit consent (`consented === true`), synthetic destination guard (`^LAB_[A-Z0-9_]{1,40}$`), bounded TTL (`1..86400s`), exponential backoff (`retryMs * 2**(attempts - 1)`), and multi-adapter scoring (`100*reliability - urgency*(latencyMs/100) - energyCost*12 - monetaryCost*4`).
   - **Boundary Clarity:** The investor laboratory store-and-forward engine is explicitly in-memory within the browser tab (`SIMULATED_ONLY`), separate from `packages/core` (which uses IndexedDB in the V0.1 demo) and separate from `experimental/android-nearby/` (which enforces a 1-pending-message foreground guard). This separation is honest and avoids pretending browser state is durable mobile disaster storage.
3. **Edge-Case Test Coverage Gaps Identified (`ACTIONABLE — P1`):**
   - While basic store-and-forward and routing invariants are tested, explicit deterministic regression tests should be added for:
     - Concurrent `dispatch(id)` calls while `inFlight` (idempotency under race conditions).
     - Cross-adapter receipt spoofing (`receipt.transportId !== selected.id`).
     - Replay rejection across all terminal states (`REVOKED` and `EXHAUSTED` tombstones, in addition to `ACK_SYNTHETIC` and `EXPIRED`).
     - Non-object payload rejection in `validate()`.
     - Explicit offline-to-online (`damaged: 100 -> 0`), gateway recovery (`gateway: false -> true`), and revoked permission (`permissions: 100 -> 0`) transitions in `emergency-routing.test.mjs`.

---

## ORACLE 2 — Security and Privacy (Safety-Sensitive Research Security Engineer)

### 2.1 Scope Inspected
- Trust boundaries in `emergency-policy.mjs`, `store-forward.mjs`, and `experimental/android-nearby/`
- GitHub Actions workflows (`.github/workflows/*.yml`) in both `civic-relay` and `buyer-arena`
- Dependency trees and licenses (`package.json`, `LICENSE`, `pnpm-lock.yaml`)
- Issue #4 (`M0.3 privacy gate`) and Issue #5 (`M1 hardware gate`)

### 2.2 Security & Privacy Findings
1. **Plaintext Payload Retention & Tombstones (Issue #4 — `MITIGATED IN CODE, RESIDUAL MEMORY LIMITATION DOCUMENTED`):**
   - `store-forward.mjs` no longer stores a duplicate serialized `fingerprint` string. Active records compare `stable(prior.envelope)` directly, and terminal transitions (`ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, `EXHAUSTED`, and `purge()`) set `r.envelope = null`, leaving only a payload-free tombstone to prevent replay.
   - `createInMemoryAdapter` records only `{ id, provenance: 'SYNTHETIC_EXERCISE_ONLY' }` without storing message payloads.
   - **Residual Risk:** JavaScript garbage collection is non-deterministic and cannot cryptographically zero V8 heap pages, nor can local `revoke()` recall data already transmitted to an external peer. Data must remain strictly synthetic until a field DPIA and cryptographic erasure layer are reviewed.
2. **CAP Alert Spoofing Boundary (`PASS`):**
   - `acceptAuthorizedCapAlert()` fails closed unless an external `verifyIssuer` function returns `{ authenticated: true, trustAnchorId }`, rejects `Exercise`/`Test`/`Draft` statuses, validates polygon bounds (`[-90..90, -180..180]`), rejects future timestamps (`> now + 60000ms`), and requires `references` on `Update`/`Cancel`.
3. **Android Nearby Receipt & Clock Rollback Hardening (`PASS — BUILD VERIFIED`):**
   - `LabDeliveryGuard` binds outgoing messages to `(id, peer, challenge, expiresAt)` and rejects mismatched peers, wrong challenges, duplicates (`MAX_SEEN = 100`), and expired packets.
   - `LabDeadlinePolicy` enforces dual-clock expiration (`wallNow >= wallDeadline || monotonicNow >= monotonicDeadline`) so rolling back the Android system clock cannot extend message TTL.
   - `MainActivity.onStop()` calls `stopAndClear()`, incrementing `sessionEpoch` to invalidate stale dialogs/callbacks and preventing background tracking.
4. **CI/CD Least-Privilege Permissions (`ACTIONABLE — P1`):**
   - `.github/workflows/emergency-lab-ci.yml` and `.github/workflows/investor-next-ci.yml` did not declare top-level `permissions: contents: read`. Adding explicit `permissions: contents: read` enforces least privilege across all workflows.
5. **Security Documentation Deliverables (`ACTIONABLE — P1`):**
   - Must publish dedicated due-diligence files under `docs/security/`:
     - `docs/security/THREAT_MODEL.md`
     - `docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md`
     - `docs/security/DATA_AND_CONSENT_BOUNDARIES.md`

---

## ORACLE 3 — Product Design and UX (Principal UX Engineer)

### 3.1 Scope Inspected
- `investor-next/app/investor-page.tsx`, `system-explained.tsx`, `system-story-data.ts`, `coordination-lab.tsx`, `emergency-building.tsx`, `scroll-experience.tsx`, `crisis-story.tsx`, `evidence-board.tsx`, `layout.tsx`, `[locale]/page.tsx`
- Real Chromium renders across `360px`, `390px`, `768px`, `1280px`, and `1440px` viewports in EN, ES, and NL

### 3.2 UX & Multilingual Findings
1. **Multilingual SEO & Metadata Defect (`CRITICAL — P0`):**
   - `investor-next/app/[locale]/page.tsx` contained a legacy Spanish satellite string (`" | Proyecto de comunicaciones por satélite para emergencias offline"`) hardcoded into `<title>`, `og:title`, and `twitter:title` for BOTH `/es/` and `/nl/`!
   - `investor-next/app/layout.tsx` (used for the English `/` route) had Spanish `<title>` and `<meta name="description">` and lacked `alternates.canonical` and `alternates.languages` (`hreflang`).
   - **Fix Required:** Provide accurate, language-matched EN/ES/NL metadata, Open Graph, Twitter cards, and `alternates` (`canonical` + `languages`) in `layout.tsx` and `[locale]/page.tsx`, with zero satellite-operational claims.
2. **8-Step Signal Journey Clarity (`ACTIONABLE — P1`):**
   - Workstream 4 specifies the central mental model:
     `EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`
     where each step clearly answers: *What enters the system? What decision is made? What software performs that decision? What output is produced? What limitation remains?*
   - While `#what-oep-does`, `#how-it-works` (6 stages), `#routing-lab`, and `#evidence` exist, adding an explicit, scannable **8-Step End-to-End Signal & Evidence Strip** (in EN/ES/NL) inside `#what-oep-does` / `#how-it-works` that maps all 8 stages (`EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`) with Input / Decision / Software Module / Output / Limitation makes the 30-second investor comprehension and 3-minute engineering inspection crystal clear without altering any existing selector or 3D animation.
3. **Interactive Laboratory Selector Disambiguation (`CRITICAL — P0`):**
   - Inside `#routing-lab`, both `TransportSandbox` (`.mer-forward-lab`) and `CoordinationLab` (`.mer-controls`) used `.mer-tools`, causing generic `#routing-lab .mer-tools button` selectors to hit `TransportSandbox` buttons first.
   - **Fix:** Scope selectors to `.mer-controls .mer-tools` and add explicit `data-testid` attributes (`data-testid="export-synthetic-evidence"`, `data-testid="reset-scenario"`, `data-testid="copy-scenario-input"`, `data-testid="sandbox-send-sos"`) to lab buttons.

---

## ORACLE 4 — European Technology Investor (Skeptical Grant & Seed Evaluator)

### 4.1 Scope Inspected
- Existing funding documents in `docs/` (`FUNDING_MASTER_ROUTING_2026.md`, `OEP_INVESTOR_DILIGENCE_AND_PITCH.md`, `OEP_VALIDATION_CERTIFICATION_AND_FUNDING_2026.md`)
- Official European Commission Horizon Europe Cluster 3 (`HORIZON-CL3-2026-01-SSRI-04`, `DRS-03`), Eureka Eurostars-3, RVO Netherlands, and Regional Development Agency (Oost NL / VFF) frameworks

### 4.2 Investor Findings
1. **Positioning & Differentiation Credibility (`PASS`):**
   - Repositioning OEP as an **open-source coordination and validation layer over existing authorized networks** (rather than a capital-intensive proprietary satellite or telecom operator) is realistic for a pre-seed/grant-stage technical founder.
2. **Structured Investor Dossier Required (`ACTIONABLE — P1`):**
   - Institutional evaluators and technical angels expect a clean, standardized 11-document investor data room under `docs/investor/`:
     1. `EXECUTIVE_SUMMARY.md`
     2. `TECHNICAL_DUE_DILIGENCE.md`
     3. `ARCHITECTURE.md`
     4. `EVIDENCE_REGISTER.md`
     5. `DIFFERENTIATION.md`
     6. `RISKS_AND_MITIGATIONS.md`
     7. `TRL_AND_VALIDATION_ROADMAP.md`
     8. `PILOT_PROPOSAL.md`
     9. `FUNDING_OPPORTUNITIES.md`
     10. `FINANCIAL_SCENARIOS.md`
     11. `ONE_PAGE_PITCH.md`
   - Every document must distinguish verified facts (TRL 3–4 software simulation + CI-compiled Android lab APK) from unverified milestones (TRL 5 two-phone physical trials, TRL 6 responder pilot), cite official EU/NL program URLs, and distinguish grants from loans (e.g., RVO VFF is a convertible loan, whereas Horizon Europe requires a multi-entity consortium).

---

## ORACLE 5 — Operational Stakeholders (Citizens, Responders, Municipalities, Telecoms, DPOs)

### 5.1 Stakeholder Evaluation Findings
1. **Citizens & Field Volunteers (`P01`, `P06`):**
   - Need unmistakable clarity that clicking "I am safe" or "I need help" in the web lab is a local exercise and NEVER contacts 112. Verified in Chromium (`01-resident-es`, `06-volunteer-es`).
2. **Emergency Coordinators & Municipal Partners (`P02`, `P08`):**
   - Require strict separation between `SAFE`, `SOS_EXPLICIT`, and `UNKNOWN` (silence must never generate false casualty counts) and between `QUEUED`, `FORWARDED_UNCONFIRMED`, and `ACK_SYNTHETIC` (model receipt is never rescue confirmation).
3. **Data Protection Reviewers (`P05`):**
   - Require explicit opt-in consent before recording status or starting radio discovery, no GPS coordinates collected in the Android lab, bounded retention (1 hour in web exercise; foreground-only in Android lab), and clear disclosure that once a payload leaves a device, local revocation cannot erase a remote copy.

---

## ORACLE 6 — Principal Engineering Integrator (Synthesis & Priority Matrix)

Using `priority = severity (1-5) × impact (1-5) × reproducibility (1-5) × investor relevance (1-5)`:

| Rank | ID | Finding | Score (`S×I×R×IR`) | Est. Effort | Status |
|---:|---|---|---:|---|---|
| 1 | **F01** | **Incident B:** Buyer Arena `synthetic-json-download` timeout on `02-responder-en` and `06-volunteer-es` due to `.mer-tools` selector ambiguity | `5×5×5×5 = 625` | 30m | **FIXED & VERIFIED IN CI (`29bf9f8`)** |
| 2 | **F02** | **Incident A:** Vercel `civic-relay-investor` `productionBranch` mismatch (`master` lacked `investor-next`) + deployment smoke verification | `5×5×5×5 = 625` | 45m | **IN PROGRESS (Workstream 1)** |
| 3 | **F03** | **SEO / i18n Defect:** Legacy Spanish satellite claim in `investor-next/app/[locale]/page.tsx` metadata for `/es/` and `/nl/`, and Spanish metadata on English `/` in `layout.tsx` | `4×5×5×5 = 500` | 25m | **IN PROGRESS (Workstream 4)** |
| 4 | **F04** | **Workstream 4 UX:** Explicit 8-step end-to-end architecture table/strip (`EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`) with Input/Decision/Code/Output/Limitation + `data-testid` attributes on lab controls | `3×4×5×5 = 300` | 40m | **IN PROGRESS (Workstream 4)** |
| 5 | **F05** | **Workstream 2 Quality:** Additional deterministic edge-case tests (concurrent `dispatch`, cross-adapter forged receipt, `REVOKED`/`EXHAUSTED` replay rejection, non-object payload guard, offline/online & gateway recovery transitions) | `3×4×5×4 = 240` | 30m | **IN PROGRESS (Workstream 2)** |
| 6 | **F06** | **Workstream 5 Security & Trust:** Enforce `permissions: contents: read` on all GitHub workflows and author `docs/security/{THREAT_MODEL,DEPENDENCY_AND_LICENSE_AUDIT,DATA_AND_CONSENT_BOUNDARIES}.md` | `3×4×5×4 = 240` | 40m | **IN PROGRESS (Workstream 5)** |
| 7 | **F07** | **Workstream 6 Investor Dossier:** Author all 11 required files in `docs/investor/*.md` with verified EU/NL funding details and strict claim classification | `3×4×4×5 = 240` | 60m | **IN PROGRESS (Workstream 6)** |
| 8 | **F08** | **Workstream 7 Physical Validation Bridge:** Document operator protocol and `HUMAN_ACTION_REQUIRED.md` for the two-phone physical Android Nearby trials (Issue #5) | `3×4×4×4 = 192` | 25m | **IN PROGRESS (Workstream 7)** |
