# SENDA — Guion de entrevista técnica | Technical interview brief

**Uso:** entrevista de empleo en IA aplicada, SaaS, implantación industrial, gestión de producto técnico o transformación digital. **No es un certificado ni una oferta comercial.** Los últimos experimentos enlazados están en [PR #51](https://github.com/abrahamhl/civic-relay/pull/51), todavía no integrados en `master` al documentarlo.

## Presentación de 45–60 segundos (ES)

«SENDA es un proyecto propio de investigación de software para coordinación de emergencias y avisos en carretera. Partí de un problema concreto: cuando un coche queda inmovilizado y se coordinan una grúa, un taxi y la señalización, la información llega fragmentada y un conductor puede encontrarse antes con una cola de vehículos que con el accidente original. Planteé escenarios, requisitos y límites de seguridad y coordiné herramientas de IA para desarrollar, revisar y poner a prueba los módulos. El prototipo incluye identidad de incidentes, trazabilidad de fuentes, predicción acotada del final de cola y modelos de cobertura que no asumen independencia de canales. Lo que puedo enseñar son pruebas reproducibles y una interfaz de laboratorio; no pretendo que sea una red de emergencias operativa. Lo interesante para una empresa es esa forma de convertir procesos reales y complejos en software verificable.»

## 45–60 second introduction (EN)

“SENDA is my research software project for emergency coordination and road-hazard awareness. The starting point was a concrete workflow problem: a broken-down vehicle, a tow truck and an arriving taxi can create a secondary-collision risk while the information remains fragmented. I defined scenarios, requirements and safety boundaries, and coordinated AI-assisted development and critical review. The prototype explores incident identity and provenance, bounded moving-queue predictions and delivery modelling that does not assume communication links are independent. I can show reproducible tests and a laboratory interface—not a certified or live emergency service. For an employer, the value is how I translate operational problems into testable software and manage the implementation process.”

## Preguntas difíciles y respuestas que puedes respaldar

**«¿Qué has programado personalmente?»** Explica con exactitud qué escribiste tú, qué revisaste, qué propusieron los agentes y qué puedes explicar delante del código. No afirmes haber redactado cada implementación si no consta. Abre un archivo y explica una decisión, un edge case y un test.

**«¿Cuál es el algoritmo innovador?»** No es descubrir la teoría LWR ni la desigualdad de Fréchet: ambas existían. La hipótesis de ingeniería es **combinar** trayectoria del final de cola, incertidumbre de posición, plazos de entrega y decisión conservadora (`ABSTAIN`) en un mismo análisis reproducible. Falta validación real y comparación independiente con sistemas existentes.

**«¿Cómo has utilizado ChatGPT, Claude, DeepSeek y Antigravity?»** Para segmentar investigación e implementación, pedir revisiones críticas, generar pruebas negativas, comparar cambios, documentar decisiones y exigir CI. Aclara que los nombres de agentes no son un número de empleados ni garantizan auditoría independiente.

**«¿Por qué no despliegas ya?»** Porque un test de navegador no demuestra radio BLE entre coches, la conexión real a DGT/112/Waze ni que una persona haya recibido a tiempo el aviso. Hay que medir, firmar acuerdos y validar factores humanos.

**«¿Cómo trasladarías esto a una fábrica?»** Una incidencia de máquina puede modelarse como `evento → evidencia y origen → gravedad/estado → responsable → acuse de recepción → cierre verificable`. Propondría primero una integración limitada con software de mantenimiento y datos autorizados, sin afirmar conocimientos prácticos de PLC/SCADA que aún deban acreditarse.

**«¿Y si falla la IA?»** Las decisiones deben tener criterios previos, fuentes, tests reproducibles, una revisión que busque falsos positivos y una opción de abstención. No se acepta una respuesta de modelo como autoridad factual.

## Demostración de 3 minutos

1. **30 s:** explicar el incidente y el objetivo de evitar una segunda colisión.
2. **45 s:** abrir [el estudio de caso](RECRUITER_CASE_STUDY_ES_EN.md) y señalar la separación entre origen, observación, decisión y entrega.
3. **60 s:** inspeccionar [el código del predictor con límites](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/src/roadsafe-queue-reachability.mjs) y [las pruebas](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/packages/senda/tests/roadsafe-queue-reachability.test.mjs).
4. **30 s:** enseñar [el resultado sintético archivado](https://github.com/abrahamhl/civic-relay/blob/78bfd87e98d959296d3cada61dadeac47db4c596/evidence/roadsafe/reachability-synthetic-20261118.json); diferenciar un invariante interno de rendimiento en carretera.
5. **15 s:** conectar el mismo patrón con integración SaaS, mantenimiento industrial y mejora de procesos.

**Cierre de la conversación:** «Me interesa especialmente trabajar en un equipo que necesite combinar conocimiento operativo, tecnología web, herramientas de IA y gestión de implantaciones B2B, desde España, colaborando con equipos internacionales en inglés y, cuando ayude, neerlandés básico.»