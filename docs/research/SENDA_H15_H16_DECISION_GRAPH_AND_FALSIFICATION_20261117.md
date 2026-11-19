# SENDA · Investigación H15–H16 — decisión trazable y prueba de ventaja contra baselines
Fecha: 17-11-2026 · **SOLO LABORATORIO / SHADOW MODE** · Dependencias: Claude PR #32 → seguridad P0 PR #39 → incertidumbre H11–H14 PR #42 → integración y evaluación H15–H16 PR #43.

## Brecha de arquitectura identificada
La prueba de 643 tests en PR #42 demuestra que múltiples motores individuales pasan casos de software, pero **no que un sistema de emergencias pueda tomar decisiones confiables extremo a extremo**. Tampoco demuestra superioridad frente a esperar a la red o a un baseline FIFO bajo los mismos recursos.

**H15 — Resilience Council** implementa una función de auditoría que recorre:
1. \`scenario-frequency-evidence\`: 30+ episodios con identificadores únicos de bloque causal declarado, categorías exhaustivas con UNKNOWN. **Una DANA multiciudad no son n incidentes IID independientes**.
2. \`anytime-scenario-confidence\`: intervalo simultáneo para cualquier momento de consulta, usando Hoeffding y reparto de error por n·(n+1).
3. \`attachConservativeResearchHazards\`: cuando el tipo de fallo se desconoce, éxito garantizado cero para todos los portadores a efectos de una cota inferior.
4. \`shared-risk-topology\`: se niega a tratar rutas que comparten energía, torre o gateway como físicamente disjuntas; sin datos de topología, usa UNKNOWN_TOPOLOGY como riesgo universal.
5. \`auditDeclaredContactWindow\`: compara duración de transmisión *declarada*, tasa de bytes, handshake, inicio/fin y plazo. No realiza propagación orbital, predicción RF o contacto real.
6. \`robust-assurance-audit\`: cálculo condicional del motor Claude y cota inferior sin independencia oculta de paquetes.
7. \`robust-scenario-risk\`: peor caso sobre masas de escenarios inciertas, usando programa lineal exacto sobre caja ∩ simplex.
8. \`reproducibilitySha256\`: digest SHA-256 de **entrada JSON canonizada**, sin acreditar origen, firma, integridad de almacenamiento ni cadena de custodia institucional.

La selección devuelve exclusivamente \`RESEARCH_ONLY_COUNTERFACTUAL_PAIR\`, y siempre \`maySendTraffic:false\`, \`mayIssuePublicAlert:false\`, \`mayClaimCertifiedEmergencyDelivery:false\`. La selección es una decisión de hipótesis *interna*, no operativa.

**Límite conocido:** 1 ventana de contacto por ruta. **No** demuestra routing multihop, capacidad de satélite ni servicio D2C, energía real, cobertura de radio o compatibilidad de operador. La variable \`p\` sigue siendo hipótesis, el riesgo UNKNOWN es deliberadamente conservador y el fichero de origen/metadata puede ser falsificado por el llamador. La firma institucional queda bloqueada hasta disponer de PKI/identidades verificadas externamente.

## H16 — evaluación falsable de política frente a baseline, no duplicada con Brier
\`calibration-gates.mjs\` del proyecto ya calcula calibración, Brier y RMSE en casos apartados. H16 añade una pregunta distinta: **¿la nueva política entrega antes de un plazo más veces que un baseline predefinido, consumiendo el mismo presupuesto?**

Módulo \`paired-policy-evaluator.mjs\`:
- Dos brazos congelados antes de los datos: \`candidateVersion\` y \`baselineVersion\` diferentes, diseño \`FROZEN_SYNTHETIC_PAIRED_REPLAY\` explícito.
- Cada registro contiene \`incidentKey\`, \`causalBlockId\`, SHA-256 formal de traza, fold TEST, fecha posterior a congelación, estrato de escenario y resultado de ambos brazos ante **la misma oportunidad exógena declarada**.
- Rechaza duplicados, observaciones anteriores al congelamiento, saltos de deadline, inconsistencias de ACK, recibos sin latencia y presupuesto desigual.
- \`d_i = I{candidate on-time} - I{baseline on-time}\` toma valores -1, 0, 1. La media \`d̄\` mide diferencia de proporción de entregas puntuales en el benchmark declarado.
- Hoeffding con rango [-1,1] para tamaño prefijado n: radio \`sqrt(2 ln(2/α)/n)\`.
- Bajo consulta reiterada, radio \`sqrt(2 ln(2 n(n+1)/α)/n)\` por union bound en todos los tiempos.
- Solo una cota inferior positiva en esta comparación permite el estado **\`POSITIVE_PAIRED_GAIN_IN_SYNTHETIC_REPLAY_ONLY\`**. Aun así, siempre \`mayClaimCertifiedGain:false\`, \`eventIIDVerified:false\` y \`realReceiverReceiptsCryptographicallyVerified:false\`.
- Reporta por estratos para detectar degradaciones locales; las medias por estrato no son una garantía de mezcla geográfica futura.
- Reporta latencia p95 **solo entre los ACK recibidos** con una bandera de sesgo de supervivencia: comparar las latencias únicamente de los mensajes entregados puede resultar engañoso.

**Contraejemplo obligatorio:** si 100 paquetes de una única tormenta son contados como 100 episodios independientes, se falsea la precisión. H16 exige claves de bloque causal distintas, pero una clave única no es prueba de independencia estadística; debe verificarse externamente.

**Hipótesis H16 falsable:** frente a FIFO/esperar red y a la política puntual de Claude, con presupuestos de energía/coste/aire equivalentes, una combinación H11–H15 reduce incumplimientos de deadline en holdout causal y zonas de estrés, sin empeorar desproporcionadamente energía, p95 o fallos en subpoblaciones. Refutaciones: intervalos cruzan cero; daños en fallos desconocidos; alto coste; métricas peores tras calibración; baseline gana.

## Evaluación experimental, sin inventar pruebas de campo
Los tests incluidos usan **fixtures sintéticos**, deliberadamente fáciles/difíciles y negativos, no registros reales:
- H15: 12 pruebas de composición, con rechazo de torre compartida, permisos declarados ausentes, contacto fuera de ventana, geometría temporal imposible, datos no documentados, banda amateur cifrada y evidencia no independiente. Coteja huella reproducible ante distinto orden de claves.
- H16: 12 pruebas de benchmark, con políticas iguales, candidato peor, mejora fuerte ficticia, error secuencial, rechazos de causales/trace duplicados, filtración TRAIN/TEST, costes desequilibrados, recibos tardíos y sesgo en latencia.
- **Ninguno de esos tests valida autonomía del dispositivo, MTU real, interfaces públicas institucionales, telecom en zonas de emergencia ni seguridad de la aplicación completa**.

## Hoja de ruta con criterios de aceptación, no una promesa de producto
P0-01: Congelar hash del software/firmware y la política candidata y baseline **antes** de los ensayos.
P0-02: Inventario de permisos concretos por enlace (operador, banda, equipo homologado, role/consent); excluir cualquier red de terceros sin permiso.
P0-03: Como mínimo dos móviles y dos dispositivos compatibles con la banda legal aplicable en el laboratorio, con firmas de ACK a nivel de aplicación y bitácora monotónica + UTC.
P0-04: Capturar **fracasos**, batería, RSSI/PER, ruido e interferencia, canal, ubicación aproximada protegida, versión del firmware, contacto programado vs real, disponibilidad eléctrica y backhaul, trazas de fallo reproducibles.
P0-05: Etiquetado por **evento causal independiente**; revisión de independencia frente a una misma tormenta, apagón o proveedor; bloqueo explícito de datos sin licencia.
P0-06: Datasets por región/temporada fuera de muestra; baseline mismo hardware/aire/energía; análisis de diferencias pareadas, Brier y calibración de cobertura de intervalos, con intervalos de confianza, incertidumbre y resultados negativos.
P0-07: Ensayo de seguridad con consentimiento, DPIA y verificación institucional de CA/credenciales cuando se quiera contactar con salas/organismos. No probar con 112 ni celular/satélite sin convenio.
P0-08: Para responder emergencias de verdad se necesita validación externa de los requisitos de seguridad, ENS/CRA/RED en el alcance aplicable, interfaces CAP/operador y gobernanza de alertas.

## Trabajo por módulos que debe recibir Claude
- PR #43 integra H15/H16 sobre #42; #42 depende de #39; #39 depende de Claude #32.
- **No cherry-pick ciego a master:** en master quedan versiones anteriores con estatus científicos distintos y duplicación de archivos web/core.
- Antes del merge, generar las copias \`investor-next/public/senda/core\` desde una sola fuente y comprobar SHA de paridad en CI; no mantener duales de forma manual.
- Próxima investigación original defendible: comparar el optimizador de SENDA contra CGR, RUCoP, espera por conectividad y routing greedy con mismas restricciones y eventos retenidos. La unión SRLG + incertidumbre de eventos + dependencia libre + tiempo solo es diferenciación **si demuestra ventaja reproducible**, no por presentar matemáticas conocidas como propias.
- No desplegar a producción ni activar transmisores con resultados de modo SHADOW.

## Fuentes normativas/referencias técnicas
- IETF RFC 9171 — Bundle Protocol v7: https://www.rfc-editor.org/rfc/rfc9171.html
- IETF RFC 9172 — BPSec (integridad y confidencialidad): https://www.rfc-editor.org/rfc/rfc9172.html
- IETF RFC 6414 — Shared Risk Link Groups: https://www.rfc-editor.org/rfc/rfc6414.html
- Howard et al. (2021) Time-uniform nonparametric confidence sequences: https://doi.org/10.1214/20-AOS1991
- Ningún cumplimiento de BPv7/BPSec/CAP o SRLG debe deducirse por citar sus estándares.


## P0 adicional: falsa independencia epistemológica y acreditación de campo autoafirmada

**Auditoría del código fuente \`source-evidence.mjs\`** detectó dos vulnerabilidades semánticas que no aparecen necesariamente como errores de ejecución:

1. Dos fuentes inventadas que no figuraban en el registro \`SOURCE_DEPENDENCY_GRAPH\` producían \`independent:true\`, simplemente porque ambas tenían un conjunto de antecedentes vacío. Esa conclusión **no es una prueba de independencia**. Ahora cualquier identificador ausente devuelve \`independent:false,reason:'UNKNOWN_SOURCE_LINEAGE'\`. Para fuentes presentes la independencia sigue siendo **solo de procedencia declarada**, \`externallyAuthenticated:false\`; no equivale a causalidad independiente validada.
2. Bastaba indicar \`stage:'FIELD_VALIDATED'\` con una cadena \`fieldTrialReceiptId\` y un \`holdoutScore\` para obtener \`isFieldValidated:true\`, aunque no existía verificación de firma, identidad del evaluador, dato ni ensayo. El nuevo adaptador **no otorga ese estado**: \`requestedStage\` conserva la solicitud, pero \`stage\` efectivo queda \`HOLDOUT_TESTED\`, \`isFieldValidated:false\` y \`fieldReceiptSignatureVerified:false\` hasta desarrollar y desplegar un verificador externo con anclas de confianza autorizadas.
3. Se valida el digest SHA-256 completo, finitud del holdout y formato mínimo de identificadores. **Formato correcto** sigue sin validar que el hash coincida con los bytes o que los datos estén licenciados; esas validaciones son trabajo futuro independiente.

Pruebas de regresión contra \`UNKNOWN_SOURCE_LINEAGE\`, \`sha256:garbage\`, \`NaN\` y field IDs autoafirmados; sincronización core/browser y seguimiento en CI en los dos Node. Ningún estado de laboratorio da autorización para CAP Actual o comunicaciones de 112.

**Relevancia para financiación:** un repositorio puede tener tests verdes mientras hace afirmaciones semánticas falsas en indicadores clave. Es preferible **rechazar un estado de certificación que no se puede demostrar** antes que mostrar una insignia convincente pero no auditada. La demostración al financiador debe separar: funcionalidad calculada, matemática validada, simulación, field trial verificado por tercero e integración institucional operativa.
