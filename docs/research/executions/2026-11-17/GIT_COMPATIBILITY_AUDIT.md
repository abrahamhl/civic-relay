# Auditoría de Compatibilidad Git, Dependencias y CI (A0 · 2026-11-17)

- **Rama de trabajo aislada:** `research/senda-scientific-iteration-20261117` (creada desde `feat/senda-canonical-integration-20261117` `f68af10`)
- **Ramas intocadas:** `master` (`b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40`), `origin/pr/32`, `origin/pr/38`, `origin/pr/39`, `origin/pr/42`, `origin/pr/44`, `origin/pr/45`, `feat/senda-canonical-integration-20261117` (PR #46).

## 1. Grafo Exacto de Ancestros y Conflictos Verificados

| PR | Rama | SHA HEAD | Base PR | Ancestro común con `origin/master` | Estado CI consultado hoy | Hallazgo / riesgo |
|---|---|---|---|---|---|---|
| `#32` | `claude/promotional-video-prompts-p5vzh8` | `cdabff3ee28422080ac05ec0be252fe385006bd3` | `feat/senda-funding-mission-day1` | `4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3` | 9/9 checks `SUCCESS` | Diverge frente a `master` (`globals.css`, `investor-page.tsx`). |
| `#38` | `audit/senda-agent1-durable-lab-20261117` | `74631c052605ecca3f8517c6e6327363bf11e126` | `#35` (`fc2bebe`) | `b8360c9` | 4/4 checks `SUCCESS` | APK compilada; journal separado de `apps/senda-android`. |
| `#39` | `audit/senda-pr32-safety-gates-20261117` | `d7ed6bd80a0500f12b71f54c805bee5733291700` | `#32` snapshot (`632e9de`) | `4c310f78` | 5/5 checks `SUCCESS` | `CONFLICTING` contra cabeza actual `#32` en `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md`. |
| `#42` | `audit/senda-robust-scenario-uncertainty-20261117` | `d8feb5e523f51e809c3ea4c01d25da5ade9c74eb` | `#39` | `4c310f78` | 10/10 checks `SUCCESS` (incl. `HiGHS 250`) | Diverge de `#43` desde `c1d5dee`; oráculos sintéticos. |
| `#44` | `ccr-ea048c78-86gcio` | `ce9ab69fbae2773f3256659197c9d83937fca9b8` | `#38` | `b8360c9` | 2/2 checks `SUCCESS` (`simulator`, `arr-invariants`) | `arr-invariants` solo ejecuta tests y smoke rápido de routing, **no** el experimento H2 completo; merge-base con `#42` = `4c310f78`. |
| `#45` | `docs/senda-scientific-decisions-20261117` | `12157f5ca74f91e5a6a8e79206c25043769a5bef` | `master` | `b8360c9` | 2/2 checks `SUCCESS` | Documentación normativa científica de 4 archivos. |
| `#46` | `feat/senda-canonical-integration-20261117` | `f68af10c49a64268f723e0e77f95a5f86a366411` | `master` | `b8360c9` | **24 `pass` / 2 `fail` reales en GitHub** | Descubiertos **2 fallos reales de CI** tras push (detallados abajo). |

## 2. Fallos Reales Detectados Al Inspeccionar la CI de PR #46

1. **`canonical-gate` (`FAILURE` en runs `44046050282` y `44046036212`):**
   - Comando fallido: `pnpm --dir investor-next exec playwright install --with-deps chromium` (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "playwright" not found`).
   - Causa raíz: `playwright` no está listado en `investor-next/package.json`; el resto de workflows (`.github/workflows/senda-ci.yml`) lo instala efímeramente en `/tmp/pw`.
   - Corrección aplicada en `research/senda-scientific-iteration-20261117`: instalación efímera con `pnpm --dir /tmp/pw add playwright@1.63.0` y `NODE_PATH=/tmp/pw/node_modules`.
2. **`usgs-live` (`FAILURE` en run `44046050108`):**
   - Error: `ERR_MODULE_NOT_FOUND: Cannot find package '@senda/core'` desde `apps/senda-live/server/services/emergency.mjs`.
   - Causa raíz: `.github/workflows/senda-live-usgs-map.yml` ejecutaba `node --test apps/senda-live/tests/*.test.mjs` en la línea 31 **antes** de `corepack pnpm install --frozen-lockfile` (línea 35).
   - Corrección aplicada en `research/senda-scientific-iteration-20261117`: mover `pnpm install --frozen-lockfile` antes de los tests de adaptadores offline.
