# Investor Readiness & Autonomous Engineering Status Report

**Date:** 2026-10-21  
**Primary Repository:** `https://github.com/abrahamhl/civic-relay`  
**Validation Repository:** `https://github.com/abrahamhl/buyer-arena`  
**Production URL:** `https://civic-relay-investor.vercel.app` (EN `/`, ES `/es/`, NL `/nl/`)

---

## 1. Executive Summary of Completed Workstreams

| Workstream | Scope | Status | Evidence & Artifacts |
|---|---|---|---|
| **Incident A — Vercel Production Branch Alignment** | Synchronized `investor-next/`, `docs/`, `audit/`, and CI workflows cleanly between `feat/master-emergency-routing-v1-20261020` and `master`, and aligned Vercel project `civic-relay-investor` (`prj_WAFcG0kyKgq11V5vkoTwLatk3GNt`) while keeping `apps/web` (`civic-relay`) untouched. | `VERIFIED` | `investor-next/scripts/smoke-deploy.mjs`, Issue #6 |
| **Incident B — Buyer Arena `synthetic-json-download` Failure** | Diagnosed selector collision in `#routing-lab .mer-tools button` where `<TransportSandbox/>` rendered before `.mer-controls`. Scoped selector to `#routing-lab .mer-controls .mer-tools button` `.nth(2)` and added explicit `data-testid` attributes. | `VERIFIED` | `abrahamhl/buyer-arena` commit `29bf9f8`, GitHub Actions Run `39553738476` & `39553738492` (`78/78` checks passing) |
| **Six Independent Specialist Reviews (Oracles 1–6)** | Conducted 5 independent domain reviews (Architecture, Security/Safety, QA/Browser, UX/Product, Grants/Investment) + Oracle 6 Synthesis. | `VERIFIED` | [`docs/audits/SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md`](SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md) |
| **WS1 — Release Engineering & Deployment Integrity** | Added automated live deployment smoke test (`investor-next/scripts/smoke-deploy.mjs`) and verified EN/ES/NL static routes. | `VERIFIED` | `investor-next/scripts/smoke-deploy.mjs` |
| **WS2 — Internal Engineering Quality** | Hardened `store-forward.mjs` payload validation against non-plain objects and added 8 new deterministic edge-case tests (`55/55` tests passing). | `VERIFIED` | `investor-next/lib/store-forward.mjs`, `investor-next/tests/*.test.mjs` |
| **WS3 — Buyer Arena Real Execution (`P01`–`P08`)** | Executed real headless Chromium journeys across all 8 mandatory personas (`P01`–`P08`) with individual folders, screenshots, and JSON evidence. | `VERIFIED` | `audit/personas/P01..P08/{run.json,evidence.json,feedback.md,issues.md,recommendations.md,screenshots/}` |
| **WS4 — Next-Generation Investor UX & Multilingual SEO** | Removed legacy satellite-operational SEO title in `[locale]/page.tsx`, added `canonical` + `hreflang` alternates (`en`, `es`, `nl`), and added the 8-stage scannable architecture pipeline (`EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`). | `VERIFIED` | `investor-next/app/layout.tsx`, `investor-next/app/[locale]/page.tsx`, `investor-next/app/system-explained.tsx`, `investor-next/app/system-story-data.ts` |
| **WS5 — Security, Licensing & Trust** | Created Threat Model, Dependency & License Audit, Data & Consent Boundaries, and hardened GitHub Actions `permissions: contents: read`. | `VERIFIED` | [`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md), [`docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md`](../security/DEPENDENCY_AND_LICENSE_AUDIT.md), [`docs/security/DATA_AND_CONSENT_BOUNDARIES.md`](../security/DATA_AND_CONSENT_BOUNDARIES.md) |
| **WS6 — Investor & Funding Dossier** | Authored all 11 required investor & grant documents with verified EU/NL sources (`HORIZON-CL3-2026-01-SSRI-04`, NLnet (OIS), UCPM KAPP, RVO WBSO/MIT). | `VERIFIED` | [`docs/investor/`](../investor/) (11 Markdown files) |
| **WS7 — Independent Physical Validation Readiness** | Documented two-phone Android Nearby validation protocol and operator checklist (`PHYSICAL_TEST_PENDING`). | `VERIFIED` | [`experimental/android-nearby/PILOT_ACCEPTANCE.md`](../../experimental/android-nearby/PILOT_ACCEPTANCE.md), [`docs/audits/HUMAN_ACTION_REQUIRED.md`](HUMAN_ACTION_REQUIRED.md) |

---

## 2. Verification Summary Matrix

| Test Suite / Check | Command | Result | Classification |
|---|---|---|---|
| **Investor-Next Unit, Policy, Store-and-Forward & 810-Sweep Tests** | `node --test investor-next/tests/*.test.mjs` | **55 / 55 PASS** (0 failures) | `AUTOMATED_TESTED` |
| **Next.js Strict TypeScript Validation** | `pnpm --dir investor-next run type-check` | **PASS** (0 errors) | `BUILD_VERIFIED` |
| **Next.js Static Production Build (`/`, `/es`, `/nl`)** | `pnpm --dir investor-next run build` | **PASS** | `BUILD_VERIFIED` |
| **Multilingual & SEO / Hreflang / Canonical Smoke Check** | `pnpm --dir investor-next run check:locales` | **PASS** (EN, ES, NL) | `AUTOMATED_TESTED` |
| **Buyer Arena 8-Persona Chromium Audit (`P01`–`P08`)** | `node scripts/civic-relay-review.mjs` | **78 / 78 PASS** (0 failed, 0 critical) | `BROWSER_TESTED` |
| **Buyer Arena Core CLI & Unit Test Suite** | `pnpm test && node dist/cli/main.js demo --size 10` | **PASS** (All unit & CLI smoke checks green) | `AUTOMATED_TESTED` |
| **Two-Phone Physical Android Nearby Field Matrix (30 Trials)** | Manual two-handset execution per `PILOT_ACCEPTANCE.md` | **Pending physical execution** (`Issue #5`) | `PHYSICAL_TEST_PENDING` |

---

## 3. Addendum 2026-11-06 - Function Lab, favicon and WCAG target sizes

| Workstream | Scope | Status | Evidence & Artifacts |
|---|---|---|---|
| **WS8 - Interactive Function Lab** | Added `#function-lab` section to EN/ES/NL home pages: 7 tabs (alert propagation SIR, Pareto routing, delivery probability, coverage search reduction, energy budget, 1-D Kalman tracking, real WebCrypto ECDSA sign/verify/tamper) plus a capability scorecard that labels radio as `NO_IMPLEMENTADO`. Pure math in `lib/function-lab.mjs`, typed via `lib/function-lab.d.mts`. | `VERIFIED` | `investor-next/app/function-lab.tsx`, `investor-next/lib/function-lab.mjs`, `investor-next/tests/function-lab.test.mjs` |
| **WS9 - Unit and static-build validation** | Full investor test suite `111 / 111 PASS`; `tsc --noEmit` clean; `check:locales` PASS EN/ES/NL; clean static export with 12 routes. | `VERIFIED` | `node --test tests/*.test.mjs`, `npm run type-check`, `npm run build`, `npm run check:locales` |
| **WS10 - Favicon and tap targets** | Real `favicon.ico` (701 B) and `icon.svg` served with metadata links; all interactive targets on home and mission control at least 24x24 px including globe fly-to buttons, sector chips, SSRF test buttons, checkboxes and external-source links. | `VERIFIED` | `investor-next/public/favicon.ico`, `investor-next/app/icon.svg`, `investor-next/app/globals.css` |
| **WS11 - Production deployment and live check** | Deployed `civic-relay-investor` with `vercel deploy --prod --local-config investor-next/vercel.json`. Live: `/`, `/es`, `/nl`, `/mission-control`, `/science` return 200; `#function-lab` present in all three home locales; `/favicon.ico` and `/icon.svg` return 200; Chromium at 390 and 1440 shows `consoleErrors: []`, `pageErrors: []`, horizontal overflow 0, and working ECDSA sign -> verify flow. | `VERIFIED` | Production URL `https://civic-relay-investor.vercel.app` |

Notes: local Python preview reports a 404 for `/senda/ojo` and `ERR_ABORTED` for video preloads; neither reproduces in production. The `__next.*` directories under `out/mission-control` are RSC export artifacts, not pages.

---

## 4. Addendum 2026-11-07 — Trilingual research library

| Workstream | Scope | Status | Evidence & Artifacts |
|---|---|---|---|
| **WS12 — Research library** | Added `/research/`, `/es/research/`, and `/nl/research/` with three technical reports (PCI, erasure tails/DTN bounds, display determinism), HTML/Markdown/BibTeX/PDF artifacts, two data files, and a full SHA-256 manifest. Reports explicitly state “not peer reviewed”; results are model outputs, not field measurements. | `VERIFIED` | `investor-next/app/research-page.tsx`, `investor-next/app/research-page.css`, `investor-next/content/research/papers.json`, `investor-next/public/research/manifest.json` |
| **WS13 — Localization and accessibility** | Localized page status, section eyebrows, abstracts and navigation in EN/ES/NL; English report titles marked `lang="en"` to avoid incorrect Dutch hyphenation; research, manifest, report and footer links meet the 24×24 px target minimum; sticky header keeps the research nav visible at 390 px. | `VERIFIED` | `investor-next/app/research-page.tsx`, `investor-next/app/research-page.css`, `investor-next/public/research/research.css` |
| **WS14 — Automated verification** | Added `scripts/research/verify-export.mjs`, chained it into `npm run build`, and exposed `npm run check:research`. It verifies three locales, three reports, two datasets, three PDFs and bundle digest `4c0f0e34…8f839f66`. `smoke:deploy` now also checks the three live research routes, all three report HTML pages, the 14 manifest files with byte size and SHA-256, and the aggregate BibTeX. | `VERIFIED` | `investor-next/scripts/research/verify-export.mjs`, `investor-next/scripts/smoke-deploy.mjs` |
| **WS15 — Production deployment and live check** | Production deployment `dpl_EEj1nqZRJgydYY4cNApgnV359JnA` is `READY` and aliased to `https://civic-relay-investor.vercel.app`. Vercel served the report editions only at clean URLs, so `.html` links initially returned 404; `investor-next/vercel.json` now rewrites `/research/:slug.html` to `/research/:slug`. Live smoke: `/`, `/es`, `/nl`, `/research/`, `/es/research/`, `/nl/research/`, all report HTML, 14 manifest artifacts and aggregate BibTeX return 200; source SHA `a622404c535affac27cf781e832fda6653427168` matches. Browser checks at 390 px and 1440 px across all three locales open all three reports and show 3 cards, 3 PDFs, sticky nav visible, zero horizontal overflow, zero console/page/HTTP errors. | `VERIFIED` | Production URL `https://civic-relay-investor.vercel.app/research/` |

Build evidence: `15` static pages, `123 / 123` site tests, `tsc --noEmit` clean, `check:locales` PASS EN/ES/NL, `check:domain` PASS, `check:research` PASS. `.vercelignore` now re-includes `investor-next/content/research/*.md`, which are build inputs.
