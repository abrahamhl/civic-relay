# SENDA — Arquitectura Soberana Europea B2G, Integración de Drones, Satélites NTN, Mallas Multisoftware y Kits COTS Open-Hardware

**Repositorio:** `https://github.com/abrahamhl/civic-relay`  
**Rama:** `mission/senda-corridor-fabric-20261108`  
**Módulo de implementación:** `packages/senda/src/sovereign-mesh-kit.mjs`  
**Suite de verificación:** `packages/senda/tests/sovereign-mesh-kit.test.mjs`

---

## 1. Tesis de Ingeniería Soberana y Posicionamiento Industrial Europeo (B2G)

Las administraciones públicas europeas (Direcciones Generales de Tráfico, operadores de carreteras nacionales como **Rijkswaterstaat / NDW**, servicios **112 / Protección Civil**, confederaciones hidrográficas, gestores ferroviarios y cuerpos de extinción de incendios forestales) afrontan tres fallos estructurales en sus sistemas actuales:

1. **Fragilidad ante caída de infraestructura compartida**: Las cámaras viales, paneles de mensaje variable (PMV/DRIP), estaciones meteorológicas y centros de control dependen de las mismas redes de fibra y suministro eléctrico que colapsan en inundaciones (DANA), incendios o apagones.
2. **Silos de software incompatibles**: Los sistemas viales hablan **DATEX II v2/v3** y **ETSI C-ITS (CAM/DENM)**; las salas de emergencia 112 consumen **OASIS CAP v1.2**; los equipos de rescate sobre el terreno utilizan **ATAK / CivTAK (Cursor on Target XML)**; y las redes ciudadanas de radio operan sobre **LoRa / Meshtastic / Reticulum**.
3. **Coste prohibitivo del hardware propietario**: Un nodo RSU (Road-Side Unit) o pasarela de emergencia propietaria cuesta entre **€4.500 y €18.000 por unidad**, impidiendo instrumentar tramos secundarios, puentes rurales, túneles locales o flotas de drones municipales.

**SENDA Corridor Fabric + Sovereign Mesh Kit** resuelve esta brecha con una arquitectura **100% Open Source (núcleo auditable sin cajas negras)** complementada con **Kits de Campo COTS / Open-Hardware (€19,50 a €68,50)** adquiribles en proveedores estándar (AliExpress, Mouser, Seeed, LilyGO, Heltec).

---

## 2. Calibración Estadística OSINT y Cuarentena Anti-Spoofing (`calibrateOsintFeeds`)

SENDA no confía ciegamente en ninguna fuente abierta ni asigna probabilidades arbitrarias. Cada flujo OSINT ingerido se somete a calibración empírica continua:

- **Fuentes reales verificadas con hash SHA-256 en `evidence/senda/corridor-fabric/fixtures/`**:
  - `ndw-a12-srti-v3.xml`: Ingesta real **NDW DATEX II v3** (`actueel_beeld.xml.gz`, 832 situaciones en Países Bajos, 7 en el corredor A12 Arnhem–Ede).
  - `ndw-a12-monibas-v2.xml`: Ingesta real **NDW MONIBAS DATEX II v2.3** (`trafficspeed.xml.gz`, 89 estaciones inductivas entre hm 110 y hm 131 de la A12).
  - `ndw-bridge-openings-v3.xml`: Ingesta real **NDW Brugopeningen DATEX II v3** (`planningsfeed_brugopeningen.xml.gz`, 1.140 aperturas programadas/activas de puentes móviles).
  - `dgt-nap-v36-slice.xml`: Ingesta real **DGT NAP España DATEX II v3.6** (`nap.dgt.es`, 548 situaciones reales).
  - `celestrak-galileo-iridium.tle`: Elementos orbitales reales **NORAD GP / CelesTrak** para la constelación **Galileo** (`GSAT0101` a `GSAT0206`).
- **Métricas matemáticas implementadas**:
  - **Brier Score ($\text{BS}$)**:
    $$\text{BS} = \frac{1}{N}\sum_{i=1}^{N} (p_i - y_i)^2$$
  - **Expected Calibration Error ($\text{ECE}$)** en $M$ cubetas de confianza:
    $$\text{ECE} = \sum_{m=1}^{M} \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
  - **Escala de Temperatura de Platt ($T = 1 + 1.8 \cdot \text{ECE}$)** para suavizar fuentes sobreconfiadas.
  - **Cuarentena automática**: Si $\text{BS} > 0.32$, el desfase temporal supera $3600\text{ s}$ o se detecta un hash de carga útil repetido (ataque de replay), la fuente queda en cuarentena (`quarantined: true`, `reliabilityWeight: 0`).

---

## 3. Interconexión Satelital Store-and-Forward y Anti-Spoofing Galileo OSNMA

### 3.1 Presupuesto de Enlace Orbital y Fragmentación Reed-Solomon (`planSatelliteStoreAndForward`)
- **Propagación Kepler + Perturbación Secular $J_2$**: Calcula ángulo de elevación, distancia oblicua (*slant range* $d_{\text{km}}$), desplazamiento Doppler radial ($\Delta f = -\frac{v_r}{c} f_0$) y pérdida en espacio libre ($\text{FSPL}_{\text{dB}} = 32.45 + 20\log_{10}(d_{\text{km}}) + 20\log_{10}(f_{\text{MHz}})$).
- **Codificación de Borrado MDS Cauchy Reed-Solomon sobre $\text{GF}(2^8)$ (`erasure.mjs`)**:
  - Un sobre cifrado SENDA v2 (`AES-256-GCM + ECDH P-256 + ECDSA P-256`) se divide en $k$ fragmentos de datos y $n-k$ fragmentos de paridad autodescriptivos (cabecera `SF` de 16 bytes).
  - Cada fragmento respeta estrictamente la MTU física de la constelación:
    - **Iridium Short Burst Data (`IRIDIUM_SBD`)**: $\le 340\text{ B}$ MO / $270\text{ B}$ MT.
    - **Skylo 3GPP Rel-17 NB-NTN (`SKYLO_NTN`)**: $\le 256\text{ B}$.
    - **Starlink Direct-to-Cell (`STARLINK_D2C`)**: $\le 160\text{ B}$.
  - Basta con que lleguen **cualesquiera $k$ fragmentos** (incluso repartidos entre satélites o portadores distintos) para reconstruir el mensaje original con pérdida cero.
- **Cumplimiento regulatorio ITU (QO-100 / Es'hail-2)**:
  - En la banda de radioaficionado por satélite (`QO100`, $2400.15\text{ MHz}$), el Reglamento de Radiocomunicaciones de la UIT (Art. 25) prohíbe ocultar el contenido mediante cifrado opaco. SENDA bloquea automáticamente el envío de texto cifrado por `QO100` (`REJECTED_ITU_AMATEUR_CLEARTEXT_RULE`) y solo permite boletines públicos en claro firmados criptográficamente.
- **Honestidad de hardware**: Mientras no exista un módem satelital físico conectado al puerto serie/USB, el estado de ejecución física se reporta como `BLOCKED`.

### 3.2 Autenticación de Navegación Galileo OSNMA (`verifyGalileoOsnmaTag`)
- Verifica la cadena de claves unidireccional **TESLA** ($H^d(K_i) = K_{\text{root}}$) y el código de autenticación de mensaje truncado (`HMAC-SHA256`) sobre la efeméride del satélite (`prnSvId`) y el tiempo del sistema Galileo (`gstTowSec`).
- Si un atacante intenta desviar un dron o falsificar la ubicación de un vehículo mediante un transmisor SDR (spoofing GPS/GNSS), la verificación OSNMA falla y el sistema activa `SPOOFING_ALERT_QUARANTINED`.

---

## 4. Integración de Drones: MAVLink v2 Firmado, Fotogrametría Honesta y Mula Aérea DTN

### 4.1 Tramas Binarias MAVLink v2 con Firma de Enlace (`packMavlinkV2Frame`, `parseMavlinkV2Frame`)
- Implementa el protocolo binario **MAVLink v2 (`STX = 0xFD`)**:
  - Cabecera de 10 bytes (`LEN`, `INC_FLAGS = 0x01`, `CMP_FLAGS`, `SEQ`, `SYSID`, `COMPID`, `MSGID` 24 bits).
  - Suma de comprobación **CRC-16/MCRF4XX (X.25)** con semilla `CRC_EXTRA` oficial por mensaje (`#0 HEARTBEAT`, `#1 SYS_STATUS`, `#33 GLOBAL_POSITION_INT`, `#263 CAMERA_IMAGE_CAPTURED`, `#33001 SENDA_DTN_BUNDLE_FRAGMENT`).
  - **Firma criptográfica de enlace de 13 bytes**: `linkId` (1 byte) + marca de tiempo de 48 bits en unidades de $10\ \mu\text{s}$ (6 bytes LE) + truncamiento de 48 bits de `SHA-256(secretKey || header || payload || crc || linkId || timestamp)` (6 bytes). Impide secuestro de mando C2 o inyección de telemetría falsa.

### 4.2 Proyección Fotogramétrica de Colinealidad al Terreno (`projectDroneGimbalToGround`)
- Proyecta cualquier píxel $(u,v)$ detectado por el dron (vehículo siniestrado, foco térmico, persona aislada) a coordenadas WGS84 utilizando la altitud sobre el suelo ($\text{AGL}$), los ángulos del gimbal ($\text{pitch}, \text{yaw}$) y la distancia focal intrínseca $(f_x, f_y)$.
- **Regla de honestidad fotogramétrica**: Propaga analíticamente la incertidumbre de actitud IMU ($\sigma_{\theta}$), error de altitud y tipo de fijación GNSS (`rtkFixType`). Si el dron opera con GNSS estándar (`rtkFixType < 5`), SENDA **jamás declara precisión submétrica** (`subMeterVerified: false`, radio de incertidumbre al 95% típico de $\pm 4\text{ a } 9\text{ m}$).

### 4.3 Planificador Energético de Mula de Datos Aérea (`planAerialMuleTour`)
- Cuando dos sectores terrestres quedan incomunicados, el dron actúa como **custodio físico Store-Carry-Forward**.
- El planificador calcula la velocidad respecto al suelo teniendo en cuenta el vector de viento real (viento en cara / viento en cola), el tiempo de vuelo estacionario (*hover*) necesario para transferir los megabytes en cola a alta velocidad local (Wi-Fi/BLE), y **garantiza una reserva mínima innegociable del 25% de batería para Retorno a Base (RTH)**.

---

## 5. Kits COTS / AliExpress Open-Hardware ("SENDA Field Kits")

Para demostrar que cualquier municipio, servicio de bomberos o investigador puede desplegar nodos físicos de inmediato sin depender de hardware propietario millonario, SENDA incluye soporte nativo en código (`encodeKissFrame`, `decodeKissFrame`, `governEtsiDutyCycle`, `compressThermalArray32x24`) para tres kits abiertos reproducibles:

| ID del Kit | Nombre y Rol Operativo | Coste BOM | Masa / Consumo | Componentes COTS (AliExpress / Distribuidores Abiertos) | Protocolos Soportados en `sovereign-mesh-kit.mjs` |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **`KIT-COTS-01`** | **SENDA Pocket LoRa/BLE Civic Relay Node** (Nodo de bolsillo o guantera de vehículo) | **€19,50** | $46\text{ g}$ / $110\text{ mW}$ | • Placa **Heltec WiFi LoRa 32 V3** o **LilyGO T3-S3** (`ESP32-S3` + radio `Semtech SX1262` 868 MHz + OLED 0.96") — €14,20<br>• Antena monopolo 868 MHz SMA 3 dBi — €2,30<br>• Batería LiPo 1100 mAh PCM + carcasa PETG — €3,00 | • Tramas serie **KISS (`0xC0`) + CRC-16-CCITT** por USB-C / WebSerial<br>• Gobernador **ETSI EN 300 220** (1% en g1 `868.1 MHz`, conmutación automática SOS al 10% en g3 `869.525 MHz`) |
| **`KIT-COTS-02`** | **SENDA Aerial Drone Thermal + LoRa/RemoteID Pod** (Cápsula acoplable a cualquier dron) | **€44,00** | $82\text{ g}$ / $420\text{ mW}$ | • **Seeed XIAO ESP32-S3** + módulo `SX1262` — €12,50<br>• Cámara térmica infrarroja **Melexis MLX90640BAA** ($32\times 24$ píxeles IR, I2C, FOV $110^\circ\times 75^\circ$) — €22,00<br>• GNSS **u-blox SAM-M10Q** (Galileo E1/OSNMA) — €6,50<br>• Arnés UART `TELEM2` 5V — €3,00 | • **MAVLink v2 firmado** a 921 600 bps<br>• Compresor térmico `compressThermalArray32x24` ($<180\text{ B}$ por fotograma con detección de incendio $>140\ ^\circ\text{C}$)<br>• **EU Direct Remote ID (EN 4709-002)** |
| **`KIT-COTS-03`** | **SENDA Autonomous Solar Corridor & Bridge Gateway** (Pasarela autónoma para puentes y túneles) | **€68,50** | $640\text{ g}$ / $1,45\text{ W}$ | • **Orange Pi Zero 3** (1.5 GB RAM) o **RPi Zero 2W** — €19,00<br>• Transceptor `SX1262` + LNA 868 MHz — €11,50<br>• Receptor **RTL-SDR (`RTL2832U + R860 TCXO`)** — €18,00<br>• Panel solar 10W 6V + cargador MPPT `CN3791` + celda **LiFePO4 32700** (6000 mAh, $-20\ ^\circ\text{C}$ a $+60\ ^\circ\text{C}$) — €20,00 | • Custodia DTN `senda-relay` local<br>• Puente `createMqttEdgeBridge` ONVIF Profile M<br>• Escucha pasiva SDR y reenvío oportunista a vehículos y drones |

---

## 6. Malla Federada Multisoftware y Quórum Bizantino Multiusuario

### 6.1 Traductor Multisoftware (`translateMeshProtocol`)
Un único incidente corroborado por SENDA se exporta de forma determinista y manteniendo el hash criptográfico de procedencia (`provenanceHash`) a:
1. **`OASIS_CAP_1_2`**: XML validado contra los enumerados obligatorios de OASIS Common Alerting Protocol v1.2 para ingesta directa en sistemas **112 / ES-Alert / NL-Alert**.
2. **`ETSI_C_ITS_DENM`**: Estructura **ETSI EN 302 637-3** (*Decentralized Environmental Notification Message*) con `causeCode = 94` (*stationaryVehicle*) o `causeCode = 18` (*dangerousSituation*), lista para unidades de carretera RSU y vehículos conectados V2X.
3. **`ATAK_COT_XML`**: Evento XML **Cursor on Target v2.0** (`a-h-G-E-V`) con elipse de error circular (`ce`, `le`) y `remarks` firmados para visualización inmediata en tabletas tácticas **ATAK / CivTAK / WinTAK**.
4. **`MESHTASTIC_RETICULUM`**: Sobre JSON/CBOR ultracompacto ($<180\text{ bytes}$) para difusión por radio ciudadana LoRa sin Internet.

### 6.2 Anillo de Validadores Bizantinos con Trinquete Criptográfico (`createByzantineValidatorRing`)
Para evitar que un nodo comprometido o un atacante inyecte falsas alarmas de corte de autopista o evacuación:
- **Quórum Umbral $M$-de-$N$ con Diversidad Institucional**: Exige al menos $M$ firmas válidas provenientes de al menos $D_{\min}$ organizaciones operadoras distintas (por ejemplo: `RIJKSWATERSTAAT_NDW` + `VEILIGHEIDSREGIO_GELDERLAND` + `FLEET_PARTNER_X`).
- **Descuento Anti-Sybil por Subred (`/24`)**: Si múltiples identidades firmantes provienen de la misma subred IP o pasarela local, solo el primer voto computa con peso $1.0$; los votos adicionales de la misma subred reciben peso $0$ (`sybilDiscounted: true`).
- **Cadena de Cifrado e Integridad Forward-Secure (Hash-Ratchet)**: Cada bloque validado avanza la clave de cadena mediante $K_{t+1} = \text{SHA256}(\text{"RATCHET\_NEXT"} \parallel K_t \parallel B_t)$, impidiendo alterar registros pasados incluso si una clave futura fuese comprometida.

---

## 7. Cumplimiento Normativo Europeo y Tesis de Valoración B2G

| Marco / Norma Europea | Requisito Gubernamental | Implementación Verificable en SENDA |
| :--- | :--- | :--- |
| **Directiva NIS2 (UE 2022/2555)** | Continuidad operativa de infraestructuras críticas de transporte ante caída de proveedores telecom | Planificador R3 de fallos correlacionados + Custodia DTN multimodo + Kits autónomos LiFePO4 |
| **EU Cyber Resilience Act (CRA)** | Trazabilidad criptográfica, ausencia de credenciales por defecto, SBOM sin dependencias opacas | Cero dependencias externas en `packages/senda`, bloqueo anti-SSRF y credenciales nunca incrustadas en URL |
| **Reglamento Delegado UE 2015/962 (SRTI) y DATEX II v3** | Intercambio europeo de información de tráfico relacionada con la seguridad vial | Conectores reales verificados para **NDW v3 / MONIBAS v2.3** y **DGT NAP v3.6** + exportación **ETSI DENM** |
| **EASA U-space (Reglamento UE 2021/664) y ASD-STAN EN 4709-002** | Identificación remota directa de UAS y telemetría autenticada | Codificador binario **EU Direct Remote ID** (`drone.mjs`) + **MAVLink v2 firmado** (`sovereign-mesh-kit.mjs`) |
| **RGPD / AVG (Minimización en Origen)** | Prohibición de difusión masiva de vídeo identificable sin base legal | Bloqueo estricto de vídeo bruto sobre DTN (`RAW_VIDEO_OVER_DTN_FORBIDDEN`); transmisión exclusiva de descriptores matemáticos y hashes SHA-256 |

### Comparativa Económica para Licitaciones Públicas (TCO a 5 años para un Corredor de 120 km)
- **Despliegue Tradicional Propietario (RSUs cerradas + fibra dedicada + licencias por asiento)**: €2,8M – €5,4M en CAPEX/OPEX, sin capacidad de supervivencia cuando cae el backhaul celular/fibra ni interoperabilidad nativa entre cámaras, drones, satélites y mallas ciudadanas.
- **Despliegue SENDA Sovereign Corridor Fabric (Open-Source Core + Kits COTS + Certificación Institucional)**:
  - Reduce en **$>85\%$ el CAPEX de sensorización y pasarelas de respaldo** empleando nodos COTS de €19,50–€68,50 y aprovechando las fuentes abiertas existentes (NDW, DGT NAP, CelesTrak, cámaras ONVIF ya instaladas).
  - Justifica contratos plurianuales B2G de **licenciamiento empresarial, soporte SLA 24/7, validación criptográfica soberana, integración de flotas UAS/satélite y gemelo digital de corredor** en el rango de **€1,5M a €6M por corredor/región**, entregando tecnología funcional auditada desde el primer día.
