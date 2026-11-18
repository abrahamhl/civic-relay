/**
 * SENDA · Activación de área (modo administrador / 112).
 *
 * Caso: un ciudadano avisa de humo cerca de un edificio. El operador del 112 activa SENDA en ese
 * perímetro y necesita, en segundos, la «superficie» de la zona: qué teléfonos SENDA hay (en
 * agregado), qué cámaras públicas la ven, qué sensores de tráfico y estaciones meteorológicas hay,
 * cuándo pasó el último satélite útil y qué vio, cuánta gente vive o circula ahí. Con todo eso decide
 * y ordena: evacuar el edificio, confinar o vigilar.
 *
 * SENDA es el CANALIZADOR: escucha lo que se emite en abierto, consulta lo que se publica, pide a sus
 * propios teléfonos (con orden firmada y consentimiento) y FUSIONA. Lo que NO hace, por ley y por
 * diseño: entrar en dispositivos ajenos. Un coche, un aerogenerador o una cámara de terceros solo
 * aportan datos a través de su operador o fabricante (convenio, Ley de Datos de la UE con
 * consentimiento del usuario, Data for Road Safety) o de lo que emiten públicamente. Un pulso de
 * radio que «rebota» en un coche da distancia y movimiento (física de radar), no las lecturas de sus
 * sensores.
 *
 * Piezas:
 *  1. SURFACE_SOURCES — registro de fuentes con vía legal, latencia y módulo que las implementa.
 *  2. scanSurface — inventario del perímetro con distancias, frescura y estado de acceso.
 *  3. authorizeSurfaceRequest — permite, pide convenio o rechaza con su motivo.
 *  4. fuseHazardEvidence — fusión bayesiana en log-odds con dependencia de fuentes por linaje.
 *  5. evacuationDecision — tiempo de llegada del peligro, decisión y orden firmable.
 */
import { haversineKm } from './zones.mjs';

/** Vías de acceso (de menos a más restrictiva). */
export const SURFACE_ACCESS = Object.freeze({
  PUBLIC_OPEN: 'Dato público abierto: se consulta sin permiso especial (citar fuente y licencia)',
  PUBLIC_KEY: 'Dato público con clave gratuita del proveedor',
  PASSIVE_BROADCAST: 'Emisión pública destinada a ser recibida por cualquiera (se escucha, no se interroga)',
  SENDA_CONSENTED: 'Teléfono o accesorio SENDA cuyo dueño consintió; orden firmada por credencial institucional',
  AGREEMENT: 'Requiere convenio con el operador, fabricante o administración',
  NOT_ALLOWED: 'Fuera de alcance: acceso no autorizado a un sistema ajeno',
});

/**
 * Registro de fuentes de la superficie. `module`: dónde está implementado en el núcleo o en SENDA LIVE.
 * `status`: LIVE (funciona hoy), NEEDS_KEY, NEEDS_AGREEMENT, NOT_ALLOWED.
 */
export const SURFACE_SOURCES = Object.freeze([
  { id: 'SENDA_PHONES', what: 'Teléfonos SENDA en la zona: recuento agregado, estado, batería, barómetro, sirena, baliza', access: 'SENDA_CONSENTED', latencyS: 5, module: 'remote-command.mjs', status: 'LIVE' },
  { id: 'POPULATION_GRID', what: 'Residentes por km² (censo 2021, Eurostat/GISCO)', access: 'PUBLIC_OPEN', latencyS: 0, module: 'exposure.mjs', status: 'LIVE' },
  { id: 'TRAFFIC_SENSORS', what: 'Intensidad, ocupación y velocidad (Digitraffic, Informo Madrid, NAP DGT)', access: 'PUBLIC_OPEN', latencyS: 300, module: 'exposure.mjs · datex2.mjs', status: 'LIVE' },
  { id: 'PUBLIC_CAMERAS', what: 'Cámaras de tráfico y paisaje con licencia de reutilización', access: 'PUBLIC_OPEN', latencyS: 60, module: 'cameras.mjs', status: 'LIVE' },
  { id: 'GDACS', what: 'Evaluaciones de riesgo multirriesgo (sismo, incendio, inundación, ciclón)', access: 'PUBLIC_OPEN', latencyS: 1800, module: 'apps/senda-live gdacs-osint.mjs', status: 'LIVE' },
  { id: 'WEATHER_FORECAST', what: 'Viento, lluvia y humedad previstos (MET Norway)', access: 'PUBLIC_OPEN', latencyS: 3600, module: 'apps/senda-live', status: 'LIVE' },
  { id: 'SATELLITE_PASSES', what: 'Próximas pasadas y elevación de satélites (cálculo orbital)', access: 'PUBLIC_OPEN', latencyS: 0, module: 'orbital.mjs · satellites.mjs', status: 'LIVE' },
  { id: 'SENTINEL_SCENES', what: 'Última escena Sentinel-1/2 sobre el área (metadatos y miniatura)', access: 'PUBLIC_OPEN', latencyS: 86400, module: 'STAC de Copernicus (pendiente)', status: 'NEEDS_KEY' },
  { id: 'FIRMS_HOTSPOTS', what: 'Focos de calor VIIRS/MODIS de la última pasada', access: 'PUBLIC_KEY', latencyS: 10800, module: 'NASA FIRMS (MAP_KEY pendiente)', status: 'NEEDS_KEY' },
  { id: 'AEMET_STATIONS', what: 'Observaciones de estaciones meteorológicas oficiales', access: 'PUBLIC_KEY', latencyS: 3600, module: 'AEMET OpenData (clave gratuita pendiente)', status: 'NEEDS_KEY' },
  { id: 'ADSB_AIS_REMOTEID', what: 'Aeronaves (ADS-B), buques (AIS) y drones (Remote ID) que emiten su posición en abierto', access: 'PASSIVE_BROADCAST', latencyS: 1, module: 'receptor SDR / Open Drone ID', status: 'LIVE' },
  { id: 'MESHTASTIC_PUBLIC', what: 'Nodos LoRa Meshtastic que publican posición o telemetría en el canal público', access: 'PASSIVE_BROADCAST', latencyS: 30, module: 'puente Meshtastic (pendiente)', status: 'LIVE' },
  { id: 'V16_BEACONS', what: 'Balizas V16 de vehículos detenidos (DGT 3.0)', access: 'AGREEMENT', latencyS: 100, module: 'drive-cases.mjs (v16Fusion)', status: 'NEEDS_AGREEMENT' },
  { id: 'CONNECTED_CARS', what: 'Datos de coches conectados (temperatura, lluvia, ABS, airbag) vía fabricante con consentimiento (Ley de Datos UE) o Data for Road Safety', access: 'AGREEMENT', latencyS: 60, module: 'vehicle-link.mjs', status: 'NEEDS_AGREEMENT' },
  { id: 'WIND_FARM_SCADA', what: 'Anemómetro y estado de aerogeneradores', access: 'AGREEMENT', latencyS: 60, module: 'convenio con el operador eólico', status: 'NEEDS_AGREEMENT' },
  { id: 'SMART_METERS', what: 'Hora de corte eléctrico por vivienda', access: 'AGREEMENT', latencyS: 900, module: 'sensor-fabric.mjs (distribuidora)', status: 'NEEDS_AGREEMENT' },
]);

/** Peticiones que SENDA rechaza siempre, con su motivo (no es una lista exhaustiva). */
export const FORBIDDEN_REQUESTS = Object.freeze({
  CONTROL_THIRD_PARTY_VEHICLE: 'Activar o mandar órdenes a un coche ajeno es acceso no autorizado a un sistema informático (art. 197 bis del Código Penal) y un riesgo para la seguridad vial.',
  READ_DEVICE_BY_RADIO_INTRUSION: 'Leer los sensores de un aerogenerador, coche o equipo ajeno conectándose a él sin permiso es acceso no autorizado. Sus datos solo llegan por convenio con el operador o por consentimiento del dueño.',
  PAIR_UNKNOWN_BLUETOOTH: 'Emparejarse con dispositivos Bluetooth ajenos para extraer datos es acceso no autorizado; solo se escuchan anuncios públicos y en agregado.',
  PRIVATE_CAMERAS: 'Cámaras privadas sin licencia de reutilización: acceder a ellas es ilícito aunque estén indexadas en buscadores.',
  INTERCEPT_TETRA_OR_CELLULAR: 'Interceptar comunicaciones de emergencia o de telefonía vulnera el secreto de las comunicaciones.',
  INDIVIDUAL_TRACKING: 'Seguir a personas concretas o mostrar usuarios individuales en el mapa: SENDA solo maneja recuentos agregados (k ≥ 5).',
});

/* ------------------------------------------------------------------ 2. inventario */

const dist = (a, b) => haversineKm({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });

/**
 * Inventario del perímetro (círculo `center` + `radiusKm`). `inventory` contiene lo que los
 * adaptadores han traído: listas geolocalizadas por fuente con `observedAt` (ISO) cuando aplique.
 * Los teléfonos SENDA llegan como recuentos por celda; celdas con < k dispositivos se suprimen.
 * @returns {{perimeter, sources: Array, sendaDevices: {count:number, suppressedCells:number}, gaps: string[]}}
 */
export function scanSurface({ center, radiusKm, now = Date.now(), inventory = {}, kAnon = 5 }) {
  if (!(radiusKm > 0)) throw new RangeError('radiusKm > 0');
  const sources = [];
  for (const src of SURFACE_SOURCES) {
    const items = inventory[src.id];
    if (!Array.isArray(items)) continue;
    const near = items
      .map((it) => ({ ...it, distanceKm: Number.isFinite(it.lat) ? dist(center, it) : null }))
      .filter((it) => it.distanceKm === null || it.distanceKm <= radiusKm)
      .map((it) => ({ ...it, ageS: it.observedAt ? Math.max(0, (now - Date.parse(it.observedAt)) / 1000) : null }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    sources.push({ id: src.id, access: src.access, status: src.status, count: near.length, nearest: near.slice(0, 5), stale: near.filter((n) => n.ageS !== null && n.ageS > 3 * src.latencyS + 600).length });
  }
  // Teléfonos SENDA: solo agregados por celda y con umbral k-anónimo.
  let count = 0, suppressedCells = 0;
  for (const cell of inventory.SENDA_PHONE_CELLS ?? []) {
    if (dist(center, cell) > radiusKm) continue;
    if (cell.devices >= kAnon) count += cell.devices; else suppressedCells++;
  }
  const covered = new Set(sources.filter((s) => s.count > 0).map((s) => s.id));
  const gaps = SURFACE_SOURCES.filter((s) => !covered.has(s.id) && s.id !== 'SENDA_PHONES')
    .map((s) => `${s.id}: ${s.status === 'LIVE' ? 'sin datos en el perímetro' : s.status}`);
  return { perimeter: { center, radiusKm }, sources, sendaDevices: { count, suppressedCells, kAnon }, gaps };
}

/* ------------------------------------------------------------------ 3. autorización */

/**
 * Decide una petición del operador sobre la superficie.
 * @param {{sourceId?:string, kind?:keyof FORBIDDEN_REQUESTS|'COMMAND_SENDA_PHONES'|'READ'}} request
 * @param {{verifiedInstitution?:boolean, orgKind?:string, agreements?:string[], keys?:string[]}} actor
 * @returns {{decision:'ALLOW'|'NEEDS_AGREEMENT'|'NEEDS_KEY'|'DENY', reason:string}}
 */
export function authorizeSurfaceRequest(request, actor = {}) {
  if (request.kind && FORBIDDEN_REQUESTS[request.kind]) return { decision: 'DENY', reason: FORBIDDEN_REQUESTS[request.kind] };
  if (request.kind === 'COMMAND_SENDA_PHONES') {
    return actor.verifiedInstitution
      ? { decision: 'ALLOW', reason: 'Orden firmada por credencial institucional verificada; cada teléfono comprueba firma, zona y consentimiento (remote-command.mjs).' }
      : { decision: 'DENY', reason: 'Solo una credencial institucional verificada (roles.mjs) puede ordenar a los teléfonos de una zona.' };
  }
  const src = SURFACE_SOURCES.find((s) => s.id === request.sourceId);
  if (!src) return { decision: 'DENY', reason: `Fuente desconocida: ${request.sourceId}` };
  if (src.access === 'AGREEMENT') {
    return (actor.agreements ?? []).includes(src.id)
      ? { decision: 'ALLOW', reason: 'Convenio vigente con el operador.' }
      : { decision: 'NEEDS_AGREEMENT', reason: SURFACE_ACCESS.AGREEMENT };
  }
  if (src.access === 'PUBLIC_KEY' && !(actor.keys ?? []).includes(src.id)) return { decision: 'NEEDS_KEY', reason: SURFACE_ACCESS.PUBLIC_KEY };
  if (src.access === 'SENDA_CONSENTED' && !actor.verifiedInstitution) return { decision: 'DENY', reason: 'Requiere credencial institucional verificada.' };
  return { decision: 'ALLOW', reason: SURFACE_ACCESS[src.access] };
}

/* ------------------------------------------------------------------ 4. fusión de evidencias */

/**
 * Razones de verosimilitud por tipo de evidencia de un peligro localizado (p. ej. fuego cerca de un
 * edificio). HIPÓTESIS DE PLANIFICACIÓN a calibrar con casos reales: LR > 1 apoya, LR < 1 resta.
 */
export const EVIDENCE_LR = Object.freeze({
  CITIZEN_REPORT: { present: 4, absent: 1 },
  CITIZEN_REPORT_WITH_PHOTO: { present: 12, absent: 1 },
  CAMERA_OPERATOR_CONFIRMED: { present: 60, absent: 0.3 },
  SATELLITE_HOTSPOT: { present: 20, absent: 0.7 },
  SENDA_PHONE_SMOKE_SENSOR: { present: 6, absent: 0.9 },
  GDACS_WILDFIRE_EVENT: { present: 5, absent: 1 },
});

/**
 * Fusión en log-odds: logit(P) = logit(prior) + Σ log LR. Las evidencias que comparten `lineage`
 * (mismo origen: p. ej. un evento GDACS-WF y un foco FIRMS, ambos del satélite) cuentan UNA vez:
 * dentro de cada linaje solo se usa la de mayor |log LR|.
 * @param {Array<{type:keyof EVIDENCE_LR, present:boolean, lineage?:string, id?:string}>} evidence
 */
export function fuseHazardEvidence(evidence, { prior = 0.02 } = {}) {
  if (!(prior > 0 && prior < 1)) throw new RangeError('prior ∈ (0, 1)');
  const byLineage = new Map();
  for (const e of evidence) {
    const lr = EVIDENCE_LR[e.type];
    if (!lr) throw new RangeError(`tipo de evidencia desconocido: ${e.type}`);
    const w = Math.log(e.present ? lr.present : lr.absent);
    const key = e.lineage ?? `own:${e.id ?? byLineage.size}`;
    const prev = byLineage.get(key);
    if (!prev || Math.abs(w) > Math.abs(prev.w)) byLineage.set(key, { ...e, w });
  }
  const used = [...byLineage.values()];
  const logit = Math.log(prior / (1 - prior)) + used.reduce((a, e) => a + e.w, 0);
  const posterior = 1 / (1 + Math.exp(-logit));
  return {
    posterior,
    prior,
    used: used.map(({ type, present, lineage, w }) => ({ type, present, lineage: lineage ?? null, logLR: +w.toFixed(3) })),
    discardedAsDependent: evidence.length - used.length,
  };
}

/* ------------------------------------------------------------------ 5. decisión de evacuación */

/**
 * Tiempo hasta que el peligro alcanza el edificio y decisión.
 * @param {object} o
 * @param {{lat:number, lon:number}} o.building
 * @param {{lat:number, lon:number, spreadMps:number}} o.hazard  frente y su velocidad de avance hacia el edificio
 * @param {number} o.pHazard  probabilidad fusionada de que el peligro sea real
 * @param {number} o.occupants  personas estimadas dentro (exposure.mjs o recuento SENDA)
 * @param {number} [o.evacuationRateP_s=1.3]  personas/s por salida (hipótesis; ≈ 1,3 p/s por metro de puerta)
 * @param {number} [o.exits=2]
 * @param {number} [o.marginS=300]  margen de seguridad exigido
 */
export function evacuationDecision({ building, hazard, pHazard, occupants, evacuationRateP_s = 1.3, exits = 2, marginS = 300, alertLatencyS = 30, reactionS = 120 }) {
  if (!(pHazard >= 0 && pHazard <= 1)) throw new RangeError('pHazard ∈ [0, 1]');
  if (!(hazard.spreadMps >= 0)) throw new RangeError('spreadMps ≥ 0');
  const dM = dist(building, hazard) * 1000;
  const arrivalS = hazard.spreadMps > 0 ? dM / hazard.spreadMps : Infinity;
  const egressS = alertLatencyS + reactionS + occupants / (evacuationRateP_s * Math.max(1, exits));
  const slackS = arrivalS - egressS;
  let decision;
  if (pHazard >= 0.5 && slackS >= marginS) decision = 'EVACUATE';
  else if (pHazard >= 0.5 && slackS < marginS) decision = 'SHELTER_IN_PLACE_OR_EVACUATE_NOW_IF_ROUTE_SAFE';
  else if (pHazard >= 0.15) decision = 'VERIFY_AND_PREPARE';
  else decision = 'MONITOR';
  const command = decision.startsWith('EVACUATE') || decision.startsWith('SHELTER')
    ? { target: { type: 'circle', lat: building.lat, lon: building.lon, radiusM: 80 }, actions: ['SIREN', 'REPORT_STATUS'], requiresSignedCredential: true, module: 'remote-command.mjs signCommand' }
    : null;
  return { distanceM: Math.round(dM), arrivalS, egressS, slackS, decision, pHazard, command };
}
