# Rendimiento real medido (`RENDIMIENTO.md`)

- **Comando reproducible:** `node packages/senda/scripts/benchmark-peritaje-fisica.mjs`
- **Fecha UTC de medida:** `2026-11-25T18:30:22Z`
- **Hardware real declarado:**
  - **CPU:** `Intel(R) Xeon(R) CPU @ 2.30GHz` (2 núcleos lógicos)
  - **RAM:** `7,77 GiB`
  - **Sistema operativo:** `linux 6.18.57 (x64)` (Ubuntu 24.04)
  - **Runtime:** `Node.js v22.23.5`
  - **GPU / WebGPU:** **No disponible en esta VM** (solo CPU).
  - **Teléfono móvil de gama media:** **No disponible en esta VM** (registrado honestamente en `IDEAS_NO_VALIDADAS.md`).

## 1. Tiempos reales medidos en CPU (media, mediana p50 y p95)

| Operación / Módulo | Corridas | Media (ms) | p50 (ms) | p95 (ms) | Notas |
|---|---:|---:|---:|---:|---|
| `citizen-report`: crear + firmar + verificar Ed25519 | 25 | `1,223` | `1,117` | `1,852` | WebCrypto nativo; despreciable frente a latencia de red. |
| `report-forensics`: `dHash-64` (64×64) + Dawid-Skene + peritaje 5 pilares | 15 | `3,747` | `3,028` | `10,455` | > 250 expedientes/s en 1 hilo CPU. |
| `report-protocol`: evaluación N0–N4 + autorización humana Ed25519 N5 + CAP 1.2 | 15 | `5,659` | `4,646` | `12,133` | Incluye verificación doble Ed25519 (`AuthorityGrant` + decisión) + XML CAP 1.2. |
| `data-assimilation`: EnKF acoplado a `shallow-water` (12 miembros, malla 14×8) | 5 | `24,350` | `18,227` | `51,829` | Escala con $O(N_{\text{miembros}} \cdot N_{\text{pasos}})$ del modelo directo. |
| `shallow-water-fv`: malla 64×64, `t=60 s` en CPU `f64` | 5 | `11,340` | `9,763` | `17,679` | Cero asignaciones por paso (búferes prealojados). |
| `shallow-water-fv`: malla 64×64, `t=60 s` en CPU `f32` (paridad WGSL) | 5 | `10,074` | `9,026` | `15,759` | Paridad medida `f32↔f64` (32×32, 40 s): `maxAbsDiff = 1,14e-6 m` (100× mejor que tolerancia `1e-4 m`). |
| `fire-rothermel`: 1000 evaluaciones Rothermel (1972) / Scott & Burgan | 10 | `10,861` | `11,111` | `18,176` | ~10,9 µs por evaluación de celda. |
| `fire-rothermel`: Level-Set Huygens 2D (61×61, `t=1 h`, `dx=50 m`) | 5 | `13,840` | `11,613` | `27,997` | Banda activa estrecha + caché de elipses por pendiente/combustible. |
| `rail-physics-etcs`: 1000 evaluaciones ETCS + CWR Kish-Samavedam + Nadal | 10 | `11,383` | `10,458` | `14,860` | ~11,4 µs por terna física completa. |
| `radio-propagation-advanced`: ITU-R P.526-15 Delta-Bullington + ITM + banda $k$ (120 pts Poyo) | 50 | `0,460` | `0,394` | `1,361` | > 2000 perfiles reales/s en 1 núcleo CPU. |
| `uncertainty-uq`: Sobol-Saltelli (Ishigami, `N=1024`, 5120 evals) | 10 | `4,926` | `5,787` | `6,943` | Estimadores de Jansen (1999) + LHS estratificado. |
| `emergency-routing-zones` + `triage-governance`: A* (40 nodos) + zonas seguras + panel 4 especialistas + auditoría | 25 | `0,268` | `0,228` | `0,539` | Interactivo en tiempo real (< 1 ms). |

## 2. Simulaciones completas de larga duración (DANA 29-10-2024, 11 h simuladas)

Medido con `node packages/senda/scripts/dana-fv-validate.mjs` sobre malla `212×171` (`36 252` celdas, `dx = 118,1 m`, 11 h 40 min de hidrograma):
- **Bates 2010 (base):** `4 472` pasos en **`4,42 s`** (~1,0 ms/paso).
- **FV2D Audusse-HLLC bruto:** `7 685` pasos en **`14,03 s`** (~1,8 ms/paso).
- **FV2D + breaching + porosidad urbana:** `9 209` pasos en **`22,67 s`** (~2,5 ms/paso; incluye evaluación completa HLLC en 4 caras + reacción de muros urbanos + fricción semi-implícita).

## 3. Declaración honesta sobre WebGPU y móvil

- El núcleo WGSL (`WGSL_SWE_FV_SHADER`, 2 pases `flux_pass` + `update_pass`, `workgroup_size(16, 16, 1)`) está incluido y probado sintácticamente junto al selector dual `createDualBackendSweRunner`, que en esta VM selecciona `CPU_FALLBACK` sin fallar.
- **No se publican ni estiman tiempos de GPU ni de teléfono de gama media** porque no se han medido en hardware físico (ver `IDEAS_NO_VALIDADAS.md`).
