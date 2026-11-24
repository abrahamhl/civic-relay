# SENDA · handoff (2026-11-24 18:08Z, sesión Antigravity)

## Publicado hoy (master e9f3a69, PRs #80/#81/#82 fusionadas, APK en la Release fija `senda-android-latest`)
- App: portada estilo Apple `/senda/app` con roles (ADMIN/OBSERVADOR/CIUDADANO, credencial ECDSA, QR), marco común en 50 páginas, icono, un solo icono (Drive como módulo).
- Mensajería: chat estilo WhatsApp (✓ en camino / ✓✓ entregado con recibo verificado), buzón Bluetooth GATT móvil a móvil (`BleMailbox`, `MailboxFrames`), invitar contacto por SMS (selector del sistema).
- Ruta (`/senda/ruta`, OSM l'Horta Sud), aviso por voz sin red, verificación de avisos con cámara (MediaPipe + EfficientDet-Lite0, imagen nunca sale).
- **Conducir** (`/senda/conducir`): mapa estilo navegador (MapLibre + OpenFreeMap), búsqueda Nominatim, ruta giro a giro OSRM (FOSSGIS, pruebas), avisos con color/icono propios, incidencias y cámaras DGT (en vivo en play), cámara con IA, **dashcam** 720p/1080p con datos en el vídeo y guardado real en Descargas/SENDA (`FileSaver`), más caja negra JSONL (`blackbox.mjs`), panel `#tele`, `#markBtn`, `ScreenRecordService` y `radioCaps()` (PR #82).
- Enlaces externos (Waze/Maps/SMS/tel) por lista cerrada `ExternalLinks`.
- 24-11 (PR #80): avisos entre móviles por Bluetooth (`hazard-share.mjs`, paquete 0xA5, sin firma → «sin verificar»); texto falso corregido; barrido de secretos limpio (solo el keystore de prueba, público a propósito).

## En rama borrador `antigravity/conducir-calibracion-20261124` (fusionada limpiamente con último `origin/master` `e9f3a69`, NO fusionada a `master`)
- **Consola `⚡ Lab Campo · Ciberseguridad & Física` + Escucha Activa (`drive-field-lab.mjs`, 188 módulos civiles sincronizados)**:
  - Batería de **1 toque** (`runFieldLabBattery`) que ejecuta e interpreta los **8 motores activos simultáneamente** (EKF+NAP, DENM 36 B CRC-16 + tamper 1-bit, BLE/Two-Ray/Doppler, Cañón Urbano/Fresnel/Rician K/OLS/CRLB, Corredor LWR/RSS, Visión AR-HUD/Horizonte, Firme IMU IRI y Auditoría Ciber/RGPD).
  - **Escucha activa** con mapeo continuo en rejilla de **25 m × 25 m** (`createSurfaceMapper`) + parser anonimizado de `WifiSurveyRecorder` JSONL (**0 MACs/SSIDs almacenados**) y exportación en 1 toque de **GeoJSON** + informe **SHA-256**.
- **4 módulos científico-matemáticos integrados**: `cits-denm.mjs` (ETSI EN 302 637-3 36 B CRC-16), `drive-kalman-fusion.mjs` (EKF 6E forma Joseph + puerta $\chi^2$ + *dead-reckoning* + Huber `horizonY`), `traffic-shockwave.mjs` (LWR PDE Rankine–Hugoniot + cola móvil en `#corridorAlert`), `hydro-surge-nl.mjs` (Manning + Martínez-Gomariz/Shand + EurOtop + NAP NL).
- **Países Bajos con datos oficiales (`ndw-nl.mjs`, 769 NDW CC0 + 844 cámaras NL + OM `meetcorrectie`, total 1 970 cámaras ES+NL)** + **AR-HUD 3D + BEV (`drive-ar-hud.mjs`)** + **Caja Negra unificada (SHA-256 v2 + JSONL + MediaProjection)**.
- Batería completa en verde: `packages/senda` **1 024/1 024**, `investor-next` **157/157**, `prove.mjs` **19/19**, `claims-lint` **PASS**, Android JVM **119/119**, Chromium Pixel 7 vertical/horizontal & Real-Video **100 % PASS** (Field Lab v4 + Science v3 + Full v2 9/9 + NL/AR-HUD 5/5).
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
