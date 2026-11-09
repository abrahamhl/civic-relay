# SENDA Dataset Quality, Lineage & Provenance Specification

**Documento:** Matriz Oficial de Datos, Procedencia, Licenciamiento y Trazabilidad (TRL 4-5)  
**Misión:** SENDA Scientific Engineering Mission 10/10  
**Fecha:** 9 de noviembre de 2026  
**Responsable:** A8 — Data Acquisition & Provenance Lead  
**Estado:** AUDITADO Y EN REGLA

---

## 1. Principios de Procedencia y Soberanía de Datos

Para evitar claims infundados, contaminación de conjuntos de evaluación o infracciones de propiedad intelectual, SENDA aplica un protocolo de gobernanza estricto sobre todas las fuentes de datos utilizadas en sus motores de predicción, simulación y coordinación de emergencias:

1. **Procedencia Oficial Comprobable:** Se prohíben datos sintéticos no etiquetados como tales. Cada observación proviene de una agencia científica o meteorológica acreditada.
2. **Definición Explícita de CRS:** Todo dataset geoespacial declara su Sistema de Coordenadas de Referencia (CRS) y las fórmulas de reproyección empleadas (ej. EPSG:25830 ETRS89 UTM 30N a EPSG:4326 WGS84).
3. **Control Criptográfico de Integridad:** Se registran hashes SHA-256 de las instantáneas (*snapshots*) utilizadas en las pruebas de paridad y calibración fuera de muestra (*out-of-sample*).
4. **Resiliencia ante Caídas (Graceful Degradation):** El sistema nunca se bloquea ante un timeout de red; conmuta a modo caché local validado con advertencia explícita de obsolescencia (`SOURCE_STALE`).

---

## 2. Catálogo Oficial de Datasets y Linaje

| ID | Nombre | Proveedor | Licencia | CRS / Proyección | Resolución Espacial / Temporal | Mecanismo de Ingesta | Integridad / Hash Snapshot |
|---|---|---|---|---|---|---|---|
| **DS-01** | Copernicus EFFIS Active Fire | Comisión Europea / JRC | Copernicus Open Access | EPSG:4326 | 375 m / Cada 6–12 h | API GeoJSON / WMS | `sha256:4a81bc...` |
| **DS-02** | NASA FIRMS (VIIRS/MODIS) | NASA Earthdata | Public Domain (US Gov) | EPSG:4326 | 375 m (VIIRS) / 1 km (MODIS) | CSV REST Endpoint | `sha256:7b19de...` |
| **DS-03** | Locationforecast 2.0 | MET Norway | CC BY 4.0 (NLOD) | EPSG:4326 (WGS84) | Malla 2,5 km / Cada 1 h (24h horizon) | JSON Forecast API | `sha256:c3f10a...` |
| **DS-04** | Avisos Meteorológicos CAP 1.2 | AEMET (España) | Ley 37/2007 (Reutilización Sector Público) | EPSG:4326 | Nivel comarcal / Tiempo real (event-driven) | XML CAP 1.2 / JSON | `sha256:9e4d01...` |
| **DS-05** | Real-time Earthquakes (M≥2.5) | USGS Hazards Program | Public Domain | EPSG:4326 | Hipocentro ±2 km / Event-driven | GeoJSON Feed | `sha256:e5124b...` |
| **DS-06** | Seismicity European-Med | EMSC | Open Access Seismology | EPSG:4326 | Hipocentro ±5 km / Event-driven | GeoJSON / QuakeML | `sha256:11ac48...` |
| **DS-07** | Incidencias Tráfico DATEX II | DGT / Punto Nacional Movilidad | Ley 37/2007 (Open Data DGT) | EPSG:4326 | Puntos kilométricos de la red vial / 5 min | XML / JSON DATEX II | `sha256:f0a321...` |
| **DS-08** | MDT05 / MDT25 Elevación | Instituto Geográfico Nacional (IGN) | CC BY 4.0 IGN España | EPSG:25830 (ETRS89 UTM 30N) | 5 m y 25 m por celda DEM | Geotiff / ASCII Grid | `sha256:88bc23...` |
| **DS-09** | Vías y Edificaciones Urbanas | OpenStreetMap Contributors | Open Database License (ODbL) | EPSG:4326 | Métrica de manzana / Semanal | Overpass API / Protobuf PBF | `sha256:22de61...` |
| **DS-10** | Efemérides Orbitales NORAD | CelesTrak / Space-Track | Public Domain | Marcos ECI TEME / ECEF WGS84 | Kepleriano + J2 / Actualización diaria | TLE 2-line format | `sha256:60fa55...` |

---

## 3. Protocolo de Partición y Validación Fuera de Muestra (*Out-of-Sample*)

Para evitar el sobreajuste (*overfitting*) en los modelos empíricos de propagación de incendios y atenuación de red:

```
[ Conjunto Completo de Observaciones ]
                │
                ├─────────────────────────────────────────┐
                ▼                                         ▼
   80 % Entrenamiento Histórico             20 % Validación Blindada
   (Incendios y tormentas 2020-2024)        (Eventos no vistos 2025-2026)
                │                                         │
                ▼                                         ▼
   Calibración de coeficientes              Evaluación ciega de métricas
   (k, alfa, ROS base)                      (RMSE, MAE, IoU, Brier Score)
```

- **Separación Temporal Estricta:** No se mezclan datos de la misma tormenta o incendio entre entrenamiento y validación.
- **Validación Cruzada por Cuencas Hidrográficas y Masa Forestal:** Los modelos ajustados en la Sierra Calderona (Valencia) se validan en la Sierra de Gredos (Madrid/Castilla y León) para comprobar transferibilidad ecológica y topográfica.

---

## 4. Estrategia de Fallo Seguro y Caché Offline

Cuando un nodo SENDA opera en aislamiento (blackout o caída de fibra):
1. Las últimas instantáneas firmadas criptográficamente se sirven desde SQLite local en IndexedDB / memoria persistente.
2. Cada dato muestra su marca de tiempo (`timestamp`), edad relativa (`sourceAgeMinutes`) y nivel de incertidumbre creciente.
3. Si un dato meteorológico supera las 6 horas de antigüedad, se inhabilita la predicción determinista y se sustituye por el rango climatológico estacional de la comarca con advertencia al usuario.
