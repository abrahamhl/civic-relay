> **EXPLORATORIO, POST HOC (effectiveProbes = 200).** Ejecutado después de ver el resultado prerregistrado; no confirma nada.

# SENDA ARR — resultados del experimento H2 (asimilación de perímetros)

> Generado por `experiments/run-forecast-experiment.mjs` (2026-11-17T07:19:47.324Z). Resultado OBSERVADO: el punto queda dentro del perímetro acumulado en ≤ 24 h. Pronósticos PREDICHOS con datos ≤ instante de planificación.

Unidades (incendio × instante): 34 · 300 puntos por unidad · tasa base observada de llegada en 24 h: 5.4 %

| Pronóstico | Brier medio | Sesgo (pp) | ECE |
|---|---|---|---|
| persistence | 0.0539 | -5.4 | 0.054 |
| prior | 0.1214 | 9.6 | 0.132 |
| assimilated | 0.0944 | 3.7 | 0.098 |

- Brier(prior) − Brier(asimilado): 0.0270 [-0.0022, 0.0657] · reducción relativa 22.2 %
- Brier(persistencia) − Brier(asimilado): -0.0405 [-0.0857, -0.0137] (negativo = la persistencia es mejor)
- Brier(persistencia) − Brier(prior): -0.0675 [-0.1354, -0.0186]

| Incendio | Unidades | Persistencia | Prior | Asimilado | Prior − asimilado [IC 95 %] |
|---|---|---|---|---|---|
| camp | 12 | 0.0731 | 0.0939 | 0.1092 | -0.0153 [-0.0369, 0.0057] |
| carr | 12 | 0.0133 | 0.0326 | 0.0222 | 0.0104 [0.0025, 0.0191] |
| woolsey | 10 | 0.0797 | 0.2609 | 0.1634 | 0.0975 [0.0033, 0.2064] |

## Veredicto prerregistrado

- IC inferior > 0: **no** · reducción ≥ 15 %: **sí** → H2 **RECHAZADA**
- ¿Mejora a la persistencia?: **no**
