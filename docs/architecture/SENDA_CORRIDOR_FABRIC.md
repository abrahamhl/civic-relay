# SENDA CORRIDOR FABRIC — ARQUITECTURA DE CINCO PLANOS

- **Módulos principales:** [`packages/senda/src/corridor-connectors.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/corridor-connectors.mjs), [`packages/senda/src/corridor-fabric.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/corridor-fabric.mjs), [`investor-next/lib/command-surface.ts`](file:///c:/Users/2fabr/civic-relay/investor-next/lib/command-surface.ts), [`investor-next/app/command-surface.tsx`](file:///c:/Users/2fabr/civic-relay/investor-next/app/command-surface.tsx)

---

## 1. Visión General y Cadena Operativa de Extremo a Extremo

SENDA Corridor Fabric estructura la integración entre sensores viales, cámaras autorizadas, dashcams, vehículos y transporte resiliente DTN mediante una cadena determinista y auditable:

```text
SOURCE → INGESTION → NORMALIZATION → INFERENCE → EVIDENCE → MESSAGE → ROUTING → RECEIPT → CONSOLE
```

Principios invariantes de diseño:
1. **Separación estricta entre observación y transporte:** Una cámara CCTV fija aporta observaciones (`observationCapabilities`), pero carece de capacidades de transporte (`transportCapabilities: []`, `canActAsRelay: false`) salvo que disponga de una pasarela local independiente autorizada (`LOCAL_GATEWAY` / `DTN_RELAY`).
2. **Prohibición de representar catálogo como directo:** Los estados `CATALOG_ONLY`, `PARTNER_ACCESS_REQUIRED`, `PERMISSION_PENDING`, `UNSUPPORTED` y `SYNTHETIC` están bloqueados por validador (`validateCorridorAsset`) para no mostrarse jamás como vídeo o telemetría en vivo.
3. **Almacenamiento y custodia explícitos:** Cuando todos los enlaces IP primarios caen, no se finge entrega instantánea; el mensaje transita por estados explícitos (`QUEUED → IN_CUSTODY → FORWARDED → RECEIVED → VERIFIED`, o `EXPIRED` / `UNDELIVERABLE` / `BLOCKED`).

---

## 2. Los Cinco Planos de SENDA Corridor Fabric

### PLANO A — Discovery & Capabilities (`CORRIDOR_SOURCE_INVENTORY`)
Inventario georreferenciado con 16 tipos de activos (`CORRIDOR_ASSET_TYPES`):
- `ROAD_CAMERA`, `PRIVATE_CAMERA_AUTHORIZED`, `MUNICIPAL_CAMERA_PARTNER`, `DASHCAM`, `ANDROID_PHONE`, `VEHICLE_OBD`, `WEATHER_STATION`, `ROAD_TRAFFIC_SENSOR`, `FLOOD_SENSOR`, `RAIL_SENSOR`, `DRONE_AUTHORIZED`, `LOCAL_GATEWAY`, `DTN_RELAY`, `LORA_NODE`, `CELLULAR_BACKHAUL`, `SATELLITE_TERMINAL_AUTHORIZED`.
- Soporta selección espacial por segmento vial (`roadSegmentId`), radio geodésico Haversine (`center + radiusM`) y polígono (`polygon`).
- Registra para cada activo sus dependencias físicas compartidas (`sharedInfrastructureDeps`) para el cálculo de fallos correlacionados (R3).

### PLANO B — Ingestion (`SourceAdapter` & `normalizeObservation`)
Contrato común verificado por `validateSourceAdapter(adapter)`:
- Propiedades: `id`, `provider`, `sourceType`, `capabilities`, `permissionState`, `license`.
- Métodos: `authenticate()`, `discover()`, `health()`, `fetchObservation()`, `subscribe()`, `normalize()`, `disconnect()`, `evidence()`.
- Las operaciones no aplicables al protocolo (p. ej. `subscribe()` en feeds HTTP pull como NDW o DGT NAP) lanzan explícitamente `UNSUPPORTED_OPERATION`.
- Toda observación normalizada (`normalizeObservation`) exige 17 campos obligatorios (`observationId`, `sourceId`, `measuredAtUtc`, `receivedAtUtc`, `location`, `roadSegmentId`, `observationType`, `value`, `units`, `measurementUncertainty`, `qualityFlags`, `licenseReference`, `provenance`, `modelVersion`, `sourcePayloadHash`, `confidence`, `freshnessState`), rechazando observaciones sin unidades o con desfase de reloj (`CLOCK_SKEW_REJECTED`).

### PLANO C — Fusion & Inference (`correlateCorridorObservations`)
Motor de correlación multisensor sobre tramos viales:
- **Deduplicación espacio-temporal:** Filtra payloads repetidos por `(sourceId, observationType, sourcePayloadHash, ventana 10 s)` y descarta lecturas caducadas (`STALE`).
- **Agrupación por segmento vial y map matching:** Agrupa observaciones que comparten `roadSegmentId` y distancia geodésica dentro de `maxClusterRadiusM`.
- **Descuento de dependencia entre fuentes correlacionadas:** Agrupa las fuentes por familia de origen (`FAMILY_NDW_RWS`, `FAMILY_EGO_VEHICLE_01`, `FAMILY_BARRIO_LAB_EDGE`, `FAMILY_DGT_NAP`). La $k$-ésima observación de una misma familia recibe un factor $\gamma_k = \frac{1}{1 + 0.65(k-1)}$, evitando multiplicar probabilidades como si fueran independientes.
- **Penalización por geometría no calibrada:** Las observaciones monoculares sin calibración intrínseca/extrínseca reciben un factor $\omega_{\text{uncal}} = 0.82$.
- **Detección de contradicciones y abstención:** Si coexisten señales de flujo libre ($\ge 95\text{ km/h}$) y señales débiles de obstrucción sin alcanzar el umbral posterior, el motor devuelve `ABSTAIN_CONTRADICTION` (`abstained: true`).
- **Registro criptográfico de procedencia:** Calcula el digest Merkle SHA-256 (`merkleDigestSha256`) sobre todos los `sourcePayloadHash` ordenados de las observaciones que integran el evento.

### PLANO D — Communications (`CorridorTransportFabric`)
Grafo dinámico de portadores y custodia oportunista integrado con `envelope.mjs`:
- Separa en cada portador: `observedCoverage`, `osCapability`, `hardwareAvailability`, `authorizationState`, `realLinkQuality` (`packetLossRatio`, `latencyMs`, `throughputKbps`), `estimatedFutureAvailability` y `confirmedTransmissions`.
- Máquina de estados de ciclo de vida del mensaje:
  `QUEUED → IN_CUSTODY → FORWARDED → RECEIVED → VERIFIED` (más estados terminales/protectores `EXPIRED`, `UNDELIVERABLE` por backpressure de cola y `BLOCKED` cuando falta hardware físico).
- Incluye compuerta de protección de batería (`BATTERY_PROTECTION_GATE_ACTIVE` cuando la batería del nodo cae por debajo de `minRelayBatteryPct`).

### PLANO E — Control & Visualization (`CORRIDOR INTELLIGENCE` en SENDA Mando)
Integrado en `investor-next/lib/command-surface.ts` y `investor-next/app/command-surface.tsx`:
- Capas conmutables: `CAMERAS`, `DASHCAMS`, `ROAD DATA`, `ENVIRONMENT`, `CONNECTED DEVICES`, `GATEWAYS`, `DTN ROUTES`, `DETECTED INCIDENTS`, `EVIDENCE`.
- Modos de selección: por tramo (`SEGMENT`), por radio (`RADIUS`) o por polígono (`POLYGON`).
- Muestra insignia persistente del estado de salud/verificación en cada fuente, vídeo real autorizado (`/media/vision/dashcam.mp4` y `/media/vision/fixed.mp4`), bloqueo explícito en cámaras restringidas (`RWS-NL-A12-CCTV-VELPERBROEK`), inferencia fusionada con intervalo de incertidumbre al 90%, topología de rutas con supervivencia conjunta R3 y recibos criptográficos verificados.
