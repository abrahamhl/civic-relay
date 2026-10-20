# MASTER EMERGENCY ROUTING NETWORK
**Official direction (20 October 2026):** Distributed Emergency Coordination & Adaptive Multi-Network Routing.

## Research thesis
The innovation is not a proprietary satellite network, nor a way to remotely enable other people's radios. It is an opt-in, interoperable coordination layer that can reason over existing devices and permitted transports during an infrastructure emergency.

**Repository:** abrahamhl/civic-relay.
**Base preservation:** this feature branch derives from feat/proyecto-comunicaciones-satelite-emergencias-offline-20261020, itself based on the EU investor branch. Do not overwrite or auto-merge the divergent Story Mode PR #2. Existing Three.js globe and crisis story remain intact.

## What is real in v0.1?
- Existing browser-local store/dispatch code and simulated transport adapters.
- Newly added pure deterministic 20–100 node network research model, reproducible by seed, with synthetic status-check/SOS requests, energy gating, topology routing, virtual gateway, direct cellular model, queued/ACK distinction and audit summaries.
- Trilingual investor story/globe from the existing branch.
- No physical local radio, location triangulation, real satellite, signed official alert, authoritative rescue ACK, emergency dispatch, validated radio reliability, operational cryptography or institutional integration.

Run model checks: `node --test investor-next/tests/emergency-routing.test.mjs`.
Run investor Next.js: `cd investor-next && npm install && npm run dev`; the interactive building laboratory is embedded below the existing 3D globe/story.

## Five modules: design contracts
**A ZoneOrchestrator:** `Zone {id,type,source,provenance,geometry,intensity,certainty,createdAt,expiresAt,requestedResponse,permissionPolicy,updateOf,cancellationOf}`. Public CAP 1.2 can express identifier, sender, sent, status, scope, info area polygons, severity, certainty, expiry, updates and cancellations. CAP *format conformity does not authenticate the issuer*. Production needs trusted issuer keys, X.509 or equivalent trust anchor, replay prevention, revocations, signed payload validation, rate limit and a vetted institutional feed. Current alert is explicitly an exercise object.

**B CapabilityRegistry:** one local device owns its capability/permission records. States AVAILABLE, DISABLED, PERMISSION_REQUIRED, UNSUPPORTED, RESTRICTED. Use documented Android/iOS APIs only. No silent OS permission or radio activation. Build optional OEM/operator adapters behind capabilities.

**C HumanStatus:** user choices SAFE, SOS_EXPLICIT, OTHERS_AFFECTED, CANNOT_DETERMINE plus UNKNOWN/NO_CONTACT when unanswered/unreachable. Never treat UNKNOWN as physical harm; optionally share location only with permitted recipient and retention expiry. All test data stays synthetic, with no 112 integration. A transport ACK does NOT mean a human is safe or rescued.

**D MasterRoutingEngine:** `TransportAdapter {id,evidenceLevel,capabilities(),send(envelope): Promise<AcceptedOrReceipt>}`. EvidenceLevel is SIMULATED / EXPERIMENTAL / PHYSICALLY_TESTED; it must be attached to every route and never upgraded automatically. Model route availability, compatibility, message priority, energy, capacity, synthetic latency/reliability scores, provenance, TTL and retries. Existing dispatcher/store is reusable, but real cross-device ACK authentication and multi-hop store-and-forward remain work items. No claims of untested multipath radio bonding.

**E EnergyPolicy:** NORMAL / ALERT / CONSERVATION / CRITICAL. Scan/discovery retry budgets need joint optimisation: saving battery by suppressing discovery can reduce reachability. Real system-wide energy mode changes are outside unprivileged app control.

## 12-step building collapse lab
Earthquake; exercise alert; status request; SAFE; UNKNOWN; explicit SOS; cellular blackout; opted-in local discovery; simulated external gateway; simulated centre sees SOS + UNKNOWN; indoor localisation limits; compare cellular-only versus adaptive model. Inputs: 20–100 nodes, participation, permission rate, battery, damaged infrastructure, radios, gateway, SAFE replies, SOS and deterministic seed. The graph uses **normalised abstract units**, not physical distances. Its ACK counts and hop counts are calculated model outputs, not field success metrics.

## Two-phone Android experimental plan
1. Android device A and B; one offline; both users explicitly consent. Choose Nearby Connections first (Android permissions and Play services dependent). Record versions and permission manifest. Never use emergency alert branding.
2. Define a **sandbox-only** message envelope: UUID, category, TTL, pseudonymous sender, optional coarse location with separate opt-in. Local encryption/session authentication; invite/peer identity verification.
3. Transmit A→B in airplane mode with Bluetooth/Wi-Fi manually enabled as required; B creates signed/validated receiver ACK, not a rescue ACK; A confirms correct receipt, reconnection, deduplication, expiration and cancellation.
4. Collect consented measurements: success/error denominator, p50/p95 delivery delay, Joules or battery drain methodology, device/OS profiles, false ACK count, restart recovery and operator-assisted transport reset. Do not extrapolate beyond sample devices.
5. Only after evidence: multi-hop third phone/gateway, trust anchors, CAP integration, incident centre emulator, DPIA and safety review.

## Institutional workstream
Local civil protection agency authentic alert endpoint; hospital/first-responder usability advisors; university field-methods and RF experts; telco/OEM background privileges and eSIM/NTN gateway exposure; security auditor and data-protection counsel; cross-border CAP profile & GDACS/authorised data provider assessment. These are partner requests, not existing capabilities.

## Security gates
- DENY institutional operations unless sender is verified using configured trust anchors (not a boolean set by a client).
- Default local-only and consent-granular. Allow revoke, time expiry, pseudonyms and deletion.
- No 112 API or actual emergency contact in demonstrations.
- Red-team replay, forged CAP, stale alert, malicious relay, false ACK, Sybil, denial-of-service, battery exhaustion, spoofed coordinates, device compromise, demographic exclusions and unreachable responders.
- Explicit audit labels on every output: MODELLED, LAB-EXPERIMENTAL, or INDEPENDENTLY-FIELD-TESTED.

## Financing pitch
> When a disaster takes conventional coverage offline, the devices around us do not all become useless. We are developing an open coordination layer that tests whether **consenting devices** can securely store, discover, forward and acknowledge urgent messages over compatible existing networks. Our reproducible virtual lab models 20–100 devices today; the next milestone is a measured two-Android offline pilot. We seek civil-protection, telecom and academic partners to verify alert provenance, battery trade-offs, physical reach and emergency interoperability. Not an emergency service, not a satellite carrier and not a claim of certified rescue delivery.

## Funding fit as of 20 October 2026
- **Horizon Europe Cluster 3 / Disaster Resilient Society 2026**, deadline **5 Nov 2026** per European Research Executive Agency. Potential fit for search and rescue innovation; topic eligibility, funding instrument, consortium and end-user participation must be checked in official call documents; no submission made.
  https://rea.ec.europa.eu/funding-and-grants/horizon-europe-cluster-3-civil-security-society/disaster-resilient-society-europe_en
- **UCPM 2026 KAPP:** real EU collaboration fit but **closed 21 May 2026**; track subsequent calls and build civil-protection consortium. https://civil-protection-knowledge-network.europa.eu/knowledge-action-prevention-preparedness-2026-call-proposals

## Evidence-based milestones
**M0** reproducible simulation and public risk register; **M1** two-phone validated offline transfer with receipts; **M2** safe gateway and signed authority alert proof of concept; **M3** multi-party exercise and independently documented usability/security tests. Investors should evaluate test logs and external letters of intent, not unsourced hypothetical rescue outcomes.
