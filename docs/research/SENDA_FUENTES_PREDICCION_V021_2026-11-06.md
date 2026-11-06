# SENDA v0.21 · Auditoría de fuentes, visión y predicción fuego–evacuación
**Fecha:** 2026-11-06 · **Base:** PR #13, commit 594bba7 · **Naturaleza:** continuación científica y técnica, no acreditación operativa.
**Enlace a datos estructurados:** `packages/senda/data/source-registry.v021.json`
**Código de calidad:** `packages/senda/src/observation-quality.mjs` + tests.

## 1. Hallazgos reproducibles en la implementación v0.20
1. `scripts/datos-reales/goes_hrrr_incendio.py` admitía máscaras GOES 10–14 y 30–34. Según NOAA las clases de menor tolerancia a falsos positivos son **10, 11, 30, 31**; 12/32 corresponden a nubes, 13/33 a probabilidad alta y 14/34 a media. La presencia de códigos no equivale a certeza de frente.
2. `packages/senda/scripts/referencias-real.mjs` **perdía el código de máscara** `det[3]` en la copia compacta. Los archivos compactos ya publicados son datos **legacy, sin calidad recuperable**. Esta rama preserva la máscara en nuevas exportaciones y etiqueta los resultados legacy: sin datos crudos no se recalculan ni se certifican retrospectivamente las 8.0 km/h del Camp, ni el posible adelanto de 8.5 h en Eaton.
3. El modelo `goesProgression` calcula el **máximo acumulado de centros de píxeles detectados**, NO la frontera subpíxel del fuego. Un único falso positivo adelantado puede elevar artificialmente el máximo del frente de forma permanente. El sesgo de selección por viento HRRR y el movimiento de nube también requieren control.
4. `packages/senda-vision/camera_flow.py` calculaba km/h usando el largo supuesto de un turismo, sin homografía, longitud conocida, distorsión ni ensayo de error. El “±30 %” carecía de una validación por cámara. Esta rama conserva ese valor solo como **proxy exploratorio**, publica velocidades calibradas = null y prohíbe usarlas en EnKF.
5. `docs/paper/resultados_v020.json` incluye ruido de conteo real de TfL / Caltrans, pero las **observaciones del atasco del gemelo** son simuladas. No existen mediciones de evacuación física que validen los 7–8 minutos de detección en un incendio real.
6. La PR #13 declara 7 tramos de 5 incendios, cobertura fuera de muestra 80 % nominal observada 71 %. **Muestra insuficiente** para atribuir precisión predictiva generalizable; la métrica por tramo tiene dependencia entre tramos del mismo incendio.
7. `fire-field.mjs` implementa una búsqueda de menor tiempo para costes dependientes de la hora, aproximación física que no modela automáticamente pavesas, salto de discontinuidades, extinción, supresión, comportamiento extremo ni todas las incertidumbres. El fuego no puede recibir estatus operativo de esta simulación.
8. `CAMERA_SOURCES` cataloga redes, pero **existencia de catálogo, alcance de la licencia, URL del vídeo, permiso de procesado, señal disponible y validación de métrica son seis hechos distintos**. Caltrans publica datos CCTV de ubicación/estado bajo CC BY; no se ha probado aquí que eso permita redistribuir cada stream HLS.

## 2. Fuentes contrastadas mediante documentación institucional
- **NOAA GOES ABI FHS**: codificación de confianza; GOES-16 fue sustituido por GOES-19 en GOES-East el 07-04-2025. Para casos históricos 2018–2024, GOES-16 corresponde al archivo histórico, no al sistema actual. [GOES NOAA](https://www.ncei.noaa.gov/products/satellite/goes-r), [categorías](https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_16_FDCF).
- **NASA FIRMS VIIRS 375 m**: anomalías térmicas, no perímetros; latencia, horario de pasada, nubosidad, ángulo y controles de calidad. API con MAP_KEY. [FIRMS](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html), [API](https://firms.modaps.eosdis.nasa.gov/api/data_availability).
- **NIFC WFIGS/IRWIN**: perímetros reportados por organismos, no disponibles para cada incidente; distinguir `source_observed_at`, `ingested_at` y `updated_at`. [USGS](https://www.usgs.gov/faqs/where-can-i-find-wildfire-perimeter-data).
- **NOAA HRRR**: pronóstico atmosférico, no medida observada en carretera. Guardar `forecast_issue_utc`, `valid_utc`, miembro/modelo y horizonte; no entrenar el pasado con pronósticos emitidos **después** de la decisión hipotética. [HRRR](https://registry.opendata.aws/noaa-hrrr-pds/).
- **Copernicus EFFIS**: WMS con parámetro TIME, productos por separado (riesgo FWI, focos, daños, perímetros) y licencia específica. [WMS y licencia](https://forest-fire.emergency.copernicus.eu/downloads-instructions). El FWI no predice por sí solo tiempo de llegada.
- **EUMETSAT MTG / MSG / Sentinel-3**: productos FRP/imagen, revisar nivel, estado y condición de uso de cada producto. [Productos incendios](https://user.eumetsat.int/data/themes/emergency/fires).
- **TfL JamCams**: fuente pública de imágenes RGB; el London Datastore histórico documenta 177 vistas en el producto publicado y posibles interrupciones. No interpretar ~900 IDs de cámara de otra fuente como 900 streams licenciados. [TfL/London Datastore](https://data.london.gov.uk/dataset/tfl-live-traffic-cameras-2kmnd/).
- **Caltrans CCTV**: catálogo oficial de posiciones/estado, licencia CC BY del dataset; permisos de frames HLS precisan verificación separada. [Open Data Caltrans](https://publish.data.ca.gov/dataset/closed-circuit-television), [QuickMap FAQ](https://quickmap.dot.ca.gov/faq).
- **PeMS**: detectores de tráfico reales y archivo histórico; cuenta autorizada requerida. Son una fuente externa adecuada para calibrar velocidad/flujo de cámaras. [PeMS](https://dot.ca.gov/programs/traffic-operations/mpr/pems-source).
- **DGT**: DATEX II v3.6 catálogo de ubicaciones, NO licencia automática para vídeo de cámaras. [DGT NAP](https://nap-test.dgt.es/dataset/camaras-dgt-localizaciones-datex2-v3-6).
- **ALERTCalifornia**: red institucional de vigilancia y analítica, candidato relevante a convenio, pero una visualización pública no equivale a permiso de minería masiva. [UCSD](https://alertcalifornia.org/about/).
- **Pyronear Pyro-SDIS**: conjunto RGB etiquetado para humo, no termografía ni medida de temperatura; imprescindible separación train/test por incendio, cámara y ubicación. [Dataset](https://huggingface.co/datasets/pyronear/pyro-sdis).

**Nivel de verificación de estas 12 filas:** documentación pública del publicador consultada, **sin prueba individual de endpoint, disponibilidad actual, derecho de reutilización de cada vídeo o ingesta live desde este entorno**.

## 3. Modelo matemático de evolución propuesto
### 3.1 Observación y calibración
Cada observación normalizada debe ser:
`{source_id, sensor_id, modality, observed_utc, retrieved_utc, geo, geo_sigma_m, value, unit, uncertainty, quality_flag, source_url, content_sha256, rights_version, calibration_id, parent_ids}`.
Rechazar sin excepción horas sin UTC, observaciones futuras, fuentes sin provenance, derechos sin evaluar y valores procedentes de simulación etiquetados como mediciones.

- GOES-FHS: detección por máscara 10/11/30/31 y análisis de sensibilidad adicional con clases 12–15/32–35.
- VIIRS y perímetros: una detección de 375 m no es una verdad puntual y un perímetro oficial puede ser anterior a su fecha de publicación.
- RGB: detectar humo, llama visible, congestión, oclusión y visibilidad, con bandas de confianza calibradas.
- **Térmica radiométrica:** únicamente cuando el sensor publique radiancia / temperatura radiométrica con metadatos. Corregir emisividad, temperatura reflejada, transmisión atmosférica, distancia, humedad y estado de calibración; propagar la incertidumbre. Una “hotspot detection” satelital no equivale a temperatura de llama local. Cámara RGB o IR no radiométrica = **no temperaturizable**.
- Tráfico: transformar píxeles al plano vial con homografía H, `[X,Y,1]∼H[x,y,1]`; después `v=||p(t2)-p(t1)||/Δt` y su intervalo de error. Sin H, el proxy de anchura de un coche no se publica como km/h medidos.

### 3.2 Inferencia espacial-temporal y frente
Separar **probabilidad de anomalía**, **probabilidad de incendio**, **probabilidad de celda quemada a tiempo t** y **velocidad real del frente**. Son variables distintas.
Para cada sensor s: `y_s(t)=h_s(x(t))+ε_s`. Modelo estocástico de propagación:
`x_{t+Δt}=F(x_t, W_t, combustible, pendiente, humedad, intervención)+η_t`.
Usar miembros de conjunto con perturbaciones de viento espacialmente correlacionadas y combustible, sesgos por sensor y mecanismos de ausencia. La celda se marca “observada” solo por su detección verificable; `P(T_i≤t)` es una **predicción** con intervalo, no un hecho.
- Validar con escenarios en orden cronológico y sin información futura; lo que ocurrió después de la predicción no puede usarse como entrada.
- NO comparar un píxel GOES como si fuera el perímetro de incendio. Confrontar con VIIRS y geometrías NIFC/EFFIS a la hora **efectiva**, usando tolerancias espaciales dinámicas.
- Entrenar por incendio, no por fotograma; validación leave-one-incident-out, prueba en región/combustible nuevos y comprobar calibración de intervalos por incidente.

### 3.3 Nueva implementación de frente robusto (investigación)
`packages/senda/src/fire-front-robust.mjs` contiene un estimador alternativo que exige
**máscaras GOES estrictas, al menos 3 píxeles por fotograma y 4 fotogramas, origen y rumbo explícitos**. Proyecta cada píxel sobre el rumbo de avance, calcula el cuantil 0,80 por fotograma y ajusta pendiente robusta de **Theil–Sen** por parejas de observaciones. Devuelve además desviación mediana de pendientes, incertidumbre mínima impuesta por tamaño del píxel, descartes y un `status`. Si el desplazamiento completo no supera 1,5 píxeles, devuelve `speedKmh:null`. Tiene pruebas geométricas y de atípicos sintéticos; **su exactitud sobre incendios reales NO se ha validado**.

Se produce un campo `frenteRobustoExploratorio` en el resultado regenerado **solo cuando existen máscaras crudas**. Si el histórico tiene el código de máscara perdido, devuelve `REQUIRES_MASKED_RAW_GOES` y no simula un nuevo valor científico. Este estimador no reemplaza las cifras anteriores sin validación externa sobre incendios completos.

### 3.4 Acoplamiento a evacuación
Por tramo e: `T_f(e)` = tiempo aleatorio de llegada del fuego, `T_c(e)` = tiempo de despeje de vehículos, `T_s(e)` = llegada de humo peligroso. Definir margen de seguridad aleatorio:
`M_e=min(T_f(e),T_s(e))−T_c(e)−τ_e`. Todos los tiempos usan el mismo origen y ruta; humo o fuego, el que alcance antes, limita el despeje. τ_e es el margen de seguridad.
Proponer **revisión humana prioritaria** cuando `P(M_e<0)` supere un umbral acordado con el organismo. No abrir/cerrar vías ni emitir alertas oficiales automáticamente. El filtro EnKF solo puede asimilar velocidades/capacidades con incertidumbre y calibración documentadas; mantener pruebas ciegas contra PeMS u otro detector independiente.
No es correcto afirmar “SENDA habría avisado 8,5 h antes” como éxito medido. La expresión correcta es **“contrafactual retrospectivo del simulador, condicionado a disponibilidad, latencia y calidad de detecciones históricas; no ha sido probado como alerta en campo”**.

## 4. Requisitos de aceptación para v0.22
1. Regenerar originales con máscaras GOES preservadas, hash por fichero, URL exacta, instante de adquisición, nodo y satélite, estadísticas de descartes; comparar 10/11/30/31 frente a 10–15/30–35.
2. Recalcular Camp/Eaton/Palisades con la nueva entrada. **Invalidar y reetiquetar** cualquier titular de velocidad/adelanto que no sobreviva a la depuración; no reutilizar métricas legacy sin recalcular.
3. Obtener perímetros con hora válida NIFC (US) y EFFIS (EU); completar al menos un caso europeo con observaciones temporales independientes.
4. Identificar por cámara el tipo real: RGB / térmica no radiométrica / radiométrica. Se requiere documentación y permiso, no inferencia desde la imagen.
5. Validar detección de humo con Pyro-SDIS separado por cámara y evento: precision, recall, PR-AUC, tasa de falsas alarmas por cámara-día, robustez ante niebla, nubes y puesta de sol.
6. Para cada cámara de tráfico con convenio: medir homografía, 3 o más velocidades contrastadas por detector/aforo y error relativo observado; en caso contrario, usar solo conteos agregados con duración y error.
7. Validar incertidumbre de incendio con Brier, CRPS, cobertura 50/80/90 %, sesgo espacial, tasa de aviso falso y retraso al detectar; informar por incendio completo, sin agrupar fotogramas dependientes como casos independientes.
8. Registrar vía de permiso, titular, versión de licencia, plazo de conservación, restricciones de exportación y contacto institucional para streams; aplicar el principio de no almacenar frames identificativos.
9. Comparar motores frente a referencia mecánica y nulo, documentar pérdida por cada sensor, testear cortes de red, retraso, fallo del sensor, duplicados, problemas horario UTC y fallos de vídeo.
10. Presentar panel de inversores con indicadores separados: observación real / modelo experimental / validación de campo / autorización institucional. En PR draft hasta evidencias.

## 5. Base de datos relacional reproducible (nueva en esta PR)
Se ha creado `packages/senda/data/build_source_db.py` (Python 3 + SQLite stdlib). Se alimenta exclusivamente de `packages/senda/data/source-registry.v021.json`, sin descargar ni copiar imágenes.
Contiene 7 tablas con claves y restricciones: `sources`, `sensors`, `calibrations`, `observation_batches`, `observations`, `verification_events`, `experiment_runs`. Mantiene versiones de permisos, hora real de observación, hora de importación, SHA-256 de contenido, máscara GOES y clase de origen REAL/PRONÓSTICO/MODELO/SIMULACIÓN. Una ejecución sin nuevos datos solo inserta 12 fichas documentales, **0 mediciones** y **0 permisos de ingesta**.

```bash
python3 packages/senda/data/build_source_db.py --db /tmp/senda-sources.sqlite
python3 -m unittest discover -s packages/senda/data -p 'test_*.py' -v
```

**NO ejecutar SQLite sobre una base externa o un servidor de emergencias sin revisión y autorización.** Para la próxima fase faltan ingestores API oficiales, comprobaciones de endpoint/credenciales, normalización espacial, licencias, calibraciones por cámara y evaluación temporal fuera de muestra. La tabla `verification_events` está vacía, no contiene falsos resultados de uptime.

## 6. Límites de esta continuación
- No se han descargado de nuevo históricos GOES en este entorno ni se han observado streams de cámara en tiempo real.
- No hay aprobación institucional o contrato de acceso nuevo.
- No se ha calculado una nueva cifra de velocidad de incendios: las antiguas están señaladas como **pendientes de reproceso con máscaras**.
- No se ha certificado ningún pronóstico para uso de seguridad pública.

**Conclusión:** el avance técnico comprobable es crear una cadena de evidencias falsable. La prioridad científica no es añadir decenas de URLs, sino convertir cada observación en dato con hora, derecho de uso, clase de sensor, calibración, calidad y conjunto de incertidumbre, y demostrar utilidad fuera de muestra.
