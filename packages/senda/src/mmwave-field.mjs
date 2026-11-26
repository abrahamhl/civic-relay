// @ts-check
/**
 * SENDA · paquete de práctica de campo del radar de personas (RD-03D / LD2450).
 *
 * Una sesión de campo produce UN archivo JSON autocontenido que el fundador guarda en el móvil y envía para análisis:
 * bytes crudos con tiempo (reproducibles bit a bit), trazas del seguimiento, marcas de evento («entra persona», «perro»),
 * pares de calibración con cinta métrica, ajustes usados y huellas SHA-256 de cada parte y del conjunto.
 * Nada se inventa: la base (`basis`) dice si los bytes vienen del sensor (MEASURED), de una grabación (RECORDING)
 * o de la simulación (SIMULATION). Sin datos personales: no se guarda nombre, cuenta ni identificador del aparato;
 * la posición solo si quien graba la escribe.
 */
import { createFrameParser, cleanTargets, createTracker, calibrateRange } from './mmwave-radar.mjs';

export const FIELD_FORMAT = 'senda-mmwave-field/1';
const BASES = new Set(['MEASURED', 'RECORDING', 'SIMULATION']);

/** SHA-256 hexadecimal de un texto (WebCrypto: navegador, WebView y Node ≥ 20). */
export async function sha256Text(text) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PARTS = ['raw', 'tracks', 'marks', 'calibration', 'settings', 'session'];

/**
 * Construye el paquete. input: { session: { basis, startedAtUtc, endedAtUtc, timeZone, scenario, notes, source, app, pose? },
 * raw: [{ tMs, b64 }], tracks: [...], marks: [{ tMs, label }], calibration: { rangePairs, yawPairs }, settings: {...} }
 */
export async function buildFieldPackage(input) {
  const s = input?.session;
  if (!s || !BASES.has(s.basis)) throw new Error('session.basis debe ser MEASURED, RECORDING o SIMULATION');
  if (!/Z$|[+-]\d\d:\d\d$/.test(s.startedAtUtc ?? '')) throw new Error('session.startedAtUtc necesita zona horaria (ISO con Z u ±HH:MM)');
  if (!s.timeZone) throw new Error('session.timeZone obligatoria (p. ej. Europe/Madrid)');
  const pkg = { format: FIELD_FORMAT };
  for (const k of PARTS) pkg[k] = input[k] ?? (k === 'raw' || k === 'tracks' || k === 'marks' ? [] : {});
  const hashes = {};
  for (const k of PARTS) hashes[k] = await sha256Text(JSON.stringify(pkg[k]));
  pkg.hashes = hashes;
  pkg.sha256 = await sha256Text(JSON.stringify(PARTS.map((k) => hashes[k])));
  return pkg;
}

/** Comprueba formato y huellas. Devuelve { ok, errors }. */
export async function verifyFieldPackage(pkg) {
  const errors = [];
  if (pkg?.format !== FIELD_FORMAT) errors.push(`formato desconocido: ${pkg?.format}`);
  if (!BASES.has(pkg?.session?.basis)) errors.push('basis ausente o no válida');
  for (const k of PARTS) {
    const h = await sha256Text(JSON.stringify(pkg?.[k] ?? null));
    if (pkg?.hashes?.[k] !== h) errors.push(`huella de «${k}» no coincide: el archivo se ha modificado`);
  }
  if (pkg?.hashes && pkg.sha256 !== (await sha256Text(JSON.stringify(PARTS.map((k) => pkg.hashes[k]))))) errors.push('huella global no coincide');
  return { ok: errors.length === 0, errors };
}

/**
 * Análisis reproducible: vuelve a pasar los bytes crudos por el lector, la limpieza y el seguimiento con los ajustes
 * guardados en el paquete, y resume lo medido. No añade cifras externas.
 */
export function summarizeFieldPackage(pkg) {
  const st = pkg.settings ?? {};
  const frames = [];
  const parser = createFrameParser((t) => frames.push(t));
  const times = [];
  for (const r of pkg.raw ?? []) { const before = frames.length; parser.push(Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0))); for (let i = before; i < frames.length; i++) times.push(r.tMs); }
  const durS = times.length > 1 ? (times[times.length - 1] - times[0]) / 1000 : 0;
  let tracker = null, maxSimul = 0; const ids = new Set(); let detections = 0;
  const canTrack = ['minMm', 'maxMm', 'mergeMm', 'gateMm', 'qMmS2', 'rMm', 'maxMissS'].every((k) => Number(st[k]) > 0 || (k === 'minMm' && Number(st[k]) >= 0));
  if (canTrack) tracker = createTracker(st);
  frames.forEach((f, i) => {
    const d = canTrack ? cleanTargets(f, st) : f; detections += d.length;
    if (tracker) { const tr = tracker.step(d, times[i] / 1000); const live = tr.filter((x) => !x.coasting); maxSimul = Math.max(maxSimul, live.length); live.forEach((x) => ids.add(x.id)); }
  });
  const rp = pkg.calibration?.rangePairs ?? [];
  let range = null; try { if (rp.length >= 2) range = calibrateRange(rp); } catch (e) { range = { error: String(e.message) }; }
  return {
    basis: pkg.session?.basis, scenario: pkg.session?.scenario ?? null,
    frames: frames.length, corruptFrames: parser.stats().bad, durationS: +durS.toFixed(2),
    frameRateHz: durS > 0 ? +((frames.length - 1) / durS).toFixed(2) : null,
    meanTargetsPerFrame: frames.length ? +(detections / frames.length).toFixed(3) : 0,
    tracksStarted: tracker ? ids.size : null, maxSimultaneousTracks: tracker ? maxSimul : null,
    marks: (pkg.marks ?? []).length, rangeCalibration: range,
  };
}
