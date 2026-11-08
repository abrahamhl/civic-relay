# SENDA Mission 9.5 — Tabla de Fuentes y Trazabilidad de Escenas de Vídeo

**Rama:** `mission/senda-corridor-fabric-20261108`  
**Fecha:** 2026-11-08  
**Autor y titular:** Abraham Haddioui (ver [`LICENSE`](../../LICENSE) y [`docs/handoff/01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md`](../handoff/01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md))

---

## 1. Taxonomía de afirmaciones

Toda afirmación visual o hablada en los vídeos de la release Mission 9.5 se clasifica estrictamente en una de cuatro categorías (ver [`packages/senda/src/epistemic-ledger.mjs`](../../packages/senda/src/epistemic-ledger.mjs)):

| Categoría | Definición | Requisitos en pantalla y voz |
|---|---|---|
| **`OBSERVED`** | Hecho medido directamente por tests ejecutados en esta máquina, commits/SHAs verificables o documentos oficiales publicados con cita primaria. | Cifra exacta verificada; cita de test o fuente primaria. |
| **`CALCULATED`** | Resultado determinista calculado por el núcleo de SENDA (`packages/senda`, `packages/senda-pci`) a partir de entradas conocidas o sintéticas reproducibles. | Etiqueta `COMPUTED FROM THE APP CORE` cuando se muestra una simulación calculada en vivo. |
| **`SIMULATED`** | Escenario sintético ejecutado sobre modelos físicos/matemáticos del núcleo (tráfico, fuego, drenaje de baterías, fachada BLE, fusión bayesiana). | Etiqueta visible `SIMULATION · synthetic traffic`, `INVENTED ROAD · demo`, `SYNTHETIC IMAGE · method test` o `SIMULATION · COMPUTED FROM THE APP CORE`. |
| **`INFERRED`** | Estimación con intervalo de confianza explícito o hipótesis sujeta a investigación oficial (p. ej. ocupación por planta o anomalías previas en circuito de vía). | Intervalo de confianza explícito o aviso de que la investigación oficial decidirá. |

---

## 2. Película principal — `senda-m95-film-en.mp4` (`media/senda-film/m95-film.json`)

| Escena | Título (EN) | Afirmación principal | Clasificación | Fuente primaria / Código | Test / Verificación |
|---|---|---|---|---|---|
| `s1` | *When the network falls* | Apagón peninsular 28-04-2025 (caída de conexión estable del 90 % al 40 % al agotarse baterías de estaciones base); DANA Valencia 29-10-2024 (ES-Alert a las 20:11). | `OBSERVED` | Informes públicos post-apagón 28-04-2025; cronología oficial ES-Alert DANA Valencia 29-10-2024; `investor-next/public/senda/dgt.html` | `node media/senda-film/validate.mjs media/senda-film/m95-film.json` |
| `s2` | *SENDA* | Capa de enrutamiento de emergencia sobre canales alternativos (móviles cercanos, sonido ggwave, satélite D2D/Iridium/QO-100, LoRa, drones). No sustituye al 112. | `CALCULATED` | `packages/senda/src/index.mjs`, `investor-next/public/senda/arquitectura.html` | `packages/senda/tests/senda.test.mjs` |
| `s3` | *No Internet: sound and neighbour-to-neighbour* | Cifrado extremo a extremo (ECDH P-256 + AES-GCM + ECDSA P-256), transporte acústico y epidémico store-and-forward; recibo firmado borra copias en tránsito. | `CALCULATED` | `packages/senda/src/crypto.mjs`, `packages/senda/src/router.mjs` | `packages/senda/tests/senda.test.mjs` |
| `s3b` | *Voice calls with no Internet or carrier* | Llamada WebRTC en LAN/hotspot sin servidor; SDP comprimido a ~90 bytes transmitido por sonido en < 9 s; salto de relé de voz en escalera verificado en prueba. | `OBSERVED` / `CALCULATED` | `packages/senda/src/voice-call.mjs`, `investor-next/public/senda/llamada.html` | `packages/senda/tests/voice-call.test.mjs` |
| `s4` | *Striped across every channel at once* | Fragmentación Reed-Solomon GF(256) multi-portadora; probabilidad exacta del 99 % con satélite+LoRa+SMS+vecinos; 197/200 mensajes reconstruidos byte a byte en ensayo con caída aleatoria. | `CALCULATED` / `SIMULATED` | `packages/senda/src/erasure.mjs`, `packages/senda/src/multichannel.mjs` | `packages/senda/tests/erasure.test.mjs` |
| `s5` | *Satellites: what works today and what is coming* | Clasificación honesta por nivel de acceso (D2D comercial, módulo Iridium, radioaficionado QO-100 sin cifrado y sólo estado público firmado por ley ITU/URE, gubernamental). Galileo EWSS etiquetado como en desarrollo. | `OBSERVED` | `investor-next/public/senda/ojo.html`, `packages/senda/src/satellite.mjs` | `packages/senda/tests/satellite.test.mjs` |
| `s5b` | *The SENDA Eye: live orbits over Spain* | Cálculo orbital en tiempo real (Iridium LEO, Galileo MEO, QO-100 GEO), elevación, distancia, latencia y traza hasta sala 112 sobre casos reales de España. | `CALCULATED` | `packages/senda/src/satellite.mjs`, `investor-next/public/senda/ojo.html` | `packages/senda/tests/satellite.test.mjs` |
| `s6` | *Seeing the blackout before it arrives* | Modelo de descarga de baterías de estaciones base y colocación submodular greedy de pasarelas con garantía $(1 - 1/e)$; 5 pasarelas cubren el 72 % en la ciudad de prueba. | `SIMULATED` / `CALCULATED` | `packages/senda/src/blackout.mjs` | `packages/senda/tests/blackout.test.mjs` |
| `s7` | *From impact to the control room: 34 seconds* | Fusión de impactos separa dos trenes en 34 s de simulación (frente a ~45 min en cronología publicada de Adamuz); exportación en formato estándar CAP 1.2 (OASIS). | `SIMULATED` / `OBSERVED` | `packages/senda/src/rail-impact.mjs`, `packages/senda/src/cap.mjs` | `packages/senda/tests/rail-impact.test.mjs`, `packages/senda/tests/cap.test.mjs` |
| `s8` | *Buildings: floor by floor, no assumptions* | Localización de routers por planta y alerta selectiva; quien no responde figura como desaparecido no confirmado (`missing, unconfirmed`), nunca como víctima. | `SIMULATED` / `CALCULATED` | `packages/senda/src/building.mjs` | `packages/senda/tests/building.test.mjs` |
| `s8a` | *Counting people per floor, from outside* | Conteo de móviles activos simultáneos por planta ante rotación MAC BLE; intervalo de confianza contenía la cifra real el 95 % de las veces en 720 plantas simuladas. Sin identidades. | `SIMULATED` / `INFERRED` | `packages/senda/src/ble-crowd.mjs`, `investor-next/public/senda/edificio.html` | `packages/senda/tests/ble-crowd.test.mjs` |
| `s8b` | *Seeing the unseen, without faking X-rays* | Fusión bayesiana por vivienda (respuesta, señal móvil, respiración Wi-Fi CSI, golpes); sólo declara 98 % cuando dos fuentes independientes coinciden (100 % acierto en 200 simulaciones). | `SIMULATED` / `INFERRED` | `packages/senda/src/flat-fusion.mjs`, `investor-next/public/senda/edificio.html` | `packages/senda/tests/flat-fusion.test.mjs` |
| `s8c` | *Railways: the signal was in the data* | Detección de deriva en circuito de vía respecto a su historial, geometría con acelerómetros, curvas sin supervisión y muros con lluvia intensa. Datos sintéticos; informe GC disputado por Adif citado con neutralidad. | `SIMULATED` / `INFERRED` | `packages/senda/src/rail- preventive.mjs`, `investor-next/public/senda/ferroviario.html` | `packages/senda/tests/rail-preventive.test.mjs` |
| `s8d` | *Wildfires: warn before the mast burns* | Propagación de fuego con viento y pendiente cruzada con antenas móviles; en el escenario simulado la antena arde 107 min antes del límite de aviso. | `SIMULATED` | `packages/senda/src/wildfire.mjs`, `investor-next/public/senda/incendios.html` | `packages/senda/tests/wildfire.test.mjs` |
| `s9` | *Activation only with a signed warrant* | Activación remota sólo con credencial firmada por agencia autorizada, consentimiento previo del usuario y emergencia declarada; tablero planta por planta. | `CALCULATED` | `packages/senda/src/warrant.mjs`, `packages/senda/src/pci-envelope.mjs` | `packages/senda/tests/warrant.test.mjs`, `packages/senda/tests/pci-envelope.test.mjs` |
| `s10` | *Designed to be used with shaking hands* | Modo fácil con tres botones grandes (*I'm safe*, *I need help*, *I'm trapped*) y verificación automática de accesibilidad en cada cambio. | `OBSERVED` / `CALCULATED` | `investor-next/public/senda/index.html` | `investor-next/tests/e2e.spec.mjs` |
| `s10b` | *Five layers, from the phone's mic to the 112 room* | Arquitectura en 5 capas (sensores/radios, portadoras, núcleo en el móvil, aplicaciones/destinatarios) con estado honesto (*tested*, *simulated*, *pending*). | `OBSERVED` | `investor-next/public/senda/arquitectura.html` | `packages/senda/tests/epistemic-ledger.test.mjs` |
| `s10c` | *Calculated live, never pre-rendered* | Todas las simulaciones del vídeo están calculadas fotograma a fotograma por el mismo código del núcleo que verifican los tests automatizados. | `OBSERVED` / `CALCULATED` | `media/senda-film/sims.js`, `packages/senda/src/` | `packages/senda/tests/*.test.mjs` |
| `s11` | *Ready to deploy: server, mobile and drone* | Relé autoalojado en Docker bajo control de la agencia, app Android para baliza BLE/barrido Wi-Fi y accesorio de bajo coste para drones/mástiles; vectores probados en 3 lenguajes. | `OBSERVED` | `relay/`, `android/`, `firmware/` | `packages/senda/tests/cross-lang.test.mjs` |
| `s12` | *What is proven, and what is still missing* | Verificación automática en cada cambio (266 tests del núcleo y 49 comprobaciones E2E en navegador real, casi todas sin red) y declaración explícita de lo pendiente (pilotos de campo, auditoría externa, certificación). | `OBSERVED` | `investor-next/public/senda/estado.json`, `packages/senda/scripts/build-status-page.mjs` | `node --test packages/senda/tests/*.test.mjs` (266/266) |
| `s12b` | *Cryptographic and epistemic discipline* | Sobres firmados Ed25519 con protección anti-replay y cuarentena automática por inundación; 266 tests del núcleo y 13 tests PCI pasan en esta máquina; toda cifra se etiqueta como observada, calculada, simulada o inferida; lista para revisión externa, no certificada aún. | `OBSERVED` | `packages/senda/src/pci-envelope.mjs`, `packages/senda/src/epistemic-ledger.mjs`, `packages/senda-pci/tests/pci.test.mjs`, `docs/security/SENDA_ASSURANCE_REVIEW.md` | `node --test packages/senda/tests/*.test.mjs` (266/266) + `node --test packages/senda-pci/tests/*.test.mjs` (13/13) |
| `s13` | *When everything fails, SENDA remains* | Cierre e invitación a probar la plataforma web sin instalar nada; atribución `© 2026 Abraham Haddioui · SENDA`. | `OBSERVED` | `investor-next/app/senda-home.tsx`, `LICENSE` | `node --test scripts/release-manifest.test.mjs` |

---

## 3. Película de carretera — `senda-m95-ruta-en.mp4` (`media/senda-film/m95-ruta.json`)

| Escena | Título (EN) | Afirmación principal | Clasificación | Fuente primaria / Código | Test / Verificación |
|---|---|---|---|---|---|
| `r0` | *Road, tunnel and zero coverage* | 1.119 fallecidos en vías interurbanas en España en 2025 (balance provisional DGT 24 h), mayoría en carreteras convencionales; SENDA nunca sustituye al 112 ni a la atención al volante. | `OBSERVED` | Balance provisional siniestralidad vial DGT 2025 (vías interurbanas, 24 h); `investor-next/public/senda/carretera.html` | `packages/senda/tests/road.test.mjs` |
| `r1` | *Chain-reaction crash in fog* | Niebla, 120 km/h, 1,2 s de separación: 5 coches chocan en cadena sin alerta temprana; con aviso simultáneo por frenada GPS sólo choca el coche pegado a 0,7 s. Etiqueta: `SIMULATION · synthetic traffic`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawCad`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r2` | *Crash in an 18 km dead zone* | Tramo de 18 km sin cobertura; el SOS salta de coche en coche (mula DTN) y con un 10 % de penetración sale a zona con cobertura en ~7 min de simulación. Etiqueta: `SIMULATION · synthetic traffic`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawSos`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r3` | *Exact kilometre point with no Internet* | Cálculo offline de carretera, punto kilométrico, sentido, hito visual cercano (aerogenerador) e inercia en túnel. Etiqueta: `INVENTED ROAD · demo`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawPk`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r4` | *Protecting the scene: the PAS routine* | Coordinación PAS (Proteger, Avisar, Socorrer) con confirmación cruzada entre testigos, traspaso de mando a Guardia Civil y registro inalterable de puntos cívicos. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawEsc`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r5` | *Wrong-way driver on the motorway* | 3 posiciones consecutivas contra el sentido de la calzada activan aviso al propio conductor y margen de tiempo de cruce a los que vienen de frente. Etiqueta: `SIMULATION · synthetic traffic`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawKz`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r6` | *Stopped queue past a blind bend* | Onda de choque LWR (Lighthill-Whitham-Richards) calcula la velocidad de retroceso de la cola para avisar dónde estará la retención al llegar. Etiqueta: `SIMULATION · synthetic traffic`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/carretera.html` (`drawQ`), `packages/senda/src/road.mjs` | `packages/senda/tests/road.test.mjs` |
| `r7` | *Public cameras: measuring fog, never people* | Uso exclusivo de cámaras públicas reutilizables para estimar visibilidad (ley de Koschmieder) y velocidad de parada segura; nunca identifica personas ni matrículas. Etiqueta: `SYNTHETIC IMAGE · method test`. | `SIMULATED` / `CALCULATED` | `investor-next/public/senda/camaras.html` (`drawN`), `packages/senda/src/visibility.mjs` | `packages/senda/tests/visibility.test.mjs` |
| `r8` | *Same core in Spain and the Netherlands* | Estándar europeo 112 y DATEX II (DGT NAP en España, NDW y pórticos MSI en Países Bajos con avisos en neerlandés). Etiqueta: `SIMULATION · synthetic traffic`. | `CALCULATED` | `investor-next/public/senda/paises.html` (`drawM`), `packages/senda/src/datex.mjs` | `packages/senda/tests/datex.test.mjs` |
| `r9` | *Why a radar doesn't talk to your phone (and what does)* | Radares, paneles y espiras usan red cerrada DGT y detectar radares está prohibido; SENDA consume los datos abiertos publicados (DATEX II) para localizar la onda de cola. Etiqueta: `SIMULATION · synthetic traffic`. | `OBSERVED` / `CALCULATED` | `investor-next/public/senda/dgt.html` (`drawD`), `packages/senda/src/datex.mjs` | `packages/senda/tests/datex.test.mjs` |
| `r10` | *What works today and what is still missing* | Todo el cálculo corre en el núcleo de la app con pruebas automatizadas offline; faltan pilotos en carretera real, app nativa V2V y convenios con la DGT. | `OBSERVED` | `investor-next/public/senda/carretera.html`, `docs/audits/SENDA_MISSION_95_STATUS.md` | `node --test packages/senda/tests/*.test.mjs` |
| `r11` | *SENDA on the road* | Cierre e invitación a probar en la web; atribución `© 2026 Abraham Haddioui · SENDA`. | `OBSERVED` | `investor-next/app/senda-home.tsx`, `LICENSE` | `node --test scripts/release-manifest.test.mjs` |

---

## 4. Cortes cortos (V3), Vertical 9:16 (V4) y Simulaciones explicadas (V5)

Todos los vídeos derivados reutilizan exclusivamente escenas y líneas verificadas de `m95-film.json` y `m95-ruta.json`:

| Entregable | Archivo de guion | Escenas incluidas | Duración objetivo |
|---|---|---|---|
| **V3 — Corte 90 s** | `media/senda-film/m95-90s.json` | `s1` + `s2` + `s3b` + `s9` + `s13` | ~75–105 s |
| **V3 — Corte 60 s** | `media/senda-film/m95-60s.json` | `s1` + `s4` + `s9` + `s13` | ~50–75 s |
| **V3 — Corte 30 s** | `media/senda-film/m95-30s.json` | `s1` + `s13` | ~25–40 s |
| **V4 — Vertical 9:16 (45 s)** | `media/senda-film/m95-vertical-45s.json` | `s1` + `s3b` + `s13` (formato 1080×1920) | ~35–55 s |
| **V5.1 — Sim Braking** | `media/senda-film/m95-sim-braking.json` | `r1` (*Chain-reaction crash in fog*) | ~20–30 s |
| **V5.2 — Sim SOS** | `media/senda-film/m95-sim-sos.json` | `r2` (*Crash in an 18 km dead zone*) | ~20–30 s |
| **V5.3 — Sim Wrong-way** | `media/senda-film/m95-sim-wrongway.json` | `r5` (*Wrong-way driver on the motorway*) | ~15–25 s |
| **V5.4 — Sim Queue** | `media/senda-film/m95-sim-queue.json` | `r6` (*Stopped queue past a blind bend*) | ~15–25 s |
| **V5.5 — Sim Visibility** | `media/senda-film/m95-sim-visibility.json` | `r7` (*Public cameras: measuring fog, never people*) | ~15–25 s |
| **V5.6 — Sim Proof** | `media/senda-film/m95-sim-proof.json` | `s12` + `s12b` (*What is proven* + *Cryptographic and epistemic discipline*) | ~35–50 s |
