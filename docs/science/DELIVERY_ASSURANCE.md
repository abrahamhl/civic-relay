# SENDA · Motor de Garantía de Entrega (`delivery-assurance.mjs`)

**Fecha:** 2026-11-10 · **Módulo:** [`packages/senda/src/delivery-assurance.mjs`](../../packages/senda/src/delivery-assurance.mjs) · **Tests:** [`packages/senda/tests/delivery-assurance.test.mjs`](../../packages/senda/tests/delivery-assurance.test.mjs) (10) · **Evidencia:** [`evidence/senda/delivery-assurance.json`](../../evidence/senda/delivery-assurance.json) (`node packages/senda/scripts/delivery-assurance-benchmark.mjs`)

## 1. Problema

El planificador multiportador (`bearers.mjs`) reparte fragmentos Reed-Solomon k-de-n entre canales (móviles cercanos, datos, SMS, LoRa, Iridium, relé por satélite…) y calcula **exactamente** la probabilidad de recibir ≥k fragmentos. Para hacerlo supone que **los canales fallan de forma independiente**.

En una catástrofe no ocurre así. Los fallos tienen **causa común**:

- Un **apagón** agota las baterías de las antenas en horas (apagón ibérico del 28-04-2025). Caen **a la vez** datos móviles, SMS y el relé del vecino, que también necesita corriente.
- Una **tormenta** degrada el enlace satelital en banda Ku (≈12 GHz). Apenas afecta a Iridium (1,6 GHz) o a LoRa (868 MHz).

Suponer independencia **sobrestima la fiabilidad justo en el peor momento**.

## 2. Método (cinco piezas encadenadas)

| # | Pieza | Formulación | Verificación |
|---|---|---|---|
| 1 | Fallos de causa común | Mezcla de estados de peligro *h* con P(*h*). Condicionado a *h*, los canales son independientes: P(≥k) = Σₕ P(h)·PBₕ(≥k), con PB = Poisson-binomial agrupada por programación dinámica (exacta) | Con un único estado se reduce **exactamente** al modelo independiente; coincide con Monte Carlo de 200 000 muestras (±4σ) |
| 2 | Física → probabilidad | Lluvia → atenuación ITU-R P.838-3 × trayecto → margen restante → desvanecimiento Nakagami-m → P(éxito por intento). Se aplica la degradación **relativa** a cielo despejado | Con 50 mm/h, Ku pierde > 3 dB (medido: 6,4 dB) y LoRa e Iridium < 0,1 dB |
| 3 | Aprendizaje bayesiano | Posterior Beta-Binomial por canal a partir de recibos firmados. Prior centrado en el valor de planificación (4 pseudo-observaciones). Por defecto se planifica con la **cota inferior** del intervalo creíble al 90 % (restricción de azar) | CDF y cuantil Beta contra formas cerradas; conjugación exacta; con 100 veces más datos el intervalo se estrecha más de 5 veces |
| 4 | Optimización | Para un n fijo: multiarranque (equilibrado, concentrado, aleatorio con semilla) + máxima pendiente con movimientos **de bloque** + búsqueda local iterada. Reducción por **simetría exacta** (mensajes intercambiables del mismo canal). n adaptativo con paciencia ante mesetas | **Óptimo exacto en 60 de 60** instancias aleatorias frente a enumeración exhaustiva (el test exige ≥57/60 y una brecha < 0,005) |
| 5 | Certificado | SHA-256 de {módulo, versión, entradas, plan} en JSON canónico (claves ordenadas, números a 12 cifras) | Determinista; independiente del orden de las claves; cambia si cambia cualquier entrada |

## 3. Resultados (simulación, mismas probabilidades de canal para ambos planes)

Mensaje de 380 B. Canales: móviles cercanos, datos, SMS, LoRa, Iridium y relé satelital. Escenario: P(normal) = 0,25, P(apagón) = 0,35, P(tormenta) = 0,20, P(apagón + tormenta) = 0,20.

| Plan | Promete | Entrega real (fallos correlacionados) | Peor estado (apagón + tormenta) | Fragmentos | Coste |
|---|---|---|---|---|---|
| Independiente (`bearers.mjs`) | 99,49 % | **96,09 %** | 90,87 % | 6 | 0 € |
| Garantía de entrega, 0 € | — | **98,98 %** (3,8× menos fallos) | 97,61 % | 22 | 0 € |
| Garantía de entrega, sin límite | — | **99,99 %** (≈590× menos fallos) | 99,98 % | 23 | 3 € (Iridium) |
| Garantía de entrega, 0 €, 6 fragmentos | — | 96,09 % (sin mejora) | 90,87 % | 6 | 0 € |

**Lectura honesta:**

- El planificador independiente **no mejora subiendo su objetivo**: promete el 99,49 % y entrega el 96,09 % en cualquier caso, porque reparte copias del mensaje completo entre canales que caen juntos.
- La ganancia del motor nuevo viene de **diversificar entre familias no correlacionadas**: fragmenta más fino para poder usar LoRa. Ese es el precio: **más tiempo de aire** (22 fragmentos frente a 6). Con el mismo número de fragmentos no hay ganancia, y el test lo comprueba.
- Tiempo de planificación: 2–4 s en el modo exhaustivo (por defecto) y 0,4–1,2 s en el rápido (`effort: 'fast'`), que da planes algo peores (98,47 % frente a 98,98 % a 0 €).

## 4. Por qué es difícil de replicar

1. **El foso son los datos.** Cada recibo firmado actualiza el posterior por canal y zona. Un competidor puede copiar el código, pero no el historial de entregas reales de una red desplegada.
2. **La cadena física → probabilidad → decisión → certificado** une modelos que normalmente viven separados (propagación ITU, fiabilidad bayesiana, optimización combinatoria y auditoría criptográfica).
3. **La garantía es medible.** La brecha de optimalidad se comprueba contra el óptimo exacto en cada ejecución de los tests; no se promete.

## 5. Limitaciones (declaradas)

- **Los efectos de cada estado de peligro son hipótesis de planificación** (`DEFAULT_HAZARDS`): por ejemplo, la familia terrestre al 15 % durante un apagón. Proceden de la cronología pública del apagón del 28-04-2025, no de medidas propias. Se sustituyen por datos de los operadores o se corrigen con recibos.
- **Los perfiles de radio (`RADIO_PROFILES`) son nominales.** Margen y longitud de trayecto típicos, no de un enlace concreto.
- **Independencia dentro de cada estado.** Dos mensajes por el mismo canal pueden seguir correlados (por ejemplo, el mismo vecino). El modelo de mezcla captura la causa común dominante, no toda la dependencia.
- **Óptimo verificado solo en instancias pequeñas** (≤ 5 mensajes, n ≤ 12), donde la enumeración es posible. En instancias grandes es un método heurístico sin cota formal.
- **Todo es simulación** (`SIMULATED`) hasta tener pilotos de campo con recibos reales.

**Confianza: 85 %.** Las matemáticas son exactas y están verificadas por tests. La magnitud de la mejora depende de los efectos supuestos de cada estado de peligro.
