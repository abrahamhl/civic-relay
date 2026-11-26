# SENDA · Dossier técnico de validación de los simuladores 4D

**Destinatarios previstos:** equipos técnicos de Protección Civil, UME, Fuerzas y Cuerpos de Seguridad del Estado y organismos de defensa que evalúen SENDA.
**Versión:** 2026-11-25 · rama `ccr-f7e46a00-mxvkgd` (se fusiona en `master`; cada cifra se puede reproducir con los comandos del apartado 9).
**Estado:** herramienta de **apoyo a la decisión** en desarrollo. **No está homologada ni certificada** por ningún organismo. Este documento describe lo que hace, con qué datos, con qué métodos, cuánto acierta medido contra la realidad y qué le falta.

---

## 1. Regla de etiquetado (se aplica a cada capa, cifra y exportación)

| Etiqueta | Significado | Ejemplo |
|---|---|---|
| **REAL / MEDIDO** | Dato observado por un instrumento o satélite, con su fuente | Mancha de agua de Copernicus EMS; cicatriz Sentinel-2 |
| **OFICIAL** | Acto o aviso de un organismo, con su hora | Activación EMSR773; ES-Alert 20:11 |
| **ESTIMADO** | Cifra calculada por un tercero (no por SENDA) | Pico de 3 500 m³/s del CEDEX (preliminar) |
| **MODELO** | Calculado por SENDA con método citado | Cauces D8, HAND, frente del incendio |
| **ESCENARIO** | Parámetro elegido por el operador | Velocidad del agua, nivel sobre el cauce, viento |
| **NO VERIFICADO** | Dato que no se pudo comprobar en su fuente original | 264 m³/s a las 12:20 (página oficial inaccesible) |

Norma interna (`CLAUDE.md` §1): **ningún dato se inventa**, ningún parámetro sin fuente lleva valor por defecto y toda simulación se declara como tal.

## 2. Producto: app y escritorio PRO

| Capacidad | App (Android y web, perfil administrador) | Escritorio PRO (Command Center, Tauri) |
|---|---|---|
| Todas las vistas de mapa (satélite oficial, NASA del día, térmico, relieve, topográfico, 3D) | Sí | Sí |
| Incendio 4D y DANA 4D completos (capas, línea del tiempo, ciencia, inspector) | Sí | Sí |
| Telemetría con fuentes y antelación frente al ES-Alert | Sí | Sí |
| Paquete de datos exportable con procedencia y huella SHA-256 de cada capa | — | **Sí** |
| Cronología exportable en CSV (hora local y UTC, tipo, estado, fuente) | — | **Sí** |
| Explorador 3D con más resolución (zoom 15, 64 teselas por levantamiento) | zoom 14, 16 teselas | **Sí** |
| Funcionamiento sin red (datos del caso incluidos) | Sí (APK) | Sí |

La APK solo puede conectarse a una lista cerrada de servidores (`NetAllow.java`, con pruebas en CI). La bóveda de defensa **no** se copia a las superficies civiles: el escritorio la excluye al sincronizar (`apps/command-center/scripts/sync-explorer.mjs`).

## 3. Incendio 4D · San Martín de Valdeiglesias, 23-07-2026

**Datos de entrada**

| Dato | Tipo | Fuente / licencia | Resolución de uso |
|---|---|---|---|
| Imágenes antes, 24-07, 29-07 y 08-08 | REAL | Copernicus Sentinel-2 (procesado por SENDA) | malla de 100 m |
| Severidad dNBR por fecha | REAL (derivado) | Sentinel-2 | 100 m |
| Perímetro final (19 939 ha) | REAL | EFFIS (JRC, Copernicus EMS) | polígono |
| Relieve | REAL | Copernicus DEM GLO-30 (© DLR, Airbus; UE/ESA) | 100 m |
| Combustible antes del fuego | REAL (clasificado) | NDVI Sentinel-2 del 16-07 | 100 m |
| Viento y masa de aire | MODELO meteorológico | NOAA GFS 0,25° (pasada 23-07 12 UTC) | ≈ 25 km |
| Carga de combustible | **ORIENTATIVA** | `FUEL_LOAD` de SENDA | no medida en campo |

**Métodos:** pendiente y orientación de Horn (1981); elipse de Alexander (1985) y Anderson (1983) para el escenario; pluma de Briggs (1975); UTM de Snyder (1987); frente por campo de viento con conservación de masa sobre el relieve, calibrado con la cicatriz del 24-07.

**Validación medida** (`data/smv2026/fire3d.json`, `validacion_effis.json`):

| Comparación | Resultado |
|---|---|
| Frente calibrado frente a la imagen del 24-07 | Jaccard 0,352 · razón de áreas 1,21 |
| Conjunto de 24 simulaciones tras asimilar la cicatriz | acierto del 100 % de lo quemado con P ≥ 50 % · **falsa alarma 89,5 %** (sobreestima) |
| EFFIS frente a cicatriz Sentinel-2 (todos los incendios de la escena) | Jaccard 0,554 · acierto 0,555 · falsa alarma 0,0015 |
| Perímetro EFFIS rasterizado | 19 018 ha frente a 19 939 ha publicadas |

**Lo que no cuadra (se muestra en la interfaz):** tres horas de inicio distintas en los datos (EFFIS 13:53, modelo 15:00 UTC, conjunto 20:00 UTC); el modelo no cubre la unión con el incendio de Almorox.

## 4. DANA 4D · Valencia, 29-10-2024 (rambla del Poyo, l'Horta Sud)

**Datos de entrada**

| Dato | Tipo | Fuente | Resolución |
|---|---|---|---|
| Mancha de agua AOI03 (imagen 31-10-2024 10:22 UTC) | REAL | Copernicus EMS EMSR773 | polígono, rasterizado a 29,5 m |
| Relieve (54 teselas, SHA-256 guardado) | REAL | Terrain Tiles (AWS Open Data), terrarium z12 | 29,5 m |
| Cronología y telemetría (15 sucesos, 4 constantes) | MEDIDO / OFICIAL / ESTIMADO | Roldán Cañas (2025, *BRAC* 174); Bonet (*Revista de Obras Públicas* 3652); Maldita.es citando a la CHJ; Copernicus EMS | por suceso |

**Métodos:** relleno de depresiones Priority-Flood+ε (Barnes, Lehman y Mulla, 2014); dirección D8 (O'Callaghan y Mark, 1984); acumulación de flujo; HAND (Rennó et al., 2008; Nobre et al., 2011 y 2016); acuerdo por índice CSI (Bates y De Roo, 2000).

**Validación medida** (`data/dana2024/hidro.json`, reproducible):

| Comprobación | Resultado | Lectura |
|---|---|---|
| Superficie de la mancha rasterizada | 24,2 km² frente a 24,07 km² oficiales | error del 0,5 % en el paso a malla |
| Longitud del cauce del Poyo (Chiva → mar) | 41,1 km del modelo frente a 40 km publicados (Roldán 2025) | +3 % |
| Cuenca del Poyo junto a Paiporta | 401 km² del modelo frente a 422,3 km² (CEDEX vía Wikipedia, **no verificado** en origen) | −5 % |
| Agua del modelo frente a satélite (mejor CSI) | **0,168** a 5 m sobre el cauce, cuenca de cauce ≥ 25 km² (acierto 45 %, falsa alarma 79 %) | bajo; **calibrado**, no predicho |
| Línea base sin hidrología («inundar lo más bajo») | CSI 0,083 | el modelo duplica la línea base |

**Por qué el acuerdo es bajo (dicho en la interfaz):** relieve de ≈ 30 m sin encauzamientos, colectores ni puentes; el Poyo se abre en un cono aluvial aguas abajo de Torrent; la imagen es 44 h posterior al inicio; el cauce del modelo pasa a 772–788 m del punto de Paiporta.

**Telemetría con hora (hora local CET = UTC+1)**

| Hora | Dato | Tipo | Estado |
|---|---|---|---|
| 12:20 | 264 m³/s, aforo de Riba-roja | MEDIDO | **no verificado** |
| ~14:00 | Se reanudan las lluvias | sin hora exacta | verificado («sobre las 14h») |
| 15:30 (14:30 UTC) | Hora del suceso según Copernicus | OFICIAL | verificado |
| 17:40 (16:40 UTC) | Activación EMSR773 | OFICIAL | verificado |
| 18:00 | > 120 mm en 1 h (estación no indicada) | MEDIDO | verificado |
| 18:00 | Turís 179,4 mm en 1 h (Bonet) frente a 184,6 mm (AEMET vía Roldán) | MEDIDO | **discrepancia mostrada** |
| 18:55 | 2 282 m³/s (CHJ vía Maldita) / 2 292 m³/s (Roldán); el agua arrastra el medidor | MEDIDO | **discrepancia mostrada** |
| 19:35 | 3 500 m³/s, CEDEX preliminar | ESTIMADO | verificado en la fuente citada |
| 20:11 | Primer ES-Alert a la provincia | OFICIAL | coincidente en varios medios |

**Antelaciones calculadas** (restas de horas publicadas; no son juicios sobre la gestión): último dato del aforo → ES-Alert **76 min**; pico estimado → ES-Alert **36 min**; hora del suceso de Copernicus → ES-Alert **281 min**.

**No encontrado:** serie continua del SAIH Júcar (la web rechaza el acceso automático), serie horaria de AEMET por estación (requiere AEMET OpenData con clave), coordenadas oficiales del aforo y texto literal del ES-Alert.

## 4 bis. DANA 4D · simulación hidrodinámica 2D · `shallow-water.mjs`

**Método:** ecuaciones de aguas someras en formulación inercial (Bates, Horritt y Fewtrell, 2010, *Journal of Hydrology* 387: 33–45; base de LISFLOOD-FP), Courant α = 0,7, con limitador de flujo para que ninguna celda ceda más agua de la que tiene.

**Verificación numérica** (`packages/senda/tests/shallow-water.test.mjs`): lago en reposo sobre fondo irregular sin movimiento (|q| < 10⁻⁹); conservación de la masa en un recinto cerrado (error relativo < 10⁻⁹); calado normal de Manning en una rampa (error < 5 %).

**Caso real:** dominio de 422×340 celdas de 59.05 m. El agua entra por el cauce del Poyo con un hidrograma construido **solo con puntos publicados**: subida desde las 16:55 («en dos horas», Bonet), 2 282 m³/s a las 18:55 (CHJ) y 3 500 m³/s a las 19:35 (CEDEX, preliminar). La bajada posterior y la rugosidad son ESCENARIO y se calibran con la mancha de Copernicus.

| n · bajada | CSI | acierto / falsa alarma | km² máx. (ROI) | llega a Paiporta | error de balance |
|---|---|---|---|---|---|
| 0.035 · 3 h | 0.203 | 30 % / 61 % | 18.4 | 21:55 | 3e-15 |
| 0.035 · 6 h | 0.208 | 32 % / 63 % | 21.4 | 21:55 | -7e-15 |
| 0.06 · 3 h | 0.212 | 32 % / 62 % | 20.5 | 23:40 | -1e-14 |
| 0.06 · 6 h | 0.228 | 38 % / 64 % | 25.2 | 23:36 | 7e-17 |
| 0.1 · 3 h | 0.195 | 29 % / 63 % | 18.6 | no llega | 6e-15 |
| 0.1 · 6 h | 0.235 | 40 % / 64 % | 26.6 | 02:00 (30-10) | 6e-15 |
| Modelo estático HAND | 0.168 | — | — | sin tiempo | — |

**Lectura:** la simulación 2D **mejora la superficie un 40 %** frente al modelo estático. **Sus tiempos no son fiables**: el frente simulado avanza a ≈ 1 m/s, frente a los 14 m/s estimados por el CEDEX. Hay dos causas conocidas: la formulación inercial omite la advección, y la malla de 59 m no resuelve el cauce encauzado.

### Actualización F4 · Volúmenes finitos 2D (`shallow-water-fv.mjs`), celeridad de Manning y validación cruzada espacial

Reproducible sin red con `node packages/senda/scripts/dana-f4-crossval.mjs` (informe sellado `evidence/quality/dana-f4-crossval.json`, SHA-256 `256654df829096103ac581b0caba4fee6a54f21f82564b72d3f03f9fa3564025`).

**Diagnóstico físico de la brecha de celeridad (ecuación de Manning, Chow 1959, `Q = 3 500 m³/s`):**

| Régimen / geometría | Ancho $B$ | Pendiente $S_0$ | Manning $n$ | Calado $h$ | Velocidad $v$ | Celeridad cinemática $c_k$ | Froude $Fr$ | Origen |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Barranco encajonado de Chiva | 30 m | 1,5 % | 0,030 | 9,02 m | **12,93 m/s** | 21,55 m/s | 1,37 (supercrítico) | ESCENARIO: calculado por este código con B, S0 y n supuestos (no medidos) |
| Barranco de Chiva (sección 40 m) | 40 m | 1,2 % | 0,032 | 8,00 m | **10,94 m/s** | 18,23 m/s | 1,24 (supercrítico) | ESCENARIO: calculado por este código con B, S0 y n supuestos (no medidos) |
| Celda gruesa sin sección subcelda | 118,1 m | 0,8 % | 0,045 | 5,23 m | **5,66 m/s** | 9,44 m/s | 0,79 (subcrítico) | ESCENARIO: calculado por este código con B, S0 y n supuestos (no medidos) |
| Cono aluvial l'Horta Sud | 1 500 m | 0,25 % | 0,060 | 1,86 m | **1,26 m/s** | 2,09 m/s | 0,29 (subcrítico) | ESCENARIO: calculado por este código con B, S0 y n supuestos (no medidos) |

**Geometrías supuestas, no medidas**: ningún levantamiento publicado da B, S₀ ni n de esas secciones; es un cálculo de escenario que muestra un mecanismo coherente con los datos, no una explicación demostrada. Este cálculo indica por qué los **14 m/s preliminares del CEDEX** (en el barranco encajonado de Chiva) y los **≈ 1 m/s** del frente medio en el cono aluvial de l'Horta Sud no son contradictorios: en una malla de 59–118 m sin batimetría subcelda LiDAR (PNOA) el cauce se ensancha artificialmente y la velocidad cae a `4,7–5,8 m/s` en la garganta y a `≈ 1 m/s` en la llanura.

**Antes / Después (F4, misma malla 118,1 m, Copernicus EMSR773 AOI03, conservación de masa < 10⁻¹⁴):**

| Métrica (ROI oficial) | Antes · Bates (2010) uniforme ($n=0,10$, $R=6\text{ h}$) | Después · FV2D Audusse-HLLC + porosidad urbana Sanders (2008) + Manning CLC-proxy | Origen |
|---|---:|---:|---|
| CSI en toda la ROI (calibrado) | 0,2450 | 0,2311 (`fv_clc_breach0_R6`) | calculado por este código |
| **CSI medio fuera de muestra (validación cruzada espacial 4 particiones N↔S, O↔E)** | **0,1834** | **0,2019 (+10,1 %)** | calculado por este código |
| Brecha media de sobreajuste ($\text{CSI}_{\text{train}} - \text{CSI}_{\text{test}}$) | — | **+0,0128** | calculado por este código |
| CSI fuera de muestra · mitad Sur (train Norte → test Sur) | 0,0000 | **0,1269** | calculado por este código |
| CSI fuera de muestra · mitad Este (train Oeste → test Este) | 0,1677 | **0,2135 (+27,3 %)** | calculado por este código |
| Velocidad punta en garganta de Chiva | — (inercial) | **4,69–5,80 m/s** (coherente con 5,66 m/s a 118 m) | calculado por este código |
| Velocidad media del frente hasta Paiporta (18,3 km) | 0,53 m/s (572 min) | **1,08 m/s (282 min, ×2 más rápido)** | calculado por este código |

*Aviso metodológico:* los coeficientes de Manning proceden literalmente de Chow (1959, Tabla 5-6) y Kalyanapu et al. (2009, Tabla 1), asignados mediante **proxy DEM+OSM** al no incluir todavía el ráster oficial CORINE/SIOSE del CNIG ni LiDAR PNOA de 1–2 m.

**Auditoría completa de parámetros físicos (DANA, Incendio Rothermel/Scott-Burgan y Tren ETCS/Nadal/Kish-Samavedam):** véase [`docs/validacion/AUDITORIA_PARAMETROS_F4.md`](AUDITORIA_PARAMETROS_F4.md), donde cada constante lleva cita literal o marca explícita **`NO VERIFICADO`** / **`APROXIMACIÓN DE ORDEN REDUCIDO`**.

## 4 ter. Tren 4D · accidente de Adamuz (18-01-2026) · `rail-reconstruct.mjs`

**Datos:** 22 sucesos de la cronología con su fuente: el informe **preliminar** de la CIAF tal como lo citan Forbes/COPE (marzo) e Infobae (abril), y los registros del 112, Adif y Renfe recogidos por Wikipedia. Hay discrepancias de 1–2 s entre fuentes; se ofrecen las dos versiones.

**Método (cinemática, sin masas porque no están publicadas):** velocidad lineal a trozos entre lecturas publicadas; la posición se integra de forma exacta y se ancla en el PK del impacto (318,173); la distancia de parada se calcula como v²/2a con la deceleración media medida entre dos lecturas. Pruebas: integración exacta, distancias de parada y restas de horas reales.

| Resultado (versión Infobae) | Valor |
|---|---|
| Primer síntoma → freno de emergencia del Alvia | 8 s (9 s en la versión Forbes) |
| Freno → choque | 5 s y 292 m, de 217 a 204 km/h |
| Deceleración media del Alvia en esos segundos | 0,72 m/s² (0,56 en la versión Forbes) |
| Distancia para detenerse con esa deceleración | 2,52 km: habría tenido que frenar ~37 s antes, antes incluso del primer síntoma |
| Velocidad de acercamiento en el choque | 356 km/h |
| Comprobación cruzada (velocidades frente a PK) | 389 m frente a 508 m: 119 m de diferencia (≈ 2,8 s), compatible con el redondeo de las horas |
| Respuesta | 112 a los +69 s; segundo tren confirmado a los +32 min 47 s |

**Simulación SENDA (sintética, etiquetada):** con un 25 % de pasajeros con SENDA y un 55 % de cobertura, el segundo emplazamiento se conocería a los 34 s. Pasajeros, posiciones, adopción y cobertura son supuestos.

**Lección:** con el tren ya descarrilado no había margen físico para frenar. El valor está antes (detectar la rotura del carril: `trackCircuitWatch` y el detector por ondas guiadas) y después (saber en segundos que hay dos trenes). La señal de 22 h antes sigue **en disputa** (Guardia Civil frente a Adif).

## 5. Motor de prevención (base) · `packages/senda/src/flood-warning.mjs`

Referencia para el motor de alerta temprana de SENDA. Entradas **obligatorias y con fuente**: umbrales y velocidades no tienen valor por defecto.

| Función | Qué hace | Estado |
|---|---|---|
| `downstreamPath` | Camino del agua aguas abajo desde cualquier punto (D8) con longitud acumulada | probado |
| `travelMinutes`, `frontIndex` | Tiempo de llegada y posición del frente a velocidad dada | probado; velocidad constante declarada |
| `flowLevel` | normal / aviso / desbordamiento con umbrales aportados (aquí: 150 m³/s CHJ, 800 m³/s capacidad urbana) | probado; sin umbral → «no medido» |
| `leadMinutes`, `eventsUntil` | Antelación entre sucesos de una cronología con fuente; no rellena huecos | probado con la cronología real |

**Escenario mostrado en la app** (ESCENARIO, no reconstrucción): si el pico pasaba por Chiva a las 19:35 a 14 m/s (lectura posible del texto del CEDEX, no confirmada), el modelo situaría el agua junto a Torrent a las 20:10, Picanya a las 20:15 y Paiporta a las 20:16. Con otra hora o velocidad, el resultado cambia: por eso el operador las elige y quedan escritas en la exportación.

**Siguiente paso para uso operativo:** conectar lecturas en vivo (SAIH, AEMET) mediante convenio, calibrar la celeridad por tramo con avenidas históricas y validar el motor en modo ciego (sin ver el resultado) con eventos no usados para calibrar.

## 5 bis. Cuando no hay dato: estimación con métodos publicados · `hydro-estimates.mjs`

Si falta una medida, SENDA no la inventa ni deja el hueco vacío: calcula **varios métodos publicados a la vez**, cada uno con su fuente y su ámbito de validez, y muestra la **horquilla** entre ellos. Jerarquía (`pickBest`): **dato medido de la red del organismo** > dato observado publicado > estimación.

| Método | Fórmula | Fuente | Ámbito |
|---|---|---|---|
| Témez | tc = 0,3·Lc^0,76·Jc^−0,19 (h; km) | Norma 5.2-IC, Orden FOM/298/2016, apdo. 2.2.2.5 (BOE-A-2016-2405), comprobada en el BOE | cuencas principales, tc > 0,25 h |
| Kirpich | tc = 0,0195·L^0,77·S^−0,385 (min; m) | Kirpich (1940); forma SI del manual de hidrología de TxDOT | cuencas agrícolas pequeñas |
| Velocidad observada | dato de un episodio | p. ej. 14 m/s del CEDEX por Chiva (preliminar, vía Roldán 2025) | ese episodio; extenderlo a todo el tramo es una suposición |

Resultado en el Poyo (Chiva → mar, 41 km): Témez 0,9 m/s (785 min), Kirpich 1,4 m/s (480 min), CEDEX 14 m/s (49 min). **No se contradicen**: las fórmulas dan el tiempo de concentración (respuesta media de la cuenca a la lluvia) y el CEDEX, la velocidad en la punta de una crecida ya formada. La interfaz lo explica y recomienda el dato observado para una crecida en marcha.

## 5 ter. Conectores: la red del organismo dentro de SENDA · `data-connectors.mjs`

| Red | Estado hoy |
|---|---|
| Fichero propio (CSV/JSON) de aforos, pluviómetros, niveles | **importable** |
| Malla SENDA (móviles y sensores en campo) | **importable** |
| Copernicus EMS, Sentinel-2, NASA GIBS | **conectado** |
| AEMET OpenData | requiere clave (gratuita; se guarda en el entorno) |
| SAIH de las confederaciones, DGT 3.0 | requiere convenio |

Validación de lo importado: hora **con zona horaria obligatoria** (una hora ambigua puede mover una alerta 1–2 h), unidades fijas por tipo, valores imposibles rechazados con su línea, orden temporal estricto, fuente obligatoria y huella SHA-256. El dato **no sale del dispositivo** y, en cuanto existe, sustituye a la estimación en el contador de caudal («tu red»). En el escritorio PRO entra en el paquete exportado con su huella.

## 5 quater. Radar de personas mmWave · `mmwave-radar.mjs` · `/senda/personas`

| Pieza | Qué es | Verificación |
|---|---|---|
| Protocolo RD-03D / LD2450 | Trama `AA FF 03 00` + 3×8 bytes + `55 CC`, 256000 baudios; bit 15 = signo positivo | Tomado del firmware abierto de Sudo_solder (MIT) y contrastado con `ld2450-proto`; prueba de ida y vuelta, trozos arbitrarios, basura y trama corrupta descartada |
| Limpieza | Alcance 100–8000 mm y fusión de ecos < 1000 mm (valores del firmware de referencia) | Prueba; sin valores por defecto en el núcleo |
| Seguimiento | Kalman de velocidad constante por pista; asignación óptima (todas las permutaciones, ≤ 3) con puerta | Prueba: dos personas que se cruzan conservan su identidad; posición final < 150 mm, velocidad < 120 mm/s de error; oclusión breve mantenida y baja tras el tiempo dado |
| Calibración | Distancia por mínimos cuadrados (escala, sesgo, residuo); rumbo de marcha por componentes principales; montaje por media circular | Pruebas con valores conocidos (escala exacta, 30° y 210°, corrección de 7° cruzando el norte) |
| Georreferencia | Del sistema del radar a lon/lat con el rumbo del montaje | Prueba: 10 m al frente mirando al este = 10 m al este |

**No medido todavía con hardware real.** Sin datos de campo no se publica precisión de distancia ni de ángulo. Límites: solo objetivos en movimiento; persona y perro no se distinguen; Web Serial solo en Chrome/Edge de escritorio. Guía: `hardware/mmwave-rd03d/README.md`.

## 6. Precisión: qué se puede prometer

- **No hay precisión milimétrica** con estos datos, y SENDA no la afirma. Las mallas de trabajo son de 29,5 m (DANA) y 100 m (incendio); los satélites usados resuelven 10–20 m (Sentinel-2) o ≈ 25 km (previsión GFS).
- La exactitud vertical de cada relieve depende de su fuente; **no se ha verificado** en esta versión contra puntos de control topográfico. Es la primera prueba pendiente de la validación independiente.
- Para reconstruir una escena (accidente, rotura, desbordamiento) a escala de centímetros harían falta datos de otro tipo: LiDAR del PNOA, fotogrametría con dron o escaneo láser de la escena. Su integración es una fase futura y sus precisiones se documentarán cuando estén medidas.

## 7. Seguridad, privacidad y licencias

- Sin datos personales en los casos. Los municipios son puntos públicos de OpenStreetMap (ODbL).
- Secretos: nunca en el código ni en el chat. Las credenciales se guardan en el entorno.
- **Revisión de licencias antes de vender:** algunas fuentes gratuitas son solo para uso no comercial (p. ej. la API gratuita de Open-Meteo usada para GloFAS). Antes de un contrato con organismos públicos hay que confirmar la licencia comercial de cada fuente o sustituirla.

## 8. Qué falta para una adopción institucional (no se afirma ninguno)

1. Evaluación técnica independiente (organismo técnico o universidad) con eventos no usados para calibrar.
2. Datos oficiales en vivo mediante convenio (SAIH de las confederaciones, AEMET OpenData, DGT 3.0).
3. Para sistemas del sector público: estudiar la adecuación al Esquema Nacional de Seguridad (Real Decreto 311/2022) y, para defensa, los requisitos del CCN.
4. Pruebas de campo con usuarios operativos y accesibilidad.
5. Contrastar la exactitud del relieve con puntos de control.

## 9. Reproducibilidad

```bash
node --test packages/senda/tests/*.test.mjs        # núcleo (incluye flood-science, flood-warning, hydro-connectors, shallow-water, fire-science)
(cd investor-next && node --test tests/*.test.mjs)  # web
node scripts/prove.mjs                              # afirmaciones públicas
node packages/senda/scripts/dana-hand.mjs           # regenera hidrología y calibración de la DANA
node packages/senda/scripts/dana-swe.mjs            # simulación hidrodinámica 2D y su calibración (≈ 90 s)
```

Cada paquete exportado desde el escritorio PRO lleva la huella SHA-256 de las capas binarias para comprobar que no se han alterado.

## 10. Registro de cambios de esta fase

| Fecha (UTC) | Cambio | Commit |
|---|---|---|
| 2026-11-25 16:04 | Laboratorio científico del Incendio 4D | 3d5eb8d (PR #93) |
| 2026-11-25 16:23 | DANA 4D: hidrología, calibración CSI y cuencas | 6a4f59f (PR #94) |
| 2026-11-25 16:44 | Línea del tiempo, telemetría con fuentes, motor `flood-warning`, modo PRO de exportación, pestaña de simuladores en el escritorio y este dossier | 9d4313f (PR #95) |
| 2026-11-25 16:59 | Estimaciones con métodos publicados cuando falta el dato (Témez, Kirpich, observado) y conectores para la red del organismo | 54f310e (PR #96) |
| 2026-11-25 17:29 | Motor hidrodinámico 2D verificado y simulación del 29-10 calibrada contra Copernicus | 333996f (PR #97) |
| 2026-11-25 | Tren 4D: reconstrucción de Adamuz con datos publicados | esta PR |

*Firmado: asistente de ingeniería de SENDA (Claude), para revisión del fundador.*
