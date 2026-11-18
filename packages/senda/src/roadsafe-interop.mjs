/**
 * SENDA RoadSafe · Adaptadores de interoperabilidad (exportación) y registro de capacidades.
 *
 * Todo lo que aquí se genera es un CONTRATO validable; nada se publica sin el acuerdo correspondiente.
 * Clasificación de capacidades: PUBLIC_VERIFIED · PARTNER_ACCESS_REQUIRED · CONTRACT_REQUIRED ·
 * PROTOTYPE_ONLY · NOT_SUPPORTED · UNKNOWN. Evidencia y fecha de verificación en `CAPABILITIES`.
 *
 * - DATEX II v3 (CEN 16157): `toDatex2Situation` produce un situationRecord VehicleObstruction que el
 *   propio lector de SENDA (`parseDatex2`) puede leer (ida y vuelta). Validación contra XSD oficial
 *   PENDIENTE (esquemas en docs.datex2.eu no descargados en este entorno).
 * - Waze CIFS: `toCifsIncident` + `validateCifs` con los campos/valores verificados en la
 *   especificación oficial el 2026-11-17. Envío solo como socio aprobado (Partner Hub).
 * - Deep links Waze / Google Maps URLs: públicos, sin clave; solo ABREN navegación, no inyectan avisos.
 * - C-ITS DENM (ETSI EN 302 637-3) y SRTI (Reglamento Delegado (UE) 886/2013): mapeos SEMÁNTICOS,
 *   sin codificación ASN.1 UPER ni firma PKI C-ITS (PROTOTYPE_ONLY).
 */

const VERIFIED_ON = '2026-11-17';

export const CAPABILITY_CLASSES = Object.freeze(['PUBLIC_VERIFIED', 'PARTNER_ACCESS_REQUIRED', 'CONTRACT_REQUIRED', 'PROTOTYPE_ONLY', 'NOT_SUPPORTED', 'UNKNOWN']);

/** Registro de capacidades (resumen; la ficha completa está en docs/roadsafe/01_INTEROP_MATRIX.md). */
export const CAPABILITIES = Object.freeze([
  { id: 'GMAPS_URLS_DIRECTIONS', what: 'Abrir ruta en Google Maps (Maps URLs api=1)', class: 'PUBLIC_VERIFIED', evidence: 'developers.google.com/maps/documentation/urls/get-started: «You don\'t need a Google API key»', verified: VERIFIED_ON },
  { id: 'GMAPS_INCIDENT_INJECTION', what: 'Publicar incidencias en Google Maps', class: 'NOT_SUPPORTED', evidence: 'La documentación de Maps URLs no ofrece ninguna operación de escritura; no se conoce API pública para ello.', verified: VERIFIED_ON },
  { id: 'WAZE_DEEPLINK', what: 'Abrir navegación en Waze (waze.com/ul?ll=…&navigate=yes)', class: 'PUBLIC_VERIFIED', evidence: 'developers.google.com/waze/deeplinks', verified: VERIFIED_ON },
  { id: 'WAZE_CIFS_FEED', what: 'Publicar incidencias en Waze vía feed CIFS', class: 'PARTNER_ACCESS_REQUIRED', evidence: 'developers.google.com/waze/data-feed/overview: alta vía Partner Hub y validación por Waze', verified: VERIFIED_ON },
  { id: 'WAZE_READ_USER_REPORTS', what: 'Leer avisos de usuarios de Waze', class: 'PARTNER_ACCESS_REQUIRED', evidence: 'Solo en programas de socios; no hay API pública. Términos de intercambio no verificados en esta sesión.', verified: VERIFIED_ON },
  { id: 'DGT30_PLATFORM', what: 'Compartir/consumir eventos en DGT 3.0 (incl. V16 conectadas)', class: 'PARTNER_ACCESS_REQUIRED', evidence: 'dgt.es «Forma parte de la DGT 3.0»: formulario de solicitud, IP pública en lista blanca, certificado X.509 de la CA de la plataforma, REST y MQTT', verified: VERIFIED_ON },
  { id: 'NAP_DATEX2_READ', what: 'Leer DATEX II del Punto de Acceso Nacional (nap.dgt.es / NDW)', class: 'PUBLIC_VERIFIED', evidence: 'Reglamentos Delegados (UE) 886/2013 y 2022/670 (página CE SRTI/RTTI). Condiciones de licencia por publicación: revisar en cada NAP.', verified: VERIFIED_ON },
  { id: 'NAP_DATEX2_PUBLISH', what: 'Publicar en el NAP como proveedor', class: 'CONTRACT_REQUIRED', evidence: 'El NAP lo gestiona el Estado; publicar exige ser proveedor reconocido. Procedimiento concreto no verificado.', verified: VERIFIED_ON },
  { id: 'CITS_DENM', what: 'Emitir DENM C-ITS (ETSI EN 302 637-3)', class: 'PROTOTYPE_ONLY', evidence: 'Requiere estación C-ITS homologada y certificados de la PKI europea C-ITS (CCMS). SENDA solo mapea semántica.', verified: VERIFIED_ON },
  { id: 'NG112_PEMEA', what: 'Entregar expediente a PSAP por NG112/PEMEA', class: 'CONTRACT_REQUIRED', evidence: 'Arquitecturas que exigen acuerdo con PSAP/ASP; sin acceso público.', verified: VERIFIED_ON },
  { id: 'ECALL', what: 'eCall vehicular', class: 'NOT_SUPPORTED', evidence: 'Lo realiza el vehículo con el 112 (Reglamento (UE) 2015/758); una app no puede emitir eCall.', verified: VERIFIED_ON },
  { id: 'ANDROID_AUTO_CARPLAY_ALERTS', what: 'Mostrar avisos de SENDA en Android Auto / CarPlay', class: 'UNKNOWN', evidence: 'Categorías de apps permitidas y revisión de cada tienda no verificadas en esta sesión.', verified: VERIFIED_ON },
  { id: 'INSURER_ASSISTANCE_API', what: 'Solicitar asistencia en carretera a aseguradora', class: 'CONTRACT_REQUIRED', evidence: 'No hay estándar público común en España; cada aseguradora/asistencia tiene su canal. Banco de pruebas contractual.', verified: VERIFIED_ON },
]);

/** Enlaces de navegación verificados (no leen nada de vuelta). */
export function navigationLinks({ lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('coordenadas no válidas');
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return {
    waze: `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll)}&travelmode=driving`,
    googleSearch: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`,
    capability: ['WAZE_DEEPLINK', 'GMAPS_URLS_DIRECTIONS'],
  };
}

// ------------------------------------------------------------------ Waze CIFS
export const CIFS_TYPES = Object.freeze(['ROAD_CLOSED', 'ACCIDENT', 'HAZARD', 'POLICE', 'CHIT_CHAT', 'JAM']);
export const CIFS_DIRECTIONS = Object.freeze(['BOTH_DIRECTIONS', 'ONE_DIRECTION']);
const CIFS_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const toCifsTime = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, '+00:00');

/** Incidente CIFS para un vehículo detenido: en arcén → HAZARD_ON_SHOULDER_CAR_STOPPED. */
export function toCifsIncident(incPublic, { nowMs, street, polylineAhead = null, ttlMs = 2 * 3600e3 } = {}) {
  const l = incPublic.location;
  const onShoulder = l.lane === 'SHOULDER';
  const secondary = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(incPublic.state);
  const pts = polylineAhead ?? [{ lat: l.lat, lon: l.lon }];
  return {
    id: `senda-${incPublic.id}`,
    type: secondary ? 'ACCIDENT' : 'HAZARD',
    subtype: secondary ? 'ACCIDENT_MINOR' : onShoulder ? 'HAZARD_ON_SHOULDER_CAR_STOPPED' : 'HAZARD_ON_ROAD_CAR_STOPPED',
    polyline: pts.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join(' '),
    street: street ?? l.roadId ?? '',
    direction: 'ONE_DIRECTION',
    starttime: toCifsTime(nowMs), endtime: toCifsTime(nowMs + ttlMs),
    description: (secondary ? 'Alcance tras avería' : onShoulder ? 'Vehículo en arcén' : 'Vehículo detenido').slice(0, 40),
  };
}
/** Validación contra los campos y valores de la especificación CIFS (verificada 2026-11-17). */
export function validateCifs(inc) {
  const errors = [];
  for (const k of ['id', 'type', 'polyline', 'street']) if (!inc[k] && inc[k] !== '') errors.push(`falta ${k}`);
  if (inc.street === '') errors.push('street vacío');
  if (!CIFS_TYPES.includes(inc.type)) errors.push(`type no válido: ${inc.type}`);
  if (inc.subtype && !inc.subtype.startsWith(inc.type === 'ROAD_CLOSED' ? 'ROAD_CLOSED' : inc.type)) errors.push(`subtype ${inc.subtype} no corresponde a ${inc.type}`);
  if (inc.direction && !CIFS_DIRECTIONS.includes(inc.direction)) errors.push(`direction no válida: ${inc.direction}`);
  if (inc.type === 'ROAD_CLOSED' && !inc.starttime) errors.push('ROAD_CLOSED exige starttime');
  for (const k of ['starttime', 'endtime']) if (inc[k] && !CIFS_TS.test(inc[k])) errors.push(`${k} con formato no CIFS`);
  const nums = String(inc.polyline ?? '').trim().split(/\s+/).map(Number);
  if (nums.length < 2 || nums.length % 2 || nums.some((x) => !Number.isFinite(x))) errors.push('polyline debe ser pares «lat lon» separados por espacios');
  for (let i = 0; i + 1 < nums.length; i += 2) if (Math.abs(nums[i]) > 90 || Math.abs(nums[i + 1]) > 180) errors.push('polyline fuera de rango');
  if (inc.description && inc.description.length > 40) errors.push('description > 40 caracteres (recomendado)');
  return { valid: errors.length === 0, errors, spec: 'Waze CIFS (developers.google.com/waze/data-feed/cifs-specification)', verifiedOn: VERIFIED_ON, publishable: false, publishRequires: 'Socio Waze aprobado (Partner Hub)' };
}
const xmlEsc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
export function cifsXml(incidents) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<incidents>\n${incidents.map((i) => ` <incident id="${xmlEsc(i.id)}">\n${['type', 'subtype', 'polyline', 'street', 'direction', 'starttime', 'endtime', 'description'].filter((k) => i[k]).map((k) => `  <${k}>${xmlEsc(i[k])}</${k}>`).join('\n')}\n </incident>`).join('\n')}\n</incidents>`;
}

// ------------------------------------------------------------------ DATEX II v3 (export)
/** situationRecord VehicleObstruction (brokenDownVehicle) — leído de vuelta por parseDatex2. */
export function toDatex2Situation(incPublic, { nowIso, version = 1 } = {}) {
  const l = incPublic.location, secondary = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(incPublic.state);
  const type = secondary ? 'Accident' : 'VehicleObstruction';
  const sub = secondary ? '<sit:accidentType>collision</sit:accidentType>' : '<sit:vehicleObstructionType>brokenDownVehicle</sit:vehicleObstructionType>';
  const prob = incPublic.confidence?.status === 'CORROBORATED' ? 'certain' : 'probable';
  return `<?xml version="1.0" encoding="UTF-8"?>
<d2:payload xmlns:d2="http://datex2.eu/schema/3/d2Payload" xmlns:sit="http://datex2.eu/schema/3/situation" xmlns:loc="http://datex2.eu/schema/3/locationReferencing" xmlns:com="http://datex2.eu/schema/3/common" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="sit:SituationPublication" lang="es">
 <sit:situation id="${xmlEsc(incPublic.id)}">
  <sit:situationRecord id="${xmlEsc(incPublic.id)}-1" version="${version}" xsi:type="sit:${type}"><sit:situationRecordCreationTime>${xmlEsc(nowIso)}</sit:situationRecordCreationTime><sit:situationRecordVersionTime>${xmlEsc(nowIso)}</sit:situationRecordVersionTime><sit:probabilityOfOccurrence>${prob}</sit:probabilityOfOccurrence>
   <sit:validity><com:validityStatus>active</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>${xmlEsc(nowIso)}</com:overallStartTime></com:validityTimeSpecification></sit:validity>
   <sit:locationReference xsi:type="loc:PointLocation"><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>${l.lat.toFixed(5)}</loc:latitude><loc:longitude>${l.lon.toFixed(5)}</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates>${l.roadId ? `<loc:roadInformation><loc:roadNumber>${xmlEsc(l.roadId)}</loc:roadNumber></loc:roadInformation>` : ''}</sit:locationReference>
   ${sub}</sit:situationRecord></sit:situation>
</d2:payload>`;
}

// ------------------------------------------------------------------ C-ITS DENM y SRTI (semántico)
/**
 * Códigos de causa DENM (ETSI TS 102 894-2, CauseCodeType) usados aquí. PROTOTYPE_ONLY: verificar
 * contra la versión del diccionario de datos que exija el despliegue (C-Roads) antes de usar.
 */
export const DENM_CAUSE = Object.freeze({ accident: 2, roadworks: 3, obstacleOnTheRoad: 10, rescueAndRecoveryWorkInProgress: 15, dangerousEndOfQueue: 27, vehicleBreakdown: 91, postCrash: 92, stationaryVehicle: 94, collisionRisk: 97 });
/** Categorías SRTI del Reglamento Delegado (UE) 886/2013, art. 3. */
export const SRTI_CATEGORIES = Object.freeze(['TEMPORARY_SLIPPERY_ROAD', 'ANIMAL_PEOPLE_OBSTACLES_DEBRIS_ON_ROAD', 'UNPROTECTED_ACCIDENT_AREA', 'SHORT_TERM_ROAD_WORKS', 'REDUCED_VISIBILITY', 'WRONG_WAY_DRIVER', 'UNMANAGED_BLOCKAGE', 'EXCEPTIONAL_WEATHER']);
export function semanticMapping(incPublic) {
  const secondary = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(incPublic.state);
  const assistance = ['ASSISTANCE_ON_SCENE', 'PARTNER_ACKNOWLEDGED'].includes(incPublic.state);
  return {
    denm: { causeCode: secondary ? DENM_CAUSE.postCrash : assistance ? DENM_CAUSE.rescueAndRecoveryWorkInProgress : DENM_CAUSE.stationaryVehicle, status: 'PROTOTYPE_ONLY_NOT_ENCODED' },
    srti: secondary ? 'UNPROTECTED_ACCIDENT_AREA' : incPublic.location.lane === 'SHOULDER' ? null : 'UNMANAGED_BLOCKAGE',
    srtiNote: 'Un vehículo en el arcén no encaja claramente en una categoría SRTI; la decisión corresponde a la autoridad.',
    datex2Type: secondary ? 'Accident' : 'VehicleObstruction/brokenDownVehicle',
    cifs: secondary ? 'ACCIDENT/ACCIDENT_MINOR' : incPublic.location.lane === 'SHOULDER' ? 'HAZARD/HAZARD_ON_SHOULDER_CAR_STOPPED' : 'HAZARD/HAZARD_ON_ROAD_CAR_STOPPED',
  };
}
