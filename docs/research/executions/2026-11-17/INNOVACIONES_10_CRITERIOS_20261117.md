# Evaluación de Innovaciones Autónomas (Filtro de 10 Criterios · Fase 3)

Siguiendo la restricción de priorizar un máximo de tres innovaciones de alto impacto y no dispersar esfuerzo ni reivindicar física nueva o patentes sin búsqueda de anterioridad, se evalúan tres contribuciones concretas:

---

## Innovación 1 — `H-INN-ACK`: Supresión Causal de Réplicas mediante Piggyback de `DESTINATION_ACK` bajo Presupuesto Compartido SRD

1. **Problema no resuelto:** En mallas oportunistas intermitentes (`H-ARR-R`), una vez que una de las $K$ réplicas alcanza el destino, los demás custodios siguen consumiendo batería y ciclo de trabajo subbanda EU868 transmitiendo copias ya inútiles.
2. **Solución publicada más cercana:** Esquemas VACCINE / anti-packet en DTN (Haas & Small 2006) y recuperación por ACK en BPv7 (RFC 9171).
3. **Diferencia técnica en SENDA:** Acopla la invalidación de custodios (`DESTINATION_ACK` firmado, nunca `CUSTODY_ACK`) al planificador submodular con presupuesto conjunto de *airtime* y *energía* y dominios SRLG, liberando cuota para el resto de fragmentos $k$-de-$n$.
4. **Formulación:** Cada encuentro sano actualiza $A_u(t) \leftarrow \max(A_u(t), A_v(t))$; si $A_u(t) \ge t_{\text{ack}}(m)$, $\text{TX}(m)$ pasa a ser cero (`ABSTAIN_ACKED`).
5. **Hipótesis falsable:** A igualdad de tasa de entrega $\ge 90\%$ en simulación `V2`, activar `H-INN-ACK` reduce al menos un 20 % las transmisiones y la energía respecto a la ablación `noAckGossip`.
6. **Datos independientes requeridos:** Trazas de encuentros medidos con al menos 2 Android / LoRa y timestamp de recepción de ACK en receptor independiente.
7. **Funcionamiento offline:** Estado puramente local por encuentro par-a-par; cero servidores centrales.
8. **Coste energético/computacional:** $O(1)$ por encuentro (comprobación de mapa de IDs terminales); ahorro medido en `REPLAN_RESULTS_V2.md`: **`5.42` vs `8.00` TX (`-32.3 %`)** y **`694 mJ` vs `1077 mJ` (`-35.6 %`)** a igual entrega (`94.2 %`). *(Cifra `SIMULATED_ONLY`, PC Node p95 = `9.37 ms`).*
9. **Experimento refutador:** Si la latencia del canal de retorno supera el TTL o si la tasa de pérdida de paquetes de control borra los ACKs antes del encuentro secundario.
10. **Valor financiable:** Extiende directamente el tiempo de batería y cumple límites regulatorios estrictos de ciclo de trabajo en redes SRD sin infraestructura.

---

## Innovación 2 — `H-INN-DAG`: Grafo DAG Causal de Procedencia y Atenuación Log-Odds Contra Falsa Corroboración (`causal-evidence-fusion.mjs`)

1. **Problema no resuelto:** Multiplicar alertas de `GDACS` y `USGS`, o de dos recortes redistribuidos del mismo evento (`ancestryHash`), genera sobreconfianza extrema en fusiones Naive Bayes.
2. **Solución publicada más cercana:** Bayes Net / Evidence Theory (Dempster-Shafer) y *fact-checking* por linaje (Pearl 2009).
3. **Diferencia técnica en SENDA:** Union-find causal sobre linaje primario (`SOURCE_DEPENDENCY_GRAPH` + `ancestryHash` + `rootEventId`) con atenuación explícita por presencia de ancla institucional verificada, bloqueo `t_avail <= t0` y salida automática `ABSTAIN` cuando la contradicción entre clústeres independientes supera umbral.
4. **Formulación:** Un único término log-odds $\eta_{\text{causal}} = \eta_0 + \sum_{c \in \mathcal{C}_{\text{indep}}} w_c \big(\text{logit}(p_c) - \eta_0\big)$ por componente conexo ancestral, donde $w_c \in \{0.30, 0.75, 1.0\}$ según anclaje.
5. **Hipótesis falsable:** Menor Brier score frente a `Naive Bayes` correlacionado en presencia de duplicados/fuentes dependientes sin aumentar el retraso ni aceptar alertas `Actual`.
6. **Datos independientes requeridos:** Incidentes multi-fuente archivados con sellos de captura y publicación independientes (USGS, EMSC, FIRMS, Copernicus EMS).
7. **Funcionamiento offline:** El grafo estático y las reglas de evaluación corren al 100 % en cliente PWA / Android sin red (`investor-next/public/senda/core/causal-evidence-fusion.mjs`).
8. **Coste:** $O(n^2)$ trivial para $n \le 200$ reportes locales (< 1 ms). Verificado en `fusion-abstention.test.mjs` (30 episodios controlados).
9. **Experimento refutador:** Si el grafo de dependencias reales está desactualizado o dos fuentes aparentemente independientes comparten un detector upstream no catalogado.
10. **Valor financiable:** Diferencial técnico verificable para centros de control que deben filtrar desinformación o ecos mediáticos sin automatizar alertas falsas.

---

## Innovación 3 — `H-INN-BOOT`: Sincronización Conservadora de Deriva Inter-Arranque mediante Contadores Monotónicos + Retos ECDSA (`Propuesta Pendiente de Hardware`)

1. **Problema no resuelto:** Tras un corte eléctrico en un móvil Android, `SystemClock.elapsedRealtime()` vuelve a `0` y el reloj NTP/pared no es confiable sin internet; una cola DTN puede expirar demasiado tarde o rechazar entregas válidas.
2. **Solución publicada más cercana:** Relojes lógicos de Lamport / vectores de versión y estimación conservadora de TTL en BPv7 (RFC 9171 §4.2).
3. **Diferencia técnica en SENDA:** Empareja `(bootCounter, monotonicDeltaMs, challengeNonce)` en el recibo `LabReceiptSigner` para acotar la ventana mínima transcurrida entre dos equipos emparejados sin depender de reloj absoluto de red; ante salto incoherente de reloj de pared, `LabPersistentQueue` aplica expiración fail-closed inmediata (`CLOCK_INCOHERENT_QUARANTINE`).
4. **Formulación:** Para una pareja que intercambia retos en $b_1$ y $b_2$, si el salto local cae fuera de $[\Delta_{\min}, \Delta_{\max}]$ o $t_{\text{wall}} < t_{\text{created}} - \epsilon$, se marca `EXPIRED` sin reenviar.
5. **Hipótesis falsable:** `0` mensajes revocados o caducados rehidratados tras 30 reinicios forzados / apagados simulados con reloj manipulado atrás en laboratorio Android + LoRa.
6. **Datos independientes requeridos:** 2 teléfonos Android físicos reales sometidos a apagado y modificación de hora del sistema (`NOT_TESTED` actualmente).
7. **Funcionamiento offline:** 100 % local entre nodos sin NTP ni GNSS obligatorio.
8. **Coste:** Bytes residuales en cabecera del recibo (8 bytes de contador + nonce UUID) y despreciable CPU.
9. **Experimento refutador:** Si el reloj de pared salta hacia adelante de forma maliciosa o ambos dispositivos pierden energía exactamente a la vez con deriva severa del oscilador.
10. **Valor financiable:** Requisito previo indispensable para cualquier piloto regulado donde un mensaje antiguo nunca deba resucitar tras un reinicio de terminal en campaña.
