# SENDA COOPERATIVE INFERENCE — CONTRIBUCIONES DE INVESTIGACIÓN R1–R5

- **Implementación:** [`packages/senda/src/corridor-fabric.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/corridor-fabric.mjs)
- **Pruebas y benchmarks:** [`packages/senda/tests/corridor-fabric.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/corridor-fabric.test.mjs)
- **Artefacto de verificación:** [`evidence/senda/corridor-fabric/corridor-fabric-verification.json`](file:///c:/Users/2fabr/civic-relay/evidence/senda/corridor-fabric/corridor-fabric-verification.json)

---

## 1. R1 — Information-Aware Routing (`rankInformationAwareQueue`)

### Formulación
En enlaces DTN oportunistas con presupuesto de bytes severamente limitado ($B_{\max}$), el enrutamiento estático por prioridad o FIFO agota la ventana de contacto transmitiendo alertas redundantes sobre un tramo vial ya conocido con alta certeza.

Sea $p_{\text{old}}(s)$ la probabilidad previa conocida en el segmento vial $s$ tras $c_s$ corroboraciones entregadas, y $p_{\text{new}}(m)$ la confianza posterior aportada por el mensaje $m$ de tamaño $|m|$ bytes. Definimos la densidad de ganancia marginal de información:

$$\mathcal{I}(m) = \frac{D_{\text{KL}}\!\left(p_{\text{new}}(m) \parallel p_{\text{old}}(s)\right) \cdot (1 + 0.8\,c_s)^{-1}}{\log_2 |m|}$$

El índice de programación R1 garantiza prioridad absoluta a mensajes `SOS` ($\mathbb{I}_{\text{SOS}} \cdot 1000$) y ordena el resto por $10 \cdot \text{prio}(m) + 45 \cdot \mathcal{I}(m)$.

### Comparación frente a Baseline (Presupuesto $B_{\max} = 1250\text{ B}$)
| Métrica | Baseline Estático / FIFO | R1 Information-Aware Routing |
|---|---|---|
| Mensajes SOS entregados | `1 / 1` (100%) | `1 / 1` (100%) |
| Tramos viales únicos cubiertos | `2` (`BARRIO-ACCESO-NORTE-01`, `NL-A12-HM110-130`) | **`3`** (`BARRIO-ACCESO-NORTE-01`, `NL-A12-HM126-VELPERBROEK`, `NL-A12-HM110-130`) |
| Ganancia de información útil (bits) | `2.6512 bits` | **`4.1325 bits` (+55.9%)** |

---

## 2. R2 — Risk-Aware Cooperative Camera Selection (`selectCooperativeCameras`)

### Formulación
Consultar indiscriminadamente todas las cámaras de un corredor satura el enlace, agota baterías de nodos móviles y viola restricciones de acceso/licencia. Para cada cámara candidata $i$, se evalúa su elegibilidad legal ($\text{health}_i \notin \{\text{CATALOG\_ONLY}, \text{PARTNER\_ACCESS\_REQUIRED}, \text{PERMISSION\_PENDING}\}$, batería $\ge B_{\min}$) y su utilidad neta:

$$U_i = \exp\!\left(-\frac{d_i}{1200}\right) \cdot \min\!\left(1, \frac{V_i}{1000}\right) \cdot \alpha_{\text{orient}, i} \cdot \phi_{\text{fresh}, i} - C_{\text{bw}, i} - C_{\text{batt}, i}$$

### Comparación frente a Baseline ("Consultar Todas")
| Métrica | Baseline (Query-All) | R2 Cooperative Selector |
|---|---|---|
| Cámaras seleccionadas | `5` | `2` (`DASHCAM-A12-REAL-TRACE-01`, `CAM-AUTHORIZED-FLEET-02`) |
| Consumo de ancho de banda | `2580 kbps` | **`300 kbps` (-88.4% ahorro)** |
| Consultas a fuentes sin permiso / restringidas | `2` (violación de política) | **`0` (100% bloqueadas preventivamente)** |

---

## 3. R3 — Correlated Failure Routing (`planCorrelatedFailureRoutes`)

### Formulación
Dos rutas de comunicación que parecen distintas en la capa de transporte suelen compartir infraestructura física subyacente (p. ej., la misma troncal de fibra `INFRA-NL-KPN-FIBER-ARNHEM` o la misma red eléctrica `INFRA-NL-ALLIANDER-GRID-GELDERLAND`). Si el conjunto de dependencias compartidas entre la ruta primaria $A$ y la de respaldo $B$ es $S = D_A \cap D_B$, la probabilidad real de fallo conjunto es:

$$P(\text{Fail}_A \cap \text{Fail}_B) = \left(1 - \prod_{e \in S}(1 - q_e)\right) + \left(\prod_{e \in S}(1 - q_e)\right) P(\text{Fail}_{A \setminus S}) P(\text{Fail}_{B \setminus S})$$

mientras que el estimador ingenuo asume erróneamente $P_{\text{naive}}(\text{Fail}_A \cap \text{Fail}_B) = P(\text{Fail}_A) P(\text{Fail}_B)$.

### Comparación frente a Baseline Ingenuo
- **Par con dependencias compartidas (`ROUTE-CELL-KPN-PRIMARY` + `ROUTE-FIBER-RELAY-VELPERBROEK`):** Comparte fibra y red eléctrica; el estimador ingenuo sobreestima la supervivencia conjunta con un error de sesgo de optimismo significativo.
- **Par diverso seleccionado por R3 (`ROUTE-FIBER-RELAY-VELPERBROEK` + `ROUTE-OPPORTUNISTIC-NEARBY-P2P`):** `sharedDependencies = []` ($S = \emptyset$), logrando una supervivencia conjunta real del **`94.84%`**.

---

## 4. R4 — Evidence-Carrying Messages (`createEvidenceCarryingMessage`)

### Formulación
Vincula el descriptor compacto del incidente (`incidentId`, `roadSegmentId`, `incidentType`, `approximateLocation`, `uncertaintyInterval90`, `corroboratingSources`, `sourcePayloadHashes` y `provenanceMerkleDigestSha256`) y su hash canónico SHA-256 dentro de un sobre AEAD SENDA v2 (`sealMessage` con ECDH P-256 + HKDF-SHA-256 + AES-256-GCM + firma ECDSA P-256 + `ackHash` de recibo).

### Resultados Verificados
- Tamaño en cable binario (`packEnvelope`): **`642 B`** en Piloto A y **`596 B`** en Piloto B (más de 1000 veces menor que transmitir un clip de vídeo, manteniendo verificación criptográfica completa de extremo a extremo).
- Cualquier alteración de un solo bit en el payload o en el `canonicalEvidenceHash` es rechazada de forma determinista (`BAD_SIGNATURE` / `EVIDENCE_DIGEST_MISMATCH`).

---

## 5. R5 — Adaptive Edge Inference (`computeAdaptiveEdgePolicy`)

### Formulación
Controlador dinámico en borde que adapta resolución, FPS, modelo de visión y cadencia de transmisión en función de `(batteryPct, cpuLoadPct, temperatureC, packetLossRatio, urgencyLevel)`.

### Comparación frente a Baseline Fijo (`1920x1080 @ 30 fps`)
| Régimen Operativo | Resolución / FPS | Modelo Activo | Cómputo (GFLOPs/s) | Tráfico (B/min) | Ahorro Cómputo / Red |
|---|---|---|---|---|---|
| **Baseline Fijo** | `1920x1080 @ 30 fps` | Completo | `67.500` | `84,000 B/min` | `0% / 0%` |
| **R5 Batería Baja (`12%`)** | `320x240 @ 1 fps` | `KOSCHMIEDER_DARK_CHANNEL_ONLY` | `0.004` | `720 B/min` | **`99.9% / 99.14%`** |
| **R5 Urgencia `CRITICAL_SOS`** | `1280x720 @ 15 fps` | `YOLOX_S_ONNX_BYTETRACK` | `15.000` | `25,200 B/min` | **`77.8% / 70.00%`** |
