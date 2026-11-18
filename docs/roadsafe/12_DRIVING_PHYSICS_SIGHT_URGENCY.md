# 12 · Conducción: visibilidad calculada desde el trazado y urgencia física de cada aviso

> Iteración VII · 18-11-2026 · Firma: Claude (Asistente de Orquestación Senior)
> **Regla de veracidad.** Las fórmulas son física y geometría. Los parámetros (reacción, μ, despeje lateral, umbrales de frenada) son **escenarios declarados**: `roadsafe-drive-physics.mjs` no trae ningún valor por defecto.

## 1. 🎯 Hueco que cierra

Antes de esta iteración había tres piezas sueltas: el horizonte (qué hay delante), el presupuesto de atención (qué se dice) y la distancia de parada (`drive-cases.mjs`). El orden de los avisos no tenía en cuenta **cuánto habría que frenar**. Tampoco sabía si el peligro está **escondido tras una curva**: la visibilidad se introducía a mano.

## 2. 🧮 Capacidades nuevas (`packages/senda/src/roadsafe-drive-physics.mjs`)

| Función | Qué calcula |
|---|---|
| `sightDistanceAlong(road, fix, {clearanceM, maxM, stepM})` | Visibilidad hacia delante calculada con la polilínea de la vía. Un objetivo a distancia d es visible si ningún punto intermedio se separa de la visual más que el despeje lateral. Sirve para cualquier trazado, incluidas las curvas en S. |
| `requiredDecel` (DRAC) | Deceleración necesaria para parar antes del peligro tras el tiempo de reacción. Usa la velocidad relativa si el peligro avanza, como una cola que se mueve. |
| `maxSpeedToStopWithin` | La inversa: velocidad máxima para parar dentro de una distancia dada. |
| `physicalUrgency` | Clasifica cada aviso en INFO, PREPARE, BRAKE o IMMINENT. IMMINENT significa que la DRAC alcanza μ·g, es decir, que no se puede parar. Además marca **OCULTO** el peligro que queda más allá de la visibilidad y dentro de la zona de parada, y aconseja una velocidad máxima. |
| `urgencyPhrase` | Frase en ES/EN/NL: «Frena ya», «Peligro oculto tras la curva: reduce (≤ X km/h)». |

**Cambios en el planificador de atención (`roadsafe-attention.mjs`):**

- La urgencia física se convierte en la primera clave de orden.
- Lo que obliga a frenar **no se raciona**: salta el presupuesto y la separación mínima.
- Un aviso «tardío» se rescata si está oculto o si exige frenar. Si los ojos no lo ven, la percepción directa no basta.

## 3. ✅ Validación contra la geometría analítica

La visibilidad en una curva circular se compara con la fórmula de la ordenada media, S = 2R·acos(1 − M/R). Los valores numéricos los calcula este código:

| Radio R | Despeje M | Numérico | Analítico |
|---|---|---|---|
| 200 m | 6 m | 98 m | 98,2 m |
| 400 m | 8 m | 160 m | 160,3 m |
| 800 m | 5 m | 178 m | 179,0 m |

DRAC y velocidad máxima se comprueban como funciones inversas (error < 10⁻⁶).

| Suite | Resultado |
|---|---|
| Núcleo y defensa | 794/794 |
| Adversariales | 31/31 |
| Chromium | 74/74 |

## 4. ⏳ Límites y pendientes

- **Solo planta.** No contempla el perfil vertical (cambios de rasante) ni obstáculos concretos como muros o vegetación. Para eso hace falta un modelo digital del terreno.
- **Umbrales sin calibrar.** Los umbrales de frenada (preparar, frenar) son de diseño. Hay que calibrarlos con un piloto o con literatura verificada.
- **Rozamiento.** El coeficiente μ depende del firme y del neumático. Lo debe aportar quien llama, por ejemplo desde los sensores del coche (ABS/ESC activos en `vehicle-link.mjs`) o desde la meteorología.
- **Tarea aparte propuesta.** Auditar los valores por defecto sin fuente en `drive-cases.mjs` y `road-guard.mjs` (μ, reacción, umbrales de choque).
