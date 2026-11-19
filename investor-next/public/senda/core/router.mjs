/**
 * Enrutador por grafo de contactos (Contact Graph Routing, como en redes tolerantes a
 * retardos de la NASA/CCSDS), adaptado a emergencias.
 *
 * Un CONTACTO es una oportunidad real de mover datos: «el teléfono de Pedro ve al de
 * Ismael por Bluetooth de 10:00 a 10:40», «el satélite pasa sobre Ismael de 10:12 a
 * 10:19», «María tiene Internet por satélite todo el día». El enrutador calcula la
 * LLEGADA MÁS TEMPRANA posible al destinatario combinando cualquier secuencia de
 * contactos, y lanza en paralelo varias rutas independientes (carrera multicanal):
 * la primera que entrega gana y el receptor descarta duplicados.
 *
 * Diferencia con WhatsApp: WhatsApp solo entrega cuando el teléfono del destinatario
 * recupera SU propia conexión. SENDA entrega en cuanto existe CUALQUIER cadena de
 * contactos hasta él (un vecino con satélite + Bluetooth, un SMS que sí entra, un paso
 * de satélite directo al móvil...). Si no existe ninguna, lo dice: NO_ROUTE.
 */
import { CHANNELS, transferSeconds, fragmentsNeeded } from './channels.mjs';

/**
 * @typedef {{id?:string, from:string, to:string, channel:keyof CHANNELS, start:number, end:number,
 *   rateBps?:number, confidence?:number, measured?:boolean}} Contact  tiempos en segundos absolutos
 */

/** Valida y normaliza contactos (descarta los imposibles en vez de fallar en silencio). */
export function normalizeContacts(contacts) {
  return contacts.map((c, i) => {
    if (!CHANNELS[c.channel]) throw new Error(`Contacto ${i}: canal desconocido ${c.channel}`);
    if (!(c.end > c.start)) throw new Error(`Contacto ${i}: ventana vacía`);
    return { id: c.id ?? `c${i}`, confidence: 1, measured: false, ...c };
  });
}

/**
 * Llegada más temprana de `source` a `dest` saliendo en `t0` (Dijkstra sobre tiempo).
 * @returns {{eta:number, hops:Array, confidence:number}|null}
 */
export function earliestArrival({ contacts, source, dest, t0, sizeBytes = 512, exclude = new Set(), minConfidence = 0 }) {
  const best = new Map([[source, t0]]);
  const prev = new Map();
  const conf = new Map([[source, 1]]);
  const done = new Set();
  const byFrom = new Map();
  for (const c of contacts) {
    if (exclude.has(c.id) || c.confidence < minConfidence) continue;
    if (!byFrom.has(c.from)) byFrom.set(c.from, []);
    byFrom.get(c.from).push(c);
  }
  while (true) {
    let u = null, tu = Infinity;
    for (const [n, t] of best) if (!done.has(n) && t < tu) { u = n; tu = t; }
    if (u === null) return null;
    if (u === dest) break;
    done.add(u);
    for (const c of byFrom.get(u) ?? []) {
      if (done.has(c.to) || c.end <= tu) continue;
      const frags = fragmentsNeeded(c.channel, sizeBytes);
      const depart = Math.max(tu, c.start);
      const arrive = depart + frags * transferSeconds(c.channel, Math.min(sizeBytes, CHANNELS[c.channel].maxBytes), c.rateBps);
      if (arrive > c.end) continue; // no cabe en la ventana del contacto
      if (arrive < (best.get(c.to) ?? Infinity)) {
        best.set(c.to, arrive); prev.set(c.to, { contact: c, depart, arrive });
        conf.set(c.to, conf.get(u) * c.confidence);
      }
    }
  }
  const hops = [];
  for (let n = dest; n !== source; n = prev.get(n).contact.from) hops.unshift(prev.get(n));
  return { eta: best.get(dest), hops, confidence: conf.get(dest) };
}

/**
 * Hasta `k` rutas lo más independientes posible: tras cada ruta se excluyen sus
 * contactos para forzar caminos alternativos (diversidad frente a fallos).
 */
export function planRoutes({ contacts, source, dest, t0, sizeBytes = 512, k = 3 }) {
  const cs = normalizeContacts(contacts);
  const exclude = new Set();
  const routes = [];
  for (let i = 0; i < k; i++) {
    const r = earliestArrival({ contacts: cs, source, dest, t0, sizeBytes, exclude });
    if (!r) break;
    routes.push({ ...r, channels: [...new Set(r.hops.map((h) => h.contact.channel))], path: [source, ...r.hops.map((h) => h.contact.to)] });
    // Se excluyen los contactos de la ruta salvo el primer salto (la salida del emisor,
    // compartida por todas las rutas), para que la siguiente use relés distintos.
    r.hops.slice(1).forEach((h) => exclude.add(h.contact.id));
    if (r.hops.length === 1) exclude.add(r.hops[0].contact.id);
  }
  return routes;
}

/**
 * Línea base «WhatsApp»: el servidor ya tiene el mensaje, pero solo entrega cuando el
 * destinatario recupera conectividad PROPIA de datos (CELL_DATA o Wi-Fi con Internet).
 */
export function baselineDirectDelivery({ contacts, dest, t0, ownUplinks = ['CELL_DATA', 'SAT_BROADBAND'] }) {
  const own = normalizeContacts(contacts).filter((c) => c.to === dest && c.from === 'INTERNET' && ownUplinks.includes(c.channel) && c.end > t0);
  if (!own.length) return null;
  return Math.max(t0, Math.min(...own.map((c) => c.start))) + 1;
}

/**
 * Plan completo de envío: carrera multicanal + comparación con la línea base.
 * Estados honestos: DELIVERABLE (hay ruta), NO_ROUTE (no existe cadena de contactos).
 */
export function routeMessage({ contacts, source, dest, t0, sizeBytes = 512, k = 3 }) {
  const routes = planRoutes({ contacts, source, dest, t0, sizeBytes, k });
  const baseline = baselineDirectDelivery({ contacts, dest, t0 });
  if (!routes.length) {
    return { status: 'NO_ROUTE', routes: [], eta: null, baselineEta: baseline, advantageS: null,
      explanation: 'No existe ninguna cadena de contactos hasta el destinatario. El mensaje queda cifrado en el emisor y se reintenta cuando aparezca una.' };
  }
  const eta = Math.min(...routes.map((r) => r.eta));
  const pDelivery = 1 - routes.reduce((p, r) => p * (1 - r.confidence), 1);
  const faster = routes.filter((r) => baseline === null || r.eta < baseline);
  const pBeforeBaseline = 1 - faster.reduce((p, r) => p * (1 - r.confidence), 1);
  return {
    status: 'DELIVERABLE', routes, eta, etaSeconds: eta - t0,
    baselineEta: baseline, baselineSeconds: baseline === null ? null : baseline - t0,
    advantageS: baseline === null ? Infinity : baseline - eta,
    deliveryProbability: pDelivery,
    probabilityBeforeBaseline: pBeforeBaseline,
    explanation: `Carrera por ${routes.length} ruta(s) en paralelo; la primera en entregar gana y el receptor deduplica.`,
  };
}
