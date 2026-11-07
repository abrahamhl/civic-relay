# OEP Android M1 — adversarial protocol review and safety gate
Date: 2026-10-21. Scope: opt-in, foreground, two Android phones with Google Nearby Connections and app-level synthetic v2 receipt. **Not independently peer-reviewed. No physical trials yet.**

## Trust boundary
No account, official alert or 112 integration exists. A volunteer must explicitly accept the lab disclosure, grant OS permissions, choose the peer and compare the authentication digits shown by Google Nearby on both handsets. Peer IDs are *ephemeral Nearby session identifiers*, not verified real-world identities. The local process contains no server and does not collect GPS or rescue/victim data.

## Message v2
- Sender creates random UUID message ID + independently random UUID challenge and wall-clock expiry <=60 seconds. A single outbound attempt is held per peer/session.
- Receiver accepts only protocol version 2, the constant synthetic test body, canonical UUIDs, valid expiry, approved peer connection and a bounded replay cache of 100 inbound IDs.
- Receiver sends back LAB_RECEIPT with identical ID and challenge. Sender may show application ACK **only** if pending ID, challenge, authorised peer and sender-side TTL all match. Bytes accepted by Nearby are NOT app-level receipt.
- Timeout or a matched outgoing Nearby payload failure clears the reservation for the next synthetic trial. STOP clears local peer authorisation and test metadata. The opt-in journal has maximum 120 rows, is in-memory and requires manual export through the system chooser.
- LabDeliveryGuardTest and LabTrialJournalTest exercise policy independently of Android. Current Android CI builds a debug APK and does not emulate real Bluetooth/Wi-Fi propagation.

## Attack and failure review

| Risk | Current guard | Residual severity / falsification test |
| --- | --- | --- |
| Fake official emergency alert or 112 injection | Fixed LAB service ID, synthetic body, no CAP or 112 code | **High if re-used as production**; verify network traffic and source scan, do not add live alerts |
| Wrong peer receives data | Two-device digit comparison and approved endpoint set; session epoch invalidates old dialogs | **Medium**; user can mistakenly approve a malicious peer; two phones compare digits and explicitly reject mismatch |
| Spoofed receiver ACK | Challenge + message UUID + approved peer + TTL, v2 strict parsing | **High outside the test scope**; an approved malicious peer can lie after seeing bytes; application does not implement signed identities or third-party attestations |
| Replay and stale callbacks | Nonce, bounded seen-ID cache, TTL, STOP epoch and guard reset | **Medium**; cache is size-limited, process restart loses replay state; test 101+ messages, stop/re-consent and delayed receipts |
| Clock drift across offline phones | Receiver checks sender-provided expiresAt and sender independently checks local deadline | **Medium**; manual clock skew might reject valid exercise messages; test ±2 minutes drift; solve with session-monotonic age protocol, not looser auth |
| Battery exhaustion / background discovery | Foreground-only activity, stop advertising after connection, consent/permission gate | **High for emergency deployment**; unmeasured battery cost and Android OEM behavior; measure baseline and discovery duty cycle |
| Privacy retention | Minimal in-memory UUID/outcome/elapsed CSV; export only on explicit chooser | **Medium**; exported CSV belongs to receiving app; OS logs, Nearby stack and peer may retain metadata; consent notice explicitly states irreversibility |
| Radio availability and interoperability | Uses documented Android Nearby API, manual radio activation | **High**; no physical evidence or cross-vendor measurements; test Wi-Fi off, Bluetooth off, both toggled, 2 handset brands |
| Reliance on Google Play services | Nearby dependency is explicit and pinned | **High** for universal resilience hypothesis; AOSP-only phones and battery restrictions may be incompatible; investigate optional alternative adapters later |
| Multi-hop/central dispatch assumptions | No relay code, no fake source authentication | **Critical** for operational claims; one-hop trial cannot validate a city-wide mesh, satellite gateway or emergency-response dispatch |

## Go / no-go
- GO: download debug APK, perform informed consenting **laboratory-only** trials, publish failures and denominators.
- NO-GO: anonymous public pilots, unsupervised disaster deployment, official alert impersonation, actual SOS, 112, safety certification claim, throughput/latency performance claim without data.
- Hard prerequisites to raise physical maturity: issue #5 measured two-phone evidence with two endpoints and >=30 trial denominator; app protocol peer-security review; privacy review and approved independent test plan. No AI-generated score can substitute for those gates.

## Evidence ledger
GitHub PR: https://github.com/abrahamhl/civic-relay/pull/3
Physical test issue: https://github.com/abrahamhl/civic-relay/issues/5
Privacy issue: https://github.com/abrahamhl/civic-relay/issues/4
Primary platform guidance:
- https://developers.google.com/nearby/connections/android/manage-connections
- https://developers.google.com/nearby/connections/android/exchange-data
- https://developers.google.com/android/reference/com/google/android/gms/nearby/connection/ConnectionsClient
