# SENDA · handoff (2026-11-23, sesión app)

## Hecho
- Fase 0: workflow `.github/workflows/senda-android-release.yml` → Release fija `senda-android-latest` (PR #69). APK base 12,8 MB y play 16,6 MB con SHA256SUMS; comprobado.
- Firma de pruebas de campo fija: `apps/senda-android/senda-test.keystore` (no secreta, no vale para tiendas).
- Página `/senda/descargas` (`investor-next/public/senda/descargas.html` + rewrite en `vercel.json`).
- command-center: instantánea de `estado.json` regenerada (master estaba en rojo).
- `packages/senda/src/external-links.mjs`: V16 conectada, walkie 4G, híbrido y Xiaomi Offline, sin cifras inventadas; `survivesCellBlackout()`.
- `docs/research/VIGIA_NOVEDADES.md` creado.

## En curso
- Nada abierto de la Fase 0. `/senda/descargas` verificada en producción (200, 13:34Z).

## Siguiente
1. Fase 1: credencial de rol ECDSA P-256 (envelope.mjs), QR, caducidad/revocación, pruebas (sin firma/caducada → CIUDADANO).
2. Fase 3: pruebas guiadas de campo (BLE 5/10/20/40 m, sonido 1/3/5 m, …) con JSON firmado.
3. Comprobar si DGT publica las V16 en NAP/DATEX II (API para terceros: no documentada).

## Bloqueos / pendientes
- Clave de publicación real (secreto) cuando se vaya a tiendas u organismos.
- No hay SDK de Android en el contenedor: el APK solo se prueba en CI.

## Decisiones del fundador pendientes
- Nombre o enlace del «walkie 4G chino sin datos» (no encontrado).
- Repositorio público: el APK es descargable por cualquiera con el enlace.
