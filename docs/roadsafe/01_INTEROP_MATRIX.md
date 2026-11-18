# RoadSafe · Matriz de interoperabilidad real (fichas)

**Verificación:** 2026-11-17. Las fuentes marcadas «leída hoy» se consultaron en esta sesión; el resto se declara como conocimiento previo **no reverificado** (estado `UNKNOWN` o pendiente) y debe confirmarse antes de cualquier compromiso.
**Clases:** `PUBLIC_VERIFIED` · `PARTNER_ACCESS_REQUIRED` · `CONTRACT_REQUIRED` · `PROTOTYPE_ONLY` · `NOT_SUPPORTED` · `UNKNOWN`.
**Reglas:** sin endpoints inventados, sin APIs privadas, sin identidades institucionales simuladas en producción.

## Resumen

| Capacidad | Clase | Evidencia |
|---|---|---|
| DGT 3.0 (compartir/consumir eventos, V16) | PARTNER_ACCESS_REQUIRED | Leída hoy (dgt.es) |
| NAP DATEX II (lectura) | PUBLIC_VERIFIED | Leída hoy (CE SRTI/RTTI); licencia por publicación a revisar |
| NAP DATEX II (publicación) | CONTRACT_REQUIRED | Procedimiento no verificado |
| Waze CIFS (publicar incidencias) | PARTNER_ACCESS_REQUIRED | Leída hoy (overview + spec) |
| Waze deep links | PUBLIC_VERIFIED | Leída hoy |
| Google Maps URLs (abrir ruta) | PUBLIC_VERIFIED | Leída hoy |
| Google Maps: inyectar incidencias | NOT_SUPPORTED | La documentación no ofrece escritura |
| Android Auto / CarPlay (mostrar avisos de SENDA) | UNKNOWN | No verificado en esta sesión |
| C-ITS DENM | PROTOTYPE_ONLY | Requiere estación homologada + PKI C-ITS |
| eCall | NOT_SUPPORTED (para una app) | Lo emite el vehículo |
| AML | NOT_SUPPORTED (para una app; lo hace el SO) | — |
| NG112 / PEMEA | CONTRACT_REQUIRED | Acuerdo con PSAP/ASP |
| Aseguradoras / asistencia / grúas / taxis | CONTRACT_REQUIRED | Sin estándar público común; banco contractual |

---

## Fichas

### F1 · DGT 3.0 (España)
- **Estándar/API:** REST y colas MQTT (leída hoy).
- **Documentación oficial:** https://www.dgt.es/muevete-con-seguridad/tecnologia-e-innovacion-en-carretera/forma-parte-de-la-dgt-3.0/
- **Operaciones:** actores que «comparten y/o consumen la información»; apps servidor conectadas a clientes en balizas, móviles o vehículos.
- **Autenticación:** certificado cliente **X.509 v3** emitido por la CA interna de la plataforma; **IP pública del backend en lista blanca** (requisito).
- **Alta:** formulario de solicitud; la DGT valida y contacta para confirmar y explicar siguientes pasos. No se menciona convenio adicional en la parte leída.
- **Licencia / latencia:** no publicadas en la página → `UNKNOWN`.
- **Responsable de datos:** DGT (plataforma); cada actor sobre lo que aporta.
- **Límites:** la página leída no detalla esquemas de mensaje; no se infieren.
- **Plan de validación:** (1) solicitud de alta en entorno de pruebas; (2) recibir especificación técnica; (3) adaptar `roadsafe-interop` y medir latencia V16→plataforma→consumidor con baliza homologada; (4) registrar latencia p50/p95 real en `evidence/roadsafe`.
- **Nota V16:** la obligatoriedad de la V16 conectada desde el 1-1-2026 es conocimiento previo; **no reverificado hoy**.

### F2 · Punto de Acceso Nacional (DATEX II) — España (nap.dgt.es) y Países Bajos (NDW)
- **Estándar:** DATEX II (serie CEN 16157); perfiles armonizados en docs.datex2.eu; perfiles 2022/670 «deberían estar disponibles en 2026» (página CE, leída hoy).
- **Normativa:** Reglamento Delegado (UE) 886/2013 (SRTI, información mínima universal de seguridad, gratuita) y (UE) 2022/670 (RTTI), en desarrollo de la Directiva 2010/40/UE.
- **Operaciones:** lectura de publicaciones (situaciones, medidas, paneles).
- **Autenticación/licencia:** depende de cada NAP y publicación → revisar condiciones por conjunto.
- **Implementación SENDA:** `parseDatex2` endurecido (P0-5), `toDatex2Situation` (exportación) con ida y vuelta probada.
- **Pendiente:** validación contra XSD oficial; mapeo del feed MSI de NDW.

### F3 · Waze Partner Feeds / CIFS
- **Documentación:** https://developers.google.com/waze/data-feed/overview · https://developers.google.com/waze/data-feed/cifs-specification
- **Acceso:** «Waze partners»; URL del feed vía Partner Hub; Waze valida y luego lo recoge automáticamente.
- **Formatos:** CIFS (preferido), XML o JSON; también ESRI, WZDx y DATEX II («parcialmente soportado»).
- **Campos requeridos:** `incident id`, `type`, `polyline`, `street`, `starttime` (omitible salvo ROAD_CLOSED). Solicitados: `subtype`, `direction`, `endtime` (por defecto +14 días), `description` (< 40 caracteres recomendado).
- **Tipos:** `ROAD_CLOSED, ACCIDENT, HAZARD, POLICE, CHIT_CHAT, JAM`. **No existe `CONSTRUCTION`** → defecto corregido en `toCifs`.
- **Subtipos relevantes:** `HAZARD_ON_SHOULDER_CAR_STOPPED`, `HAZARD_ON_ROAD_CAR_STOPPED`, `ACCIDENT_MINOR/MAJOR`.
- **Hora:** `yyyy-MM-dd'T'HH:mm:ss+HH:mm`.
- **Frecuencia de sondeo / licencia:** no publicadas → `UNKNOWN`.
- **Implementación:** `toCifsIncident`, `validateCifs`, `cifsXml` (`publishable:false` hasta ser socio).

### F4 · Waze deep links
- https://developers.google.com/waze/deeplinks · `https://waze.com/ul?ll=lat,lon&navigate=yes` · sin clave. Solo abre navegación.

### F5 · Google Maps URLs
- https://developers.google.com/maps/documentation/urls/get-started · «You don't need a Google API key», `api=1` obligatorio, `dir/?api=1&destination=…&travelmode=driving`, límite 2 048 caracteres.
- **Inyección de incidencias:** la documentación no contempla escritura → `NOT_SUPPORTED`. Google Maps Platform (APIs de pago) tampoco se ha verificado que permita publicar incidencias públicas; no se supone.

### F6 · Android Auto / Apple CarPlay
- `UNKNOWN`. Las categorías de apps admitidas (navegación, mensajería, etc.) y su revisión por tienda no se verificaron hoy. **No se promete** visualización en el coche.

### F7 · C-ITS / C-Roads / ETSI DENM
- DENM (ETSI EN 302 637-3) con códigos de causa de ETSI TS 102 894-2 (p. ej. 94 stationaryVehicle, 91 vehicleBreakdown, 92 postCrash, 15 rescueAndRecoveryWorkInProgress) — **conocimiento previo, a verificar** contra la versión de diccionario exigida por el despliegue.
- Requiere estación C-ITS y certificados de la PKI europea (CCMS) → `PROTOTYPE_ONLY` (solo `semanticMapping`).

### F8 · 112 / eCall / AML / NG112 / PEMEA
- eCall: Reglamento (UE) 2015/758, MSD EN 15722, lo realiza el vehículo.
- AML: ETSI TS 103 625, lo realiza el sistema operativo al marcar 112.
- NG112 (EENA) y PEMEA (ETSI TS 103 478): integración solo con acuerdo del PSAP/proveedor.
- Estado de verificación: **conocimiento previo, no reverificado hoy**. Implementación: `roadsafe-emergency-gateway.mjs` (expediente, nunca llamada automática).

### F9 · Asistencia privada (aseguradoras, corredores, asistencia en carretera, grúas, taxis)
- No hay API pública común identificada. Integración por contrato bilateral.
- Implementación: contrato genérico + `createContractSimulator` con inyección de fallos (timeout, 5xx, ACK sin referencia, fuera de orden, duplicados, nunca llega).
- Datos mínimos: `minimalPayload` (solo campos consentidos).

### F10 · Protección civil y servicios autonómicos
- Competencias y canales varían por comunidad autónoma (p. ej. centros 112 autonómicos; Cataluña y País Vasco con competencias de tráfico propias — **conocimiento previo, a verificar**). Requiere mapeo por territorio en el piloto.
