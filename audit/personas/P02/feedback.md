# P02 — Emergency coordinator, EN

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Inspect message and routing semantics
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `en` @ `1440x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (12/12 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/
- click chapter anchor #how-it-works
- set virtual devices range slider to 20
- click GENERATE SYNTHETIC SOS in Store & Forward sandbox
- click EXPORT SYNTHETIC EVIDENCE JSON button

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `WHEN THE
NETWORK
GOES DARK.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":1440,"window":1440}`
- **responder-finds-workflow** (`PASS`): Expected `Navigate to #how-it-works` → Observed: `Clicked six-stage explanation`
- **responder-six-decisions** (`PASS`): Expected `6 interactive decision stage controls present` → Observed: `Six-state decision controls: 6`
- **responder-no-false-dispatch** (`PASS`): Expected `Explicit warning that synthetic ACK is not 112 dispatch` → Observed: `No real Bluetooth, Wi-Fi, satellite, CAP authentication, triangulation or emergency service dispatch. A synthetic ACK means modelled gateway receipt only.`
- **real-slider-mutates-model** (`PASS`): Expected `Changing virtual devices slider from 60 to 20 updates deterministic model state` → Observed: `Devices input 60 -> 20; displayed 20`
- **store-forward-sandbox-enqueue** (`PASS`): Expected `Clicking GENERATE SYNTHETIC SOS creates EXERCISE_0001 in queue` → Observed: `Store & Forward sandbox state: QUEUE STATE EXERCISE_0001 ACK_SYNTHETIC 1 attempt(s) · SIMULATED_ONLY`
- **synthetic-json-download** (`PASS`): Expected `Downloads JSON with kind=OEP_SYNTHETIC_EVIDENCE_EXPORT and NOT_PHYSICALLY_TESTED warning` → Observed: `Downloaded oep-simulation-seed-20261020.json with OEP_SYNTHETIC_EVIDENCE_EXPORT; simulation warning present`

## Summary Note
AUTOMATED TEST NOTE (P02 / Emergency coordinator, EN): 12/12 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
