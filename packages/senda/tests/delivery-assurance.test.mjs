import test from 'node:test';
import assert from 'node:assert/strict';
import {
  betaCdf, betaQuantile, posteriorReliability, linkAvailability, RADIO_PROFILES, DEFAULT_HAZARDS,
  bearerSuccessInState, correlatedDeliveryProbability, exactOptimalAllocation, greedyAllocation, planAssuredDelivery,
  auditIndependentPlan, certifyPlan,
} from '../src/delivery-assurance.mjs';
import { deliveryProbability, planMultiBearer } from '../src/bearers.mjs';
import { mulberry32 } from '../src/opportunistic-routing.mjs';

const SCEN = {
  NORMAL: { ...DEFAULT_HAZARDS.NORMAL, prob: 0.25 },
  GRID_DOWN: { ...DEFAULT_HAZARDS.GRID_DOWN, prob: 0.35 },
  STORM: { ...DEFAULT_HAZARDS.STORM, prob: 0.2 },
  GRID_DOWN_STORM: { ...DEFAULT_HAZARDS.GRID_DOWN_STORM, prob: 0.2 },
};
const AVAILABLE = [{ id: 'PHONE_MESH' }, { id: 'CELL_DATA' }, { id: 'SMS' }, { id: 'MESHTASTIC' }, { id: 'IRIDIUM_SBD' }, { id: 'RELAY_INTERNET' }];

test('Beta: CDF y cuantil coinciden con formas cerradas', () => {
  // Beta(1,1) = uniforme; Beta(a,1): x^a; Beta(1,b): 1-(1-x)^b
  for (const x of [0.1, 0.37, 0.9]) {
    assert.ok(Math.abs(betaCdf(x, 1, 1) - x) < 1e-12);
    assert.ok(Math.abs(betaCdf(x, 3, 1) - x ** 3) < 1e-12);
    assert.ok(Math.abs(betaCdf(x, 1, 4) - (1 - (1 - x) ** 4)) < 1e-12);
  }
  // Beta(2,2): I_x = 3x² − 2x³ ; simetría I_x(a,b) = 1 − I_{1−x}(b,a)
  assert.ok(Math.abs(betaCdf(0.3, 2, 2) - (3 * 0.09 - 2 * 0.027)) < 1e-12);
  assert.ok(Math.abs(betaCdf(0.2, 5.4, 18.6) + betaCdf(0.8, 18.6, 5.4) - 1) < 1e-12);
  for (const q of [0.05, 0.5, 0.95]) assert.ok(Math.abs(betaCdf(betaQuantile(q, 5.4, 18.6), 5.4, 18.6) - q) < 1e-10);
});

test('Posterior Beta-Binomial: conjugación exacta y el intervalo se estrecha con datos', () => {
  const few = posteriorReliability({ p0: 0.6, successes: 3, failures: 17 });
  assert.equal(few.alpha, 0.6 * 4 + 3);
  assert.equal(few.beta, 0.4 * 4 + 17);
  assert.ok(Math.abs(few.mean - 5.4 / 24) < 1e-12);
  assert.ok(few.lower < few.mean && few.mean < few.upper);
  const many = posteriorReliability({ p0: 0.6, successes: 300, failures: 1700 });
  assert.ok(many.upper - many.lower < (few.upper - few.lower) / 5, 'con 100× datos el intervalo creíble debe estrecharse');
  assert.ok(Math.abs(many.mean - 0.15) < 0.002, 'los datos dominan al prior');
  assert.throws(() => posteriorReliability({ p0: 1.2 }), RangeError);
});

test('Física: la lluvia degrada la banda Ku y apenas la banda L o 868 MHz', () => {
  const ku = linkAvailability(RADIO_PROFILES.RELAY_INTERNET, 50);
  const lora = linkAvailability(RADIO_PROFILES.MESHTASTIC, 50);
  const iri = linkAvailability(RADIO_PROFILES.IRIDIUM_SBD, 50);
  assert.ok(ku.rainLossDb > 3, `Ku pierde ${ku.rainLossDb} dB`);
  assert.ok(lora.rainLossDb < 0.05 && iri.rainLossDb < 0.1);
  assert.ok(ku.pLink < linkAvailability(RADIO_PROFILES.RELAY_INTERNET, 0).pLink - 0.1);
  assert.ok(Math.abs(bearerSuccessInState('MESHTASTIC', 0.75, DEFAULT_HAZARDS.STORM) - 0.75) < 0.01);
  assert.ok(bearerSuccessInState('CELL_DATA', 0.5, DEFAULT_HAZARDS.GRID_DOWN) < 0.1);
  assert.equal(bearerSuccessInState('PHONE_MESH', 0.6, DEFAULT_HAZARDS.NORMAL), 0.6);
});

test('Correlación: con un único estado normal se reduce EXACTAMENTE al modelo independiente', () => {
  const groups = [{ id: 'PHONE_MESH', p: 0.6, shards: 2 }, { id: 'MESHTASTIC', p: 0.75, shards: 1 }, { id: 'IRIDIUM_SBD', p: 0.9, shards: 2 }];
  const corr = correlatedDeliveryProbability(groups, 3, { NORMAL: { ...DEFAULT_HAZARDS.NORMAL, prob: 1 } });
  assert.ok(Math.abs(corr.pDelivery - deliveryProbability(groups, 3)) < 1e-12);
  assert.ok(Math.abs(corr.pIndependentMarginal - corr.pDelivery) < 1e-12);
});

test('Correlación: la probabilidad exacta coincide con Monte Carlo (200 000 muestras)', () => {
  const groups = [{ id: 'CELL_DATA', p: 0.5, shards: 2 }, { id: 'SMS', p: 0.55, shards: 1 }, { id: 'RELAY_INTERNET', p: 0.6, shards: 2 }, { id: 'MESHTASTIC', p: 0.75, shards: 1 }];
  const k = 3;
  const exact = correlatedDeliveryProbability(groups, k, SCEN).pDelivery;
  const states = Object.entries(SCEN);
  const rng = mulberry32(2026);
  const N = 200000;
  let ok = 0;
  for (let i = 0; i < N; i++) {
    let u = rng(), h = states[states.length - 1][1];
    for (const [, s] of states) { if (u < s.prob) { h = s; break; } u -= s.prob; }
    let got = 0;
    for (const g of groups) if (rng() < bearerSuccessInState(g.id, g.p, h)) got += g.shards;
    if (got >= k) ok++;
  }
  const mc = ok / N, se = Math.sqrt((mc * (1 - mc)) / N);
  assert.ok(Math.abs(mc - exact) < 4 * se, `exacta ${exact} vs MC ${mc} ± ${se}`);
});

test('Correlación: la independencia SOBRESTIMA la fiabilidad con causa común', () => {
  const naive = planMultiBearer(380, AVAILABLE, { target: 0.99 });
  const audit = auditIndependentPlan(naive, SCEN);
  assert.ok(audit.claimed > 0.99, 'el planificador independiente promete > 99 %');
  assert.ok(audit.actual < audit.claimed - 0.02, `entrega real ${audit.actual} frente a ${audit.claimed} prometido`);
});

test('Optimización: brecha del voraz + búsqueda local frente al óptimo exacto (60 instancias aleatorias)', () => {
  const ids = ['CELL_DATA', 'SMS', 'MESHTASTIC', 'RELAY_INTERNET', 'PHONE_MESH', 'IRIDIUM_SBD'];
  const rng = mulberry32(7);
  let worstGap = 0, exactHits = 0;
  for (let t = 0; t < 60; t++) {
    const slots = Array.from({ length: 5 }, () => {
      const id = ids[Math.floor(rng() * ids.length)];
      return { id, p: 0.3 + 0.6 * rng(), cap: 1 + Math.floor(rng() * 3), costEUR: 0, latencyS: 1 };
    });
    const capTotal = slots.reduce((a, s) => a + s.cap, 0);
    const n = Math.min(capTotal, 3 + Math.floor(rng() * 5));
    const k = 1 + Math.floor(rng() * Math.min(3, n));
    const exact = exactOptimalAllocation(slots, n, k, SCEN);
    const greedy = greedyAllocation(slots, n, k, SCEN);
    assert.ok(greedy.p <= exact.p + 1e-12, 'el óptimo exacto es cota superior');
    worstGap = Math.max(worstGap, exact.p - greedy.p);
    if (exact.p - greedy.p < 1e-9) exactHits++;
  }
  assert.ok(worstGap < 0.005, `brecha máxima ${worstGap}`);
  assert.ok(exactHits >= 57, `óptimo exacto alcanzado en ${exactHits}/60 instancias`);
});

test('Plan garantizado: a igual probabilidad de canal supera al plan independiente con fallos correlacionados', () => {
  const naive = auditIndependentPlan(planMultiBearer(380, AVAILABLE, { target: 0.99 }), SCEN);
  const free = planAssuredDelivery(380, AVAILABLE, { reliability: 'mean', budgetEUR: 0, scenarios: SCEN });
  assert.equal(free.costEUR, 0);
  assert.ok(free.pDelivery > naive.actual + 0.02, `${free.pDelivery} vs ${naive.actual}`);
  assert.ok((1 - naive.actual) / (1 - free.pDelivery) > 3, 'al menos 3× menos fallos sin coste');
  assert.ok(free.n > 6, 'el precio es más tiempo de aire: más fragmentos que el plan ingenuo');
  // Con el mismo número de fragmentos que el ingenuo no hay ganancia: la mejora no es gratis.
  const same = planAssuredDelivery(380, AVAILABLE, { reliability: 'mean', budgetEUR: 0, scenarios: SCEN, maxFragments: 6 });
  assert.ok(Math.abs(same.pDelivery - naive.actual) < 1e-3);
  // Bandas de aficionado excluidas sin permiso de texto en claro.
  const amateur = planAssuredDelivery(120, [{ id: 'APRS' }, { id: 'QO100' }]);
  assert.equal(amateur.feasible, false);
});

test('Plan garantizado: la cota inferior creíble es más prudente que la media', () => {
  const lower = planAssuredDelivery(380, AVAILABLE, { scenarios: SCEN, credibility: 0.9 });
  const mean = planAssuredDelivery(380, AVAILABLE, { scenarios: SCEN, reliability: 'mean' });
  assert.ok(lower.pDelivery <= mean.pDelivery + 1e-9);
  // Con muchos recibos buenos de LoRa, el plan aprende y su cota inferior sube.
  const learned = planAssuredDelivery(380, AVAILABLE, { scenarios: SCEN, receipts: { MESHTASTIC: { successes: 480, failures: 20 } } });
  assert.ok(learned.learned.MESHTASTIC.lowerCredible > lower.learned.MESHTASTIC.lowerCredible + 0.3);
});

test('Certificado: SHA-256 determinista e independiente del orden de las claves', async () => {
  const plan = planAssuredDelivery(380, AVAILABLE, { scenarios: SCEN, reliability: 'mean' });
  const a = await certifyPlan({ len: 380, available: AVAILABLE }, plan);
  const b = await certifyPlan({ available: AVAILABLE, len: 380 }, JSON.parse(JSON.stringify(plan)));
  assert.match(a.sha256, /^[0-9a-f]{64}$/);
  assert.equal(a.sha256, b.sha256);
  const c = await certifyPlan({ len: 381, available: AVAILABLE }, plan);
  assert.notEqual(a.sha256, c.sha256);
});
