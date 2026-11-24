# SENDA · handoff (2026-11-24 13:45Z, sesión app)

## Publicado hoy (master e3789f0, APK en la Release fija `senda-android-latest`)
- App: portada estilo Apple `/senda/app` con roles (ADMIN/OBSERVADOR/CIUDADANO, credencial ECDSA, QR), marco común en 50 páginas, icono, un solo icono (Drive como módulo).
- Mensajería: chat estilo WhatsApp (✓ en camino / ✓✓ entregado con recibo verificado), buzón Bluetooth GATT móvil a móvil (`BleMailbox`, `MailboxFrames`), invitar contacto por SMS (selector del sistema).
- Ruta (`/senda/ruta`, OSM l'Horta Sud), aviso por voz sin red, verificación de avisos con cámara (MediaPipe + EfficientDet-Lite0, imagen nunca sale).
- **Conducir** (`/senda/conducir`): mapa estilo navegador (MapLibre + OpenFreeMap), búsqueda Nominatim, ruta giro a giro OSRM (FOSSGIS, pruebas), avisos con color/icono propios, incidencias y cámaras DGT (en vivo en play), cámara con IA, **dashcam** 720p/1080p con datos en el vídeo y guardado real en Descargas/SENDA (`FileSaver`).
- Enlaces externos (Waze/Maps/SMS/tel) por lista cerrada `ExternalLinks`.
- 24-11 (PR #80): avisos entre móviles por Bluetooth (`hazard-share.mjs`, paquete 0xA5, sin firma → «sin verificar»); texto falso corregido; barrido de secretos limpio (solo el keystore de prueba, público a propósito).

## Pendiente del fundador (decisiones)
1. Buzón de Internet para Holanda → España: A Vercel (verificar plan gratuito) / B servidor propio / C ninguno.
2. Agente de I+D semanal (consume créditos del plan): sí/no.
3. Resultados del viaje de vuelta: capturas, avisos falsos, batería, temperatura.

## Siguiente (sin preguntar el orden)
1. Calibrar con los vídeos del fundador los umbrales ámbar/lateral (`drive-hazard.mjs`).
2. Grupos en el chat; notas de voz.
3. Volver a renderizar la película (rótulo de b4 corregido en el guion).
4. Fase 3: pruebas guiadas de campo con JSON firmado (BLE a 1/5/10/20/40 m).
5. Antigravity: sin matemáticas en GitHub; prompt de entrega (rama o bundle/zip) en `PROMPT_ANTIGRAVITY_MATEMATICAS.md`.
6. Firmar los paquetes de avisos (Ed25519 de avisos.html) para pasar de «sin verificar» a «firmado».

## Reglas aprendidas hoy
- Validar YAML antes de subir (un «: » sin comillas tumbó el flujo Android).
- Las tareas programadas consumen créditos: no crear sin permiso.
- El visor web de Android ignora descargas blob y enlaces externos: usar el puente (`FileSaver`, `ExternalLinks`).
