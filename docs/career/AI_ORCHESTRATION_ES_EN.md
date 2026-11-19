# SENDA — Dirección de producto, orquestación de IA y trazabilidad de autoría

**2026-11-18 · Documento profesional ES/EN · Metodología de trabajo, no un sistema de agentes autónomos validado industrialmente.**

> La **aportación demostrable del promotor** es establecer problemas de usuario, requisitos, prioridades, criterios de aceptación, exigencias de veracidad y revisión de resultados. Claude, ChatGPT, DeepSeek, Antigravity, Codex/OpenCode y otros asistentes se utilizaron en distintas iteraciones para investigación, programación, documentación y auditoría. No consta que todos se ejecutaran simultáneamente, ni que existiera independencia estadística entre sus evaluaciones. **La aprobación de un asistente no sustituye revisión humana ni auditoría externa.**

## La idea de dirección: IA como equipo supervisado, no como argumento de autoridad

El trabajo está organizado alrededor de una pregunta operativa que aparece repetidamente en los briefs del proyecto: *«¿Qué tendría que pasar, con qué evidencia, para que esta funcionalidad fuese segura y útil fuera de una demo?»* Esta pregunta lleva a tomar decisiones de diseño, dividir el trabajo en experimentos y exigir resultados vinculados al repositorio. La documentación refleja los briefs y la actividad visible; no prueba quién redactó cada función.

```text
Problema observado / necesidad real
       ↓
Hipótesis falsable + límites + dato necesario
       ↓
Contrato técnico + criterios de aceptación + amenaza principal
       ↓
Agente de implementación (rama y commits aislados)
       ↓
Revisión crítica y pruebas negativas (separación de funciones)
       ↓
CI + trazabilidad de datos + auditoría humana
       ↓
PR en borrador / decisión explícita: MERGE, REWORK o NO-GO
       ↓
Validación física, jurídica e institucional independiente antes de operación
```

### Qué decido y qué delego (sin exagerar atribuciones)

| Responsabilidad | Dirección humana / promotor | Herramientas IA | Evidencia y control |
|---|---|---|---|
| Descubrimiento del problema | Proponer escenarios, definir qué daño se pretende evitar y qué usuario necesita ayuda | Ampliar hipótesis, investigar antecedentes, proponer alternativas | Briefs, decisiones registradas, casos de uso |
| Arquitectura de producto | Priorizar restricciones de seguridad, permisos, offline y utilidad mínima | Proponer módulos y contratos; señalar trade-offs | [Visión maestra](../product/CIVIC_RELAY_VISION_MAESTRA_2026-10-25.md), PR y documentación técnica |
| Desarrollo y experimentos | Dar alcance, métricas, aceptación y rechazo de claims | Escribir/proponer código y tests en ramas | Archivos, cambios, CI, pruebas adversariales |
| Auditoría | Exigir que los hallazgos sean reproducibles y que no se oculte incertidumbre | Buscar fallos, generar casos adversariales, inspeccionar lógica | [Informe de límites RoadSafe](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/docs/roadsafe/13_ROBUST_QUEUE_REACHABILITY_RESEARCH.md) |
| Selección de versión | Determinar prioridades y decidir qué se presenta como prototipo | Sugerir correcciones y redactar documentación | SHA inmutable, PR, checks y decisión humana |
| Operación de emergencias | **No existe autorización operativa ni validación física** | No debe crear decisiones de riesgo para personas reales | Prohibición de atribuir pilotos simulados a servicio operativo |

### Cinco controles prácticos aplicados al trabajo con modelos

1. **Descomposición disciplinada:** pedir módulos y verificadores pequeños, no una promesa global de «sistema completo». Priorizar seguridad y la cadena de evidencias.
2. **Frontera entre productor y evaluador:** una segunda revisión cuestiona los supuestos; no se presume independencia cuando los agentes comparten datos, prompts o código.
3. **No aceptar confianza decorativa:** un valor por defecto, un `PASS` sin ejecución o una descripción de demo no certifican fiabilidad. La ausencia de información debe permanecer marcada `UNKNOWN`/`ABSTAIN`.
4. **Trazabilidad exacta:** registrar qué rama y SHA produjo cada resultado, qué tests pasaron, qué se simuló y qué no se comprobó; no equiparar preview Vercel, código de PR y `master`.
5. **Preservación del producto:** cambios aislados, revisión previa de conflictos, no fusionar/desplegar automáticamente ante fallos P0, y no destruir funciones ya existentes por optimizar el currículum.

### Caso demostrativo: una corrección que importa más que una captura bonita

En el núcleo de carretera se investigaron valores de confianza por defecto, etiquetas `LIVE_VERIFIED` sin evidencia, un token de laboratorio escrito en código y un intervalo llamado «90 %» sin calibración estadística. La línea de trabajo priorizó que *dato ausente ≠ dato validado*. También se separaron las autorizaciones de canal de su simple presencia técnica. Véanse los cambios y pruebas de [PR #50](https://github.com/abrahamhl/civic-relay/pull/50) y la investigación posterior de [PR #51](https://github.com/abrahamhl/civic-relay/pull/51).

**Caso de dirección científica:** se revisó si un aviso de peligro podía llegar antes de alcanzar una cola móvil. En lugar de anunciar «prevención de accidentes» por un test verde, se impuso un experimento sintético reproducible, un baseline explícito, un modelo de abstención y la necesidad posterior de medir vehículos/dispositivos reales. [Resultado archivado a SHA fijo](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/evidence/roadsafe/reachability-synthetic-20261118.json).

## Prueba de competencia ante un equipo de contratación

Un entrevistador puede pedir: **(a)** explicar un diseño a partir de un problema humano concreto; **(b)** identificar un supuesto oculto en un algoritmo; **(c)** describir cómo un asistente de IA introdujo o detectó una hipótesis incorrecta; **(d)** mostrar un test adversarial; y **(e)** justificar por qué se detuvo una integración. Estos son ejemplos de conversación; no se afirma que todas las revisiones fueran realizadas personalmente línea a línea.

**Respuesta fiel:** «Mi contribución se centra en planteamiento de producto, definición de requisitos, coordinación de herramientas de IA, integración orientada a pruebas y exigencia de evidencias. El código incluye contribuciones generadas o asistidas por IA; puedo demostrar decisiones, errores corregidos, pruebas y límites, y distinguirlos del trabajo que requeriría un ingeniero de seguridad certificado.»

## English — how I direct AI-assisted engineering

**Positioning:** *Human-led product and engineering direction, AI-assisted implementation, adversarial validation and evidence-based release gates.* I have used multiple AI coding/research assistants across separate iterations, not as an unverified claim of a permanently autonomous team. I set the use cases, guardrails, review priorities and acceptance criteria. AI tools helped create and critique implementations, experiments and documentation. I do **not** claim personally to have authored every line, invented established scientific formulae, or performed hardware validation that has not occurred.

**The workflow:** operational scenario → falsifiable hypothesis → technical contract → isolated implementation → challenge with counterexamples → deterministic and browser tests → exact commit/CI references → human go/no-go → field validation where required.

**Recruiter-ready example:** a road-event source could silently invent `0.85` confidence and tag an observation `LIVE_VERIFIED`. The safer architectural response was to preserve an unknown state, prevent unsupported sensor fusion, require channel authorization and test negative cases. This is transferable to industrial incident workflows, SaaS implementation, data integrity and operational AI governance.

**What the evidence actually proves:** software tests and documented reviews of specific commits. It does not establish independent code authorship, formal safety certification, hardware delivery rates, signed public-sector agreements or compliant deployment in factories.

**Alignment reference, not certification:** NIST's [AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) describes governance, documentation, testing and human oversight as relevant risk-management practices. SENDA's workflow can be discussed against these principles; no NIST compliance audit is claimed.