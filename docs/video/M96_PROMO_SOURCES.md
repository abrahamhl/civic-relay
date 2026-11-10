# SENDA M96 — Película promocional completa · fuentes y trazabilidad

**Fecha:** 2026-11-10 · **Guion:** `media/senda-film/m96-promo.json` (generado por `media/senda-film/build-m96-promo.mjs`, no editar a mano)

Reutiliza escenas verificadas de `m95-film.json` y `m95-ruta.json` y añade cuatro nuevas (`p0`–`p3`). Las cifras de pruebas salen de `investor-next/public/senda/estado.json` (generado ejecutando las pruebas). Las cifras de física se calculan al construir el guion con el núcleo, y el script falla si no coinciden con lo que dice la narración. La taxonomía de afirmaciones es la de [M95_VIDEO_SOURCES.md](M95_VIDEO_SOURCES.md) §1.

El contenido de defensa y doble uso **no** aparece en esta película: vive en la bóveda `/defense`.

| # | Escena | Título (ES) | Clasificación | Fuentes |
|---|---|---|---|---|
| 1 | `p0` | Por qué existe SENDA | `OBSERVED` | `docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md` · `docs/research/PROCUREMENT_GAP_2026.md` |
| 2 | `p1` | Lo que nos enseñaron estos accidentes | `OBSERVED` | `docs/research/PROCUREMENT_GAP_2026.md` · `packages/senda/src/rail-watch.mjs` · `packages/senda/src/rail-incident.mjs` · `docs/video/M95_VIDEO_SOURCES.md` |
| 3 | `p2` | El hueco que nadie cubre | `OBSERVED` | `docs/research/PROCUREMENT_GAP_2026.md` |
| 4 | `s2` | SENDA: la capa que coordina todo lo que mueva un mensaje | `CALCULATED` | `packages/senda/src/index.mjs` · `investor-next/public/senda/arquitectura.html` |
| 5 | `s3` | Sin Internet desde el primer segundo | `CALCULATED` | `packages/senda/src/crypto.mjs` · `packages/senda/src/router.mjs` |
| 6 | `s3b` | Llamar sin Internet | `CALCULATED` | `packages/senda/src/voice-call.mjs` · `investor-next/public/senda/llamada.html` |
| 7 | `s4` | Un mensaje, muchos caminos a la vez | `CALCULATED` | `packages/senda/src/erasure.mjs` · `packages/senda/src/multichannel.mjs` |
| 8 | `s5` | Toda la red satelital, por nivel de acceso | `OBSERVED` | `investor-next/public/senda/ojo.html` · `packages/senda/src/satellite.mjs` |
| 9 | `s5b` | El Ojo de SENDA: dónde está cada satélite y para qué sirve | `CALCULATED` | `packages/senda/src/satellite.mjs` · `investor-next/public/senda/ojo.html` |
| 10 | `s6` | Prever el apagón antes de que ocurra | `SIMULATED` | `packages/senda/src/blackout.mjs` |
| 11 | `s7` | Accidente ferroviario: segundos, no minutos | `SIMULATED` | `packages/senda/src/rail-impact.mjs` · `packages/senda/src/cap.mjs` |
| 12 | `s8c` | Vías de tren: la señal estaba en los datos | `SIMULATED` | `packages/senda/src/rail-preventive.mjs` · `investor-next/public/senda/ferroviario.html` |
| 13 | `s8` | Edificios: planta a planta, sin presuponer | `SIMULATED` | `packages/senda/src/building.mjs` |
| 14 | `s8a` | Contar personas por planta, desde fuera | `SIMULATED` | `packages/senda/src/ble-crowd.mjs` · `investor-next/public/senda/edificio.html` |
| 15 | `s8b` | Ver lo que no se ve, sin fingir rayos X | `SIMULATED` | `packages/senda/src/flat-fusion.mjs` · `investor-next/public/senda/edificio.html` |
| 16 | `s8d` | Incendios: avisar antes de que caiga la antena | `SIMULATED` | `packages/senda/src/wildfire.mjs` · `investor-next/public/senda/incendios.html` |
| 17 | `ruta-r1` | La frenada que no ves | `SIMULATED` | `investor-next/public/senda/carretera.html` · `packages/senda/src/road.mjs` |
| 18 | `ruta-r2` | Sin cobertura, el SOS viaja con los coches | `SIMULATED` | `investor-next/public/senda/carretera.html` · `packages/senda/src/road.mjs` |
| 19 | `ruta-r5` | Un coche en sentido contrario | `SIMULATED` | `investor-next/public/senda/carretera.html` · `packages/senda/src/road.mjs` |
| 20 | `ruta-r7` | Cuánto se ve, medido en una cámara | `SIMULATED` | `investor-next/public/senda/camaras.html` · `packages/senda/src/visibility.mjs` |
| 21 | `s9` | Confianza: firma, consentimiento y zona | `CALCULATED` | `packages/senda/src/warrant.mjs` · `packages/senda/src/pci-envelope.mjs` |
| 22 | `s10` | Tan fácil como tres botones | `OBSERVED` | `investor-next/public/senda/index.html` · `investor-next/tests/e2e.spec.mjs` |
| 23 | `s10b` | Toda la arquitectura, en 3D | `OBSERVED` | `investor-next/public/senda/arquitectura.html` · `packages/senda/src/epistemic-ledger.mjs` |
| 24 | `p3` | Debajo hay física, no promesas | `CALCULATED` | `packages/senda/src/telecom-mathematical-physics.mjs` · `packages/senda/src/scientific-theorems-physics.mjs` · `packages/senda/tests/telecom-mathematical-physics.test.mjs` · `packages/senda/tests/scientific-theorems-physics.test.mjs` |
| 25 | `s10c` | Cada imagen es el código real | `CALCULATED` | `media/senda-film/sims.js` · `packages/senda/src/index.mjs` |
| 26 | `s11` | Listo para desplegar | `OBSERVED` | `packages/senda/tests/cross-lang.test.mjs` |
| 27 | `s12` | Verificado por máquina. Honesto en lo que falta. | `OBSERVED` | `investor-next/public/senda/estado.json` · `packages/senda/scripts/build-status-page.mjs` |
| 28 | `s12b` | La prueba que puedes inspeccionar | `OBSERVED` | `packages/senda/src/pci-envelope.mjs` · `packages/senda/src/epistemic-ledger.mjs` · `packages/senda-pci/tests/pci.test.mjs` · `docs/security/SENDA_ASSURANCE_REVIEW.md` |
| 29 | `s13` | Para que ningún mensaje se pierda | `OBSERVED` | `investor-next/app/senda-home.tsx` · `LICENSE` |

## Escenas nuevas: hechos y límites

- **p0 · Origen.** Testimonio del fundador (incendio y apagón sin poder contactar con la familia), recogido en `docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md`.
- **p1 · Accidentes en España.** Apagón 28-04-2025 (del 90 % al 40 % de conexión estable) y DANA 29-10-2024 (ES-Alert a las 20:11; 224 fallecidos según el recuento publicado, pendiente de cierre oficial): `docs/research/PROCUREMENT_GAP_2026.md`. Adamuz 18-01-2026 (unos 45 min hasta reconocer el segundo tren): `packages/senda/src/rail-incident.mjs` y M95 `s7`. Gelida 20-01-2026 y Angrois 2013: `packages/senda/src/rail-watch.mjs`. Incendios de la sierra oeste (El Tiemblo): tabla de casos de la documentación de investigación. **Las causas de Adamuz y Gelida siguen bajo investigación oficial; la película lo dice expresamente y no atribuye culpas.**
- **p2 · El hueco.** `docs/research/PROCUREMENT_GAP_2026.md` §3.
- **p3 · Física.** Lluvia ITU-R P.838-3 (polarización V, 50 mm/h), Deygout frente a Epstein-Peterson, enlace acústico 16-FSK + RS(104,80) y modelo DTN epidémico. Todo calculado por el núcleo corregido en el PR #31.

## Correcciones heredadas

- `m95-film.json` y `m95-sim-proof.json` (y sus VTT publicados) tenían acentos corrompidos (`n?cleo`, `m?s`, `autom?ticamente`…). Quedan reparados en origen.
- Las cifras de pruebas de M95 (266) se actualizan a las actuales del núcleo civil.
