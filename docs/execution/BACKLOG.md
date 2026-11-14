# Backlog

Ordered by risk reduction per unit of work. Nothing here is committed to a
release without approval.

## P0 — correctness and trust

1. Fix the Windows SQLite teardown `PermissionError [WinError 32]` in
   `packages/senda/data` fixtures so the Python suite is green on Windows.
2. Add `provenance lint`: a test that fails when any rendered record has no
   provenance chip and no namespace label.
3. Add a snapshot integrity test that recomputes SHA-256 at test time and fails
   if a snapshot file drifts from its manifest entry.
4. Verify `cargo build` for `src-tauri` on a machine with crate access; record
   the resulting toolchain versions in `STATE.md`.

## P1 — evidence depth

5. GOES / FIRMS / EFFIS adapters as `DOCUMENTATION_ONLY` with a hashed sample
   acquisition stored under `evidence/`.
6. Camera calibration intake: without intrinsics, keep FOV and triangulation
   `NOT_AVAILABLE`.
7. Temporal alignment rules: explicit rejection when a historical clip and a
   2026 catalogue entry share a view.

## P2 — operator experience

8. Deterministic visual-regression baseline from `browser-smoke.mjs`.
9. Keyboard-complete navigation and a documented focus order.
10. Command palette for dataset and view switching with no hidden state.

## P3 — packaging and field

11. Signed installers and an update channel with signature verification.
12. Operator authentication and an audit log for every evidence query.
13. Any live camera integration, only with written per-provider permission.

## Explicitly out of scope

- Autonomous dispatch or public alerting.
- Any claim of life detection without hardware.
- Training or publishing models on restricted footage.
