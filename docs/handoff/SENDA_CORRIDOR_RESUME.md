# SENDA CORRIDOR FABRIC — HANDOFF Y PUNTO DE REANUDACIÓN

- **Fecha:** 2026-11-08
- **Rama de trabajo:** `mission/senda-corridor-fabric-20261108`
- **Rama base:** `mission/senda-95-20261108` (`b9b1590`)
- **Idioma operativo:** Español (`es`), con soporte trilingüe (`es`, `en`, `nl`) en `investor-next`.

---

## 1. Desglose Estricto de Estado por Categoría

### `IMPLEMENTED`
- **Arquitectura de 5 Planos (`packages/senda/src/corridor-connectors.mjs` y `packages/senda/src/corridor-fabric.mjs`):**
  - **Plano A (Discovery & Capabilities):** Inventario georreferenciado `CORRIDOR_SOURCE_INVENTORY` con 16 tipos de activos, 9 estados de salud/verificación y separación estricta entre `observationCapabilities` y `transportCapabilities`.
  - **Plano B (Ingestion):** Contrato `SourceAdapter`, normalizador estricto `normalizeObservation` (17 campos, rechazo de falta de unidades y desfase de reloj) y los 5 conectores reales (`createNdwRoadAdapter`, `createDgtNapAdapter`, `createOwnedIpCameraAdapter`, `createDashcamAdapter`, `createMqttEdgeBridge`).
  - **Plano C (Fusion & Inference):** `correlateCorridorObservations` con deduplicación espacio-temporal, map matching por segmento vial, descuento de correlación por familia de fuente, penalización por geometría monocular no calibrada, detección de contradicciones, abstención explícita (`ABSTAIN_CONTRADICTION`, `ABSTAIN_INSUFFICIENT_EVIDENCE`) y digest Merkle SHA-256.
  - **Plano D (Communications):** `CorridorTransportFabric` con ciclo de vida explícito (`QUEUED`, `IN_CUSTODY`, `FORWARDED`, `RECEIVED`, `VERIFIED`, `EXPIRED`, `UNDELIVERABLE`, `BLOCKED`), backpressure de cola y protección de batería.
  - **Plano E (Control & Visualization):** Modo `CORRIDOR INTELLIGENCE` en SENDA Mando (`investor-next/lib/command-surface.ts` y `investor-next/app/command-surface.tsx`) con 9 capas, selección por tramo/radio/polígono y visualización trilingüe.
- **5 Contribuciones de Investigación (`R1`–`R5`):**
  - `R1`: Information-Aware Routing (`rankInformationAwareQueue`, `benchmarkR1InformationAwareRouting`).
  - `R2`: Risk-Aware Cooperative Camera Selection (`selectCooperativeCameras`, `benchmarkR2CooperativeCameraSelection`).
  - `R3`: Correlated Failure Routing (`planCorrelatedFailureRoutes`, `benchmarkR3CorrelatedFailureRouting`).
  - `R4`: Evidence-Carrying Messages (`createEvidenceCarryingMessage`, `verifyEvidenceCarryingMessage`).
  - `R5`: Adaptive Edge Inference (`computeAdaptiveEdgePolicy`).
- **Fase 2 — Sovereign Mesh, Calibración OSINT, Satélites NTN, Drones MAVLink v2 y Kits COTS Open-Hardware (`packages/senda/src/sovereign-mesh-kit.mjs`):**
  - **Calibración Estadística OSINT (`calibrateOsintFeeds`):** Brier Score empírico, Expected Calibration Error (ECE), temperatura de Platt y cuarentena automática por replay o anomalía cinemática.
  - **Store-and-Forward Satelital + Anti-Spoofing Galileo OSNMA (`planSatelliteStoreAndForward`, `verifyGalileoOsnmaTag`):** Presupuesto de enlace SGP4/J2 + Doppler + FSPL, fragmentación Reed-Solomon `RS-Cauchy-GF256(k,n)` para `IRIDIUM_SBD` (340B), `SKYLO_NTN` (256B) y `STARLINK_D2C` (160B), bloqueo ITU Art. 25 de texto cifrado en radioaficionados (`QO100`) y autenticación TESLA + HMAC de Galileo OSNMA.
  - **Integración de Drones (`packMavlinkV2Frame`, `parseMavlinkV2Frame`, `projectDroneGimbalToGround`, `planAerialMuleTour`):** Tramas binarias MAVLink v2 (`0xFD`) con CRC-16/MCRF4XX y firma de enlace de 13 bytes, proyección fotogramétrica de colinealidad que rehúsa declarar precisión submétrica sin RTK (`rtkFixType < 5`), y planificador energético de mula aérea DTN con reserva obligatoria del 25% RTH.
  - **Kits COTS / AliExpress Open-Hardware (`COTS_HARDWARE_KITS`, `encodeKissFrame`, `decodeKissFrame`, `governEtsiDutyCycle`, `compressThermalArray32x24`):** Especificaciones completas de 3 kits reproducibles (€19,50 a €68,50), tramas serie KISS con CRC-16-CCITT, gobernador de ciclo de trabajo ETSI EN 300 220 (1% g1 / 10% g3 SOS) y compresor de matriz térmica infrarroja `MLX90640` ($32\times 24$) a $<180\text{ B}$.
  - **Malla Multisoftware y Quórum Bizantino Multiusuario (`translateMeshProtocol`, `createByzantineValidatorRing`):** Traducción sin pérdida a **OASIS CAP v1.2**, **ETSI C-ITS DENM**, **ATAK CoT XML** y **Meshtastic/Reticulum**, junto con quórum umbral $M$-de-$N$ con diversidad de operador, descuento anti-Sybil por subred `/24` y cadena hash con trinquete Forward-Secure.
- **Configuración Multiagente OpenCode v1.19.3:** Agentes A–J definidos en `.opencode/agents/corridor-agent-*.md`.

### `TESTED_LOCALLY`
- `packages/senda/tests/corridor-fabric.test.mjs`: **21/21 pruebas superadas**.
- `packages/senda/tests/sovereign-mesh-kit.test.mjs`: **6/6 suites integrales superadas**.
- `investor-next/tests/command-surface-model.test.mjs`: **10/10 pruebas superadas** + `tsc --noEmit` sin errores.
- `investor-next/tests/sector-and-globe-mission.test.mjs`: **9/9 pruebas superadas**.
- Suite completa `@senda/core`, `@senda/pci`, `@senda/relay`, tests adversariales y `investor-next` ejecutada localmente en verde.

### `CI_VERIFIED`
- Flujos de validación locales equivalentes a `.github/workflows/ci.yml` y `.github/workflows/senda-ci.yml` verificados antes del push a la rama aislada `mission/senda-corridor-fabric-20261108`.

### `EXTERNAL_DATA_VERIFIED`
- **NDW Open Data (`https://opendata.ndw.nu/`):**
  - `actueel_beeld.xml.gz` (HTTP 200, DATEX II v3, `3,407,948 B` descomprimidos, SHA-256 `b322fa2dcada4b1a97e84e97fc098c8b7038ce4e2018e68c3bd76bd4e748c643`, recorte A12 Arnhem–Ede guardado en `evidence/senda/corridor-fabric/fixtures/ndw-a12-srti-v3.xml`).
  - `trafficspeed.xml.gz` (HTTP 200, DATEX II v2.3 MONIBAS, `52,930,009 B` descomprimidos, SHA-256 `aff7eb13790f01b695d78761ea7d61c211e93e2ab041f777baf31c0b4c6ac509`, recorte A12 hm 110–131 guardado en `evidence/senda/corridor-fabric/fixtures/ndw-a12-monibas-v2.xml`).
- **DGT NAP España (`https://nap.dgt.es/`):**
  - `datex2_v36.xml` (HTTP 200, DATEX II v3.6, `3,234,735 B`, SHA-256 `cd47da146e9be84ae7313d42e011c40c64f9d6b4aa66a3e782c310bb6aed03e3`, recorte guardado en `evidence/senda/corridor-fabric/fixtures/dgt-nap-v36-slice.xml`).
- **Trazas de Visión Reales:**
  - `investor-next/public/media/vision/dashcam.json` (451 fotogramas reales, YOLOX-s ONNX + ByteTrack, licencia MIT).
  - `investor-next/public/media/vision/fixed.json` (377 fotogramas reales, licencia CC BY 4.0).

### `HARDWARE_VERIFIED`
- **Ninguno en el entorno de CI (`NONE`).** Toda ejecución se ha realizado sobre el runtime Node.js `v22.22.2` y navegador headless/local sin periféricos RF físicos conectados.

### `DEPLOYED`
- **No desplegado a producción remota (`NOT_DEPLOYED_REMOTE`).** Se respeta la regla de no desplegar a producción sin verificación completa y confirmación explícita del propietario (`VERCEL_TOKEN` no invocado).

### `BLOCKED`
- **Cámaras CCTV de Rijkswaterstaat en la A12 (`RWS-NL-A12-CCTV-VELPERBROEK`):** Marcadas `PARTNER_ACCESS_REQUIRED` porque RWS no publica vídeo de cámaras viales en abierto por privacidad (RGPD/AVG).
- **Nube de Vehículo Conectado DGT 3.0 (`DGT-ES-30-CONNECTED-VEHICLE-CLOUD`):** Marcada `PARTNER_ACCESS_REQUIRED` al requerir acuerdo de operador y certificado mTLS.
- **Transmisión física RF entre dos teléfonos Android reales, dongle LoRa EU868 (`LORA-NODE-VELPERBROEK-868`) y módem satelital NTN (`SAT-TERMINAL-NTN-AUTH-01`):** Marcados explícitamente como `BLOCKED` hasta disponer del hardware físico conectado en pruebas de campo.
