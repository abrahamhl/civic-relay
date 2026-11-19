# SENDA `H-ARR-R` Convergence Contract (Adaptador A2)

Este módulo experimental implementa **H-ARR-R** (planificación robusta por custodio en horizonte recedente) reutilizando por contrato:
- `experimental/senda-arr/src/arr-core.mjs`: grafo temporal elegible (`buildProblem`), ventanas (`hopTiming`, `hopAlive`), conjunto de escenarios (`normalizeEnsemble`) y línea base estática `ARR_STATIC` (`planAdaptiveResilience`).
- `packages/senda/src/failure-domain-cuts.mjs`: dominios compartidos SRLG N-1 / N-2 (`enumerateDeclaredFailureCuts`).
- `packages/senda/src/transport-telemetry.mjs`: semántica de custodia (`CUSTODY_ACK` distinto de `DESTINATION_ACK`), consentimiento, caducidad y revocación.
- `packages/senda/src/erasure.mjs`: umbral de reconstrucción `k-de-n` sin suponer independencia entre portadores.

**Prohibido:** copiar código del simulador #44, transmitir telemetría real desde este simulador, usar contactos futuros o afirmar entrega física desde métricas simuladas (`evidenceKind: SIMULATED_ONLY`).
