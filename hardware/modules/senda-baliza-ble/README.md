# SENDA Baliza Rescate BLE · Baliza autónoma Bluetooth Low Energy 5.0 de localización cercana

> **Estado**: `diseño` (CAD paramétrico con guarda anti-pulsación y anilla de mosquetón, STL 2-manifold, GLB `< 2 MB`, renders 4D 1080p y BOM fechada listos; ensayos de alcance/autonomía y cualificación Bluetooth SIG pendientes).
> **Aviso legal**: **No está a la venta**. Comercializar un dispositivo Bluetooth en la UE exige marcado **CE** (**Directiva 2014/53/UE RED**, `ETSI EN 300 328`), **RoHS**, **RAEE** y, además, **cualificación oficial y Company Identifier asignado por Bluetooth SIG** (el identificador `0xFFFF` está prohibido en productos comerciales). Las imágenes y vídeos de `renders/` están rotulados como **`render`**.

---

## 1. Problema que resuelve y a quién sirve

- **Problema que resuelve**: un teléfono móvil con la pantalla encendida o buscando cobertura agota su batería en pocas horas. Esta cápsula dedicada de $29\text{ g}$ basada en **Nordic `nRF52840`** (`Seeed Studio XIAO BLE`) emite balizas cortas `BLE 5.0` (compatible con modo estándar `1M PHY` para cualquier móvil actual y `Coded PHY S=8` entre nodos compatibles) con consumo de microamperios en reposo, permitiendo localizar por `RSSI` y geometría multi-punto a personas aisladas o marcar viviendas ya revisadas sin red celular.
- **A quién sirve**: senderistas y trabajadores forestales, personas mayores en municipios inundables, voluntarios de Protección Civil en barrido puerta a puerta y equipos de primera intervención.

---

## 2. Integración exacta con el núcleo y las pantallas de SENDA

| Capa de SENDA | Módulo / Ruta | Función exacta |
|---|---|---|
| **Codificación de baliza de emergencia** | [`packages/senda/src/beacon.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/beacon.mjs) · `SendaFormats.java` | Empaqueta estado de emergencia, contador monotónico anti-repetición y nivel de batería en carga compacta BLE sin datos personales (0 PII). |
| **Estimación geométrica bajo obstáculos** | [`packages/senda/src/rubble.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/rubble.mjs) | Calcula anillo de distancia e incertidumbre explícita a partir de lecturas `RSSI` desde varias posiciones de paso (sin prometer precisión centimétrica irreal). |
| **Barrido coordinado de edificios** | [`packages/senda/src/house-sweep.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/house-sweep.mjs) | Registra detección de balizas durante inspecciones puerta a puerta. |
| **Pantallas de la aplicación** | `/senda/barrido` · `/senda/conducir` (`📡 Señales`) | Escaneo pasivo y representación inmediata de balizas cercanas en móvil y escritorio. |

---

## 3. Límites radioeléctricos UE y requisito de licencia Bluetooth SIG (fuentes oficiales)

1. **Espectro UE (`2400–2483,5 MHz` ISM)**: **ETSI EN 300 328** (bajo **Directiva 2014/53/UE RED**, <https://eur-lex.europa.eu/eli/dir/2014/53/oj>) — potencia radiada isótropa equivalente máxima de **`10 mW` (`+10 dBm e.i.r.p.`)** para modulaciones digitales de banda ancha sin acceso adaptativo, o hasta **`100 mW` (`+20 dBm e.i.r.p.`)** cumpliendo los requisitos correspondientes de ocupación espectral (`nRF52840` entrega como máximo `+8 dBm` conducidos, dentro del margen).
2. **Bluetooth SIG (Tarifas oficiales vigentes desde el `01-03-2026`, consultadas el `2026-11-26` en <https://www.bluetooth.com/fee-schedule/>)**:
   - Alta como miembro **Adopter**: **`0 USD/año`**.
   - **Company Identifier (16 bits)** para tramas *Manufacturer Specific Data*: **`1.250 USD`** (pago único obligatorio antes de comercializar; en fase de laboratorio interno el estándar reserva `0xFFFF` exclusivamente para pruebas no comerciales).
   - **Product Qualification Fee** (obligatoria para usar la tecnología y marca Bluetooth en un producto puesto en el mercado): **`12.000 USD`** por declaración en nivel *Adopter* (o **`8.000 USD`** la primera cualificación anual en nivel *Contributing Adopter*, cuya cuota anual es de `3.500 USD`).

---

## 4. Qué aporta y protocolo de medida (`pendiente de medir`)

- **Alcance de recepción en teléfonos Android/iOS y días reales de batería (`250 mAh`)**: **`pendiente de medir`** (cálculo energético preliminar sobre hoja de datos de `nRF52840`: a `0 dBm` con intervalo de anuncio de `500 ms` y reposo de $\sim 5\,\mu\text{A}$, el consumo medio esperado ronda $\sim 35\text{–}60\,\mu\text{A}$, lo que sugiere varios meses teóricos en `ESCENARIO`, pero **no se publica ninguna cifra comercial hasta medir la corriente real con amperímetro de rango microamperimétrico sobre la placa completa**).
- **Protocolo reproducible de medida**:
  1. Medir corriente media en serie sobre `BT1` ($3,7\text{ V}$) durante $600\text{ s}$ con analizador de perfil energético (PPK2 o multímetro de banco) a intervalos de `200 ms`, `500 ms` y `1000 ms` (`0 dBm` y `+8 dBm`).
  2. Medir tasa de recepción y curva `RSSI(d)` a $1, 2, 5, 10, 25, 50$ y $100\text{ m}$ con tres modelos distintos de teléfono Android/iOS tanto en exterior despejado como detrás de un muro interior de ladrillo hueco y forjado doméstico.

---

## 5. Coste calculado (`BOM.csv`, consultado el `2026-11-26`), CAD, licencias y camino CE

- **Coste BOM verificado (`node hardware/modules/shared/verify-bom.mjs hardware/modules/senda-baliza-ble/BOM.csv`)**:
  - **Unitario prorrateado**: **`24,28 €` IVA incl.** (`20,08 €` sin IVA).
  - **Compra inicial con bobina/bolsas completas**: **`47,50 €` IVA incl.**
- **CAD, STL, GLB y renders 4D**:
  - [`cad/senda_baliza_ble.scad`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/cad/senda_baliza_ble.scad) → [`stl/bottom_shell.stl`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/stl/bottom_shell.stl) + [`stl/top_shell.stl`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/stl/top_shell.stl) ($16,619\text{ cm}^3$ sólidos, $20\text{ g}$ PETG, $1\text{ h }15\text{ min}$ `ESCENARIO`).
  - [`glb/senda-baliza-ble.glb`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/glb/senda-baliza-ble.glb): **`241,08 KB`** (`< 2 MB`).
  - [`renders/turntable-360.{mp4,webm}`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/renders/turntable-360.mp4) y [`renders/exploded-4d.{mp4,webm}`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-baliza-ble/renders/exploded-4d.mp4) (`1920×1080`, $8,0\text{ s}$, rotulados `render`).
- **Licencias**: carcasa OpenSCAD, STL/GLB y formato de trama SENDA bajo **MIT License**; esquemático de hardware XIAO BLE abierto por Seeed Studio.
- **Camino CE**: **RED 2014/53/UE** (`ETSI EN 300 328`, `EN 301 489-1/-17`, `EN IEC 62368-1`, `EN 62479`), **RoHS**, **RAEE**, **UN 38.3** de batería Li-Po y cualificación **Bluetooth SIG**.
