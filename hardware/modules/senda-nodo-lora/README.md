# SENDA Nodo Malla EU868 · Pasarela de largo alcance sin cobertura para sobres firmados SENDA

> **Estado**: `diseño` (CAD paramétrico, STL 2-manifold, GLB `< 2 MB`, renders 4D 1080p y BOM fechada listos; firmware de pasarela y pruebas de alcance en campo pendientes).
> **Aviso legal**: **No está a la venta**. La puesta en el mercado de la Unión Europea exige evaluación de conformidad y marcado **CE** bajo la **Directiva 2014/53/UE (RED)** (`ETSI EN 300 220-2`, `EN 300 328`, `EN 301 489-1/-3/-17`, `EN IEC 62368-1`, `EN 62479`), **RoHS** y **RAEE**. Las imágenes y vídeos de `renders/` están rotulados como **`render`** (no son fotografías de un producto fabricado).

---

## 1. Problema que resuelve y a quién sirve

- **Problema que resuelve**: cuando un incendio forestal quema los tendidos de fibra/electricidad o una inundación tumba las estaciones base móviles, los teléfonos quedan aislados a pocos cientos de metros (Wi-Fi / Bluetooth). Este nodo añade un portador radio sub-GHz en **$868\text{ MHz}$ (`LoRa` CSS sobre `Semtech SX1262`)** capaz de transportar fragmentos $k\text{-de-}n$ Reed-Solomon y sobres compactos firmados de SENDA a través de valles o entre barrios sin operadora ni internet.
- **A quién sirve**: agrupaciones municipales de Protección Civil, retenes forestales, refugios vecinales, puestos de mando avanzados y vehículos de enlace.

---

## 2. Integración exacta con el núcleo y las pantallas de SENDA

| Capa de SENDA | Módulo / Ruta | Función exacta |
|---|---|---|
| **Ciclo de trabajo y tiempo en el aire** | [`packages/senda/src/sovereign-mesh-kit.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/sovereign-mesh-kit.mjs) (`governEtsiDutyCycle`) | Lleva la cuenta horaria por subbanda y rechaza el envío que superaría el ciclo de trabajo de la subbanda elegida. El tiempo en el aire de cada trama se le pasa como dato: su cálculo según Semtech AN1200.13 está **pendiente** (ningún módulo del núcleo lo hace todavía). |
| **Codificación de borrado $k\text{-de-}n$** | [`packages/senda/src/erasure.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/erasure.mjs) | Divide sobres firmados en fragmentos sobre $\text{GF}(256)$ compatibles con cargas útiles LoRa de $51\text{–}222\text{ B}$. |
| **Sobre firmado y transporte DTN** | [`envelope.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/envelope.mjs) · [`courier.mjs`](https://github.com/abrahamhl/civic-relay/blob/master/packages/senda/src/courier.mjs) | Verifica autenticidad extremo a extremo y evita duplicados (*store-and-forward*). |
| **Pantallas de la aplicación** | `/senda/mensaje` · `/senda/radio` · `/senda/sala` | Conexión al teléfono o portátil por **USB-C serie CDC** o **GATT Bluetooth Low Energy** desde el `ESP32-S3` de la placa `Heltec Wireless Stick Lite V3`. |

---

## 3. Banda y límites legales de emisión en la UE (fuentes oficiales)

Fuente primaria consultada el `2026-11-26`: **CEPT ERC Recommendation 70-03** (*Relating to the use of Short Range Devices*, Anexo 1: *Non-specific SRDs*, edición 05-06-2026, <https://docdb.cept.org/download/4980>) y norma armonizada **ETSI EN 300 220-2**:

| Subbanda ERC 70-03 | Rango de frecuencias | Potencia máxima permitida | Ciclo de trabajo (*Duty Cycle*) máximo | Uso previsto en SENDA |
|---|---|---:|---:|---|
| **Anexo 1 · `h1.4`** | $868,000\text{–}868,600\text{ MHz}$ | **`25 mW p.r.a.` (`+14 dBm e.r.p.`)** | **`≤ 1 %`** ($36\text{ s/hora}$) o LBT+AFA | Canal general de fragmentos cortos y acuses firmados |
| **Anexo 1 · `h1.7`** | $869,400\text{–}869,650\text{ MHz}$ | **`500 mW p.r.a.` (`+27 dBm e.r.p.`)** | **`≤ 10 %`** ($360\text{ s/hora}$) o LBT+AFA | Enlace troncal de emergencia entre refugio y puesto de mando *(Nota: el SX1262 entrega hasta $+22\text{ dBm}$ conducidos $\approx 158\text{ mW}$, dentro del límite)* |

---

## 4. Qué aporta y protocolo de medida (`pendiente de medir`)

- **Alcance real y tasa de entrega de paquetes (PDR)**: **`pendiente de medir`** (prohibido publicar kilómetros genéricos de catálogo sin medición real sobre terreno).
- **Protocolo reproducible de medida en campo**:
  1. Fijar un nodo emisor a $2,0\text{ m}$ de altura con potencia conducida declarada ($+14\text{ dBm}$, subbanda `868,1 MHz`, `BW 125 kHz`, `CR 4/5`, `SF7`, `SF9` y `SF12`) respetando estrictamente el contador de `duty cycle ≤ 1 %`.
  2. Desplazar el segundo nodo receptor conectado por USB-C a un móvil con GPS activo en tres entornos: (a) línea de vista despejada con primera zona de Fresnel libre (`ITU-R P.526`), (b) trama urbana densa y (c) masa forestal mediterránea.
  3. Emitir ráfagas de **100 tramas numeradas de `51 B`** en cada punto estático, registrando coordenadas, `RSSI (dBm)`, `SNR (dB)` y `PDR (%)` con sello `SHA-256`.

---

## 5. Coste calculado (`BOM.csv`, consultado el `2026-11-26`), CAD, licencias y camino CE

- **Coste BOM verificado (`node hardware/modules/shared/verify-bom.mjs hardware/modules/senda-nodo-lora/BOM.csv`)**:
  - **Unitario prorrateado**: **`31,67 €` IVA incl.** (`26,18 €` sin IVA).
  - **Compra inicial con bobina/bolsas completas**: **`54,00 €` IVA incl.**
- **CAD, STL, GLB y renders 4D**:
  - [`cad/senda_nodo_lora.scad`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/cad/senda_nodo_lora.scad) → [`stl/base.stl`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/stl/base.stl) + [`stl/lid.stl`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/stl/lid.stl) ($39,39\text{ cm}^3$ sólidos, $48\text{ g}$ PETG, $2\text{ h }58\text{ min}$ `ESCENARIO`).
  - [`glb/senda-nodo-lora.glb`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/glb/senda-nodo-lora.glb): **`330,87 KB`** (`< 2 MB`).
  - [`renders/turntable-360.{mp4,webm}`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/renders/turntable-360.mp4) y [`renders/exploded-4d.{mp4,webm}`](https://github.com/abrahamhl/civic-relay/blob/master/hardware/modules/senda-nodo-lora/renders/exploded-4d.mp4) (`1920×1080`, $8,0\text{ s}$, rotulados `render`).
- **Licencias**: diseño mecánico OpenSCAD, modelos STL/GLB y software de integración bajo **MIT License**; esquemático de referencia `HTIT-WSL_V3` publicado por Heltec Automation.
- **Camino CE**: evaluación completa **RED 2014/53/UE** del conjunto caja + antena látigo 868 MHz + radio 2,4 GHz del ESP32-S3 (`ETSI EN 300 220-2` + `EN 300 328` + `EN 301 489-1/-3/-17` + `EN IEC 62368-1` + `EN 62479`), **RoHS**, **RAEE** y ensayo **UN 38.3** en la celda Li-Po (coste de laboratorio acreditado: `no verificado`, requiere presupuesto formal; véase [`docs/negocio/MODULOS_SENDA.md`](https://github.com/abrahamhl/civic-relay/blob/master/docs/negocio/MODULOS_SENDA.md)).
