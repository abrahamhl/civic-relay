/**
 * SENDA · Drones: identificación remota (Open Drone ID), misión de barrido de fachadas y
 * dron como mula de datos entre zonas aisladas.
 *
 * Open Drone ID (ASTM F3411 / ASD-STAN EN 4709-002): mensajes de 25 bytes por Bluetooth/Wi-Fi.
 * La disposición de bytes sigue la estructura ODID_Location_encoded de opendroneid-core-c
 * (campos de bits con el primero declarado en los bits bajos). Validar con capturas reales
 * antes de uso operativo: aquí se prueba con ida y vuelta y vectores calculados a mano.
 */
export const ODID_TYPE = Object.freeze({ BASIC_ID: 0, LOCATION: 1, AUTH: 2, SELF_ID: 3, SYSTEM: 4, OPERATOR_ID: 5, PACK: 0xf });
const UA_TYPES = ['NONE', 'AEROPLANE', 'HELICOPTER_OR_MULTIROTOR', 'GYROPLANE', 'HYBRID_LIFT', 'ORNITHOPTER', 'GLIDER', 'KITE', 'FREE_BALLOON', 'CAPTIVE_BALLOON', 'AIRSHIP', 'FREE_FALL_PARACHUTE', 'ROCKET', 'TETHERED_POWERED_AIRCRAFT', 'GROUND_OBSTACLE', 'OTHER'];
const ID_TYPES = ['NONE', 'SERIAL_NUMBER', 'CAA_REGISTRATION_ID', 'UTM_ASSIGNED_UUID', 'SPECIFIC_SESSION_ID'];
const STATUS = ['UNDECLARED', 'GROUND', 'AIRBORNE', 'EMERGENCY', 'REMOTE_ID_SYSTEM_FAILURE'];

const alt = (v) => (v === 0 ? null : v * 0.5 - 1000);
const altEnc = (m) => (m == null ? 0 : Math.round((m + 1000) * 2));

export function encodeLocation({ status = 'AIRBORNE', lat, lon, altGeoM, heightM = null, directionDeg = 0, speedMs = 0, vSpeedMs = 0, tenthsSinceHour = 0 }) {
  const b = new Uint8Array(25), dv = new DataView(b.buffer);
  b[0] = (ODID_TYPE.LOCATION << 4) | 2; // versión de protocolo 2
  const ew = directionDeg >= 180 ? 1 : 0, mult = speedMs > 63.75 ? 1 : 0;
  b[1] = (STATUS.indexOf(status) << 4) | (0 << 2) | (ew << 1) | mult;
  b[2] = Math.round(ew ? directionDeg - 180 : directionDeg);
  b[3] = mult ? Math.min(254, Math.round((speedMs - 63.75) / 0.75)) : Math.round(speedMs / 0.25);
  dv.setInt8(4, Math.round(vSpeedMs / 0.5));
  dv.setInt32(5, Math.round(lat * 1e7), true); dv.setInt32(9, Math.round(lon * 1e7), true);
  dv.setUint16(13, 0, true); dv.setUint16(15, altEnc(altGeoM), true); dv.setUint16(17, altEnc(heightM), true);
  dv.setUint16(21, tenthsSinceHour, true);
  return b;
}

export function decodeOdid(b) {
  if (b.length < 25) return null;
  const type = b[0] >> 4, dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (type === ODID_TYPE.BASIC_ID) {
    const id = new TextDecoder().decode(b.subarray(2, 22)).replace(/\0+$/, '');
    return { type: 'BASIC_ID', idType: ID_TYPES[b[1] >> 4] ?? 'UNKNOWN', uaType: UA_TYPES[b[1] & 0x0f] ?? 'UNKNOWN', uasId: id };
  }
  if (type === ODID_TYPE.LOCATION) {
    const mult = b[1] & 1, ew = (b[1] >> 1) & 1;
    return {
      type: 'LOCATION', status: STATUS[b[1] >> 4] ?? 'UNKNOWN',
      directionDeg: b[2] + (ew ? 180 : 0), speedMs: mult ? b[3] * 0.75 + 63.75 : b[3] * 0.25, vSpeedMs: dv.getInt8(4) * 0.5,
      lat: dv.getInt32(5, true) / 1e7, lon: dv.getInt32(9, true) / 1e7,
      altBaroM: alt(dv.getUint16(13, true)), altGeoM: alt(dv.getUint16(15, true)), heightM: alt(dv.getUint16(17, true)),
      tenthsSinceHour: dv.getUint16(21, true),
    };
  }
  if (type === ODID_TYPE.PACK) {
    const size = b[1], count = b[2], out = [];
    for (let i = 0; i < count && 3 + (i + 1) * size <= b.length; i++) out.push(decodeOdid(b.subarray(3 + i * size, 3 + (i + 1) * size)));
    return { type: 'PACK', messages: out };
  }
  return { type: `TYPE_${type}` };
}

/* ---------------- misión de barrido de fachada (QGroundControl .plan) ---------------- */
const M_LAT = 111320;
/**
 * Anillos a la altura de cada planta, a `standoffM` de la fachada: el dron con el accesorio
 * ESP32 (hardware/esp32-survey) barre routers y balizas planta a planta. Devuelve el plan en
 * formato QGroundControl (MAVLink NAV_WAYPOINT, marco relativo al despegue).
 */
export function facadeMission({ center, widthM, depthM, levels, floorHeightM = 3, standoffM = 6, pointsPerRing = 12, holdS = 4 }) {
  const items = []; let seq = 1;
  const a = widthM / 2 + standoffM, b = depthM / 2 + standoffM, mLon = M_LAT * Math.cos((center.lat * Math.PI) / 180);
  for (let f = 0; f < levels; f++) {
    const altM = f * floorHeightM + 1.5;
    for (let i = 0; i < pointsPerRing; i++) {
      const th = (2 * Math.PI * i) / pointsPerRing, x = a * Math.cos(th), y = b * Math.sin(th);
      items.push({ AMSLAltAboveTerrain: null, Altitude: +altM.toFixed(1), AltitudeMode: 1, autoContinue: true, command: 16, doJumpId: seq++, frame: 3,
        params: [holdS, 0, 0, null, +(center.lat + y / M_LAT).toFixed(7), +(center.lon + x / mLon).toFixed(7), +altM.toFixed(1)], type: 'SimpleItem', senda: { floor: f } });
    }
  }
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); // Ramanujan
  const lengthM = levels * perimeter + (levels - 1) * floorHeightM;
  return {
    plan: { fileType: 'Plan', version: 1, groundStation: 'QGroundControl', geoFence: { circles: [], polygons: [], version: 2 }, rallyPoints: { points: [], version: 2 },
      mission: { version: 2, firmwareType: 12, vehicleType: 2, cruiseSpeed: 5, hoverSpeed: 2, plannedHomePosition: [center.lat, center.lon, 0], items: items.map(({ senda, ...it }) => it) } },
    waypoints: items.length, lengthM: Math.round(lengthM),
  };
}

/** ¿Puede un dron llevar paquetes entre dos zonas aisladas y volver? (energía y tiempo). */
export function muleSortie({ from, to, speedMs = 12, enduranceMin = 30, reserve = 0.2, exchangeS = 60 }) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat), dLon = toRad(to.lon - from.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  const d = 2 * 6371000 * Math.asin(Math.sqrt(h));
  const needS = (2 * d) / speedMs + exchangeS, availS = enduranceMin * 60 * (1 - reserve);
  return { distanceM: Math.round(d), roundTripMin: +(needS / 60).toFixed(1), feasible: needS <= availS, deliveryAfterMin: +((d / speedMs + exchangeS / 2) / 60).toFixed(1) };
}
