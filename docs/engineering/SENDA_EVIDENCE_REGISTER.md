# SENDA — Registro de Evidencias de Ingeniería y Pruebas

**Fecha de Registro:** 2026-11-09T01:42:00Z  
**Entorno de Pruebas:** Node.js v22.22.2 / Python 3.12.7 / Windows 11 / PowerShell

---

## 1. Evidencias de Ejecución de Suites de Tests

| Suite | Comando | Resultado | Duración / Métricas |
|---|---|---|---|
| **Workspace Completo** | `pnpm -r test` | **APROBADO (0 errores)** | 9/9 proyectos completados con éxito |
| **SENDA LIVE Server & Client** | `pnpm --filter @senda/live test` | **74/74 APROBADOS** | 0.996s, 0 fallos, 0 saltados |
| **Calibración Científica Python** | `python -m unittest discover -s packages/senda/data` | **16/16 APROBADOS** | 0.944s, 0 errores, SQLite cerrando conex. en Windows |
| **SENDA LIVE TypeCheck** | `pnpm --filter @senda/live type-check` | **APROBADO (0 errores)** | Código TypeScript estrictamente tipeado |
| **Build de Producción Workspace** | `pnpm -r build` | **APROBADO (0 errores)** | Vite, Rollup, Workbox PWA y Next.js generan assets |

---

## 2. Evidencias de Commits Criptográficos y Fusiones

- `25400cf`: Fusión de Corridor Fabric (PR #24) y SENDA LIVE (PR #25) en `mission/senda-unified-platform-20261108`.
- `d2ba465`: Fusión controlada de PR #26 (USGS + NASA EONET), PR #27 (Atmosphere 4D), PR #28 (DEM 3D Mesh), PR #29 (GeoRelay Fresnel) y rama `feat/senda-osint-gdacs-correlation-20261109` en `feat/senda-master-integration-20261109`.
- `3c679a1`: Fusión de PR #18 (calibración 14 motores, 17 fuentes oficiales, held-out scoring).
- `9b4478a`: Corrección de Windows SQLite locks en tests Python con `contextlib.closing`.
- `7c9eab1`: Ignorar archivos temporales de Python (`__pycache__`, `*.pyc`).
- `3b1c3cf`: Corrección de YAML syntax error en `.github/workflows/senda-real-observations-ci.yml` y soporte de trigger en rama de integración.

---

## 3. Integridad Criptográfica de Datasets y Artefactos

- **Mapzen AWS DEM:** 4 teselas (Z=10, X=514-515, Y=395-396), 1089 muestras ráster decodificadas, hash validado en `docs/research/SENDA_MAPZEN_TERRAIN_REAL_RECEIPT_2026-11-09.md`.
- **MET Norway Weather Grid:** Cuadrícula de 9 puntos espaciales × 24 pasos horarios, hash validado en `docs/research/SENDA_METNO_ATMOSPHERE4D_REAL_RECEIPT_2026-11-09.md`.
- **Digitraffic TMS Estación 23001:** Telemetría de tráfico real con integridad verificada contra SHA-256 de descarga oficial.
- **NOAA GOES Casos Históricos:** 13.116 píxeles clasificados y 535 valores HRRR catalogados en SQLite sin filtración de futuro.
