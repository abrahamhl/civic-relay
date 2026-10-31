# OEP investor due-diligence pack — 2026-10-21
## 70-second pitch
**OEP — Offline Emergency Protocol (Protocolo de Emergencias Offline)** researches how existing authorised radios, smartphones and gateways might form an adaptive emergency coordination overlay when conventional services degrade. We do not compete with telecoms, build our own satellite constellation, take control of other people's phones, or send tests to 112.

**What we can show now:** a reproducible 20–100 node virtual laboratory and a preserved Three.js earthquake/collapsed-building narrative; explicit human status categories; bounded store-and-forward in-memory lab code; differentiated simulated queue/receiver receipts. **What still needs proof:** actual offline A-to-B on two Android phones, measured energy/latency, authenticated institutional alerts, a secure gateway and responder validation.

We are looking for **research partners, not deployment customers**. The aim of the next funding milestone is a repeatable Android pilot, a threat-model review, and independently scrutinised interoperability experiments.

## Recommended live demo (90 seconds, no misleading claims)
- **0–15 s:** reveal existing 3D globe, explain conventional-network outage and opt-in hardware principle.
- **15–35 s:** collapse building; show one SAFE, one UNKNOWN, one explicit SOS; state UNKNOWN does not mean injured.
- **35–55 s:** remove conventional connectivity/gateway; synthetic SOS remains in local queue.
- **55–70 s:** enable simulated gateway, trigger retry; only a **SYNTHETIC_RECEIVER_ACK** appears, no rescue promise.
- **70–90 s:** show machine-verifiable test suite and open PR; present next 2-phone milestone and open scientific questions.

## High-integrity maturity rubric (maximum 100 points)
This is an **internal readiness framework**, NOT a third-party audit score. Award points solely when evidence linked below exists.
| Axis | Max | Proof required for full marks |
| --- | ---: | --- |
| Investor story and honest claims | 10 | Consistent OEP EN/ES/NL pages, live demo and non-operational disclaimer |
| Design accessibility and UI | 10 | Cross-browser device QA, WCAG audit, keyboard and screen reader review |
| Deterministic reproducibility | 10 | Repeated fixed-seed 20/40/100 tests, documented input/output export |
| Core correctness | 15 | Queue, retry, TTL, dedup, crash recovery, cancellation, source-level unit/property tests |
| Security and data privacy | 15 | Threat model reviewed, credible auth/trust design, deletion test, DPIA/legal assessment |
| Android physical evidence | 15 | Two actual phones, receipts and denominator, battery/latency/error logs |
| Networking interoperability | 10 | Real two-vendor paths, gateway tests, evidence labels |
| Partner/responder validation | 5 | Documented external operator feedback or LOI |
| Funding eligibility and economics | 5 | Topic requirements verified, legal applicant, consortium and defensible budget |
| Documentation / release hygiene | 5 | CI green on exact release ref, SBOM/license/security policy, release provenance |

**Strict status 21 October 2026:** Scores from this rubric are NOT assigned pending full audit; 9.95/10 is a *stretch target*, never an attained rating. Even a visually excellent demo does not close the physical, external validation and privacy gates.

## Diligence questions investors should ask
- How many recipients and route successes were **physically** measured vs simulated?
- Who authenticated a CAP warning? Where are root-of-trust rotation and replay controls?
- Can we verify receiver ACK beyond a transport send success?
- What happens to payload copies on intermediate/receiving devices following revocation?
- What is the discovery/battery tradeoff, and whose permission controls radios?
- Which legally eligible SME/university/public-service partner will co-sign a Horizon proposal?
- What commercial value does an open-source simulation license capture? What services are proprietary?
- What failures make OEP worse than the baseline and which groups might be excluded?

**Release gate:** demo and scientific partner outreach GO; actual emergency activation and performance claims NO-GO.
