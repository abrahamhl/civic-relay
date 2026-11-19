# State

Last updated: 2026-11-06.

## Identity

- Repository: `abrahamhl/civic-relay`
- Branch: `feat/senda-command-center-20261106`
- Base commit: `a622404c535affac27cf781e832fda6653427168` (PR #17 head,
  `research/senda-v021-evidence-quality-20261106`, based on PR #13, based on PR #12)
- Working tree: new app, docs and evidence; `experimental/oep-tactical/` left
  untracked and untouched.

## Baseline

- `@senda/core` 247 / 247 pass.
- `@civic-relay/core` 26 / 26 pass.
- `@senda/relay` 2 / 2 pass.
- `web` type-check pass.
- Python: 12 tests, all assertions pass, 4 Windows-only teardown
  `PermissionError [WinError 32]` (open item P0-1).

## Milestone M1 — vertical slice delivered

New app `apps/command-center`:

- `src/data/adapter.mjs` — pure provenance adapter, no React/DOM/network.
- `src/data/snapshot/` — four byte-identical evidence files bound by SHA-256.
- `src/components/` — Header, SourceTree, Map2D, Scene3D (lazy), ContextPanel,
  TimelineBar, CameraIntelligence, RfLab, SimulationPanel, EvidenceView.
- `scripts/sync-evidence.mjs` — deterministic snapshot + manifest.
- `scripts/browser-smoke.mjs` — real Chromium smoke test with screenshots.
- `src-tauri/` — Tauri v2 shell, minimal capability, CSP, read-only bridge.

### Snapshot SHA-256 (recorded in `manifest.json`)

| File | SHA-256 |
| --- | --- |
| `source-registry.v021.json` | `ffb6827e537fe8d2962a3d8d4c6c4fcef8bdb0d2da92104962eda5eee90c54c6` |
| `tfl_camaras.json` | `2aeea2fc0968c80b4219bd20c8d13b1a0b6ab367aeb30776db159c35a383033a` |
| `caltrans_corredores.json` | `75586848fc334d10bca45598192c72d5c054584d6200d02a8b05c6b9c53fc2d6` |
| `estado.json` | `1ac3ba6204366fa3ff61426acb0f935aabfb90dbe4f13140d3a1ad7063cda67c` |

## Milestone M2 — secure transport and integrity

- `src/security/canonical.mjs` — SJSON-1 deterministic serialization.
- `src/security/crypto.mjs` — SHA-256, Ed25519, X25519 → HKDF-SHA-256 →
  AES-256-GCM, using Node 22 WebCrypto only (no third-party crypto deps).
- `src/security/envelope.mjs` — `senda-secure-envelope/v1`, signed fields,
  rejection reasons `PAYLOAD_TAMPERED`, `SIGNATURE_INVALID`, `EXPIRED`,
  `CREATED_IN_FUTURE`, `SENDER_MISMATCH`.
- `src/security/transport.mjs` — outbox, replay guard, transport inventory that
  never claims a radio.
- `src/security/manifest.mjs` — recomputes SHA-256 and byte counts from the
  bytes the UI actually renders.
- `src/components/SecureLinkPanel.tsx` — identity fingerprints, manifest PASS
  table, sign/verify, tamper demo, outbox enqueue/ack, legal gates.

## Milestone M3 — RF and structure physics

- `src/science/rf.mjs` — material attenuation table, free-space path loss,
  link budget, RSSI→distance with 1σ band, presence likelihood, through-wall
  feasibility always `SIMULATION_ONLY`, legal gates.
- `src/science/structure.mjs` — segment/wall intersection, path loss through a
  building, naive-Bayes presence heatmap labelled `SIMULATOR`, synthetic
  `DEMO_FLOOR` (20×12 m, 9 walls, 2 sensors).
- `src/components/RfLab.tsx` — legal gates, attenuation calculator, SVG floor
  plan heatmap, capability probe that fails closed.
- Numerical fix: `pathLossThroughBuilding` clamps distance to 5 cm so a grid
  cell landing exactly on a sensor cannot throw; the far-field model is not
  valid at zero distance and this is documented in code.

## Milestone M4 — meteorology and forecast verification

- `src/science/meteorology.mjs` — unit conversions, Magnus-Tetens dew point,
  Rothfusz heat index, JAG/TI wind chill, meteorological wind vectors, Fosberg
  FFWI, Haines index, Briggs dispersion, Gaussian ground-level plume, Brier
  score and skill, empirical CRPS, reliability bins, rank-based ROC AUC.
- `src/components/MeteorologyLab.tsx` — diagnostics sliders, plume simulator
  with declared assumptions, reliability chart and scores. All values are
  `MODEL_DERIVED` or `SIMULATOR`; no live ingestion is claimed.

## Milestone M5 — access control and entity management

- `src/access/rbac.mjs` — seven roles (`super_admin`, `entity_admin`,
  `coordinator`, `operator`, `field_unit`, `analyst`, `observer`), fourteen
  permissions grouped by domain, cumulative union semantics, deny-by-default.
- `src/access/directory.mjs` — eight synthetic entities across emergency,
  municipal, health, security, utility, NGO, press and research; twenty-two
  synthetic users with roles, status, MFA and last-seen; aggregation helpers.
- `src/components/AccessControlPanel.tsx` — summary KPIs, entity table, user
  table with search/entity/status filters, full role-permission matrix, and an
  access checker that shows effective permissions for any combination of roles.
- All data is labelled `SIMULATOR`. There is no auth server, session store or
  persistence; the UI says so explicitly.

## Deployment

- `vercel.json` now builds `@senda/command-center` and serves
  `apps/command-center/dist`; the old catch-all redirect to the investor site
  was removed so the console is actually reachable.
- CSP tightened: no `unsafe-eval`, no external origins, `connect-src 'self'`.
- Linked to the existing Vercel project `civic-relay`
  (`2fabraham-7129s-projects`).
- Production: <https://civic-relay-pi.vercel.app>
- Deployment id: `dpl_2WBuMyNVugURc5BUxWh2Rdjx5R5n`.
- `.vercel/` and `.env.local` are gitignored; no secret is committed.

## Verification actually run

| Check | Command | Result |
| --- | --- | --- |
| App tests | `pnpm --filter @senda/command-center test` | 52 / 52 pass |
| Type-check | `pnpm --filter @senda/command-center type-check` | pass |
| Production build | `pnpm --filter @senda/command-center build` | pass |
| Browser smoke | `node apps/command-center/scripts/browser-smoke.mjs` | exit 0 |

Test files: `tests/adapter.test.mjs` (9), `tests/security.test.mjs` (12),
`tests/rf.test.mjs` (10), `tests/meteorology.test.mjs` (14),
`tests/access.test.mjs` (7).

Build output:

- `index.html` 0.67 kB
- CSS 16.05 kB (gzip 3.99 kB)
- app chunk 306.83 kB (gzip 88.95 kB)
- lazy `Scene3D` chunk 830.05 kB (gzip 225.00 kB)

Browser smoke (production build, Chromium headless, 1600×960):

- header brand and chips rendered;
- 25 real camera markers; TfL-only filter yields 12;
- selecting a marker opens `Strand/Lancaster Place`;
- 3D tab mounts one WebGL canvas, zero fallbacks, zero page errors;
- RF Lab shows `ARCHITECTURE_VIEWER_ONLY` plus three
  `NOT_AVAILABLE_NO_HARDWARE`; legal gates include `PROHIBITED` and
  `SIMULATION_ONLY`; heatmap renders 279 rects labelled `SIMULATOR`;
- probe returns `NOT_AVAILABLE_NO_HARDWARE`;
- Meteorology tab renders diagnostics, plume and verification; reliability
  chart renders 10 marks; body contains `MODEL_DERIVED` and `SIMULATOR` and no
  `NaN`;
- Access tab renders 8 entities / 22 users / 45% MFA; user search filters 22
  rows to 1; role matrix renders 19 rows and 48 grants; access checker denies
  11 permissions for `operator` and 0 after adding `super_admin`;
- Secure Link: manifest PASS over 4 files, sign `VERIFIED`, tamper
  `REJECTED. PAYLOAD_TAMPERED · SIGNATURE_INVALID`, outbox 1→0 pending and
  0→1 ack;
- simulation is labelled `SINTÉTICOS` with 19 synthetic bars;
- Evidence view shows 4 SHA-256 rows;
- Camera Intelligence shows 25 rows; Live Sources shows 24 rows;
- offline reload with all external requests blocked still renders;
- `consoleErrors: []`, `pageErrors: []`.

Screenshots and machine summary:
`evidence/senda-command-center/01-overview.png` … `11-secure-link.png`,
including `05b-meteorology.png`, `05c-access.png` and
`12-live-production.png`, plus
`evidence/senda-command-center/summary.json`.

Live production check (Chromium, 1600×960, against
`https://civic-relay-pi.vercel.app`):

- HTTP 200, title `SENDA Command Center`, brand rendered;
- Access tab: 8 entities, 22 users, 45% MFA, `SIMULATOR` label, 22 user rows,
  access checker 11 denied → 0 after `super_admin`;
- Meteorology: `MODEL_DERIVED` and `SIMULATOR` present, no `NaN`;
- RF: `PROHIBITED`, `SIMULATION_ONLY`, `NOT_AVAILABLE_NO_HARDWARE` present;
- `consoleErrors: []`, `pageErrors: []`.

## Not verified yet

- `cargo build` for `src-tauri` — not run; requires crate download. Do not
  claim a working native binary until it is built and launched.
- Windows Python teardown fix (P0-1).
- Any live data acquisition; the console is deliberately snapshot-only.
- No real RF/UWB/CSI hardware, no calibration, no life detection. The RF lab
  is an architecture viewer and simulator only.

## Next objective

M6: replace the simulated directory with a real identity backend (provider,
signed sessions, server-side authorization, audit persistence) and wire a
hashed NOAA/ERA5 acquisition path behind the provenance contract. Then close
P0-1 and add the provenance lint (P0-2) and snapshot integrity test (P0-3).
No merge without explicit approval; production deploys require explicit
approval each time.
