/**
 * SENDA EVENT INTELLIGENCE v0 — motor determinista y explicable (sin LLM).
 *
 * Todo lo que produce son HIPÓTESIS etiquetadas como tales (`kind: 'HYPOTHESIS'`):
 *  - agrupación de publicaciones que parecen describir el mismo acontecimiento;
 *  - acontecimiento existente relacionado;
 *  - posibles contradicciones (negación explícita o cifras discrepantes);
 *  - preguntas de corroboración.
 * Nunca crea alertas, nunca cambia estados de verificación y nunca trata metadatos externos
 * como hechos observados. Un humano decide.
 */
import { haversineKm } from './geo.mjs';

const STOP = new Set(('a al algo ante con contra de del desde el ella en entre es esta este esto hay la las lo los más mas me mi no o para pero por que se sin sobre su sus un una uno y ya ' +
  'the a an and are as at be by for from has have in is it its of on or that the this to was were with ' +
  'de het een en is in op van voor met niet').split(/\s+/));
const NEGATION = /\b(no hay|no ha habido|desmiente|desmentido|falso|bulo|not true|no (?:injur|dead)|denies|denied|fake|hoax|geen|onwaar)\b/i;
const NUMERIC = /(\d+(?:[.,]\d+)?)\s*(heridos?|muertos?|fallecidos?|víctimas?|victimas?|evacuad[oa]s?|km|kil[oó]metros?|casas?|vehículos?|vehiculos?|injured|dead|deaths?|evacuated|homes?|cars?)/gi;

export function tokens(text = '') {
  return new Set(String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const UNIT_CANON = (u) => {
  u = u.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^(herid|injur)/.test(u)) return 'injured';
  if (/^(muert|fallec|dead|death|victim)/.test(u)) return 'dead';
  if (/^(evacu)/.test(u)) return 'evacuated';
  if (/^(km|kilometr)/.test(u)) return 'km';
  if (/^(casa|home)/.test(u)) return 'homes';
  if (/^(vehicul|car)/.test(u)) return 'vehicles';
  return u;
};

export function numericClaims(text = '') {
  const out = new Map();
  for (const m of String(text).matchAll(NUMERIC)) out.set(UNIT_CANON(m[2]), Number(m[1].replace(',', '.')));
  return out;
}

/** Similitud explicable entre dos publicaciones. */
export function similarity(a, b, { maxHours = 12, maxKm = 15 } = {}) {
  const text = jaccard(tokens(`${a.title} ${a.body}`), tokens(`${b.title} ${b.body}`));
  const sameCategory = a.category && a.category === b.category;
  const dtH = Math.abs((a.occurredAt ?? a.createdAt) - (b.occurredAt ?? b.createdAt)) / 3_600_000;
  const hasGeo = a.lat != null && b.lat != null;
  const km = hasGeo ? haversineKm({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }) : null;
  if (dtH > maxHours) return { score: 0, why: ['TIME_WINDOW_EXCEEDED'] };
  if (hasGeo && km > maxKm) return { score: 0, why: ['TOO_FAR'] };
  let score = text * 0.6 + (sameCategory ? 0.25 : 0) + (hasGeo ? 0.15 * (1 - km / maxKm) : 0.05);
  const why = [`text_jaccard=${text.toFixed(2)}`];
  if (sameCategory) why.push('same_category');
  if (hasGeo) why.push(`distance_km=${km.toFixed(1)}`);
  score = Math.round(score * 1000) / 1000;
  return { score, why };
}

/** Agrupa publicaciones en candidatos a acontecimiento (union-find por umbral). */
export function proposeClusters(posts, { threshold = 0.35 } = {}) {
  const parent = posts.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const links = [];
  for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++) {
    const s = similarity(posts[i], posts[j]);
    if (s.score >= threshold) { parent[find(i)] = find(j); links.push({ a: posts[i].id, b: posts[j].id, ...s }); }
  }
  const groups = new Map();
  posts.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
  return [...groups.values()].filter((g) => g.length >= 2).map((g) => {
    const ids = new Set(g.map((p) => p.id));
    return {
      kind: 'HYPOTHESIS',
      label: 'Posible mismo acontecimiento (propuesta automática, requiere revisión humana)',
      postIds: g.map((p) => p.id),
      category: mode(g.map((p) => p.category)),
      evidence: links.filter((l) => ids.has(l.a) && ids.has(l.b)),
      contradictions: findContradictions(g),
      questions: corroborationQuestions(g),
    };
  });
}

/** Detecta posibles contradicciones: negación explícita o cifras distintas para la misma magnitud. */
export function findContradictions(posts) {
  const out = [];
  for (const p of posts) if (NEGATION.test(`${p.title} ${p.body}`)) out.push({ kind: 'HYPOTHESIS', type: 'NEGATION', postId: p.id });
  const claims = posts.map((p) => ({ id: p.id, c: numericClaims(`${p.title} ${p.body}`) }));
  for (let i = 0; i < claims.length; i++) for (let j = i + 1; j < claims.length; j++) {
    for (const [unit, v] of claims[i].c) {
      const w = claims[j].c.get(unit);
      if (w !== undefined && w !== v) out.push({ kind: 'HYPOTHESIS', type: 'NUMERIC_MISMATCH', unit, values: { [claims[i].id]: v, [claims[j].id]: w } });
    }
  }
  return out;
}

export function corroborationQuestions(posts) {
  const q = ['¿Hay una fuente oficial o un medio identificado que lo confirme?', '¿Las imágenes son de hoy? Comprueba fecha original y lugar (posible material antiguo).'];
  if (posts.some((p) => p.lat == null)) q.push('¿Dónde ocurre exactamente? (indica municipio o vía, sin datos de personas)');
  if (findContradictions(posts).length) q.push('Hay versiones distintas: ¿qué fuente aporta evidencia directa?');
  return q;
}

/** Clasificación sugerida a partir de palabras clave (hipótesis). */
const CATS = [
  ['flood', /inundaci|riada|dana|crecida|flood|overstroming/i],
  ['fire', /incendi|fuego|humo|wildfire|fire|brand/i],
  ['traffic', /accidente|atasco|tr[aá]fico|carretera|autov[ií]a|crash|traffic|ongeluk|file/i],
  ['weather', /tormenta|granizo|viento|ola de calor|nieve|storm|hail|weer/i],
  ['outage', /apag[oó]n|corte de luz|sin luz|corte de agua|outage|blackout|storing/i],
  ['quake', /terremoto|seísmo|sismo|earthquake|aardbeving/i],
];
export function suggestCategory(text = '') {
  for (const [c, re] of CATS) if (re.test(text)) return { kind: 'HYPOTHESIS', category: c };
  return { kind: 'HYPOTHESIS', category: 'general' };
}

function mode(arr) {
  const m = new Map(); let best = arr[0], n = 0;
  for (const x of arr) { const k = (m.get(x) ?? 0) + 1; m.set(x, k); if (k > n) { n = k; best = x; } }
  return best;
}
