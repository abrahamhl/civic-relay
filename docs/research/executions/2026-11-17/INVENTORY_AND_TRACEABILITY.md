# Inventario de Subsistemas, Top-10 Bloqueos y Matriz de Trazabilidad (A0 · 2026-11-17)

## 1. Inventario de Capacidades (Real vs Experimental vs Simulado vs Incompleto/Duplicado)

| Capacidad / Módulo | Estado actual | Clasificación epistémica | Qué existe hoy | Brechas / Duplicación |
|---|---|---|---|---|
| Cifrado WebCrypto, Reed-Solomon `GF(256)`, MFSK-16 acústico, `SND3` Ed25519, `CAP 1.2 Exercise` (`packages/senda/src/*`) | **Implementado + Verificado en Node/Web** | `REAL_OFFLINE_SOFTWARE` (no hardware RF) | Tests locales y CI verde; bloquea `Actual` | Requiere anclas externas reales para `VERIFIED_INSTITUTIONAL` |
| Núcleo legado TypeScript (`packages/core`, `apps/web`) | **Duplicación parcial tolerada (adaptador)** | `LEGACY_ADAPTER` | `libsodium` X25519 paralelo al núcleo `@senda/core` P-256 | Mantener sin ruptura hasta verificar paridad completa |
| Diario Android Nearby (`experimental/android-nearby/*`) + App Campo (`apps/senda-android/*`) | **Incompleto / Compilación sin prueba física** | `JVM_TESTED_HARDWARE_NOT_TESTED` | Compile-only en CI; P-256 en `LabReceiptSigner`, queue TSV en `LabPersistentQueue` | Faltan `CUSTODY_ACK` vs `DESTINATION_ACK`, detector de incoherencia inter-boot, telemetría RF (airtime, energía, SRLG) y **0 ensayos físicos** |
| Enrutamiento ARR estático (`experimental/senda-arr/src/arr-core.mjs`) y `routing-canonical.mjs` | **Experimental simulado** | `SIMULATED_ONLY` | Selección voraz submodular sobre conjunto de escenarios | Falta replanificación dinámica por custodio bajo presupuestos de airtime/energía y propagación causal de ACK (`H-ARR-R`) |
| Controles de incertidumbre H11–H16 (`robust-scenario-risk.mjs`, `failure-domain-cuts.mjs`, `resilience-council.mjs`, `anytime-scenario-confidence.mjs`) | **Matemática auditada en sintético/HiGHS** | `MATHEMATICAL_MODEL_ONLY` | Verificado vs oráculos LP HiGHS y Python SRLG `240/240` | Asume IID temporal en H14 y topologías declaradas |
| Pronóstico de incendio H2 (`experimental/senda-arr/src/arr-forecast.mjs`) | **RECHAZADO** | `EXPERIMENTAL_REJECTED` | Brier `0.0943` vs persistencia `0.0539` | Cinemático, pseudorreplicación en 3 incendios, censura tratada como negativo |
| Física de propagación existente (`packages/senda/src/wildfire.mjs`, `fire-field.mjs`) | **Implementado en núcleo (Dijkstra Rothermel)** | `MODEL_FORECAST_UNVALIDATED` | Elipse de viento + pendiente Rothermel + Monte Carlo | Sin solucionador upwind PDE Level-Set causal ni auditoría de censura / fuga temporal `H-FIRE-B` |
| Fusión situacional y linaje (`fusion.mjs`, `cross-source.mjs`, `source-evidence.mjs`) | **Parcial / Fragmentado** | `RULE_BASED_PARTIAL` | 2 grafos parciales de dependencia y emparejamiento por ventana | Falta DAG de procedencia completo con actualización bayesiana sin doble contabilización y regla explícita `UNKNOWN`/`ABSTAIN` |
| Visor 4D / Centro de Coordinación (`visor.html`, `centro.html`, `atlas.html`) | **Funcional offline con fallback 2D** | `UI_VERIFIED_SYNTHETIC` | 205/205 activos SW; 24/24 QA Chromium | Falta conectar salidas reales de `H-ARR-R`, `H-FIRE-B`, `H-FUS-1` y contrato P4 de abstención |
| Integraciones 112 / LoRa físico / CE-RED / ENS / ISO 27001 | **No iniciado / Bloqueado** | `BLOCKED_EXTERNAL` | `0` ensayos RF, `0` convenios 112, `0` certificaciones | Imprescindible campaña 2 Android + 2 LoRa y auditoría externa |

---

## 2. Los 10 Bloqueos de Mayor Impacto (Científico, Técnico y Comercial)

1. **`[CRÍTICO · Científico/Comercial]` Ausencia total de telemetría física medida (`0` ensayos BLE/Wi-Fi/LoRa):** impide sustituir probabilidades hipotéticas (`p: 0.95`, `260 mJ`) por PDR/RSSI/SNR/consumo reales.
2. **`[CRÍTICO · Científico]` Fracaso de H2 y déficit de física causal con auditoría de censura (`H-FIRE-B`):** no existe aún un pronóstico de frente que supere persistencia sin fuga temporal ni sesgo de censura.
3. **`[ALTA · Distribuido]` Confusión `CUSTODY_ACK` vs `DESTINATION_ACK` e identidad efímera por reinicio en laboratorio Android:** riesgo de falsos positivos de entrega tras pérdida de energía o salto de reloj.
4. **`[ALTA · Routing]` Planificación estática en origen (`arr-core.mjs`):** los custodios no replantean localmente ni suprimen copias redundantes tras un ACK ni respetan presupuesto conjunto de *airtime* SRD.
5. **`[ALTA · Inferencia]` Riesgo de doble contabilización en fusión multi-fuente:** recortes o reemisiones de un mismo evento ancestral inflarían confianza en Naive Bayes sin un DAG causal bayesiano (`H-FUS-1`).
6. **`[ALTA · Seguridad/Producto]` Ausencia de bloque uniforme de abstención (`H-ABST-1`):** los usuarios necesitan distinguir de un vistazo qué está medido, supuesto, cuándo caduca y por qué se abstiene el sistema.
7. **`[MEDIA · Regulación]` Restricciones SRD EU868 heterogéneas y Bluetooth `COMPANY_ID = 0xFFFF`:** requiere gobernador por subbanda y asignación de identificador Bluetooth SIG antes de piloto real.
8. **`[MEDIA · Datos]` Falta de archivo histórico causal HRRR/LANDFIRE/EFFIS de ≥ 10 incendios en local:** bloquea la validación confirmatoria externa de `H-FIRE-B` (se documenta como `DATASET_BLOCKED` sin fabricar resultados).
9. **`[MEDIA · DevSecOps]` Roturas reales de CI cross-workspace en PR #46 (`canonical-gate` y `usgs-live`):** ya diagnosticadas y corregidas en esta rama.
10. **`[CRÍTICO · Comercial/Legal]` Cero convenios institucionales (112/DGPCE), cero auditoría criptográfica independiente y cero certificaciones ENS/ISO/RED.**

---

## 3. Matriz de Trazabilidad

| Problema | Implementación existente | Hipótesis / Programa | Experimento a ejecutar en esta sesión | Criterio de decisión / Resultado |
|---|---|---|---|---|
| CI de integración y USGS Live rotas en PR #46 | `.github/workflows/senda-canonical-integration-ci.yml`, `senda-live-usgs-map.yml` | Gate DevSecOps `A0` | Corrección de orden `pnpm install` + `/tmp/pw` con `pnpm` | Ejecución limpia en CI GitHub al subir Draft PR |
| Custodia ambigua, reloj post-reboot y falta de esquema RF en lab Android | `experimental/android-nearby/*` (`LabPersistentQueue`, `LabReceiptSigner`, `LabTrialJournal`) | `H-PHY-1` (P0) | Endurecimiento Java + capturador/validador Node (`transport-telemetry.mjs`) + tests adversariales sintéticos (hardware físico: `NOT_TESTED`) | Código e instrumentación completos; estado físico honesto `NOT_TESTED` hasta 2 Android + 2 LoRa |
| Planes estáticos en origen sin reacción a fallos ni ACK ni airtime | `experimental/senda-arr/src/arr-core.mjs`, `routing-canonical.mjs` | `H-ARR-R` (P1) + `H-INN-ACK` | Simulador por custodio `experimental/senda-arr-replan/` vs 6 comparadores bajo mismo presupuesto de *airtime*/energía en 3 familias topológicas ($\ge 30$ bloques/familia) + 7 ablaciones | Aceptar provisionalmente en simulación SOLO si $\Delta \ge +2\text{ pp}$, IC 95 % > 0, TX $\le 1.5\times$, energía $\le 1.2\times$, CPU p95 $\le 250\text{ ms}$; conservar fallo si fracasa |
| H2 rechazado (`Brier 0.0943 > 0.0539`) y falta PDE física causal + censura | `packages/senda/src/wildfire.mjs`, `fire-field.mjs`, `arr-forecast.mjs` | `H-FIRE-B` (P2) | `experimental/senda-fire-physics/`: Level-Set upwind Rothermel ($\text{CFL}\le 0.45$), filtro `t_avail <= t0`, auditoría `CENSORED`, diagnóstico `camp/carr/woolsey` + benchmark analítico + evaluación externa | Tests matemáticos/CFL/causalidad exigidos al 100 %; confirmatorio real bloqueado como `DATASET_BLOCKED` al faltar $\ge 4$ incendios externos con HRRR/LANDFIRE locales |
| Fuentes redundantes/dependientes y ausencia de `ABSTAIN` formal | `source-evidence.mjs`, `cross-source.mjs`, `fusion.mjs` | `H-FUS-1` (P3) + `H-ABST-1` (P4) + `H-INN-FUS` | `causal-evidence-fusion.mjs` (DAG + factorización por ancestro + contradicción) y `robust-abstention.mjs` (1.000 casos adversariales) | Mejora de Brier vs Naive Bayes correlacionado en DAG causal + `0/1000` certezas no soportadas |
| Riesgo de confundir simulación con observación en visor offline | `visor.html`, `centro.html`, `senda-canonical-qa.mjs` | `H-VIZ-1` (P5) | Integración directa de salidas `H-ARR-R`, `H-FIRE-B`, `H-FUS-1`, `H-ABST-1` en Visor 4D/Centro + QA Chromium 320/390/768/1440 px | `0` etiquetas `OBSERVADO` en datos simulados, `0` errores JS, `0` desbordamiento horizontal |
