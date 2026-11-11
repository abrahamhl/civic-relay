# SENDA · Película de presentación a inversores v2 (motor 3D `cinema`)

Fecha: 11-11-2026 · Rama: `claude/promotional-video-prompts-p5vzh8` · Base: `feat/senda-funding-mission-day1`

## Qué es

Película de 12:31 en 1080p (formato panorámico 2.39:1 con bandas), narración en inglés con voz femenina
(`bf_emma`, Kokoro, la voz fijada en `docs/handoff/prompts/antigravity/03_VOZ_Y_SUBTITULOS.md`), música techno
tranquila generada por código y subtítulos en español (quemados) y en español e inglés (pistas y `.vtt`).

La v2 sustituye a la v1 (4:16). Motivo, a petición del fundador: la v1 no explicaba nada. La v2 cuenta por qué
pasó cada suceso, cómo funciona SENDA paso a paso, qué física hay debajo, cómo probarlo, cómo se coordinan los
organismos, con qué se integra, qué módulos de hardware se diseñan y qué falta. Todo se cuenta en escenas 3D
animadas, no en diapositivas.

## Cómo se reproduce

```bash
cd media/senda-film
node build-investor-film.mjs            # guion; calcula la física con el núcleo y falla si no coincide
node validate.mjs investor-film en
python3 voice.py investor-film en       # voz + tiempos (Kokoro en ~/.cache/kokoro)
STILLS=15,40,65 node render-cinema.mjs --stills   # fotogramas de control en build/
JOBS=4 node render-cinema.mjs           # build/senda-investor-film-en.mp4 + .es.vtt + .en.vtt
```

| Pieza | Ruta |
|---|---|
| Guion (generado) | `media/senda-film/investor-film.json` ← `build-investor-film.mjs` |
| Motor y rótulos | `media/senda-film/cinema.html` |
| Escenas 3D | `media/senda-film/cinema/scenes.js` (v1, ampliado), `cinema/scenes2.js` (v2), `cinema/lib.js` |
| three.js r158 + postproceso + RoomEnvironment (MIT) | `media/senda-film/cinema/vendor/` |
| Pantallas reales de la app | `media/senda-film/assets/` (`app-*.png` capturadas de `investor-next/public/senda/*.html`) |
| Música | `media/senda-film/music-techno.py` |
| Grabación | `media/senda-film/render-cinema.mjs` |

Cada fotograma es función pura del tiempo (`window.seek(t)`), sin `Math.random` ni relojes.

## Comprobaciones que hace el generador (fallo cerrado)

- Atenuación por lluvia con `computeRainAttenuation` (ITU-R P.838-3) a 50 mm/h: 868 MHz < 0,01 dB/km; 28 GHz ≈ 7 dB/km (7,38).
- Difracción en filo de cuchillo (`computeFresnelV` + `computeKnifeEdgeLossDb`): cresta de 60 m a mitad de 10 km a 868 MHz ≈ 22 dB (22,1).
- Longitudes de onda: 34,5 cm a 868 MHz y 1,07 cm a 28 GHz.
- Reed-Solomon (`erasure.mjs`): codifica 6 de 10, pierde 4 fragmentos y reconstruye el mensaje byte a byte.
- Pruebas: núcleo y extremo a extremo leídos de `estado.json` (433 y 49, SHA `c1112d2`); agentes contados en `.opencode/agents` (43).
- Ningún subtítulo supera 2 líneas × 42 caracteres; la voz no contiene cifras ni símbolos.

## Procedencia por escena

| Escena | Contenido | Fuente en el repositorio |
|---|---|---|
| v01 Apagón | Antenas con batería; 90 % → 40 % | `docs/handoff/04_DESASTRES_ESPANA.md` (fuentes de prensa citadas allí) |
| v02 DANA | Lluvia aguas arriba; pueblos sin lluvia; ES-Alert 20:11; causas en disputa | `media/senda-film/features.json` (f4), `docs/handoff/04_DESASTRES_ESPANA.md` |
| v03 Adamuz | Segundo tren ≈ 45 min; rotura de soldadura (CIAF preliminar) | `docs/product/SENDA_VISION_2026-11-04.md` § 2 ter, `docs/research/ACCIDENTES_GRAVES_Y_PREVENCION_2026-11-04.md` |
| v04 Patrón | Cuatro puntos del patrón común | `docs/handoff/04_DESASTRES_ESPANA.md` § Patrón común |
| v06 App | Web instalable, offline, 3 botones, sobre ≈ 300 B, E2E, app Android | `SENDA_VISION` § 2 bis y 2 quinquies, `docs/field/PRUEBA_CON_TU_HERMANO.md` |
| v07 Malla | Relés ciegos, intercambio al cruzarse, recibos que purgan, ciudad de 40 móviles | `SENDA_VISION` § 2 bis (`bundle.mjs`, `envelope.mjs`) |
| v08 Reed-Solomon | k-de-n, 197/200 en vivo, Contact Graph Routing | `erasure.mjs`, `m96-promo.json` (s4), `SENDA_VISION` § 2 (`router.mjs`) |
| v09 Arnhem → San Martín | ≈ 4 min frente a 480 min (simulación); sin puente no finge; 112 por otro operador | `SENDA_VISION` § 1 y 2 (S01), `PRUEBA_CON_TU_HERMANO.md` § 1 |
| v10 Prueba en casa | Sonido 8–10 s; punto de acceso y llamada; nodos LoRa 30–40 € | `PRUEBA_CON_TU_HERMANO.md` § 2–4 |
| v11 Reserva | 1.024 MB; mochila 0/1 con frescura; cola de intenciones; los bytes no son cobertura | `packages/senda/src/net-reserve.mjs`, `PRUEBA_CON_TU_HERMANO.md` § 6 |
| v12 Lluvia | P.838-3 calculado | `telecom-mathematical-physics.mjs` |
| v13 Difracción | Deygout y Epstein-Peterson; ≈ 22 dB | `telecom-mathematical-physics.mjs` |
| v14 Satélites | Kepler + J2 en el móvil; pasos como contactos | `SENDA_VISION` § 2 (`orbital.mjs`) |
| v15 Previsión del apagón | Baterías por antena; 5 pasarelas → 72 % | `m96-promo.json` (s6), `blackout.mjs` |
| v16 Carretera | 1.119 fallecidos (2025); 5 → 1; SOS en coches, 1 de cada 10, ≈ 7 min | `ruta.json` (r0, r1, r2) |
| v17 PAS | Proteger, avisar, socorrer; PK y sentido; túnel; aerogeneradores; Guardia Civil | `ruta.json` (r3, r4), `features.json` (f7) |
| v18 Tren | Detección de impacto; 20–30 s; fusión; 30–40 s con 5 %; CAP | `SENDA_VISION` § 2 ter (`rail-incident.mjs`, `rail-scenario.mjs`) |
| v19 Terremoto | STA/LTA; ≥ 4 móviles; 14 móviles ≈ 0,5 km (sintético); corroboración | `SENDA_VISION` § 2 (`seismic.mjs`), `CIVIC_RELAY_VISION_MAESTRA` E4 |
| v20 Inundación | Hidrología, embalses, 2 h 30 de aviso, 3 l/m² (sintético) | `features.json` (f4), `flood-watch.mjs` |
| v21 Incendio | Viento, pendiente, combustible; antena 107 min antes del límite | `m96-promo.json` (s8d), `wildfire.mjs` |
| v22 Edificios | Balizas BLE desde dron; 95 % en 720 plantas; golpe a 10 cm (sim.); desaparecido sin confirmar | `m96-promo.json` (s8a), `features.json` (f1), `SENDA_VISION` § 2 quater |
| v23 Coordinación | Ancla de confianza, credenciales, orden firmada, firma + zona + consentimiento, cuadro por planta | `SENDA_VISION` § 2 quater y quinquies, `PRUEBA_CON_TU_HERMANO.md` § 5 |
| v24 Red | Sin servidor central; recibos que enseñan fiabilidad (CRDT); fuentes abiertas; linaje | `docs/handoff/09_…` L2 y L4, `delivery-assurance.mjs`, `source-evidence.mjs` |
| v25 Integraciones | Mismo núcleo en varias plataformas; CAP, DATEX II, MAVLink, OBD-II; convenios; nunca intrusión | `features.json` (f0), `docs/integrations/SENDA_INTEROPERABILITY_MATRIX.md`, `PRUEBA_CON_TU_HERMANO.md` § 7 |
| v26 Módulos | ESP32 (firmware en CI); LoRa 30–40 €; diseños: radar 24 GHz, microsismógrafo, repetidor LoRa solar | `SENDA_VISION` § 2 quinquies, `docs/hardware/SENDA_COTS_HARDWARE_PACKS_AND_PHYSICS_GUIDE.md` (packs 1–3, coste estimado) |
| v27 Pruebas | 433 / 49 / 43; equipos rojos; lo que falta; siguiente paso | `estado.json`, `.opencode/agents`, `SENDA_VISION` § 6 |

## Límites (no ocultar)

- **No hay metraje real.** La red de esta sesión bloquea los bancos de vídeo con licencia (Wikimedia Commons,
  archive.org) y la regla 6 del prompt maestro prohíbe metraje sin licencia e imágenes de víctimas. Los sucesos
  reales se cuentan con visualizaciones 3D, rotuladas `PUBLISHED RECORD · 3D VISUALISATION`.
- **El 3D es de tiempo real (WebGL por software), no un render de Blender/Cycles.** No hay GPU en el entorno.
- **Las escenas simuladas son ilustrativas**: reproducen las cifras del núcleo, pero la coreografía no ejecuta
  `packages/senda` (salvo la frenada en cadena, modelada en la propia escena). Rótulo: `ILLUSTRATIVE 3D · FIGURES FROM THE SENDA CORE`.
- **Las pantallas del móvil son reales**, pero en español (la app aún no tiene interfaz en inglés).
- **Los módulos de radar, microsismógrafo y repetidor solar son diseños** con coste estimado de piezas; no se han
  fabricado ni probado en campo. La voz lo dice.
- **Contenido de defensa y doble uso excluido**, como en M96: vive en la bóveda `/defense`.
- Sin subtítulos en neerlandés: no publicar en producción sin añadirlos y revisarlos. Vídeo no integrado en la web.
