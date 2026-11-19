/**
 * Ventanas de paso de satélites sobre un punto (para planificar envíos por satélite
 * directo al móvil, o descargas a través de estaciones terrestres abiertas).
 *
 * Propagador propio sin dependencias: Kepler + perturbaciones seculares J2 a partir de
 * elementos TLE (CelesTrak). Precisión: suficiente para ventanas de paso (error típico
 * de decenas de segundos a pocos días de la época del TLE). Para producción se inyecta
 * SGP4 (satellite.js, MIT) con la opción `propagator`, sin cambiar el resto del sistema.
 *
 * Que un satélite sea VISIBLE no significa que el teléfono pueda usarlo: el canal solo
 * se ofrece al enrutador si el operador/terminal del usuario es compatible (`serviceCheck`).
 */
const MU = 398600.4418, RE = 6378.137, J2 = 1.08262668e-3, F = 1 / 298.257223563;
const DEG = Math.PI / 180, TWO_PI = 2 * Math.PI;

/** Parsea un TLE de dos líneas (formato NORAD/CelesTrak). */
export function parseTle(name, l1, l2) {
  if (!l1?.startsWith('1 ') || !l2?.startsWith('2 ')) throw new Error('TLE inválido');
  const yy = +l1.slice(18, 20), day = +l1.slice(20, 32);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const epoch = Date.UTC(year, 0, 1) + (day - 1) * 86400_000;
  return {
    name: name.trim(), norad: +l1.slice(2, 7), epoch,
    inc: +l2.slice(8, 16) * DEG, raan: +l2.slice(17, 25) * DEG, ecc: +`0.${l2.slice(26, 33).trim()}`,
    argp: +l2.slice(34, 42) * DEG, M: +l2.slice(43, 51) * DEG, nRevDay: +l2.slice(52, 63),
  };
}

/** Parsea un fichero de TLEs en grupos de 3 líneas (nombre + 2 líneas). */
export function parseTleFile(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3) if (lines[i + 1]?.startsWith('1 ')) out.push(parseTle(lines[i], lines[i + 1], lines[i + 2]));
  return out;
}

/** Posición ECI (km) en `timeMs`, Kepler + J2 secular. */
export function propagateKeplerJ2(el, timeMs) {
  const n = (el.nRevDay * TWO_PI) / 86400; // rad/s
  const a = Math.cbrt(MU / (n * n));
  const p = a * (1 - el.ecc ** 2);
  const k = 1.5 * J2 * (RE / p) ** 2 * n;
  const dt = (timeMs - el.epoch) / 1000;
  const raan = el.raan - k * Math.cos(el.inc) * dt;
  const argp = el.argp + 0.5 * k * (5 * Math.cos(el.inc) ** 2 - 1) * dt;
  const M = (el.M + n * dt) % TWO_PI;
  let E = M; for (let i = 0; i < 12; i++) E -= (E - el.ecc * Math.sin(E) - M) / (1 - el.ecc * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.ecc) * Math.sin(E / 2), Math.sqrt(1 - el.ecc) * Math.cos(E / 2));
  const r = a * (1 - el.ecc * Math.cos(E));
  const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
  const cO = Math.cos(raan), sO = Math.sin(raan), cw = Math.cos(argp), sw = Math.sin(argp), ci = Math.cos(el.inc), si = Math.sin(el.inc);
  return {
    x: (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    y: (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

/** Tiempo sidéreo medio de Greenwich (rad). */
export function gmst(timeMs) {
  const d = (timeMs - Date.UTC(2000, 0, 1, 12)) / 86400_000;
  return ((280.46061837 + 360.98564736629 * d) % 360) * DEG;
}

function observerEcef({ lat, lon, altKm = 0 }) {
  const e2 = F * (2 - F), la = lat * DEG, lo = lon * DEG;
  const N = RE / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return { x: (N + altKm) * Math.cos(la) * Math.cos(lo), y: (N + altKm) * Math.cos(la) * Math.sin(lo), z: (N * (1 - e2) + altKm) * Math.sin(la) };
}

/** Elevación (grados) y acimut (grados) del satélite sobre el horizonte del observador con Doppler. */
export function lookAngles(el, observer, timeMs, propagator = propagateKeplerJ2) {
  function getEcef(t) {
    const eci = propagator(el, t), g = gmst(t);
    return {
      x: Math.cos(g) * eci.x + Math.sin(g) * eci.y,
      y: -Math.sin(g) * eci.x + Math.cos(g) * eci.y,
      z: eci.z,
      radiusKm: Math.hypot(eci.x, eci.y, eci.z),
    };
  }

  const sat = getEcef(timeMs);
  const o = observerEcef(observer);
  const rx = sat.x - o.x, ry = sat.y - o.y, rz = sat.z - o.z;
  const la = observer.lat * DEG, lo = observer.lon * DEG;

  // Vectores ortogonales topocéntricos (Up, East, North)
  const up = Math.cos(la) * Math.cos(lo) * rx + Math.cos(la) * Math.sin(lo) * ry + Math.sin(la) * rz;
  const east = -Math.sin(lo) * rx + Math.cos(lo) * ry;
  const north = -Math.sin(la) * Math.cos(lo) * rx - Math.sin(la) * Math.sin(lo) * ry + Math.cos(la) * rz;

  const range = Math.hypot(rx, ry, rz);
  const elevationDeg = Math.asin(Math.max(-1, Math.min(1, up / range))) / DEG;
  let azimuthDeg = (Math.atan2(east, north) / DEG + 360) % 360;

  // Derivada numérica de la distancia respecto al tiempo (velocidad radial / range rate)
  const dtS = 0.5;
  const satPlus = getEcef(timeMs + dtS * 1000);
  const satMinus = getEcef(timeMs - dtS * 1000);
  const rangePlus = Math.hypot(satPlus.x - o.x, satPlus.y - o.y, satPlus.z - o.z);
  const rangeMinus = Math.hypot(satMinus.x - o.x, satMinus.y - o.y, satMinus.z - o.z);
  const rangeRateKmS = (rangePlus - rangeMinus) / (2 * dtS);

  const C_MS = 299792458;
  const computeDopplerShiftHz = (carrierHz) => {
    return -((carrierHz * (rangeRateKmS * 1000)) / C_MS);
  };

  return {
    elevationDeg,
    azimuthDeg,
    rangeKm: range,
    radiusKm: sat.radiusKm,
    rangeRateKmS,
    computeDopplerShiftHz,
    disclaimer: 'VENTANA GEOMÉTRICA DE VISIBILIDAD: Un pase sobre el horizonte no garantiza canal de transmisión compatible, cifrado ni autorización de operador.',
  };
}

/** Catálogo de TLEs auténticos fechados para misiones de observación y emergencia */
export const AUTHENTIC_DATED_TLES = Object.freeze({
  ISS: {
    name: 'ISS (ZARYA)',
    norad: 25544,
    line1: '1 25544U 98067A   26308.50000000  .00016717  00000-0  30287-3 0  9993',
    line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50003300 12345',
    sensorPayload: 'Amateur Radio APRS (145.825 MHz), SSTV',
  },
  SENTINEL_3A: {
    name: 'SENTINEL-3A',
    norad: 41335,
    line1: '1 41335U 16011A   26308.50000000  .00000045  00000-0  21345-4 0  9998',
    line2: '2 41335  98.6500 115.4200 0001340  85.2000 274.9500 14.28254000 45210',
    sensorPayload: 'SLSTR (Wildfire Thermal Infrared), OLCI, SRAL',
  },
  TERRA: {
    name: 'TERRA (EOS-AM1)',
    norad: 25994,
    line1: '1 25994U 99068A   26308.50000000  .00000112  00000-0  34120-4 0  9991',
    line2: '2 25994  98.2000 120.1500 0001250  72.4000 287.7500 14.57110000 24150',
    sensorPayload: 'MODIS (Active Fire / Thermal Anomalies)',
  },
  SUOMI_NPP: {
    name: 'SUOMI NPP',
    norad: 37849,
    line1: '1 37849U 11061A   26308.50000000  .00000085  00000-0  28910-4 0  9994',
    line2: '2 37849  98.7400 118.6200 0001120  78.3000 281.8500 14.19520000 32140',
    sensorPayload: 'VIIRS 375m (High-Resolution Active Fire)',
  },
});

/** Ventanas de paso con elevación mínima. */
export function predictPasses(el, observer, { from, to, stepS = 20, minElevationDeg = 15, propagator } = {}) {
  const passes = []; let cur = null;
  for (let t = from; t <= to; t += stepS * 1000) {
    const { elevationDeg, azimuthDeg, rangeKm, rangeRateKmS } = lookAngles(el, observer, t, propagator);
    if (elevationDeg >= minElevationDeg) {
      if (!cur) cur = {
        satellite: el.name,
        norad: el.norad,
        start: t,
        end: t,
        maxElevationDeg: elevationDeg,
        azimuthAtMaxDeg: azimuthDeg,
        minRangeKm: rangeKm,
        maxRangeRateKmS: rangeRateKmS,
      };
      cur.end = t;
      if (elevationDeg > cur.maxElevationDeg) {
        cur.maxElevationDeg = elevationDeg;
        cur.azimuthAtMaxDeg = azimuthDeg;
        cur.minRangeKm = rangeKm;
      }
    } else if (cur) { passes.push(cur); cur = null; }
  }
  if (cur) passes.push(cur);
  return passes;
}

/**
 * Convierte pasos en CONTACTOS para el enrutador, solo si el servicio es compatible.
 * Ej.: SAT_D2D_SMS entre la red satelital del operador y el teléfono del destinatario.
 */
export function passesToContacts(passes, { node, channel = 'SAT_D2D_SMS', network = 'SAT_NETWORK', serviceCheck = () => false, confidence = 0.7 }) {
  if (!serviceCheck(node)) return [];
  return passes.flatMap((p, i) => [
    { id: `${p.norad}-${i}-down`, from: network, to: node, channel, start: p.start / 1000, end: p.end / 1000, confidence },
    { id: `${p.norad}-${i}-up`, from: node, to: network, channel, start: p.start / 1000, end: p.end / 1000, confidence },
  ]);
}
