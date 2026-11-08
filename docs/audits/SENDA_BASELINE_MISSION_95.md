# SENDA · Baseline de la misión 9.5

Fecha: 2026-11-08  
Rama: `mission/senda-95-20261108`  
Commit base: `1136f572bb696a6a1da30eb4693b866b983f3b7e`  
Repositorio: `https://github.com/abrahamhl/civic-relay`

## Objetivo

Elevar SENDA a un estándar verificable de excelencia científica y de ingeniería (≥9,5/10) sin confundir simulación con validación física, fuente documentada con dato ingerido, ni CI verde con certificación. Este documento fija el punto de partida y la puntuación honesta antes de los cambios de la misión.

## Línea base verificada

- Suite SENDA: `248/248` pruebas en verde en el commit base.
- Comando: `cd packages/senda; node --test tests/*.test.mjs`.
- Entorno: Windows 11, Node v22.22.2, pnpm 9.12.3, git 2.53.0.
- No había manifiesto de release ni huella del árbol fuente.
- El árbol desplegado en Vercel no era identificable de forma única por el SHA declarado.

## Hallazgos que bloquean una afirmación de excelencia

### Reproducibilidad

- El SHA de Git no identifica el contenido desplegado: la issue #19 documenta dos despliegues Vercel con el mismo `githubCommitSha` y árboles distintos.
- `packages/senda-pci/` existe en el árbol desplegado, pero no en ningún ref de Git ni en disco.
- No existía una huella del árbol de ficheros ni del lockfile asociada a la evidencia.
- CI verde no demuestra que el artefacto publicado sea el árbol probado.

### Incendios

- `assessAssets` podía inventar una hora de caída de comunicaciones y cobertura cuando no había antena declarada.
- `skillVsNull` dividía por cero cuando el modelo nulo coincidía perfectamente (`J0 = 1`).
- Faltaban validaciones fail-closed en mallas, igniciones, viento, opciones de ensemble, métricas y óptica de cámaras.
- El frente se propaga con vecindad 16 (incluye saltos de caballo): una franja de una celda puede saltarse. Es un artefacto de discretización, no una validación física.
- `fire-field` usa la ROS de la celda origen para cada tramo; `wildfire` usa la media armónica origen/destino. La diferencia entre motores no estaba cuantificada.
- No había calibración contra perímetros oficiales ni validación con datos independientes.

### DTN

- El benchmark v1 repite escenarios deterministas con 20 semillas y los presenta como 20 ejecuciones; eso es pseudo-réplica, no 20 casos independientes.
- `overheadRatio = transferencias / transferencias únicas` no es la definición estándar de overhead.
- El simulador solo procesaba contactos en `contact.start`; si un portador llegaba a mitad de una ventana abierta, el contacto se perdía.
- No existía un escenario con contactos declarados fiables/no fiables ni un mecanismo de fallo durante el ensayo.
- `adaptive` era una política de tope de portadores y energía, no una contribución novedosa claramente diferenciada.
- No había intervalos de confianza, deltas pareados ni análisis de potencia.

### PCI y seguridad

- No hay paquete PCI verificable en Git; la recuperación de la v0.1 está BLOCKED.
- El relé no puede verificar la firma del emisor; el destinatario sí detecta manipulación. Es un límite conocido, no una garantía.
- No hay auditoría externa ni prueba formal de las propiedades de seguridad.

### PI y novedad

- No había estrategia de protección tecnológica, registro de invenciones ni búsqueda de prior art.
- La licencia MIT ya publicada impide revertir la apertura del código existente.
- No se puede afirmar novedad ni patentabilidad sin búsqueda sistemática y revisión legal.

## Puntuación de partida (0–10)

| Dimensión | Nota | Motivo |
|---|---:|---|
| Reproducibilidad | 4,0 | SHA ambiguo, sin manifiesto, despliegue no identificable |
| Rigor científico | 4,0 | Simulación sin validación independiente; pseudo-réplica DTN |
| Incendios | 6,0 | Base física sólida, pero centinelas y sin calibración oficial |
| DTN | 5,0 | Estrategias implementadas, benchmark estadísticamente engañoso |
| PCI | 1,0 | Ausente; recuperación bloqueada |
| Seguridad | 5,0 | Pruebas adversariales útiles, sin auditoría externa |
| PI | 3,0 | Sin estrategia ni prior art |
| Documentación | 4,0 | Extensa, pero con afirmaciones por encima de la evidencia |
| **Global** | **4,8** | **No apto para afirmar 9,5** |

## Reglas de evidencia adoptadas

- `SIMULATED` no es `PHYSICALLY_VALIDATED`.
- `DOCUMENTED_SOURCE` no es `INGESTED_DATASET`.
- `HASH_VERIFIED` no es `COMPUTATION_PROVEN`.
- `MODEL_CALIBRATED` no es `SAFETY_CERTIFIED`.
- `CI_GREEN` no es `SCIENTIFICALLY_VALIDATED`.

Cada afirmación debe declarar: OBSERVED, CALCULATED, SIMULATED, INFERRED, UNVERIFIED, REJECTED o BLOCKED.

## Bloqueos iniciales

- PCI v0.1: fuentes ausentes; no se puede llamar «recuperación».
- Validación física DTN: sin hardware ni permisos; solo plan y simulación.
- Calibración oficial de incendios: acceso y licencias por confirmar.
- Revisión independiente real: los subagentes comparten modelo; la independencia externa está pendiente.
- Árbol de trabajo sucio: cualquier manifiesto actual sería `UNCOMMITTED_BUILD`.

## Referencias

- `docs/audits/SENDA_MISSION_95_STATUS.md`
- `scripts/release-manifest.mjs`
- `packages/senda/tests/fire-audit.test.mjs`
- `packages/senda/tests/eaor-routing.test.mjs`
- `evidence/senda/mission-95/routing-benchmark-m95.json`
