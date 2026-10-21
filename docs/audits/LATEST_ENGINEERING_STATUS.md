# Civic Relay — Engineering status / investor truth gate
## RELEASE HARDENING — 22 October 2026 / PR #9

**Scope:** [PR #9](https://github.com/abrahamhl/civic-relay/pull/9) addresses **two previously reproducible gaps** found after PR #8 merged. These changes are not automatically evidence of a deployed production release.

1. **Nondeterministic build dependency graph:** `investor-next/package-lock.json` was missing while three GitHub workflows used `npm install`. A real clean GitHub Actions install produced a 36,515-byte npm lock v3 (70 packages, `next@16.4.2`), which is now tracked. CI switches to `npm ci` to abort on lock mismatch. The bootstrap logging step was removed after committing the lock.
2. **Misstated ephemeral key lifecycle:** Android `LabReceiptSigner` was a `final` Activity field: STOP revoked the peer map but the ECDSA signer remained reusable within the same Activity. PR #9 regenerates the key after explicit STOP and disconnected peers; JVM tests prove the old signature does not verify under the next session public key. **No phone-to-phone cryptographic interoperability has yet been validated.**
3. **STOP erasure warning hidden:** the Activity previously logged disk deletion errors and then cleared the same UI, potentially hiding the failure. The new order preserves a visible fail-closed warning and blocks further sends.
4. **Release parity gap:** the production host served a correctly localised **older Vercel preview** rather than the latest GitHub master source. The build now emits a public `release-provenance.json` with its exact source SHA (not a signed attestation), and `smoke:deploy` can enforce `EXPECTED_SOURCE_SHA` against the actual host. The environment must supply/build a real SHA for a *production* parity PASS. Absence of the proof or mismatch fails closed if parity is requested.

**Critical remaining distinction:** the source-level fixes, CI tests and the deployable static artefact are different from live release. Check [release issue #6](https://github.com/abrahamhl/civic-relay/issues/6) before treating the website as published at the latest SHA. The **overall TRL remains approximately 3**; working offline radio hardware is still unmeasured.

## PRE-PILOT ENGINEERING ASSESSMENT — 22 October 2026 (PR #8)

**Current merged scope:** [PR #8](https://github.com/abrahamhl/civic-relay/pull/8) was **merged into `master`** as [`159796d74ce6e0989b41940987d5c0163555c3fb`](https://github.com/abrahamhl/civic-relay/commit/159796d74ce6e0989b41940987d5c0163555c3fb). The exact pre-merge source SHA `455d34a682ddd898865689af33e708e7e4bc3af9` passed **5/5 GitHub Actions** including Android build/JVM, SCA/SBOM and eight actual Chromium QA tasks. This is machine-tested source, not physical delivery.

### Fixed failures and verifiable tests
| Finding | Baseline defect | Change made on PR #8 | Evidence / limitations |
| --- | --- | --- | --- |
| P0-A1 Android persistence | `LabPersistentQueue.java` existed but `MainActivity.sendTest()` did not call it; durability was overstated | Fixed synthetic-only disk queue is wired **before** Nearby send; actual ACK/STOP update and purge it; corruption or failed writes block new sends | JVM corruption/replay tests + debug APK compile; not physically measured; no automatic resend after restart |
| P0-A2 Cryptographic receipts | `LabReceiptSigner` was unit-tested but not called by the live Nearby flow | Protocol **v3** exchanges ephemeral P-256 keys after manual-digit-approved pairing, pins them by endpoint for the current session, signs receiver ACK, verifies before challenge check; unsigned v2 rejected | JVM ECDSA tests and Android build only; **not** institutionally rooted identity or field-proven exchange; key substitution threats require device adversarial trials |
| P0-A3 Sensitive data | TSV file is plaintext, generic payload allowed | Enforces fixed `SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS` only, rejects arbitrary PII and malformed persisted records; STOP/onStop erases local file | **Not encryption**; user data must NOT be stored or transmitted |
| P0-W1 Vulnerable dependency | `next@16.3.6` triggered HIGH GitHub advisory findings during a newly enabled `npm audit` | Pinned `next@16.4.2` following npm's remediation; CI now refuses high/critical production vulnerability results and archives CycloneDX SBOM | Only mark remediated after exact-final-SHA audit PASS; lockfile/transitive reproducibility not yet fully solved |
| P1-Q1 Persona evidence stale | Historic Buyer Arena P01-P08 files are from an earlier SHA; current release used only 3 Chromium smoke tasks | [Browser release QA](../../.github/workflows/browser-release-qa.yml) now performs **8 distinct actual Chromium tasks**, one per P01–P08, logging observed action/results and screenshot JSON; P04 exports generated real synthetic evidence | **Automated scripts, not 8 real people** and **not a fresh execution of the Buyer Arena CLI**; zero hardware inference |
| P0-F1 Grant compliance | Funding pitch still recommended NLnet and allowed AI writing despite v2 policy | [Funding opportunities](../investor/FUNDING_OPPORTUNITIES.md) and [financial scenarios](../investor/FINANCIAL_SCENARIOS.md) now block GenAI-assisted NLnet submission and mark all budgets unverified | Read-only evaluation only. NLnet v2 forbids proposal GenAI and AI-generated funded deliverables |
| P0-R1 Release domain | Public alias served a build older than current `master` | Existing single-domain code gates and historical redirect retained; source and actual served SHA documented separately | **Partially corrected:** official alias now serves a READY preview with identical investor-web source, `/`, `/es/`, `/nl/` independently verified; Git-driven master production release automation is STILL unresolved |

### Transparent internal score — constant weighted rubric (NOT a grant-provider rating)
Weights and approximate retrospective baseline/conditional current score:

| Dimension | Weight | Baseline 21 Oct | Conditional after full PR #8 CI & merge | Why |
| --- | ---: | ---: | ---: | --- |
| Architecture / boundaries | 15 | 10 | 11 | Existing simulation solid; cleaner Android protocol boundary |
| Safety / privacy / cryptography | 20 | 7 | 10 | Fixed lab PII allowlist and session-level ACK signatures; still not independently audited |
| Offline reliability / persistence | 15 | 6 | 9 | Actual queue wiring, corruption fail-closed and atomic replacement; still one hop |
| Automated QA and reproducibility | 10 | 7 | 10 | Eight genuine Chromium role tasks, Android adversarial regressions, SCA + SBOM; lockfile is still a gap |
| Usability / multilingual web | 10 | 8 | 8 | EN/ES/NL, limitations and design kept; not independently WCAG certified |
| Eligibility / commercial plan | 5 | 3 | 3 | Truthful claims; no funded partner agreement or legally established eligibility |
| Release operations | 5 | 2 | 3 | Live alias now serves reviewed site tree and all three routes; automatic deployment/legacy redirect proof still open |
| Physical / external validation | 20 | 0 | 0 | No field evidence, no third-party responder evaluation |
| **TOTAL** | **100** | **43** | **54 provisional** | **Gain is limited to independently machine-checkable software evidence** |

**Score rule:** 54 is an **internal provisional assessment** after the PR #8 exact-SHA machine tests and squash merge. It is NOT independently audited or a financing/certification approval. **Global TRL stays approximately 3.** This project is fit for *research partner discussions*, not operational emergency deployment.

**Canonical live release gate:** `civic-relay-investor.vercel.app` is assigned to Vercel READY deployment `dpl_Hm4YDkX53r81KnTQA8JPmG3KCg2h`, source SHA `0804f2327477e46d45230a90ef3cb4523ab1bcce`. Comparing this build to the final reviewed PR head showed **only Android signer code and this audit documentation** changed; the investor website source was identical. Independent live fetch verified EN `lang=en`, ES `lang=es`, NL `lang=nl`, canonical tags, research disclaimers and no navigation links to stale sites. The code merged into master is newer and Vercel Git production branch/preview mapping still needs a durable correction; [issue #6](https://github.com/abrahamhl/civic-relay/issues/6) remains OPEN. No claim of deployed physical networking.

**Latest exact-SHA CI evidence:** [Browser eight-task QA](https://github.com/abrahamhl/civic-relay/actions/runs/39690193482) (JSON + screenshots), [Android JVM + experimental APK](https://github.com/abrahamhl/civic-relay/actions/runs/39690193435), [Site build/SCA + CycloneDX inventory](https://github.com/abrahamhl/civic-relay/actions/runs/39690193459); all green. Eight scripted browser stakeholders ≠ eight humans or full Buyer Arena CLI.

### Outstanding investment blockers / next gate
1. **P0 release**: Vercel production SHA must equal the reviewed `master` (or an explicitly reviewed release SHA); live `/`, `/es/`, `/nl/` must have correct `html lang`, canonical links and zero stale marketing claims. [Issue #6](https://github.com/abrahamhl/civic-relay/issues/6).
2. **P0 security**: independent audit of ephemeral Nearby-key binding, replay/forgery tests, encrypted storage design for any future non-fictional content, supply-chain lockfile, privacy/DPIA for proposed use cases. [Issue #4](https://github.com/abrahamhl/civic-relay/issues/4).
3. **P0 physical**: two explicitly consenting phones and full ≥30 recorded attempts with failures and latency; still missing. [Issue #5](https://github.com/abrahamhl/civic-relay/issues/5).
4. **P1 licensing / funding**: confirm legal entity and consortium path. Horizon SSRI-04 remains a research partner opportunity only; NLnet cannot be treated as immediately available under AI-assisted development. No applications have been sent during this audit.

### Agent 2 funding handoff — verified scope
Open-source software models **explicit opt-in SAFE/SOS → TTL-bounded local queue → compatible route choice → correctly typed receiver ACK**. Browser WebCrypto and real local browser interactions coexist with synthetic graph/RF/NTN models. Android provides a single-hop experimental Nearby prototype with manual code verification and a v3 source-level signed receipt path, **not a validated physical network**. Next fundable technical work package: independent review + consented two-phone physical validation, then three-phone authenticated multi-hop. Do not claim satellite transmission, CSI through walls, government alerts, a working rescue service, partner endorsement, or 112 integration.


## CURRENT RELEASE UPDATE — 21 October 2026 (later CTO verification)

**One public domain:** [https://civic-relay-investor.vercel.app](https://civic-relay-investor.vercel.app) with `/`, `/es/`, `/nl/`. Vercel alias **confirmed assigned** to deployment `dpl_2JiFK5wWFZPMkr9wLsyU84Niccdc`, SHA `dd35abec52d70ec27196a87ccca4384a9a12c670`, state `READY`. These three **public routes** were fetched and localized content and canonical metadata inspected successfully. **Caveat:** this served SHA still has incorrect `html lang=en` on ES/NL routes; don't claim this public defect fixed until a newer build is published.

**Historical domain:** `civic-relay-pi.vercel.app` alias reassigned to build `dpl_7RDvPFMYUXKRhYdMYp9nurp7ZYrG` (READY) containing a permanent 308 catch-all redirect to the official domain. Vercel configuration is in root `vercel.json`. Third-party HTTP extraction returned an empty-content error for that redirect and cannot independently confirm the observed status code. The unowned older name `civic-relay.vercel.app` is NOT a controlled domain and cannot be promised a redirect.

**New source changes (not yet live):** proper distinct static Next.js root layouts for EN and ES/NL in `investor-next/app/(en)` and `investor-next/app/(localized)/[locale]`; source-gated domain audit; translated HTML `lang`, Three.js retained, and real Chromium browser release QA. At commit `b6be6615730938fd614adcc44f25dba59a2500cc`, all **four** workflows passed: main CI, investor microsite, emergency research, and [real Chromium QA](https://github.com/abrahamhl/civic-relay/actions/runs/39681164899). That CI performed three real browser navigations (automated personas P01/P03/P08) on the **local static artifact** and uploaded screenshots plus individual JSON: [oep-browser-release-qa artifact](https://github.com/abrahamhl/civic-relay/actions/runs/39681164899/artifacts/12383623834). This is not Buyer Arena's full eight-persona rerun and it is not a hardware test.

**Publication constraint:** Vercel rejected an extra API deployment with `402 api-deployments-free-per-day` (over 100 free API deployments in the current 24-hour window). Therefore the newest per-locale HTML fix is still source/CI verified but NOT publicly served; do not assign the older SHA's production status to this newer commit. Do not purchase an upgrade or increase spending silently. Monitor actual master→production Git deployment and validate new alias SHA before marking the release finished.

**Measured release gate improvement:** automatic domain consistency gate, a root-layout accessibility fix, CI pass and evidence-bearing real Chromium tests. **Unchanged product gate:** global diagnostic TRL ≈3, no physical two-phone ACK and no operational emergency readiness. Neither commit count nor green website tests warrants a higher overall hardware score.

**Review date:** 2026-10-21 UTC. **Working branch:** `audit/funding-truth-gate-20261021`, downstream draft PR [#7](https://github.com/abrahamhl/civic-relay/pull/7). **Production remains unchanged by this review.** This report is an evidence register, NOT certification.

## Executive decision (scope-specific)
- **Software research / controlled laboratory:** CONDITIONAL GO for synthetic data, explicitly opted-in participants and lab-only devices; subject to green checks on the exact final commit.
- **Investors / consortium exploratory outreach:** CONDITIONAL GO using this evidence boundary and accurate public links, with no operational performance, technology-readiness, applicant eligibility or procurement claim.
- **Real emergency response / location of trapped people / institutional dispatch:** NO-GO. No 112/verified-CAP/live NTN integration or validated through-wall sensing.

**Diagnostic baseline:** 43/100, global TRL approximately 3, from 2026-10-21 prior audit. **After-change score:** unassigned (no uplift until final SHA CI, live browser, independent review, physical validation). Components must never inherit another subsystem's TRL.

## Capability → file → evidence → risk → next gate
| Capability | Source | Evidence/status | Risk / truthful boundary | Next gate |
|---|---|---|---|---|
| Deterministic routing under outages | `investor-next/lib/emergency-routing.mjs` | SIMULATED_ONLY / repository Node unit and scenario checks on earlier SHAs | Virtual nodes, modelled routes, synthetic performance | Preserve seed and final-SHA scenario artifact |
| Consent, TTL, unknown safety status | `investor-next/lib/emergency-policy.mjs` | UNIT_TESTED on prior SHAs | No OS-wide auto permission, no real CAP issuer trust | Independent safety and institutional threat review |
| Store and forward, dedup, challenge and synthetic ACK | `investor-next/lib/store-forward.mjs` | UNIT_TESTED in prior CI; synthetic adapters | Local clear does not imply deletion at remote peers; no production identity | Privacy/security issue [#4](https://github.com/abrahamhl/civic-relay/issues/4), real peer trust |
| Browser cryptography & data channel | `investor-next/lib/live-protocol-node.mjs`, `app/live-hardware-console.tsx` | WebCrypto implemented; WebRTC is SAME-PAGE loopback, BroadcastChannel same-origin | Neither establishes offline phone-to-phone delivery; localStorage holds demo packets | Real two-device end-to-end signed ACK |
| RF/CSI wall attenuation / overlay | `investor-next/lib/telecom-suite.mjs`, `app/telecom-rf-radar-suite.tsx` | SIMULATED_ONLY / mathematical models | No handset CSI measurement; no people/device detected behind a wall | Approved instruments, acquisition, geometry, ground-truth calibration, independent study |
| NTN satellite frame and orbital model | `investor-next/lib/telecom-suite.mjs`, `lib/live-protocol-node.mjs` | CODE / SIMULATED_ONLY | Binary codec ≠ licensed NTN uplink or operational satellite orbit feed | Spectrum rights, operator gateway, external test |
| Nearby Connections one-hop Android | `experimental/android-nearby/` | Source and prior CI APK build; PHYSICAL_PENDING | No measured cross-handset offline ACK or 30-trial dataset | [Issue #5](https://github.com/abrahamhl/civic-relay/issues/5): 10 baseline + 5 permission + 5 interruption + 5 replay + 5 TTL |
| Investor web, Three.js, EN/ES/NL | `investor-next/` | Prior CI build; corrections in draft PR #7 | Public alias remains on earlier deployment until separately verified/promoted | Exact-SHA build, browser check, alias/branch parity |
| Buyer Arena personas P01–P08 | `audit/personas/P01..P08/` | HISTORICAL_BROWSER_TESTED files on PR #3; provenance states earlier SHA `c18c6ac` | Reports are not tests of this final patch; do not write new PASS outcomes | Re-run Browser/Buyer Arena on exact preview SHA with traces, screenshots, console and timestamps |
| Intellectual property and compliance | root `LICENSE` | MIT codebase / SPDX review pending | Open-source reuse allowed; no exclusive rights, ISO/ENS/GDPR certification | Legal/compliance and supply-chain review |

## CTO corrective commits — audit branch, NOT production
1. `94b3902`: browser refuses fake microphone FFT after denied permission; cross-tab timestamp no longer shown as measured WebRTC RTT; lab RTT labelled same-page.
2. `9127c9a`: replaced speculative grant catalogue and inflated auto-generated proposal prompts with one multilingual source-gated catalogue. NLnet proposal button remains disabled; v2.0 restriction disclosed.
3. `40f7b89`: changed EN/ES/NL radar target, live-camera overlay, satellite enable, comparison headlines and canvas from misleading detection/transmission language to simulated-only.
4. `e4e478d`: added 3 source regression tests preventing misleading UI labels returning.
5. `49df40d`: corrected stale funding test to assert eight unique source-gated entries rather than duplicate fictional programme entries per language.
6. `808d9c7`: fixed a Dutch TSX string quoting error identified by GitHub Actions. Full build and release gates need fresh green evidence; errors must not be hidden.

## Five independent audit lenses & outstanding blockers
- **A Architecture:** RESEARCH-ONLY; Android one-hop code not proof of mesh; real NTN/CSI remains absent.
- **B Security/privacy:** P0 gate: retain synthetic messages only. Browser `localStorage` and Android file-backed storage are not reviewed secure E2EE stores. Issue #4 stays OPEN. STOP/revocation only controls known local references.
- **C QA/release:** three workflows were green on older PR #7 SHA `1da2b3c`. That does not certify later commits. Exact-final-SHA CI and field evidence are required.
- **D UX/publication:** obsolete Vercel production alias: `civic-relay-investor.vercel.app` observed pointing to Vercel deployment `dpl_Ev17SYE2Us1VcbJEZKqe7nYpDHA5` from older experimental SHA `012233e`; new PR previews must not be confused with production.
- **E Finance/eligibility:** Horizon `HORIZON-CL3-2026-01-SSRI-04` deadline 2026-11-05 confirmed from [EU Funding & Tenders](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?callIdentifier=HORIZON-CL3-2026-01). NLnet Restack: 2026-11-03 12:00 CET, awards generally €5k–€50k ([official call](https://nlnet.nl/restack/)). Critically, [NLnet AI policy v2.0](https://nlnet.nl/foundation/policies/generativeAI/2.0/) bars GenAI-authored applications and limits GenAI in funded work. Civic Relay's AI-assisted development creates a substantial eligibility risk; do not write/submit an NLnet application using an agent.

## Release and funding handoff for Agent 2
**Problem:** communications coordination degrades during outages; conventional connectivity is not always available. **Approach:** open-source research layer that models opt-in safe/SOS status, consent, bounded queue and adaptive transport choice over *existing authorised networks*; does not replace carriers or responders.

**Demonstrated to date:** deterministic simulation, queue engine and security-state unit tests, browser WebCrypto signed packets, same-page WebRTC proof-of-concept, trilingual interactive site, source of opt-in Android Nearby one-hop experimental lab and earlier build. **Not demonstrated:** real two-phone offline message+ACK, physical mesh/multi-hop, reliable emergency delivery, satellite uplink, RF/CSI sensing or "seeing through walls", official CAP/112, privacy certification, volunteer or institutional participation, TRL 5–9 or commercial customers.

**Financiable next milestones:** M1 instrumented 30-trial two-handset pilot; M2 authenticated three-node relay with failure-injection and battery/latency measurement; M3 independently reviewed DPIA/threat model; M4 responder-supervised laboratory evaluation; M5 eligible consortium design after actual letters of intent. Budget lines and dates are hypotheses until validated.

**Potential partner path:** Horizon SSRI-04 as a consortium technical research partner if accepted and legally eligible; EIC/VC only on later milestones; NLnet only if the human-authored application and entire funded development comply with its stricter policy. **No institutional endorsements, grant approvals, or funding promises exist in this report.**

**Mandatory separate release check:** inspect final SHA workflows; navigate `/`, `/es/`, `/nl/` on the exact preview; verify Vercel deployment Git source, status and alias, manually test WebRTC timeout, microphone-denied and RF camera permissions; run actual Buyer Arena P01–P08 to regenerate metadata artifacts; obtain two devices and willing participants for issue #5. **No production promotion authorized by this report.**
