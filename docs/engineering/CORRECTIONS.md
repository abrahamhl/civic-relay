# Correction ledger

## R01 — bounded asynchronous adapter operations

Severity P1: a never-settling describe/send locked dispatch and serial retryDue forever; revoke/purge could not settle the pending promise. Purging/reusing an ID shared a stale lock.

Reproduction: `node --test investor-next/tests/adapter-deadline.test.mjs` — four failures in evidence/2026-10-24/p1-before.txt.

Fix: configurable 1–60,000 ms operation timeout (default 5 seconds), bounded by envelope TTL; cooperative AbortSignal; revoke/purge/expiry cancel; record-scoped locks prevent old finally handlers unlocking newer records. Late failures do not recreate purged audit events.

Regression: deadline and store-forward suites, 28/28 pass, p1-after.txt. Adapter-held copies cannot be recalled or securely erased; a malicious adapter ignoring cancellation remains outside the local coordinator's control. Commit: locate with `git log --oneline --grep='bound adapter deadlines'`.
