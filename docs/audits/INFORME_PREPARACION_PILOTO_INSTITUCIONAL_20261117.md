# Informe de Preparación para Piloto Institucional y Evidencias Diferenciadas (SENDA)

- **Fecha:** 2026-11-17
- **Rama de integración:** `feat/senda-canonical-integration-20261117` (sin fusión a `master` ni despliegue automático)
- **Regla de verdad:** Ninguna métrica de simulación o laboratorio se presenta como rendimiento de campo ni capacidad operativa certificada.

---

## 1. Matriz Diferenciada de Evidencias (Estado Verificado)

| Categoría | Estado Actual | Evidencia Verificable / Artefacto | Qué NO demuestra todavía |
|---|---|---|---|
| **1. Pruebas unitarias** | **VERIFICADO EN LOCAL** | `@senda/core` + defensa + adversariales + `@senda/pci` + `senda-route-truth` + `senda-arr` + `investor-next` + `@senda/live` (conteo exacto en Registro Final tras última edición) | No prueba radiofrecuencia física ni supervivencia en campo |
| **2. Integración de módulos** | **VERIFICADO EN LOCAL** | `routing-canonical.mjs` (paridad diferencial con `route-truth.mjs`, `arr-core.mjs`, `failure-domain-cuts.mjs`, `resilience-council.mjs`), `evidence-contract.mjs`, `sync-web.mjs` | No integra aún un gateway 112 real ni módem LoRa físico |
| **3. CI exacto por commit** | **VERDE EN RAMAS BASE; NUEVA RAMA PENDIENTE DE EJECUCIÓN EN GITHUB** | PR #32 (9 checks), PR #39 (5 checks), PR #42 (11 checks incl. HiGHS 250 LP), PR #43 (7 checks), PR #38 (4 checks), PR #44 (2 checks) | La rama unificada requiere revisión y ejecución de CI tras push del draft PR |
| **4. Tests de navegador (Chromium)** | **VERIFICADO EN LOCAL** | `senda-screens-e2e.mjs` (39/39), `senda-canonical-qa.mjs` (24/24: 360/390/768/1440 px, IndexedDB + revocación, SRLG, Visor 4D, fallback sin WebGL), `browser-release-smoke.mjs` | Audio decodificado por búfer en memoria, no altavoz-micrófono físico |
| **5. Compilación Android** | **VERDE EN CI PREVIA; SIN JDK/GRADLE EN ESTE EQUIPO** | `apps/senda-android` (`AppActivity.java`, `OfflineAssets.java`, `OfflineAssetsTest.java`) y `experimental/android-nearby` verificados en GitHub Actions de PR #32/#38/#42/#43 | Compilar APK/JVM no equivale a ensayo con teléfonos físicos |
| **6. Simulaciones matemáticas** | **VERIFICADO** | H11–H16 (`robust-scenario-risk.mjs`, `failure-domain-cuts.mjs` + `verify-failure-cuts.py` 240/240, `anytime-scenario-confidence.mjs`), H-ARR-1 (`results.json`, +4,2 a +5,1 pp sobre `planRoutes`, +1,2/+1,7 pp sobre ablación) | Hipótesis condicionales a topologías y desvanecimientos simulados; H2 **RECHAZADO** (peor que persistencia) |
| **7. Datasets históricos observados** | **VERIFICADO CON SHA-256** | GeoMAC 2018 (Camp, Carr, Woolsey), Copernicus EMSR773 (DANA Valencia), EFFIS, NOAA GOES (7 incendios), USGS, EMSC, GDACS, DGT DATEX II, NDW, Rijkswaterstaat, GTFS EMT València, Nepal Sentinel-2 + DEM | Son datos retrospectivos/snapshots para análisis; no sustituyen telemetría en vivo autorizada |
| **8. Ensayos físicos realizados** | **0 EJECUTADOS (BLOQUEADO POR HARDWARE)** | Protocolo prerregistrado listo en `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md` | Pendiente campaña con ≥ 2 Android + ≥ 2 LoRa EU868 |
| **9. Integraciones institucionales autorizadas** | **0 ACTIVAS** | Exportador `CAP 1.2` confinado a `status="Exercise"`, `scope="Restricted"`, `certainty="Unknown"`; `canPublicWarn = false` | Pendiente convenio con 112 / DGPCE / organismos autonómicos o equivalentes NL |
| **10. Certificaciones obtenidas** | **0 OBTENIDAS** | Software en **TRL 3–4** (laboratorio y simulación validada) | Sin CE/RED de hardware propio, sin auditoría ENS/ISO 27001, sin homologación aeronáutica/ferroviaria |

---

## 2. Qué Hace SENDA Hoy vs Qué Requiere Piloto

### Lo que funciona hoy en código real (sin red y verificable)
1. **Mensajería cifrada offline:** WebCrypto ECDH + ECDSA P-256 + AES-GCM, fragmentos Reed-Solomon `GF(256)` y módem acústico MFSK-16 que cabe en líneas de ≤ 160 caracteres.
2. **Reportes ciudadanos firmados (`SND3` Ed25519) con contención:** se verifican, deduplican, agrupan por proximidad y priorizan sin permitir promoción automática a alerta oficial (`canPublicWarn = false`).
3. **Centro de Coordinación (`/senda/centro`):** flujo de sala completo (`Detectar → Comprobar → Clasificar → Coordinar → Cerrar`), cadena de auditoría SHA-256 verificable, gestión fail-closed de roles, cola local IndexedDB con TTL y revocación de consentimiento (`REVOKED`), cortes SRLG N-2 y contraste de linaje de fuentes.
4. **Visor Científico Temporal / 4D (`/senda/visor` y `/senda/atlas`):** reproducción temporal de perímetros observados (GeoMAC 2018, DANA EMSR773, GOES), comparación reproducible de políticas de enrutamiento (ARR, ablación, CGR, techo epidémico), vistas 2D/3D con fallback determinista sin WebGL y cuarentena explícita del pronóstico H2 (`EXPERIMENTAL_REJECTED`).

### Lo que todavía exige acuerdos, ensayos físicos o regulación
1. **Campaña física de radio (P0):** ejecutar `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md` para reemplazar probabilidades de catálogo por PDR/RSSI/SNR/batería medidos.
2. **Cumplimiento regulatorio EU868:** incorporar presupuesto duro de ciclo de trabajo por nodo (ETSI EN 300 220) en el planificador ARR.
3. **Convenio institucional y seguridad externa:** auditoría criptográfica independiente, adecuación ENS / GDPR DPIA y firma de convenio piloto con un organismo de protección civil antes de habilitar ningún adaptador `CAP Actual`.

---

## 3. Guion Reproducible para Inversores (Sin Cifras Simuladas como Reales)

1. **Apertura (hecho verificable):** abrir `/senda/centro`, mostrar autocomprobación criptográfica y física en local sin servidor (`#boot`), encolar un sobre en IndexedDB, recargar la página y revocar el consentimiento (`REVOKED`).
2. **Seguridad institucional fail-closed:** cargar el lote de reportes Ed25519 (`#cit-sample`), recorrer revisión y cierre, cambiar rol a `OBSERVADOR` (bloqueado), emitir orden como `COORDINADOR_INCIDENTE` y exportar el paquete de evidencias JSON + CAP 1.2 (`Exercise/Restricted`).
3. **Visor Científico 4D (`/senda/visor`):** cargar Camp Fire 2018 (`OBSERVADO`), activar vista 3D, ejecutar «Sortear mundo» comparando ARR vs CGR vs techo epidémico, y señalar explícitamente la advertencia de H2 rechazado frente a persistencia (honestidad científica como ventaja competitiva).
4. **Cierre financiero:** solicitar financiación específicamente para ejecutar el **piloto controlado de 12 semanas** (hardware 2 Android + 2 LoRa, campaña de medida y auditoría de seguridad), presentando el TRL 3–4 actual sin prometer producto certificado.
