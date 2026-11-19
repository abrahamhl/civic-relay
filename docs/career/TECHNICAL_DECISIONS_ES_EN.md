# SENDA — decisiones de ingeniería y razonamiento algorítmico | Engineering decision record

**Actualizado:** 2026-11-18 · **Formato:** caso de estudio para selección técnica y revisión independiente.  
**Repositorio:** [Civic Relay / SENDA](https://github.com/abrahamhl/civic-relay) · **Código de referencia:** [commit `78bfd87`](https://github.com/abrahamhl/civic-relay/commit/78bfd87e98d959296d3cada61dadeac47db4c596), en [PR #51](https://github.com/abrahamhl/civic-relay/pull/51). **Esos módulos no están necesariamente en `master` ni en la web publicada.**

> **Autoría y precisión.** Las prioridades de producto, preguntas de investigación y exigencia de pruebas se recogen de los briefs y las iteraciones dirigidas por el promotor del proyecto; la implementación, los tests y esta documentación han contado con asistentes de IA. La autoría de *cada línea* o la formulación inicial exacta de *cada algoritmo* no se infiere del nombre de quien dirige el proyecto. Una fórmula previa de la literatura no se anuncia como nueva ciencia.

## 1. Pregunta original que articula RoadSafe

Una avería en el arcén, una V16 y un taxi que llega no bastan para evitar un choque secundario si quien se aproxima no sabe **qué peligro encontrará primero, si el aviso es auténtico y cuánto tiempo le queda**. El proyecto parte de un caso de coordinación vial aportado por el promotor: la asistencia y la detención de otros vehículos introducen riesgos secundarios; la comunicación entre partes es fragmentada.

De ese problema derivan cinco preguntas verificables: (a) ¿cuál es la identidad real del incidente si se replica en varios feeds? (b) ¿puede localizarse el peligro sobre la calzada y el sentido correctos? (c) ¿se desplaza el final de la cola? (d) ¿cuándo dejaría de ser útil una advertencia? (e) ¿qué evidencia existe de que un canal *entregó* el mensaje, y no solo lo aceptó?

### Mapa de decisiones y evidencia (no tabla de características comerciales)

| Decisión y alternativa descartada | Fundamento técnico | Prueba auditable y límite | Aplicación profesional transferible |
|---|---|---|---|
| **Identidad causal antes de cantidad de mensajes.** No contar tres copias DGT/DATEX/BLE como tres testigos | `rootId`, `incidentKey`, familia de independencia y firma/atestación; deduplicar sin borrar sucesos distintos | [`normalizeRoadReport`, `fuseRoadReports`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-road-alert-network.mjs); autenticación externa sigue siendo condición necesaria | Event sourcing, integración entre APIs, correlación de incidencias industriales |
| **Localización vial antes de GPS aislado.** No advertir por cercanía geométrica sin calzada/sentido | Map-matching declarado, PK/chainage, incertidumbre y descarte de peligro detrás | [`buildElectronicHorizon`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-road-alert-network.mjs); mapas reales por carril aún no validados | Contexto espacial, trazabilidad de activos móviles |
| **Final de cola móvil antes que punto estático del accidente.** No asumir umbral universal de 500 m | Dos observaciones espaciotemporales y cinemática por intervalos; contraste opcional LWR | [`projectQueueTailEnvelope`, `lwrShockSpeed`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-queue-reachability.mjs); escenarios únicamente sintéticos | Forecasting responsable, modelos con condiciones de validez |
| **Dependencias de fallo antes que sumar canales.** No prometer independencia BLE + móvil + pasarela | Dominios de fallo; cotas de unión de Fréchet; estratos de medición | [`evaluateCoverageBounds`, `assessCoverageAtQueueDeadline`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-coverage-bounds.mjs); sin fiabilidad física medida | Resiliencia de SaaS/OT, SRE, SLAs y observabilidad |
| **Atención humana antes que volumen de alertas.** No confundir alerta creada con conductor informado | Arbiter determinista de HMI, prioridades, límites de repetición y opt-in | [`createDriverAlertArbiter`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-alert-arbiter.mjs); no ensayo de distracción real | UX para operaciones críticas, diseño de alarmas industriales |
| **Autorización verificable antes que publicidad técnica.** No anunciar conexiones DGT/Waze/112 inexistentes | Plan de difusión bloqueado sin derecho, consentimiento, enlace y atestación | [`planRoadAlertDistribution`](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-road-alert-network.mjs); crea plan, no transmite | Control de acceso, privacidad, integraciones B2B gobernadas |

## 2. Matemáticas: lo conocido, la adaptación y lo que queda por demostrar

**Modelo de tráfico existente, no inventado:** en LWR, conservación unidimensional `∂k/∂t + ∂q/∂x = 0`; velocidad teórica de una discontinuidad `w = (q₂ − q₁)/(k₂ − k₁)`. La aportación de SENDA **no** es esa ecuación, sino usarla como chequeo de coherencia dentro de un sistema de decisiones con múltiples incertidumbres y posibilidad de abstenerse. Fuente externa: [FHWA, Traffic Flow Theory, capítulo 5](https://www.fhwa.dot.gov/publications/research/operations/tft/chap5.pdf).

**Modelo original del prototipo SENDA — H-ROAD-RRE-1:** con dos observaciones de la **misma** cola `s₁ ± ε₁`, `s₂ ± ε₂` y `Δt > 0`, el rango de velocidad de la frontera se acota por `[(s₂−ε₂−s₁−ε₁)/Δt, (s₂+ε₂−s₁+ε₁)/Δt]`, aplicando signos conforme al código y a la orientación del mapa. Luego se proyecta un intervalo de posición y de distancia al conductor; se incorpora el tiempo de comunicación, reacción y desaceleración con rangos explícitos. **No** es un intervalo estadístico de confianza, una orden de frenado ni un certificado de distancia segura. El código puede responder `ABSTAIN` cuando faltan mediciones, cuando el comportamiento queda fuera de la región acotada o cuando los extremos no permiten una conclusión.

**H-ROAD-COVER-1:** el intervalo de Wilson aproxima una tasa de éxito *solo* bajo supuestos de muestreo Bernoulli representativo e independiente. Si no se conoce la dependencia entre canales, el prototipo usa `máx(pᵢ) ≤ P(∪ eventos de entrega) ≤ mín(1, Σpᵢ)`. Esta cota se fundamenta en probabilidad elemental; la unión de intervalos marginales **no** produce por sí misma un intervalo conjunto de confianza del 95 %. Fuente sobre confirmaciones de entrega en redes tolerantes a retrasos: [IETF RFC 9171](https://www.rfc-editor.org/rfc/rfc9171.html). No se afirma conformidad integral BPv7.

### Resultado reproducible sin extrapolación comercial

El [experimento de 4.000 escenarios sintéticos](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/evidence/roadsafe/reachability-synthetic-20261118.json) usa semilla fija. Frente a un baseline deliberadamente simple de 500 m, el modelo de intervalos produjo **0 falsas declaraciones de suficiencia dentro de esos supuestos**, mientras el baseline produjo 6. El modelo robusto declaró 1.946 escenarios con margen, 2.008 como indeterminados. **Eso NO mide reducción de accidentes, cobertura física, precisión predictiva en carretera ni fiabilidad operacional.** Es una prueba de propiedades internas de un modelo bajo hipótesis que contienen deliberadamente la verdad sintética.

## 3. Decisiones organizativas derivadas de la ingeniería

1. Separar **evidencia de observación**, **propuesta de modelo**, **simulación**, **resultado de test**, **resultado en hardware** y **capacidad autorizada en producción**.
2. Registrar y corregir defectos que alteran el significado del dato (por ejemplo, una confianza `0,85` inventada, una localización por defecto o un falso IC 90 %), antes que embellecer visualizaciones.
3. Evitar modificaciones directas en producción: rama temática → PR → pruebas adversariales → CI → revisión humana → decisión de integración.
4. Diseñar interfaces con un estado `UNKNOWN` significativo. Un acuse de custodia, un HTTP `202`, un dispositivo conectado o un test verde no demuestran que una persona haya recibido una alerta útil.
5. Conservar los escenarios originales de emergencias y los módulos previos. El estudio profesional **no añade ni sustituye funciones**.

## 4. English — technical explanation for a recruiter

**Problem framing.** A breakdown report, V16 beacon and arriving taxi may refer to one evolving scene, yet approaching drivers first encounter the moving queue tail. The engineering question is not merely where an incident sits, but which evidence is trustworthy, whether it matches the driver's carriageway, how the queue is moving, and whether a verified message can reach the recipient before a deadline.

**My role, stated conservatively.** I framed and prioritised user scenarios and demanded auditable outcomes, coordinated a multi-model AI-assisted workflow and pushed the prototype toward falsifiable safety decisions rather than attractive simulations. AI agents contributed code, analytical suggestions and tests. Per-commit human authorship and individual algorithm invention are **not** established by this summary.

**Three explicit trade-offs:** (1) model a moving hazard envelope rather than rely on a static GPS point; (2) treat correlated routes as correlated instead of multiplying independent-success probabilities; (3) return an abstention or an unknown state rather than fabricate source confidence or dispatch success. LWR wave theory, Wilson intervals and Fréchet bounds are **existing mathematics**. The proposed novelty is their constrained system-level combination for road-safety research; it has not been independently established as a scientific discovery.

**How to verify:** inspect the pinned source and experiments above; review [RoadSafe PR #51](https://github.com/abrahamhl/civic-relay/pull/51), its tested head SHA and CI, and reproduce the experiment with `node packages/senda/scripts/roadsafe-reachability-experiment.mjs` on that branch. An applicant can explain the trade-offs, edge cases and failure modes, without asserting field radio performance or partnerships.

**Skills relevant to industrial IT:** data contracts, event correlation, resilience under degraded networks, audit trails, reliability measurement, access-control gates, incident workflows, safety-aware interfaces and cross-functional technical direction. **Not claimed:** PLC/SCADA programming, certified functional safety engineering, production deployment for emergency services or independent discovery of new physical laws.