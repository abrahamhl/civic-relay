# SENDA Command Center — Baseline

Recorded 2026-11-06 from `feat/senda-command-center-20261106`, whose base is
`a622404c535affac27cf781e832fda6653427168` (PR #17 head).

## Toolchain actually observed

| Tool | Version |
| --- | --- |
| git | 2.53.0.windows.1 |
| gh | 2.96.0 |
| node | v22.22.2 |
| pnpm | 9.1.0 |
| python | 3.12.10 |
| rustc / cargo | 1.98.1 |
| OS | Windows 11, PowerShell 5.1 |

`rg` is not installed on this machine; searches used the editor/agent tooling.

## Package baseline

| Package | Command | Result |
| --- | --- | --- |
| `@senda/core` (`packages/senda`) | `pnpm --filter @senda/core test` | 247 / 247 pass |
| `@civic-relay/core` (`packages/core`) | `pnpm --filter @civic-relay/core test` | 26 / 26 pass |
| `@senda/relay` | `pnpm --filter @senda/relay test` | 2 / 2 pass |
| `web` | `pnpm --filter web type-check` | pass |
| `packages/senda/data` (pytest) | `python -m pytest packages/senda/data -q` | 12 run, all assertions pass, 4 isolated teardown `PermissionError [WinError 32]` |

### Known Windows-only teardown defect

Four pytest cases fail only while releasing a SQLite handle
(`PermissionError: [WinError 32] El proceso no tiene acceso al archivo`).
Assertions already passed. This is a cleanup ordering defect in the test
fixture, not a product failure. It must be fixed in the fixture
(`try/finally` around the connection) before any release that claims green
Windows Python tests. CI on Ubuntu is expected to stay green.

`tzdata` was installed into the Python environment to make
`ZoneInfo("America/Los_Angeles")` resolvable on Windows.

## Non-negotiables inherited from the prompt

1. Never fabricate evidence. Every observation carries source id, acquisition
   UTC, spatial and temporal uncertainty, provenance and rights.
2. Keep these namespaces separate and visually labelled:
   `REAL_MEASUREMENT`, `MODEL_DERIVED_REAL_INPUT`, `FORECAST`,
   `HINDSIGHT_REPLAY`, `SIMULATOR`, `MISSING_DATA`.
3. Historical fires are never rendered as if they were a 2026 camera scene.
4. No production video permissions are assumed. A public catalogue is not a
   video licence.
5. Without calibration, FOV and triangulation are `NOT_AVAILABLE` and the UI
   must say so.
6. Mobile backgrounds are reduced or paused, never silently downgraded.
7. No merge, release, or external deployment without explicit approval.

## Untracked residue

`experimental/oep-tactical/` existed in the checkout before this work began.
It is left untracked and out of scope.
