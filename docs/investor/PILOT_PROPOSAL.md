# Pilot Proposal — Municipal, Academic & Civil-Protection Sandbox

**Proposal Title:** Controlled Offline Coordination & Two-Handset / Multi-Node Validation Pilot  
**Target Partners:** Dutch Safety Regions (*Veiligheidsregio's*), Spanish Municipal Civil Protection (*Protección Civil*), European University RF/Resilience Labs (e.g., TU Delft, TNO, UPM), and Telecom Resilience Teams.  
**Safety Classification:** **100% Non-Operational Sandbox Exercise (`EXERCISE_ONLY`)** — Zero connection to live 112 / PSAP dispatch or public warning channels.

---

## 1. Pilot Objectives

1. **Validate Physical Short-Range Store-and-Forward (Phase 1 — 2 Handsets):** Measure actual connection setup latency, payload delivery rate, TTL expiration accuracy, and battery consumption across two consenting Android devices in Airplane Mode using `experimental/android-nearby/`.
2. **Evaluate Human Status Triage Clarity (Phase 2 — Tabletop Exercise):** Test whether emergency coordinators accurately distinguish `SAFE`, `SOS_EXPLICIT`, `OTHERS_AFFECTED`, and `UNKNOWN` (`NO_CONTACT`) using OEP's coordination console without inferring casualties from silence.
3. **Verify CAP 1.2 Institutional Trust Boundary (Phase 3 — Sandbox Feed):** Test `evaluateCapAlert()` against a partner's non-public test CAP 1.2 feed signed with sandbox keys.

---

## 2. Three-Phase Pilot Structure (12 Weeks)

| Phase | Duration | Scope & Participants | Deliverables |
|---|---|---|---|
| **Phase 1: Bench & Corridor RF Measurement (M1)** | Weeks 1–3 | 2–4 Android devices in lab/building conditions (line-of-sight, closed door, next floor, timeout, revocation). | Completed 30+ trial CSV dataset (`field_trials.csv`), p50/p95 latency report, 0 false-ACK verification. |
| **Phase 2: Coordinator Tabletop & Usability Drill** | Weeks 4–8 | 10–20 synthetic + 5–10 physical lab nodes in a simulated building blackout; reviewed by 2–3 civil-protection officers. | Coordinator feedback report, DPIA (Data Protection Impact Assessment) template, human-factors audit. |
| **Phase 3: Sandbox Gateway & Signed CAP Test** | Weeks 9–12 | Local edge gateway emulator receiving queued status envelopes and returning signed sandbox receipts. | Joint technical report for Horizon Europe / RVO consortium work package submission. |

---

## 3. Strict Safety & Ethical Guardrails

- **No Live Emergency Traffic:** All screens, payloads, and exports carry mandatory `EXERCISE_ONLY` / `LABORATORY ONLY — NOT AN EMERGENCY SERVICE` banners.
- **Voluntary Informed Consent:** Participating testers sign an explicit consent form and can tap `STOP & CLEAR` at any moment to purge local logs and terminate radio discovery.
- **Zero PII Collection:** Only ephemeral pseudonymous trial IDs, timestamps, byte counts, and battery deltas are logged.
