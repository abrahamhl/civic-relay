# Scientific Truth Matrix & Capability Classification

> Historical snapshot (2026-10-22). Its M01–M19 identifiers are local to this document and differ from the canonical M01–M20 in [CR-VM-2026-10-25](CIVIC_RELAY_VISION_MAESTRA_2026-10-25.md). Use [the integration register](MASTER_VISION_INTEGRATION.md) for the current product programme. Old file references and capability labels require current verification; this matrix is not proof of deployment.

**Date:** 2026-10-22  
**Canonical Public Domain:** `https://civic-relay-investor.vercel.app`  
**Worktree Branch:** `feat/mission-control-sector-intel-20261022`  
**Audit Standard:** Section 3, 6 & 11 of `PROMPT_MASTER.md` + `docs/investor/EVIDENCE_REGISTER.md`

---

## 1. Classification Taxonomy

Every feature, visual layer, and protocol claim in **Civic Relay / OEP** is strictly categorized into one of five scientific and engineering states:

1. **`IMPLEMENTADO (REAL CODE / LOCAL LAB)`** — Deterministic, executable software verified by automated unit and Chromium integration tests in this repository.
2. **`SIMULADO (SYNTHETIC SIMULATION)`** — Interactive browser/Node simulation modeling physical or network phenomena using explicit synthetic parameters; labeled visibly in the UI so it is never mistaken for live hardware telemetry.
3. **`EN INVESTIGACIÓN (PHYSICAL FIELD TEST PENDING)`** — Code exists in repository (`android/oep-core` or experimental modules), but physical multi-device RF/hardware validation has not yet been executed and recorded.
4. **`SIN PERMISOS (UNAVAILABLE / NO PERMISSION)`** — Requires institutional, regulatory, or operator credentials (e.g., 112 PSAP dispatch integration, restricted municipal camera streams, or commercial 3D tile redistribution licenses).
5. **`NO FACTIBLE CON WEB ACTUAL (INFEASIBLE IN BROWSER / CURRENT HARDWARE)`** — Physically or architecturally impossible from a standard browser sandbox or standard unrooted consumer handset without external hardware or OS-level privileges.

---

## 2. Master Scientific Truth Matrix

| ID | Capability / Claim | Classification | Code / Module Reference | Verification Test / Evidence | UI Guardrail Badge |
|---|---|---|---|---|---|
| **M01** | **Canonical Envelope Validation, TTL Check & Anti-Spoofing (`OFFICIAL` state rejection)** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `packages/core/src/index.mjs`, `investor-next/lib/store-forward-engine.mjs` | `packages/core/tests/*.test.mjs`, `investor-next/tests/store-forward-engine.test.mjs` | `REAL CODE / LOCAL LAB` |
| **M02** | **Store-and-Forward Queue (`0 routes → QUEUED`) & Opportunistic Retry** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `investor-next/lib/store-forward-engine.mjs` | `investor-next/tests/store-forward-engine.test.mjs`, `sector-and-globe-mission.test.mjs` | `REAL CODE / LOCAL LAB` |
| **M03** | **Multipath SHA-256 Deduplication & Explicit Receiver `ACK` Requirement** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `investor-next/lib/store-forward-engine.mjs`, `investor-next/lib/sector-camera-engine.mjs` | `investor-next/tests/store-forward-engine.test.mjs` | `REAL CODE / LOCAL LAB` |
| **M04** | **Interactive 3D WebGL Globe with Raycasting, Orbit/Zoom, Layer Toggles & 2D SVG Fallback** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `investor-next/app/mission-control.tsx`, `investor-next/public/geo/land-110m.json` | `investor-next/tests/sector-and-globe-mission.test.mjs`, Playwright `P09` | `REAL CODE / LOCAL LAB` + `SYNTHETIC SIMULATION` |
| **M05** | **Natural Earth 1:110m Public-Domain Continental Land Geometry** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `investor-next/scripts/build-land-mask.mjs`, `investor-next/public/geo/land-110m.json` | `sector-and-globe-mission.test.mjs` (127 rings, 3,992 vertices) | `REAL CODE / LOCAL LAB` |
| **M06** | **Sector Intelligence Console (`El Tiemblo · Ávila`, `Valencia · Turia`, `Arnhem · NL`) with 1/4/9 CCTV Matrix** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `investor-next/lib/sector-camera-engine.mjs`, `investor-next/app/sector-intelligence-console.tsx` | `investor-next/tests/sector-and-globe-mission.test.mjs`, Playwright `P10` | `PUBLIC_CATALOG_VERIFIED` / `SYNTHETIC` |
| **M07** | **Anti-SSRF Camera URL Validator & Fail-Closed RBAC + Privacy Mosaic** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `validateCameraFeedUrl()` & `evaluateSectorIntelligence()` in `sector-camera-engine.mjs` | `investor-next/tests/sector-and-globe-mission.test.mjs` | `REAL CODE / LOCAL LAB` |
| **M08** | **8-Link Unified Causal Pipeline (`OBSERVAR → DECIDIR → COORDINAR`)** | `IMPLEMENTADO (REAL CODE / LOCAL LAB)` | `buildUnifiedPipelineState()` in `sector-camera-engine.mjs` | `investor-next/tests/sector-and-globe-mission.test.mjs`, Playwright `P10` | `REAL CODE / LOCAL LAB` |
| **M09** | **Multi-Scenario Crisis Topologies (`Wildfire`, `Coastal Flood`, `Urban Blackout`, etc.)** | `SIMULADO (SYNTHETIC SIMULATION)` | `investor-next/lib/virtual-scenarios.mjs` | `investor-next/tests/virtual-scenarios.test.mjs` | `SYNTHETIC SIMULATION` |
| **M10** | **2.5D Camera FOV Coverage Cones on Sector GIS Map** | `SIMULADO (SYNTHETIC SIMULATION)` | `computeCameraFovPolygon()` in `sector-camera-engine.mjs` | `investor-next/tests/sector-and-globe-mission.test.mjs` | `SYNTHETIC SIMULATION` (`isCalibrated: false`) |
| **M11** | **Celestial Body Exploration (`MOON` / `MARS` Spheres in Mission Control)** | `SIMULADO (SYNTHETIC SIMULATION)` | `CELESTIAL_BODIES` in `investor-next/app/mission-control.tsx` | `investor-next/tests/sector-and-globe-mission.test.mjs`, Playwright `P09` | `SYNTHETIC SIMULATION — EDUCATIONAL EXPLORATION ONLY` |
| **M12** | **Android Nearby Connections / BLE Physical Handset-to-Handset Relay** | `EN INVESTIGACIÓN (PHYSICAL FIELD TEST PENDING)` | `android/oep-core/`, `docs/audits/HUMAN_ACTION_REQUIRED.md` | JVM unit tests pass; physical 2-phone field test pending (`PHYSICAL_TEST_PENDING`) | `PHYSICAL FIELD TEST PENDING` |
| **M13** | **LoRa / Meshtastic External Radio Bridge** | `EN INVESTIGACIÓN (PHYSICAL FIELD TEST PENDING)` | Conceptual adapter schema in protocol layer; no paired USB/BLE LoRa hardware in web demo | Documented in `docs/investor/TRL_AND_VALIDATION_ROADMAP.md` | `RESEARCH CONCEPT` |
| **M14** | **Live Streaming of Municipal Restricted CCTV Cameras** | `SIN PERMISOS (UNAVAILABLE / NO PERMISSION)` | `accessLevel: 'MUNICIPAL_RESTRICTED'` in `sector-camera-engine.mjs` | Tested fail-closed via `RBAC_BLOCKED` in `sector-and-globe-mission.test.mjs` | `UNAVAILABLE / NO PERMISSION` |
| **M15** | **Direct 112 / 911 / Emergency PSAP Operational Dispatch** | `SIN PERMISOS (UNAVAILABLE / NO PERMISSION)` | Explicitly excluded by design; requires certified civil-protection interconnection | Verified by `dossier-truth-gate.test.mjs` | `UNAVAILABLE / NO PERMISSION` |
| **M16** | **Google Photorealistic 3D Tiles for Offline Emergency Operations** | `SIN PERMISOS (UNAVAILABLE / NO PERMISSION)` | Replaced with public-domain Natural Earth 1:110m + open SVG GIS layers to respect high-risk/offline ToS | Documented in `CAMERA_SECTOR_ARCHITECTURE.md` | `REAL CODE / LOCAL LAB` (Open Data alternative used) |
| **M17** | **Direct Browser-to-Satellite Uplink / NTN Control from Web App** | `NO FACTIBLE CON WEB ACTUAL` | Labeled in 3D Globe orbital layer (`SATELLITE_CONCEPT`) | `investor-next/tests/sector-and-globe-mission.test.mjs` | `RESEARCH CONCEPT — NO REAL SATELLITE LINK` |
| **M18** | **Through-Wall Human Presence Detection / RF Vitals Sensing from Browser** | `NO FACTIBLE CON WEB ACTUAL` | Explicitly debunked in Scientific Truth Matrix & Audio Audit (`W01`) | `docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md` | `NOT FEASIBLE IN BROWSER` |
| **M19** | **Zero-Click / Unconsented Remote Activation of Citizen Microphones or Cameras** | `NO FACTIBLE CON WEB ACTUAL` | Prohibited by OS sandboxes, GDPR, and OEP ethical architecture (`W02`) | `docs/security/DATA_AND_CONSENT_BOUNDARIES.md` | `PROHIBITED BY DESIGN` |

---

## 3. Automated Truth Gate Enforcement

The repository enforces scientific honesty automatically on every test run via:
1. **`investor-next/tests/dossier-truth-gate.test.mjs`** — Scans documentation and UI source to prevent fabricated TRL claims, unverified hardware assertions, or dependency mismatches.
2. **`investor-next/tests/sector-and-globe-mission.test.mjs`** — Verifies that `MOON` and `MARS` modes carry educational-only disclaimers, that `SATELLITE_CONCEPT` objects state no real satellite link exists, that camera FOV polygons carry `isCalibrated: false`, and that restricted feeds fail closed with `RBAC_BLOCKED`.
3. **`investor-next/scripts/check-canonical-domain.mjs`** — Ensures only `https://civic-relay-investor.vercel.app` is referenced across active product and investor documentation.
