# Six-perspective technical and investment audit — 20 October 2026
The requested "five auditors + chief engineer" is applied here as a **structured internal review framework**. It is NOT a certified Andrei Karpathy methodology, his authorship, or six independent human expert reviews. Scores are estimates and not evidence of external validation.

| Reviewer | Internal readiness /10 | Main finding | Acceptance gate |
| --- | ---: | --- | --- |
| 1. Principal security engineer | 3 | Official identity absent; E2E primitives not wired to dispatch; CSP had unsafe allowances | Authenticated authority identity, key lifecycle, cryptographic audit and threat model |
| 2. Distributed systems engineer | 5 | Real ACK/dedup logic in local simulator; actual radio reliability undemonstrated | Physical 2-device, failure-injection, replay, TTL/duplication and ACK tests |
| 3. EU grant evaluator | 2 | SSRI-04 fits theme but needs eligible consortium and end-user organisations | Coordinator + qualified responders; call Annex eligibility checklist |
| 4. Product / public safety UX | 4 | Old UI impersonated operational alerts and exaggerated radio availability | Explicit simulation labels, no fake authority, honest status semantics |
| 5. Commercial and licensing reviewer | 4 | MIT reuse permitted including competitors; no demonstrated commercial demand | Defined buyer, letters of interest, trademark strategy, operator agreements |
| 6. Chief engineer / acceptance owner | 4 | Repository must pass fresh CI, persist crash testing, and regain trust through truthful claims | All gates below; do not label ready for public deployment early |

### Chief engineer: release blockers
P0 — A demo must NEVER originate or mark an alert as `OFFICIAL` from client role selection or local button.
P0 — A simulated successful route is not an emergency-service receipt. State should reflect receiver ACK only.
P0 — Satellite/mesh/LEO/112/ENS/EUCCS claims must be labelled as research unless independently proven.
P0 — No personal data/real geolocation in mock alerts; no fake institutional email addresses.
P1 — IndexedDB must persist a coherent snapshot and flush before dispatch; browser power-loss/reload testing must precede a durability guarantee.
P1 — Real hardware pilot and failure coverage + security assessment.
P2 — Next.js investor experience with independent CI, documented deploy; do not break existing Vite demo.
P2 — User consent, DPIA, procurement/consumer liability and accessibility audit.

### Evidence categories
- **PROVEN SYNTHETIC:** automated tests in existing `packages/core/tests` and original `RELEASE_TRUTH_V0_1.md` (historical, not rerun by this document).
- **SOURCE-INSPECTED:** repository implementation exists, functional integration needs test.
- **PROPOSED:** roadmap and opportunity pages, NOT an implemented capability.
- **EXTERNAL VALIDATION:** NONE as of this dated internal audit.

### General decision
Pursue eligible consortium partnership and bounded technical validation. Do not solicit procurement as an operational emergency service. Protect credibility with negative testing and independently falsifiable claims, not inflated scores.

### Risk register
| Risk | Severity | Mitigation |
| --- | --- | --- |
| Citizen believes a fictional SOS reached rescuers | CRITICAL | Persistent demo-only banners and no real-world SOS details |
| Fraudulent official-origin injection | CRITICAL | Gate all official credentials on trusted backend; never via UI roles |
| Lost queued message after browser crash | HIGH | Atomic IndexedDB snapshot, flush barriers, tested recoverability |
| Browser cannot directly access smartphone satellite APIs | HIGH | Operator/OS partnerships and supported terminals; scope research |
| Grants reject ineligible standalone applicant | HIGH | 3 first responders + coordinator before submitting |
| OSS clone or brand confusion | MEDIUM | Trademark strategy, license compliance, speed and network effects |
| Private keys compromised by browser malware | HIGH | Secure enclave/OS keystore plan, security expert review |
