# SENDA Estación Hidrometeo y Humo · Telemetría temprana de barrancos e incendios forestales

> **Estado**: `diseño` (garita paramétrica de doble cámara con lamas antilluvia, STL 2-manifold, GLB `< 2 MB`, renders 4D 1080p y BOM fechada con hojas de datos primarias listos; validación metrológica en exterior pendiente).
> **Aviso legal**: **No está a la venta**. Su puesta en el mercado en la UE exige evaluación de conformidad **CE** (**Directiva 2014/53/UE RED** si activa Wi-Fi/BLE del `ESP32-S3`, o **Directiva EMC 2014/30/UE** en modo cableado puro, más seguridad **EN IEC 62368-1**), **RoHS** y **RAEE**. Las imágenes y vídeos de `renders/` están rotulados como **`render`**.

---

## 1. Problema que resuelve y a quién sirve

- **Problema que resuelve**: muchos barrancos secundarios y pasos inundables carecen de estación SAIH oficial aguas arriba, y en interfaz urbano-forestal las alertas llegan tarde cuando el humo ya invade las carreteras. Esta estación combina en una garita ventilada tres magnitudes físicas verificables sin piezas móviles sumergidas en el cauce:
  1. **Distancia sin contacto a la lámina de agua** (colgada bajo tablero de puente o pasarela, lejos del arrastre de piedras y lodo).
  2. **Concentración másica de partículas de humo $\text{PM}_{1.0}, \text{PM}_{2.5}, \text{PM}_{4}$ y $\text{PM}_{10}$** por dispersión láser con autolimpieza.
  3. **Presión barométrica, temperatura del aire y humedad relativa** en cámara inferior térmicamente separada de la CPU.
- **A quién sirve**: técnicos municipales de emergencias, comunidades de montes vecinales, consorcios provinciales de bomberos y centros educativos/ciudadanos en redes de observación auditables.

---

## 2. Integración exacta con el núcleo y las pantallas de SENDA

| Capa de SENDA | Módulo / Ruta | Función exacta |
|---|---|---|
| **Vigilancia de crecida aguas arriba y asimilación** | [`flood-watch.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/flood-watch.mjs) · [`shallow-water.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/shallow-water.mjs) · [`data-assimilation.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/data-assimilation.mjs) | Convierte la distancia medida desde la cota fija del puente en calado $h(t) = H_{\text{puente}} - d_{\text{ultrasonido}}$ con incertidumbre declarada ($\sigma_h$) para asimilación EnKF y aviso temprano. |
| **Propagación de fuego y humedad fina** | [`fire-rothermel.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/fire-rothermel.mjs) · `fire-nowcast.mjs` | Alimenta $T$ y $\text{HR}$ para estimar humedad del combustible fino muerto y detecta incrementos anómalos de $\text{PM}_{2.5}/\text{PM}_{1.0}$ compatibles con combustión de biomasa. |
| **Contrato estricto de series temporales** | [`connector-series.schema.json`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/schemas/connector-series.schema.json) · [`data-connectors.mjs`](file:///home/antigravity/abrahamhl/civic-relay/packages/senda/src/data-connectors.mjs) | Exige unidad explícita, fuente verificable y marca temporal ISO-8601 con zona horaria (`Z` o `±HH:MM`); rechaza lecturas ambiguas o `NaN`. |
| **Pantallas de la aplicación** | `/senda/dana4d` · `/senda/fuego` · `/senda/incendio4d` · `/senda/sala` | Visualización de series hidrometeorológicas y alertas con procedencia explícita (nunca dispara un aviso público `N5` sin firma humana). |

---

## 3. Verificación de cada sensor frente a su hoja de datos primaria (`2026-11-26`)

| Ref. | Sensor | Magnitudes medidas y rango oficial | Precisión / Tolerancia en hoja de datos | Alimentación e interfaz | Fuente primaria verificada |
|---|---|---|---|---|---|
| `S1` | **Sensirion SPS30** | Masa $\text{PM}_{1.0}, \text{PM}_{2.5}, \text{PM}_{4}, \text{PM}_{10}$ ($0\text{–}1000\,\mu\text{g/m}^3$) | Certificación **MCERTS**; $\pm 10\,\mu\text{g/m}^3$ ($0\text{–}100\,\mu\text{g/m}^3$ $\text{PM}_{1}/\text{PM}_{2.5}$) o $\pm 10\,\%$ ($100\text{–}1000\,\mu\text{g/m}^3$) | `4,5–5,5 V DC` ($\sim 55\text{ mA}$ med.); I2C/UART a **`3,3 V`** | [Sensirion SPS30 Datasheet](https://sensirion.com/media/documents/8600FF88/64A3B8D6/Sensirion_PM_Sensors_Datasheet_SPS30.pdf) |
| `S2` | **Bosch BME280** | Presión ($300\text{–}1100\text{ hPa}$), Temperatura ($-40\text{ a }+85\,^\circ\text{C}$), Humedad ($0\text{–}100\,\%\text{ HR}$) | $\pm 1,0\text{ hPa}$ abs. ($\pm 0,12\text{ hPa}$ rel. $\approx \pm 1\text{ m}$), $\pm 0,5\,^\circ\text{C}$ a $25\,^\circ\text{C}$, $\pm 3\,\%\text{ HR}$ | **`3,3 V`** ($\sim 3,6\,\mu\text{A}$ a $1\text{ Hz}$); I2C `0x76` | [Bosch BME280 Datasheet DS002](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf) |
| `S3` | **JSN-SR04T** | Distancia acústica aire-agua sin contacto ($20\text{–}450\text{ cm}$, cono $\sim 45^\circ\text{–}60^\circ$) | Resolución $1\text{ mm}$, tolerancia típica $\pm 1\text{ cm}$ *(corregible en SENDA con $c_{\text{sonido}}(T) = 331{,}3 + 0{,}606\,T$ medida por el BME280)* | `5,0 V` ($\sim 30\text{ mA}$ activos); pulso `ECHO` bajado a `3,3 V` con divisor `R1..R3` | [TinyTronics SKU 001959 Spec](https://www.tinytronics.nl/en/sensors/distance/waterproof-ultrasonic-sensor-jsn-sr04T) |

> **Nota crítica de diseño mecánico verificada**: en el `JSN-SR04T` únicamente el transductor cilíndrico y su cable coaxial de $2,5\text{ m}$ resisten la intemperie; su pequeña PCB adaptadora **no es impermeable** y por ello se aloja dentro de la cámara superior cerrada de `rear_housing.stl`.

---

## 4. Qué aporta y protocolo de medida (`pendiente de medir`)

- **Desviación térmica solar dentro de la garita PETG y error real de calado frente a mira limnimétrica**: **`pendiente de medir`**.
- **Protocolo reproducible de medida**:
  1. **Calado**: suspender la sonda `JSN-SR04T` verticalmente a $250,0\text{ cm}$ sobre lámina de agua con regla milimetrada de contraste, variando el nivel en escalones de $10,0\text{ cm}$ entre $30\text{ cm}$ y $220\text{ cm}$ y aplicando compensación de velocidad del sonido con la temperatura del `BME280`.
  2. ** Radiación solar**: imprimir la garita en **PETG blanco UV** para instalación exterior soleada y comparar durante $72\text{ h}$ la serie $T(t)$ frente a termohigrómetro de referencia aspirado para cuantificar el sesgo radiativo diurno.
  3. **Humo**: comparar lecturas $\text{PM}_{2.5}$ de `SPS30` frente a estación oficial de calidad del aire cercana durante episodio estable y tras limpieza semanal automática del ventilador.

---

## 5. Coste calculado (`BOM.csv`, consultado el `2026-11-26`), CAD, licencias y camino CE

- **Coste BOM verificado (`node hardware/modules/shared/verify-bom.mjs hardware/modules/senda-estacion-ambiental/BOM.csv`)**:
  - **Unitario prorrateado**: **`70,19 €` IVA incl.** (`58,02 €` sin IVA).
  - **Compra inicial con bobina/bolsas completas**: **`91,90 €` IVA incl.**
- **CAD, STL, GLB y renders 4D**:
  - [`cad/senda_estacion_ambiental.scad`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/cad/senda_estacion_ambiental.scad) → [`stl/rear_housing.stl`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/stl/rear_housing.stl) + [`stl/front_louvers.stl`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/stl/front_louvers.stl) ($87,652\text{ cm}^3$ sólidos, $106\text{ g}$ PETG, $6\text{ h }35\text{ min}$ `ESCENARIO`).
  - [`glb/senda-estacion-ambiental.glb`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/glb/senda-estacion-ambiental.glb): **`347,50 KB`** (`< 2 MB`).
  - [`renders/turntable-360.{mp4,webm}`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/renders/turntable-360.mp4) y [`renders/exploded-4d.{mp4,webm}`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/renders/exploded-4d.mp4) (`1920×1080`, $8,0\text{ s}$, rotulados `render`).
- **Licencias**: carcasa OpenSCAD, STL/GLB y esquemas de conexión bajo **MIT License**.
- **Camino CE**: **RED 2014/53/UE** (`ETSI EN 300 328` si transmite por Wi-Fi/BLE desde la XIAO ESP32-S3; o **EMC 2014/30/UE** si opera exclusivamente por cable USB con radios deshabilitadas en compilación), seguridad **EN IEC 62368-1** (y seguridad fotobiológica láser Clase 1 ya integrada en el módulo cerrado `SPS30` según **IEC 60825-1** declarada en la hoja de datos de Sensirion), **RoHS** y **RAEE**.
