# Transport Boundaries – Legal & Authorization Limits

## Core Principle

> **Civic Relay NEVER transmits on unauthorized frequencies.**

All RF transmission requires:
1. **Legal authorization** (FCC/RED compliance, licensed bands)
2. **Approved hardware** (certified devices)
3. **User consent** (explicit opt-in)

---

## What V0.1 Does

### ✅ Implemented

- **IP Transport** – Standard internet (TCP/IP over WiFi/Ethernet)
- **Simulated transports** – Deterministic fixtures for demo

### ❌ NOT Implemented

- **NO RF transmission** – No Bluetooth, no LoRa, no satellite uplink
- **NO frequency selection** – No ability to choose bands
- **NO signal modulation** – No PHY layer control
- **NO interception** – No receive-only scanning

**V0.1 is a software prototype.** It does not access radio hardware.

---

## Transport Authorization Matrix

| Transport | V0.1 Status | Legal Requirement | Planned V1.0 |
|-----------|-------------|-------------------|--------------|
| IP (WiFi/LTE) | ✅ Real | None (user's network) | ✅ |
| Bluetooth Mesh | 🎭 Simulated | ISM band (2.4 GHz, unlicensed) | ✅ Via OS APIs |
| LoRa | 🎭 Simulated | ISM band (868/915 MHz, power limits) | ⏳ Via certified module |
| Satellite | 🎭 Simulated | Licensed uplink via provider | ⏳ Via authorized gateway |
| Amateur Radio | ❌ Not planned | HAM license + callsign | ❌ Out of scope |
| CB Radio | ❌ Not planned | FCC Part 95 (US), licensed | ❌ Out of scope |

---

## Bluetooth Mesh (Future)

### Legal Basis

**Frequency:** 2.4 GHz ISM band (Industrial, Scientific, Medical)

**Regulation:**
- **US:** FCC Part 15 (unlicensed, power limit 1 mW - 100 mW)
- **EU:** ETSI EN 300 328 (similar limits)

**Authorization:** None required (uses OS-provided Bluetooth APIs)

### Implementation Path

**V1.0 approach:**

- Use **platform Bluetooth APIs** (Web Bluetooth, CoreBluetooth, Android BLE)
- No custom RF stack
- OS handles regulatory compliance

**Code:**

```typescript
// Web Bluetooth API (browser)
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: ['civic-relay-mesh'] }]
});
```

**Constraints:**

- Range: ~30-100m (Class 2 Bluetooth)
- Throughput: ~1 Mbps
- Peer limit: 7 direct connections (Bluetooth spec)

**Status:** ⏳ PLANNED (V1.0)

---

## LoRa (Future)

### Legal Basis

**Frequency:**
- **US:** 902-928 MHz (FCC Part 15.247)
- **EU:** 863-870 MHz (ETSI EN 300.220)

**Power limits:**
- US: 1W EIRP
- EU: 25mW ERP (duty cycle limits)

**Authorization:** Uses ISM band (unlicensed), but device must be **FCC/CE certified**

### Implementation Path

**V1.5 approach:**

- Use **certified LoRa module** (e.g., RN2483, SX1276)
- Module handles regulatory compliance (frequency hopping, duty cycle)
- App sends commands via serial/SPI

**Hardware required:**

- LoRa HAT for Raspberry Pi (certified)
- OR mobile phone with LoRa chip (rare)

**Constraints:**

- Range: 2-10 km (line of sight)
- Throughput: 0.3 - 50 kbps
- Duty cycle: 1% (EU) = 36s per hour transmit time

**Status:** ⏳ PLANNED (V1.5)

---

## Satellite (Future)

### Legal Basis

**Uplink:** Requires **licensed frequency allocation**

**Who has licenses:**
- Starlink (SpaceX)
- Iridium
- Inmarsat
- Thuraya

**User authorization:** Account with licensed provider

### Implementation Path

**V2.0 approach:**

- **NOT direct satellite transmission**
- Use **authorized gateway** (Starlink user terminal, Iridium modem)
- Gateway handles regulatory compliance
- App sends messages via **provider's API**

**Example:**

```typescript
// Starlink (future, if API available)
const response = await fetch('https://starlink.com/api/send', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userToken}` },
  body: JSON.stringify(message),
});
```

**OR use Iridium Short Burst Data (SBD):**

- User has Iridium modem (certified device)
- App connects via serial/Bluetooth
- Modem handles uplink

**Constraints:**

- Cost: $0.10 - $2 per message (provider-dependent)
- Latency: 10s - 60s
- Requires clear sky view

**Status:** ⏳ PLANNED (V2.0)

---

## Prohibited Transports

### ❌ Government/Military Frequencies

**Examples:**
- Police/Fire radio (VHF/UHF)
- Military SATCOM
- Aviation bands
- Maritime distress (2182 kHz, 156.8 MHz)

**Why prohibited:**
- **Illegal** (FCC fines up to $10,000/violation)
- **Dangerous** (interfere with emergency services)
- **Encrypted** (cannot decode without keys)

**Civic Relay will NEVER:**
- Scan these bands
- Attempt transmission
- Provide frequency selection UI

---

### ❌ Jamming / Interference

**Illegal under:**
- FCC Communications Act § 333 (US)
- European Commission Decision 2006/771/EC (EU)

**Prohibited actions:**
- Deliberately disrupting other signals
- Transmitting to block communications
- Creating interference

**Civic Relay will NEVER:**
- Implement jamming features
- Provide "deny service" modes

---

### ❌ Interception / Eavesdropping

**Illegal under:**
- ECPA (Electronic Communications Privacy Act, US)
- GDPR (EU)

**Prohibited actions:**
- Receiving/decoding messages not addressed to user
- Monitoring others' communications
- Passive scanning of encrypted channels

**Civic Relay will NEVER:**
- Receive messages not sent to this device
- Log other users' traffic
- Implement "sniffing" modes

---

## Regulatory Compliance Checklist

### Before V1.0 Launch

- [ ] **FCC Part 15 compliance** (if using Bluetooth/LoRa in US)
- [ ] **CE marking** (if selling in EU)
- [ ] **Device certification** (LoRa modules must be certified)
- [ ] **Privacy policy** (GDPR/CCPA)
- [ ] **Terms of service** (legal disclaimers)
- [ ] **Export control** (ITAR compliance if selling internationally)

### Device Certification

**If using LoRa:**

1. Use **pre-certified module** (FCC ID, CE mark)
2. Submit **Declaration of Conformity** (EU)
3. Test at certified lab (EMC, RF exposure)
4. Obtain **FCC ID** (if selling in US)

**Cost:** $5,000 - $20,000 (lab testing + filing)

---

## User Consent

### Required Disclosures

Before enabling any RF transport, app must show:

```
Civic Relay uses local mesh networks to send messages when internet is unavailable.

This uses Bluetooth, which may:
- Drain battery faster
- Be detected by nearby devices
- Transmit your approximate location

[ ] I understand and agree to enable mesh networking.

[Cancel] [Enable]
```

**User must explicitly opt-in.** No silent activation.

---

## Incident Response (RF Violations)

**If user reports interference:**

1. **Investigate:** Check logs, firmware version
2. **Disable:** Remote kill switch for RF transports
3. **Report:** File self-disclosure with FCC (if applicable)
4. **Fix:** OTA update to affected devices
5. **Notify:** Email all users with affected hardware

**Contacts:**

- **FCC:** https://www.fcc.gov/enforcement
- **ETSI:** https://www.etsi.org/

---

## Open Questions

1. **Power budget:** Can LoRa duty cycle (1% EU) support disaster traffic?
2. **Antenna design:** External vs. internal (affects certification)
3. **Multi-region:** How to detect user's region and enforce correct bands?
4. **Fallback:** If satellite gateway offline, show clear error (not silent fail)
5. **Liability:** If user misuses device (transmits illegally), is developer liable?

---

## Educational Note

**This document is NOT legal advice.**

Before implementing RF features:
- Consult RF engineer
- Hire regulatory attorney
- Work with certified test lab

**Non-compliance = fines, recalls, lawsuits.**

---

## Summary

| What Civic Relay Does | What It Does NOT |
|-----------------------|------------------|
| ✅ Use user's existing networks | ❌ Transmit on restricted bands |
| ✅ Platform Bluetooth APIs | ❌ Custom RF stacks |
| ✅ Certified LoRa modules | ❌ Arbitrary frequency selection |
| ✅ Authorized satellite gateways | ❌ Direct satellite uplinks |
| ✅ Comply with FCC/ETSI | ❌ Jam or intercept signals |

**V0.1 transmits NOTHING.** It's a software prototype.

**V1.0 will use only authorized, certified, licensed-or-unlicensed transports.**

---

**Next:** See [DEMO_SCENARIO.md](./DEMO_SCENARIO.md) for the wildfire acceptance test.
