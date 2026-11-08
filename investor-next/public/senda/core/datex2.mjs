/**
 * SENDA · DATEX II: el idioma común del tráfico europeo, para España, Países Bajos y el resto de la UE.
 *
 * El Reglamento Delegado (UE) 2022/670 obliga a cada Estado miembro a ofrecer su información de tráfico
 * en tiempo real en un Punto de Acceso Nacional, con DATEX II como formato de referencia. En España
 * es la DGT (nap.dgt.es, DATEX II v3.6/v3.7); en Países Bajos, NDW (incidencias, obras de Melvin,
 * aperturas de puentes, señales de carril). Un solo lector sirve para todos los países: esa es la
 * pieza que hace exportable SENDA.
 *
 * `parseDatex2` es tolerante con los prefijos de espacio de nombres (sit:, loc:, com: o ninguno) y
 * con las versiones 2 y 3. Extrae cada situationRecord: tipo, validez, gravedad, coordenadas y subtipos.
 * `toHazards` lo convierte en las tramas de aviso de SENDA y `corridorPack` se queda con lo que
 * afecta a tu ruta para guardarlo en la reserva antes de salir.
 *
 * Señales de carril neerlandesas (MSI, «matrixsignaalgevers»): `msiAdvice` traduce lo que muestra
 * cada pórtico (rood kruis = carril cerrado, flechas, velocidad obligatoria, fin de limitaciones) en un
 * aviso hablado. Saltarse un rood kruis se multa con al menos 260 € según Rijkswaterstaat. El formato
 * exacto del feed MSI de NDW está PENDIENTE de mapear (su documentación no es accesible desde este entorno).
 */
import { HAZARD } from './road-guard.mjs';
import { localFrame } from './geo-offline.mjs';

const NS = '(?:[\\w.-]+:)?';
const firstTag = (body, name) => { const m = body.match(new RegExp(`<${NS}${name}\\b[^>]*>([^<]*)</${NS}${name}>`)); return m ? m[1].trim() : null; };
const allTags = (body, name) => [...body.matchAll(new RegExp(`<${NS}${name}\\b[^>]*>([^<]*)</${NS}${name}>`, 'g'))].map((m) => m[1].trim());
const attr = (attrs, name) => { const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };

/** Lee todos los situationRecord de una publicación DATEX II (v2 o v3). */
export function parseDatex2(xml) {
  const out = [], re = new RegExp(`<(${NS}situationRecord)\\b([^>]*)>([\\s\\S]*?)</\\1>`, 'g');
  for (const m of xml.matchAll(re)) {
    const [, , attrs, body] = m, type = (attr(attrs, 'xsi:type') ?? '').replace(/^[\w.-]+:/, '') || 'Unknown';
    const lats = allTags(body, 'latitude').map(Number), lons = allTags(body, 'longitude').map(Number);
    let line = [];
    const pos = firstTag(body, 'posList');
    if (pos) { const v = pos.split(/\s+/).map(Number); for (let i = 0; i + 1 < v.length; i += 2) line.push({ lat: v[i], lon: v[i + 1] }); }
    if (!line.length && lats.length > 1) line = lats.map((lat, i) => ({ lat, lon: lons[i] }));
    const subtypes = {};
    for (const t of body.matchAll(new RegExp(`<${NS}(\\w+Type)\\b[^>]*>([^<]+)</`, 'g'))) (subtypes[t[1]] ??= []).push(t[2].trim());
    out.push({
      id: attr(attrs, 'id'), version: attr(attrs, 'version'), type,
      created: firstTag(body, 'situationRecordCreationTime'), start: firstTag(body, 'overallStartTime'), end: firstTag(body, 'overallEndTime'),
      status: firstTag(body, 'validityStatus'), probability: firstTag(body, 'probabilityOfOccurrence'), severity: firstTag(body, 'severity'),
      lat: lats[0] ?? line[0]?.lat ?? null, lon: lons[0] ?? line[0]?.lon ?? null, line,
      road: firstTag(body, 'roadNumber') ?? firstTag(body, 'roadName'), comment: firstTag(body, 'value'), subtypes,
    });
  }
  return out;
}

const TYPE_MAP = {
  Accident: HAZARD.CRASH, VehicleObstruction: HAZARD.STOPPED, AnimalPresenceObstruction: HAZARD.ANIMAL, GeneralObstruction: HAZARD.OBSTACLE,
  EnvironmentalObstruction: HAZARD.OBSTACLE, InfrastructureDamageObstruction: HAZARD.OBSTACLE, NonWeatherRelatedRoadConditions: HAZARD.OBSTACLE,
  DisturbanceActivity: HAZARD.OBSTACLE, AbnormalTraffic: HAZARD.QUEUE, PublicEvent: HAZARD.QUEUE, MaintenanceWorks: HAZARD.WORKS, ConstructionWorks: HAZARD.WORKS,
  Roadworks: HAZARD.WORKS, ReroutingManagement: HAZARD.WORKS, RoadOrCarriagewayOrLaneManagement: HAZARD.LANE_CLOSED, WinterDrivingManagement: HAZARD.ICE,
  WeatherRelatedRoadConditions: HAZARD.ICE, PoorEnvironmentConditions: HAZARD.FOG,
};
const LABEL = { [HAZARD.CRASH]: 'Accidente', [HAZARD.STOPPED]: 'Vehículo detenido', [HAZARD.ANIMAL]: 'Animal en la vía', [HAZARD.OBSTACLE]: 'Obstáculo', [HAZARD.QUEUE]: 'Retención', [HAZARD.WORKS]: 'Obras', [HAZARD.LANE_CLOSED]: 'Carril o calzada cerrados', [HAZARD.ICE]: 'Hielo o nieve', [HAZARD.FOG]: 'Visibilidad reducida', [HAZARD.FLOOD]: 'Inundación', [HAZARD.FIRE]: 'Incendio', [HAZARD.BRIDGE_OPEN]: 'Puente abierto' };

/** Del registro DATEX II a un peligro SENDA, afinando por subtipo (niebla, hielo, inundación, humo, puente). */
export function toHazard(rec) {
  let type = TYPE_MAP[rec.type] ?? HAZARD.OBSTACLE;
  // los valores DATEX II van en camelCase: «blackIce» → «black ice», para buscar palabras enteras
  const sub = Object.values(rec.subtypes).flat().map((v) => v.replace(/([a-z])([A-Z])/g, '$1 $2')).join(' ').toLowerCase();
  if (/\bsmoke\b/.test(sub) || /\bfire\b/.test(sub)) type = HAZARD.FIRE;
  else if (/\b(fog|mist)\b/.test(sub)) type = HAZARD.FOG;
  else if (/\b(ice|icy|snow|frost|freezing|slush)\b/.test(sub)) type = HAZARD.ICE;
  else if (/\bflood(ing|ed)?\b/.test(sub)) type = HAZARD.FLOOD;
  else if (/\bbridge\b/.test(sub) && /\b(open|opening|swing|lift)\b/.test(sub)) type = HAZARD.BRIDGE_OPEN;
  else if (/\b(lane closures?|lanes closed|road closed|carriageway closures?)\b/.test(sub)) type = HAZARD.LANE_CLOSED;
  return { id: rec.id, type, label: LABEL[type] ?? rec.type, lat: rec.lat, lon: rec.lon, road: rec.road, start: rec.start, active: rec.status !== 'suspended' && rec.status !== 'inactive', source: rec.type };
}
export const toHazards = (records) => records.map(toHazard).filter((h) => h.lat != null && h.active);

/** Solo lo que cae a menos de `bufferKm` de la ruta, ordenado por el orden en que te lo encontrarás. */
export function corridorPack(hazards, route, { bufferKm = 2 } = {}) {
  const f = localFrame(route[0].lat, route[0].lon), xy = route.map((p) => f.toXY(p.lat, p.lon)), cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
  const proj = (q) => { let best = { d: Infinity, s: 0 }; for (let i = 1; i < xy.length; i++) { const a = xy[i - 1], b = xy[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)), d = Math.hypot(q.x - a.x - u * dx, q.y - a.y - u * dy); if (d < best.d) best = { d, s: cum[i - 1] + u * Math.sqrt(l2) }; } return best; };
  const kept = hazards.map((h) => ({ ...h, ...((p) => ({ offKm: +(p.d / 1000).toFixed(2), alongKm: +(p.s / 1000).toFixed(1) }))(proj(f.toXY(h.lat, h.lon))) })).filter((h) => h.offKm <= bufferKm).sort((a, b) => a.alongKm - b.alongKm);
  return { hazards: kept, bytes: kept.length * 24, dropped: hazards.length - kept.length };
}

// ---------------------------------------------------------------- Señales de carril neerlandesas (MSI)
export const MSI = Object.freeze({ X: 'rood kruis: rijstrook dicht', AL: 'pijl links: rijstrook eindigt, voeg in naar links', AR: 'pijl rechts: rijstrook eindigt, voeg in naar rechts', END: 'einde alle beperkingen', BLANK: '' });
const SAY = {
  nl: { closed: (l) => `Rood kruis op rijstrook ${l}`, merge: (d) => `voeg in naar ${d === 'R' ? 'rechts' : 'links'}`, speed: (v) => `maximaal ${v}`, in: (m) => `Over ${m} meter` },
  es: { closed: (l) => `Carril ${l} cerrado (cruz roja)`, merge: (d) => `pásate a la ${d === 'R' ? 'derecha' : 'izquierda'}`, speed: (v) => `máximo ${v} obligatorio`, in: (m) => `A ${m} metros` },
  en: { closed: (l) => `Red cross over lane ${l}`, merge: (d) => `merge ${d === 'R' ? 'right' : 'left'}`, speed: (v) => `limit ${v}`, in: (m) => `In ${m} metres` },
};
/**
 * Próximo pórtico por delante: carriles cerrados (numerados desde la izquierda), hacia dónde pasarse y
 * velocidad obligatoria. `gantries`: [{ s, lanes: ['X','70','70'] }] sobre la misma calzada.
 */
export function msiAdvice(gantries, sMe, { lang = 'nl', maxAheadM = 2000 } = {}) {
  const next = gantries.filter((gt) => gt.s > sMe && gt.s - sMe <= maxAheadM).sort((a, b) => a.s - b.s)[0];
  if (!next) return null;
  const T = SAY[lang] ?? SAY.es, closed = next.lanes.map((v, i) => (v === 'X' ? i + 1 : null)).filter(Boolean), speeds = next.lanes.filter((v) => /^\d+$/.test(v)).map(Number);
  const open = next.lanes.map((v, i) => (v !== 'X' ? i + 1 : null)).filter(Boolean), dir = closed.length && open.length ? (Math.min(...open) > Math.max(...closed) ? 'R' : 'L') : null;
  const parts = [T.in(Math.round((next.s - sMe) / 50) * 50)];
  if (closed.length) parts.push(`${T.closed(closed.join(', '))}${dir ? ': ' + T.merge(dir) : ''}`);
  if (speeds.length) parts.push(T.speed(Math.min(...speeds)));
  return { atM: Math.round(next.s - sMe), closedLanes: closed, mergeTo: dir, speedLimit: speeds.length ? Math.min(...speeds) : null, allClosed: closed.length === next.lanes.length, say: parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('. ') + '.' };
}

/**
 * Publicación de EJEMPLO construida según la estructura de DATEX II v3 (situation → situationRecord con
 * xsi:type, validez, coordenadas y subtipos). NO es una captura real de la DGT ni de NDW: sirve para
 * probar el lector. La conexión real la hace el relé del organismo (ver scripts/datex-pack.mjs).
 */
export const SAMPLE_DATEX2 = `<?xml version="1.0" encoding="UTF-8"?>
<d2:payload xmlns:d2="http://datex2.eu/schema/3/d2Payload" xmlns:sit="http://datex2.eu/schema/3/situation" xmlns:loc="http://datex2.eu/schema/3/locationReferencing" xmlns:com="http://datex2.eu/schema/3/common" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="sit:SituationPublication" lang="es">
 <sit:situation id="EJ-1"><sit:headerInformation><com:informationStatus>real</com:informationStatus></sit:headerInformation>
  <sit:situationRecord id="EJ-1-1" version="1" xsi:type="sit:Accident"><sit:situationRecordCreationTime>2026-11-05T06:10:00Z</sit:situationRecordCreationTime><sit:probabilityOfOccurrence>certain</sit:probabilityOfOccurrence><sit:severity>high</sit:severity>
   <sit:validity><com:validityStatus>active</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>2026-11-05T06:08:00Z</com:overallStartTime></com:validityTimeSpecification></sit:validity>
   <sit:locationReference xsi:type="loc:PointLocation"><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>40.2010</loc:latitude><loc:longitude>-3.3005</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates><loc:roadInformation><loc:roadNumber>A-3</loc:roadNumber></loc:roadInformation></sit:locationReference>
   <sit:accidentType>collision</sit:accidentType></sit:situationRecord></sit:situation>
 <sit:situation id="EJ-2"><sit:situationRecord id="EJ-2-1" version="3" xsi:type="sit:PoorEnvironmentConditions"><sit:validity><com:validityStatus>active</com:validityStatus></sit:validity>
   <sit:locationReference xsi:type="loc:PointLocation"><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>39.9120</loc:latitude><loc:longitude>-2.5480</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates></sit:locationReference>
   <sit:poorEnvironmentType>fog</sit:poorEnvironmentType></sit:situationRecord></sit:situation>
 <sit:situation id="EJ-3"><sit:situationRecord id="EJ-3-1" version="2" xsi:type="sit:RoadOrCarriagewayOrLaneManagement"><sit:validity><com:validityStatus>active</com:validityStatus></sit:validity>
   <sit:locationReference xsi:type="loc:LinearLocation"><loc:gmlLineString><loc:posList>39.5620 -1.9150 39.5600 -1.9000</loc:posList></loc:gmlLineString><loc:roadInformation><loc:roadNumber>A-3</loc:roadNumber></loc:roadInformation></sit:locationReference>
   <sit:roadOrCarriagewayOrLaneManagementType>laneClosures</sit:roadOrCarriagewayOrLaneManagementType></sit:situationRecord></sit:situation>
 <sit:situation id="EJ-4"><sit:situationRecord id="EJ-4-1" version="1" xsi:type="sit:MaintenanceWorks"><sit:validity><com:validityStatus>suspended</com:validityStatus></sit:validity>
   <sit:locationReference xsi:type="loc:PointLocation"><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>39.4800</loc:latitude><loc:longitude>-0.5000</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates></sit:locationReference>
   <sit:roadMaintenanceType>resurfacingWork</sit:roadMaintenanceType></sit:situationRecord></sit:situation>
 <sit:situation id="EJ-5"><sit:situationRecord id="EJ-5-1" version="1" xsi:type="sit:VehicleObstruction"><sit:validity><com:validityStatus>active</com:validityStatus></sit:validity>
   <sit:locationReference xsi:type="loc:PointLocation"><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>42.8000</loc:latitude><loc:longitude>-1.6400</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates></sit:locationReference>
   <sit:vehicleObstructionType>brokenDownVehicle</sit:vehicleObstructionType></sit:situationRecord></sit:situation>
</d2:payload>`;

// ---------------------------------------------------------------- Medidas de tráfico y paneles (DATEX II)
/**
 * Medidas de estaciones de aforo (MeasuredDataPublication): caudal (veh/h) y velocidad media (km/h)
 * por punto de medida. Tolerante con prefijos y versiones; si hay varios carriles, suma caudales y
 * promedia velocidades ponderando por caudal.
 */
export function parseMeasured(xml) {
  const out = [], re = new RegExp(`<(${NS}siteMeasurements)\\b[^>]*>([\\s\\S]*?)</\\1>`, 'g');
  for (const m of xml.matchAll(re)) {
    const body = m[2], ref = body.match(new RegExp(`<${NS}measurementSiteReference\\b[^>]*\\bid="([^"]+)"`));
    const flows = allTags(body, 'vehicleFlowRate').map(Number), speeds = allTags(body, 'speed').map(Number);
    const flow = flows.reduce((a, b) => a + b, 0), speed = speeds.length ? (flows.length === speeds.length && flow > 0 ? speeds.reduce((s, v, i) => s + v * flows[i], 0) / flow : speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;
    out.push({ id: ref ? ref[1] : null, time: firstTag(body, 'measurementTimeDefault'), flowVehH: flows.length ? flow : null, speedKmh: speed == null ? null : +speed.toFixed(1) });
  }
  return out;
}
/** Paneles de mensaje variable: identificador, posición si viene y líneas de texto (cualquier elemento *TextLine). */
export function parseVms(xml) {
  const out = [], re = new RegExp(`<(${NS}(?:vmsUnit|vmsController|vmsControllerStatus|vmsUnitStatus|vms))\\b([^>]*)>([\\s\\S]*?)</\\1>`, 'g');
  for (const m of xml.matchAll(re)) {
    const body = m[3], lines = [...body.matchAll(new RegExp(`<${NS}\\w*[tT]extLine\\b[^>]*>([^<]+)</`, 'g'))].map((x) => x[1].trim()).filter(Boolean);
    if (!lines.length) continue;
    const lat = firstTag(body, 'latitude'), lon = firstTag(body, 'longitude');
    out.push({ id: attr(m[2], 'id'), lat: lat == null ? null : +lat, lon: lon == null ? null : +lon, lines });
  }
  return out;
}
/** Medidas de EJEMPLO con la estructura de DATEX II v3 (no son una captura real): 6 estaciones cada 1 km. */
export const SAMPLE_MEASURED = `<d2:payload xmlns:d2="http://datex2.eu/schema/3/d2Payload" xmlns:mst="http://datex2.eu/schema/3/measuredData" xmlns:roa="http://datex2.eu/schema/3/roadTrafficData" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="mst:MeasuredDataPublication">
${[[1800, 98], [1790, 96], [1810, 94], [1200, 22], [1180, 18], [1250, 24]].map(([q, v], i) => ` <mst:siteMeasurements><mst:measurementSiteReference id="EST-${i + 1}" version="1" targetClass="MeasurementSiteRecord"/><mst:measurementTimeDefault>2026-11-05T07:40:00Z</mst:measurementTimeDefault>
  <mst:physicalQuantity><mst:basicData xsi:type="roa:TrafficFlow"><roa:vehicleFlow><roa:vehicleFlowRate>${q}</roa:vehicleFlowRate></roa:vehicleFlow></mst:basicData></mst:physicalQuantity>
  <mst:physicalQuantity><mst:basicData xsi:type="roa:TrafficSpeed"><roa:averageVehicleSpeed><roa:speed>${v}</roa:speed></roa:averageVehicleSpeed></mst:basicData></mst:physicalQuantity></mst:siteMeasurements>`).join('\n')}
</d2:payload>`;
/** Paneles de EJEMPLO (estructura orientativa; no es una captura real de la DGT ni de NDW). */
export const SAMPLE_VMS = `<payload><vmsUnit id="PMV-A3-118"><latitude>40.05</latitude><longitude>-3.05</longitude><vmsTextLine>ACCIDENTE KM 121</vmsTextLine><vmsTextLine>CARRIL IZQ. CERRADO</vmsTextLine></vmsUnit>
<vmsUnit id="PMV-A3-160"><latitude>39.92</latitude><longitude>-2.6</longitude><vmsTextLine>NIEBLA</vmsTextLine><vmsTextLine>MODERE SU VELOCIDAD</vmsTextLine></vmsUnit>
<vmsUnit id="DRIP-A12-34"><vmsTextLine>ONGEVAL</vmsTextLine><vmsTextLine>FILE 4 KM</vmsTextLine></vmsUnit></payload>`;
