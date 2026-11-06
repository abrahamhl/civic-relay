/**
 * SENDA · Triaje para cualquier persona y aviso al servicio adecuado.
 *
 * En una catástrofe, el primero en llegar suele ser un vecino, no un médico. SENDA le guía con un
 * algoritmo público y reconocido internacionalmente para múltiples víctimas, START (Simple Triage
 * and Rapid Treatment): camina → respira → frecuencia respiratoria → circulación → obedece órdenes.
 * Con una sola víctima que no respira con normalidad, la indicación cambia: pedir ayuda y RCP
 * (recomendaciones del Consejo Europeo de Resucitación 2021: 100–120 compresiones por minuto,
 * 5–6 cm de profundidad).
 *
 * Reglas de SENDA: nunca declara a nadie fallecido (eso lo confirma un profesional); el 112 va
 * siempre primero; el mensaje cabe en un SMS (160 caracteres) y en un mensaje por satélite.
 * No es un producto sanitario: orienta a una persona sin formación mientras llega la ayuda.
 */

export const CATEGORIES = Object.freeze({
  ROJO: { label: 'Inmediato', color: '#ff5b6e' },
  AMARILLO: { label: 'Puede esperar poco', color: '#fbbf24' },
  VERDE: { label: 'Leve, camina', color: '#34d399' },
  SIN_RESPIRACION: { label: 'Sin respiración tras abrir la vía aérea · lo confirma un profesional', color: '#7d8f99' },
  PARADA: { label: 'No respira con normalidad · RCP ya', color: '#ff5b6e' },
});

/**
 * @param {{walks?:boolean, breathes?:boolean, breathesAfterAirway?:boolean, rr?:number, radialPulse?:boolean, capRefillS?:number, obeys?:boolean}} o
 * @param {{mci?:boolean}} opts mci = múltiples víctimas (START); false = una sola víctima
 */
export function startTriage(o, { mci = true } = {}) {
  const r = (cat, why) => ({ cat, why, ...CATEGORIES[cat] });
  if (o.walks) return r('VERDE', 'Puede caminar');
  if (o.breathes === false) {
    if (o.breathesAfterAirway) return r('ROJO', 'Solo respira al abrirle la vía aérea');
    return mci ? r('SIN_RESPIRACION', 'No respira ni al abrir la vía aérea') : r('PARADA', 'No respira con normalidad');
  }
  if ((o.rr ?? 0) > 30) return r('ROJO', 'Respira más de 30 veces por minuto');
  if (o.radialPulse === false || (o.capRefillS ?? 0) > 2) return r('ROJO', 'Mala circulación (sin pulso en la muñeca o relleno capilar > 2 s)');
  if (o.obeys === false) return r('ROJO', 'No obedece órdenes sencillas');
  return r('AMARILLO', 'Estable por ahora, pero no puede caminar');
}

/** Qué hacer ahora, según la categoría y lo observado. */
export function firstAid(res, { bleeding = false, trapped = false, unconsciousBreathing = false } = {}) {
  const s = [];
  if (res.cat === 'PARADA') s.push('Pide que llamen al 112 y pon el altavoz.', 'Compresiones en el centro del pecho: 100–120 por minuto, 5–6 cm de profundidad. No pares hasta que llegue ayuda o un desfibrilador.');
  if (res.cat === 'SIN_RESPIRACION') s.push('Marca su posición y pasa a la siguiente persona: con muchas víctimas, el tiempo salva a otras. Un profesional lo confirmará.');
  if (bleeding) s.push('Presión directa y firme sobre la herida con lo más limpio que tengas; no la levantes para mirar.', 'Si sangra a chorro en un brazo o una pierna y la presión no basta: torniquete unos 5–7 cm por encima de la herida, aprieta hasta que pare y anota la hora.');
  if (res.cat === 'ROJO' && o2(res)) s.push('Si respira mejor sentado, déjale sentado; si no, tumbado con las piernas estiradas.');
  if (unconsciousBreathing) s.push('Si no responde pero respira: posición lateral de seguridad y vigila que siga respirando.');
  if (trapped) s.push('No muevas escombros grandes ni a la persona salvo peligro inmediato. Háblale y marca el lugar.');
  if (res.cat === 'VERDE') s.push('Que se aleje del peligro y espere en el punto de reunión; puede ayudar a otros.');
  return s;
}
const o2 = (res) => /Respira más de 30/.test(res.why);

/** Servicios que necesita el caso (el 112 siempre primero; él coordina). */
export function routeFor({ medical = false, trapped = false, fire = false, crime = false, traffic = false, mountain = false, sea = false } = {}) {
  const r = ['112'];
  if (medical) r.push('Sanitario');
  if (trapped || fire) r.push('Bomberos');
  if (mountain) r.push('Guardia Civil (062) · rescate de montaña');
  if (crime || traffic) r.push('Guardia Civil (062) / Policía (091)');
  if (sea) r.push('Salvamento Marítimo');
  return r;
}

/** Recuento por colores en una escena con varias víctimas. */
export function tally(results) {
  const t = { ROJO: 0, AMARILLO: 0, VERDE: 0, SIN_RESPIRACION: 0, PARADA: 0 };
  for (const r of results) t[r.cat]++;
  return t;
}

/**
 * Parte compacto: cabe en un SMS (≤ 160) y en un mensaje satelital corto. Sin nombres.
 * Ej.: «SENDA TRIAJE R2 A1 V3 | 39.45210,-0.43020 ±8m P3 | atrapados 1 · hemorragia 1 | 112,Bomberos | 18:42»
 */
export function compactReport({ counts, lat, lon, accM, floor = null, needs = [], services = [], hhmm }) {
  const c = `R${counts.ROJO + counts.PARADA} A${counts.AMARILLO} V${counts.VERDE}${counts.SIN_RESPIRACION ? ` N${counts.SIN_RESPIRACION}` : ''}`;
  const pos = `${lat.toFixed(5)},${lon.toFixed(5)} ±${Math.round(accM)}m${floor != null ? ` P${floor}` : ''}`;
  let msg = `SENDA TRIAJE ${c} | ${pos} | ${needs.join(' · ')} | ${services.join(',')} | ${hhmm}`;
  if (msg.length > 160) msg = msg.slice(0, 157) + '...';
  return msg;
}
