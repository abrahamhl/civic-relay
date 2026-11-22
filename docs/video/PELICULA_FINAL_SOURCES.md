# SENDA · Película final (noviembre de 2026) · fuentes y trazabilidad

**Fecha:** 2026-11-22 · **Guion:** `media/senda-film/senda-final.json`, generado por `media/senda-film/build-senda-final.mjs`; no se edita a mano.
**Montaje:** `media/senda-film/assemble-final.mjs` · **Archivo:** `investor-next/public/media/senda-pelicula-final-es.mp4`, con subtítulos y capítulos en VTT.

## Estructura

1. **Avance** (escenas `a0`–`a1` de este guion): el radar con avisos reales y la presentación de los dos capítulos.
2. **Capítulo 1**: la película m96 del 10-11-2026, vuelta a renderizar con las cifras de pruebas de hoy.
   - Pasa de «350» a las del `estado.json` actual.
   - Las 49 comprobaciones de principio a fin se describen como **última ejecución guardada**: no se repiten en cada compilación.
   - Fuentes de ese capítulo: [M96_PROMO_SOURCES.md](M96_PROMO_SOURCES.md).
3. **Capítulo 2** (escenas `b0`–`b20`): todo lo construido desde entonces.

La película de 8 minutos (`senda-film-es.mp4`) no se incluye: sus 21 escenas ya están, actualizadas, en la m96.
El reel de drones `m95-reel-drones` («caza de drones») tampoco: es contenido de doble uso y vive en la bóveda de defensa (CLAUDE.md).
Los drones aparecen por su parte civil: Open Drone ID, censo por planta, barrido casa por casa y dron mula.

## Cómo se calculan las cifras del capítulo 2

Las calcula `build-senda-final.mjs` al construir el guion:

| Cifras | De dónde salen |
|---|---|
| Avisos, fuentes y terremotos fusionados | `data/alertas/instantanea.json` del día, con `alert-watch.mjs` |
| Tamaño del sobre | Medido con `envelope.mjs` |
| Tiempos de salida (ciudad, pueblo, pasarela de un bar) | `simulateStrangerRelay`, con el escenario de ejemplo **declarado** |
| Reparto entre pasarelas | `planShardSpread` |
| Miniaturas | Decodificadas con el códec real a partir de una foto de la DANA (`assets/m97-thumbs.json`) |
| Probabilidades de la malla | `hazard-reports.mjs` |
| Acierto del fuego (Jaccard) | `data/smv2026/fire3d.json`. El 0,352 es una **calibración dentro de la propia muestra**; sin calibrar el modelo acierta 0,013, por debajo de un círculo (0,131) |
| Humo | `smoke-exposure.mjs`, comprobando la conservación de la masa |
| Pruebas | `estado.json` |

## Técnicas visuales nuevas

Las técnicas de los «comandos» de vídeo explicativo (`/graph`, `/map-route`, `/breakdown`, gráficos minimalistas) se han rehecho en `media/senda-film/m97-kinds.js`. Son canvas deterministas con datos reales: no se ha instalado ningún paquete externo sin verificar.

Los clips son grabaciones reales de la web. Las partes simuladas llevan la etiqueta SIMULACIÓN.

## Escenas

| # | Escena | Título | Clasificación | Fuentes |
|---|---|---|---|---|
| 1 | `a0` | Cuando todo se cae, alguien tiene que seguir viendo | `OBSERVED` | `investor-next/public/senda/radar.html` · `packages/senda/src/alert-watch.mjs` · `investor-next/public/senda/data/alertas/instantanea.json` |
| 2 | `a1` | Dos capítulos, una sola historia | `OBSERVED` | `investor-next/public/media/m96/senda-m96-promo-es.mp4` · `investor-next/public/senda/estado.json` |
| 3 | `b0` | Capítulo 2: lo que hemos construido | `OBSERVED` | `investor-next/public/senda/estado.json` · `investor-next/app/senda-home.tsx` |
| 4 | `b1` | El ojo que ve, y que no se queda mirando | `OBSERVED` | `investor-next/public/senda/ciclo.html` · `investor-next/public/senda/ciclo.mjs` |
| 5 | `b2` | Radar: SENDA rastrea los avisos por ti | `CALCULATED` | `packages/senda/src/alert-watch.mjs` · `packages/senda/tests/alert-watch.test.mjs` · `docs/research/SENDA_RADAR_AVISOS_2026-11-20.md` |
| 6 | `b3` | Activar SENDA aquí: el radio de acción | `SIMULATED` | `packages/senda/src/alert-watch.mjs` · `investor-next/public/senda/radar.mjs` |
| 7 | `b4` | Sin datos, pero no solo | `CALCULATED` | `packages/senda/src/stranger-gateway.mjs` · `docs/research/SENDA_MENSAJERIA_SIN_COBERTURA_2026-11-20.md` |
| 8 | `b5` | La prueba, ejecutada de verdad | `OBSERVED` | `investor-next/public/senda/viaje-desconocido.mjs` · `packages/senda/tests/stranger-gateway.test.mjs` |
| 9 | `b6` | Quien te ayuda no puede leer nada | `CALCULATED` | `packages/senda/src/envelope.mjs` · `packages/senda/src/stranger-gateway.mjs` · `packages/senda/src/erasure.mjs` |
| 10 | `b7` | Cuánto tarda en salir el mensaje | `SIMULATED` | `packages/senda/src/stranger-gateway.mjs` |
| 11 | `b8` | Un chat que ya conoces | `CALCULATED` | `packages/senda/src/familiar-chat.mjs` · `packages/senda/tests/familiar-chat-smoke.test.mjs` |
| 12 | `b9` | Cada conductor puede ser un salvavidas | `SIMULATED` | `investor-next/public/senda/ciclo.mjs` · `packages/senda/src/drive-autostart.mjs` · `packages/senda/src/hazard-reports.mjs` |
| 13 | `b10` | Simulador 3D: el fuego, con pocos datos | `SIMULATED` | `investor-next/public/senda/simulador.mjs` · `packages/senda/src/wildfire.mjs` · `investor-next/public/senda/data/smv2026/fire3d.json` |
| 14 | `b11` | Agua que sube y terremotos | `SIMULATED` | `investor-next/public/senda/simulador.mjs` · `packages/senda/src/seismic.mjs` |
| 15 | `b12` | Calidad del aire, calculada desde casa | `CALCULATED` | `packages/senda/src/smoke-exposure.mjs` · `packages/senda/tests/familiar-chat-smoke.test.mjs` |
| 16 | `b13` | Drones: contar personas sin entrar | `SIMULATED` | `investor-next/public/senda/dron.html` · `packages/senda/src/drone.mjs` · `packages/senda/src/sovereign-mesh-kit.mjs` |
| 17 | `b14` | Dron casa por casa, y dron mula | `SIMULATED` | `investor-next/public/senda/barrido.html` · `packages/senda/src/bearers.mjs` |
| 18 | `b15` | Sala de decisión: la DANA real | `OBSERVED` | `investor-next/public/senda/sala.html` · `investor-next/public/senda/data/dana2024/emsr773.json` |
| 19 | `b16` | En qué se basa, y qué aporta | `CALCULATED` | `packages/senda/src/erasure.mjs` · `packages/senda/src/bearers.mjs` · `packages/senda/src/delivery-assurance.mjs` · `packages/senda/src/stranger-gateway.mjs` · `packages/senda/src/envelope.mjs` · `packages/senda/src/hazard-reports.mjs` · `packages/senda/src/wildfire.mjs` · `packages/senda/src/smoke-exposure.mjs` · `packages/senda/src/seismic.mjs` · `packages/senda/src/atmos3d.mjs` |
| 20 | `b17` | Contra quién competimos, y cómo nos sumamos | `OBSERVED` | `docs/research/SENDA_MENSAJERIA_SIN_COBERTURA_2026-11-20.md` · `docs/research/SENDA_RADAR_AVISOS_2026-11-20.md` |
| 21 | `b18` | Europa: el mismo núcleo en todos los países | `OBSERVED` | `packages/senda/src/interop.mjs` · `investor-next/public/senda/paises.html` · `packages/senda/src/alert-watch.mjs` |
| 22 | `b19` | Comprobado hoy, y lo que falta | `OBSERVED` | `investor-next/public/senda/estado.json` · `scripts/prove.mjs` |
| 23 | `b20` | Para que ningún mensaje se pierda | `OBSERVED` | `investor-next/app/senda-home.tsx` · `LICENSE` |
