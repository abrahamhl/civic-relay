# Changelog

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
