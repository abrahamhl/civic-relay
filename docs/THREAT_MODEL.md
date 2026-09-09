# Threat Model – Civic Relay

## Security Posture Summary

**V0.1 is a prototype.** It demonstrates resilient architecture but does **NOT** implement production-grade security.

**Key principles:**

1. **No custom crypto** – Use platform APIs (Web Crypto, TLS)
2. **Honest threat assessment** – Document what we don't protect against
3. **Input validation** – Zod schemas enforce message structure
4. **Provenance tracking** – Origin and verification state preserved

---

## Assets to Protect

### 1. User Location

**Sensitivity:** HIGH

Approximate location sent with every message.

**Risk:** Location tracking, surveillance, targeting.

**V0.1 mitigation:** None (location sent in plaintext)

**Future:**
- Location obfuscation (random jitter)
- User consent per message
- Differential privacy for aggregated maps

---

### 2. Message Content

**Sensitivity:** VARIES

- "I'm Safe" – Low sensitivity
- Medical condition details – High sensitivity
- Names of missing persons – Medium sensitivity

**Risk:** Eavesdropping, data leaks, unauthorized access.

**V0.1 mitigation:** None (messages unencrypted)

**Future:**
- TLS for IP transport
- E2E encryption for sensitive message types
- Opt-in encryption (user choice)

---

### 3. User Identity

**Sensitivity:** MEDIUM

Origin field = device ID (no real names).

**Risk:** Device tracking, correlation attacks.

**V0.1 mitigation:** Device ID only (no PII)

**Future:**
- Ephemeral identities (rotate per incident)
- Anonymous mode (no device ID)
- Public key identity (self-sovereign)

---

### 4. Incident Data Integrity

**Sensitivity:** HIGH

Coordinator decisions based on message data.

**Risk:** False reports, message tampering, spam.

**V0.1 mitigation:**
- Verification states (UNVERIFIED clearly labeled)
- Message ID prevents duplication
- TTL prevents stale data

**Future:**
- Digital signatures (sender verification)
- Rate limiting (prevent spam)
- Reputation system (penalize false reports)

---

## Threat Actors

### 1. Eavesdropper

**Goal:** Intercept messages in transit

**Capability:** Passive network monitoring

**V0.1 impact:** **HIGH**  
All messages sent unencrypted. Eavesdropper sees location, type, content.

**Mitigation:**
- [ ] TLS for IP transport
- [ ] E2E encryption for sensitive messages

---

### 2. Spammer

**Goal:** Flood system with fake messages

**Capability:** Automated message creation

**V0.1 impact:** **MEDIUM**  
No rate limiting. Spammer can create unlimited messages.

**Mitigation:**
- [ ] Device ID rate limiting
- [ ] Proof-of-work (slow down automation)
- [ ] Coordinator moderation tools

---

### 3. Malicious Node (Mesh)

**Goal:** Drop or alter messages in mesh network

**Capability:** Control mesh peer, intercept forwarding

**V0.1 impact:** **HIGH**  
No message integrity check. Malicious node can:
- Drop messages silently
- Alter message content
- Replay old messages

**Mitigation:**
- [ ] Message signatures (HMAC or digital signature)
- [ ] Merkle tree for history integrity
- [ ] Peer reputation (penalize drops)

---

### 4. False Reporter

**Goal:** Create panic with fake incidents

**Capability:** Create FIRE/SOS messages at will

**V0.1 impact:** **MEDIUM**  
All citizen reports marked UNVERIFIED. Coordinator sees verification state.

**Existing mitigation:**
- ✅ Verification states prevent auto-trust
- ✅ Origin tracking (device ID)

**Future mitigation:**
- [ ] Corroboration (multiple independent reports)
- [ ] Reputation decay (penalize false reports)
- [ ] Official source prioritization

---

### 5. State-Level Adversary

**Goal:** Surveillance, censorship, jamming

**Capability:** DPI, RF jamming, backdoors

**V0.1 impact:** **VERY HIGH**  
No encryption, no anti-censorship, no jamming resistance.

**Future mitigation:**
- [ ] E2E encryption
- [ ] Frequency hopping (LoRa)
- [ ] Onion routing (anonymity)
- [ ] Domain fronting (censorship resistance)

**Reality check:** Civic Relay **cannot** protect against state-level adversaries in V0.1 or near future. Users in high-risk environments should use specialized tools (Tor, Signal, etc.).

---

## Attack Scenarios

### Scenario 1: Replay Attack

**Attacker:** Eavesdropper records old SOS message

**Method:** Re-transmit same message later (false alarm)

**Impact:** Resources wasted on resolved incident

**V0.1 defense:** ✅ TTL expires old messages

**Weakness:** No timestamp verification (attacker can replay within TTL)

**Fix:** [ ] Signed timestamps from coordinator

---

### Scenario 2: Message Tampering

**Attacker:** Malicious mesh peer

**Method:** Alter message payload ("SAFE" → "SOS")

**Impact:** False alarm or missed emergency

**V0.1 defense:** ❌ None

**Fix:** [ ] Message signatures (verify integrity)

---

### Scenario 3: Location Spoofing

**Attacker:** False reporter

**Method:** Create FIRE message at false location

**Impact:** Resources sent to wrong area

**V0.1 defense:** ⚠️ Verification state (UNVERIFIED)

**Weakness:** Coordinator may still act on unverified report

**Fix:**
- [ ] Corroboration (multiple reports at same location)
- [ ] GPS attestation (Android SafetyNet / iOS App Attest)

---

### Scenario 4: Denial of Service

**Attacker:** Spammer creates 10,000 fake messages

**Method:** Automated script, no rate limit

**Impact:** Coordinator dashboard unusable, real messages buried

**V0.1 defense:** ❌ None

**Fix:**
- [ ] Rate limiting per device ID
- [ ] Coordinator filtering tools
- [ ] Message throttling (queue size limits)

---

### Scenario 5: Man-in-the-Middle (IP Transport)

**Attacker:** Network attacker

**Method:** Intercept HTTP POST, alter message

**Impact:** Message content changed, location spoofed

**V0.1 defense:** ❌ None (HTTP only)

**Fix:** [ ] HTTPS (TLS) for all IP transport

---

## Privacy Considerations

### Data Retention

**V0.1:** Messages stored in-memory (cleared on page reload)

**Future:** IndexedDB (persistent)

**Risk:** Old messages reveal historical location patterns

**Mitigation:**
- [ ] Auto-delete after 7 days
- [ ] User-controlled retention
- [ ] Export + local delete

---

### Cross-Device Sync

**V0.1:** No sync (each device independent)

**Future:** Backend sync for message history

**Risk:** Server sees all user messages + locations

**Mitigation:**
- [ ] E2E encryption (server sees ciphertext only)
- [ ] Zero-knowledge architecture
- [ ] User controls sync (opt-in)

---

### Analytics / Telemetry

**V0.1:** None

**Future:** Error reporting, usage metrics

**Risk:** Tracking, profiling

**Mitigation:**
- [ ] Opt-in only
- [ ] Anonymize device IDs
- [ ] No location in telemetry

---

## Cryptography (Future)

### What NOT to Do

❌ **Do NOT implement custom crypto**

- No custom AES modes
- No homebrew key derivation
- No custom signature schemes

### What TO Use

✅ **Platform APIs:**

- **Browser:** Web Crypto API
- **Node.js:** `crypto` module
- **Standard:** TLS 1.3, AES-GCM, Ed25519, X25519

### Recommended Approach

**Message encryption (E2E):**

1. Each device generates Ed25519 keypair
2. Public key = device identity
3. Encrypt payload with recipient's public key (X25519 + ChaCha20-Poly1305)
4. Sign envelope with sender's private key

**Implementation:** Use [libsodium.js](https://github.com/jedisct1/libsodium.js) or [TweetNaCl](https://tweetnacl.js.org/)

---

## Authorization

### Who Can Do What?

| Action | Citizen | Coordinator | Responder | Admin |
|--------|---------|-------------|-----------|-------|
| Create message | ✅ | ✅ | ✅ | ✅ |
| View unverified | ✅ (own) | ✅ (all) | ✅ (all) | ✅ |
| Upgrade verification | ❌ | ✅ | ✅ | ✅ |
| Mark disputed | ❌ | ✅ | ✅ | ✅ |
| Delete message | ✅ (own) | ❌ | ❌ | ✅ |

**V0.1 enforcement:** None (no roles implemented)

**Future:** Role-based access control (RBAC)

---

## Compliance

### GDPR

**Personal data:** Location, device ID

**V0.1 status:** ❌ Not compliant

**Required:**
- [ ] User consent (explicit opt-in)
- [ ] Data deletion (right to erasure)
- [ ] Data export (right to portability)
- [ ] Privacy policy
- [ ] Cookie banner (if using analytics)

---

### FCC (US Radio Regulations)

**Applies to:** Any RF transmission

**V0.1 status:** ✅ N/A (no RF transmission)

**Future (LoRa/satellite):**
- [ ] Use licensed bands OR ISM bands (902-928 MHz)
- [ ] Stay within power limits (FCC Part 15)
- [ ] Device certification (FCC ID)
- [ ] No interference with emergency services

---

### RED (EU Radio Equipment Directive)

**Applies to:** Bluetooth, LoRa, satellite devices

**V0.1 status:** ✅ N/A

**Future:**
- [ ] CE marking
- [ ] Declaration of Conformity
- [ ] Electromagnetic compatibility (EMC) testing

---

## Incident Response Plan (Future)

### Security Breach

1. **Detect:** Monitoring alerts on anomalous traffic
2. **Contain:** Rate-limit affected device IDs
3. **Investigate:** Log analysis, trace attacker
4. **Eradicate:** Block malicious nodes
5. **Recover:** Restore from backup if needed
6. **Learn:** Post-mortem, update threat model

### Data Leak

1. **Notify:** Users affected within 72h (GDPR)
2. **Assess:** What data was exposed?
3. **Mitigate:** Rotate keys, invalidate tokens
4. **Communicate:** Public disclosure (transparency)

---

## Security Roadmap

### Phase 1: Transport Security

- [ ] HTTPS for IP transport
- [ ] TLS 1.3 minimum
- [ ] Certificate pinning (mobile apps)

### Phase 2: Message Integrity

- [ ] Message signatures (Ed25519)
- [ ] Timestamp verification
- [ ] Replay protection (nonce)

### Phase 3: Privacy

- [ ] E2E encryption for sensitive messages
- [ ] Location obfuscation
- [ ] Ephemeral identities

### Phase 4: Abuse Prevention

- [ ] Rate limiting per device
- [ ] Proof-of-work for message creation
- [ ] Reputation system

### Phase 5: Mesh Security

- [ ] Peer authentication
- [ ] Secure routing (prevent malicious nodes)
- [ ] Traffic analysis resistance

---

## Open Questions

1. **Identity:** How to verify device identity without central authority?
2. **Key distribution:** How to share public keys in offline environment?
3. **Revocation:** How to revoke compromised device?
4. **Spam vs. Privacy:** Rate limiting requires tracking device IDs (reduces privacy)
5. **Emergency override:** Should admins be able to decrypt E2E messages in life-or-death situations?

---

## Disclaimer

**V0.1 is NOT production-ready.**

Do not use Civic Relay in actual emergencies until:

- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] Privacy policy published
- [ ] Regulatory compliance verified
- [ ] E2E encryption implemented

**Use at your own risk.**

---

**Next:** See [DATA_SOURCES.md](./DATA_SOURCES.md) for external data integration security.
