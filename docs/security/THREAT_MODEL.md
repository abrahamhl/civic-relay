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
| **Android Nearby Lab (`experimental/android-nearby/`)** | Local 2-phone Google Play Services Nearby Connections (`P2P_POINT_TO_POINT`) laboratory app, manual Nearby authentication-digit token confirmation, UUID + per-message random challenge ACK guard (`LabDeliveryGuard.java`), v3 `SHA256withECDSA` ephemeral receiver ACK signature bound to explicitly paired Nearby session in MainActivity (physical testing pending), fixed synthetic-only file-backed lab queue (`LabPersistentQueue.java`) now wired in PR #8, dual-clock TTL expiry, local CSV export, STOP & CLEAR purge. | Multi-hop background mesh routing, zero-click pairing, fleet PKI management, Play Store production readiness, field-validated range/battery claims (`PHYSICAL_TEST_PENDING`). |

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
| **TM-01** | **Unauthenticated CAP Alert Activation** | `acceptAuthorizedCapAlert()` (`investor-next/lib/emergency-policy.mjs`) requires an injected `verifyIssuer(alert)` returning `{ authenticated: true, trustAnchorId }`, `status === 'Actual'`, `msgType` in `Alert`/`Update`/`Cancel`, valid time window, and valid polygon ($\ge 3$ points). Without a verified authority, activation throws and fails closed. | `investor-next/tests/emergency-policy.test.mjs` (`AUTOMATED_TESTED`) | Real X.509 / government CAP PKI signature verification requires institutional partner integration (`INDEPENDENT_VALIDATION_PENDING`). |
| **TM-02** | **False Casualty Inference from Device Silence** | `recordSafetyResponse()` (`emergency-policy.mjs`) and `runScenario()` (`emergency-routing.mjs`) strictly separate volunteered `SAFE` and `SOS_EXPLICIT` from `UNKNOWN` and `NO_CONTACT`. Silence never generates an SOS message. | `investor-next/tests/emergency-routing.test.mjs`, `investor-next/tests/oep-evidence-report.test.mjs` (810-scenario sweep, 0 violations) | Operator training in pilot exercises must reinforce that `UNKNOWN` is not a casualty count. |
| **TM-03** | **Store-and-Forward Memory Exhaustion & Payload Abuse** | `createStoreForwardEngine()` (`investor-next/lib/store-forward.mjs`) enforces strict envelope validation (`^[A-Z0-9_-]{1,64}$`, `LAB_*` destinations only, plain-object JSON payload $\le 4096$ bytes, TTL $1..86400\text{ s}$, bounded `maxEntries` failing closed). On Android, `LabPersistentQueue.java` provides a durable file-backed queue surviving process restarts with TTL expiration and tombstone anti-replay. | `investor-next/tests/store-forward.test.mjs` & `LabPersistentQueueTest.java` (`AUTOMATED_TESTED`) | Multi-hop distributed storage quotas will be evaluated in TRL 5–6 pilots. |
| **TM-04** | **Message ID Replay & Post-Revocation Resurrection** | Finalized records (`ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, `EXHAUSTED`) wipe `envelope = null` and remain as payload-free tombstones that reject ID reuse. Late async receipts arriving after `revoke()`, `purge()`, or TTL expiry are ignored in both `store-forward.mjs` and `LabPersistentQueue.java`. | `investor-next/tests/store-forward.test.mjs` & `LabPersistentQueueTest.java` (`AUTOMATED_TESTED`) | Tombstone map is bounded by session lifetime and `maxEntries`. |
| **TM-05** | **Forged or Cross-Transport ACK Spoofing** | In `store-forward.mjs`, `ACK_SYNTHETIC` requires `sent.accepted === true`, `receipt.kind === 'SIMULATED_RECEIVER_RECEIPT'`, `receipt.messageId === id`, and `receipt.transportId === selected.id`. In Android, `LabDeliveryGuard.java` enforces matching `approvedPeer`, `uuid`, and per-message `challenge` before wall-clock and monotonic TTL expiry, and `LabReceiptSigner.java` provides separate JVM-tested asymmetric `SHA256withECDSA` (`secp256r1`) primitives. **PR #8 integrates the signer and verifies ACK signatures against a public key pinned to the manually matched Nearby endpoint for that session.** This is TOFU-over-an-explicitly-approved-Nearby-session rather than institutional PKI; it is NOT yet measured on hardware. | `investor-next/tests/store-forward.test.mjs`, `LabDeliveryGuardTest.java`, `LabReceiptSignerTest.java` (`AUTOMATED_TESTED`) | Hardware-backed Keystore certificate pinning across fleet devices is planned for TRL 5–6. |
| **TM-06** | **Battery Drain via Relay Participation** | `energyPolicy()` (`emergency-policy.mjs`) and `runScenario()` (`emergency-routing.mjs`) prevent intermediary relaying when battery is `CRITICAL` ($\le 15\%$), and `store-forward.mjs` holds non-SOS messages under `CRITICAL` energy profile. | `investor-next/tests/emergency-policy.test.mjs`, `investor-next/tests/emergency-routing.test.mjs` | Actual mAh consumption on physical handsets is not yet measured (`PHYSICAL_TEST_PENDING`). |
| **TM-07** | **Unauthorized Peer Connection or Stale Callback Leak (Android Lab)** | `MainActivity.java` requires explicit operator checkbox consent before starting Nearby advertisement/discovery and manual confirmation of the Nearby authentication digits (`onConnectionInitiated`). `MainActivity.java` + `LabTrialJournal.java` increments a session epoch on `STOP & CLEAR` so late callbacks cannot repopulate cleared UI/logs. | `LabDeliveryGuardTest.java`, `LabDeadlinePolicyTest.java`, `LabTrialJournalTest.java` (`AUTOMATED_TESTED` in `.github/workflows/android-nearby-ci.yml`) | Physical two-handset RF testing remains required (`PHYSICAL_TEST_PENDING`). |

## 4. Additional pre-pilot P0 controls (22 October 2026, PR #8)

- **Storage corruption/restart denial:** the Android lab queue now rejects malformed/truncated/duplicate records and files exceeding an explicit bound rather than silently accepting partial data; writes attempt atomic replacement with a portability fallback. Corruption triggers a visible failure and disables sending until STOP & CLEAR. This is not a forensic-grade or crash-consistent database guarantee.
- **Actual send-path wiring:** `MainActivity.sendTest` must durably record the fixed fictional payload before it calls Nearby; a failed write prohibits sending. `finishTrial` settles the local record and `STOP/onStop` purges it. A record restored after interruption is never automatically re-transmitted without fresh consent and pairing.
- **Confidentiality boundary:** the experimental local TSV file is NOT encrypted at rest. Arbitrary user text or coordinate payloads are rejected in the queue; only `SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS` is permitted. Do not store PII until encrypted storage, independent privacy analysis and key lifecycle controls have been implemented and reviewed.
- **Honest receipt boundary:** matching Nearby endpoint plus random challenge is a protocol-level app receipt, NOT a cryptographically authenticated institutional delivery guarantee. `LabReceiptSigner.java` is wired in PR #8: unsigned v2 receipts are rejected and v3 signed ACKs use an ephemeral key exchanged after manual-digit pairing. No persistent/federated trust anchor or physical security assessment exists.
- **Risk still OPEN:** [privacy/retention issue #4](https://github.com/abrahamhl/civic-relay/issues/4), [physical trials issue #5](https://github.com/abrahamhl/civic-relay/issues/5), and production deployment [issue #6](https://github.com/abrahamhl/civic-relay/issues/6). No GDPR/ISO/ENS certification.
