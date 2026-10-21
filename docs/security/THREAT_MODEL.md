# Threat Model — OEP (Offline Emergency Protocol) / Civic Relay

**Document Status:** `IMPLEMENTED` / `AUTOMATED_TESTED`  
**Scope:** `investor-next/` (Research & Investor Web Platform), `experimental/android-nearby/` (Experimental 2-Phone Android Nearby Lab), and `packages/core/` (Baseline Core Engine).  
**Positioning:** Distributed Emergency Coordination & Adaptive Multi-Network Routing (Research MVP).

---

## 1. System Boundaries & Non-Claims

OEP is an open-source research coordination layer and deterministic simulation workbench. It is **not** a certified emergency service, **not** connected to 112 / PSAP infrastructure, **not** an operational satellite network, and **not** a cryptographic government Common Alerting Protocol (CAP) authority verifier.

| Boundary | Inside Current Scope | Outside Current Scope (Explicit Non-Claim) |
|---|---|---|
| **Web Research Lab (`investor-next/`)** | Deterministic 20–100 node routing simulation (`emergency-routing.mjs`), bounded in-memory store-and-forward engine (`store-forward.mjs`), capability/consent/CAP boundary policy (`emergency-policy.mjs`), synthetic JSON export. | Live radio transmission, real emergency dispatch, server-side PII storage, cryptographic identity verification. |
| **Android Nearby Lab (`experimental/android-nearby/`)** | Local 2-phone Google Play Services Nearby Connections (`P2P_POINT_TO_POINT`) laboratory app, manual Nearby authentication-digit token confirmation, UUID + per-message random challenge ACK guard (`LabDeliveryGuard.java`), dual-clock TTL expiry, local CSV export, STOP & CLEAR purge. | Multi-hop background mesh routing, zero-click pairing, E2EE key management, Play Store production readiness, field-validated range/battery claims (`PHYSICAL_TEST_PENDING`). |

---

## 2. Threat Actors & Attack Surfaces

1. **Spoofed Authority / Fake Alert Injector:** Attempts to inject a crafted CAP alert or emergency zone to cause panic or unauthorized relay activation.
2. **Replay / Duplicate Flood Adversary:** Attempts to exhaust local device memory or battery by replaying old SOS messages or flooding unique message IDs.
3. **Forged Receipt / False Rescue Adversary:** Attempts to inject a fake transport receipt (`ACK`) so a sender believes an SOS was received when it was not, or after its TTL expired.
4. **Malicious Nearby Peer (Android Lab):** Attempts to connect to a lab handset without operator consent or spoof an `EXPERIMENT_ACK` for an unapproved endpoint or mismatched challenge.
5. **Silent Inference / Privacy Misuse:** System or observer attempts to infer human injury or precise indoor coordinates from device silence (`UNKNOWN` / `NO_CONTACT`) or involuntary background telemetry.

---

## 3. Threat Matrix, Controls & Residual Risks

| Threat ID | Threat Description | Implemented Technical Control | Verification Evidence | Residual Risk & Next Step |
|---|---|---|---|---|
| **TM-01** | **Unauthenticated CAP Alert Activation** | `evaluateCapAlert()` (`investor-next/lib/emergency-policy.mjs`) requires an injected `authorityVerifier(alert)` returning `{ verified: true }`, `status === 'Actual'`, `msgType` in `Alert`/`Update`/`Cancel`, valid time window, and closed polygon ($\ge 4$ points). Without a verified authority, activation returns `SIMULATION_ONLY` (`trusted: false`). | `investor-next/tests/emergency-policy.test.mjs` (`AUTOMATED_TESTED`) | Real X.509 / government CAP PKI signature verification requires institutional partner integration (`INDEPENDENT_VALIDATION_PENDING`). |
| **TM-02** | **False Casualty Inference from Device Silence** | `humanStatusOutcome()` (`emergency-policy.mjs`) and `runScenario()` (`emergency-routing.mjs`) strictly separate volunteered `SAFE` and `SOS_EXPLICIT` from `UNKNOWN` and `NO_CONTACT`. Silence never generates an SOS message. | `investor-next/tests/emergency-routing.test.mjs`, `investor-next/tests/oep-evidence-report.test.mjs` (810-scenario sweep, 0 violations) | Operator training in pilot exercises must reinforce that `UNKNOWN` is not a casualty count. |
| **TM-03** | **Store-and-Forward Memory Exhaustion & Payload Abuse** | `createStoreForwardEngine()` (`investor-next/lib/store-forward.mjs`) enforces strict envelope validation (`^[A-Z0-9_-]{1,64}$`, `LAB_*` destinations only, plain-object JSON payload $\le 4096$ bytes, TTL $1..86400\text{ s}$, bounded `maxEntries` failing closed). | `investor-next/tests/store-forward.test.mjs` (`AUTOMATED_TESTED`) | Browser memory is ephemeral; durable mobile storage quotas will require SQLite/Room bounds in TRL 5–6. |
| **TM-04** | **Message ID Replay & Post-Revocation Resurrection** | Finalized records (`ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, `EXHAUSTED`) wipe `envelope = null` and remain as payload-free tombstones that reject ID reuse. Late async receipts arriving after `revoke()`, `purge()`, or TTL expiry are ignored. | `investor-next/tests/store-forward.test.mjs` (`AUTOMATED_TESTED`) | Tombstone map is bounded by session lifetime and `maxEntries`. |
| **TM-05** | **Forged or Cross-Transport ACK Spoofing** | In `store-forward.mjs`, `ACK_SYNTHETIC` requires `sent.accepted === true`, `receipt.kind === 'SIMULATED_RECEIVER_RECEIPT'`, `receipt.messageId === id`, and `receipt.transportId === selected.id`. In Android (`LabDeliveryGuard.java`), ACK requires matching `approvedPeer`, `uuid`, and per-message `challenge` (random UUID) before wall-clock and monotonic TTL expiry. | `investor-next/tests/store-forward.test.mjs` & `experimental/android-nearby/app/src/test/.../`LabDeliveryGuardTest.java` / `LabDeadlinePolicyTest.java` / `LabTrialJournalTest.java` (`AUTOMATED_TESTED`) | Lab challenge is transmitted in the JSON envelope for protocol verification, not cryptographically signed (E2EE / Ed25519 planned for TRL 5). |
| **TM-06** | **Battery Drain via Relay Participation** | `energyPolicy()` (`emergency-policy.mjs`) and `runScenario()` (`emergency-routing.mjs`) prevent intermediary relaying when battery is `CRITICAL` ($\le 15\%$), and `store-forward.mjs` holds non-SOS messages under `CRITICAL` energy profile. | `investor-next/tests/emergency-policy.test.mjs`, `investor-next/tests/emergency-routing.test.mjs` | Actual mAh consumption on physical handsets is not yet measured (`PHYSICAL_TEST_PENDING`). |
| **TM-07** | **Unauthorized Peer Connection or Stale Callback Leak (Android Lab)** | `MainActivity.java` requires explicit operator checkbox consent before starting Nearby advertisement/discovery and manual confirmation of the Nearby authentication digits (`onConnectionInitiated`). `MainActivity.java` + `LabTrialJournal.java` increments a session epoch on `STOP & CLEAR` so late callbacks cannot repopulate cleared UI/logs. | `LabDeliveryGuardTest.java` / `LabDeadlinePolicyTest.java` / `LabTrialJournalTest.java` (`AUTOMATED_TESTED` in `.github/workflows/android-nearby-ci.yml`) | Physical two-handset RF testing remains required (`PHYSICAL_TEST_PENDING`). |
