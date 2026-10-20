# Civic Relay — Story Mode & trilingual demo delivery brief

**Date:** 2026-10-20
**Scope:** Investor narrative + browser-based lab simulation. Not a field-deployable emergency network.

## Product decision
Civic Relay is an **offline-first research prototype** for resilient crisis messages. It explores local persistence, store-and-forward, deduplication and receiver acknowledgments. It has **no live Bluetooth, satellite, governmental or emergency-services integration**. Civil Sentry is a separate cyber-intelligence product.

## Human narrative
1. Normal day — coverage available.
2. Wildfire threatens infrastructure.
3. No route; send fails.
4. Message saved locally but undelivered.
5. Hypothetical authorized route appears.
6. Simulated same-page receiver ACK, distinct from transmission acceptance.
7. Pilot and independent field validation required.

The `StoryMode.tsx` component presents the visual sequence and accessible controls. The main landing page places the human consequence before the technical network globe. The globe is labeled *conceptual*.

## Languages
A single `locale` state in `App.tsx` controls both the landing page and the lab.
- EN, ES, NL; persist selection with `localStorage`.
- Read `?lang=en|es|nl` before stored/browser preference.
- Update `document.documentElement.lang` and URL query on change.
- New translations live in `apps/web/src/i18n.ts`.
- All new interface text must be added in all three languages. Avoid presenting real-world security or emergency authority via unverified strings.

## Honest capability boundary
**In repository:** local browser store with IndexedDB (subject to browser availability), in-page simulated transports, acknowledgment logic and deduplication.
**Not validated:** hardware transport, mobile background relay, satellite handoff, public warning authentication, a real responder receiving a message, certified E2E security and SLA.

Every interface showing a simulated ACK must state that it is not a real-world delivery receipt. `navigator.onLine` must be labeled *browser connection* rather than verified application routing.

## Manual acceptance matrix
- Open `/?lang=es`, switch to EN then NL, open lab, navigate back: language should persist.
- Refresh lab after creating a synthetic message: IndexedDB recovery should show message, subject to storage policy.
- Disable browser network, reload already cached app: inspect shell availability, distinguish this from transport connectivity. Base map tiles can fail offline.
- Simulate SOS in lab: no network request to an emergency service. No false official badge.
- Observe status changes: a queued attempt must not be called delivered until receiver ACK in same-page simulation.
- Scroll all seven story scenes on desktop and mobile; test buttons, keyboard, reduced-motion setting.
- Verify developer console: no project secrets and no exposed real personal information.
- Run `pnpm install --frozen-lockfile && pnpm build && pnpm type-check && pnpm test` in CI.

## Security, policy & procurement blockers
- Security review of untrusted payload parsing, audit trail and consent.
- Browser storage is not a substitute for controlled encrypted persistence.
- External maps and third-party assets may require internet, consent or a vendor evaluation.
- Register product marks only after legal checks; existing MIT license stays MIT. A permissive open-source license does **not** stop forks or cloning.
- No claim of ENS/NIS2/GDPR certification or institutional affiliation without evidence.
- Before field use: partner authorization, threat model, data minimization, usability pilots, resilience benchmarks, and independent safety testing.

## Next agent mission (copy/paste)
You are the principal engineer and adversarial reviewer for abrahamhl/civic-relay. Inspect the current branch and open PR before editing. Preserve the existing Vite/React architecture unless a measured constraint requires a migration. Run and fix all build, typecheck, test and accessibility failures. Verify the EN/ES/NL language selector applies to every user-facing lab and investor string. Prove offline state retention across reload and document failures. Never fake transmission, official verification, emergency affiliation, E2E encryption or satellite service. Add reproducible Playwright tests for language persistence, narrative progression, mobile viewport, offline reload and no false ACK. Create an evidence ledger with claim/source/proof/date/confidence, a prioritized security threat model and an honest public-sector pilot pitch. Re-run checks until green; commit to a feature branch and present a PR. Do not publish to production or merge unless the automated checks pass and a human reviews any emergency-service implications.
