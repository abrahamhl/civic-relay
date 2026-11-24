# SENDA · handoff (2026-11-24 17:45Z, sesión Antigravity)

## Publicado hoy (master e9f3a69, PRs #80/#81/#82 fusionadas, APK en la Release fija `senda-android-latest`)
- App: portada estilo Apple `/senda/app` con roles (ADMIN/OBSERVADOR/CIUDADANO, credencial ECDSA, QR), marco común en 50 páginas, icono, un solo icono (Drive como módulo).
- Mensajería: chat estilo WhatsApp (✓ en camino / ✓✓ entregado con recibo verificado), buzón Bluetooth GATT móvil a móvil (`BleMailbox`, `MailboxFrames`), invitar contacto por SMS (selector del sistema).
- Ruta (`/senda/ruta`, OSM l'Horta Sud), aviso por voz sin red, verificación de avisos con cámara (MediaPipe + EfficientDet-Lite0, imagen nunca sale).
- **Conducir** (`/senda/conducir`): mapa estilo navegador (MapLibre + OpenFreeMap), búsqueda Nominatim, ruta giro a giro OSRM (FOSSGIS, pruebas), avisos con color/icono propios, incidencias y cámaras DGT (en vivo en play), cámara con IA, **dashcam** 720p/1080p con datos en el vídeo y guardado real en Descargas/SENDA (`FileSaver`), más caja negra JSONL (`blackbox.mjs`), panel `#tele`, `#markBtn`, `ScreenRecordService` y `radioCaps()` (PR #82).
- Enlaces externos (Waze/Maps/SMS/tel) por lista cerrada `ExternalLinks`.
- 24-11 (PR #80): avisos entre móviles por Bluetooth (`hazard-share.mjs`, paquete 0xA5, sin firma → «sin verificar»); texto falso corregido; barrido de secretos limpio (solo el keystore de prueba, público a propósito).

## En rama borrador `antigravity/conducir-calibracion-20261124` (fusionada limpiamente con último `origin/master` `e9f3a69`, NO fusionada a `master`)
- **4 nuevos módulos científico-matemáticos puros e integrados (187 módulos civiles sincronizados)**:
  - **`cits-denm.mjs`** (ETSI EN 302 637-3 V1.3.1 C-ITS DENM): conversión canónica SENDA ↔ DENM + **codec binario compacto 36 B con CRC-16-CCITT** (`0xD3`) integrado en vivo en `window.sendaP2P` y `exportDenm()`.
  - **`drive-kalman-fusion.mjs`**: **EKF GNSS+IMU de 6 estados** (forma de Joseph, puerta $\chi^2$ 2D antimultipath con re-anclaje seguro, *dead-reckoning* transparente en túnel) + **auto-calibrador online Huber de horizonte (`horizonY`)** conectado al AR-HUD 3D y al panel `#tele`.
  - **`traffic-shockwave.mjs`**: **EDP hiperbólica LWR** (ondas de choque Rankine–Hugoniot, cola móvil en `#corridorAlert` como `cola LWR ~… (modelo)` y física de relé BLE en calzada contraria, ampliando PR #49/#51).
  - **`hydro-surge-nl.mjs`**: hidráulica de Manning, estabilidad vehicular en riadas Martínez-Gomariz/Shand, rebase de oleaje **EurOtop (2018)** y resguardo altimétrico frente a **NAP** en pólderes neerlandeses.
- **Países Bajos precisión centimétrica (`ndw-nl.mjs`, `nl_ndw_incidencias.json`, `nl_radares_oficiales.json`)**: auto-detección ES/NL por GPS, analizador NDW DATEX II v3 CC0 + **769 incidencias reales de hoy** (319 SRTI ~11 cm + rumbo `<loc:bearing>`, 200 puentes levadizos *brugopeningen*, 250 cortes *afsluitingen*), **844 cámaras NL** (CC BY 4.0: 288 fijas + 501 *roodlicht* + 55 *trajectcontrole*, total **1 970 ES+NL**), regla oficial **OM `meetcorrectie`** y ventana 06–19 h.
- **Nuevo AR-HUD 3D + BEV (`drive-ar-hud.mjs`)** en cámara y dashcam de `/senda/conducir`: identificación ampliada (`includeInfra: true`, semáforos, STOP, trenes, vehículos, VRU, animales), proyección monocular 3D (`Z`, `THW`), alfombra 3D curvada por guiñada coloreada por RSS, clasificadores cromáticos reales `ImageData` de semáforos y luces de freno, panel cenital **BEV 3D** en tiempo real y horizonte artificial IMU calibrado.
- **Caja Negra unificada (SHA-256 v2 + JSONL + pantalla Android MediaProjection)** + selector `IA: Auto / 4 Hz fija / 2 Hz`, `drive-hazard.mjs` calibrado, `drive-corridor.mjs`, `drive-physics-v2.mjs`, `ble-link-probe.mjs`, `pmtiles-reader.mjs`, `osint-feeds.mjs`, `blackbox-sweep.mjs` y dossiers `FRONTERA_FISICA_TELECOM_OSINT_2026-11.md` + `ARQUITECTURA_NL_Y_HUD_VISION_2026-11.md`.
- Batería completa en verde: `packages/senda` **1 020/1 020**, `investor-next` **157/157**, `prove.mjs` **19/19**, `claims-lint` **PASS**, Android JVM **119/119**, Chromium Pixel 7 & Dashcam Real-Video **PASS** (Full v2 9/9 + NL/AR-HUD 5/5 + Unified Science v3 PASS con 0 errores JS y 0 solapamientos).
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
