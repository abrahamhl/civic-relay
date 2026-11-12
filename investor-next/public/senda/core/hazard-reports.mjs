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
