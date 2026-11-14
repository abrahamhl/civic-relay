# P05 — Privacy reviewer, NL

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Assess consent and permissions
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `nl` @ `390x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (9/9 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/nl/
- click chapter anchor #routing-lab

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/nl`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `ALS HET
NETWERK
UITVALT.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":390,"window":390}`
- **privacy-finds-lab** (`PASS`): Expected `Navigate to #routing-lab in NL locale` → Observed: `Clicked Dutch simulation lab`
- **privacy-radio-boundary** (`PASS`): Expected `Dutch radio/112 non-interference boundary stated` → Observed: `Geen echte Bluetooth-, Wi-Fi- of satellietverbinding, CAP-verificatie, triangulatie of contact met 112. ACK is uitsluitend een gesimuleerde ontvangst.`
- **permission-model-switches** (`PASS`): Expected `>= 3 consent/radio/gateway checkboxes inspectable` → Observed: `Radio/gateway assumption switches 4`

## Summary Note
AUTOMATED TEST NOTE (P05 / Privacy reviewer, NL): 9/9 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
