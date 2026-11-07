import { CHANNELS, transferSeconds, fragmentsNeeded } from './channels.mjs';
import { earliestArrival, normalizeContacts } from './router.mjs';

export const STRATEGIES = Object.freeze(['direct', 'flooding', 'epidemic', 'spray', 'earliest', 'adaptive']);
export const SCENARIO_NAMES = Object.freeze(['scheduled-line', 'scheduled-partition', 'crowd', 'energy-scarce', 'held-out']);
export const SCENARIO_NOTES = Object.freeze({
  'scheduled-line': 'Cadena lineal de contactos con ventanas escalonadas; no hay enlace directo S→T.',
  'scheduled-partition': 'Dos grupos separados que solo se comunican por una mula/ferry con ventana tardía.',
  crowd: 'Multitud con contactos aleatorios sembrados y atajos; sin enlace directo S→T.',
  'energy-scarce': 'Ruta WiFi Direct rápida y cara frente a cadena BLE lenta y barata.',
  'held-out': 'Grafo aleatorio sembrado no usado para ajustar estrategias; sin enlace directo S→T.',
});

const contact = (from, to, start, end, channel = 'BLE') => ({ from, to, start, end, channel });

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function heldOut(seed) {
  const r = lcg(seed + 99991);
  const contacts = [];
  let t = 20;
  contacts.push(contact('S', 'I0', 0, 40));
  for (let i = 0; i < 10; i++) {
    t += 30 + Math.floor(r() * 50);
    const ch = ['BLE', 'LORA', 'SMS'][Math.floor(r() * 3)];
    contacts.push(contact(`I${i}`, `I${i + 1}`, t, t + 35 + Math.floor(r() * 40), ch));
  }
  contacts.push(contact('I10', 'T', t + 90, t + 140));
  for (let k = 0; k < 8; k++) {
    const a = Math.floor(r() * 11), b = Math.floor(r() * 11);
    if (a === b) continue;
    const start = 80 + Math.floor(r() * (t + 60));
    contacts.push(contact(`I${a}`, `I${b}`, start, start + 30 + Math.floor(r() * 50), ['BLE', 'LORA'][Math.floor(r() * 2)]));
  }
  return { contacts, source: 'S', dest: 'T', t0: 0, tEnd: t + 360, sizeBytes: 512, note: SCENARIO_NOTES['held-out'] };
}

export function buildScenario(name, { seed = 1 } = {}) {
  if (!SCENARIO_NAMES.includes(name)) throw new Error(`Escenario desconocido: ${name}`);
  if (name === 'scheduled-line') {
    return { contacts: [contact('S', 'A', 0, 40), contact('A', 'B', 200, 240), contact('B', 'C', 400, 440), contact('C', 'T', 600, 640)], source: 'S', dest: 'T', t0: 0, tEnd: 900, sizeBytes: 512, note: SCENARIO_NOTES[name] };
  }
  if (name === 'scheduled-partition') {
    return { contacts: [contact('S', 'A', 0, 30), contact('A', 'B', 100, 130), contact('B', 'F', 300, 330), contact('F', 'C', 500, 530), contact('C', 'T', 700, 730)], source: 'S', dest: 'T', t0: 0, tEnd: 950, sizeBytes: 512, note: SCENARIO_NOTES[name] };
  }
  if (name === 'energy-scarce') {
    return {
      contacts: [
        contact('S', 'W1', 0, 20, 'WIFI_DIRECT'), contact('W1', 'T', 100, 120, 'WIFI_DIRECT'),
        contact('S', 'A', 30, 60), contact('A', 'B', 130, 160), contact('B', 'T', 230, 260),
      ],
      source: 'S', dest: 'T', t0: 0, tEnd: 420, sizeBytes: 512, note: SCENARIO_NOTES[name],
    };
  }
  if (name === 'crowd') {
    const r = lcg(seed + 3571);
    const contacts = [contact('S', 'I0', 0, 30), contact('S', 'I1', 5, 35), contact('S', 'I2', 10, 40)];
    for (let i = 0; i < 11; i++) contacts.push(contact(`I${i}`, `I${i + 1}`, 60 + i * 25, 95 + i * 25));
    contacts.push(contact('I11', 'T', 360, 390));
    contacts.push(contact('I4', 'T', 220, 250));
    contacts.push(contact('I8', 'T', 300, 330));
    for (let k = 0; k < 10; k++) {
      const a = 1 + Math.floor(r() * 11), b = 1 + Math.floor(r() * 11);
      if (a === b) continue;
      const start = 80 + Math.floor(r() * 260);
      contacts.push(contact(`I${a}`, `I${b}`, start, start + 40 + Math.floor(r() * 50)));
    }
    return { contacts, source: 'S', dest: 'T', t0: 0, tEnd: 700, sizeBytes: 512, note: SCENARIO_NOTES[name] };
  }
  return heldOut(seed);
}

export function simulateRouting({
  contacts, source, dest, strategy, t0 = 0, tEnd = 1000, sizeBytes = 512,
  seed = 1, sprayCopies = 16, adaptiveCopies = 12,
} = {}) {
  if (!STRATEGIES.includes(strategy)) throw new Error(`Estrategia desconocida: ${strategy}`);
  const cs = normalizeContacts(contacts);
  if (!source || !dest) throw new Error('Faltan source/dest');
  const planned = strategy === 'earliest' ? earliestArrival({ contacts: cs, source, dest, t0, sizeBytes }) : null;
  const edges = new Set((planned?.hops ?? []).map((h) => `${h.contact.from}->${h.contact.to}`));

  const holders = new Map([[source, { copies: strategy === 'spray' ? sprayCopies : 1, depth: 0 }]]);
  const stats = {
    strategy, seed, source, dest, t0, tEnd, contactCount: cs.length,
    delivered: false, deliveredAt: null, latencyS: null, hopCount: null,
    transfers: 0, uniqueTransfers: 0, duplicateSends: 0, duplicateArrivals: 0,
    bytesOnAir: 0, energyProxy: 0,
    dropReasons: { NO_HOLDER: 0, WINDOW_TOO_SMALL: 0, HORIZON: 0, ALREADY_HAS: 0, COPY_LIMIT: 0, ROUTE_FILTER: 0, ENERGY_POLICY: 0, NO_ROUTE: 0, DIRECT_ONLY: 0 },
  };

  const queue = cs.map((c, index) => ({ time: c.start, kind: 'contact', index, contact: c }))
    .filter((e) => e.time <= tEnd)
    .sort((a, b) => a.time - b.time || a.index - b.index);
  const push = (event) => {
    let lo = 0, hi = queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const q = queue[mid];
      if (q.time < event.time || (q.time === event.time && (q.kind === 'arrive' || event.kind === 'contact'))) lo = mid + 1;
      else hi = mid;
    }
    queue.splice(lo, 0, event);
  };

  const send = (event, give = 1, allowDuplicate = false) => {
    const c = event.contact;
    const spec = CHANNELS[c.channel];
    const frags = fragmentsNeeded(c.channel, sizeBytes);
    const duration = frags * transferSeconds(c.channel, Math.min(sizeBytes, spec.maxBytes), c.rateBps);
    const arrive = event.time + duration;
    if (arrive > c.end) { stats.dropReasons.WINDOW_TOO_SMALL++; return false; }
    if (arrive > tEnd) { stats.dropReasons.HORIZON++; return false; }
    if (holders.has(c.to) && !allowDuplicate) { stats.duplicateSends++; return false; }
    stats.transfers++;
    stats.bytesOnAir += sizeBytes * frags;
    stats.energyProxy += spec.energy * frags;
    if (allowDuplicate) { stats.duplicateSends++; return false; }
    push({ time: arrive, kind: 'arrive', to: c.to, from: c.from, depth: holders.get(c.from).depth + 1, copies: give });
    return true;
  };

  while (queue.length) {
    const event = queue.shift();
    if (event.time > tEnd) break;
    if (event.kind === 'arrive') {
      if (holders.has(event.to)) { stats.duplicateArrivals++; continue; }
      holders.set(event.to, { copies: event.copies, depth: event.depth });
      stats.uniqueTransfers++;
      if (event.to === dest) {
        stats.delivered = true;
        stats.deliveredAt = event.time;
        stats.latencyS = event.time - t0;
        stats.hopCount = event.depth;
        break;
      }
      continue;
    }
    const c = event.contact;
    const holder = holders.get(c.from);
    if (!holder) { stats.dropReasons.NO_HOLDER++; continue; }
    const already = holders.has(c.to);
    if (strategy === 'direct') {
      if (c.from !== source || c.to !== dest) { stats.dropReasons.DIRECT_ONLY++; continue; }
      if (already) { stats.dropReasons.ALREADY_HAS++; continue; }
      send(event);
      continue;
    }
    if (strategy === 'earliest') {
      if (!edges.has(`${c.from}->${c.to}`)) { stats.dropReasons.ROUTE_FILTER++; continue; }
      if (already) { stats.dropReasons.ALREADY_HAS++; continue; }
      send(event);
      continue;
    }
    if (strategy === 'flooding') {
      if (already) { send(event, 1, true); continue; }
      send(event);
      continue;
    }
    if (strategy === 'epidemic') {
      if (already) { stats.dropReasons.ALREADY_HAS++; continue; }
      send(event);
      continue;
    }
    if (strategy === 'spray') {
      if (already) { stats.dropReasons.ALREADY_HAS++; continue; }
      if (c.to === dest) { if (holder.copies < 1) { stats.dropReasons.COPY_LIMIT++; continue; } if (send(event, 1)) holder.copies = Math.max(0, holder.copies - 1); continue; }
      if (holder.copies > 1) {
        const give = Math.max(1, Math.floor(holder.copies / 2));
        if (send(event, give)) holder.copies -= give;
        continue;
      }
      stats.dropReasons.COPY_LIMIT++;
      continue;
    }
    if (already) { stats.dropReasons.ALREADY_HAS++; continue; }
    if (c.to !== dest && CHANNELS[c.channel].energy >= 3) { stats.dropReasons.ENERGY_POLICY++; continue; }
    if (c.to !== dest && holders.size >= adaptiveCopies) { stats.dropReasons.COPY_LIMIT++; continue; }
    const next = earliestArrival({ contacts: cs, source: c.to, dest, t0: event.time, sizeBytes });
    if (!next || next.eta > tEnd) { stats.dropReasons.NO_ROUTE++; continue; }
    send(event);
  }

  stats.endReason = stats.delivered ? 'DELIVERED' : 'NO_DELIVERY_BY_HORIZON';
  stats.overheadRatio = stats.uniqueTransfers ? stats.transfers / stats.uniqueTransfers : null;
  stats.plannedEta = planned?.eta ?? null;
  return stats;
}

export function runBenchmark({ seeds = 20, seedBase = 20261107, scenarios = SCENARIO_NAMES, strategies = STRATEGIES, sizeBytes = 512 } = {}) {
  const rows = [];
  for (const scenario of scenarios) {
    for (const strategy of strategies) {
      const runs = [];
      for (let i = 0; i < seeds; i++) {
        const s = seedBase + i * 104729;
        const sc = buildScenario(scenario, { seed: s });
        runs.push(simulateRouting({ ...sc, strategy, sizeBytes: sc.sizeBytes ?? sizeBytes, seed: s }));
      }
      rows.push({ scenario, strategy, runs });
    }
  }
  return rows;
}
