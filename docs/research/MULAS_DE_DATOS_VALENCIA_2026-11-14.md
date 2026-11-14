# Autobuses como mulas de datos: el canal offline sobre horarios reales (EMT València)

Fecha: 14-11-2026. Autor: Claude Code. Regla de veracidad: `CLAUDE.md` §1. **Todo resultado es SIMULACIÓN sobre horarios reales.**

## Pregunta

Si cae la red móvil, ¿qué fracción de la flota de autobuses tendría que llevar un nodo SENDA para que un mensaje corto (de 160 caracteres o menos) cruce València a tiempo? ¿Y qué estrategia de copia conviene usar?

## Ciencia de base

- **DakNet** (Pentland, Fletcher y Hasson, *IEEE Computer* 2004) y **UMass DieselNet / MaxProp** (Burgess et al., *INFOCOM* 2006): vehículos de transporte público como portadores de datos (store-carry-forward, DTN).
- **Connection Scan Algorithm** (Dibbelt, Pajor, Strasser y Wagner, *SEA* 2013): da la llegada más temprana, exacta, en una red con horario.
- **Encaminado epidémico** (Vahdat y Becker, 2000) frente a **copia única**. Con copias ilimitadas, la llegada epidémica es la llegada más temprana sobre los autobuses que llevan nodo, y eso es justo lo que calcula el CSA.

## Datos

- **GTFS de la EMT de València:** fichero del 12-11-2026, licencia **CC BY 4.0** del Ajuntament de València, verificada en la ficha CKAN del portal. SHA-256 del ZIP guardado en `valencia.json`.
- **Contenido:** 1.152 paradas, 31.574 viajes y 774.928 horarios de paso.
- **Día simulado:** lunes 16-11-2026, de 07:00 a 11:00. Son 44.314 conexiones de 2.099 viajes.

## Hipótesis (por eso es simulación)

1. Cada autobús lleva nodo SENDA con probabilidad *q*, independiente por viaje.
2. Hay un buzón o teléfono SENDA en cada parada.
3. El intercambio en la parada es instantáneo.
4. Los autobuses cumplen el horario publicado (en una emergencia real puede no ser así).

## Resultados (40 parejas a más de 3 km elegidas con semilla, 30 flotas al azar por cada *q*, salida a las 08:00)

| Flota con nodo | ≤ 120 min · epidémico | ≤ 120 min · copia única | ≤ 60 min · epidémico | ≤ 60 min · copia única |
|---|---|---|---|---|
| 10 % | 6,9 % | 0,2 % | 1,7 % | 0,8 % |
| 30 % | 44,7 % | 1,5 % | 12,5 % | 3,3 % |
| 50 % | **74,4 %** | **7,4 %** | 37,1 % | 10,8 % |
| 75 % | 91,2 % | 29,8 % | 71,7 % | 37,9 % |
| 100 % | 100 % | 100 % | 100 % | 100 % |

- **Desde la Plaça de l'Ajuntament con toda la flota:** se llega a las 1.151 paradas, con una mediana de 46,1 min y un p90 de 68,6 min.
- **La copia única se hunde** porque una ruta con *k* transbordos solo sobrevive con probabilidad *qᵏ*. Las copias en todos los autobuses encuentran alternativas, y con la mitad de la flota multiplican la entrega por unas 10 veces en el plazo de 120 min.
- **Muestra pequeña con el plazo de 60 min:** solo 8 de las 40 parejas son posibles incluso con toda la flota.

## ¿Cuántos buzones y dónde? (flota completa, entrega buzón→buzón, el mensaje solo baja o cambia de autobús donde hay buzón)

| Buzones | Por cobertura (MCLP voraz, ≤ 400 m): cubre · entrega ≤ 2 h | En transbordos (más líneas): cubre · entrega ≤ 2 h |
|---|---|---|
| 25 | 42 % · 4,5 % | 14 % · 31 % |
| 50 | 68 % · 7,3 % | 21 % · **63 %** |
| 100 | 91 % · 10,4 % | 35 % · **83 %** |
| 200 | 100 % · 14,1 % | 55 % · 85 % |
| 400 | 100 % · 14,1 % (el voraz se detiene al cubrirlo todo) | 74 % · 95 % |
| 1152 (todas) | 100 % · 97 % | — |

- **Hallazgo:** colocar buzones solo por **cobertura geográfica**, aunque sea casi óptima (garantía ≥ 1 − 1/e), deja los **transbordos** sin buzón, y el mensaje no puede cambiar de autobús. En las paradas donde se cruzan más líneas la entrega se multiplica por unas 8 veces con 100 buzones, aunque se cubren menos barrios a pie. El **plan mixto**, con la mitad de los buzones en transbordos y la otra mitad completando la cobertura con el voraz, queda en medio:
  - 50 buzones: cubre el 52 % y entrega el 21 %;
  - 100 buzones: cubre el 78 % y entrega el 54 %;
  - 200 buzones: cubre el 97 % y entrega el 66 %;
  - 302 buzones: cubre el 100 % y entrega el 80 %.

  Es una frontera de compromiso entre cubrir barrios y entregar a tiempo, y cada ayuntamiento elige su punto. Un efecto de la métrica: al añadir buzones en la periferia entran parejas más lejanas, y eso también baja la entrega media.
- **Precauciones:**
  - las parejas buzón→buzón se sortean entre los buzones de cada plan, así que las muestras no son idénticas entre planes;
  - es cobertura de paradas, no de personas (no hay datos de población).

## Lectura para SENDA

- La estrategia por defecto del canal offline debe ser **multicopia** (epidémica o con un límite de copias), **no copia única**.
- Para que el canal sea útil en un plazo de unas 2 horas hace falta equipar una parte grande de la flota, alrededor del 50–75 %.

## Reproducir

- `node scripts/datos-reales/gtfs_valencia_mulas.mjs 20261116`: descarga el GTFS y escribe `investor-next/public/senda/data/mulas/`.
- Pruebas: `packages/senda/tests/bus-mules.test.mjs`. Página interactiva: `/senda/mulas`, que ejecuta el CSA en el navegador.

## Límites

- Sin retrasos ni cancelaciones reales.
- No se modela la capacidad del buffer ni la energía.
- El buzón en cada parada es una hipótesis optimista.
- Pendiente:
  - añadir Spray-and-Wait con L copias.
