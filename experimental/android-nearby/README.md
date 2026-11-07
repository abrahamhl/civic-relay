# OEP — Offline Emergency Protocol | two-phone Android Nearby laboratory

**Safety / provenance:** this is an EXPERIMENTAL, separately buildable Android app. It is not a production emergency system, a satellite uplink, an official alert, a rescue confirmation or a test call to 112. The current source has NOT been physically tested; any build-only CI means BUILDABLE, not PHYSICALLY_TESTED.

## Platform and dependencies
- Java 17, Android Studio + Android SDK 35, Android Gradle Plugin 8.9.2, Gradle 8.11.1, Google Play services Nearby 19.5.1.
- Minimum Android SDK 26. Two physical Android phones with Google Play services and working Bluetooth/Wi-Fi. Platform variations may require manual setup.
- Google announced in **July 2026** that Nearby Connections will stop automatically enabling Wi-Fi/Bluetooth radios (late 2026). Users must enable radios using the device Settings. The app only opens Settings pages; it never force-enables radios.
- Build from this folder using `gradle :app:assembleDebug` or open it as a project in Android Studio. No secrets, server, analytics SDK, GPS access in Java, or 112 integration.
- Experimental APK is debug-only. No guarantee of Android 17/SDK 37 behavior, power efficiency or cross-vendor compatibility.

## Two-phone reproducible protocol
1. Both owners read the experiment disclaimer, install the app and explicitly press **I CONSENT**. Only physically present adult volunteers should use it; do not test during a real incident.
2. On both phones, manually turn on Wi-Fi/Bluetooth in system Settings when needed. Grant the Android permissions when prompted. The app does not request location coordinates or use GPS; older Android versions may still demand platform location permission for discovery.
3. On phone B press **ADVERTISE AS LAB RECEIVER**; on phone A press **DISCOVER AS LAB SENDER**. Select the discovered peer by prompt; the two users must compare the matching Nearby authentication digits before both press **Codes match**.
4. Once both show CONNECTED, phone A presses **SEND SYNTHETIC TEST MESSAGE**. Observe that send acceptance alone is **not** a receiver receipt. Only after B receives bytes and returns an application-level `LAB_RECEIPT` will A display the receipt.
5. Turn off radios manually, move devices apart, disconnect, repeat with a new test session. Observe errors and delivery failures. Press STOP on both to revoke participation and close all endpoints; background discovery stops automatically on leaving the screen.
6. Capture for each trial: consent, timestamp, device model, Android version, Play services version, radio manually enabled, trial ID, sender/receiver role, successful pairing, test message receipt (yes/no), time difference between send and app-level ACK, failure reason, battery telemetry where obtainable. Use a separate volunteer-approved lab sheet; do not include personal whereabouts.
7. Repeat with at least 30 **explicitly enumerated** trials before any preliminary latency summary. Physical results cannot be claimed until logs and device identities are actually recorded. This is only a proposed methodology.

## Engineering limits / honest evidence
- This example has **one-hop device-to-device transfer**, no mesh, no gateway, no store-and-forward integration into the web app, no CAP, no satellite and no emergency dispatcher. `Status.SUCCESS` or `sendPayload` acceptance does not prove the remote app processed the message; receiver-originated `LAB_RECEIPT` is a separate byte payload.
- The peer session is gated by Nearby's user-compared authentication digits; the demonstration does **not** implement independent application-level digital signatures or persistent device identity. Therefore receipts remain experimental proof only **for the voluntarily paired peer in the local session**.
- The `LAB_MESSAGE` contains only a random UUID, a synthetic string and a 60-second expiration; no person/status/location is sent. The endpoint user can still observe radio proximity and device/app presence, so this is a privacy-relevant experiment.
- Queue/retry logic in `investor-next/lib/store-forward.mjs` is a separate simulated demonstration; it has **not** been ported into this native app.
- If the build fails due to toolchain or API evolution, fix source and rerun CI. Do not label the APK functional until successful physical device tests.

## Primary official API evidence
- https://developers.google.com/nearby/connections/android/get-started
- https://developers.google.com/nearby/connections/android/discover-devices
- https://developers.google.com/nearby/connections/android/manage-connections
- https://developers.google.com/nearby/connections/android/exchange-data
- https://android-developers.googleblog.com/2026/07/upcoming-changes-nearby-connections-api.html
- https://developers.google.com/android/guides/releases

## M1.1 protocol hardening — 21 October 2026
- LabDeliveryGuard.java is a JDK-testable state machine. Every application ACK must match the current UUID and consent-confirmed endpoint and arrive strictly before its 60-second local deadline. Stale ACKs, wrong peers, wrong IDs and expired envelopes never become successful messages.
- Timeout no longer locks sending forever: pressing SEND after the prior TTL expires records an expired attempt and permits a new fictional message.
- onConnectionResult now requires explicit local approval of matching authentication digits, not merely a successful Nearby status; old dialogs are blocked after consent revocation by a session epoch. Discovery/advertising and byte exchange still require normal Android permissions.
- Payload-level FAILURE and CANCELED from Nearby, distinguished using the outgoing payload's transport ID, clear the matching outstanding application trial. Successful sendPayload or byte transfer alone **never** means the receiver acknowledged the app message.
- An informed opt-in dialog documents nearby discoverability, battery implications and optional manual CSV sharing. STOP clears consent, messages, peer approvals and trial journal. Trial CSV is locally bounded to 120 events (UUID, outcome, local monotonic elapsed milliseconds) with no names, phone IDs, coordinates or distress text. Its only exit is an **explicit user-invoked system share chooser**; external copies cannot be recalled.
- JVM regression tests: LabDeliveryGuardTest.java and LabTrialJournalTest.java run before the Android APK build in .github/workflows/android-nearby-ci.yml. A passing CI compile **does not** attest to successful Android device-to-device transmission.
- **Known residual risks:** in-memory state is not persistent store-forward; the 60-second absolute wall-clock expiry in the message assumes reasonably synchronised phone clocks; locally recorded sender elapsed times are not calibrated RF measurements; a manually confirmed Nearby pairing code does not establish persistent trusted identity. No physical multi-hop, satellites, emergency-dispatch calls, third-party security audit or actual 30-trial dataset exists.

### Collecting voluntary reproducible data
Two owners review consent and verify the same Nearby digits on each screen. For each run, note the test scenario and manually export the local CSV after the trials; pair the files with the external worksheet only with volunteers' explicit approval. Include unsuccessful and expired runs, different vendor/Android versions, and radio-off tests. This is an experiment, not a rescue product. Use experimental/android-nearby/PILOT_ACCEPTANCE.md as the field checklist.

### Lab protocol v2 — challenge-bound receipts
Each fictional LAB_MESSAGE now carries a fresh cryptographically random UUID challenge in addition to the message UUID, expiry and fixed synthetic body. The consenting receiver echoes both IDs in its LAB_RECEIPT; the sender checks the exact message ID, per-message challenge, approved Nearby peer and local deadline. Version 1 payloads are intentionally rejected. Both handsets must run a v2 build. This **does not** create authenticated signatures, prevent a malicious approved peer from lying, guarantee disaster connectivity, or count as physical delivery without an observed hardware trial. It narrows simple mismatched/replayed receipt mistakes in the research protocol.

### M1.3 — automatic missing-ACK watchdog (21 October 2026)
A consented foreground trial now starts a **60-second application-level TTL watchdog** as soon as the synthetic message is submitted. A trial with no receiver receipt is automatically closed and recorded as `EXPIRED`, even without a second button press. Successful, failed, disconnected or revoked trials cancel the delayed callback. The callback checks both the session epoch and current message UUID, preventing obsolete timers from finalising newer trials or continuing after STOP.

Two deadline clocks are used: a wall-clock expiry for existing synthetic envelope compatibility and Android's monotonic `elapsedRealtime` for sender-side TTL. A change to the phone's date/time cannot extend the sender's monotonic deadline or permit a late receipt as valid. Pure-Java `LabDeadlinePolicy` and `LabDeadlinePolicyTest` check rollback, forward adjustment, TTL boundary, invalid monotonic progression and earliest-expiry scheduling. GitHub Actions runs the JDK test **before** APK assembly.

**Truth boundary:** this fixes a client-side safety-state bug. It is not measured RF reliability, a guarantee of delivery, persistent SOS queuing, Android background operation or a certified emergency service. Trial expiry is a failed/unconfirmed laboratory outcome, not evidence of injury. A device must remain foregrounded; leaving to Settings automatically stops the lab and revokes this session's consent. Cross-device clock differences may still cause a synthetic incoming message to be rejected.
