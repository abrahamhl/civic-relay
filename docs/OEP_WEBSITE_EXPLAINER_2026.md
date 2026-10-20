# OEP investor + developer website — executable narrative
Updated 21 October 2026. Public brand: **OEP — Offline Emergency Protocol**.
Feature branch: `feat/master-emergency-routing-v1-20261020`; PR #3 remains draft.

## Editorial goal
The original GlobeCanvas / five-act scroll journey, building collapse 3D scene, language pages and old interactive laboratory are retained as-is. Additional content answers four questions a non-technical funder and a senior engineer should BOTH be able to answer:
1. What human/public-safety problem is being investigated?
2. Which permissioned device/routing functions does OEP actually implement today?
3. What exact input, decision and response produces each state?
4. Where is that behaviour in source, and is the proof SIMULATED, BUILD-ONLY or PHYSICALLY_TESTED?

## New page narrative (top → bottom)
1. Hero and existing Mission Control: retain emotional opening and sample fictional network failures. The second CTA scrolls to the actual local #routing-lab rather than opening an unrelated preview URL.
2. `#what-oep-does` — plain-language definition with four pillars (alert, human, message, route), grounded by strict current evidence.
3. Existing CrisisStory and ScrollExperience remain intact. Each five-act chapter now contains an engineering fact and a link to its related six-decision detail: network failure→zone, queue→store, discovery→route, ACK→receipt, future pilot→device permission.
4. `#how-it-works` — six interconnected stages (`zone`, `consent`, `human`, `store`, `route`, `ack`). Desktop: long scroll chapters on left and sticky interactive system console on right; mobile: readable stacked chapters and keyboard-accessible stage buttons. Every stage has:
   - INPUT → ENGINE DECISION → OUTPUT
   - Investor value, developer explanation and verified GitHub source link
   - Evidence status / non-operational disclaimer
5. Existing `#routing-lab`: 3D collapsed building, adjustable 20–100 virtual nodes, explicit synthetic SOS, consent, queue/gateway switch, route decision trace and JSON export.
6. `#developer-stack` — six technical layers, current technology and links to the exact current repository files:
   - Next.js 16 + React 19 + Three.js 0.180 for UI
   - deterministic `emergency-routing.mjs` virtual graph
   - `emergency-policy.mjs` permission / energy / CAP trust-verifier boundary
   - `store-forward.mjs` in-memory lab queue, dedup, TTL, backoff, simulated transport receipts
   - Android Nearby Connections 19.5.1 experimental Java client (APK build, not physical link)
   - GitHub Actions/test scripts and zero fabricated two-phone measurements
   - Explicit message-state semantics and a 3-stage evidence ladder
7. Existing evidence board, product rationale, investment thesis, roadmap and contact CTA remain visible.

## Trust boundaries that MUST be retained
- Do not state that OEP relays over real multi-hop mesh, satellite or official 112. No phones are operated by the website.
- Local browser queue is **not** durable Android store-and-forward; an in-memory simulated ACK is **not** field delivery.
- No-response = UNKNOWN, not human casualty. A consenting SOS is a voluntary statement, not a verified rescue request forwarded to operators.
- CAP format research is not government issuer authentication. A compilation of the Android APK is not a completed two-phone field trial.
- The 810 seeded scenario runs are synthetic model executions; 30 Android trials are **planned, not performed**.

## Evidence / QA gates
- `node --test investor-next/tests/*.test.mjs` — contains `system-story.test.mjs` checks for complete languages, code links, original 3D chapters and evidence copy.
- `cd investor-next && npm install --no-audit --no-fund && npm run type-check && npm run build && npm run check:locales` — run in GitHub Actions against the exact commit.
- **Manual QA remaining:** real desktop and mobile browsers, 3 breakpoints (360, 768, 1440), mouse/touch/keyboard stage clicks, IntersectionObserver sticky behaviour, reduced motion, Three.js WebGL fallback, the 3 static locales `/`, `/es/`, `/nl/`, and that every code link opens the correct branch. Mark checks as NOT VERIFIED until inspected in a browser. A successful build is not visual QA.
- Preview must be confirmed from the exact Vercel deployment SHA; a historical production URL does not establish that the latest PR is public.

## Next production-quality refinements
1. Browser screenshot/device accessibility audit; fix any overflow or invisible text.
2. Human usability test with one engineer and one non-technical evaluator; measure comprehension of QUEUED, UNKNOWN, ACK_SYNTHETIC.
3. Physical Android pilot, independent security assessment and institutional alert-provider trust architecture before operational pitch.
