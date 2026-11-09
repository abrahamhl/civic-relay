# SENDA — Plan de Acción Inmediato y Hoja de Ruta Ejecutiva

**Fecha de Actualización:** 2026-11-09T02:08:00Z  
**Estado:** Bloques 1, 2, 3, 4, 5, 6 y 7 COMPLETADOS Y CONSOLIDADOS en [PR #30](https://github.com/abrahamhl/civic-relay/pull/30).

---

## 1. Estado de Tareas por Bloque

- [x] **Bloque 1 (Auditoría e Integración Controlada):**
  - Fusión de PRs #18, #24, #25, #26, #27, #28, #29 y rama GDACS en `feat/senda-master-integration-20261109`.
  - Resolución de conflictos, verificación de paridad web y suites de tests al 100%.
  - Apertura de [PR #30](https://github.com/abrahamhl/civic-relay/pull/30) contra `master`.
- [x] **Bloque 2 (OSINT e Inteligencia Multirriesgo):**
  - Conector para **Copernicus EMS / EFFIS** (detecciones de anomalías térmicas activas con procedencia SHA-256 cruda y CC-BY 4.0).
  - Conector para **AEMET / Meteoalarm CAP** (alertas meteorológicas oficiales con severidad Yellow/Orange/Red y ventanas temporales).
  - Motor de Reconciliación Espacio-Temporal con grafo de dependencias upstream para neutralizar la falsa independencia, detección de discrepancias espaciales/magnitud, y generación de recibos criptográficos Merkle (`generateReconciliationReceipt`).
- [x] **Bloque 3 (Visualizadores GIS 3D/4D Profesionales):**
  - Implementación de `Globe4DStudio` con Three.js: Globo WGS84 interactivo, malla 3D de terreno Mapzen DEM con exageración de relieve ($\times 1$ a $\times 6$), partículas de viento aceleradas por GPU, órbitas satelitales con telemetría en tiempo real y elipsoide de Fresnel 3D con altura de mástiles (3–45 m) y frecuencias UHF/SHF.
- [x] **Bloque 4 (Motores Científicos y Calibración):**
  - Módulo `packages/senda/src/scientific-evaluation.mjs`: IoU espacial, matriz de confusión (Precision/Recall/F1/FPR), difracción en arista de cuchillo según recomendación ITU-R P.526, balance de enlace RF, y filtro de viabilidad satelital Doppler ($\Delta f > 5\text{ kHz}$) frente a hardware COTS de banda estrecha.
- [x] **Bloque 5 (Offline, Telemetría y Privacidad):**
  - Almacén IndexedDB v2 `cached_sources` con degradación transparente offline (`offlineCached: true`) en el cliente API.
  - Telemetría estrictamente opt-in para sensores del dispositivo.
- [x] **Bloque 6 (SENDA LIVE e Interfaz Premium):**
  - Integración del visualizador `Globe4DStudio` en `MapView.tsx`, preservación de protecciones XSS DOM-safe y controles multirriesgo.
- [x] **Bloque 7 (Vídeos, Branding y Materiales para Inversores):**
  - Verificación de 53 archivos audiovisuales M95 con peticiones por rangos HTTP 206 y pistas de subtítulos en ES, EN y NL (`evidence/video/m95/release.json`).

---

## 2. Próximas Acciones Inmediatas

1. **Seguimiento de CI en GitHub Actions:**
   - Supervisar los 5 workflows activos lanzados en PR #30 (`CI`, `Investor microsite checks`, `SENDA`, `SENDA LIVE · USGS observations and secure map`, `Emergency routing research lab`).
2. **Validación de Despliegue en Staging (Vercel):**
   - Confirmar el despliegue automático de staging para el commit `3ec8623` y documentar la URL de previsualización.
3. **Ampliación de Movilidad y Corredores Transfronterizos:**
   - Expandir el conector NDW / DATEX II para el corredor de pruebas A12 Arnhem-Ede y la DGT 3.0 en España.
