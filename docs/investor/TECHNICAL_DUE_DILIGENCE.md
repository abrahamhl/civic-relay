# Technical Due Diligence — OEP / Civic Relay

**Document Purpose:** Transparent engineering inspection guide for technical reviewers, grant evaluators, and institutional partners.  
**Verification Date:** 2026-10-21

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
| **Automated Synthetic Stakeholder Audit** | `abrahamhl/buyer-arena`: `scripts/civic-relay-review.mjs` | 78 Chromium assertions across `P01`–`P08` (`audit/personas/`) | `IMPLEMENTED`, `BROWSER_TESTED` |

---

## 2. Reproducible Commands for Reviewers

Any technical reviewer can reproduce the entire verification suite locally in under 3 minutes:

```bash
# 1. Run all 62 deterministic unit, policy, store-and-forward, truth-gate, and 810-sweep tests
node --test investor-next/tests/*.test.mjs

# 2. Generate the standalone 810-scenario synthetic evidence artifact & validate field trials CSV
node investor-next/scripts/oep-evidence-run.mjs --out evidence/oep-virtual-scenario-report.json
node investor-next/scripts/validate-field-trials.mjs

# 3. Type-check, build static EN/ES/NL export, and run locale & SEO assertions
pnpm --dir investor-next run type-check
pnpm --dir investor-next run build
pnpm --dir investor-next run check:locales
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
5. **Tombstone Anti-Replay, Durable Persistence & Cryptographic Receipt Signing:** Once a message transitions to `ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, or `EXHAUSTED`, its payload is zeroed (`envelope = null`) and late asynchronous receipts or duplicate `enqueue()` calls with the same ID are rejected (`store-forward.mjs` and `LabPersistentQueue.java`). On Android, `LabReceiptSigner.java` signs and verifies receipts using asymmetric `SHA256withECDSA` (`secp256r1`).
