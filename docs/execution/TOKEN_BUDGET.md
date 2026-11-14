# Token budget

This session is operated under a token budget. The rules below keep spend
proportional to risk.

## Allocation

| Phase | Share | Purpose |
| --- | --- | --- |
| Reconnaissance and baseline | 10% | Read the prompt, record the real toolchain and test baseline |
| Vertical slice implementation | 45% | Adapter, views, snapshot, tests, Tauri scaffold |
| Verification | 25% | Unit tests, type-check, production build, browser smoke |
| Documentation | 15% | `docs/execution/*` |
| Contingency | 5% | Unforeseen defects |

## Rules

- Read a file once; keep the relevant excerpt, not the whole file in mind.
- Prefer one verified build over several speculative edits.
- Batch independent commands in a single message.
- Never re-run a passing suite to "be sure" unless code changed since.
- Stop and ask when a required fact cannot be verified; do not spend budget
  guessing.
- Escalate budget for a task only when the task is P0.

## Spend log

| Entry | Note |
| --- | --- |
| M1 | Slice implemented and verified in one pass after a single TS fix (`perspectiveCamera makeDefault`) and one bundling fix (lazy `Scene3D`). |
