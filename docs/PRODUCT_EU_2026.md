# Civic Relay — European Civil Resilience Partnership Brief
**Version:** 2026-10-20 | **Status:** early-stage, reproducible browser simulation, NOT an operational service
**Owner:** Abraham Haddioui | **Public code:** https://github.com/abrahamhl/civic-relay

## Executive proposition
When conventional communications fail during floods, wildfires, outages or infrastructure attacks, responders and civilians need a dependable way to compose messages, store them durably and transfer them whenever an authorised connection becomes available. Civic Relay explores a **store-and-forward message engine** with explicit receiver acknowledgments, multipath delivery, deduplication and trust states. It is designed as a research building block for **future integration**, not a replacement for emergency numbers, TETRA, 3GPP MCX or the European Union Critical Communication System (EUCCS).

## Product boundaries — what exists
- Typed message envelopes with TTL, incident identifiers, priorities and trust states.
- Local same-browser delivery simulator with IP, cellular and mesh-labelled virtual routes; **no actual BLE/mesh/IP exchange is proven by this demo**.
- Sender store, retry engine and receiver-side deduplication and acknowledgments; test coverage in `packages/core/tests`.
- IndexedDB persistence code in sender store, requiring additional browser crash/reload tests.
- An independent investor microsite under `investor-next` and a Vite product demonstration under `apps/web`.
- Synthetic, fictional messages only, never claims of official warnings.

## Not delivered (important)
- No operator-provided satellite service, satellite modem connection or universal smartphone satellite access.
- No inter-device mesh, verified Web Bluetooth hardware pilot, production gateway or validated 112/PSAP/CAD integration.
- No institutional credentials, signed authority directory, EUCCS/MCX conformance, certified post-quantum crypto or deployed E2E in live sending.
- No cybersecurity certification, ENS approval, EU endorsement, third-party audit or commercial field trials.
- No quantified market size, delivery success rate, coverage, latency or return on investment based on field data.

## Architecture roadmap with real acceptance gates
| Stage | Deliverable | Verifiable exit criterion |
| --- | --- | --- |
| A. Controlled lab | Portable reproducible demo | Green fresh CI, synthetic golden scenario, no institutional-origin forgery |
| B. Browser resilience | Reliable local persistence | IndexedDB recovery after reload/process termination, TTL replay handling, crash/partial-write tests, no phantom `DELIVERED` |
| C. Physical gateway | Verified device-to-device route | Minimum two isolated devices, offline messaging, independent ACK, measurable throughput and battery usage |
| D. Trust and security | Credentialed official channels | Independent penetration test, threat model, authority identity lifecycle, E2E protocol review; never authorise by UI role |
| E. Public safety | Standards and governance | MCX/EUCCS interoperability plan, GDPR DPIA where required, accessibility review, emergency-service governance, pilot approval |
| F. Satellite research | Operator-supported uplink | Signed operator agreement, actual terminal, independent documented live test, service/coverage constraints |

## Proposed EU research work packages — not agreed contracts
- WP1: first-responder needs, safety governance, accessibility and privacy impact.
- WP2: reproducible offline-first message protocol, failure handling, and proof-bearing ACK.
- WP3: physical gateways, constrained radio testing, optional satellite bridge architecture.
- WP4: open interoperability with recognised critical communications profiles and credentialed authorities.
- WP5: controlled pilots, independent verification, uptake and business case.

## Ethics and service safety
Never imply a user has reached emergency responders when only local storage or transport acceptance exists. Operational UX must distinguish `QUEUED`, `SENT`, `ACKED`, `DELIVERED`, `EXPIRED`, and `UNKNOWN`. Show local-first data minimisation, retention controls, cryptographic provenance, permission boundaries and operator responsibility. No silent citizen tracking. GPS optional by explicit consent. No automatic spoofed alerts and no release of safety-critical pilot to the public without controls.

## Technology rationale
A useful potential contribution is a verifiable delivery and trust boundary across multiple **authorised** transports. LoRa/Meshtastic, BLE, Wi-Fi Aware, commercial NTN, 3GPP MCX and GOVSATCOM have different legal/technical prerequisites; they are neither synonyms nor universal properties of mobile phones. They must be evaluated independently.

## What we offer partners now
Reviewable open-source code and synthetic examples; a clearly bounded demonstrator; an implementation contributor for local-first messaging, reliability engineering, prototype UI and evidence-first evaluation. We seek a qualified coordinating institution, end-user responders, security/telecom specialists and controlled-test facilities.

**Official relevant call:** https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04
