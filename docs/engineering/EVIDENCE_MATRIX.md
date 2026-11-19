# OEP evidence matrix — 24 October 2026

Base remote: `619359356700c10c9da8d9d1895f007fe09876e0`. Tested local implementation: `2e2e73e` (including all six corrective/build commits below). Evidence directory: [2026-10-24](evidence/2026-10-24/). Software evidence never promotes physical claims.

| Function | Implemented | Executed this run | Physically measured | Classification / limitation |
|---|---|---|---|---|
| Next.js / React / TypeScript / Three.js investor site | Yes | Build, typecheck, browser render | No | SOFTWARE_TESTED; no deployment claim |
| ES / EN / NL | Yes | Export markup checks, initial HTML language, browser routes | No | SOFTWARE_TESTED; 3 locales × 5 widths |
| Original narrative / six-stage journey / six anchors | Preserved | Existing integration tests and browser anchor checks | No | SOFTWARE_TESTED; no content removed from required sections |
| Three.js globe / reduced motion / fallback | Yes | Reduced-motion browser; injected WebGL context loss | No | SOFTWARE_TESTED; visual scene is SIMULATED |
| Routing / retry / TTL / dedup / synthetic ACK | Yes | Node tests + 810 deterministic runs / 12,150 invariants | No | SOFTWARE_TESTED engine; SIMULATED transports |
| Adapter deadline / STOP / purge | Fixed | Four failing reproductions, then 28 passing focused regressions | No | SOFTWARE_TESTED; foreign adapters must cooperate with abort |
| WebCrypto ECDSA P-256 | Yes | Native Node and Chrome signatures/verification | No RF delivery | SOFTWARE_TESTED; self-signed identity remains UNTRUSTED |
| Browser WebRTC | Same-browser loopback | Matching packet received in normal local browser; timeout while browser offline | No inter-device test | SOFTWARE_TESTED; not a remote ACK, radio or rescue receipt |
| BroadcastChannel | Same-origin tab transport | Second tab signature verification and replay rejection | No inter-device test | SOFTWARE_TESTED; no device mesh or authenticated enrollment |
| Inbox validation / replay / bounded metadata | Yes | UUID, size, status, timestamps, expiry, concurrency, clear during verify | No | SOFTWARE_TESTED; fixed 60-second lab freshness window, 5-second future-clock tolerance |
| Local queue / retention / purge | Yes | Local storage write/readback, purge readback, injected storage failure | No disk-forensic test | SOFTWARE_TESTED; max 8 lab packets, 60-second TTL, cleanup while open/on reload; no cryptographic erase |
| Camera / microphone adapters | Yes | Denied-permission and late-grant fixtures; STOP/resource unit tests | No actual media capture | IMPLEMENTED_UNVERIFIED positive device path; error/cancellation paths SOFTWARE_TESTED |
| Acoustic FFT | Existing WebAudio analyser corrected | Static regression guards; no microphone activated | No | IMPLEMENTED_UNVERIFIED physical input; relative amplitude only, no SPL/RF/ultrasound calibration |
| Geolocation | Opt-in one-shot API | Late callback after STOP fixture | No location read | IMPLEMENTED_UNVERIFIED positive device path; local only, not persisted/transmitted |
| BLE standard Battery Service | Chooser + GATT read | Fixture read of standard Battery Level and disconnect | No BLE device attached | SOFTWARE_TESTED contract; physical interoperability IMPLEMENTED_UNVERIFIED; no RSSI/CSI |
| Browser battery / network | Optional API metadata | Read in Chrome; absent values remain UNKNOWN/null | No instrument comparison | SOFTWARE_TESTED browser reporting; connectivity/rate/RTT are browser hints/estimates |
| Web Serial | Chooser permission only | Capability and permission logic inspected | No device | IMPLEMENTED_UNVERIFIED; no unknown firmware opened or read |
| WebUSB / RTL-SDR / Wi-Fi CSI | Capability/diagnostic + optional sample contract | Invalid and fixture sample contract tests | No receiver | HARDWARE_REQUIRED diagnostic; IMPLEMENTED_UNVERIFIED driver/bridge; no RF capture implemented |
| RF demonstration | Explicit opt-in | Default zero targets, DEMO three synthetic emitters, no people | No | SIMULATED / DEMO_ONLY; synthetic arrays are not observations |
| Orbital shells / FSPL / Doppler | Illustrative circular model | Geometry bounds, observer-independent subpoints, browser hydration | No | SIMULATED / DEMO_ONLY; source epoch absent, uncertainty UNKNOWN |
| Nine-sector topology / satellite link budgets | Models | Unit invariants, model controls | No | SIMULATED; no satellite terminal, operator access or transmission |
| Core packages / historical Vite app | Existing; schema/dependency security patch | Workspace build/typecheck; 26 core tests; Vite PWA build | No | SOFTWARE_TESTED in these scopes; historical Vite UI not manually toured |
| Android guard / deadline / queue / signer / journal | Existing, unchanged | Five pure JVM suites, 186 checks with portable JDK17 | No phones/emulator | SOFTWARE_TESTED pure Java; Android radio behavior IMPLEMENTED_UNVERIFIED |
| Android assembleDebug on new local commits | Source unchanged | Not executed locally: SDK35/build tools/Gradle8.11.1 missing | No | IMPLEMENTED_UNVERIFIED locally; successful BASE-SHA remote build recorded separately |
| Thirty-trial pilot validator | Existing | Header-only template reports zero trials, gate false; adversarial CSV tests | No trials supplied | SOFTWARE_TESTED validator, PHYSICAL_TEST_PENDING; self-report never enables PHYSICALLY_TESTED |
| External privacy/certification / real rescue / CAP issuer trust | Not established | Issues #4/#5 read; residual limitations documented | No | IMPLEMENTED_UNVERIFIED or absent; no EXTERNALLY_VALIDATED claim |

## Evidence receipts

- [Node tests](evidence/2026-10-24/integrated-node.txt): 107/107.
- [Workspace tests](evidence/2026-10-24/workspace-tests.txt): 26/26 core tests; [build](evidence/2026-10-24/workspace-build.txt), [typecheck](evidence/2026-10-24/workspace-typecheck.txt).
- [JVM](evidence/2026-10-24/jvm.txt): 15 deadline + 139 guard + 13 queue + 7 signer + 12 journal assertions. These are software fixtures.
- [Browser](evidence/2026-10-24/browser-qa.json): 41 checks; 15 locale/viewport combinations; no page errors; 200% CSS zoom check. [Offline loaded-page scope](evidence/2026-10-24/browser-offline.json).
- [axe 4.14.0](evidence/2026-10-24/axe-after.json): six locale/viewport runs with zero automated WCAG 2 A/AA / 2.1 AA violations. Incomplete contrast/ARIA results still require human review; this is not accessibility certification.
- [Static build](evidence/2026-10-24/investor-build.txt), [locales](evidence/2026-10-24/locales.txt), [npm ci](evidence/2026-10-24/npm-ci.txt), [typecheck](evidence/2026-10-24/investor-typecheck.txt).
- [Synthetic scenarios](evidence/2026-10-24/synthetic-scenarios.json): 810 runs, 12,150 successful invariant checks, zero physical deliveries measured.
- [Field validator](evidence/2026-10-24/field-pilot.json): zero real trials, false physical gate.
- [Remote state](evidence/2026-10-24/remote-state.json): remote CI success is for base SHA `6193593`, never these unpublished local commits.

No functionality in this run qualifies as HARDWARE_TESTED, PHYSICALLY_TESTED or EXTERNALLY_VALIDATED.

- Production dependency audits: investor and workspace zero advisory matches after security commit2e2e73e; package-audit scope only, not external assurance. See dependency-audit.json, workspace-dependency-audit.json and selector-parser-css-regression.json.
