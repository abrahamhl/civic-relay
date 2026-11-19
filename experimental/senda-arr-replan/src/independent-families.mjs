/**
 * SENDA A2 (H-ARR-R) — Three independent topological families NOT derived from `arr-sim.mjs` generator.
 * Ensures fair evaluation with explicit SRLG shared-risk domains, mobility ferry encounters,
 * EU868 airtime saturation, and adversarial N-2 / blackout faults.
 */
import { mulberry32, gaussian, normalCdf } from '../../senda-arr/src/arr-sim.mjs';

const HOUR = 3_600_000;

function makeContact(id, from, to, startMs, endMs, { bearer = 'LORA', rateBps = 25, handshakeMs = 1200, energyMj = 210, p = 0.9 } = {}) {
  return {
    id,
    from,
    to,
    kind: 'ACTIVE_RADIO',
    bearer,
    authorized: true,
    enabled: true,
    dutyCycleAllowed: true,
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
    rateBytesPerSec: rateBps,
    handshakeMs,
    energyMj,
    probabilityLowerBound: p,
  };
}

/** Family 1: Scheduled mobility corridor + encounter variability (tests PRoPHET / Spray / Replan). */
export function buildMobilityCorridorFamily(seed, { horizonMs = 10 * HOUR, payloadBytes = 200 } = {}) {
  const rng = mulberry32(seed ^ 0x13572468);
  const nodes = [
    { id: 'SRC', role: 'SENDER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['GRID_SRC'] },
    { id: 'DST', role: 'RECEIVER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['GRID_DST'] },
  ];
  for (let i = 0; i < 8; i++) {
    nodes.push({ id: `M${i}`, role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: [`DOM_${i % 3}`] });
  }
  for (let i = 0; i < 6; i++) {
    nodes.push({ id: `GW${i}`, role: 'GATEWAY', consent: true, powered: true, radioEnabled: true, srlgDomains: [`DOM_${i % 2}`] });
  }
  const contacts = [];
  let cid = 0;
  // Early windows with stochastic ferry passes + repeated encounters so PRoPHET can learn
  for (let w = 0; w < 4; w++) {
    const tBase = w * 2.2 * HOUR;
    for (let i = 0; i < 4; i++) {
      const m = `M${i}`, m2 = `M${4 + ((i + w) % 4)}`, gw = `GW${(i + w) % 6}`;
      contacts.push(makeContact(`mc${cid++}`, 'SRC', m, tBase + 5 * 60_000, tBase + 18 * 60_000, { p: 0.92, energyMj: 120 }));
      contacts.push(makeContact(`mc${cid++}`, m, gw, tBase + 25 * 60_000, tBase + 40 * 60_000, { p: 0.88, energyMj: 150 }));
      contacts.push(makeContact(`mc${cid++}`, m, m2, tBase + 35 * 60_000, tBase + 52 * 60_000, { p: 0.90, energyMj: 110 }));
      contacts.push(makeContact(`mc${cid++}`, gw, 'DST', tBase + 55 * 60_000, tBase + 75 * 60_000, { p: 0.91, energyMj: 180 }));
      contacts.push(makeContact(`mc${cid++}`, m2, 'DST', tBase + 70 * 60_000, tBase + 90 * 60_000, { p: 0.87, energyMj: 190 }));
    }
  }
  // Ensemble of 48 regional hazard scenarios
  const ensemble = Array.from({ length: 48 }, () => {
    const z = gaussian(rng);
    const dead = {};
    for (const n of nodes) {
      if (n.id === 'SRC' || n.id === 'DST') continue;
      if (normalCdf(0.75 * z + 0.66 * gaussian(rng)) < 0.34) dead[n.id] = Math.round((0.15 + 0.7 * rng()) * horizonMs);
    }
    return { nodeDeathMs: dead, contactFactor: {}, weight: 1 };
  });
  const truthZ = gaussian(rng);
  const truth = { nodeDeathMs: {}, contactFactor: {} };
  for (const n of nodes) {
    if (n.id === 'SRC' || n.id === 'DST') continue;
    if (normalCdf(0.75 * truthZ + 0.66 * gaussian(rng)) < 0.38) truth.nodeDeathMs[n.id] = Math.round((0.1 + 0.65 * rng()) * horizonMs);
  }
  return { family: 'MOBILITY_CORRIDOR', nodes, contacts, source: 'SRC', destination: 'DST', startMs: 0, deadlineMs: horizonMs, payloadBytes, ensemble, truth };
}

/** Family 2: SRLG shared-risk blackout corridors (primary fast gateways share a vulnerable power/backhaul domain). */
export function buildSrlgBlackoutFamily(seed, { horizonMs = 8 * HOUR, payloadBytes = 200 } = {}) {
  const rng = mulberry32(seed ^ 0x9b4d7c12);
  const nodes = [
    { id: 'SRC', role: 'SENDER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['SRC_SOLAR'] },
    { id: 'DST', role: 'RECEIVER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['DST_BACKUP'] },
    // Fast primary corridor sharing TRUNK_POWER_A (high outage hazard!)
    { id: 'A1', role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['TRUNK_POWER_A'] },
    { id: 'A2', role: 'GATEWAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['TRUNK_POWER_A', 'BACKHAUL_X'] },
    { id: 'A3', role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['TRUNK_POWER_A'] },
    // Secondary independent battery corridor sharing BATTERY_B
    { id: 'B1', role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['BATTERY_B1'] },
    { id: 'B2', role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['BATTERY_B2'] },
    { id: 'C1', role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['SRLG_C1'] },
    { id: 'C2', role: 'GATEWAY', consent: true, powered: true, radioEnabled: true, srlgDomains: ['SRLG_C2'] },
  ];
  const contacts = [];
  let cid = 0;
  for (let w = 0; w < 3; w++) {
    const t = w * 2.1 * HOUR;
    // Fast but SRLG-coupled primary
    contacts.push(makeContact(`sb${cid++}`, 'SRC', 'A1', t + 60_000, t + 20 * 60_000, { p: 0.96, energyMj: 90, rateBps: 120 }));
    contacts.push(makeContact(`sb${cid++}`, 'A1', 'A2', t + 21 * 60_000, t + 40 * 60_000, { p: 0.96, energyMj: 90, rateBps: 120 }));
    contacts.push(makeContact(`sb${cid++}`, 'A2', 'DST', t + 41 * 60_000, t + 60 * 60_000, { p: 0.96, energyMj: 90, rateBps: 120 }));
    contacts.push(makeContact(`sb${cid++}`, 'A1', 'A3', t + 22 * 60_000, t + 38 * 60_000, { p: 0.95, energyMj: 90 }));
    contacts.push(makeContact(`sb${cid++}`, 'A3', 'DST', t + 45 * 60_000, t + 70 * 60_000, { p: 0.94, energyMj: 100 }));
    // Divergent lower-margin independent paths (slightly later ETA so blind earliest CGR picks A1->A2)
    contacts.push(makeContact(`sb${cid++}`, 'SRC', 'B1', t + 5 * 60_000, t + 28 * 60_000, { p: 0.90, energyMj: 140 }));
    contacts.push(makeContact(`sb${cid++}`, 'B1', 'B2', t + 32 * 60_000, t + 58 * 60_000, { p: 0.89, energyMj: 140 }));
    contacts.push(makeContact(`sb${cid++}`, 'B2', 'DST', t + 62 * 60_000, t + 95 * 60_000, { p: 0.90, energyMj: 150 }));
    contacts.push(makeContact(`sb${cid++}`, 'SRC', 'C1', t + 10 * 60_000, t + 35 * 60_000, { p: 0.88, energyMj: 150 }));
    contacts.push(makeContact(`sb${cid++}`, 'C1', 'C2', t + 40 * 60_000, t + 65 * 60_000, { p: 0.88, energyMj: 150 }));
    contacts.push(makeContact(`sb${cid++}`, 'C2', 'DST', t + 72 * 60_000, t + 105 * 60_000, { p: 0.90, energyMj: 160 }));
  }

  const sampleShock = (r) => {
    const dead = {};
    if (r() < 0.62) {
      const tCut = Math.round((0.05 + 0.45 * r()) * horizonMs);
      dead.A1 = tCut; dead.A2 = tCut; dead.A3 = tCut;
    }
    if (r() < 0.28) { const tc = Math.round((0.2 + 0.5 * r()) * horizonMs); dead.B1 = tc; dead.B2 = tc; }
    if (r() < 0.25) { const tc = Math.round((0.2 + 0.5 * r()) * horizonMs); dead.C1 = tc; }
    return { nodeDeathMs: dead, contactFactor: {}, weight: 1 };
  };
  const ensemble = Array.from({ length: 48 }, () => sampleShock(rng));
  const truth = sampleShock(rng);
  return { family: 'SRLG_CORRELATED_BLACKOUT', nodes, contacts, source: 'SRC', destination: 'DST', startMs: 0, deadlineMs: horizonMs, payloadBytes, ensemble, truth };
}

/** Family 3: EU868 congested SRD airtime-limited network (penalizes blind epidemic bloat). */
export function buildCongestedSrdFamily(seed, { horizonMs = 6 * HOUR, payloadBytes = 200 } = {}) {
  const rng = mulberry32(seed ^ 0x4e8a2f01);
  const nodes = [
    { id: 'SRC', role: 'SENDER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['SITE_0'] },
    { id: 'DST', role: 'RECEIVER', consent: true, powered: true, radioEnabled: true, srlgDomains: ['SITE_END'] },
  ];
  for (let i = 0; i < 10; i++) {
    nodes.push({ id: `R${i}`, role: 'RELAY', consent: true, powered: true, radioEnabled: true, srlgDomains: [`CH_${i % 4}`] });
  }
  const contacts = [];
  let cid = 0;
  // Low-p noisy early broadcast relays (tempt flooding/epidemic into burning strict airtime budget!)
  for (let i = 0; i < 5; i++) {
    contacts.push(makeContact(`cs${cid++}`, 'SRC', `R${i}`, 60_000 + i * 30_000, 15 * 60_000 + i * 30_000, { rateBps: 8, energyMj: 420, p: 0.40 }));
    contacts.push(makeContact(`cs${cid++}`, `R${i}`, 'DST', 20 * 60_000 + i * 60_000, 40 * 60_000 + i * 60_000, { rateBps: 8, energyMj: 420, p: 0.35 }));
  }
  // Cleaner multi-hop or delayed high-SNR path arriving mid-horizon
  for (let i = 5; i < 9; i++) {
    const next = i === 8 ? 'DST' : `R${i + 1}`;
    const prev = i === 5 ? 'SRC' : `R${i}`;
    contacts.push(makeContact(`cs${cid++}`, prev, next, (i - 4) * 35 * 60_000, ((i - 4) * 35 + 25) * 60_000, { rateBps: 40, energyMj: 130, p: 0.94 }));
  }
  // Alternate resilient relay R9 bridging late blackout
  contacts.push(makeContact(`cs${cid++}`, 'SRC', 'R9', 50 * 60_000, 80 * 60_000, { rateBps: 45, energyMj: 120, p: 0.93 }));
  contacts.push(makeContact(`cs${cid++}`, 'R9', 'DST', 160 * 60_000, 220 * 60_000, { rateBps: 45, energyMj: 140, p: 0.92 }));

  const sampleShock = (r) => {
    const dead = {};
    for (let i = 0; i < 10; i++) if (r() < 0.25) dead[`R${i}`] = Math.round((0.15 + 0.7 * r()) * horizonMs);
    return { nodeDeathMs: dead, contactFactor: {}, weight: 1 };
  };
  const ensemble = Array.from({ length: 48 }, () => sampleShock(rng));
  const truth = sampleShock(rng);
  return { family: 'EU868_CONGESTED_SRD', nodes, contacts, source: 'SRC', destination: 'DST', startMs: 0, deadlineMs: horizonMs, payloadBytes, ensemble, truth };
}
