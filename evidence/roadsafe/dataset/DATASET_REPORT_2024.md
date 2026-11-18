# Dataset armonizado de accidentes 2024 · informe automático

Generado por `packages/senda/scripts/roadsafe-data/build-dataset.mjs`. Registros armonizados: **652224**.

> Datos de accidentes ocurridos: las proporciones son **gravedad condicionada** (sin exposición), no riesgo de accidentarse. Definiciones de gravedad y cobertura difieren entre países.

## Fuentes y procedencia

| Fuente | Ficheros | SHA-256 (12) | Ingesta |
|---|---|---|---|
| ES_DGT | es-2024.xlsx (25357990 B) | 4c39dbdf3c31 | 101996/101996 |
| ES_DGT_DICT | es-dictionary.xlsx (42553 B) | 1df06643eff9 | — |
| DE_UNFALLATLAS | de-2024.zip (12681950 B) | 4a321fbde7ca | 268519/268519 |
| DE_DSB | de-DSB_Unfallatlas.pdf (405394 B) | 3afe9d303e8c | — |
| FR_CARACT | fr-caract-2024.csv (6538156 B) | 45a69360aeb5 | — |
| FR_LIEUX | fr-lieux-2024.csv (7070795 B) | a500a44b4efd | — |
| FR_VEHICULES | fr-vehicules-2024.csv (6369908 B) | 40261a1d5ac0 | — |
| FR_USAGERS | fr-usagers-2024.csv (13843733 B) | 4e05cea88d5a | — |
| FR_DICT | fr-description-bases.pdf (897872 B) | 8ed3bc135f90 | — |
| UK_COLLISION | uk-collision-2024.csv (19208488 B) | 32a78f4662e3 | — |
| UK_VEHICLE | uk-vehicle-2024.csv (20296911 B) | 1a60f65f07a4 | — |
| UK_AADF | uk-aadf.zip (19464638 B) | 5273cf63da4c | — |
| NL_BRON | nl-2024.csv (42219285 B) | ca3d3b147e45 | 126380/126380 |
| BE_STATBEL | — | — | sin fichero manual (portal con captcha) |

## Perfil RoadSafe por país (accidentes con víctimas)

| País | Con víctimas | Alcance | Vehículo detenido | Cadena | Visibilidad tapada por vehículo | «Otro accidente» (secundario declarado) |
|---|---|---|---|---|---|---|
| ES | 101996 | 16.9 % (17279) | 0.0 % (0) | 2.0 % (1995) | 1.1 % (1130) | 0 |
| DE | 268519 | 16.0 % (42854) | 5.5 % (14673) | 0.0 % (0) | 0.0 % (0) | 0 |
| NL | 25416 | 11.1 % (2809) | 1.7 % (423) | 0.0 % (0) | 0.0 % (0) | 184 |
| FR | 54402 | 13.1 % (7108) | 0.0 % (0) | 3.3 % (1819) | 0.0 % (0) | 0 |
| GB | 100927 | 0.0 % (0) | 0.0 % (0) | 0.0 % (0) | 0.0 % (0) | 0 |

## Factores de gravedad (OR de mortal entre accidentes con víctimas, IC 95 %)

| País | Oscuridad vs día | Sin alumbrado vs alumbrado | Mojado vs seco | Niebla vs despejado | Alcance/detenido vs otros | Interurbano vs urbano | Curva vs recta |
|---|---|---|---|---|---|---|---|
| ES | 1.596 [1.435–1.775] * | 3.419 [2.844–4.109] * | 0.875 [0.74–1.034] | 0.355 [0.265–0.475] * | 0.435 [0.369–0.514] * | 4.614 [4.147–5.134] * | 1.237 [1.097–1.394] * |
| DE | 1.554 [1.419–1.702] * | — | 1.018 [0.927–1.117] | — | 0.356 [0.31–0.409] * | — | — |
| NL | 1.502 [1.237–1.824] * | — | 0.948 [0.781–1.151] | 2.423 [0.98–5.989] | 0.489 [0.352–0.678] * | 3.82 [3.206–4.552] * | 1.46 [1.107–1.926] * |
| FR | 1.514 [1.403–1.634] * | 4.269 [3.721–4.899] * | 0.992 [0.908–1.084] | 2.553 [1.988–3.278] * | 0.402 [0.352–0.459] * | 3.591 [3.331–3.873] * | 1.852 [1.712–2.002] * |
| GB | 1.675 [1.51–1.859] * | 2.947 [2.5–3.473] * | 1.215 [1.087–1.359] * | 1.098 [0.545–2.214] | — | — | — |

## Vehículo detenido y arcén (caso de investigación)

| País | Bandera | n con dato | Con la condición | % mortal si la tiene | OR mortal vs resto | OR mortal oscuridad dentro | % en vía rápida |
|---|---|---|---|---|---|---|---|
| DE | stoppedVehicle | 268519 | 17313 (6.45 %) | 0.34 % | 0.348 [0.268–0.452] * | 1.793 [1.026–3.131] * | 0 % |
| FR | stoppedVehicle | 54402 | 3570 (6.56 %) | 3.33 % | 0.53 [0.44–0.638] * | 1.251 [0.85–1.842] | 14 % |
| FR | hardShoulder | 54397 | 291 (0.53 %) | 11.34 % | 2.04 [1.417–2.935] * | 1.505 [0.704–3.22] | 89 % |
| FR | rearImpact | 54402 | 12636 (23.23 %) | 2.98 % | 0.42 [0.377–0.469] * | 1.758 [1.412–2.188] * | 32 % |
| GB | stoppedVehicle | 100927 | 18905 (18.73 %) | 0.83 % | 0.502 [0.425–0.593] * | 1.558 [1.121–2.167] * | 28 % |
| GB | hardShoulder | 100927 | 738 (0.73 %) | 3.52 % | 2.442 [1.646–3.624] * | 1.673 [0.756–3.702] | 42 % |
| GB | rearImpact | 100927 | 23978 (23.76 %) | 0.73 % | 0.419 [0.358–0.491] * | 1.576 [1.152–2.156] * | 35 % |

`*` = IC 95 % no incluye 1. OR > 1: mayor proporción de mortales entre los accidentes con víctimas en esa condición.


## Exposición GB: tasas por 100 M veh-km (AADF DfT × STATS19)

Tramos aforados 17936 · accidentes GB 100927 · asignados 45289 · sin tramo 14788 · sin vía 40850.

| Categoría | Exposición (100 M veh-km) | Con víctimas /100 M | Mortales /100 M | Arcén /100 M |
|---|---|---|---|---|
| PA | 1638.8 | 23.2 | 0.371 | 0.157 |
| TM | 1116.6 | 2.69 | 0.069 | 0.049 |
| TA | 749.1 | 5.62 | 0.219 | 0.103 |
| PM | 10 | 5.51 | 0 | 0 |

Tasa media 15.11 /100 M veh-km · prior EB {"alpha":0.148,"beta":0.0098}

| Tramo (vía) | AADF | Exposición | Accidentes | Tasa bruta | **Tasa EB** |
|---|---|---|---|---|---|
| 28465 (A45) | 34564 | 0.6308 | 24 | 38.05 | **37.7** |
| 92184 (A4180) | 16243 | 0.5277 | 19 | 36.01 | **35.63** |
| 58231 (A406) | 112905 | 0.5769 | 20 | 34.67 | **34.34** |
| 56436 (A40) | 57620 | 0.5258 | 17 | 32.33 | **32.02** |
| 6458 (A41) | 68610 | 0.5259 | 17 | 32.33 | **32.01** |
| 48610 (A13) | 131432 | 0.5277 | 16 | 30.32 | **30.04** |
| 81522 (A354) | 30054 | 0.6472 | 19 | 29.36 | **29.14** |
| 47396 (A625) | 29136 | 0.6168 | 18 | 29.18 | **28.96** |
| 28440 (M25) | 146626 | 0.5352 | 15 | 28.03 | **27.79** |
| 56330 (A34) | 51154 | 0.5041 | 14 | 27.77 | **27.53** |

## Modelo multivariante de gravedad (OR AJUSTADOS, regresión logística)

Entrenamiento 440777 · prueba 110483 · mortales 9383 · AUC prueba **0.7817** · Brier 0.01586 · tasa base 0.0168. Efectos fijos por país.

| Variable | OR ajustado [IC 95 %] |
|---|---|
| dark | 1.174 [1.096–1.257] * |
| darkUnlit | 1.544 [1.408–1.693] * |
| twilight | 1.103 [0.99–1.229] |
| lightUnknown | 0.329 [0.085–1.269] |
| wet | 0.867 [0.817–0.919] * |
| iceSnow | 0.552 [0.424–0.718] * |
| fog | 0.778 [0.63–0.96] * |
| rural | 3.492 [3.232–3.774] * |
| areaUnknown | 0.963 [0.539–1.723] |
| motorway | 0.703 [0.636–0.777] * |
| dualCarriageway | 1.198 [1.042–1.378] * |
| curve | 1.171 [1.085–1.264] * |
| intersection | 0.751 [0.697–0.81] * |
| hardShoulder | 1.552 [1.131–2.131] * |
| stoppedVehicle | 0.583 [0.515–0.661] * |
| rearEndOrChain | 0.557 [0.503–0.617] * |
| headOn | 2.98 [2.763–3.214] * |
| pedestrian | 2.561 [2.363–2.775] * |
| runOffRoad | 2.034 [1.892–2.187] * |
| hgv | 4.017 [3.698–4.364] * |
| night0to6 | 1.491 [1.37–1.623] * |
| cDE | 0.973 [0.543–1.744] |
| cNL | 1.707 [1.521–1.916] * |
| cFR | 2.892 [2.691–3.109] * |
| cGB | 2.12 [1.182–3.803] * |

**Calibración (deciles de la prueba):** 1: 0.0034/0.0018 · 2: 0.005/0.0027 · 3: 0.0062/0.0051 · 4: 0.0064/0.0045 · 5: 0.0087/0.0092 · 6: 0.0123/0.0161 · 7: 0.0137/0.0138 · 8: 0.0163/0.0157 · 9: 0.023/0.0242 · 10: 0.0753/0.0752

**Dejar un país fuera:**

| País fuera | n | AUC | Predicho medio | Observado |
|---|---|---|---|---|
| ES | 101996 | 0.7643 | 0.0433 | 0.0162 |
| DE | 268519 | 0.7043 | 0.017 | 0.0092 |
| NL | 25416 | 0.6722 | 0.022 | 0.0213 |
| FR | 54402 | 0.7273 | 0.0255 | 0.0593 |
| GB | 100927 | 0.6105 | 0.0066 | 0.0149 |

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

## Puntos negros con Bayes empírico · FR

Prior Poisson–Gamma: {"alpha":0.362,"beta":0.172} · celdas: 25904

| Celda | Conteo | Mortales | Esperado EB | Contracción |
|---|---|---|---|---|
| 48.86,2.35 | 90 | 0 | 77.08 | 0.144 |
| 48.86,2.31 | 79 | 1 | 67.7 | 0.143 |
| 48.86,2.41 | 77 | 0 | 65.99 | 0.143 |
| 48.85,2.34 | 71 | 0 | 60.88 | 0.143 |
| 48.88,2.28 | 67 | 0 | 57.46 | 0.142 |
| 48.82,2.32 | 64 | 1 | 54.9 | 0.142 |
| 48.88,2.36 | 63 | 0 | 54.05 | 0.142 |
| 48.87,2.32 | 62 | 1 | 53.2 | 0.142 |
| 48.87,2.35 | 62 | 0 | 53.2 | 0.142 |
| 48.86,2.30 | 60 | 0 | 51.49 | 0.142 |

## Puntos negros con Bayes empírico · GB

Prior Poisson–Gamma: {"alpha":0.492,"beta":0.177} · celdas: 36301

| Celda | Conteo | Mortales | Esperado EB | Contracción |
|---|---|---|---|---|
| 51.51,-0.13 | 102 | 0 | 87.08 | 0.146 |
| 51.51,-0.14 | 90 | 1 | 76.89 | 0.146 |
| 51.51,-0.07 | 85 | 1 | 72.64 | 0.145 |
| 51.46,-0.12 | 79 | 0 | 67.54 | 0.145 |
| 51.51,-0.06 | 79 | 0 | 67.54 | 0.145 |
| 51.58,-0.08 | 74 | 0 | 63.29 | 0.145 |
| 51.51,-0.15 | 69 | 0 | 59.04 | 0.144 |
| 51.52,-0.08 | 69 | 0 | 59.04 | 0.144 |
| 51.50,-0.13 | 64 | 0 | 54.79 | 0.144 |
| 51.48,-0.13 | 64 | 0 | 54.79 | 0.144 |

