# Dependency and License Audit — OEP / Civic Relay

**Audit Date:** 2026-10-21 (re-verified against `package.json` and `build.gradle.kts`; earlier draft contained incorrect versions and non-existent test dependencies — corrected here)  
**Status:** `IMPLEMENTED` / `BUILD_VERIFIED`  
**Repository License:** MIT (`LICENSE`)

> **Limitation:** This is a manual inventory of *direct* dependencies. No automated SBOM (CycloneDX/SPDX) or transitive license scan has been run yet. That is a recommended follow-up (`pnpm licenses list`, `osv-scanner`).

---

## 1. Direct Dependencies — `investor-next/package.json`

| Package | Declared Version | Scope | License | Purpose |
|---|---|---|---|---|
| `next` | `16.4.2` | dependencies | MIT | Static export (`/`, `/es`, `/nl`) |
| `react` | `19.2.0` | dependencies | MIT | UI rendering |
| `react-dom` | `19.2.0` | dependencies | MIT | DOM rendering / static HTML |
| `three` | `0.180.0` | dependencies | MIT | Scroll globe and 3D building scene |
| `typescript` | `5.8.3` | devDependencies | Apache-2.0 | `tsc --noEmit` |
| `@types/node` | `22.15.3` | devDependencies | MIT | Types |
| `@types/react` | `19.2.0` | devDependencies | MIT | Types |
| `@types/react-dom` | `19.2.0` | devDependencies | MIT | Types |
| `@types/three` | `0.180.0` | devDependencies | MIT | Types |

The research engines `investor-next/lib/emergency-routing.mjs`, `emergency-policy.mjs` and `store-forward.mjs` have **zero external dependencies**.

---

## 2. Experimental Android Lab — `experimental/android-nearby/`

| Artifact | Version | Scope | License | Notes |
|---|---|---|---|---|
| `com.android.application` (AGP) | `8.9.2` | build plugin | Apache-2.0 | Build tooling |
| `com.google.android.gms:play-services-nearby` | `19.5.1` | implementation | Android SDK / Google Play Services terms (proprietary) | Only runtime dependency. Requires Google Play services on the handset. |

- `minSdk = 26`, `targetSdk = 35`. Nearby strategy in `MainActivity.java`: `Strategy.P2P_POINT_TO_POINT` (one-to-one, not mesh).
- JVM tests (`LabDeliveryGuardTest`, `LabDeadlinePolicyTest`, `LabTrialJournalTest`) are **JDK-only, no JUnit**: CI compiles them with `javac --release 17` and runs them with `java`.

> **Isolation note:** The proprietary Play Services dependency is confined to `experimental/`. Core protocol logic stays transport-agnostic so an AOSP BLE / Wi-Fi Aware adapter could replace it.

---

## 3. CI Workflow Permissions

| Workflow | Token permissions |
|---|---|
| `.github/workflows/emergency-lab-ci.yml` | `contents: read` |
| `.github/workflows/investor-next-ci.yml` | `contents: read` |
| `.github/workflows/android-nearby-ci.yml` | `contents: read` |
| `.github/workflows/ci.yml` (historical V0.1 workspace) | default (not yet restricted) |

Note: third-party actions in civic-relay workflows are pinned by tag (`@v4`), not by commit SHA. Pinning by SHA is a recommended hardening step.

---

## 4. Secret Hygiene

- `.gitignore` excludes `.env*`, `.vercel`, `node_modules/`, `dist/`, `out/`, `.next/`, `docs/internal/`.
- No automated secret scanner (gitleaks/trufflehog) is wired into civic-relay CI yet; adding one is a recommended follow-up.

## Security update — 22 October 2026 (PR #8)

The new CI vulnerability gate `npm audit --omit=dev --audit-level=high` flagged `next@16.3.6` as affected by high-severity GitHub advisories (including `GHSA-3w37-wq28-93x7`, `GHSA-mcj8-r9mp-w47p` and `GHSA-cjq9-62q9-8jv4`). The audit recommended `next@16.4.2` as the patched version. We updated the direct pinned dependency to that version. **This is not marked remediated until the same check is green on the final PR SHA.** The workflow also generates a CycloneDX SBOM artefact for the actual installed production dependency graph.

The repository currently lacks a committed `investor-next/package-lock.json`; direct dependencies are pinned but npm transitive resolution is not yet provably immutable. A reviewed, committed lockfile with `npm ci` is a separate reproducibility gate, not silently claimed complete.
