# Auditoría de Etiquetas y Fuga Causal de H2 (A0 · 2026-11-17)

- **Objeto auditado:** `experimental/senda-arr/src/arr-forecast.mjs`, `experimental/senda-arr/experiments/run-forecast-experiment.mjs`, `experimental/senda-arr/results/forecast-results.json`.
- **Veredicto H2 prerregistrado (INALTERADO):** **RECHAZADA**. No se modifica ni se promueve retrospectivamente.

## Defectos Metodológicos Detectados en H2

| Defecto | Archivo y línea | Estado | Impacto científico |
|---|---|---|---|
| **Solo 3 incendios tratados como 34 unidades independientes** | `run-forecast-experiment.mjs:25-38, 50` | `UNRESOLVED_IN_H2` | Los 34 instantes `(camp:12, carr:12, woolsey:10)` comparten trayectorias meteorológicas y de combustible; el IC bootstrap `[-0.0798, -0.0123]` sobre 34 instantes subestima la varianza entre incendios. |
| **Censura por derecha tratada como negativo observado (0)** | `run-forecast-experiment.mjs:33-37` | `FAIL_CENSORING` | `kEnd` es el último perímetro dentro de `(t0, t0+24h]`, aunque su hora sea muy anterior a `t0+24h`. Cualquier punto alcanzado después de `kEnd` pero antes de `t0+24h` se puntúa falsamente como `0`. |
| **Ausencia de física (viento, pendiente, combustible)** | `arr-forecast.mjs:4-7, 53` | `MODEL_LIMITATION` | `speed(theta)` solo usa expansión cinemática radial histórica sin aprovechar `wildfire.mjs` ni `fire-field.mjs`, resultando en Brier asimilado `0.0943` vs persistencia `0.0539`. |
| **Falta de campo `availableAt` vs `observedAt` en GeoMAC** | `geomac-2018-*.json` | `UNAUDITED_TIMING` | Las marcas `t` representan estampas de polígono digitalizado, no garantizan que el perímetro estuviera disponible en un centro de coordinación en `t0`. |

## Decisión para H-FIRE-B

1. **H2 permanece archivada como resultado negativo bloqueado (`EXPERIMENTAL_REJECTED`, `canPublicWarn = false`).**
2. **`camp`, `carr`, `woolsey` pasan a ser exclusivamente `DEVELOPMENT_DIAGNOSTIC_ONLY`** y nunca se utilizarán como prueba confirmatoria de `H-FIRE-B`.
3. `H-FIRE-B` debe implementar auditoría explícita de `CENSORED` a `t0+24h` y bloqueo duro ante `availableAt > t0`.
