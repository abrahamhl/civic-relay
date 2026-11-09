# SENDA — Estado Actual de Ingeniería y Plataforma

**Fecha y Hora (UTC):** 2026-11-09T02:05:00Z  
**Rama Activa:** `feat/senda-master-integration-20261109`  
**Último Commit SHA:** `3ec8623`  
**Tracking Remoto:** `origin/feat/senda-master-integration-20261109`  
**Pull Request Activo:** [PR #30: Integración Maestra OSINT, GIS 4D WebGL, Motores Científicos ITU-R P.526 y Resiliencia Offline](https://github.com/abrahamhl/civic-relay/pull/30)  

---

## 1. Integración de PRs y Ramas Consolidadas

| PR / Rama | Componente | Estado | Verificación |
|---|---|---|---|
| **PR #18** (`audit/senda-calibration-quality-gates-20261107`) | Gobernanza de calibración 14 motores, 17 fuentes oficiales, datasets reales NOAA/Digitraffic/USGS, scoring held-out | Integrado en PR #30 | 16/16 tests Python + suites JS |
| **PR #24** (`mission/senda-corridor-fabric-20261108`) | SENDA Corridor Fabric 5 planos, 5 conectores reales, R1-R5 y Pilotos A/B | Integrado en PR #30 | Suite Corridor Fabric + adversarial |
| **PR #25** (`feat/senda-social-live-20261108`) | Red Social de Acontecimientos SENDA LIVE, API, DB SQLite, moderación DSA | Integrado en PR #30 | 87/87 tests `@senda/live` |
| **PR #26** (`feat/senda-usgs-map-evidence-20261108`) | Observaciones reales USGS + Incendios NASA EONET, mapa Leaflet seguro | Integrado en PR #30 | Tests usgs-earthquakes + eonet |
| **PR #27** (`feat/senda-atmosphere4d-offline-20261109`) | Atmosphere 4D navegable, pronóstico MET Norway, línea temporal horaria | Integrado en PR #30 | Tests weather-grid + metno |
| **PR #28** (`feat/senda-terrain-mesh-georef-20261109`) | Terreno DEM georreferenciado 3D (Mapzen/AWS), caché offline PWA | Integrado en PR #30 | Tests terrain-grid + decodificador |
| **PR #29** (`feat/senda-relay-terrain-physics-20261109`) | GeoRelay físico, despeje 60% Fresnel, sombras RF 121 celdas, grafos repetidor | Integrado en PR #30 | Tests relay-geometry + 8 escenarios DEM |
| **`feat/senda-osint-gdacs-correlation-20261109`** | Ingestión multi-amenaza GDACS GeoJSON, cruce espaciotemporal sin falsa independencia | Integrado en PR #30 | Tests gdacs-osint + correlation |
| **Nuevas Fuentes OSINT (EFFIS & AEMET)** | Copernicus EMS/EFFIS anomalías térmicas y AEMET/Meteoalarm CAP alertas severas oficiales | Implementado y Probado | Tests copernicus-effis + aemet-cap |
| **Motor de Reconciliación Espacio-Temporal** | Grafo de dependencias upstream, detección de anomalías, scoring de confianza y recibos Merkle | Implementado y Probado | Tests spatial-reconciliation-engine |
| **Visualizador GIS 4D WebGL** | `Globe4DStudio` con Three.js: globo WGS84, DEM 3D con relieve $\times 1$–$\times 6$, órbitas Sentinel/MODIS/VIIRS, viento GPU, elipsoide Fresnel 3D | Implementado y Probado | Type-check OK, bundle OK |
| **Motor Científico y RF P.526** | `scientific-evaluation.mjs`: IoU espacial, matriz de confusión (F1/Precision/Recall), difracción ITU-R P.526 y Doppler satelital vs COTS | Implementado y Probado | 4/4 tests `scientific-evaluation.test.mjs` |
| **Resiliencia Offline y PWA** | IndexedDB versión 2 con almacén `cached_sources` y fallback automático en cliente API | Implementado y Probado | Client & Storage OK |

---

## 2. Métricas de Pruebas y Validación

- **Workspace Monorepo:** 9 proyectos en el workspace, 100% de tests aprobados (`pnpm test` completado con código 0).
- **SENDA Núcleo (`packages/senda`):** 329/329 tests superados (100%), paridad web exacta sincronizada hacia `investor-next/public/senda/core/`.
- **SENDA LIVE (`apps/senda-live`):** 87/87 tests superados (100%): unitarios, integración, endpoints HTTP, seguridad adversarial XSS y reconciliación espacial.
- **Investor Next (`investor-next`):** 10/10 tests de superficie de mando superados, comprobación estricta de rutas multilingües (ES, EN, NL) aprobada.
- **Suite de Calibración Científica Python (`packages/senda/data`):** 16/16 tests superados en Windows con gestión rigurosa de SQLite locks.
- **Suite Audiovisual & Media M95:** 53 archivos verificados, soporte para peticiones HTTP por rangos 206, pistas VTT para ES, EN y NL.
- **TypeScript Typecheck:** 0 errores en todos los paquetes y aplicaciones.
- **GitHub Actions:** CI general, Investor checks y SENDA LIVE CI en ejecución sobre PR #30.

---

## 3. Limitaciones Explícitas y Verdad Científica

1. **Observaciones vs Predicciones:** Los registros de USGS, NASA EONET, Copernicus EFFIS y GDACS se etiquetan rigurosamente como catálogos u observaciones de fuentes externas con licencias transparentes, nunca como alertas de emergencia de SENDA.
2. **Defensa contra Falsa Independencia:** Las coincidencias espaciotemporales entre fuentes no se confunden con confirmación independiente. Si dos catálogos dependen del mismo sensor satelital (ej. NASA FIRMS MODIS/VIIRS compartido entre EONET y EFFIS), el motor de reconciliación lo refleja explícitamente en el grafo de dependencias y no infla artificialmente la puntuación de confianza.
3. **Modelos RF / Fresnel vs Enlace Físico:** El despeje geométrico del 60% de la 1.ª zona de Fresnel y el cálculo de difracción en filo de cuchillo (ITU-R P.526) son modelos predictivos de atenuación; no garantizan enlace de paquetes IP sin margen de desvanecimiento ($\ge 15\text{ dB}$) y protocolo L2/L3 contrastado en hardware.
4. **Visibilidad Satelital vs Viabilidad de Hardware:** La visibilidad matemática orbital sobre el horizonte ($>0^\circ$) no implica viabilidad de enlace. Se exige máscara de elevación ($\ge 15^\circ$) y se evalúa el corrimiento Doppler ($\Delta f > 5\text{ kHz}$) que satura receptores COTS de banda estrecha sin compensación en banda base.
5. **Meteorología:** Los datos de MET Norway son pronósticos numéricos horarias (NWP), no sensores barométricos o anemómetros in-situ en tiempo real.
