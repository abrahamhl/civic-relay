# SENDA — Decisiones científicas independientes (2026-11-17)

**Estado:** documento de investigación, no aprobación de lanzamiento. **Rama de origen:** master @ b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40. **Revisión de PR:** #32, #38, #39, #42, #44 el 17-11-2026. Todas en DRAFT/abiertas al consultar. No modifica producción ni incorpora código experimental.

## 0. Decisión ejecutiva

**Investigación PRINCIPAL = P1, fiabilidad físico-experimental de custodia, transporte y fallo común de SENDA.** Construir un expediente verificable de extremo a extremo entre dos Android y radios propias/autorizadas, con recibo del DESTINATARIO, recuperación tras corte, persistencia, bitácora y medición de airtime/energía. Sin eso no se puede vender una tasa de entrega ni calibrar las probabilidades usadas por los motores.

**SECUNDARIA S1 = H-ARR-R, replanificación robusta por custodio sobre grafo temporal con presupuestos distribuidos.** Tiene potencial para aprovechar la brecha estático-epidémico detectada en #44. Reutiliza ARR, H11–H16, CGR y persistencia; prohíbe crear un quinto router. Primero pruebas simuladas y shadow; después reproducción controlada sobre trazas físicas.

**SECUNDARIA S2 = H-FIRE-B, pronóstico físico causal de propagación con abstención.** H2 no se reabre ni se maquilla: es un resultado NEGATIVO. La alternativa física deberá superar persistencia y climatología/velocidad constante, con eventos disjuntos, datos solo disponibles en tiempo de emisión, incertidumbre y trazabilidad de observaciones. No alimenta decisiones reales de evacuación.

**Puertas transversales obligatorias:** autenticidad institucional (CAP Actual cerrado), fusión sin doble contabilización, offline con procedencia, abstención cuando la incertidumbre supere límites y reconciliación explícita de ramas.

## 1. Auditoría Git exacta

| Elemento | HEAD examinado | Base / estado | Evidencia y limitación |
|---|---|---|---|
| master | b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40 | rama por defecto | No incluye los motores de los PR en borrador |
| #44 ARR/H2 | ce9ab69fbae2773f3256659197c9d83937fca9b8 | base audit/senda-agent1-durable-lab-20261117 (#38); draft | ARR research gate y emergency lab CI con success a ese HEAD; el gate ARR solo ejecutó tests y smoke rápido de routing, **no reprodujo en CI el experimento completo H2 ni sus 34 unidades**; simulación exclusivamente |
| #38 durabilidad | 74631c052605ecca3f8517c6e6327363bf11e126 | base audit/senda-agent1-two-sandbox-20261117; draft | Journal Node con fsync/ACK sintético; Android tiene otro journal, no duplicarlo |
| #32 expansión | cdabff3ee28422080ac05ec0be252fe385006bd3 | base feat/senda-funding-mission-day1; draft | Android compilado, plataforma amplia aún no integrada a master; una ejecución SENDA estaba in_progress en esta consulta |
| #39 seguridad | d7ed6bd80a0500f12b71f54c805bee5733291700 | base claude/promotional-video-prompts-p5vzh8; draft | Correcciones CAP/Ed25519; comprobar base exacta de #32 al integrar |
| #42 H11–H16 | d8feb5e523f51e809c3ea4c01d25da5ade9c74eb | base audit/senda-pr32-safety-gates-20261117 (#39); draft | Cinco workflows success al HEAD; oráculos LP y tests son sintéticos, no ensayos RF |

Comparación GitHub: master...#44 = 26 commits ahead, 0 behind, merge-base b8360c9; #44...#42 = **diverged** (ambos conservan ancestro 4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3); master...#32 = **diverged** (362 ahead / 1 behind en la comparación de GitHub). Por tanto, una afirmación previa del dossier de #44 («sin ancestro común») no se sostiene para los HEAD actuales: **sí hay merge-base en los pares consultados**, pero divergir mucho sigue impidiendo una integración automática segura. La PR #42 parte de una instantánea #39 y no hereda automáticamente todos los commits nuevos de #32.

**Dependencias:** rama A: master → #34 → #35 → #38 → #44. Rama B: línea #32 → snapshot de #32 usado por #39 → #39 → #42. Los dos grafos deben auditarse en worktrees separados; no hacer cherry-pick de toda una rama ni fusionar PR.

**CI no equivale a calidad operativa:** el workflow senda-arr-ci.yml lanza tests y una ejecución quick del experimento de routing, no reproduce las cifras del informe de forecast H2.  workflows verdes en HEAD #44/#42 verifican casos programados. No hay certificado, ensayos RF, homologación ni comprobación de ruta real. El árbol master declara pnpm 9.12.3 y dependencias root i18next ^26.4.2, react-i18next ^17.0.13; el módulo ARR utiliza Node 22 sin dependencias propias nuevas. Antes de cambiar código: comprobar lockfile, versiones concretas y licencias del árbol HEAD relevante.

## 2. Resultados científicos existentes: interpretaciones defendibles

**ARR H-ARR-1 (#44):** simulación retenida +1,2 pp (rho=.6) y +1,7 pp (rho=.9) frente a selección con independencia, aproximadamente +4–5 pp frente a CGR k-exclusión sintético. No hay incremento monotónico con rho; la explicación de «ganancia por correlación regional» no está identificada. La inundación epidémica alcanza ~89–92 % frente ~80 % de ARR pero requiere ~5 veces transmisiones. Topologías, probabilidades de radio y costes son sintéticos. Incendios Camp y Carr prácticamente empatan; Woolsey sostiene el resultado agregado. Eliminar conclusiones fuertes del agregado de tres incendios.

**H2 (#44): RECHAZADA:** 34 instantes/incendio (12 Camp, 12 Carr, 10 Woolsey), 300 puntos por unidad, tasa observada 5,4 %. Brier persistencia=.0539; prior=.1214; asimilado=.0943. Prior menos asimilado=.0271 con IC 95 % [-.0008,.0668]; persistencia menos asimilado=-.0403 [-.0798,-.0123]. El asimilado no supera persistencia. Más importante: las 34 unidades comparten **solo 3 incendios**, por lo que un bootstrap por instante no permite inferencias entre incendios. La etiqueta en run-forecast-experiment.mjs toma el último perímetro publicado hasta t0+24h; si no cubre todo el horizonte, esa etiqueta es censurada, no un negativo probado a 24h. La unión de anillos puede representar mal islas interiores y las fechas de mapeado no equivalen al instante de llegada física. Historial de cambios/observaciones y relojes necesitan auditoría.

**H11–H16 (#42):** matemáticamente útiles y auditados con oráculos sintéticos: incertidumbre de mezcla de estados, dependencia arbitraria de fragmentos, frecuencia con categoría UNKNOWN, intervalos anytime bajo IID, SRLG y cortes N−1/N−2, reconstrucción k-de-n superviviente. **No generar otro motor de fiabilidad**; requerir un adaptador de incertidumbre compartido e inventario de riesgos físicos, no deducir independencia de dos portadores con nombres diferentes.

## 3. Matriz de 10 propuestas, puntuación 1–5

Escala común: 5 = más favorable. I=impacto en coordinación; V=viabilidad actual; E=evidencia científica; D=diferenciación defendible; C=coste/operación offline favorable (5=barato/eficiente); X=validación externa posible; R=riesgo favorable (5=bajo riesgo legal/técnico). Ponderación propuesta I25 %, V15 %, E12 %, D13 %, C8 %, X17 %, R10 %. Son **juicios de priorización, no resultados experimentales**.

| ID | Línea de investigación | I | V | E | D | C | X | R | Total /5 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 | Custodia física verificable BLE/Wi-Fi/LoRa y fallos comunes | 5 | 4 | 5 | 4 | 3 | 5 | 4 | 4.46 |
| P2 | Replanificación robusta por custodio y presupuesto de copias | 5 | 4 | 4 | 5 | 3 | 4 | 3 | 4.20 |
| P3 | Abstención verificable y límites de confianza en decisiones | 5 | 4 | 4 | 3 | 5 | 5 | 4 | 4.37 |
| P4 | Fusión de evidencia con procedencia y dependencias | 5 | 3 | 4 | 4 | 3 | 4 | 3 | 3.92 |
| P5 | Predicción de incendio física causal y calibrada | 5 | 3 | 5 | 4 | 2 | 4 | 2 | 3.86 |
| P6 | Pantallas científicas offline con fuentes y abstención | 4 | 5 | 4 | 3 | 5 | 5 | 5 | 4.37 |
| P7 | Auditoría de fallos N−2 y k-de-n con traza medida | 4 | 4 | 5 | 4 | 3 | 4 | 4 | 4.04 |
| P8 | Descubrimiento/capacidad de contactos con relojes inciertos | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 3.67 |
| P9 | Geometría de ventanas satelitales sin acceso a servicio | 3 | 3 | 5 | 2 | 3 | 4 | 3 | 3.28 |
| P10 | Recomendación de rutas de evacuación sobre datos inferidos | 5 | 2 | 3 | 3 | 2 | 2 | 1 | 2.90 |

Totales recalculados con las ponderaciones indicadas (suma ponderada de las siete notas, redondeada a dos decimales). La **prioridad operativa** no es solo el total: P3 y P6 son controles obligatorios de presentación/seguridad, pero P1 es el cuello de botella causal para poder calibrar P2 y demostrar capacidad a una entidad financiadora. P5 permanece entre las tres investigaciones porque resuelve un fallo significativo y ofrece una prueba científica independiente con datos públicos; no porque su coste o riesgo actual sean favorables.

## 4. Seis líneas exigidas: decisiones técnicas

### A. Incendio: física, observación y mapa, no intercambiables
Problema: modelo geométrico H2 no supera persistencia. Antecedentes: Rothermel (ROS en superficie); FARSITE/Finney (perímetro, combustible, humedad, spotting); level sets y WRF-Fire. Hipótesis H-FIRE-B: una velocidad direccional vinculada a viento/pendiente/combustible, más término de error de modelo, reducirá Brier en incidentes retenidos frente a persistencia y climatología. Modelo de frente: ecuación de nivel-set ∂φ/∂t + V_n(x,t; viento,pendiente,combustible) |∇φ| = 0; si falta combustible o meteo, abstención. Resolver con esquema upwind monotónico y condición CFL; mantener la distinción entre velocidad calibrada y campo visualizado. ERA5 es reanálisis posterior: puede servir para estudio histórico exploratorio, **no como predictor disponible en t0** sin archivo de emisión causal. El modelo de producción retrospectiva debe usar pronósticos emitidos antes de t0 o observación archivada con latencia probada. No emitir tiempo de llegada como instrucción de evacuación.

### B. Routing adaptativo
Problema: los planes de #44 son de origen, no se reajustan cuando un nodo se vuelve custodio. Antecedentes CGR, PRoPHET (RFC 6693), Spray-and-Wait, epidemic, BPv7 (RFC 9171). Política: MDP con observación parcial, horizonte recedente y función robusta sobre q en conjunto de ambigüedad de H11; transición condicionada por ACK real, contactos activos, SRLG H13 y cortes H15, reconstrucción k-de-n H16. Optimizar entrega antes del vencimiento sujeto a energía E, airtime A, presupuesto total de réplicas B y autorización. Un recibo de custodia NO es recibo del destino. Sin datos de contacto, emitir WAIT/ABSTAIN, no inventar oportunidad de contacto.

### C. Comunicaciones oportunistas
Problema: Android/JVM y Node IPC no prueban BLE/Wi-Fi sobre aire ni durabilidad ante pérdida de alimentación. H-PHY: emparejamiento autenticado con dos teléfonos y radios propias, recibos con desafío, reproducción tras reinicio **solo con consentimiento vigente**, estado de custodia persistente y medición independiente. Fuentes: Android Bluetooth / Wi-Fi APIs, BPv7/BPSec, requisitos regionales EU868. No afirmar Wi-Fi Direct/Aware en hardware sin capabilities + permisos. LoRa no implica interoperabilidad por sí sola, ni acceso a repetidores públicos.

### D. Fusión de evidencias
Problema: reportes ciudadanos, hotspots VIIRS, perímetros y avisos institucionales pueden derivar del mismo incidente/observación. Hipótesis: un grafo dirigido de procedencia (hash, origen, observadoEn, disponibleEn, transformación, derechos, dependencia causal) reduce la doble contabilización sin retrasar excesivamente las confirmaciones. Modelo: factores por fuente causal; p(D|H) no es producto de términos si comparten ancestro, y una credencial no transforma una observación en verdad. La identidad institucional exige ancla de confianza externa. Faltantes se codifican UNKNOWN.

### E. Planificación bajo incertidumbre
Problema: una puntuación puntual puede inducir falsas seguridades. En laboratorio: optimización robusta min_q Pr(entrega antes de plazo|q), intervalos calibrados y abstención si política no distingue rutas robustamente. Para evacuación: solo **escenarios hipotéticos no prescriptivos**; tiempo de llegada del frente, rutas y aforos no validan recomendaciones públicas. La abstención y la incertidumbre son prestaciones del producto, no fracasos del modelo.

### F. Visualización científica offline
Problema: la representación 4D puede inducir apariencia de observación exacta. Contrato por fotograma/capa: OBSERVADO, PREDICHO, SIMULADO o DESCONOCIDO; tiempo de observación, disponibilidad, emisión, horizonte, unidad, resolución, versión modelo y hash; reproducción causal y estado offline. Fuentes y errores consultables sin internet desde paquete previamente obtenido; las bandas de incertidumbre no deben ocultarse por estética. Deshabilitar o atenuar recomendaciones si el modelo se abstiene. Rechazar imágenes, GIF o telemetría ficticia presentados como medición.

## 5. Decisiones reversibles y producto financiable

**Rechazado ahora:** refactor masivo de rutas, aplicar CVaR porque parezca más sofisticado (ablación negativa), aumento indiscriminado de replicas, afirmar acceso satelital, integrar H2 en avisos, duplicar persistencia Android, alertas CAP Actual desde ciudadanos, «ver a través de paredes» mediante receptores comunes, y patentar física sin anterioridades.

**Valor institucional vendible por fases:** (1) laboratorio reproducible y auditoría de procedencia; (2) piloto con entidad y permisos, fallos documentados, dataset RF y SLA limitado al entorno medido; (3) certificación/contratos/seguridad evaluados por terceros para casos de uso concretos. No igualar TRI/TRL, compilación o CI con producto crítico certificable. La ventaja defendible es el expediente de evidencia, trazabilidad y calibración regional, no teoría matemática nueva.

**Criterios para pasar a fase siguiente:** gates definidos antes de mirar resultados en SENDA_NEXT_HYPOTHESES_PREREGISTER.md. Resultado negativo preservado; ningún merge ni despliegue por este PR.

Fuentes y licencias: SENDA_SOURCE_EVIDENCE_MATRIX.md. Instrucciones ejecutables: SENDA_AGENT_HANDOFF.md.
