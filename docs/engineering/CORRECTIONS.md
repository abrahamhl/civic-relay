# Correction ledger

## R01 — bounded asynchronous adapter operations

Severity P1: a never-settling describe/send locked dispatch and serial retryDue forever; revoke/purge could not settle the pending promise. Purging/reusing an ID shared a stale lock.

Reproduction: `node --test investor-next/tests/adapter-deadline.test.mjs` — four failures in evidence/2026-10-24/p1-before.txt.

Fix: configurable 1–60,000 ms operation timeout (default 5 seconds), bounded by envelope TTL; cooperative AbortSignal; revoke/purge/expiry cancel; record-scoped locks prevent old finally handlers unlocking newer records. Late failures do not recreate purged audit events.

Regression: deadline and store-forward suites, 28/28 pass, p1-after.txt. Adapter-held copies cannot be recalled or securely erased; a malicious adapter ignoring cancellation remains outside the local coordinator's control. Commit: 9d1f7e8.

## R02 — RF/demo separation and illustrative orbital provenance

Commit 7145f50. Three truth failures reproduced (phantom RF targets, missing synthetic provenance, observer-dependent orbital subpoints), then focused 15-test regression passed: truth-before.txt / truth-after.txt. Radar defaults to zero targets; DEMO has synthetic emitters without bodies/respiration/fake confidence. Orbital model is corrected/reclassified with unknown uncertainty and no observed epoch. Camera positive-on-denial branch was source-confirmed; final browser injection verifies unavailable state. Added permission-gated adapters, BLE Battery Level fixtures and bounded RF sample contract. No RF driver is claimed.

## R03 — receiver, storage and loopback truth

Commit c481180. Baseline loopback ignored abort and ended in TIMEOUT after 80ms (loopback-before.txt); current test closes both peers immediately and blocks late offer/send work (loopback-after.txt). Pre-existing receiver lacked admission/replay/freshness limits; dynamic adversarial inbox tests cover real signatures, UUID/time/size/status checks, concurrency and clear while verifying. Console removes automatic SOS and missing battery/network substitutes; UUID/ref-based queue writes, retention, storage write/purge readback, cancellation, safe funding prompts and clipboard failure state added. Browser evidence proves only local loopback/same-origin tabs, never inter-device delivery. receiver-after.txt and browser-qa.json archive results.

## R04 — layout, hydration and accessibility

Commit 7954fbf. Browser reproduced orbital FSPL serialization 180.8292709465754 vs 180.82927094657543 causing hydration mismatch; display formatting fixed in R03. Browser also exposed 320px grids, Dutch headings and desktop header collisions. Layout corrected; QA waits for fonts/two layout frames after an initial font-loading measurement race. Final browser-qa.json: 41 checks, 15 layouts, zero page errors; screenshots visually inspected.

axe-before.json reproduces invalid labelled-div role. Expanded audit found non-focusable scroll log and selected-scenario contrast (axe-expanded-before.json). All corrected; axe-after.json reports zero violations in six locale/width runs. Incomplete/manual review remains. Added keyboard tab controls, context-loss fallback and 200% CSS zoom verification; no accessibility certification.

## R05 — reproducible installs/local review

Commit d9b822c. Committed investor lockfile and npm ci --ignore-scripts in both CI paths. Fresh local npm ci, typecheck, static build and locale checks pass. Next react-jsx setting retained. Auto-generated agent files created this run were removed with an environment receipt after reading matching bundled docs; agentRules:false prevents regeneration. Loopback-only static preview preserves language routes. No remote pipeline/deployment triggered.

## Environment corrections, not product fixes

Initial isolated core tests lacked dependencies/dist modules (baseline-core.txt); frozen PNPM install and workspace build resolved this, with 26/26 passing core tests. No core source changed. One inherited source-text assertion expected the old receiver call; its integration assertion was updated and dynamic adversarial tests verify behavior. Verbose intermediate source-dumping output stays local, with a compact evidence summary committed.

## R06 — security dependency advisories

Commit2e2e73e. Dependency metadata reproduction: investor next16.3.6 had critical advisory matches; workspace had1 critical/3 high/3 moderate. No external exploit was attempted or claimed. Next16.4.3, patched PNPM transitive overrides and Zod4.6.6 remove all production-audit matches. Zod migration needs only explicit string keys in z.record; builds/types and26 core tests pass. Parser6-to7 compatibility is checked by the full Vite build and identical emitted CSS SHA-256. Investor107 tests, static build/locales and41 browser checks were repeated on the patched version. Primary maintainer advisories, before/after audit JSON and source version sync live in the security audit/receipts. Future audit results may change; zero package advisories does not certify application safety.
