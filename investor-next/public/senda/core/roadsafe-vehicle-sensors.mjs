/**
 * SENDA RoadSafe · Sensores del móvil y del coche (inteligente o no) → señales físicas fiables.
 *
 * Fuentes y acceso REAL (sin APIs privadas):
 *  - Móvil (web): DeviceMotionEvent (aceleración con/sin gravedad, rotationRate) y Geolocation (velocidad
 *    Doppler GNSS, rumbo, precisión). iOS exige permiso explícito; la frecuencia la decide el navegador/SO.
 *  - Móvil (app nativa SENDA Android): SensorManager (acelerómetro, giroscopio, presión) a mayor frecuencia.
 *  - Coche NO inteligente: adaptador OBD-II (ELM327). Por Web Bluetooth solo los adaptadores BLE; los de
 *    Bluetooth clásico requieren la app nativa. PIDs estándar SAE J1979 (fórmulas abajo); el freno NO es
 *    un PID estándar.
 *  - Coche conectado (APIs de fabricante): CONTRACT_REQUIRED. eCall: inaccesible para apps (lo hace el coche).
 *
 * Funciones: decodificar PIDs OBD-II, alinear el móvil con el coche (gravedad + rumbo GNSS), deceleración
 * longitudinal fusionada (IMU + Doppler), detección de frenada brusca/choque con rechazo de caídas del
 * móvil, estimación de Δv del pulso de choque e intención de parada del vehículo de delante.
 */
import { G } from './roadsafe-secondary-risk.mjs';

// ------------------------------------------------------------------ OBD-II (SAE J1979, modo 01)
/** Respuesta ELM327 tipo «41 0D 3C» → valor físico. Solo PIDs estándar documentados. */
export const OBD_PIDS = Object.freeze({
  '0D': { name: 'vehicleSpeed', unit: 'km/h', bytes: 1, f: ([A]) => A },
  '0C': { name: 'engineRpm', unit: 'rpm', bytes: 2, f: ([A, B]) => (256 * A + B) / 4 },
  '11': { name: 'throttlePosition', unit: '%', bytes: 1, f: ([A]) => (100 * A) / 255 },
  '04': { name: 'engineLoad', unit: '%', bytes: 1, f: ([A]) => (100 * A) / 255 },
  '05': { name: 'coolantTemp', unit: '°C', bytes: 1, f: ([A]) => A - 40 },
});
export function decodeObd(line) {
  const h = String(line).trim().toUpperCase().replace(/[^0-9A-F ]/g, '').split(/\s+/).filter(Boolean);
  if (h.length < 3 || h[0] !== '41') return { ok: false, error: 'no es una respuesta de modo 01' };
  const pid = OBD_PIDS[h[1]]; if (!pid) return { ok: false, error: `PID ${h[1]} no soportado` };
  const data = h.slice(2, 2 + pid.bytes).map((x) => parseInt(x, 16));
  if (data.length < pid.bytes || data.some((x) => !Number.isFinite(x))) return { ok: false, error: 'respuesta incompleta' };
  return { ok: true, pid: h[1], name: pid.name, unit: pid.unit, value: +pid.f(data).toFixed(2) };
}
/** Deceleración desde la serie de velocidad OBD (km/h, t en s) por regresión en ventana. */
export function obdDecel(series, { winS = 1 } = {}) {
  const last = series.at(-1); if (!last) return null;
  const w = series.filter((p) => p.t >= last.t - winS); if (w.length < 2) return null;
  const mt = w.reduce((s, p) => s + p.t, 0) / w.length, mv = w.reduce((s, p) => s + p.kmh / 3.6, 0) / w.length;
  const slope = w.reduce((s, p) => s + (p.t - mt) * (p.kmh / 3.6 - mv), 0) / (w.reduce((s, p) => s + (p.t - mt) ** 2, 0) || 1);
  return +(-slope).toFixed(2);
}

// ------------------------------------------------------------------ Alineación móvil ↔ coche
const norm = (v) => Math.hypot(v.x, v.y, v.z), scale = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k }), sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
/**
 * Estima el eje «vertical» (gravedad media en reposo/crucero) y el eje «longitudinal» (dirección de la
 * aceleración horizontal cuando la velocidad GNSS cambia). Devuelve una base para proyectar la IMU.
 * samples: [{ a:{x,y,z} (con gravedad, m/s²), dvGnss (m/s² por Doppler, + acelera) }]
 */
export function estimateMounting(samples, { minDv = 1.0 } = {}) {
  if (samples.length < 20) return { ok: false, error: 'muestras insuficientes' };
  const g = samples.reduce((s, p) => ({ x: s.x + p.a.x, y: s.y + p.a.y, z: s.z + p.a.z }), { x: 0, y: 0, z: 0 });
  const up = scale(g, 1 / norm(g));
  let fwd = { x: 0, y: 0, z: 0 }, used = 0;
  for (const p of samples) if (Math.abs(p.dvGnss ?? 0) >= minDv) { const h = sub(p.a, scale(up, dot3(p.a, up))); fwd = { x: fwd.x + Math.sign(p.dvGnss) * h.x, y: fwd.y + Math.sign(p.dvGnss) * h.y, z: fwd.z + Math.sign(p.dvGnss) * h.z }; used++; }
  if (!used || norm(fwd) < 1e-6) return { ok: false, error: 'sin cambios de velocidad GNSS para orientar el eje longitudinal', up };
  const f = scale(fwd, 1 / norm(fwd)), left = cross3(up, f);
  return { ok: true, up, forward: f, left, samplesUsed: used, gravityMs2: +norm(scale(g, 1 / samples.length)).toFixed(2) };
}
/** Proyección de una muestra IMU (con gravedad) a ejes del coche: longitudinal (+ acelera), lateral, vertical. */
export function toVehicleFrame(a, m) { const lin = sub(a, scale(m.up, G)); return { long: +dot3(lin, m.forward).toFixed(3), lat: +dot3(lin, m.left).toFixed(3), vert: +dot3(lin, m.up).toFixed(3) }; }

// ------------------------------------------------------------------ Choque vs caída del móvil, Δv del pulso
/**
 * Clasifica un pico de aceleración: CRASH_LIKELY exige pico alto + duración de pulso compatible +
 * caída de velocidad GNSS/OBD coherente; un pico sin cambio de velocidad del VEHÍCULO o precedido de caída
 * libre (|a|≈0) se clasifica como PHONE_DROP. Umbrales HIPOTÉTICOS a validar con pruebas.
 */
export function classifyImpulse({ imu, speedBefore, speedAfter, dt = 0.01 }, { peakG = 4, minPulseS = 0.03, maxPulseS = 0.3, minSpeedDropMs = 2, freeFallG = 0.3, freeFallS = 0.15 } = {}) {
  const mag = imu.map((a) => Math.hypot(a.x, a.y, a.z) / G);
  const peak = Math.max(...mag), above = mag.filter((m) => m >= peakG / 2).length * dt;
  let ff = 0, ffMax = 0; for (const m of mag) { ff = m < freeFallG ? ff + dt : 0; ffMax = Math.max(ffMax, ff); }
  const drop = Number.isFinite(speedBefore) && Number.isFinite(speedAfter) ? speedBefore - speedAfter : null;
  let verdict = 'NONE';
  if (peak >= peakG) {
    if (ffMax >= freeFallS && (drop == null || drop < minSpeedDropMs)) verdict = 'PHONE_DROP';
    else if (drop != null && drop >= minSpeedDropMs && above >= minPulseS && above <= maxPulseS) verdict = 'CRASH_LIKELY';
    else if (drop == null) verdict = 'IMPACT_UNCONFIRMED';
    else verdict = 'PHONE_HANDLING_OR_POTHOLE';
  }
  return { verdict, peakG: +peak.toFixed(2), pulseS: +above.toFixed(3), freeFallS: +ffMax.toFixed(3), speedDropMs: drop == null ? null : +drop.toFixed(2), needsHumanConfirmation: verdict !== 'NONE' };
}
/** Δv del pulso integrando la aceleración longitudinal (ejes del coche) durante el pulso. */
export function pulseDeltaV(longSeries, dt) {
  let dv = 0, peak = 0; for (const a of longSeries) { dv += a * dt; peak = Math.min(peak, a); }
  return { deltaVms: +Math.abs(dv).toFixed(2), peakDecelMs2: +Math.abs(peak).toFixed(1) };
}

// ------------------------------------------------------------------ Intención de parada del de delante
/** A partir de velocidad y deceleración del vehículo de delante: dónde y cuándo parará. */
export function predictStop({ vMs, decelMs2, posAheadM = 0, latencyS = 0.3 }) {
  if (!(vMs >= 0) || !(decelMs2 > 0)) return null;
  const tStop = vMs / decelMs2, dStop = (vMs * vMs) / (2 * decelMs2) + vMs * latencyS;
  return { tStopS: +tStop.toFixed(2), stopAtAheadM: Math.round(posAheadM + dStop), note: 'supone deceleración constante desde ahora' };
}
