# RoadSafe · Tres investigaciones principales (preregistro)

No se reivindica descubrimiento ni patentabilidad: no se ha hecho búsqueda de antecedentes (patentes/literatura) en esta sesión. La diferenciación propuesta es de **ingeniería e integración**, pendiente de revisión independiente.

---

## H-ROAD-1 · Anticipación de colisiones secundarias con ventana útil de aviso

- **Problema:** ¿cuándo un aviso digital sobre un vehículo detenido reduce el riesgo de alcance y cuándo lo aumenta (distracción, aviso tardío, calzada equivocada)?
- **Estado del arte (conocimiento previo, a revisar):** tiempos de percepción-reacción (Green, 2000: ≈0,7–0,75 s prevenido; ≈1,25 s inesperado; AASHTO usa 2,5 s y 3,4 m/s² para diseño); avisos de colisión frontal (FCW) en vehículos; guías NHTSA 2013 de distracción visuo-manual (miradas ≤ 2 s); C-ITS «stationary vehicle warning».
- **Diferenciación posible:** política explícita de **abstención** que combina confianza de fuente, calzada, error de posición, ventana temporal y beneficio estimado con IC, sobre fuentes federadas con linaje.
- **Matemática:** `d_stop = v·t_r + v²/(2·η·μ·g) + margen`; impacto residual `v_i = √(v² − 2a(d − v·t_r))⁺`; MC pareado; IC de Wilson; onda de choque LWR `w = Δq/Δk`.
- **Supuestos:** 1D longitudinal; deceleración constante; aviso aceptado ⇒ reacción «prevenida» y reducción de velocidad (rangos hipotéticos); aviso tardío ⇒ retraso por distracción (hipotético).
- **Baselines:** A (sin digital), B (V16 informativa sin entrega supuesta), C (canal autorizado).
- **Protocolo:** barridos de headway, visibilidad, adopción, latencia; controles negativos NC1–NC4; después, **estudio en simulador de conducción** con preregistro (n por condición calculado por potencia) y, solo con autorización, piloto observacional.
- **Datasets disponibles:** ninguno del caso. Candidatos: microdatos de accidentalidad DGT (condiciones de acceso por verificar), datos de aforo DATEX II (NAP), estudios naturalísticos (SHRP2 — acceso restringido).
- **Métricas:** P(alcance), P(empuje secundario), velocidad de impacto p50/p95, antelación útil, cobertura efectiva, avisos tardíos suprimidos/mostrados, falsas alarmas.
- **Rechazo:** si en simulador el grupo con aviso no reduce reacción ni velocidad de aproximación (IC95 de la diferencia incluye 0) o aumenta miradas > 2 s, se rechaza la política de WARNING y queda solo ADVISORY.
- **Resultado actual (simulación, no evidencia real):** el factor dominante es la **distancia temporal** (headway 0,6 s → P≈0,19; 2 s → P≈0,005). La mejora atribuible a avisos es **marginal** con adopción baja (adopción 10 %: 0,0357 → 0,0333) y crece con adopción (60 %: → 0,024). NC4: con retraso por distracción hipotético, mostrar avisos tardíos **triplica** el riesgo (0,036 → 0,112) y la política lo evita. La magnitud de NC4 depende enteramente del parámetro hipotético.
- **Limitaciones:** sin validación de factores humanos; modelo 1D; sin geometría real.
- **Coste:** simulador universitario 3–6 meses (estimación a validar).
- **Valor institucional:** criterio auditable de cuándo NO avisar, aplicable a cualquier proveedor que consuma DGT 3.0.

## H-ROAD-2 · Fusión heterogénea con deduplicación causal

- **Problema:** la misma V16 aparece en varias capas (dispositivo → DGT 3.0 → navegadores); contarlas como independientes produce corroboración falsa.
- **Estado del arte:** fusión bayesiana con dependencia de fuentes; H-FUS-1 de SENDA (principio reutilizado).
- **Matemática:** log-odds aditivos solo entre raíces independientes; representante más reciente por raíz; decaimiento por semivida; índice de contradicción `min(pos,neg)/max(pos,neg)` con abstención.
- **Baseline:** Bayes ingenuo (`naive:true`).
- **Resultado (episodios sintéticos):** corroboración falsa **1,00 (ingenuo) → 0,00 (causal)**; sensibilidad 1,00 → 0,21. La pérdida de sensibilidad es deliberada: una V16 sola no es corroboración. El umbral (p ≥ 0,9) es una elección de diseño a calibrar.
- **Datasets:** registros etiquetados DGT 3.0 + NAP + informes de patrulla (requiere convenio).
- **Rechazo:** si con datos reales la tasa de falsas corroboraciones causales no es menor que la ingenua con IC95, o la sensibilidad cae por debajo del umbral operativo acordado con el centro de tráfico.
- **Limitaciones:** las razones de verosimilitud (`lrPresent`) son hipótesis; requieren calibración (Brier/ECE).

## H-ROAD-3 · Coordinación multiagente con confirmaciones verificables

- **Problema:** con proveedores independientes, latencias inciertas y fallos parciales, ¿cómo evitar afirmar movilizaciones que no ocurrieron sin bloquear la ayuda?
- **Matemática/semántica:** máquina de estados monotónica con fuente por transición; relevo «make-before-break» (el original solo pasa a HANDED_OVER cuando el nuevo confirma); detección de retrasos por SLA/ETA.
- **Baseline:** «2xx = enviado».
- **Resultado (banco contractual):** en 7 escenarios de fallo, el baseline afirmaría «enviado» en 5; el contrato nunca afirma llegada sin declaración del proveedor, marca `ACK_SIN_REFERENCIA`, `COMPLETADO_SIN_LLEGADA`, `DELAYED`.
- **Rechazo:** si en piloto con un proveedor real aparece algún estado mostrado al ciudadano sin respaldo en el registro del proveedor.
- **Limitaciones:** simuladores, no proveedores reales; autenticación de webhooks delegada a la capa de transporte.
