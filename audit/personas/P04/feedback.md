# P04 — Network engineer, EN

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Examine architecture, interactions and source
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `en` @ `1440x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (10/10 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/
- click chapter anchor #how-it-works
- click 6th system stage button (.oep-system-node nth(5))

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `WHEN THE
NETWORK
GOES DARK.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":1440,"window":1440}`
- **engineer-navigation** (`PASS`): Expected `Navigate to #how-it-works` → Observed: `Clicked engineering stage section`
- **engineer-interactive-steps** (`PASS`): Expected `Clicking stage node updates active stage heading` → Observed: `Active stage: Emergency zone -> Adaptive routing`
- **engineer-six-layers** (`PASS`): Expected `6 developer architecture layers rendered` → Observed: `Implementation layers 6`
- **engineer-source-paths** (`PASS`): Expected `All 6 developer stack layers link to GitHub source paths` → Observed: `["https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/investor-next/app/investor-page.tsx","https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/investor-next/lib/emergency-routing.mjs","https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/investor-next/lib/emergency-policy.mjs","https://github.com/abrahamhl/civic-relay/blob/feat/master-emerg`

## Summary Note
AUTOMATED TEST NOTE (P04 / Network engineer, EN): 10/10 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
