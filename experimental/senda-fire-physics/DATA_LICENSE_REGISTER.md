# Registro de Fuentes, Licencias y Auditoría Causal — `H-FIRE-B` (2026-11-17)

| Dataset / Fuente | Rol en `H-FIRE-B` | Observación (`t_obs`) vs Disponibilidad (`t_avail`) | Licencia / Restricciones | Estado local actual |
|---|---|---|---|---|
| **USGS/NIFC GeoMAC 2018 (`camp`, `carr`, `woolsey`)** | **SOLO DIAGNÓSTICO / DESARROLLO (`DEVELOPMENT_DIAGNOSTIC_ONLY`)** | Marca `t` digitalizada; sin garantía de publicación institucional en tiempo real | Público USGS/NIFC (citar origen; SHA-256 en repositorio) | **PRESENTE EN LOCAL** (`experimental/senda-arr/data/`) |
| **NOAA HRRR Archive (CONUS 3 km)** | Predictor meteorológico causal | Exige `issueTime + archiveLatency <= t0` | Dominio público NOAA (verificar URL de ciclo y GRIB SHA-256) | **`DATASET_BLOCKED` (no descargado en local)** |
| **USGS / USFS LANDFIRE 30 m** | Combustibles superficiales EE. UU. | Estático versionado | Aviso/atribución por capa y versión; escala >30 m | **`DATASET_BLOCKED` (no descargado en local)** |
| **Copernicus C3S ERA5** | **SOLO HINDCAST / SENSIBILIDAD RETROSPECTIVA** | Disponible días/meses post-evento: **PROHIBIDO en predicción confirmatoria (`t_avail > t0`)** | CC BY Copernicus / CDS | **BLOQUEADO POR LEAKAGE CAUSAL PARA PREDICCIÓN** |
| **Copernicus EFFIS** | Validación externa europea futura | Dependiente de capa WMS/FWI | CC BY 4.0 contenido UE (verificar terceros) | **`DATASET_BLOCKED` (no descargado en local)** |

**Veredicto externo confirmatorio:** Al faltar en local $\ge 4$ incendios de test externos independientes con meteorología causal archivada (`t_avail <= t0`) y capas de combustible, toda evaluación histórica externa queda declarada **`DATASET_BLOCKED` / `INCONCLUSIVE`** hasta ingestión autorizada con SHA-256.
