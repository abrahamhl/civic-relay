# P01 — Affected citizen, ES

> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**

- **Objective:** Understand purpose and human-status states
- **Campaign Mode:** `SINGLE-VERSION SMOKE`
- **Target URL:** `https://civic-relay-investor.vercel.app` (commit `c18c6ac936c8b3c6560997b113e46b50cab51302`)
- **Locale & Viewport:** `es` @ `390x850`
- **Verdict:** `AUTOMATED_BROWSER_CHECKS_PASSED` (10/10 checks passed)

## Actions Performed in Chromium
- goto https://civic-relay-investor.vercel.app/es/
- click chapter anchor #what-oep-does
- click chapter anchor #routing-lab
- check human status consent checkbox
- click SAFE human status response button

## Observed Checks
- **http-response** (`PASS`): Expected `HTTP 200 on language entry route` → Observed: `HTTP 200 at https://civic-relay-investor.vercel.app/es`
- **visible-hero** (`PASS`): Expected `Hero heading > 15 chars visible above fold` → Observed: `CUANDO LA
RED
SE APAGA.`
- **six-sections** (`PASS`): Expected `All 6 architectural anchor sections exist in DOM` → Observed: `Missing section anchors: none`
- **chapter-navigation** (`PASS`): Expected `6 sticky navigation chapter links present` → Observed: `Chapter anchor count 6`
- **truthful-simulation-label** (`PASS`): Expected `Explicit simulation-only disclaimer visible in body copy` → Observed: `Visible synthetic/non-operational disclaimer present: true`
- **no-global-mobile-overflow** (`PASS`): Expected `scrollWidth <= innerWidth + 3` → Observed: `{"scroll":390,"window":390}`
- **resident-finds-function** (`PASS`): Expected `Anchor navigation moves hash to #what-oep-does` → Observed: `Visited #what-oep-does via real chapter click`
- **resident-brief-has-detail** (`PASS`): Expected `#what-oep-does section contains > 150 chars of explanation` → Observed: `Brief text length 850`
- **resident-finds-lab** (`PASS`): Expected `Anchor navigation moves hash to #routing-lab` → Observed: `Chapter navigation -> live lab`
- **resident-consented-human-status** (`PASS`): Expected `Human status panel records SAFE after consent checkbox` → Observed: `Recorded human status after explicit consent: Respuesta local de ejercicio: SAFE Caduca en una hora; se elimina al salir de la página REVOCAR Y ELIMINAR`

## Summary Note
AUTOMATED TEST NOTE (P01 / Affected citizen, ES): 10/10 observed checks passed. No critical failure in scripted tasks; human comprehension remains untested.
