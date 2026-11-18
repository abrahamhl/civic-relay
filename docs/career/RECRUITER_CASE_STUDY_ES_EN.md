# SENDA — Engineering case study for recruiters | Caso de ingeniería para selección
Updated 2026-11-18 — Research software, not a deployed emergency service.

## 45-second summary

**EN.** SENDA is a research and prototyping platform for road-safety alerts and resilient communications. I defined product scenarios, coordinated AI-assisted development and adversarial review, and focused the software on a real question: *Can a warning reach an approaching driver before the moving tail of a queue becomes a collision risk?* The system models evidence provenance, consent/permission gates, multiple transmission paths, a moving-queue horizon, delivery uncertainty and responsible abstention. It also includes interactive web visualisations and automated testing. It is **not** an accredited, field-tested emergency warning network.

**ES.** SENDA es una plataforma de investigación y prototipado sobre prevención de accidentes y comunicaciones resilientes. Dirigí los escenarios de producto, coordiné desarrollo y auditoría adversarial asistidos por IA y prioricé un problema verificable: *¿puede llegar a tiempo un aviso al conductor que se aproxima a un final de cola móvil?* El sistema modela procedencia de evidencias, consentimiento y permisos, rutas de comunicación alternativas, predicción de colas, incertidumbre de entrega y abstención segura. También incluye interfaces web interactivas y pruebas automatizadas. **No** es un servicio de emergencia homologado ni validado físicamente.

## What I designed, what AI assisted, and how to audit it

This case is not presented as a claim that one person manually wrote every line. The founder supplied and iterated use cases, product priorities, human safety constraints and verification requirements. AI coding/research assistants contributed implementations, tests and analysis over multiple sessions. The auditable professional contribution is **problem decomposition, technical decision-making, orchestration, review discipline and explicit no-go gates**; individual per-line authorship requires the underlying commit/agent record.

- [Technical decisions and algorithms (ES/EN)](TECHNICAL_DECISIONS_ES_EN.md) — causal deduplication, map-matched electronic horizon, moving queue-tail intervals, correlated delivery, alert fatigue and fail-closed permissions, with source files and evidence.
- [AI orchestration and responsible attribution (ES/EN)](AI_ORCHESTRATION_ES_EN.md) — human leadership vs AI assistance, implementation/review hand-offs, version control, checks and unknown states.
- [Interview briefing and 3-minute demonstration (ES/EN)](INTERVIEW_BRIEF_ES_EN.md) — grounded ways to explain the project for AI/SaaS/industrial IT employers.

**ES.** Mi aporte profesional es transformar problemas de operaciones reales en requisitos y prototipos verificables; dirigir trabajo con IA no equivale a reclamar autoría humana de todos los cambios. Las ecuaciones LWR, Wilson y Fréchet son anteriores a SENDA. La aportación investigadora propuesta está en su combinación concreta y su evaluación, todavía sin demostración física independiente.

## Real-world problem → technical work → transferable skill

| Pain point | SENDA prototype | Workplace skill |
|---|---|---|
| A broken-down vehicle, tow truck and taxi are coordinated manually | Incident state machine; consent-aware partner dispatch workflow; manual 112 dossier | Workflow mapping, product discovery, API contracts, B2B integration |
| A V16 or traffic report does not automatically warn the right driver | Canonical road incident identity, signed-origin requirements, deduplication across DGT/DATEX/BLE | Data normalization, traceability, security, event-driven design |
| Moving queue tail matters more than static accident point | H-ROAD-RRE-1: bounded speed, location uncertainty, queue approach and warning deadline | Applied modelling, testing assumptions |
| Mobile data or BLE may fail | H-ROAD-COVER-1: conditional channel evidence, delivery ACK distinction, correlation-aware bounds, fail-closed routing | Resilience, reliability, observability |
| Complex dashboards mislead operational users | Driver-attention arbiter; ES/EN/NL interface; synthetic-only demonstrations | UX for critical workflows and human-centred systems |

## Evidence at an immutable revision

- **Repository:** https://github.com/abrahamhl/civic-relay
- **Research PR:** https://github.com/abrahamhl/civic-relay/pull/51
- **Audited commit:** https://github.com/abrahamhl/civic-relay/commit/78bfd87e98d959296d3cada61dadeac47db4c596
- **RoadSafe CI:** https://github.com/abrahamhl/civic-relay/actions/runs/44220990437
- On this revision RoadSafe CI reported **840/840 core tests, 25/25 adversarial tests and 68/68 Chromium checks** on mobile and desktop, plus byte-exact synthetic experiment reproducibility.
- Node.js 22/24 builds, Android compilation, trilingual browser smoke, simulator and canonical gate were green on the reviewed commit.
- **Research model:** https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/docs/roadsafe/13_ROBUST_QUEUE_REACHABILITY_RESEARCH.md
- **Maturity:** research/browser/software validation only. BLE hardware performance, live road feeds, warning effectiveness on real drivers and partner contracts with Waze, DGT, 112, insurers and taxis are **not proven**.
- **Integration caution:** PR #51 is stacked on PR #50 → #49 → #48 → #47 → #46; research advances are **not yet merged into the default master branch**. Investor website may show a different revision.
- **AI disclosure:** development, tests and documentation used generative AI with founder orchestration, review and source-control oversight. Machine tests demonstrate observed software behaviour, not sole human authorship or regulatory compliance.

## Interview questions

**What trade-off did you make?** Missing or contradictory observations must result in *unknown*, not invented confidence, position, official authority or success acknowledgement. Fail-closed behaviour is prioritised.

**What was validated?** Deterministic tests, adversarial fixtures, Chromium web interactions, and synthetic reachability experiments. **No claims of field radio reliability or crash prevention.**

**How can this transfer to a factory?** The same design patterns apply to industrial event streams: correlate sensors and operator reports, de-duplicate events, track responsibility, escalate hand-offs, record auditable evidence, and design simple shop-floor user interfaces. This is a transferable architecture pattern, **not proof of PLC/SCADA integration or certified plant-control experience**.

## Recommended career directions

AI Solutions Implementation; Digital Transformation & Automation (manufacturing/SMEs); Technical Product Specialist / Product Operations (AI/SaaS/industrial tech); B2B web product UX; industrial IT project support without mandatory PLC expertise.

**Professional portfolio:** https://creative-tech-portfolio.vercel.app/ · **AUX Design:** https://auxdesign.nl/ · **Contact:** 2f.abraham@gmail.com (public business contact).

**Languages:** Spanish native, English C1 (self-reported), Dutch basic. **Work preference:** remote from Spain or hybrid in Spain, including employers based in the Netherlands where compliant cross-border employment is possible.

This page is a professional case study, not an engineering degree, scientific discovery, safety certificate or commercial release.
