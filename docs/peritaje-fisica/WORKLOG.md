# WORKLOG · SENDA Peritaje Ciudadano Multimodal + Física Avanzada + Integración CalmPath/Civil Sentry

- **Repositorio base:** `abrahamhl/civic-relay`
- **Rama de trabajo:** `feat/peritaje-fisica-senda-20261125`
- **Commit base en `master`:** `333996f4f133a8ea44e01c062f79a306e6d2756d`
- **Entorno de ejecución:** Linux Ubuntu 24.04 · Node.js `v22.23.5` · Intel(R) Xeon(R) CPU @ 2.30GHz (2 núcleos) · 7,8 GiB RAM · GPU: no disponible en esta VM.
- **Línea base previa (`master`):** `node --test packages/senda/tests/*.test.mjs` → **1078/1078 en verde (0 fallos)** en 114,3 s.

---

## Fase 1.1 · Entrada multimodal firmada, privacidad por diseño y cadena de evidencia inmutable
- **Hora UTC real de cierre:** `2026-11-25T17:43:46Z`
- **Qué se hizo:**
  - Nuevo módulo [`packages/senda/src/citizen-report.mjs`](../../packages/senda/src/citizen-report.mjs) (sincronizado en `investor-next/public/senda/core/citizen-report.mjs` y exportado en `packages/senda/src/index.mjs`):
    - Sobre único multimodal `senda.citizen-report/v1` firmado con Ed25519 (WebCrypto), zona horaria obligatoria (ISO-8601), posición con precisión, orientación de cámara, acelerómetro/barómetro, consentimiento explícito obligatorio y `operationalStatus` obligatorio (`ACTUAL | EXERCISE | SIMULATION | TEST`, patrón endurecido de `civil-sentry`).
    - Redacción de privacidad antes de compartir: `stripJpegExif` (elimina APP1/APP13/COM sin recodificar), `redactRgbaRegions` (pixelado determinista sobre caras/matrículas) y `fuzzLocation`.
    - Adaptadores multicanal reutilizando el núcleo existente: `reportToCompactSnd3` (`hazard-reports.mjs`, 160 car.), `reportToEncryptedAuthorityEnvelope` (`envelope.mjs`), `reportToCourierShards` / `reassembleCourierReport` (`erasure.mjs`), `reportToQrChunks` / `reassembleQrChunks`, `reportToGeoUri` / `parseGeoUri` (RFC 5870, patrón `calmpath-maps-pro`) y `reportToSharePack` (`hazard-share.mjs`).
    - Cadena inmutable `createEvidenceChain` / `verifyEvidenceChainIntegrity` con JSON canónico determinista, enlace `prevHash`, cobertura de metadatos + `rawValue`, separación explícita `OBSERVED | ABSENT | COLLECTION_ERROR` y `compareRunEvidence` (patrón `civil-sentry` endurecido).
  - Pruebas nuevas: `packages/senda/tests/citizen-report.test.mjs`.
- **Qué se probó:**
  - `node --test packages/senda/tests/citizen-report.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **11/11 en verde (0 fallos)**.
- **Qué falta:** Fases 1.2 (`report-forensics.mjs`), 1.3 (`report-protocol.mjs`), 1.4 (`reportar.html`, `comite.html`), 1.5 (servidor local + OpenAPI + sincronización), 1.6 (asimilación EnKF), 2 (física avanzada), 3 (integraciones de alto valor de CalmPath Maps Pro y Civil Sentry) y 4 (benchmarks, documentación, parches y ZIP).

## Fase 1.2 · Peritaje automático multimodal (`report-forensics.mjs`)
- **Commit fase anterior:** `a58b1a9`
- **Hora UTC real de cierre:** `2026-11-25T17:48:18Z`
- **Qué se hizo:**
  - Nuevo módulo [`packages/senda/src/report-forensics.mjs`](../../packages/senda/src/report-forensics.mjs) (sincronizado en `investor-next/public/senda/core/report-forensics.mjs` y exportado en `packages/senda/src/index.mjs`):
    - Coherencia del dispositivo (`checkDeviceCoherence`): desfase de reloj, salto cinemático imposible, altitud barométrica ISA (`barometricAltitudeM`), inspección estructural C2PA (`inspectC2paBytes`, declarada no anclada), huella perceptual `computeDHash64` / `hammingDistanceHex64` para fotos reutilizadas y saneamiento MITRE ATLAS (`sanitizeUntrustedText`).
    - Plausibilidad física (`checkPhysicalContext`): hidrología (`hydro-estimates.mjs`), fuego (`fire-watch.mjs`), desprendimientos con Horn (1981) + Caine (1980, DOI `10.1080/04353676.1980.11879996`) + Guzzetti et al. (2008, DOI `10.1007/s10346-007-0112-1`) y separación `OBSERVED | ABSENT | COLLECTION_ERROR`.
    - Satélite y fuentes oficiales (`checkSatelliteAndOfficial`): próximo paso con TLE reales (`orbital.mjs`), índices espectrales Sentinel-2 (`computeSpectralIndices`: NDVI, NDWI McFeeters 1996, NBR/dNBR Key & Benson 2006), plan Sentinel-1 SAR con nubes y grafo anti-doble-conteo (`cross-source.mjs` + `source-evidence.mjs`).
    - Otros ciudadanos y cámaras (`checkCrowdAndCameras`): deduplicación por seudónimo, grupo (`groupHint`), ráfaga colocalizada y foto compartida + verificación con cámara (`hazard-verify.mjs`) exigiendo permiso explícito.
    - Fiabilidad del informante: algoritmo EM de Dawid y Skene (1979, DOI `10.2307/2346806`, `fitDawidSkene`) sobre seudónimos sin PII.
    - Puerta de fundamentación `acceptGroundedFinding` (endurecida desde `civil-sentry`) y expediente completo encadenado `runForensicAssessment`.
  - Pruebas nuevas: `packages/senda/tests/report-forensics.test.mjs`.
- **Qué se probó:**
  - `node --test packages/senda/tests/report-forensics.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **12/12 en verde (0 fallos)** (incluye verificación analítica, TLE real AMSAT del repo y casos de abuso).
- **Qué falta:** Fases 1.3 (`report-protocol.mjs`), 1.4, 1.5, 1.6, 2, 3 y 4.

## Fase 1.3 · Niveles N0–N5, protocolo de transiciones y puerta criptográfica humana (`report-protocol.mjs`)
- **Commit fase anterior:** `0174632`
- **Hora UTC real de cierre:** `2026-11-25T17:51:03Z`
- **Qué se hizo:**
  - Nuevo módulo [`packages/senda/src/report-protocol.mjs`](../../packages/senda/src/report-protocol.mjs) (sincronizado en `investor-next/public/senda/core/report-protocol.mjs` y exportado en `packages/senda/src/index.mjs`):
    - Máquina de estados `N0 → N1 → N2 → N3 → N4` automática con trazabilidad por transición, descenso automático por contradicción verificada o decaimiento exponencial bayesiano, umbrales de riesgo con fuente citada obligatoria (`createRiskThreshold`, `PUBLISHED_RISK_THRESHOLDS`), borrador CAP 1.2 restringido en N4 (`buildCommitteeCapDraft` reutilizando `incidentToCap`) y `canPublicWarn: false` inmutable en toda ruta automática.
    - Puerta criptográfica humana para N5 (`createAuthorityKeyPair`, `issueAuthorityGrant`, `verifyAuthorityGrant`, `authorizePublicWarningN5`, `cancelPublicWarningN5`): exige `operationalStatus === 'ACTUAL'`, `AuthorityGrant` firmado Ed25519 contra ancla institucional, ventana temporal estricta sin hueco `NaN`, geocerca, alcance de peligro, decisión firmada Ed25519 por la autoridad humana y registro en `createAuditLog` (SHA-256).
  - Pruebas nuevas: `packages/senda/tests/report-protocol.test.mjs`.
- **Qué se probó:**
  - `node --test packages/senda/tests/report-protocol.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **8/8 en verde (0 fallos)** (incluye todas las transiciones N0–N5, descenso, bloqueo de simulación/grant caducada/fuera de geocerca, cancelación N5 y resistencia a inundación Sybil de 25 reportes).
- **Qué falta:** Fases 1.4 (`reportar.html`, `comite.html`), 1.5, 1.6, 2, 3 y 4.

## Fase 1.4 · Interfaces web accesibles sin instalación (`reportar.html` y `comite.html`)
- **Commit fase anterior:** `63a7fcd`
- **Hora UTC real de cierre:** `2026-11-25T17:56:32Z`
- **Qué se hizo:**
  - [`investor-next/public/senda/reportar.html`](../../investor-next/public/senda/reportar.html) + [`reportar.mjs`](../../investor-next/public/senda/reportar.mjs): interfaz móvil sin app en español con selector rápido de peligro, acceso directo `tel:112`, captura foto/vídeo/audio con herramienta local de difuminado de caras/matrículas en `<canvas>` (`redactRgbaRegions`), borrado EXIF (`stripJpegExif`), `dHash-64`, GPS + sensores, consentimiento explícito, cola local sin red y exportación `SND3`/QR/`geo:`/JSON.
  - [`investor-next/public/senda/comite.html`](../../investor-next/public/senda/comite.html) + [`comite.mjs`](../../investor-next/public/senda/comite.mjs): pantalla de operador de comité siguiendo el lenguaje visual de `/senda/sala` (tipografía local `Inter` + `IBM Plex Mono`, sin dependencias CDN): cola filtrable N0–N5, selección circular AOI y escáner del área visible (adaptados de `calmpath-maps-pro`), mapa `<canvas>` retina con opacidad por probabilidad y borde sólido/discontinuo por verificación instrumental, línea del tiempo, expediente forense, petición de verificación a quien pasa (`hazard-verify.mjs`), borrador CAP 1.2 y puerta criptográfica humana N5 bloqueada por defecto.
  - Pruebas nuevas: `packages/senda/tests/web-interfaces.test.mjs`.
- **Qué se probó:**
  - Google Chrome headless (`1440×900` y `390×844`) sobre `/senda/reportar.html` y `/senda/comite.html`: renderizado dinámico confirmado con **0 errores de consola/página**.
  - `node --test packages/senda/tests/web-interfaces.test.mjs` → en verde.
- **Qué falta:** Fases 1.5 (servidor local + OpenAPI + sincronización), 1.6 (asimilación EnKF), 2 (física avanzada), 3 (CalmPath/Civil Sentry integraciones de alto valor) y 4 (documentación, benchmarks, parches y ZIP).

## Fase 1.5 · Cliente independiente del transporte, sincronización multicanal y servidor de referencia local
- **Commit fase anterior:** `acf6fff`
- **Hora UTC real de cierre:** `2026-11-25T17:58:32Z`
- **Qué se hizo:**
  - Nuevo módulo [`packages/senda/src/sync-protocol.mjs`](../../packages/senda/src/sync-protocol.mjs) (sincronizado en `investor-next/public/senda/core/sync-protocol.mjs` y exportado en `packages/senda/src/index.mjs`): cliente independiente del transporte (`createTransportClient`, `createHttpTransportAdapter`, `createMemoryTransportAdapter`) y libro CRDT causal (`createSyncLedger`) con exportación/fusión de deltas con SHA-256, convergencia conmutativa/idempotente y resolución de conflictos donde `N5_CANCELLED > N5_AUTHORIZED > AUTO_EVALUATED`.
  - Servidor de referencia local sin coste de nube [`packages/senda/server/reference-server.mjs`](../../packages/senda/server/reference-server.mjs) (Node `node:http` puro, solo `127.0.0.1`, cabeceras de seguridad, límite de cuerpo, rate-limiter anti-inundación, SSE `/api/v1/events`, `/api/v1/sync`, verificación de paso y puerta Ed25519 N5) + especificación [`packages/senda/server/openapi.yaml`](../../packages/senda/server/openapi.yaml).
  - Pruebas nuevas: `packages/senda/tests/sync-and-server.test.mjs`.
- **Qué se probó:**
  - `node --test packages/senda/tests/sync-and-server.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **6/6 en verde (0 fallos)**.
- **Qué falta:** Fases 1.6 (asimilación EnKF), 2 (física avanzada), 3 (integraciones CalmPath Maps Pro & Civil Sentry) y 4 (benchmarks, documentación, parches y ZIP).

## Fase 1.6 · Asimilación de datos de campo (N2+) con Filtro de Kalman por Conjuntos (`data-assimilation.mjs`)
- **Commit fase anterior:** `39cce7d`
- **Hora UTC real de cierre:** `2026-11-25T18:00:41Z`
- **Qué se hizo:**
  - Nuevo módulo [`packages/senda/src/data-assimilation.mjs`](../../packages/senda/src/data-assimilation.mjs) (sincronizado en `investor-next/public/senda/core/data-assimilation.mjs` y exportado en `packages/senda/src/index.mjs`):
    - Puerta de admisión N2+ (`filterAssimilableObservations`): solo admite observaciones N2–N5 sin contradicción activa y con `observationStd > 0`.
    - Localización espacial de soporte compacto de Gaspari & Cohn (1999, DOI `10.1002/qj.49712555417`, `gaspariCohnWeight`).
    - Filtro de Kalman por Conjuntos estocástico (`enkfUpdate`: Evensen 1994/2003, DOI `10.1029/94JC00572` y `10.1007/s10236-003-0036-9`; Burgers et al. 1998, DOI `10.1175/1520-0493(1998)126<1719:ASITEK>2.0.CO;2`; inflación Anderson & Anderson 1999).
    - Acoplamiento directo con `shallow-water.mjs` (`runFloodAssimilationExperiment`) y con propagación de frente de incendio (`assimilateFireFrontObservations`).
  - Pruebas nuevas: `packages/senda/tests/data-assimilation.test.mjs`.
- **Qué se probó:**
  - Verificación analítica EnKF frente a ganancia de Kalman exacta (< 1e-9), Gaspari-Cohn exacto, puerta N2+, asimilación en incendio y caso de desbordamiento de mota en `shallow-water.mjs` (medido: CSI `0,1811 → 1,0000`, RMSE `0,2550 → 0,0317 m` [−87,6 %], horquilla 90 % `0,4181 → 0,1285 m` [−69,3 %]).
  - `node --test packages/senda/tests/data-assimilation.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **9/9 en verde (0 fallos)**.
- **Qué falta:** Fase 2 (física y computación avanzada: FV 2D WebGPU/CPU + porosidad + estabilidad + Poyo, Rothermel + Scott-Burgan + level-set, ETCS + Nadal + pandeo, ITU-R P.526 avanzada, UQ/LHS/Sobol), Fase 3 (CalmPath Maps Pro & Civil Sentry integraciones de alto valor) y Fase 4 (benchmarks, documentación, parches y ZIP).
