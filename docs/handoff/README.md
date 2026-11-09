# SENDA · Paquete de traspaso (handoff) para un proyecto limpio

> **Actualizado (08-11-2026):** empieza por **[HANDOFF_COMPLETO_2026-11-05.md](HANDOFF_COMPLETO_2026-11-05.md)** (mapa y procedimiento) y **[08_ANTIGRAVITY_VIDEO_HANDOFF.md](08_ANTIGRAVITY_VIDEO_HANDOFF.md)** (suite de vídeo profesional, inglés 1080p, VTT es/en/nl y despliegue). Vídeos: **[07_VIDEOS_3D_RUNBOOK.md](07_VIDEOS_3D_RUNBOOK.md)**. La puntuación vigente es **6,7/10**, no el 7,9 histórico de § 4; para el estado real usa `docs/audits/SENDA_MISSION_95_STATUS.md`. Lo que sigue es la versión 1 (contexto histórico).

> Versión 1 · 04-11-2026 · commit de referencia `c933c9b` (rama `ccr-bb7a95b8-t79scj`, PR #12).
> Entrada → Procesamiento → Validación → Salida: todo lo necesario para que cualquier persona o
> agente retome el proyecto sin el historial de conversación.

## 1. Ficha

| Campo | Valor |
|---|---|
| **Título** | **SENDA — Sistema de Enrutamiento de Emergencia por canales alternativos** |
| **Lema** | *Offline first, for sure.* Cuando cae la red, el mensaje sigue su camino. |
| **Descripción (corta)** | Capa abierta y verificable que coordina cualquier medio capaz de mover un mensaje de emergencia (teléfonos cercanos, sonido, satélite directo al móvil, LoRa, Iridium, radioaficionados, drones y la red que quede) para que la ciudadanía, los coordinadores y los servicios de emergencia sigan comunicados cuando la red móvil cae. |
| **Descripción (larga)** | Mensajes cifrados de extremo a extremo viajan sin Internet por sonido, archivo o de mano en mano (DTN). Cada mensaje puede trocearse en fragmentos k-de-n (Reed-Solomon) repartidos entre portadores con probabilidad de entrega calculada de forma exacta. Un organismo emite credenciales y alertas firmadas que los teléfonos verifican y solo ejecutan con consentimiento y zona declarada. Hay módulos de accidente ferroviario, gemelo digital de edificios, previsión de apagón con colocación de pasarelas, drones, exportación CAP 1.2 al 112 y auditoría encadenada. Funciona como PWA en modo avión, con relé autoalojable, app Android y accesorio ESP32. |
| **Repositorio** | https://github.com/abrahamhl/civic-relay (licencia MIT; ver [01](01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md)) |
| **Web en producción** | https://civic-relay-investor.vercel.app · `/es` · `/nl` (Vercel, proyecto `civic-relay-investor`) |
| **Aplicación** | https://civic-relay-investor.vercel.app/senda (PWA instalable, abre sin red) |
| **Pantallas** | `/senda/red` (portadores, satélites, apagón, drones, CAP) · `/senda/incidente` (ferroviario) · `/senda/edificios` (gemelo 3D) · `/senda/organismo` (credenciales) · `/senda/estado` (verificación) |
| **Película** | `/media/senda-film-es.mp4` (4:33) · `/media/senda-film-en.mp4` (4:24) · subtítulos es/en/nl |
| **Autor / titular** | Abraham Haddioui (© 2026) |
| **Estado** | Prototipo avanzado verificado por máquina. Sin validación de campo ni certificaciones (ver § 4). |

## 2. Alcance (scope)

**Dentro:**
- Mensajería ciudadana sin red.
- Coordinación firmada organismo → coordinador → residente.
- Capa multiportador (satélite, LoRa, Iridium, SMS, radioaficionados, drones, vecinos).
- Previsión de apagón de comunicaciones.
- Módulos ferroviario y de edificios.
- Interoperabilidad con el 112: CAP 1.2 y auditoría.
- Relé soberano, app Android, accesorio ESP32.
- Web trilingüe con película.

**Fuera, por diseño:**
- **No sustituye al 112 ni a EU-Alert.** SENDA es un canal secundario y se etiqueta como tal.
- **No intercepta comunicaciones** de cuerpos de seguridad.
- **No enciende radios sin el toque del usuario.**
- **No declara víctimas.** Una persona sin respuesta figura como «desaparecida sin confirmar».

**Siguiente alcance** (especificado en [03](03_OJO_DE_SENDA_COP_3D.md)): «Ojo de SENDA», una imagen operativa común en 3D con cámaras, sensores, aviones, drones como pasarela, incendios y capas topográficas, activada solo con una alerta confirmada.

## 3. Objetivos

1. **Ciudadanía:** que un mensaje llegue antes que WhatsApp cuando la antena ha caído (escenario S01: unos 4 min frente a 480).
2. **Coordinadores y cuerpos:** una imagen operativa por planta, por tren y por zona, con alertas firmadas y respuestas cifradas.
3. **Administraciones:**
   - Continuidad entre hoy y el sistema europeo de comunicación crítica (EUCCS, 2030–2036).
   - Relé bajo control del propio organismo.
   - Cumplimiento ENS/ENI/accesibilidad como objetivo de certificación.
4. **Inversión:** núcleo abierto para la adopción; ingresos por licencias institucionales, integración, kits de hardware, operación y certificación.

## 4. Puntuación (rúbrica con evidencias: [`../product/SENDA_EVALUACION_2026-11-04.md`](../product/SENDA_EVALUACION_2026-11-04.md))

| | Valor |
|---|---|
| Nota global ponderada | **7,9 / 10** (antes 6,9) |
| Producto y tecnología | **9,0 / 10** |
| Pruebas | Núcleo 78/78 · relé 2/2 · E2E sin red 23/23 · web 98/98 · paridad JVM 14/14 · C++ · CI: APK, firmware ESP32, imagen Docker |
| Para llegar a 9,5 real | (1) piloto de campo con protección civil; (2) auditoría de seguridad independiente + ENS + DPIA; (3) auditoría de accesibilidad EN 301 549 con usuarios; (4) primer convenio firmado |

## 5. Índice de este paquete

| Archivo | Contenido |
|---|---|
| [01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md](01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md) | Copyright, licencia, open core, marca, secretos empresariales, protección anti-clon realista |
| [02_AGENTES_Y_PROMPTS.md](02_AGENTES_Y_PROMPTS.md) | 12 agentes especialistas con prompt optimizado, archivos de entrada, entregables, criterios y skills |
| [03_OJO_DE_SENDA_COP_3D.md](03_OJO_DE_SENDA_COP_3D.md) | Especificación de la imagen operativa 3D (cámaras, sensores, aviones, drones como pasarela, SITRE, WhatsApp) con límites legales |
| [04_DESASTRES_ESPANA.md](04_DESASTRES_ESPANA.md) | Desastres recientes en España y qué habría cambiado SENDA |
| [../research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md](../research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md) | v0.10: llamadas sin Internet (señalización compacta por sonido), censo radio con dron, matriz de sensores Android con fuentes, pasos siguientes para decidir |
| [05_CERTIFICACIONES_Y_PERMISOS.md](05_CERTIFICACIONES_Y_PERMISOS.md) | ENS, NIS2, RGPD, accesibilidad, CE/RED, drones, espectro, financiación pública |
| [06_PROMPT_INICIAL.md](06_PROMPT_INICIAL.md) | Prompt maestro para abrir la nueva conversación |
| [07_VIDEOS_3D_RUNBOOK.md](07_VIDEOS_3D_RUNBOOK.md) | Pipeline determinista de vídeo (Kokoro, Playwright, three.js, ffmpeg) |
| [08_ANTIGRAVITY_VIDEO_HANDOFF.md](08_ANTIGRAVITY_VIDEO_HANDOFF.md) | Encargo profesional: película y ruta en inglés 1080p, VTT es/en/nl, web, protección y QA |
| [prompts/antigravity/](prompts/antigravity/) | Prompts listos para pegar: maestro, película, ruta/sims, voz/subtítulos, web/deploy y QA |
| [templates/CLAUDE.md](templates/CLAUDE.md) | Reglas del repositorio para cualquier agente (copiar a la raíz del nuevo repo) |
| [templates/TRADEMARK.md](templates/TRADEMARK.md) | Política de marca (borrador para revisión legal) |

## 6. Mapa de archivos del proyecto (lo que hay que llevarse)

| Área | Archivos | Verificación |
|---|---|---|
| Núcleo (JS puro, sin dependencias) | `packages/senda/src/*.mjs` (29 módulos: envelope, bundle, router, ladder, zones, seismic, roles, remote-command, building-twin, rail-incident, acoustic-modem, beacon, **erasure, bearers, satellites, blackout, drone, interop**…) | `node --test packages/senda/tests/*.test.mjs` |
| Pruebas del núcleo | `packages/senda/tests/*.test.mjs` (11 archivos) | idem |
| Escenarios y página de estado | `packages/senda/scripts/{run-scenarios,sync-web,build-status-page}.mjs` | genera `evidence/senda/*.json`, `investor-next/public/senda/estado.{html,json}` |
| App de campo (PWA) | `investor-next/public/senda/*` (index, app.mjs, coord.mjs, red, incidente, edificios, organismo, estado, core/ sincronizado) + `investor-next/public/senda-sw.js` | `node investor-next/scripts/senda-offline-e2e.mjs` |
| Web (Next.js 16) | `investor-next/app/senda-home.{tsx,css}`, `investor-page.tsx`, `responsive-header.tsx`, `copy.ts` | `npm run build`, `node test-locales.mjs`, `node --test tests/*.test.mjs` |
| Relé | `packages/senda-relay/{server.mjs,Dockerfile,README.md,tests/}` | `node --test packages/senda-relay/tests/*.test.mjs` + Docker en CI |
| Android | `apps/senda-android/` (BleBeacon, WifiSurveyRecorder, NativeAction, SendaFormats, MainActivity) | `.github/workflows/senda-android-ci.yml` |
| ESP32 | `hardware/esp32-survey/{esp32-survey.ino,senda_frame.h,test/host_test.cpp}` | `.github/workflows/senda-esp32-ci.yml` |
| Película | `media/senda-film/{script.json,film.html,voice.py,render.mjs,publish.sh,assets/}` | ver agente A3 |
| Película antigua (marca anterior) | `media/promo-video/` | solo referencia |
| Documentación | `docs/architecture/SENDA_ARCHITECTURE.md`, `docs/research/PROCUREMENT_GAP_2026.md`, `docs/product/SENDA_VISION_2026-11-04.md`, `docs/product/SENDA_EVALUACION_2026-11-04.md`, `docs/product/CAMERA_SECTOR_ARCHITECTURE.md`, `docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md`, `docs/IP_OPEN_SOURCE_2026.md` | — |
| CI | `.github/workflows/senda-ci.yml`, `senda-android-ci.yml`, `senda-esp32-ci.yml` | GitHub Actions |
| Evidencias | `evidence/senda/` (JSON + capturas e2e-01…13) | regenerables |

**Para un repositorio limpio:** copiar `packages/senda`, `packages/senda-relay`, `apps/senda-android`, `hardware/esp32-survey`, `media/senda-film` (sin `out/`), `investor-next/public/senda*` y los tres workflows SENDA. La web Next.js se puede reducir a la portada `senda-home`. Conservar el historial de Git o una referencia al commit `c933c9b` es la prueba de autoría y fecha (ver 01).

## 7. Fuentes principales (todas verificadas en la investigación del 04-11-2026)

- Apagón ibérico 28-04-2025: [laecuaciondigital](https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/) · [Infobae](https://www.infobae.com/tecno/2025/04/29/el-apagon-que-desconecto-a-espana-por-que-whatsapp-dejo-de-funcionar-aunque-el-movil-mostraba-cobertura/) · [Wikipedia](https://es.wikipedia.org/wiki/Apag%C3%B3n_en_la_pen%C3%ADnsula_ib%C3%A9rica_de_2025)
- DANA Valencia 29-10-2024 (ES-Alert 20:11): [El Debate](https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html) · [Donporque](https://donporque.com/por-que-retraso-es-alert-dana/)
- EUCCS (propuesta 30-09-2026): [Comisión Europea](https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en) · [EENA](https://eena.org/news/the-commission-proposed-a-new-european-union-critical-communication-system-regulation/)
- Galileo EWSS (en desarrollo): [EUSPA](https://www.euspa.europa.eu/galileo-ewss) · Galileo Return Link: [ESA](https://www.esa.int/Applications/Satellite_navigation/Galileo_now_replying_to_SOS_messages_worldwide)
- Pliegos ENS/ENI: [SMS Murcia 2025](https://sms.carm.es/sms/licitacion/licitacion/documento?numExpediente=CSE%2F9900%2F1101169037%2F25%2FPA&idDoc=R0337119) · 112 Murcia: [CARM](https://transparencia.carm.es/wres/transparencia/doc/Consejo_Gobierno/2023-03-16/punto_22_contrato_gestion_emergencias.pdf)
- EMSI: [ISO/TR 22351](https://www.iso.org/standard/57384.html) · CAP en compras: [Adaptive Lighthouse](https://adaptivelighthouse.com/resources/emergency-management-software-guide)
- Satélite: [Starlink D2C Europa (SpaceNews)](https://spacenews.com/virgin-media-o2-launches-europes-first-starlink-direct-to-smartphone-service/) · [Skylo/Orange](https://www.androidcentral.com/phones/google-pixel/pixel-9-10-gain-brief-satellite-texting-exclusivity-via-european-carrier-orange) · [RockBLOCK SBD](https://docs.rockblock.rock7.com/docs/transmit-binary-data) · [QO-100 (AMSAT-UK)](https://wordpress.amsat-uk.org/satellites/geo/eshail-2)
- Drones: [Open Drone ID (MAVLink)](https://mavlink.io/en/services/opendroneid.html)
- Países Bajos (NL-Alert, sirenas): [DutchNews](https://www.dutchnews.nl/2026/06/government-u-turns-on-decision-not-to-replace-air-raid-sirens/)
- Mercado: [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/emergency-management-software-market-218079999.html) · [Growth Market Reports](https://growthmarketreports.com/report/incident-and-emergency-management-software-market-global-industry-analysis)
- God's Eye View: `bilawalsidhu/gods-eye-view` (código MIT, datos con licencias no comerciales; ver `docs/product/SENDA_VISION_2026-11-04.md` § 4 bis)

**Pendiente de verificar** (la búsqueda web se agotó en esta sesión): la web de cámaras y comunicaciones del incendio de El Tiemblo / San Martín de Valdeiglesias, qué es exactamente «SITRE» y la fuente oficial del proxy de WhatsApp. Instrucciones para el agente en [03](03_OJO_DE_SENDA_COP_3D.md) § 7.
