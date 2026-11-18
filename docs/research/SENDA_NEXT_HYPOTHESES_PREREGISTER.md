# SENDA — Prerregistro falsable de próximas hipótesis

Fecha de congelación del diseño: **2026-11-17**, antes de cualquier nuevo desarrollo o consulta de nuevos resultados retenidos. Este documento define las pruebas que deben implementarse, **no** resultados ya obtenidos. H2 en PR #44 sigue RECHAZADA y su conjunto no se reutilizará como prueba confirmatoria de H-FIRE-B.

## Reglas metodológicas globales (aplican a todas)

1. Registrar por ejecución: preregister SHA, source SHA, dependencia/lock SHA, dataset URL/DOI, digest SHA-256 de bytes, licencia, instante de observación (t_obs), instante disponible en sistema (t_avail), instante de decisión (t0), conjunto causal, seed, versión hardware, firmware, entorno, consentimiento, criterio de exclusión y logs originales. **t_avail ≤ t0** para todo predictor confirmatorio.
2. Primero definir población objetivo y unidades independientes. Una ciudad, móvil, mensaje, instante, punto del grid o seed NO es otro desastre independiente. Análisis jerárquico: grupo externo = incidente causal / emplazamiento-día / sesión de apagón; análisis pareado dentro de grupo. No bootstrap de puntos como si fueran incidentes.
3. Dividir por incendio/tormenta física y por tiempo, con embargo temporal para observaciones posteriores. Decisión de inclusión antes de evaluación. Retener también instancias sin ruta, fallos de descarga, observaciones ausentes, contactos no autorizados y predicciones abstinentes (reportar cobertura, no invisibilizarlas).
4. IC 95 % bilateral por bootstrap pareado de bloques externos (10.000 muestras), o método exacto/permutación donde corresponda. Con menos de 10 bloques externos, reportar intervalos como exploratorios y prohibir afirmaciones confirmatorias generalizables. Multiplicidad: primaria única por hipótesis; secundarias descriptivas; si dos primarias, Holm-Bonferroni.
5. Repetir baselines con idénticos contactos, carga útil, plazos, oportunidades, energía, tiempo de radio, topología y semillas de generador; el coste total es aire más discovery, CPU, espera, ACK, cifrado y reintentos. Ningún algoritmo obtiene información del futuro.
6. Éxitos de seguridad y permisos son **gates absolutos**: un envío sin permiso, una alerta CAP Actual no autorizada, un recibo falsificado aceptado, una violación de presupuesto de duty cycle o una telemetría inventada bloquean la promoción aunque la métrica principal mejore.
7. Fallos, artefactos y tests NEGATIVOS nunca se borran. Cambiar umbrales exige una nueva versión preregistrada y conjunto nuevo; no reetiquetar confirmatorio lo post hoc. Si tamaño de muestra es insuficiente: INCONCLUSO.
8. Advertencia regulatoria: verificar límite de frecuencia/banda/subbanda, potencia, duty cycle y equipo por país; las cifras generales «EU868=1%» no constituyen regla universal.

## H-PHY-1 — La custodia SENDA funciona físicamente y resiste cortes

**Hipótesis nula H0:** con dos móviles Android realmente desconectados de internet y radios cooperativas en una prueba controlada, SENDA no cumple el protocolo de envío/recibo/deduplicación/recuperación definido, o su PDR a destino es inferior al 80 % en el entorno de prueba; adicionalmente, existen violaciones de seguridad o autorización.

**H1:** entrega y verificación al destinatario demostradas en al menos un par de Android sin infraestructura de datos operativa, recibos válidos ligados a nonce+hash+receptor, estado persistido y restaurado sin reenvío no autorizado y tasas de prueba controlada compatibles con los gates indicados.

**Modelo:** un mensaje M contiene ID aleatorio, hash, remitente autorizado, destinatario, TTL, contador de boot, límite de intentos, copia máxima y estado de custodia. Transición de estado del durable log: CREATED → QUEUED → CUSTODY_ACK (no confundir con entregado) → DESTINATION_ACK; REVOKED/EXPIRED es terminal. Recibo firmado sobre (digest(M), receptor, nonce, clave de sesión, contador) y verificable sin hora absoluta. Si reloj cambia de forma incoherente: cuarentena/abstención. Reloj monotónico no sobrevive apagado: usar registro de boot + fuente confiable / expiración conservadora, no inventar monotonicidad interarranque.

**Variables:** PDR destino=# mensajes de prueba con ACK verificado / # mensajes elegibles lanzados; latencia p50/p95 segundos; pérdidas antes/después del corte; retransmisiones, airtime ms/paquete y por hora, corriente mA, energía mJ con instrumento si disponible (estimaciones separadas), RTT/ACK ms, CPU/tiempo ms, tamaño payload bytes, % colisiones, uso de batería y memoria, tasa de falsos ACK, intents de permiso. Evento no confirmado al plazo = fallo, no censurar sin justificante.

**Plan de piloto exploratorio físico:** ≥2 modelos de Android, ≥2 radios LoRa propias/autorizadas si se habilita ese bearer, ≥4 lugares, ≥3 jornadas, ≥30 mensajes preprogramados por combinación radio/condición. Condiciones: línea visible, obstrucción legal/segura, modo avión sin Wi-Fi móvil y radios compatibles habilitadas, aplicación pausada, batería baja, pérdida y recuperación de energía del gateway, almacenamiento lleno/corrupto, cambio hora, revocación de consentimiento, ausencia de destinatario, reordenación/duplicación y fallo de un gateway compartido. Escoger mensajes y órdenes antes del ensayo; no se requiere provocar peligro real.

**Rechazo del gate funcional:** cualquier violación de autorización, aceptación de ACK apócrifo, recuperación de mensaje revocado o falso «destino recibido»; incapacidad de comunicación real sin red; o PDR exploratorio inferior a 0,80. **Aceptación limitada:** dos equipos interoperan físicamente, logs verificables, no hay fallos críticos, PDR exploratorio ≥ 0,80 en cada condición nominal y ≤ 1 % de violaciones de presupuesto (en realidad violaciones duras deben ser 0). Se comunica como **prueba de concepto de laboratorio**, nunca fiabilidad poblacional. Inferencia generalizable exige más sesiones independientes y calibración externa.

**Abstención:** si no hay dispositivos, permisos, medida independiente, receptor verificable o si un canal está prohibido, resultado NOT_TESTED / BLOCKED; no hacer pasar emulación por hardware.

## H-ARR-R — Replanificación por custodio, con correlación y costes iguales

**H0:** una política ARR recedente que se ejecuta en cada custodio no incrementa la probabilidad de entrega antes de TTL frente a ARR estático, o viola el presupuesto de coste y seguridad.

**H1:** en simulación temporal externa retenida, incrementa la entrega a tiempo **≥ 2 puntos porcentuales** con límite superior de 1,5x transmisiones, 1,2x energía y airtime y una mejora estrictamente positiva cuyo IC inferior 95 % sea >0. Esta magnitud es objetivo de decisión experimental, no predicción ya lograda.

**Estado:** s_t=(custodios y fragmentos poseídos, reloj local/boot, red observada hasta t, contactos autorizados, energía restante, capacidad, TTL, certificados, ACKs, conjuntos de fallo observados, presupuesto global). Acción: STORE/WAIT/TRANSMIT/ABSTAIN. Política pi(s_t)=argmax over feasible actions min_{q in Q_t} P_q(reconstrucción de k fragmentos antes de TTL) sujeto a Σairtime≤A, ΣE≤E, Σcopias≤B. El historial causal y el inventario SRLG condicionan escenarios; usar H11–H16 para incertidumbre, sin duplicar código. Las acciones no pueden deducir contactos futuros salvo un pronóstico explícito/rotulado.

**Comparadores:** ARR de origen (#44); CGR/earliest, k-exclusión de contactos, PRoPHET (RFC 6693 con entrenamiento solo previo), spray-and-focus, epidemic bajo MISMO airtime/presupuesto (más techo epidémico sin restricciones como referencia separada), baseline WAIT-for-coverage. Descartar Spray-and-Wait 8 copias como único baseline fuerte: el simulador #44 favorece mallas estáticas en las que este esquema presenta ~9 %.

**Diseño:** 3 familias topológicas no derivadas del generador #44 (contactos con movilidad, fallos de energía compartidos, saturación/capacidad). Dataset de simulación retenido por familia y seeds disjuntas; ≥30 bloques independientes por familia y una etapa con trazas RF reales cuando H-PHY termine. Variables: entrega antes de TTL, no-ruta total, budget violations, ACK autenticado, ratio de fragmentos recuperables, overhead bytes/aire, energía, p95 latencia end-to-end, p95 compute de planificación Android y tasa abstención. Escenarios adversariales: doble fallo N−2, gateway central, firmware común, reboot, reloj atrasado, partición prolongada y p mal calibrada; obligar a informar del caso sin ruta.

**Ablaciones fijadas:** no replanificar, quitar SRLG, quitar ajuste de hazard, sin propagación de ACK, sin presupuesto global, sin coste CPU, posterior desconocido. La política que requiera un servidor o telemetría futura para decidir queda invalidada como offline.

**Criterio confirmatorio:** mejora ≥2pp e IC inferior>0, ratio TX≤1,5 y energía/aire≤1,2 con IC superior dentro del límite, sin violaciones duras, y p95 de cálculo≤250ms en dispositivo Android de referencia seleccionado antes del ensayo. Rechazar si no cumple, incluso cuando supera baselines débiles. Si p95 no medido en Android, etiqueta SIMULATED_ONLY. Sensibilidad: p de contacto -30%, correlación residual, duración de apagón, K=1..6, fragmentos k=1..n, capacidad y longitud de TTL.

## H-FIRE-B — Física causal vs persistencia: reemplazo de H2 rechazado

**H0:** un solucionador de propagación física con viento/combustible/pendiente no reduce el Brier a 24 horas respecto a persistencia en incendios disjuntos, o su ventaja depende de información no disponible en t0.

**H1:** reducción Brier absoluta ≥0,010 en incendios retenidos y límite inferior del IC 95 % para Brier(persistencia)−Brier(física) >0, sin degradación crítica de falsa seguridad y con cobertura de predicciones declarada.

**Modelo candidato:** ∂φ/∂t + V_n(x,t)|∇φ|=0; V_n parametrizada con Rothermel/Regla publicada para pendiente, humedad de combustible, carga y viento. Resolver en malla mediante upwind monotónico con CFL≤0,5 como criterio numérico inicial, verificando conservación de monotonicidad. Conjuntos meteorológicos/físicos separan variación aleatoria de error de modelo. El filtro de observación no puede identificar velocidad correcta a partir de geometrías erróneas sin que el modelo pase baselines.

**Fuentes:** historial USGS/NIFC perímetros, NOAA HRRR issue-time archivados (CONUS), ERA5 solo para análisis de sensibilidad retrospectiva, LANDFIRE 30m (escala efectiva regional), FIRMS VIIRS 375m hotspots con latencia, DEM USGS, EFFIS para validación externa europea tras revisar licencias. Registrar tanto tiempo de observación como de publicación. Perímetro cartografiado no es la posición exacta del fuego a esa hora.

**Partición:** los tres incendios 2018 Camp/Carr/Woolsey se etiquetan DESARROLLO/DIAGNÓSTICO, nunca test confirmatorio de nueva hipótesis por haber sido inspeccionados para H2. Antes de la nueva prueba seleccionar ≥10 incendios adicionales con mínimo 6 entrenamiento/calibración, ≥4 de TEST sin ajuste; separar por incendio y período, incluir un evento europeo solo si se consigue perimetraje temporal y fuel compatible. Si <4 incendios test no hay aceptación generalizable.

**Etiquetas:** un punto es positivo a 24h solo con cobertura observacional que demuestre llegada antes del plazo; negativo solo si hay observación posterior suficientemente completa al plazo que pruebe ausencia. Si la última cartografía es anterior a t0+24h y no hay prueba del resto, dato CENSURADO, no negativo. Modelar censura en análisis separado, informar cuántos puntos/instantes se pierden y por qué. Excluir observaciones publicadas después de t0 como features aunque su hora de captura sea anterior. Única métrica primaria: Brier de llegada en 24h entre instantes con etiqueta verificable; ponderar por incidente con peso igual.

**Baselines:** persistencia, velocidad isotrópica constante ajustada solo en train, elipse orientada por viento, H2 actual (diagnóstico), FARSITE/FlamMap validado si licencias/implementación y entradas comparables lo permiten. Secundarias: CRPS o error de cuantiles en tiempo de llegada si observable, IoU/perímetro a plazo, error Hausdorff 95 m, ECE, calibration-in-the-large, falsa seguridad P(evento) <0,1 con evento observado, latencia y memoria Android/offline. Reportar tasa de abstención y cobertura separadas.

**Aceptar:** ambas reglas de Brier e IC y error falso-seguro no peor que persistencia por >1 pp en retenidos, integridad temporal 100 %, gates numéricos en tests analíticos de propagación; no constituye aptitud para emitir alertas. **Rechazar:** si no supera persistencia, los intervalos cruzan 0, t_avail>t0 o el resultado depende de elegir después una localidad/horizonte. **Abstener:** viento/fuel/DEM desconocido, perímetro desfasado, observación incompleta, fuera del dominio meteorológico o covariate shift.

## H-FUS-1 — Fusión de observaciones sin duplicar fuentes

H0: el grafo de proveniencia causal no reduce la sobreconfianza frente a una fusión ingenua. H1: mejora Brier al menos 0,005 en episodios retenidos con IC>0, sin más de 10 % de retraso relativo en detección a igual tasa de falsos positivos. Comparadores: una sola fuente primaria; naive Bayes que multiplica «fuentes» correlacionadas; grafo de dependencia; baseline de corroboración institucional verificada. Grafo: observación→productor→redistribuidor→producto derivado, con ancestryHash y valid time. Verificar en datos sintéticos controlados y, después, ≥10 incidentes causalmente independientes con documentación de origen. Criterio fatal: dos recortes de la misma imagen cuentan como dos evidencias o fuentes de apariencia oficial elevan rol de autenticación. No se configura un adaptador CAP Actual.

## H-ABST-1 y H-VIZ-1 — Decisión y presentación

**H-ABST-1:** sobre salidas de H-FIRE-B o H-ARR-R, una regla de abstención predefinida por falta de datos, intervalos superpuestos o dominio no cubierto reducirá afirmaciones peligrosamente seguras sin ocultar sistemáticamente fallos. Primaria: 0 afirmaciones de certeza operativa no soportada en 1000 casos adversariales sintéticos más revisión humana; secundaria cobertura predictiva y falsa seguridad en eventos test. Aceptación es gate de integridad, no «salvar vidas demostrado». Escenarios de evacuación solo con sello NO OPERATIVO.

**H-VIZ-1:** 100 % de capas temporales deben conservar tipo de evidencia, observación/publicación/disponibilidad, versión y procedencia al exportar, pausar, repetir o estar offline. 0 etiquetas «OBSERVADO» para valores simulados en test E2E; 0 «Actual» sin autoridad; <=1 % errores de renderización/overflow en conjunto de resoluciones predefinido, 0 fuentes omitidas. Test de 8 tareas cognitivas con ≥12 usuarios de prueba no representativos (exploratorio): distinguir predicción de observación, obtener fuente/fecha, localizar abstención. Este test de usabilidad no sustituye validación con personal de emergencia.

## Régimen de decisiones

Secuencia: H-PHY gate → H-ARR-R replay calibrado; H-FIRE-B se trabaja offline separada; H-FUS/ABST/VIZ constituyen gates no bloqueantes para investigación de laboratorio pero absolutamente bloqueantes para afirmaciones institucionales. Comprobaciones en SENDA_AGENT_HANDOFF.md. Todas las salidas incluyen PASS / FAIL / INCONCLUSIVE / NOT_TESTED, nunca «validado real» por CI o simulación.
