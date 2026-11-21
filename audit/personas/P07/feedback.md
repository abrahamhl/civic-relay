# P07 — Accessibility reviewer, EN

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Keyboard, mobile and reduced-motion flows
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `en` @ `360x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (9/9 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/
- press Tab key

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `WHEN THE
NETWORK
GOES DARK.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":360,"window":360}`
- **keyboard-focus** (`PASS`): Expected `Keyboard Tab focuses an interactive element` → Observed: `{"tag":"A","name":"OEP — Offline Emergency Protocol"}`
- **accessible-semantic-buttons** (`PASS`): Expected `>= 12 native buttons in #how-it-works` → Observed: `Stage controls are native buttons: 12`
- **images-have-alt** (`PASS`): Expected `0 images missing alt attribute` → Observed: `Images without alt 0`

## Summary Note
AUTOMATED TEST NOTE (P07 / Accessibility reviewer, EN): 9/9 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
