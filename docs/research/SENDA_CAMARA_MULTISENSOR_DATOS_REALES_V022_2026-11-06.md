# SENDA v0.22 · Cámara multisensor y datos reales — hoja científica de continuación
**Fecha:** 2026-11-06 · **Base técnica:** SENDA v0.21 PR #17.
**Regla estricta:** ninguna muestra generada, simulada o no medida se incorpora como observación real o se usa para reclamar precisión predictiva. Tests de contrato aislados no son datos de entrenamiento.

## 1. Dónde añade valor genuino
La función diferenciadora propuesta es un **observatorio virtual de carretera y fuego, explicable por fuente**, que analiza múltiples mediciones físicas en el mismo lugar e intervalo, con calibración, licencia y registro de incertidumbre. Una cámara RGB no mide radiación térmica. No se afirma ser el primer sistema en segmentar humo o triangular un incendio: ambos tienen estado del arte previo (IEEE TIE 2024; PyroNear; Fire Dynamic Vision 2025; optical flow 2026).

### Capacidades de imagen candidatas, por orden técnico
| Capacidades | Observación necesaria | Qué inferimos matemáticamente | Estado / bloqueo |
| --- | --- | --- | --- |
| A. Cámara de visibilidad metrológica | RGB antes/después de un **hito oscuro de distancia conocida**, fotometría/exposición estable | extinción óptica β = −ln(C/C0)/d; visibilidad meteorológica orientativa 3.912/β | **Función de cálculo con bloqueo de calibración**, `evidence-multisensor.mjs`; no se ha medido en cámaras de SENDA |
| B. Vector de pluma verificable | Secuencia real de humo etiquetado, cámara calibrada y altitud de pluma | flujo óptico → velocidades aparentes, contraste con viento a distintas alturas | **Investigación pendiente**; movimiento aparente de humo no es velocidad del frente |
| C. Alerta de ceguera de vía | Visibilidad calibrada A + velocidad de detector vial contemporáneo | margen observacional visibilidad−distancia de parada; publicación como investigación | **Función experimental fail-closed**; no emite órdenes de cierre |
| D. Localización en 3D | Dos o más cámaras calibradas, posiciones/ruidos/relojes y DEM | intersección de rayos y elipsoide de incertidumbre; evitar vistas paralelas | `fire-field.mjs` tiene geometría de rayos, pero SIN prueba real de localización |
| E. Detección temprana multifuente | FIgLib/Pyro-SDIS + FRP GOES/MTG y meteo con timestamp de publicación | posterior de presencia de humo/fuego, sin doble contar fuentes correlacionadas | pendiente de evaluación externa con falsos positivos por cámara-día |
| F. Cámara con termografía real | Sensor LWIR/MWIR **radiométrico**, calibración y permiso | temperatura de brillo y corrección de emisividad/transmisión | NO se puede ofrecer con RGB ni con simples imágenes térmicas coloreadas |
| G. Detección de colapso de tráfico | Conteo real de vehículos + detector de velocidad + cierres oficiales | probabilidad de cuello de botella y tiempo de despeje con incertidumbre | 19 vídeos medidos en 2026, sin detector físico de coincidencia geográfica/temporal validada |
| H. Memoria de predicción sin filtraciones | Perímetros oficiales con observación efectiva y meteo emitida anteriormente | validación retrospectiva en orden cronológico, alertas hipotéticas separadas de operativas | estructura creada; no se declaran ventajas temporales en campo |

La fórmula \(V=3.912/β\) asume contraste umbral de 2 % y dispersión relativamente homogénea; no distingue humo, bruma, niebla y polvo sin otras mediciones. La distancia de frenado \(d=v t_r+v^2/(2a)\) es orientativa, no un criterio administrativo de cierre; no incluye todas las condiciones de tráfico y firme.

## 2. Hechos reales disponibles e incorporados en SQLite
De los archivos inmutables existentes en el GitHub (SHA `594bba7`):
- TfL 06-11-2026 ~00:31 UTC: **12 clips reales**, ~125.16 s, **21 cruces** identificados por YOLOX/ByteTrack.
- Caltrans 05-11-2026 ~17:15 PST (06-11 ~01:15 UTC): 13 cámaras catalogadas, **7 clips útiles** (~365.8 s), **128 cruces** computados por detector; **6 sin vídeo útil**, no deben interpretarse como 0 tráfico.
- En total **19 clips reales** y **149 detecciones de cruce**, almacenadas con **57 observaciones de detector** en 25 fichas de sensor (tres métricas por clip). Esos 149 no son un aforo oficial ni independientes del algoritmo; precisan evaluación humana para reclamaciones de precisión.
- Se creó `ingest_recorded_real_cameras.py`: SHA256 del fichero original, coordenadas, intervalo de captura aproximado, fuente inmutable, no imagen identificativa, sin autorización operativa.
- El historial GOES 2018–2025 es real, pero está en otros años: **prohibido unirlo temporalmente a los vídeos de 2026**. `evidence-multisensor.mjs` implementa esta barrera.
- La nueva captura instrumental física de Fintraffic se procesa mediante `fetch_real_digitraffic_tms.py` y `ingest_digitraffic_snapshot.py`: sólo si la API devuelve mediciones oficiales reales y se verifica SHA256, UTC, frescura y valor numérico. El artefacto CI guarda respuesta original, normalizada y SQLite; las claves de estaciones se obtienen del operador. Ausencia o caída = FAIL, no valores 0 ni estimaciones simuladas.
- **NOAA histórico realmente presente en el repositorio:** `goes_casos.json` contiene **13 116 detecciones de píxeles GOES** (7 incendios, 678 fotogramas) y **107 registros horarios HRRR** con cinco valores por registro (**535 datos de pronóstico**). La tarea `ingest_real_goes_hrrr_archive.py` los incorpora a SQLite con SHA256, ID de caso, hora UTC, posición de píxel, fuente física NOAA y etiqueta de calidad. Las máscaras GOES/DQF se perdieron en la compactación v0.20, de modo que **ningún píxel sirve como perímetro verificado ni para certificar la velocidad**. Los HRRR son datos originales de pronóstico, no observaciones meteorológicas de campo; el archivo compacto perdió el instante de emisión, por lo que no puede justificar retrospectivamente qué información estaba disponible a las autoridades.
- Tras ambos procesos sin nueva red, el repositorio proporciona **13 708 filas de evidencias de investigación** (13 116 píxeles GOES + 535 valores de pronóstico HRRR + 57 mediciones derivadas de vídeo), sin datos sintéticos. Son filas de distintas clases de dato y **no deben sumarse como 13 708 mediciones físicas independientes validadas**.
- **Ninguna** de las observaciones citadas se considera prueba operativa de evacuación, velocidad del fuego o temperatura radiométrica. SQLite mantiene por defecto `allow_model_fusion=0`.

## 3. APIs y documentación adicional verificada (sujeto a prueba de servicio)
- NDW tiempo real y cambio de DATEX II 2.3 a **3.6** a partir de 09-02-2027: https://opendata.ndw.nu/ ; historial Dexter con afiliación: https://english.ndw.nu/products-and-services/dexter
- Digitraffic TMS: https://www.digitraffic.fi/en/road-traffic/ ; contrato `/api/tms/v1/stations/{id}/data`. Gzip obligatorio (sin `Accept-Encoding:gzip` devuelve HTTP 406) y cabecera `Digitraffic-User`: https://www.digitraffic.fi/en/support/instructions/
- AEMET OpenData: https://opendata.aemet.es/dist/ (estaciones, rayos, riesgo; requiere API key)
- Meteocat XEMA: https://apidocs.meteocat.gencat.cat/documentacio/dades-de-la-xema/ (mediciones con códigos V y tiempos UTC, suscripción)
- Euskadi: https://opendata.euskadi.eus/catalogo/-/camaras-de-trafico-de-euskadi/ (imágenes y metadatos, catálogo antiguo, condiciones de reutilización)
- MeteoAlarm API: https://api.meteoalarm.org/ (avisos oficiales, token approved re-user; Hub CAP de **emisión** es solo para agencias autorizadas)
- LSA SAF MTG FRP: https://lsa-saf.eumetsat.int/en/data/products/fire-products/mtfrp/ (CC BY 4.0; 1 km, 10 min, aún demonstration, ~45 min de latencia máxima indicada)
- NASA ECOSTRESS L2T 70 m: https://data.nasa.gov/dataset/ecostress-tiled-land-surface-temperature-and-emissivity-instantaneous-l2-global-70-m-v003 (temperatura **de superficie** y emisividad, no termómetro de llama)
- Pyro-SDIS de cámaras reales: https://www.data.gouv.fr/datasets/images-de-departs-de-feux-sdis-2024 (33 636 imágenes según versión pública 2024; tratar apartados/versiones y licencias independientemente)
- HPWREN Fire Ignition Library: https://www.hpwren.ucsd.edu/FIgLib/ (series reales ~2016–2021 de cámaras de montaña, aptas para prueba de latencia y confusores).
- PyroNear 2025: https://www.mdpi.com/2079-9292/15/12/2652 contiene una fracción **sintética**; filtrar a escenas con procedencia documentada REAL para cualquier entrenamiento conforme a la petición del usuario.

## 4. Evidencia de que no son todas ideas inéditas
- *Early Wildfire Detection and Distance Estimation Using Aerial Visible-Infrared Images* (IEEE TIE 2024), DOI 10.1109/TIE.2024.3387089: integración VIS/IR y triangulación con SLAM ya investigadas.
- *Fire Dynamic Vision* (Environmental Modelling & Software 2025), DOI 10.1016/j.envsoft.2024.106286: seguimiento multiescala de fuego y plumas.
- *Modelling the impact of wildfire smoke on driving speed* (IJDRR 2022), DOI 10.1016/j.ijdrr.2022.103211: densidad óptica del humo en modelos de tráfico.
- *Dense Optical Flow Retrieval of Wildfire Smoke Plume Motion* (Remote Sensing 2026), DOI 10.3390/rs18121868: flujo óptico de humo y contraste con HRRR.
**Aportación propuesta SENDA**, no validada ni patentada: integrar todas estas familias de fuentes bajo evidencia temporal verificable, permisos por activo y un único indicador probabilístico de riesgo de ruta junto al enrutamiento de emergencia sin red. La novedad a nivel mundial debe investigarse con búsqueda de patentes y revisión formal del estado de la técnica.

## 5. Condiciones concretas para pasar de investigación a producto
1. Dos cámaras reales del mismo entorno con orientación, campo de visión, exposición, distancia a puntos de referencia y permiso de análisis. Registrar fotogramas de control claros y con humo.
2. Vídeos reales etiquetados por incendio **disjuntos** en validación, incluyendo amaneceres, nubes, niebla, lluvia y humo urbano. Medir PR-AUC, recall a falsa alarma por cámara-día y latencia de la primera detección.
3. Un instrumento de velocidad real contemporáneo al vídeo, en la misma carretera, para calibrar homografía y medir incertidumbre; 10 segundos de un vídeo aislado no constituyen una serie de velocidad estable.
4. Para incendios 2018/2025, usar pronósticos meteorológicos que existían a la hora hipotética de decisión y el registro de latencia real de satélites; no cruzar con datos reanalizados publicados posteriormente como si fueran disponibles entonces.
5. Implementar fronteras de incertidumbre por sensor y separar **sensor apagado**, **señal perdida**, **sin detección** y **confirmado negativo**.
6. El panel inversor deberá mostrar siempre `HECHO_MEDIDO`, `MEDICION_DERIVADA_DE_VIDEO`, `MODELO_NO_VALIDADO`, `FUENTE_DOCUMENTADA`, `CONVENIO_REQUERIDO` o `OPERATIVO_CERTIFICADO` según evidencias; ningún módulo alcanza la última categoría sin ensayos y autorización.

## 6. Próxima entrega verificable
Los jobs de GitHub Actions deben aportar `evidence.sqlite`, `digitraffic_tms_23001.raw.json`, `digitraffic_tms_23001.normalized.json`, salidas de validación, SHA256 y estado con timestamp real. Una API caída no autoriza a rellenar mediciones ficticias. Los datos sensibles de video no se redistribuyen sin permiso.

**No están completados:** captura calibrada de cámara óptica, sensor térmico independiente, reconstrucción de máscaras GOES históricas, prueba de campo, conectores AEMET/Meteocat autenticados ni evaluación de patentabilidad.
