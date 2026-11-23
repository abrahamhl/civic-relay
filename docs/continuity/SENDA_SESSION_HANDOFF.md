# SENDA · handoff (2026-11-23, sesión app)

## Hecho y fusionado
- Fase 0: APK en la Release fija `senda-android-latest` (workflow), `/senda/descargas` verificada.
- Fase 1 núcleo: `app-roles.mjs` (ADMIN por clave no exportable, OBSERVADOR_TOTAL por credencial, CIUDADANO) — PR #71.
- Portada `/senda/app` estilo Apple (Inicio, Módulos por rol, Mensajes, Ajustes con dar/revocar acceso por código) — PR #71.
- Marco común `app-chrome.mjs` en las 50 páginas (solo dentro de la app). Icono adaptativo. Márgenes Android 15. SENDA Drive como módulo (un solo icono) — PR #71.
- `external-links.mjs` (V16, walkie 4G, Xiaomi) y `docs/research/VIGIA_NOVEDADES.md`.

## Fusionado después (PR #72, #73)
- Ruta, voz y QR (#72). Buzón Bluetooth cercano GATT + MailboxFrames (#73). OJO: validar YAML antes de subir (un «: » sin comillas tumbó el flujo de Android).

## Fusionado (#74, #75) y en PR #76
- Chat estilo WhatsApp (#74). Verificación de avisos con cámara: MediaPipe + EfficientDet-Lite0 int8 en `senda/vendor/` (#75; licencias en LICENSES.md). #76: ✓/✓✓ con recibo verificado y rótulo de la película corregido.
- OJO: las tareas programadas consumen créditos de pago del plan (el sistema apagó la anterior): no crear sin permiso del fundador.

## Antes (ya fusionado)
- `/senda/ruta` + `route-planner.mjs`: rutas moldeables sobre OSM de l'Horta Sud, agua Copernicus, cámaras DGT, Google Maps/Waze.
- Aviso por voz: `voice-report.mjs` + `SendaNative.listen()` (SpeechRecognizer, prefiere sin red) + `<queries>` en el manifiesto.

## Siguiente (todo, sin preguntar el orden)
1. Volver a renderizar la película (escena b4) con el rótulo corregido.
2. Chat: recibos de entrega/lectura visibles, chats de grupo, notas de voz (Codec2/Opus de `familiar-chat.mjs`).
2b. Relé de Internet para Holanda → España: pendiente de que el fundador elija alojamiento.
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
