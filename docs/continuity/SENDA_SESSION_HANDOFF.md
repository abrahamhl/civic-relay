# SENDA · handoff (2026-11-25 16:20Z, sesión app)

## Publicado (master 74f3004, APK fija `senda-android-latest` 14:14Z, play sha 3578398c…)
- **Arreglos raíz de la app Android**: `NetAllow.java` (antes 404 a toda red → sin mapa/rutas/búsqueda) y
  tipos `.wasm/.tflite` en `OfflineAssets` (antes la IA de la cámara no cargaba). Pruebas JVM en CI.
- Conducir: modos 🚗/🚲/🚶, capas tipo apps de mapas (10 tipos: Mapa, Claro, Noche, Satélite oficial PNOA+PDOK,
  Relieve, Topográfico, Satélite del día NASA, Térmico y Nubes con paleta oficial NASA en °C, Luces), blanco y
  negro, 3D con relieve real, punto azul con precisión, «atrás» cierra paneles, «ⓘ» en cada sección,
  radar de señales tipo videojuego (Wi-Fi leído al final del barrido, antigüedad medida), caja negra, probabilidad
  bayesiana de avisos (`hazard-belief`).
- Portada: 53 vistas previas reales (`investor-next/scripts/module-previews.mjs`) y destacados.
- **Incendio 4D** `/senda/incendio4d`: San Martín 23-07-2026 sobre relieve 3D (REAL: EFFIS, Sentinel-2 ×4,
  dNBR, ignición M-501 km 57; MODELO: frente, humo Briggs, viento GFS; ESCENARIO: elipse Alexander). `fire4d.mjs`.

## Pendiente del fundador
1. Probar la APK de hoy (mapa, cámara, radar, capas, Incendio 4D) y pasar caja negra (.json/.jsonl + vídeo).
2. Decidir buzón de Internet NL→ES (A Vercel / B servidor propio / C ninguno) y solicitar DGT 3.0 (`docs/fundador/`).
3. Nombre de la startup de mapas que vio (para comparar con precisión).

## Siguiente (sin preguntar el orden)
1. **DANA 4D**: EMSR773 (data/dana2024) + flujo del agua sobre DEM (D8) + dibujo; mismo motor que Incendio 4D.
2. EOX Sentinel-2: verificar que `s2cloudless_3857` es 2016 (CC BY 4.0) antes de usarlo.
3. NDW en vivo (play), RSSI por paquete BLE, firma Ed25519 de avisos.
4. Calibrar con la caja negra real (EM de s/c, SPRT, cadencia por batería: `docs/research/PROPUESTAS_MATEMATICAS_2026-11-24.md`).

## Reglas aprendidas
- Probar SIEMPRE con las reglas de red de la app (NetAllow) y no solo en navegador: así se escapó el mapa.
- `bbLog`/`let` en módulos: no llamar antes de declarar (TDZ). Validar YAML antes de subir.
- Licencias de capas: verificar antes de integrar (EOX quedó fuera por eso).
