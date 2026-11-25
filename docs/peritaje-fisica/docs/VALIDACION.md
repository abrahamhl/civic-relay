# Informe de validación reproducible (`VALIDACION.md`)

Todas las cifras de este documento proceden de ejecuciones reales en este entorno (`Node.js v22.23.5`, Linux Ubuntu 24.04) sobre datos abiertos del repositorio (huellas SHA-256 en `data/MANIFIESTO_DATOS_ABIERTOS.json`) o contra soluciones analíticas cerradas. Cada tabla incluye el comando exacto que la reproduce.

---

## 1. Caso real DANA 29-10-2024 (Barranc del Poyo, l'Horta Sud) — FV 2D vs Bates (2010)

- **Comando reproducible (100 % sin red):** `node packages/senda/scripts/dana-fv-validate.mjs`
- **Datos abiertos:** `dem_d4.bin` (118,1 m, 212×171), `dir_z12.bin`, `emsr773_inundacion.geojson` (Copernicus EMSR773 AOI03, 24,53 km² en ROI), `swe.json` (referencia previa Bates 59 m), `radio/poyo.json`.
- **Etiqueta epistémica:** `MODEL_CALIBRATED_AGAINST_OBSERVED` (hidrograma con 3 puntos publicados 16:55 / 18:55 / 19:35 CET + recesión lineal escenario 6 h).

| Configuración | CSI ↑ | Acierto (Hit) ↑ | Falsa Alarma ↓ | Picanya (min desde 16:55) | Paiporta (min desde 16:55) | Sedaví (min desde 16:55) | Error balance masa | CPU (s) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Referencia `swe.json` (Bates 59 m, mejor CSI, $n=0{,}10$) | `0,2354` | `0,388` | — | `480` | `545` | — | — | — |
| Referencia `swe.json` (Bates 59 m, más rápida, $n=0{,}035$) | `0,2028` | `0,2970` | `0,6100` | `271` | `300` | — | `3,12e-15` | `8,5` |
| Bates 2010 en misma malla 118,1 m ($n=0{,}06$) | `0,2371` | `0,4036` | `0,6351` | `393` | `448` | `646` | `6,33e-16` | `4,42` |
| FV2D Audusse-HLLC bruto ($n=0{,}06$ uniforme) | `0,2427` | `0,4116` | `0,6283` | `372` | `426` | `588` | `-4,36e-15` | `14,03` |
| FV2D + breaching MDS (Lindsay-Dhun 2015) + Manning dif. + $\phi=0{,}68$ | `0,2486` | `0,4991` | `0,6688` | `254` | `300` | `433` | `-1,27e-15` | `19,65` |
| **FV2D + breaching MDS + incisión 1 m garganta + Manning dif. ($0{,}022/0{,}085$) + $\phi=0{,}72$** | **`0,2516`** | **`0,4906`** | `0,6594` | **`215`** | **`262`** | **`389`** | **`5,49e-15`** | `22,67` |

**Diagnóstico físico:** el MDS grueso `dem_d4.bin` contiene **56 contrapendientes artificiales** (puentes/terraplenes) sobre el cauce D8 del Poyo. Al combinar el solver FV 2D completo (que conserva la advección inercial $\nabla\cdot(h\mathbf{u}\otimes\mathbf{u})$) con apertura hidrológica monótona (Lindsay & Dhun 2015), Manning diferenciado cauce/llanura y porosidad urbana (Sanders 2008), el CSI sube de **`0,2354` → `0,2516`** (+6,9 % sobre mejor `swe.json` y +24,1 % sobre la variante rápida), el acierto sube a **`0,4906`**, y las llegadas se acortan en **178–265 min en Picanya** y **186–283 min en Paiporta**. Persiste un retraso de ~60–100 min respecto a testimonios reales (18:55–19:30 CET) debido a la resolución de 118 m y ausencia de LiDAR MDT 2 m y afluentes laterales (ver `IDEAS_NO_VALIDADAS.md`).

---

## 2. Asimilación de datos de campo N2+ (EnKF)

- **Comando reproducible:** `node --test packages/senda/tests/data-assimilation.test.mjs`
- **Escenario:** experimento gemelo de desbordamiento de mota en `shallow-water.mjs` con 20 miembros previos sesgados y marcas de agua peritadas `N2+`.

| Métrica | Previo (sin asimilación) | Análisis EnKF (con marcas N2+) | Mejora medida |
|---|---:|---:|---:|
| CSI de zona inundada | `0,1811` | **`1,0000`** | `+0,8189` |
| RMSE de calado (m) | `0,2550` | **`0,0317`** | `−87,6 %` |
| Anchura horquilla 90 % (m) | `0,4181` | **`0,1285`** | `−69,3 %` |
| Error ganancia Kalman lineal | — | `< 1e-9` | Exactitud analítica |

---

## 3. Verificaciones numéricas analíticas y casos reales restantes

| Módulo | Verificación analítica / conservativa | Caso con datos públicos reales | Casos de error y abuso verificados | Comando exacto |
|---|---|---|---|---|
| `shallow-water-fv.mjs` | Lago en reposo C-property con relieve + isla seca + $\phi(x,y)$ variable (`< 1e-12`); rotura de presa Ritter (1892) (`RMSE < 0,04 m`); conservación masa `< 1e-12`; paridad `f32↔f64` **`1,14e-6 m`** (`< 1e-4 m`). | DANA 29-10-2024 Poyo (tabla §1). | Rechaza ausencia de Manning `n`, `debrisFactor`, `incisionM`, `minSlope`, `urbanPhi`. | `node --test packages/senda/tests/shallow-water-fv.test.mjs` |
| `fire-rothermel.mjs` | Expansión circular isotrópica Level-Set con convergencia $O(\Delta x)$ (`err(dx=5 m) < err(dx=10 m) < 3 %`); elipse de Huygens con viento + barrera `NB8` infranqueable. | **Incendio SMV 2026** (`dem_100m.bin`, `fuel_100m.bin`, `burn_100m.bin`, NOAA GFS real `UGRD/VGRD/RH`): conjunto LHS 6 miembros solapa cicatriz real Sentinel-2 del 24-07 con horquilla `p10 ≤ p50 ≤ p90`. | Rechaza ausencia de humedades, viento, pendiente o modelo inexistente. | `node --test packages/senda/tests/fire-rothermel.test.mjs` |
| `rail-physics-etcs.mjs` | Distancia EBD exacta `< 0,2 m` y jerarquía estricta `EBD < EBI ≤ SBI < W < P < I`; fuerza axial térmica $2EA\alpha\Delta T$ exacta; Nadal exacto `1,2003` ($\beta=70°,\mu=0{,}36$); Prud'homme exacto `70 kN` / `59,5 kN`. | **Angrois (24-07-2013)** con datos públicos CIAF Exp. 0054/2013 (`200→80 km/h`, `R=402 m`, peralte `150 mm`) y plantilla pública **Adamuz (18-01-2026)** con campos pendientes en `NO_VERIFICADO`. | Rechaza parámetros omitidos y `PUBLISHED_FACT` sin fuente oficial. | `node --test packages/senda/tests/rail-physics-etcs.test.mjs` |
| `radio-propagation-advanced.mjs` | Friis FSPL (`91,22 dB` a 1 km / 868 MHz); filo de cuchillo ITU-R P.526-15 $J(0)=6,03$ dB y $J(1)=13,86$ dB; cresta 80 m añade `> 20 dB`. | **MDE abierto del Poyo (`radio/poyo.json`)**: enlaces LoRa EU868 Chiva↔Paiporta y Chiva↔Buñol con $\Delta h$ ITM y horquilla de refractividad $k \in [2/3, 4/3, 2{,}0]$. | Rechaza ausencia de `kFactor`, frecuencias fuera de rango P.2108 e intervalos $k$ mal ordenados. | `node --test packages/senda/tests/radio-propagation-advanced.test.mjs` |
| `uncertainty-uq.mjs` | Estratificación exacta 1-por-estrato en LHS; inversa normal Acklam `< 1e-7`; **función analítica de Ishigami** (los 6 índices Sobol $S_1, S_2, S_3, S_{T1}, S_{T2}, S_{T3}$ dentro de $\pm 0{,}06$ de los valores exactos); CRPS exacto `0` en conjunto perfecto. | Propagación de incertidumbre sobre velocidad de Manning y verificación de habilidad predictiva. | Rechaza dimensiones vacías, `min ≥ max`, arrays de distinta longitud. | `node --test packages/senda/tests/uncertainty-uq.test.mjs` |
| `citizen-report.mjs`, `report-forensics.mjs`, `report-protocol.mjs`, `sync-protocol.mjs`, `triage-governance.mjs` | Verificación Ed25519/SHA-256, `dHash-64`, EM Dawid-Skene, convergencia conmutativa/idempotente CRDT, 8 invariantes epistémicos. | **TLE reales AMSAT** (`amsat-nasabare-2026-11-20.txt`, 97 satélites) para predicción de paso satelital; UI web verificada en Chrome headless `1440×900` y `390×844` con 0 errores. | Hora manipulada, salto GPS imposible, foto reutilizada, inundación Sybil de 25 reportes, rate-limit HTTP 429, inyección MITRE ATLAS, intento de bypass `canPublicWarn` en simulacro o grant caducada, fuga de PII en logs. | `node --test packages/senda/tests/citizen-report.test.mjs packages/senda/tests/report-forensics.test.mjs packages/senda/tests/report-protocol.test.mjs packages/senda/tests/sync-and-server.test.mjs packages/senda/tests/web-interfaces.test.mjs packages/senda/tests/triage-governance.test.mjs` |
| `emergency-routing-zones.mjs` | Enrutador A* evita puente inundado (Cox/Shand) y desvía a ruta accesible $\le 6°$ para PMR; campo potencial apunta al Sur (~180°) huyendo de fuego al Norte; SHA-256 detecta manipulación de paquete offline y degrada frescura tras TTL. | Grafo sobre coordenadas reales de Paiporta (`39.428, -0.418`) y área sin red de l'Horta Sud. | Rechaza ausencia de `debrisFactor`, `weights`, presupuesto de bytes excedido y manipulación de capas. | `node --test packages/senda/tests/emergency-routing-zones.test.mjs` |

---

## 4. Suite completa del repositorio

El archivo adjunto `RESULTADOS_PRUEBAS.txt` contiene la salida literal íntegra de `node --test packages/senda/tests/*.test.mjs` ejecutada sobre el repositorio con todos los módulos nuevos y exportaciones aplicadas, verificando **0 fallos** tanto en los 1078 tests preexistentes como en todos los tests nuevos.
