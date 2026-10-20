# OEP — Offline Emergency Protocol
## Verified funding, independent validation and certification routes
**Research date:** 21 October 2026. **Geography:** EU / Netherlands. **Readiness:** simulated lab + source-only experimental Android (check current CI separately). This is **not** an emergency service or a recognised standard.

## Decision in 90 seconds
**Fastest near-term:** secure a consortium introduction around Horizon Europe Cluster 3 SSRI-04 or DRS-03 **before 5 November 2026**, while honestly explaining that OEP is only a research demonstrator. **Best realistic later funding window:** build an SME-led cross-border consortium for Eurostars-3 call 12 (opens 17 December 2026; deadline 4 March 2027). **Independent evidence:** pursue standards-based interoperability testing via ETSI CTI / Plugtests **after** implementing a relevant interoperable interface. **Certification is NOT available automatically from an open-source repo, standard, CI run, or GitHub badge.**

## Funding opportunity ledger
| Priority | Programme/topic | Status as of 21 Oct | Dates | Consortium / eligibility reality | Fit, readiness and next action | Primary source |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | HORIZON-CL3-2026-01-SSRI-04 — Secured European Critical Communication System ecosystem | OPEN | Closes **5 Nov 2026** | EU Horizon partnership/eligibility and expected outcomes must be verified in the detailed call; no current partners secured | Strong strategic match for safe cross-network coordination; find an established coordinator, offer our demonstrator as experimental work package, not standalone qualified vendor | https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04 |
| P0 | HORIZON-CL3-2026-01-DRS-03 — Rescue technology in hazardous disaster conditions | OPEN | Closes **5 Nov 2026** | Exact consortium, responder involvement, budget and TRL **not verified** | Building-collapse use-case; engage professional rescue end user and research institute before writing formal proposal | https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-DRS-03 |
| P1 | HORIZON-CL3-2026-01-DRS-01 — Risk awareness and enhanced disaster preparedness | OPEN | Closes **5 Nov 2026** | Exact consortium requirements **not verified** | Lower-fit alternative for opt-in public alert orchestration/participation research rather than radio interoperability | https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?callIdentifier=HORIZON-CL3-2026-01 |
| P1 | Eurostars-3 / RVO — Call 12 | FUTURE | Opens **17 Dec 2026**, closes **4 Mar 2027 at 14:00 CET** | Innovative SME in participating country leads, **>=2 independent organisations**; cross-border/national eligibility and own co-financing need verification | Better schedule for a measured two-device prototype and actual EU SME consortium. Contact RVO Team IRIS (public channel) to confirm eligibility before formation | https://www.rvo.nl/subsidies-financiering/eurostars/internationale-aanvraagprocedure |
| NOT OPEN | UCPM KAPP 2026 | CLOSED | Closed **21 May 2026** | Multi-country partnerships; future calls unconfirmed | Monitor next call; do not send 2026 submission | https://civil-protection-knowledge-network.europa.eu/knowledge-action-prevention-preparedness-2026-call-proposals |
| NOT OPEN | UCPM Track 1 2026 | CLOSED | Closed **21 Apr 2026** | For competent public risk-management authority/partners; not a solo software grant | Future monitoring only | https://civil-protection-knowledge-network.europa.eu/UCPM-Track-1-call2026 |

**Source certainty:** programme titles/dates/status from cited official agency pages; specific topic participation conditions, € awards and grant rates are not asserted here without full official call text. EU Funding & Tenders remains the authority. No grant application submitted or funds awarded.

## Product assurance: what to pursue, what NOT to claim
| Instrument | Nature | Applicability to OEP | Evidence / independent gate |
| --- | --- | --- | --- |
| ETSI TS 103 480 (2026-03) / NG112 | Technical interoperability test specification, **not a certificate by itself** | Investigate only if OEP implements a relevant next-generation emergency communication interface, policy or routing procedure | ETSI official https://www.etsi.org/technical-groups/emtel/ |
| ETSI NG112 Plugtests / CTI | Cross-vendor independent interoperability **test event**, not a general certificate of emergency readiness | High-value partner test when OEP has an independently interoperable implementation; 2026 Plugtests **already held May 26–29**; future event dates **not confirmed** | https://www.etsi.org/events/2631-ng112-plugtests-2026/ and https://www.etsi.org/expertise/testing-interoperability/ |
| ISO 22320:2018 | Guidelines on incident management; **not product approval** | Use as design-review and governance reference for responder coordination | https://www.iso.org/standard/67851.html |
| ISO/IEC 27001:2022 | **Organisational** information-security management system certification, when certified by an accredited body | Relevant later once a legal organisation and ISMS exist; does not certify rescue delivery/Android radio reliability | https://www.iso.org/standard/27001 |
| EU Cyber Resilience Act | Legal cybersecurity framework for products with digital elements; not an automatic grant or product certification | Ask legal expert if a future commercial software release is within scope (OSS/market status matters). Main obligations **11 Dec 2027**, reporting obligations **11 Sep 2026** under relevant scope | https://digital-strategy.ec.europa.eu/en/policies/cra-summary |
| Android Nearby offline test | Two-phone **physical engineering test**, not statutory certification | First attainable external-data gate: independently record 2 devices, versions, consent, authenticated link, success denominator, packet timestamps, latency, battery measurement and failure cases | https://developers.google.com/nearby/connections/android/get-started |

## Proposed third-party validation package
1. **Device-to-device independent reproducibility:** two Android models, permission states, no cellular Internet, pre-shared pairing digits verified on both phones, explicit receiver ACK and failed-link tests. Do not confuse a Google Nearby cryptographic/transport link with an independently audited identity system.
2. **Threat-model review:** fake exercise alerts, relay spoofing, receiver receipt injection, expiry/revocation, battery denial of service, retained copies on receiving devices, store-forward loops, malicious adapters and vulnerable residents.
3. **ETSI interoperability exploratory call:** explain current limitations; request feedback on interface scope and next Plugtests eligibility, **not a certification claim**.
4. **Emergency-professional exercise:** ask for tabletop feedback using synthetic messages only, never actual 112 or operational dispatch.
5. **Privacy/legal scoping:** DPIA necessity, lawful basis, minimised audit trail, high-risk sensitivity and commercial CRA applicability. No GDPR/ISO/CE compliance assertion without independent evidence.

## Immediate blockers to 9.95 investor-grade
- Official verified test results: no physical two-Android evidence attached.
- Android CI build must pass on the exact source commit; source files alone do not prove an installable APK.
- Written collaborator commitment: none known.
- User and emergency-operator usability/accessibility testing: not yet independently evidenced.
- Verified funding budget, SME legal applicant entity and consortium: unknown.
- Product protection: MIT code grants permitted reuse; brand, trademark and proprietary services require separate IP choices; do not promise anti-copy protection from MIT.

## Who should be contacted first (no outreach sent)
- Existing **Horizon Cluster 3 proposal coordinators** (via official Funding & Tenders partner search or National Contact Points).
- **University RF/networking and HCI group** with Android testing capabilities; approach using measurable 2-device pilot.
- **ETSI CTI** for interoperability test scope and future Plugtests.
- **Dutch RVO Team IRIS** for Eurostars pathway; official page lists eurostars@rvo.nl.
- **Civil-protection training/research partner** for tabletop exercise, not to endorse operational deployment.

A draft message pack can be prepared, but no letters, emails or application submissions have been sent.

## Update — 21 October 2026: broader non-duplicate funding + certification triage

### Newly verified opportunity: INNOWWIDE 2026, international market feasibility
- **Status:** Call 5 is in its published application window **1 October–1 December 2026, 14:00 CET**; RVO general overview marks it OPEN. The detailed RVO page may still show a generic "temporarily closed" heading: check the actual submission form before stating that an application is accepted.
- **Amount:** fixed **€60,000** grant where awarded, minimum eligible project cost **€86,000** (up to 70%). RVO publishes total call budget €4.2m for 70 projects.
- **Critical eligibility:** registered eligible SME and an international feasibility project **with an external-country counterpart in Africa, the Americas, Middle East, Asia or Oceania**. A Netherlands-only two-Android engineering pilot or a partnership only in EU Member States is **not sufficient**; commercial market testing is a different work package from emergency-device R&D.
- **OEP decision:** **CONDITIONAL FIT ONLY** if an actual eligible third-country market/civil resilience partner and legally eligible applicant exist; do not divert scarce effort from the Nov 5 Horizon opportunity. Do not label a one-person unregistered research repo as a Dutch SME applicant.
- **Source:** RVO official https://english.rvo.nl/subsidies-financing/innowwide and current overview https://www.rvo.nl/onderwerpen/internationaal-innoveren/regelingen

### EUCC: real security certification route, NOT rescue approval
- **Instrument:** European Common Criteria-based Cybersecurity Certification (EUCC), based on ISO/IEC 15408, available for qualifying ICT hardware/software/components. ENISA reports certificates can be issued since February 2025 and accredited certification bodies/labs perform the assessment.
- **OEP fit:** prospective **product-specific cybersecurity evaluation only after a precisely defined target of evaluation (TOE), security target, controlled build, software updates and repeatable assurance evidence**. It cannot validate emergency communications coverage or grant authority to send official alerts or 112 signals.
- **Current decision:** **NOT CERTIFICATION READY**. Do not claim the project, developers or simulation are EUCC/ISO 27001 certified. Ask accredited assessor about scope, feasibility and cost only after the security architecture and device lab stabilize.
- **Sources:** ENISA https://certification.enisa.europa.eu/browse-topic/eucc_en and EU cybersecurity certification framework https://www.enisa.europa.eu/topics/product-security-and-certification/cybersecurity-certification-framework

### Priority order of independent evidence
1. M0: CI reproducibility — evidence matrix reports **810 virtual scenario executions / 12,150 model invariant checks**, downloadable artifact for exact commit once GitHub Action succeeds. Not independent field evidence.
2. M1: repeatable consenting Android→Android transfer over a supported physical transport, document failed runs too (minimum explicit trial denominator); **pending actual devices**.
3. M2: cross-vendor interoperability exercise with compatible interfaces and consenting technical partners; **no ETSI Plugtests invitation or result claimed**.
4. M3: independent application penetration test, privacy/DPIA assessment and emergency-practitioner tabletop exercise using synthetic test data; **all pending**.
5. M4: define product/security scope and explore EUCC assessment with an accredited body; only then consider product assurance label. **No certified scope exists today**.

### Funding submission reality as of 21 October
**Horizon CL3 SSRI-04 and DRS-03: open, deadline 5 November 2026** on the European Commission portal; that does not establish that OEP can submit alone. **Eurostars-3 call 12: opens 17 December 2026, closes 4 March 2027**; RVO specifies Dutch company eligibility and co-financing. **Innowwide: call window open but fundamentally international market-feasibility focused**. No signed consortium, external field validation, grant application or certification filing has been verified.

Official Horizon portal: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?callIdentifier=HORIZON-CL3-2026-01

### Funding-agent relevance rubric (mandatory)
Classify every lead **ACTIVE ELIGIBLE / ACTIVE CONDITIONAL / FUTURE / CLOSED / NOT A GRANT / CERTIFICATION PATH**. Require: official URL, topic ID, call status, exact date and timezone, product fit, legal applicant requirements, funding and co-financing, proof of consortium, current TRL, blocker, one *verifiable* next action, retrieved date. Never fill unknown fields with plausible figures. Rank speed-to-next-action, not grant amount alone. Do not treat a standard, security test, pre-assessment, independent exercise or technical open-source licence as a granted certificate.
