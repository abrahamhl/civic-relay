# Evidencia · Misión SENDA 9.5

Fecha: 2026-11-08  
Estado: `SIMULATED` + `SOURCE_ONLY`; no es validación física.

## Ficheros

| Fichero | Descripción | Estado |
|---|---|---|
| `routing-benchmark-m95.json` | Benchmark DTN v2, schema `senda.routing-benchmark/2` | `SOURCE_ONLY`, generado desde árbol limpio |
| `README.md` | Este índice | — |

## Procedencia

- Commit medido: `3041a52435aadb936e34cf8546df3806a31c68a6`.
- Árbol Git: `5445dd62a6af300e3769a15b4de7070288cec223`.
- `source.manifestClaim`: `SOURCE_ONLY`.
- `source.worktreeDirty`: `false`; `source.dirtyPaths`: `[]`.
- SHA-256 del JSON: `c399870d43f121c4739fb9bb4cc5ed7b652436eac99f7b1ce46642cc7ffcd860`.
- Script: `packages/senda/scripts/routing-benchmark-v2.mjs`, SHA-256 `25cb77407d9c77102a93205e2c893c9b0097487fad9a2a2f0ac8545e43ccd78c`.
- Módulo: `packages/senda/src/opportunistic-routing.mjs`, SHA-256 `eb22d8f1ae8e3d42410c715a1e49289d1a1a2a98cfdea004be2d6931509c0b28`.
- El JSON se commitea después del código medido; ese commit de evidencia no cambia el contenido medido.

El smoke `routing-benchmark-smoke.json` se eliminó para no confundirlo con evidencia final.

## Qué mide

- Grafos independientes: 30.
- Realizaciones por grafo: 20.
- Bootstrap: 2000 remuestreos por conglomerados de grafo.
- Repeticiones de escenarios deterministas: 10 (no se cuentan como réplicas).
- Semilla: 20261107.
- Estrategias: `direct`, `flooding`, `epidemic`, `spray`, `earliest`, `adaptive`, `eaor`.
- Escenarios: `scheduled-line`, `scheduled-partition`, `crowd`, `energy-scarce`, `held-out`, `unreliable-contacts`.

## Resultado principal

`unreliable-contacts`:

| Estrategia | Entrega | IC 95 % | Latencia (s) | Transmisiones/entrega | Energía/entrega |
|---|---:|---|---:|---:|---:|
| earliest | 0,112 | 0,092–0,132 | 81,5 | 2,00 | 6,00 |
| eaor | 0,977 | 0,965–0,987 | 156,7 | 4,92 | 7,05 |
| adaptive | 0,985 | 0,975–0,993 | 148,2 | 5,52 | 7,46 |
| epidemic | 0,988 | 0,980–0,997 | 140,7 | 5,88 | 8,75 |

EAOR vs earliest: +86,5 pp de entrega (IC 95 %: 84,2–88,8), +75,7 s de latencia, +2,90 transmisiones/entrega, +1,05 energía/entrega. EAOR no domina a adaptive/epidemic; el trade-off está documentado en `docs/research/SENDA_MATHEMATICAL_VALIDATION.md`.

## Cómo regenerar

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda
node scripts/routing-benchmark-v2.mjs `
  --graphs=30 --realizations=20 --bootstrap=2000 --repeats=10 `
  --seed=20261107 `
  --out="C:\Users\2fabr\AppData\Local\Temp\opencode\routing-benchmark-m95.json"
```

Para una comprobación rápida:

```powershell
node scripts/routing-benchmark-v2.mjs --graphs=2 --realizations=2 --bootstrap=40 --repeats=2 --out="$env:TEMP\smoke.json"
```

## Regla de honestidad

- `source.manifestClaim = SOURCE_ONLY` significa que el árbol estaba limpio y que la evidencia se generó desde ese commit; no significa que el artefacto esté atestiguado por CI.
- `UNCOMMITTED_BUILD` no es una release verificada.
- `SIMULATED` no es `PHYSICALLY_VALIDATED`.
- Los IC son nominales del 95 % y no están corregidos por comparaciones múltiples.
- Los deltas son exploratorios y pareados por grafo.
- La confianza de contacto y la energía son modelos, no mediciones.

## Verificación

- Tests del benchmark: `node --test tests/routing-benchmark-v2.test.mjs`.
- Manifiesto: `node scripts/release-manifest.mjs --verify <ruta>`.
- Paridad web: `node scripts/sync-web.mjs` y `node --test tests/web-parity.test.mjs`.
