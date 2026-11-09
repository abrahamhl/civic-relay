/**
 * SENDA · Módulo de incidente ferroviario (y de transporte en general).
 *
 * Motivación (cronología publicada del accidente de Adamuz, 18-01-2026): la primera
 * llamada al 112 llegó a los ~60 s, pero los servicios de emergencia tardaron en torno a
 * 45 minutos en saber que había un SEGUNDO tren descarrilado, porque la información
 * inicial solo llevaba las coordenadas del primero. SENDA ataca exactamente ese hueco:
 *
 *  1. DETECCIÓN EN CADA TELÉFONO (`detectCrash`): contexto de velocidad previo +
 *     impacto + parada brusca y/o vuelco del coche. Distingue caída del móvil, frenada
 *     de emergencia y bache, para no inundar el 112 de falsas alarmas.
 *  2. RESPUESTA HUMANA (`crashResponsePolicy`): cuenta atrás para que la persona diga
 *     «estoy bien / necesito ayuda / atrapado / herido grave / ayudo a otros». Si no
 *     responde, el teléfono informa solo («sin respuesta»), que es un dato clave.
 *  3. FUSIÓN DE INFORMES (`fuseIncidentReports`): agrupa los informes de todos los
 *     pasajeros por tren / posición / sentido de marcha y devuelve, en segundos:
 *     cuántos trenes y emplazamientos hay, coches afectados, atrapados, sin respuesta y
 *     una prioridad de intervención. Es un complemento del 112 (AML ya envía la posición
 *     de quien llama); SENDA añade la imagen agregada de cientos de teléfonos.
 */
import { haversineKm } from './zones.mjs';

export const G = 9.80665;
export const PASSENGER_STATUS = Object.freeze(['OK', 'HELPING_OTHERS', 'NEED_HELP', 'INJURED_SERIOUS', 'TRAPPED', 'NO_RESPONSE']);
const WEIGHT = { OK: 0, HELPING_OTHERS: 0, NEED_HELP: 2, INJURED_SERIOUS: 4, TRAPPED: 5, NO_RESPONSE: 3 };

const mag = (s) => Math.hypot(s.ax, s.ay, s.az);
const angleDeg = (a, b) => {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};
const meanVec = (xs) => xs.reduce((m, s) => ({ x: m.x + s.ax / xs.length, y: m.y + s.ay / xs.length, z: m.z + s.az / xs.length }), { x: 0, y: 0, z: 0 });

/**
 * @param {{motion: Array<{t:number,ax:number,ay:number,az:number}>, gps: Array<{t:number,speed:number}>}} input
 *   aceleración con gravedad (m/s², DeviceMotionEvent.accelerationIncludingGravity) y velocidad GPS (m/s)
 * @returns {{state:'NONE'|'PHONE_DROP'|'HARD_BRAKING'|'CRASH_SUSPECTED'|'CRASH_LIKELY', confidence:number, at:number|null, peakG:number, decelMs2:number|null, tiltDeg:number|null, reasons:string[]}}
 */
export function detectCrash({ motion, gps }, { impactG = 2.5, speedContextMs = 25, stopMs = 3, crashDecelMs2 = 4, tiltDeg = 45 } = {}) {
  const reasons = [];
  let peak = { g: 0, t: null };
  for (const s of motion) { const g = Math.abs(mag(s) - G) / G; if (g > peak.g) peak = { g, t: s.t }; }
  const gpsBefore = (t) => gps.filter((f) => f.t <= t && f.t >= t - 60);
  const gpsAfter = (t, w) => gps.filter((f) => f.t > t && f.t <= t + w);

  // Frenada fuerte sin impacto (para no confundirla)
  const maxSpeed = Math.max(0, ...gps.map((f) => f.speed));
  if (peak.g < impactG) {
    const last = gps[gps.length - 1];
    if (maxSpeed >= speedContextMs && last && last.speed < stopMs) return { state: 'HARD_BRAKING', confidence: 0.2, at: null, peakG: +peak.g.toFixed(2), decelMs2: null, tiltDeg: null, reasons: ['Parada sin impacto: frenada, no accidente'] };
    return { state: 'NONE', confidence: 0, at: null, peakG: +peak.g.toFixed(2), decelMs2: null, tiltDeg: null, reasons };
  }
  reasons.push(`Impacto de ${peak.g.toFixed(1)} g`);
  const before = gpsBefore(peak.t), vBefore = Math.max(0, ...before.map((f) => f.speed));
  const hadSpeed = vBefore >= speedContextMs;
  if (!hadSpeed) return { state: 'PHONE_DROP', confidence: 0.1, at: peak.t, peakG: +peak.g.toFixed(2), decelMs2: null, tiltDeg: null, reasons: [...reasons, 'Sin velocidad previa: caída del teléfono'] };
  reasons.push(`Velocidad previa ${Math.round(vBefore * 3.6)} km/h`);

  const after = gpsAfter(peak.t, 20);
  const stopped = after.find((f) => f.speed < stopMs);
  const decel = stopped ? (vBefore - stopped.speed) / Math.max(0.5, stopped.t - (before[before.length - 1]?.t ?? peak.t)) : null;
  const abruptStop = decel !== null && decel >= crashDecelMs2;
  if (abruptStop) reasons.push(`Parada brusca: ${decel.toFixed(1)} m/s² (una frenada de emergencia de alta velocidad ronda 1–1,5)`);

  const pre = motion.filter((s) => s.t >= peak.t - 4 && s.t < peak.t - 0.5), post = motion.filter((s) => s.t > peak.t + 3 && s.t <= peak.t + 8);
  const tilt = pre.length && post.length ? angleDeg(meanVec(pre), meanVec(post)) : null;
  const overturned = tilt !== null && tilt >= tiltDeg;
  if (overturned) reasons.push(`Orientación cambiada ${Math.round(tilt)}°: posible vuelco`);

  if (!abruptStop && !overturned) {
    const keptSpeed = after.some((f) => f.speed >= speedContextMs * 0.8);
    return { state: 'NONE', confidence: 0.05, at: peak.t, peakG: +peak.g.toFixed(2), decelMs2: decel && +decel.toFixed(1), tiltDeg: tilt && Math.round(tilt), reasons: [...reasons, keptSpeed ? 'Siguió a velocidad: bache o golpe, no accidente' : 'Sin parada ni vuelco confirmados'] };
  }
  const likely = abruptStop && (overturned || peak.g >= impactG * 1.6);
  return { state: likely ? 'CRASH_LIKELY' : 'CRASH_SUSPECTED', confidence: likely ? 0.9 : 0.65, at: peak.t, peakG: +peak.g.toFixed(2), decelMs2: decel && +decel.toFixed(1), tiltDeg: tilt && Math.round(tilt), reasons };
}

/** Cuánto esperar la respuesta humana antes de informar solo. */
export function crashResponsePolicy(detection) {
  if (!['CRASH_SUSPECTED', 'CRASH_LIKELY'].includes(detection.state)) return { prompt: false };
  return {
    prompt: true, countdownS: detection.state === 'CRASH_LIKELY' ? 20 : 30, onTimeout: 'NO_RESPONSE',
    options: [['OK', 'Estoy bien'], ['NEED_HELP', 'Necesito ayuda'], ['INJURED_SERIOUS', 'Herido grave'], ['TRAPPED', 'Estoy atrapado'], ['HELPING_OTHERS', 'Estoy bien y ayudo a otros']],
  };
}

/** Informe compacto que viaja cifrado por cualquier canal SENDA (sonido, Bluetooth, SMS, Internet). */
export function buildIncidentReport({ reporterId, detection, status, position, trip = {}, nearbyInjured = 0, at }) {
  if (!PASSENGER_STATUS.includes(status)) throw new Error(`Estado no válido: ${status}`);
  return {
    v: 1, type: 'TRANSPORT_INCIDENT', id: `${reporterId}:${Math.round(at)}`, reporterId, at, status, auto: status === 'NO_RESPONSE',
    lat: position.lat, lon: position.lon, accuracyM: position.accuracyM ?? 30, headingDeg: position.headingDeg ?? null, speedBeforeMs: position.speedBeforeMs ?? null,
    train: trip.train ?? null, coach: trip.coach ?? null, nearbyInjured: Math.max(0, Math.min(50, nearbyInjured | 0)),
    detection: detection && { state: detection.state, peakG: detection.peakG, tiltDeg: detection.tiltDeg },
  };
}

const headingDiff = (a, b) => (a == null || b == null ? 0 : Math.abs((((a - b) % 360) + 540) % 360 - 180));

/**
 * Fusiona informes de pasajeros en una imagen operativa.
 * Separa trenes por identificador declarado o, si no lo hay, por posición + sentido de marcha.
 */
export function fuseIncidentReports(reports, { radiusKm = 0.6, headingSplitDeg = 90, minReports = 2, now } = {}) {
  const latest = new Map(); // el último estado de cada persona manda
  for (const r of [...reports].sort((a, b) => a.at - b.at)) if (now === undefined || r.at <= now) latest.set(r.reporterId, r);
  const rs = [...latest.values()];
  const clusters = [];
  for (const r of rs.sort((a, b) => a.at - b.at)) {
    const c = clusters.find((k) => (r.train && k.train ? r.train === k.train
      : haversineKm(r, k.center) <= radiusKm && headingDiff(r.headingDeg, k.heading) < headingSplitDeg));
    if (c) {
      c.members.push(r); const n = c.members.length;
      c.center = { lat: c.center.lat + (r.lat - c.center.lat) / n, lon: c.center.lon + (r.lon - c.center.lon) / n };
      if (r.headingDeg != null && c.heading == null) c.heading = r.headingDeg;
      c.train ??= r.train;
    } else clusters.push({ train: r.train, heading: r.headingDeg, center: { lat: r.lat, lon: r.lon }, members: [r], firstAt: r.at });
  }
  const sites = clusters.filter((c) => c.members.length >= minReports).map((c, i) => {
    const counts = Object.fromEntries(PASSENGER_STATUS.map((s) => [s, 0]));
    const coaches = {};
    let nearby = 0;
    for (const m of c.members) {
      counts[m.status]++; nearby += m.nearbyInjured;
      if (m.coach != null) { coaches[m.coach] ??= { reports: 0, score: 0, trapped: 0, noResponse: 0 }; const k = coaches[m.coach]; k.reports++; k.score += WEIGHT[m.status]; k.trapped += m.status === 'TRAPPED'; k.noResponse += m.status === 'NO_RESPONSE'; }
    }
    const extentM = Math.round(1000 * Math.max(...c.members.map((m) => haversineKm(m, c.center))));
    const score = c.members.reduce((s, m) => s + WEIGHT[m.status], 0) + nearby;
    const detectedAt = c.members[Math.min(minReports, c.members.length) - 1].at;
    return {
      site: i + 1, train: c.train ?? `Tren sin identificar (rumbo ${c.heading == null ? '?' : Math.round(c.heading) + '°'})`,
      center: { lat: +c.center.lat.toFixed(5), lon: +c.center.lon.toFixed(5) }, headingDeg: c.heading, extentM,
      reports: c.members.length, firstReportAt: c.firstAt, detectedAt, counts, nearbyInjuredReported: nearby, priorityScore: score,
      coachesByPriority: Object.entries(coaches).map(([coach, k]) => ({ coach, ...k })).sort((a, b) => b.score - a.score),
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
  const alerts = [];
  const byTime = [...sites].sort((a, b) => a.detectedAt - b.detectedAt);
  if (byTime.length > 1) alerts.push({ level: 'CRITICAL', text: `${byTime.length} trenes/emplazamientos distintos implicados`, at: byTime[1].detectedAt });
  for (const s of sites) for (const k of s.coachesByPriority) if (k.trapped || k.noResponse >= 2) alerts.push({ level: 'HIGH', text: `Sitio ${s.site} · coche ${k.coach}: ${k.trapped} atrapado(s), ${k.noResponse} sin respuesta`, at: s.detectedAt });
  return { generatedAt: now ?? null, reporters: rs.length, sites, alerts, secondSiteDetectedAt: byTime[1]?.detectedAt ?? null };
}

/** Resumen de texto para el operador del 112 / centro de coordinación (cabe en un SMS largo). */
export function emergencyBrief(fusion) {
  return fusion.sites.map((s) => `SITIO ${s.site} ${s.train} @${s.center.lat},${s.center.lon} ±${s.extentM}m · ${s.reports} informes · atrapados ${s.counts.TRAPPED} · graves ${s.counts.INJURED_SERIOUS} · sin respuesta ${s.counts.NO_RESPONSE} · coches prioritarios ${s.coachesByPriority.slice(0, 3).map((k) => k.coach).join(',') || '-'}`).join('\n');
}
