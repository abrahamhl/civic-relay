# SENDA · Validación matemática y numérica

Fecha: 2026-11-08  
Estado: revisión interna; no sustituye una auditoría externa.  
Evidencia: `packages/senda/tests/*.test.mjs`, `evidence/senda/mission-95/`.

## 1. Propagación de incendios

### 1.1 Núcleo de Rothermel

`wildfire.mjs` implementa el núcleo de Rothermel: carga de combustible, relación superficie/volumen, humedad de extinción, viento y pendiente. `directionalRos` combina la ROS de cabeza con una elipse de viento:

- `head = 1 + a·U^b`, con `U` en km/h; `a = 0,18`, `b = 1,25` en la implementación actual.
- `ecc = sqrt(1 − 1/lb²)`, con `lb` la relación longitud/anchura.
- ROS direccional: `R(θ) = R_head·(1 − ecc)/(1 − ecc·cos(θ − θ_wind))`.
- El foco de ignición se coloca en el foco trasero de la elipse, no en el centro geométrico.

El modelo es determinista y sin spotting, corona, supresión ni interacción con la atmósfera. Es un modelo operativo de orden de magnitud, no un certificado de seguridad.

### 1.2 Pendiente

`slopeK = 5,275·β^(−0,3)` y factor `1 + slopeK·tan²(θ)`, con `β` la pendiente adimensional. Solo se aplica cuando la pendiente es positiva (cuesta arriba). La fórmula es una aproximación de Rothermel; no se ha calibrado contra un conjunto independiente.

### 1.3 Llegada sobre malla real

`arrivalOnField` resuelve un problema de camino mínimo dependiente del tiempo:

- Estados: celdas de la malla.
- Aristas: vecindad 16 (incluye saltos de caballo).
- Peso: `dist / max(ROS, 1e-3)`, con `ROS` evaluada en la celda origen y en el instante de llegada.
- Viento: `windAt(i,j,t)` en m/s (u este, v norte); se convierte a km/h con `×3,6`.
- Cola de prioridad binaria; se encola el valor ya redondeado a `Float32` para evitar descartes por comparación de precisión.

Consecuencias:

- La solución es un frente de Dijkstra, no una solución de Eikonal de alta resolución.
- La vecindad 16 permite que el frente salte una franja de una celda; una franja de tres celdas sí lo detiene (test existente).
- La ROS se evalúa en la celda origen; `wildfire` usa la media armónica origen/destino. En dirección cardinal y sin viento ambos coinciden (test de consistencia); en general pueden diferir.
- No hay término de difusión, radiación ni convección; el ensemble introduce incertidumbre de viento y ROS, no física nueva.

### 1.4 Ensemble

`ensembleArrival` perturba dirección, velocidad y ROS con log-normal/normal y ejecuta `arrivalOnField` por miembro. `pAt(t)` devuelve probabilidad en 0–100 por celda. La probabilidad es monótona en `t` por construcción. El ensemble no está calibrado; sus bandas son de sensibilidad, no intervalos predictivos validados.

### 1.5 Validación contra cicatriz

- `burnedMask(T, t)` marca celdas con `T ≤ t`.
- `jaccard(a,b) = |a∩b| / |a∪b|`; convención `1` si la unión es vacía.
- `sorensen(a,b) = 2|a∩b| / (|a|+|b|)`; convención `1` si la suma es cero.
- `timeForArea(T, cells)` compara a igualdad de área.
- `circleNull(F, ign, cells)` construye el círculo de la misma área.
- `skillVsNull(J, J0) = (J − J0)/(1 − J0)`; se lanza si `J0 ≥ 1` porque la habilidad no está definida.

Limitaciones:

- La cicatriz Sentinel-2 tiene resolución y tiempo de adquisición distintos del frente simulado.
- La comparación a igualdad de área reduce la dependencia de la hora de ignición, pero no elimina el sesgo de perímetro.
- No hay validación contra partes oficiales de incendio ni contra varios incendios independientes en esta misión.

### 1.6 Cámaras y señales

- `makeCamera`, `pixelRay`, `projectPoint`: modelo estenopeico en ENU.
- `rayTerrain` y `lineOfSight`: intersección rayo-terreno por marcha y bisección; no modelan refracción atmosférica.
- `closestPointToRays`: mínimos cuadrados 3D; devuelve `ok:false` si el sistema es degenerado.
- `plumeHeatFromHeight` y `plumeHeatFromRise`: inversión de Briggs; orden de magnitud.
- `flickerSpectrum`: DFT de la serie de brillo; `peakHz` y `bandRatio`.
- `flickerToWidthM = (1,5/f)²`: aproximación de «puffing»; no es una ley universal.
- `syncOffset`: correlación cruzada; requiere al menos 2 muestras.

Ninguna de estas funciones está validada con cámaras reales en esta misión.

## 2. Enrutado DTN

### 2.1 Modelo de contactos

Un contacto es `{from, to, start, end, channel, confidence, failed?}`. La duración de transferencia es:

`duration = fragmentsNeeded(channel, sizeBytes) · transferSeconds(channel, min(sizeBytes, maxBytes), rateBps)`

La energía es un proxy del catálogo de canales, no julios. No hay colas, contención, SNR ni consumo en reposo.

### 2.2 Estrategias

- `direct`: solo fuente→destino.
- `flooding`: intenta enviar en cada contacto; cuenta duplicados.
- `epidemic`: inunda solo a nodos que aún no tienen el mensaje.
- `spray`: spray-and-wait con 16 copias; reparte la mitad.
- `earliest`: ruta de llegada más temprana calculada una vez sobre `planningContacts` (tipo CGR).
- `adaptive`: replanifica con `planningContacts`, tope de 12 portadores y evita relés con energía ≥3.
- `eaor` (Energy-Aware Opportunistic Routing): planifica hasta `k` rutas edge-disjoint, puntúa `onTime·confidence/(1+energy/energyScale)`, filtra por `confidence ≥ minConfidence`, envía una copia por ruta y respeta presupuesto de energía y deadline.

### 2.3 Supuestos de EAOR

- La confianza de cada contacto es independiente. Si los fallos están correlacionados, el producto de confianzas sobreestima la fiabilidad.
- Las rutas son edge-disjoint, pero pueden compartir nodos.
- La energía se acumula como proxy; no se modela la energía restante por nodo.
- El plan usa `planningContacts` (predicción); la simulación usa `contacts` (realización con `failed`).
- La selección top-k por score no es óptima en sentido estricto; es una heurística. En el escenario `unreliable-contacts` selecciona BLE, LoRa y dos rutas de señuelo, y excluye la ruta WiFi rápida pero muy poco fiable.

### 2.4 Contactos reabiertos

Si un portador llega a un nodo mientras una ventana de salida ya está abierta (`start < t < end`), el simulador reabre el contacto una vez. Esto corrige la brecha store-carry-forward del simulador v1. La reapertura no crea contactos nuevos ni cambia la ventana.

### 2.5 Estadística

El benchmark v2 separa:

- Grafos independientes (`independentGraphs`).
- Realizaciones por grafo (`realizationsPerGraph`).
- Repeticiones de escenarios deterministas (`deterministicRepeats`), que no se cuentan como réplicas.

Intervalos: bootstrap percentil sobre grafos independientes, `B = 2000`, semilla fija. En `unreliable-contacts` las realizaciones comparten grafo; el IC remuestrea grafos, no realizaciones. Los deltas son pareados por grafo y exploratorios; no hay corrección por comparaciones múltiples.

Resultado principal (`unreliable-contacts`, 30 grafos × 20 realizaciones):

| Estrategia | Entrega | IC 95 % | Latencia media (s) | Transmisiones/entrega | Energía/entrega |
|---|---:|---|---:|---:|---:|
| earliest | 0,112 | 0,092–0,132 | 81,5 | 2,00 | 6,00 |
| eaor | 0,977 | 0,965–0,987 | 156,7 | 4,92 | 7,05 |
| adaptive | 0,985 | 0,975–0,993 | 148,2 | 5,52 | 7,46 |
| epidemic | 0,988 | 0,980–0,997 | 140,7 | 5,88 | 8,75 |

EAOR no domina a epidemic/adaptive: entrega algo menos y es más lento, pero usa menos energía y transmisiones. Frente a `earliest` (CGR-like), el delta de entrega es +86,5 pp (IC 95 %: 84,2–88,8), a costa de +75,7 s de latencia y +1,05 unidades de energía por entrega. La afirmación defendible es «mejora sustancial en fiabilidad bajo contactos no fiables con un coste moderado», no «óptimo global».

## 3. Mapa de pruebas

| Propiedad | Prueba |
|---|---|
| No negatividad, causalidad y consistencia analítica | `fire-audit.test.mjs` |
| Consistencia `fire-field` vs `wildfire` en cardinal | `fire-audit.test.mjs` |
| Viento fuerte, cota física y no finitos | `fire-audit.test.mjs` |
| Ensemble determinista y fail-closed | `fire-audit.test.mjs` |
| Métricas, longitudes y habilidad indefinida | `fire-audit.test.mjs` |
| `assessAssets` sin antena | `fire-audit.test.mjs` |
| EAOR rutas, copias y energía | `eaor-routing.test.mjs` |
| EAOR vs earliest con fallo de ruta rápida | `eaor-routing.test.mjs` |
| Contacto reabierto a mitad de ventana | `eaor-routing.test.mjs` |
| Benchmark v2: esquema y pseudo-réplica | `routing-benchmark-v2.test.mjs` |
| Paridad web del núcleo | `web-parity.test.mjs` |

## 4. Limitaciones declaradas

- El modelo de fuego no está calibrado contra perímetros oficiales.
- El modelo de viento no resuelve micrometeorología ni acoplamiento atmósfera-fuego.
- La propagación no incluye spotting, corona, supresión ni combustibles dinámicos.
- El DTN es sintético; no hay trazas reales de encuentros.
- La confianza de contacto es declarada, no medida.
- La energía es un proxy adimensional; no hay medición en julios.
- No hay validación física, auditoría externa ni certificación.

Cualquier afirmación de seguridad o de rendimiento en una emergencia real queda BLOCKED hasta completar el plan de validación física.
