# RoadSafe · Dataset armonizado de accidentes (España, Alemania, Países Bajos; Bélgica preparado)

**Construido:** 2026-11-17/18 · **Registros armonizados (2024):** 496 895 (ES 101 996 · DE 268 519 · NL 126 380), con **0 rechazados**.
**Reproducir:** `node packages/senda/scripts/roadsafe-data/build-dataset.mjs --year 2024`. Necesita `python3` + `openpyxl` para el XLSX de la DGT.
**Informe automático:** [`evidence/roadsafe/dataset/DATASET_REPORT_2024.md`](../../evidence/roadsafe/dataset/DATASET_REPORT_2024.md) · procedencia con SHA-256: `manifest-2024.json`.

## 1. Fuentes oficiales (descargadas y verificadas en esta sesión)

| País | Fuente | Contenido | Ubicación | Licencia | Estado |
|---|---|---|---|---|---|
| ES | [DGT · microdatos de accidentes con víctimas 2024](https://www.dgt.es/menusecundario/dgt-en-cifras/dgt-en-cifras-resultados/dgt-en-cifras-detalle/Ficheros-de-microdatos-de-accidentes-con-victimas-2024/) + diccionario | 1 fila = 1 accidente con víctimas; gravedad a 30 días; tipo, firme, iluminación, niebla, visibilidad restringida | carretera + PK + sentido (sin coordenadas) | aviso legal DGT / datos.gob.es (**condiciones exactas por verificar**) | ✅ |
| DE | [Unfallatlas «Unfallorte» 2024](https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/) + DSB_Unfallatlas.pdf | accidentes con daños personales; Unfallart, Unfalltyp, luz, firme, implicados | WGS84 | Datenlizenz Deutschland – Namensnennung 2.0 | ✅ |
| NL | [Rijkswaterstaat BRON 2024](https://data.overheid.nl/dataset/53580-verkeersongevallen-nederland----ongevallen--rws-) (WFS `ongevallen_2024`, CSV) | todos los registrados, **incluidos solo daños materiales**; aard ongeval, luz, firme, tiempo, circunstancias temporales | RD New → WGS84 (≈1 m) | CC0 | ✅ |
| BE | [Statbel](https://statbel.fgov.be/en/themes/mobility/traffic/road-accidents) | accidentes con víctimas | parcial | open data Statbel (verificar) | ⛔ **captcha anti-bots**: no se elude. Adaptador listo para un fichero descargado a mano; el mapeo de columnas está marcado como NO VERIFICADO |

Los códigos de cada fuente se tradujeron con su **diccionario oficial**, leído en esta sesión:
- DE: UART 1 «colisión con vehículo que arranca, se detiene o está parado», 2 «con el vehículo de delante o que espera», etc.
- ES: TIPO_ACCIDENTE 4 «por alcance», 5 «múltiple o en caravana», etc.
- NL: «Kop/staart», «Geparkeerd voertuig» y `bijz_tijdelijke_aard = "Ander ongeval"`.

## 2. Esquema común `senda-road-accident/1`

`country, source, sourceId, year, month, weekday (ISO), hour, lat, lon, coordQuality (POINT | POINT_RD_APPROX | ROAD_PK | NONE), road, km, direction, roadClass, area, light, surface, weather, fog, collision, severity (FATAL | SERIOUS | SLIGHT | INJURY | PDO | UNKNOWN), fatalities, seriouslyInjured, slightlyInjured, vehicles, involves{…}, speedLimitKmh, visibilityRestrictedByVehicle, secondaryIndicator, intersection, curve`.

**Comparabilidad:** NL incluye accidentes solo con daños materiales y no distingue heridos graves de leves (por eso existe `INJURY`). Para comparar países se filtra siempre a accidentes **con víctimas**.

## 3. Hallazgos (gravedad condicionada: proporciones entre accidentes ocurridos, sin datos de exposición)

| Hallazgo | ES | DE | NL | Lectura |
|---|---|---|---|---|
| Oscuridad vs día (OR de desenlace mortal) | **1,60** [1,44–1,78] | **1,55** [1,42–1,70] | **1,50** [1,24–1,82] | Replicado en 3 países: de noche los accidentes son más graves |
| De noche sin alumbrado vs con alumbrado | **3,42** [2,84–4,11] | — | — | El alumbrado importa mucho |
| Mojado vs seco | 0,88 (n.s.) | 1,02 (n.s.) | 0,95 (n.s.) | La lluvia no cambia la gravedad; actúa sobre la frecuencia (física) |
| Interurbano vs urbano | **4,61** | — | **3,82** | La velocidad de la vía domina la gravedad |
| Curva vs recta | **1,24** | — | **1,46** | |
| Alcance o vehículo detenido vs otros tipos | 0,44 | 0,36 | 0,49 | En promedio son menos mortales; son **frecuentes** (11–17 % de los accidentes con víctimas) |
| Alcances (% de accidentes con víctimas) | 16,9 % | 16,0 % | 11,1 % | |
| Colisión con vehículo que arranca, se detiene o está parado | — | **5,5 %** (14 673) | 1,7 % (vehículo aparcado) | El tipo del caso de investigación está identificado en los datos alemanes |
| Accidente causado por **otro accidente** (secundario declarado) | — | — | **184** | Primera señal directa de accidente secundario en datos oficiales; probable infraregistro |
| Visibilidad tapada por otro vehículo | 1,1 % (1 130) | — | — | |

Los puntos negros se calculan con Bayes empírico (Poisson–Gamma), que contrae el conteo bruto hacia la media para corregir la regresión a la media:
- **España:** tramos de 1 km de carretera interurbana (p. ej. C-58, B-20, AP-7 PK 146, A-2 PK 606).
- **Alemania y Países Bajos:** rejilla de 0,01°, dominada por ciudades porque los datos alemanes no traen clase de vía.

## 4. Cómo alimenta a los algoritmos

| Algoritmo | Uso del dataset |
|---|---|
| `roadsafe-risk-factors` | Nuevo factor `DARK_SEVERITY` (×1,55; ×2 sin alumbrado) con evidencia de grado A. La lluvia queda solo en la física. |
| `roadsafe-routes.compareRoutesByRisk` | Puntos negros con Bayes empírico a lo largo de cada alternativa (riesgo por km). |
| `roadsafe-dataset-analysis.similarCases` | Casos históricos parecidos (circunstancias + cercanía) para estudio o apoyo pericial. |
| Calibración pendiente | Los multiplicadores de frecuencia necesitan exposición (aforos DATEX II/NAP): siguiente paso. |

## 5. Límites

- Sin exposición (veh-km), no se puede decir «de noche hay más accidentes», solo «los que hay son más graves».
- Los datos españoles no tienen coordenadas; los puntos negros son por carretera y PK.
- Los secundarios están muy infraregistrados: solo los Países Bajos tienen un campo explícito.
- Bélgica está bloqueada por el captcha y la licencia exacta de la DGT queda por confirmar.
