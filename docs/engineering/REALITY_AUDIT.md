# OEP reality audit — 24 October 2026

**Result: reproducible local hardening delivered; NO-GO for real emergencies.** Six local implementation/build commits correct demonstrated software defects. Physical RF, phone-to-phone routing and external privacy/security assurance remain pending. All work is in an isolated checkout of the exact PR #3 branch. No push, merge, GitHub comment/issue update, preview, production deployment, paid model, personal emergency traffic or radio experiment was performed.

Start here: [evidence matrix](EVIDENCE_MATRIX.md), [correction ledger](CORRECTIONS.md), [roadmap](REALITY_ROADMAP.md), [pilot capture](PILOT_CAPTURE.md), [RF contract/model limits](RF_ADAPTER_CONTRACT.md).

## Current technical truth

Remote PR #3 HEAD was checked through GitHub metadata and Git fetch/ls-remote: `619359356700c10c9da8d9d1895f007fe09876e0`. Original local checkout was behind at `37f479c`; collaborator fixes were incorporated through a fresh shared-object clone before coding. Existing queue fingerprint removal, Android log epoch guards, signed-field binding, invalid-signature rejection, microphone-denial and local-loopback fixes were preserved. Issues #4 and #5 remain open.

The original checkout `C:\dev\02_PROJECTS\civic-relay` was not edited or switched. Delivery checkout: `C:\dev\_WORKTREES\civic-relay-reality-20261024`, branch `feat/master-emergency-routing-v1-20261020`. Local implementation/build head is `2e2e73e`; subsequent commits archive documentation/evidence only.

Architecture: PNPM workspace with schemas/transports/core/API and Vite app; independent static Next.js 16.4.3/React19.2/Three0.180 investor experience; Java Android Nearby experiment; deterministic Node simulation and JVM CI. No new model provider, cloud integration or hardware driver was invented. ASSET_MAP.md records source reuse.

## Five principal problems, ordered by severity

1. **P1, corrected — hung adapter promises prevented cancellation and progress.** Describe/send could never settle, leaving dispatch/retryDue locked after revoke/purge. Added TTL-bounded operation timeouts, cooperative abort and record-specific locks. Four reproductions failed before; focused 28-test regression passes. Adapter-held copies cannot be forcibly erased.
2. **P1/P2, corrected in browser scope — stale/replayed/unbounded incoming work and late UI updates.** Added bounded inbox admission before crypto, UUID/status/zone/time validation, immutable packet copies, concurrent dedup and clear epochs. Same-origin self-signed packets remain UNTRUSTED. WebRTC clear aborts pending peers and blocks late negotiation/send work. No inter-device delivery or enrolled identity exists.
3. **P1 product-truth defect, corrected — synthetic RF/observer-relative positions presented as live measurements.** Default radar now has no targets or CSI; explicit DEMO contains synthetic emitters, no bodies, respiration, SOS or battery identities. Camera denial cannot activate a positive live state. Orbital subpoints are observer-independent but remain illustrative, with no source epoch and UNKNOWN uncertainty. Removed battery/network substitutes and automatic fictional SOS signing.
4. **P2, corrected in tested viewports — clipping, hydration and accessibility failures.** Cross-runtime float serialization caused React hydration mismatch. Formatting now states illustrative precision. Corrected 320px card widths, Dutch headings, desktop nav/language collisions, case-tab keyboard behavior, scroll-log keyboard focus, selected-scenario contrast and an invalid ARIA label role. Context loss reveals a static globe fallback. See browser/axe before-and-after receipts.
5. **Release blocker, pending — no physical or independent operational evidence.** No RF receiver, Android SDK/Gradle toolchain or two consenting phones was available. Pure JVM tests do pass. Privacy issue #4 still needs independent review; issue #5 still needs 30 authenticated/documented physical trials. Neither CI nor a self-reported CSV can satisfy those gates.

## What was executed

- Investor Node regression: 107/107; core: 26/26. Initial failures from missing workspace dependencies were resolved by a frozen PNPM install and build, rather than ignored.
- Workspace build and typecheck, independent Next static build, npm ci, ES/EN/NL export checks: pass. CI now uses the committed investor lockfile rather than resolving a new dependency tree each run.
- Portable Temurin JDK17 ZIP verified against the official API SHA-256; five unchanged Java suites pass 186 assertions. No system Java settings changed. Local assembleDebug was not executed because Android SDK35/build-tools35 and Gradle8.11.1 are absent. Base-SHA GitHub Android build success is separately recorded and not attributed to local commits.
- Browser: 41/41 checks; EN/ES/NL at 320, 375, 390, 768, 1440px; initial HTML language; six anchors; keyboard focus/tabs; reduced motion; 200% CSS zoom; injected camera denial, storage failure and context loss; native WebCrypto, matching same-browser loopback, second-tab verification/replay rejection and storage purge readback. Hardware-error injections are fixtures, not hardware tests.
- Offline browser after initial load: signing and local purge work; loopback returned TIMEOUT without a fake receipt. Investor site offline reload/cache guarantees were not established. Historical Vite PWA build succeeded, but its full UI was not manually exercised.
- axe4.14, three locales at 375/1440: zero reported violations after fixes; incomplete contrast/ARIA analyses and assistive-technology review remain. No WCAG certification claim.
- Deterministic model: 810 synthetic runs / 12,150 invariant checks. No physical battery/latency/RF performance is inferred.

## Dependency security remediation

The installed investor package initially had Next.js16.3.6 and critical advisory matches. It was upgraded to16.4.3 after checking the primary maintainer advisories/release. The workspace audit initially had1 critical,3 high,3 moderate advisory matches. Exact PNPM overrides patch proxy-addr2.0.8, body-parser1.20.9, qs6.16.0, source-map-js1.2.2 and postcss-selector-parser7.1.6; schemas upgrade to Zod4.6.6 with one explicit record-key API adaptation. Complete workspace rebuild/types/core tests pass. Vite CSS is SHA-256-identical before/after the parser upgrade.

Final production dependency audits report zero current advisories for both trees. This is dependency metadata remediation, not an exploited-vulnerability reproduction or independent security clearance. Next server advisory preconditions were not exercised: this site is statically exported, image optimization is disabled, and no Cache Components feature was enabled. Primary sources and receipts are in docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md and dependency-audit[-before].json / workspace-dependency-audit[-before].json. Historical Vite React/Three postprocessing peer-version warnings and large JS bundle warnings remain; its full UI still needs separate manual verification.

## Security, privacy and science boundaries

Browser lab freshness is a fixed 60-second window with 5-second future-clock tolerance. It is not clock synchronization or an emergency dispatch protocol. Signature validity authenticates possession of a supplied key, not a person, institution or authorization. Same-origin malicious scripts/tabs remain inside the browser trust boundary; no XSS resistance, external pen test or persistent enrolled identity is claimed.

Local queue is limited to eight signed lab packets and TTL-cleaned while open/on next load; browsers may suspend timers, retain disk remnants or deny storage. Purge verifies the storage key is absent and invalidates local asynchronous writers. It cannot revoke already exported/received data, cryptographically erase browser memory or attest destruction of backing storage. Keep messages synthetic pending independent privacy review. Camera/mic/location data from RF Explorer are not stored or transmitted by that component.

Optional SDR/CSI bridge is a fixture-tested sample contract only. Web Serial selects a port without opening an unknown protocol. WebUSB diagnoses missing supported hardware/driver. BLE implements a service-filtered standard Battery Level read, tested with fixtures; physical BLE interoperability is unverified. No RSSI, CSI, spectral capture, hidden-person sensing or satellite service comes from a conventional browser camera.

The 24-byte encoding contains a CRC and a non-cryptographic short tag; the separate ECDSA-signed JSON envelope is much larger. Nominal frequencies, wall attenuation, ideal orbits, sector damage/connectivity, predicted battery life and scenario benefits remain model assumptions, not calibrated measurements. See RF_ADAPTER_CONTRACT.md for units, formulas, provenance and missing observations.

## Usability and product alignment

Heuristic usability score: **6/10 for the complete experimental page**, a reviewer judgment rather than a measurement. Tested interactions now expose failures and availability, but the page remains long and combines research, technical controls and funding. The prescribed WhatItDoes, ScrollExperience, six-stage SystemExplained, CoordinationLab, DeveloperBlueprint, EvidenceBoard, six-anchor mobile nav, Three.js and three languages are preserved.

Next product iteration should prioritize one visible task: choose the lab, authorize a compatible sensor, inspect provenance, STOP, then consult evidence. Keep advanced models/funding behind optional detail panels once a separate UX change is authorized. EvidenceBoard now states software/simulation/hardware boundaries and links directly to live sensor status; no unpublished GitHub matrix link is shown.

Alignment: a reproducible opt-in research prototype with explicit receipt/identity limits is supported by the evidence. An operational multi-radio emergency platform, physically verified CSI rescue sensor, certified satellite terminal or validated public-alert authority is not supported. No definitive ChatGPT/Grok/Obsidian strategy document was supplied for this project; alignment here is to the attached OEP directive. No unrelated AnomalyOS vault or document duplication was created.

## Technical/commercial viability

Viable now as an experimental software demonstrator and developer test lab. A paid operational emergency product remains unvalidated: hardware interoperability, reliable offline delivery, threat review, operator/institutional access, privacy decisions and pilot outcomes are unresolved. No customer, revenue, eligibility, funding availability, certification or market-size claim was established. Inherited funding figures/dates are explicitly UNVERIFIED; copied prompts now require current official-source checks and forbid unsupported capability claims.

## Local-only delivery and next action

Local preview: run `python scripts/serve-reality-preview.py` from the delivery checkout; browse `http://127.0.0.1:8766/es/`. The helper binds only to loopback and maps exported ES/NL routes. Build first with `npm ci --ignore-scripts --prefix investor-next` and `npm run build --prefix investor-next` when recreating the demo.

No Vercel recovery check or preview request was attempted. Git auto-deployment behavior was not proven safe, so all commits remain local. This clone has `remote.origin.pushurl=DISABLED_LOCAL_ONLY` and `push.default=nothing`; ordinary pushes fail. Explicit alternate URLs/other clients can bypass those local defaults, so these are not a network sandbox. No remote settings were changed. No master merge occurred.

**One next physical action:** arrange two consenting Android phones and capture the 30-trial pilot against an exact APK SHA using PILOT_CAPTURE.md. In parallel, independent privacy review can proceed using issue #4's residual limits. No emergency activation is authorized by this audit.
