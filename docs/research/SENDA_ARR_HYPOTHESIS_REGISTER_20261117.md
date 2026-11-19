# SENDA ARR — Registro de hipótesis y evidencia · 17 noviembre 2026

> **Todo lo medido aquí es simulación.** Ninguna cifra es una tasa de entrega real, una medida de radio ni una garantía.
> Código: `experimental/senda-arr/`. Cifras completas: `experimental/senda-arr/results/RESULTS.md` y `results.json`.
> Arquitectura, física, riesgos, PI y hoja de ruta: `SENDA_SCIENTIFIC_ARCHITECTURE_20261117.md`.
> No se afirma novedad científica: las piezas son conocidas (ver §4).

## 1. Hipótesis desarrollada: H-ARR-1

**Enunciado.** Con el mismo presupuesto de K réplicas y las mismas rutas candidatas, elegir las réplicas maximizando la probabilidad de entrega calculada sobre un **conjunto de escenarios de peligro** (ARR) consigue más entregas a tiempo y predicciones mejor calibradas que elegirlas suponiendo que los contactos fallan de forma independiente.

**Protocolo** (escrito en `run-experiment.mjs` antes de la ejecución retenida): semillas de desarrollo 1–40 excluidas; semillas retenidas ≥ 1001; ningún parámetro ajustado con datos retenidos; K = 3, 64 miembros, 48 candidatas, 8 saltos; unidad estadística = instancia; diferencias pareadas con números aleatorios comunes; IC 95 % por bootstrap (2000 remuestreos).

**Datos.** Sintético: 200 topologías por nivel de correlación, 30 mundos cada una. Real: perímetros OBSERVADOS de Camp, Carr y Woolsey (USGS GeoMAC 2018 vía NIFC Open Data; procedencia, resolución y SHA-256 en cada fichero), 10 instantes de planificación × 12 topologías por incendio, horizonte 24 h. La topología, los contactos y el desvanecimiento son SIMULADOS.

### Veredicto prerregistrado

| Criterio | Resultado | Cifra |
|---|---|---|
| C1 superioridad con correlación (ρ = 0,6 y 0,9) | Se cumple | +1,2 pp [0,5; 1,9] y +1,7 pp [1,0; 2,4] |
| C2 sin daño a ρ = 0 | Se cumple | +1,5 pp [0,7; 2,3] |
| C3 calibración a ρ = 0,9 | Se cumple | Brier 0,1435 frente a 0,1592; sesgo ARR +2,0 pp |
| C4 peligro real, no inferior / superior | Se cumple | agrupado +0,7 pp [0,2; 1,2] |
| C5 invariantes de seguridad | Se cumple | 0 fallos de auditoría en todas las ejecuciones |

### Lo que los datos dicen de verdad (lectura crítica)

1. **El efecto frente a la ablación fuerte es pequeño:** entre +1,2 y +1,7 puntos de entrega. Estadísticamente distinto de cero, operativamente modesto.
2. **No hay dosis-respuesta con la correlación regional.** La ventaja es la misma a ρ = 0 (+1,5) que a ρ = 0,9 (+1,7). El mecanismo que yo esperaba (diversificar entre regiones) **no queda demostrado**. La explicación compatible con los datos es la dependencia por **relé compartido**: la caída de un nodo tumba todos sus contactos a la vez, a cualquier ρ, y el modelo de independencia por contacto la cuenta mal. Es una hipótesis explicativa, no un resultado.
3. **La ventaja grande es frente a lo que hoy hay en el repositorio**, no frente a la ablación: +4,2 a +5,1 pp sobre k rutas por exclusión de contactos (el `planRoutes` de las ramas SENDA) y unos +25 pp sobre una sola ruta de llegada más temprana, con las mismas ≈ 12 transmisiones.
4. **Calibración:** ARR sobreestima unos +2 pp de forma sistemática con 64 miembros y +6,2 pp con 8. Es el sesgo del optimizador (se elige el máximo con los mismos escenarios con que se evalúa). La independencia subestima entre −2 y −7 pp. ECE 0,02 frente a 0,05–0,06.
5. **En incendios reales la superioridad la sostiene un solo incendio:** Woolsey +2,0 pp [0,8; 3,4]; Camp −0,1 y Carr 0,0 (empates). El resultado no cambia con la censura temporal del perímetro. El pronóstico de incendio es pesimista: sesgo −7,0 pp.
6. **Si el pronóstico está mal, la ventaja desaparece.** Planificador que cree ρ = 0: +0,3 pp [−0,7; 1,3]. Planificador que cree la mitad de pérdida de nodos: +0,6 pp [−0,2; 1,3] y sesgo de calibración +12,8 pp.
7. **Queda lejos del techo.** La inundación epidémica entrega 89–92 % frente a 80 % de ARR, a costa de ≈ 5 veces más transmisiones (59–66 frente a 12–13). Un plan estático de origen no recupera una réplica cuando cae un relé.

### Ablaciones (ρ = 0,9, 150 semillas retenidas)

| Variante | Resultado | Conclusión |
|---|---|---|
| K = 1 / 2 / 4 | −0,1 [−0,9; 0,7] · +0,9 [−0,1; 1,8] · +1,2 [0,5; 1,9] | Sin réplicas no hay ventaja; con K = 2 no es concluyente |
| Sin candidatas por escenario | −0,3 pp [−0,8; 0,2] | **No aportan.** Pieza prescindible |
| Sin desviaciones (nodo/contacto) | +3,1 pp a favor de tenerlas [2,1; 4,1] | La diversidad de candidatas es lo que más pesa |
| CVaR λ = 0,5 (bien y mal especificado) | 0,1 · 0,2 · −0,3 pp, IC incluyen 0 | **Resultado negativo:** la aversión al riesgo no ayuda aquí |
| Conjunto de 8 miembros | +0,9 pp [−0,1; 2,0] | No concluyente y peor calibrado |
| Éxito por contacto 0,80 | +0,5 pp [−0,4; 1,4] | No concluyente cuando domina el desvanecimiento |
| Pérdida de nodos 0,20 / 0,50 | +1,3 [0,6; 2,1] · +1,6 [0,8; 2,4] | Estable |
| Malla más dispersa (grado 5) | +1,2 pp [0,4; 2,1] | Estable; 32 % de instancias sin ruta |
| Voraz frente a óptimo exhaustivo | razón media 0,996, mínima 0,941, óptimo en 62 % | Muy por encima de la garantía 0,632 |

**Coste.** Planificación completa (candidatas + cinco métodos) p50 ≈ 82 ms, p95 ≈ 130 ms; selección ARR sola p50 ≈ 19 ms, en un núcleo de servidor con ≈ 900 contactos. No medido en un teléfono.

### Informe de fallos y límites

- **Línea base débil:** spray-and-wait binario (8 copias) entrega ≈ 9 %. En una malla casi estática de 5–7 saltos es una debilidad conocida del esquema; no debe usarse como argumento a favor de ARR.
- **Instancias excluidas:** 9 % sintéticas y 30 % de incendio no tienen ninguna ruta antes del plazo y quedan fuera de todas las medias.
- **Sesgo de selección en incendios:** origen y destino se eligen entre nodos que no arden en el registro; la evaluación es condicional a eso.
- **Riesgo de sobreajuste:** bajo en parámetros (ninguno ajustado), pero el diseño del generador sintético y de la topología es mío; otro generador puede dar otro tamaño de efecto. La lectura rápida previa usó 30 semillas retenidas sin cambiar el diseño después.
- **Marca temporal de GeoMAC** no verificada de forma independiente (posible ambigüedad de zona horaria); el primer perímetro de Camp ya cubre 54.586 acres.
- **No modelado:** capacidad compartida, colisiones, ciclo de trabajo como presupuesto de tiempo en el aire, reintentos entre ventanas, relojes desajustados, energía en espera.

**Decisión.** H-ARR-1 se acepta **solo en su forma literal y débil**: mejora pequeña y calibrada frente a la independencia, clara frente a los enrutadores actuales. La explicación por correlación regional queda **no confirmada**. El módulo permanece en `experimental/` y no debe integrarse en una ruta de producción ni citarse como ganancia de entrega real.

## 2. Hipótesis propuestas (cinco) y prioridad

Formato: problema · por qué no basta lo actual · formulación · prototipo · predicción · refutación · tres alternativas · riesgos · valor/PI.

### H1 — ARR (desarrollada arriba) · prioridad 1
Problema: réplicas multisalto con fallos de causa común. Lo actual supone independencia (`routeMessage`) o trata solo portadores en paralelo (`delivery-assurance`). Formulación y prototipo: §3 de la arquitectura y `arr-core.mjs`. Predicción y refutación: criterios C1–C5. Alternativas comparadas: CGR llegada más temprana, CGR k-exclusión, voraz con independencia (más top-k, epidémico, spray). Riesgos: pronóstico sesgado, coste 2^K. Valor: banco de pruebas y calibración; PI baja.

### H2 — Asimilación de observaciones en el conjunto · prioridad 2
- **Problema:** el pronóstico de incendio usado aquí es un prior sin datos de viento y sale sesgado (−7 pp); con pronóstico erróneo ARR pierde su ventaja (ablación).
- **Insuficiencia actual:** los miembros tienen peso uniforme y no aprenden del último perímetro.
- **Formulación:** pesos `w_m ∝ w_m · L(perímetro observado | miembro m)`, con verosimilitud sobre la distancia firmada entre frente predicho y observado; remuestreo cuando el tamaño efectivo `1/Σw²` cae por debajo de M/2 (filtro de partículas SIR).
- **Prototipo:** extender `fireForecastEnsemble` con un paso de actualización; sin dependencias.
- **Predicción:** Brier de pérdida de nodo a 24 h baja ≥ 15 % y |sesgo| de la probabilidad de entrega ≤ 3 pp en incendios retenidos.
- **Refutación:** si en ≥ 4 incendios retenidos (incluido uno europeo) el Brier no mejora con IC 95 %, se descarta.
- **Alternativas:** prior actual; persistencia (el frente no avanza); modelo elíptico con viento observado sin asimilación.
- **Riesgos:** cadencia irregular de perímetros; colapso de pesos.
- **Valor/PI:** técnica estándar; el valor es el conjunto de casos validados.

**Resultado H2 (ejecutado en esta misma iteración): RECHAZADA.** Código `src/arr-forecast.mjs`, protocolo `experiments/run-forecast-experiment.mjs`, cifras `results/FORECAST_RESULTS.md`. 34 unidades (incendio × instante), 300 puntos cada una, resultado OBSERVADO «el frente llega en ≤ 24 h» (tasa base 5,4 %).

| Pronóstico | Brier | Sesgo |
|---|---|---|
| Persistencia (el frente no avanza) | 0,0539 | −5,4 pp |
| Prior sin asimilar | 0,1214 | +9,6 pp |
| Asimilado (prerregistrado) | 0,0943 | +6,3 pp |

- Prior − asimilado: 0,0271 [−0,0008; 0,0668]: reducción del 22 %, pero el IC toca el cero → criterio no cumplido.
- **Ambos conjuntos son peores que la persistencia** (diferencia −0,040 [−0,080; −0,012]). El modelo geométrico de propagación sobrepredice el avance y no tiene pericia demostrada.
- Defecto encontrado por un test sintético: con el templado prerregistrado el filtro casi no se mueve (tamaño efectivo 346 de 384). Una ejecución **exploratoria post hoc** con templado más débil (`FORECAST_RESULTS.exploratory.md`) mejora en Carr y Woolsey, empeora en Camp y sigue sin batir a la persistencia. No se ajustó más.
- **Consecuencias:** (1) el sesgo pesimista de ARR en incendios (−7 pp) viene de aquí; (2) este pronóstico **no debe mostrarse como aviso a la población**: el visor lo rotula «pericia no demostrada» junto a cada aviso; (3) la siguiente alternativa no es otro filtro sino otra física.
- **Alternativa seleccionada (H2b, P0):** modelo con viento observado (reanálisis ERA5/HRRR en la fecha del incendio) y una regla de velocidad de avance publicada (p. ej. la del 10 % de Cruz y Alexander, 2019, ya referenciada en `fire-cases.mjs` de las ramas SENDA), evaluado con el mismo protocolo y la persistencia como línea base obligatoria.

### H3 — Replanificación por custodio · prioridad 3
- **Problema:** 10–12 pp de brecha frente al techo epidémico.
- **Insuficiencia actual:** el plan se fija en origen; una réplica muere con su primer salto fallido.
- **Formulación:** cada custodio ejecuta ARR con horizonte restante, presupuesto restante de réplicas y el conjunto condicionado a lo que ha observado (política de horizonte deslizante).
- **Prototipo:** bucle de eventos sobre `executePlan` reutilizando `planAdaptiveResilience`.
- **Predicción:** recuperar ≥ 50 % de la brecha con ≤ 2× las transmisiones de ARR estático.
- **Refutación:** si recupera < 25 % o supera 3× transmisiones en semillas retenidas.
- **Alternativas:** ARR estático, epidémico, spray-and-focus.
- **Riesgos:** coste en el dispositivo, bucles de custodia, consistencia del presupuesto de réplicas sin coordinación.
- **Valor/PI:** medio; cercano a literatura de enrutado DTN con incertidumbre.

### H4 — Señales de oportunidad como sonda de enlace · requiere hardware
- **Problema:** predecir `p` por contacto sin medir cada enlace ni tocar dispositivos ajenos.
- **Insuficiencia actual:** modelos de relieve (ITU-R P.1812) ignoran obstrucción local.
- **Formulación:** regresión de la pérdida en exceso sobre `C/N0` por satélite GNSS (máscara de cielo) y RSSI de tramas propias.
- **Predicción:** reducir el error absoluto medio de pérdida de trayecto ≥ 3 dB frente a solo relieve en ubicaciones no vistas.
- **Refutación:** campaña con ≥ 30 enlaces LoRa EU868 medidos y validación por ubicación retenida.
- **Alternativas:** P.1812 solo; Okumura–Hata; trazado de rayos con edificios.
- **Riesgos:** regulatorio nulo en recepción; privacidad de posición; transferencia entre entornos.
- **Valor/PI:** el más diferencial si se confirma, porque exige datos propios de campo.

### H5 — Intervalos conformales sobre recibos firmados · depende de datos
- **Problema:** el sesgo del optimizador (+2 a +6 pp) y la falta de garantía de cobertura.
- **Formulación:** predicción conformal dividida sobre el residuo `predicho − observado` de recibos; da intervalo con cobertura marginal `1 − α` sin supuestos de distribución (intercambiabilidad).
- **Predicción:** cobertura empírica 90 ± 3 % donde la cota de Hoeffding falla.
- **Refutación:** cobertura fuera de ese rango en datos retenidos; pierde validez si cambia el régimen de peligro.
- **Alternativas:** cota de Hoeffding actual; posterior Beta-Binomial de `delivery-assurance`; bootstrap.
- **Valor/PI:** bajo en novedad, alto en credibilidad ante revisores.

**Tres prioritarias:** H1 (hecha), H2 y H3. H4 y H5 esperan a hardware y recibos.

## 3. Requisitos antes de cualquier afirmación externa

1. Reproducir: `node experimental/senda-arr/experiments/run-experiment.mjs` (≈ 25 min) y comparar con `results.json`.
2. Medir `p` por contacto con hardware real y repetir el experimento con esos valores.
3. Revisión externa de la estadística y búsqueda de anterioridades.

## 4. Fuentes

- Nemhauser, Wolsey y Fisher (1978), *An analysis of approximations for maximizing submodular set functions*, Math. Programming 14.
- Rockafellar y Uryasev (2000), *Optimization of conditional value-at-risk*, Journal of Risk 2.
- Spyropoulos, Psounis y Raghavendra (2005), *Spray and Wait*, ACM WDTN.
- Gordon, Salmond y Smith (1993), *Novel approach to nonlinear/non-Gaussian Bayesian state estimation*, IEE Proc. F 140.
- Vahdat y Becker (2000), *Epidemic Routing for Partially-Connected Ad Hoc Networks*, Duke CS-2000-06.
- RFC 9171 (BPv7), RFC 9172 (BPSec); CCSDS Schedule-Aware Bundle Routing (CGR).
- ITU-R P.526 (difracción), P.1812 (punto-área terrestre), P.618 (Tierra-espacio); ETSI EN 300 220 (SRD, ciclo de trabajo).
- USGS GeoMAC Historic Perimeters 2018, NIFC Open Data (capa y consulta en cada `data/geomac-2018-*.json`).
- Trabajo previo en este repositorio: `SENDA_SCIENTIFIC_GAPS_20261117.md` (H1–H8 del agente anterior), PR #34/#35/#38.

Las referencias bibliográficas se citan de memoria y deben comprobarse contra la fuente antes de publicarlas.

## 5. Checkpoint

- Base: `74631c0` (PR #38). Rama: `ccr-ea048c78-86gcio`.
- Tests: 22 propios + 31 heredados, todos pasan en local.
- Siguiente experimento: H2b (viento observado + regla de avance publicada) con la persistencia como línea base y al menos un incendio europeo retenido.
