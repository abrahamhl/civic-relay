/**
 * SENDA · Incendio 4D: geometría y física para dibujar un incendio en mapa 3D a lo largo del tiempo.
 * Cada salida dice si es REAL (dato medido) o MODELO / ESCENARIO (calculado), según CLAUDE.md.
 *
 * Fórmulas (con fuente):
 *  - UTM → geográficas: proyección transversa de Mercator, serie de Snyder (USGS PP 1395, 1987, pp. 63-64), WGS84.
 *  - Forma del frente con viento: relación longitud/anchura de Alexander (1985),
 *      LB = 1 + 8,729·(1 − e^(−0,030·U))^2,155, U = viento a 10 m en km/h.
 *    Elipse con el foco en la ignición; velocidades de cabeza, flanco y cola a partir de LB
 *    (HB = (LB + √(LB²−1)) / (LB − √(LB²−1)), Anderson 1983).
 *  - Ascenso de la pluma doblada por el viento, atmósfera neutra (Briggs, 1975):
 *      Δh(x) = 1,6 · F^(1/3) · x^(2/3) / U  → x(z) = (z·U / (1,6·F^(1/3)))^(3/2),
 *    con F = flujo de flotabilidad (m⁴/s³) y U = viento en la capa de mezcla (m/s). Se corta en la altura final.
 *    Radio de la pluma ≈ β·z con β = 0,5 (arrastre, Briggs): supuesto declarado.
 */
const D = Math.PI / 180;

/** UTM (zona, hemisferio norte) → [lon, lat] en WGS84. */
export function utmToLonLat(x, y, zone = 30) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const M = y / k0, mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const φ1 = mu + (3 * e1 / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(φ1) ** 2, T1 = Math.tan(φ1) ** 2, N1 = a / Math.sqrt(1 - e2 * Math.sin(φ1) ** 2);
  const R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(φ1) ** 2) ** 1.5, Dd = (x - 500000) / (N1 * k0);
  const lat = φ1 - ((N1 * Math.tan(φ1)) / R1) * (Dd ** 2 / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * Dd ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * Dd ** 6) / 720);
  const lon = (Dd - ((1 + 2 * T1 + C1) * Dd ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * Dd ** 5) / 120) / Math.cos(φ1);
  return [((zone - 1) * 6 - 180 + 3) + lon / D, lat / D];
}

/** Esquinas [NO, NE, SE, SO] en [lon, lat] de una malla UTM (para colocar imágenes en el mapa). */
export function gridCorners({ x0, y1, res, w, h }, zone = 30) {
  return [[x0, y1], [x0 + w * res, y1], [x0 + w * res, y1 - h * res], [x0, y1 - h * res]].map(([x, y]) => utmToLonLat(x, y, zone));
}

/** Alexander (1985): relación longitud/anchura del frente con viento U (km/h). */
export const lengthToBreadth = (windKmh) => 1 + 8.729 * (1 - Math.exp(-0.030 * Math.max(0, windKmh))) ** 2.155;

/**
 * ESCENARIO: perímetro elíptico tras `tMin` minutos con velocidad de cabeza `rosHeadMMin` (m/min),
 * viento `windKmh` soplando HACIA `toDeg`. Devuelve un anillo [lon, lat] (polígono GeoJSON).
 */
export function fireEllipse({ lat, lon, rosHeadMMin, windKmh, toDeg, tMin, n = 72 }) {
  const LB = lengthToBreadth(windKmh), s = Math.sqrt(LB * LB - 1);
  const HB = (LB + s) / (LB - s);
  const head = rosHeadMMin * tMin, back = head / HB, L = head + back, a = L / 2, b = a / LB, c = a - back; // c: centro desde la ignición
  const mLat = 111_320, mLon = 111_320 * Math.cos(lat * D), th = toDeg * D, ring = [];
  for (let i = 0; i <= n; i++) {
    const u = (2 * Math.PI * i) / n, along = c + a * Math.cos(u), across = b * Math.sin(u);
    const east = along * Math.sin(th) + across * Math.cos(th), north = along * Math.cos(th) - across * Math.sin(th);
    ring.push([lon + east / mLon, lat + north / mLat]);
  }
  return { ring, LB, HB, headM: head, backM: back, widthM: 2 * b, areaHa: (Math.PI * a * b) / 10_000, basis: 'ESCENARIO · Alexander (1985) / Anderson (1983)' };
}

/** Briggs (1975), pluma doblada, neutra: distancia a sotavento x (m) a la que el eje llega a la altura z (m). */
export const briggsX = (z, F, U) => ((z * U) / (1.6 * Math.cbrt(F))) ** 1.5;

/**
 * MODELO: columna de humo en anillos apilados para extrusión 3D (fill-extrusion de MapLibre).
 * Devuelve FeatureCollection con base/top en metros y opacidad decreciente con la altura.
 */
export function plumeRings({ lat, lon, F, U, toDeg, zTop, layers = 14, beta = 0.5, n = 28 }) {
  const mLat = 111_320, mLon = 111_320 * Math.cos(lat * D), th = toDeg * D, feats = [];
  for (let k = 0; k < layers; k++) {
    const z0 = (zTop * k) / layers, z1 = (zTop * (k + 1)) / layers, zm = (z0 + z1) / 2;
    const x = briggsX(zm, F, U), r = Math.max(60, beta * zm);
    const cx = lon + (x * Math.sin(th)) / mLon, cy = lat + (x * Math.cos(th)) / mLat, ring = [];
    for (let i = 0; i <= n; i++) { const u = (2 * Math.PI * i) / n; ring.push([cx + (r * Math.cos(u)) / mLon, cy + (r * Math.sin(u)) / mLat]); }
    feats.push({ type: 'Feature', properties: { base: Math.round(z0), top: Math.round(z1), opacity: +(0.55 - 0.35 * (k / layers)).toFixed(3), driftM: Math.round(x) }, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return { type: 'FeatureCollection', features: feats, basis: 'MODELO · Briggs (1975) pluma doblada, β = 0,5 (supuesto)' };
}

/**
 * Pinta la llegada del fuego (minutos desde la ignición; 65535 = no llega) hasta el instante `tMin`:
 * frente reciente en amarillo-naranja, zona ya quemada en rojo oscuro, resto transparente.
 */
export function arrivalRGBA(arr, w, h, tMin, { frontMin = 45 } = {}) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const t = arr[i]; if (t === 65535 || t > tMin) continue;
    const age = tMin - t, o = i * 4;
    if (age <= frontMin) { const k = age / frontMin; out[o] = 255; out[o + 1] = Math.round(220 - 140 * k); out[o + 2] = 40; out[o + 3] = 235; }
    else { out[o] = 120; out[o + 1] = 20; out[o + 2] = 10; out[o + 3] = 150; }
  }
  return out;
}

/** Área (ha) que ha alcanzado el fuego en `tMin` según la rejilla de llegada (celda de `res` m). */
export function arrivalAreaHa(arr, tMin, res = 100) {
  let n = 0; for (let i = 0; i < arr.length; i++) if (arr[i] !== 65535 && arr[i] <= tMin) n++;
  return (n * res * res) / 10_000;
}
