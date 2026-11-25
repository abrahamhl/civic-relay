# Estado actual verificado (`CURRENT_TRUTH.md`)

Adoptado de la disciplina epistémica de `civil-sentry` para SENDA: este documento registra exclusivamente hechos verificados en código y ejecución real a fecha `2026-11-25T18:33Z`, separando con nitidez lo **VERIFICADO**, lo **SOPORTADO**, lo **NO VERIFICADO** y las **RESTRICCIONES INNEGOCIABLES**.

## 1. Hechos verificados (`VERIFIED`)

- **Integridad de la suite completa:** `node --test packages/senda/tests/*.test.mjs` ejecutado con éxito el `2026-11-25`: **1137/1137 pruebas en verde, 0 fallos, 0 omitidas** (`111,1 s`).
- **Paridad web y cero colisiones de exportación:** `node packages/senda/scripts/sync-web.mjs`, `index-exports.test.mjs` y `web-parity.test.mjs` en verde (211 módulos civiles sincronizados idénticamente entre `packages/senda/src/` e `investor-next/public/senda/core/`).
- **Modificación mínima del repositorio base:** respecto a `master` (`333996f4f133a8ea44e01c062f79a306e6d2756d`), **ningún archivo existente ha sido modificado salvo la adición de exportaciones** en `packages/senda/src/index.mjs` (y su copia sincronizada `investor-next/public/senda/core/index.mjs`).
- **Puerta humana N5 verificada:** `canPublicWarn` permanece `false` en toda evaluación automática (N0–N4, escáner situacional, panel de 4 especialistas, ataque Sybil de 25 reportes, simulacros). Solo se activa con `AuthorityGrant` Ed25519 vigente + firma Ed25519 humana + `operationalStatus === 'ACTUAL'`.
- **Validación DANA 29-10-2024 (Poyo) offline:** `FV2D Audusse-HLLC + breaching Lindsay-Dhun + incisión 1 m + Manning diferenciado + porosidad urbana 0,72` alcanza **CSI `0,2516`** (vs `0,2354` en `swe.json`), **Picanya `215 min`** (vs `393–480 min`) y **Paiporta `262 min`** (vs `448–545 min`), balance de masa `5,49e-15`.
- **Asimilación EnKF (N2+):** mejora CSI `0,1811 → 1,0000`, RMSE `0,2550 → 0,0317 m` y anchura de horquilla 90 % en `−69,3 %` en experimento gemelo acoplado a `shallow-water.mjs`.
- **Interfaces web sin instalación:** `reportar.html` y `comite.html` renderizan dinámicamente en Google Chrome headless (`1440×900` y `390×844`) con **0 errores de consola**.

## 2. Capacidades verificadas en CPU pero NO verificadas en hardware objetivo (`UNKNOWN / NOT_VERIFIED`)

- Ejecución de `WGSL_SWE_FV_SHADER` en GPU física (VM sin GPU; sí verificada paridad CPU `f32↔f64` a `1,14e-6 m`).
- Cronometraje en teléfono móvil físico de gama media.
- Conexión en vivo a SAIH, AEMET, Copernicus CDSE, DGT 3.0 o ES-Alert.
- Validación de cadena X.509/COSE de C2PA contra la lista oficial de CAs.
- Dictamen jurídico formal RGPD/LOPDGDD (ver `PRIVACIDAD.md` e `IDEAS_NO_VALIDADAS.md`).

## 3. Reglas invariantes activas

1. Ningún dato o cifra se inventa ni se rellena con valores por defecto sin fuente citada.
2. Ningún `COLLECTION_ERROR` se convierte en `ABSENT` ni en `CONTRADICTED`.
3. Ningún registro `SIMULATION | EXERCISE | TEST` puede cruzar a `N5` (`canPublicWarn`).
4. Ningún despliegue en la nube ni `git push` se ha realizado: todo el trabajo permanece en local.
