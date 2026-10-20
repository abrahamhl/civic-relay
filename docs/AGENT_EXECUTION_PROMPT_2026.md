# EXECUTION PROMPT — MASTER EMERGENCY ROUTING NETWORK (20 OCT 2026)
Use this exact prompt in a code-capable agent with access to `abrahamhl/civic-relay`. Operate in the existing feature branch and open/update PR #3; do not auto-merge.

## Mission
You are the lead systems engineer and research architect for an OFFLINE-FIRST, opt-in Distributed Emergency Coordination & Adaptive Multi-Network Routing research platform. Protect all current code, preserve the existing Three.js globe and narrative, and move from simulated claims toward an independently reproducible, honest MVP. **This is not a satellite network, not a phone exploit, not an emergency dispatch service, and not an official source of CAP alerts.** Treat every proof level explicitly: SIMULATED, EXPERIMENTAL, PHYSICALLY_TESTED. Never promote results by assumption.

## Starting point — read before writing
Repository: `https://github.com/abrahamhl/civic-relay`
Branch: `feat/master-emergency-routing-v1-20261020`
PR: `https://github.com/abrahamhl/civic-relay/pull/3` (draft)
Existing source:
- `investor-next/lib/emergency-routing.mjs`: deterministic 20–100-node simulator
- `investor-next/lib/emergency-policy.mjs`: capability/consent/energy/CAP server-verifier boundary
- `investor-next/lib/store-forward.mjs`: executable exercise-only queue, adapter selection, TTL, retries, duplicates, fake ACK, revocation and audit
- `investor-next/app/emergency-building.tsx`, `coordination-lab.tsx`: 3D-building 12-scene narrative
- `investor-next/app/transport-sandbox.tsx`: in-memory transport exercise fixture
- `investor-next/app/human-safety-panel.tsx`: opt-in local-only safety response with expiry
- `packages/core/src/{dispatcher,router,store,envelope}.ts`: EXISTING core; audit and reuse carefully, do not fork carelessly
- `docs/MASTER_EMERGENCY_ROUTING_2026.md` and `docs/INSTITUTIONAL_INTEGRATION_PLAN.md`: architectural ground truth
- `.github/workflows/emergency-lab-ci.yml`: test/build gate
- Older docs may be inconsistent; fact-check each claim and propose corrections.

## Execution discipline — no phase-by-phase permission prompts
1. Inspect current git status, branches, PR comments and successful CI checks. Do not delete or overwrite user work. If existing files diverge, create safe isolated commits.
2. Run `node --test investor-next/tests/*.test.mjs`; `cd investor-next && npm install --no-audit --no-fund && npm run type-check && npm run build`. Fix regressions before adding features.
3. Implement the next highest-evidence milestone **M0.2**:
   - Define a strict `TransportAdapter` contract (id, capability, permission, security, cost/energy/rate limits, evidence level) shared between prototype and core where compatible.
   - Extract store-and-forward policies into reusable, individually tested functions; avoid duplicating two distinct production engines. Migration MUST retain backwards compatibility with existing `packages/core` tests.
   - Add message ordering by priority, deterministic clock/seed injection, TTL test vectors, dedup collision defense, bounded storage, retry jitter policy, backpressure, secure receipt design boundary, versioned event schema, audit retention/deletion.
   - Simulate topology with explicit *assumption* fields for latency/reliability/energy; refuse any UI copy implying those are measured.
   - Confirm revoked messages cannot be resurrected by late callbacks; test cancel-vs-send races and hostile adapters.
   - Human confirmations: explicit SAFE, SOS, others affected, cannot determine; silence remains UNKNOWN/NO_CONTACT, never injured or rescued; no GPS without separate consent.
4. UI/investor experience: preserve the original globe, maintain EN/ES/NL, meet mobile accessibility and keyboard requirements. Keep 12-scene collapse scenario. Add an explicit inspectable audit/explanation view with traceable synthetic route choices, queued-vs-ACK states and optional JSON export. Use no fabricated efficiency claims.
5. Construct a practical Android two-phone **laboratory** pilot specification or sample app in a separate `experimental/android-nearby/` directory, only if toolchain permits. User consent must precede discovery; use approved Android Nearby Connections or other documented local API; display permission requests; exchange a nonce and receiver acknowledgement, not an unverified "sent" flag. Do NOT label this physically tested until reproducible runs on two actual devices exist. Do not assert that app code can force-toggle Bluetooth, Wi-Fi, satellite or system battery saver.
6. Research and document institutional CAP ingestion as a server-side trust verifier, including signed-source verification, replay controls, update/cancel handling, trusted key management and audit, without enabling a user to forge official zones.
7. Document privacy-by-design, GDPR/DPIA path, technical evidence thresholds, threat model, liabilities, scope exclusions, no 112 testing, and partner-approval dependencies. Do not put precise location in audit logs by default.
8. Update the funding dossier with a factual opportunity grid: programme URL, topic identifier, official deadline, eligibility, expected consortium, TRL fit, grant rate, confidence, required action and current verification date. Cite primary EU portals; mark unknowns UNKNOWN. Do not invent partners or accepted funding.
9. Run six adversarial reviews separately (security engineer, mobile RF/OS engineer, emergency practitioner, privacy/legal reviewer, grant evaluator, investor/product lead). Record factual defects, severity, reproduction, fix, residual risk and a FINAL accountable chief-engineer decision.
10. Commit small thematic changes to the **feature branch**, update PR #3 with evidence and acceptance checklist, and leave it draft unless all quality gates pass. Never merge into master automatically.

## Immediate acceptance tests (fail closed)
- Seeded 20, 40 and 100 node experiments produce identical results for identical inputs.
- Participation=0 produces zero authorized relays; no valid radio + total cellular outage produces zero ACK.
- No answers produces UNKNOWN, never synthetic victims/SOS.
- Invalid issuer/test CAP cannot authorize operational zone; cancellation and replay policies tested.
- Critical battery does not relay unrelated traffic; explicit SOS can still try a permitted route; no system settings silently changed.
- All delivered-looking UI strings say SYNTHETIC until proven with physical evidence.
- Offline→queue→gateway restored→receipt is demonstrable with real executable *in-memory* code.
- Forged receipt, conflicting duplicate IDs, expired TTL, send exception, disconnect, concurrent retry/revoke and queue overflow handled without silent success.
- Existing Three.js globe remains visible; English, Spanish, Dutch; Next build and tests pass.
- No hard-coded secrets, tracking, unauthorized radios, 112 calls, or fictitious satellite API URLs.

## Expected output from agent
Return an evidence-first table: implemented feature; affected files; test command; CI run URL; proof level; honest unresolved blockers. Provide final PR link, preview deployment if confirmed, and separate M1 Android pilot specification. For any unchecked claims say NOT VERIFIED. Do not declare "100% works" before hardware tests. Use Spanish in progress reports, English in code/API naming. Save a clear `docs/NEXT_ACTIONS.md` containing max 5 priority steps.
