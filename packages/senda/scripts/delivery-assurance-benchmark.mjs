#!/usr/bin/env node
/**
 * Evidencia reproducible del Motor de Garantía de Entrega: plan independiente (bearers.mjs)
 * frente a plan con fallos correlacionados (delivery-assurance.mjs), con las MISMAS probabilidades
 * de canal. Escribe evidence/senda/delivery-assurance.json. Uso: node scripts/delivery-assurance-benchmark.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planMultiBearer } from '../src/bearers.mjs';
import { DEFAULT_HAZARDS, planAssuredDelivery, auditIndependentPlan, certifyPlan } from '../src/delivery-assurance.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const scenarios = {
  NORMAL: { ...DEFAULT_HAZARDS.NORMAL, prob: 0.25 },
  GRID_DOWN: { ...DEFAULT_HAZARDS.GRID_DOWN, prob: 0.35 },
  STORM: { ...DEFAULT_HAZARDS.STORM, prob: 0.2 },
  GRID_DOWN_STORM: { ...DEFAULT_HAZARDS.GRID_DOWN_STORM, prob: 0.2 },
};
const available = [{ id: 'PHONE_MESH' }, { id: 'CELL_DATA' }, { id: 'SMS' }, { id: 'MESHTASTIC' }, { id: 'IRIDIUM_SBD' }, { id: 'RELAY_INTERNET' }];
const lengthBytes = 380;
const r4 = (x) => +x.toFixed(4);

const naivePlan = planMultiBearer(lengthBytes, available, { target: 0.99 });
const naive = auditIndependentPlan(naivePlan, scenarios);
const rows = [];
for (const [label, opts] of [['0 €', { budgetEUR: 0 }], ['sin límite', {}], ['0 €, mismos 6 fragmentos', { budgetEUR: 0, maxFragments: 6 }]]) {
  const t0 = performance.now();
  const plan = planAssuredDelivery(lengthBytes, available, { reliability: 'mean', scenarios, ...opts });
  const ms = performance.now() - t0;
  const cert = await certifyPlan({ lengthBytes, available, scenarios, opts }, plan);
  rows.push({ budget: label, pDelivery: r4(plan.pDelivery), failureRate: r4(1 - plan.pDelivery), fragments: plan.n, k: plan.k, costEUR: plan.costEUR,
    worstState: { name: plan.worstState.name, pDelivery: r4(plan.worstState.pDelivery) }, failureReductionVsIndependent: +((1 - naive.actual) / (1 - plan.pDelivery)).toFixed(1), plannerMs: Math.round(ms), certificateSha256: cert.sha256 });
}
const evidence = {
  module: 'packages/senda/src/delivery-assurance.mjs', generatedAt: new Date().toISOString(), lengthBytes, available: available.map((a) => a.id), scenarios: Object.fromEntries(Object.entries(scenarios).map(([k, v]) => [k, v.prob])),
  claim: 'SIMULATED',
  note: 'Probabilidades de canal = valores de planificación de bearers.mjs; efectos de los estados de peligro = hipótesis declaradas. Comparación justa: ambos planes se evalúan con el mismo modelo de fallos correlacionados.',
  independentPlanner: { claimed: r4(naive.claimed), actual: r4(naive.actual), fragments: naivePlan.n, k: naivePlan.k, costEUR: naivePlan.costEUR, byState: naive.byState.map((s) => ({ name: s.name, pDelivery: r4(s.pDelivery) })) },
  assuredPlanner: rows,
};
mkdirSync(resolve(root, 'evidence/senda'), { recursive: true });
writeFileSync(resolve(root, 'evidence/senda/delivery-assurance.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ independent: evidence.independentPlanner, assured: rows.map(({ certificateSha256, ...r }) => r) }, null, 1));
