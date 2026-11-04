# Changelog

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
