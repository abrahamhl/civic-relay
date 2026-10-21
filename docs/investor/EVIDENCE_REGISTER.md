# Evidence Register — OEP / Civic Relay

**Purpose:** Master claim-to-evidence ledger mapping every technical, product, and validation claim to its exact source code, test command, CI workflow, artifact, and mandatory classification status.

### Allowed Claim Classifications
- `IMPLEMENTED` — Source code exists in the repository and performs the stated logic.
- `BUILD_VERIFIED` — Compiles cleanly in local and GitHub Actions CI builds.
- `AUTOMATED_TESTED` — Verified by deterministic unit/integration tests in CI.
- `BROWSER_TESTED` — Verified by real headless Chromium execution via Playwright / Buyer Arena.
- `SIMULATED_ONLY` — Operates over synthetic in-memory or mathematical models; not physical hardware.
- `PHYSICAL_TEST_PENDING` — Software and test protocol exist, but physical hardware trials have not yet been executed.
- `INDEPENDENT_VALIDATION_PENDING` — Requires external third-party lab, telco, or civil-protection authority validation.

---

## Master Claim-to-Evidence Table

**Evidence freshness:** GitHub [PR #8](https://github.com/abrahamhl/civic-relay/pull/8) is an unmerged engineering change until CI and review complete; PR source does not imply published or field-tested hardware. The latest production web alias is a different SHA. Do not re-label stale Buyer Arena work as tested on this branch.

| ID | Claim | Classification | Source Location | Verification Command | Artifact / Evidence Path |
|---|---|---|---|---|---|
| **EV-01** | Deterministic 20–100 virtual device emergency routing simulator with repeatable PRNG seeds | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` | `investor-next/lib/emergency-routing.mjs` | `node --test investor-next/tests/emergency-routing.test.mjs` | `evidence/oep-virtual-scenario-report.json` |
| **EV-02** | 810-scenario parameter sweep proves zero human-safety or accounting invariant violations | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` | `investor-next/scripts/oep-evidence-run.mjs` | `node --test investor-next/tests/oep-evidence-report.test.mjs` | `.github/workflows/emergency-lab-ci.yml` (`oep-synthetic-evidence` artifact) |
| **EV-03** | Silence (`UNKNOWN` / `NO_CONTACT`) never triggers an inferred SOS or casualty count | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` | `investor-next/lib/emergency-policy.mjs` (`recordSafetyResponse`) | `node --test investor-next/tests/emergency-policy.test.mjs` | `investor-next/tests/emergency-routing.test.mjs` |
| **EV-04** | Bounded store-and-forward engine enforces explicit consent, TTL expiry, deduplication, anti-replay tombstones, and synthetic transport receipt matching (not cryptographic identity verification) | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` | `investor-next/lib/store-forward.mjs` | `node --test investor-next/tests/store-forward.test.mjs` | `investor-next/app/transport-sandbox.tsx` |
| **EV-05** | Policy rejects CAP alerts without a caller-provided trusted-verifier assertion; production CAP issuer verification is NOT implemented | `IMPLEMENTED`, `AUTOMATED_TESTED`, `SIMULATED_ONLY` | `investor-next/lib/emergency-policy.mjs` (`acceptAuthorizedCapAlert`) | `node --test investor-next/tests/emergency-policy.test.mjs` | `investor-next/tests/emergency-policy.test.mjs` |
| **EV-06** | Multilingual (EN / ES / NL) investor & research web application with interactive 3D building lab and JSON evidence export | `IMPLEMENTED`, `BUILD_VERIFIED`, `BROWSER_TESTED` | `investor-next/app/*` | `pnpm --dir investor-next run build && pnpm --dir investor-next run check:locales` | `.github/workflows/investor-next-ci.yml`, `audit/personas/P01..P08/` |
| **EV-07** | Historical automated stakeholder browser results across 8 personas (78 checks on an EARLIER SHA; NOT re-run against current master) | `HISTORICAL_BROWSER_TESTED`, `STALE_FOR_CURRENT_SHA` | `abrahamhl/buyer-arena`: `scripts/civic-relay-review.mjs` | `node scripts/civic-relay-review.mjs` | `audit/personas/P01..P08/{run.json,evidence.json,feedback.md,screenshots/}` |
| **EV-08** | Experimental Android Nearby APK with consent, manual pairing digits, UUID+challenge ACK guard, strict synthetic-only file queue WIRED to MainActivity send/ACK/STOP in PR #8, dual-clock TTL and CSV export. `LabReceiptSigner.java` is separately JVM-unit-tested but NOT used in the live Nearby message/receipt flow; no authenticated ECDSA receiver identity claim. | `IMPLEMENTED`, `BUILD_VERIFIED`, `AUTOMATED_TESTED`, `PHYSICAL_TEST_PENDING` | `experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/*` | `gradle :app:assembleDebug` | `.github/workflows/android-nearby-ci.yml` (`oep-two-phone-lab-debug-apk` (30-day artifact retention)) |
| **EV-09** | Physical two-handset offline delivery rate, latency (p50/p95), and battery drain across 30 trials (validated by `investor-next/scripts/validate-field-trials.mjs`) | `PHYSICAL_TEST_PENDING` | `experimental/android-nearby/PILOT_ACCEPTANCE.md`, `investor-next/scripts/validate-field-trials.mjs` | `node investor-next/scripts/validate-field-trials.mjs` | `experimental/android-nearby/field_trials_template.csv` (awaiting filled dataset) |
| **EV-10** | Institutional CAP cryptographic authority verification, live satellite/NTN gateway relay, and 112/PSAP integration | `INDEPENDENT_VALIDATION_PENDING` | `docs/investor/PILOT_PROPOSAL.md` | Requires consortium partner integration | Planned TRL 5–7 milestones |
