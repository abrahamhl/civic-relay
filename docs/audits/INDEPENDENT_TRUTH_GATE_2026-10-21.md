# Civic Relay: independent truth gate (2026-10-21)

This corrective patch does **not** claim operational emergency readiness.

## Evidence boundary
- `investor-next/lib/emergency-routing.mjs`: virtual nodes, synthetic ACKs; no actual radio transmission.
- `investor-next/lib/telecom-suite.mjs`: simulated satellite/NTN models and RF/CSI targets, not real Wi-Fi CSI capture or radio sensing.
- `investor-next/app/live-hardware-console.tsx`: real browser WebCrypto signatures but WebRTC loopback between peer objects in the same page; BroadcastChannel is same-origin browser context only.
- `experimental/android-nearby/`: Android Nearby lab with consent and synthetic payloads; CI build is not evidence of two-handset success. Issue #5 is still open.
- `LICENSE`: MIT, not Apache-2.0.

## Fixes in this branch
1. Fail closed on WebRTC unsupported, timeout and setup rejection; remove hardcoded RTT (1.4ms) displayed as measured.
2. Disclose the difference between browser crypto and phone-to-phone transport.
3. Label satellite, mesh and through-wall CSI/radar scenarios simulated in EN/ES/NL. Preserve Three.js and existing interactive experiments.
4. Disable one-click AI-generated NLnet proposal prompts in the site; add warning about the 20 October 2026 NLnet generative AI policy (the applicant must independently verify current rules and write without generative AI unless an explicit exception applies).
5. Correct Horizon SSRI-04 deadline in displayed cards from the erroneous 18 November to 5 November 2026 (official portal must remain source of record).

## Required before merging
- Run Next.js type-check, unit tests, static build, locale/SEO checks, and Browser/Buyer Arena regression on exact proposed SHA.
- Manually inspect live text in EN/ES/NL, all funding cards, WebRTC timeout/not-supported branches, simulated radar display, mobile layout and accessibility.
- Search all code for remaining unsupported claims (e.g. \"detects breathing\", \"through-wall\", \"real satellite\", \"100% implemented\") and correct only after verification.
- Keep deployment to production unapproved until PR checks and human acceptance.

## Strict no-go claims
No physical Android-to-Android transport measured, multi-hop field routing, raw CSI from ordinary smartphones, through-wall person detection, NTN uplink, 112/CAP institutional authority, operational SOS, or independent security certification.
