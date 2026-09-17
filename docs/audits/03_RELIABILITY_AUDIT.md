# SRE & Observability Audit

## Perspective: Staff Site Reliability Engineer
**Focus:** Queue eviction, memory leaks, partition recovery.

### Findings
1. **OOM Risks:** If disconnected for days, MessageStore in-memory queues will OOM Node.js.
2. **Eviction:** TTL-based eviction is critical.

### Action Items
- [x] Implemented cleanupExpired to reap dead messages.
