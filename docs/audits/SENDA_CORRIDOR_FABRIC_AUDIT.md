# SENDA CORRIDOR FABRIC — AUDITORÍA INICIAL E INFORME ADVERSARIAL QA (AGENT J)

- **Fecha:** 2026-11-08
- **Rama base auditada:** `mission/senda-95-20261108` (`b9b1590`)
- **Rama de trabajo aislada:** `mission/senda-corridor-fabric-20261108`
- **Versión OpenCode verificada:** `1.19.3` (10 agentes especializados `corridor-agent-a-principal` a `corridor-agent-j-qa` en `.opencode/agents/`)

---

## 1. Auditoría de Estado del Repositorio, PRs e Incidencias

### 1.1 Estado de ramas y cambios locales preservados
- **`mission/senda-95-20261108` (`b9b1590`)**: Contiene el trabajo consolidado de `@senda/pci` v0.2, el núcleo matemático `@senda/core` (61 módulos previos), el relé de custodia `@senda/relay` y el commit de preservación `1136f57` (`wip: preservar superficie mando v0.21/v0.22 y materiales locales (DeepSeek)`).
- **Árbol de trabajo local previo**: Se detectaron 32 archivos modificados y tests adversariales (`packages/senda/tests-adversarial/`, `packages/senda-pci/tests-adversarial/`, `scripts/vercel-provenance.mjs`, y activos de subtítulos/evidencia de vídeo M95). Todo ese trabajo fue preservado íntegramente en la rama `mission/senda-corridor-fabric-20261108` antes de añadir la arquitectura Corridor Fabric.

### 1.2 Revisión de PRs (#12, #13, #17, #18, #21, #22, #23) e Incidencia #19
| Referencia | Estado | Hallazgo de Auditoría |
|---|---|---|
| **PR #12** (`feat/oep-scientific-core-and-product-ui`) | MERGED | Incorporó el motor de sectores y cámaras (`sector-camera-engine.mjs`) y la separación inicial entre observación y SOS. |
| **PR #13** (`feat/oep-30s-thesis-globe-cctv-sectors`) | MERGED | Añadió los sectores piloto (El Tiemblo, Valencia, Arnhem). **Hallazgo crítico corregido en esta misión:** `CAM-NL-RWS-A325` figuraba como `PUBLIC_CATALOG_VERIFIED` (`PUBLIC_OPEN_DATA_SNAPSHOT`), pero Rijkswaterstaat (RWS) no publica imágenes de cámaras viales en abierto por privacidad (RGPD/AVG). Se ha reclasificado a `PARTNER_ACCESS_REQUIRED` / `INSTITUTIONAL_RBAC_REQUIRED`. |
| **PR #17** (`feat/senda-92-architecture-and-vision`) | MERGED | Consolidó el núcleo matemático y las trazas reales `dashcam.json` (YOLOX-s + ByteTrack, 451 fotogramas) y `fixed.json` (377 fotogramas). |
| **PR #18** (`feat/senda-96-operational-proof`) | MERGED | Incorporó el servidor `@senda/relay`, sobres AEAD v2 (`envelope.mjs`) y benchmarks DTN. |
| **Issue #19** (`Misión SENDA ≥ 9,5/10`) | OPEN | Exige trazabilidad extremo a extremo, eliminación de sobreafirmaciones y separación rigurosa entre catálogo, simulación, muestras grabadas y datos reales en vivo. |
| **PR #21** (`mission/senda-95-20261108`) | MERGED | Incorporó `@senda/pci` v0.2 (`packages/senda-pci/src/ledger.mjs`), endurecimiento criptográfico y manifiesto de entrega (`scripts/release-manifest.mjs`). |
| **PR #22** (`claude/Continue-2O2rA`) | OPEN | Rama paralela experimental de páginas estáticas; no fusionada para evitar regresiones sobre `mission/senda-95-20261108`. |
| **PR #23** (`fix/senda-honesty-and-ci`) | MERGED | Endureció CI y etiquetas de honestidad científica. |

---

## 2. Inventario Obligatorio de Fuentes y Nodos (13 Columnas)

Estados permitidos y aplicados: `LIVE_VERIFIED`, `RECORDED_REAL_SAMPLE`, `LAB_VERIFIED`, `CATALOG_ONLY`, `PARTNER_ACCESS_REQUIRED`, `PERMISSION_PENDING`, `STALE`, `UNSUPPORTED`, `SYNTHETIC`.

| SOURCE_ID | TYPE | OPERATOR | GEOLOCATION | ACCESS_RIGHTS | AUTH | ENDPOINT | SAMPLE_OBTAINED | LAST_OBSERVED_AT | HEALTH | INTEGRATION_TEST | NODE_CAPABILITIES | PROOF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NDW-NL-A12-SRTI-V3` | `ROAD_TRAFFIC_SENSOR` | Nationaal Dataportaal Wegverkeer (NDW) | 51.9852, 5.9676 (A12) | `OPEN_DATA_CC0` | `NONE_PUBLIC_HTTPS` | `https://opendata.ndw.nu/actueel_beeld.xml.gz` | YES | `2026-11-08T14:48:00.000Z` | `LIVE_VERIFIED` | `corridor-fabric.test.mjs#NDW-SRTI-V3` | `OBS:[INCIDENT_STATUS,VEHICLE_OBSTRUCTION,SRTI] / TX:[NONE]` | `evidence/senda/corridor-fabric/fixtures/ndw-a12-srti-v3.xml` (`sha256:9e40d658...`) |
| `NDW-NL-A12-MONIBAS-0121` | `ROAD_TRAFFIC_SENSOR` | NDW / Rijkswaterstaat MONIBAS | 52.0185, 5.8640 (A12) | `OPEN_DATA_CC0` | `NONE_PUBLIC_HTTPS` | `https://opendata.ndw.nu/trafficspeed.xml.gz` | YES | `2026-11-08T14:47:42.015Z` | `LIVE_VERIFIED` | `corridor-fabric.test.mjs#NDW-MONIBAS-V2` | `OBS:[TRAFFIC_SPEED_KMH,TRAFFIC_FLOW_VEH_H] / TX:[NONE]` | `evidence/senda/corridor-fabric/fixtures/ndw-a12-monibas-v2.xml` (`sha256:7d9b826d...`) |
| `RWS-NL-A12-CCTV-VELPERBROEK` | `ROAD_CAMERA` | Rijkswaterstaat Verkeerscentrum Oost-NL | 51.9814, 5.9632 (A12) | `RESTRICTED_GDPR_PARTNER_ONLY` | `PARTNER_VPN_MTLS_REQUIRED` | `urn:rws:camera:a12-velperbroek-restricted` | NO | `NONE` | `PARTNER_ACCESS_REQUIRED` | `corridor-fabric.test.mjs#RWS-CAMERA-BLOCKED-HONESTY` | `OBS:[CCTV_RESTRICTED] / TX:[NONE]` | RWS no publica cámaras de carretera en abierto por RGPD/AVG. |
| `DASHCAM-A12-REAL-TRACE-01` | `DASHCAM` | SENDA Vision Probe (YOLOX-s + ByteTrack) | 51.9860, 5.9610 (A12) | `MIT_RECORDED_REAL_SAMPLE` | `DEVICE_ED25519_SESSION` | `investor-next/public/media/vision/dashcam.json` | YES | `2026-11-08T14:40:00.000Z` | `RECORDED_REAL_SAMPLE` | `corridor-fabric.test.mjs#DASHCAM-ADAPTER` | `OBS:[VEHICLE_DETECTION,MONOCULAR_TTC,BRAKING] / TX:[BLE,WIFI_AWARE]` | `investor-next/public/media/vision/dashcam.json` (451 frames reales) |
| `OBD-A12-VEHICLE-01` | `VEHICLE_OBD` | SENDA Vehicle Link (ELM327 / CAN) | 51.9860, 5.9610 (A12) | `USER_CONSENTED_TELEMETRY` | `BLE_PIN_AND_CONSENT_TOKEN` | `local://vehicle-link/obd2-elm327` | YES | `2026-11-08T14:40:00.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#VEHICLE-LINK-OBD` | `OBS:[WHEEL_SPEED_KMH,DECELERATION_MPS2,HAZARD] / TX:[NONE]` | `packages/senda/src/vehicle-link.mjs` |
| `KNMI-NL-DEELEN-06275` | `WEATHER_STATION` | KNMI (Deelen Station 06275) | 52.0560, 5.8730 (A12/A50) | `OPEN_DATA_API_KEY_REQUIRED` | `API_KEY_PENDING` | `https://dataplatform.knmi.nl/` | NO | `NONE` | `CATALOG_ONLY` | `corridor-fabric.test.mjs#CATALOG-ONLY-GUARD` | `OBS:[METEOROLOGY_VISIBILITY_M,WIND] / TX:[NONE]` | Estación KNMI catalogada; sin API key se mantiene `CATALOG_ONLY`. |
| `NODE-ANDROID-A12-CARRIER-01` | `ANDROID_PHONE` | SENDA Android Lab Instance #1 | 51.9858, 5.9625 (A12) | `OPERATOR_OWNED_LAB_DEVICE` | `ECDSA_P256_AND_ED25519_PCI` | `local://android-nearby/service-id-senda-corridor` | YES | `2026-11-08T14:45:00.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#PILOT-A-CORRIDOR` | `OBS:[GNSS,BAROMETER,IMU] / TX:[NEARBY,WIFI_AWARE,BLE,CELL]` | `apps/senda-android/` + `envelope.mjs` (RF física en campo: `BLOCKED`) |
| `GATEWAY-A12-VELPERBROEK-RELAY` | `DTN_RELAY` | SENDA Relay Server | 51.9825, 5.9702 (A12) | `OPERATOR_OWNED_GATEWAY` | `ENVELOPE_V2_SHAPE_AND_RATE_LIMIT` | `http://127.0.0.1:8787/v1/bundles` | YES | `2026-11-08T14:48:00.000Z` | `LAB_VERIFIED` | `packages/senda-relay/tests/relay.test.mjs` | `OBS:[RELAY_QUEUE] / TX:[HTTP_CUSTODY,WS,STORE_FORWARD]` | `packages/senda-relay/server.mjs` (16 tests) |
| `CAM-LAB-BARRIO-RTSP-01` | `PRIVATE_CAMERA_AUTHORIZED` | Laboratorio SENDA (Cámara IP Propia) | 40.4168, -3.7038 (Lab) | `OWNER_EXPLICIT_AUTHORIZATION` | `DIGEST_RTSP_ENV_SECRET` | `rtsp://127.0.0.1:8554/barrio-cam-01` | YES | `2026-11-08T14:46:00.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#OWNED-IP-CAMERA-ADAPTER` | `OBS:[OCCUPANCY,KOSCHMIEDER_VIS,STOPPED_VEH] / TX:[NONE]` | `investor-next/public/media/vision/fixed.json` + adaptador RTSP |
| `EDGE-MQTT-BARRIO-BROKER-01` | `LOCAL_GATEWAY` | Laboratorio SENDA (Edge MQTT Bridge) | 40.4169, -3.7037 (Lab) | `OWNER_AUTHORIZED_EDGE_GATEWAY` | `BEARER_HMAC_TOKEN_ACL` | `mqtt://127.0.0.1:1883/senda/corridor/events` | YES | `2026-11-08T14:46:05.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#MQTT-EDGE-BRIDGE` | `OBS:[EDGE_DETECTION_EVENT] / TX:[MQTT,DTN_FORWARDER]` | `createMqttEdgeBridge` (`senda.edge-event/1.0`) |
| `NODE-ANDROID-BARRIO-PEER-01` | `ANDROID_PHONE` | Laboratorio SENDA (Nodo Móvil A) | 40.4167, -3.7039 (Lab) | `OPERATOR_OWNED_LAB_DEVICE` | `ECDSA_P256_AND_ED25519_PCI` | `local://barrio-peer-01` | YES | `2026-11-08T14:46:10.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#PILOT-B-BARRIO` | `OBS:[ACOUSTIC_HORN,IMU_SHOCK] / TX:[NEARBY,WIFI_DIRECT,BLE]` | Piloto B custodia local tras corte WAN |
| `NODE-ANDROID-BARRIO-PEER-02` | `ANDROID_PHONE` | Laboratorio SENDA (Nodo Móvil B) | 40.4172, -3.7032 (Lab) | `OPERATOR_OWNED_LAB_DEVICE` | `ECDSA_P256_AND_ED25519_PCI` | `local://barrio-peer-02` | YES | `2026-11-08T14:46:12.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#PILOT-B-BARRIO` | `OBS:[GNSS_LOCATION] / TX:[NEARBY,WIFI_DIRECT,HTTP_CUSTODY]` | Piloto B entrega y recibo E2E verificado |
| `DGT-ES-NAP-DATEX2-V36` | `ROAD_TRAFFIC_SENSOR` | Dirección General de Tráfico (DGT NAP) | 40.4120, -4.5010 (N-403) | `OPEN_DATA_LEY_37_2007` | `NONE_PUBLIC_HTTPS` | `https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml` | YES | `2026-11-08T14:47:20.973Z` | `LIVE_VERIFIED` | `corridor-fabric.test.mjs#DGT-NAP-ADAPTER` | `OBS:[INCIDENT_STATUS,ROADWORKS,WEATHER_ROAD] / TX:[NONE]` | `evidence/senda/corridor-fabric/fixtures/dgt-nap-v36-slice.xml` (`sha256:542bcd0c...`) |
| `DGT-ES-30-CONNECTED-VEHICLE-CLOUD` | `ROAD_TRAFFIC_SENSOR` | DGT 3.0 Plataforma Vehículo Conectado | 40.4120, -4.5010 (N-403) | `PARTNER_AGREEMENT_REQUIRED` | `MTLS_PARTNER_CERTIFICATE` | `urn:dgt30:partner-broker-restricted` | NO | `NONE` | `PARTNER_ACCESS_REQUIRED` | `corridor-fabric.test.mjs#DGT30-PARTNER-GUARD` | `OBS:[V16_BEACON_RESTRICTED] / TX:[NONE]` | Requiere convenio de operador DGT 3.0; nunca simulado como abierto. |
| `CAM-MUNICIPAL-ARNHEM-PARTNER-01` | `MUNICIPAL_CAMERA_PARTNER` | Gemeente Arnhem | 51.9838, 5.9122 (N325) | `MUNICIPAL_PARTNER_DSA_REQUIRED` | `OAUTH2_MTLS_PENDING` | `urn:arnhem:municipal-camera:velperplein-01` | NO | `NONE` | `PERMISSION_PENDING` | `corridor-fabric.test.mjs#INVENTORY-VALIDATION` | `OBS:[URBAN_OCCUPANCY] / TX:[NONE]` | Sin convenio municipal activo; bloqueada como vídeo en vivo. |
| `SENSOR-FLOOD-VALENCIA-SAIH-JUCAR` | `FLOOD_SENSOR` | CHJ SAIH Júcar / Rambla del Poyo | 39.4180, -0.4020 (V-31) | `PUBLIC_HYDROLOGICAL_CATALOG` | `NONE_PUBLIC_HTTPS` | `https://saih.chj.es/` | NO | `NONE` | `CATALOG_ONLY` | `corridor-fabric.test.mjs#INVENTORY-VALIDATION` | `OBS:[WATER_LEVEL_M,FLOW_M3_S] / TX:[NONE]` | Modelo en `flood-watch.mjs`; fuente SAIH catalogada (`CATALOG_ONLY`). |
| `SENSOR-RAIL-ARNHEM-PRORAIL-CAT` | `RAIL_SENSOR` | ProRail / NDOV Loket | 51.9850, 5.8990 (Arnhem) | `OPEN_CATALOG_NDOV` | `SUBSCRIPTION_KEY_REQUIRED` | `https://ndovloket.nl/` | NO | `NONE` | `CATALOG_ONLY` | `corridor-fabric.test.mjs#INVENTORY-VALIDATION` | `OBS:[LEVEL_CROSSING_STATUS] / TX:[NONE]` | Catalogado sin suscripción activa (`CATALOG_ONLY`). |
| `DRONE-SENDA-THERMAL-LAB-01` | `DRONE_AUTHORIZED` | SENDA Aerial Relay Model | 40.4090, -4.5080 (N-403) | `FLIGHT_PERMIT_REQUIRED` | `MAVLINK_SIGNED_SESSION` | `urn:senda:drone-lab-sim` | NO | `NONE` | `SYNTHETIC` | `corridor-fabric.test.mjs#INVENTORY-VALIDATION` | `OBS:[THERMAL_SYNTHETIC] / TX:[LOITER_SIMULATED]` | Modelo matemático en `drone.mjs`; etiquetado `SYNTHETIC`. |
| `LORA-NODE-VELPERBROEK-868` | `LORA_NODE` | SENDA Edge Accessory (EU868) | 51.9822, 5.9680 (A12) | `ISM_EU868_1PCT_DUTY_CYCLE` | `AES128_DEVADDR_SESSION` | `serial://usb-lora-eu868` | NO | `NONE` | `PERMISSION_PENDING` | `corridor-fabric.test.mjs#HARDWARE-BLOCKED-STATES` | `OBS:[RSSI_SNR] / TX:[LORA_ISM_EU868]` | Sin dongle físico conectado en CI: marcado `BLOCKED`. |
| `CELLULAR-BACKHAUL-KPN-ARNHEM-04` | `CELLULAR_BACKHAUL` | KPN Mobile NL | 51.9845, 5.9650 (A12) | `COMMERCIAL_SIM_CARRIER` | `SIM_AKA_TLS13` | `https://relay.senda.local/v1/bundles` | YES | `2026-11-08T14:48:00.000Z` | `LAB_VERIFIED` | `corridor-fabric.test.mjs#R3-CORRELATED-FAILURE` | `OBS:[NONE] / TX:[LTE_5G_IP_BACKHAUL]` | Portador modelado con dependencias compartidas R3. |
| `SAT-TERMINAL-NTN-AUTH-01` | `SATELLITE_TERMINAL_AUTHORIZED` | Terminal NTN 3GPP Rel-17 | 40.4110, -4.5030 (N-403) | `AUTHORIZED_NTN_SUBSCRIPTION` | `3GPP_USIM_NTN` | `urn:3gpp:ntn-l-band-sos` | NO | `NONE` | `PERMISSION_PENDING` | `corridor-fabric.test.mjs#HARDWARE-BLOCKED-STATES` | `OBS:[NONE] / TX:[NTN_SATELLITE_SOS_256B]` | Sin módem satelital físico: marcado `BLOCKED`. |

---

## 3. Informe Adversarial Independiente — AGENT J (Independent QA)

### 3.1 Hallazgos Adversariales y Correcciones Aplicadas
1. **Separación Fuente de Observación vs. Portador de Transporte:**
   - Se verificó mediante `validateCorridorAsset` que ninguna cámara CCTV fija (`ROAD_CAMERA`, `PRIVATE_CAMERA_AUTHORIZED`, `MUNICIPAL_CAMERA_PARTNER`) tenga capacidades de transporte (`transportCapabilities: []`, `canActAsRelay: false`) salvo que exista un gateway separado explícitamente registrado (`LOCAL_GATEWAY` / `DTN_RELAY`).
2. **Eliminación de Cámaras Públicas Falsas en la A12 (Rijkswaterstaat):**
   - En versiones previas de `sector-camera-engine.mjs`, `CAM-NL-RWS-A325` tenía `state: 'PUBLIC_CATALOG_VERIFIED'`. AGENT J exigió su corrección inmediata a `PARTNER_ACCESS_REQUIRED` / `INSTITUTIONAL_RBAC_REQUIRED` porque Rijkswaterstaat no publica cámaras de tráfico en abierto por RGPD/AVG. El Piloto A opera con `rwsPublicCamerasClaimed: 0`.
3. **Incertidumbre Monocular en Dashcam (Connector 4):**
   - El cálculo de distancia y TTC en `dashcam.json` depende de una altura de vehículo asumida (`carHeightM: 1.45`) y campo de visión horizontal (`hfovDeg: 65`, `focalPx: 1004.6`). El adaptador incluye de forma obligatoria `measurementUncertainty.value = 30` (±30%) y la bandera `MONOCULAR_UNCALIBRATED_WARNING`, penalizando el peso en la fusión bayesiana (`uncalibratedPenalty = 0.82`).
4. **Prohibición de Multiplicación Ingenua de Fuentes Dependientes (Plano C):**
   - Cuando el mismo vehículo aporta observaciones por `DASHCAM-A12-REAL-TRACE-01` y `OBD-A12-VEHICLE-01` (familia `FAMILY_EGO_VEHICLE_01`), el motor de fusión aplica un factor de descuento `dependencyDiscount = 1 / (1 + 0.65 * k) = 0.606` a la segunda fuente de la misma familia, y exige al menos `2` familias independientes para emitir `CONFIRMED_MULTISENSOR_INCIDENT`.
5. **Honestidad sobre Hardware Físico Ausente (`BLOCKED`):**
   - No se dispone en el entorno de ejecución de CI de dos terminales físicos Android transmitiendo por radio Bluetooth/Wi-Fi Direct en campo ni de dongles físicos LoRa EU868 o módems satelitales NTN. Toda etapa de transmisión RF física sobre hardware ausente figura explícitamente como `BLOCKED` (`HARDWARE_VERIFIED: NONE`).

### 3.2 Veredicto de AGENT J
- **Estado:** **APROBADO CON FRONTERAS HARDWARE EXPLÍCITAS (`BLOCKED` para RF física en campo)**.
- **Suite de pruebas ejecutada:** `21/21` pruebas en `packages/senda/tests/corridor-fabric.test.mjs`, `10/10` en `investor-next/tests/command-surface-model.test.mjs`, `9/9` en `investor-next/tests/sector-and-globe-mission.test.mjs`, y suite completa del monorepo en verde.
