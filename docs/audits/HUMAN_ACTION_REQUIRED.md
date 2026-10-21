# HUMAN ACTION REQUIRED — OEP / Civic Relay

**Document Status:** Active Operator Checklist for Physical & Institutional Gates  
**Updated:** 2026-10-21

All software engineering, deterministic simulation (55/55 unit tests, 810-scenario sweep), multilingual investor UX (EN / ES / NL), Buyer Arena 8-persona Chromium validation (78/78 checks), security/threat modeling, and the 11-document investor dossier have been executed autonomously.

The following items **cannot be fabricated or simulated by an autonomous agent** and require physical hardware or institutional human sign-off:

---

## 1. Physical Two-Phone Android Nearby Field Validation (GitHub Issue #5 — `PHYSICAL_TEST_PENDING`)

- **Why Human Action Is Required:** Proving real short-range offline radio transfer (`PHYSICALLY_TESTED`) requires two physical Android handsets with Google Play Services in Airplane Mode, human operators confirming the Nearby authentication digits on both screens, and physical distance/attenuation conditions.
- **Pre-Built Artifact Ready to Install:**
  - GitHub Actions workflow `.github/workflows/android-nearby-ci.yml` compiles and uploads `oep-two-phone-lab-debug-apk` (7-day artifact retention) (`app-debug.apk`).
  - Or build locally: `cd experimental/android-nearby && gradle :app:assembleDebug`
- **Step-by-Step Operator Procedure:**
  1. Install `app-debug.apk` on **Phone A** and **Phone B** (record model, Android OS version, and Google Play Services version).
  2. Enable **Airplane Mode** on both phones, then manually re-enable Bluetooth and Wi-Fi on both phones. Confirm zero cellular/internet connectivity.
  3. Open **OEP Nearby Lab** on both phones, check the explicit laboratory consent checkbox, and grant requested Android Nearby permissions.
  4. Execute the **30-trial matrix** defined in [`experimental/android-nearby/PILOT_ACCEPTANCE.md`](../../experimental/android-nearby/PILOT_ACCEPTANCE.md):
     - 10 baseline A-to-B sessions (`1m` line-of-sight and `10m` indoor).
     - 5 discovery failure / permission-denied trials.
     - 5 connection interruption trials.
     - 5 duplicate-ID / replay rejection trials.
     - 5 TTL-expiry and late-ACK rejection trials (including `TIMEOUT-NO-ACK`, `CLOCK-ROLLBACK`, and `REVOKE-TIMER`).
  5. Export the local trial journal from both devices and populate [`experimental/android-nearby/field_trials_template.csv`](../../experimental/android-nearby/field_trials_template.csv) with the real measured rows (never pre-populate synthetic rows).
  6. Commit the resulting measured CSV and screenshots to close **Issue #5**.

---

## 2. Non-Dilutive Grant Submission & Consortium Outreach (`INDEPENDENT_VALIDATION_PENDING`)

Per Execution Directive #14 (*"Do not spend money, enable paid resources or submit funding applications without approval"*), no external grant applications were submitted automatically. Using the prepared dossier in [`docs/investor/`](../investor/):
1. **NLnet (Open Internet Stack — Restack / general call) (€5k–€50k):** Review [`docs/investor/ONE_PAGE_PITCH.md`](../investor/ONE_PAGE_PITCH.md) and [`docs/investor/FINANCIAL_SCENARIOS.md`](../investor/FINANCIAL_SCENARIOS.md) (Scenario A) and submit via `https://nlnet.nl/propose/`.
2. **Horizon Europe Cluster 3 (`HORIZON-CL3-2026-01` (SSRI-04 = European Critical Communication System; deadline 5 Nov 2026 — only realistic by joining an existing consortium)):** Share [`docs/investor/PILOT_PROPOSAL.md`](../investor/PILOT_PROPOSAL.md) and [`docs/investor/TECHNICAL_DUE_DILIGENCE.md`](../investor/TECHNICAL_DUE_DILIGENCE.md) with candidate European consortium coordinators / civil-protection practitioners.
3. **Dutch RVO (WBSO / MIT Feasibility):** Submit technical R&D project hours and feasibility scope using [`docs/investor/FUNDING_OPPORTUNITIES.md`](../investor/FUNDING_OPPORTUNITIES.md).
