# Contratos de integración de SENDA · borrador de ingeniería

`OBSERVATION_V1.schema.json` es un contrato de referencia para conectar motores, no una nueva API ya desplegada.

**Flujo**: SourceAdapter(permiso+health) -> normalización+hash -> `Observation` -> reconciliación upstream -> `Event` -> revisión/alerta -> `Message` -> `Bearer` (REAL/SIM) -> `Receipt` -> UI.

**Prohibido saltar etapas**: la mera coincidencia geográfica no verifica un evento; un hash no autentica el proveedor; un mensaje en custodia no demuestra entrega; un elemento 3D no es prueba de radar/óptica reales.

**Discriminador de señales**: cada observación lleva `evidenceLevel`; jamás actualizar automáticamente `LIVE_VERIFIED` por la existencia de fuente o un HTTP 200, necesita validación de contenido, autenticidad y frescura. `FIELD_MEASURED` requiere un dispositivo conocido y su log asociado.

**Roles**: PUBLIC_FEED, AUTHOR, FOLLOWER, MODERATOR, VERIFIED_ORGANIZATION, INCIDENT_COMMANDER, RESEARCHER. El control de lectura se aplica al nivel de post, story, event, source y evidence; default deny para datos privados.

**Gateway contract**:
- `discover() -> capabilities` + `permissionStatus`.
- `health() -> status` con timestamp, fuente y dispositivo.
- `read()/subscribe() -> Observation[]` con origen, licencia y límites.
- `send(message) -> IN_CUSTODY|FORWARDED|FAILED`, nunca DELIVERED sin recibo autenticado.
- `evidence() -> rawHash, source, acquireUTC, transforms, signatureStatus`.
- `disconnect()/revoke()` idempotentes y con cierre de dispositivos.

**Software externo**: Waze partner feed por convenio; Google Maps por API con términos; OSM con atribución y licencia; C-ITS DATEX y telemetría vehicular autorizados; ROS/MAVLink no implica acceso a hardware. Un adaptador inactivo debe devolver `PARTNER_REQUIRED`, `HARDWARE_REQUIRED` o `UNAVAILABLE`, nunca inventar datos.
