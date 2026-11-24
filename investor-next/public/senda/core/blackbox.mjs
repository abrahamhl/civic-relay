/**
 * SENDA Drive · caja negra del viaje (100 % en el móvil; el archivo solo sale si tú lo compartes).
 *
 * Registro en JSON Lines (una fila por evento) con lo que la app vio y decidió: posición GPS y su precisión,
 * velocidad, rumbo, acelerómetro/giroscopio, rendimiento del detector, alertas de cámara y de corredor,
 * red, batería y Bluetooth. Sirve para comprobar después, fila a fila y con el vídeo de pantalla al lado,
 * si SENDA reaccionó bien.
 *
 * Veracidad: el resumen solo cuenta lo que hay en el archivo (medido). No calcula «aciertos»: para eso
 * hace falta comparar con lo que pasó de verdad (vídeo), que se revisa a mano.
 * Privacidad: contiene tu recorrido GPS. No incluye imágenes de la cámara ni datos de otras personas.
 */
import { haversineM } from './route-planner.mjs';

export const SCHEMA = 'senda-blackbox/v1';
export const KINDS = Object.freeze(['gps', 'imu', 'det', 'alert', 'corridor', 'net', 'bat', 'ble', 'nav', 'note']);
export const LIMITS = Object.freeze({ maxRows: 200_000, gpsGapS: 3, imuHz: 10 }); // reglas de la app (tamaño y cadencia)

/** Crea una caja negra. `now` en ms (inyectable para pruebas). */
export function createBlackbox({ now = () => Date.now(), meta = {}, limits = LIMITS } = {}) {
  const t0 = now();
  const rows = [{ k: 'head', schema: SCHEMA, t0, iso: new Date(t0).toISOString(), ...meta }];
  let dropped = 0, lastImu = -Infinity;
  return {
    t0,
    get rows() { return rows; },
    get dropped() { return dropped; },
    /** Añade un evento. Devuelve false si se descarta (tipo desconocido, límite, o IMU por encima de la cadencia). */
    add(k, data = {}, t = now()) {
      if (!KINDS.includes(k)) return false;
      if (k === 'imu') { if (t - lastImu < 1000 / limits.imuHz) return false; lastImu = t; }
      if (rows.length >= limits.maxRows) { dropped++; return false; }
      rows.push({ k, t: Math.round(t - t0), ...data });
      return true;
    },
    toJsonl() { return rows.map((r) => JSON.stringify(r)).join('\n') + '\n'; },
    summary() { return summarize(rows); },
  };
}

/** Lee un archivo JSONL de caja negra (texto). Las líneas rotas se cuentan, no se inventan. */
export function parseJsonl(text) {
  const rows = []; let bad = 0;
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { bad++; }
  }
  if (!rows.length || rows[0].k !== 'head' || rows[0].schema !== SCHEMA) throw new Error('no es una caja negra SENDA (senda-blackbox/v1)');
  return { rows, bad };
}

const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** Resumen medido del viaje (todo sale de las filas; nada estimado fuera de ellas). */
export function summarize(rows) {
  const by = (k) => rows.filter((r) => r.k === k);
  const gps = by('gps'), imu = by('imu'), det = by('det'), alerts = by('alert'), corr = by('corridor');
  const tEnd = rows.reduce((m, r) => Math.max(m, r.t ?? 0), 0);
  const durS = tEnd / 1000, min = durS / 60;

  let distM = 0; const gaps = [];
  for (let i = 1; i < gps.length; i++) {
    const a = gps[i - 1], b = gps[i];
    if (a.lat != null && b.lat != null && (a.acc ?? 0) <= 50 && (b.acc ?? 0) <= 50) distM += haversineM([a.lon, a.lat], [b.lon, b.lat]);
    const dt = (b.t - a.t) / 1000; if (dt > LIMITS.gpsGapS) gaps.push({ atS: r1(a.t / 1000), s: r1(dt) });
  }
  const speeds = gps.map((g) => g.v).filter((v) => v != null);
  const accs = gps.map((g) => g.acc).filter((v) => v != null);
  const lat = det.map((d) => d.ms).filter((v) => v != null);
  const amag = imu.map((m) => m.a).filter((v) => v != null);

  const levels = { ROJO: 0, AMBAR: 0 };
  for (const a of alerts) if (levels[a.level] != null) levels[a.level]++;
  const corrLevels = {};
  for (const c of corr) corrLevels[c.urgency ?? 'SIN_NIVEL'] = (corrLevels[c.urgency ?? 'SIN_NIVEL'] ?? 0) + 1;

  return {
    basis: 'MEDIDO_EN_ESTE_ARCHIVO',
    durationS: r1(durS),
    rows: rows.length,
    gps: { fixes: gps.length, distanceKm: r1(distM / 1000), maxKmh: speeds.length ? r1(Math.max(...speeds) * 3.6) : null, accP50M: r1(pct(accs, 0.5)), accP95M: r1(pct(accs, 0.95)), gapsOver3s: gaps.length, worstGaps: gaps.sort((a, b) => b.s - a.s).slice(0, 5) },
    detector: { frames: det.length, hz: det.length > 1 && det.at(-1).t > det[0].t ? r1((det.length - 1) / ((det.at(-1).t - det[0].t) / 1000)) : null, activeS: det.length > 1 ? r1((det.at(-1).t - det[0].t) / 1000) : 0, msMean: r1(mean(lat)), msP95: r1(pct(lat, 0.95)), backends: [...new Set(det.map((d) => d.be).filter(Boolean))] },
    alerts: { rojo: levels.ROJO, ambar: levels.AMBAR, perMin: min ? r1((levels.ROJO + levels.AMBAR) / min) : null, list: alerts.slice(0, 50).map((a) => ({ atS: r1(a.t / 1000), level: a.level, what: a.label, zone: a.zone, ttcS: a.ttcS ?? null })) },
    corridor: { events: corr.length, byUrgency: corrLevels },
    imu: { samples: imu.length, maxAccelMs2: amag.length ? r1(Math.max(...amag)) : null },
    net: by('net').at(-1) ?? null,
    battery: (() => { const b = by('bat').filter((x) => x.level != null); return b.length ? { startPct: Math.round(b[0].level * 100), endPct: Math.round(b.at(-1).level * 100), charging: b.at(-1).charging ?? null } : null; })(),
    ble: by('ble').length,
    notes: by('note').map((n) => ({ atS: r1(n.t / 1000), text: n.text })),
  };
}
