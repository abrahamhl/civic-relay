# Website Information Architecture & Progressive Disclosure Journey

**Date:** 2026-10-22  
**Canonical Public Domain:** `https://civic-relay-investor.vercel.app`  
**Worktree Branch:** `feat/mission-control-sector-intel-20261022`  
**Base Commit SHA:** `7640ffddd53184d305543e78349d561ed41a3210`

---

## 1. Brand Architecture & Identity Alignment

To eliminate confusion between the umbrella platform and the underlying cryptographic/store-and-forward research protocol, every surface, header, and thesis card presents a unified two-tier nomenclature:

- **Civic Relay** — *Decentralized Crisis Coordination & Situational Awareness Platform* (the human-facing web, Mission Control 3D globe, Sector Intelligence / CCTV coordination view, and institutional transparency interface).
- **OEP (Offline Emergency Protocol)** — *Store-and-Forward & Opt-In Multi-Transport Protocol* (`investor-next/lib/` and `packages/core/`), governing signed canonical envelopes, SHA-256 deduplication, TTL enforcement, and explicit receiver acknowledgment (`DELIVERED` requires verified `ACK`).

---

## 2. The 30-Second Comprehension Thesis (`#thirty-second-thesis`)

Immediately below the main hero in `investor-next/app/investor-page.tsx`, a zero-jargon comprehension banner answers the three mandatory questions for non-technical citizens, emergency responders, scientists, and grant evaluators:

1. **What problem does it solve?**  
   *When cellular towers, power grids, or fiber backbones fail during wildfires, floods, or blackouts, isolated citizens and field teams lose coordination.*
2. **How does a simulation work?**  
   *You choose a crisis scenario, inspect a geographic sector on the 3D globe or Sector CCTV Console, watch how signed alerts enter a local `QUEUED` state when zero routes exist, and observe how opportunistic relays forward and deduplicate messages until an explicit receiver `ACK` is recorded.*
3. **What is demonstrated today vs. in research?**  
   - **Demonstrated Today (`REAL CODE / LOCAL LAB` & `SYNTHETIC SIMULATION`):** Deterministic browser/Node protocol engine, interactive 3D WebGL Earth/Moon/Mars Mission Control, Sector Intelligence CCTV coordination console (`El Tiemblo · Ávila`, `Valencia · Turia`, `Arnhem · Nederrijn`), and 83 automated verification tests.
   - **Pending Field Validation (`PHYSICAL FIELD TEST PENDING`):** Two-handset physical Android Nearby Connections / BLE relay test (`docs/audits/HUMAN_ACTION_REQUIRED.md`).
   - **Out of Scope / Not Claimed (`UNAVAILABLE / NO PERMISSION`):** Live 112/911 dispatch, real satellite uplink, through-wall radar, or unconsented sensor activation.

### Primary Call-to-Action Triad
- **CTA 1 (`Simular una emergencia` / `Simulate an emergency`):** Scrolls directly to `#mission-control-globe` and triggers interactive scenario controls.
- **CTA 2 (`Explorar el mapa interactivo` / `Explore interactive map`):** Scrolls to `#sector-intelligence-console` and focuses the 2.5D GIS / CCTV sector coordination matrix.
- **CTA 3 (`Ver qué funciona de verdad` / `See what truly works`):** Scrolls to `#evidence` (Scientific Truth Matrix & Verification Gate).

---

## 3. Three-Surface Progressive Disclosure Architecture

Rather than overwhelming first-time visitors with 20+ dense technical sections on a single undifferentiated scroll, Civic Relay organizes content into **three progressive disclosure surfaces** accessible both via the in-page Surface Switcher (`[data-testid="surface-switcher"]`) and via dedicated static routes:

| Surface | Target Audience | Primary Anchor / Dedicated Route | Core Modules Included |
|---|---|---|---|
| **Surface A · Descubrir** (*Story / Public Narrative*) | General public, municipalities, press, first-time visitors | `/`, `/es/`, `/nl/` (`#what-oep-does`, `#crisis-story`, `#eight-scene-journey`) | Hero, 30-Second Thesis, 8-Scene Causal Journey (`#eight-scene-journey`), Scroll Experience (`ScrollExperience`), System Explained (`SystemExplained`) |
| **Surface B · Explorar** (*Mission Control 3D & Sector Intelligence*) | Emergency coordinators, civil protection, UX reviewers, GIS analysts | `/mission-control`, `/es/mission-control`, `/nl/mission-control` (`#mission-control-globe`, `#sector-intelligence-console`) | Interactive 3D WebGL Globe (`mission-control.tsx`), Celestial Body Switcher (`EARTH` / `MOON` / `MARS`), Sector Intelligence & CCTV Console (`sector-intelligence-console.tsx`), Unified 8-Link Pipeline (`OBSERVAR → DECIDIR → COORDINAR`) |
| **Surface C · Investigar** (*Science, Lab & Technical Dossier*) | Protocol engineers, security auditors, NLnet / Horizon Europe reviewers | `/science`, `/es/science`, `/nl/science` (`#routing-lab`, `#developer-stack`, `#evidence`) | Interactive Store-and-Forward Routing Lab, Android Experimental Parity Matrix, Threat Model & Privacy Boundaries, Reproducible Test & Evidence Register |

---

## 4. The 8-Scene Causal Story (`#eight-scene-journey`)

Every visitor can step through or jump across the 8 causal scenes that connect the founder's vision (`audio/vision_original_2026-10-22.ogg`) to observable UI components:

| Scene | Title (ES / EN / NL) | Causal Role | Linked Interactive Module | Evidence Badge |
|---|---|---|---|---|
| **01** | **Evento de crisis** / *Crisis Event* / *Crisisevenement* | Forest fire (`El Tiemblo, Ávila`), DANA flood (`Valencia`), or grid blackout (`Arnhem`) disrupts normal infrastructure. | `#crisis-story` | `SYNTHETIC SIMULATION` |
| **02** | **Fallo de red convencional** / *Conventional Network Failure* / *Uitval regulier netwerk* | Cellular base stations and fiber backhaul drop to `0 routes`; cloud-dependent apps fail silently. | `#mission-control-globe` | `SYNTHETIC SIMULATION` |
| **03** | **Observación por sector y cámaras** / *Sector & Camera Observation* / *Sector- & camera-observatie* | Operator selects a geographic sector (`SECTOR-AVILA-TIEMBLO`, `SECTOR-VLC-TURIA`, `SECTOR-NL-ARNHEM`) and inspects open-catalog or synthetic CCTV cells with uncalibrated FOV cones. | `#sector-intelligence-console` | `PUBLIC_CATALOG_VERIFIED` / `SYNTHETIC` |
| **04** | **Estado humano con consentimiento** / *Consented Human Status* / *Menselijke status met toestemming* | Citizen explicitly opts in (`OK`, `NEED_HELP`, `SHELTERING`) with ephemeral session keys and local purge capability. | `#what-oep-does` | `REAL CODE / LOCAL LAB` |
| **05** | **Cola local Store-and-Forward** / *Local Store-and-Forward Queue* / *Lokale Store-and-Forward wachtrij* | With zero routes available, the signed envelope is retained locally in `QUEUED` state (`0 routes → QUEUED`) rather than dropped. | `#routing-lab` | `REAL CODE / LOCAL LAB` |
| **06** | **Salto oportunista y deduplicación** / *Opportunistic Hop & Deduplication* / *Opportunistische hop & deduplicatie* | When a mobile relay or secondary gateway appears, envelopes traverse multiple paths and collapse into one logical record via SHA-256 digest. | `#mission-control-globe` | `REAL CODE / LOCAL LAB` |
| **07** | **Confirmación explícita (ACK)** / *Explicit Acknowledgment (ACK)* / *Expliciete bevestiging (ACK)* | Delivery is never assumed on transmission; status transitions to `DELIVERED` only when a verified receiver `ACK` returns. | `#sector-intelligence-console` | `REAL CODE / LOCAL LAB` |
| **08** | **Frontera científica y auditoría** / *Scientific Boundary & Audit* / *Wetenschappelijke grens & audit* | Side-by-side separation of verified software logic (`TRL 3–4`), pending Android field tests (`PHYSICAL_TEST_PENDING`), and non-existent hardware capabilities. | `#evidence` | `REAL CODE / LOCAL LAB` |

---

## 5. Static Route Map & Internationalization (`EN`, `ES`, `NL`)

The Next.js 16 static export (`output: 'export'` in `investor-next/next.config.mjs`) generates 9 localized HTML entrypoints verified by `investor-next/scripts/finalize-locales.mjs`:

| Route Path | Static Output File | HTML `lang` Attribute | Surface Focus |
|---|---|---|---|
| `/` | `investor-next/out/index.html` | `lang="en"` | Full 3-Surface Experience (Default `EN`) |
| `/es` | `investor-next/out/es/index.html` | `lang="es"` | Full 3-Surface Experience (`ES`) |
| `/nl` | `investor-next/out/nl/index.html` | `lang="nl"` | Full 3-Surface Experience (`NL`) |
| `/mission-control` | `investor-next/out/mission-control/index.html` | `lang="en"` | Dedicated Surface B: 3D Globe + Sector CCTV Console (`EN`) |
| `/es/mission-control` | `investor-next/out/es/mission-control/index.html` | `lang="es"` | Dedicated Surface B: 3D Globe + Sector CCTV Console (`ES`) |
| `/nl/mission-control` | `investor-next/out/nl/mission-control/index.html` | `lang="nl"` | Dedicated Surface B: 3D Globe + Sector CCTV Console (`NL`) |
| `/science` | `investor-next/out/science/index.html` | `lang="en"` | Dedicated Surface C: Protocol Lab, Truth Matrix & Dossier (`EN`) |
| `/es/science` | `investor-next/out/es/science/index.html` | `lang="es"` | Dedicated Surface C: Protocol Lab, Truth Matrix & Dossier (`ES`) |
| `/nl/science` | `investor-next/out/nl/science/index.html` | `lang="nl"` | Dedicated Surface C: Protocol Lab, Truth Matrix & Dossier (`NL`) |

### Deep-Link & Query State Persistence
All routes preserve and synchronize URL query parameters so engineers and reviewers can share exact simulation states:
- `?scenario=URBAN_BLACKOUT_72H|COASTAL_FLOOD_MESH|RURAL_WILDFIRE_PARTITION|...`
- `?sector=SECTOR-AVILA-TIEMBLO|SECTOR-VLC-TURIA|SECTOR-NL-ARNHEM`
- `?body=EARTH|MOON|MARS`
