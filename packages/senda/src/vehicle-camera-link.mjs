/**
 * SENDA · Cámaras de vehículos y cámaras públicas como sensores de la carretera.
 *
 * Idea del fundador: si un coche con cámaras (Tesla, una dashcam, el propio móvil) o una cámara pública de
 * la DGT ve un accidente o una anomalía, que llegue a SENDA y se cruce con el resto de avisos (V16, BLE,
 * DATEX II, conductores).
 *
 * LO QUE ES POSIBLE DE VERDAD (investigado 2026-11-18; detalle y fuentes en docs/roadsafe/19_*):
 *  · Ningún fabricante expone hoy a terceros lo que «reconoce» su visión artificial (Tesla incluido). La
 *    Fleet API de Tesla tiene un permiso de «Live Camera», pero no está verificado qué entrega ni con qué
 *    condiciones: NO INTEGRADO.
 *  · SÍ es posible procesar los VÍDEOS que el propio dueño tiene: la memoria USB de TeslaCam (SavedClips,
 *    SentryClips, con event.json) o cualquier dashcam, con SENDA Vision (Python, YOLOX Apache-2.0), en su
 *    equipo y con su consentimiento. Sale solo un EVENTO (qué, dónde, cuándo), nunca la imagen.
 *  · Cámaras públicas (DGT, Euskadi, Cataluña…): las que su licencia permite reutilizar (cameras.mjs).
 *  · Ley de Datos de la UE (Reglamento 2023/2854, aplicable desde el 12-09-2025): el usuario puede pedir los
 *    datos de su vehículo y cederlos a un tercero. Si incluye cámaras o sensores: NO VERIFICADO.
 *
 * Contrato `senda-camera-event/1`. Reglas:
 *  · Privacidad por diseño: se RECHAZA cualquier evento con imagen, fotograma, matrícula, cara o identidad.
 *  · Consentimiento: un evento de cámara de vehículo exige `consent.share === true`.
 *  · Sin probabilidades inventadas: `detector.score` es la salida del detector, no una probabilidad
 *    calibrada. En la fusión estas fuentes cuentan como avistamiento independiente pero NO suben la
 *    confianza (roadsafe-correlation: lrPresent null).
 */
import { HAZARD } from './road-guard.mjs';
import { correlateObservations, causalRoot } from './roadsafe-correlation.mjs';

export const CAMERA_EVENT_SCHEMA = 'senda-camera-event/1';

/** Fuentes de cámara y su acceso REAL. status: INTEGRATED | OWNER_FILES | PUBLIC_LICENSED | NOT_INTEGRATED | NOT_AVAILABLE. */
export const CAMERA_ACCESS = Object.freeze([
  { id: 'TESLACAM_USB', kind: 'VEHICLE', status: 'OWNER_FILES', how: 'Clips de la memoria USB del propio Tesla (TeslaCam/SavedClips, SentryClips, con event.json) procesados por el dueño con packages/senda-vision/vehicle_camera_scan.py', limits: 'Diferido (cuando el dueño vuelca la USB), no en tiempo real. Campos de event.json no documentados por Tesla: lectura defensiva.' },
  { id: 'GENERIC_DASHCAM', kind: 'VEHICLE', status: 'OWNER_FILES', how: 'Vídeo MP4 de cualquier dashcam (y GPX/NMEA opcional) con el mismo script', limits: 'Sin posición si la dashcam no la graba.' },
  { id: 'PHONE_CAMERA', kind: 'VEHICLE', status: 'OWNER_FILES', how: 'Cámara del móvil en el soporte (grabación del usuario) con el mismo script', limits: 'En tiempo real exige app nativa con permiso de cámara: pendiente.' },
  { id: 'TESLA_FLEET_LIVE_CAMERA', kind: 'VEHICLE', status: 'NOT_INTEGRATED', how: 'Permiso «Live Camera» de la Fleet API de Tesla', limits: 'No verificado qué entrega a terceros, ni sus condiciones o coste. Requiere alta de desarrollador y consentimiento del dueño.' },
  { id: 'OEM_VISION_DETECTIONS', kind: 'VEHICLE', status: 'NOT_AVAILABLE', how: 'Detecciones de la visión del fabricante (Tesla, Mobileye…)', limits: 'No se exponen a terceros: no encontrado ningún acceso público.' },
  { id: 'EU_DATA_ACT_VEHICLE', kind: 'VEHICLE', status: 'NOT_INTEGRATED', how: 'Petición del usuario al fabricante para ceder datos de su vehículo a SENDA (Ley de Datos UE)', limits: 'Si cubre imágenes o detecciones: no verificado. Vía legal, no técnica.' },
  { id: 'PUBLIC_CAMERA_DGT', kind: 'PUBLIC', status: 'PUBLIC_LICENSED', how: 'Cámaras del Punto de Acceso Nacional de la DGT (cameras.mjs)', limits: 'Licencia concreta de las imágenes: por verificar en la ficha del conjunto.' },
  { id: 'PUBLIC_CAMERA_REGIONAL', kind: 'PUBLIC', status: 'PUBLIC_LICENSED', how: 'Open Data Euskadi, Servei Català de Trànsit… (cameras.mjs)', limits: 'Según la licencia de cada organismo.' },
]);

/** Anomalías detectables y su traducción a peligro SENDA. Todas son detecciones automáticas, no hechos confirmados. */
export const ANOMALY_CLASSES = Object.freeze({
  STOPPED_VEHICLE_IN_LANE: { hazard: HAZARD.STOPPED, label: 'Vehículo detenido en el carril' },
  VEHICLE_ACROSS_LANE: { hazard: HAZARD.CRASH, label: 'Vehículo atravesado en la calzada (posible accidente)' },
  COLLISION_OBSERVED: { hazard: HAZARD.CRASH, label: 'Colisión observada' },
  PERSON_ON_ROADWAY: { hazard: HAZARD.OBSTACLE, label: 'Persona en la calzada (sin identificar)' },
  DEBRIS_ON_ROADWAY: { hazard: HAZARD.OBSTACLE, label: 'Objeto en la calzada' },
  WRONG_WAY_VEHICLE: { hazard: HAZARD.WRONG_WAY, label: 'Vehículo en sentido contrario' },
  QUEUE_OR_SLOW_TRAFFIC: { hazard: HAZARD.QUEUE, label: 'Retención' },
  SMOKE_OR_FIRE: { hazard: HAZARD.FIRE, label: 'Humo o fuego' },
  LOW_VISIBILITY: { hazard: HAZARD.FOG, label: 'Visibilidad reducida' },
});

const FORBIDDEN = /^(image|images|frame|frames|jpeg|jpg|png|video|snapshot|thumbnail|plate|plates|licensePlate|license_plate|face|faces|personId|person_id|driverName|vin)$/i;
const LANES = ['LEFT_LANE', 'MIDDLE_LANE', 'RIGHT_LANE', 'SHOULDER', 'LEFT_SHOULDER'];

function forbiddenKeys(o, path = '') {
  if (!o || typeof o !== 'object') return [];
  return Object.entries(o).flatMap(([k, v]) => (FORBIDDEN.test(k) ? [path + k] : forbiddenKeys(v, `${path}${k}.`)));
}

/**
 * Valida un evento de cámara. Devuelve { ok, errors[], privacyReject }.
 * ev: { schema, eventId, source (id de CAMERA_ACCESS), deviceId|cameraId, at (s), lat, lon, anomaly,
 *       laneHint?, detector: { model, version, score|null }, heuristic?: { name, validated:false }, consent?: { share } }
 */
export function validateCameraEvent(ev) {
  const errors = [], bad = forbiddenKeys(ev);
  if (bad.length) return { ok: false, privacyReject: true, errors: [`datos personales o imagen no permitidos: ${bad.join(', ')}`] };
  if (ev?.schema !== CAMERA_EVENT_SCHEMA) errors.push(`esquema distinto de ${CAMERA_EVENT_SCHEMA}`);
  if (typeof ev?.eventId !== 'string' || !ev.eventId) errors.push('falta eventId');
  const src = CAMERA_ACCESS.find((s) => s.id === ev?.source);
  if (!src) errors.push(`fuente desconocida «${ev?.source}»`);
  else if (src.status === 'NOT_AVAILABLE' || src.status === 'NOT_INTEGRATED') errors.push(`fuente ${src.id} no integrada (${src.status})`);
  if (src?.kind === 'VEHICLE' && typeof ev.deviceId !== 'string') errors.push('evento de vehículo sin deviceId (seudónimo del dispositivo)');
  if (src?.kind === 'PUBLIC' && typeof ev.cameraId !== 'string') errors.push('evento de cámara pública sin cameraId');
  if (src?.kind === 'VEHICLE' && ev.consent?.share !== true) errors.push('sin consentimiento expreso para compartir (consent.share)');
  if (!Number.isFinite(ev?.at)) errors.push('falta la hora (at, s)');
  if (!(ev?.lat >= -90 && ev?.lat <= 90) || !(ev?.lon >= -180 && ev?.lon <= 180)) errors.push('posición ausente o fuera de rango');
  if (!ANOMALY_CLASSES[ev?.anomaly]) errors.push(`anomalía desconocida «${ev?.anomaly}»`);
  if (ev?.laneHint != null && !LANES.includes(ev.laneHint)) errors.push(`carril no válido «${ev.laneHint}»`);
  if (typeof ev?.detector?.model !== 'string' || typeof ev?.detector?.version !== 'string') errors.push('falta modelo y versión del detector');
  const sc = ev?.detector?.score;
  if (sc != null && !(Number.isFinite(sc) && sc >= 0 && sc <= 1)) errors.push('score del detector fuera de [0, 1]');
  if (ev?.heuristic && ev.heuristic.validated === true) errors.push('ninguna heurística de SENDA está validada todavía: validated debe ser false');
  return { ok: errors.length === 0, privacyReject: false, errors };
}

/** Evento válido → observación para la fusión y el gemelo del incidente (una raíz por vehículo o cámara). */
export function toRoadObservation(ev) {
  const v = validateCameraEvent(ev);
  if (!v.ok) throw new Error(`evento de cámara rechazado: ${v.errors.join('; ')}`);
  const src = CAMERA_ACCESS.find((s) => s.id === ev.source), isPublic = src.kind === 'PUBLIC';
  return {
    obsId: `cam:${ev.eventId}`, source: isPublic ? 'PUBLIC_CAMERA_AI' : 'VEHICLE_CAMERA_AI',
    rootHint: isPublic ? ev.cameraId : undefined, reporterId: isPublic ? undefined : ev.deviceId,
    at: ev.at, lat: ev.lat, lon: ev.lon, accuracyM: Number.isFinite(ev.accuracyM) ? ev.accuracyM : null,
    roadId: ev.roadId ?? null, laneHint: ev.laneHint ?? undefined, present: true,
    hazard: ANOMALY_CLASSES[ev.anomaly].hazard, anomaly: ev.anomaly,
    provenance: { camera: ev.source, detector: `${ev.detector.model}@${ev.detector.version}`, score: ev.detector.score ?? null, scoreMeaning: 'SALIDA_DEL_DETECTOR_NO_PROBABILIDAD', heuristic: ev.heuristic?.name ?? null },
  };
}

/**
 * Cruza eventos de cámaras entre sí y con otras observaciones viales (V16, BLE, DATEX II…): agrupa por zona
 * y ventana y cuenta avistamientos INDEPENDIENTES (vehículos o cámaras distintos). DECLARADOS: { radiusM, windowS }.
 * Varios clips del MISMO vehículo cuentan como uno.
 */
export function crossCheck(cameraEvents, otherObservations, opts) {
  for (const k of ['radiusM', 'windowS']) if (!Number.isFinite(opts?.[k])) throw new Error(`crossCheck: «${k}» debe declararse`);
  const accepted = [], rejected = [];
  for (const ev of cameraEvents) { const v = validateCameraEvent(ev); if (v.ok) accepted.push(toRoadObservation(ev)); else rejected.push({ eventId: ev?.eventId ?? null, errors: v.errors, privacyReject: v.privacyReject }); }
  const groups = correlateObservations([...accepted, ...(otherObservations ?? [])], { radiusM: opts.radiusM, windowS: opts.windowS })
    .map((g) => { const roots = [...new Set(g.obs.map(causalRoot))]; return { ...g, independentSightings: roots.length, roots, cameraOnly: g.obs.every((o) => o.source === 'VEHICLE_CAMERA_AI' || o.source === 'PUBLIC_CAMERA_AI') }; });
  return { groups, accepted: accepted.length, rejected };
}
