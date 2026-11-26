// @ts-check
/**
 * SENDA · Copiloto por voz durante el trayecto: órdenes de calibración y notas para estudiar después con la caja negra.
 *
 *  - Órdenes (español, habladas): «estoy parado/aparcado» · «en marcha/arranco» · «voy a 50» (lo que marca el
 *    velocímetro del coche) · «marca/marcar» · «falsa alarma / eso no es nada».
 *  - Todo lo demás es una NOTA: se guarda con hora, posición, velocidad y lo que veía la cámara, con etiquetas
 *    automáticas (matrícula, intención de otro conductor, noche o visibilidad, usuario vulnerable…).
 *  - Calibración en parado: mientras la persona dice que está parada, se aprende el ruido de la velocidad del GPS.
 *    Después, una velocidad igual o menor que ese ruido se muestra como 0 km/h. Umbral = percentil 95 de lo medido
 *    en parado (MEDIDO en el propio móvil); sin calibrar no se filtra nada (no hay valor por defecto).
 *  - Velocímetro del coche: los pares (GPS, lo que marca el coche) se guardan para analizarlos; no corrigen el GPS
 *    (en la UE el velocímetro nunca puede marcar menos que la velocidad real: Reglamento CEPE/ONU n.º 39).
 * Las matrículas son datos personales: las notas se quedan en el móvil y no viajan en los avisos compartidos.
 */
const NUM = { cero: 0, diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100 };
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Interpreta una frase. Devuelve { cmd: 'PARKED'|'MOVING'|'SPEED'|'MARK'|'FALSE_ALERT'|'NOTE', kmh?, tags, plates } */
export function parseUtterance(text) {
  const t = norm(text);
  const out = { cmd: 'NOTE', text: String(text ?? '').trim(), tags: tagNote(t), plates: plateCandidates(t) };
  if (!t) return { ...out, cmd: 'EMPTY' };
  if (/^(estoy |estamos )?(parado|parada|aparcado|aparcada|detenido|detenida|quieto|quieta)\b/.test(t) || /\b(estoy|estamos) (parad|aparcad|detenid)/.test(t)) return { ...out, cmd: 'PARKED' };
  if (/^(en marcha|arranco|arrancamos|ya me muevo|nos movemos|salgo)\b/.test(t)) return { ...out, cmd: 'MOVING' };
  if (/^(falsa alarma|eso no es nada|no hay nada|error de la camara|aviso falso)\b/.test(t)) return { ...out, cmd: 'FALSE_ALERT' };
  if (/^(marca|marcar|marcalo|apunta)\b/.test(t) && t.split(' ').length <= 3) return { ...out, cmd: 'MARK' };
  const m = t.match(/^(voy a|vamos a|marca el coche|el coche marca|velocimetro)\s+(\d{1,3}|[a-z]+(?: y [a-z]+)?)/);
  if (m) { const kmh = /^\d/.test(m[2]) ? Number(m[2]) : words(m[2]); if (Number.isFinite(kmh) && kmh >= 0 && kmh <= 250) return { ...out, cmd: 'SPEED', kmh }; }
  return out;
}
function words(s) { let v = 0, ok = false; for (const w of s.split(/ y | /)) { if (w in NUM) { v += NUM[w]; ok = true; } } return ok ? v : NaN; }

/** Matrículas españolas actuales (4 cifras + 3 consonantes, sin vocales ni Ñ ni Q). Solo candidatas: el reconocedor se equivoca. */
export function plateCandidates(t) {
  const s = norm(t).toUpperCase(); const out = new Set();
  for (const m of s.matchAll(/\b(\d{4})\s?([BCDFGHJKLMNPRSTVWXYZ])\s?([BCDFGHJKLMNPRSTVWXYZ])\s?([BCDFGHJKLMNPRSTVWXYZ])\b/g)) out.add(`${m[1]} ${m[2]}${m[3]}${m[4]}`);
  return [...out];
}
/** @type {Array<[string, RegExp]>} */
const TAGS = [
  ['MATRICULA', /\bmatricula\b|\b\d{4}\s?[bcdfghjklmnprstvwxyz]{3}\b/],
  ['INTENCION', /\b(va a|se va a|quiere|intenta|pretende|intermitente|cambia de carril|se mete|se cruza|adelanta|gira|frena|para|invade|se incorpora|sale)\b/],
  ['NOCHE_VISIBILIDAD', /\b(noche|oscur|sin luces|luces|deslumbr|faro|niebla|lluvia|contraluz|reflejo)\w*/],
  ['VULNERABLE', /\b(peaton|peatones|ciclista|bici|bicicleta|moto|motorista|patinete|nino|perro|animal)\w*/],
  ['PESADO', /\b(camion|trailer|autobus|furgoneta|tractor|grua)\w*/],
  ['PELIGRO', /\b(peligro|casi|cuidado|freno|frenazo|choque|accidente|obstaculo|bache)\w*/],
];
export function tagNote(t) { const s = norm(t); return TAGS.filter(([, re]) => re.test(s)).map(([k]) => k); }

/**
 * Calibrador del ruido de velocidad en parado. minSamples (obligatorio): cuántas lecturas en parado hacen falta.
 * Devuelve { add(ms), threshold(), gate(ms), state() } — threshold = percentil 95 de las velocidades en parado.
 */
export function createParkedCalibrator({ minSamples, saved = null }) {
  if (!(minSamples > 0)) throw new Error('createParkedCalibrator exige minSamples (sin valor por defecto)');
  let samples = saved?.samples?.slice(-500) ?? [];
  const threshold = () => { if (samples.length < minSamples) return null; const s = samples.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]; };
  return {
    add(ms) { if (Number.isFinite(ms) && ms >= 0) { samples.push(ms); if (samples.length > 500) samples.shift(); } },
    threshold,
    gate(ms) { const thr = threshold(); if (ms == null || !Number.isFinite(ms)) return ms; return thr != null && ms <= thr ? 0 : ms; },
    state: () => ({ n: samples.length, thresholdMs: threshold(), samples: samples.slice() }),
  };
}

/** Resumen de una sesión de notas para el análisis posterior (cuántas, de qué tipo, pares de velocidad). */
export function summarizeSession(notes) {
  const by = {}; for (const n of notes) for (const t of n.tags ?? []) by[t] = (by[t] ?? 0) + 1;
  const pairs = notes.filter((n) => n.cmd === 'SPEED' && Number.isFinite(n.gpsKmh)).map((n) => ({ declared: n.kmh, gps: n.gpsKmh, diff: +(n.kmh - n.gpsKmh).toFixed(1) }));
  return { notes: notes.filter((n) => n.cmd === 'NOTE').length, commands: notes.filter((n) => n.cmd !== 'NOTE').length, tags: by, speedPairs: pairs, plates: notes.reduce((s, n) => s + (n.plates?.length ?? 0), 0), containsPersonalData: notes.some((n) => (n.plates?.length ?? 0) > 0 || (n.tags ?? []).includes('MATRICULA')) };
}
