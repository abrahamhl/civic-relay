# P03 — Technology investor, EN

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Find evidence and funding proposition
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `en` @ `1280x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (10/10 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/
- click chapter anchor #evidence

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `WHEN THE
NETWORK
GOES DARK.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":1280,"window":1280}`
- **partner-finds-proof** (`PASS`): Expected `Navigate to #evidence` → Observed: `Clicked #evidence from overview`
- **zero-physical-proof** (`PASS`): Expected `Evidence board explicitly states 0 validated physical relays` → Observed: `Evidence cards: 01
SIMULATED
20–100

VIRTUAL NODES

Reproducible topology

Seeded experiments exercise explicit | 02
AUTOMATED LAB
810

SYNTHETIC SCENARIO RUNS

Automated invariants

A fixed-scenario test matr | 03
NOT PHYSICALLY TESTED
0

PROVEN REAL-WORLD RELAYS

Physical interoperability

The Android re`
- **link-to-source** (`PASS`): Expected `Direct outbound links to GitHub repository evidence` → Observed: `GitHub evidence links 2`
- **funding-section** (`PASS`): Expected `#investment section present` → Observed: `Investment section exists`

## Summary Note
AUTOMATED TEST NOTE (P03 / Technology investor, EN): 10/10 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
