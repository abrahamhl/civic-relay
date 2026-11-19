# Registro Final de Integración SENDA (2026-11-17)

- **Rama de integración:** `feat/senda-canonical-integration-20261117` (basada en `master` `b8360c9`, sin `--allow-unrelated-histories`, sin fusión automática ni despliegue)
- **Ancestro común verificado en Git:** `4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3` (`chore: remove unused route handler in favor of vercel rewrite`)
- **Ramas consolidadas limpiamente:**
  - `master` (`b8360c9`)
  - `origin/pr/44` (`ce9ab69`, que ya integraba PR #34 `b0337fb`, PR #35 `fc2bebe` y PR #38 `74631c0`)
  - `origin/pr/32` (`cdabff3`, merge con resolución de conflictos en `investor-next/app/globals.css` e `investor-next/app/investor-page.tsx`)
  - `origin/pr/39` (`d7ed6bd`, merge manteniendo cita BOE verificada `BOE-A-2026-20742` en `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md`)
  - `origin/pr/42` (`d8feb5e`, merge automático sin conflictos)
  - `origin/pr/43` (`8bde691`, merge automático sin conflictos desde divergencia en `c1d5dee`)

---

## 1. Implementado

- **Arquitectura Canónica y Contratos (`packages/senda/src/`):**
  - `packages/senda/src/evidence-contract.mjs`: taxonomía cerrada (`OBSERVADO`, `SIMULADO`, `PREDICHO`, `HIPÓTESIS`, `NO VERIFICADO`), `createEvidenceContractRecord`, `assessForecastSkillGate` (cuarentena H2 como `EXPERIMENTAL_REJECTED`, `canPublicWarn = false`), `summarizeEvidenceLineage` (detección de dependencias compartidas en fuentes).
  - `packages/senda/src/routing-canonical.mjs`: puerta `assessCanonicalRouteGate` (paridad con `route-truth.mjs` y `arr-core.mjs`), planificador unificado `planCanonicalRoute` (`CGR`, `DELIVERY_ASSURANCE`, `SRLG_CUTS`, `RESILIENCE_COUNCIL` + comparadores enchufables vía `registerRoutingComparator` como `ARR_ENSEMBLE`) y `compareCanonicalRoutes`.
  - `packages/senda/src/index.mjs` y `packages/senda/scripts/sync-web.mjs`: exportación canónica y sincronización de `packages/senda/src/*.mjs` → `investor-next/public/senda/core/` (114 módulos civiles + 5 defensa) y `experimental/senda-arr/` → `investor-next/public/senda/arr/`.
- **Portabilidad Windows/Linux y Higiene Git:**
  - `.gitattributes` con `eol=lf` para evitar falsos positivos de SHA-256 en fixtures en Windows (`CRLF`).
  - `experimental/senda-route-truth/durable-lab-queue.mjs` (salta `fsyncSync(dirFd)` solo en `win32` manteniendo `fsyncSync(fileFd)` y `renameSync`) y `experimental/senda-route-truth/two-sandbox-offline.test.mjs` (espera limpia de hijos y reintentos en `rmSync`).
- **Centro de Coordinación Integrado (`investor-next/public/senda/centro.html` + `db.mjs`):**
  - Mapa táctico, línea temporal, panel de procedencia y linaje (`source-evidence.mjs`), zonas/perímetros, nodos cooperativos y rutas hipotéticas/SRLG N-2, cola offline persistente en IndexedDB (`enqueueOfflineItem`, `sweepExpiredQueue`, `revokeConsentTombstone`, `ackOfflineItem`), flujo ciudadano `Detectar → Comprobar → Clasificar → Coordinar → Cerrar` (nunca promoción automática a alerta oficial), historial SHA-256 verificable, gestión fail-closed de roles (`COORDINADOR_INCIDENTE`, `VERIFICADOR_SALA`, `OBSERVADOR`, `NO_ANCLADO`), exportación de paquete JSON + CAP 1.2 (`Exercise/Restricted`), panel de incertidumbre H11/H2 y selector ES/EN/NL.
- **Visor Científico Temporal / 4D (`investor-next/public/senda/visor.html` + `fuego3d.html` + `atlas.html`):**
  - Vista 2D y proyección isométrica 3D opcional con sonda WebGL y fallback determinista Canvas 2D (también añadido en `fuego3d.html`).
  - Desplazamiento temporal sobre datasets observados GeoMAC 2018 (`camp`, `carr`, `woolsey`) y simulación ARR regional, comparación entre `ARR`, ablación, `CGR` y techo epidémico, traza explicable de selección voraz + cortes SRLG N-2, inspector de fuentes y antigüedad (`observation_time`, `download_time`, `forecast_valid_time`, `sha256`), cuarentena explícita de H2 (`EXPERIMENTAL_REJECTED`, `canPublicWarn = false`) y gancho `window.SENDA_VISOR.registerForecastSuccessor` para futuro H3.
  - Enlaces actualizados en `investor-next/public/senda/index.html`, `investor-next/public/senda/atlas.html`, `investor-next/app/senda-home.tsx` y caché offline `investor-next/public/senda-sw.js` (`senda-campo-v47`).
- **Documentación, QA y CI:**
  - `docs/adr/ADR-CANONICAL-CONSOLIDATION-20261117.md`
  - `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md`
  - `docs/audits/INFORME_PREPARACION_PILOTO_INSTITUCIONAL_20261117.md`
  - `packages/senda/tests/canonical-consolidation.test.mjs`
  - `investor-next/scripts/senda-canonical-qa.mjs`
  - `.github/workflows/senda-canonical-integration-ci.yml` y actualización de `.github/workflows/senda-android-ci.yml`.

---

## 2. Comprobado (Resultados Exactos Tras la Última Edición de Código)

- **Núcleo `@senda/core` + Defensa + H11–H16 + Canónico:** `719/719` subtests PASS (`0` fallos, `0` omitidos).
- **Seguridad adversarial (`packages/senda/tests/adversarial/*.test.mjs`):** `11/11` subtests PASS (`0` fallos, `0` omitidos).
- **Libro mayor PCI (`packages/senda-pci/tests/*.test.mjs`):** `19/19` subtests PASS (`0` fallos, `0` omitidos).
- **Route Truth & ARR (`experimental/senda-route-truth/*.test.mjs` + `experimental/senda-arr/tests/*.test.mjs`):** `53/53` subtests PASS (`0` fallos, `0` omitidos).
- **`investor-next` unit tests (`investor-next/tests/*.test.mjs`):** `112/112` PASS (`0` fallos, `0` omitidos).
- **Criptografía legada (`@civic-relay/core`):** `26/26` PASS (`0` fallos, `0` omitidos).
- **Relé ciego (`@senda/relay`):** `3/3` PASS (`0` fallos, `0` omitidos).
- **Puente comunitario y meteorología (`@senda/live`):** `104/104` PASS (`0` fallos, `0` omitidos).
- **Manifiesto de release y procedencia Vercel (`scripts/release-manifest.test.mjs`, `scripts/vercel-provenance.test.mjs`):** `9/9` PASS (`0` fallos, `0` omitidos).
- **Oráculo independiente SRLG en Python (`packages/senda/scripts/verify-failure-cuts.py`):** `240/240` topologías sintéticas, `0` cortes mal clasificados (`EXACT_FOR_DECLARED_FINITE_TOPOLOGY_ONLY`).
- **Verificación de tipos workspace (`pnpm -r type-check`):** completada con código de salida `0` (`@civic-relay/schemas`, `@civic-relay/transports`, `@senda/live`, `@civic-relay/core`, `@civic-relay/api`, `apps/web`).
- **QA E2E navegador real Chromium (`investor-next/scripts/senda-screens-e2e.mjs`):** `39/39` PASS (`evidence/senda/screens-e2e.json`).
- **QA Canónica / Responsiva / Offline / 4D (`investor-next/scripts/senda-canonical-qa.mjs`):** `24/24` PASS (`evidence/senda/canonical-qa.json`):
  - Activos SW `senda-sw.js` en disco: `205/205` existentes (`0` ausentes).
  - Responsividad sin scroll horizontal a `360`, `390`, `768` y `1440` px en `/centro`, `/visor` y `/atlas`.
  - Cambio de idioma ES/EN/NL, IndexedDB tras recarga + tumba `REVOKED`, gate SRLG fail-closed, detección de no independencia `GDACS_EQ + USGS_NEIC`, flujo ciudadano sin alerta automática, bloqueo fail-closed de `OBSERVADOR`, auditoría JSON con cadena SHA-256 y `canPublicWarn=false`, puerta H2 `EXPERIMENTAL_REJECTED` en `/visor` + vista 3D + fallback Canvas 2D sin WebGL en `fuego3d`, `0` errores JS no capturados.

---

## 3. Pendiente

- **CI de GitHub en la nueva rama (`feat/senda-canonical-integration-20261117`):** ejecución de `senda-canonical-integration-ci.yml`, `senda-android-ci.yml` (compilación Gradle APK), y `senda-robust-risk-ci.yml` (`HiGHS` LP y `SciPy` en Ubuntu CI) tras abrir el PR en borrador.
- **Integración futura H3:** cuando exista un modelo sucesor experimental validado externamente, conectarlo mediante `window.SENDA_VISOR.registerForecastSuccessor(...)` y `assessForecastSkillGate(...)`, manteniendo bloqueo de alertas públicas hasta validación operativa.
- **Revisión humana de PR en borrador y decisión sobre retiro futuro de adaptadores legados (`packages/core`, `apps/web`).**
- **Actualización de seguridad de `next` (`16.4.2` en `investor-next`):** detectada recomendación automática de seguridad durante `next build`; no se aplica sin decisión explícita del responsable y siempre mediante `pnpm`.

---

## 4. Bloqueado (Fuera del Entorno Actual / Sin Hardware ni Convenios)

- **Campaña física de campo (`0` ensayos realizados):** faltan ≥ 2 terminales Android físicos y ≥ 2 nodos LoRa EU868 autorizados (CE/RED, ETSI EN 300 220) para ejecutar `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md`.
- **Compilación Android / pruebas Robolectric locales:** este entorno Windows no dispone de JDK/Android SDK/Gradle ni `adb` en `PATH` (verificado previamente en CI Linux de las ramas base; reconfirmar en CI del PR).
- **Oráculos Python con `scipy` en local:** no instalado `scipy` en Python 3.12 local (`verify-robust-lp.py` y `verify-dependence-bounds.py` dependen de Ubuntu CI `senda-robust-risk-ci.yml`).
- **Operación real e integraciones 112 / protección civil / certificaciones:** `0` convenios activos y `0` certificaciones obtenidas (ENS, ISO 27001, CE/RED hardware propio). El sistema permanece confinado a modo ejercicio/investigación (`canPublicWarn = false`).

---

## 5. Siguiente Responsable

1. **DevSecOps / Mantenedor del repositorio:** revisar el Draft PR en GitHub, verificar el paso verde de toda la matriz CI (incluidos APK Gradle y oráculos SciPy/HiGHS en Linux) y decidir en consulta con el equipo si se ejecuta `pnpm` upgrade de Next.js.
2. **Ingeniería de Campo / Hardware:** ejecutar `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md` con 2 Android y 2 nodos LoRa EU868 autorizados y publicar `field_trials.csv` con SHA-256 sin filtrar caídas.
3. **Investigación Científica (OpenCode H3):** cuando se entregue un sucesor H3 validado experimentalmente frente a persistencia y referencias, conectarlo vía `assessForecastSkillGate` y `registerForecastSuccessor`.
4. **Dirección Institucional / Legal:** tramitar auditoría criptográfica externa, DPIA/ENS y convenio piloto con organismo competente de protección civil antes de desbloquear ningún adaptador de operación real.
