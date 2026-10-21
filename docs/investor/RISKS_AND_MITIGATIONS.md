# Risks and Mitigations — OEP / Civic Relay

**Risk Governance Philosophy:** In emergency technology, unacknowledged limitations are liabilities. OEP maintains a live, transparent risk register across technical, operational, regulatory, and adoption dimensions.

---

## Risk Matrix

| Risk ID | Category | Risk Description | Severity | Likelihood | Implemented or Planned Mitigation | Status |
|---|---|---|---|---|---|---|
| **R-01** | **Human Safety** | **False sense of rescue:** A user or operator mistakes a transport receipt (`ACK`) for confirmation that emergency services have dispatched a rescue team. | Critical | Medium | Strict state separation (`QUEUED`, `FORWARDED_UNCONFIRMED`, `ACK_SYNTHETIC`, `ANDROID_RECEIVER_ACK`); UI and JSON exports prominently warn `NO 112 · NO RESCUE CONFIRMATION`. | `IMPLEMENTED` / `AUTOMATED_TESTED` |
| **R-02** | **Human Safety** | **False casualty inference from silence:** Responders assume non-responding devices (`UNKNOWN` / `NO_CONTACT`) represent injured or trapped victims, misallocating scarce resources. | Critical | Medium | `humanStatusOutcome()` and `runScenario()` enforce `humanImpactInferred: false`; silence never increments `humanSOS`. | `IMPLEMENTED` / `AUTOMATED_TESTED` |
| **R-03** | **Security** | **Fake emergency alert injection:** Unverified CAP XML/JSON triggers false panic or unauthorized radio discovery. | High | Medium | `evaluateCapAlert()` fails closed unless an injected `authorityVerifier` confirms cryptographic trust, `status === 'Actual'`, active time window, and valid polygon. | `IMPLEMENTED` (Gate) / `INDEPENDENT_VALIDATION_PENDING` (PKI) |
| **R-04** | **Hardware / OS** | **Mobile OS background execution limits:** Android and iOS aggressively throttle background Bluetooth/Wi-Fi scanning when screens are locked, limiting unassisted mesh relays. | High | High | Explicitly scoped Android lab to foreground/consented operation (`experimental/android-nearby/`); TRL 5–6 roadmap targets OEM/carrier privileged APIs or foreground crisis-mode UX. | `PHYSICAL_TEST_PENDING` |
| **R-05** | **Energy** | **Battery exhaustion during outage:** Continuous peer discovery drains low-battery devices needed by citizens for flashlights or emergency calls. | High | Medium | `energyPolicy()` scales scan intervals up and disables intermediary relaying when battery $\le 15\%$ (`CRITICAL`), while still allowing explicit `SOS_EXPLICIT` origination. | `IMPLEMENTED` (Model) / `PHYSICAL_TEST_PENDING` (mAh) |
| **R-06** | **Validation** | **Lack of physical RF measurements:** Current web evidence is mathematical (`SIMULATED_ONLY`), and the Android APK is build-verified (`BUILD_VERIFIED`) without published two-phone field data. | High | Certain (Current) | Published 30-trial two-phone test protocol (`PILOT_ACCEPTANCE.md`), CSV schema (`LabTrialJournal.java`), and logged `HUMAN_ACTION_REQUIRED.md` for immediate execution. | `PHYSICAL_TEST_PENDING` |
| **R-07** | **Privacy / GDPR** | **Unintended metadata persistence:** Sensitive status or location data lingers on relay devices after an exercise or incident concludes. | Medium | Low | Mandatory TTL ($1..86400\text{ s}$), automatic payload wiping on terminal states (`envelope = null`), `purge(id)` in web engine, and `STOP & CLEAR` epoch reset in Android lab. | `IMPLEMENTED` / `AUTOMATED_TESTED` |
