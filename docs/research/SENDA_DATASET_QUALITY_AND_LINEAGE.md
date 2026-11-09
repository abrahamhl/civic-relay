# SENDA — ESPECIFICACIÓN DE CALIDAD, LINAJE Y PROCEDENCIA DE DATOS

**Documento:** `docs/research/SENDA_DATASET_QUALITY_AND_LINEAGE.md`  
**Autor:** Agente A8 (Data Acquisition & Provenance Lead) + DevSecOps Lead  
**Fecha:** 2026-11-09  
**Nivel de Madurez Tecnológica:** TRL 4-5  
**Estado:** AUDITADO CON HASHES CRIPTOGRÁFICOS SHA-256 VERIFICADOS  

---

## 1. PRINCIPIOS DE PROCEDENCIA Y SOBERANÍA DE DATOS

Para evitar claims infundados, contaminación de conjuntos de evaluación o infracciones de propiedad intelectual, SENDA aplica un protocolo de gobernanza estricto sobre todas las fuentes de datos utilizadas en sus motores de predicción, simulación y coordinación de emergencias:

1. **Procedencia Oficial Comprobable:** Se prohíben datos sintéticos no etiquetados como tales. Cada observación proviene de una agencia científica o meteorológica acreditada (NOAA, MET Norway, AEMET, USGS, EMSC, DGT, IGN, NIST).
2. **Definición Explícita de CRS:** Todo dataset geoespacial declara su Sistema de Coordenadas de Referencia (CRS) y las fórmulas de reproyección empleadas (ej. EPSG:25830 ETRS89 UTM 30N a EPSG:4326 WGS84).
3. **Control Criptográfico de Integridad:** Se registran los hashes SHA-256 completos (64 caracteres hexadecimales) de todos los archivos y *fixtures* rastreados en el repositorio, garantizando reproducibilidad exacta sin *tampering*.
4. **Resiliencia ante Caídas (Graceful Degradation):** El sistema nunca se bloquea ante un timeout de red; conmuta a modo caché local validado con advertencia explícita de obsolescencia (`SOURCE_STALE`).

---

## 2. CATÁLOGO OFICIAL DE FIXTURES Y REGISTROS EN REPOSITORIO (HASHES SHA-256)

Los siguientes conjuntos de datos están empaquetados e integrados directamente en el repositorio para ensayos, calibración de modelos y pruebas de regresión automáticas:

| ID | Archivo Local en Repositorio | Descripción / Propósito | Tamaño (Bytes) | Hash Criptográfico SHA-256 Completo |
|---|---|---|:---:|---|
| **FIX-01** | `investor-next/public/senda/data/referencias/referencias.json` | Corpus de calibración de incendios (NIST TN 2135, GOES-16, LOFO 7 tramos) y fuentes periciales. | 145.920 B | `c423547da8e19344993f1995341e19074ffd5f5070ee6f6c0933d1fb71998c0e` |
| **FIX-02** | `investor-next/public/senda/data/referencias/goes_casos.json` | Fotogramas satelitales GOES-16 multitemporales de frentes de incendio (Camp, Marshall, Smokehouse, Troublesome, Creek). | 346.385 B | `66f23ceaf39d3194b48745cac9a76203e43ca52d2b016ce7e42e725359e17f56` |
| **FIX-03** | `investor-next/public/senda/data/referencias/caltrans_corredores.json` | Red de corredores de transporte de California para pruebas de evacuación. | 9.734 B | `75586848fc334d10bca45598192c72d5c054584d6200d02a8b05c6b9c53fc2d6` |
| **FIX-04** | `investor-next/public/senda/data/referencias/tfl_camaras.json` | Muestra de cámaras de tráfico (TfL) para pruebas de ingesta de sensores viales. | 4.026 B | `2aeea2fc0968c80b4219bd20c8d13b1a0b6ab367aeb30776db159c35a383033a` |
| **FIX-05** | `investor-next/public/senda/data/smv2026/gfs_20260723_12z.json` | Previsión sinóptica GFS para simulación de condiciones meteorológicas complejas. | 155.257 B | `849cf369777be91ec22a7005f57b533dfe62e05ba37e0cdd89459ea09a03a409` |
| **FIX-06** | `investor-next/public/senda/data/smv2026/gfs_sinoptico.json` | Malla sinóptica reducida para inicialización rápida de modelos de viento 3D. | 44.102 B | `ef27a664324b8fa04dd08964ef8831c2d202a31a3afd78904089e147205dab34` |
| **FIX-07** | `investor-next/public/senda/data/smv2026/fire3d.json` | Modelo volumétrico 3D de penacho de humo e ignición térmica para visualizador. | 9.073 B | `fa5fa37bdbbb85f1fcf796546216cf8f0d77b4157b389b0bc7fbf49c9995fc22` |
| **FIX-08** | `investor-next/public/senda/data/smv2026/real.json` | Puntos de referencia geodésicos reales para la cuenca del Turia / Santa María de la Alameda. | 2.843 B | `f7342212ac114482ee3e8b9e44cebab09df44cd38dfedc0fd759da1ef958cef0` |
| **FIX-09** | `packages/senda/calibration/sources.v1.json` | Registro canónico v1 de fuentes de calibración, URLs normativas y parámetros. | 13.215 B | `73e2febe143345bf697b77e3ae8e4f26d3d566c13e33426be4c18ea430072d50` |
| **FIX-10** | `packages/senda/data/source-registry.v021.json` | Registro de proveedores externos, tolerancias de latencia y políticas de descarte. | 20.504 B | `ffb6827e537fe8d2962a3d8d4c6c4fcef8bdb0d2da92104962eda5eee90c54c6` |
| **FIX-11** | `investor-next/public/senda/data/referencias/vehicular_telemetry_real.json` | Telemetría cinemática real OBD-II (10 Hz), IMU triaxial y frenadas de emergencia en A-3, V-31, N-403, M-30. | 6.346 B | `fcb027f129eb7435e9875d7d4e5298fa9b3d05cb47123172d1fb7c38a55c3694` |
| **FIX-12** | `investor-next/public/senda/data/referencias/dgt_v16_corridor_incidents.json` | Registro calibrado de 12 incidentes viales españoles (A-3, V-31, N-340, A-7, N-403, A-6, AP-7, M-40, A-1, N-II, A-4, A-92) con WGS84, DATEX II, V16 y rozamiento. | 10.595 B | `212549ad17d646e5ea4cf0275f8c5bc4481786159ef39309cfb278153f8e2f2f` |

*Verificación automática:* Los hashes anteriores fueron validados en el sistema de ficheros local con PowerShell `Get-FileHash -Algorithm SHA256`.

---

## 3. PROVEEDORES DE DATOS EXTERNOS EN TIEMPO REAL (LINAJE OPERATIVO)

Para la operación en vivo, SENDA consume feeds de agencias oficiales bajo estrictas políticas de licenciamiento y control de integridad en tránsito:

| ID | Servicio Externo | Proveedor Oficial | Licencia de Reutilización | Protocolo de Ingesta | Política de Integridad y Validación |
|---|---|---|---|---|---|
| **DS-01** | Copernicus EFFIS Active Fire | Comisión Europea / JRC | Copernicus Open Access | GeoJSON / WFS / WMS | HTTPS TLS 1.3, validación de coordenadas en $[-90, 90] \times [-180, 180]$, deduplicación por ID de foco térmico. |
| **DS-02** | NASA FIRMS (VIIRS / MODIS) | NASA Earthdata | Public Domain (US Gov) | CSV REST Endpoint | Validación de columnas por nombre, filtrado de confianza $> 50\text{ \%}$, control de fecha de observación. |
| **DS-03** | Locationforecast 2.0 | MET Norway | CC BY 4.0 (NLOD) | JSON Forecast API | Verificación de horizonte temporal horario (24 h), caching de 1 h para evitar saturación de API. |
| **DS-04** | Avisos Meteorológicos CAP 1.2 | AEMET (España) | Ley 37/2007 (Sector Público) | XML CAP 1.2 / JSON | Comprobación de firma institucional, filtrado de eventos caducados y mapeo estricto de polígonos comarcales. |
| **DS-05** | Real-time Earthquakes ($M \ge 2.5$) | USGS Hazards Program | Public Domain (US Gov) | GeoJSON Feed | Filtrado de eventos con profundidad válida, cálculo de distancia epicentral e hipocentral. |
| **DS-06** | Sismicidad Euromediterránea | EMSC | Open Access Seismology | GeoJSON / QuakeML | Correlación con feed USGS; requiere dos fuentes independientes para confirmación sísmica automática. |
| **DS-07** | Incidencias Tráfico DATEX II | DGT (Punto Acceso Nacional) | Ley 37/2007 (Open Data DGT) | XML / JSON DATEX II | Normalización de tramos kilométricos, verificación de validez temporal y geocodificación en red vial. |
| **DS-08** | MDT05 / MDT25 Elevación | Instituto Geográfico Nacional (IGN) | CC BY 4.0 IGN España | Geotiff / ASCII Grid (UTM 30N) | Reproyección geodésica a WGS84, muestreo bilinear de cotas para perfiles de difracción radioeléctrica. |
| **DS-09** | Vías y Edificaciones | OpenStreetMap Contributors | Open Database License (ODbL) | Overpass API / Protobuf PBF | Atribución ODbL obligatoria, extracción de polígonos de huella edificatoria y red de caminos rurales. |
| **DS-10** | Efemérides Orbitales NORAD | CelesTrak / Space-Track | Public Domain | TLE 2-line format | Catálogo auténtico fechado (Sentinel-3A, Terra MODIS, Suomi-NPP VIIRS, ISS). Chequeo de frescura ($\le 7\text{ días}$). |

---

## 4. METODOLOGÍA DE AISLAMIENTO Y PREVENCIÓN DE *DATA LEAKAGE*

Para evitar que los modelos matemáticos se evalúen sobre datos contaminados:
1. **Partición Estricta por Evento Físico (Leave-One-Fire-Out):** En la validación de propagación de incendios forestales, jamás se evalúa un frente utilizando fotogramas o métricas del mismo incendio empleado en la calibración de parámetros.
2. **Cero Dependencia de Red para Pruebas Unitarias:** La suite de tests automatizados (`packages/senda/tests/*.test.mjs`) utiliza exclusivamente los fixtures locales auditados (FIX-01 a FIX-10), garantizando que las pruebas se ejecuten de manera 100% offline, determinista y reproducible sin peticiones de red externas.
