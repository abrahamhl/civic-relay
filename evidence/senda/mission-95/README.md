# Evidencia · Misión SENDA 9.5

Fecha: 2026-11-08  
Estado: `SIMULATED` + `UNCOMMITTED_BUILD` hasta regenerar desde árbol limpio.

## Ficheros

| Fichero | Descripción | Estado |
|---|---|---|
| `routing-benchmark-m95.json` | Benchmark DTN v2, schema `senda.routing-benchmark/2` | Generado con árbol sucio; regenerar |
| `README.md` | Este índice | — |

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
  --out="C:\Users\2fabr\AppData\Local\Temp\routing-benchmark-m95.json"
```

Para una comprobación rápida:

```powershell
node scripts/routing-benchmark-v2.mjs --graphs=2 --realizations=2 --bootstrap=40 --repeats=2 --out="$env:TEMP\smoke.json"
```

## Regla de honestidad

- `source.manifestClaim = UNCOMMITTED_BUILD` significa que el árbol no estaba limpio. No es una release verificada.
- Para una evidencia limpia: commitear código, ejecutar con salida fuera del repo, verificar `git.dirtyPaths` vacío, copiar el JSON y commitearlo aparte.
- `SIMULATED` no es `PHYSICALLY_VALIDATED`.
- Los IC son nominales del 95 % y no están corregidos por comparaciones múltiples.
- Los deltas son exploratorios y pareados por grafo.
- La confianza de contacto y la energía son modelos, no mediciones.

## Verificación

- Tests del benchmark: `node --test tests/routing-benchmark-v2.test.mjs`.
- Manifiesto: `node scripts/release-manifest.mjs --verify <ruta>`.
- Paridad web: `node scripts/sync-web.mjs` y `node --test tests/web-parity.test.mjs`.
