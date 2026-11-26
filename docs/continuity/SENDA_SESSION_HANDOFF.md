# SENDA · handoff (2026-11-26 13:15Z, commit `741166b` · cierre F8 / H0 y coordinación hardware H1–H2)

## Estado verificado en `master` (`fe696c6` / `0faf51e`)
- **Integración F1–F7 en producción y APK (`0faf51e`, PR #110 y #111)**:
  - CI de GitHub en verde (21/21 jobs), producción verificada (`/senda/personas` con «Práctica de campo», `img-src https:` con cámaras públicas DGT visibles, `/senda/estado` en verde) y APK publicada con `mmwave-field.mjs`, `save-file.mjs` y `personas.html` (SHA-256 `0718c681…3de67`).
  - Correcciones de revisión consolidadas: pruebas con `ajv` aisladas en `packages/senda/tests/contracts/`, `.gitleaks.toml` por valor exacto (no por ruta), geometrías supuestas del barranco de Chiva en F4 rotuladas `ESCENARIO`.

## Cierre de F8 / Bloque H0 (`741166b` · `pnpm verify` único + `prove.mjs` 21/21)
- **Comando único reproducible `pnpm verify` (`scripts/verify.mjs`)**: ejecuta y verifica en serie 9 puertas sin ensuciar el árbol git:
  1. Guardia estática de **cero dependencias npm** en `packages/senda/src`, `packages/senda/tests/*.test.mjs`, `packages/senda/tests/defense/*.test.mjs`, `scripts/film-claims.mjs` y `scripts/prove.mjs`.
  2. Suite del núcleo sin dependencias (`NODE_PATH=""`, civil + defensa: 1 210 pruebas).
  3. Contratos y compilación de los 5 esquemas JSON Draft 2020-12 (`packages/senda/schemas/validate.mjs` + `tests/contracts/`).
  4. Suites web (`investor-next/tests`) y relé (`packages/senda-relay/tests`).
  5. Suite de escritorio (`@senda/command-center`).
  6. Comprobación estática de tipos (`pnpm type-check` incluido `@ts-check` JSDoc en `packages/senda/src` + `tsc` de `investor-next` si `node_modules` está instalado).
  7. Prueba pública `node scripts/prove.mjs` ampliada a **21/21 afirmaciones** (`mmwave-rd03d-field` sobre protocolo RD-03D/LD2450 de 30 B, cruce Kalman y paquete SHA-256; `dana-f4-crossval` sobre validación cruzada espacial 4-fold y etiqueta `ESCENARIO`).
  8. Escaneo de secretos `gitleaks` con `.gitleaks.toml` sobre el árbol completo no ignorado.
  9. Puerta de publicación de Vercel (`investor-next/scripts/write-release-proof.mjs` + `write-senda-status.mjs`).
- **Alineación en disco de F4 (`evidence/quality/dana-f4-crossval.json`)**: regenerado con `node packages/senda/scripts/dana-f4-crossval.mjs` (SHA-256 `256654df829096103ac581b0caba4fee6a54f21f82564b72d3f03f9fa3564025`) para que el JSON persistido refleje `celerityPhysics.basis: "ESCENARIO"` igual que el script y `DOSSIER_VALIDACION.md`.

## Reparto activo entre agentes (bloques H1 y H2)
1. **Antigravity (ramas propias desde `master`, 1 PR en borrador por bloque, sin tocar páginas de `investor-next`)**:
   - **H1 · SENDA Radar v1** (`hardware/modules/senda-radar/`): electrónica verificada hoja de datos en mano (Ai-Thinker RD-03D / HLK-LD2450 a 5 V + Seeed XIAO ESP32-S3 + OLED SSD1306 I2C + LiPo 1S protegida + elevador 5 V fijo + interruptor), esquema SVG/KiCad pin a pin, firmware puente USB-CDC transparente + pantalla PPI probado en host (`g++`) y compilado en CI (`arduino-cli`), CAD OpenSCAD paramétrico con ventana de radomo sin metal + STL por pieza + GLB `< 2 MB`, renders 4D 1080p rotulados «render», `BOM.csv` con enlaces y precios fechados, guía de montaje y prueba de humo con `mmwave-field-report.mjs`.
   - **H2 · Familia de módulos SENDA y negocio**: fichas técnicas, CAD/GLB y renders 4D de la familia (Radar 24 GHz, Nodo malla LoRa EU868, Baliza rescate BLE, Estación hidrometeo/humo con descartes razonados), catálogo y plan legal UE (CE RED 2014/53/UE, RoHS, RAEE) en `docs/negocio/MODULOS_SENDA.md` y contrato `docs/negocio/modulos.json`.
2. **Claude Code**:
   - Integra `docs/negocio/modulos.json`, los `.glb` y los renders 4D en `investor-next` y el escritorio PRO.
   - Revisa protocolo, veracidad, licencias, CSP y CI antes de fusionar cada PR.
   - Analiza las sesiones físicas `senda-campo-*.json` grabadas por el fundador antes de publicar cualquier cifra de precisión del radar.

## Pendiente del fundador (físico / externo)
1. Imprimir las piezas STL, montar el prototipo SENDA Radar v1 y grabar sesiones reales con `/senda/personas` → «Práctica de campo» (`senda-campo-*.json`).
2. Probar la APK en carretera con caja negra y decidir buzón NL→ES / solicitud DGT 3.0 (`docs/fundador/`).
3. Antes de comercializar cualquier módulo con radio en la UE: ensayos en laboratorio acreditado (RED 2014/53/UE + EMC + seguridad), declaración UE de conformidad, alta RAEE y registro Bluetooth SIG (nunca usar Company ID de prueba `0xFFFF` en producto comercial).

## Lecciones obligatorias vigentes
- Abrir cada PR directamente contra `master` (nunca apiladas) y esperar a que el CI de GitHub quede 100 % en verde en la PR.
- `packages/senda/tests/*.test.mjs` y `scripts/film-claims.mjs` no pueden importar ningún paquete npm; todo lo que use `ajv` u otros paquetes vive en `packages/senda/tests/contracts/`.
- Antes de modificar `vercel.json` o cabeceras CSP: verificar las 61 páginas en Chromium con las cabeceras reales (0 bloqueos nuevos).
- Ninguna cifra sin origen verificable (`medido`, `calculado por <código>`, `fuente <enlace + fecha>`); supuestos sin fuente primaria se rotulan `ESCENARIO` o `no verificado`.
