/**
 * SENDA · Humo en el suelo: cuánta PM2.5 llega a cada pueblo a sotavento de un incendio, calculado desde casa.
 *
 * atmos3d.mjs ya calcula cuánto SUBE la pluma (Briggs). Este módulo calcula cuánto BAJA al nivel del suelo:
 * modelo gaussiano de penacho estacionario con reflexión total en el suelo (la forma de los modelos
 * reglamentarios de dispersión, p. ej. el «Workbook of Atmospheric Dispersion Estimates», Turner 1970):
 *
 *   C(x, y, z) = Q / (2π·u·σy·σz) · e^(−y²/2σy²) · [ e^(−(z−H)²/2σz²) + e^(−(z+H)²/2σz²) ]
 *   C(x, y, 0) = Q / (π·u·σy·σz) · e^(−y²/2σy²) · e^(−H²/2σz²)
 *
 * con σy(x), σz(x) de Briggs (1973) para terreno rural según la clase de estabilidad de Pasquill (A–F), y la
 * clase obtenida de la tabla de Pasquill–Turner a partir del viento en superficie y la insolación o la nubosidad
 * nocturna. Comprobación física incluida: el flujo de masa a través de cualquier plano vertical a sotavento,
 * ∬ u·C dy dz (z ≥ 0), debe ser igual a Q (conservación de la masa); la prueba lo integra numéricamente.
 *
 * Emisión Q (g/s de PM2.5) = combustible consumido por segundo (kg/s) × factor de emisión (g/kg). AMBOS se
 * DECLARAN: el factor depende del tipo de vegetación y de la fase de combustión (bibliografía de factores de
 * emisión de biomasa, p. ej. Andreae 2019) y aquí no lleva valor por defecto.
 *
 * Límites (rotulados en la salida): penacho estacionario y terreno llano, viento uniforme, sin química ni
 * deposición, promedios del orden de una hora; no sustituye a un modelo operativo de calidad del aire ni a
 * las estaciones de medida. Sirve para decir ANTES dónde mirar y a quién avisar, y se contrasta con lo medido.
 * Umbral de referencia: guía de la OMS de 2021 para PM2.5, 15 µg/m³ como media de 24 h.
 */

export const WHO_2021_PM25_24H = Object.freeze({ ugm3: 15, source: 'OMS, WHO global air quality guidelines (2021), PM2.5 media de 24 h' });
const need = (name, o, keys) => { for (const k of keys) if (!Number.isFinite(o?.[k])) throw new Error(`${name}: «${k}» debe declararse`); };

/** Coeficientes de dispersión de Briggs (1973), terreno rural, x en metros (válidos ~100 m – 10 km). */
export const BRIGGS_VALID_MAX_M = 10_000; // rango habitual de validez de las curvas (≈ 0,1–10 km)
const BRIGGS_RURAL = Object.freeze({
  A: { sy: (x) => 0.22 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.20 * x },
  B: { sy: (x) => 0.16 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.12 * x },
  C: { sy: (x) => 0.11 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.08 * x / Math.sqrt(1 + 0.0002 * x) },
  D: { sy: (x) => 0.08 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.06 * x / Math.sqrt(1 + 0.0015 * x) },
  E: { sy: (x) => 0.06 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.03 * x / (1 + 0.0003 * x) },
  F: { sy: (x) => 0.04 * x / Math.sqrt(1 + 0.0001 * x), sz: (x) => 0.016 * x / (1 + 0.0003 * x) },
});
export const STABILITY_CLASSES = Object.freeze(Object.keys(BRIGGS_RURAL));
export function sigmas(cls, x) { const b = BRIGGS_RURAL[cls]; if (!b) throw new Error(`clase de estabilidad desconocida: ${cls}`); return { sy: b.sy(x), sz: b.sz(x) }; }

/**
 * Tabla de Pasquill–Turner (Turner 1970). Día: insolación STRONG/MODERATE/SLIGHT. Noche: nubosidad
 * ≥ 4/8 (CLOUDY) o ≤ 3/8 (CLEAR). Celdas intermedias (p. ej. «A–B») se resuelven hacia la más inestable.
 * La tabla original no da clase de noche con viento < 2 m/s: se usa la de 2–3 m/s (E/F);
 * `pasquillIsAssumed` lo indica para rotularlo.
 * Viento a 10 m en m/s.
 */
export function pasquillClass({ windMs, day, insolation, nightCloud }) {
  if (!Number.isFinite(windMs) || windMs < 0) throw new RangeError('windMs ≥ 0');
  const row = windMs < 2 ? 0 : windMs < 3 ? 1 : windMs < 5 ? 2 : windMs < 6 ? 3 : 4;
  if (day) {
    const col = { STRONG: 0, MODERATE: 1, SLIGHT: 2 }[insolation]; if (col == null) throw new Error('insolation: STRONG | MODERATE | SLIGHT');
    return [['A', 'A', 'B'], ['A', 'B', 'C'], ['B', 'B', 'C'], ['C', 'C', 'D'], ['C', 'D', 'D']][row][col];
  }
  const col = { CLOUDY: 0, CLEAR: 1 }[nightCloud]; if (col == null) throw new Error('nightCloud: CLOUDY | CLEAR');
  return [['E', 'F'], ['E', 'F'], ['D', 'E'], ['D', 'D'], ['D', 'D']][row][col];
}

/** true si la clase sale de la extensión nocturna con viento < 2 m/s (no tabulada en el original). */
export const pasquillIsAssumed = ({ windMs, day }) => !day && windMs < 2;

/** Emisión de PM2.5 (g/s) = consumo de combustible (kg/s) × factor de emisión (g/kg), ambos declarados. */
export function emissionGs({ fuelConsumedKgS, emissionFactorGkg }) {
  need('emissionGs', { fuelConsumedKgS, emissionFactorGkg }, ['fuelConsumedKgS', 'emissionFactorGkg']);
  return fuelConsumedKgS * emissionFactorGkg;
}
/**
 * Consumo de combustible de un frente (kg/s) desde la intensidad de Byram I = H·w·r (kW/m):
 * masa quemada por metro de frente y segundo = I / H (H en kJ/kg). Todo declarado.
 */
export function fuelConsumptionFromFront({ byramKWm, heatContentKJkg, frontLengthM }) {
  need('fuelConsumptionFromFront', { byramKWm, heatContentKJkg, frontLengthM }, ['byramKWm', 'heatContentKJkg', 'frontLengthM']);
  return (byramKWm / heatContentKJkg) * frontLengthM;
}

/** Concentración (g/m³) en (x a sotavento, y transversal, z altura), con reflexión en el suelo. x ≤ 0 ⇒ 0. */
export function plumeConcentration({ Q, u, H, cls }, x, y, z = 0) {
  if (x <= 0) return 0;
  const { sy, sz } = sigmas(cls, x);
  return (Q / (2 * Math.PI * u * sy * sz)) * Math.exp(-(y * y) / (2 * sy * sy)) * (Math.exp(-((z - H) ** 2) / (2 * sz * sz)) + Math.exp(-((z + H) ** 2) / (2 * sz * sz)));
}

/** Flujo de masa (g/s) a través del plano vertical x = cte, integrado numéricamente (debe ser ≈ Q). */
export function massFluxThroughPlane(p, x, { ny = 400, nz = 400 } = {}) {
  const { sy, sz } = sigmas(p.cls, x), Y = 8 * sy, Z = p.H + 8 * sz, dy = (2 * Y) / ny, dz = Z / nz;
  let s = 0;
  for (let i = 0; i < ny; i++) for (let j = 0; j < nz; j++) s += plumeConcentration(p, x, -Y + (i + 0.5) * dy, (j + 0.5) * dz);
  return p.u * s * dy * dz;
}

/** Máximo de concentración en el suelo a lo largo del eje y la distancia a la que ocurre (búsqueda en malla log). */
export function groundMaximum(p, { xMin = 100, xMax = BRIGGS_VALID_MAX_M, steps = 400 } = {}) {
  let best = { x: xMin, c: 0 };
  for (let i = 0; i <= steps; i++) { const x = xMin * (xMax / xMin) ** (i / steps), c = plumeConcentration(p, x, 0, 0); if (c > best.c) best = { x, c }; }
  return { xM: best.x, ugm3: best.c * 1e6 };
}

/**
 * Exposición de puntos (pueblos) dado un foco en (lat, lon), viento que SOPLA HACIA `windToDeg` (0 = norte,
 * sentido horario) y altura efectiva H. Proyección local equirrectangular (válida a escala de decenas de km).
 */
export function exposureAtPoints(src, points, threshold = WHO_2021_PM25_24H.ugm3) {
  need('exposureAtPoints', src, ['lat', 'lon', 'windToDeg', 'Q', 'u', 'H']);
  const R = 6_371_008.8, rad = Math.PI / 180, th = src.windToDeg * rad, ex = Math.sin(th), ey = Math.cos(th);
  return points.map((pt) => {
    const dx = (pt.lon - src.lon) * rad * R * Math.cos(src.lat * rad), dy = (pt.lat - src.lat) * rad * R;
    const along = dx * ex + dy * ey, cross = -dx * ey + dy * ex;
    const ugm3 = plumeConcentration(src, along, cross, 0) * 1e6;
    return { name: pt.name, alongM: Math.round(along), crossM: Math.round(cross), ugm3: ugm3 === 0 ? 0 : Number(ugm3.toPrecision(3)), overThreshold: ugm3 > threshold };
  });
}

/** Área (ha) del suelo por encima del umbral, integrando en una malla a sotavento. */
export function areaOverThresholdHa(p, threshold = WHO_2021_PM25_24H.ugm3, { xMax = BRIGGS_VALID_MAX_M, cell = 100 } = {}) {
  let n = 0, farthest = 0;
  for (let x = cell / 2; x < xMax; x += cell) {
    const { sy } = sigmas(p.cls, x), Y = 5 * sy;
    for (let y = -Y; y <= Y; y += cell) if (plumeConcentration(p, x, y, 0) * 1e6 > threshold) { n++; farthest = Math.max(farthest, x); }
  }
  return { ha: (n * cell * cell) / 1e4, farthestM: farthest, reachesLimit: farthest >= xMax - cell, basis: 'MODELO_GAUSSIANO_ESTACIONARIO · terreno llano · sin deposición · calculado hasta ' + xMax / 1000 + ' km' };
}
