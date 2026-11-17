# SENDA A2 (H-ARR-R) — Resultados Confirmatorios en Simulación

- **Evidencia:** `SIMULATED_ONLY` (120 sesiones independientes = 40 por familia × 3 familias no derivadas de #44, bootstrap pareado 10.000 muestras).
- **Presupuesto igual para comparadores acotados:** maxCopies=6, airtimeMax=95000 ms, energyMax=2100 mJ.

| Estrategia | Entrega (%) | TX medias | Airtime medio (ms) | Energía media (mJ) | CPU p95 Node (ms) | Violaciones seg. |
|---|---:|---:|---:|---:|---:|---:|
| WAIT | 0.0 | 0.00 | 0 | 0 | 0.42 | 0 |
| CGR_EARLIEST | 52.5 | 2.33 | 22813 | 409 | 0.67 | 0 |
| PROPHET | 0.0 | 0.00 | 0 | 0 | 0.37 | 0 |
| SPRAY_AND_FOCUS | 85.8 | 9.10 | 89802 | 1466 | 0.57 | 0 |
| EPIDEMIC_CAPPED | 65.0 | 8.34 | 81267 | 1328 | 0.62 | 0 |
| ARR_STATIC | 95.8 | 8.25 | 71541 | 1205 | 24.66 | 0 |
| ARR_REPLAN | 65.0 | 6.08 | 64372 | 1047 | 2.60 | 0 |
| EPIDEMIC_CEILING | 98.3 | 25.44 | 257819 | 4480 | 0.47 | 0 |

## Diferencias Pareadas (IC 95 %, 10.000 resamples)
- **ARR_REPLAN − ARR_STATIC:** -30.83 pp [-39.17, -23.33] pp
- **ARR_REPLAN − CGR_EARLIEST:** 12.50 pp [5.83, 20.00] pp
- **ARR_REPLAN − PROPHET:** 65.00 pp [56.67, 73.33] pp
- **Ratio TX vs STATIC:** 0.74x (IC sup 0.78x) · **Ratio Energía vs STATIC:** 0.87x (IC sup 0.95x) · **Ratio Airtime:** 0.90x

## Ablaciones (`ARR_REPLAN`)
| Ablación | Entrega (%) | TX medias | Energía media (mJ) |
|---|---:|---:|---:|
| noReplan | 95.8 | 6.99 | 1019 |
| noSrlg | 65.0 | 6.08 | 1047 |
| noHazardUpdate | 65.0 | 6.08 | 1048 |
| noAckGossip | 65.0 | 8.31 | 1323 |
| noGlobalBudget | 98.3 | 11.03 | 2054 |
| priorOnly | 65.0 | 6.08 | 1048 |

## Decisión Prerregistrada: **REJECTED_OR_INCONCLUSIVE**
> Nota obligatoria: CPU p95 (2.601 ms) medido en Node.js PC; la latencia en Android real y el PDR físico RF permanecen **NOT_TESTED**.