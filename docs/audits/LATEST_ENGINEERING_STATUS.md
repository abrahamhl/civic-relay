# Civic Relay — Engineering status / investor truth gate
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
