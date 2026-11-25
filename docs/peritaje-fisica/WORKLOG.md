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
