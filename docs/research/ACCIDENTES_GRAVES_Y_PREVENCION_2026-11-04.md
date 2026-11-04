# Accidentes graves, señales previas y prevención con software

> Versión 1 · 04-11-2026 · SENDA. Entrada → Procesamiento → Validación → Salida.
> **No es un informe técnico oficial.** Resume lo publicado por organismos investigadores y
> medios citados. Donde una causa está en disputa o sin cerrar, se dice. Las cifras de
> víctimas varían entre fuentes; se da la más repetida.

## 1. Pregunta

¿Cuántos de los accidentes más graves tenían **una señal medible antes** que nadie convirtió en
alarma? ¿Se puede detectar esa señal con software sobre datos que **ya existen** (registros de
mantenimiento, móviles de los viajeros, perfiles de velocidad, meteorología), sin esperar a
renovar toda la infraestructura?

## 2. Casos revisados

| Accidente | Víctimas | Qué se sabe (y su estado) | Señal previa medible | Detector SENDA | Fuente |
|---|---|---|---|---|---|
| **Adamuz** (Córdoba), 18-01-2026. Un Iryo descarrila e invade la vía contraria; choque con un Alvia | 45–46 | La CIAF mantiene la **rotura del carril, en una soldadura**, como causa principal y descarta anomalías previas en los trenes (informe preliminar remitido al juzgado, abril de 2026). Un informe de la **Guardia Civil** al juzgado describe una **caída brusca de tensión del circuito de vía ~22 h antes**, registrada por el sistema de apoyo al mantenimiento, que **no generó alarma** porque quedó por encima del umbral de ocupación (0,78 V según el proveedor). **Adif lo discute**: una caída de 0,7 V puede deberse a otras incidencias. Pendiente: informe final de la CIAF y laboratorios (CSIC, Aimen). | Escalón persistente en la tensión del circuito, por encima del umbral | `trackCircuitWatch` | [Infobae (CIAF, abr. 2026)](https://www.infobae.com/espana/2026/04/28/conclusion-del-accidente-de-adamuz-la-ciaf-dice-que-se-rompio-el-carril-y-descarta-anomalias-previas-en-los-trenes/) · [Forbes (postura de Adif)](https://forbes.es/economia/902492/adif-asegura-que-la-caida-de-tension-de-la-via-de-adamuz-22-horas-antes-no-tiene-por-que-deberse-a-una-rotura/) · [Diario de León (Guardia Civil)](https://www.diariodeleon.es/nacional/260409/2081293/via-adamuz-rompio-dia-activo-aviso-transportes-dianael-pp-exige-cese-puente-negligencia-continuada.html) · [Maldita (cronología)](https://maldita.es/malditobulo/20260123/causas-accidente-tren-adamuz-teorias/) |
| **Gelida** (Barcelona), 20-01-2026. Un tren de la R4 choca con un muro de contención caído durante el temporal | 1 (maquinista en prácticas) | Adif atribuye la caída al temporal; según la caja negra, el maquinista tuvo unos 5 s para frenar. Los maquinistas habían avisado del temporal ese día. CIAF, expediente 011/2026, abierto. | Lluvia acumulada + estado del muro + avisos del personal | `weatherAssetWatch` | [El Debate (CIAF)](https://www.eldebate.com/espana/cataluna/20260122/ciaf-abre-expediente-investigar-causa-descarrilamiento-tren-gelida-barcelona_377180_amp.html) · [El Debate (5 s)](https://www.eldebate.com/espana/cataluna/20260123/rodalies-gelida-solo-tuvo-cinco-segundos-frenar-antes-chocar-contra-muro-caido_377612.html) · [Bolsamanía (avisos)](https://www.bolsamania.com/noticias/empresas/economia--los-maquinistas-advirtieron-ayer-a-renfe-del-temporal-en-cataluna-antes-del-accidente-mortal-en-rodalies--21529649.html) |
| **Angrois** (Santiago), 24-07-2013. Alvia a 179 km/h en una curva limitada a 80 | 80 | La CIAF atribuyó el descarrilamiento al exceso de velocidad y a la distracción del maquinista; el punto estaba fuera del tramo con ERTMS y la reducción no tenía supervisión continua. La Agencia Ferroviaria Europea cuestionó la independencia de la CIAF y que no se evaluara el riesgo de la curva. Condena firme al maquinista; absolución del exdirector de seguridad de Adif. | Bajada de 120 km/h confiada solo al maquinista | `speedTransitionAudit` | [Wikipedia (síntesis con fuentes)](https://en.wikipedia.org/wiki/Santiago_de_Compostela_derailment) · [Público (ERA)](https://www.publico.es/politica/europa-determina-debio-evaluar-riesgo-curva-angrois.html) · [Poder Judicial](https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Tribunales-Superiores-de-Justicia/TSJ-Galicia/Noticias-Judiciales-TSJ-Galicia/El-maquinista-del-Alvia-y-el-exdirector-de-Seguridad-en-la-Circulacion-de-ADIF-son-condenados-a-dos-anos-y-medio-de-prision-por-79-homicidios-y-143-lesiones-imprudentes-) |
| **Metro de Valencia**, 03-07-2006. Descarrilamiento en curva | 43 | Causa oficial y judicial: exceso de velocidad. La protección era de frenado puntual (FAP); sindicatos sostuvieron que una baliza antes de la curva lo habría evitado. Las víctimas discuten la versión oficial. Límites de velocidad exactos: **pendiente de verificar** en el auto judicial. | Curva sin control de velocidad antes de entrar | `speedTransitionAudit` | [elDiario.es](https://www.eldiario.es/politica/archiva-causa-accidente-metro-valencia_1_3384074.html) · [El Salto (20 años)](https://www.elsaltodiario.com/valencia/veinte-anos-del-descarrilamiento-del-metro-valencia) |
| **Tempi** (Grecia), 28-02-2023. Choque frontal de pasajeros y mercancías en vía única | 57 | Informe de HARSIA/EODASAAM (feb. 2025): error humano en la estación, señalización incompleta o inoperativa, sin mantenimiento preventivo de los sistemas de control y mando, y sin criterio para adaptar la velocidad al estado de la señalización. | Dos trenes asignados a la misma vía única; sistemas de señalización fuera de servicio conocidos | Fusión de posiciones (`rail-incident.mjs`) + auditoría de configuración (por hacer) | [Euronews](https://www.euronews.com/my-europe/2025/02/28/report-reveals-tempi-train-crash-was-a-result-of-human-error-outdated-infrastructure) · [Protothema (informe)](https://en.protothema.gr/2025/02/27/tempi-read-the-full-eodasaam-report-on-the-tragedy/) |
| **Balasore** (India), 02-06-2023. Un expreso entra en vía de apartado y choca con un mercante | ~293–296 | El Comisionado de Seguridad Ferroviaria atribuye el choque a fallos del departamento de señalización: una **modificación de circuitos** previa, cables mal rotulados en la caja de conexiones y procedimientos no seguidos. | Cambios de cableado de señalización sin verificación; avisos previos | Auditoría de cambios de configuración (por hacer) | [Wikipedia](https://en.wikipedia.org/wiki/2023_Odisha_train_collision) · [Business Standard](https://business-standard.com/india-news/lapses-at-multiple-levels-what-led-to-balasore-train-accident-on-june-2-123070400138_1.html) |
| **Eschede** (Alemania), 03-06-1998. ICE descarrila por rotura de un aro de rueda | 101 | Grieta de fatiga en un aro de rueda elástica; según las fuentes consultadas hubo avisos previos sobre ese diseño (grietas halladas en tranvías de Hannover en 1997). Informe primario de Fraunhofer LBF **pendiente de consultar**. | Defecto de flota conocido en otro operador | Intercambio de incidencias entre operadores (por hacer) | [Wikipedia](https://www.Wikipedia.com/wiki/Eschede_train_disaster) |

Otros desastres españoles (DANA de Valencia, apagón ibérico, incendios): ver
[`docs/handoff/04_DESASTRES_ESPANA.md`](../handoff/04_DESASTRES_ESPANA.md).

## 3. Patrón común

En **los 7 casos** las fuentes describen alguna señal anterior que no se convirtió en acción (en Adamuz y en el metro de Valencia esa lectura está **en disputa**):

1. **Umbrales absolutos** que no ven cambios relativos (Adamuz, si se confirma).
2. **Reducciones de velocidad confiadas a la atención humana** (Angrois, Valencia).
3. **Riesgo meteorológico sin cruzar con el estado del activo** ni con los avisos del personal (Gelida).
4. **Cambios de configuración sin verificación independiente** (Balasore, Tempi).
5. **Conocimiento de defectos que no viaja** entre operadores (Eschede).

El patrón no es falta de tecnología punta: es **datos que existen y no se cruzan**. Eso es
exactamente lo que sabe hacer una capa de software determinista y auditable.

## 4. Qué se ha construido (v0.7)

| Detector | Datos de entrada | Qué devuelve | Prueba |
|---|---|---|---|
| `trackCircuitWatch` | Serie de tensión de cada circuito de vía (exportación del registro de mantenimiento) | Escalones persistentes respecto a **su propia historia** (mediana y MAD), solo con la vía libre, aunque sigan por encima del umbral; distingue transitorios | `tests/rail-watch.test.mjs` |
| `trackGeometryCrowd` | Aceleración vertical de los móviles de los viajeros por punto kilométrico | Rugosidad relativa por tramo de 50 m (normalizada por viaje y por velocidad), impactos repetidos (juntas y soldaduras), degradación entre periodos; exige ≥3 dispositivos distintos | idem |
| `speedTransitionAudit` | Perfil de velocidades y si cada reducción está supervisada (dato del gestor) | Ranking por energía a disipar de las bajadas fuertes sin supervisión | idem |
| `weatherAssetWatch` | Muros y taludes (tipo, estado, días sin inspección), lluvia de AEMET, avisos del personal | Nivel 0–3 con propuesta: vigilar, inspeccionar antes del próximo tren o proponer limitación | idem |

Resultado en el escenario sintético (`evidence/senda/rail-watch.json`): el escalón de 0,67 V que
deja la tensión en 1,24 V (umbral 0,78 V) se confirma **30 min** después de producirse, con
**21,5 h** de margen hasta el final de la serie; el umbral absoluto da **0 alarmas**. La
geometría colaborativa señala el impacto repetido y el tramo que se degrada (×2 respecto al
periodo anterior) con 24 móviles distintos y **no** confunde la zona de velocidad reducida.

**Límites declarados:**
- Los datos son **sintéticos**: reproducen la *forma* del patrón, no los voltios de Adif.
- La validación real exige series históricas de circuitos de vía y pasos del vehículo de
  auscultación, por convenio con el gestor de la infraestructura.
- La geometría con móviles es un **complemento** del vehículo de medida, no un sustituto
  (Paixão et al., 2019; TU Delft, 2025: la repetibilidad y la variedad de móviles son el reto).
  Fuentes: [Challenges in Smartphone-Based Crowdsensing (TU Delft)](https://repository.tudelft.nl/record/uuid:ff7db447-b831-4277-ae93-638d59224887) ·
  [Smartphone's sensing capabilities… (Paixão et al.)](https://structurae.net/en/literature/journal-article/smartphone-s-sensing-capabilities-for-on-board-railway-track-monitoring-structural-performance-and-geometrical-degradation-assessment).
- SENDA **no opera trenes ni señalización**: propone, con la evidencia adjunta, al gestor.

## 5. Por qué esto es invertible (tesis, con lo que está verificado y lo que no)

1. **Coste marginal casi nulo en hardware.** Los detectores 1, 3 y 4 trabajan con datos que el
   gestor ya registra; el 2 usa teléfonos que ya viajan en cada tren. Lo que se vende es la
   capa de cruce de datos, la auditoría y la operación.
2. **Comprador identificable y con urgencia.** Gestores de infraestructura, operadores
   ferroviarios y organismos investigadores, en un momento de máxima presión pública tras
   Adamuz y Gelida. Importes de inversión en vía publicados en prensa (p. ej.
   [The Objective sobre el tramo de Adamuz](https://theobjective.com/economia/transporte/2026-04-27/adif-368-millones-tramo-via-adamuz/)):
   **pendiente de verificar** su alcance antes de citarlos en un dosier.
3. **Mismo motor, varios mercados.** La fusión determinista con intervalos y traza sirve igual
   para «¿hay alguien en esta vivienda?» que para «¿se ha roto este carril?»: evidencia
   heterogénea → probabilidad calibrada → acción propuesta → auditoría encadenada.
4. **Defensa frente a clones** (ver [`docs/handoff/01`](../handoff/01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md)):
   las calibraciones con datos reales de pilotos son **secreto empresarial**; el código abierto
   sin esas calibraciones no da el mismo resultado.
5. **Financiación pública a investigar** (agente A5, pendiente de verificar convocatorias
   vigentes): Europe's Rail Joint Undertaking, Mecanismo Conectar Europa (CEF Transporte),
   CDTI, compra pública de innovación.

**Lo que NO se puede afirmar todavía:** que SENDA «habría evitado» Adamuz. Lo honesto es: *si*
el escalón descrito por la Guardia Civil se confirma, un detector relativo como este lo habría
señalado para inspección con muchas horas de margen. Lo decidirá la investigación oficial.

## 6. Siguiente paso

1. Piloto de datos con un gestor de infraestructura: 12 meses de series de circuitos de vía de
   una línea, con sus incidencias, para medir **sensibilidad y falsas alarmas reales**.
2. App de viajero con consentimiento explícito (modo «viajo en tren») que suba solo
   agregados por tramo: privacidad por diseño (DPIA, agente A6).
3. Detector 5: **auditoría de cambios de configuración** de enclavamientos y circuitos (patrón
   Balasore/Tempi), sobre los registros de mantenimiento.
4. Ficha para la CIAF: ofrecer el detector como herramienta abierta de análisis.

**Confianza del documento: 80 %.** Las causas de Adamuz y Gelida no están cerradas; la cifra de
víctimas de Adamuz y Balasore varía entre fuentes; los límites del metro de Valencia y el
informe primario de Eschede están pendientes.
