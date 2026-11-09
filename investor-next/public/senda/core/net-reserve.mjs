/**
 * SENDA · Reserva de red: una «batería de Internet» dentro del teléfono.
 *
 * Igual que una batería guarda energía para cuando no hay enchufe, la reserva guarda, mientras hay
 * Wi-Fi y el móvil carga, la parte de Internet que esa persona necesitará cuando no haya red:
 * mapas de su zona, plan de emergencia, albergues, hospitales, primeros auxilios, zonas inundables,
 * antenas, órbitas de satélites, sus documentos cifrados, contactos… Cuando se corta la red, la app
 * responde desde la reserva como si fuera la red, y lo que no se puede responder (enviar, consultar
 * algo nuevo) se encola como «intención» para la primera ventana de conexión.
 *
 * No se puede guardar «todo Internet» (la Wikipedia en español sin imágenes ronda 9 GB), así que
 * la reserva se elige con matemáticas:
 *  - Valor de cada contenido = utilidad base × peso del riesgo de la zona × frescura.
 *  - Frescura con semivida: 2^(−edad/semivida). Un aviso meteorológico caduca en horas; un mapa, en meses.
 *  - Selección óptima con presupuesto de megas: mochila 0/1 por programación dinámica (exacta).
 *  - En una ventana corta de conexión (30 s en una cima, un satélite, un vecino con Wi-Fi): primero lo
 *    que más valor recupera por mega (orden por densidad).
 *  - Recarga por difusión (satélite de televisión, radio digital): una vía, sin saturar la red.
 * Los navegadores Chromium permiten a una web guardar hasta ~60 % del disco y la app puede pedir
 * almacenamiento PERSISTENTE (navigator.storage.persist) para que el sistema no lo borre.
 * Tamaños: estimaciones de planificación (los de teselas se calculan con geo-offline.mjs).
 */
import { tilePack } from './geo-offline.mjs';

export const freshness = (ageH, halfLifeH) => (!Number.isFinite(halfLifeH) ? 1 : 2 ** (-Math.max(0, ageH) / halfLifeH));
const bboxAround = ({ lat, lon }, km) => { const dLat = km / 111.32 / 2, dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180)) / 2; return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon }; };

/**
 * Catálogo de contenidos para una persona y su zona.
 * @param {{home:{lat:number,lon:number}, hazards?:string[], regionKm?:number, barrioKm?:number}} profile
 */
export function reserveCatalog({ home = { lat: 39.47, lon: -0.38 }, hazards = [], regionKm = 60, barrioKm = 6 } = {}) {
  const region = tilePack(bboxAround(home, regionKm), 6, 13, { kbPerTile: 18 }).mb, barrio = tilePack(bboxAround(home, barrioKm), 14, 17, { kbPerTile: 22 }).mb, vecinos = tilePack(bboxAround(home, regionKm * 2.5), 6, 11, { kbPerTile: 18 }).mb;
  const H = (map) => hazards.reduce((m, h) => m * (map[h] ?? 1), 1);
  const items = [
    { id: 'app', name: 'SENDA sin red (app, núcleo y ayuda)', mb: 12, u: 100, hl: Infinity, essential: true },
    { id: 'contactos', name: 'Contactos y tarjetas de tu familia', mb: 0.2, u: 70, hl: 720, essential: true },
    { id: 'documentos', name: 'Tus documentos cifrados (identidad, salud, alergias, medicación)', mb: 6, u: 55, hl: Infinity },
    { id: 'auxilios', name: 'Primeros auxilios y RCP (texto, dibujos y audio)', mb: 25, u: 65 * H({ terremoto: 1.3, victimas: 1.5 }), hl: Infinity },
    { id: 'plan', name: 'Plan de emergencia, puntos de reunión y albergues', mb: 3, u: 60, hl: 720 },
    { id: 'sanidad', name: 'Hospitales, centros de salud y farmacias de guardia', mb: 1.5, u: 45, hl: 24 },
    { id: 'mapa-region', name: `Mapa de tu región (${regionKm} km)`, mb: region, u: 70 * H({ monte: 1.3, riada: 1.2 }), hl: 4320 },
    { id: 'mapa-barrio', name: 'Callejero detallado de tu barrio', mb: barrio, u: 55, hl: 4320 },
    { id: 'inundables', name: 'Zonas inundables de tu municipio', mb: 12, u: 8 * H({ riada: 6, maremoto: 4 }), hl: 8760 },
    { id: 'antenas', name: 'Antenas de telefonía de la región (datos abiertos)', mb: 4, u: 30 * H({ apagon: 1.5 }), hl: 2160 },
    { id: 'huellas', name: 'Huellas de cobertura de tus vecinos', mb: 3, u: 35 * H({ apagon: 1.4, monte: 1.3 }), hl: 6 },
    { id: 'avisos', name: 'Avisos oficiales y previsión meteorológica', mb: 0.6, u: 45 * H({ riada: 1.4, incendio: 1.3 }), hl: 6 },
    { id: 'orbitas', name: 'Órbitas de satélites para enviar el SOS', mb: 0.2, u: 30 * H({ monte: 2 }), hl: 72 },
    { id: 'rutas', name: 'Rutas de evacuación y senderos', mb: 8, u: 25 * H({ monte: 2, incendio: 1.6, maremoto: 1.8 }), hl: 4320 },
    { id: 'supervivencia', name: 'Guía sin luz ni agua (texto y audio)', mb: 30, u: 35 * H({ apagon: 1.6, terremoto: 1.3 }), hl: Infinity },
    { id: 'vecinos', name: 'Mapas de municipios vecinos para evacuar', mb: vecinos, u: 20 * H({ incendio: 1.5, riada: 1.3 }), hl: 4320 },
    { id: 'idiomas', name: 'Frases de emergencia en 12 idiomas con audio', mb: 18, u: 12, hl: Infinity },
    { id: 'wiki-medicina', name: 'Wikipedia temática de medicina (sin conexión, tamaño estimado)', mb: 450, u: 30, hl: 4320, estimate: true },
    { id: 'ninos', name: 'Cuentos y juegos sin conexión para niños', mb: 150, u: 12, hl: Infinity },
    { id: 'wiki-completa', name: 'Wikipedia completa en español sin imágenes', mb: 9000, u: 40, hl: 4320, estimate: true },
  ];
  return items.map((i) => ({ ...i, mb: +i.mb.toFixed(1), u: +i.u.toFixed(1) }));
}

/** Mochila 0/1 exacta con granularidad de 1 MB (lo esencial entra siempre si cabe). */
export function planReserve(items, budgetMB) {
  const ess = items.filter((i) => i.essential), rest = items.filter((i) => !i.essential);
  const essMB = ess.reduce((s, i) => s + Math.ceil(i.mb), 0), B = Math.max(0, Math.floor(budgetMB) - essMB);
  const w = rest.map((i) => Math.max(1, Math.ceil(i.mb))), v = rest.map((i) => i.u);
  const dp = new Float64Array(B + 1), take = rest.map(() => new Uint8Array(B + 1));
  rest.forEach((_, j) => { for (let c = B; c >= w[j]; c--) { const cand = dp[c - w[j]] + v[j]; if (cand > dp[c]) { dp[c] = cand; take[j][c] = 1; } } });
  const chosen = new Set(); let c = B;
  for (let j = rest.length - 1; j >= 0; j--) if (take[j][c]) { chosen.add(rest[j].id); c -= w[j]; }
  const pick = [...ess, ...rest.filter((i) => chosen.has(i.id))];
  const total = items.reduce((s, i) => s + i.u, 0), got = pick.reduce((s, i) => s + i.u, 0);
  return { chosen: pick, skipped: items.filter((i) => !pick.includes(i)), usedMB: +pick.reduce((s, i) => s + i.mb, 0).toFixed(1), value: got, coverage: +(got / total).toFixed(3), essentialOk: essMB <= budgetMB };
}

/** Valor que queda de la reserva tras `hours` sin conexión (la frescura decae). */
export const reserveValueAt = (chosen, hours) => chosen.reduce((s, i) => s + i.u * freshness((i.ageH ?? 0) + hours, i.hl), 0);
/** Horas hasta que lo URGENTE (semivida ≤ 72 h) pierde la mitad de su valor. */
export function urgentHalfLifeH(chosen) {
  const urg = chosen.filter((i) => i.hl <= 72); if (!urg.length) return Infinity;
  const v0 = reserveValueAt(urg, 0); let h = 0; while (h < 24 * 30 && reserveValueAt(urg, h) > v0 / 2) h += 0.25; return h;
}

/** Megas que caben en una ventana de conexión de `seconds` a `kbps`. */
export const windowMB = (seconds, kbps) => (seconds * kbps) / 8 / 1024;
/** Qué actualizar primero en una ventana corta: máximo valor recuperado por mega (avaro por densidad). */
export function refreshPlan(chosen, budgetMB) {
  const cand = chosen.map((i) => ({ ...i, gain: i.u * (1 - freshness(i.ageH ?? 0, i.hl)) })).filter((i) => i.gain > 0.01).sort((a, b) => b.gain / b.mb - a.gain / a.mb);
  const out = []; let left = budgetMB;
  for (const i of cand) if (i.mb <= left) { out.push({ id: i.id, name: i.name, mb: i.mb, gain: +i.gain.toFixed(1) }); left -= i.mb; }
  return { items: out, usedMB: +(budgetMB - left).toFixed(2), gain: +out.reduce((s, i) => s + i.gain, 0).toFixed(1) };
}

/** Megas recibidos por difusión unidireccional (p. ej. canal de datos por satélite de TV o radio digital). */
export const broadcastMB = (kbps, hours) => +((kbps * 3600 * hours) / 8 / 1024).toFixed(1);

/**
 * Intenciones: lo que el usuario pide sin red se guarda y sale en la primera ventana, por prioridad.
 * @param {Array<{id:string, kind:'enviar'|'consultar'|'sincronizar', priority:number, kb:number}>} intents
 */
export function drainIntents(intents, windowKB) {
  const order = [...intents].sort((a, b) => a.priority - b.priority || a.kb - b.kb), sent = [], left = [];
  let cap = windowKB; for (const it of order) { if (it.kb <= cap) { sent.push(it.id); cap -= it.kb; } else left.push(it.id); }
  return { sent, left, usedKB: windowKB - cap };
}
