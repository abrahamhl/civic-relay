# Incendios de referencia y cruce de coches, cámaras de tráfico y fuego (06-11-2026)

> **Firma:** Asistente de Orquestación Senior (Claude), v0.20.
> **Estructura:** entrada → procesamiento → validación → salida.
> **Reglas:**
> - Cada dato lleva su fuente; lo no comprobado va marcado **«pendiente de verificar»**.
> - Los datos de entrenamiento salen solo de mediciones (satélite y modelo meteorológico), nunca de prensa.
> - SENDA es un **canal secundario**: propone, el 112 y la autoridad de tráfico deciden.

## 1. Entrada

El fundador pidió:
- contrastar con otros incendios y otras investigaciones;
- entrenar una base de referencia propia con datos reales, no sintéticos;
- buscar más cámaras abiertas, también en el catálogo de *God's Eye View*;
- sobre todo, **cruzar coches y cámaras de tráfico** con el fuego.

## 2. Datos reales usados en v0.20

| Dato | Fuente y licencia | Cómo se obtiene |
|---|---|---|
| Detecciones de fuego cada 5–10 min | NOAA GOES-16/18 ABI L2 FDC, AWS Open Data, dominio público ([registro](https://registry.opendata.aws/noaa-goes/)) | `scripts/datos-reales/goes_hrrr_incendio.py` |
| Viento a 10 m, racha, T y HR | NOAA HRRR 3 km, AWS Open Data, dominio público ([registro](https://registry.opendata.aws/noaa-hrrr-pds/)) | El mismo script, con rangos de bytes del `.idx` |
| Cámaras de Londres | TfL JamCams: bucket público y catálogo `api.tfl.gov.uk` (890 cámaras). «Powered by TfL Open Data» | Clips de ≈ 10 s; YOLOX + ByteTrack |
| Cámaras en los corredores de evacuación de Camp, Palisades y Eaton | Caltrans CCTV: catálogos D3 y D7 en `cwwp2.dot.ca.gov` y vídeo HLS en `wzmedia.dot.ca.gov`. Condiciones de reutilización **pendientes de verificar** | `packages/senda-vision/camera_flow.py` |
| Cicatriz del caso español | Sentinel-2 y Copernicus DEM (v0.19) | Contraste fuera de muestra |

Para alcanzar los catálogos oficiales de cámaras se creó el entorno de sesión `civic-relay`. Solo permite 13 hosts: Caltrans, WSDOT, DelDOT, NSW, Digitraffic, TfL, Generalitat y DGT. Su aprobación quedó registrada en esta sesión.

## 3. Incendios de la base (14)

| Incendio | Por qué está | Uso |
|---|---|---|
| Camp 2018 | 85 muertos. Cronología de NIST: [TN 2135](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2135.pdf) y [suplemento TN 2252](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2252sup.pdf). Atasco desde Chico; a las 08:30, fuego sobre el tráfico de Pentz y Skyway alta | GOES + HRRR; tráfico en Skyway |
| Palisades 2025 | Coches abandonados en Palisades Dr | GOES; gemelo de bloqueo |
| Eaton 2025 | Orden a Altadena oeste después de las 03:00 ([Fire Engineering](https://www.fireengineering.com/firefighting/wildland-firefighting/report-eaton-fire-marched-toward-west-altadena-hours-before-official-accounts)) | GOES; umbral de aviso |
| Marshall 2021 | 1.084 viviendas ([Colorado Newsline](https://coloradonewsline.com/briefs/1084-homes-louisville-superior-destroyed-marshall-fire-updated-tally/)); pasto con rachas de 100–115 mph | GOES (pasto) |
| Smokehouse Creek 2024 | 1.058.482 acres; GOES-18 vio el foco antes del aviso oficial ([resumen](https://en.wikipedia.org/wiki/Smokehouse_Creek_Fire)) | GOES (pasto) |
| East Troublesome 2020 · Creek 2020 | Carreras de conífera; cifras **pendientes de verificar** | GOES |
| Pedrógão 2017 · Mati 2018 · Lahaina 2023 · Kilmore East 2009 · Sierra de la Culebra 2022 | Lecciones de evacuación y pavesas; sin datos horarios abiertos accesibles | Lecciones, no entrenamiento |
| Kincade 2019 | Capacidad ≈ 5 % menor y ≈ 3,5 km/h más lento en evacuación, citado en una revisión de [Fire Technology (2025)](https://link.springer.com/article/10.1007/s10694-025-01813-y); **pendiente de verificar** en el original | Prior de tráfico |
| SMV 2026 | Caso propio (v0.19) | Contraste fuera de muestra |

## 4. Procesamiento

- **Progresión.** Píxel GOES más avanzado a sotavento del viento HRRR, acumulado.
- **Tramos.** Ajuste por trozos con BIC. Un tramo «resuelto» avanza más de un píxel.
- **Entrenamiento.** Validación dejando fuera un incendio entero. Comparación con la regla del 10 % de [Cruz y Alexander (2019)](https://doi.org/10.1007/s13595-019-0829-8).
- **Tráfico.** Modelo de celdas de Daganzo (1994) con humo, salidas de Rayleigh, cierres y último aviso seguro.
- **Filtro de Kalman.** Por conjuntos (Evensen, 2003); estima la capacidad oculta de los cuellos de botella.
- **Umbral dinámico.** Cova et al. (2005), Larsen et al. (2011) y Li, Cova y Dennison (2019).
- **Humo en carretera.** Intini et al. (2022) ([IJDRR](https://iris.unisalento.it/handle/11587/488606)) y la evacuación de Lahaina como ley de conservación escalar ([arXiv 2603.29055](https://arxiv.org/html/2603.29055v1)) respaldan la elección.

## 5. Validación (resultados reproducibles)

`node packages/senda/scripts/referencias-real.mjs` genera `docs/paper/resultados_v020.json`.
- **Camp.** El satélite mide **≈ 8,0 km/h** en los primeros 90 min. NIST da ≈ 7,5 km/h (7 millas en 90 min), en una presentación **pendiente de verificar** en la TN 2135.
- **Pentz Rd.** Fuego a ≤ 3 km a las **08:17** y a ≤ 2 km a las **08:37**. NIST: 08:30.
- **Eaton.**
  - El fuego queda a ≤ 3 km de Altadena oeste a las **20:51**.
  - El umbral dinámico de SENDA dispara a las **18:31**, con la primera detección.
  - La orden llegó después de las 03:00, así que el adelanto posible es de **8,5 h**; con un umbral fijo de 3 km, 6,1 h.
- **Entrenamiento.** Con 7 tramos resueltos de 5 incendios, la regla publicada gana en error puntual (4,1 km/h). Lo aprendido es su sesgo (×1,43) y su dispersión (σ = 0,88 en logaritmo). La cobertura del intervalo del 80 % es del 71 % fuera de muestra, y la del 90 %, del 100 %.
- **Filtro de Kalman (gemelos simulados).**
  - Atasco en Chico: detectado en 7 min y cuantificado (0,30) en ≈ 15 min.
  - Bloqueo en Palisades Dr: localizado en 8 min.

## 6. Cámaras: lo que se usa y lo que no

- El registro `CAMERA_SOURCES` (`packages/senda/src/cameras.mjs`) pasa de 10 a **32 fuentes**: 23 PASIVO, 5 CONVENIO y 4 NUNCA. Toma las fuentes oficiales y licencias que documenta *God's Eye View* ([repositorio, MIT](https://github.com/bilawalsidhu/gods-eye-view)).
  - **CONVENIO:** NYC DOT exige acuerdo de datos, FL511 solo permite uso personal y Houston TranStar no da licencia.
- **NUNCA:**
  - cámaras privadas sin contraseña;
  - agregadores de datos personales (bots tipo «Ojo de Dios», que no son *God's Eye View*);
  - lectura de matrículas (ALPR);
  - reconocimiento de caras.

## 7. Salida y siguientes pasos

1. VIIRS 375 m y perímetros oficiales por hora para resolver frentes lentos (Palisades, Eaton).
2. Casos europeos con datos horarios: EFFIS/MTG-FCI cuando la red lo permita.
3. Homografía por cámara con marcas viales para velocidades sin el ±30 %.
4. Ensayo de campo con una autoridad de tráfico: DGT 3.0 o una región de seguridad neerlandesa.

**Confianza: 80 %.** Los datos de satélite, modelo y cámaras son reales y reproducibles. Las cifras de prensa están marcadas, y el tráfico de evacuación es un modelo con supuestos explícitos.
