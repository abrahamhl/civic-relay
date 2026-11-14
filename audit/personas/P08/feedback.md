# P08 — Municipal partner, NL

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Understand institutional value and integration limits
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `nl` @ `1280x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (9/9 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/nl/
- click chapter anchor #evidence

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/nl`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `ALS HET
NETWERK
UITVALT.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":1280,"window":1280}`
- **partner-finds-proof** (`PASS`): Expected `Navigate to #evidence` → Observed: `Clicked #evidence from overview`
- **zero-physical-proof** (`PASS`): Expected `Evidence board explicitly states 0 validated physical relays` → Observed: `Evidence cards: 01
GESIMULEERD
20–100

VIRTUELE NODES

Reproduceerbare topologie

Deterministische oefeningen m | 02
LABTEST
810

VIRTUELE SIMULATIES

Geautomatiseerde checks

Scenariomatrix met invarianten; r | 03
NIET FYSIEK GETEST
0

GEVERIFIEERDE FYSIEKE RELAYS

Fysieke interoperabiliteit

Er is experi`
- **link-to-source** (`PASS`): Expected `Direct outbound links to GitHub repository evidence` → Observed: `GitHub evidence links 2`

## Summary Note
AUTOMATED TEST NOTE (P08 / Municipal partner, NL): 9/9 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
