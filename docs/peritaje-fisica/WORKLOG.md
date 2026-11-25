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

## Fases 2A–2C · Física avanzada: Inundación FV 2D WebGPU/CPU, Incendio Rothermel/Level-Set y Ferrocarril ETCS/Nadal/CWR
- **Commit fase anterior:** `47737a1`
- **Hora UTC real de cierre:** `2026-11-25T18:18:25Z`
- **Qué se hizo:**
  - **Fase 2A (`shallow-water-fv.mjs` + `dana-fv-validate.mjs`):** solver 2D de volúmenes finitos bien equilibrado (Audusse et al. 2004 + HLLC Toro et al. 1994 + fricción semi-implícita Liang & Marche 2009 + porosidad urbana Sanders et al. 2008 + apertura hidrológica Lindsay & Dhun 2015 + incisión subcelda Neal et al. 2012), compute shaders WGSL WebGPU de 2 pases (`flux_pass`, `update_pass`) con respaldo CPU automático y paridad f32↔f64 verificada (< 1e-4 m), más estabilidad de personas (Cox et al. 2010 / DEFRA FD2320) y vehículos (Shand et al. 2011 / Martínez-Gomariz et al. 2018).
  - **Fase 2B (`fire-rothermel.mjs`):** ecuaciones exactas de Rothermel (1972, INT-115) + catálogo publicado de 22 modelos Scott & Burgan (2005, RMRS-GTR-153) + Byram (1959) + solver 2D upwind Godunov Level-Set con elipse de Huygens exacta (Osher & Sethian 1988; Finney 1998) + anclaje de interfaz (Russo & Smereka 2000) + conjunto probabilista por Hipercubo Latino (`runFireEnsemble`).
  - **Fase 2C (`rail-physics-etcs.mjs`):** curvas de frenado ETCS UNISIG SUBSET-026-3 Baseline 3 Release 2 v3.6.0 (§3.13: EBD, EBI, SBI, Warning, Permitted, Indication), pandeo térmico CWR con barrera de energía $T_{B,\min}/T_{B,\max}$ (Kish & Samavedam 2013, DOT/FRA/ORD-13/01), descarrilamiento Nadal (1908) / Weinstock (1984) / Prud'homme (EN 14363) y marco de reconstrucción solo con datos públicos (`buildPublicRailReconstruction`, caso público Angrois CIAF 0054/2013 y plantilla Adamuz 2026 con `NO_VERIFICADO`).
  - Pruebas nuevas: `shallow-water-fv.test.mjs`, `fire-rothermel.test.mjs`, `rail-physics-etcs.test.mjs`. Sincronización web completa (`sync-web.mjs`) y exportaciones en `packages/senda/src/index.mjs`.
- **Qué se probó:**
  - `shallow-water-fv.test.mjs`: **7/7 en verde** (C-property exacta `< 1e-12` con porosidad variable, rotura de presa analítica de Ritter 1892, conservación de masa `< 1e-12`, aceleración urbana Sanders, paridad f32↔f64 `< 1e-4 m`, Cox/DEFRA, Shand/Martínez-Gomariz).
  - Validación real sin red DANA 29-10-2024 (`node packages/senda/scripts/dana-fv-validate.mjs`, datos `dem_d4.bin` 118,1 m + `dir_z12.bin` + Copernicus `emsr773_inundacion.geojson`):
    - Referencia `swe.json` (Bates 59 m): mejor CSI `0,2354` (Paiporta `545 min`, Picanya `480 min`; variante más rápida Paiporta `300 min`, Picanya `271 min` con CSI `0,2028`).
    - Base Bates 118 m: CSI `0,2371`, Acierto `0,4036`, Picanya `393 min`, Paiporta `448 min`, Sedaví `646 min`.
    - FV2D Audusse-HLLC bruto (`n=0,06`): CSI `0,2427`, Picanya `372 min`, Paiporta `426 min`, Sedaví `588 min`.
    - FV2D + breaching Lindsay-Dhun (2015) + incisión 1 m garganta + Manning diferenciado + porosidad urbana `0,72`: **CSI `0,2516`** (+6,9 % sobre `swe.json`), **Acierto `0,4906`**, **Picanya `215 min`** (−178 min vs Bates 118 m / −265 min vs mejor `swe.json`), **Paiporta `262 min`** (−186 min / −283 min), **Sedaví `389 min`** (−257 min), balance de masa `5,49e-15`.
  - `fire-rothermel.test.mjs`: **5/5 en verde** (Rothermel/Scott-Burgan, convergencia $O(\Delta x)$ en círculo analítico, elipse de Huygens + cortafuegos `NB8`, caso real SMV 2026 con `dem_100m.bin`, `fuel_100m.bin`, `burn_100m.bin` y NOAA GFS real `UGRD/VGRD/RH` + conjunto LHS).
  - `rail-physics-etcs.test.mjs`: **4/4 en verde** + `index-exports.test.mjs` + `web-parity.test.mjs` (**0 fallos**).
- **Qué falta:** Fases 2D (`radio-propagation-advanced.mjs`), 2E (`uncertainty-uq.mjs`), Fase 3 (CalmPath Maps Pro & Civil Sentry integraciones de alto valor en SENDA) y Fase 4 (benchmarks reales, documentación completa, pruebas globales, parches y ZIP final).

## Fases 2D–2E · Radio avanzada (ITU-R P.526-15 / ITM) e Incertidumbre transversal (LHS / Sobol / CRPS)
- **Commit fase anterior:** `791125e`
- **Hora UTC real de cierre:** `2026-11-25T18:22:00Z`
- **Qué se hizo:**
  - **Fase 2D (`radio-propagation-advanced.mjs`):** pérdida de espacio libre Friis, filo de cuchillo ITU-R P.526-15 §4.2, difracción sobre Tierra esférica lisa §3.1.1, **Delta-Bullington ITU-R P.526-15 §4.5.2** (P.452-17/P.1812-6), cascada Epstein-Peterson (1953), irregularidad del terreno $\Delta h$ y horizontes radioeléctricos estilo Longley-Rice/ITM (NTIA 82-100), clutter ITU-R P.2108-1 §3.2, vegetación ITU-R P.833-10, muestreador de perfiles MDE (`sampleDemProfile`) y evaluación de enlace de malla con horquilla de refractividad atmosférica $k$ (`evaluateMeshLinkWithUncertainty`).
  - **Fase 2E (`uncertainty-uq.mjs`):** muestreo estratificado por Hipercubo Latino (McKay, Beckman & Conover 1979) con distribuciones uniforme, normal (inversa racional de Acklam 2003), triangular y lognormal, resumen con horquillas (`summarizeEnsemble`), propagación genérica (`propagateUncertainty`), análisis global de sensibilidad Sobol-Saltelli (2010) / Jansen (1999) (`sobolSensitivitySaltelli`), y métricas de verificación determinista/probabilista (MAE, RMSE, sesgo, $R^2$, CSI, POD, FAR, F1, cobertura empírica, Brier 1950 y CRPS empírico Gneiting & Raftery 2007).
  - Pruebas nuevas: `radio-propagation-advanced.test.mjs` y `uncertainty-uq.test.mjs`. Sincronización web completa (`sync-web.mjs`) y exportaciones en `packages/senda/src/index.mjs`.
- **Qué se probó:**
  - `radio-propagation-advanced.test.mjs`: **4/4 en verde** (verificación analítica Friis + filo de cuchillo $J(0) \approx 6,03$ dB, difracción esférica/clutter/vegetación, enlaces reales LoRa 868 MHz Chiva↔Paiporta y Chiva↔Buñol sobre el MDE abierto `radio/poyo.json` con horquilla $k \in [2/3, 4/3, 2,0]$).
  - `uncertainty-uq.test.mjs`: **4/4 en verde** (estratificación exacta 1-por-estrato en LHS, verificación analítica de los 6 índices de Sobol $S_1, S_2, S_3, S_{T1}, S_{T2}, S_{T3}$ en la función de Ishigami, CRPS/Brier/CSI/cobertura).
  - `index-exports.test.mjs` + `web-parity.test.mjs` → **12/12 en verde (0 fallos)**.
- **Qué falta:** Fase 3 (integraciones restantes de alto valor de `calmpath-maps-pro` y `civil-sentry` enfocadas en SENDA: `emergency-routing-zones.mjs` y `triage-governance.mjs`) y Fase 4 (benchmarks reales, documentación completa, ejecución íntegra de `node --test`, parches y ZIP final).

## Fase 3 · Integraciones de alto valor de CalmPath Maps Pro y Civil Sentry enfocadas en SENDA
- **Commit fase anterior:** `28ea077`
- **Hora UTC real de cierre:** `2026-11-25T18:27:40Z`
- **Qué se hizo:**
  - **Módulo 3A (`emergency-routing-zones.mjs`, desde `calmpath-maps-pro` adaptado a emergencias SENDA):**
    - Enrutador de evacuación multivector A-estrella (`routeEvacuationGraph`) con puertas físicas de intransitabilidad (`assessHumanFloodStability` Cox/DEFRA, `assessVehicleFloodStability` Shand/Martínez-Gomariz, aglomeración Fruin 1971, fuego/humo PM2.5 y perfil de movilidad reducida `low_mobility_accessible`), más respaldo sin grafo por campo potencial (`computeFallbackEscapeBearing`).
    - Motor multicriterio explicable de zonas seguras/albergues (`rankEmergencySafeZones`) con pesos declarados obligatorios, taxonomía de procedencia de 7 niveles (`PROVENANCE_LEVELS`), fortalezas, factores de riesgo y puertas eliminatorias físicas.
    - Filtros AOI (`circle`, `bbox`, `polygon`), clustering espacial determinista por zoom (`clusterIncidentsByGrid`) y escáner situacional en 1 clic (`scanViewportSituation`, `canPublicWarn: false`).
    - Empaquetador de área sin red (`createOfflineAreaPackage` / `verifyOfflineAreaPackage`) con SHA-256 por capa + manifiesto y decaimiento suave de frescura por TTL, y registro de salud de fuentes con degradación honesta (`createSourceHealthRegistry`: nunca etiqueta caché caducada como `OBSERVED`).
  - **Módulo 3B (`triage-governance.mjs`, desde `civil-sentry` y `calmpath-maps-pro`):**
    - Grafo de conocimiento situacional (`createSituationGraph`) con nodos tipados y aristas `SUPPORTS | CONTRADICTS | SUPERSEDES | LOCATED_IN | AFFECTS | SOURCED_FROM | AUTHORIZED_BY`.
    - Panel determinista de 4 especialistas para el comité (`runCommitteeTriagePanel`: Física/Hidrología, Operaciones PC, Forense/Fuentes y Auditor Adversario Red-Team) que reconcilia desacuerdos y mantiene `canPublicWarn === false`.
    - Auto-auditoría epistémica y de modelo de amenazas (`runEpistemicSecurityAudit`, STRIDE + MITRE ATT&CK + ATLAS) que verifica 8 invariantes críticos (fundamentación, puerta N5, aislamiento de simulacros, error≠ausencia, cadenas hash, consentimiento+firma, cero PII en logs y señales de inyección).
  - Pruebas nuevas: `emergency-routing-zones.test.mjs` y `triage-governance.test.mjs`. Sincronización web completa (`sync-web.mjs`) y exportaciones en `packages/senda/src/index.mjs`.
- **Qué se probó:**
  - `node --test packages/senda/tests/emergency-routing-zones.test.mjs packages/senda/tests/triage-governance.test.mjs packages/senda/tests/index-exports.test.mjs packages/senda/tests/web-parity.test.mjs` → **11/11 en verde (0 fallos)**.
- **Qué falta:** Fase 4 (script de benchmarks reales en esta VM, documentación completa exigida en §4 + documentos de gobernanza `CURRENT_TRUTH.md`, `EVIDENCE_MATRIX.md`, `THREAT_MODEL.md`, manifiesto SHA-256 de datos abiertos, ejecución completa de toda la suite `node --test`, `git format-patch`, empaquetado y verificación del ZIP final + SHA-256).

## Fase 4 · Benchmarks reales, documentación completa, verificación íntegra del repositorio y empaquetado ZIP
- **Commit fase anterior:** `8f644dd`
- **Hora UTC real de cierre:** `2026-11-25T18:34:18Z`
- **Qué se hizo:**
  - Script de benchmarks reproducibles en hardware real [`packages/senda/scripts/benchmark-peritaje-fisica.mjs`](../../packages/senda/scripts/benchmark-peritaje-fisica.mjs) ejecutado en esta VM (`Intel Xeon @ 2.30GHz`, 2 núcleos, 7,77 GiB RAM, sin GPU).
  - Documentación completa en `docs/peritaje-fisica/`:
    - `LEEME.md`, `IDEAS_NO_VALIDADAS.md`, `data/MANIFIESTO_DATOS_ABIERTOS.json` (14 ficheros abiertos con URL, licencia y SHA-256 computado), `RESULTADOS_PRUEBAS.txt` (salida literal de los 1137 tests).
    - `docs/METODOS.md`, `docs/VALIDACION.md`, `docs/PROTOCOLO_NIVELES.md`, `docs/PRIVACIDAD.md`, `docs/RENDIMIENTO.md`.
    - Trío de gobernanza adaptado de `civil-sentry` para SENDA: `docs/CURRENT_TRUTH.md`, `docs/EVIDENCE_MATRIX.md`, `docs/THREAT_MODEL.md` (STRIDE + MITRE ATT&CK + MITRE ATLAS).
- **Qué se probó:**
  - Suite íntegra del repositorio: `node --test packages/senda/tests/*.test.mjs` → **1137/1137 en verde (0 fallos, 0 omitidas)** en `111,1 s` (`EXIT_CODE=0`).
  - Benchmark real: `node packages/senda/scripts/benchmark-peritaje-fisica.mjs` → `EXIT_CODE=0`, paridad `f32↔f64` medida `1,14e-6 m` (`< 1e-4 m`).
  - Verificación de regla §4 (`git diff --name-status master`): únicamente archivos nuevos (`A`) y adición de exportaciones (`M`) en `packages/senda/src/index.mjs` e `investor-next/public/senda/core/index.mjs`.
- **Qué falta:** Generar `patches/` con `git format-patch master`, ensamblar `/home/antigravity/senda-peritaje-fisica-20261125.zip`, verificar integridad del archivo ZIP y calcular su huella SHA-256 final.
