/**
 * SENDA · Todas las situaciones al volante, con su física y su fuente de datos.
 *
 * Cada caso dice qué señal lo detecta, qué hace SENDA, de dónde salen los datos y con qué permiso.
 * Las cuentas son de manual (cinemática, rozamiento, diseño de curvas de AASHTO, teoría de tráfico de
 * Lighthill-Whitham-Richards, modelo de dispersión de Koschmieder) y están probadas; los umbrales que
 * dependen del teléfono están marcados como pendientes de calibrar.
 *
 * BALIZA V16 + SENDA. La V16 conectada (obligatoria en España desde el 1-1-2026) envía su posición a
 * DGT 3.0 cada 100 s con su propia tarjeta SIM, y la DGT la reenvía a los navegadores. Dice DÓNDE hay
 * un vehículo detenido, pero no QUÉ pasa (¿avería o accidente?, ¿heridos?, ¿atrapados?). SENDA aporta
 * justo eso. `v16Fusion` cruza las balizas con los informes de SENDA por posición y tiempo. SENDA nunca
 * usa la SIM de la baliza (es un dispositivo homologado y cerrado); la complementa.
 */
import { localFrame } from './geo-offline.mjs';
import { detectCrash } from './rail-incident.mjs';
import { haversineKm } from './zones.mjs';
import { roadLocate, pointAt } from './road-guard.mjs';

const g = 9.80665, kmh = (v) => v * 3.6;

// ---------------------------------------------------------------- Catálogo de situaciones
export const DRIVE_CASES = Object.freeze([
  { id: 'frenada', name: 'Frenada brusca delante', signal: 'Velocidad GNSS de otro móvil SENDA', action: 'Aviso de 24 bytes y deceleración necesaria', source: 'Móviles SENDA', module: 'road-guard', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'choque', name: 'Choque', signal: 'Impacto + parada brusca o vuelco', action: 'Cuenta atrás, SOS con PK, coches que pasan', source: 'Acelerómetro y GNSS', module: 'road-guard', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'kamikaze-propio', name: 'Voy en sentido contrario', signal: 'Rumbo opuesto al de una calzada de sentido único', action: 'Aviso inmediato al conductor', source: 'Geometría de la vía en la reserva', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'kamikaze-ajeno', name: 'Viene alguien en sentido contrario', signal: 'Trama de otro móvil o aviso oficial', action: 'Tiempo hasta cruzarse y qué hacer', source: 'Móviles SENDA, DGT 3.0', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'retencion', name: 'Final de retención', signal: 'Velocidades de móviles y detectores de tráfico', action: 'Dónde estará la cola cuando llegues (onda de choque)', source: 'Móviles SENDA, DGT, NDW', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'niebla', name: 'Niebla', signal: 'Visibilidad estimada en cámaras públicas, avisos', action: 'Velocidad para parar dentro de lo que ves', source: 'Cámaras abiertas, AEMET', module: 'cameras + drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'firme', name: 'Lluvia, nieve o hielo', signal: 'Avisos meteorológicos y temperatura', action: 'Distancia de frenado con el rozamiento real', source: 'AEMET, DATEX II', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'curva', name: 'Curva peligrosa', signal: 'Radio calculado con la geometría de la vía', action: 'Velocidad máxima de la curva y deceleración necesaria', source: 'Geometría guardada (IGN, OpenStreetMap)', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'fatiga', name: 'Fatiga', signal: 'Tiempo al volante y hora del día', action: 'Propuesta de parada', source: 'El propio viaje', module: 'drive-cases', status: 'HECHO', access: 'PASIVO' },
  { id: 'motorista', name: 'Motorista o ciclista caído', signal: 'Impacto y cambio de orientación', action: 'Cuenta atrás y SOS', source: 'Acelerómetro', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'inundada', name: 'Carretera inundada', signal: 'Alarma de riada y profundidad', action: '«Da la vuelta»: 30 cm de agua en movimiento arrastran un coche', source: 'flood-watch, SAIH', module: 'drive-cases', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'incendio', name: 'Incendio junto a la vía', signal: 'Focos por satélite y frente de llama', action: 'Evitar la carretera y salir antes', source: 'NASA FIRMS, wildfire', module: 'wildfire', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'carril', name: 'Obras o carril cerrado', signal: 'Incidencias DATEX II y señales de carril', action: 'Qué carril se cierra y a qué distancia', source: 'DGT (paneles), NDW (MSI, Melvin)', module: 'datex2', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'puente', name: 'Puente móvil abierto (Países Bajos)', signal: 'Aperturas de puentes en DATEX II', action: 'Aviso y ruta alternativa', source: 'NDW', module: 'datex2', status: 'PENDIENTE', access: 'PASIVO' },
  { id: 'v16', name: 'Vehículo detenido con baliza V16', signal: 'Posición de la V16 en DGT 3.0', action: 'Cruzarla con SENDA: ¿avería o accidente con heridos?', source: 'DGT 3.0', module: 'drive-cases', status: 'SIMULADO', access: 'CONVENIO' },
  { id: 'animal', name: 'Animal suelto', signal: 'Aviso de un toque', action: 'Aviso a los que vienen detrás', source: 'Móviles SENDA', module: 'road-guard', status: 'SIMULADO', access: 'PASIVO' },
  { id: 'tunel', name: 'Túnel', signal: 'Pérdida del GNSS', action: 'Posición por estima; salidas de emergencia (pendiente de datos)', source: 'Geometría guardada', module: 'road-guard', status: 'PARCIAL', access: 'PASIVO' },
  { id: 'paso-nivel', name: 'Paso a nivel', signal: 'Posición del paso y circulación de trenes', action: 'Aviso de aproximación', source: 'Gestor ferroviario', module: 'rail-watch', status: 'PENDIENTE', access: 'CONVENIO' },
  { id: 'peligrosas', name: 'Mercancías peligrosas', signal: 'Número ONU del panel naranja', action: 'Distancia de seguridad de la guía de respuesta', source: 'Guía de respuesta (ERG) sin conexión', module: '—', status: 'PENDIENTE', access: 'PASIVO' },
  { id: 'emergencias', name: 'Vehículo de emergencia acercándose', signal: 'Posición del vehículo prioritario', action: 'Apartarse a tiempo', source: 'DGT 3.0, C-ITS', module: '—', status: 'PENDIENTE', access: 'CONVENIO' },
]);

// ---------------------------------------------------------------- Rozamiento, frenado y visibilidad
/** Coeficientes de rozamiento típicos de referencia (orden de magnitud de manual, no medidos). */
export const MU = Object.freeze({ seco: 0.7, mojado: 0.4, nieve: 0.2, hielo: 0.1 });
export function stoppingDistance(vMs, { mu = MU.seco, reactS = 1.5, gradePct = 0 } = {}) {
  const a = g * (mu + gradePct / 100), reactM = vMs * reactS, brakeM = a > 0 ? vMs ** 2 / (2 * a) : Infinity;
  return { reactM: Math.round(reactM), brakeM: Math.round(brakeM), totalM: Math.round(reactM + brakeM) };
}
/** Velocidad máxima para parar dentro de lo que se ve: v·t + v²/2a = visibilidad. */
export function safeSpeedForVisibility(visM, { mu = MU.seco, reactS = 1.5, marginM = 0 } = {}) {
  const a = mu * g, d = Math.max(0, visM - marginM), v = a * (-reactS + Math.sqrt(reactS ** 2 + (2 * d) / a));
  return { vMs: +v.toFixed(2), kmh: Math.floor(kmh(v)) };
}

// ---------------------------------------------------------------- Curvas (modelo de masa puntual de AASHTO)
export function circumradius(a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ca = Math.hypot(a.x - c.x, a.y - c.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}
/** v² = g·R·(e + f): peralte e y rozamiento lateral f de diseño (valores típicos). */
export const curveSpeed = (R, { e = 0.06, f = 0.12 } = {}) => (Number.isFinite(R) ? Math.sqrt(g * R * (e + f)) : Infinity);
/** Curva más cerrada en los próximos metros de la vía y lo que hay que frenar para tomarla. */
export function curveAhead(road, s, vMs, { lookM = 400, stepM = 25, spanM = 50, e = 0.06, f = 0.12 } = {}) {
  const ll = (u) => pointAt(road, u), fr = localFrame(ll(s).lat, ll(s).lon), xy = (u) => { const p = ll(u); return fr.toXY(p.lat, p.lon); };
  let worst = { R: Infinity, atM: null };
  for (let u = s + spanM; u <= s + lookM; u += stepM) { const R = circumradius(xy(u - spanM), xy(u), xy(u + spanM)); if (R < worst.R) worst = { R, atM: Math.round(u - s) }; }
  const vMax = curveSpeed(worst.R, { e, f }), need = vMs > vMax && worst.atM ? (vMs ** 2 - vMax ** 2) / (2 * Math.max(1, worst.atM)) : 0;
  return { radiusM: Number.isFinite(worst.R) ? Math.round(worst.R) : null, atM: worst.atM, vMaxKmh: Number.isFinite(vMax) ? Math.floor(kmh(vMax)) : null, decelNeedMs2: +need.toFixed(2), level: need >= 3.4 ? 'FRENA' : need > 0.5 ? 'REDUCE' : 'OK' };
}

// ---------------------------------------------------------------- Sentido contrario
/**
 * Calzada de sentido único (`road.oneway = 1` si se circula hacia PK crecientes por la geometría, −1 al revés).
 * Si varias posiciones seguidas, con velocidad, van contra ese sentido sobre la calzada: «vas en sentido contrario».
 */
export function wrongWayCheck(fixes, road, { minSpeedMs = 8, minFixes = 3, laneM = 20 } = {}) {
  let run = 0, since = null;
  for (const f of fixes) {
    const loc = roadLocate(f, road), bad = (f.speed ?? 0) >= minSpeedMs && loc.crossM <= laneM && loc.dir !== road.oneway;
    run = bad ? run + 1 : 0; if (bad && run === 1) since = f.t;
    if (run >= minFixes) return { wrongWay: true, since, at: f.t, say: '¡Vas en sentido contrario! Reduce, luces de emergencia, arcén derecho. No des la vuelta en la calzada.' };
  }
  return { wrongWay: false };
}
/** Para los demás: tiempo hasta cruzarse con quien viene de frente por su calzada. */
export function wrongWayMeet({ distM, vMeMs, vOtherMs }) {
  const closing = vMeMs + vOtherMs, t = distM / Math.max(0.1, closing);
  return { closingKmh: Math.round(kmh(closing)), tS: +t.toFixed(1), level: t < 15 ? 'PELIGRO' : 'AVISO', say: `Vehículo en sentido contrario a ${distM >= 1000 ? (distM / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(distM) + ' m'}: carril derecho, reduce, no adelantes` };
}

// ---------------------------------------------------------------- Final de retención (Lighthill-Whitham-Richards)
export const densityFromQV = (qVehH, vKmh) => qVehH / Math.max(1, vKmh); // veh/km
/** Velocidad de la onda de choque entre tráfico libre (arriba) y congestionado (abajo): w = Δq / Δk. */
export function shockwaveKmh({ qUp, vUp, qDown, vDown }) { const kU = densityFromQV(qUp, vUp), kD = densityFromQV(qDown, vDown); return +((qDown - qUp) / (kD - kU)).toFixed(1); }
/** Cola: desde dónde la velocidad cae por debajo de `slowKmh` (sondas ordenadas en el sentido de la marcha). */
export function queueTail(probes, { slowKmh = 30 } = {}) {
  const ps = [...probes].sort((a, b) => a.s - b.s), i = ps.findIndex((p) => p.vKmh < slowKmh);
  return i < 0 ? null : { sTail: ps[i].s, before: i ? ps[i - 1] : null };
}
/** Dónde y cuándo alcanzarás la cola si sigue creciendo hacia atrás a w (negativo = hacia ti). */
export function queueWarning({ sMe, vMeKmh, sTail, wKmh }) {
  const closing = (vMeKmh - wKmh) / 3.6, t = (sTail - sMe) / Math.max(0.1, closing), meet = sTail + (wKmh / 3.6) * t;
  return { tS: Math.round(t), meetDistM: Math.round(meet - sMe), say: `Final de retención en ${Math.round(meet - sMe)} m: reduce y luces de emergencia` };
}

// ---------------------------------------------------------------- Fatiga, motoristas, agua
export function fatigueRisk({ sinceBreakMin, hour }) {
  const lowWindow = (hour >= 2 && hour < 6) || (hour >= 14 && hour < 16), due = sinceBreakMin >= 120;
  const level = due && lowWindow ? 'ALTO' : due || (lowWindow && sinceBreakMin >= 60) ? 'MEDIO' : 'BAJO';
  return { level, say: level === 'BAJO' ? null : `Llevas ${Math.round(sinceBreakMin)} min sin parar${lowWindow ? ' y es una hora de bajón de sueño' : ''}: para a descansar en la próxima área` };
}
/** Caída de moto o bici: más peso al vuelco que a la deceleración (al deslizar se frena menos). Pendiente de calibrar. */
export const detectRiderFall = (input, opts = {}) => detectCrash(input, { impactG: 3, speedContextMs: 15 / 3.6, stopMs: 2, crashDecelMs2: 6, tiltDeg: 60, ...opts });
/** Profundidades de la campaña «Turn Around, Don't Drown» del servicio meteorológico de EE. UU. */
export function floodedRoad({ depthCm = null, flowing = true } = {}) {
  const level = depthCm == null ? 'DESCONOCIDA' : depthCm >= 60 ? 'ARRASTRA_SUV' : depthCm >= 30 && flowing ? 'ARRASTRA_COCHE' : depthCm >= 15 ? 'PIERDE_CONTROL' : 'ENGAÑOSA';
  const why = { ARRASTRA_SUV: '60 cm arrastran incluso todoterrenos', ARRASTRA_COCHE: '30 cm de agua en movimiento arrastran la mayoría de coches', PIERDE_CONTROL: 'con 15 cm se pierde el control y el motor se cala', ENGAÑOSA: 'el agua engaña: la calzada puede haberse hundido', DESCONOCIDA: 'no se ve el fondo: la calzada puede haberse hundido' }[level];
  return { level, say: `Da la vuelta: ${why}.` };
}

// ---------------------------------------------------------------- Baliza V16 + SENDA
export const V16 = Object.freeze({ mandatorySince: '2026-01-01', reportEveryS: 100, reaches: 'DGT 3.0 → paneles y navegadores', lacks: ['si es avería o accidente', 'heridos y atrapados', 'quién coordina', 'qué carril ocupa'] });
/**
 * Cruza balizas V16 (de DGT 3.0, con convenio) con informes SENDA cercanos en espacio y tiempo.
 * @param {Array<{id,lat,lon,t}>} v16s @param {Array<{id,lat,lon,t,kind,injured?,trapped?,coordinator?}>} reports
 */
export function v16Fusion(v16s, reports, { maxM = 250, maxGapS = 900 } = {}) {
  const used = new Set();
  const incidents = v16s.map((b) => {
    const near = reports.filter((r) => haversineKm(b, r) * 1000 <= maxM && Math.abs(r.t - b.t) <= maxGapS);
    near.forEach((r) => used.add(r.id));
    const crash = near.find((r) => r.kind === 'CRASH'), injured = near.reduce((s, r) => s + (r.injured ?? 0), 0), trapped = near.reduce((s, r) => s + (r.trapped ?? 0), 0);
    const kind = crash ? 'ACCIDENTE' : near.some((r) => r.kind === 'BREAKDOWN') ? 'AVERIA' : 'VEHICULO_DETENIDO';
    return { v16: b.id, lat: b.lat, lon: b.lon, kind, sources: near.length ? ['V16', 'SENDA'] : ['V16'], injured, trapped, coordinator: near.find((r) => r.coordinator)?.coordinator ?? null, priority: kind === 'ACCIDENTE' ? (trapped ? 3 : injured ? 2 : 1) : 0 };
  });
  const orphans = reports.filter((r) => !used.has(r.id) && r.kind === 'CRASH').map((r) => ({ report: r.id, lat: r.lat, lon: r.lon, kind: 'ACCIDENTE_SIN_V16', sources: ['SENDA'], say: 'Enciende la V16: así la DGT y los navegadores avisan a los que vienen' }));
  return { incidents: incidents.sort((a, b) => b.priority - a.priority), orphans };
}

/**
 * Carretera de montaña SINTÉTICA para las demostraciones: recta, curva de 120 m, recta, curva cerrada
 * de 40 m (horquilla) y recta. Geometría exacta en metros para probar el cálculo de curvas.
 */
export function mountainRoad({ lat0 = 42.5, lon0 = -0.5, stepM = 10 } = {}) {
  const f = localFrame(lat0, lon0), pts = [{ x: 0, y: 0 }]; let h = 0, x = 0, y = 0;
  const straight = (L) => { for (let d = stepM; d <= L; d += stepM) { x += stepM * Math.sin(h); y += stepM * Math.cos(h); pts.push({ x, y }); } };
  const arc = (R, deg, dir) => { const n = Math.max(2, Math.round((R * Math.abs(deg) * Math.PI) / 180 / stepM)), dh = ((deg * Math.PI) / 180 / n) * dir; for (let k = 0; k < n; k++) { const c = 2 * R * Math.sin(Math.abs(dh) / 2); h += dh / 2; x += c * Math.sin(h); y += c * Math.cos(h); h += dh / 2; pts.push({ x, y }); } };
  straight(600); arc(120, 90, 1); straight(300); arc(40, 180, -1); straight(400);
  const road = { id: 'CV-000', oneway: 1, points: pts.map((p) => f.toLL(p.x, p.y)) };
  road.milestones = [0, 1, 2].map((k) => ({ km: k, ...pointAt(road, k * 1000) }));
  return road;
}
