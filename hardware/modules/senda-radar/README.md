# SENDA Radar v1 · Módulo externo de radar mmWave de 24 GHz con puente USB-CDC transparente y pantalla PPI

> **Estado**: Prototipo de hardware abierto listo para imprimir en 3D, soldar y cargar firmware (`MIT License`).
> **Aviso legal y de veracidad**:
> - Este módulo **no está a la venta**. La comercialización en la Unión Europea exige evaluación de conformidad y marcado **CE** bajo la **Directiva 2014/53/UE (RED)**, **RoHS (2011/65/UE + UE 2015/863)** y registro **RAEE (RD 110/2015)**.
> - El sensor **Ai-Thinker Rd-03D / Hi-Link HLK-LD2450** entrega coordenadas $(x, y)$ y velocidad radial de **hasta 3 objetivos EN MOVIMIENTO** dentro de $\pm 60^\circ$ / $8\text{ m}$. No detecta con fiabilidad personas inmóviles ni distingue una persona de un animal o vegetación movida por el viento.
> - Todos los vídeos e imágenes de [`renders/`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-radar/renders) están rotulados como **`render`** (generados por código mediante Three.js + OpenSCAD; no son fotografías de un producto fabricado).
> - La precisión empírica en campo de SENDA permanece **`pendiente de medir`** hasta que se registren sesiones reales con hardware físico según [`packages/senda/data/mmwave/PROTOCOLO_MEDIDA.md`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/data/mmwave/PROTOCOLO_MEDIDA.md).

---

## 1. Estructura del módulo

```text
hardware/modules/senda-radar/
├── BOM.csv                         # Lista de materiales fechada (2026-11-26) con enlaces, hojas de datos y licencias
├── README.md                       # Esta ficha técnica y guía de reproducción
├── cad/
│   ├── senda_radar_v1.scad         # CAD paramétrico en OpenSCAD (radomo 1,0 mm libre de metal, trípode 1/4", clip)
│   └── cad-metrics.json            # Volúmenes sólidos exactos, áreas, SHA-256 y estimación ESCENARIO de laminado
├── stl/
│   ├── front_bezel.stl             # Bisel frontal con ventana de antena de 1,0 mm y cunas plásticas (0 soportes)
│   ├── rear_body.stl               # Cuerpo trasero con USB-C, interruptor, trípode 1/4"-20 y guías (0 soportes)
│   └── belt_clip.stl               # Clip desmontable de cinturón / correa MOLLE en cola de milano (0 soportes)
├── glb/
│   └── senda-radar-v1.glb          # Conjunto PBR ligero (592,6 KB < 2 MB) con 11 nodos nombrados para giro web
├── renders/
│   ├── turntable-360.{mp4,webm}    # Giro de 360° en 1080p (9,0 s, fondo #04080b, rotulado «render»)
│   ├── exploded-4d.{mp4,webm}      # Vista explosionada animada en 1080p (9,0 s, se separa y vuelve a cerrar)
│   ├── assembly-steps.{mp4,webm}   # Secuencia de montaje en 5 pasos en 1080p (10,0 s)
│   ├── hero-preview.png            # Fotograma 1080p de portada (rotulado «render»)
│   ├── exploded-preview.png        # Fotograma 1080p explosionado (rotulado «render»)
│   └── step-01..05-*.png           # 5 vistas 1080p paso a paso para la guía de montaje (rotuladas «render»)
├── firmware/
│   ├── firmware.ino                # Sketch Arduino-ESP32 para Seeed XIAO ESP32-S3 (puente USB-CDC + OLED 20 Hz)
│   ├── radar_core.h                # Lógica C++17 desacoplada del hardware (parser AA FF 03 00, puente, PPI 128x64)
│   ├── ssd1306_i2c.h               # Controlador I2C SSD1306 no bloqueante página a página (3,1 ms/página a 400 kHz)
│   └── test/host_test.cpp          # Pruebas nativas en host con las mismas tramas de mmwave-radar.test.mjs
├── docs/
│   ├── wiring-schematic.svg        # Esquema eléctrico vectorial pin a pin y dominios de tensión
│   ├── senda-radar.kicad_sch       # Hoja de esquema en formato KiCad 7/8
│   └── GUIA_MONTAJE_Y_FABRICACION.md # Guía paso a paso para personas sin experiencia previa
└── scripts/
    ├── verify-bom.mjs              # Verificación aritmética y documental de BOM.csv
    ├── build-glb-and-metrics.mjs   # Cálculo exacto de volúmenes STL y exportación del GLB (< 2 MB)
    ├── render-4d.mjs               # Generación reproducible de los vídeos 4D MP4/WebM 1080p y capturas PNG
    └── smoke-field-session.mjs     # Prueba extremo a extremo en Chromium (/senda/personas + puente C++17 + informe)
```

---

## 2. Integración directa con SENDA (cero cambios en web ni APK)

| Capa de SENDA | Archivo / Ruta | Cómo interactúa con SENDA Radar v1 |
|---|---|---|
| **Parser y cinemática del núcleo** | [`packages/senda/src/mmwave-radar.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/mmwave-radar.mjs) | Consume directamente las tramas `AA FF 03 00 … 55 CC` a `256000 8N1` reenviadas sin alteración por `TransparentBridge` y envía las órdenes `FD FC FB FA …` (`MULTI_TARGET_CMD`, etc.). |
| **Grabador e integridad SHA-256** | [`packages/senda/src/mmwave-field.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/mmwave-field.mjs) | Empaqueta sesiones `senda-campo-*.json` con huella `SHA-256` verificables por [`mmwave-field-report.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/scripts/mmwave-field-report.mjs). |
| **Aplicación web (Web Serial)** | `/senda/personas` | Botón **«Conectar radar (USB)»** y asistente **«Práctica de campo»**. |
| **APK nativa Android (USB-OTG)** | `android/.../MmWaveUsbSerialBridge.java` | Reconoce el CDC-ACM nativo de la XIAO ESP32-S3 (`VID 0x2886`, `PID 0x0056` / ESP32-S3 USB JTAG/serial) a `256000 8N1`. |

---

## 3. Verificación electrónica pieza a pieza (consultada el `2026-11-26`)

| Ref. | Pieza | Tensión de alimentación | Niveles lógicos | Consumo en hoja de datos | Masa / Cotas | Fuente primaria |
|---|---|---|---|---|---|---|
| `U1` | Ai-Thinker **Rd-03D** (24,00–24,25 GHz) | `4,5–5,5 V DC` (típ. `5,0 V`, rizado `< 100 mV`) | UART `3,3 V` (`256000 8N1`) | Media **`92 mA`** (`@ 5 V, 25 °C`); pico diseño $\ge 200\text{ mA}$ | $3\text{ g}$ · $44,0 \times 15,0\text{ mm}$ | [Hoja de datos Rd-03D V1.0.0](https://en.ai-thinker.com/Uploads/file/20231016/20231016032622_13559.pdf) |
| `U2` | Seeed **XIAO ESP32-S3** | `5 V` por USB-C o `3,0–4,2 V` en pads `BAT+/BAT-` | **`3,3 V` estrictos** | Circuito `19 mA @ 5 V` / `22 mA @ 3,8 V` (sin Wi-Fi); carga Li-Po `~50–100 mA` | $3\text{ g}$ · $21,0 \times 17,8\text{ mm}$ | [Seeed Studio XIAO ESP32S3](https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html) |
| `U3` | **OLED $0,96''$** 128×64 I2C `SSD1306` | `3,3–5,0 V` (alimentado a **`3,3 V`** desde `U2`) | I2C `3,3 V` (`0x3C`, $400\text{ kHz}$) | $\sim 12\text{–}18\text{ mA}$ con abanico PPI activo | $4\text{ g}$ · $28,0 \times 28,0\text{ mm}$ | [Hoja de datos SSD1306](https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf) |
| `BT1` | **PKCELL LP503562** Li-Po 1S `1200 mAh` | Nominal `3,7 V` (`3,00–4,20 V` con PCM `S-8261DAA`) | — | Capacidad nominal `4,44 Wh` | $24\text{ g}$ · máx. $65 \times 36 \times 5,3\text{ mm}$ | [TinyTronics SKU 005879](https://www.tinytronics.nl/en/power/batteries/li-po/pkcell-li-po-battery-3.7v-1200mah-jst-ph-lp503562) |
| `U4` | **Elevador DC-DC Step-Up `5,0 V` fijo** | Entrada `0,9–5,0 V` → Salida fija `5,0 V` | — | Salida máx. `480 mA` ($\eta \approx 85\,\%$); aislado de `VUSB` | $\sim 1,5\text{ g}$ · $11 \times 10,5 \times 7,5\text{ mm}$ | [TinyTronics SKU 001334](https://www.tinytronics.nl/en/power/voltage-converters/boost-(step-up)-converters/mini-dc-dc-5v-step-up-boost-converter-480ma) |

- **Balance energético calculado desde hojas de datos (Variante completa en modo autónomo con Wi-Fi/BLE apagados)**:
  $$P_{\text{batería}} \approx \frac{5{,}0\text{ V} \times 0{,}092\text{ A}}{0{,}85} + (3{,}8\text{ V} \times 0{,}022\text{ A}) + (3{,}3\text{ V} \times 0{,}015\text{ A}) \approx 0{,}541 + 0{,}084 + 0{,}050 = 0{,}675\text{ W}$$
  Con una celda de $4,44\text{ Wh}$ ($3,7\text{ V} \times 1,2\text{ Ah}$), la **estimación teórica (`ESCENARIO` calculado sobre hojas de datos)** es de $\approx 5,9\text{–}6,5\text{ h}$ continuas; **autonomía real: `pendiente de medir` en prototipo físico**.
- **Masa total estimada (`ESCENARIO` suma de componentes + filamento calculado)**: $66\text{ g}$ PETG + $3\text{ g}$ Rd-03D + $3\text{ g}$ XIAO + $4\text{ g}$ OLED + $24\text{ g}$ Li-Po + $\sim 10\text{ g}$ insertos/cables/interruptor $\approx \mathbf{110\text{ g}}$ (Variante completa) o $\approx \mathbf{78\text{ g}}$ (Variante mínima sin batería ni OLED, sin contar el cable USB-C externo).

---

## 4. Resumen de costes calculados desde `BOM.csv` (consultado el `2026-11-26`)

Cifras calculadas automáticamente por `node hardware/modules/senda-radar/scripts/verify-bom.mjs`:

| Variante | Filas BOM | Coste unitario prorrateado (IVA incl.) | Coste unitario prorrateado (sin IVA) | Compra inicial de lotes completos* (IVA incl.) |
|---|---:|---:|---:|---:|
| **Variante mínima** (solo puente USB-C al móvil/PC, con carcasa + trípode + cable USB-C) | 9 | **`23,35 €`** | `19,32 €` | `55,19 €` |
| **Variante completa** (autónoma con batería Li-Po 1200 mAh + pantalla OLED + elevador 5 V + interruptor) | 15 | **`36,87 €`** | `30,50 €` | `69,04 €` |

*\*La columna «Compra inicial de lotes completos» refleja el desembolso real si se adquiere por primera vez una bobina entera de $1\text{ kg}$ de PETG ($17,90\text{ €}$, da para $\sim 15$ carcasas) y bolsas completas de insertos Ruthex (20 uds), insertos M2.5 (20 uds), tornillos M2.5 (100 uds), condensadores (10 uds) y resistencias (10 uds).*

---

## 5. Reproducción completa desde línea de comandos

```bash
# 1. Pruebas en host de la lógica C++17 del firmware (vectores idénticos a mmwave-radar.test.mjs)
g++ -std=c++17 -O2 -Wall -Wextra -Werror \
  hardware/modules/senda-radar/firmware/test/host_test.cpp -o /tmp/senda_radar_host_test && /tmp/senda_radar_host_test

# 2. Prueba de humo extremo a extremo (/senda/personas en Chromium + puente C++17 + mmwave-field-report.mjs)
node hardware/modules/senda-radar/scripts/smoke-field-session.mjs

# 3. Verificación aritmética y de fuentes/fechas de la lista de materiales
node hardware/modules/senda-radar/scripts/verify-bom.mjs

# 4. Exportación paramétrica de los 3 STL desde OpenSCAD + generación del GLB (< 2 MB) y métricas CAD
openscad --export-format binstl -o hardware/modules/senda-radar/stl/front_bezel.stl -D 'part="front_bezel"' hardware/modules/senda-radar/cad/senda_radar_v1.scad
openscad --export-format binstl -o hardware/modules/senda-radar/stl/rear_body.stl   -D 'part="rear_body"'   hardware/modules/senda-radar/cad/senda_radar_v1.scad
openscad --export-format binstl -o hardware/modules/senda-radar/stl/belt_clip.stl   -D 'part="belt_clip"'   hardware/modules/senda-radar/cad/senda_radar_v1.scad
node hardware/modules/senda-radar/scripts/build-glb-and-metrics.mjs

# 5. Generación reproducible de los 3 renders 4D (MP4 + WebM 1080p) y las 7 capturas PNG rotuladas «render»
node hardware/modules/senda-radar/scripts/render-4d.mjs
```

El workflow de integración continua [`.github/workflows/senda-radar-firmware-ci.yml`](file:///home/antigravity/abrahamhl/civic-relay/.github/workflows/senda-radar-firmware-ci.yml) ejecuta en cada PR las pruebas nativas C++17 en el host y compila el binario real `firmware.ino.bin` para `esp32:esp32:XIAO_ESP32S3` con `arduino-cli` descargado desde su release oficial, publicando el artefacto junto con su huella `SHA-256`.
