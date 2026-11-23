# SENDA · hoja de ruta de la app (fase privada: fundador = ADMIN, hermano = OBSERVADOR_TOTAL)

Prompt de trabajo: `docs/prompts/SONNET_SENDA_APP_2026-11-23.md`. Marcar `[x]` solo con PR fusionada y verificada (poner su enlace).

## 0 · Entrega sin ordenador
- [x] Workflow: en cada fusión a master, APK (base y play) en la Release fija `senda-android-latest`, con su SHA-256 (PR #69; Release verificada)
- [x] (PR #69, verificada en producción 2026-11-23 13:34Z) Página `/senda/descargas` con el enlace y las instrucciones de instalación desde el móvil

## 1 · Roles sin servidor
- [x] Credencial de rol firmada por la clave del ADMIN (ECDSA P-256), con caducidad y revocación — núcleo `packages/senda/src/app-roles.mjs` con 11 pruebas (PR de esta sesión; falta la pantalla)
- [ ] Emparejamiento por QR entre los dos móviles (hoy: código de texto que se comparte por el chat del móvil y se pega en Ajustes; falta el QR)
- [x] Pruebas: sin firma o caducada → CIUDADANO; el OBSERVADOR no edita (11/11, también revocada, manipulada, ancla ajena y reloj retrocedido)

## 2 · La web dentro de la app
- [ ] Radar, sala, simulador, ciclo, viaje y cámaras dentro de la app; sin red con instantáneas, y en vivo cuando hay red
- [ ] Menú según el rol — portada `/senda/app` con 49 módulos por secciones y candado por rol, Ajustes con dar/revocar acceso por código (PR de esta sesión; falta probar en los dos móviles)

## 2b · Ruta y avisos estilo Waze (petición del fundador, 2026-11-23)
- [ ] `/senda/ruta`: calles reales (OSM), puntos de paso, zonas dibujadas a evitar, agua observada, coche/bici/a pie, 3 alternativas, cámaras DGT cercanas, abrir en Google Maps (con paradas) o Waze (solo destino) — PR de esta sesión
- [ ] Aviso por voz sin red (reconocedor de Android + reglas `voice-report.mjs`), con confirmación — PR de esta sesión; probar en el móvil
- [ ] Más zonas además de l'Horta Sud (paquetes de calles por zona)
- [ ] Tiempo de viaje y sentido único (requieren datos con velocidades y `oneway`; hoy «no disponible»)
- [ ] Convenio con un organismo para Waze for Cities (no hay API pública)

## 3 · Validación física real (prioridad)
- [ ] Pruebas guiadas en la app: baliza BLE, sonido, pasarela de un desconocido, DTN/.senda, arranque en coche, barrido Wi-Fi
- [ ] Resultado en JSON firmado → `evidence/field/AAAA-MM-DD/` → validador
- [ ] Sustituir los EJEMPLO_DECLARADO por medidas (con n e intervalos) cuando haya muestras suficientes

## 4 · Escritorio para organismos (`apps/command-center`, Tauri)
- [ ] Sala, radar, cámaras, roles, auditoría encadenada, CAP, modo sin red
- [ ] Instaladores de Windows y Linux en una Release

## 5 · IA
- [ ] En el dispositivo y sin red: transcripción, resumen y clasificación (licencias verificadas)
- [ ] Asistente Claude para ADMIN y OBSERVADOR mediante proxy con la clave en el servidor y límite de gasto

## 6 · OSINT y cámaras
- [ ] Catálogo completo para ADMIN y OBSERVADOR; solo lo público para el ciudadano; registro de accesos; sin reconocimiento facial ni de matrículas

## 7 · Vigía de novedades
- [ ] `docs/research/VIGIA_NOVEDADES.md` creado el 2026-11-23 (V16, walkie 4G, Xiaomi); revisión en cada sesión
