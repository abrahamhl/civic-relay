# CIVIC RELAY / six-lens investment and engineering review
**Date:** 2026-10-20  
**Scope:** investor-next landing (English / Spanish / Dutch), scroll-driven orbital demonstration, main repository evidence.  
**Method:** five deliberately conflicting audit perspectives and one accountable chief-engineer acceptance decision. An internal exercise inspired by adversarial code review, **not an official or attributed Andrej Karpathy skill**, six independent people, or a certification.

## What the team is actually proposing
Civic Relay investigates continuity of **messages** during communications disruptions: prepare a typed message, retain a local queue, select an authorised route when available, seek a true receiving-side acknowledgment, and avoid confusing an ACK with rescue. The current public MVP is a browser model. It **does not** supply smartphone mesh, satellite uplinks, 112 dispatch, verified emergency alerts, secure government channels or validated multi-device delivery.

## Internal auditor scores
Scores below are **judgment calls /10 about the investor website after this pass**, not measured TRL and not independent validation. Technology-readiness scores are separate.

| Auditor | Focus / verdict | Investor experience | Open risk / next acceptance test |
| --- | --- | ---: | --- |
| 1 — Public-safety UX lead | Five-act interactive explanation makes the failure scenario more tangible. Full EN/ES/NL narrative instead of superficial translated buttons. | 8.2 | Test comprehension with actual responders and people unfamiliar with radio technology. |
| 2 — Distributed-systems engineer | Demonstrated local queue / ACK / dedup software correctly separated from simulated hardware. | 7.9 | Offline two-device scenario with a **remote** ACK; restart/replay TTL and crash tests. Core field readiness remains low. |
| 3 — Security and civil-rights reviewer | Continuous 'simulation' qualification, no real distress entry or authority impersonation in pitch. No credentials or API tokens required for static site. | 7.4 | Threat modelling, signed-authority trust chain, data minimisation/privacy audit, independent security review. |
| 4 — EU grants evaluator | Thesis identifies relevant Horizon Cluster 3 theme and specifically names prospective partner types. Budget/outcomes are not fabricated. | 7.6 | Eligibility, consortium coordinator, 3 qualifying first responders where required, evidence from end users; no awarded funding. |
| 5 — Investor / business critic | Audience segmentation, proposed open-source professional-service route and fundable work packages now explicit. | 7.5 | Current revenue **zero evidenced**; validate willingness to pay, LOIs, competition and credible unit economics. |
| **6 — Chief engineer** | Accept as **investor discussion preview**, subject to CI + manual route verification. Do not promote as operational public-safety deployment. | **conditional** | Run previews/CI, test interactive locale buttons, document remaining blockers. |

## Adversarial debate
- **Optimist:** Site looks like a serious mission system; the narrative can attract a coordinator's attention.
- **Security critic:** The visual polish might falsely imply operational satellite coverage. Keep 'no live link' visible at all times, and never label fictitious alarms OFFICIAL.
- **Grant reviewer:** A compelling site cannot substitute for organisational eligibility, end-user partners or a grant application.
- **Systems architect:** A beautiful 3D globe is not technical proof; tie every capability claim to tests or place it in the roadmap.
- **Commercial reviewer:** MIT open source permits forks/commercial reuse. Position services, integration, operational evidence and partnerships as the possible moat, not exclusivity.

**Chief-engineer decision:** Deploy a clear, high-contrast site with visible limits, EN/ES/NL static routes, self-contained interactive chapters, evidence-based investment rationale, no invented emergency claims, and explicit pilot requirements. Keep source branch in PR pending independent review.

## Implemented in this website pass
- EN at '/', ES at '/es/', NL at '/nl/' with directly selectable languages and locale-specific metadata.
- Five chapter narratives and 3 scenario selectors fully translated, including warning/limitation strings.
- Three-step 'create → persist → acknowledge' product explanation, with non-confusion of local vs real acknowledgment.
- Audience segmentation (responders, telecom and academia, public authorities).
- Investor questions: why this problem, why the research engine, why an EU consortium may be relevant, revenue route **proposed** not established.
- Concrete list of **fundable next experiments**: two-device messaging, authority verification, first-responder field test.
- Honest EU call link and deadline, explicitly not a guarantee or an application.
- Mobile and reduced-motion handling; no public API secrets introduced.
- Continued WebGL scroll story, separate from the actual local functional simulator.

## Evidence classes — release discipline
| Claim | Class | Responsible evidence |
| --- | --- | --- |
| Next static site builds and can be opened | TESTED if CI/preview green | GitHub 'Investor microsite checks' and Vercel preview |
| Core local queue / ACK logic | LOCAL TESTED / CODE INSPECTED | packages/core tests, existing engineering dossier |
| Local queue survives power loss / app termination | NEEDS VALIDATION | Browser restart, fault injection and storage test matrix |
| Physical mesh and satellite delivery | NOT IMPLEMENTED / RESEARCH | Real hardware integration + operator permission + controlled field log |
| Critical infrastructure interoperability / official provenance | NOT IMPLEMENTED / PARTNERSHIP | Institutional scope, standards review, credential issuer and security audit |
| Commercial ROI, delivery reliability, market size | UNKNOWN | Pilots, pricing interviews, independent metrics |

## Next gates ranked
**P0 (external truth):** Do not advertise satellite coverage, device relay, official emergency features or guaranteed results. Test that EN, ES and NL have consistent disclaimers.

**P1 (technical evidence):** Engineer a deterministic two-device offline test and independent receiver ACK, power loss persistence, failure injection, trust state transitions and rejection of fraudulent official status.

**P1 (European eligibility):** Identify and secure consortium coordinator, responder organisations and academic/telecom partners. Review formal grant requirements and keep official dates current.

**P2 (commercial):** Interview 10 pilot decision makers (target, not achieved); obtain written problem statements or expressions of interest, pricing evidence and procurement constraints.

**P2 (product):** User-study comprehension, contrast, mobile GPU/battery and reduced-motion testing, WCAG accessibility evaluation and translated terminology with native speakers.

## Chief engineer acceptance checklist
- [ ] Latest CI branch passes Next.js typecheck + build in GitHub.
- [ ] Baseline repository CI passes after marketing-only changes.
- [ ] Public preview serves '/' '/es/' '/nl/' with each language's copy.
- [ ] Scenario and phase controls work in browser in different locales.
- [ ] No fake emergency connection or 'official' messages.
- [ ] PR remains reviewable; do not merge to production without explicit release gate.

This document defines what was audited and what's left to prove; it does not certify the system for emergency use.
