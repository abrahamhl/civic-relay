# SENDA GeoRelay — Primer cálculo RF reproducible con DEM público real

**Fecha UTC:** 2026-11-09 00:34:39.
**Ejecución original:** https://github.com/abrahamhl/civic-relay/actions/runs/42540901210
**Artefacto:** senda-rf-geometry-real-dem (JSON en el workflow, conservado temporalmente por GitHub Actions).
**Rama:** feat/senda-relay-terrain-physics-20261109 (PR #29).

## Alcance real del experimento

El job consultó elevaciones Mapzen Terrain Tiles desde AWS, generó una malla DEM para Valencia y utilizó las **cotas realmente descargadas** en las ecuaciones de curvatura y primera zona de Fresnel. Los puntos A y E del escenario son coordenadas hipotéticas derivadas de la cuadrícula, no dispositivos existentes.

| Observación verificable | Resultado |
| --- | --- |
| Estado del conjunto | SOURCE_SNAPSHOT |
| Elevaciones de DEM usadas | 1.089 |
| Distancia del corredor | 24.723 m |
| Frecuencias de cribado | 433, 868, 2.400 y 5.800 MHz |
| Alturas de antena utilizadas | 20 m y 60 m |
| Escenarios geométricos | 8 |
| Resultado del planificador A→E, 868 MHz, 60 m, saltos ≤15 km | GEOMETRIC_RELAY_CANDIDATE |
| Saltos candidatos geométricos | 2 |
| Radios medidos en el terreno | **0** |
| Validación empírica de cobertura | **NO** |

## Integridad de fuente

**SHA-256 del DEM derivado de 1.089 cotas:** 85231c16cbfe1d306109cecef5bd039cbe08f4569b2b9dc44174c71a36776bed

El recibo JSON guarda igualmente los hashes de cada PNG original, límites espaciales, fecha de descarga y los ocho resultados de Fresnel. Permite identificar el raster concreto utilizado en la simulación. Un SHA-256 verifica identidad de contenido, no exactitud geodésica ni capacidad de comunicaciones.

Fuente: https://registry.opendata.aws/terrain-tiles/
Atribución: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
Fórmula referencia: https://www.itu.int/rec/R-REC-P.526-16-202511-I/en

## Qué se puede presentar honestamente

SENDA es capaz de **utilizar relieve georreferenciado real para simular qué sectores podrían encontrarse topográficamente fuera de la línea de visión de un enlace radioeléctrico y explorar rebotes alternativos**. Ese cálculo puede repetirse sin conectividad después de haber descargado el DEM y permite evaluar sensibilidad a altura, banda y geometría del terreno.

No permite asegurar que existan retransmisores, que la banda esté autorizada en una ubicación, que el dispositivo posea radio compatible ni que el enlace tenga suficiente potencia o tasa de entrega.

## Pruebas complementarias

- El workflow incluyó **37/37 pruebas de adaptadores** y **54/54 del paquete SENDA LIVE** sin fallos, más TypeScript y Vite.
- Chromium de escritorio y móvil verificó el panel RF y la recuperación offline con **fixtures sintéticos**, separado del recibo real Mapzen.
- La función adicional Radio Shadow Field calcula una cuadrícula de 121 clasificaciones geométricas locales, no 121 mediciones de cobertura. Consultar los resultados de CI del SHA exacto de esa adición.

## Próxima calibración científica real

El experimento con terreno auténtico es un paso hacia una prueba de campo, pero **no sustituye mediciones**. Para estimar false-clear, false-block y probabilidad calibrada de enlace se requiere un dataset independiente de radios que hayan sido probados por emplazamiento, con consentimiento, reglamentación y separación por corredores en entrenamiento/validación. Hasta entonces el motor permanece en la clase GEOMETRIC_RF_SCREENING.

No se han activado sensores, recopilado ubicaciones de usuarios ni transmitido señales de radio durante estas pruebas.
