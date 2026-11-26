# Catálogo de la Familia de Módulos Externos SENDA y Plan Legal de Venta en la Unión Europea

> **Regla roja de estado comercial (`2026-11-26`)**: **NINGÚN módulo físico de SENDA está a la venta en este momento**. Publicar los planos CAD, el firmware y la lista de materiales bajo licencia abierta (`MIT`) permite a cualquier ciudadano, universidad o servicio de protección civil **autoconstruir** un prototipo experimental bajo su propia responsabilidad; sin embargo, **poner en el mercado o comercializar en la Unión Europea** (ya sea montado o como kit completo destinado al consumidor final) exige completar previamente el expediente técnico y el marcado **CE** bajo la **Directiva 2014/53/UE (RED)**, **RoHS**, el registro de productor **RAEE** y, en equipos Bluetooth, la cualificación ante **Bluetooth SIG**.
>
> **Regla de veracidad**: cada precio de componente procede de proveedor europeo con enlace directo y fecha de consulta **`2026-11-26`**. Todo supuesto operativo (tiempo de laminador, embalaje, mano de obra de montaje o precio objetivo de venta) se etiqueta explícitamente como **`ESCENARIO`**. Las tarifas sin lista pública oficial (ensayos de laboratorio acreditado ENAC/organismo notificado y cuotas de adhesión a un SCRAP RAEE) figuran como **`no verificado`**. No se incluye ninguna cifra de tamaño de mercado inventada.

---

## 1. Catálogo de la familia de módulos SENDA (4 candidatos retenidos)

| Código | Nombre del módulo | Estado actual | Qué mide / resuelve | Módulos del núcleo SENDA | Pantallas SENDA | BOM unitaria IVA incl. (`2026-11-26`) | BOM unitaria sin IVA (`2026-11-26`) | GLB web (`< 2 MB`) |
|---|---|---|---|---|---|---:|---:|---:|
| **H1 · `senda-radar`** | **SENDA Radar v1** *(Variante mínima USB / Variante completa autónoma)* | **`prototipo`** *(CAD + STL + GLB + firmware compilado en CI + puente probado)* | Coordenadas $(x,y)$ y velocidad radial de **hasta 3 objetivos en movimiento** a $24\text{ GHz}$ ($\pm 60^\circ$, hasta $8\text{ m}$) por USB-CDC transparente y pantalla PPI OLED | `mmwave-radar.mjs` · `mmwave-field.mjs` | `/senda/personas` (Web Serial y APK USB-OTG) | **`23,35 €`** *(mín.)* / **`36,87 €`** *(compl.)* | `19,32 €` *(mín.)* / `30,50 €` *(compl.)* | `592,64 KB` |
| **H2.1 · `senda-nodo-lora`** | **SENDA Nodo Malla EU868** | **`diseño`** *(CAD + STL + GLB + renders 4D + BOM)* | Pasarela radio sub-GHz `LoRa` ($868\text{ MHz}$, `SX1262`) para enviar sobres firmados y fragmentos Reed-Solomon $k\text{-de-}n$ cuando cae la red móvil | `bearers.mjs` · `erasure.mjs` · `envelope.mjs` · `courier.mjs` | `/senda/mensaje` · `/senda/radio` · `/senda/sala` | **`31,67 €`** | `26,18 €` | `330,87 KB` |
| **H2.2 · `senda-baliza-ble`** | **SENDA Baliza Rescate BLE** | **`diseño`** *(CAD + STL + GLB + renders 4D + BOM)* | Baliza autónoma ultraligera ($29\text{ g}$ estimados) en `BLE 5.0` (`nRF52840`) para localización cercana por `RSSI` y barrido puerta a puerta sin cobertura | `beacon.mjs` · `rubble.mjs` · `house-sweep.mjs` | `/senda/barrido` · `/senda/conducir` (`📡 Señales`) | **`24,28 €`** | `20,08 €` | `241,08 KB` |
| **H2.3 · `senda-estacion-ambiental`** | **SENDA Estación Hidrometeo y Humo** | **`diseño`** *(CAD + STL + GLB + renders 4D + BOM)* | Telemetría temprana en garita ventilada: calado de barranco sin contacto (`JSN-SR04T`), humo forestal láser MCERTS (`SPS30`) y $P/T/\text{HR}$ (`BME280`) | `flood-watch.mjs` · `shallow-water.mjs` · `data-assimilation.mjs` · `fire-rothermel.mjs` · `data-connectors.mjs` | `/senda/dana4d` · `/senda/fuego` · `/senda/incendio4d` · `/senda/sala` | **`70,19 €`** | `58,02 €` | `347,50 KB` |

### Fichas individuales detalladas y protocolos de medida
- **SENDA Radar v1**: [`hardware/modules/senda-radar/README.md`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-radar/README.md) y guía paso a paso [`GUIA_MONTAJE_Y_FABRICACION.md`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-radar/docs/GUIA_MONTAJE_Y_FABRICACION.md).
- **SENDA Nodo Malla EU868**: [`hardware/modules/senda-nodo-lora/README.md`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-nodo-lora/README.md).
- **SENDA Baliza Rescate BLE**: [`hardware/modules/senda-baliza-ble/README.md`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-baliza-ble/README.md).
- **SENDA Estación Hidrometeo y Humo**: [`hardware/modules/senda-estacion-ambiental/README.md`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/senda-estacion-ambiental/README.md).

---

## 2. Candidatos descartados razonadamente

Para proteger la credibilidad técnica ante UME, FCSE y comités de emergencia, se han **descartado expresamente** tres propuestas habituales en proyectos *maker*:

1. **Detector exterior de incendios basado en sensores de gas de óxido metálico sin calibrar (`MQ-2`, `MQ-135`, `BME680` sin curva de campo)** — **Descartado**:
   - *Motivo físico y energético*: los sensores `MQ-*` incorporan un calefactor resistivo permanente de $\sim 750\text{–}900\text{ mW}$ que arruina la autonomía en batería, sufren deriva severa por humedad relativa y temperatura, responden a vapores domésticos/alcohol y al aire libre la pluma de gases se diluye antes de superar su umbral de ruido. En su lugar, la estación usa dispersión óptica láser de partículas finas **Sensirion SPS30** con certificación **MCERTS**.
2. **Sonda de presión hidrostática sumergida en el lecho del barranco sin tubo capilar compensado** — **Descartado**:
   - *Motivo hidrodinámico y metrológico*: un transductor absoluto sumergido suma la columna de agua y la presión atmosférica; durante el paso de una DANA, una caída barométrica de $25\text{ hPa}$ introduce un error espurio de $\approx 25\text{ cm}$ de nivel si no se compensa con un segundo barómetro seco sincronizado, y en ramblas mediterráneas el arrastre de bolos y lodo destruye o entierra las sondas sumergidas en minutos. Se adopta medición acústica aérea sin contacto (**JSN-SR04T**) suspendida bajo tablero de puente y compensada en temperatura con el **BME280**.
3. **«Radar de localización de víctimas bajo escombros» basado en el módulo `RD-03D` de 24 GHz** — **Descartado**:
   - *Motivo electromagnético y de seguridad vital*: a $24\text{ GHz}$ ($\lambda \approx 12,5\text{ mm}$) la atenuación dieléctrica en hormigón armado húmedo y mampostería es muy elevada, y además el algoritmo interno del `S5KM312CL` (`RD-03D` / `LD2450`) suprime blancos estáticos y exige movimiento traslacional. Presentarlo como herramienta de rescate bajo escombros induciría falsos negativos mortales.

---

## 3. Modelo de producto: Kit para montar frente a Unidad montada

| Criterio | Opción 1 · Kit DIY de hardware abierto (para montar) | Opción 2 · Unidad montada y verificada en banco |
|---|---|---|
| **Público objetivo** | Universidades, radioaficionados, talleres de Protección Civil, desarrolladores | Ayuntamientos, consorcios de emergencias, flotas logísticas, usuarios sin soldador |
| **Qué recibe el usuario** | Piezas impresas en PETG (o archivos STL para autoimpresión), módulos COTS embolsados ESD, tornillería y acceso a la guía paso a paso | Equipo ensamblado, flasheado, comprobado uno a uno con prueba de humo firmada (`SHA-256`) y etiquetado reglamentario |
| **Obligación CE (RED 2014/53/UE)** | **Atención legal**: en la UE, un kit completo vendido al usuario final que al ensamblarse según las instrucciones forma un equipo radioeléctrico suele considerarse equivalente al aparato terminado ante las autoridades de vigilancia de mercado (Guía Azul de la Comisión Europea sobre la aplicación de la normativa de productos de la UE, `2022/C 247/01`, §2.1). Solo la publicación gratuita de planos/código (`MIT`) está exenta | Requiere expediente técnico completo, ensayos conforme a normas armonizadas, Declaración UE de Conformidad (DoC), marcado CE, RoHS y registro RAEE |
| **Transporte de baterías Li-Po** | Puede suministrarse **sin batería Li-Po** (variante USB o compra local de la celda por el usuario) para evitar recargos ADR / IATA `UN 3480` | Batería instalada dentro del equipo (**`UN 3481`**, Instrucción de Embalaje `PI 967` / ADR Disposición Especial `188`), exigiendo certificado **`UN 38.3`** del fabricante de la celda |

---

## 4. Costes calculados desde la BOM y matriz `ESCENARIO` de precios y márgenes

### 4.1 Origen exacto de cada columna
- **Columna `BOM sin IVA` (`calculado + fuente 2026-11-26`)**: suma exacta verificada por [`hardware/modules/shared/verify-bom.mjs`](file:///home/antigravity/abrahamhl/civic-relay/hardware/modules/shared/verify-bom.mjs) a precios unitarios de minorista europeo (*TinyTronics B.V.* y *Ruthex GmbH*, consultados el `2026-11-26`; compras en volumen B2B reducirían la BOM, pero no se asume ningún descuento no cotizado).
- **Supuestos explícitos de `ESCENARIO` operativo (sin fuente externa, declarados para modelización financiera transparente)**:
  - `Embalaje ESD + caja reciclable + etiqueta` (`ESCENARIO`): **`2,50 €`** sin IVA por unidad.
  - `Mano de obra de montaje, flasheo, prueba funcional individual y provisión del 4 % de garantía` (`ESCENARIO`, solo en unidad montada): **`14,00 €`** sin IVA en módulos compactos ($\approx 35\text{ min}$) y **`18,00 €`** sin IVA en la Estación Hidrometeo y Humo ($\approx 45\text{ min}$).
  - `IVA aplicable en España` (fuente oficial: **Ley 37/1992 del IVA**, tipo general vigente): **`21 %`**.
  - **Importante**: el margen bruto unitario mostrado abajo **es previo a amortizar los costes fijos de certificación CE/RED y tasas Bluetooth SIG** detallados en la sección 5.

| Módulo y variante | Modalidad | BOM sin IVA (`2026-11-26`) | Embalaje + montaje (`ESCENARIO`) | Coste directo total sin IVA (`ESCENARIO`) | Precio venta sin IVA (`ESCENARIO`) | PVP con 21 % IVA España (`ESCENARIO`) | Margen bruto unitario (`ESCENARIO`) | Margen bruto % (`ESCENARIO`) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **SENDA Radar v1** *(Mínima USB)* | Kit para montar | `19,32 €` | `2,50 €` | `21,82 €` | `36,00 €` | `43,56 €` | `+14,18 €` | **`39,39 %`** |
| **SENDA Radar v1** *(Completa OLED+LiPo)* | Kit para montar | `30,50 €` | `2,50 €` | `33,00 €` | `55,00 €` | `66,55 €` | `+22,00 €` | **`40,00 %`** |
| **SENDA Radar v1** *(Completa OLED+LiPo)* | **Montado y probado** | `30,50 €` | `16,50 €` | `47,00 €` | `82,00 €` | `99,22 €` | `+35,00 €` | **`42,68 %`** |
| **SENDA Nodo Malla EU868** | Kit para montar | `26,18 €` | `2,50 €` | `28,68 €` | `48,00 €` | `58,08 €` | `+19,32 €` | **`40,25 %`** |
| **SENDA Nodo Malla EU868** | **Montado y probado** | `26,18 €` | `16,50 €` | `42,68 €` | `74,00 €` | `89,54 €` | `+31,32 €` | **`42,32 %`** |
| **SENDA Baliza Rescate BLE*** | Kit para montar | `20,08 €` | `2,50 €` | `22,58 €` | `38,00 €` | `45,98 €` | `+15,42 €` | **`40,58 %`** |
| **SENDA Baliza Rescate BLE*** | **Montado y probado** | `20,08 €` | `16,50 €` | `36,58 €` | `64,00 €` | `77,44 €` | `+27,42 €` | **`42,84 %`** |
| **SENDA Estación Hidrometeo y Humo** | Kit para montar | `58,02 €` | `2,50 €` | `60,52 €` | `99,00 €` | `119,79 €` | `+38,48 €` | **`38,87 %`** |
| **SENDA Estación Hidrometeo y Humo** | **Montado y probado** | `58,02 €` | `20,50 €` | `78,52 €` | `135,00 €` | `163,35 €` | `+56,48 €` | **`41,84 %`** |

*\*Advertencia financiera sobre la Baliza Rescate BLE: debido a las tasas fijas obligatorias de Bluetooth SIG (`1.250 USD` Company ID + `12.000 USD` Product Qualification como miembro Adopter gratuito; fuente oficial abajo), con un margen unitario `ESCENARIO` de `27,42 €` harían falta vender más de $\sim 450$ unidades **únicamente** para empatar las tasas administrativas de Bluetooth SIG antes incluso de sumar el laboratorio CE/RED. Por ello se recomienda priorizar comercialmente **SENDA Radar v1 (solo USB, radios Wi-Fi/BLE deshabilitadas en firmware)** como primer producto certificable.*

---

## 5. Plan de Venta Legal en la Unión Europea (CE RED, RoHS, RAEE, Baterías y Consumo)

### 5.1 Directiva de Equipos Radioeléctricos — Marcado CE (`Directiva 2014/53/UE`, RED)
- **Base legal oficial**: **Directiva 2014/53/UE** del Parlamento Europeo y del Consejo, de 16 de abril de 2014 (<https://eur-lex.europa.eu/eli/dir/2014/53/oj>, transpuesta en España por el **Real Decreto 188/2016**, <https://www.boe.es/eli/es/rd/2016/05/06/188>).
- **Principio clave de ingeniería regulatoria**: integrar submódulos pre-certificados (`XIAO ESP32-S3`, `Rd-03D`, `Heltec SX1262`, `XIAO BLE`) dentro de una carcasa nueva con alimentación, cableado y proximidad dieléctrica propios **constituye un aparato radioeléctrico nuevo**. Los certificados CE de los submódulos ayudan en ensayos conducidos, pero **NO eximen** al fabricante final de evaluar el conjunto radiado, redactar el Expediente Técnico y firmar la **Declaración UE de Conformidad (DoC)**.
- **Normas armonizadas aplicables por módulo**:
  1. **Espectro radioeléctrico (Art. 3.2 RED)**:
     - `SENDA Radar v1` ($24,00\text{–}24,25\text{ GHz}$ SRD $\le 100\text{ mW}$ p.i.r.e.): **ETSI EN 300 440 V2.2.1** *(con Wi-Fi y Bluetooth del ESP32-S3 desactivados por compilación para evitar ensayar un segundo transmisor innecesario)*.
     - `SENDA Nodo Malla EU868` ($868\text{ MHz}$ SRD): **ETSI EN 300 220-2** + **CEPT ERC/REC 70-03** (<https://docdb.cept.org/download/4980>) + **ETSI EN 300 328** (si habilita BLE/Wi-Fi).
     - `SENDA Baliza Rescate BLE` y `Estación Ambiental` con radio $2,4\text{ GHz}$: **ETSI EN 300 328**.
  2. **Compatibilidad electromagnética — EMC (Art. 3.1.b RED)**: **ETSI EN 301 489-1**, **EN 301 489-3** (SRD $24\text{ GHz}$ / $868\text{ MHz}$) y **EN 301 489-17** (banda ancha $2,4\text{ GHz}$), más **EN 55032 / EN 55035** en puerto USB-C.
  3. **Seguridad eléctrica y térmica (Art. 3.1.a RED)**: **EN IEC 62368-1** (equipos TIC/electrónicos) y **EN 62133-2** (seguridad de celdas secundarias de litio).
  4. **Exposición humana a campos electromagnéticos — SAR / MPE (Art. 3.1.a RED)**: **EN 62479** / **EN 50663** (evaluación de baja potencia) o **EN 62311**.
  5. **Requisitos de ciberseguridad RED (Art. 3.3 d/e/f — Reglamento Delegado (UE) 2022/30, aplicable desde el `01-08-2025`, <https://eur-lex.europa.eu/eli/reg_del/2022/30/oj>)**: serie **EN 18031-1/-2** para equipos radio conectables a internet; **SENDA Radar v1** conectado exclusivamente por cable serie USB local y con radios Wi-Fi/BLE físicamente deshabilitadas en el binario compilado evita exponer interfaces de red IP inalámbricas.
- **Coste de ensayos en laboratorio acreditado (ENAC / ILAC)**: **`no verificado`** *(los laboratorios acreditados como Alter Technology, Applus+, Dekra o Eurofins emiten presupuesto cerrado por expediente según número de radios y modos; solicitar 3 presupuestos formales empezando por `SENDA Radar v1` en modo solo-24 GHz)*.

### 5.2 Restricción de Sustancias Peligrosas — **RoHS**
- **Base legal oficial**: **Directiva 2011/65/UE (RoHS 2)** modificada por la **Directiva Delegada (UE) 2015/863** (10 sustancias restringidas: $\text{Pb}, \text{Hg}, \text{Cd}, \text{Cr}^{6+}, \text{PBB}, \text{PBDE}, \text{DEHP}, \text{BBP}, \text{DBP}, \text{DIBP}$; <https://eur-lex.europa.eu/eli/dir_del/2015/863/oj>).
- **Ejecución práctica**: recopilar y archivar durante 10 años las declaraciones RoHS de cada SKU (`TinyTronics` / `Seeed` / `Ai-Thinker` / `Sensirion` / `Bosch` / `PKCELL` / `AzureFilm`) y emplear exclusivamente **soldadura libre de plomo `SAC305` ($\text{Sn96.5Ag3.0Cu0.5}$)** en el montaje.
- **Coste documental propio**: `0 €` si todos los subcomponentes aportan certificado RoHS trazable por lote; ensayo químico XRF adicional en laboratorio: **`no verificado`**.

### 5.3 Residuos de Aparatos Eléctricos y Electrónicos (**RAEE**) y Reglamento Europeo de Baterías
- **Base legal oficial RAEE**: **Directiva 2012/19/UE (WEEE)** y, en España, **Real Decreto 110/2015** (<https://www.boe.es/eli/es/rd/2015/02/20/110>).
  - Obligaciones antes de vender la primera unidad: (1) inscripción como productor de AEE (categoría 6: *aparatos de informática y telecomunicaciones pequeños $\le 50\text{ cm}$*) en el **Registro Integrado Industrial (`RII-AEE`)** del Ministerio de Industria (trámite administrativo público gratuito), (2) adhesión a un Sistema Colectivo de Responsabilidad Ampliada del Productor (**SCRAP**, p. ej. Ambilamp, Ecoasimelec/Recyclia o Ecolec), (3) impresión del **símbolo del contenedor tachado con barra inferior negra (UNE-EN 50419)** en carcasa/etiqueta y (4) desglose e informe trimestral de unidades y kilogramos puestos en el mercado.
  - **Cuota anual de adhesión y ecovalor SCRAP**: **`no verificado`** *(depende del SCRAP elegido, tramo mínimo anual y masa exacta declarada)*.
- **Base legal oficial de Baterías**: **Reglamento (UE) 2023/1542** sobre las pilas y baterías y sus residuos (<https://eur-lex.europa.eu/eli/reg/2023/1542/oj>) y transporte **ONU `UN 38.3`**:
  - Exigir informe de ensayo **`UN 38.3`** completo al proveedor de las celdas `LP503562` / `250 mAh`, inscripción en la sección de pilas/acumuladores del Registro Integrado Industrial y diseño que permita al usuario final **sustituir la batería con herramientas comunes** (cumplido: conector JST y 2/4 tornillos `M2.5`, sin pegamento estructural permanente).

### 5.4 Tasas oficiales verificadas de **Bluetooth SIG** (consultadas el `2026-11-26`)
- **Fuente primaria oficial**: *Bluetooth SIG Fee Schedule* (vigente desde el `01 de marzo de 2026`, <https://www.bluetooth.com/fee-schedule/>):
  - Cuota anual membresía **Adopter**: **`0 USD`**.
  - Cuota anual membresía **Contributing Adopter**: **`3.500 USD/año`**.
  - Asignación de **16-bit Company Identifier**: **`1.250 USD`** (pago único).
  - **Product Qualification Fee** (por declaración de producto): **`12.000 USD`** (*Adopter*) u **`8.000 USD`** primera cualificación del año / **`10.000 USD`** siguientes (*Contributing Adopter*).

### 5.5 Garantía legal, derecho de desistimiento y etiquetado al consumidor en España / UE
- **Garantía legal de conformidad de `3 años` en España**: **Real Decreto Legislativo 1/2007** (*TRLGDCU*, modificado por el **Real Decreto-ley 7/2021** que transpone la **Directiva (UE) 2019/771**, <https://www.boe.es/eli/es/rdlg/2007/11/16/1/con>):
  - Todo bien nuevo vendido a consumidores en España goza de **3 años de garantía legal** desde la entrega (y obligación de disponibilidad de repuestos/soporte; al ser hardware abierto con STL y componentes COTS estándar, cualquier pieza es reemplazable).
- **Derecho de desistimiento de `14 días naturales`**: **Directiva 2011/83/UE** sobre los derechos de los consumidores y arts. 102–108 del **RDL 1/2007**:
  - En ventas a distancia (web), el comprador dispone de **14 días naturales** desde la recepción para devolver el producto sin necesidad de justificación, con reembolso íntegro en un máximo de 14 días desde la notificación.
- **Trazabilidad y marcado físico obligatorio en cada unidad comercializada**:
  - Nombre comercial o razón social y **dirección postal física en la UE** del fabricante, modelo/lote/número de serie, tensión/corriente nominal (`5 V DC 0,5 A`), marcado **CE**, símbolo **RAEE** e instrucciones y advertencias de seguridad en **español** (y en la lengua oficial de cada Estado miembro de destino).
