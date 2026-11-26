# SENDA · Modelo de Amenazas STRIDE y Auditoría de Seguridad (F6)

**Ámbito:** Reportes ciudadanos multimodales (`citizen-report.mjs`, `report-forensics.mjs`, `report-protocol.mjs`, `/senda/reportar`, `/senda/comite`), servidor de referencia local (`packages/senda/server/reference-server.mjs`), cabeceras/CSP de `investor-next/vercel.json` y allowlist Android (`NetAllow.java`).
**Fecha de auditoría:** 2026-11-25 UTC.
**Estado normativo:** Documento de ingeniería preventiva para evaluación por equipos técnicos (UME, FCSE, Protección Civil). **No constituye certificación ENS (RD 311/2022) ni auditoría externa independiente.**

---

## 1. Activos críticos y fronteras de confianza

1. **Puerta humana N5 (`canPublicWarn`)**: ningún aviso público puede salir automáticamente desde un reporte ciudadano, un cálculo físico o un cliente HTTP sin credencial `AuthorityGrant` firmada por el ancla de confianza + firma Ed25519 individual de una autoridad humana.
2. **Privacidad ciudadana (0 PII en reposo)**: seudónimo criptográfico efímero (sin nombre/DNI/teléfono), difuminado de caras y matrículas en `<canvas>` local y borrado de metadatos EXIF JPEG antes de exportar.
3. **Integridad forense**: firma Ed25519 sobre JSON canónico + huella SHA-256 + cadena de auditoría encadenada en el servidor de referencia.
4. **Aislamiento de red**: APK `base` sin permiso `INTERNET` ni GMS; APK `play` restringida a la lista cerrada `NetAllow.java`; servidor de referencia enlazado por defecto a `127.0.0.1` sin CORS `*`.
5. **Separación de la bóveda de defensa**: `packages/senda/src/defense/` permanece excluida de superficies civiles, de `tsconfig.json` civil y del escritorio civil.

---

## 2. Matriz STRIDE (Reportes ciudadanos + Servidor de referencia)

| ID | Categoría | Amenaza concreta | Mitigación implementada en código | Estado |
|---|---|---|---|---|
| **S-01** | **Spoofing** (Suplantación de ciudadano o autoridad) | Emisor falsifica un reporte ciudadano o intenta hacerse pasar por autoridad para activar N5 (`canPublicWarn: true`). | Firma Ed25519 obligatoria verificada sobre JSON canónico en `verifyCitizenReport()`; puerta N5 exige `AuthorityGrant` firmado por `trustAnchorPublicRaw` + firma Ed25519 del objeto `decision` + alcance geográfico y de tipo de peligro (`report-protocol.mjs`). El esquema Ajv `citizen-report.schema.json` fija `canPublicWarn: false`. | **Corregido** |
| **S-02** | **Spoofing** (Sybil / falsos avisos coordinados) | Un atacante genera 20 identidades Ed25519 desde un mismo grupo/IP para forzar N2/N4. | Independencia de fuentes (`cross-source.mjs` + `groupHint` + proximidad espaciotemporal) y modelo de fiabilidad Dawid–Skene (`report-forensics.mjs`) que penaliza fuentes con historial erróneo; rate-limit por IP en `reference-server.mjs` (HTTP 429). **Límite:** sin identidad fuerte ni red móvil controlada, un atacante distribuido con muchas IPs podría alcanzar N2/N4 (nunca N5). | **Aceptado con motivo** (N4 solo pre-alerta al comité humano; nunca emite a población) |
| **T-01** | **Tampering** (Alteración en tránsito o en cola offline) | Modificación de coordenadas, texto o marca temporal de un reporte o de una entrada de auditoría. | `contentSha256` + firma Ed25519 sobre `payload` canónico; cadena encadenada `prevHash → entryHash` verificada por `verifyAuditLog()`. | **Corregido** |
| **T-02** | **Tampering** (Inyección XSS / scripts en páginas web) | Inyección de código en `reportar.html`, `comite.html`, `copiloto.html` o `conducir.html` por texto de avisos externos o CDNs comprometidos. | Escapado HTML (`esc()`) en renderizado + **CSP estricta en `investor-next/vercel.json`** para las 9 superficies operativas modernas (`script-src 'self' 'wasm-unsafe-eval'` **sin `'unsafe-inline'` ni `'unsafe-eval'`**, `object-src 'none'`, `frame-ancestors 'none'`, 0 CDNs externos). | **Corregido** (9 páginas operativas) · **Aceptado con motivo** en 40 páginas legacy de laboratorio (`'unsafe-inline'` hasta migración a `.mjs` externos) |
| **R-01** | **Repudiation** (Repudio de decisión humana N5) | Una autoridad niega haber autorizado un aviso público N5 o se manipula la hora del evento. | Cada decisión N5 exige firma Ed25519 del operador + `grantId` + `rationale` + `instruction`, registrada en `auditLog` encadenado con marca temporal ISO-8601 con zona horaria explícita (validada por Ajv). | **Corregido** |
| **I-01** | **Information Disclosure** (Fuga de PII, EXIF o CORS abierto) | Exposición de caras/matrículas/EXIF GPS en fotos ciudadanas o lectura cross-origin del servidor de referencia local. | Difuminado local en `<canvas>` + `stripJpegExif()` antes de salir del móvil; `containsRawMediaBytes: false`; `reference-server.mjs` sin CORS `*` (lista explícita, por defecto solo mismo origen / `127.0.0.1`), cabeceras `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. | **Corregido** |
| **I-02** | **Information Disclosure** (Evasión de `NetAllow.java` en Android) | Petición hacia otro bucket S3 mediante path traversal codificado (`%2e%2e`, `%2E%2E`, `%5c`) bajo `s3.amazonaws.com/elevation-tiles-prod/terrarium/`. | `NetAllow.java` endurecido para rechazar `..`, `%2e`, `%2f`, `%5c` y `\` en `getRawPath()`, cubierto por 20 comprobaciones en `NetAllowTest.java` (JVM). | **Corregido** |
| **D-01** | **Denial of Service** (Inundación de reportes / SSE / cuerpo gigante) | Envío masivo de JSONs grandes o apertura ilimitada de conexiones SSE al servidor de referencia. | Límite de tamaño de cuerpo (`maxBodyBytes`), rate-limit por ventana e IP con HTTP 429 (`sync-and-server.test.mjs`), cierre limpio `closeAllConnections()` en `reference-server.mjs`, `senda-relay` y `senda-live`. | **Corregido** |
| **E-01** | **Elevation of Privilege** (Automatización de N5 o fuga de bóveda defensa) | Un fallo de lógica o parámetro manipulado eleva un expediente a N5 sin autoridad humana o expone `packages/senda/src/defense/` en la web/escritorio civil. | `authorizeN5()` falla cerrado si falta `AuthorityGrant` válido o firma humana; `citizen-report.schema.json` fija `canPublicWarn: false`; `app-catalog.test.mjs` y `security-hardening.test.mjs` verifican aislamiento de `defense/`. | **Corregido** |

---

## 3. Resultados de auditoría automática (F6, medidos en este commit)

| Control | Herramienta / Prueba | Resultado medido | Estado |
|---|---|---|---|
| Secretos en el repositorio | `gitleaks` en `.github/workflows/senda-security-ci.yml` + `security-hardening.test.mjs` | **0 secretos detectados** | **Corregido** |
| Dependencias de producción (monorepo) | `pnpm audit --prod --audit-level=critical` | **0 críticos, 0 altos** (1 moderada en dependencia transitiva no expuesta en navegador) | **Aceptado con motivo** (0 críticos/altos) |
| Dependencias de producción (`investor-next`) | `npm audit --omit=dev --audit-level=high` | **0 vulnerabilidades** | **Corregido** |
| Lockfiles OSV | `osv-scanner` (Apache-2.0) en CI (`senda-security-ci.yml`) | Gate de 0 críticos en CI | **Corregido** |
| Cabeceras y CSP (`investor-next/vercel.json`) | `security-hardening.test.mjs` | HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `COOP: same-origin`, `CORP: same-origin`, `object-src 'none'`, 0 `'unsafe-eval'`, 0 CDNs (`unpkg`/`fonts.gstatic`), CSP sin `'unsafe-inline'` en `script-src` para las 9 superficies operativas | **Corregido** |
| Allowlist Android (`NetAllow.java`) | `NetAllowTest.java` (JVM Java 17) | **20/20 comprobaciones PASS** (incluyendo `%2e%2e`, `%2E%2E`, `%5c`) | **Corregido** |
| Tránsito TLS del servidor de referencia local | `reference-server.mjs` (HTTP en `127.0.0.1`) | Enlace local exclusivamente para referencia; cualquier despliegue institucional requiere reverse-proxy TLS 1.3 + mTLS y revisión jurídica/ENS | **Aceptado con motivo** (no se despliega servidor público) |
