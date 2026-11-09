# SENDA — Estado Actual de Ingeniería y Plataforma

**Fecha y Hora (UTC):** 2026-11-09T03:40:00Z  
**Rama Activa:** `feat/senda-master-integration-20261109`  
**Tracking Remoto:** `origin/feat/senda-master-integration-20261109`  
**Pull Request Activo:** [PR #30: Integración Maestra OSINT, GIS 4D WebGL, Motores Científicos ITU-R P.526, Drones Tácticos, COTS RF Recon y Resiliencia Offline](https://github.com/abrahamhl/civic-relay/pull/30)  

---

## 1. Integración de PRs y Ramas Consolidadas

| PR / Módulo | Componente | Estado | Verificación |
|---|---|---|---|
| **PR #18** (`audit/senda-calibration-quality-gates-20261107`) | Gobernanza de calibración 14 motores, 17 fuentes oficiales, datasets reales NOAA/Digitraffic/USGS, scoring held-out | Integrado en PR #30 | 16/16 tests Python + suites JS |
| **PR #24** (`mission/senda-corridor-fabric-20261108`) | SENDA Corridor Fabric 5 planos, 5 conectores reales, R1-R5 y Pilotos A/B | Integrado en PR #30 | Suite Corridor Fabric + adversarial |
| **PR #25** (`feat/senda-social-live-20261108`) | Red Social de Acontecimientos SENDA LIVE, API, DB SQLite, moderación DSA | Integrado en PR #30 | 97/97 tests `@senda/live` |
| **PR #26** (`feat/senda-usgs-map-evidence-20261108`) | Observaciones reales USGS + Incendios NASA EONET, mapa Leaflet seguro | Integrado en PR #30 | Tests usgs-earthquakes + eonet |
| **PR #27** (`feat/senda-atmosphere4d-offline-20261109`) | Atmosphere 4D navegable, pronóstico MET Norway, línea temporal horaria | Integrado en PR #30 | Tests weather-grid + metno |
| **PR #28** (`feat/senda-terrain-mesh-georef-20261109`) | Terreno DEM georreferenciado 3D (Mapzen/AWS), caché offline PWA | Integrado en PR #30 | Tests terrain-grid + decodificador |
| **PR #29** (`feat/senda-relay-terrain-physics-20261109`) | GeoRelay físico, despeje 60% Fresnel, sombras RF 121 celdas, grafos repetidor | Integrado en PR #30 | Tests relay-geometry + 8 escenarios DEM |
| **`feat/senda-osint-gdacs-correlation-20261109`** | Ingestión multi-amenaza GDACS GeoJSON, cruce espaciotemporal sin falsa independencia | Integrado en PR #30 | Tests gdacs-osint + correlation |
| **Copernicus EFFIS & AEMET CAP** | Detecciones térmicas activas EFFIS (CC-BY 4.0) y alertas severas oficiales CAP (AEMET) | Integrado y Probado | Tests copernicus-effis + aemet-cap |
| **Reconciliación Espacio-Temporal** | Grafo de dependencias upstream, detección de discrepancias y recibos Merkle a prueba de manipulación | Integrado y Probado | Tests spatial-reconciliation-engine |
| **Visualizador GIS 4D WebGL** | `Globe4DStudio` con Three.js: globo WGS84, DEM 3D con relieve $\times 1$–$\times 6$, trayectorias UAV 3D, partículas de viento GPU, elipsoide Fresnel 3D | Integrado y Probado | Type-check OK, bundle OK |
| **Física Matemática Telecom** | `telecom-mathematical-physics.mjs`: Percolación continua ($\lambda_c$), dinámica epidémica DTN (P90/P99), difracción Deygout multi-obstáculo (ITU-R P.526), atenuación por lluvia (ITU-R P.838), desvanecimiento Nakagami-m / Shannon, y Doppler orbital LEO | Implementado y Probado | 8/8 tests `telecom-mathematical-physics.test.mjs` |
| **Ciencia Táctica de Drones y Mapeo Topográfico** | `uav-tactical-science.mjs`: Canal 3D A2G sigmoide Al-Hourani, altitud óptima $h_{\text{opt}}$, conectividad algebraica Laplaciana del enjambre ($\lambda_2$), fotogrametría aérea GSD y margen anti-jamming EW | Implementado y Probado | 5/5 tests `uav-tactical-science.test.mjs` |
| **Planificador de Vuelo Táctico Boustrophedon y API** | `uav-tactical-planner.mjs`: Malla de rastreo topográfico sobre DEM real, exportación PX4/QGroundControl `.plan`, GeoJSON y endpoints REST | Implementado y Probado | 4/4 tests `uav-tactical-planner.test.mjs` + tests HTTP API |
| **Reconocimiento COTS RF & Radar Biestático Pasivo** | `cots-rf-tactical.mjs`: Decodificador ASTM F3411 Remote ID (Basic ID, Location/Vector, System Operator/GCS), Cross-Ambiguity Function (CAF) para Radar Biestático Pasivo (PBR) con iluminadores FM/DVB-T, radiogoniometría DoA interferométrica y síntesis milimétrica de antenas caseras (Yagi, QFH, Bi-Quad, Monopolo) | Implementado y Probado | 5/5 tests `cots-rf-tactical.test.mjs` |
| **Dominio y API de Rastreo COTS & Geolocalización de Piloto** | `cots-drone-recon.mjs`: Catálogo de hardware COTS AliExpress (<25€), asociación de drones hostiles/no autorizados con coordenadas del operador GCS en tierra, endpoints REST y pruebas | Implementado y Probado | 2/2 tests `cots-rf.test.mjs` |
| **Integración 3D COTS en Estudio GIS 4D** | `Globe4DStudio.tsx`: Renderizado 3D de drones detectados, baliza en superficie del piloto no autorizado con cable/línea discontinua de atadura, modal interactivo de hardware AliExpress y laboratorio de decodificación hex ASTM | Implementado y Probado | Type-check OK, bundle OK |
| **Harness Gubernamental y Defensa** | `government-resilience-harness.mjs`: Evaluación de 5 pilares (Black-Sky, Capacidad de Evacuación, Agilidad Espectral, Criptografía Forense y Calibración Empírica) con sello de auditoría SHA-256 | Implementado y Probado | 2/2 tests `government-resilience-harness.test.mjs` |
| **Movilidad DATEX II (CEN/TS 16157)** | `datex-mobility.mjs`: Ingestión de incidencias de tráfico, cortes de calzada y chokepoints de evacuación (NDW Países Bajos y DGT 3.0 España) | Implementado y Probado | 3/3 tests `datex-mobility.test.mjs` |
| **Resiliencia Offline y PWA** | IndexedDB versión 2 con almacén `cached_sources` y fallback automático en cliente API | Integrado y Probado | Client & Storage OK |

---

## 2. Métricas de Pruebas y Validación

- **Workspace Monorepo:** 9 proyectos en el workspace, 100% de tests aprobados (`pnpm test` completado con código 0).
- **SENDA Núcleo (`packages/senda`):** 347/347 tests superados (100%), paridad web exacta sincronizada (74 módulos idénticos hacia `investor-next/public/senda/core/`).
- **SENDA LIVE (`apps/senda-live`):** 97/97 tests superados (100%): unitarios, integración, endpoints HTTP, seguridad adversarial XSS, DATEX II, planificador UAV, reconciliación espacial y COTS RF.
- **Investor Next (`investor-next`):** 10/10 tests de superficie de mando superados, comprobación estricta de rutas multilingües (ES, EN, NL) aprobada.
- **Suite de Calibración Científica Python (`packages/senda/data`):** 16/16 tests superados en Windows con gestión rigurosa de SQLite locks.
- **Suite Audiovisual & Media M95:** 53 archivos verificados, soporte para peticiones HTTP por rangos 206, pistas VTT para ES, EN y NL.
- **TypeScript Typecheck:** 0 errores en todos los paquetes y aplicaciones (`tsc -p web/tsconfig.json --noEmit` completado limpiamente).
- **Build de Producción:** Vite compila `dist/` en 3.57s con 0 errores.
- **GitHub Actions:** 17/17 checks aprobados en la corrida anterior en PR #30.

---

## 3. Limitaciones Explícitas y Verdad Científica

1. **Observaciones vs Predicciones:** Los registros de USGS, NASA EONET, Copernicus EFFIS, GDACS y DATEX II se etiquetan rigurosamente como catálogos u observaciones de fuentes externas con licencias transparentes, nunca como alertas de emergencia inventadas por SENDA.
2. **Defensa contra Falsa Independencia:** Las coincidencias espaciotemporales entre fuentes no se confunden con confirmación independiente. El grafo de dependencias explicita proveedores comunes (ej. NASA FIRMS compartido entre EONET y EFFIS).
3. **Modelos RF / Fresnel vs Enlace Físico:** El despeje geométrico y el cálculo de difracción multi-obstáculo Deygout (ITU-R P.526) son modelos predictivos de atenuación; no garantizan enlace de paquetes IP sin margen de desvanecimiento ($\ge 15\text{ dB}$) y protocolo L2/L3 contrastado en hardware.
4. **Hardware COTS y Radares Caseros:** Los receptores RTL-SDR económicos poseen un ancho de banda instantáneo de 2.4 MHz y un convertidor ADC de 8 bits (rango dinámico teórico $\approx 48\text{ dB}$); en escenarios con fuertes ecos directos del transmisor (FM/DVB-T), se requiere cancelación adaptativa de señal directa (ECA / NLMS) para detectar secciones eficaces de radar (RCS) de microdrones ($<0.01\text{ m}^2$) sin enmascaramiento.
5. **Geolocalización de Operadores (ASTM F3411):** La localización del piloto depende de la emisión de mensajes OpenDroneID System Message (Tipo 0x4) por drones compatibles. En drones militares o modificados sin emisor (uncooperative), la detección recae exclusivamente en radar biestático pasivo o radiogoniometría DoA interferométrica multiantena.
6. **Visibilidad Satelital vs Viabilidad de Hardware:** La visibilidad matemática orbital sobre el horizonte ($>0^\circ$) no implica viabilidad de enlace. Se exige máscara de elevación ($\ge 15^\circ$) y se evalúa el corrimiento Doppler ($\Delta f > 5\text{ kHz}$) que satura receptores COTS de banda estrecha sin compensación en banda base.
7. **Drones Tácticos y Mapeo en Zonas Críticas:** Los planes de vuelo generados (Boustrophedon / PX4) respetan techos operacionales tácticos ($\le 300\text{ m}$ AGL) y calculan GSD físico efectivo según sensor óptico; en zonas sin GNSS (GPS-denied), la navegación requiere correlación altimétrica sobre DEM y odometría visual, distinguiendo trayectorias calculadas de telemetría inercial real.
8. **Meteorología:** Los datos de MET Norway son pronósticos numéricos horarias (NWP), no sensores barométricos o anemómetros in-situ en tiempo real.
