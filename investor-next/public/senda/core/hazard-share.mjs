/**
 * Compartir avisos de carretera entre móviles SENDA (Bluetooth cercano o paquete), sin servidor.
 * Paquete = [0xA5, versión 1, nº de avisos] + N tramas de 24 bytes (`encodeHazard` de road-guard).
 * Las tramas NO van firmadas: lo recibido se marca «de otro móvil, sin verificar» (la verificación con cámara
 * de hazard-verify.mjs puede confirmarlo después). Reglas de la app (declaradas, no calibradas): se comparten
 * los avisos de las últimas 6 h; dos avisos son el mismo si coinciden en tipo, distan < 50 m y < 10 min.
 */
import { encodeHazard, decodeHazard, HAZARD_BYTES, REPORT_KINDS } from './road-guard.mjs';
import { haversineM } from './route-planner.mjs';

export const MAGIC = 0xa5;
export const SHARE_RULES = Object.freeze({ maxAgeMs: 6 * 3600_000, sameM: 50, sameMs: 10 * 60_000, maxReports: 200 });

/** Tipo de trama → aviso de SENDA (el primero que use ese tipo; «parado» y «arcén» comparten tipo). */
const KIND_OF_TYPE = Object.entries(REPORT_KINDS).reduce((m, [k, v]) => (m[v.type] ??= k, m), {});

export function packReports(reports, { now = Date.now(), rules = SHARE_RULES, rnd = () => Math.floor(Math.random() * 2 ** 32) } = {}) {
  const fresh = reports.filter((r) => REPORT_KINDS[r.kind] && now - r.t <= rules.maxAgeMs && now - r.t >= -60_000).slice(-rules.maxReports);
  const out = new Uint8Array(3 + fresh.length * HAZARD_BYTES);
  out[0] = MAGIC; out[1] = 1; out[2] = fresh.length;
  fresh.forEach((r, i) => out.set(encodeHazard({ type: REPORT_KINDS[r.kind].type, t: Math.floor(r.t / 1000), lat: r.lat, lon: r.lon, hops: Math.min(15, (r.hops ?? 0) + 1), id: r.id ?? rnd() }), 3 + i * HAZARD_BYTES));
  return out;
}

export const isReportPack = (bytes) => bytes instanceof Uint8Array && bytes.length >= 3 && bytes[0] === MAGIC;

/** Devuelve { reports, rejected } — las tramas corruptas o de tipo desconocido se descartan, nunca se aceptan. */
export function unpackReports(bytes, { from = 'BLUETOOTH' } = {}) {
  if (!isReportPack(bytes)) throw new Error('no es un paquete de avisos SENDA');
  if (bytes[1] !== 1) throw new Error(`versión ${bytes[1]} desconocida`);
  const n = bytes[2];
  if (bytes.length !== 3 + n * HAZARD_BYTES) throw new Error('paquete de avisos con tamaño incorrecto');
  const reports = []; let rejected = 0;
  for (let i = 0; i < n; i++) {
    try {
      const h = decodeHazard(bytes.slice(3 + i * HAZARD_BYTES, 3 + (i + 1) * HAZARD_BYTES));
      const kind = KIND_OF_TYPE[h.type];
      if (!kind) { rejected++; continue; }
      reports.push({ kind, lat: h.lat, lon: h.lon, t: h.t * 1000, id: h.id, hops: h.hops, own: false, from, verified: null });
    } catch { rejected++; }
  }
  return { reports, rejected };
}

/** Une avisos sin duplicar (mismo tipo, cerca y a la vez). Conserva los propios frente a los recibidos. */
export function mergeReports(existing, incoming, rules = SHARE_RULES) {
  const out = [...existing]; let added = 0;
  for (const r of incoming) {
    const dup = out.some((e) => e.kind === r.kind && Math.abs(e.t - r.t) < rules.sameMs && haversineM([e.lon, e.lat], [r.lon, r.lat]) < rules.sameM);
    if (!dup) { out.push(r); added++; }
  }
  return { reports: out, added };
}
