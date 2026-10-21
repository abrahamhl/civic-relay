# Technical Due Diligence — OEP / Civic Relay

**Document Purpose:** Transparent engineering inspection guide for technical reviewers, grant evaluators, and institutional partners.  
**Verification Date:** 2026-10-22 (PR #8; staging engineering review; no physical field verification)

---

## 1. Subsystem Inventory & Verification Status

| Subsystem | Source Files | Automated Test Files | Verification Status |
|---|---|---|---|
| **Deterministic 20–100 Node Routing Engine** | `investor-next/lib/emergency-routing.mjs`, `investor-next/lib/index.mjs` | `investor-next/tests/emergency-routing.test.mjs`, `investor-next/tests/oep-evidence-report.test.mjs` | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` |
| **Bounded Store-and-Forward Queue Engine** | `investor-next/lib/store-forward.mjs`, `investor-next/lib/index.mjs` | `investor-next/tests/store-forward.test.mjs` | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` |
| **Consent, Energy & CAP Boundary Policies** | `investor-next/lib/emergency-policy.mjs`, `investor-next/lib/index.mjs` | `investor-next/tests/emergency-policy.test.mjs` | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` |
| **810-Scenario Sweep & Field Trial Validator** | `investor-next/scripts/oep-evidence-run.mjs`, `investor-next/scripts/validate-field-trials.mjs` | `investor-next/tests/oep-evidence-report.test.mjs`, `investor-next/tests/field-trials-validator.test.mjs` | `IMPLEMENTED`, `AUTOMATED_TESTED` |
| **Multilingual Next.js + Three.js Web Lab** | `investor-next/app/*` | `investor-next/tests/system-story.test.mjs`, `oep-brand-evidence.test.mjs`, `test-locales.mjs`, `dossier-truth-gate.test.mjs` | `IMPLEMENTED`, `BUILD_VERIFIED`, `BROWSER_TESTED` |
| **Experimental Android Nearby 2-Phone Lab** | `experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/*` (`MainActivity.java`, `LabDeliveryGuard.java`, `LabDeadlinePolicy.java`, `LabTrialJournal.java`, `LabReceiptSigner.java`, `LabPersistentQueue.java`) | `experimental/android-nearby/app/src/test/java/eu/civicrelay/nearbylab/` (`LabDeliveryGuardTest.java`, `LabDeadlinePolicyTest.java`, `LabTrialJournalTest.java`, `LabReceiptSignerTest.java`, `LabPersistentQueueTest.java`) | `IMPLEMENTED`, `BUILD_VERIFIED`, `AUTOMATED_TESTED`, `PHYSICAL_TEST_PENDING` |
| **Automated Synthetic Stakeholder Audit** | `abrahamhl/buyer-arena`: `scripts/civic-relay-review.mjs` | Historical 78 Chromium assertions across `P01`–`P08` on earlier source; not repeated for this SHA | `HISTORICAL_BROWSER_TESTED`, `NOT_CURRENT` |

---

## 2. Reproducible Commands for Reviewers

A technical reviewer can reproduce the deterministic checks using the commands below; duration, dependencies and Android SDK setup depend on the environment:

```bash
# 1. Run deterministic unit, policy, store-and-forward, truth-gate and 810-sweep tests (count varies by commit)
node --test investor-next/tests/*.test.mjs

# 2. Generate the standalone 810-scenario synthetic evidence artifact & validate field trials CSV
node investor-next/scripts/oep-evidence-run.mjs --out evidence/oep-virtual-scenario-report.json
node investor-next/scripts/validate-field-trials.mjs

# 3. Type-check, build static EN/ES/NL export, and run locale & SEO assertions
npm --prefix investor-next run type-check
npm --prefix investor-next run build
npm --prefix investor-next run check:locales
```

For the experimental Android Nearby lab (requires JDK 17 + Android SDK):
```bash
cd experimental/android-nearby
gradle :app:assembleDebug
```

---

## 3. Core Engineering Invariants Verified by Automated Tests

1. **Deterministic Seed Reproducibility:** Identical `ScenarioParameters` (`seed`, `devices`, `participation`, `permissions`, `battery`, `damaged`, `responses`, `helpRequests`, `bluetooth`, `wifi`, `gateway`) always produce byte-identical topology coordinates, routes, and summary counts.
2. **Human Status Non-Inference (`UNKNOWN !== SOS`):** When `responses = 0` and `helpRequests = 0`, `summary.humanSOS === 0` and `summary.routes.length === 0` across all 810 parameter combinations.
3. **Consent & Permission Gating:** Non-participating (`participating: false`) or unpermissioned (`permission: false`) nodes cannot originate or relay messages.
4. **Energy-Aware Relay Exclusion:** Nodes in `CRITICAL` battery state ($\le 15\%$) are excluded from acting as intermediate multi-hop relays in Dijkstra path selection (`emergency-routing.mjs` line 46), while explicit `SOS_EXPLICIT` origination remains permitted in `store-forward.mjs`.
5. **Tombstone Anti-Replay, Durable Persistence & Cryptographic Receipt Signing:** Once a message transitions to `ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, or `EXHAUSTED`, its payload is zeroed (`envelope = null`) and late asynchronous receipts or duplicate `enqueue()` calls with the same ID are rejected (`store-forward.mjs` and `LabPersistentQueue.java`). On Android, `LabReceiptSigner.java` now signs and verifies v3 receiver receipts in the **MainActivity source path** (PR #8): manual Nearby pairing digits precede a per-session P-256 public-key exchange, the key is pinned to the approved endpoint, and unsigned/wrong-key receipts are rejected. This is NOT proof of interoperability on physical handsets or institutional identity authentication. The synthetic-only disk queue was connected to actual MainActivity send/ACK/STOP transitions in PR #8; it is neither encrypted nor an operational emergency store.

### 4. Release evidence and known gaps (22 October 2026)

- The three-language Next.js code, canonical domain check and Chromium smoke QA are merged in master, but the public Vercel alias still serves an earlier SHA; resolve [release issue #6](https://github.com/abrahamhl/civic-relay/issues/6).
- Android PR #8 must pass its own exact SHA Android build, JVM storage corruption tests and consent-path source review before merge. Green CI is evidence of compilation/unit behavior only.
- Browser-simulation acknowledgement `ACK_SYNTHETIC`, transport API success, the Android `ACK_RECEIVED` application acknowledgment and actual rescue response are different events. They are NOT interchangeable.
