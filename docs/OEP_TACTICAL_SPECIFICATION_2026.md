# OEP-TACTICAL: STRATEGIC TECHNICAL SPECIFICATION & TENDER BLUEPRINT
## PROGRAM: CIVIC RELAY / OEP-TACTICAL (OFFLINE EMERGENCY PROTOCOL - MULTI-DOMAIN)
### DOCUMENT REF: `CR-OEP-TAC-2026-10-MASTER`
**Classification:** RESTRICTED / DUAL-USE STRATEGIC ARCHITECTURE (EU MoDs / Interior / EDA / DIANA)  
**Parent Baseline:** `CR-VM-2026-10-25` (Truth-Verified Core Baseline)

---

## 1. RESUMEN EJECUTIVO Y ARQUITECTURA MULTI-DOMINIO

OEP-Tactical constituye la capa militar y estatal de alta resiliencia de Civic Relay. Despliega una infraestructura móvil ad-hoc (MANET) y tolerante a retardos (DTN) unificando tres dominios operativos:

1. **Dominio Aéreo ($\mathcal{V}_{\text{air}}$):** Drones cautivos (Tethered UAS) para permanencia 24h a 100-150m AGL y enjambres autónomos tácticos (PX4/ArduPilot) como mulas DTN.
2. **Dominio Terrestre Táctico ($\mathcal{V}_{\text{tac}}$):** Terminales EUD con ATAK/WinTAK, vehículos autónomos (UGV con ROS 2/DDS) y pasarelas SDR de bajo SWaP (ESP32-S3 + Semtech SX1262).
3. **Dominio Terrestre Ciudadano ($\mathcal{V}_{\text{gnd}}$):** Terminales comerciales COTS interconectados mediante Wi-Fi Aware (NAN), BLE 5.4 Coded PHY y sincronización periódica (Scheduled Rendezvous).

---

## 2. INTERFACE CONTROL DOCUMENTS (ICD)

### 2.1 ICD-001: MAVLink v2 Encapsulation (`0x0000BF`)
Encapsula micro-ráfagas binarias OEP directamente en el flujo de telemetría de autopilotos PX4 / ArduPilot:
- **STX:** `0xFD` (MAVLink v2)
- **Message ID:** `0x0000BF` (191)
- **Payload:** Estructura fija de 240 bytes que transporta paquetes OEP comprimidos y autenticados (ChaCha20-Poly1305 + Ed25519).

### 2.2 ICD-002: Adaptador Cursor-on-Target (CoT) para ATAK
Mapeo semántico biyectivo:
- `SOS_EXPLICIT` $\to$ CoT Type `b-m-p-s-m` (Distress emergency)
- `HUMAN_STATUS: SAFE` $\to$ CoT Type `a-f-G-U-C` (Friendly Ground Civilian)
- `HUMAN_STATUS: NEED_HELP` $\to$ CoT Type `a-f-G-U-C-I` (Civilian Injured)
- `SENSOR_VECTOR` $\to$ CoT Type `a-h-G-E-V-A` (Hostile/Tracked Entity)

### 2.3 ICD-003: Vector Semántico de Detección de Borde ($\le 48\text{ bytes}$)
Trama binaria compacta generada por Nvidia Jetson / Edge TPU para transmitir detecciones visuales y térmicas sobre enlaces con $BW < 1\text{ kbps}$.

---

## 3. FORMULACIÓN MATEMÁTICA Y ALGORÍTMICA

### 3.1 Modelo de Propagación ITM / A2G
$$PL_{\text{A2G}}(d, \theta) = FSPL(d) + P_{\text{LoS}}(\theta)\eta_{\text{LoS}} + (1 - P_{\text{LoS}}(\theta))\eta_{\text{NLoS}} + L_{\text{ITM}}(d, \text{terrain})$$
$$P_{\text{LoS}}(\theta) = \frac{1}{1 + a \exp(-b [\frac{180}{\pi}\theta - a])}$$

### 3.2 Optimización de Cobertura de Enjambre
$$\max_{\{\mathbf{y}_j\}} \sum_{i=1}^M \sum_{j=1}^K \alpha_{ij} w_i B_{ij} \log_2 \left(1 + \frac{P_t 10^{-PL_{\text{A2G}}(\|\mathbf{x}_i - \mathbf{y}_j\|, \theta_{ij})/10}}{\sigma^2 + I_{\text{jamming}}}\right)$$

### 3.3 Estimación EKF en Entornos GNSS-Denied
Fusión sensorial acoplada: IMU (Dead-Reckoning) + Wi-Fi RTT (IEEE 802.11mc/az) a drones ancla con clasificación de confianza:
$$\mathcal{C}_{\text{pos}} = \exp\left(-\frac{\text{Tr}(\mathbf{P}_{k, \text{pos}})}{\sigma_{\text{threshold}}^2}\right)$$

---

## 4. CÓDIGO DE REFERENCIA

- Daemon Rust para Drones: `experimental/oep-tactical/oep-air-daemon/src/main.rs`
- Conector ATAK Kotlin: `experimental/oep-tactical/atak-plugin/src/main/kotlin/com/civicrelay/oep/atak/OepCotBridgeService.kt`

Consulte la especificación completa en el artefacto de ingeniería de sistemas del proyecto.
