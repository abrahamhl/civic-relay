# P06 — Field volunteer, ES

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Interact with simulator and export JSON
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `es` @ `768x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (9/9 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/es/
- set virtual devices range slider to 20
- click GENERATE SYNTHETIC SOS in Store & Forward sandbox
- click EXPORT SYNTHETIC EVIDENCE JSON button

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/es`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `CUANDO LA
RED
SE APAGA.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":768,"window":768}`
- **real-slider-mutates-model** (`PASS`): Expected `Changing virtual devices slider from 60 to 20 updates deterministic model state` → Observed: `Devices input 60 -> 20; displayed 20`
- **store-forward-sandbox-enqueue** (`PASS`): Expected `Clicking GENERATE SYNTHETIC SOS creates EXERCISE_0001 in queue` → Observed: `Store & Forward sandbox state: ESTADO DE LA COLA EXERCISE_0001 ACK_SYNTHETIC 1 attempt(s) · SIMULATED_ONLY`
- **synthetic-json-download** (`PASS`): Expected `Downloads JSON with kind=OEP_SYNTHETIC_EVIDENCE_EXPORT and NOT_PHYSICALLY_TESTED warning` → Observed: `Downloaded oep-simulation-seed-20261020.json with OEP_SYNTHETIC_EVIDENCE_EXPORT; simulation warning present`

## Summary Note
AUTOMATED TEST NOTE (P06 / Field volunteer, ES): 9/9 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
