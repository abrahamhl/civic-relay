# SENDA SOURCE MATRIX — MATRIZ DE CONECTORES REALES, LICENCIAS Y PRUEBAS

- **Implementación:** [`packages/senda/src/corridor-connectors.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/corridor-connectors.mjs)
- **Script de captura reproducible:** [`packages/senda/scripts/capture-corridor-fixtures.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/scripts/capture-corridor-fixtures.mjs)
- **Proveniencia de fixtures:** [`evidence/senda/corridor-fabric/fixtures/fixtures-provenance.json`](file:///c:/Users/2fabr/civic-relay/evidence/senda/corridor-fabric/fixtures/fixtures-provenance.json)

---

## 1. Resumen de los 5 Conectores Implementados

| Conector | Adaptador | Fuentes / Endpoints | Protocolo / Esquema | Estado de Salud | Evidencia / Hash SHA-256 |
|---|---|---|---|---|---|
| **Connector 1 — NDW Road Data** | `createNdwRoadAdapter` | `https://opendata.ndw.nu/actueel_beeld.xml.gz`, `https://opendata.ndw.nu/trafficspeed.xml.gz` | HTTPS GZIP · DATEX II v3 (`sit:SituationPublication`) + DATEX II v2.3 (`MeasuredDataPublication`) | `LIVE_VERIFIED` / `RECORDED_REAL_SAMPLE` | `ndw-a12-srti-v3.xml` (`9e40d658...`), `ndw-a12-monibas-v2.xml` (`7d9b826d...`) |
| **Connector 2 — DGT / NAP** | `createDgtNapAdapter` | `https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml` vs. DGT 3.0 | HTTPS · DATEX II v3.6 (`levelC/schema/3`) | `LIVE_VERIFIED` (NAP abierto) / `PARTNER_ACCESS_REQUIRED` (DGT 3.0) | `dgt-nap-v36-slice.xml` (`542bcd0c...`) |
| **Connector 3 — Owned IP Camera / RTSP Lab** | `createOwnedIpCameraAdapter` | `rtsp://127.0.0.1:8554/barrio-cam-01` + `fixed.json` | ONVIF Profile T/M, RTSP/RTSPS, WebRTC, HLS, MJPEG, HTTPS Snapshot | `LAB_VERIFIED` | `investor-next/public/media/vision/fixed.json` + Koschmieder dark channel |
| **Connector 4 — Dashcam Adapter** | `createDashcamAdapter` | `investor-next/public/media/vision/dashcam.json` + GPS/IMU/OBD-II | YOLOX-s ONNX + ByteTrack + ELM327 OBD-II | `RECORDED_REAL_SAMPLE` | `dashcam.json` (451 frames reales, 12 vehículos, MIT) |
| **Connector 5 — MQTT / Edge Events** | `createMqttEdgeBridge` | `mqtt://127.0.0.1:1883/senda/corridor/events` | `senda.edge-event/1.0` + `senda.dtn-evidence-descriptor/1.0` | `LAB_VERIFIED` | Validación de esquema + rechazo de vídeo bruto sobre DTN |

---

## 2. Detalle Técnico por Conector

### 2.1 Connector 1 — NDW Road Data (Corredor A12 Arnhem–Ede)
- **Cobertura funcional:** Adquiere situaciones viales de seguridad (SRTI / `actueel_beeld.xml.gz` en DATEX II v3) y mediciones de velocidad e intensidad de espiras inductivas MONIBAS (`RWS01_MONIBAS_0121` en `trafficspeed.xml.gz`, DATEX II v2.3).
- **Preparación migración DATEX II v3 (febrero 2027):** El parser `parseNdwDatexPayload` soporta nativamente el espacio de nombres `http://datex2.eu/schema/3/` (ya activo en `actueel_beeld.xml.gz`, `veiligheidsgerelateerde_informatie_srti.xml.gz` y `snelheden_en_intensiteiten_meetgegevens.xml.gz`) y mantiene compatibilidad con `http://datex2.eu/schema/2/2_0` hasta el apagado de v2 en febrero de 2027.
- **Métricas registradas:** `ingestionLatencyMs`, `freshnessState`, `httpFailures`, `schemaDriftCount`, `reconnections`, `missingDataCount`, `roadSegmentId` (`NL-A12-HM110-130`).

### 2.2 Connector 2 — DGT / NAP vs. DGT 3.0
- **Separación estricta:**
  - `mode: 'OPEN_NAP'` consume el feed público nacional `https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml` bajo licencia RISP (Ley 37/2007).
  - `mode: 'DGT_3_0_PARTNER'` exige certificado mTLS y convenio de operador; sin credenciales lanza `PARTNER_ACCESS_REQUIRED` y establece `dgt30PartnerClaimed: false`.

### 2.3 Connector 3 — Owned IP Camera / Local RTSP Lab
- **Seguridad y privacidad:**
  - Bloquea credenciales embebidas en la URL (`CREDENTIALS_IN_ENDPOINT_FORBIDDEN`); exige variables de entorno (`SENDA_LAB_CAM_TOKEN`).
  - Protección anti-SSRF activa: deniega el acceso a rangos privados (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`) salvo cuando `allowLocalLab: true` y `operatorAuthorized: true` están habilitados explícitamente.
- **Evaluación de pasarelas opcionales (`MEDIAMTX_GO2RTC_EVALUATION`):**
  - Tanto `mediamtx` como `go2rtc` utilizan licencia MIT y son compatibles como puentes locales RTSP → WebRTC/HLS en loopback (`127.0.0.1`), sin requerir su inclusión como binarios residentes en el núcleo `@senda/core`.

### 2.4 Connector 4 — Dashcam Adapter (Vídeo Real + Geometría Monocular Honesta)
- Consume la serie temporal real de `investor-next/public/media/vision/dashcam.json` (451 fotogramas, 36.0 s, YOLOX-s ONNX + ByteTrack) combinada con GPS, deceleración IMU (`m/s²`) y velocidad OBD-II.
- **Límite físico explícito:** Declara `carHeightM: 1.45`, `hfovDeg: 65`, `focalPx: 1004.6` e incertidumbre relativa del `±30%` (`MONOCULAR_UNCALIBRATED_WARNING`), impidiendo afirmar velocidades o distancias métricas exactas sin calibración extrínseca.

### 2.5 Connector 5 — MQTT / Edge Events Bridge
- Valida tokens de acceso (`MQTT_EDGE_UNAUTHORIZED`) y versión de esquema (`senda.edge-event/1.0`).
- **Compuerta de protección DTN (`DTN_RAW_VIDEO_FORBIDDEN`):** Rechaza cualquier intento de inyectar fotogramas o vídeo bruto hacia la cola DTN, emitiendo únicamente un descriptor compacto (`senda.dtn-evidence-descriptor/1.0`, `< 2048 B`) con el hash SHA-256 de la evidencia local.
