# OEP reality roadmap — 24 October 2026

Remote base: 619359356700c10c9da8d9d1895f007fe09876e0. Isolated local checkout on exact PR #3 branch. Tested implementation/build head: 2e2e73e. Later documentation/evidence commits do not alter that implementation. No pushes or deployments.

| Cycle | Software work | Evidence / remaining boundary |
|---|---|---|
| 1 baseline/privacy/P1 | Done in bounded scope | Remote collaborator fixes preserved; 87 baseline tests pass; P1 four failing reproductions followed by 28 passing focused regressions. Independent privacy review pending. |
| 2 fabricated data/ACK | Identified paths corrected | Default radar has no targets; opt-in synthetic emitters; no person/battery/network substitutes or automatic SOS. Three truth reproductions fail before and pass after. |
| 3 routing/cancellation | Browser-lab scope done | Abortable deadlines/loopback, bounded inbox, UUID, freshness, replay/concurrency regressions. Enrolled trust and inter-device routing unverified. |
| 4 RF/sensors | Software contract done; hardware pending | Permission-gated browser adapters, BLE Battery Service fixture, serial permission-only, USB diagnostic. No SDR/CSI driver or actual receiver integrated. |
| 5 scientific rigor | Identified models corrected/reclassified | Observer-independent ideal orbital geometry, no hidden elevation floor, UNKNOWN uncertainty/source epoch, exact frame/reference-byte comparison. No physical calibration or observed orbital propagation. |
| 6 UX/i18n/accessibility | Tested scope done | Required narrative/Three.js/anchors/languages preserved; 41 browser checks, 15 layouts, 200% CSS zoom, keyboard, reduced motion, fallback. Six axe runs report zero violations; incomplete/manual checks remain. |
| 7 integration/evidence | Done locally | 107 web + 26 core tests; five JVM suites/186 assertions; builds/types/locales; 810 synthetic runs/12,150 invariants; matrix/audit/receipts/local commits. No remote CI for unpublished commits. |

## Next actions, by impact and effort

1. Physical acceptance, highest impact: two consenting Android phones, exact-SHA APK, controlled setting and independent reviewer. Follow PILOT_CAPTURE.md; at least 30 trials, including failures. Fixtures cannot satisfy this gate.
2. Privacy/security, highest impact: independent issue #4 review; enrolled identity, receiver consent, retention/export handling and malicious-peer boundaries before personal emergency data.
3. Android reproducibility, medium effort: provision SDK35/build-tools35 and Gradle8.11.1; run assembleDebug against exact source. JVM/base-SHA remote APK evidence is not physical delivery.
4. RF integration, high effort: choose one documented receiver/firmware and implement an authorized receive-only calibrated bridge. Current sample contract is fixture-tested only.
5. Research calibration, high effort: consented signal/battery/acoustic/localization observations and reliable orbital elements/validated propagation before contact predictions.
6. Accessibility/product focus, medium effort: manual screen-reader/contrast review and optional detail panels for technical/funding material. Full-page heuristic usability score: 6/10.
7. Publication, separately gated: prove whether push triggers Vercel. No payment/production promotion/repeated previews. At most one post-recovery preview check/attempt per day, with exact-SHA green CI. Clone push defaults disabled until a release decision.

## Operational decision

NO-GO for real emergencies. Issues #4/#5 remain open. No physical trials, external assurance, satellite access, live CAP trust or rescue outcomes. SOFTWARE_TESTED/SIMULATED cannot satisfy HARDWARE_TESTED, PHYSICALLY_TESTED or EXTERNALLY_VALIDATED gates.

## Follow-up requested by the user — interactive building

The building screenshot is now a connected, bounded mission at `/es/#routing-lab`: explicit fictional response, real local queue/controller, computed model path and synthetic receipt. The original twelve-step research UI remains in a collapsed independent advanced panel. No radio, physical measurement or operational readiness promotion.

Validation: 112 web tests, static build/types/locales, 51 browser checks, ES/EN/NL layouts at 320/375/768/1440, six scoped axe runs and startup/context-loss 2D fallback. See [the focused UX audit and receipts](BUILDING_MISSION_UX.md). Historical baseline counts above describe the earlier checkpoint; this addendum records the subsequent building implementation. Manual assistive-technology and new-user comprehension testing remain pending.
