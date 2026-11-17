/**
 * SENDA · Avisos ciudadanos: ver, medir y reportar un peligro sin colapsar el 112.
 *
 * Un vecino ve que el río sube. Hoy llama al 112 (sin foto, sin posición precisa, sin medida) y con él
 * llaman otros cuarenta por lo mismo. Aquí:
 *  1. MIDE: toca en la foto la línea del agua y dos marcas de altura conocida del puente o del muro
 *     (o una regla de aforo); con varias fotos en el tiempo sale la VELOCIDAD DE SUBIDA en cm/min.
 *     Es geometría reproducible, no una IA opaca. La foto se queda en el móvil salvo que el usuario la
 *     comparta.
 *  2. AGRUPA: los reportes del mismo sitio y momento forman UN incidente (40 reportes → 1 incidente).
 *  3. CONTRASTA: personas independientes (con reputación aprendida), medidas, sensores cercanos y
 *     fuentes oficiales (aforos SAIH, avisos AEMET/Meteoalarm, CAP) suman evidencia con razones de
 *     verosimilitud declaradas.
 *  4. ESCALA: RUMOR → CORROBORADO → RECONOCIMIENTO (se piden datos a cámaras públicas, sensores y
 *     móviles SENDA de la zona antes de cualquier aviso) → OFICIAL. Un aviso a la población SOLO sale
 *     cuando un organismo oficial lo confirma: SENDA prepara, el organismo decide.
 *  5. PRIORIZA para el 112: un incidente por suceso, ordenado por gravedad, personas en riesgo y
 *     certeza. Nunca se disuade de llamar al 112 cuando hay riesgo para la vida.
 */

import { toCap } from './interop.mjs';

const R_EARTH = 6_371_000;
export function distanceM(a, b) {
  const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Tipos de reporte: familia (para agrupar), gravedad base (0–1) y si implica riesgo para la vida. */
export const HAZARD_KINDS = Object.freeze({
  RIVER_RISING: { family: 'WATER', severity: 0.5, label: 'El río sube' },
  STREET_FLOODED: { family: 'WATER', severity: 0.6, label: 'Calle inundada' },
  CAR_SWEPT: { family: 'WATER', severity: 0.95, life: true, label: 'Coche arrastrado / persona en el agua' },
  SMOKE: { family: 'FIRE', severity: 0.4, label: 'Humo' },
  FIRE: { family: 'FIRE', severity: 0.7, label: 'Fuego visible' },
  FIRE_NEAR_HOMES: { family: 'FIRE', severity: 0.9, life: true, label: 'Fuego junto a casas' },
  ROAD_BLOCKED: { family: 'ROAD', severity: 0.3, label: 'Carretera cortada' },
  POWER_LINE_DOWN: { family: 'ROAD', severity: 0.6, label: 'Cable eléctrico caído' },
  COLLAPSE: { family: 'STRUCTURE', severity: 0.9, life: true, label: 'Derrumbe' },
  PERSON_TRAPPED: { family: 'STRUCTURE', severity: 1, life: true, label: 'Persona atrapada' },
});

/* ───────────── 1. Medida del nivel del agua en una foto ───────────── */

/**
 * Nivel del agua (m) por interpolación lineal entre dos marcas de altura conocida en un objeto vertical
 * (pilar, muro, regla de aforo) del mismo plano que la línea de agua. Filas en píxeles (0 = arriba).
 */
export function levelFromTaps({ refTop, refBottom, waterRow }) {
  if (refTop.row >= refBottom.row) throw new RangeError('la marca superior ha de estar más arriba en la imagen');
  if (refTop.heightM <= refBottom.heightM) throw new RangeError('la marca superior ha de ser más alta');
  const mPerPx = (refTop.heightM - refBottom.heightM) / (refBottom.row - refTop.row);
  return +(refBottom.heightM + (refBottom.row - waterRow) * mPerPx).toFixed(3);
}

/** Velocidad de subida (cm/min) por mínimos cuadrados sobre [{at(ms), levelM}], con su error típico. */
export function riseRate(series) {
  if (series.length < 2) return null;
  const xs = series.map((s) => s.at / 60_000), ys = series.map((s) => s.levelM * 100), n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (sxx === 0) return null;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const res = ys.map((y, i) => y - (my + slope * (xs[i] - mx))), se = n > 2 ? Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (n - 2) / sxx) : null;
  return { cmPerMin: +slope.toFixed(3), stdErr: se === null ? null : +se.toFixed(3), points: n };
}

/* ───────────── 2. Agrupar reportes en incidentes ───────────── */

export function clusterReports(reports, { radiusM = 400, windowMin = 60 } = {}) {
  const sorted = [...reports].sort((a, b) => a.at - b.at), out = [];
  for (const r of sorted) {
    const fam = HAZARD_KINDS[r.kind]?.family; if (!fam) throw new Error(`tipo desconocido: ${r.kind}`);
    const c = out.find((x) => x.family === fam && distanceM(x.center, r) <= radiusM && r.at - x.lastAt <= windowMin * 60_000);
    if (c) { c.reports.push(r); c.lastAt = r.at; const k = c.reports.length; c.center = { lat: c.center.lat + (r.lat - c.center.lat) / k, lon: c.center.lon + (r.lon - c.center.lon) / k }; }
    else out.push({ id: `INC-${out.length + 1}`, family: fam, center: { lat: r.lat, lon: r.lon }, firstAt: r.at, lastAt: r.at, reports: [r] });
  }
  return out;
}

/* ───────────── 3. Contrastar y 4. escalar ───────────── */

/** Razones de verosimilitud declaradas (HIPÓTESIS a calibrar con incidentes reales). */
export const EVIDENCE_LR = Object.freeze({
  REPORTER: 3, // una persona independiente con reputación neutra
  MEASUREMENT_RISING: 4, // medida de subida > 0,5 cm/min con error pequeño
  SENSOR_AGREES: 6, // un sensor (aforo, Vigía, estación) cuadra
  OFFICIAL: 50, // una fuente oficial lo confirma
  OFFICIAL_CONTRADICTS: 0.1, // un aforo oficial cercano NO sube
});
const PRIOR = { WATER: 0.1, FIRE: 0.15, ROAD: 0.2, STRUCTURE: 0.1 };

/**
 * @param {object} inc  incidente de clusterReports
 * @param {{reputation?:Record<string,{good:number,bad:number}>, official?:Array, sensors?:Array, nearM?:number}} ctx
 */
export function assessIncident(inc, { reputation = {}, official = [], sensors = [], nearM = 3000 } = {}) {
  let logOdds = Math.log(PRIOR[inc.family] / (1 - PRIOR[inc.family])); const why = [];
  const devices = new Map(); for (const r of inc.reports) if (!devices.has(r.deviceId)) devices.set(r.deviceId, r);
  for (const [d] of devices) {
    const rep = reputation[d] ?? { good: 0, bad: 0 }, trust = (rep.good + 1) / (rep.good + rep.bad + 2); // Beta(1,1)
    const lr = 1 + (EVIDENCE_LR.REPORTER - 1) * 2 * trust; // reputación neutra (0,5) → LR 3; mala → ~1
    logOdds += Math.log(lr);
  }
  why.push(`${devices.size} persona(s) distinta(s) (${inc.reports.length} reportes)`);
  const rates = inc.reports.map((r) => r.measurement?.rise).filter(Boolean);
  if (rates.some((x) => x.cmPerMin > 0.5 && (x.stdErr ?? 1) < x.cmPerMin / 2)) { logOdds += Math.log(EVIDENCE_LR.MEASUREMENT_RISING); why.push('medida de subida coherente'); }
  for (const s of sensors.filter((s) => s.family === inc.family && distanceM(s, inc.center) <= nearM)) {
    if (s.agrees) { logOdds += Math.log(EVIDENCE_LR.SENSOR_AGREES); why.push(`sensor ${s.id} cuadra`); }
    else if (s.official) { logOdds += Math.log(EVIDENCE_LR.OFFICIAL_CONTRADICTS); why.push(`aforo oficial ${s.id} no sube`); }
  }
  const off = official.find((o) => o.family === inc.family && distanceM(o, inc.center) <= nearM && o.at >= inc.firstAt - 6 * 3600_000);
  if (off) { logOdds += Math.log(EVIDENCE_LR.OFFICIAL); why.push(`confirmado por ${off.source}`); }
  const p = 1 / (1 + Math.exp(-logOdds));
  const sev = Math.max(...inc.reports.map((r) => HAZARD_KINDS[r.kind].severity));
  const life = inc.reports.some((r) => HAZARD_KINDS[r.kind].life || (r.people?.trapped ?? 0) > 0);
  const state = off ? 'OFFICIAL' : p >= 0.8 && (sev >= 0.6 || life) ? 'RECON' : p >= 0.8 || devices.size >= 3 ? 'CORROBORATED' : 'RUMOR';
  return { basis: 'MODEL_UNCALIBRATED_LR', id: inc.id, family: inc.family, pReal: +p.toFixed(3), state, severity: sev, lifeRisk: life, reporters: devices.size, reports: inc.reports.length, why,
    canPublicWarn: Boolean(off), // regla dura: sin organismo oficial no hay aviso a la población
    official: off ? { source: off.source, ref: off.ref ?? null } : null };
}

/**
 * Zona de reconocimiento previa a la emergencia: qué cámaras públicas, sensores y móviles SENDA de la zona
 * aportan datos y qué se les pide. No avisa a nadie; recoge información para quien decide.
 */
export function reconZone(incident, center, { cameras = [], sensors = [], phones = [], radiusM = 2000 } = {}) {
  const near = (x) => distanceM(center, x) <= radiusM;
  return { incident: incident.id, radiusM,
    cameras: cameras.filter(near).map((c) => ({ id: c.id, source: c.source, ask: 'captura actual y visibilidad (sin personas)' })),
    sensors: sensors.filter(near).map((s) => ({ id: s.id, ask: s.family === 'WATER' ? 'nivel y tendencia de la última hora' : 'lectura y tendencia' })),
    phones: phones.filter((p) => near(p) && p.consent).map((p) => ({ id: p.id, ask: incident.family === 'WATER' ? '¿ves agua en tu calle? Mide el nivel si puedes hacerlo seguro' : '¿ves humo o fuego? Indica la dirección' })) };
}

/* ───────────── 5. Cola para el 112 ───────────── */

/** Puntuación de prioridad y cola deduplicada. Cada incidente indica cuántos reportes agrupa. */
export function triageQueue(assessed, clusters) {
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const scored = assessed.map((a) => {
    const c = byId.get(a.id), trapped = Math.max(0, ...c.reports.map((r) => r.people?.trapped ?? 0)), injured = Math.max(0, ...c.reports.map((r) => r.people?.injured ?? 0));
    const score = a.severity * (1 + 10 * trapped + 5 * injured) * (0.3 + 0.7 * a.pReal) * (a.lifeRisk ? 2 : 1);
    return { ...a, trapped, injured, score: +score.toFixed(3) };
  }).sort((x, y) => y.score - x.score);
  const totalReports = scored.reduce((s, x) => s + x.reports, 0);
  return { queue: scored, totalReports, incidents: scored.length, deduplicated: totalReports - scored.length };
}

/** Lo que ve quien reporta. Si hay riesgo para la vida, SIEMPRE se le dice que llame al 112. */
export function citizenAdvice(kind, assessed) {
  const k = HAZARD_KINDS[kind];
  if (k.life) return { call112: true, text: 'Hay riesgo para la vida: llama al 112 ahora. Dile tu posición; tu reporte queda guardado en SENDA (la conexión directa con la sala 112 necesita un convenio con el organismo).' };
  if (assessed?.state === 'OFFICIAL') return { call112: false, text: `El organismo ya lo gestiona (${assessed.official.source}). Llama al 112 si cambia o hay personas en peligro.` };
  if (assessed && assessed.reporters >= 3) return { call112: false, text: `Ya lo han reportado ${assessed.reporters} personas en SENDA y está agrupado como un solo incidente. Llama al 112 si ves personas en peligro.` };
  return { call112: false, text: 'Reporte enviado. Si ves personas en peligro, llama al 112.' };
}

/* ───────────── 6. Reporte compacto y firmado para viajar por cualquier vía ─────────────
 * 20 B de datos + 32 B de clave pública Ed25519 + 64 B de firma = 116 B → una línea «SND3 …» de exactamente
 * 160 caracteres (un SMS o un mensaje de mensajero satelital). Ed25519 comprobado en Node 22 y en el Chromium de las pruebas; versiones mínimas de cada navegador: no verificadas. Sin nombre ni teléfono: el autor es la huella de una clave
 * de reportes del propio móvil (seudónimo), lo justo para contar personas distintas y aprender
 * reputación, y para que nadie pueda fabricar reportes en nombre de otro móvil.
 * Formato: ver(1) tipo(1) lat·1e5(4) lon·1e5(4) minutos desde 2020(4) atrapados(1) heridos(1)
 *          subida cm/min·100 (int16, 0x7fff = sin medida)(2) error·100 (uint16)(2) | clave pública (32) | firma (64)
 */
const KIND_IDS = Object.keys(HAZARD_KINDS);
const EPOCH_MIN = Date.UTC(2020, 0, 1) / 60_000;
const sub = globalThis.crypto.subtle;
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export async function createReporterKeys() {
  const k = await sub.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { privateKey: k.privateKey, publicRaw: new Uint8Array(await sub.exportKey('raw', k.publicKey)) };
}

function packBody(r) {
  const b = new Uint8Array(20), v = new DataView(b.buffer);
  const kid = KIND_IDS.indexOf(r.kind); if (kid < 0) throw new Error(`tipo desconocido: ${r.kind}`);
  b[0] = 1; b[1] = kid; v.setInt32(2, Math.round(r.lat * 1e5)); v.setInt32(6, Math.round(r.lon * 1e5));
  v.setUint32(10, Math.round(r.at / 60_000 - EPOCH_MIN)); b[14] = Math.min(255, r.people?.trapped ?? 0); b[15] = Math.min(255, r.people?.injured ?? 0);
  const rise = r.measurement?.rise; v.setInt16(16, rise ? Math.max(-32767, Math.min(32766, Math.round(rise.cmPerMin * 100))) : 0x7fff); v.setUint16(18, rise?.stdErr != null ? Math.min(65535, Math.round(rise.stdErr * 100)) : 65535);
  return b;
}

/** Línea de texto firmada lista para cualquier vía. */
export async function encodeReport(r, keys) {
  const body = packBody(r), sig = new Uint8Array(await sub.sign({ name: 'Ed25519' }, keys.privateKey, body));
  const out = new Uint8Array(body.length + 32 + 64); out.set(body); out.set(keys.publicRaw, body.length); out.set(sig, body.length + 32);
  return 'SND3 ' + b64u(out);
}

/** Lee y verifica todas las líneas SND3 de un texto. Devuelve reportes válidos y cuántas se rechazaron. */
export async function decodeReports(text) {
  const ok = [], rejected = [];
  for (const m of String(text).matchAll(/SND3 ([A-Za-z0-9_-]+)/g)) {
    try {
      const u = unb64u(m[1]); if (u.length !== 116 || u[0] !== 1) throw new Error('formato');
      const body = u.subarray(0, 20), pub = u.subarray(20, 52), sig = u.subarray(52);
      const key = await sub.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
      if (!(await sub.verify({ name: 'Ed25519' }, key, sig, body))) throw new Error('firma');
      const v = new DataView(body.buffer, body.byteOffset), riseRaw = v.getInt16(16), se = v.getUint16(18);
      const deviceId = 'k' + b64u(new Uint8Array(await sub.digest('SHA-256', pub)).subarray(0, 9));
      ok.push({ kind: KIND_IDS[body[1]], lat: v.getInt32(2) / 1e5, lon: v.getInt32(6) / 1e5, at: (v.getUint32(10) + EPOCH_MIN) * 60_000, people: { trapped: body[14], injured: body[15] },
        ...(riseRaw !== 0x7fff ? { measurement: { rise: { cmPerMin: riseRaw / 100, stdErr: se === 65535 ? null : se / 100 } } } : {}), deviceId, signed: true });
    } catch (e) { rejected.push(e.message); }
  }
  return { reports: ok, rejected };
}

/* ───────────── 7. Exportar un incidente a CAP 1.2 para la sala de emergencias ───────────── */
const FAMILY_CAP = { WATER: 'Met', FIRE: 'Fire', ROAD: 'Transport', STRUCTURE: 'Rescue' };
/**
 * CAP 1.2 con ámbito RESTRINGIDO (para el organismo, no para la población). Certeza según el estado:
 * OFFICIAL → Observed; RECON/CORROBORATED → Likely; RUMOR → Possible. Nunca sale como aviso público:
 * la difusión a la población la decide y la firma el organismo con sus propios sistemas.
 */
export function incidentToCap(assessed, cluster, { sender = 'senda@organismo.example', now, exercise = true } = {}) {
  if (!Number.isFinite(now)) throw new TypeError('now obligatorio');
  const certainty = assessed.state === 'OFFICIAL' ? 'Observed' : assessed.state === 'RUMOR' ? 'Possible' : 'Likely';
  const severity = assessed.lifeRisk ? 'Extreme' : assessed.severity >= 0.6 ? 'Severe' : 'Moderate';
  const rise = cluster.reports.map((r) => r.measurement?.rise?.cmPerMin).filter((x) => Number.isFinite(x));
  const kinds = [...new Set(cluster.reports.map((r) => HAZARD_KINDS[r.kind].label))];
  const radiusKm = Math.max(0.1, Math.max(...cluster.reports.map((r) => distanceM(cluster.center, r))) / 1000);
  return toCap({ identifier: `SENDA-REP-${assessed.id}-${cluster.firstAt}`, sender, sent: now, status: exercise ? 'Exercise' : 'Actual', msgType: 'Alert', scope: 'Restricted',
    info: { category: FAMILY_CAP[cluster.family] ?? 'Other', event: `Reportes ciudadanos: ${kinds.join(', ')}`, urgency: assessed.lifeRisk ? 'Immediate' : 'Expected', severity, certainty,
      headline: `${assessed.reporters} persona(s) distinta(s), ${assessed.reports} reporte(s) · estado ${assessed.state}`,
      description: `Agrupado por SENDA a partir de reportes firmados de móviles (seudónimos). Probabilidad del modelo ${assessed.pReal} (razones de verosimilitud sin calibrar). Motivos: ${assessed.why.join('; ')}. SENDA no ha avisado a la población.`,
      parameters: [['SENDA_STATE', assessed.state], ['SENDA_REPORTERS', assessed.reporters], ['SENDA_TRAPPED', assessed.trapped ?? 0], ['SENDA_INJURED', assessed.injured ?? 0], ...(rise.length ? [['SENDA_RISE_CM_MIN_MAX', Math.max(...rise).toFixed(2)]] : []), ['SENDA_MODEL_BASIS', assessed.basis]],
      area: { areaDesc: 'Zona de los reportes', circle: { center: { lat: +cluster.center.lat.toFixed(5), lon: +cluster.center.lon.toFixed(5) }, radiusKm: +radiusKm.toFixed(2) } } } });
}
