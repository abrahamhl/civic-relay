# Security & Trust Boundary Audit

## Perspective: Staff Security Engineer
**Focus:** Cryptographic identity, message spoofing, replay attacks.

### Findings
1. **Non-repudiation:** Ed25519 signatures correctly prevent payload tampering, but replay attacks might be possible if UUIDs are reused maliciously.
2. **Encryption:** NaCl box encryption ensures payload confidentiality, but metadata remains plaintext (necessary for routing).

### Action Items
- [x] Ensure idempotent enqueue tests prevent replay overwrites.
