# Fuentes de cada afirmación en pantalla

Verificado el 03-11-2026 sobre `master` @ `4c310f7`.

| Afirmación en el vídeo | Fuente | Cómo comprobarla |
| --- | --- | --- |
| 98/98 tests del laboratorio en verde | `investor-next/tests/*.test.mjs` | `cd investor-next && node --test tests/*.test.mjs` (re-ejecutado: 98 pass, 0 fail) |
| 810 escenarios, 0 violaciones de invariantes (simulado) | `docs/investor/EVIDENCE_REGISTER.md` EV-02, `investor-next/scripts/oep-evidence-run.mjs` | `node --test investor-next/tests/oep-evidence-report.test.mjs` |
| 15/15 tareas automatizadas en Chromium | `evidence/browser-release/summary.json`, `evidence/vision-integration/manifest.json` | Registrado el 24-10-2026, SHA `LOCAL`; son scripts, no personas |
| 26 tests del núcleo | `evidence/vision-integration/manifest.json` (`unitTests.core`) | `pnpm --filter @civic-relay/core test` |
| 6 workflows de CI | `.github/workflows/` | `ls .github/workflows` |
| ~22k líneas de código | Conteo `wc -l` de `.ts .tsx .mjs .java .kt .css` sin `node_modules` | 22 184 líneas |
| ES · EN · NL | `investor-next/app/(en)`, `investor-next/app/(localized)/[locale]` | — |
| 20 módulos, 8 escenarios, gates G0–G7 | `docs/product/CIVIC_RELAY_VISION_MAESTRA_2026-10-25.md` §C, §D, §H | — |
| Flujo de 8 etapas y módulos | `docs/investor/ARCHITECTURE.md` | — |
| 8 núcleos de la arquitectura objetivo | Documento maestro §F | — |
| Escenario S01 y prueba negativa | Documento maestro §C S01 y §G | Objetivo de diseño, no capacidad desplegada |
| Protocolo Android v3 (P-256, cola, STOP regenera clave) | `docs/audits/LATEST_ENGINEERING_STATUS.md` (PR #8, PR #9), `experimental/android-nearby/` | `gradle :app:assembleDebug` y tests JVM en CI |
| TRL ≈ 3, 54/100 provisional, validación física 0/20 | `docs/audits/LATEST_ENGINEERING_STATUS.md` | Rúbrica interna, no auditoría |
| €50k / €180k / €350–500k ilustrativos | `docs/investor/FINANCIAL_SCENARIOS.md` | Envolventes de planificación, no presupuestos validados |
| Modelo de sostenibilidad post-TRL 6 | `docs/investor/FINANCIAL_SCENARIOS.md` §3 | — |
| Piloto de 12 semanas | `docs/investor/PILOT_PROPOSAL.md` | — |
| Mapa | Natural Earth 1:110m, dominio público | `investor-next/public/geo/land-110m.json` |
