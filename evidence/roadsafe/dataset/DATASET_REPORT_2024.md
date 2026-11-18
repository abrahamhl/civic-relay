# Dataset armonizado de accidentes 2024 · informe automático

Generado por `packages/senda/scripts/roadsafe-data/build-dataset.mjs`. Registros armonizados: **496895**.

> Datos de accidentes ocurridos: las proporciones son **gravedad condicionada** (sin exposición), no riesgo de accidentarse. Definiciones de gravedad y cobertura difieren entre países.

## Fuentes y procedencia

| Fuente | Ficheros | SHA-256 (12) | Ingesta |
|---|---|---|---|
| ES_DGT | es-2024.xlsx (25357990 B) | 4c39dbdf3c31 | 101996/101996 |
| ES_DGT_DICT | es-dictionary.xlsx (42553 B) | 1df06643eff9 | — |
| DE_UNFALLATLAS | de-2024.zip (12681950 B) | 4a321fbde7ca | 268519/268519 |
| DE_DSB | de-DSB_Unfallatlas.pdf (405394 B) | 3afe9d303e8c | — |
| NL_BRON | nl-2024.csv (42219285 B) | ca3d3b147e45 | 126380/126380 |
| BE_STATBEL | — | — | sin fichero manual (portal con captcha) |

## Perfil RoadSafe por país (accidentes con víctimas)

| País | Con víctimas | Alcance | Vehículo detenido | Cadena | Visibilidad tapada por vehículo | «Otro accidente» (secundario declarado) |
|---|---|---|---|---|---|---|
| ES | 101996 | 16.9 % (17279) | 0.0 % (0) | 2.0 % (1995) | 1.1 % (1130) | 0 |
| DE | 268519 | 16.0 % (42854) | 5.5 % (14673) | 0.0 % (0) | 0.0 % (0) | 0 |
| NL | 25416 | 11.1 % (2809) | 1.7 % (423) | 0.0 % (0) | 0.0 % (0) | 184 |

## Factores de gravedad (OR de mortal entre accidentes con víctimas, IC 95 %)

| País | Oscuridad vs día | Sin alumbrado vs alumbrado | Mojado vs seco | Niebla vs despejado | Alcance/detenido vs otros | Interurbano vs urbano | Curva vs recta |
|---|---|---|---|---|---|---|---|
| ES | 1.596 [1.435–1.775] * | 3.419 [2.844–4.109] * | 0.875 [0.74–1.034] | 0.355 [0.265–0.475] * | 0.435 [0.369–0.514] * | 4.614 [4.147–5.134] * | 1.237 [1.097–1.394] * |
| DE | 1.554 [1.419–1.702] * | — | 1.018 [0.927–1.117] | — | 0.356 [0.31–0.409] * | — | — |
| NL | 1.502 [1.237–1.824] * | — | 0.948 [0.781–1.151] | 2.423 [0.98–5.989] | 0.489 [0.352–0.678] * | 3.82 [3.206–4.552] * | 1.46 [1.107–1.926] * |

`*` = IC 95 % no incluye 1. OR > 1: mayor proporción de mortales entre los accidentes con víctimas en esa condición.

## Puntos negros con Bayes empírico · ES

Prior Poisson–Gamma: {"alpha":1.511,"beta":0.935} · celdas: 21555

| Celda | Conteo | Mortales | Esperado EB | Contracción |
|---|---|---|---|---|
| C-58@0 | 71 | 1 | 37.48 | 0.472 |
| B-20@10 | 40 | 0 | 21.46 | 0.464 |
| B-20@9 | 40 | 0 | 21.46 | 0.464 |
| B-20@8 | 36 | 0 | 19.39 | 0.461 |
| AP-7@146 | 34 | 0 | 18.35 | 0.46 |
| A-2@606 | 33 | 0 | 17.84 | 0.459 |
| B-10@0 | 32 | 1 | 17.32 | 0.459 |
| B-20@16 | 32 | 0 | 17.32 | 0.459 |
| B-20@11 | 31 | 0 | 16.8 | 0.458 |
| B-20@13 | 29 | 0 | 15.77 | 0.456 |

## Puntos negros con Bayes empírico · DE

Prior Poisson–Gamma: {"alpha":0.4,"beta":0.134} · celdas: 89811

| Celda | Conteo | Mortales | Esperado EB | Contracción |
|---|---|---|---|---|
| 52.52,13.41 | 115 | 1 | 101.77 | 0.115 |
| 50.93,6.93 | 109 | 1 | 96.48 | 0.115 |
| 52.49,13.38 | 105 | 0 | 92.95 | 0.115 |
| 53.55,10.00 | 104 | 0 | 92.07 | 0.115 |
| 50.93,6.95 | 97 | 0 | 85.9 | 0.114 |
| 52.37,9.73 | 93 | 0 | 82.37 | 0.114 |
| 50.11,8.67 | 92 | 1 | 81.49 | 0.114 |
| 48.13,11.56 | 91 | 0 | 80.61 | 0.114 |
| 50.11,8.68 | 91 | 0 | 80.61 | 0.114 |
| 52.51,13.38 | 91 | 0 | 80.61 | 0.114 |

## Puntos negros con Bayes empírico · NL

Prior Poisson–Gamma: {"alpha":0.339,"beta":0.051} · celdas: 19173

| Celda | Conteo | Mortales | Esperado EB | Contracción |
|---|---|---|---|---|
| 52.41,4.86 | 195 | 0 | 185.78 | 0.047 |
| 51.92,4.47 | 188 | 0 | 179.12 | 0.047 |
| 52.06,4.31 | 184 | 0 | 175.32 | 0.047 |
| 52.06,4.30 | 178 | 0 | 169.61 | 0.047 |
| 52.06,4.29 | 169 | 0 | 161.05 | 0.047 |
| 52.06,4.28 | 150 | 1 | 142.98 | 0.047 |
| 52.16,4.48 | 144 | 1 | 137.27 | 0.047 |
| 52.07,4.31 | 141 | 0 | 134.42 | 0.047 |
| 52.05,4.30 | 138 | 1 | 131.57 | 0.047 |
| 52.16,5.56 | 135 | 0 | 128.71 | 0.047 |

