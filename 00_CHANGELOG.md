# Changelog

## SENDA v0.12 · 05-11-2026 · Arquitectura multiplataforma, sentidos ampliados, riadas, triaje, monte y dron casa por casa

**Entrada (fundador):**
- Auditoría desde 5 perspectivas.
- Preparar SENDA para varias plataformas (móvil, ordenador, dron, ferrocarril), también sin acceso a sistemas de terceros.
- Tener en cuenta las tragedias recientes de España y Europa.
- Más «sentidos» reales (dron casa por casa, respiración por Wi-Fi).
- Más escenarios: terremoto, maremoto, conflicto, evacuación de heridos, monte, riadas.
- Infraestructura e ideas de inversión.
- Arquitectura primero; después la web y los vídeos.

**Procesamiento (núcleo, 6 módulos nuevos, 21 pruebas):**
- `platforms.mjs`: plataformas donde corre SENDA, integraciones con modo de acceso (PASIVO = legal hoy · CONVENIO · NUNCA), planes por escenario (8) con planificador de cobertura y lecciones de catástrofes reales con fuente.
- `flood-watch.mjs`: hidrograma de Nash, embalse y alarma por subida aguas arriba. En el escenario sintético, 2 h 30 y 3 h 40 de margen en pueblos donde caen 3 mm. Maremoto con √(g·h) y evacuación vertical.
- `triage.mjs`: START para varias víctimas, RCP para una sola (Consejo Europeo de Resucitación 2021), qué hacer ya, servicios (112 primero) y parte ≤ 160 caracteres. Nunca declara fallecidos.
- `geo-offline.mjs`: resección con rumbos a marcas conocidas (aerogeneradores con luces de balizamiento, antenas, campanarios) con elipse de error, detección de pasos, estima por pasos y tamaño de mapas sin conexión.
- `senses.mjs`: escucha coral (golpes localizados con 5 móviles y relojes desfasados, < 0,5 m tras el pitido de sincronía) y modo detector de avalancha para la baliza Bluetooth.
- `house-sweep.mjs`: dron casa por casa, con orden de visita (vecino más cercano + 2-opt), salidas por batería con reserva y tablero de prioridad (personas probables × daño EMS-98).

**Web (5 pantallas nuevas, con «modo película» `?film=1&viz=` grabable desde la app real):**
- `/senda/sentidos`, `/senda/agua`, `/senda/triaje`, `/senda/monte`, `/senda/barrido`.
- `/senda/arquitectura`: 12 piezas nuevas, 3 escenarios nuevos (riada, monte, múltiples víctimas) y la sección «Plataformas, permisos y planes por escenario» con planificador interactivo.
- Portada (es/en/nl), SENDA Campo, service worker v13.

**Correcciones honestas registradas:**
- Los NOAA con imagen APT se dieron de baja en 2025.
- La respiración por Wi-Fi a través de muros no tiene validación independiente.
- Interrogar aerogeneradores u otra infraestructura ajena queda en NUNCA; usarlos como marcas visibles es PASIVO.

**Auditoría:** `docs/evaluacion/AUDITORIA_5_PERSPECTIVAS_2026-11-05.md` (TRL por capacidad, 5 perspectivas simuladas, huecos, multiplataforma, infraestructura, modelo de negocio, 90 días).

**Validación:** núcleo + relé 146/146 · E2E en Chromium 37/37 (accesibilidad en 17 pantallas) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.11 · 04-11-2026 · Malla de voz, despliegue físico y película v5 con simulaciones y 3D

**Entrada (fundador):**
- Seguir creando una arquitectura nueva, pero real, funcional y llevable al plano físico.
- Rehacer la película (inglés y español) incluyendo lo nuevo.
- Que la película se centre en cómo funcionan las simulaciones, los renders 3D, la arquitectura y la app, y en lo fácil que es usarla.

**Procesamiento:**
- `voice-mesh.mjs` (núcleo, nuevo): cadena y sala de voz entre teléfonos que no se alcanzan todos entre sí.
  - Árbol de repetidores con los saltos mínimos.
  - Quien tiene poca batería participa pero nunca repite.
  - Turno de palabra tipo walkie-talkie: 1 flujo por enlace sea cual sea el tamaño de la sala.
  - Replanificación por batería con aviso de quién queda aislado.
  - 5 pruebas.
- `/senda/llamada`: nueva sección «Cadena de voz».
  - Edificio con el árbol elegido y botón «Iker se queda sin batería».
  - Demo real A → B → C en una pestaña con cuatro conexiones WebRTC: C oye el tono de 440 Hz de A (441 Hz medidos) a través de B, y el chat llega reenviado.
- `/senda/arquitectura`: añadidos la pieza «Malla de voz», el escenario «Cadena de voz» y la tabla «Del plano al mundo físico», que dice para cada pieza qué existe hoy y qué falta.
- Película v5 (español 8:36, inglés 8:22; subtítulos es/en/nl): la v4 íntegra más 4 escenas calculadas con el núcleo real (`media/senda-film/sims.js`).
  1. Llamar sin Internet: el código de 91 bytes se convierte en su partitura real de tonos, la conexión es directa y sigue la cadena de voz.
  2. Censo con dron en 3D (three.js): edificio, dron, anuncios Bluetooth y panel con direcciones frente a teléfonos y personas.
  3. Arquitectura en 3D: las 5 capas con el estado real de cada pieza y paquetes recorriendo 4 escenarios.
  4. «Cada imagen es el código real»: código del núcleo ejecutándose, pruebas automáticas, render determinista y «un toque».
- Subtítulos sin fonética: el texto que se pronuncia (`<lang>_say`) va separado del que se lee. Por ejemplo, la voz dice «Rid Sólomon» y el subtítulo muestra «Reed-Solomon».

**Validación:** núcleo 123/123 + relé 2/2 · E2E en Chromium 32/32 (incluida la cadena de voz real) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.10 · 04-11-2026 · SENDA como canal de comunicación: llamadas sin Internet, censo radio con dron y arquitectura visible

**Entrada (fundador):** que la app no sea solo sonido sino un canal de comunicación de verdad (llamar y comunicarse en general), que use los sensores del teléfono y de los drones (estimar por radio cuántas personas hay en un edificio), centrarse en la arquitectura del sistema de forma visual y funcional, e inventar tecnología nueva.

**Procesamiento:**
- `sdp-compact.mjs` (núcleo, nuevo): señalización WebRTC compacta. Plantilla común (Opus + canal de datos) y solo lo variable en binario: claves ICE, huella SHA-256 DTLS, rol y candidatos host (IPv4 o mDNS). Oferta 79–103 bytes (~20 veces menos que el SDP), transmitible por el módem acústico en 8–10 s o como código de texto. 4 pruebas.
- `/senda/llamada`: llamada de voz y chat cifrados (DTLS-SRTP) entre dos teléfonos de la misma red local o punto de acceso, sin Internet ni servidor: crear/responder, enviar y escuchar el código por sonido, copiar/compartir, pulsar para hablar, colgar, ida y vuelta, pérdidas, kbit/s y botón «Estoy atrapado». Incluye una **llamada de prueba en un solo dispositivo** (sin micrófono) con la «partitura» de tonos del código.
- `rf-census.mjs` (núcleo, nuevo): censo radio por planta. Planta por RSSI mediano; teléfonos = máximo de direcciones simultáneas por familia (inmune a la rotación de direcciones BLE); personas por **inferencia bayesiana exacta** (0/1/2 teléfonos por persona, hipótesis 12 %/8 % pendiente de calibrar) con mediana e intervalo del 90 %; «0 teléfonos» = «0, quizá 1». Solo recuentos. Escenario sintético realista (personas sin móvil o con dos; generador mulberry32). 8 pruebas.
- `/senda/dron`: fachada en vivo con el dron y los anuncios Bluetooth, tabla por planta (direcciones vs teléfonos vs personas vs verdad simulada), línea de tiempo «cada fila un dispositivo, cada segmento una dirección», distribución posterior, el dron como plataforma de sensores con estado honesto, y privacidad/ley.
- `/senda/arquitectura`: 5 capas (sensores y radios → portadores → núcleo → aplicaciones → destinos), 35 piezas con estado real (navegador / simulación / app Android / app nativa / hoja de ruta), 6 escenarios animados paso a paso (llamada, atrapada tras un sismo, dron, satélite, incendio, vía), ficha de cada pieza con código y enlace, matriz de sensores Android con interfaz y permiso, y fuentes.
- Investigación: `docs/research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md` (Science 2025 sobre alertas sísmicas Android, Wi-Fi Aware, límite de 200 Hz de Android 12, BarcodeDetector, Wi-Fi RTT; infrarrojos descartado como canal).
- Integración: tarjetas nuevas en la portada (es/en/nl), accesos desde SENDA Campo, service worker v11 con las tres pantallas precargadas, E2E ampliada.

**Validación:** núcleo + relé 120/120 · E2E en Chromium 31/31 con las nuevas comprobaciones (llamada con oferta por onda acústica real, voz y chat, cero peticiones de red durante la llamada; demo en un dispositivo; dron; arquitectura; accesibilidad en 12 pantallas). Límite declarado: la emulación «offline» de Chromium también bloquea WebRTC local, así que la llamada se prueba sin ningún servidor y con cero peticiones; falta ensayo con dos teléfonos físicos.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.9 · 04-11-2026 · Corrección de rumbo: portada restaurada, Ojo de SENDA, incendio cartográfico y película v4

**Entrada (fundador):** la v0.8 bajó el nivel. Volver a la portada anterior con sus explicaciones largas; que «ver como» cambie la página de verdad; explicar el globo (satélites, casos y módulos); película con introducción, en inglés y español, al nivel de la v3.

**Procesamiento:**
- Portada restaurada tal como estaba (todas las secciones). Retirados la portada condensada, `/lab`, los cuadros de demos y la película/reels v0.8.
- `audience-filter.tsx`: «Ver la página como» Todo · Ciudadanía · Coordinación · Ingeniería · Inversión. Cada perfil ve su recorrido completo (9–13 secciones, con sus explicaciones) y «Todo» la página entera (20).
- `/senda/ojo` (spec 03): globo en tiempo real con Iridium (66, LEO), Galileo (24, MEO) y QO-100 (GEO), 7 casos reales con fuente y módulos, ruta del aviso caso → satélite → relé → 112 con elevación, distancia y latencia, plan k-de-n con los canales que quedan; terminador día/noche exacto. Incrustado en la portada con explicación en es/en/nl.
- `/senda/incendio`: relieve sombreado, curvas de nivel, vegetación continua, frente con resplandor y humo, isócronas por marching squares, antenas con cobertura, línea de tiempo y explicación larga con fuentes. Paisaje sintético con manchas de combustible continuas (antes, ruido por celda).
- Película v4 = v3 íntegra + 4 escenas (Ojo de SENDA, ver lo que no se ve, vías, incendio) con capturas reales y voz Kokoro de precisión completa (fp32) en es y en; subtítulos es/en/nl.

**Validación:** núcleo + relé 108/108 · E2E sin red 27/27 (Ojo e incendio incluidos, accesibilidad en 9 pantallas) · web: compilación, idiomas y 98/98.

**Lección registrada:** «acortar» no es «sustituir»; antes de retirar contenido, preguntar.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.8 · 04-11-2026 · Portada en vivo por niveles, incendio forestal, película y reels

**Entrada:** web más corta e inmersiva, con demostraciones en vivo de cada innovación; foco en incendios, vías, comunicación sin red, seguridad y satélite; material audiovisual para inversión.

**Procesamiento:**
- `wildfire.mjs` (núcleo): tiempo mínimo de llegada del fuego (Dijkstra, elipse de viento, pendiente con forma de Rothermel), FIRMS, y cruce con antenas: si la antena de un pueblo cae antes de su hora límite de aviso, la alerta sale antes o por portadores sin red (`planMultiBearer`). 7 pruebas. Corregido un fallo de precisión Float32 en el montículo que detenía la propagación sin viento.
- `investor-next/public/senda/home/demos.mjs`: 7 demos deterministas `render(t)` sobre el núcleo (malla, k-de-n, cifrado WebCrypto real, fusión, incendio, vía, órbitas con costas Natural Earth). Las mismas demos alimentan la web y los vídeos.
- Portada nueva `senda-experience.tsx` (es/en/nl): selector de nivel (ciudadanía, coordinación, ingeniería, inversión), 6 capítulos con demo en vivo, película y reels, algoritmo, inversión y verdad declarada. El laboratorio anterior completo pasa a `/lab` (en/es/nl) sin perder nada.
- `media/senda-promo`: guiones, voz Kokoro local, compositor `promo.html`, render por tramos, publicación. Película para inversores (16:9) y 3 reels (9:16) en es/en.

**Validación:** núcleo + relé 108/108; E2E sin red; web: compilación, idiomas y 98/98; capturas de control de escritorio, móvil y fotogramas de vídeo.

**Salida:** `/` `/es/` `/nl/` nuevas; `/lab/`; `public/media/promo/*`.

**Siguiente:** combustibles reales (SIOSE/CORINE) y AEMET para el incendio; TLE reales en la demo orbital; medición Lighthouse de la portada nueva.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.7 · 04-11-2026 · Motor de fusión de evidencias, visión por capas y vigilancia ferroviaria

**Entrada:** convertir «una cámara que vea a través de las paredes no existe» en algo construible y verificable; prevenir accidentes ferroviarios con datos que ya existen.

**Procesamiento:**
- `occupancy.mjs`: fusión bayesiana por persona + OR ruidoso por vivienda; intervalo por rango de parámetros; traza en decibanes; «≥98 %» solo con dos familias independientes; prioridad = probabilidad × riesgo EMS-98.
- `rescue-scenario.mjs`: verdad conocida para medir calibración (Brier, fiabilidad) y adaptador al edificio 14.
- `sensor-fabric.mjs`: catálogo de 17 dispositivos con permiso legal; barometría diferencial; planificador de la siguiente medida por bits/minuto.
- `vision-layers.mjs`: capas sobre la cámara (probabilidad, espectro, estructura, topografía, térmica real) y puntos calientes térmicos.
- `rail-watch.mjs` + `/senda/via`: escalones en circuitos de vía (patrón Adamuz), geometría con móviles de viajeros, transiciones de velocidad sin supervisión (Angrois), muros con lluvia (Gelida).
- `/senda/edificios`: pestaña «Visión por capas» con «dónde buscar primero» y «siguiente medida».

**Validación:** núcleo + relé 101/101 · E2E sin red 25/25 (2 comprobaciones nuevas y `/senda/via` en la auditoría de accesibilidad) · web: compilación, idiomas y 98/98. Calibración en 200 escenarios: Brier 0,107 frente a 0,124; insignia «≥98 %» acertada en 1.149/1.149 (619/619 con parámetros erróneos). Error de diseño detectado por la propia medición y corregido (doble conteo de detecciones compartidas).

**Salida:** `docs/architecture/MOTOR_FUSION_EVIDENCIAS.md`, `docs/research/ACCIDENTES_GRAVES_Y_PREVENCION_2026-11-04.md`, `evidence/senda/{fusion-calibration,rail-watch}.json`, capturas `e2e-14`, `e2e-15`.

**Siguiente:** piloto de calibración con bomberos/UME; convenio de datos de circuitos de vía con un gestor; Wi-Fi RTT y cámara térmica en la app Android.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## V0.1 (demo ficticia, endurecida, publicada)

- Publicada en GitHub Pages: `https://abrahamhl.github.io/civic-relay/` (repo `abrahamhl/civic-relay`).
- Reproducibilidad: se eliminan `*.tsbuildinfo` versionados; CI `install -> build -> type-check -> test`.
- Carga limpia verificada y CI verde (28 s).

- Core: `Dispatcher`/`MessageStore` separan aceptación de entrega; `DELIVERED` solo con ACK del receptor.
- Core: `demo.ts` conecta el flujo real (router/store/dedup) al escenario dorado.
- Core: TTL comprobado antes de rutar; caducados y `OFFICIAL` forjado rechazados; colisiones de ID rechazadas.
- Crypto: claves Ed25519 (firma) y X25519/XSalsa20-Poly1305 (cifrado experimental) separadas; sin E2E en el flujo.
- Tests: 21 pruebas con `node:test` (`pnpm test`).
- Web: build con `base: /civic-relay/`, tipos restringidos a la demo, manifiesto mínimo, identidad/GPS ficticios.
- Verdad: retirado "ENS Alto Compliant / Ready for Pilot / 93%"; tenantes con dominios `*.example`; README y docs nuevos.
- Auditorías: `AUDITORIAS_INVERSION_PUBLICA.md`, `ASTRA_RED_TEAM.md`, `RELEASE_TRUTH_V0_1.md`, `WORKWIZE_CASE_STUDY.md`.

## Antes

- HEAD `3f1c398`: higiene básica restaurada (lockfile, CI `master`), pero core sin escenario dorado verificado, crypto incompatible y documentación con exceso de afirmaciones.
