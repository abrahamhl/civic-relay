# Institutional integration workstream (NOT included in the software lab)
## Hard rule
An unprivileged app may only discover, activate or query capabilities exposed by the device OS and authorised by the device owner. No hidden sensor activation, official alert spoofing, privileged Bluetooth toggles or automatic 112 messages.

| Integration | Today / without privileged partnerships | What partner must provide | Acceptance evidence |
| --- | --- | --- | --- |
| CAP 1.2 | Parse publicly available CAP feeds; treat unverified sources as untrusted | Civil protection publisher trust anchors, signed issuance and revocation policy | Provenance and replay tests with a real authorised feed |
| Android phone-to-phone | Nearby Connections, Bluetooth/Wi-Fi under manifest/runtime permissions, opt-in | None for basic 2-device tests; OEM for background/privileged continuity | Two distinct phones, isolated network, packet logs and battery measurements |
| iOS local networking | Network framework & user-facing local network permissions; support/OS matrix | Apple / platform partners for deeper integration or elevated operation | Device and OS compatibility matrix |
| Device energy controls | App-controlled scan/retry duty cycle, read battery mode where allowed | OEM / OS provider if global power mode changes are desired | Energy tests vs loss of discoverability, same hardware and workload |
| Satellite paths | No general-purpose direct-to-satellite socket assumed | Carrier, satellite/NTN vendor, supported app entitlement/API and contracts | Documented sanctioned API + physical transmission logs |
| Official incident routing | Sandbox only; no connection to 112 dispatch | Emergency agency procurement, trust, SOP, safety case and data governance | Institutional sandbox interoperability & human-approved go-live gate |
| Search/rescue confirmation | Explicit human SOS/status only; unknown remains unknown | Responders define triage workflow and confirmation semantics | Human-factor tests and error taxonomy |
| Indoor localisation | Floor and position visualisations purely synthetic | Hardware / infrastructure plus university RF evaluation | Reference ground truth and error bounds in real buildings |

## Consent and governance deliverables
Revocation UI, configurable data TTL, opt-in for precise location, encrypted storage as applicable, verifiable deletion, purpose limitation, minimised audit logs, threat model, GDPR DPIA before processing real public/health-sensitive incident data. Current browser lab contains no person's incident or contact data.

## Institutional milestones
P0 – design partner signed intent, technical/API feasibility workshop, project authority matrix.
P1 – Android offline pilot with explicit consent, device versions and independent receiver ACK.
P2 – official alert trust anchors and local gateway sandbox with replay protection.
P3 – formal field exercise under agency control, accessibility, reliability, energy, security and privacy evaluation.
P4 – optional certified public safety integration only after operator/agency approval; a product demo is not a certification.

## References
- Android Bluetooth permissions: https://developer.android.com/develop/connectivity/bluetooth/bt-permissions
- Nearby Connections: https://developers.google.com/nearby/connections/overview
- Apple Network framework: https://developer.apple.com/documentation/network
- CAP 1.2 standard: https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2.html
- Android PowerManager: https://developer.android.com/reference/android/os/PowerManager
