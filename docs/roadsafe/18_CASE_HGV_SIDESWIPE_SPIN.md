# Caso real · Camión contra turismo en autopista, trompo de 180° y coche inmovilizado en el carril rápido

**Origen:** declaración escrita de un conductor implicado, aportada por el fundador el 2026-11-18. **Anonimizada**: no se guardan el texto literal, la fecha exacta ni la ubicación precisa (solo «autopista, Bélgica»). **Es la versión de una de las partes y NO está verificada.** No establece responsabilidades: SENDA no juzga culpas.

## Secuencia declarada

| Fase | Qué ocurre | Qué exige a SENDA |
|---|---|---|
| 1 | El turismo circula por el carril derecho. La esquina de la cabina de un camión le golpea el lateral izquierdo (le arranca el espejo) | Detectar un impacto **lateral**, no solo frontal |
| 2 | El turismo queda empujado contra el frontal del camión y es **arrastrado varios metros**, casi perpendicular | Contacto **sostenido**, no un único impulso |
| 3 | El camión se va al arcén derecho; el turismo sale despedido hacia la izquierda y **gira ~180°** | El rumbo final no dice nada de la calzada |
| 4 | Golpea la barrera izquierda y queda **inmovilizado en el carril rápido, mirando contra el tráfico** | Avisar a quien llega por detrás; no confundirlo con un «kamikaze» |
| 5 | Posiciones finales: camión en el **arcén derecho**, turismo en el **carril rápido** | Un incidente con dos posiciones; manda la más peligrosa |
| 6 | Otros conductores pitan y dan las luces; sin heridos graves | Su riesgo era el impacto secundario: el aviso a los que llegan es lo que salva vidas |

## Lo que el caso ha destapado y se ha corregido

1. **Fallo de seguridad en `hazardRelevance` (road-guard).** Para un accidente o un vehículo parado, el código descartaba el aviso si el rumbo del emisor difería del propio: «circula en otro sentido». En la fase 4, **todos los coches que llegaban por detrás habrían ignorado el aviso de accidente** (reproducido con 180° y 90°).
   - **Corrección:** en peligros estáticos el rumbo solo se usa si es fiable, es decir:
     - la trama trae el rumbo de **marcha** anterior al suceso (`HAZARD_FLAGS.TRAVEL_HEADING`),
     - o el sentido viene de geometría o de una fuente oficial,
     - o el emisor todavía se mueve.
   - Si no es fiable, **se avisa** marcado `carriagewayUncertain`. Una posible falsa alarma en la otra calzada es menos grave que callar un coche atravesado en tu carril.
   - **Nuevo:** `travelHeadingBefore()` calcula el rumbo de marcha anterior al choque. Si no hay datos, devuelve `null` y no se inventa.
2. **Gemelo del incidente (`roadsafe-incident-twin`).**
   - Solo sabía representar «arcén» y «carril derecho»: **el carril rápido era imposible**. Ahora: `LEFT_LANE`, `MIDDLE_LANE`, `RIGHT_LANE`, `SHOULDER` y `LEFT_SHOULDER`.
   - Asignaba **p = 0,6 sin fuente** a una pista. Ahora `p: null` (es una pista, no una medida).
   - La ubicación salía solo de la **primera** observación. Si el primero en avisar era el camión del arcén, se perdía el coche del carril rápido. Ahora se guardan todas las posiciones declaradas y la vista pública muestra la **peor** (`occupiedLanes`, `liveLaneBlocked`).
3. **Guion del 112:** dice el carril y «orientado contra la circulación» **solo si se declara**.

Prueba de regresión: `packages/senda/tests/roadsafe-case-hgv-sideswipe.test.mjs` (5 pruebas). La prueba adversarial P0-2/6 se ha ampliado con el caso del coche girado sin perder su intención: un peligro de la otra calzada con sentido fiable sigue sin avisar.

## Lo que el caso NO puede hacer

- **No calibra ningún umbral.** No hay velocidades, tiempos, distancias ni aceleraciones medidas. Convertir la narración en números sería inventarlos (`CLAUDE.md` §1).
- **Límite del modelo de física** (`roadsafe-crash-physics`): es **impulsivo** (un solo contacto instantáneo). No representa el contacto sostenido ni el arrastre de las fases 2–3, ni puede predecir que el coche acabe en el carril opuesto al inicial. Queda anotado como fuera de alcance; no se ha tocado el modelo.
- **No se ha cambiado la guía** «¿quedarse o salir?»: con el coche en carril de circulación ya da prioridad ALTA y no llama sola al 112. La recomendación concreta junto a una mediana sigue pendiente de validación con la DGT/112.

## Qué datos lo convertirían en un caso de calibración (con consentimiento del implicado)

| Dato | Para qué | Estado |
|---|---|---|
| Atestado policial / croquis | Posiciones, distancias, carriles | Por pedir |
| Registro de datos de eventos (EDR) del turismo | Δv y velocidad previa | Obligatorio en turismos nuevos de la UE según el Reglamento (UE) 2019/2144: **a verificar** para este modelo y año |
| Tacógrafo digital del camión | Velocidad del camión antes y durante el suceso | Registra velocidad: **a verificar** la resolución y el acceso |
| Cámaras (dashcam propia o de otros) | Secuencia y tiempos | Desconocido |
| Historial GNSS del móvil | Velocidad y trayectoria | Desconocido |
| Peritaje del seguro | Daños y deformaciones | Desconocido |

Cualquier dato medido entraría por `calibration-gates.mjs` con procedencia y hash, y solo en el conjunto reservado para la prueba.

## Privacidad

- El repositorio es **público**. No se publica el texto literal ni datos que identifiquen al conductor, el vehículo, la fecha o el punto exacto.
- Si el implicado tiene una reclamación abierta, esta ficha **no** es una prueba pericial ni una opinión sobre la culpa.
