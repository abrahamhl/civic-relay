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
