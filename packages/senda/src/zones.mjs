/**
 * Zonas de emergencia y activación del modo relé.
 *
 * Fuentes, de más a menos autoridad:
 *  1. OFFICIAL  — alerta de una autoridad (EU-Alert/ES-Alert/NL-Alert vía CAP 1.2) cuya
 *                 firma verifica un ancla de confianza configurada.
 *  2. PUBLIC_FEED — catálogos públicos (EMSC, USGS, IGN, Meteoalarm) con su procedencia.
 *  3. SENDA_NETWORK — detección propia por acelerómetros de teléfonos participantes.
 * Una zona OFFICIAL activa el relé de inmediato. Una detección propia solo lo activa si
 * otra fuente independiente la corrobora; si no, queda en STANDBY y se pregunta al usuario.
 * SENDA redistribuye alertas como canal SECUNDARIO; no emite alertas oficiales.
 */
const R_EARTH_KM = 6371;
export function haversineKm(a, b) {
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inZone(point, zone) {
  if (zone.circle) return haversineKm(point, zone.circle.center) <= zone.circle.radiusKm;
  if (zone.polygon) return pointInPolygon(point, zone.polygon);
  return false;
}

/**
 * Alerta oficial (CAP 1.2 simplificado). `verifyIssuer(alert)` debe comprobar la firma
 * contra un ancla institucional y devolver true; sin verificación → rechazada.
 */
export async function ingestOfficialAlert(alert, { verifyIssuer, now }) {
  if (alert.status !== 'Actual') return { accepted: false, reason: 'NOT_ACTUAL' };
  if (!['Alert', 'Update'].includes(alert.msgType)) return { accepted: false, reason: 'MSGTYPE' };
  if (!(Date.parse(alert.expires) > now)) return { accepted: false, reason: 'EXPIRED' };
  if (typeof verifyIssuer !== 'function' || !(await verifyIssuer(alert))) return { accepted: false, reason: 'UNVERIFIED_ISSUER' };
  return { accepted: true, zone: {
    id: `official:${alert.identifier}`, source: 'OFFICIAL', sender: alert.sender, event: alert.event,
    severity: alert.severity, expiresAt: Date.parse(alert.expires),
    polygon: alert.area.polygon, circle: alert.area.circle,
  } };
}

/**
 * Evento sísmico de un catálogo público. Radio de afección HEURÍSTICO (no oficial):
 * r_km = 10^(0.48·M − 1) → M5 ≈ 25 km, M6 ≈ 76 km, M7 ≈ 229 km. Etiquetado MODELLED.
 */
export function zoneFromQuake({ id, mag, lat, lon, time, provider }, { ttlHours = 24 } = {}) {
  const radiusKm = Math.round(10 ** (0.48 * mag - 1));
  return { id: `${provider}:${id}`, source: 'PUBLIC_FEED', provider, event: `Sismo M${mag}`, severity: mag >= 6 ? 'Severe' : mag >= 5 ? 'Moderate' : 'Minor',
    circle: { center: { lat, lon }, radiusKm }, expiresAt: time + ttlHours * 3600_000, radiusModel: 'MODELLED_HEURISTIC' };
}

/**
 * Perfil de consentimiento firmado en la instalación (términos de uso). Es lo que hace
 * que el relé esté PREAUTORIZADO cuando se declara una zona, sin preguntar en el peor momento.
 */
export function createConsentProfile({ termsVersion, relayInDeclaredZones = false, maxBatteryPct = 20, maxDataMB = 200,
  shareApproxLocationWithCoordinators = false, acceptedAt }) {
  if (!termsVersion || !acceptedAt) throw new Error('Consentimiento sin versión de términos o fecha');
  return Object.freeze({ termsVersion, relayInDeclaredZones, maxBatteryPct, maxDataMB, shareApproxLocationWithCoordinators, acceptedAt });
}

/**
 * ¿Debe este teléfono actuar de relé ahora?
 * @returns {{mode:'OFF'|'STANDBY'|'RELAY_ACTIVE', relayActive:boolean, zones:Array, reason:string}}
 */
export function relayActivation({ zones, position, consent, now, battery = 100, dataUsedMB = 0 }) {
  const live = zones.filter((z) => z.expiresAt > now && inZone(position, z));
  if (!live.length) return { mode: 'OFF', relayActive: false, zones: [], reason: 'Fuera de cualquier zona activa' };
  if (!consent?.relayInDeclaredZones) return { mode: 'STANDBY', relayActive: false, zones: live, reason: 'Sin preautorización de relé: se pregunta al usuario' };
  if (battery < 25) return { mode: 'STANDBY', relayActive: false, zones: live, reason: 'Límite de batería del consentimiento' };
  if (dataUsedMB >= consent.maxDataMB) return { mode: 'STANDBY', relayActive: false, zones: live, reason: 'Límite de datos del consentimiento' };
  const official = live.some((z) => z.source === 'OFFICIAL');
  const sources = new Set(live.map((z) => z.source));
  if (official || sources.size >= 2) {
    return { mode: 'RELAY_ACTIVE', relayActive: true, zones: live, reason: official ? 'Alerta oficial verificada' : 'Detección corroborada por dos fuentes independientes' };
  }
  return { mode: 'STANDBY', relayActive: false, zones: live, reason: 'Una sola fuente no oficial: se espera corroboración' };
}
