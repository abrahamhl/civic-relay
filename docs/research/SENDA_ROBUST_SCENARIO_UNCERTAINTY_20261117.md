# SENDA · Misión matemática 11: robustez frente a probabilidades inciertas de desastre
**17 noviembre 2026 · Investigación reproducible · Solo SHADOW MODE · No certificación ni nueva ley física**

## Problema observado, sin duplicar trabajo de Claude
Claude ya implementó en packages/senda/src/delivery-assurance.mjs:
- probabilidad exacta de recibir >=k fragmentos condicionada a distintos escenarios (fallos de causa común);
- mezcla sobre escenarios con pesos fijos s.prob;
- posterior Beta, asignación multiportador y experimentos de Monte Carlo.
Esto **NO** equivale a tener una distribución de escenarios contrastada; tampoco demuestra independencia condicional entre envíos en un escenario. Las probabilidades DEFAULT_HAZARDS son hipótesis. Este PR **no** modifica esos motores.

Investigación nueva, conectada: packages/senda/src/robust-scenario-risk.mjs + robust-assurance-audit.mjs.

## Modelo matemático y su alcance
Dados escenarios exhaustivos H={h1..hn}, masas desconocidas q_i, límites declarados
0 <= l_i <= q_i <= u_i <= 1, sum_i q_i =1,
y cotas de éxito de un plan en cada estado a_i <= P(delivered | h_i) <= b_i,
se computa:

  R_lower = min_{q in Q} sum_i q_i a_i
  R_upper = max_{q in Q} sum_i q_i b_i.

Q es un politopo caja ∩ simplex. El algoritmo inicializa q_i=l_i y coloca la masa libre en los escenarios con **menor a_i** para el mínimo, o **mayor b_i** para el máximo, sin exceder u_i. Es EXACTO para el programa lineal declarado: si una solución invierte masa de un estado con mayor a hacia uno con menor a, ese intercambio no puede aumentar el coste objetivo. La solución se construye repitiendo intercambios hasta saturar límites.

Complejidad O(n log n), memoria O(n). n<=128. Prueba de pequeña instancia por cuadrícula exhaustiva y 100 sobres de escenarios generados con semilla determinista.

**Matiz crucial:** “exacto” se refiere al *programa lineal de entrada*, NO a predicción estadística real. La propiedad no sobrevive si Q excluye la distribución real, si omitimos un modo de fallo o si a_i no es una cota válida. Este trabajo aplica DRO, una familia conocida en investigación; **no inventa la optimización robusta**.

## Ejemplo hipotético (SIN datos RF)
Estado NORMAL: masa nominal .95, permitido .40..95.
Estado GRID_DOWN: masa nominal .05, permitido .05..60.

Plan A: una sola ruta celular. Éxito condicional de ejemplo NORMAL=.98, GRID_DOWN=.05.
- Nominal A = .95*.98 + .05*.05 = .9335.
- Peor A = .40*.98 + .60*.05 = .422.

Plan B: rutas diversas con éxito condicional NORMAL=.85, GRID_DOWN=.80.
- Nominal B = .95*.85 + .05*.80 = .8475.
- Peor B = .40*.85 + .60*.80 = .82.

Por la probabilidad nominal, A gana; por cota robusta ante el mismo conjunto de incertidumbre, B gana. Esta inversión es una propiedad del modelo, **no la cifra de entrega de SENDA en España, Países Bajos o una zona de emergencia**.

## Integración con Claude / contract
auditAssuranceAgainstUncertainHazards({states,plans}):
- Recibe candidatos explícitos {id, groups:[{id,p,shards}], k, costEUR, energyMj, consentDeclared, linkAuthorizedDeclared}.
- Por cada escenario, llama a correlatedDeliveryProbability(groups,k,{estado: {...hazard,prob:1}}) **en el motor de Claude**.
- Aplica envolvente robusta sin renormalizar silenciosamente las masas y bloquea escenarios ausentes, probabilidades inválidas, grupos no representables y candidatos sin consentimiento/autorización DECLARADOS.
- Devuelve RESEARCH_SHADOW_CHOICE, nunca canDeliver, authorizedTransport, signedReceipt ni operationallyAuthorized=true.
- “ConsentDeclared” y “linkAuthorizedDeclared” son declaraciones del simulador, no evidencia institucional; la función nunca habilita operación.

No se han integrado gateways, redes ajenas, 112, radio, elementos orbitales o permisos de instituciones. **Ninguna transmisión ni solicitud de autorización se simula como real**.

## Pruebas y hipótesis de falsación
1. Pruebas exactas contra valor analítico de 2 escenarios y enumeración exhaustiva de 3 escenarios.
2. Stress de 100 sobres de distribución aleatorios: masas adversariales siempre satisfacen límites y suman 1.
3. Monte Carlo sintético 120.000 ensayos: comparar media simulada con fórmula de Claude bajo un estado de red con apagón 60%; NO estimar frecuencias reales.
4. Doble runtime GitHub Actions Node 22 y 24; ejecutar suite completa de núcleo y adversariales.
5. **H11-A:** en incidentes retenidos con apagones correlacionados, optimizar bajo Q reduce descalibración y falsos compromisos de entrega frente a selección por probabilidad puntual. Refutación: cero mejora, coste energético prohibitivo o intervalo inestable.
6. **H11-B:** intervalos de probabilidad obtenidos de incidentes independientes y geografía/operador heterogéneos pueden cubrir las frecuencias retenidas. Refutación: undercoverage, domain shift, limitaciones de licencia o detección incompleta de incidentes.
7. **H11-C:** el algoritmo de escenarios escala con 128 estados sin latencia relevante, pero depende del motor condicional de Claude y éste no modela fallos comunes no etiquetados dentro de cada estado.

## Siguiente trabajo que sí tendría valor científico si se demuestra
- **Descriptor de dominios de fallo compartidos (SRLG)** para infraestructura real autorizada: proveedor, red eléctrica, emplazamiento, capa OSI, gateway, puente, zona inundable; nunca inferir independencia por usar tecnologías distintas.
- Estimar intervalos de masas q a partir de datos completos y etiquetados **por incidente independiente**, no por cada mensaje (sería pseudorreplicación). Analizar drift, confianza y fallos raros.
- Auditoría con escenarios adversariales fuera del catálogo; introducir explícitamente UNKNOWN/UNMODELED con una masa alta hasta que existan datos.
- Descomponer el riesgo en incertidumbre aleatoria/epistémica; diseñar calibración por zona y estación con validación temporal/geográfica fuera de muestra.
- Dos Android y dos nodos LoRa EU868 voluntarios, 30+ ensayos por condición SOLO exploratorios; para demostrar >=99% con cero fallos con 95% de confianza bajo supuestos binomiales independientes hacen falta aproximadamente 299 ensayos SIN fallos (y bajo fallos correlacionados mucho más cuidado). El campo no está certificado.
- Comparar baseline “esperar la conectividad”, router actual, modelo correlacionado puntual y modelo robusto con mismo presupuesto de energía/aire/latencia. Publicar también cuándo gana el baseline.

## Fuentes
- IETF BPv7 RFC 9171: el estándar no prescribe el algoritmo de routing: https://www.rfc-editor.org/rfc/rfc9171.html
- IETF BPSec RFC 9172 (integridad/confidencialidad): https://www.rfc-editor.org/rfc/rfc9172.html
- IETF RFC 6414, Shared Risk Link Groups: https://www.rfc-editor.org/rfc/rfc6414.html
- Research foundations for distributionally robust optimization: https://doi.org/10.1007/s10107-017-1172-1
- Finite-scenario DRO literature: https://doi.org/10.1016/j.cor.2025.107142
- Probabilistic DTN routing under exponential and Pareto contact models (2026): https://doi.org/10.1016/j.adhoc.2026.104262
- Existing SENDA delivery model: packages/senda/src/delivery-assurance.mjs.

**TRL / comunicación:** una fórmula demostrada y un CI en verde no constituyen validación física. No afirmar teoría nueva, producto certificado, fiabilidad >99 %, acceso satelital autorizado ni integración con servicios críticos.

## Decisión de integración
Rama aislada basada en PR #39 (seguridad) que, a su vez, depende del PR #32 de Claude. **Nunca mergear directamente a master sin cerrar dependencia, revisar licencias y pasar el gate integral; ningún deploy**. Gate del Agente 1 aún sin pruebas físicas, así que esta labor continúa en línea de investigación, no activación del Agente 2.


## H11-D · Segunda incertidumbre: dependencia oculta ENTRE retransmisiones dentro de un escenario

**Problema encontrado:** delivery-assurance.mjs evalúa paquetes como eventos independientes *condicionado al estado*; retransmisiones que atraviesan un mismo gateway o energía pueden fallar a la vez. La mezcla de escenarios no cubre necesariamente esta correlación residual.

Implementación añadida:
- packages/senda/src/dependency-agnostic-shards.mjs
- packages/senda/tests/dependency-agnostic-shards.test.mjs
- El adaptador robust-assurance-audit.mjs sigue calculando el valor puntual condicional con Claude, pero usa esta nueva **cota inferior sin independencia** antes de la incertidumbre de masas de escenarios.

Sean grupos i con r_i fragmentos, evento binario X_i de éxito y una **cota marginal válida** p_i <= P(X_i=1), con umbral k de fragmentos, N=sum_i r_i, μ=sum_i r_i*p_i.
Sin suponer ninguna independencia, Y=sum_i r_i X_i cumple:

E[Y] >= μ, E[Y] <= (k-1) P(Y<k) + N P(Y>=k).

Por tanto:
P(Y>=k) >= max(0, (μ-(k-1))/(N-k+1)).

Para todo subconjunto A con sum_A r_i >= k, la coincidencia de éxito de todos los grupos A implica alcanzar k, y por Boole/Fréchet:
P(Y>=k) >= max(0, 1 - sum_A(1-p_i)).

Se toma el máximo de estas cotas inferiores. Para <=10 grupos se enumeran todos los subconjuntos; entre 11 y 32 se usa un conjunto ganador voraz como **cota válida no óptima**. N<=255. Si únicamente hay cotas marginales inferiores, la **cota superior es 1**, no se aplica incorrectamente Markov a una esperanza inferior. Solo para probabilidades marginales exactas en el modelo (opción explícita) se usa upper<=min(1,μ/k).

**Contraejemplo de marketing:** dos copias con p=.95 sobre el mismo gateway y k=1. La independencia daría 1−(.05)^2=.9975 (99,75 %). Si ambas copias fallan exactamente juntas, la entrega solo es .95; la cota sin dependencia es .95. No se puede afirmar 99,75 % por haber duplicado envíos.

**Pruebas:** casos extremos, 2-de-3, tamaños GF(256), repeticiones completamente correlacionadas, 280 casos aleatorios confrontados con la distribución Poisson-binomial independiente. El resultado independiente debe caer dentro del intervalo sin hipótesis de independencia, nunca fuera.

**Limitación:** la cota requiere que p_i sean límites marginales genuinos. Sin medidas reales no se convierten en probabilidades de campo, incluso si las matemáticas están correctamente demostradas. Ninguna transmisión en vivo, 112 ni acceso por satélite queda habilitado por este algoritmo. La ganancia científica sería **calibrar las cotas por dependencia física real** y probar reducción de sobreconfianza, no atribuir originalidad a Boole/Fréchet ni a las desigualdades de esperanza.

Referencia conceptual adicional: IETF RFC 6414 (Shared Risk Link Group); IETF BPv7 no estandariza política de ruta. El siguiente contrato científico debe registrar riesgos comunes de suministro eléctrico, emplazamiento, operador y dispositivo sin asumirlos independientes.


## H12 · Frecuencias de desastres con incertidumbre de muestreo

Implementado en `packages/senda/src/scenario-frequency-evidence.mjs`, sincronizado de forma idéntica con la versión web offline, y probado en `packages/senda/tests/scenario-frequency-evidence.test.mjs`.

- La unidad estadística es un **episodio identificable**, no cada paquete, teléfono ni reporte. El módulo rechaza claves repetidas y exige identificador de fuente y SHA-256 bien formados. **No verifica la autenticidad del contenido ni la independencia real entre episodios**.
- Se exige un inventario cerrado de etiquetas declaradas `scenarioIds`, incluyendo `UNKNOWN`: las incidencias sin clasificación registrada no desaparecen del denominador. La categoría UNKNOWN **no garantiza** que incidentes nunca observados estén representados.
- Con `n` episodios *IID* y `m` categorías, por Hoeffding y cota de la unión se obtiene simultáneamente con confianza al menos `1-alpha`:
  `|q_s - n_s/n| <= sqrt(log(2m/alpha)/(2n))` para cada categoría `s`.
- Para `n=100`, `m=3`, `alpha=0.05`, la semiamplitud es aproximadamente **0,1547**. Si `UNKNOWN` no apareció en esa muestra, su cota superior sigue siendo aproximadamente **15,47 %**, no cero. Es una cota conservadora, no un pronóstico.
- `attachConservativeResearchHazards` convierte `UNKNOWN` en un estado donde ningún portador tiene éxito garantizado: los factores de cada familia registrada son cero. El resultado puede alimentar `auditAssuranceAgainstUncertainHazards` **en modo laboratorio**, sin transmitir ni abrir permisos.

**Hipótesis falsable H12:** episodios efectivamente independientes y representativos permiten intervalos calibrados que cubran frecuencias de etiquetas en regiones/temporadas retenidas, con una incertidumbre útil para decidir. Debe refutarse si hay infraobservación, selección de incidentes, tormentas correlacionadas, cambios de red o deriva estacional. Para crisis que comparten una misma tormenta, hacer bloques por **evento meteorológico causal**, no por municipio afectado, antes de afirmar cobertura.

**Limitación metodológica:** este módulo devuelve siempre `representativeOfFutureDisastersVerified:false`, `independenceOfIncidentsVerified:false`, `mayAuthorizeOperationalRouting:false`. La confianza matemática es condicional a las hipótesis, no procede de un ensayo físico.

## H13 · Topología SRLG: reconocer puntos de fallo físicos compartidos

Implementado en `packages/senda/src/shared-risk-topology.mjs` y prueba `shared-risk-topology.test.mjs`, con copia exacta en la web offline.

- Los **enlaces** informan identificadores de dominio de riesgo (energía, torre, gateway, backhaul, emplazamiento, operador, versión de firmware, puente). Las **rutas** declaran qué enlaces usan, presupuesto de coste/energía y consentimiento/autorización **solo declarados**.
- Se audita si dos rutas comparten un enlace literal o un `SRLG:<dominio>`; **no basta que el canal sea distinto**. Por ejemplo SMS y datos móviles podrían compartir antena y suministro eléctrico. Si una ruta carece de inventario, el riesgo `UNKNOWN_TOPOLOGY` es comodín y se considera compartido con **todas las rutas**.
- Solo se selecciona una pareja con **disyunción SRLG declarada**, presupuestos satisfechos y permisos declarados. Aun así, el resultado `DECLARED_DISJOINT_RESEARCH_PAIR` mantiene `physicalIndependenceValidated:false`, `successEventsIndependentValidated:false`, `mayMultiplyReliabilities:false`, `mayTransmit:false`.
- La disyunción declarada **no autoriza** calcular éxito combinado por independencia. La cota inferior de H11-D sigue siendo aplicable hasta que haya evidencia empírica de dependencia condicional y se descarten dominios ocultos.

**Hipótesis falsable H13:** identificar dominadores físicos compartidos reduce planes redundantes y falsos supuestos de diversidad de rutas frente a selección basada únicamente en portador. Se debe comparar en escenarios medidos de fallo de suministro/gateway y publicar cuántos dominios reales quedaron sin identificar.

Fuentes oficiales: [IETF RFC 6414 §3.1.10](https://www.rfc-editor.org/rfc/rfc6414.html) para SRLG; [IETF RFC 8001](https://www.rfc-editor.org/rfc/rfc8001.html) sobre recopilación de información de SRLG; [RFC 9171](https://www.rfc-editor.org/rfc/rfc9171.html) para el límite de garantías DTN.

## Bloqueo de certificación / continuidad para Claude

**No traspasar a emergencias reales ni fusionar con `master` hasta cerrar**: (a) PR #32 de Claude, (b) PR #39 de autorización CAP y reportes, (c) PR #42 de H11–H13; (d) ensayo con al menos 2 Android y 2 radios autorizadas, sin enlaces de terceros no consentidos; (e) mapa de procedencia y licencias; (f) pruebas de reloj, pérdida, apagón, duplicación y latencia p95; (g) evaluación independiente de seguridad, privacidad y compatibilidad de la institución.

**Potencial diferenciador defendible:** auditoría conjunta de incertidumbre de frecuencia de desastres, dependencia entre retransmisiones y puntos de fallo comunes. **No reclamar teoría inédita**: la innovación vendible sería integración, evidencia de campo, trazabilidad y ventaja medida frente a baselines de enrutamiento, no atribuirse Hoeffding, Fréchet o SRLG como descubrimientos propios.


## H14 · Intervalos simultáneos válidos durante consultas reiteradas (optional stopping)

**Problema:** H12 calculaba intervalos Hoeffding correctos para un tamaño muestral prefijado. No son suficientes si los responsables observan el panel reiteradamente y se detienen justo cuando aparece una distribución favorable. Esta selección aumenta la probabilidad de haber emitido alguna conclusión falsa.

**Nueva implementación:** \`packages/senda/src/anytime-scenario-confidence.mjs\` y \`packages/senda/tests/anytime-scenario-confidence.test.mjs\`, con copia idéntica para la aplicación offline.

Para m categorías exhaustivas (incluida UNKNOWN) y n episodios causales independientes, bajo una distribución categórica *IID estacionaria*:
- Hoeffding: \`P(|p_hat_s(n)-p_s| > epsilon_n) <= 2 exp(-2n epsilon_n²)\`.
- Se reparte alpha entre **todas las categorías y todos los tiempos** usando \`alpha/(m*n*(n+1))\` por categoría y tiempo, porque \`sum_{n>=1} 1/[n(n+1)] = 1\`.
- Radio secuencial \`epsilon_n = sqrt( ln(2*m*n*(n+1)/alpha)/(2*n) )\`.
- Resultado: \`P(for all n>=1 and all s, |p_hat_s(n)-p_s|<=epsilon_n) >= 1-alpha\`, **solo si las hipótesis IID y de captura íntegra son verdaderas**.

Esto es una aplicación conservadora de resultados matemáticos establecidos (Hoeffding + Bonferroni/alpha-spending), no una nueva teoría. Alternativas más eficientes de secuencias de confianza se publican en Howard et al., *Annals of Statistics* 49(2), 2021, DOI https://doi.org/10.1214/20-AOS1991. Una contribución propia defendible requerirá demostrar mejora de calibración, tiempos de aviso y coste de recogida frente a estos métodos.

**Pruebas:** caso analítico, identidad telescópica del presupuesto de error, 300 trayectorias categóricas sintéticas con múltiples consultas, validación de bloques causales, manejo de UNKNOWN y conexión conservadora con el planificador Claude. Todos los estados de investigación muestran \`operationalAuthorizationGranted:false\`.

**Hipótesis falsable H14:** supervisar intervalos secuenciales calibrados por episodio causal reduce falsas garantías en un sistema consultado repetidamente. Fallaría con deriva temporal o espacial, categorías incompletas, datos seleccionados, fallos de procedencia y episodios correlacionados. El módulo **no corrige por sí solo** estas causas.

## P0 de veracidad institucional descubierto y corregido en esta rama

**Hallazgo:** \`assessIncident(incident,{official:[...]})\` utilizaba campos suministrados por el llamador para elevar un hecho a estado \`OFFICIAL\`, aumentar las odds sin comprobación de procedencia, y \`sensors:[{official:true,agrees:false}]\` podía suprimir la puntuación aunque el origen no estuviese autenticado. Si se etiquetaba \`OFFICIAL\` mediante otra vía, \`incidentToCap\` daba \`<certainty>Observed</certainty>\`. Las probabilidades reportadas tampoco estaban calibradas en campo, por lo que \`Likely\` no era defendible frente a CAP 1.2.

**Corrección:**
- Referencias externas y sensores sin firma/autoridad verificada siguen visibles en contexto, pero **no cambian el valor heurístico, ni el estado, ni los permisos de avisos**. El estado oficial se reserva a un adaptador institucional futuro con confianza fuera de banda.
- \`canPublicWarn=false\`, \`publicAlertAuthorityVerified=false\`, \`modelCalibrationVerified=false\`, \`individualHumanIdentityVerified=false\` y \`sensorMeasurementsAuthenticated=false\` en las evaluaciones del módulo ciudadano.
- Un informe SND3 de un pseudónimo no demuestra que provenga de una persona distinta. El texto de reporte y CAP ahora habla de seudónimos, no de personas independientes acreditadas.
- El exportador CAP ciudadano solo emite \`Exercise + Restricted + certainty Unknown\` y **rechaza** \`state OFFICIAL\` o \`exercise:false\`, aunque un llamador haya creado dichos campos. Nunca emite una alerta pública.
- \`packages/senda/tests/untrusted-official-evidence-gate.test.mjs\` comprueba suplantación de fuente, sensor falso, caducidad y rutas CAP.
- Los archivos \`packages/senda/src/hazard-reports.mjs\` y \`investor-next/public/senda/core/hazard-reports.mjs\` están sincronizados bit a bit.

**Referencia de formato:** OASIS CAP 1.2 define \`Observed\` como hecho determinado y \`Unknown\` como certeza desconocida; un cálculo heurístico sin certificación del emisor no acredita una observación oficial: https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2.html .

**Pendiente (bloqueador de piloto):** diseñar un adaptador real de fuente institucional, con claves públicas ancladas fuera del repositorio, rotación, revocación, caducidad, confianza de transportes, control de zonas y permisos de publicación. No introducir \`official:true\` como sustituto de la autenticación. Verificar interfaz y dependencia de todos los actores antes de integrar \`master\`.


## H15 · Cortes deterministas de dominios de fallo (N−1 y N−2)

**Motivación:** H13 comprueba si dos rutas declaradas comparten riesgos. Eso no basta para contestar si **todo** el sistema pierde caminos tras una o dos averías de causa común. Un solo teléfono usado como emisor puede ser un punto único de fallo aunque tenga Bluetooth, LoRa y satélite. RFC 6414 §3.1.10 reconoce SRLG como conjunto de enlaces que comparten un riesgo lógico o físico. RFC 8001 discute la recogida de información SRLG en redes con dominio de gestión; trasladar este concepto a una pila experimental heterogénea exige comprobar la información de cada portador.

**Implementado:** \`packages/senda/src/failure-domain-cuts.mjs\` y \`packages/senda/tests/failure-domain-cuts.test.mjs\`, además de copia idéntica en la app web offline.

**Modelo:** conjunto finito de enlaces \`L\`, rutas declaradas \`P\`, dominios \`D\`. Cada ruta p contiene enlaces \`linkIds\` y dependencias de terminales \`endpointRiskDomains\`; sus dominios incluyen los identificadores de enlace y los SRLG de enlaces/terminales. El mismo nombre físico (por ejemplo \`GRID-X\`) se unifica en la **misma** categoría SRLG independientemente de que esté declarado en un enlace o en un terminal. Sea \`F⊆D\` el conjunto de recursos fallidos, y \`U(F)={p∈P autorizados declarativamente: riesgos(p)∩F=∅}\`. Un conjunto F es un corte bajo el modelo si \`|U(F)| < requiredSurvivingPaths\`. Se enumeran exhaustivamente todos los F con tamaño 1 o 2, hasta un máximo de 64 dominios declarados, 40 caminos y 1024 enlaces de referencia. Complejidad aproximada O(|D|² × |P| × riesgosPorRuta), acotada.

**Salidas:** \`singleDomainCuts\`, \`doubleDomainCuts\`, \`smallestObservedCutSize\`, \`declaredN1Resilience\`, \`declaredN2Resilience\`, \`eligiblePathCount\`, \`excludedPathIds\`, \`pathRiskTable\`, y estado \`SHADOW_TOPOLOGY_RESEARCH_ONLY\`. En la ausencia de cualquier metadato físico aparece un dominio \`UNKNOWN_TOPOLOGY\` que afecta conservadoramente **a todas las rutas**; entonces \`declaredN1Resilience=false\`, aunque en teoría algunas vías pudieran funcionar.

**Ejemplos falsables:**
- LTE y SMS unidos a \`GRID-A\`, \`TOWER-9\` y una misma batería: esos tres dominios pueden cortar las dos rutas aunque sus portadores sean distintos.
- Dos rutas que declaran dominios totalmente disjuntos pueden tolerar cualquier fallo individual enumerado, **pero no necesariamente dos simultáneos**.
- Tres rutas con dominios disjuntos y terminales realmente independientes *según inventario declarado* resisten dos fallos del catálogo, pero el modelo no contempla fallos no inventariados ni demuestra fiabilidad RF.

**Validación:** pruebas adversariales contra inventarios duplicados/incompletos, autorización ausente, recursos transversales, desempate estable, límites de coste computacional y 100 topologías aleatorias confrontadas con un enumerador independiente en las pruebas. Ninguna cota de N−1/N−2 implica más de 0% de disponibilidad verificada en campo: se trata de lógica de conjuntos, no probabilidades calibradas.

**Hipótesis H15:** al descubrir cortes comunes de energía, gateway, torre, proveedor, batería, firmware o puente, se reduce el número de rutas erróneamente clasificadas como redundantes, frente a un sistema que solo contabiliza portadores. Debe probarse contra inventario real autorizado, apagones controlados y telemetría de campo. No automatizar ensayos sobre redes de terceros.

**Valor de producto potencial:** ofrecer a Protección Civil un mapa de **dependencias críticas y cortes** verificable en una infraestructura voluntaria de piloto, con manifest de fuente, titular del equipo, permiso, fecha de inspección, integridad de inventario y plan de mitigación por cada corte. Sin esas pruebas solo sirve como laboratorio.

Fuentes: https://www.rfc-editor.org/rfc/rfc6414.html , https://www.rfc-editor.org/rfc/rfc8001.html .

**Afirmaciones expresamente prohibidas:** «N−1 certificado», «comunicaciones garantizadas», «dos tecnologías equivalen a redes independientes», «certificación ENS/RED/CRA obtenida», «acceso satelital confirmado». Ninguna de las implementaciones H11–H15 modifica la política real de transmisión, ni autoriza conexión a 112, redes policiales o satélites.


## H16 · Composición arquitectónica: incertidumbre + topología + reconstrucción k-de-n

**Problema de integración:** tener dos rutas estructuralmente distintas no es suficiente para recuperar un mensaje de Reed–Solomon si este requiere dos fragmentos (\`k=2\`) y uno desaparece. H15 cuenta caminos; H11 evalúa probabilidad condicionada de recibir k fragmentos. El acoplamiento correcto exige respetar **qué fragmentos reales dependen de qué ruta física declarada**.

**Motor implementado:** \`packages/senda/src/cross-layer-survivability.mjs\` con espejo de lectura offline, pruebas \`cross-layer-survivability.test.mjs\` y gate de CI Node 22/24.

Entrada de laboratorio:
- \`links\`, \`paths\` con dominios SRLG y endpoints explícitos de H15.
- \`states\` del modelo de incertidumbre, opcionalmente generados por la secuencia H12/H14 y \`UNKNOWN\`.
- \`plans\` de H11 con grupos \`{id, shards, p}\`, umbral \`k\`, costes, energía y permisos **solo declarados**.
- \`groupPathBindings[planId]\`: lista por posición que asocia cada grupo de fragmentos a una ruta física declarada; un portador puede aparecer más de una vez, sin fingir que comparte independencia.

Para un subconjunto de recursos fallidos \`F\`, se consideran supervivientes solo los grupos cuyos caminos no intersectan \`F\`. El plan es reconstruible bajo ese fallo si:

\`sum_{grupo g: dominios(camino_g) ∩ F = vacío} shards_g >= k\`.

Se enumera F con cardinalidad 1 y 2 sobre los dominios de los caminos ligados al plan. Se calcula \`declaredN1ShardReconstruction\`/\`declaredN2ShardReconstruction\`, cuántos escenarios impiden reconstrucción y el mínimo de fragmentos supervivientes. Se **intersecta** este gate estructural con el resultado \`auditAssuranceAgainstUncertainHazards\` de H11. No se ofrece \`selectedId\` si falla cualquiera de los dos gates, o si hay dependencias físicas incompletas.

**Contraejemplo:** dos radios muy fiables sobre caminos declarativamente disjuntos, un fragmento por radio y \`k=2\`: una sola avería impide reconstruir. En cambio, con \`k=1\`, cualquiera de las dos puede servir frente al fallo individual declarado. Con tres caminos y \`k=1\`, hasta dos fallos individuales pueden ser tolerables si no comparten terminales u otros SRLG.

**Pruebas:** entradas incompletas, rutas inventadas, permisos no acreditados, fragmentos duplicados que comparten gateway, límites de probabilidad, garantías N−1/N−2 y prueba integral **H14 → H12 → H11 → H15 → H16** con escenario UNKNOWN. Todas las salidas conservan \`physicalTestingCompleted:false\`, \`institutionallyAuthenticated:false\`, \`noCommandEmission:true\` y \`mayOperateEmergencyInfrastructure:false\`.

La distinción entre *elegibilidad de laboratorio* y *capacidad de emergencia operativa* es obligatoria. Falta medir enlaces RF autorizados, comprobar permisos de terceros, evaluar relojes y acuses de receptor, y contar con certificación de componente y protocolo acordado por el organismo. Nada de lo anterior es un descubrimiento de una nueva ley matemática; la innovación potencial está en **conectar modelos físicos, incertidumbre y codificación tolerante a fallos de forma verificable**.

**Prueba falsable:** comparar H16 contra escoger el camino de mayor probabilidad nominal con idénticos presupuestos de transmisión/energía y 100+ episodios de laboratorio por falla, registrando los casos donde H16 no aporta mejora o empeora latencia. Modelos de simulación pueden priorizar ensayos, pero nunca sirven por sí solos como resultado de campo.
