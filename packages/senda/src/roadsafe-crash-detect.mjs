/**
 * SENDA RoadSafe · Detección de accidente en el móvil: fusión secuencial de evidencias con abstención.
 *
 * Contexto verificado (2026-11-18): la detección de choques de Apple ha generado falsos positivos
 * documentados (temporada de esquí, montañas rusas, motos de nieve), con centros 911 que recibieron
 * avisos sin incidente real (Hackaday, TechSpot, Tom's Guide, Intego). La literatura académica (WreckWatch,
 * Vanderbilt) señala que el móvil puede caerse y no está unido al vehículo, y filtra con contexto.
 *
 * Diseño de SENDA (diferencial): un pico de aceleración NUNCA basta. Se exige coherencia FÍSICA y de
 * CONTEXTO, y la decisión final es humana con cuenta atrás. SENDA no llama solo al 112: prepara el
 * expediente, avisa al grupo del viaje si el usuario no responde y deja el botón 112 delante.
 *
 *   Disparo  →  evidencias (cada una con razón de verosimilitud DECLARADA)  →  posterior  →  estado
 *   evidencias: caída brusca de velocidad del VEHÍCULO (GNSS/OBD) · forma de pulso compatible ·
 *               caída libre previa (en contra) · vehículo detenido después · reanudación de la marcha
 *               (en contra) · sobre una vía conocida (map matching) o lejos de toda vía (en contra) ·
 *               airbag/aviso del coche (si hay contrato) · cambio brusco de orientación
 *   estados:    NO_EVENT · CHECK_USER (cuenta atrás larga) · LIKELY_CRASH (cuenta atrás corta + expediente)
 *               · ABSTAIN (datos insuficientes: se pregunta al usuario sin afirmar nada)
 *
 * Regla de veracidad: las razones de verosimilitud y los umbrales NO tienen valores por defecto; se pasan
 * como configuración declarada. `EXAMPLE_DETECTION_CONFIG` es un ejemplo explícito, sin calibrar.
 */
import { G, wilson } from './roadsafe-secondary-risk.mjs';

export const EVIDENCE_KEYS = Object.freeze(['speedDrop', 'pulseShape', 'freeFallBefore', 'stationaryAfter', 'motionResumed', 'onRoad', 'farFromRoad', 'airbagSignal', 'orientationFlip']);

/** Configuración de EJEMPLO, SIN CALIBRAR (hipótesis declaradas para verificar el software, no para producción). */
export const EXAMPLE_DETECTION_CONFIG = Object.freeze({
  basis: 'MODEL_UNCALIBRATED_LR — ejemplo para verificación de software; calibrar con trazas etiquetadas',
  priorOdds: 1 / 2000,
  trigger: { peakG: 4, physicalDecelG: 1.3 },
  thresholds: { speedDropMs: 4, pulseMinS: 0.03, pulseMaxS: 0.3, freeFallG: 0.3, freeFallS: 0.15, stationaryAfterS: 10, stationaryMs: 1, resumeWithinS: 30, resumeMs: 6, onRoadM: 25, farFromRoadM: 150, flipDeg: 45 },
  lr: { speedDrop: 40, pulseShape: 3, freeFallBefore: 0.05, stationaryAfter: 4, motionResumed: 0.05, onRoad: 2, farFromRoad: 0.02, airbagSignal: 500, orientationFlip: 2.5 },
  decision: { checkUserPosterior: 0.05, likelyCrashPosterior: 0.6, minEvidence: 2 },
  countdownS: { CHECK_USER: 30, LIKELY_CRASH: 15 },
});

function requireConfig(c) {
  if (!c?.basis || !c.lr || !c.thresholds || !c.trigger || !c.decision || !Number.isFinite(c.priorOdds)) throw new Error('detectCrashEvent exige una configuración declarada { basis, priorOdds, trigger, thresholds, lr, decision } (regla de veracidad)');
  return c;
}
const mag = (a) => Math.hypot(a.x, a.y, a.z);
const angle = (a, b) => { const d = (a.x * b.x + a.y * b.y + a.z * b.z) / ((mag(a) * mag(b)) || 1); return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI; };

/**
 * Evalúa una ventana alrededor de un posible evento.
 * trace: {
 *   imu: [{ t, x, y, z }] (m/s², con gravedad), speed: [{ t, ms, src:'GNSS'|'OBD' }],
 *   distanceToRoadM?: number|null (map matching), airbag?: boolean|null
 * }
 */
export function detectCrashEvent(trace, config) {
  const C = requireConfig(config), T = C.thresholds, ev = {}, why = [];
  const imu = trace.imu ?? [], sp = (trace.speed ?? []).slice().sort((a, b) => a.t - b.t);
  if (imu.length < 5) return { state: 'ABSTAIN', why: ['sin datos de acelerómetro'], basis: C.basis };
  // ---- disparo: pico IMU o deceleración física imposible para una frenada
  let peak = 0, tPeak = imu[0].t; for (const a of imu) { const g = mag(a) / G; if (g > peak) { peak = g; tPeak = a.t; } }
  let maxDecel = 0; for (let i = 1; i < sp.length; i++) { const dt = sp[i].t - sp[i - 1].t; if (dt > 0 && dt <= 1.5) maxDecel = Math.max(maxDecel, (sp[i - 1].ms - sp[i].ms) / dt / G); }
  if (peak < C.trigger.peakG && maxDecel < C.trigger.physicalDecelG) return { state: 'NO_EVENT', peakG: +peak.toFixed(2), why: ['sin disparo'], basis: C.basis };
  // ---- evidencias
  const before = sp.filter((s) => s.t <= tPeak && s.t >= tPeak - 3), after = sp.filter((s) => s.t > tPeak);
  if (before.length && after.length) {
    const v0 = Math.max(...before.map((s) => s.ms)), v1 = Math.min(...after.filter((s) => s.t <= tPeak + 2).map((s) => s.ms).concat([Infinity]));
    if (Number.isFinite(v1)) ev.speedDrop = v0 - v1 >= T.speedDropMs;
    const late = after.filter((s) => s.t >= tPeak + T.stationaryAfterS);
    if (late.length) ev.stationaryAfter = late.every((s) => s.ms <= T.stationaryMs);
    const resumed = after.filter((s) => s.t <= tPeak + T.resumeWithinS && s.t > tPeak + 3);
    if (resumed.length) ev.motionResumed = resumed.some((s) => s.ms >= T.resumeMs);
  } else why.push('sin velocidad del vehículo antes y después: evidencia cinemática ausente');
  const above = imu.filter((a) => mag(a) / G >= C.trigger.peakG / 2);
  if (above.length >= 2) { const dur = above[above.length - 1].t - above[0].t; ev.pulseShape = dur >= T.pulseMinS && dur <= T.pulseMaxS; }
  let ff = 0, ffMax = 0, prevT = null; for (const a of imu.filter((x) => x.t < tPeak)) { const dt = prevT == null ? 0 : a.t - prevT; prevT = a.t; ff = mag(a) / G < T.freeFallG ? ff + dt : 0; ffMax = Math.max(ffMax, ff); }
  ev.freeFallBefore = ffMax >= T.freeFallS;
  const pre = imu.filter((a) => a.t < tPeak - 0.5).slice(-20), post = imu.filter((a) => a.t > tPeak + 1).slice(0, 20);
  if (pre.length >= 5 && post.length >= 5) { const avg = (arr) => arr.reduce((s, a) => ({ x: s.x + a.x, y: s.y + a.y, z: s.z + a.z }), { x: 0, y: 0, z: 0 }); ev.orientationFlip = angle(avg(pre), avg(post)) >= T.flipDeg; }
  if (Number.isFinite(trace.distanceToRoadM)) { ev.onRoad = trace.distanceToRoadM <= T.onRoadM; ev.farFromRoad = trace.distanceToRoadM >= T.farFromRoadM; }
  else why.push('sin map matching: no se sabe si estaba en una vía');
  if (trace.airbag === true || trace.airbag === false) ev.airbagSignal = trace.airbag;
  // ---- posterior (Bayes con razones de verosimilitud declaradas; solo evidencias presentes cuentan)
  let odds = C.priorOdds; const used = [];
  for (const [k, v] of Object.entries(ev)) {
    if (v !== true) continue;
    const lr = C.lr[k]; if (!Number.isFinite(lr)) { why.push(`sin razón de verosimilitud declarada para ${k}`); continue; }
    odds *= lr; used.push({ evidence: k, lr });
  }
  const posterior = odds / (1 + odds), observed = Object.keys(ev).length;
  let state;
  if (observed < C.decision.minEvidence) state = 'ABSTAIN';
  else if (posterior >= C.decision.likelyCrashPosterior) state = 'LIKELY_CRASH';
  else if (posterior >= C.decision.checkUserPosterior) state = 'CHECK_USER';
  else state = 'NO_EVENT';
  // Sesgo de seguridad: sin velocidad del vehículo (túnel, sin GNSS/OBD) un pulso fuerte no puede descartarse.
  const kinematicsMissing = ev.speedDrop === undefined && ev.stationaryAfter === undefined && ev.motionResumed === undefined;
  if (kinematicsMissing && peak >= C.trigger.peakG && ev.freeFallBefore !== true && (state === 'NO_EVENT' || state === 'ABSTAIN')) { state = 'CHECK_USER'; why.push('sin datos de velocidad: un pulso fuerte no se descarta, se pregunta al usuario'); }
  if (state === 'ABSTAIN') why.push('evidencias insuficientes: se pregunta al usuario sin afirmar un choque');
  return {
    state, posterior: +posterior.toFixed(4), peakG: +peak.toFixed(2), maxVehicleDecelG: +maxDecel.toFixed(2), evidence: ev, used, why,
    countdownS: C.countdownS?.[state] ?? null, autoCall112: false, basis: C.basis,
    next: state === 'LIKELY_CRASH' ? 'cuenta atrás corta → si no responde: expediente preparado, aviso al grupo del viaje y botón 112 en pantalla' : state === 'CHECK_USER' ? 'preguntar «¿estás bien?» sin alarma' : 'nada',
  };
}

/**
 * Trazas SINTÉTICAS etiquetadas para verificar el software (no para estimar precisión real).
 * Cada generador produce imu/speed con la firma física típica del caso.
 */
export function syntheticTrace(kind, { t0 = 10 } = {}) {
  const imu = [], speed = [], g = { x: 0, y: 0, z: G };
  const push = (t, a) => imu.push({ t: +t.toFixed(3), ...a });
  for (let t = 0; t < 30; t += 0.01) push(t, g);
  const setSpeed = (f) => { for (let t = 0; t <= 60; t += 1) speed.push({ t, ms: f(t), src: 'GNSS' }); };
  const spike = (gPeak, durS, at = t0) => { for (const a of imu) if (a.t >= at && a.t < at + durS) a.x = -gPeak * G; };
  const flip = (from) => { for (const a of imu) if (a.t > from) { a.x = G; a.z = 0; } };
  switch (kind) {
    case 'CRASH_REAR_END': spike(12, 0.12); setSpeed((t) => (t < t0 ? 25 : 0)); return { label: true, imu, speed, distanceToRoadM: 3 };
    case 'CRASH_LOW_SPEED': spike(5, 0.1); setSpeed((t) => (t < t0 ? 9 : 0)); return { label: true, imu, speed, distanceToRoadM: 2 };
    case 'CRASH_ROLLOVER': spike(9, 0.25); flip(t0 + 1); setSpeed((t) => (t < t0 ? 27 : 0)); return { label: true, imu, speed, distanceToRoadM: 8 };
    case 'PHONE_DROP_IN_CAR': for (const a of imu) if (a.t >= t0 - 0.3 && a.t < t0) { a.z = 0.5; } spike(8, 0.02); setSpeed(() => 25); return { label: false, imu, speed, distanceToRoadM: 2 };
    case 'POTHOLE': spike(4.5, 0.04); setSpeed((t) => (Math.abs(t - t0) < 1 ? 22 : 24)); return { label: false, imu, speed, distanceToRoadM: 1 };
    case 'HARD_BRAKE_NO_CRASH': for (const a of imu) if (a.t >= t0 && a.t < t0 + 2.5) a.x = -0.9 * G; setSpeed((t) => (t < t0 ? 25 : t < t0 + 3 ? Math.max(3, 25 - 8 * (t - t0)) : Math.min(25, 3 + 3 * (t - t0 - 3)))); return { label: false, imu, speed, distanceToRoadM: 2 };
    case 'SKI_FALL': spike(7, 0.15); setSpeed((t) => (t < t0 ? 15 : t < t0 + 20 ? 0 : 12)); return { label: false, imu, speed, distanceToRoadM: 900 };
    case 'ROLLER_COASTER': for (const a of imu) if (a.t >= t0 && a.t < t0 + 1) a.z = 5 * G; setSpeed((t) => (t < t0 ? 20 : 5)); return { label: false, imu, speed, distanceToRoadM: 400 };
    case 'DOOR_SLAM_PARKED': spike(4.2, 0.02); setSpeed(() => 0); return { label: false, imu, speed, distanceToRoadM: 5 };
    case 'CRASH_NO_GNSS': spike(11, 0.1); return { label: true, imu, speed: [], distanceToRoadM: null };
    default: throw new Error(`traza sintética desconocida: ${kind}`);
  }
}
export const SYNTHETIC_KINDS = Object.freeze(['CRASH_REAR_END', 'CRASH_LOW_SPEED', 'CRASH_ROLLOVER', 'PHONE_DROP_IN_CAR', 'POTHOLE', 'HARD_BRAKE_NO_CRASH', 'SKI_FALL', 'ROLLER_COASTER', 'DOOR_SLAM_PARKED', 'CRASH_NO_GNSS']);

/** Matriz de confusión con IC de Wilson sobre trazas etiquetadas (sintéticas o reales). */
export function evaluateDetector(traces, config, { positiveStates = ['LIKELY_CRASH', 'CHECK_USER'] } = {}) {
  let tp = 0, fp = 0, tn = 0, fn = 0, abstain = 0; const rows = [];
  for (const tr of traces) {
    const r = detectCrashEvent(tr, config), pos = positiveStates.includes(r.state);
    if (r.state === 'ABSTAIN') abstain++;
    if (tr.label && pos) tp++; else if (tr.label) fn++; else if (pos) fp++; else tn++;
    rows.push({ kind: tr.kind ?? null, label: tr.label, state: r.state, posterior: r.posterior });
  }
  return { tp, fp, tn, fn, abstain, sensitivity: { p: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null, ci: wilson(tp, tp + fn) }, specificity: { p: tn + fp ? +(tn / (tn + fp)).toFixed(3) : null, ci: wilson(tn, tn + fp) }, rows, basis: traces.every((t) => t.synthetic) ? 'SIMULATION (trazas sintéticas: verifica la lógica, no la precisión real)' : 'LABELED_TRACES' };
}
