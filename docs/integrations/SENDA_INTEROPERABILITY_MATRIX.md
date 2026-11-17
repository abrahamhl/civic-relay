# MATRIZ DE INTEROPERABILIDAD Y PROTOCOLOS SENDA
**Versión:** 1.0.0-Interop  
**Fecha:** 2026-11-08  
**Autor:** Multiagente OpenCode / Multisoftware Integration & Telecom Engineer  

---

## 1. PRINCIPIO DE TRANSPARENCIA Y NIVELES DE MADUREZ

Para cumplir con las normas de rigor técnico y auditoría independiente, cada interfaz en SENDA se califica con uno de los siguientes estados:
- **`IMPLEMENTED`**: Código fuente completo y probado con tests unitarios/integración en el repositorio.
- **`LIVE_VERIFIED`**: Validado contra hardware real, feeds en producción o captura física en banco de pruebas.
- **`MOCKED`**: Emulador determinista utilizado en entornos CI donde el hardware físico no está presente.
- **`SPECIFIED`**: Contrato de interfaz formalmente definido pendiente de pasarela física con terceros.

---

## 2. MATRIZ INTEGRAL DE INTERFACES

| Dominio | Protocolo / Estándar | Carga Útil (Payload) | Estado | Módulo en Repositorio | Fallback / Modo Degradado |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Vídeo & CCTV** | RTSP / HLS / WebRTC | H.264 / AAC 1080p | `IMPLEMENTED` | `packages/senda/src/cameras.mjs` | Fotogramas JPEG periódicos vía HTTP/SSE |
| **Cámaras IP** | ONVIF Profile S | XML SOAP / PTZ | `IMPLEMENTED` | `packages/senda/src/dgt-infra.mjs` | Polling pasivo de imágenes fijas |
| **Visión IA** | YOLOX + ByteTrack | JSON Bounding Boxes | `IMPLEMENTED` | `packages/senda/src/vision-layers.mjs` | Detección basada en reglas de movimiento |
| **Tráfico Vía** | DGT NAP v36 (DATEX II) | XML / JSON Bucles conteo | `IMPLEMENTED` | `packages/senda/src/datex2.mjs` | Estimación por densidad macroscópica LWR |
| **Tráfico Holanda**| NDW Open Data | JSON / GeoJSON | `IMPLEMENTED` | `packages/senda/src/corridor-fabric.mjs`| Modelo sintético de flujo vehicular |
| **Cartografía** | OSM Overpass API | GeoJSON huellas/plantas | `IMPLEMENTED` | `packages/senda/src/geo-offline.mjs` | Caché vectorial MBTiles local sin conexión |
| **Malla DTN** | EAOR Opportunistic | CBOR / Protobuf binario | `LIVE_VERIFIED` | `packages/senda/src/bearers.mjs` | Inundación epidémica controlada (TTL limitado) |
| **Radio BLE** | Bluetooth LE 5.x COTS | Baliza 23 bytes + CRC8 | `LIVE_VERIFIED` | `packages/core/src/transports/` | Baliza de audio acústico en alta frecuencia |
| **Radio LoRa** | Meshtastic / Paxcounter | Paquete LoRaWAN 256 B | `IMPLEMENTED` | `packages/senda/src/sovereign-mesh-kit.mjs` | Retransmisión por vehículo con Wi-Fi |
| **Satelital D2D** | SatNOGS / TLE Tracking | Tramas LEO / Iridium SBD | `IMPLEMENTED` | `packages/senda/src/satellites.mjs` | Espera de paso orbital siguiente con buffer |
| **Audio Acústico**| Audio FSK Ultrasonido | Audio PCM 48 kHz / 200 B | `LIVE_VERIFIED` | `packages/senda/src/voice-mesh.mjs` | Código QR dinámico en pantalla |
| **Vehículos** | OBD-II / SAE J1979 | PID 0x33 (Baro, Temp, V) | `IMPLEMENTED` | `packages/senda/src/vehicle-link.mjs` | Sensores barométricos internos del smartphone |
| **Drones & UAV** | MAVLink v2.0 | Heartbeat, Global Position | `IMPLEMENTED` | `packages/senda/src/drone.mjs` | Waypoints preprogramados en modo fail-safe |
| **Alertas Gov** | CAP v1.2 (OASIS) | XML firmado digitalmente | `IMPLEMENTED` | `packages/senda/src/interop.mjs` | Alerta comunitaria local con firma local |
| **Social Live** | REST / SSE / SQLite | JSON estandarizado | `IMPLEMENTED` | `apps/senda-live/server/` | Cola de almacenamiento local IndexedDB |

---

## 3. ESPECIFICACIÓN DE LA PASARELA DE CORREDOR FABRIC (`corridor-fabric.mjs`)

El motor de corredor fabric unifica fuentes heterogéneas de autopista mediante un pipeline secuencial de 4 etapas:
1. **Normalización Geodésica:** Todas las fuentes (WGS84, coordenadas UTM ETRS89 huso 30N) se proyectan en un eje métrico lineal a lo largo del kilometraje del corredor (PK 0.0 a PK 45.0).
2. **Fusión Espacio-Temporal:** Las lecturas de bucles electromagnéticos de calzada (DGT) se correlacionan con la telemetría de vehículos conectados mediante filtro de partículas.
3. **Inferencia de Congestión y Anomalías:** Cálculo en tiempo real de la velocidad armónica media y detección de ondas de frenado hacia atrás.
4. **Alerta Temprana Proactiva:** Si la concentración de partículas de humo estimada por el modelo de dispersión supera los $150\,\mu\text{g/m}^3$ o la visibilidad cae por debajo de $100\,\text{m}$, se inyecta automáticamente una orden de restricción en los paneles de señalización variable (VMS) y se notifica a los vehículos dentro de un radio de influencia de $15\,\text{km}$.
