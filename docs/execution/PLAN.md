# SENDA Command Center — Execution Plan

Base: `a622404` (PR #17 head). Branch: `feat/senda-command-center-20261106`.

## M0 — Reconnaissance and guardrails (done)

- Read `PROMPT_01_DEEPSEEK_OPENCODE_DIRECTOR.md`.
- Install the 12 subagent definitions in `.opencode/agents/`.
- Record the real baseline in `BASELINE.md`.

## M1 — Vertical slice (done)

Ship a buildable, testable, offline-first console that shows real evidence with
honest provenance:

- Pure data adapter (`src/data/adapter.mjs`) with no React, DOM or network.
- Byte-identical evidence snapshot bound by SHA-256 (`src/data/snapshot/`).
- 2D offline map (SVG, no tiles) with 25 real camera observations.
- Lazy 3D digital twin (React Three Fiber) that fails closed when WebGL is
  unavailable.
- Camera, RF, simulation and forensic evidence views.
- Vite + React + TypeScript build; Tauri v2 shell with least-privilege bridge.
- Unit tests for the adapter and a real-browser smoke test with screenshots.

## M2 — Native packaging (partial)

- Tauri v2 scaffold committed (`src-tauri/`), CSP, capability allowlist,
  read-only commands.
- Not yet built: `cargo build` requires a network fetch of the Tauri crates,
  which was not performed in this environment. Packaging must be verified on a
  machine with registry access or a vendored cache before any release claim.

## M3 — Evidence depth (next)

- Register NOAA GOES / NASA FIRMS / EFFIS adapters as
  `DOCUMENTATION_ONLY` until a real acquisition is fetched and hashed.
- Add a `provenance lint` script that fails when a view renders a record
  without a provenance chip.
- Fix the Windows SQLite teardown fixture.
- Add a deterministic visual-regression harness on top of
  `scripts/browser-smoke.mjs`.

## M4 — Field readiness (blocked on external approvals)

- Signed installers, auto-update channel, operator authentication.
- Any live video integration requires written per-provider permission.
- No autonomous dispatch, ever.
