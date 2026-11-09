# SENDA — Registro de Evidencias de Ingeniería y Pruebas

**Fecha de Registro:** 2026-11-09T03:40:00Z  
**Entorno de Pruebas:** Node.js v22.22.2 / Python 3.12.7 / Windows 11 / PowerShell

---

## 1. Evidencias de Ejecución de Suites de Tests

| Suite | Comando | Resultado | Duración / Métricas |
|---|---|---|---|
| **Workspace Completo** | `pnpm -r test` | **APROBADO (0 errores)** | 9/9 proyectos completados con éxito |
| **SENDA Núcleo (`packages/senda`)** | `pnpm --filter @senda/core test` | **347/347 APROBADOS** | 13.4s, 0 fallos, 0 saltados, 100% aprobado |
| **SENDA LIVE Server & Client** | `pnpm --filter @senda/live test` | **97/97 APROBADOS** | 1.14s, 0 fallos, 0 saltados |
| **COTS RF Tactical & ASTM F3411** | `node --test packages/senda/tests/cots-rf-tactical.test.mjs` | **5/5 APROBADOS** | Remote ID ASTM F3411, Radar Biestático Pasivo (CAF slice / Doppler), DoA interferométrico, Síntesis de antenas caseras |
| **COTS Drone Recon & Hardware API** | `node --test apps/senda-live/tests/cots-rf.test.mjs` | **2/2 APROBADOS** | Distancia/rumbo geodésico, decodificación hex Remote ID, catálogo de antenas, endpoints REST |
| **Ciencia Táctica de Drones y A2G** | `node --test packages/senda/tests/uav-tactical-science.test.mjs` | **5/5 APROBADOS** | Al-Hourani A2G, altitud óptima $h_{\text{opt}}$, conectividad Fiedler $\lambda_2$, GSD fotogrametría, margen anti-jamming |
| **Planificador de Misión Táctica UAV** | `node --test apps/senda-live/tests/uav-tactical-planner.test.mjs` | **4/4 APROBADOS** | Boustrophedon sobre DEM, techos operacionales, GeoJSON, QGroundControl PX4 `.plan` |
| **API REST / SSE UAV** | `node --test apps/senda-live/tests/uav-api.test.mjs` | **1/1 APROBADO** | Presets de cámara, POST plan táctico, GET query, POST evaluación swarm |
| **Física Telecom & Deygout ITU-R P.526** | `node --test packages/senda/tests/telecom-mathematical-physics.test.mjs` | **6/6 APROBADOS** | Percolación $\lambda_c$, DTN $R_0$, Deygout, ITU-R P.838, Nakagami-m, Doppler LEO |
| **Harness Gubernamental y Resiliencia** | `node --test packages/senda/tests/government-resilience-harness.test.mjs` | **2/2 APROBADOS** | Calificación Tier-1 Soberana UME/ERCC con sello SHA-256 |
| **Movilidad DATEX II (CEN/TS 16157)** | `node --test apps/senda-live/tests/datex-mobility.test.mjs` | **3/3 APROBADOS** | Normalización, hash SHA-256 y fallback offline NDW/DGT |
| **Paridad Web Núcleo/Investor** | `node --test packages/senda/tests/web-parity.test.mjs` | **2/2 APROBADOS** | 74 módulos idénticos byte a byte |
| **Calibración Científica Python** | `python -m unittest discover -s packages/senda/data` | **16/16 APROBADOS** | 0.931s, 0 errores, SQLite cerrando conex. en Windows |
| **SENDA LIVE TypeCheck** | `pnpm --filter @senda/live type-check` | **APROBADO (0 errores)** | Código TypeScript con Three.js estrictamente tipeado |
| **Investor Next Mando** | `node --test investor-next/tests/command-surface-model.test.mjs` | **10/10 PASS** | Mando calibrado y superficies de enlace aprobadas |
| **Verificación Audiovisual M95** | `node media/senda-film/verify-web.mjs` | **53/53 ARCHIVOS OK** | Rangos HTTP 206, pistas VTT y release.json generado |
| **Build de Producción SENDA LIVE** | `pnpm --filter @senda/live build` | **APROBADO (0 errores)** | Vite compila dist/ en 3.57s con 0 errores |

---

## 2. Evidencias de Commits Criptográficos y Fusiones

- `25400cf`: Fusión de Corridor Fabric (PR #24) y SENDA LIVE (PR #25) en `mission/senda-unified-platform-20261108`.
- `d2ba465`: Fusión controlada de PR #26 (USGS + NASA EONET), PR #27 (Atmosphere 4D), PR #28 (DEM 3D Mesh), PR #29 (GeoRelay Fresnel) y rama `feat/senda-osint-gdacs-correlation-20261109` en `feat/senda-master-integration-20261109`.
- `3c679a1`: Fusión de PR #18 (calibración 14 motores, 17 fuentes oficiales, held-out scoring).
- `9b4478a`: Corrección de Windows SQLite locks en tests Python con `contextlib.closing`.
- `3b1c3cf`: Corrección de YAML syntax error en `.github/workflows/senda-real-observations-ci.yml`.
- `3ec8623`: Integración maestra OSINT, GIS 4D WebGL Three.js, motor de evaluación científica ITU-R P.526 y almacenamiento offline IndexedDB v2.
- `992c5cf`: Preservación estricta de la semántica de caída en bloque catch para mallas de terreno y meteorología en cliente web.
- `2e6f69c`: Registro de aprobación de los 17 checks de CI en PR #30.
- `036231f`: Implementación de física matemática telecom (percolación, Deygout, ITU-R P.838, Nakagami-m, Doppler LEO), arnés de resiliencia gubernamental/defensa y conector de movilidad DATEX II (CEN/TS 16157).
- `8924236`: Implementación de ciencia táctica de drones y enjambres (Al-Hourani A2G LoS, $h_{\text{opt}}$, conectividad Fiedler $\lambda_2$, GSD y margen anti-jamming).
- `3bfc713`: Integración de planificador táctico Boustrophedon sobre DEM real, exportador PX4 `.plan` y renderizado 3D de misión en `Globe4DStudio`.
- **PR #30 en GitHub:** Publicado contra la rama base `master` con la integración completa validada.

---

## 3. Integridad Criptográfica de Datasets y Artefactos

- **Sello de Planificación Táctica de Misión UAV SHA-256:** Hash SHA-256 generado sobre el conjunto de parámetros del sensor, límites geodésicos del DEM y coordenadas de waypoints.
- **Sello de Auditoría Gubernamental SHA-256:** Recibo generado por `evaluateGovernmentResilience` validando los 5 pilares de soberanía operativa con hash SHA-256 determinista.
- **Trama Hexadecimal ASTM F3411 Remote ID:** Mensajes empaquetados validados por decodificador con extracción determinista de identificadores ANSI/CTA-2063 y posición geodésica del piloto.
- **DATEX II Incidencias de Tráfico:** Hash SHA-256 individual por registro normalizado para NDW (A12 Arnhem-Ede) y DGT 3.0 (España).
- **Copernicus EMS/EFFIS:** Detecciones de anomalías térmicas acotadas geodésicamente con hash SHA-256 de carga útil cruda y procedencia CC-BY 4.0.
- **AEMET / Meteoalarm CAP:** Alertas meteorológicas oficiales con SHA-256 y parseo de severidad internacional.
- **Recibos Merkle de Reconciliación Espacio-Temporal:** Función `generateReconciliationReceipt` generando recibo criptográfico firmado con SHA-256 de todas las observaciones agrupadas y métricas de discrepancia de coordenadas y magnitudes.
- **Mapzen AWS DEM:** 4 teselas (Z=10, X=514-515, Y=395-396), 1089 muestras ráster decodificadas, hash validado en `docs/research/SENDA_MAPZEN_TERRAIN_REAL_RECEIPT_2026-11-09.md`.
- **MET Norway Weather Grid:** Cuadrícula de 9 puntos espaciales × 24 pasos horarios, hash validado en `docs/research/SENDA_METNO_ATMOSPHERE4D_REAL_RECEIPT_2026-11-09.md`.
