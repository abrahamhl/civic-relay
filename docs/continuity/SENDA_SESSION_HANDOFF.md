# SENDA · handoff (2026-11-24 15:55Z, sesión Antigravity)

## Publicado hoy (master c3706a5, APK en la Release fija `senda-android-latest`)
- App: portada estilo Apple `/senda/app` con roles (ADMIN/OBSERVADOR/CIUDADANO, credencial ECDSA, QR), marco común en 50 páginas, icono, un solo icono (Drive como módulo).
- Mensajería: chat estilo WhatsApp (✓ en camino / ✓✓ entregado con recibo verificado), buzón Bluetooth GATT móvil a móvil (`BleMailbox`, `MailboxFrames`), invitar contacto por SMS (selector del sistema).
- Ruta (`/senda/ruta`, OSM l'Horta Sud), aviso por voz sin red, verificación de avisos con cámara (MediaPipe + EfficientDet-Lite0, imagen nunca sale).
- **Conducir** (`/senda/conducir`): mapa estilo navegador (MapLibre + OpenFreeMap), búsqueda Nominatim, ruta giro a giro OSRM (FOSSGIS, pruebas), avisos con color/icono propios, incidencias y cámaras DGT (en vivo en play), cámara con IA, **dashcam** 720p/1080p con datos en el vídeo y guardado real en Descargas/SENDA (`FileSaver`).
- Enlaces externos (Waze/Maps/SMS/tel) por lista cerrada `ExternalLinks`.
- 24-11 (PR #80): avisos entre móviles por Bluetooth (`hazard-share.mjs`, paquete 0xA5, sin firma → «sin verificar»); texto falso corregido; barrido de secretos limpio (solo el keystore de prueba, público a propósito).

## En rama borrador `antigravity/conducir-calibracion-20261124` (commit `e3c3628`, NO fusionada)
- `drive-hazard.mjs`: looming isotrópico con guarda de recorte en bordes, pendiente robusta Theil–Sen, confirmación en 2 fotogramas, continuidad `car/bus/truck` y predicción de movimiento para incorporaciones rápidas a 4 Hz. Medido sobre vídeo real Udacity MIT (145 fotogramas a 4 Hz con EfficientDet-Lite0 int8): falsas alarmas AMBAR **6 → 0**, fragmentos de pista **10 → 3**; en simulación cinemática a 4 Hz (`SIMULATION`), incorporación `0,30/s` pasa de no detectada a 0,75 s (ROJO sin retraso adicional: 1,75 s).
- `drive-corridor.mjs` + `/senda/conducir` (`#corridorAlert`): avisos por delante en ruta OSRM o cono frontal ±35° con distancia de parada AASHTO y deduplicación de 120 m (106 duplicados colapsados sobre 838 incidencias reales DGT DATEX II); operativo también en radar sin red (APK base) y con avisos Bluetooth («sin verificar»).
- Batería completa en verde: `packages/senda` 985/985, `investor-next` 157/157, `senda-offline-e2e` 49/49, `prove.mjs` 19/19, Android JVM 119/119, Chromium Pixel 7 6/6 (`evidence/drive-calibration/`).
- Nota sobre bundles previos: `antigravity-20261123.bundle` y `senda-waves1-23-validated.bundle` residen únicamente en la VM aislada de la conversación anterior (`df55d99d-2467-4e6f-bb67-798b822dd8e8`) y no estaban disponibles en esta sesión.

## Pendiente del fundador (decisiones)
1. Buzón de Internet para Holanda → España: A Vercel (verificar plan gratuito) / B servidor propio / C ninguno.
2. Agente de I+D semanal (consume créditos del plan): sí/no.
3. Resultados del viaje de vuelta: capturas, avisos falsos, batería, temperatura.
4. Revisar la PR borrador de `antigravity/conducir-calibracion-20261124` (y si quiere rescatar `antigravity-20261123.bundle` / `senda-waves1-23-validated.bundle`, subirlos desde la conversación `df55d99d-…`).

## Siguiente (sin preguntar el orden)
1. Calibrar con los vídeos reales del fundador (noche, lluvia, urbano) los umbrales ámbar/lateral (`drive-hazard.mjs`) y el corredor (`drive-corridor.mjs`).
2. Grupos en el chat; notas de voz.
3. Volver a renderizar la película (rótulo de b4 corregido en el guion).
4. Fase 3: pruebas guiadas de campo con JSON firmado (BLE a 1/5/10/20/40 m).
5. Firmar los paquetes de avisos (Ed25519 de avisos.html) para pasar de «sin verificar» a «firmado».

## Reglas aprendidas hoy
- Validar YAML antes de subir (un «: » sin comillas tumbó el flujo Android).
- Las tareas programadas consumen créditos: no crear sin permiso.
- El visor web de Android ignora descargas blob y enlaces externos: usar el puente (`FileSaver`, `ExternalLinks`).
- Las conversaciones de Antigravity no comparten disco entre VMs: subir siempre a rama GitHub antes de cerrar sesión.
