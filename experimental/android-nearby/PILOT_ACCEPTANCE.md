# OEP M1 — two-Android physical acceptance protocol
Evidence gate: **PHYSICALLY_TESTED** only after real devices, volunteers and actual logs exist. Current Android APK building in CI is not this gate.

## Before starting
- Two distinct physical Android phones, foregrounded app, Google Play services present.
- Consent actively granted on both phones; users themselves enable Bluetooth/Wi-Fi.
- Participants confirm displayed connection authentication digits on BOTH screens.
- Test material must be synthetic, including the exact `LAB_MESSAGE` payload; no SOS, GPS coordinates, human identities, official authority zones or 112 calls.
- Use the accompanying blank `field_trials_template.csv`. No rows may be pre-populated with fictitious trials.
- Record application source commit, APK build link, device model, Android version, Play services version, radio state and test clock method. Keep log pseudonymous.
- Include runs with failures and non-delivery in the denominator. A receipt arriving after TTL MUST be recorded as late/invalid, not a success.

## Repeatable matrix (at least 30 actual logged attempts; proposed, not performed)
- 10 baseline A-to-B sessions with manual Bluetooth/Wi-Fi enabled and cellular Internet unavailable.
- 5 discovery failure/permission-denied trials, with no silent radio activation.
- 5 connection interruption trials (manually disable a radio/disconnect while attempting a message).
- 5 repeated-message and replay experiments (test receiver behavior with duplicated exercise identifiers).
- 5 TTL-expiry and expired-ACK trials; report both expected and actual behavior.
- Include both the same-vendor and cross-vendor Android pair if available; do NOT claim cross-vendor interoperability without a second vendor.

## Pass/fail acceptance
- P0: no unconsented discovery or send; no 112 calls, official CAP spoofing, private status or precise GPS.
- P0: only a receipt created by the explicitly paired receiving application may mark a valid experimental ACK; sender transport acceptance is NOT success.
- P0: TTL expiry prevents a late receipt being counted as delivered; failures and revocation close the local session.
- P1: deterministic data schema, independent denominator and evidence of at least 30 actual trials.
- P1: report trial success numerator/denominator and failures; p50/p95 time only with honest timestamps/time measurement methodology. Battery drain analysis requires documented control and measurement method; never infer Joules from percentages.
- P1: tester signs report as a lab experiment, not an operational safety certification. Incident responders are not contacted.

## Escalation after M1
M2: gateway plus third phone, independent security review, demonstrable authenticated receipts and offline resend persistence.
M3: partner tabletop test, verified alert ingestion, threat analysis, privacy/DPIA.
M4: ask a standards laboratory about a **defined** product cybersecurity evaluation / interoperability exercise. Neither M1 nor an ISO guideline certifies emergency efficacy.

**Disallowed claim:** an Android CI green badge, app permission screen or local transport receipt makes OEP deployable for real emergency response.
