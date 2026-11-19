/**
 * Detección sísmica con los acelerómetros de los teléfonos participantes
 * (enfoque tipo MyShake / Android Earthquake Alerts, implementado de forma propia:
 * SENDA no tiene acceso a la red privada de Google).
 *
 * 1. En cada teléfono: disparo STA/LTA sobre la aceleración (quieto y enchufado = mejor sensor).
 * 2. En la red: con ≥4 disparos coherentes se localiza el epicentro por búsqueda en
 *    rejilla minimizando residuos de llegada de onda P.
 * 3. Se calcula, para cada punto, cuántos segundos faltan para la onda S (la dañina).
 * La alerta llega ANTES de las ondas dañinas a quien está lejos, nunca antes del sismo.
 */
import { haversineKm } from './zones.mjs';

/** STA/LTA clásico sobre |a| − g. Devuelve los instantes (s) de disparo. */
export function staLtaTriggers(samples, { sr = 50, staS = 0.5, ltaS = 10, on = 4, off = 1.5 } = {}) {
  const ns = Math.round(staS * sr), nl = Math.round(ltaS * sr);
  const x = samples.map((v) => Math.abs(v));
  const triggers = [];
  let sta = 0, lta = 0, armed = true;
  for (let i = 0; i < x.length; i++) {
    sta += x[i] / ns; if (i >= ns) sta -= x[i - ns] / ns;
    lta += x[i] / nl; if (i >= nl) lta -= x[i - nl] / nl;
    if (i < nl) continue;
    const ratio = sta / Math.max(lta, 1e-6);
    if (armed && ratio >= on) { triggers.push(i / sr); armed = false; }
    else if (!armed && ratio <= off) armed = true;
  }
  return triggers;
}

/**
 * Localiza el evento a partir de llegadas P de varios teléfonos.
 * @param {Array<{lat:number, lon:number, t:number}>} picks t en segundos absolutos
 * @returns {{lat,lon,originTime,rmsS,stations,confidence}|null}
 */
export function locateEvent(picks, { vpKmS = 6.0, gridKm = 120, stepKm = 2, minStations = 4, maxRmsS = 1.0 } = {}) {
  if (picks.length < minStations) return null;
  const c = { lat: picks.reduce((s, p) => s + p.lat, 0) / picks.length, lon: picks.reduce((s, p) => s + p.lon, 0) / picks.length };
  const kmLat = 111.2, kmLon = 111.2 * Math.cos((c.lat * Math.PI) / 180);
  let best = null;
  const solve = (lat, lon) => {
    const tt = picks.map((p) => haversineKm({ lat, lon }, p) / vpKmS);
    const t0 = picks.reduce((s, p, i) => s + (p.t - tt[i]), 0) / picks.length;
    const rms = Math.sqrt(picks.reduce((s, p, i) => s + (p.t - (t0 + tt[i])) ** 2, 0) / picks.length);
    return { lat, lon, originTime: t0, rmsS: rms };
  };
  for (let dy = -gridKm; dy <= gridKm; dy += stepKm) for (let dx = -gridKm; dx <= gridKm; dx += stepKm) {
    const s = solve(c.lat + dy / kmLat, c.lon + dx / kmLon);
    if (!best || s.rmsS < best.rmsS) best = s;
  }
  // refinado fino alrededor del mínimo
  for (let dy = -stepKm; dy <= stepKm; dy += stepKm / 10) for (let dx = -stepKm; dx <= stepKm; dx += stepKm / 10) {
    const s = solve(best.lat + dy / kmLat, best.lon + dx / kmLon);
    if (s.rmsS < best.rmsS) best = s;
  }
  if (best.rmsS > maxRmsS) return { ...best, stations: picks.length, confidence: 'REJECTED_INCOHERENT' };
  return { ...best, stations: picks.length, confidence: picks.length >= 8 ? 'HIGH' : 'MEDIUM', classification: 'SENDA_NETWORK_OBSERVATION' };
}

/** Segundos que faltan, en `now`, para que la onda S llegue a cada punto (negativo = ya llegó). */
export function sWaveLeadTimes(event, points, now, { vsKmS = 3.5 } = {}) {
  return points.map((p) => ({ ...p, leadS: event.originTime + haversineKm(event, p) / vsKmS - now }));
}
