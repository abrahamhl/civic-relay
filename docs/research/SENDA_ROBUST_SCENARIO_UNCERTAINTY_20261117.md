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
