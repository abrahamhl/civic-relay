/**
 * SENDA · Malla de voz: llamadas y salas de grupo entre teléfonos que NO se alcanzan todos entre sí.
 *
 * Problema físico: un punto de acceso de móvil cubre unas decenas de metros en interior; en un
 * edificio dañado, la persona de la 4.ª planta no alcanza al equipo de la calle. Pero sí alcanza a
 * un vecino de la escalera, que alcanza a otro… Cada teléfono intermedio puede REENVIAR la voz
 * (WebRTC permite reenviar una pista de audio recibida por otra conexión) y el chat.
 *
 * Tres ideas que hacen que escale en el mundo real:
 *  1. ÁRBOL, no malla completa: se elige un árbol de expansión que minimiza los saltos máximos;
 *     solo los nodos interiores (repetidores) reenvían.
 *  2. TURNO DE PALABRA (walkie-talkie): como en la radio profesional, habla una persona a la vez,
 *     así que cada enlace lleva como mucho UN flujo de voz por sentido, sea cual sea el tamaño de
 *     la sala. Sin turno, el tráfico crecería con el número de personas que hablan a la vez.
 *  3. BATERÍA: un teléfono con poca batería nunca hace de repetidor (solo de hoja); cuando la
 *     batería de un repetidor baja, el plan se recalcula y avisa si alguien queda aislado (para
 *     enviar una mula, un dron con punto de acceso o una pasarela LoRa).
 *
 * Honestidad: DTLS-SRTP cifra salto a salto; el repetidor oye la voz, como en una conferencia.
 * El TEXTO sí puede ir cifrado de extremo a extremo con el sobre SENDA (el repetidor solo ve
 * bytes). Los kbit/s son de configuración (Opus admite de 6 a 510 kbit/s, RFC 6716).
 */

export const OPUS_VOICE_KBPS = 24;

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Grafo de enlaces utilizables (calidad ≥ minQuality). */
function graph(nodes, links, minQuality) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const [a, b, q = 1] of links) if (q >= minQuality && adj.has(a) && adj.has(b)) { adj.get(a).push(b); adj.get(b).push(a); }
  for (const v of adj.values()) v.sort();
  return adj;
}

/** BFS desde root en la que solo los nodos que pueden repetir se expanden. */
function bfsTree(root, adj, canRelay) {
  const parent = new Map([[root, null]]), depth = new Map([[root, 0]]), q = [root];
  while (q.length) {
    const u = q.shift(); if (u !== root && !canRelay(u)) continue; // sin batería: hoja, no reenvía
    for (const v of adj.get(u)) if (!parent.has(v)) { parent.set(v, u); depth.set(v, depth.get(u) + 1); q.push(v); }
  }
  return { parent, depth };
}

function treeDiameter(parent) {
  const adj = new Map([...parent.keys()].map((k) => [k, []]));
  for (const [v, p] of parent) if (p != null) { adj.get(v).push(p); adj.get(p).push(v); }
  const far = (s) => { const d = new Map([[s, 0]]), q = [s]; let best = s; while (q.length) { const u = q.shift(); for (const w of adj.get(u)) if (!d.has(w)) { d.set(w, d.get(u) + 1); q.push(w); if (d.get(w) > d.get(best)) best = w; } } return [best, d.get(best)]; };
  const [a] = far([...parent.keys()][0]); return far(a)[1];
}

/**
 * Plan de la sala de voz.
 * @param {Array<{id:string, battery:number}>} nodes  batería 0–1
 * @param {Array<[string,string,number]>} links        enlaces [a, b, calidad 0–1]
 * @returns {{root, parent, depth, relays:string[], maxHops:number, unreachable:string[], uplinkKbps:Object, edges:string[][]}}
 */
export function planVoiceMesh(nodes, links, { minBattery = 0.2, minQuality = 0.3, kbps = OPUS_VOICE_KBPS } = {}) {
  const adj = graph(nodes, links, minQuality), bat = new Map(nodes.map((n) => [n.id, n.battery]));
  const canRelay = (id) => bat.get(id) >= minBattery;
  let best = null;
  for (const n of [...nodes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!canRelay(n.id)) continue;
    const t = bfsTree(n.id, adj, canRelay), reach = t.parent.size, ecc = Math.max(...t.depth.values());
    const score = [reach, -treeDiameter(t.parent), -ecc, bat.get(n.id)];
    if (!best || cmp(score, best.score) > 0) best = { root: n.id, ...t, score }; // empate: id menor
  }
  if (!best) return { root: null, parent: new Map(), depth: new Map(), relays: [], maxHops: 0, unreachable: nodes.map((n) => n.id), uplinkKbps: {}, edges: [] };
  const children = new Map(); for (const [v, p] of best.parent) if (p != null) children.set(p, (children.get(p) ?? 0) + 1);
  const relays = [...children.keys()].filter((id) => children.get(id) + (best.parent.get(id) != null ? 1 : 0) >= 2).sort();
  const degree = (id) => (children.get(id) ?? 0) + (best.parent.get(id) != null ? 1 : 0);
  const uplinkKbps = Object.fromEntries([...best.parent.keys()].map((id) => [id, degree(id) * kbps])); // peor caso: habla él y envía por todos sus enlaces
  const edges = [...best.parent].filter(([, p]) => p != null).map(([v, p]) => [p, v]);
  return { root: best.root, parent: best.parent, depth: best.depth, relays, maxHops: treeDiameter(best.parent), unreachable: nodes.map((n) => n.id).filter((id) => !best.parent.has(id)).sort(), uplinkKbps, edges };
}
function cmp(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; return 0; }

/** Camino entre dos participantes dentro del árbol (para saber qué teléfonos reenvían). */
export function routeBetween(plan, a, b) {
  const up = (x) => { const p = [x]; while (plan.parent.get(p[p.length - 1]) != null) p.push(plan.parent.get(p[p.length - 1])); return p; };
  if (!plan.parent.has(a) || !plan.parent.has(b)) return null;
  const pa = up(a), pb = up(b), sb = new Set(pb); const lca = pa.find((x) => sb.has(x));
  return [...pa.slice(0, pa.indexOf(lca) + 1), ...pb.slice(0, pb.indexOf(lca)).reverse()];
}

/**
 * Flujos de voz por enlace cuando hablan `talkers` a la vez. En un árbol, el flujo de cada persona
 * que habla cruza cada enlace exactamente una vez, así que la carga de cada enlace = nº de personas
 * hablando: con turno de palabra, 1; sin turno, crece con la sala.
 */
export function streamsPerLink(plan, talkers) {
  const n = talkers.filter((t) => plan.parent.has(t)).length;
  return new Map(plan.edges.map(([a, b]) => [key(a, b), n]));
}

/**
 * Turno de palabra determinista (como el «pulsar para hablar» de la radio): primero en pedir,
 * primero en hablar; empate → id menor. Turno máximo para que nadie bloquee el canal.
 */
export function floorControl({ maxTalkS = 30 } = {}) {
  let holder = null, since = 0; const queue = [];
  const grantNext = (t) => { queue.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); const n = queue.shift(); holder = n ? n.id : null; since = t; return holder; };
  return {
    get holder() { return holder; }, get queue() { return queue.map((q) => q.id); },
    request(id, t) { if (holder === id || queue.some((q) => q.id === id)) return holder; if (holder == null) { holder = id; since = t; } else queue.push({ id, t }); return holder; },
    release(id, t) { if (holder === id) return grantNext(t); const i = queue.findIndex((q) => q.id === id); if (i >= 0) queue.splice(i, 1); return holder; },
    tick(t) { if (holder != null && t - since >= maxTalkS) return grantNext(t); return holder; },
  };
}

/** Recalcula al cambiar las baterías y dice qué cambió (repetidores nuevos/retirados, aislados). */
export function replanOnBattery(nodes, links, prev, opts) {
  const plan = planVoiceMesh(nodes, links, opts);
  const was = new Set(prev.relays), now = new Set(plan.relays);
  return { plan, retired: [...was].filter((x) => !now.has(x)), added: [...now].filter((x) => !was.has(x)), isolated: plan.unreachable.filter((x) => !prev.unreachable.includes(x)) };
}

/**
 * Escenario de referencia: edificio de 5 plantas tras un sismo, el equipo de rescate en la calle.
 * Enlaces por planta (fuertes) y por la escalera (débiles). Ilustrativo, determinista.
 */
export function voiceMeshScenario() {
  const nodes = [
    { id: 'Ana', floor: 4, x: 0.15, battery: 0.8 }, { id: 'Luis', floor: 4, x: 0.7, battery: 0.3 },
    { id: 'Marta', floor: 3, x: 0.75, battery: 0.12 }, { id: 'Iker', floor: 3, x: 0.2, battery: 0.7 },
    { id: 'Sara', floor: 2, x: 0.25, battery: 0.9 }, { id: 'Vecina', floor: 2, x: 0.8, battery: 0.6 },
    { id: 'Juan', floor: 1, x: 0.35, battery: 0.5 }, { id: 'Portero', floor: 0, x: 0.6, battery: 0.45 },
    { id: 'Equipo', floor: -1, x: 0.5, battery: 1 },
  ];
  const links = [
    ['Ana', 'Luis', 0.9], ['Ana', 'Iker', 0.5], ['Luis', 'Marta', 0.6], ['Marta', 'Iker', 0.8],
    ['Iker', 'Sara', 0.6], ['Sara', 'Vecina', 0.9], ['Sara', 'Juan', 0.5], ['Vecina', 'Juan', 0.35],
    ['Juan', 'Portero', 0.7], ['Vecina', 'Portero', 0.32], ['Portero', 'Equipo', 0.85], ['Luis', 'Vecina', 0.2],
  ];
  return { nodes, links };
}
