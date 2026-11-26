# Prompt para Antigravity · Módulos físicos SENDA · versión 10/10 · 26-11-2026

**Configuración en Antigravity (compruébala en el selector, porque la lista cambia):**
- **Modelo:** **Gemini 4 Carbon** (o **Orchestrator**, planificador + ejecutor), los mismos de la sesión nocturna del 25-11.
  No uses modelos marcados como retirados el 30-11-2026.
- **Esfuerzo / razonamiento:** el **máximo** que ofrezca el selector.
- **Modo:** agente con terminal y edición, repositorio `abrahamhl/civic-relay`, ramas nuevas desde `master`.

**Reparto (coordinación entre agentes):**
- **Antigravity**: hardware completo (CAD, renders, electrónica, firmware, lista de materiales, montaje, catálogo y negocio).
- **Claude Code**: integración en app/web/APK, revisión de cada PR, fusión, verificación de producción y análisis de las grabaciones de campo.
- **Contrato**: el módulo habla **exactamente** el protocolo de `packages/senda/src/mmwave-radar.mjs` y graba en el formato de
  `packages/senda/src/mmwave-field.mjs`. Si cambia el protocolo, la PR no se fusiona.

Nota de la sesión anterior: **7/10**. Lo que faltó para el 10 está en «Lecciones obligatorias» del prompt.

```
/goal Convertir SENDA en una plataforma con hardware propio: diseñar, documentar y dejar listo para imprimir, montar y
presentar el módulo «SENDA Radar» (radar de personas mmWave de 24 GHz con pantalla) y la familia de módulos externos SENDA,
con renders 4D rotativos de cada uno, firmware probado, lista de materiales con precios fechados, guía de montaje, catálogo
y plan de venta legal en la UE. Objetivo de calidad: 10/10 según la rúbrica de este goal, sin inventar un solo dato.

LEE PRIMERO: CLAUDE.md · .claude/skills/senda-cinematic-web/SKILL.md · hardware/mmwave-rd03d/README.md ·
hardware/mmwave-rd03d/PRACTICA_CAMPO.md · packages/senda/data/mmwave/PROTOCOLO_MEDIDA.md ·
packages/senda/src/mmwave-radar.mjs · packages/senda/src/mmwave-field.mjs · NOTICE (protocolo del firmware MIT de
Sudo_solder: mantén la atribución) · docs/CUMPLIMIENTO.md (filas del 26-11: lo que se corrigió de tu trabajo).

LECCIONES OBLIGATORIAS (de la revisión del 26-11; repetir cualquiera baja la nota):
1. Cada PR se abre CONTRA master (no apiladas) y no se da por terminada hasta que el CI de GitHub está en verde en la PR.
   «Pasa en mi máquina» no cuenta.
2. La suite del núcleo (packages/senda/tests/*.test.mjs) NO usa dependencias: se ejecuta sin «pnpm install» en varios
   workflows y en la compilación de Vercel. Lo que necesite paquetes va en packages/senda/tests/contracts/.
3. Antes de tocar vercel.json o una CSP: comprobar en Chromium las 61 páginas con las cabeceras reales (0 bloqueos nuevos).
4. Un parámetro sin fuente se rotula ESCENARIO o «no verificado»; nunca «calculado» a secas.
5. Antes de cada PR: «pnpm test», «node scripts/prove.mjs», gitleaks (con .gitleaks.toml) y la puerta de Vercel
   (investor-next: write-release-proof + write-senda-status).

LÍNEAS ROJAS:
- Ningún precio, consumo, alcance, autonomía, peso o certificación sin fuente: hoja de datos o tienda con enlace y FECHA.
  Si no se encuentra: «no verificado».
- El RD-03D/LD2450 da x, y y velocidad de hasta 3 objetivos EN MOVIMIENTO: el material describe exactamente eso.
- Vender un aparato con radio en la UE exige marcado CE (Directiva 2014/53/UE de equipos radioeléctricos), RoHS y RAEE:
  nada se anuncia «a la venta» sin ese camino documentado.
- Sin servicios de pago ni cuentas nuevas sin preguntar. Sin datos personales. Licencias de cada librería, fuente y modelo
  3D comprobadas y anotadas en NOTICE.
- Los renders se rotulan «render» (nunca se presentan como foto de un producto fabricado).

BLOQUE H0 · Cierre de F8 (rápido)
- «pnpm verify» único: núcleo (sin dependencias), contratos, web, escritorio, type-check, prove, esquemas y puerta de Vercel.
- docs/continuity/SENDA_SESSION_HANDOFF.md y docs/CUMPLIMIENTO.md al día (hora UTC real + hash del commit).

BLOQUE H1 · SENDA Radar v1 (prototipo listo para imprimir y montar)
1. Electrónica: RD-03D o LD2450 + placa ESP32-S3 con USB-C nativo (p. ej. XIAO ESP32-S3, la del proyecto de referencia) +
   pantalla pequeña (SPI o I2C) + LiPo de 1 celda con cargador y protección + interruptor. Verifica hoja de datos, pines y
   tensión de CADA pieza. Esquema de conexiones en SVG (y KiCad si es viable) con tabla pin a pin.
2. Firmware (Arduino-ESP32 o ESP-IDF, licencia compatible), en hardware/modules/senda-radar/firmware/:
   a) Puente USB-CDC TRANSPARENTE: reenvía las tramas «AA FF 03 00 … 55 CC» tal cual y acepta las órdenes «FD FC FB FA …».
      La app (Web Serial en escritorio, USB-OTG en la APK) funciona sin cambios. Demuéstralo con la «Práctica de campo».
   b) Pantalla tipo radar: sector, anillos de 1 m, hasta 3 objetivos con distancia y velocidad, batería, estado USB.
   c) Lógica separada del hardware y probada en el host (las mismas tramas de packages/senda/tests/mmwave-radar.test.mjs).
   d) Compilación en CI (arduino-cli o ESP-IDF descargados de su release oficial) con el binario como artefacto y su SHA-256.
3. CAD paramétrico en OpenSCAD: carcasa de dos piezas con ventana del radar sin metal delante de la antena, hueco de pantalla,
   USB-C, interruptor, rosca de trípode 1/4", clip de cinturón/soporte y cierre sin tornillos (o tornillos M2/M3 con insertos).
   Parámetros documentados (holguras, grosor de pared). Exporta STL por pieza y GLB del conjunto.
4. Renders 4D rotativos (para la web, el catálogo y los vídeos de Claude Code):
   - Giro de 360° del conjunto (MP4 y WebM 1080p, fondo oscuro de la marca, 8–12 s), vista explosionada animada
     (las piezas se separan y vuelven) y animación de montaje paso a paso.
   - Generados por código en el repositorio (three.js o Blender por línea de comandos), reproducibles, rotulados «render».
   - Además, un GLB ligero (< 2 MB) que la web pueda girar en tiempo real.
5. Lista de materiales «BOM.csv»: referencia, cantidad, enlace, precio, FECHA de consulta, hoja de datos y licencia.
   Coste total = suma calculada de la tabla. Variante mínima (solo USB al móvil) y variante completa (batería + pantalla).
6. Fabricación: material (PLA o PETG), relleno, soportes, orientación y tiempo del laminador (rotulado como estimación del
   laminador). Guía de montaje con renders paso a paso y una prueba de humo:
   /senda/personas → «Simulación» → «Conectar radar» → «Práctica de campo» → archivo senda-campo-*.json válido en
   packages/senda/scripts/mmwave-field-report.mjs.
7. Estructura: hardware/modules/senda-radar/{cad,stl,glb,renders,firmware,docs,BOM.csv,README.md}.

BLOQUE H2 · Familia de módulos SENDA (catálogo y negocio)
1. Ficha por módulo con: problema que resuelve, a quién sirve, cómo se conecta a SENDA (qué módulo del núcleo lo usa y qué
   pantalla de la app lo muestra), qué aporta (medido, o «pendiente de medir» con el protocolo de medida), BOM y coste
   calculado, licencias, camino CE y render 4D rotativo. Candidatos (descarta con motivo los que no se sostengan):
   - SENDA Radar (mmWave, H1).
   - Nodo de malla de largo alcance para mensajes sin cobertura (banda y límites de emisión en la UE con fuente).
   - Baliza Bluetooth de localización para rescate.
   - Estación de sensores (humo, temperatura y humedad, nivel de agua), con la fuente de cada sensor.
2. docs/negocio/MODULOS_SENDA.md: catálogo, kit para montar frente a montado, precio de venta y margen calculados desde la
   BOM, costes de CE, garantía, devoluciones y RAEE. Ninguna cifra de mercado sin fuente.
3. docs/negocio/modulos.json para la web (Claude Code lo integra): nombre, descripción llana, función en SENDA, estado
   («prototipo», «diseño»), BOM total con fecha, rutas de los renders y del GLB. No edites las páginas de investor-next.

RÚBRICA 10/10 (autoevalúate con evidencia al final; cada punto vale 1):
1. CI de GitHub en verde en cada PR contra master, a la primera revisión.
2. Firmware compila en CI y su lógica pasa pruebas en el host con tramas reales del protocolo.
3. Puente transparente demostrado con la app: sesión de «Práctica de campo» que el analizador da por válida.
4. CAD paramétrico completo, STL por pieza y GLB < 2 MB que gira en la web.
5. Renders 4D (giro 360°, explosionada y montaje) reproducibles por código y rotulados.
6. BOM con enlace, precio y fecha en cada línea, y coste total calculado (variantes mínima y completa).
7. Guía de montaje y fabricación que una persona sin experiencia pueda seguir.
8. Catálogo de la familia con fichas completas y descartes razonados.
9. Plan de venta legal en la UE (CE, RoHS, RAEE) con fuentes y costes o «no verificado».
10. Cero datos inventados: cada cifra con origen (medido, calculado por X, fuente Y).

FORMA DE TRABAJAR:
- Orden: H0 → H1 → H2. Un PR por bloque contra master, en borrador, con lo comprobado y lo que no.
- Lo que no se pueda hacer aquí (no hay impresora ni hardware): «bloqueado: motivo», y sigue.

INFORME FINAL en español, corto: enlaces a las PR con su CI · tabla de la rúbrica con la nota y la evidencia de cada punto ·
BOM total y fecha · qué falta para imprimir, montar y vender · riesgos · confianza 0–100 %.
```

## Lo que hace Claude Code en paralelo
1. Integra `modulos.json`, los GLB y los renders en la web y en el escritorio PRO, y los usa en los vídeos.
2. Revisa cada PR (protocolo, veracidad, licencias, CI, CSP) antes de fusionarla.
3. Analiza las grabaciones `senda-campo-*.json` del fundador y solo entonces publica cifras de precisión.
