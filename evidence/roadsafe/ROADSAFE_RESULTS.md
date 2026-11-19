# RoadSafe · Resultados de simulación (reproducibles)

Generado por `packages/senda/scripts/roadsafe-experiment.mjs` con N=3000 por escenario y semillas fijas.

> **Simulación con parámetros declarados. No demuestra reducción real de accidentes.** Procedencia de cada parámetro en `roadsafe-experiments.json → provenance`.

## 1. Escenarios A–E (base: visibilidad 250 m, llegada del taxi 300–2400 s tras la V16)

| Escenario | P(alcance) [IC95] | P(taxi→furgoneta) | Impacto p50/p95 km/h | Cobertura efectiva | Latencia p50/p95 s | Antelación p50 s | Falsas alarmas | Acuse de visualización |
|---|---|---|---|---|---|---|---|---|
| A · Sin alertas digitales | 0.0357 [0.0296, 0.0429] | 0.018 | 26.7/50.8 | 0 | —/— | — | 0 | 0 |
| B · V16 informativa (sin asumir entrega al conductor) | 0.0357 [0.0296, 0.0429] | 0.018 | 26.7/50.8 | 0 | —/— | — | 0 | 0 |
| C · Canal vial autorizado con latencia modelada | 0.0287 [0.0233, 0.0353] | 0.015 | 26.9/50.9 | 0.201 | 61.8/235.9 | 60.2 | 0 | 0 |
| D · SENDA con aviso anticipado y fuentes verificadas | 0.0267 [0.0215, 0.0331] | 0.014 | 26.9/50.9 | 0.2433 | 43.3/213.1 | 60.2 | 0 | 0 |
| E · SENDA con fallos de red, datos erróneos y baja adopción | 0.0303 [0.0248, 0.0371] | 0.0157 | 26.9/50.9 | 0.118 | 180.5/996.7 | 60.3 | 0.049 | 0 |

## 2. Visibilidad efectiva (m) — P(alcance)

En seguimiento de vehículos la visibilidad solo limita cuando es menor que la separación (≈ headway·v): niebla densa.

| sight | A | B | C | D | E |
|---|---|---|---|---|---|
| 25 | 0.744 | 0.744 | 0.7147 | 0.706 | 0.7273 |
| 40 | 0.1537 | 0.1537 | 0.1273 | 0.1217 | 0.1353 |
| 60 | 0.0357 | 0.0357 | 0.0287 | 0.0267 | 0.0303 |
| 100 | 0.0357 | 0.0357 | 0.0287 | 0.0267 | 0.0303 |
| 250 | 0.0357 | 0.0357 | 0.0287 | 0.0267 | 0.0303 |

## 3. Adopción de SENDA (visibilidad 100 m, canal DGT→navegador anulado)

| cuota | A | D | cobertura D |
|---|---|---|---|
| 0 | 0.0357 | 0.0357 | 0 |
| 0.01 | 0.0357 | 0.0357 | 0.007 |
| 0.05 | 0.0357 | 0.0347 | 0.0313 |
| 0.1 | 0.0357 | 0.0333 | 0.0647 |
| 0.3 | 0.0357 | 0.0303 | 0.1937 |
| 0.6 | 0.0357 | 0.024 | 0.3827 |

## 4. Latencia del canal autorizado (taxi llega 120 s tras la V16; visibilidad 100 m)

| latencia s | A | C | cobertura C | avisos tardíos mostrados |
|---|---|---|---|---|
| 5 | 0.032 | 0.026 | 0.2067 | 0 |
| 30 | 0.032 | 0.027 | 0.1957 | 6 |
| 60 | 0.032 | 0.0277 | 0.1587 | 15 |
| 120 | 0.032 | 0.0293 | 0.0947 | 20 |
| 300 | 0.032 | 0.0317 | 0.0233 | 10 |

## 5. Distancia temporal (s) — A vs D

| headway | A | D |
|---|---|---|
| 1 | 0.07 | 0.0547 |
| 2 | 0.005 | 0.003 |
| 0.6 | 0.1893 | 0.1503 |
| 1.5 | 0.0227 | 0.0157 |

## 6. Controles negativos

```json
{
  "NC1_zero_adoption_equals_A": {
    "A": 0.0363,
    "C": 0.0363,
    "D": 0.0363,
    "pass": true
  },
  "NC2_placebo_no_effect": {
    "A": 0.0387,
    "D": 0.0387,
    "pass": true
  },
  "NC3_latency_beyond_event_no_benefit": {
    "A": 0.0333,
    "C": 0.0333,
    "D": 0.0333,
    "pass": true
  },
  "NC4_late_warning_harm": {
    "A": 0.0363,
    "C_noPolicy": 0.112,
    "D_policy": 0.0363,
    "lateShownC": 2300,
    "lateSuppressedD": 2909,
    "harmObserved": true,
    "policyAvoidsHarm": true
  }
}
```

## 7. H-ROAD-2 — doble conteo de fuentes derivadas

```json
{
  "episodes": 2000,
  "naive": {
    "falseCorroborationRate": 1,
    "sensitivity": 1
  },
  "causal": {
    "falseCorroborationRate": 0,
    "sensitivity": 0.2092
  },
  "note": "Episodios sintéticos con proporciones HIPOTÉTICAS; mide el efecto del doble conteo, no la tasa real de falsas alarmas."
}
```

## 8. H-ROAD-3 — fallos parciales de proveedor (banco contractual)

| fallo | estado final | referencia | marcas | «enviada» ingenuo | «en el lugar» contrato |
|---|---|---|---|---|---|
| none | ON_SCENE_REPORTED | TOW-A-SIM-1 | — | true | true |
| timeout | FAILED | — | TIMEOUT | false | false |
| http5xx | FAILED | — | TRANSPORTE_503 | false | false |
| ackWithoutRef | TRANSPORT_ACCEPTED | — | ACK_SIN_REFERENCIA, DELAYED | true | false |
| outOfOrder | ON_SCENE_REPORTED | TOW-A-SIM-1 | COMPLETADO_SIN_LLEGADA | true | true |
| duplicateEvents | ON_SCENE_REPORTED | TOW-A-SIM-1 | — | true | true |
| neverArrives | PARTNER_ASSIGNED | TOW-A-SIM-1 | DELAYED | true | false |

## 9. Probabilidad condicionada por circunstancia (simulada; A sin aviso vs D SENDA)

| Circunstancia | P(alcance) A [IC95] | × base | P(empuje) A | impacto p95 km/h | P(alcance) D |
|---|---|---|---|---|---|
| Mojado + 0,8 s | 0.7003 [0.6837, 0.7165] | 19.62 | 0.499 | 32.9 | 0.5387 |
| Noche + niebla + pesado | 0.5777 [0.5599, 0.5952] | 16.18 | 0.4523 | 63.4 | 0.4713 |
| Mojado + noche | 0.5233 [0.5054, 0.5412] | 14.66 | 0.3063 | 38.9 | 0.398 |
| Calzada mojada (μ 0,45) | 0.305 [0.2888, 0.3217] | 8.54 | 0.15 | 36.4 | 0.2337 |
| Seguidor pesado (según escenario) | 0.231 [0.2163, 0.2464] | 6.47 | 0.1473 | 42.6 | 0.1783 |
| Niebla densa (40 m) | 0.1537 [0.1412, 0.167] | 4.31 | 0.0787 | 64.9 | 0.1217 |
| Distancia temporal 0,8 s | 0.1137 [0.1028, 0.1255] | 3.18 | 0.063 | 45.6 | 0.0903 |
| Noche (reacción alargada según escenario) | 0.095 [0.085, 0.106] | 2.66 | 0.0417 | 48 | 0.0737 |
| Base (seco, día, 250 m de visibilidad) | 0.0357 [0.0296, 0.0429] | 1 | 0.018 | 50.8 | 0.0267 |
| Velocidad 120 km/h | 0.02 [0.0156, 0.0257] | 0.56 | 0.013 | 52.7 | 0.015 |
| Distancia temporal 2 s (recomendada) | 0.005 [0.003, 0.0082] | 0.14 | 0.0013 | 69.6 | 0.003 |
