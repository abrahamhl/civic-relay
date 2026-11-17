# RoadSafe · Casuística, factores de riesgo y conclusiones de investigación

**Fecha:** 2026-11-17 · **Código:** `roadsafe-evidence.mjs`, `roadsafe-risk-factors.mjs`, `roadsafe-priority.mjs`, `roadsafe-zone.mjs`, `circumstanceGrid` en `roadsafe-accident-sim.mjs`
**Regla:** cada cifra tiene su fuente y su grado (A, B, C, E, H; ver `EVIDENCE`). Varias fuentes se leyeron **solo en resumen o extracto**, y así se indica en cada entrada.

## 1. Qué dice la evidencia (consultada hoy)

| # | Hallazgo | Grado | Fuente |
|---|---|---|---|
| 1 | Cada minuto más de incidente añade ≈1,2 puntos porcentuales de probabilidad de un secundario (Virginia). | B | [Khattak et al., «Are incident durations and secondary incidents interdependent?»](https://www.researchgate.net/publication/228380158_Are_Incident_Durations_and_Secondary_Incidents_Interdependent) |
| 2 | La mayoría de secundarios ocurre en los primeros ~20 min; el 99,9 % en menos de 4 h. | B | [Safety 12(2):50](https://doi.org/10.3390/safety12020050) · [Iowa](https://www.researchgate.net/publication/276168207_Mining_the_Characteristics_of_Secondary_Crashes_on_Highways) |
| 3 | Más del 90 % de los secundarios se vincularon a primarios que **necesitaban grúa** (Tennessee 2017–2022). | B | [Safety 12(2):50](https://doi.org/10.3390/safety12020050) |
| 4 | El bloqueo de carril, su duración y el volumen de tráfico aumentan el riesgo. | C | [VTRC 11-R11](https://vtrc.virginia.gov/media/vtrc/vtrc-pdf/vtrc-pdf/11-r11.pdf) · [TETC 2026](https://tetcoalition.org/wp-content/uploads/2026/01/Secondary-Crash-Factors_Final.pdf) |
| 5 | Definición operativa: secundario es el que ocurre en la escena o en la cola, en cualquier sentido. | A | [FHWA-HOP-23-043](https://ops-dr.fhwa.dot.gov/publications/fhwahop23043/fhwahop23043.pdf) |
| 6 | Los atropellos de intervinientes están mal registrados en los sistemas tradicionales. | B | [FHWA-HOP-23-069](https://highways.dot.gov/media/56731) |
| 7 | El aviso de final de cola **en vía**, junto con bandas sonoras, redujo un 44 % los choques (I-35, Texas). | B | [FHWA-HRT-25-049](https://highways.dot.gov/sites/fhwa.dot.gov/files/FHWA-HRT-25-049.pdf) |
| 8 | Sin detección automática, encontrar un vehículo parado en carril vivo costaba de media ~17 min; el objetivo de detección automática es <20 s. | B | [AA / Highways England](https://www.theaa.com/about-us/newsroom/news/17-minutes-to-spot-a-live-lane-breakdown-on-smart-motorways) |
| 9 | España: ≈25 peatones fallecidos al año tras bajar del vehículo, según **estimación** de la DGT sin desglose publicado. No hay estudio riguroso del efecto de la V16. | E | [DGT](https://www.dgt.es/comunicacion/notas-de-prensa/20251125-dgt-recuerda-la-obligacion-de-disponer-de-la-baliza-v-16-para-senalizar-averias-y-accidentes-en-carretera/) · [Maldita.es](https://maldita.es/malditobulo/20251223/no-hay-estudios-que-confirmen-que-hay-25-muertos-al-ano-por-colocar-triangulos-en-carretera/) |
| 10 | Una zona temporal tiene cuatro áreas: aviso anticipado, transición, actividad y terminación. En carretera abierta el aviso anticipado suele ser ≥450 m. | A (EE. UU.) | [MUTCD Parte 6](https://mutcd.fhwa.dot.gov/htm/2009/part6/part6_toc.htm) |
| 11 | La presencia de camiones agrava la severidad del choque secundario. | B | [rosap dot_42625](https://rosap.ntl.bts.gov/view/dot/42625/dot_42625_DS1.pdf) |

**Lagunas:** no se encontró cuantificación fiable del efecto de la noche ni de los «mirones» en sentido contrario. Tampoco hay datos españoles desagregados de secundarios. Esos factores quedan como hipótesis (H) o solo con dirección.

## 2. Casuística (8 mecanismos, `CASEBOOK`)

C1 alcance a vehículo parado en carril · C2 invasión del arcén · C3 atropello de ocupantes fuera del vehículo · **C4 frenada del vehículo de asistencia que llega (caso de investigación)** · C5 empuje en cadena · C6 final de cola · C7 atropello de intervinientes · C8 distracción en sentido contrario.

## 3. Probabilidades condicionadas por circunstancia (simulación, N=3 000 por fila)

Escenario del caso: taxi frenando tras la furgoneta y seguidor detrás. La columna A es sin aviso; la D, con SENDA y política de ventana útil. Estas cifras **ordenan circunstancias**; no son tasas reales.

| Circunstancia | P(alcance) A | × base | P(empuje) A | P(alcance) D |
|---|---|---|---|---|
| Mojado + distancia 0,8 s | 0,70 | ×19,6 | 0,50 | 0,54 |
| Noche + niebla + pesado | 0,58 | ×16,2 | 0,45 | 0,47 |
| Mojado + noche | 0,52 | ×14,7 | 0,31 | 0,40 |
| Mojado (μ 0,45) | 0,31 | ×8,5 | 0,15 | 0,23 |
| Seguidor pesado | 0,23 | ×6,5 | 0,15 | 0,18 |
| Niebla 40 m | 0,15 | ×4,3 | 0,08 | 0,12 |
| Distancia 0,8 s | 0,11 | ×3,2 | 0,06 | 0,09 |
| Noche | 0,095 | ×2,7 | 0,04 | 0,07 |
| **Base** | 0,036 | ×1 | 0,018 | 0,027 |
| **Distancia 2 s** | 0,005 | ×0,14 | 0,001 | 0,003 |

Tabla completa e intervalos de confianza: `evidence/roadsafe/ROADSAFE_RESULTS.md §9`.

**Limitación:** en este modelo, con distancia temporal constante, la velocidad casi no cambia la probabilidad; solo cambia la gravedad (p95 de impacto). Es un efecto del modelo, no una conclusión.

## 4. Conclusiones (para decidir)

1. **El riesgo se concentra en minutos y en un contexto concreto:** vehículo inmovilizado esperando grúa, con carril ocupado o personas fuera (hallazgos 1–3 y 9). En consecuencia, la prioridad pesa **exposición de personas, ocupación de carril, tiempo en escena y espera de grúa**, y el orquestador trata la retirada rápida como medida de seguridad, no de comodidad.
2. **La palanca dominante es física y de comportamiento:** adherencia y distancia de seguridad (§3). El aviso digital reduce el riesgo en todas las circunstancias simuladas, pero **menos que pasar de 0,8 s a 2 s**. Por eso el mensaje a conductores debe describir el peligro con antelación, para que reduzcan velocidad y aumenten distancia, sin dar órdenes.
3. **La detección temprana vale más que la sofisticación:** de ~17 min a segundos (hallazgo 8). La V16 conectada y la declaración del afectado en un toque son el activo principal, siempre sin contarlas como dos fuentes.
4. **El aviso debe vivir en la vía y moverse con la cola:** el −44 % de referencia (hallazgo 7) se logró con avisos **físicos en la vía**. Por eso RoadSafe propone al centro de tráfico paneles y un aviso anticipado que crece con la cola (onda de choque). Los avisos en móviles solo llegan a la fracción conectada.
5. **El caso de investigación (C4) tiene una mitigación concreta y barata:** protocolo de aproximación del vehículo de asistencia (antelación, luces de emergencia, deceleración progresiva, detención fuera del carril y por delante del averiado). Es **hipótesis a validar** con expertos de seguridad vial y no exige ninguna integración.
6. **Ante la duda sobre una vida, primero:** un «atrapado» sin verificar se prioriza y se marca VERIFICAR; nunca se rebaja por baja confianza.

## 5. Qué se implementó con esto

- `assessIncidentRisk`: índice relativo 0–100 y nivel. La física (margen de visibilidad) integra noche, lluvia, niebla y curva sin doble conteo. Con datos incompletos da un rango y usa el peor caso.
- `prioritizeIncidents`: orden lexicográfico explicable (vida, escalada, nivel, índice, SLA, confianza). La reordenación manual exige autor y motivo, y queda registrada.
- `planIncidentZone`:
  - áreas de la zona temporal con su base de cálculo, y cola proyectada por onda de choque;
  - banda de aviso útil (ventana 4–90 s) y paneles PMV **propuestos** para aprobación;
  - indicaciones a intervinientes y polilínea compatible con CIFS.
- `circumstanceGrid`: 11 circunstancias, reproducible.
- Consola: autoevaluación ciudadana, priorización, plan de zona con minutos y ranking científico.

## 6. Próximos pasos de investigación

1. Datos españoles: microdatos de accidentalidad de la DGT (condiciones de acceso por verificar) para calibrar los multiplicadores (`lrPresent` y factores).
2. Validar el protocolo C4 con la DGT, una asistencia en carretera y formadores de intervinientes.
3. Sustituir las referencias MUTCD por la Instrucción 8.3-IC y la regulación de la DGT aplicables.
4. Estudio en simulador (H-ROAD-1) de la reacción ante avisos descriptivos.
