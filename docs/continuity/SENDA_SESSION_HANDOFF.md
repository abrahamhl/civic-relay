# SENDA · handoff (2026-11-23, sesión app)

## Hecho y fusionado
- Fase 0: APK en la Release fija `senda-android-latest` (workflow), `/senda/descargas` verificada.
- Fase 1 núcleo: `app-roles.mjs` (ADMIN por clave no exportable, OBSERVADOR_TOTAL por credencial, CIUDADANO) — PR #71.
- Portada `/senda/app` estilo Apple (Inicio, Módulos por rol, Mensajes, Ajustes con dar/revocar acceso por código) — PR #71.
- Marco común `app-chrome.mjs` en las 50 páginas (solo dentro de la app). Icono adaptativo. Márgenes Android 15. SENDA Drive como módulo (un solo icono) — PR #71.
- `external-links.mjs` (V16, walkie 4G, Xiaomi) y `docs/research/VIGIA_NOVEDADES.md`.

## En esta PR (pendiente de fusionar)
- `/senda/ruta` + `route-planner.mjs`: rutas moldeables sobre OSM de l'Horta Sud, agua Copernicus, cámaras DGT, Google Maps/Waze.
- Aviso por voz: `voice-report.mjs` + `SendaNative.listen()` (SpeechRecognizer, prefiere sin red) + `<queries>` en el manifiesto.

## Siguiente (todo, sin preguntar el orden)
1. QR para pasar el código de acceso (mostrar y leer).
2. Red social: perfiles, contactos y chat de grupo sobre `familiar-chat.mjs`.
3. Rehacer el interior de las páginas al estilo de la portada (empezar por index/SOS, avisos, sala).
4. Ruta: más zonas (paquete de calles por zona), sentido único y velocidades si hay datos con fuente.
5. Agente de I+D: tarea programada que revise el Vigía (pedir confirmación de coste/frecuencia solo si genera gasto).
6. Fase 3: pruebas guiadas de campo con JSON firmado.

## Bloqueos
- Sin SDK de Android aquí: lo nativo solo se compila en CI.
- Clave de publicación real (secreto) cuando se vaya a tiendas u organismos.
- Waze for Cities exige un organismo socio.

## Pendiente del fundador
- Nombre o enlace del «walkie 4G sin datos».
- Probar en los dos móviles: Ajustes → administrador → código → hermano; Ruta y aviso por voz.
