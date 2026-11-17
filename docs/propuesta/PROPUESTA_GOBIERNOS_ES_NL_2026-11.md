# SENDA · Propuesta candidata para servicios de emergencia de España y Países Bajos

**Versión:** 17-11-2026 · **Estado:** borrador de trabajo del fundador. No se ha presentado a ningún organismo.
**A quién va dirigida:** a los órganos técnicos de protección civil y emergencias (en España, Ministerio del Interior y servicios autonómicos; en Países Bajos, Ministerio de Justicia y Seguridad / NCTV, *veiligheidsregio's* y Rijkswaterstaat).
**Nota sobre España:** una fuente secundaria indica elecciones generales el 29-11-2026 (no verificado en BOE). La propuesta se dirige al Gobierno que resulte, sea cual sea, y a los órganos técnicos permanentes.

---

## 1. Qué es y qué no es

**Es** un conjunto de herramientas de código abierto que ya funcionan sobre datos públicos reales y que se pueden abrir hoy en un navegador:

| Herramienta | Pregunta que responde | Datos reales que usa | Estado |
|---|---|---|---|
| **Aislamiento por inundación** | ¿Qué calles tocan el agua y qué barrios secos se quedan sin camino a un hospital, centro de salud, bomberos o policía? | Agua observada por Copernicus EMS (EMSR773, DANA de Valencia) + calles de OpenStreetMap | Funciona; 10 pruebas automáticas |
| **Planificador de radio** | Si cae la red móvil, ¿dónde poner repetidores de baja potencia para llevar un aviso valle abajo? | Relieve Copernicus DEM GLO-30 de la cuenca del Poyo | Funciona como **modelo**; sin medida de campo |
| **Vigilancia de agua (NL)** | ¿Qué estaciones suben, cuánto tarda la onda de una a otra, cuánto se desvía la previsión oficial? | 25 estaciones de Rijkswaterstaat, 28 días de medidas + previsión oficial | Funciona; foto del día de la descarga |
| **Consola de fusión** | ¿Qué sucesos están respaldados por varias fuentes independientes? | GDACS, USGS, EMSC, Copernicus, DGT, NDW, ADS-B | Funciona |
| **Cordón de cámaras** | ¿Desde qué sectores se puede comprobar visualmente un suceso? | Cámaras públicas de la DGT | Funciona; lectura puntual |
| **Mulas de datos** | ¿Pueden los autobuses llevar mensajes sin red? | Horarios GTFS de la EMT de València | **Simulación** sobre horarios reales |

**No es** (y no se debe presentar como tal):
- No está integrado con el 112, ES-Alert, NL-Alert ni con ningún sistema oficial.
- No ha sido probado por ningún servicio de emergencias ni en un simulacro.
- No tiene certificación de seguridad (ENS en España, BIO en Países Bajos).
- No sustituye a ningún sistema oficial de alerta: las reglas de atención son de SENDA y están declaradas como tales.
- No tiene clientes, contratos ni cartas de apoyo.

## 2. Resultados que se pueden enseñar (y de dónde sale cada cifra)

Todas las cifras salen de ejecutar el código del repositorio sobre los ficheros de datos indicados; se repiten con los scripts de `scripts/datos-reales/`.

**Aislamiento por inundación · l'Horta Sud (Valencia).** Fichero `data/aislamiento/dana_horta_sud_resultado.json`, escenario «un tramo se corta si toca agua observada»:
- 1 227,3 km de calles analizadas; **489,5 km** quedan dentro del agua observada los días 30 y 31-10-2024.
- 9 de 57 servicios (hospitales, centros de salud, bomberos, policía) caen dentro del agua observada.
- **1 326 cruces secos** (4,4 % de los secos) se quedan sin ningún camino seco a un servicio, repartidos en 66 bolsas.
- 6 218 de 32 052 edificios de OpenStreetMap tienen su cruce más cercano dentro del agua.
- **Límite importante:** el satélite no delimitó agua dentro de los cascos urbanos densos (Benetússer, Alfafar, Massanassa, Catarroja aparecen como huecos). Un hueco no significa que estuviera seco, así que estas cifras se quedan cortas ahí. Las calles son las de OpenStreetMap de hoy, no las de 2024. No hay calado: «tocar agua» es una regla de escenario.

**Planificador de radio · cuenca del Poyo.** Fichero `data/radio/poyo_plan.json`. Es una **predicción con modelo** (espacio libre + difracción ITU-R P.526), sobre terreno desnudo:
- Desde una azotea en Chiva, el modelo prevé enlace directo con 14 de 22 municipios; con un repetidor en una cima de 1 028 m y otro en Turís, con los 22.
- Si se añaden 20 dB de pérdida por edificios y arbolado (supuesto, no medido), el enlace directo baja a 2 de 22 y hacen falta 4 repetidores para los 22.
- Potencia (14 dBm) y sensibilidad (−137 dBm) son valores habituales de norma y de hoja de datos, **no verificados en esta sesión**. Antes de comprar equipos hay que medir en campo.

**Vigilancia de agua · Países Bajos.** Fichero `data/nl-water/rws_niveles.json`, descargado el 17-11-2026 a las 00:50 UTC:
- 25 estaciones; 6 con algún motivo de atención según las reglas de SENDA; ninguna en atención alta.
- Tiempo de viaje medido de la onda: Lobith → Nijmegen 5 h (correlación 0,94); Nijmegen → Tiel 8 h (0,85); Doesburg → Zutphen 3 h (0,95). En 9 de 20 tramos se puede medir; en los tramos con presas o marea, no.
- 6 estaciones tienen marea detectada con sus propios datos; se les quita antes de juzgar la tendencia.
- No se usan umbrales oficiales de alarma (no integrados). El percentil es respecto a 28 días, no un periodo de retorno.

## 3. Qué se propone a cada administración

**Un piloto de evaluación, no una compra.** Objetivo: que un equipo técnico de la administración diga, con sus propios datos, si estas herramientas le sirven o no.

| Fase | Duración orientativa | Qué se hace | Qué decide la administración al final |
|---|---|---|---|
| 0 · Revisión | 2–4 semanas | Sus técnicos abren las herramientas y revisan código, fuentes e hipótesis | Si merece un piloto |
| 1 · Piloto en sombra | 3–6 meses | Se ejecuta en paralelo a sus sistemas, sin tocar la operación, sobre un episodio pasado elegido por ellos y sobre el día a día | Si los resultados coinciden con lo que ellos saben que pasó |
| 2 · Simulacro | 1 ejercicio | Uso en un simulacro real, con medida de campo del planificador de radio | Si pasa a integración |

Las duraciones son una propuesta de quien redacta, no un compromiso de nadie. **No se incluye precio**: el fundador aún no ha fijado tarifas (decisión pendiente).

**Para España (servicios autonómicos de emergencias y DGPCE):** repetir el análisis de aislamiento con la cartografía oficial de calles y con sus propios datos de la DANA (qué calles estuvieron cortadas de verdad) para medir cuánto acierta el método; medir en campo dos enlaces del plan de radio del Poyo.

**Para Países Bajos (*veiligheidsregio's*, Rijkswaterstaat, *waterschappen*):** conectar la vigilancia de agua con los umbrales oficiales de cada estación; aplicar el aislamiento por inundación a un escenario de rotura de dique con sus mapas oficiales de inundación; la interfaz está en español y habría que traducirla al neerlandés y al inglés.

## 4. Lo que hace falta para pasar de demostración a servicio

1. Sociedad constituida y un responsable legal del servicio.
2. Servidor propio para que las capas se actualicen solas (hoy son fotos fijas de la fecha de descarga).
3. Auditoría de seguridad independiente y camino hacia ENS / BIO.
4. Acuerdo de datos con cada organismo y revisión de licencias (la de Rijkswaterstaat no se ha releído en esta sesión).
5. Validación con un episodio real por parte de quienes lo vivieron.

## 5. Cómo se financiaría

Ver `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md`. La vía con mejor encaje es Horizon Europe Cluster 3, tema DRS-03 (sistemas de apoyo a la decisión en crisis), que abre el 5-5-2027 y exige que un usuario final —precisamente una de estas administraciones— participe en el consorcio.

## 6. Dónde verlo

- `/senda/aislamiento` · `/senda/radio` · `/senda/agua-nl` · `/senda/consola`
- Código: `packages/senda/src/{flood-isolation,radio-planner,water-nl}.mjs` con sus pruebas en `packages/senda/tests/`.
- Capturas: `docs/media/nuevos/`.
