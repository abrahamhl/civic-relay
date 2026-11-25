/**
 * SENDA · conectores de datos: cómo un organismo enchufa SUS redes y sensores (aforos, pluviómetros, umbrales)
 * a los simuladores y al motor de prevención, con validación estricta y procedencia.
 *
 * Principios:
 *  - El dato importado se marca MEDIDO (IMPORTADO) con su fuente, licencia, quién lo aporta y su huella SHA-256.
 *  - Sin zona horaria explícita NO se acepta una hora (una hora ambigua puede mover una alerta 1–2 h).
 *  - Unidades fijas por tipo; valores imposibles (negativos, NaN) se rechazan con su línea.
 *  - El dato se queda en el dispositivo: importar no lo envía a ningún servidor.
 */

/** Tipos de serie admitidos (unidad fija). */
export const SERIES_KINDS = Object.freeze({
  caudal: { unit: 'm³/s', label: 'Caudal en un aforo', min: 0 },
  lluvia: { unit: 'mm', label: 'Lluvia acumulada en el intervalo', min: 0, needsInterval: true },
  nivel: { unit: 'm', label: 'Nivel de agua en una estación', min: -50 },
});

/**
 * Catálogo de redes que se pueden conectar. Estado = lo que hay HOY en SENDA, no una promesa.
 * conectado · importable (por fichero) · requiere_clave · requiere_convenio
 */
export const CONNECTORS = Object.freeze([
  { id: 'fichero', label: 'Fichero del organismo (CSV o JSON)', kinds: ['caudal', 'lluvia', 'nivel'], status: 'importable', note: 'Cualquier aforo, pluviómetro o sensor propio, con hora y zona horaria.' },
  { id: 'cems', label: 'Copernicus EMS (cartografía de emergencias)', kinds: ['mancha'], status: 'conectado', note: 'Activaciones descargadas con su huella (p. ej. EMSR773).' },
  { id: 'sentinel2', label: 'Copernicus Sentinel-2', kinds: ['imagen'], status: 'conectado', note: 'Escenas procesadas para cicatrices y combustible.' },
  { id: 'nasa_gibs', label: 'NASA GIBS (imágenes diarias)', kinds: ['imagen'], status: 'conectado', note: 'Fondos de mapa por fecha, en todo el mundo.' },
  { id: 'aemet', label: 'AEMET OpenData (estaciones y avisos)', kinds: ['lluvia'], status: 'requiere_clave', note: 'Clave gratuita; se guarda en el entorno, nunca en el código.' },
  { id: 'saih', label: 'SAIH de las confederaciones hidrográficas', kinds: ['caudal', 'lluvia', 'nivel'], status: 'requiere_convenio', note: 'La web pública rechaza el acceso automático: hace falta convenio o descarga del organismo.' },
  { id: 'dgt30', label: 'DGT 3.0 (tráfico conectado)', kinds: ['incidencia'], status: 'requiere_convenio', note: 'Solicitud en borrador (docs/fundador).' },
  { id: 'malla_senda', label: 'Malla SENDA (móviles y sensores en campo)', kinds: ['caudal', 'nivel', 'incidencia'], status: 'importable', note: 'Avisos firmados y caja negra; se exportan y se importan como fichero.' },
]);

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Separa una línea CSV con comillas dobles. */
function splitCsv(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out.map((s) => s.trim());
}

/**
 * Lee una serie de un CSV («hora,valor» con cabecera; separador , o ;; decimales con punto o coma si el
 * separador es ;) o de un JSON ([{hora, valor}] o {serie:[...]}).
 * Devuelve { ok, kind, unit, points:[{tMs, iso, value}], errors:[{line, msg}], meta }.
 */
export function parseSeries(text, { kind, station = null, source = null } = {}) {
  const K = SERIES_KINDS[kind]; const errors = [], points = [];
  if (!K) return { ok: false, errors: [{ line: 0, msg: `tipo desconocido: ${kind}` }], points };
  if (!source?.name) errors.push({ line: 0, msg: 'falta la fuente (quién mide y aporta el dato)' });
  let rows = [];
  const t = String(text).replace(/^﻿/, '').trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    try { const j = JSON.parse(t); rows = (Array.isArray(j) ? j : j.serie ?? []).map((r, i) => ({ line: i + 1, hora: r.hora ?? r.time, valor: r.valor ?? r.value })); }
    catch (e) { errors.push({ line: 0, msg: `JSON no válido: ${e.message}` }); }
  } else {
    const lines = t.split(/\r?\n/).filter((l) => l.trim()); const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const head = splitCsv(lines[0], sep).map((h) => h.toLowerCase());
    const ih = head.findIndex((h) => /^(hora|time|fecha|datetime)/.test(h)), iv = head.findIndex((h) => /^(valor|value|q|caudal|lluvia|nivel)/.test(h));
    if (ih < 0 || iv < 0) errors.push({ line: 1, msg: 'la cabecera debe tener una columna «hora» y otra «valor»' });
    else for (let i = 1; i < lines.length; i++) { const c = splitCsv(lines[i], sep); rows.push({ line: i + 1, hora: c[ih], valor: sep === ';' ? c[iv]?.replace(',', '.') : c[iv] }); }
  }
  let prev = -Infinity;
  for (const r of rows) {
    if (!ISO_TZ.test(String(r.hora ?? ''))) { errors.push({ line: r.line, msg: `hora sin zona horaria o mal escrita: «${r.hora}» (use p. ej. 2024-10-29T18:55+01:00)` }); continue; }
    const tMs = Date.parse(r.hora), v = Number(r.valor);
    if (!Number.isFinite(tMs)) { errors.push({ line: r.line, msg: `hora imposible: «${r.hora}»` }); continue; }
    if (!Number.isFinite(v) || v < K.min) { errors.push({ line: r.line, msg: `valor no válido: «${r.valor}» ${K.unit}` }); continue; }
    if (tMs <= prev) { errors.push({ line: r.line, msg: 'las horas deben ir en orden creciente y sin repetirse' }); continue; }
    prev = tMs; points.push({ tMs, iso: new Date(tMs).toISOString(), value: v });
  }
  if (!points.length && !errors.length) errors.push({ line: 0, msg: 'el fichero no tiene datos' });
  return { ok: errors.length === 0 && points.length > 0, kind, unit: K.unit, points, errors, meta: { basis: 'MEDIDO_IMPORTADO', station, source } };
}

/** Huella SHA-256 (hex) del texto importado, para la procedencia. Usa WebCrypto (navegador y Node ≥ 19). */
export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Último valor de una serie en o antes de tMs (null si no hay). */
export function valueAt(series, tMs) {
  let best = null; for (const p of series.points) { if (p.tMs <= tMs) best = p; else break; }
  return best;
}
