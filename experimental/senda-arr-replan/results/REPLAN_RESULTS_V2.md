# SENDA A2 (H-ARR-R-v2) — Resultados Confirmatorios Bajo Choque Mid-Horizon y Coste de Oportunidad

- **Evidencia:** `SIMULATED_ONLY` (120 bloques independientes nuevos, semillas disjuntas, choque regional mid-horizon no anticipado en t0).
- **V1 anterior archivado honestamente como negativo:** ver `REPLAN_RESULTS_V1_REJECTED.md`.

| Estrategia | Entrega (%) | TX medias | Airtime medio (ms) | Energía media (mJ) | CPU p95 Node (ms) | Violaciones seg. |
|---|---:|---:|---:|---:|---:|---:|
| WAIT | 0.0 | 0.00 | 0 | 0 | 0.28 | 0 |
| CGR_EARLIEST | 58.3 | 2.31 | 22676 | 406 | 0.31 | 0 |
| PROPHET_WARM | 81.7 | 8.49 | 82821 | 1361 | 0.33 | 0 |
| SPRAY_AND_FOCUS | 85.0 | 9.24 | 91410 | 1448 | 0.28 | 0 |
| EPIDEMIC_CAPPED | 65.0 | 8.24 | 80558 | 1314 | 0.26 | 0 |
| ARR_STATIC | 94.2 | 7.26 | 62644 | 1071 | 10.26 | 0 |
| ARR_REPLAN_V2 | 94.2 | 5.42 | 38702 | 694 | 9.37 | 0 |
| EPIDEMIC_CEILING | 96.7 | 25.13 | 254706 | 4420 | 0.33 | 0 |

## Diferencias Pareadas V2 (IC 95 %, 10.000 resamples)
- **ARR_REPLAN_V2 − ARR_STATIC:** 0.00 pp [-2.50, 2.50] pp
- **ARR_REPLAN_V2 − CGR_EARLIEST:** 35.83 pp [27.50, 45.00] pp
- **ARR_REPLAN_V2 − PROPHET_WARM:** 12.50 pp [6.67, 18.33] pp
- **ARR_REPLAN_V2 − SPRAY_AND_FOCUS:** 9.17 pp [4.17, 15.00] pp
- **Ratio TX vs STATIC:** 0.75x (IC sup 0.83x) · **Ratio Energía vs STATIC:** 0.65x (IC sup 0.76x) · **Ratio Airtime:** 0.62x

## Ablaciones V2
| Ablación | Entrega (%) | TX medias | Energía media (mJ) |
|---|---:|---:|---:|
| noReplan | 94.2 | 6.24 | 921 |
| noSrlg | 94.2 | 5.42 | 694 |
| noHazardUpdate | 94.2 | 5.37 | 685 |
| noAckGossip | 94.2 | 8.00 | 1077 |
| noGlobalBudget | 94.2 | 7.82 | 999 |
| priorOnly | 94.2 | 5.37 | 685 |

## Decisión Protocolo V2: **REJECTED_OR_INCONCLUSIVE**