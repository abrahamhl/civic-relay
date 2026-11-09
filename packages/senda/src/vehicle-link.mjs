/**
 * SENDA · Coches conectados, cámaras y teléfonos como una sola red de sensores, con base legal y privacidad.
 *
 * Marco real (05-11-2026):
 *  - Ley de Datos de la UE (Reglamento (UE) 2023/2854), aplicable desde el 12-09-2025: el usuario de un coche
 *    conectado puede pedir sus datos (art. 4) y ordenar que se compartan con un tercero de su elección
 *    (art. 5), con compensación razonable (art. 9). Los «guardianes de acceso» de la DMA no pueden ser ese tercero.
 *  - Data for Road Safety (DFRS): fabricantes, autoridades y proveedores comparten gratis y en reciprocidad la
 *    información de tráfico relacionada con la seguridad (SRTI, Reglamento Delegado (UE) 886/2013), también la
 *    generada por los propios coches, y se publica en los Puntos de Acceso Nacionales en DATEX II.
 *  - eCall de nueva generación (4G/5G) en los tipos nuevos desde el 01-01-2026 (Reglamento Delegado (UE) 2024/1180).
 *  - Android Automotive / Android Auto: solo ciertas categorías de app (navegación, puntos de interés, IoT,
 *    VoIP, tiempo).
 *
 * Qué hace este módulo (todo comprobable):
 *  1. `VEHICLE_SOURCES`: cada fuente con lo que aporta, su base legal, su latencia y su permiso.
 *  2. `SRTI` y `vehicleEventToHazard`: los 8 tipos de aviso de seguridad de la UE y los eventos típicos de un
 *     coche conectado, convertidos en las tramas de aviso de SENDA.
 *  3. `privacyGate`: agregación con k-anonimato (celda de vía × franja de tiempo; si hay menos de k fuentes
 *     distintas no se publica) y sin identificadores.
 *  4. `fuseSegmentSpeed`: velocidad de un tramo fusionando fuentes de distinta precisión y antigüedad
 *     (actualización de Kalman secuencial, varianza que crece con la edad del dato).
 *  5. `fusePosition`: posición por mínimos cuadrados ponderados con medidas heterogéneas: GNSS, distancias
 *     a puntos Wi-Fi o a otros coches (RTT, UWB), rumbos a marcas visibles (aerogeneradores) y la propia
 *     carretera (el coche está sobre la vía). Devuelve la elipse de error: así se mide la ganancia, no se promete.
 *  6. Puentes con la visión: medidas de cámara y observaciones a bordo convertidas en datos de SENDA.
 */
import { HAZARD } from './road-guard.mjs';
import { localFrame } from './geo-offline.mjs';

// ---------------------------------------------------------------- 1) Fuentes
export const VEHICLE_SOURCES = Object.freeze([
  { id: 'telefono', name: 'Teléfono con SENDA', gives: 'GNSS, velocidad Doppler, acelerómetro, Bluetooth entre coches', legal: 'Consentimiento en la app', latency: '< 1 s', access: 'PASIVO' },
  { id: 'obd2', name: 'Lector OBD-II del propio coche (Bluetooth)', gives: 'Velocidad del vehículo, frenada, luces de emergencia según modelo', legal: 'El titular lee su propio coche', latency: '< 1 s', access: 'PASIVO', note: 'Útil en coches antiguos; datos disponibles según fabricante' },
  { id: 'data-act', name: 'Datos del coche vía Ley de Datos de la UE', gives: 'Telemetría que el fabricante tenga disponible (velocidad, ABS/ESP, airbag, luces, posición)', legal: 'Art. 5 del Reglamento (UE) 2023/2854: el titular lo ordena; compensación razonable (art. 9)', latency: 'segundos a minutos según fabricante', access: 'CONVENIO', note: 'Integración técnica con cada fabricante; acceso directo de diseño para productos comercializados desde el 12-09-2026' },
  { id: 'agregadores', name: 'Plataformas multimarca de datos del vehículo', gives: 'Una sola interfaz para varias marcas', legal: 'Contrato comercial + consentimiento del titular', latency: 'según plataforma', access: 'CONVENIO' },
  { id: 'dfrs', name: 'Avisos de seguridad generados por coches (DFRS / SRTI)', gives: 'Firme deslizante, visibilidad reducida, vehículo detenido, sentido contrario… agregados por los fabricantes', legal: 'Publicados en los NAP en DATEX II; gratuitos y recíprocos', latency: 'minutos', access: 'PASIVO', note: 'Leer: ya posible con el lector DATEX II. Aportar los de SENDA: adhesión a DFRS (convenio)' },
  { id: 'aaos', name: 'App de SENDA en la pantalla del coche (Android Automotive / Auto)', gives: 'Avisos en el coche; datos del vehículo según permisos', legal: 'Categorías de app limitadas por Google', latency: '< 1 s', access: 'CONVENIO', note: 'Categoría encajable y permisos de datos del vehículo: pendiente de verificar' },
  { id: 'camaras', name: 'Cámaras públicas analizadas en el relé', gives: 'Caudal por sentido, ocupación, visibilidad', legal: 'Datos publicados para reutilizarse; solo agregados', latency: 'segundos', access: 'PASIVO' },
  { id: 'detectores', name: 'Estaciones de aforo (DGT, NDW)', gives: 'Caudal y velocidad por carril', legal: 'Datos abiertos DATEX II', latency: '1 min', access: 'PASIVO' },
  { id: 'v16', name: 'Balizas V16 (DGT 3.0)', gives: 'Vehículo detenido', legal: 'Convenio DGT 3.0', latency: '≈ 100 s', access: 'CONVENIO' },
  { id: 'waze', name: 'Alertas y atascos de Waze', gives: 'Avisos de usuarios y atascos', legal: 'Waze for Cities, a través de un organismo socio', latency: 'minutos', access: 'CONVENIO' },
  { id: 'ecall', name: 'eCall del coche', gives: 'Llamada automática al 112 con su mensaje', legal: 'Canal del coche al 112: SENDA no lo intercepta', latency: '—', access: 'NUNCA', note: 'SENDA lo complementa; nunca lo intercepta ni lo sustituye' },
  { id: 'reidentificar', name: 'Seguir un vehículo concreto entre cámaras o leer matrículas', gives: '—', legal: 'Vigilancia de personas', latency: '—', access: 'NUNCA' },
]);

// ---------------------------------------------------------------- 2) Eventos → avisos
/** Las 8 categorías de información de tráfico relacionada con la seguridad (art. 3 del Reglamento Delegado 886/2013). */
export const SRTI = Object.freeze({
  'firme-deslizante-temporal': HAZARD.ICE, 'animales-personas-obstaculos': HAZARD.OBSTACLE, 'accidente-sin-proteger': HAZARD.CRASH, 'obras-corta-duracion': HAZARD.WORKS,
  'visibilidad-reducida': HAZARD.FOG, 'conductor-sentido-contrario': HAZARD.WRONG_WAY, 'bloqueo-no-gestionado': HAZARD.STOPPED, 'meteorologia-excepcional': HAZARD.FLOOD,
});
const EVENT_MAP = { HARD_BRAKING: HAZARD.BRAKE, AIRBAG_DEPLOYED: HAZARD.CRASH, CRASH_DETECTED: HAZARD.CRASH, HAZARD_LIGHTS: HAZARD.STOPPED, BREAKDOWN: HAZARD.STOPPED,
  ABS_ACTIVE: HAZARD.ICE, ESC_ACTIVE: HAZARD.ICE, TRACTION_LOSS: HAZARD.ICE, FOG_LIGHTS: HAZARD.FOG, WRONG_WAY: HAZARD.WRONG_WAY, WIPERS_MAX: HAZARD.FLOOD };
/** Un evento de coche (telemetría, DFRS o lector OBD-II) → aviso SENDA con su confianza de partida. */
export function vehicleEventToHazard(evt) {
  const type = EVENT_MAP[evt.type] ?? SRTI[evt.type] ?? null;
  if (type == null) return null;
  const strong = ['AIRBAG_DEPLOYED', 'CRASH_DETECTED', 'HARD_BRAKING'].includes(evt.type);
  return { type, lat: evt.lat, lon: evt.lon, t: evt.t, headingDeg: evt.headingDeg ?? 0, speedMs: evt.speedMs ?? 0, source: evt.source ?? 'vehiculo', prior: strong ? 0.8 : 0.6 };
}

// ---------------------------------------------------------------- 3) Puerta de privacidad
/**
 * Agrega observaciones (velocidad o eventos) por celda de vía y franja de tiempo. Solo publica las celdas con al
 * menos k fuentes distintas (k-anonimato) y nunca devuelve identificadores ni trayectorias.
 */
export function privacyGate(obs, { k = 5, cellM = 500, binS = 300 } = {}) {
  const cells = new Map();
  for (const o of obs) {
    const key = `${o.roadId ?? 'x'}|${Math.floor(o.s / cellM)}|${Math.floor(o.t / binS)}`;
    const c = cells.get(key) ?? { roadId: o.roadId ?? null, cell: Math.floor(o.s / cellM), bin: Math.floor(o.t / binS), sources: new Set(), speeds: [], events: {} };
    c.sources.add(o.sourceId); if (o.speedKmh != null) c.speeds.push(o.speedKmh); if (o.event) c.events[o.event] = (c.events[o.event] ?? 0) + 1; cells.set(key, c);
  }
  const published = [], suppressed = [];
  for (const c of cells.values()) {
    const row = { roadId: c.roadId, fromM: c.cell * cellM, toM: (c.cell + 1) * cellM, fromS: c.bin * binS, n: c.sources.size, meanKmh: c.speeds.length ? +(c.speeds.reduce((a, b) => a + b, 0) / c.speeds.length).toFixed(1) : null, events: c.events };
    (c.sources.size >= k ? published : suppressed).push(row);
  }
  return { published, suppressedCells: suppressed.length, k };
}

// ---------------------------------------------------------------- 4) Velocidad de un tramo
/** σ (km/h) típica de cada fuente y cuánto crece por minuto de antigüedad (supuestos documentados, a calibrar). */
export const SOURCE_NOISE = Object.freeze({ detectores: { sd: 3, perMin: 2 }, 'data-act': { sd: 4, perMin: 3 }, telefono: { sd: 8, perMin: 3 }, camaras: { sd: 6, perMin: 2 }, waze: { sd: 10, perMin: 2 } });
/** Fusión secuencial de Kalman (estado = velocidad del tramo): cada medida pesa por su varianza (más vieja, más varianza). */
export function fuseSegmentSpeed(obs, { nowS, priorKmh = 90, priorSd = 30 } = {}) {
  let m = priorKmh, v = priorSd ** 2; const contrib = [];
  for (const o of [...obs].sort((a, b) => a.t - b.t)) {
    const n = SOURCE_NOISE[o.source] ?? { sd: 10, perMin: 3 }, ageMin = Math.max(0, ((nowS ?? o.t) - o.t) / 60), r = (n.sd + n.perMin * ageMin) ** 2, kGain = v / (v + r);
    m = m + kGain * (o.kmh - m); v = (1 - kGain) * v; contrib.push({ source: o.source, gain: +kGain.toFixed(3) });
  }
  return { kmh: +m.toFixed(1), sdKmh: +Math.sqrt(v).toFixed(2), contrib };
}

// ---------------------------------------------------------------- 5) Posición con todo lo que hay alrededor
const rad = (d) => (d * Math.PI) / 180;
/**
 * Mínimos cuadrados ponderados (Gauss-Newton) en metros locales. Medidas:
 *  { kind:'gnss', lat, lon, sdM }                 posición del GNSS
 *  { kind:'range', lat, lon, rangeM, sdM }        distancia a un punto conocido (Wi-Fi RTT, UWB, otro coche)
 *  { kind:'bearing', lat, lon, deg, sdDeg }       rumbo hacia una marca visible (aerogenerador, antena)
 *  { kind:'road', a:{lat,lon}, b:{lat,lon}, sdM }  el vehículo está sobre ese tramo de vía (distancia lateral ≈ 0)
 * Devuelve la posición, la elipse de error (1σ) y el error medio cuadrático.
 */
export function fusePosition(meas, { init, iters = 12 } = {}) {
  const g0 = init ?? meas.find((m) => m.kind === 'gnss') ?? meas[0], f = localFrame(g0.lat, g0.lon);
  let x = 0, y = 0;
  const P = (m) => f.toXY(m.lat, m.lon);
  let N = [[0, 0], [0, 0]];
  for (let it = 0; it < iters; it++) {
    N = [[0, 0], [0, 0]]; const b = [0, 0];
    const add = (Jx, Jy, r, sd) => { const w = 1 / (sd * sd); N[0][0] += w * Jx * Jx; N[0][1] += w * Jx * Jy; N[1][1] += w * Jy * Jy; b[0] += w * Jx * r; b[1] += w * Jy * r; };
    for (const m of meas) {
      if (m.kind === 'gnss') { const p = P(m); add(1, 0, p.x - x, m.sdM); add(0, 1, p.y - y, m.sdM); }
      else if (m.kind === 'range') { const p = P(m), dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1e-6; add(dx / d, dy / d, m.rangeM - d, m.sdM); }
      else if (m.kind === 'bearing') { const p = P(m), dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy || 1e-6, pred = Math.atan2(dx, dy); let r = rad(m.deg) - pred; r = Math.atan2(Math.sin(r), Math.cos(r)); add(-dy / d2, dx / d2, r, rad(m.sdDeg)); }
      else if (m.kind === 'road') { const A = P(m.a), B = P(m.b), ux = B.x - A.x, uy = B.y - A.y, L = Math.hypot(ux, uy) || 1, nx = -uy / L, ny = ux / L, cross = (x - A.x) * nx + (y - A.y) * ny; add(nx, ny, -cross, m.sdM); }
    }
    N[1][0] = N[0][1]; const det = N[0][0] * N[1][1] - N[0][1] ** 2; if (Math.abs(det) < 1e-12) break;
    const dx = (N[1][1] * b[0] - N[0][1] * b[1]) / det, dy = (N[0][0] * b[1] - N[0][1] * b[0]) / det; x += dx; y += dy; if (Math.hypot(dx, dy) < 1e-4) break;
  }
  const det = N[0][0] * N[1][1] - N[0][1] ** 2, C = [[N[1][1] / det, -N[0][1] / det], [-N[0][1] / det, N[0][0] / det]];
  const tr = C[0][0] + C[1][1], dd = Math.sqrt(((C[0][0] - C[1][1]) / 2) ** 2 + C[0][1] ** 2), l1 = tr / 2 + dd, l2 = Math.max(0, tr / 2 - dd);
  const ll = f.toLL(x, y);
  return { lat: ll.lat, lon: ll.lon, xM: x, yM: y, majorM: +Math.sqrt(l1).toFixed(2), minorM: +Math.sqrt(l2).toFixed(2), rmsM: +Math.sqrt(tr).toFixed(2), angleDeg: +((Math.atan2(2 * C[0][1], C[0][0] - C[1][1]) * 90) / Math.PI).toFixed(1), cov: C };
}
/**
 * Escenario de ejemplo (puntos INVENTADOS): un coche en una carretera con un aerogenerador a la vista, dos puntos
 * Wi-Fi con RTT en un área de servicio y otro coche con SENDA delante. Devuelve la verdad para comprobar el cálculo.
 */
export function positionScenario({ seed = 3 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const truth = { lat: 41.0, lon: -2.0 }, f = localFrame(truth.lat, truth.lon), at = (x, y) => f.toLL(x, y);
  const turbine = at(-650, 900), ap1 = at(60, -35), ap2 = at(-40, 45), car = at(4, 80), roadA = at(-3, -500), roadB = at(1, 500);
  const brg = (p) => { const q = f.toXY(p.lat, p.lon); return ((Math.atan2(q.x, q.y) * 180) / Math.PI + 360) % 360; }, dist = (p) => { const q = f.toXY(p.lat, p.lon); return Math.hypot(q.x, q.y); };
  const gnss = { kind: 'gnss', ...at(8 * N(), 8 * N()), sdM: 8 };
  const meas = [gnss, { kind: 'bearing', ...turbine, deg: brg(turbine) + 2 * N(), sdDeg: 2, label: 'aerogenerador' }, { kind: 'range', ...ap1, rangeM: dist(ap1) + 1.5 * N(), sdM: 1.5, label: 'Wi-Fi RTT 1' },
    { kind: 'range', ...ap2, rangeM: dist(ap2) + 1.5 * N(), sdM: 1.5, label: 'Wi-Fi RTT 2' }, { kind: 'range', ...car, rangeM: dist(car) + 0.5 * N(), sdM: 0.5, label: 'coche delante (UWB)' }, { kind: 'road', a: roadA, b: roadB, sdM: 1.8, label: 'sobre la vía' }];
  return { truth, meas, labels: { turbine, ap1, ap2, car, roadA, roadB } };
}

// ---------------------------------------------------------------- 6) Puentes con la visión (packages/senda-vision)
/** Métricas de una cámara fija → medida de aforo (como las de DATEX II) para el núcleo. */
export const cameraToMeasured = (fixed, { id = 'CAM-1' } = {}) => ({ id, flowVehH: Math.round((fixed.total / fixed.durationS) * 3600), speedKmh: null, source: 'camaras', perMinute: fixed.perMinute });
/**
 * Serie de una cámara a bordo → observaciones anónimas: avisos de frenada si el de delante se alcanza en < 4 s y
 * ritmo de vehículos de la calzada contraria (contactos que llevarían el SOS de SENDA).
 */
export function dashcamToProbe(dash) {
  const alerts = dash.series.filter((s) => s.ttcS && s.ttcS < 4).map((s) => ({ t: s.t, type: HAZARD.BRAKE, ttcS: s.ttcS }));
  return { alerts, oncomingPerMin: dash.oncomingPerMin ?? null, meanVisible: dash.meanVisible, leadShare: dash.leadShare };
}
