# SENDA / Civic Relay — Five-track audit and investment gates (2026-11-16)

**Status:** Research handoff, NOT a field validation or procurement recommendation. Owner repository: `abrahamhl/civic-relay`. Working branch: `research/senda-authorization-truth-gate-20261116`. No deployment or institutional integrations are claimed by this document.

## Track 1 — Verified source and product claims
- The repository's `README.md`, `docs/audits/LATEST_ENGINEERING_STATUS.md`, and `docs/investor/EVIDENCE_REGISTER.md` describe an experimental Android Nearby lab, deterministic simulated routing, synthetic acknowledgement and automated browser QA.
- **Global TRL roughly 3; physical multi-hop delivery not demonstrated.** The evidence register's EV-09 labels two-phone field measurement PENDING. The latest live website's release SHA must be checked separately against `master`.
- Current master evidence documents are internally time-stamped October; rerun exact-SHA CI, re-audit source/PRs, avoid reusing stale test claims, and verify actual production provenance before sending a pitch.

## Track 2 — Mathematical and RF feasibility
- A passive object, an observed radio source, or an unauthorised device is **not** by itself a protocol-compatible packet relay. Specular reflections and multipath can modify received fields but do not create arbitrary fresh information packets or receipts.
- Add a modeled, fail-closed route-authorisation boundary: `experimental/senda-route-truth/route-truth.mjs`. Its output explicitly says `SYNTHETIC_MODEL_ONLY`, even when a permissible directed path exists; test it using `node --test experimental/senda-route-truth/route-truth.test.mjs`.
- Future research: constrained time-expanded multigraph for transport selection (latency, energy, contact-window, legal duty-cycle, trust, permissions); independent baselines (shortest path, epidemic routing, adaptive store-and-forward); calibrated propagation link-budget and shadowing; held-out scenarios and confidence intervals. All hypotheses must have falsification criteria.
- Never claim guaranteed delivery, radio performance, satellite messaging, through-wall identification or interception from a model. LoRa EU868 regional parameters and duty-cycle limits apply: https://www.thethingsnetwork.org/docs/lorawan/regional-parameters/eu868/

## Track 3 — Open datasets, integrations and reusable repos
- EFFIS/Copernicus emergency data: https://emergency.copernicus.eu/data/ ; data/map usage examples: https://forest-fire.emergency.copernicus.eu/downloads-instructions . Preserve timestamp, attribution, licence and provenance; offline caching depends on source licence.
- Meshtastic reference firmware (GPL-3.0; review compatibility): https://github.com/meshtastic/firmware
- Reticulum and LXMF (review current licensing and interfaces): https://github.com/markqvist/Reticulum and https://github.com/markqvist/LXMF
- MapLibre Native local PMTiles documentation: https://github.com/maplibre/maplibre-native/blob/main/platform/android/docs/data/PMTiles.md
- OpenDroneMap/ODM (AGPL-3.0, review commercial integration before adapting): https://github.com/OpenDroneMap/ODM
- Externally provided OSINT must use public, licenced or expressly authorised sources, with no private network collection, impersonation or cloning cards/credentials. Data contracts require source, time, uncertainty, consent/legal basis and expiry.

## Track 4 — Government buyer intelligence, not presumed client access
- **ES:** SIRDEE 2021 awarded services contract 204,889,807.17 EUR to Telefónica Móviles España; official record: https://transparencia.gob.es/servicios-buscador/contenido/contratolicitacion.htm?fcAct=Sat+Nov+30+04%3A25%3A40+CET+2024&id=Licitacion_ee2f439e8f3c7da075cfef98925b4b0ad49101f5&lang=es . Existing critical network ≠ open tender or permission to interconnect.
- **NL:** government 2026 justice/security budget explains C2000 maintenance and mission-critical replacement preparation: https://www.rijksfinancien.nl/memorie-van-toelichting/2026/OWB/VI
- **DE:** March 2026 Bundestag describes BOS/TETRA coverage and planned broadband: https://www.bundestag.de/presse/hib/kurzmeldungen-1161366 . This is a programme reference, not a procurement award.
- **BE:** ASTRID operates a national mission-critical TETRA network and procures devices via framework agreements https://www.astrid.be/en/services/radio-communications ; ASTRID selected Frequentis LifeX for ComHub in 2026: https://tcca.info/news/126/frequentis_and_astrid_advance_belgiums_emergency_response_with_modernised_control_room_communications
- **Positioning:** additive offline-preparedness, audit logs, maps, training and bounded opt-in relaying. Never promise compatibility with encrypted government networks or 112 without contracts and certificates.
- **Funding:** 2026 Horizon Cluster 3 DRS closed on 5 Nov 2026. Verify 2027 DRS-03 decision-support and DRS-04 cross-border topics in the official current work programme before applying: https://rea.ec.europa.eu/funding-and-grants/horizon-europe-cluster-3-civil-security-society/disaster-resilient-society-europe_en ; https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe/cluster-3-civil-security-society_en
- Pilot/research proposal may be eligible without having completed field testing, but must declare technical immaturity, co-funding/consortium criteria and the hardware testing work package explicitly.

## Track 5 — Modular emergency starter kit (each electronic component target below EUR 50)
- EU868 ESP32+SX1262 LoRa development board (Heltec / compatible): limited-rate, sub-GHz **active relay only with two authorised active radios**; check board RF variant, antenna, certifications, battery and firmware.
- Seeed XIAO ESP32-S3 + Wio SX1262 low-power kit: mobile node with opt-in firmware; 868 MHz European SKU required.
- LILYGO T-Beam GNSS + LoRa variant: GNSS is *receive-only positioning*, not satellite uplink.
- USB SDR receiver (RTL2832U-compatible): **receive-only spectrum observation**, not a transmitter or multi-hop repeater; legal acquisition and privacy rules apply.
- Power bank, antenna, USB charging, enclosure, printed instructions: check total system BOM, VAT, CE/RED, spectrum rules and NL/ES shipping at checkout. This audit does **not** confirm real-time AliExpress delivery prices or shipping to both countries.
- A LoRa node costing under EUR 50 is a research component, not a certified rescue kit. Do not bundle medical supplies as clinical equipment without separate standards review.

## Prioritized acceptance gates
1. P0 Truth: canonical SHA/CI/deployment alignment; every claim maps to test or marked hypothesis.
2. P0 Safety: consent, expiry, fail closed on unknown identity, no RF spoofing or public service access, no bypass of duty cycle.
3. P0 Physical: 2 consenting Android devices + 2 LoRa units, >=30 timestamped real attempts, packet-loss, p50/p95 latency, battery drain, interference and failures.
4. P1 Data: one named open dataset with a reproducible ingest and an offline usable snapshot; provenance and licensing tested.
5. P1 Buyer: 1-page country-specific value propositions; independent partner interviews; quantified comparative gains *only* after measurement.
6. P1 Investor: conditional pilot offer, 12-week protocol, funding eligibility check, source-of-funds and 3 price tiers. Research demo ≠ deployed life-safety product.

**Five audit lanes are an analytical work division; no claim that five remote autonomous agents ran.**
