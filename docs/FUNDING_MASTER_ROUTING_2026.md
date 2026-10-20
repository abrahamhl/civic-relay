# FUNDING DOSSIER / MASTER EMERGENCY ROUTING NETWORK
**20 October 2026 | Stage: software research prototype; no live emergency service.**

## 60-second investor pitch
> Disasters often destroy the route, not the usefulness of every nearby device. Master Emergency Routing Network is an open-source research effort to test whether consenting phones can combine local storage, authenticated emergency zones, explicit human status requests and compatible authorised transports into a resilient coordination overlay. It preserves existing telecom operators and relies on lawful interfaces rather than attempting to override device permissions. We have a deterministic 20–100 node simulation and Three.js educational prototype; physical reliability, power performance and institutional interoperability are not proven. We seek a university, civil-protection and telecom consortium to make those questions measurable.

## Problem / testable hypothesis
Civil responders face disconnected or fragmented communications during multi-hazard incidents. Hypothesis: opportunistic store-and-forward with permission-aware routing across heterogeneous available network adapters improves the *scenario-model* number of reachable consented endpoints compared with a single-transport baseline, for some parameter ranges. This is not yet a measured claim about disaster effectiveness, real message reliability or saving lives.

## Open calls relevant on 20 October 2026
| Topic | Strategic fit | Caution |
| --- | --- | --- |
| HORIZON-CL3-2026-01-SSRI-04 — secured European Critical Communication System | Strong interoperability/security ecosystem angle; current investor site already links this topic | An Innovation Action with substantial consortium, maturity and critical-communications ecosystem expectations; a solo prototype is not yet sufficient |
| HORIZON-CL3-2026-01-DRS-03 — innovative rescue tools in hazardous conditions | Explicit earthquake/search and rescue scenario, comms and human-sensor technologies | Requires responder use case, validation and formal alignment with expected outcomes |
| HORIZON-CL3-2026-01-DRS-04 — uptake of disaster risk solutions | A later deployment/replication option | Product maturity and uptake partners not yet demonstrated |
| UCPM KAPP 2026 | Civil-protection international cooperation, exercises | CLOSED on 21 May 2026, do not present as currently open |

Official Horizon deadline: **5 November 2026** (confirm exact portal cut-off and electronic submission rules). No consortium or submission secured.
Links:
- https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04
- https://cordis.europa.eu/programme/id/HORIZON_HORIZON-CL3-2026-01-DRS-03
- https://rea.ec.europa.eu/funding-and-grants/horizon-europe-cluster-3-civil-security-society/disaster-resilient-society-europe_en
- https://civil-protection-knowledge-network.europa.eu/knowledge-action-prevention-preparedness-2026-call-proposals

## Consortium roles to recruit
Coordinator experienced in EU grant compliance; protection-civil end-user; two universities (RF/network systems and human factors); mobile/telecom integrator; privacy/security assessment; optional satellite and emergency-software gateway partners. All roles are prospective, not signed.

## Proposal work packages (indicative, not a grant budget)
WP1 Authority and safety case (CAP, threat model, GDPR, governance).
WP2 Multi-network message design (adapters, offline retention, dedup, ACK, TTL).
WP3 Device energy, usability and inclusion (accessibility, participation, alternative channels).
WP4 Measured dual-Android field experiment (physical link, audit traces, failures).
WP5 Gateway and end-user sandbox interoperability (third-party partner necessary).
WP6 Dissemination, open-source deliverables, exploitation and ecosystem pilot.

## Evidence/KPIs: publish denominators, not performance promises
- Simulator: determinism across fixed seeds; scenarios n=20,40,60,100; coverage of no-radio/no-permission/no-gateway/zero-response states; stable safety invariants.
- Phone pilot: receipt correctness, loss after reboot, success proportion with 95% CI where suitable, p50/p95 transmission delay, battery consumption against baseline, discovery time, false receipt count.
- Governance: zero real SOS/112 dispatch; alert authenticity failures correctly rejected; consent/revocation/retention tests; usability and accessibility review.
- Risk log: hostile fake alerts, insider relay, Sybil identity, unexpected energy drain, sensor permissions, radio range variability, indoor GPS uncertainty, vulnerable/low-technology residents, false recovery conclusions, safety-critical procurement liabilities.

## Five adversarial reviewers + chief engineer (internal methodology, not claimed third-party audit)
1. **Radio engineer:** no evidence of physical propagation, multi-hop reach or network concurrency. Gate: 2-device link, interference measurements.
2. **Security lead:** CAP is a format, not authenticity. Gate: external trust anchor, signature validation, replay and revocation.
3. **Civil protection operator:** unknown ≠ victim; receipt ≠ rescue. Gate: operational triage workflow and bounded false-positive/negative analysis.
4. **Privacy counsel:** incident status/location can be sensitive. Gate: minimise data, expiry, DPIA and consent.
5. **Investor/programme evaluator:** a Three.js visualisation is not a deployed network. Gate: partner LOIs, financial eligibility and measured milestone evidence.
6. **Chief engineer decision:** advance the reproducible model and two-phone pilot; DO NOT claim safety certification, field readiness, satellite capability or automatic responder dispatch.

## Readiness self-assessment (project authoring criteria, not external score)
Research direction: 8/10; simulator scientific validity as a **virtual model**: 7/10; field evidence: 0/10; institutional integration: 0/10; pitch clarity: 8/10; immediate grant submission readiness: 3/10. Proposed milestone for raising readiness: documented partner consortium and pilot protocol, not a higher number on the slide.

## Go/no-go
GO for open-source research demo and partner outreach. NO-GO for general-public emergency alerts, unknown-person localisation, silent sensor/radio operations, real responder routing or satellite promises.

## Next outreach
Use the simulation and this dossier to request 30-minute technical validation meetings and consortium introductions. Present the official call identifier, counterpart's proposed role, consortium deadline and evidence missing. Never imply we already collaborate with those institutions.

## Source verification / latest execution (20 October 2026)

The EU **Funding & Tenders Portal** currently lists the following as **OPEN FOR SUBMISSION**, opened 6 May 2026 and closing **5 November 2026**:
- **HORIZON-CL3-2026-01-SSRI-04**, *Development of ecosystem and next-generation capabilities for a secured European Critical Communication System in civil security* (Innovation Action). This is the **most directly relevant strategic title** to a coordination-routing overlay; topic-specific eligibility, budget, proposal template and consortium composition **NOT VERIFIED**.
- **HORIZON-CL3-2026-01-DRS-03**, *Development of innovative tools, processes, equipment and technologies through responses to disasters and emergencies for search and rescue in hazardous conditions* (Innovation Action). A credible match for the building-collapse exercise if end-users and methodology join; topic-specific eligibility **NOT VERIFIED**.
- **HORIZON-CL3-2026-01-DRS-01**, *Designing new ways of risk awareness and enhanced disaster preparedness* (Research and Innovation Action). More relevant to the zone-orchestration and community-inclusion research than physical emergency routing.
- **HORIZON-CL3-2026-01-DRS-04**, *Open topic on driving innovation uptake of disaster risk solutions* (Innovation Action). Treat as later-stage: actual field maturity/uptake evidence is missing.

Primary call listing (topic title, action type, opening date, deadline):
https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?callIdentifier=HORIZON-CL3-2026-01&frameworkProgramme=43108390&isExactMatch=true&order=DESC&pageNumber=1&pageSize=50&status=31094502

**Implementation evidence update:** feature branch now contains testable, bounded in-memory store-and-forward exercise code and a live browser sandbox controlling a fake gateway, on top of the already reproducible 20–100-node scenario. This increases demonstrator traceability, **not field maturity**. Sender signatures, real two-phone measurements and partner letters of intent are still missing. Proposal submission readiness remains low without a consortium and formal work programme review. Do not infer that the topic is suitable solely from the title.

**Pilot API candidate (not yet integrated):** Google Nearby Connections officially supports offline nearby discovery and communication on Android, but permission prompts are required; consent, mutual endpoint acceptance and identity verification remain mandatory. Sources:
https://developers.google.com/nearby/connections/android/get-started
https://developers.google.com/nearby/connections/android/manage-connections

**CAP official specification:** OASIS CAP v1.2 defines messaging and may carry XML signatures; the existence of a well-formed CAP document alone does NOT establish the issuing authority's authenticity. A trusted verification infrastructure is a separate WP.
https://docs.oasis-open.org/emergency/cap/v1.2/cs01/CAP-v1.2-cs01.html
