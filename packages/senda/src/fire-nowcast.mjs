// @ts-check
/**
 * SENDA · Incendio declarado → previsión inmediata a partir de los REPORTES CON FOTO (Guardia Civil, policía, bomberos,
 * vecinos, sensores). Cada reporte trae hora, posición y qué se ve («el frente está aquí», «ha saltado la carretera»).
 *
 *  1. AJUSTE (dato → modelo): dirección de avance = media circular de los rumbos desde la ignición, ponderada por la
 *     distancia; velocidad de cabeza (ROS) = regresión por el origen del avance proyectado frente al tiempo, con su
 *     error típico. El humo NO marca el frente (lo mueve el viento): se guarda como contexto y no entra en el ajuste.
 *  2. CONTRASTE con la regla del 10 % (Cruz y Alexander 2019, Fire 2(2):19): ROS ≈ 10 % del viento a 10 m en campo
 *     abierto. Sirve para saber si lo observado es coherente o excepcional; no sustituye a la observación.
 *  3. PROYECCIÓN: elipse con la ignición en el foco trasero; forma por el viento (Alexander 1985) →
 *     excentricidad e = √(1 − 1/LB²); tiempo hasta un punto a distancia d y ángulo θ con la cabeza:
 *     t = Σ Δs·(1 − e·cosθ) / (ROS·(1 − e)·f(s)), con f = factor de combustible DECLARADO por quien lo usa (opcional).
 *  4. CARRETERAS: primera hora de llegada a cada vía y propuesta de corte si llega antes del margen que fija el mando.
 *     Es una PROPUESTA para una persona con autoridad; SENDA no corta carreteras ni emite avisos públicos.
 *
 * Sin valores por defecto: viento, margen de corte y factor de combustible los aporta quien usa el motor. Sin viento,
 * solo se estima la zona de cabeza (±30°) y el resto queda «sin estimar».
 */
import { lengthToBreadth } from './fire4d.mjs';
import { tenPercentRule } from './fire-cases.mjs';

const R = 6371008.8, D = Math.PI / 180;
const xy = (o, p) => [(p.lon - o.lon) * D * Math.cos(o.lat * D) * R, (p.lat - o.lat) * D * R];
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
const FRONT_KINDS = new Set(['FRONT', 'CROSSED_ROAD', 'SPOT']);
export const REPORT_KINDS_FIRE = Object.freeze({ FRONT: 'el frente está aquí', CROSSED_ROAD: 'ha saltado/cruzado la carretera', SPOT: 'foco secundario (pavesas)', SMOKE: 'humo visto (no marca el frente)' });
export const REPORT_SOURCES = Object.freeze(['GUARDIA_CIVIL', 'POLICIA', 'BOMBEROS', 'UME', 'AGENTE_FORESTAL', 'CIUDADANO', 'SENSOR']);

/** ignition: { tS, lat, lon } · reports: [{ tS, lat, lon, kind, from, accM?, photoSha256?, road? }] */
export function fitFront(ignition, reports) {
  if (!ignition || !Number.isFinite(ignition.tS)) throw new Error('fitFront exige la ignición (hora y posición) declarada o el primer reporte');
  const pts = reports.filter((r) => FRONT_KINDS.has(r.kind) && r.tS > ignition.tS).map((r) => {
    const [x, y] = xy(ignition, r), d = Math.hypot(x, y);
    return { ...r, x, y, d, brg: ((Math.atan2(x, y) / D) + 360) % 360, tMin: (r.tS - ignition.tS) / 60 };
  }).filter((p) => p.d > 0);
  const smoke = reports.filter((r) => r.kind === 'SMOKE').length;
  if (!pts.length) return { ok: false, reason: 'ningún reporte de frente después de la ignición', smoke };
  let sx = 0, sy = 0; for (const p of pts) { sx += p.d * Math.sin(p.brg * D); sy += p.d * Math.cos(p.brg * D); }
  const dirToDeg = ((Math.atan2(sx, sy) / D) + 360) % 360;
  const head = pts.filter((p) => Math.abs(angDiff(p.brg, dirToDeg)) <= 45);
  const s = head.map((p) => ({ t: p.tMin, s: p.d * Math.cos(angDiff(p.brg, dirToDeg) * D) }));
  const stt = s.reduce((a, p) => a + p.t * p.t, 0), ros = s.reduce((a, p) => a + p.s * p.t, 0) / stt;
  const res = s.map((p) => p.s - ros * p.t), sdRes = s.length > 1 ? Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (s.length - 1)) : null;
  const byT = s.slice().sort((a, b) => a.t - b.t), last = byT.length >= 2 ? (byT.at(-1).s - byT.at(-2).s) / (byT.at(-1).t - byT.at(-2).t) : null;
  const trend = last == null || !(sdRes != null) ? 'SIN_DATOS' : last > ros * 1.25 ? 'ACELERA' : last < ros * 0.75 ? 'FRENA' : 'ESTABLE';
  return {
    ok: true, basis: 'MODEL_FITTED_TO_REPORTS', ignition, dirToDeg: +dirToDeg.toFixed(1), rosMMin: +ros.toFixed(2),
    rosSeMMin: sdRes == null ? null : +(sdRes / Math.sqrt(stt)).toFixed(2), lastRosMMin: last == null ? null : +last.toFixed(2), trend,
    used: head.length, reports: pts.length, smoke, crossedRoads: [...new Set(pts.filter((p) => p.kind === 'CROSSED_ROAD' && p.road).map((p) => p.road))],
    sources: [...new Set(pts.map((p) => p.from).filter(Boolean))],
  };
}

/** Contraste con la regla del 10 % (Cruz y Alexander 2019). windKmh = viento a 10 m MEDIDO o previsto (obligatorio). */
export function windCheck(fit, windKmh) {
  if (!Number.isFinite(windKmh)) throw new Error('windCheck exige el viento a 10 m (km/h)');
  const expected = (tenPercentRule(windKmh) * 1000) / 60, ratio = expected > 0 ? fit.rosMMin / expected : null;
  return { expectedMMin: +expected.toFixed(1), ratio: ratio == null ? null : +ratio.toFixed(2), verdict: ratio == null ? 'SIN_VIENTO' : ratio > 2 ? 'MAS_RAPIDO_QUE_LA_REGLA' : ratio < 0.5 ? 'MAS_LENTO_QUE_LA_REGLA' : 'COHERENTE', source: 'Cruz y Alexander (2019), Fire 2(2):19' };
}

/**
 * Hora (s) a la que el frente modelado llegaría a `p`. opts: { windKmh?, windObsKmh?, windNowKmh?, fuelFactor?(lat, lon) }.
 * windObsKmh/windNowKmh: si el viento cambia, la ROS se escala linealmente (supuesto de la regla del 10 %); ambos o ninguno.
 */
export function etaAt(fit, p, { windKmh = null, windObsKmh = null, windNowKmh = null, fuelFactor = null, samples = 12 } = {}) {
  const o = fit.ignition, [x, y] = xy(o, p), d = Math.hypot(x, y);
  if (d === 0) return { tS: o.tS, ok: true };
  const th = angDiff(((Math.atan2(x, y) / D) + 360) % 360, fit.dirToDeg) * D;
  let e;
  if (Number.isFinite(windKmh)) { const LB = lengthToBreadth(windKmh); e = Math.sqrt(1 - 1 / (LB * LB)); }
  else if (Math.abs(th) <= 30 * D) e = 0; else return { tS: null, ok: false, why: 'sin viento declarado: solo se estima la zona de cabeza (±30°)' };
  const scale = Number.isFinite(windObsKmh) && Number.isFinite(windNowKmh) && windObsKmh > 0 ? windNowKmh / windObsKmh : 1;
  const ros = fit.rosMMin * scale; if (!(ros > 0)) return { tS: null, ok: false, why: 'velocidad nula' };
  const head = ros * (1 - e) / (1 - e * Math.cos(th)); // m/min en esa dirección (elipse con foco en la ignición)
  let tMin = 0; const ds = d / samples;
  for (let k = 0; k < samples; k++) {
    const f = typeof fuelFactor === 'function' ? fuelFactor(o.lat + ((p.lat - o.lat) * (k + 0.5)) / samples, o.lon + ((p.lon - o.lon) * (k + 0.5)) / samples) : 1;
    if (!(f > 0)) return { tS: null, ok: false, why: 'sin combustible en el camino (cortafuegos, agua o roca declarados)' };
    tMin += ds / (head * f);
  }
  return { tS: o.tS + tMin * 60, ok: true, distM: Math.round(d) };
}

/** roads: [{ name, coords: [[lon, lat], …] }]. cutLeadMin (obligatorio): margen que fija el mando para proponer el corte. */
export function roadPlan(fit, roads, { nowS, cutLeadMin, stepM = 100, ...opts }) {
  if (!Number.isFinite(cutLeadMin) || !Number.isFinite(nowS)) throw new Error('roadPlan exige nowS y cutLeadMin (sin valores por defecto)');
  return roads.map((rd) => {
    if (fit.crossedRoads?.includes(rd.name)) return { name: rd.name, reached: true, observed: true, minutes: 0, cut: true, why: 'reportado: el fuego ya la ha cruzado' };
    let best = null;
    for (let i = 1; i < rd.coords.length; i++) {
      const [a, b] = [rd.coords[i - 1], rd.coords[i]], A = { lon: a[0], lat: a[1] }, B = { lon: b[0], lat: b[1] }, [bx, by] = xy(A, B), n = Math.max(1, Math.ceil(Math.hypot(bx, by) / stepM));
      for (let k = 0; k <= n; k++) {
        const q = { lon: A.lon + ((B.lon - A.lon) * k) / n, lat: A.lat + ((B.lat - A.lat) * k) / n }, r = etaAt(fit, q, opts);
        if (r.ok && (!best || r.tS < best.tS)) best = { tS: r.tS, at: [+q.lon.toFixed(6), +q.lat.toFixed(6)] };
      }
    }
    if (!best) return { name: rd.name, reached: false, minutes: null, cut: false, why: 'sin estimar (falta viento o combustible)' };
    const minutes = Math.round((best.tS - nowS) / 60);
    return { name: rd.name, reached: minutes <= 0, observed: false, minutes, at: best.at, cut: minutes <= cutLeadMin, why: minutes <= 0 ? 'el modelo dice que ya debería haber llegado: confirmar sobre el terreno' : `llegada estimada en ${minutes} min` };
  }).sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
}
