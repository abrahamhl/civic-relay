# SENDA ARR — resultados del experimento H2 (asimilación de perímetros)

> Generado por `experiments/run-forecast-experiment.mjs` (2026-11-17T07:19:49.453Z). Resultado OBSERVADO: el punto queda dentro del perímetro acumulado en ≤ 24 h. Pronósticos PREDICHOS con datos ≤ instante de planificación.

Unidades (incendio × instante): 34 · 300 puntos por unidad · tasa base observada de llegada en 24 h: 5.4 %

| Pronóstico | Brier medio | Sesgo (pp) | ECE |
|---|---|---|---|
| persistence | 0.0539 | -5.4 | 0.054 |
| prior | 0.1214 | 9.6 | 0.132 |
| assimilated | 0.0943 | 6.3 | 0.103 |

- Brier(prior) − Brier(asimilado): 0.0271 [-0.0008, 0.0668] · reducción relativa 22.4 %
- Brier(persistencia) − Brier(asimilado): -0.0403 [-0.0798, -0.0123] (negativo = la persistencia es mejor)
- Brier(persistencia) − Brier(prior): -0.0675 [-0.1354, -0.0186]

| Incendio | Unidades | Persistencia | Prior | Asimilado | Prior − asimilado [IC 95 %] |
|---|---|---|---|---|---|
| camp | 12 | 0.0731 | 0.0939 | 0.0957 | -0.0017 [-0.0138, 0.0101] |
| carr | 12 | 0.0133 | 0.0326 | 0.0286 | 0.0040 [-0.0009, 0.0102] |
| woolsey | 10 | 0.0797 | 0.2609 | 0.1714 | 0.0896 [-0.0048, 0.1958] |

## Veredicto prerregistrado

- IC inferior > 0: **no** · reducción ≥ 15 %: **sí** → H2 **RECHAZADA**
- ¿Mejora a la persistencia?: **no**
