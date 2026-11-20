/**
 * SENDA · Vigía de avisos: lee en la web los avisos oficiales y los eventos observados en cuanto se publican,
 * los normaliza, detecta los NUEVOS, los ACTUALIZADOS y los CANCELADOS, y calcula a quién despertar alrededor.
 *
 * Fuentes (adaptadores de este módulo, formatos públicos):
 *  · MeteoAlarm (EUMETNET): avisos meteorológicos OFICIALES de los servicios nacionales (AEMET en España, KNMI en
 *    Países Bajos) en Atom con campos CAP 1.2. La zona viene como código EMMA_ID; la geometría se resuelve con la
 *    tabla de zonas (data/alertas/zonas-emma-es-nl.json).
 *  · CAP 1.2 (OASIS) genérico: cualquier documento <alert> con polígonos, círculos o geocódigos.
 *  · USGS y EMSC: terremotos OBSERVADOS (no son avisos: son medidas sísmicas publicadas en minutos).
 *  · GDACS (ONU/Comisión Europea): alertas AUTOMÁTICAS de impacto (verde/naranja/rojo).
 *  · NASA EONET: catálogo de eventos naturales abiertos (incendios, tormentas, volcanes…).
 *
 * Qué hace SENDA con un aviso (planActivation): según dónde está cada dispositivo que ha dado su consentimiento,
 *  · DENTRO del área: recibe la guía del aviso y dos botones («estoy bien» / «necesito ayuda»);
 *  · en el ANILLO exterior y con consentimiento de verificación: se le pide confirmar lo que ve (testigo);
 *  · con salida a Internet y consentimiento de pasarela: activa la pasarela para vecinos sin datos (stranger-gateway);
 *  · conduciendo o cerca, con consentimiento de ayuda: queda disponible para que la autoridad le pida ayuda.
 * Con un aviso PREVISTO (urgencia Future u onset posterior), SENDA prepara: guarda mapas y rutas y enciende
 * pasarelas ANTES de que caiga la red. SENDA no emite alertas públicas: solo prepara y coordina a quien aceptó.
 *
 * Veracidad: los radios de activación y las tolerancias para fusionar el mismo evento de varias fuentes son una
 * POLÍTICA declarada (sin valores por defecto). Los ejercicios (status Exercise/Test) nunca despiertan a nadie.
 */

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const need = (name, o, keys) => { for (const k of keys) if (!fin(o?.[k])) throw new Error(`${name}: «${k}» debe declararse`); };
const R = 6_371_008.8, rad = Math.PI / 180;

export const ALERT_KINDS = Object.freeze(['EARTHQUAKE', 'TSUNAMI', 'FLOOD', 'RAIN', 'WIND', 'STORM', 'SNOW_ICE', 'HEAT', 'COLD', 'FOG', 'COASTAL', 'FIRE', 'VOLCANO', 'DROUGHT', 'AVALANCHE', 'ICE_SEA', 'OTHER']);
export const ALERT_SEVERITIES = Object.freeze(['UNKNOWN', 'MINOR', 'MODERATE', 'SEVERE', 'EXTREME']);
export const ALERT_SOURCES = Object.freeze({
  METEOALARM: { label: 'MeteoAlarm (AEMET, KNMI…)', nature: 'OFFICIAL_WARNING', url: 'https://feeds.meteoalarm.org', cors: false, licence: 'Términos equivalentes a CC BY 4.0 (MeteoAlarm)' },
  CAP: { label: 'CAP 1.2 de un emisor oficial', nature: 'OFFICIAL_WARNING', url: null, cors: null, licence: 'Según el emisor' },
  USGS: { label: 'USGS (terremotos)', nature: 'OBSERVATION', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', cors: true, licence: 'Dominio público (USGS)' },
  EMSC: { label: 'EMSC (terremotos)', nature: 'OBSERVATION', url: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=100&format=json', cors: true, licence: 'EMSC, uso con atribución' },
  GDACS: { label: 'GDACS (ONU · Comisión Europea)', nature: 'AUTOMATED_ALERT', url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Green;Orange;Red', cors: true, licence: 'GDACS, uso con atribución' },
  EONET: { label: 'NASA EONET', nature: 'EVENT_CATALOG', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300', cors: true, licence: 'NASA, uso libre con atribución' },
});

/* ───────────────────────── XML mínimo (CAP / Atom) ───────────────────────── */

const unesc = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
/** Bloques <tag>…</tag> (con o sin prefijo de espacio de nombres) dentro de `xml`. */
function blocks(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'g'), out = [];
  for (let m; (m = re.exec(xml));) out.push(m[1]);
  return out;
}
const first = (xml, tag) => { const b = blocks(xml, tag); return b.length ? unesc(b[0]) : null; };

/** CAP 1.2: identificador, emisor, estado, tipo de mensaje, referencias y bloques <info> con sus <area>. */
export function parseCapDocument(xml) {
  const alert = blocks(xml, 'alert')[0] ?? xml;
  const infos = blocks(alert, 'info').map((inf) => ({
    language: first(inf, 'language'), category: first(inf, 'category'), event: first(inf, 'event'), urgency: first(inf, 'urgency'),
    severity: first(inf, 'severity'), certainty: first(inf, 'certainty'), effective: first(inf, 'effective'), onset: first(inf, 'onset'),
    expires: first(inf, 'expires'), senderName: first(inf, 'senderName'), headline: first(inf, 'headline'), description: first(inf, 'description'),
    instruction: first(inf, 'instruction'), web: first(inf, 'web'),
    parameters: blocks(inf, 'parameter').map((p) => ({ name: first(p, 'valueName'), value: first(p, 'value') })),
    areas: blocks(inf, 'area').map((a) => ({
      areaDesc: first(a, 'areaDesc'),
      polygons: blocks(a, 'polygon').map((p) => unesc(p).split(/\s+/).filter(Boolean).map((pt) => pt.split(',').map(Number))),
      circles: blocks(a, 'circle').map((c) => { const [ll, r] = unesc(c).split(/\s+/); const [lat, lon] = ll.split(',').map(Number); return { lat, lon, radiusKm: Number(r) }; }),
      geocodes: blocks(a, 'geocode').map((g) => ({ name: first(g, 'valueName'), value: first(g, 'value') })),
    })),
  }));
  const refs = first(alert, 'references');
  return { identifier: first(alert, 'identifier'), sender: first(alert, 'sender'), sent: first(alert, 'sent'), status: first(alert, 'status'), msgType: first(alert, 'msgType'), scope: first(alert, 'scope'),
    references: refs ? refs.split(/\s+/).map((r) => { const [sender, identifier, sent] = r.split(','); return { sender, identifier, sent }; }) : [], infos };
}

/* ───────────────────────── Normalización ───────────────────────── */

const SEV = { Minor: 'MINOR', Moderate: 'MODERATE', Severe: 'SEVERE', Extreme: 'EXTREME', Unknown: 'UNKNOWN' };
/** Tipo de fenómeno a partir del texto del evento o del parámetro awareness_type de MeteoAlarm. */
export function kindFromText(t = '') {
  const s = t.toLowerCase();
  const rules = [[/tsunami|maremoto/, 'TSUNAMI'], [/earthquake|terremoto|sismo|seism/, 'EARTHQUAKE'], [/flood|inunda|crecida|riada/, 'FLOOD'], [/coastal|costero|oleaje|wave|marine/, 'COASTAL'],
    [/thunder|torment|storm|cyclone|hurricane|cicl[oó]n|hurac/, 'STORM'], [/rain|lluvia|precipit/, 'RAIN'], [/wind|viento/, 'WIND'], [/snow|ice|nieve|hielo|helada/, 'SNOW_ICE'],
    [/high.temp|heat|calor|temperaturas? m[aá]x/, 'HEAT'], [/low.temp|cold|fr[ií]o|temperaturas? m[ií]n/, 'COLD'], [/fog|niebla/, 'FOG'], [/forest.fire|wildfire|incendio|fire/, 'FIRE'],
    [/volcan/, 'VOLCANO'], [/drought|sequ[ií]a/, 'DROUGHT'], [/avalanche|alud/, 'AVALANCHE'], [/sea.?lake.?ice/, 'ICE_SEA']];
  for (const [re, k] of rules) if (re.test(s)) return k;
  return 'OTHER';
}
const iso = (x) => (x ? new Date(x).toISOString() : null);
/** Fase respecto a `now`: PREVISTO (aún no empieza), ACTIVO, OBSERVADO (evento ya ocurrido sin vigencia) o CADUCADO. */
export function phaseOf(a, now) {
  if (a.status && a.status !== 'ACTUAL') return 'EXERCISE';
  if (a.msgType === 'CANCEL') return 'CANCELLED';
  const t = (x) => (x ? Date.parse(x) : null), on = t(a.onset), ex = t(a.expires);
  if (ex != null && ex < now) return 'EXPIRED';
  if (on != null && on > now) return 'FORECAST';
  if (a.nature === 'OBSERVATION' || a.nature === 'EVENT_CATALOG') return 'OBSERVED';
  // GDACS verde = impacto humanitario bajo según su propio modelo: se muestra como evento observado, no como alerta vigente.
  if (a.nature === 'AUTOMATED_ALERT' && a.level === 'Green') return 'OBSERVED';
  return 'ACTIVE';
}

/** Atom de MeteoAlarm → avisos normalizados. `zones` = { EMMA_ID: { n, c:[lat,lon], r:[[[lon,lat]…]] } }. */
export function fromMeteoalarmAtom(xml, zones = {}) {
  return blocks(xml, 'entry').map((e) => {
    const code = blocks(e, 'geocode').map((g) => first(g, 'value'))[0] ?? null, z = code ? zones[code] : null;
    const title = first(e, 'title') ?? '', event = first(e, 'event') ?? title;
    const level = (title.match(/^(Yellow|Orange|Red|Green)/) ?? [])[1] ?? null;
    return {
      id: `METEOALARM:${first(e, 'identifier')}:${code}`, source: 'METEOALARM', nature: 'OFFICIAL_WARNING', kind: kindFromText(event),
      title, area: first(e, 'areaDesc'), severity: SEV[first(e, 'severity')] ?? 'UNKNOWN', certainty: first(e, 'certainty'), urgency: first(e, 'urgency'),
      level, status: (first(e, 'status') ?? 'Actual').toUpperCase(), msgType: (first(e, 'message_type') ?? 'Alert').toUpperCase(),
      sent: iso(first(e, 'sent')), onset: iso(first(e, 'onset')), expires: iso(first(e, 'expires')),
      geocode: code, geometry: z ? { type: 'POLYGONS', rings: z.r } : null, point: z ? { lat: z.c[0], lon: z.c[1] } : null,
      url: (e.match(/<link[^>]*type="application\/cap\+xml"[^>]*href="([^"]+)"/) ?? [])[1] ?? null,
    };
  });
}

/** CAP 1.2 → un aviso por cada <info>/<area> (el primer idioma). */
export function fromCap(xml, zones = {}) {
  const c = parseCapDocument(xml), info = c.infos[0]; if (!info) return [];
  return info.areas.map((a, i) => {
    const rings = a.polygons.map((p) => p.map(([lat, lon]) => [lon, lat]));
    const z = a.geocodes.map((g) => zones[g.value]).find(Boolean);
    const geometry = rings.length ? { type: 'POLYGONS', rings } : a.circles.length ? { type: 'CIRCLE', ...a.circles[0] } : z ? { type: 'POLYGONS', rings: z.r } : null;
    const point = geometry?.type === 'CIRCLE' ? { lat: geometry.lat, lon: geometry.lon } : geometry ? centroidOf(geometry.rings) : null;
    return { id: `CAP:${c.identifier}:${i}`, source: 'CAP', nature: 'OFFICIAL_WARNING', kind: kindFromText(`${info.event} ${info.parameters.map((p) => p.value).join(' ')}`), title: info.headline ?? info.event,
      area: a.areaDesc, severity: SEV[info.severity] ?? 'UNKNOWN', certainty: info.certainty, urgency: info.urgency, status: (c.status ?? 'Actual').toUpperCase(), msgType: (c.msgType ?? 'Alert').toUpperCase(),
      sent: iso(c.sent), onset: iso(info.onset ?? info.effective), expires: iso(info.expires), sender: info.senderName ?? c.sender, instruction: info.instruction,
      references: c.references, geometry, point, url: info.web };
  });
}

export function fromUsgs(geo) {
  return geo.features.map((f) => ({ id: `USGS:${f.id}`, source: 'USGS', nature: 'OBSERVATION', kind: f.properties.tsunami ? 'TSUNAMI' : 'EARTHQUAKE', title: f.properties.title ?? `M ${f.properties.mag} ${f.properties.place}`,
    area: f.properties.place, magnitude: f.properties.mag, depthKm: f.geometry.coordinates[2], severity: 'UNKNOWN', status: 'ACTUAL', msgType: 'ALERT',
    sent: iso(f.properties.updated), onset: iso(f.properties.time), expires: null, point: { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }, geometry: null, url: f.properties.url,
    pager: f.properties.alert ?? null }));
}
export function fromEmsc(geo) {
  return geo.features.map((f) => ({ id: `EMSC:${f.id}`, source: 'EMSC', nature: 'OBSERVATION', kind: 'EARTHQUAKE', title: `M ${f.properties.mag} ${f.properties.flynn_region}`,
    area: f.properties.flynn_region, magnitude: f.properties.mag, depthKm: f.properties.depth, severity: 'UNKNOWN', status: 'ACTUAL', msgType: 'ALERT',
    sent: iso(f.properties.lastupdate), onset: iso(f.properties.time), expires: null, point: { lat: f.properties.lat, lon: f.properties.lon }, geometry: null,
    url: `https://www.seismicportal.eu/eventdetails.html?unid=${f.id}` }));
}
const GDACS_KIND = { EQ: 'EARTHQUAKE', TC: 'STORM', FL: 'FLOOD', VO: 'VOLCANO', WF: 'FIRE', DR: 'DROUGHT', TS: 'TSUNAMI' };
const GDACS_SEV = { Green: 'MINOR', Orange: 'SEVERE', Red: 'EXTREME' };
// GDACS publica fechas sin zona horaria; son UTC.
const utc = (x) => (x ? iso(/[zZ]|[+-]\d\d:?\d\d$/.test(x) ? x : `${x}Z`) : null);
export function fromGdacs(geo) {
  return geo.features.map((f) => { const p = f.properties, c = f.geometry.coordinates;
    return { id: `GDACS:${p.eventtype}:${p.eventid}:${p.episodeid}`, source: 'GDACS', nature: 'AUTOMATED_ALERT', kind: GDACS_KIND[p.eventtype] ?? 'OTHER', title: p.name ?? p.description,
      area: p.country ?? null, level: p.alertlevel, severity: GDACS_SEV[p.alertlevel] ?? 'UNKNOWN', status: 'ACTUAL', msgType: 'ALERT',
      sent: utc(p.datemodified ?? p.fromdate), onset: utc(p.fromdate), expires: p.iscurrent === 'false' ? utc(p.todate) : null,
      point: { lat: c[1], lon: c[0] }, geometry: null, url: p.url?.report ?? null }; });
}
const EONET_KIND = { wildfires: 'FIRE', severeStorms: 'STORM', volcanoes: 'VOLCANO', floods: 'FLOOD', earthquakes: 'EARTHQUAKE', seaLakeIce: 'ICE_SEA', snow: 'SNOW_ICE', drought: 'DROUGHT', landslides: 'OTHER', dustHaze: 'OTHER', tempExtremes: 'HEAT' };
export function fromEonet(j) {
  return j.events.map((e) => { const g = e.geometry[e.geometry.length - 1], pt = g.type === 'Point' ? g.coordinates : g.coordinates[0][0];
    return { id: `EONET:${e.id}`, source: 'EONET', nature: 'EVENT_CATALOG', kind: EONET_KIND[e.categories[0]?.id] ?? 'OTHER', title: e.title, area: null, severity: 'UNKNOWN',
      status: 'ACTUAL', msgType: 'ALERT', sent: iso(g.date), onset: iso(e.geometry[0].date), expires: null, point: { lat: pt[1], lon: pt[0] }, geometry: null,
      url: e.sources?.[0]?.url ?? e.link }; });
}

/* ───────────────────────── Geometría ───────────────────────── */

function haversineKm(a, b) {
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
}
/** Punto en polígono (rayo) sobre anillos [[lon,lat]…]. */
export function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lon < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Distancia (km) del punto al área: 0 dentro; si no, a la arista más cercana (proyección local). */
export function distanceToAreaKm(pt, a) {
  const g = a.geometry;
  if (!g) return a.point ? haversineKm(pt, a.point) : Infinity;
  if (g.type === 'CIRCLE') return Math.max(0, haversineKm(pt, g) - g.radiusKm);
  if (g.rings.some((r) => inRing(pt, r))) return 0;
  const kx = Math.cos(pt.lat * rad) * 111.32, ky = 110.57; let best = Infinity;
  for (const r of g.rings) for (let i = 0; i + 1 < r.length; i++) {
    const ax = (r[i][0] - pt.lon) * kx, ay = (r[i][1] - pt.lat) * ky, bx = (r[i + 1][0] - pt.lon) * kx, by = (r[i + 1][1] - pt.lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
export function centroidOf(rings) {
  let A = 0, cx = 0, cy = 0;
  for (const r of rings) for (let i = 0; i + 1 < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[i + 1], c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  if (!A) return { lat: rings[0][0][1], lon: rings[0][0][0] };
  return { lat: cy / (3 * A), lon: cx / (3 * A) };
}

/* ───────────────────────── Fusión, cambios y activación ───────────────────────── */

/**
 * Agrupa el MISMO terremoto publicado por varias fuentes (USGS, EMSC, GDACS): distancia ≤ maxKm, diferencia de
 * hora ≤ maxSeconds y de magnitud ≤ maxMagDiff (tolerancias DECLARADAS). Devuelve grupos con la lista de fuentes.
 */
export function fuseEvents(alerts, tol) {
  need('fuseEvents', tol, ['maxKm', 'maxSeconds', 'maxMagDiff']);
  const groups = [];
  for (const a of alerts) {
    const g = a.kind === 'EARTHQUAKE' && a.point && a.onset ? groups.find((x) => x.kind === 'EARTHQUAKE' && !x.sources.includes(a.source) &&
      haversineKm(a.point, x.point) <= tol.maxKm && Math.abs(Date.parse(a.onset) - Date.parse(x.onset)) <= tol.maxSeconds * 1000 &&
      (a.magnitude == null || x.magnitude == null || Math.abs(a.magnitude - x.magnitude) <= tol.maxMagDiff)) : null;
    if (g) { g.sources.push(a.source); g.members.push(a.id); } else groups.push({ ...a, sources: [a.source], members: [a.id] });
  }
  return groups;
}

/** Firma de contenido de un aviso: si cambia, el aviso se ha ACTUALIZADO. */
const signature = (a) => JSON.stringify([a.title, a.severity, a.onset, a.expires, a.msgType, a.status, a.magnitude ?? null, a.level ?? null]);
/** Diferencias entre dos lecturas: nuevos, actualizados, cancelados y desaparecidos. */
export function diffSnapshots(prev, next) {
  const P = new Map(prev.map((a) => [a.id, a])), N = new Map(next.map((a) => [a.id, a]));
  const created = [], updated = [], cancelled = [], gone = [];
  for (const [id, a] of N) { const o = P.get(id); if (a.msgType === 'CANCEL') cancelled.push(a); else if (!o) created.push(a); else if (signature(o) !== signature(a)) updated.push(a); }
  for (const [id, o] of P) if (!N.has(id)) gone.push(o);
  return { created, updated, cancelled, gone };
}

const SEV_RANK = Object.fromEntries(ALERT_SEVERITIES.map((s, i) => [s, i]));
/**
 * Plan de activación para un aviso. policy (DECLARADA): { minSeverity, ringKm, helpEtaS, exerciseMode? } donde ringKm
 * es la anchura del anillo exterior alrededor del área (verificación y pasarelas) y helpEtaS el tiempo máximo de
 * llegada para ofrecer ayuda. devices: [{ id, lat, lon, consent:{verify, relay, help}, uplink:boolean, driving:boolean, speedMs }].
 * Solo se cuenta a quien ha dado cada consentimiento; sin consentimiento, el dispositivo no recibe peticiones.
 */
export function planActivation(alert, devices, policy, now) {
  need('planActivation', policy, ['ringKm', 'helpEtaS']);
  if (!ALERT_SEVERITIES.includes(policy.minSeverity)) throw new Error('planActivation: «minSeverity» debe declararse');
  const phase = phaseOf(alert, now);
  const wake = (phase === 'ACTIVE' || phase === 'FORECAST' || phase === 'OBSERVED') && (alert.nature === 'OBSERVATION' || SEV_RANK[alert.severity] >= SEV_RANK[policy.minSeverity]);
  const exercise = phase === 'EXERCISE';
  if (!wake && !(exercise && policy.exerciseMode)) return { alertId: alert.id, phase, wake: false, reason: exercise ? 'EXERCISE_NOT_ENABLED' : 'BELOW_POLICY_OR_INACTIVE', roles: [], counts: {} };
  const roles = [];
  for (const d of devices) {
    const km = distanceToAreaKm(d, alert), r = [];
    if (km === 0) r.push('IN_AREA');
    else if (km <= policy.ringKm) {
      if (d.consent?.verify) r.push('VERIFIER');
      if (d.uplink && d.consent?.relay) r.push('RELAY');
    }
    if (km > 0 && d.consent?.help && fin(d.speedMs) && d.speedMs > 0 && (km * 1000) / d.speedMs <= policy.helpEtaS) r.push('HELPER');
    if (km === 0 && d.uplink && d.consent?.relay) r.push('RELAY');
    if (r.length) roles.push({ id: d.id, km: +km.toFixed(2), roles: r, etaS: d.speedMs > 0 ? Math.round((km * 1000) / d.speedMs) : null });
  }
  const counts = {}; for (const x of roles) for (const r of x.roles) counts[r] = (counts[r] ?? 0) + 1;
  const prepare = phase === 'FORECAST' ? ['CACHE_MAPS_AND_ROUTES', 'ENABLE_GATEWAYS_IF_CONSENTED', 'PRESYNC_CONTACTS'] : [];
  return { alertId: alert.id, phase, wake: true, exercise, prepare, roles, counts, canPublicWarn: false };
}

/** Ejemplo de política (EJEMPLO_DECLARADO, sin fuente: para demostraciones; un organismo la fija). */
export const EXAMPLE_ALERT_POLICY = Object.freeze({ minSeverity: 'MODERATE', ringKm: 10, helpEtaS: 900, exerciseMode: false, basis: 'EJEMPLO_DECLARADO · sin fuente' });
export const EXAMPLE_ALERT_FUSION = Object.freeze({ maxKm: 100, maxSeconds: 120, maxMagDiff: 0.5, basis: 'EJEMPLO_DECLARADO · sin fuente' });
