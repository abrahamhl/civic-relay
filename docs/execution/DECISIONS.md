# Decisions

Each decision records what was chosen, what was rejected, and the guardrail it
protects. New decisions are appended, never rewritten.

## D001 — A separate app, not a new route in `apps/web`

**Chosen:** `apps/command-center`, a standalone Vite + React + TypeScript app.
**Rejected:** Extending `apps/web`.
**Why:** `apps/web` already runs a heavy three.js/postprocessing stack with
peer-dependency drift. The console needs a strict provenance contract and its
own bundle budget. Coupling them would put a deliverable at risk for zero gain.

## D002 — Pure adapter, zero framework in the truth layer

**Chosen:** `src/data/adapter.mjs` is plain ESM with no React, DOM or network.
**Why:** The provenance rules must be testable with `node --test`, portable into
the Tauri shell, and impossible to warp with rendering concerns.

## D003 — Evidence is copied byte-identically and bound by SHA-256

**Chosen:** `scripts/sync-evidence.mjs` copies four repository evidence files
verbatim and records size plus SHA-256 in `manifest.json`.
**Rejected:** Fetching live feeds at startup.
**Why:** Offline-first is a requirement, and a hash makes the UI's claim
falsifiable. The Evidence view renders the hashes, so a mismatch is visible to
the operator.

## D004 — No map tiles; 2D map is projected SVG

**Chosen:** Equirectangular projection into SVG with a graticule.
**Rejected:** Leaflet/MapLibre tiles.
**Why:** Tiles imply a network origin and a tile licence. A projected SVG works
fully offline and states exactly what it draws.

## D005 — 3D twin is lazy and fails closed

**Chosen:** Dynamic import of the React Three Fiber chunk, wrapped in a
`Suspense` fallback and a WebGL error boundary.
**Why:** The 3D chunk is ~830 kB raw. It must not tax first paint, and a machine
without WebGL must see a labelled fallback, never a blank canvas.

## D006 — RF and life-sign capabilities fail closed

**Chosen:** Every capability renders `NOT_AVAILABLE_NO_HARDWARE` unless a real
instrument reports itself. `ARCHITECTURE_VIEWER_ONLY` marks pure design.
**Rejected:** A "simulated detection" button that looks live.
**Why:** A life-detection claim without hardware is the most dangerous lie this
product could tell. The test suite asserts the fail-closed strings.

## D007 — Simulation lives in its own namespace

**Chosen:** Synthetic runs are seeded, deterministic, and labelled `SINTÉTICOS`
in the UI and `SIMULATOR` in data.
**Why:** A commander must never mistake a rehearsal for reality.

## D008 — Tauri capabilities are minimal and one command is confined

**Chosen:** `core:default` only. One custom command, `read_local_evidence`,
canonicalises the path and rejects anything outside the app data directory.
**Rejected:** The shell, fs, and http plugins.
**Why:** The renderer is untrusted surface. Least privilege is cheaper than
incident response.

## D009 — Screenshots are capture of the running app, not mock-ups

**Chosen:** `scripts/browser-smoke.mjs` drives the production build in Chromium
and writes `evidence/senda-command-center/*.png` plus `summary.json`.
**Why:** A screenshot that was not produced by the software is a fabricated
claim. The script also asserts marker counts, row counts, fail-closed strings,
hash presence, and an offline reload with all external requests blocked.
