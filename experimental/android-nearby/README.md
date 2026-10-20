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
