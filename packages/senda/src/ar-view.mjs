/**
 * SENDA · Alrededor: lo que hay alrededor, encima de la imagen de la cámara, con datos REALES y su fuente.
 *
 * En vez de intentar modelar en 3D la arquitectura de alrededor (que el móvil no puede medir), esta vista pinta encima
 * de la cámara solo lo que se sabe con fuente y posición: incidencias oficiales (DGT, NDW), avisos de otros móviles
 * SENDA, radares oficiales, cámaras públicas (con su imagen en directo) y los dispositivos de radio detectados.
 *
 * Proyección: con la posición GPS, el rumbo de la brújula, la inclinación del móvil y el campo de visión de la cámara,
 * cada punto se coloca en pantalla según su acimut (horizontal) y su distancia (vertical: lo cercano, más abajo).
 * No es realidad aumentada métrica: la precisión depende del GPS (± metros) y de la brújula (± grados). Se declara.
 *
 * Dispositivos de radio: Android da intensidad (dBm), banda y si la red Wi-Fi está abierta, pero NO dirección. Por eso no
 * se dibujan en la imagen como si se supiera dónde están: van en una lista que se puede tocar, con su ficha honesta.
 */

const R = 6_371_008.8;
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

export function distM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
/** Diferencia angular con signo en (−180, 180]. */
export const angleDiff = (a, b) => { const d = ((a - b + 540) % 360) - 180; return d === -180 ? 180 : d; };

/** Valor de cada capa (orden de importancia al mostrar): lo que afecta a la seguridad primero. */
export const LAYERS = Object.freeze({
  INCIDENT: { label: 'Incidencia oficial', weight: 5, icon: '⚠️' },
  SENDA: { label: 'Aviso de móviles SENDA', weight: 4, icon: '📣' },
  RADAR: { label: 'Radar oficial', weight: 2, icon: '📷' },
  CAMERA: { label: 'Cámara pública', weight: 2, icon: '🎥' },
});

const INC_ES = { roadworks: 'Obras', roadMaintenance: 'Obras', accident: 'Accidente', vehicleObstruction: 'Vehículo detenido', obstruction: 'Obstáculo', poorEnvironment: 'Meteorología adversa', weather: 'Meteorología', congestion: 'Retención', laneClosures: 'Carril cortado', roadClosed: 'Carretera cortada' };
const human = (x) => INC_ES[x] ?? (x ? String(x).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : 'Incidencia');

/**
 * Normaliza los conjuntos de datos del repositorio en puntos {id, layer, lat, lon, title, sub, src, license, img?, at?}.
 * Cada fuente conserva su atribución y licencia; nada se inventa: si falta un campo, no se muestra.
 */
export function normalizeDatasets({ cameras, dgtIncidents, ndwIncidents, dgtRadars, nlRadars, sendaReports } = {}) {
  const out = [];
  const ok = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  for (const i of dgtIncidents?.incidencias ?? []) if (ok(i)) out.push({ id: `dgt-${i.id}`, layer: 'INCIDENT', lat: i.lat, lon: i.lon, title: human(i.detail ?? i.cause ?? i.type), sub: i.road || '', src: 'DGT (NAP)', license: dgtIncidents.licencia ?? null, at: i.start ?? i.created ?? null });
  for (const i of ndwIncidents?.incidencias ?? []) if (ok(i)) out.push({ id: `ndw-${i.id}`, layer: 'INCIDENT', lat: i.lat, lon: i.lon, title: human(i.cause !== 'other' ? i.cause : i.type), sub: i.road || '', src: 'NDW (NL)', license: ndwIncidents.licencia ?? null, at: i.startUtc ?? null });
  for (const r of [...(dgtRadars?.puntos ?? []), ...(nlRadars?.puntos ?? [])]) if (ok(r)) out.push({ id: `rad-${r.id}`, layer: 'RADAR', lat: r.lat, lon: r.lon, title: `Radar ${r.kind === 'fixed' ? 'fijo' : r.kind ?? ''}`.trim(), sub: [r.road, r.maxspeed ? `${r.maxspeed} km/h` : ''].filter(Boolean).join(' · '), src: r.src === 'dgt' ? 'DGT' : r.src ?? 'oficial', license: (r.country === 'NL' ? nlRadars : dgtRadars)?.licencia ?? null, bearing: Number.isFinite(r.bearing) ? r.bearing : null });
  for (const c of cameras?.cameras ?? []) if (ok(c)) {
    const s = cameras.sources?.find((x) => x.id === c.src);
    out.push({ id: `cam-${c.id}`, layer: 'CAMERA', lat: c.lat, lon: c.lon, title: c.name ?? 'Cámara', sub: c.road ?? '', src: s?.name ?? c.src, license: s?.license ?? null, img: c.img ?? null, page: c.page ?? null });
  }
  for (const r of sendaReports ?? []) if (ok(r)) out.push({ id: `senda-${r.id ?? `${r.lat},${r.lon},${r.t}`}`, layer: 'SENDA', lat: r.lat, lon: r.lon, title: r.kindLabel ?? r.kind ?? 'Aviso', sub: r.devices ? `${r.devices} móvil(es) SENDA` : 'un móvil SENDA (sin confirmar)', src: 'Red SENDA', license: null, at: r.t ? new Date(r.t).toISOString() : null });
  return out;
}

/**
 * Lo que merece estar en pantalla ahora: dentro de `maxM`, ordenado por importancia y cercanía, máximo `limit`.
 * score = peso de la capa / (1 + d/500 m): un accidente a 2 km pesa más que una cámara a 300 m.
 */
export function rankNearby(points, me, { maxM = 5000, limit = 40 } = {}) {
  const out = [];
  for (const p of points) {
    const d = distM(me, p); if (d > maxM) continue;
    out.push({ ...p, distM: d, bearing: bearingDeg(me, p), score: (LAYERS[p.layer]?.weight ?? 1) / (1 + d / 500) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Coloca los puntos ya clasificados en la pantalla.
 * x: acimut relativo al rumbo dentro del campo de visión horizontal. y: horizonte según la inclinación (pitch, 0 =
 * móvil vertical mirando al frente) y, por debajo, lo cercano más abajo (log de la distancia). Fuera del campo → flecha lateral.
 */
export function project(points, { headingDeg, pitchDeg = 0, fovHDeg = 66, fovVDeg = 50, w, h, maxM = 5000 }) {
  const horizonY = h / 2 + (pitchDeg / (fovVDeg / 2)) * (h / 2);
  return points.map((p) => {
    const rel = angleDiff(p.bearing, headingDeg);
    const inView = Math.abs(rel) <= fovHDeg / 2;
    const x = w / 2 + (rel / (fovHDeg / 2)) * (w / 2);
    const near = 1 - Math.min(1, Math.log10(1 + p.distM) / Math.log10(1 + maxM)); // 1 = encima, 0 = lejos
    const y = Math.max(24, Math.min(h - 24, horizonY + near * (h - horizonY) * 0.8));
    return { ...p, rel, inView, x: inView ? x : rel < 0 ? 16 : w - 16, y };
  });
}

/** Separa etiquetas que se pisan (de arriba abajo), para que se puedan tocar. */
export function declutter(projected, { minGapPx = 34 } = {}) {
  const placed = [];
  for (const p of [...projected].sort((a, b) => b.score - a.score)) {
    let y = p.y;
    for (let k = 0; k < 8 && placed.some((q) => Math.abs(q.x - p.x) < 110 && Math.abs(q.y - y) < minGapPx); k++) y -= minGapPx;
    placed.push({ ...p, y });
  }
  return placed;
}

/** Texto honesto de distancia/dirección para la ficha. */
export function describePosition(p, headingDeg) {
  const d = p.distM < 1000 ? `${Math.round(p.distM / 10) * 10} m` : `${(p.distM / 1000).toFixed(1)} km`;
  const rel = angleDiff(p.bearing, headingDeg), side = Math.abs(rel) < 10 ? 'de frente' : `${Math.round(Math.abs(rel))}° a la ${rel < 0 ? 'izquierda' : 'derecha'}`;
  return `${d}, ${side} (según GPS y brújula; error de metros y grados)`;
}

/* ---------------- Dispositivos de radio (sin MAC ni nombre de red) ---------------- */

/** Clase de intensidad medida. Sin calibrar el modelo de propagación no se dan metros. */
export function intensityClass(dbm) {
  if (!Number.isFinite(dbm)) return { key: 'NA', label: 'sin dato' };
  if (dbm >= -55) return { key: 'VERY_NEAR', label: 'muy fuerte (probablemente muy cerca)' };
  if (dbm >= -67) return { key: 'NEAR', label: 'fuerte' };
  if (dbm >= -80) return { key: 'MID', label: 'media' };
  return { key: 'FAR', label: 'débil (lejos o tras obstáculos)' };
}

/**
 * Fichas seleccionables a partir de un barrido de radio de la app Android (RadioScan.java) y del historial de la sesión.
 * El identificador `a` es un hash con sal de la sesión: sirve para seguir al mismo emisor durante la sesión y no permite
 * saber su dirección MAC ni el nombre de la red.
 * `o` (Wi-Fi): red abierta (sin contraseña). Es la ÚNICA que SENDA puede usar como salida a Internet sin permiso de su dueño.
 */
export function deviceCards(scan, history = new Map(), now = Date.now()) {
  const cards = [];
  const touch = (key, rssi) => {
    const h = history.get(key) ?? { first: now, rssi: [] };
    h.last = now; h.rssi.push(rssi); if (h.rssi.length > 20) h.rssi.shift(); history.set(key, h);
    const n = h.rssi.length, trend = n >= 3 ? h.rssi[n - 1] - h.rssi[0] : 0;
    return { first: h.first, last: h.last, samples: n, trend: Math.abs(trend) < 6 ? 'estable' : trend > 0 ? 'acercándose o más visible' : 'alejándose o más tapado' };
  };
  for (const w of scan?.wifi ?? []) {
    const key = `w${w.a}`, t = touch(key, w.r);
    const open = w.o === true || w.o === 1;
    cards.push({ key, kind: 'WIFI', title: `Punto Wi-Fi ${w.g ?? '?'} GHz`, rssi: w.r, band: w.g ?? null, open, intensity: intensityClass(w.r), ...t,
      gateway: open ? 'Red abierta: se puede usar como salida a Internet en una emergencia (sin contraseña, sin entrar en nada)' : 'Red protegida: SENDA no la usa (entrar sin permiso del dueño sería acceso ilícito)' });
  }
  for (const b of scan?.ble ?? []) {
    const key = `b${b.a}`, t = touch(key, b.r);
    cards.push({ key, kind: b.s ? 'SENDA' : 'BLE', title: b.s ? 'Móvil SENDA' : 'Dispositivo Bluetooth', rssi: b.r, intensity: intensityClass(b.r), ...t,
      gateway: b.s ? 'Móvil SENDA: intercambia mensajes cifrados por Bluetooth (buzón), sin ver su contenido' : 'Dispositivo ajeno: solo se mide su señal; no se conecta' });
  }
  const order = { SENDA: 0, WIFI: 1, BLE: 2 };
  return cards.sort((a, b) => (order[a.kind] - order[b.kind]) || (b.open === true) - (a.open === true) || b.rssi - a.rssi);
}
