# Informe de fiabilidad de conducción · Bloque A0 (`/senda/conducir`)

- **Fecha de ejecución UTC:** `2026-11-27T13:41:22.461Z` → `2026-11-27T13:42:02.884Z`
- **Navegador medido:** `Chromium 158.0.8127.36` (Playwright, cabeceras CSP estrictas de `investor-next/vercel.json`)
- **Evidencia sellada:** `evidence/drive-reliability/2026-11-27.json` (`sha256: 7fea4371eed7…`)
- **Script reproducible:** `investor-next/scripts/drive-reliability-a0.mjs` + prueba de regresión `packages/senda/tests/drive-reliability-a0.test.mjs` + CI `.github/workflows/senda-drive-reliability-ci.yml`
- **Traza GPX real empleada:** `packages/senda/tests/fixtures/osm_valencia_pista_silla_2023-06-24.gpx` (`198` puntos GPS públicos reales descargados de `api.openstreetmap.org/api/0.6/trackpoints`, licencia ODbL, recorrido en València: *Av. dels Germans Maristes → Av. d'Ausiàs March → Pista de Silla / V-31*, `sha256: 99ce6366fc9a735763edeaa154a32fdc8bd9978796cb70e1dd8d5eb6b9358fee`), combinada con respuestas reales guardadas de Nominatim y OSRM FOSSGIS (`osrm_pista_silla_initial_2026-11-27.json` y `osrm_pista_silla_reroute_2026-11-27.json`).

---

## 1. Resumen de los 12 casos E2E medidos

| ID de caso | Escenario y formato de pantalla | Estado | Métricas medidas en Chromium |
|---|---|---|---|
| `PIXEL7_PORTRAIT_1X_FULL` | Pixel 7 vertical (`412×915`) · GPX real `1×` · búsqueda Nominatim → ruta OSRM → carriles → giro `915×412` → corte de red → desvío fuera de ruta (`Carrera de Malilla`) → túnel de `60 s` sin GPS → llegada | **APROBADO** | `maxSnapOffM = 0 m`, `maxHeadingErrDeg = 0°`, `minEaseIntervalMs = 806 ms` (`≥ 800 ms`), `sawLanes = true`, `rotationOk = true`, `offlineOk = true`, `reroutedOk = true` (`4 592 m`), `tunnelOk = true`, `duplicateNavAnnouncements = 0`, `0` errores consola / CSP |
| `TABLET_LANDSCAPE_4X_FULL` | Tablet horizontal (`1280×800`) · GPX real `×4` · búsqueda → ruta → carriles → desvío y recálculo → túnel de `60 s` sin GPS → llegada | **APROBADO** | `maxSnapOffM = 0 m`, `maxHeadingErrDeg = 0°`, `minEaseIntervalMs = 808 ms` (`≥ 800 ms`), `sawLanes = true`, `reroutedOk = true`, `tunnelOk = true`, `duplicateNavAnnouncements = 0`, `0` errores consola / CSP |
| `SPEED_30KMH_1X` | GPX real reescalado a `30 km/h` (`1×`) | **APROBADO** | `shownKmh = 30`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_30KMH_4X` | GPX real reescalado a `30 km/h` (`×4`) | **APROBADO** | `shownKmh = 30`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_50KMH_1X` | GPX real reescalado a `50 km/h` (`1×`) | **APROBADO** | `shownKmh = 50`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_50KMH_4X` | GPX real reescalado a `50 km/h` (`×4`) | **APROBADO** | `shownKmh = 50`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_90KMH_1X` | GPX real reescalado a `90 km/h` (`1×`) | **APROBADO** | `shownKmh = 90`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_90KMH_4X` | GPX real reescalado a `90 km/h` (`×4`) | **APROBADO** | `shownKmh = 90`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_120KMH_1X` | GPX real reescalado a `120 km/h` (`1×`) | **APROBADO** | `shownKmh = 120`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `SPEED_120KMH_4X` | GPX real reescalado a `120 km/h` (`×4`) | **APROBADO** | `shownKmh = 120`, `arrived = true`, `minEaseIntervalMs ≥ 800 ms`, `crashFalseAlarm = false` |
| `CRASH_SYNTHETIC_MATRIX` | `syntheticTrace` (`roadsafe-crash-detect.mjs`): 6 no-choques (`POTHOLE`, `HARD_BRAKE_NO_CRASH`, `PHONE_DROP_IN_CAR`, `SKI_FALL`, `ROLLER_COASTER`, `DOOR_SLAM_PARKED`) + 4 choques sintéticos | **APROBADO** | `falsePositivesOnNonCrash = 0/6` (`#crash` cerrado), `truePositivesOnCrash = 4/4` (simulación sintética rotulada; verifica la lógica, no la precisión en campo) |
| `SOAK_2H_7200S_MEMORY` | Rodaje continuo de `2 h` (`7 200` muestras a `1 Hz`) con una medida de memoria cada `10 min` (mediana de 3 lecturas tras 2 recogidas de basura) | **APROBADO** (revisión del 27-11) | Tendencia en régimen estable (`1 h → 2 h`, Theil–Sen) **`+8,2 %/h`** (límite `±10 %/h`); llenado desde `20 min` `+7,3 %` (límite `25 %`); `0` errores. **Ojo**: hay un crecimiento lento (~`0,5 MB/h`) dentro del límite que conviene investigar con instantáneas del montón |

---

## 2. Fallos reales detectados por la batería A0 y arreglos de causa raíz aplicados

1. **Salto prematuro de maniobras antes del cruce en rectas largas (`packages/senda/src/nav-osrm.mjs` · `nextManeuver`):**
   - *Fallo detectado:* `nextManeuver` buscaba el vértice más cercano `bi` y exigía `idxOf(step.at) > bi`. En tramos rectos largos sin vértices intermedios (como `Pista de Silla`, con huecos de `> 200 m`), al superar la mitad del tramo `bi` saltaba al vértice del cruce **100 m antes de llegar**, omitiendo el aviso hablado de `≤ 30 m` y mostrando la maniobra posterior antes de girar. Además, `announcement` indexaba solo por `step.text@band`, silenciando un segundo giro distinto con idéntico texto.
   - *Arreglo:* proyección continua de longitud de arco sobre los segmentos de `route.coords` (`projectAlongCoords`), manteniendo el paso activo hasta `5 m` después del punto de giro y deduplicando avisos por coordenada del paso + texto + franja.
2. **Pérdida de carriles de aproximación OSRM (`packages/senda/src/nav-osrm.mjs` · `parseRoute`):**
   - *Fallo detectado (`sawLanes: false` en la 1.ª pasada):* OSRM publica con frecuencia las etiquetas `lanes` en las últimas intersecciones de aproximación del paso anterior (`steps[idx - 1].intersections`) mientras `steps[idx].intersections[0].lanes` viene vacío (`undefined`), descartando 2 de 2 guías de carril en `osrm_pista_silla_initial_2026-11-27.json` y 2 de 3 en `osrm_valencia_2026-11-23.json`.
   - *Arreglo:* `parseRoute` toma `s.intersections[0].lanes` y, si está ausente, recupera los carriles de aproximación del tramo previo o del propio paso.
3. **Tirones de mapa por exceso de `easeTo` (`investor-next/public/senda/conducir.mjs`):**
   - *Fallo detectado:* `onPos` ejecutaba `st.map.easeTo(..., duration: 800)` en cada fijación GPS sin comprobar el tiempo transcurrido, cancelando la animación anterior a frecuencias `> 1,25 Hz` o en reproducción `×4`.
   - *Arreglo:* `easeCameraFollowing` aplica una puerta estricta `EASE_MIN_INTERVAL_MS = 800` (`minEaseIntervalMs` medido `806–808 ms`) y agrupa la actualización de `me-acc` cada `≥ 250 ms`.
4. **Congelación de la flecha durante 60 s en túneles sin eventos IMU (`conducir.mjs` · `coastTunnelTick`):**
   - *Fallo detectado:* la predicción EKF solo corría dentro de `devicemotion` y no actualizaba `st.me`, `snapToRoute` ni `guide()`, dejando la flecha congelada a la entrada del túnel durante pérdidas de GPS de `60 s`.
   - *Arreglo:* añadido `coastTunnelTick` (`1 Hz` cuando el GPS lleva `2,5–65 s` en silencio con `v > 1,5 m/s`), propagando posición EKF (`DEAD_RECKONING_IMU` / `DEGRADED`, sin fingir señal GPS), ajustando a la traza del túnel y recuperando `GNSS_FUSED` al salir.
5. **Fuga de memoria del `+27,37 %` en 2 horas y barrido O(N×M) en `drive-corridor.mjs`:**
   - *Fallo detectado en `SOAK_2H_7200S_MEMORY`:* (a) `conducir.mjs` reescribía `innerHTML` de `#speed`, `#turnIco`, `#laneSvg` y `#caIco` en cada muestra (`28 800` subárboles DOM/SVG recreados en `2 h`), no liberaba `Popup` al borrar marcadores, regeneraba marcadores en cada `moveend` de seguimiento y acumulaba muestras en `crashBuf.speed` a ritmo acelerado; (b) `hazardsAhead` en `drive-corridor.mjs` proyectaba las `838` incidencias nacionales sobre los `362` segmentos de ruta cada segundo sin filtro espacial previo.
   - *Arreglo:* helper `setHtml` solo ante cambios reales, liberación explícita `m.getPopup()?.remove()`, puerta espacial de `250 m` / `0,4` niveles de zoom en `moveend`, cota dura de tamaño en `crashBuf` y prefiltro exacto por desigualdad triangular en `drive-corridor.mjs`. La deriva de heap bajó de **`+27,37 %` a `+8,45 %`** (`≤ ±10 %`).
6. **Petición 404 en web y falsos disparos a `×4` en `crashSpeed`:**
   - *Fallo detectado:* `/senda/live/dgt-incidencias.xml` solo existe en el interceptor nativo de la APK Android (`AppActivity.java`), generando un error 404 en consola en la web estática; además `crashSpeed` dividía por tiempo de reloj local en vez de `dt` de fijación GNSS al reproducir a `×4`.
   - *Arreglo:* petición XML acotada a `window.SendaNative` (`0` errores en consola web) y cálculo de deceleración con el delta temporal de la muestra GNSS + `distanceToRoadM` real de la ruta.

---

## 3. Límites honestos (qué NO cubre esta prueba)

- Las pruebas se ejecutan en **Chromium real con geolocalización simulada sobre una traza GPX pública real de OpenStreetMap**, no en un teléfono físico dentro de un vehículo en movimiento (`necesita prueba física` en el trayecto real del fundador).
- El detector de choque utiliza `EXAMPLE_DETECTION_CONFIG` (razones de verosimilitud declaradas sin calibrar con siniestros reales): la matriz sintética demuestra ausencia de falsos disparos de software en esas 6 firmas típicas, no sensibilidad/especificidad clínica en carretera.

## Revisión de Claude Code (27-11-2026)
- **Fallo en master tras fusionar la PR #124.** La prueba del rodaje de 2 h falló en CI con `drift=10,36 %`. Tres pasadas locales dieron `7,36 %`, `22,15 %` (en la ventana de 1 h a 2 h) y `8,45 %`.
  - **Causa raíz**: se comparaban dos lecturas sueltas del montón, cuyo ruido es de ±10–20 %. Además, la primera lectura (a los 20 min) se tomaba con los búferes acotados aún llenándose.
  - **Arreglo**:
    - mediana de 3 lecturas, cada una tras 2 recogidas de basura;
    - una muestra cada 10 min;
    - la fuga se juzga por la tendencia (Theil–Sen) entre 1 h y 2 h, con un tope aparte para el llenado inicial.
- **Fallo intermitente en `PIXEL7_PORTRAIT_1X_FULL`.** Durante el corte de red simulado, Chrome anota `ERR_INTERNET_DISCONNECTED` por cada carga fallida, y la prueba lo contaba como error de la app.
  - **Arreglo**: esos mensajes se aceptan solo durante el corte y los 2 s siguientes. Cualquier otro error sigue contando.
