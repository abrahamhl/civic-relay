// @ts-check
/**
 * SENDA · un accidente, varios móviles: fusión de detecciones de choque de varios dispositivos en un solo incidente.
 * Caso que lo motiva: vehículo parado en el arcén, un taxi detrás y un tercer coche que choca contra ambos (3 móviles).
 *  - Agrupa por cercanía en el tiempo y el espacio (ventana y radio OBLIGATORIOS: elecciones de diseño declaradas).
 *  - Posición: media ponderada por la inversa de la varianza de cada fijo GNSS (1/σ²) y su incertidumbre combinada
 *    σ = 1/√Σ(1/σᵢ²). Es una fusión de fijos independientes, no una triangulación por radio.
 *  - Corroboración: con 2 o más dispositivos independientes el incidente pasa a CORROBORADO.
 *  - Carril: se muestra el más peligroso declarado (carril de circulación > arcén).
 */
const R = 6371008.8, D = Math.PI / 180;
const distM = (a, b) => { const dLat = (b.lat - a.lat) * D, dLon = (b.lon - a.lon) * D, x = dLon * Math.cos(((a.lat + b.lat) / 2) * D); return Math.hypot(x, dLat) * R; };
const LANE_DANGER = { LEFT_LANE: 3, MIDDLE_LANE: 3, RIGHT_LANE: 3, LEFT_SHOULDER: 1, SHOULDER: 1 };

/** detections: [{ id, tS, lon, lat, accM, state: 'LIKELY_CRASH'|'CHECK_USER', lane?, vehicle?, wellbeing? }] */
export function clusterCrashes(detections, { windowS, radiusM }) {
  if (!(windowS > 0 && radiusM > 0)) throw new Error('clusterCrashes exige windowS y radiusM (sin valores por defecto)');
  const ds = detections.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon)).slice().sort((a, b) => a.tS - b.tS);
  const clusters = [];
  for (const d of ds) {
    const c = clusters.find((k) => Math.abs(d.tS - k.t0) <= windowS && distM(k.center, d) <= radiusM + (d.accM > 0 ? d.accM : 0));
    if (c) { c.items.push(d); c.center = fuse(c.items); } else clusters.push({ t0: d.tS, items: [d], center: { lat: d.lat, lon: d.lon } });
  }
  return clusters.map((c) => summarize(c.items));
}

function fuse(items) {
  // Sin la precisión de algún fijo (aviso recibido por Bluetooth, que no la transporta) no se pondera ni se inventa σ.
  if (!items.every((d) => d.accM > 0)) return { lat: items.reduce((s, d) => s + d.lat, 0) / items.length, lon: items.reduce((s, d) => s + d.lon, 0) / items.length, sigmaM: null };
  let w = 0, la = 0, lo = 0; for (const d of items) { const wi = 1 / (d.accM * d.accM); w += wi; la += d.lat * wi; lo += d.lon * wi; }
  return { lat: la / w, lon: lo / w, sigmaM: 1 / Math.sqrt(w) };
}
function summarize(items) {
  const pos = fuse(items), devices = new Set(items.map((d) => d.id)).size;
  const lanes = items.map((d) => d.lane).filter(Boolean); const lane = lanes.sort((a, b) => (LANE_DANGER[b] ?? 0) - (LANE_DANGER[a] ?? 0))[0] ?? null;
  const vehicles = new Set(items.map((d) => d.vehicle).filter(Boolean));
  const needHelp = items.filter((d) => d.wellbeing === 'NEEDS_HELP').length, ok = items.filter((d) => d.wellbeing === 'OK').length;
  return {
    lat: +pos.lat.toFixed(7), lon: +pos.lon.toFixed(7), sigmaM: pos.sigmaM == null ? null : +pos.sigmaM.toFixed(1), devices,
    vehiclesDeclared: vehicles.size || null, lane, liveLaneBlocked: lane ? (LANE_DANGER[lane] ?? 0) >= 3 : null,
    state: devices >= 2 ? 'CORROBORATED' : 'UNVERIFIED', needHelp, ok, firstS: items[0].tS, lastS: items[items.length - 1].tS,
  };
}

/** Icono compacto para el mapa: un solo símbolo con «×N» (no N iconos). confirmed → borde lleno; probable → discontinuo. */
export function clusterIconSvg({ devices, state }, size = 44) {
  const s = size, c = s / 2, sure = state === 'CORROBORATED';
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-label="Accidente con ${devices} dispositivo${devices > 1 ? 's' : ''}"><circle cx="${c}" cy="${c}" r="${c - 3}" fill="#ff5b6e" fill-opacity=".92" stroke="#fff" stroke-width="2.5"${sure ? '' : ' stroke-dasharray="5 4"'}/><path d="M${c - 9} ${c + 1} l3-6 h12 l3 6 v5 h-18z" fill="#fff"/><text x="${c}" y="${s - 5}" text-anchor="middle" font-size="${Math.round(s / 4)}" font-weight="700" fill="#fff" font-family="Inter,system-ui">×${devices}</text></svg>`;
}
