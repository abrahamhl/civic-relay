# Prompt para Antigravity · Módulos físicos SENDA (hardware imprimible en 3D) · 26-11-2026

**Configuración en Antigravity (compruébala en el selector, porque la lista cambia):**
- **Modelo:** **Gemini 4 Carbon** u **Orchestrator** (planificador + ejecutor), los mismos de la sesión nocturna que entregó F1–F7.
  No uses modelos marcados como retirados el 30-11-2026.
- **Esfuerzo / razonamiento:** el **máximo** que ofrezca el selector (High / «thinking» alto). Es una tarea larga, con CAD, firmware y normativa.
- **Modo:** agente con terminal y edición de archivos, en el repositorio `abrahamhl/civic-relay`, rama nueva desde `master`.

**Reparto de trabajo (coordinación):**
- **Antigravity**: hardware (CAD 3D, lista de materiales, firmware del módulo, guía de montaje, ficha comercial).
- **Claude Code**: integración en la app y en la web, pruebas, validación de cada PR, fusión y verificación de producción y de la APK.
- **Contrato entre los dos**: el módulo habla **exactamente** el protocolo que la app ya entiende (`packages/senda/src/mmwave-radar.mjs`).
  Si cambias el protocolo, la PR no se fusiona.

```
/goal Diseñar el primer módulo físico de SENDA, «SENDA Radar» (radar de personas mmWave de 24 GHz con pantalla), listo para
imprimir en 3D y montar con piezas baratas, y dejar preparada la familia de módulos externos como línea de negocio, sin inventar
ni un dato.

LEE PRIMERO: CLAUDE.md (veracidad) · hardware/mmwave-rd03d/README.md · hardware/mmwave-rd03d/PRACTICA_CAMPO.md ·
packages/senda/data/mmwave/PROTOCOLO_MEDIDA.md · packages/senda/src/mmwave-radar.mjs (protocolo, órdenes y límites) ·
NOTICE (el protocolo viene del firmware MIT de Sudo_solder: mantén la atribución).

LÍNEAS ROJAS:
- Ningún precio, consumo, alcance, autonomía o certificación sin fuente: hoja de datos (enlace) o tienda con FECHA de consulta.
  Si no lo encuentras: «no verificado».
- No se promete «ver a través de paredes», «detectar personas bajo escombros» ni distinguir persona de perro: el RD-03D da x, y y
  velocidad de hasta 3 objetivos EN MOVIMIENTO.
- Para VENDER un aparato con radio en la UE hace falta marcado CE (Directiva de equipos radioeléctricos 2014/53/UE), RoHS y RAEE:
  documenta el camino (qué ensayos, qué organismo, coste con fuente o «no verificado»). Nada se anuncia «a la venta» sin eso.
- Sin servicios de pago ni cuentas nuevas sin preguntar. Sin datos personales. Licencias de cada librería y modelo 3D comprobadas.
- Rama propia desde master, PR en borrador, un PR por bloque. No se fusiona nada sin revisión de Claude Code.

BLOQUE H0 · Cierra F8 del goal anterior (corto)
- `pnpm verify` único (núcleo, web, escritorio, type-check, prove, esquemas). Actualiza CUMPLIMIENTO.md (hora UTC real + hash)
  y SENDA_SESSION_HANDOFF.md con F1–F7 (fusionados en la PR #110).

BLOQUE H1 · SENDA Radar v1 (prototipo imprimible)
- Electrónica candidata (verifica hoja de datos, pines y tensión de CADA pieza antes de usarla): RD-03D o LD2450 + placa ESP32-S3
  con USB-C nativo (p. ej. XIAO ESP32-S3, la del proyecto de referencia) + pantalla pequeña (SPI o I2C) + batería LiPo de 1 celda con
  cargador y protección + interruptor. Alternativa sin batería: solo USB-C al móvil.
- Firmware (Arduino-ESP32 o ESP-IDF, licencia compatible):
  a) Puente USB-CDC TRANSPARENTE: reenvía las tramas crudas `AA FF 03 00 … 55 CC` tal cual y acepta las órdenes `FD FC FB FA …`
     desde el host. Así la app actual (Web Serial en escritorio, USB-OTG en Android) funciona sin tocarla.
  b) Pantalla: vista de radar (sector, anillos de 1 m, hasta 3 objetivos, distancia y velocidad), estado de batería y «sin objetivos».
  c) Parámetros (alcance, fusión de ecos) sin valores inventados: los del firmware de referencia, citados.
  d) Pruebas: decodificación de tramas en el host (mismas tramas de `packages/senda/tests/mmwave-radar.test.mjs`) y compilación en CI.
- CAD paramétrico en OpenSCAD (texto, reproducible): carcasa en dos piezas con ventana para el radar (sin metal ni pintura metálica
  delante de la antena), hueco de pantalla, USB-C, interruptor, rosca de trípode de 1/4" y clip de cinturón o de soporte.
  Exporta STL y documenta: material (PLA o PETG), relleno, soportes y tiempo estimado (estimado del laminador, rotulado como tal).
- Lista de materiales `BOM.csv`: referencia, cantidad, enlace, precio, FECHA de consulta y licencia/hoja de datos. Coste total = suma
  de esa tabla (calculado), nunca redondeado a la baja ni «desde X €» sin respaldo.
- Guía de montaje con fotos o renders rotulados («render», no foto) y prueba de humo: conectar a `/senda/personas`, pulsar
  «Simulación» y luego «Conectar radar», y grabar una sesión de «Práctica de campo».
- Estructura: `hardware/modules/senda-radar/{cad,stl,firmware,docs,BOM.csv,README.md}`.

BLOQUE H2 · Familia de módulos SENDA (catálogo y negocio, sin humo)
- Ficha por módulo candidato (solo los que sirvan a SENDA y se puedan construir con piezas comunes): qué es, para qué sirve, cómo se
  conecta a SENDA (qué módulo del núcleo lo usa), qué aporta medido o «pendiente de medir», BOM y coste calculado, licencias, y
  camino CE. Candidatos a evaluar (descarta los que no se sostengan): SENDA Radar (mmWave) · nodo de malla de largo alcance para
  mensajes sin cobertura (comprobar banda y límites de emisión en la UE con fuente) · baliza Bluetooth de localización para
  rescate · estación de sensores ambientales (humo, temperatura y humedad, nivel de agua) con fuente de cada sensor.
- `docs/negocio/MODULOS_SENDA.md`: tabla de catálogo + modelo de negocio honesto (kit para montar frente a montado, márgenes calculados a
  partir de la BOM, qué falta para vender: CE, garantía, devoluciones, RAEE). Ninguna cifra de mercado sin fuente.
- Contenido para la web (Claude Code lo integra): un JSON `docs/negocio/modulos.json` con nombre, descripción llana, función en
  SENDA, estado («prototipo», «diseño», «idea»), BOM total y enlaces. NO edites las páginas de `investor-next`.

FORMA DE TRABAJAR:
- Orden: H0 → H1 → H2. Un PR por bloque, en borrador, con lo comprobado y lo que no.
- Si algo no se puede verificar o construir aquí (no hay impresora ni hardware en el entorno), escribe «bloqueado: motivo» y sigue.

INFORME FINAL en español, corto: qué se entregó con enlaces a las PR · BOM total calculada y su fecha · qué falta para la primera
impresión y el primer montaje · qué falta para poder vender · riesgos · confianza 0–100 %.
```

## Lo que hace Claude Code en paralelo
1. La app ya graba sesiones de campo (`/senda/personas` → «Práctica de campo») y las guarda en Descargas/SENDA con huella SHA-256.
2. Cuando lleguen los archivos `senda-campo-*.json`, los analiza con `packages/senda/scripts/mmwave-field-report.mjs` y solo entonces
   publica cifras de precisión.
3. Revisa cada PR de hardware de Antigravity (protocolo, veracidad, licencias), la fusiona e integra el catálogo en la web.
