# Physical pilot handoff — pending, zero supplied trials

Use the existing authoritative protocol: [PILOT_ACCEPTANCE.md](../../experimental/android-nearby/PILOT_ACCEPTANCE.md), [threat model](../../experimental/android-nearby/THREAT_MODEL_M1.md), and [CSV template](../../experimental/android-nearby/field_trials_template.csv). This handoff adds evidence handling; it does not replace the protocol or record execution.

## What is missing

Two actual consenting Android phones, supported Google Play Services, the Android SDK35/Gradle8.11.1 build environment or exact-SHA CI APK artifact, operator time, independent reviewer, and controlled permitted test conditions. No device purchase or hardware operation was performed here. Android source is unchanged from base `6193593`; an APK built at that base must still be labelled with that base SHA.

## Capture procedure

1. Record repository commit, APK SHA-256, build receipt, both device models/Android/Play Services versions, consent and pairing-code confirmation. Use pseudonyms; exclude personal locations, phone identifiers and real distress text.
2. Record the manual radio/Internet state on both devices. Do not assume airplane mode alone proves absence of Internet. Follow the existing pairing and one-hop protocol; no unsolicited discovery, 112, CAP injection or external broadcasts.
3. Run at least 30 enumerated fictional trials. Keep failures and the full denominator. Capture sender UUID/challenge, approved peer, monotonic elapsed time and receiver application receipt with both screens/logs tied to that same trial. Use the existing bounded journal export manually.
4. Include wrong peer/code, missing ACK, late ACK, timeout retry, disconnect, duplicate/replay, forged receipt, wall-clock rollback, STOP while pending and lifecycle/permission revocation. Confirm that late callbacks cannot restore cleared state or report delivery.
5. Hash every original capture before review. Keep originals private and append a manifest linking trial ID, both endpoint evidence files, exact build SHA, capture method and reviewer notes. A signature/hash proves file integrity, not that the physical event occurred.
6. Validate CSV with `node investor-next/scripts/validate-field-trials.mjs <path-to-csv>`. Passing CSV metrics only yields FIELD_CSV_REVIEW_REQUIRED; `gatePassed` stays false. The validator does not authenticate phones, volunteers, videos or external sign-off.
7. Independent reviewer reconciles every claimed success with both endpoints and consent, reports excluded/failed trials, and approves only the exact one-hop scope observed. Compute delivery rate with denominator, latency distribution, actual measurement units, clock method and uncertainty. Never infer multi-hop, satellite reachability or rescue readiness.

## Data handling

Store originals and any pseudonym mapping outside public Git. Publish only an approved redacted measurement summary and non-sensitive hashes. Local STOP cannot revoke external shares. Retention/deletion and the independent privacy decision remain issue #4. Hardware acceptance remains issue #5; neither is closed by this handoff.
