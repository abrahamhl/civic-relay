# H-FIRE-B — Evaluación exploratoria multi-incidente (NOAA GOES-R + HRRR, datos reales en el repo)

**Estado:** `EXPLORATORY` · **Decisión:** `INCONCLUSIVE_OR_NOT_SUPPORTED` · Sin uso operativo (`canIssueEvacuationOrder=false`, `canPublicWarn=false`).

Reproducir: `node experimental/senda-fire-physics/experiments/run-fire-real-cases.mjs` → `results/fire-real-cases.json` (incluye SHA-256 del dataset).

## Datos
- `investor-next/public/senda/data/referencias/goes_casos.json`: detecciones GOES-R ABI L2 FDC y serie puntual HRRR 3 km (dominio público).
- Incidentes externos (n=6): `palisades`, `eaton`, `marshall`, `smokehouse`, `troublesome`, `creek`.
- `camp` (2018): `DEVELOPMENT_DIAGNOSTIC_ONLY`, excluido del agregado.

## Protocolo
- Horizonte 3 h; t0 cada 3 h desde la primera detección + 1 h; malla 1 km; huella = unión acumulada de hotspots (radio 1 km).
- Puerta causal: muestra HRRR usada solo si `validUTC + 60 min <= t0` (latencia supuesta, no registrada).
- Comparadores: Level-Set upwind con viento HRRR; isotrópico **con la misma área predicha** (aísla la dirección); persistencia.
- Unidad estadística: incidente. Bootstrap percentil 10.000 réplicas, semilla 20261117.

## Resultados (salida real del script)
| Métrica (externos, n=6) | Media | IC 95 % |
|---|---|---|
| Δ growth-CSI Level-Set − isotrópico | +0,0184 | [−0,0022, +0,0440] |
| Δ IoU Level-Set − persistencia | −0,1425 | [−0,1877, −0,0972] |

- Level-Set supera al isotrópico de igual área en 5/6 incidentes (pierde en `palisades`).
- growth-CSI absoluto muy bajo en todos los métodos (≤ 0,074 por incidente): la habilidad direccional detectada es pequeña.
- La persistencia gana en IoU de huella acumulada: el modelo sobrepredice crecimiento sin calibrar ROS.

## Interpretación honesta
El IC del efecto direccional incluye 0 → **no hay soporte estadístico**. La señal 5/6 es sugerente, no concluyente. No se modifica la etiqueta experimental de las vistas de avance.

## Limitaciones
1. Sin DEM ni mapa de combustible para los casos de EE. UU.: terreno plano y combustible uniforme (matorral). Solo se prueba la dirección del viento.
2. Huella GOES ≠ perímetro: píxeles ≥ 2 km, omisión por humo/nubes, comisión.
3. HRRR es una serie puntual por incidente, no un campo.
4. ROS sin calibrar (`rosMult=1`).
5. n=6 < 10 → exploratorio según el prerregistro.

## smv2026 (Copernicus/Sentinel-2/GFS)
`NOT_EVALUATED`: las cicatrices d0724→d0729→d0808 distan 5–10 días y el GFS del repo cubre solo 12 h; no hay forzamiento causal emparejado para ese horizonte.
