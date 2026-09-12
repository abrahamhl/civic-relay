# Performance & Systems Audit

## Perspective: Performance Engineer
**Focus:** Crypto bottlenecks, serialization overhead.

### Findings
1. **Crypto Blocking:** Ed25519 verification is synchronous and CPU intensive. A flood of bad messages could DDoS the peer.
2. **Worker Threads:** Crypto operations should ideally be offloaded to a WebWorker or Node worker_threads.

### Action Items
- [ ] Plan architecture for off-thread crypto verification.
