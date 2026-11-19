# ADR-CANONICAL-CONSOLIDATION: Arquitectura Canónica Reversible y Resolución de Ramas SENDA

- **Estado:** ACEPTADO (Implementado en rama de integración `feat/senda-canonical-integration-20261117`, pendiente de revisión humana; sin fusión automática ni despliegue a producción)
- **Fecha:** 2026-11-17
- **Autor:** Arquitectura CTO / Integración SENDA (`civic-relay`)
- **Alcance:** Consolidación de `master`, PR #32, PR #39, PR #42, PR #43, PR #34, PR #35, PR #38 y PR #44.

---

## 1. Hallazgo Forense Git (Ancestros, CI y Conflictos)

Una auditoría previa (`SENDA_SCIENTIFIC_ARCHITECTURE_20261117.md`) asumió erróneamente que `packages/senda` vivía en historias Git sin ancestro común con `master`. La verificación directa en el repositorio completo demuestra que **todas las ramas comparten un ancestro común real**:

- **Ancestro común real:** `4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3` (`chore: remove unused route handler in favor of vercel rewrite`, 2026-10-25).
- **No se requiere `--allow-unrelated-histories`** ni fusiones destructivas.

### Inventario Exacto de Ramas y Estado CI Consultado en GitHub

| Línea / PR | Rama | SHA Head | Base / Ancestro | Estado CI (Checks) | Solapamientos / Conflictos |
|---|---|---|---|---|---|
| `master` (PR #33) | `master` | `b8360c9` | `4c310f7` (+1 commit) | Producción Vercel | `globals.css`, `investor-page.tsx` frente a PR #32 |
| PR #34 | `research/senda-authorization-truth-gate-20261116` | `b0337fb` | `master` (`b8360c9`) | GREEN (`build`, `simulator`, `research-invariants`) | Sin conflictos |
| PR #35 | `audit/senda-agent1-two-sandbox-20261117` | `fc2bebe` | PR #34 | GREEN (`research-invariants`) | Sin conflictos |
| PR #38 | `audit/senda-agent1-durable-lab-20261117` | `74631c0` | PR #35 | GREEN (`APK experimental`, `trilingual-browser-smoke`, `simulator`, `research-invariants`) | Sin conflictos |
| PR #44 | `ccr-ea048c78-86gcio` | `ce9ab69` | PR #38 | GREEN (`simulator`, `arr-invariants`) | Sin conflictos con PR #32–#43 (`0` ficheros compartidos) |
| Base Día 1 | `feat/senda-funding-mission-day1` | `6017652` | `4c310f7` | Base local | — |
| PR #32 | `claude/promotional-video-prompts-p5vzh8` | `cdabff3` | `6017652` | GREEN (9 checks: `trilingual-browser-smoke`, `build 22/24`, `simulator`, `senda`, `Formatos+APK`, `senda-adversarial`, `senda-pci`, `release-manifest`) | `globals.css`, `investor-page.tsx` vs `master`; 1 conflicto doc vs PR #39 |
| PR #39 | `audit/senda-pr32-safety-gates-20261117` | `d7ed6bd` | `632e9de` (dentro de PR #32) | GREEN (`trilingual-browser-smoke`, `simulator`, `Formatos+APK`, `trust-regression`) | 1 conflicto en `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md` (BOE RD 806/2026) |
| PR #42 | `audit/senda-robust-scenario-uncertainty-20261117` | `d8feb5e` | PR #39 | GREEN (11 checks incl. `shadow-math-and-core 22/24`, `HiGHS 250 cases`) | Diverge de PR #43 en `c1d5dee` (`0` conflictos de fichero) |
| PR #43 | `research/senda-h15-evidence-routing-council-20261117` | `8bde691` | `c1d5dee` (dentro de PR #42) | GREEN (`trilingual-browser-smoke`, `simulator`, `Formatos+APK`, `Evidence graph Node 22/24`) | `0` conflictos con PR #42 |

### Matriz de Resolución de Conflictos

1. `investor-next/app/globals.css`: Se conservan **ambos bloques** — contención responsiva + sobriedad editorial de `master` (`b8360c9`, PR #33) y `.senda-banner` de PR #32 (`cdabff3`).
2. `investor-next/app/investor-page.tsx`: Se conservan **ambos bloques** — `<EditorialScience />` de PR #33 envuelto en `data-for` junto a `<MasterVision />` y las cuatro superficies de PR #32.
3. `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md`: Se toma la versión verificada directamente en el BOE (`BOE-A-2026-20742`) de PR #39 (`d7ed6bd`), manteniendo la nota no vinculante de valoración.
4. Portabilidad Windows / LF (`core.autocrlf`): Se añade `.gitattributes` con `eol=lf` para evitar alteración de SHA-256 en fixtures reales (`gdacs_eventos.json`, `espana-dgt`, `ndw-bridge-openings-v3.xml`, `celestrak-galileo-iridium.tle`), y en `experimental/senda-route-truth/durable-lab-queue.mjs` se omite únicamente `fsyncSync(dirFd)` en `win32` (donde NTFS lanza `EPERM` sobre descriptores de directorio, manteniendo siempre `fsyncSync(fileFd)` y `renameSync`).

---

## 2. Decisiones de Arquitectura Canónica (Reversible)

1. **Único núcleo de protocolos (`@senda/core`):**
   - `packages/senda/src/` es la fuente canónica de verdad para protocolos DTN, físicas de propagación, custodia, informes ciudadanos (`SND3`), CAP 1.2, resiliencia H11–H16 y contrato de evidencias.
   - `packages/senda/scripts/sync-web.mjs` sincroniza byte a byte `packages/senda/src/*.mjs` → `investor-next/public/senda/core/` y `experimental/senda-arr/src/*.mjs` + datos GeoMAC → `investor-next/public/senda/arr/`. La paridad se verifica automáticamente en test (`canonical-consolidation.test.mjs`).

2. **Motor de enrutamiento canónico + adaptadores para comparadores (`packages/senda/src/routing-canonical.mjs`):**
   - Fachada unificada `planCanonicalRoute` + puerta `assessCanonicalRouteGate` (paridad diferencial con `experimental/senda-route-truth/route-truth.mjs#assessModelRoute` y `arr-core.mjs#contactRejection`).
   - Motores soportados nativamente bajo un contrato único: `CGR` (`router.mjs`), `DELIVERY_ASSURANCE` (`delivery-assurance.mjs`), `SRLG_CUTS` (`failure-domain-cuts.mjs`), `RESILIENCE_COUNCIL` (`resilience-council.mjs`), más comparadores enchufables vía `registerRoutingComparator` (`ARR_ENSEMBLE` de PR #44, comparadores históricos de `investor-next` o `packages/core`).
   - Ningún motor puede devolver `physicalDeliveryVerified = true` ni `canPublicWarn = true` desde una ruta calculada.

3. **Contrato unificado de evidencias y riesgos (`packages/senda/src/evidence-contract.mjs`):**
   - Taxonomía cerrada obligatoria: `OBSERVADO`, `SIMULADO`, `PREDICHO`, `HIPÓTESIS`, `NO VERIFICADO`.
   - Todo registro exige `source`, `license`, `observationTime`, `downloadTime`, `forecastValidTime` (si aplica) y verificación de linaje compartido vía `source-evidence.mjs` (p. ej. `GDACS_EQ` deriva de `USGS_NEIC`/`EMSC`; `GDACS_WF` de `NASA_FIRMS`/`EFFIS`; `GDACS_FL` de `GloFAS`).
   - Puerta `assessForecastSkillGate`: mientras H2 tenga Brier peor o igual que la persistencia, queda confinado a `EXPERIMENTAL_REJECTED` con `canPublicWarn = false` y aviso explícito. Un futuro sucesor H3 se integra por este mismo contrato sin habilitar avisos públicos hasta superar ensayos operativos y certificación.

4. **Implementación criptográfica coherente por protocolo:**
   - **Sobres DTN / Malla / Órdenes remotas:** WebCrypto ECDH/ECDSA P-256 + AES-GCM (`packages/senda/src/envelope.mjs`, `roles.mjs`, `remote-command.mjs`).
   - **Reportes ciudadanos compactos (`SND3` ≤ 160 car.):** Ed25519 (`packages/senda/src/hazard-reports.mjs`), verificados pero **nunca** autenticados institucionalmente ni promovidos a `OFFICIAL`.
   - **Cadena de custodia y auditoría:** SHA-256 encadenado (`packages/senda/src/interop.mjs#createAuditLog`) y libro mayor PCI Ed25519 (`packages/senda-pci/src/ledger.mjs`).
   - **Legado `@civic-relay/core`:** `libsodium` X25519 SealedBox (`packages/core/src/crypto.ts`) mantenido en modo adaptador legado para `apps/web` hasta verificar equivalencia funcional.
   - **Android Lab (`experimental/android-nearby`):** ECDSA P-256 (`LabReceiptSigner.java`) en laboratorio físico aislado; no se mezcla con credenciales institucionales.

5. **Sistema único de autenticación institucional y permisos (Fail-Closed):**
   - Regla invariante de PR #39 + PR #43 + PR #34: un reporte ciudadano nunca se convierte en alerta institucional; `toCap()` usa por defecto `status='Exercise'`, `scope='Restricted'`, `certainty='Unknown'`; `situationReport(..., { exercise: false })` falla cerrado; roles desconocidos o sin consentimiento/batería/ciclo de trabajo se rechazan en `assessCanonicalRouteGate`.

6. **Adaptadores de plataforma (Android, Navegador, Simulación, Gateways):**
   - **Navegador / PWA:** `investor-next/public/senda/` (`/senda/centro`, `/senda/visor`, `/senda/atlas`, etc.) + `senda-sw.js` + `db.mjs` (IndexedDB local con revocación de consentimiento y tumbas).
   - **Android:** `apps/senda-android` sirve la app canónica offline desde `assets/senda/` sobre `https://app.senda.local` sin permiso de Internet (`AppActivity.java` + `OfflineAssets.java`), abriendo `MainActivity` para radios BLE/Wi-Fi solo por toque explícito del usuario. `experimental/android-nearby` aporta `LabPersistentQueue.java` y `LabReceiptSigner.java` para los ensayos de campo con 2 Android + 2 LoRa (pendientes de ejecutar).
   - **Simulación:** `experimental/senda-arr/` y `experimental/senda-route-truth/` permanecen aislados como laboratorios reproducibles (`simulationOnly`), conectados al Visor 4D mediante adaptador y copia sincronizada (`arr/`).
   - **Gateways autorizados:** `packages/senda-relay`, `apps/senda-live` y `datex2.mjs` / `interop.mjs`, todos en modo restringido mientras no existan convenios institucionales.

7. **Separación estricta entre investigación, demostración y operación real:**
   - **Investigación:** `experimental/*`, H11–H16, H2/H-ARR-1 (`SOLO MODELO / EXPERIMENTAL`).
   - **Demostración:** `investor-next` (`/`, `/es/`, `/nl/`, `/senda/demo`) con etiquetado transparente de qué funciona en código hoy frente a qué es simulación o hardware pendiente.
   - **Operación real:** Bloqueada (`canPublicWarn: false`, `CAP Actual` bloqueado, `physicalDeliveryVerified: false`) hasta completar ensayos físicos, auditoría de seguridad y acreditación de organismos de protección civil.

---

## 3. Matriz de Migración Módulo por Módulo

| Módulo / Superficie | Ubicación | Decisión | Justificación y Criterio de Retiro |
|---|---|---|---|
| Núcleo `@senda/core` (88+ módulos) | `packages/senda/src/*` | **REUTILIZAR (Canónico)** | Motor principal probado; incluye seguridad P0 (PR #39), H11–H16 (PR #42–#43) y nuevos contratos `evidence-contract.mjs` y `routing-canonical.mjs`. |
| Custodia `@senda/pci` | `packages/senda-pci/` | **REUTILIZAR (Canónico)** | Cadena de custodia Ed25519 + SHA-256 verificada (13/13 tests). |
| Relé ciego `@senda/relay` | `packages/senda-relay/` | **ADAPTADOR GATEWAY** | Reenvío ciego de sobres cifrados; pendiente de despliegue federado autorizado. |
| Red social puente `@senda/live` | `apps/senda-live/` | **ADAPTADOR CONTEXTO** | 104/104 tests; aporta contexto de cámaras y eventos sin promover reportes ciudadanos a alerta oficial. |
| Centro de Coordinación PWA | `investor-next/public/senda/centro.html` | **CONSOLIDAR (Fase 2)** | Superficie principal de coordinación (10 capacidades, IndexedDB offline, SRLG, roles, CAP Exercise, auditoría). |
| Visor Científico Temporal / 4D | `investor-next/public/senda/visor.html` + `atlas.html` | **CONSOLIDAR (Fase 3)** | Unifica Atlas + ARR/H2 + GeoMAC 2018 + cortes SRLG + vista 2D/3D opcional + traza explicable. |
| Web Showcase Trilingüe | `investor-next/app/*` | **REUTILIZAR + ENLAZAR** | Mantiene contención editorial PR #33 y enlaza a Centro y Visor con etiquetas de verdad. |
| `@civic-relay/core`, `schemas`, `transports`, `api`, `apps/web` | `packages/{core,schemas,transports,api}`, `apps/web` | **ADAPTADOR LEGADO** | Conservado sin rotura; solo se retirará si se verifica equivalencia completa en todos los consumidores TypeScript. |
| `investor-next/lib/emergency-routing.mjs` | `investor-next/lib/` | **ADAPTADOR COMPARADOR** | Mantenido para la demo interactiva de portada; no se usa como planificador operativo. |
| `experimental/senda-route-truth/*` | `experimental/senda-route-truth/` | **EXPERIMENTAL + PARIDAD** | Semántica de roles/autorización integrada en `routing-canonical.mjs`; el journal Node (`durable-lab-queue.mjs`) permanece solo para sandbox multi-proceso en Node. |
| `experimental/senda-arr/*` | `experimental/senda-arr/` | **EXPERIMENTAL + ADAPTADOR** | Motor ARR y datasets GeoMAC sincronizados a `public/senda/arr/` para el Visor 4D; H2 marcado `EXPERIMENTAL_REJECTED`. |
| App Android SENDA | `apps/senda-android/` | **REUTILIZAR (Canónico Móvil)** | WebView offline `https://app.senda.local` + puente `senda://` a radios BLE/Wi-Fi. |
| Lab Android Nearby | `experimental/android-nearby/` | **EXPERIMENTAL HARDWARE** | Aporta `LabPersistentQueue.java` y `LabReceiptSigner.java` para pruebas de campo 2 Android + 2 LoRa; no duplicar `durable-lab-queue.mjs` aquí. |
