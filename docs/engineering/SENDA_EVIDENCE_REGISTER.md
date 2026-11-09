# SENDA — Registro de Evidencias de Ingeniería y Pruebas

**Fecha de Registro:** 2026-11-09T02:05:00Z  
**Entorno de Pruebas:** Node.js v22.22.2 / Python 3.12.7 / Windows 11 / PowerShell

---

## 1. Evidencias de Ejecución de Suites de Tests

| Suite | Comando | Resultado | Duración / Métricas |
|---|---|---|---|
| **Workspace Completo** | `pnpm -r test` | **APROBADO (0 errores)** | 9/9 proyectos completados con éxito |
| **SENDA Núcleo (`packages/senda`)** | `pnpm --filter @senda/core test` | **329/329 APROBADOS** | 13.3s, 0 fallos, 0 saltados, 100% aprobado |
| **SENDA LIVE Server & Client** | `pnpm --filter @senda/live test` | **87/87 APROBADOS** | 0.97s, 0 fallos, 0 saltados |
| **Evaluación Científica & RF P.526** | `node --test packages/senda/tests/scientific-evaluation.test.mjs` | **4/4 APROBADOS** | IoU espacial, F1, ITU-R P.526, Doppler satelital |
| **Paridad Web Núcleo/Investor** | `node --test packages/senda/tests/web-parity.test.mjs` | **2/2 APROBADOS** | 70 módulos idénticos byte a byte |
| **Calibración Científica Python** | `python -m unittest discover -s packages/senda/data` | **16/16 APROBADOS** | 0.944s, 0 errores, SQLite cerrando conex. en Windows |
| **SENDA LIVE TypeCheck** | `pnpm --filter @senda/live type-check` | **APROBADO (0 errores)** | Código TypeScript con Three.js estrictamente tipeado |
| **Investor Next Mando & Locales** | `pnpm --dir investor-next run test:command && pnpm --dir investor-next run check:locales` | **10/10 + 6/6 PASS** | Mando calibrado y rutas ES/EN/NL aprobadas |
| **Verificación Audiovisual M95** | `node media/senda-film/verify-web.mjs` | **53/53 ARCHIVOS OK** | Rangos HTTP 206, pistas VTT y release.json generado |
| **Build de Producción Workspace** | `pnpm -r build` | **APROBADO (0 errores)** | Vite, Rollup, Workbox PWA y Next.js generan assets |

---

## 2. Evidencias de Commits Criptográficos y Fusiones

- `25400cf`: Fusión de Corridor Fabric (PR #24) y SENDA LIVE (PR #25) en `mission/senda-unified-platform-20261108`.
- `d2ba465`: Fusión controlada de PR #26 (USGS + NASA EONET), PR #27 (Atmosphere 4D), PR #28 (DEM 3D Mesh), PR #29 (GeoRelay Fresnel) y rama `feat/senda-osint-gdacs-correlation-20261109` en `feat/senda-master-integration-20261109`.
- `3c679a1`: Fusión de PR #18 (calibración 14 motores, 17 fuentes oficiales, held-out scoring).
- `9b4478a`: Corrección de Windows SQLite locks en tests Python con `contextlib.closing`.
- `7c9eab1`: Ignorar archivos temporales de Python (`__pycache__`, `*.pyc`).
- `3b1c3cf`: Corrección de YAML syntax error en `.github/workflows/senda-real-observations-ci.yml` y soporte de trigger en rama de integración.
- `3ec8623`: Integración maestra OSINT (Copernicus EFFIS, AEMET CAP, Reconciliación Merkle), GIS 4D WebGL Three.js (`Globe4DStudio`), motor de evaluación científica ITU-R P.526 y almacenamiento offline IndexedDB v2.
- **PR #30 en GitHub:** Publicado contra la rama base `master` con 22 archivos integrados y validados.

---

## 3. Integridad Criptográfica de Datasets y Artefactos

- **Copernicus EMS/EFFIS:** Detecciones de anomalías térmicas acotadas geodésicamente con hash SHA-256 de carga útil cruda y procedencia CC-BY 4.0.
- **AEMET / Meteoalarm CAP:** Alertas meteorológicas oficiales con SHA-256 y parseo de severidad internacional (Yellow/Orange/Red).
- **Recibos Merkle de Reconciliación Espacio-Temporal:** Función `generateReconciliationReceipt` generando recibo criptográfico firmado con SHA-256 de todas las observaciones agrupadas y métricas de discrepancia de coordenadas y magnitudes.
- **Mapzen AWS DEM:** 4 teselas (Z=10, X=514-515, Y=395-396), 1089 muestras ráster decodificadas, hash validado en `docs/research/SENDA_MAPZEN_TERRAIN_REAL_RECEIPT_2026-11-09.md`.
- **MET Norway Weather Grid:** Cuadrícula de 9 puntos espaciales × 24 pasos horarios, hash validado en `docs/research/SENDA_METNO_ATMOSPHERE4D_REAL_RECEIPT_2026-11-09.md`.
- **Digitraffic TMS Estación 23001:** Telemetría de tráfico real con integridad verificada contra SHA-256 de descarga oficial.
- **NOAA GOES Casos Históricos:** 13.116 píxeles clasificados y 535 valores HRRR catalogados en SQLite sin filtración de futuro.
