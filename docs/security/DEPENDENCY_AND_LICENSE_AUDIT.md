# Dependency and License Audit — OEP / Civic Relay

**Audit Date:** 2026-10-21  
**Status:** `IMPLEMENTED` / `BUILD_VERIFIED`  
**Repository License:** MIT (`LICENSE`)

---

## 1. Repository License & Open-Source Compliance

- **Primary License:** MIT License (`LICENSE` at repository root, Copyright (c) 2026 Abraham).
- **Compatibility:** All direct runtime and development dependencies across the root workspace, `investor-next/`, and `experimental/android-nearby/` use permissive licenses compatible with MIT and EU public-research grant requirements (Horizon Europe / NGI / RVO).

---

## 2. Direct Dependency Inventory (`investor-next/package.json`)

| Package | Pinned / Declared Version | Scope | License | Purpose |
|---|---|---|---|---|
| `next` | `16.2.4` (resolved `16.3.6`) | Runtime (`dependencies`) | MIT | Static-export (`output: 'export'`) React framework for `/`, `/es/`, `/nl/` |
| `react` | `19.2.5` | Runtime (`dependencies`) | MIT | UI component rendering |
| `react-dom` | `19.2.5` | Runtime (`dependencies`) | MIT | DOM rendering and static HTML generation |
| `three` | `0.183.2` | Runtime (`dependencies`) | MIT | 3D orbital crisis globe and 5-floor emergency building visualizer |
| `typescript` | `5.9.3` | Dev (`devDependencies`) | Apache-2.0 | Strict static type checking (`tsc --noEmit`) |
| `@types/node` | `22.19.17` | Dev (`devDependencies`) | MIT | Node.js type definitions |
| `@types/react` | `19.2.14` | Dev (`devDependencies`) | MIT | React type definitions |
| `@types/react-dom` | `19.2.3` | Dev (`devDependencies`) | MIT | React DOM type definitions |
| `@types/three` | `0.183.1` | Dev (`devDependencies`) | MIT | Three.js type definitions |

### Core Simulation & Policy Engine Dependencies (`investor-next/lib/*.mjs`)
- `investor-next/lib/emergency-routing.mjs`: **Zero external dependencies** (pure ES module).
- `investor-next/lib/emergency-policy.mjs`: **Zero external dependencies** (pure ES module).
- `investor-next/lib/store-forward.mjs`: **Zero external dependencies** (pure ES module).

---

## 3. Experimental Android Nearby Lab Dependencies (`experimental/android-nearby/app/build.gradle`)

| Artifact | Version | Scope | License | Notes |
|---|---|---|---|---|
| `com.google.android.gms:play-services-nearby` | `19.3.0` | `implementation` | Google Play Services Terms / Android SDK | Proprietary Google Play Services client library on Android devices; used strictly in optional `experimental/android-nearby/` lab module. |
| `junit:junit` | `4.13.2` | `testImplementation` | EPL-1.0 | JVM unit testing for `LabDeliveryGuard`, `SessionCancellationGuard`, and `TrialExportFormatter`. |
| `org.json:json` | `20240303` | `testImplementation` | JSON License (permissive) | Local JVM test parsing of JSON envelopes. |

> **Architectural Isolation Note:** Because `com.google.android.gms:play-services-nearby` depends on Google Play Services on the handset, it is isolated inside `experimental/android-nearby/`. The core OEP protocol logic (`investor-next/lib/*.mjs` and `packages/core`) remains 100% open-source and transport-agnostic so future AOSP BLE / Wi-Fi Aware adapters can be plugged in without proprietary SDK lock-in.

---

## 4. CI/CD Supply-Chain & Workflow Permissions Audit

| Workflow File | Trigger Scope | Token Permissions | Status |
|---|---|---|---|
| `.github/workflows/emergency-lab-ci.yml` | `investor-next/**`, `docs/**` | `permissions: contents: read` | `IMPLEMENTED` |
| `.github/workflows/investor-next-ci.yml` | `investor-next/**` | `permissions: contents: read` | `IMPLEMENTED` |
| `.github/workflows/android-nearby-lab.yml` | `experimental/android-nearby/**` | `permissions: contents: read` | `IMPLEMENTED` |
| `.github/workflows/ci.yml` | Workspace root | Standard read checkout | `IMPLEMENTED` |

---

## 5. Secret & Credential Hygiene Verification

- Verified `.gitignore` excludes `.env*`, `.vercel`, `node_modules/`, `dist/`, `out/`, `.next/`, and `docs/internal/`.
- Verified zero API keys, private tokens, or personal data exist in tracked Git files (`git log` and working tree audited).
