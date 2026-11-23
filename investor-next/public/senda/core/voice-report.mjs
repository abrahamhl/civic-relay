/**
 * Aviso por voz (estilo Waze, sin red): convierte lo que dice el conductor en un tipo de aviso de SENDA.
 * El reconocimiento de voz lo hace el propio Android; aquí solo se interpreta el TEXTO, con reglas
 * explícitas y auditables (sin modelo de IA, sin red). Siempre se pide confirmación antes de enviar.
 *
 * Por qué reglas y no IA: funcionan sin red, sin coste y se pueden revisar línea a línea. Su acierto
 * real con conductores está POR MEDIR (no hay cifra de precisión: no se inventa).
 */
import { REPORT_KINDS } from './road-guard.mjs';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Reglas en orden de prioridad: la primera que encaja gana. Cada una lista sus expresiones. */
export const RULES = Object.freeze([
  { kind: 'accidente', any: ['accidente', 'choque', 'chocado', 'chocaron', 'colision', 'alcance', 'siniestro', 'volcado', 'han chocado', 'atropello'] },
  { kind: 'arcen', all: [['parado', 'parada', 'averiado', 'averiada', 'detenido', 'coche', 'camion', 'vehiculo', 'furgoneta', 'moto'], ['arcen', 'cuneta', 'lateral', 'a la derecha del todo']] },
  { kind: 'parado', any: ['coche parado', 'vehiculo parado', 'camion parado', 'furgoneta parada', 'moto parada', 'averiado', 'averiada', 'parado en el carril', 'parado en la carretera', 'coche detenido', 'baliza', 'v16', 'v 16', 'triangulo'] },
  { kind: 'animal', any: ['animal', 'perro', 'jabali', 'ciervo', 'corzo', 'vaca', 'caballo', 'oveja', 'cabra', 'gato'] },
  { kind: 'obstaculo', any: ['objeto', 'obstaculo', 'piedra', 'piedras', 'rueda', 'neumatico', 'carga', 'caja', 'escombro', 'rama', 'arbol caido', 'desprendimiento', 'mancha de aceite', 'aceite'] },
  { kind: 'niebla', any: ['niebla', 'no se ve', 'visibilidad', 'neblina', 'humo'] },
  { kind: 'hielo', any: ['hielo', 'nieve', 'helada', 'placa', 'resbala', 'granizo'] },
  { kind: 'obras', any: ['obras', 'obra', 'operarios', 'corte por obras', 'asfaltando', 'maquinas'] },
  { kind: 'retencion', any: ['atasco', 'retencion', 'caravana', 'trafico denso', 'cola', 'parados todos', 'esta parado todo', 'embotellamiento'] },
]);

const SIDE = [
  { side: 'CONTRARIO', any: ['sentido contrario', 'otro sentido', 'en contra', 'del otro lado'] },
  { side: 'MI_SENTIDO', any: ['mi sentido', 'mi carril', 'delante', 'en mi direccion', 'este sentido'] },
];

const hit = (t, w) => (` ${t} `).includes(` ${w} `);

/** Interpreta una frase. Devuelve { kind, label, side, matched, needsConfirmation:true } o { kind:null, reason }. */
export function interpretReport(transcript) {
  const t = norm(transcript);
  if (!t) return { kind: null, reason: 'VACIO', needsConfirmation: true };
  for (const r of RULES) {
    let matched = null;
    if (r.any) matched = r.any.find((w) => hit(t, w));
    else if (r.all) { const parts = r.all.map((grp) => grp.find((w) => hit(t, w))); if (parts.every(Boolean)) matched = parts.join(' + '); }
    if (matched) {
      const side = SIDE.find((s) => s.any.some((w) => hit(t, w)))?.side ?? 'SIN_INDICAR';
      return { kind: r.kind, label: REPORT_KINDS[r.kind].label, side, matched, text: t, needsConfirmation: true };
    }
  }
  return { kind: null, reason: 'NO_ENTENDIDO', text: t, needsConfirmation: true };
}

/** Varias alternativas del reconocedor (Android devuelve una lista): se queda con la primera que se entiende. */
export function interpretAlternatives(list) {
  for (const s of list || []) { const r = interpretReport(s); if (r.kind) return { ...r, from: s }; }
  return interpretReport(list?.[0] ?? '');
}
