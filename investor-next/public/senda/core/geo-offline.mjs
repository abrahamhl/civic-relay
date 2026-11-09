/**
 * SENDA · Saber dónde estás sin cobertura: marcas conocidas, pasos y mapas guardados.
 *
 * 1) RESECCIÓN POR MARCAS CONOCIDAS. Aerogeneradores (con sus luces rojas de balizamiento), antenas,
 *    campanarios o cumbres tienen coordenadas públicas. Si apuntas el móvil a dos o tres y la brújula
 *    da su rumbo, la intersección de esas visuales es tu posición: como en orientación, pero calculado
 *    por mínimos cuadrados y con su elipse de error. No emite nada ni necesita señal: es PASIVO.
 * 2) ESTIMA POR PASOS (PDR). El acelerómetro cuenta pasos y la brújula da el rumbo: mantiene la
 *    posición entre dos fijos (el error crece con la distancia recorrida).
 * 3) MAPAS GUARDADOS. Calcula cuántas teselas y megas ocupa una zona para descargarla antes de salir.
 * Nota: la brújula del móvil marca el norte magnético; en España la declinación es pequeña, pero se
 * puede corregir con `declDeg`. Las marcas metálicas o el coche desvían la brújula: calibrar.
 */

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

/** Proyección local plana (válida para unas decenas de km). */
export function localFrame(lat0, lon0) {
  const kx = R * Math.cos(rad(lat0)) * (Math.PI / 180), ky = R * (Math.PI / 180);
  return { toXY: (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat - lat0) * ky }), toLL: (x, y) => ({ lat: lat0 + y / ky, lon: lon0 + x / kx }) };
}
/** Rumbo verdadero (0 = norte, horario) desde a hasta b, en grados. */
export function bearingDeg(a, b) {
  const φ1 = rad(a.lat), φ2 = rad(b.lat), Δλ = rad(b.lon - a.lon);
  return (deg(Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ))) + 360) % 360;
}

/**
 * Resección: posición a partir de rumbos a marcas conocidas.
 * @param {Array<{lat:number, lon:number, bearingDeg:number, sigmaDeg?:number}>} obs  rumbo DESDE ti HACIA la marca
 * @returns {{lat, lon, errMajorM, errMinorM, residualsM:number[]}}
 */
export function resection(obs, { declDeg = 0 } = {}) {
  if (obs.length < 2) throw new Error('hacen falta al menos 2 marcas');
  const lat0 = obs.reduce((s, o) => s + o.lat, 0) / obs.length, lon0 = obs.reduce((s, o) => s + o.lon, 0) / obs.length, F = localFrame(lat0, lon0);
  const L = obs.map((o) => ({ ...F.toXY(o.lat, o.lon), th: rad(o.bearingDeg + declDeg), sig: rad(o.sigmaDeg ?? 2) }));
  let P = null;
  for (let it = 0; it < 4; it++) {
    let a = 0, b = 0, c = 0, d = 0, e = 0;
    for (const l of L) {
      const nx = Math.cos(l.th), ny = -Math.sin(l.th); // normal a la visual
      const dist = P ? Math.max(30, Math.hypot(l.x - P.x, l.y - P.y)) : 1, w = 1 / (dist * l.sig) ** 2;
      const rhs = nx * l.x + ny * l.y; a += w * nx * nx; b += w * nx * ny; c += w * ny * ny; d += w * nx * rhs; e += w * ny * rhs;
    }
    const det = a * c - b * b; if (Math.abs(det) < 1e-18) throw new Error('visuales casi paralelas: elige marcas en direcciones distintas');
    P = { x: (c * d - b * e) / det, y: (a * e - b * d) / det, cov: [c / det, -b / det, a / det] };
  }
  const [sxx, sxy, syy] = P.cov, tr = sxx + syy, disc = Math.sqrt(Math.max(0, (sxx - syy) ** 2 / 4 + sxy * sxy));
  const residualsM = L.map((l) => Math.abs(Math.cos(l.th) * (P.x - l.x) - Math.sin(l.th) * (P.y - l.y)));
  return { ...F.toLL(P.x, P.y), errMajorM: Math.sqrt(tr / 2 + disc), errMinorM: Math.sqrt(Math.max(0, tr / 2 - disc)), residualsM };
}

/** Detección de pasos en la magnitud de la aceleración (m/s²) muestreada a `sr` Hz. */
export function detectSteps(mag, sr, { minGapS = 0.3, k = 0.6 } = {}) {
  const w = Math.max(1, Math.round(sr)), hp = mag.map((v, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(mag.length - 1, i + w); j++) { s += mag[j]; n++; } return v - s / n; });
  const sd = Math.sqrt(hp.reduce((s, v) => s + v * v, 0) / hp.length), thr = k * sd, steps = [];
  for (let i = 1; i < hp.length - 1; i++) if (hp[i] > thr && hp[i] >= hp[i - 1] && hp[i] > hp[i + 1] && (!steps.length || i - steps[steps.length - 1] >= minGapS * sr)) steps.push(i);
  return steps.map((i) => i / sr);
}
/** Longitud de paso por regla empírica (≈ 0,415 × estatura al caminar). */
export const stepLengthM = (heightM = 1.7) => 0.415 * heightM;
/** Estima por pasos: cada paso con su rumbo. */
export function deadReckon(start, headingsDeg, stepM) {
  const pts = [{ x: start.x, y: start.y }];
  for (const h of headingsDeg) { const p = pts[pts.length - 1]; pts.push({ x: p.x + stepM * Math.sin(rad(h)), y: p.y + stepM * Math.cos(rad(h)) }); }
  return pts;
}

/** Teselas (estándar XYZ) y megas para guardar una zona sin conexión. */
export function tileXY(lat, lon, z) { const n = 2 ** z, x = Math.floor(((lon + 180) / 360) * n), φ = rad(lat), y = Math.floor(((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n); return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) }; }
export function tilePack({ minLat, minLon, maxLat, maxLon }, zMin, zMax, { kbPerTile = 20 } = {}) {
  const perZoom = [];
  for (let z = zMin; z <= zMax; z++) { const a = tileXY(maxLat, minLon, z), b = tileXY(minLat, maxLon, z); perZoom.push({ z, tiles: (b.x - a.x + 1) * (b.y - a.y + 1) }); }
  const tiles = perZoom.reduce((s, p) => s + p.tiles, 0);
  return { perZoom, tiles, mb: +((tiles * kbPerTile) / 1024).toFixed(1) };
}

/**
 * Escenario ilustrativo de monte: posiciones de marcas INVENTADAS para la demostración (en producción,
 * registros públicos u OpenStreetMap). Devuelve la verdad para comprobar el cálculo.
 */
export function monteScenario() {
  const me = { lat: 42.8123, lon: -1.3517 };
  const marks = [
    { id: 'A1', kind: 'Aerogenerador', lat: 42.8302, lon: -1.3305 },
    { id: 'A2', kind: 'Aerogenerador', lat: 42.8331, lon: -1.3402 },
    { id: 'T', kind: 'Antena en cumbre', lat: 42.7982, lon: -1.3121 },
    { id: 'C', kind: 'Campanario', lat: 42.8015, lon: -1.3790 },
  ].map((m) => ({ ...m, trueBearing: +bearingDeg(me, m).toFixed(2) }));
  return { me, marks };
}
