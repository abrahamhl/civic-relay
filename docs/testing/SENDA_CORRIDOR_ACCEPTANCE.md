# SENDA CORRIDOR ACCEPTANCE — MATRIZ DE PRUEBAS Y CRITERIOS DE ACEPTACIÓN

- **Suite principal Corridor Fabric:** [`packages/senda/tests/corridor-fabric.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/corridor-fabric.test.mjs)
- **Suite UI / Modelo Mando:** [`investor-next/tests/command-surface-model.test.mjs`](file:///c:/Users/2fabr/civic-relay/investor-next/tests/command-surface-model.test.mjs)
- **Suite GIS y Sectores:** [`investor-next/tests/sector-and-globe-mission.test.mjs`](file:///c:/Users/2fabr/civic-relay/investor-next/tests/sector-and-globe-mission.test.mjs)

---

## 1. Matriz de 10 Pruebas Obligatorias por Conector

| Requisito de Prueba | Connector 1 (NDW) | Connector 2 (DGT NAP) | Connector 3 (IP Camera) | Connector 4 (Dashcam) | Connector 5 (MQTT Edge) |
|---|---|---|---|---|---|
| 1. Autenticación | `PUBLIC_OPEN_DATA_CC0` | `OPEN_NAP` / mTLS guard | Token por variable de entorno | Sesión consentida | Token Bearer/HMAC ACL |
| 2. Autorización | Licencia CC0 verificada | Bloquea DGT 3.0 sin convenio (`PARTNER_ACCESS_REQUIRED`) | Anti-SSRF + prohíbe credenciales en URL | Consentimiento del conductor | Rechaza tokens no autorizados |
| 3. Pérdida de conexión | Simulación HTTP 503 | Simulación fallo HTTP | `simulateSignalLoss()` → `CAMERA_SIGNAL_LOST` | Ausencia de traza → error explícito | Desconexión limpia de suscriptores |
| 4. Respuestas corruptas | `SCHEMA_DRIFT_NDW` | `SCHEMA_DRIFT_DGT_NAP` | Validación de dimensiones de frame | `INVALID_DASHCAM_TRACE` | `UNSUPPORTED_EDGE_EVENT_SCHEMA` |
| 5. Desfase de reloj | `CLOCK_SKEW_REJECTED` (>120 s en el futuro) | `CLOCK_SKEW_REJECTED` | `CLOCK_SKEW_REJECTED` | `CLOCK_SKEW_REJECTED` | `CLOCK_SKEW_REJECTED` |
| 6. Fuentes duplicadas | Deduplicación en Plano C (`deduplicatedCount`) | Deduplicación en Plano C | Deduplicación por hash de frame | Descuento intra-familia con OBD-II (`0.606`) | Deduplicación por `sourcePayloadHash` |
| 7. Datos obsoletos | Clasificación `STALE` (>15 min) | Clasificación `STALE` | Estado `STALE` tras pérdida de señal | Decaimiento exponencial por edad | Filtrado por ventana temporal |
| 8. Reconexión | Contador `reconnections` verificado | Recuperación tras reintento | `reconnect()` incrementa contador | Reanudación por índice de fotograma | Re-suscripción pub/sub |
| 9. Rendimiento | `< 25 ms` parseo local / `345 ms` ingesta HTTPS | `< 5 ms` parseo local / `337 ms` ingesta HTTPS | `< 2 ms` Koschmieder frame | `< 2 ms` por consulta de traza | `< 2 ms` por evento Edge |
| 10. Ausencia de fuga de datos | Sin PII en DATEX II | Sin PII en DATEX II | `GDPR_NO_BIOMETRIC_STORAGE` | Sin biometría ni OCR de matrículas | `DTN_RAW_VIDEO_FORBIDDEN` |

---

## 2. Verificación de los Dos Demostradores Obligatorios

### 2.1 Piloto A — Corredor Vial (A12 Arnhem–Ede)
- **Función:** `runPilotACorridorA12` en `packages/senda/src/corridor-fabric.mjs`.
- **Fuentes combinadas:**
  1. `NDW-NL-A12-SRTI-V3` (`actueel_beeld.xml.gz`, DATEX II v3, obstáculo estacionario en `51.9852, 5.967553`).
  2. `NDW-NL-A12-MONIBAS-0121` (`trafficspeed.xml.gz`, DATEX II v2.3, 89 estaciones en A12 hm 110–131).
  3. `DASHCAM-A12-REAL-TRACE-01` (`investor-next/public/media/vision/dashcam.json`, YOLOX-s + ByteTrack, frenada `-4.4 m/s²`, incertidumbre monocular `±30%`).
  4. `OBD-A12-VEHICLE-01` (velocidad de rueda `32 km/h`, luces de emergencia activas, con descuento de correlación respecto a la dashcam del mismo vehículo).
- **Honestidad de cámaras públicas en A12:** `rwsPublicCamerasClaimed: 0` (`RWS-NL-A12-CCTV-VELPERBROEK` mantenida en `PARTNER_ACCESS_REQUIRED`).
- **Resultado extremo a extremo:** Decisión `CONFIRMED_MULTISENSOR_INCIDENT`, mensaje AEAD sellado (`642 B`), caída del enlace celular primario, custodia store-and-forward (`QUEUED → IN_CUSTODY → FORWARDED → RECEIVED → VERIFIED`) y recibo criptográfico verificado (`verified: true`).

### 2.2 Piloto B — Barrio / Edificio (Laboratorio Local)
- **Función:** `runPilotBNeighborhoodLab` en `packages/senda/src/corridor-fabric.mjs`.
- **Fuentes y nodos combinados:**
  1. `CAM-LAB-BARRIO-RTSP-01` (cámara IP de laboratorio RTSP + serie real `fixed.json` CC BY 4.0, visibilidad Koschmieder `580 m`, ocupación `9` vehículos).
  2. `EDGE-MQTT-BARRIO-BROKER-01` (puente MQTT Edge con validación `senda.edge-event/1.0` y bloqueo de vídeo bruto).
  3. `NODE-ANDROID-BARRIO-PEER-01` y `NODE-ANDROID-BARRIO-PEER-02` (instancias de nodos móviles en laboratorio con transferencia store-and-forward tras corte WAN).
- **Resultado extremo a extremo:** Decisión `CONFIRMED_MULTISENSOR_INCIDENT`, sobre SOS sellado (`596 B`), transición completa `QUEUED → IN_CUSTODY → FORWARDED → RECEIVED → VERIFIED` y recibo criptográfico verificado (`verified: true`).

---

## 3. Comandos de Reproducción

```bash
# 1. Recapturar fixtures reales en vivo desde NDW (Países Bajos) y DGT NAP (España)
node packages/senda/scripts/capture-corridor-fixtures.mjs

# 2. Sincronizar módulos del núcleo con la superficie web
node packages/senda/scripts/sync-web.mjs

# 3. Ejecutar pruebas unitarias, de integración y de pilotos de SENDA Corridor Fabric
node --test packages/senda/tests/corridor-fabric.test.mjs

# 4. Generar el informe criptográfico de verificación en evidence/senda/corridor-fabric/
node packages/senda/scripts/corridor-fabric-evidence.mjs

# 5. Ejecutar toda la batería de pruebas del repositorio (Core + PCI + Relay + Mando UI)
pnpm --filter @senda/core test
pnpm --filter @senda/pci test
pnpm --filter @senda/relay test
node --test investor-next/tests/*.test.mjs
```
